#!/usr/bin/env node
'use strict';
/* =========================================================================
   Octo-Shooter DENGE SİMÜLATÖRÜ (CLI)
   -------------------------------------------------------------------------
   index.html'i OLDUĞU GİBİ okur: <script> bloklarını çıkarır, sahte DOM /
   canvas / rAF / matchMedia / localStorage ile node:vm bağlamında çalıştırır.
   Çizim no-op, Math.random seed'li; oyun updateWave(1/60) ile ilerletilir,
   markette (ve varsa mutasyon ekranında) botlar karar verir.

   Modlar:
     node sim.js --runs 50 --strategy all            normal özet (F1 botları)
     node sim.js --accept [--runs 50]                DESIGN.md F2: 15 metrik GEÇTİ/KALDI
     node sim.js --cheat --runs 20                   yalnız hileli bot (F2 #7)
     node sim.js --wtest                             yalnız tek silah kalabalık testi (F2 #11)

   Kod: lib/game.js (vm çekirdeği), lib/bots.js (botlar), lib/run.js (koşu +
   kalabalık testi), lib/pool.js (worker havuzu), lib/ratings.js (silah puanı),
   lib/accept.js (F2 metrikleri), lib/report.js (normal özet). Bağımlılık yok.
========================================================================= */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { loadGameFromHtml } = require('./lib/game');
const { runPool } = require('./lib/pool');
const { getRatings, crowdTable, probe, median } = require('./lib/ratings');
const { F1_BOTS, LEGACY_BOTS, BOT_DESC } = require('./lib/bots');
const { summarize, printSummary } = require('./lib/report');
const { runAccept } = require('./lib/accept');

const DEFAULTS = {
  file: path.join(__dirname, '..', 'index.html'),
  runs: 50, seed: 1, strategy: 'all', maxWave: 60, json: null,
  fps: 60,              // dt = 1/fps. 30 → daha hızlı ama hızlı silahların DPS'i düşer (README)
  viewport: '390x844',  // oyunda S ölçeği ve düşman doğma mesafesi buna bağlı
  shopEarly: 45, shopLate: 30, shopEarlyUntil: 5,   // DESIGN.md: market w1–5 45 sn, sonra 30 sn
  playSpeed: 1, focus: 'Mermi+Uzun', stallSec: 600,
  rating: 'dynamic',    // dynamic | designer (tasarımcının statik RATING tablosu)
  wtestWave: 8, wtestSec: 40, wtestReps: 4,         // F2 #11 kalabalık testi
  cheatRuns: 20, cheatWave: 15, cheatLv: 4,         // F2 #7 hileli bot
  perfWave: 30, perfCpu: 4, perfSec: 20, noPerf: false,   // F2 #14
  workers: Math.max(1, Math.min(os.cpus().length, 8)),
  accept: false, cheat: false, wtest: false, quiet: false
};
const NUM = ['runs','seed','maxWave','fps','shopEarly','shopLate','shopEarlyUntil','playSpeed','stallSec','workers',
             'wtestWave','wtestSec','wtestReps','cheatRuns','cheatWave','cheatLv','perfWave','perfCpu','perfSec'];
const FLAGS = ['quiet','accept','cheat','wtest','noPerf'];

function parseArgs(argv){
  const o = Object.assign({}, DEFAULTS), given = new Set();
  for(let i = 0; i < argv.length; i++){
    const a = argv[i];
    if(a === '--help' || a === '-h'){ o.help = true; continue; }
    if(!a.startsWith('--')) continue;
    const k = a.slice(2);
    if(FLAGS.includes(k)){ o[k] = true; continue; }
    const next = argv[i + 1];
    if(next === undefined || next.startsWith('--')){ console.error(`Uyarı: --${k} için değer yok`); continue; }
    i++; given.add(k);
    o[k] = NUM.includes(k) ? Number(next) : next;
  }
  /* Kabul modunda maxWave varsayılanı 45 (37/38 sınırlarının üstü; geç dalgalar pahalı) */
  if(o.accept && !given.has('maxWave')) o.maxWave = 45;
  return o;
}

const HELP = `Octo-Shooter denge simülatörü
Modlar:
  (varsayılan)          botlarla koşu + özet
  --accept              DESIGN.md F2 kabul ölçütleri (15 metrik, GEÇTİ/KALDI)
  --cheat               yalnız hileli bot (dalga ${DEFAULTS.cheatWave}'te tüm kollar Lv${DEFAULTS.cheatLv}, tılsımlar tavan)
  --wtest               yalnız tek silah kalabalık testi (dalga ${DEFAULTS.wtestWave}, Lv1/Lv3)
Genel:
  --file <yol>          index.html (varsayılan ../index.html)
  --runs <n>            bot başına koşu (50)
  --seed <n>            ana seed (1)
  --strategy <liste>    all (=F1: ${F1_BOTS.join(',')}) | legacy (=${LEGACY_BOTS.join(',')}) | every | virgüllü liste
  --maxWave <n>         bu dalgayı bitiren koşu durur (60; --accept'te 45)
  --json <dosya>        ham koşular + özet/metrikler
  --fps <n>             dt=1/fps (60)
  --viewport <WxH>      390x844 (telefon) | 1280x800 (masaüstü)
  --shopEarly/--shopLate/--shopEarlyUntil   market süresi (45/30/5)
  --playSpeed <1|2|4>   gerçek süre tahmini için hız
  --rating <mod>        dynamic (oyunda ölçülen) | designer (statik tablo)
  --focus <A+B>         legacy 'focus' botunun sınıfları
  --workers <n>         worker sayısı (CPU sayısı)
Kabul modu:
  --cheatRuns/--cheatWave/--cheatLv       hileli bot (20 / 15 / 4)
  --wtestWave/--wtestSec/--wtestReps      kalabalık testi (8 / 40 / 4)
  --perfWave/--perfCpu/--perfSec/--noPerf performans (30 / 4x / 20 sn)
  --quiet               ilerleme yazma`;

function resolveBots(s){
  if(s === 'all' || s === 'f1') return F1_BOTS.slice();
  if(s === 'legacy') return LEGACY_BOTS.slice();
  if(s === 'every') return F1_BOTS.concat(LEGACY_BOTS);
  return String(s).split(',').map(x => x.trim()).filter(Boolean);
}

async function main(){
  const opts = parseArgs(process.argv.slice(2));
  if(opts.help){ console.log(HELP); return; }
  opts.file = path.resolve(opts.file);
  const html = fs.readFileSync(opts.file, 'utf8');     // BİR kez okunur; worker'lara metin gider
  const gameInfo = loadGameFromHtml(html);
  const log = m => { if(!opts.quiet) process.stderr.write(m + '\n'); };
  const prog = label => (d, n) => { if(!opts.quiet && (d % 20 === 0 || d === n)) process.stderr.write(`  ${label} ${d}/${n}\r`); };

  if(opts.accept){
    const res = await runAccept(html, gameInfo, opts, log);
    process.exitCode = res.metrics.some(m => m.pass === false) ? 1 : 0;
    return;
  }

  if(opts.wtest){
    const t = await crowdTable(html, opts, [1, 2, 3], opts.wtestReps, opts.workers, prog('kalabalık'));
    const ids = Object.keys(t.mean).sort((a, b) => t.mean[b][3] - t.mean[a][3]);
    const m1 = median(ids.map(id => t.mean[id][1])), m3 = median(ids.map(id => t.mean[id][3]));
    console.log(`\nTek silah kalabalık DPS — dalga ${opts.wtestWave}, ${opts.wtestSec} sn, ${opts.wtestReps} tekrar (index.html ${gameInfo.hash})`);
    console.log('silah        Lv1     Lv2     Lv3   Lv1/med  Lv3/med');
    for(const id of ids){
      const v = t.mean[id];
      console.log(id.padEnd(10) + [v[1], v[2], v[3]].map(x => x.toFixed(1).padStart(8)).join('') +
                  (v[1] / m1).toFixed(2).padStart(9) + (v[3] / m3).toFixed(2).padStart(9) + (v[3] < 0.6 * m3 ? '  < 0,6×' : ''));
    }
    if(t.errors.length) console.log('Hatalar:\n  ' + t.errors.slice(0, 10).join('\n  '));
    if(opts.json) fs.writeFileSync(opts.json, JSON.stringify(t.mean, null, 1));
    return;
  }

  const bots = opts.cheat ? ['orta'] : resolveBots(opts.strategy);
  for(const b of bots) if(!BOT_DESC[b]){ console.error(`Bilinmeyen bot: ${b} (seçenekler: ${Object.keys(BOT_DESC).join(', ')})`); process.exit(2); }
  const ratings = await getRatings(html, opts, opts.workers, log);
  const jobs = [];
  for(let i = 0; i < opts.runs; i++) for(const b of bots) jobs.push({ type: 'run', bot: b, i, cheat: opts.cheat });
  log(`${jobs.length} koşu, ${opts.workers} worker, dt=1/${opts.fps}, viewport ${opts.viewport}`);
  const t0 = Date.now();
  const runs = await runPool(jobs, { html, opts, ratings, workers: opts.workers, onProgress: prog('koşu') });
  const elapsed = Date.now() - t0;
  const pr = probe(html, opts);
  const WMAP = {};
  for(const id in pr.W) WMAP[id] = { name: pr.W[id].name, price: pr.W[id].price, cls: [...(pr.W[id].cls || [])] };
  const sum = summarize(runs, opts, gameInfo, WMAP);
  printSummary(sum, runs, opts, gameInfo, elapsed, WMAP);
  if(opts.json){
    const meta = { file: opts.file, htmlHash: gameInfo.hash, date: new Date().toISOString(), opts, ratings,
                   bots: Object.fromEntries(bots.map(b => [b, BOT_DESC[b]])), elapsedMs: elapsed };
    fs.writeFileSync(opts.json, JSON.stringify({ meta, summary: sum, runs }, null, 1));
    console.log(`\nJSON yazıldı: ${path.resolve(opts.json)}`);
  }
  process.exitCode = runs.some(r => r.errors.length || r.anomalies.length) ? 1 : 0;
}

if(require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { parseArgs, DEFAULTS };
