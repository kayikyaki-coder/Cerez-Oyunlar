'use strict';
/* =========================================================================
   lib/accept.js — DESIGN.md F2 kabul ölçütleri (15 metrik)
   Akış: (1) tek silah kalabalık testi Lv1+Lv3 → silah puanları + #11
         (2) 10 F1 botu × N koşu  (3) hileli bot × M koşu (#7)
         (4) perf.mjs (Playwright) → #14   (5) metrikler → GEÇTİ/KALDI tablosu
========================================================================= */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { runPool } = require('./pool');
const { crowdTable, ratingsFrom, median } = require('./ratings');
const { F1_BOTS, REF_BOTS, ARCHETYPES } = require('./bots');

/* "Mevcut 19 silah" (F2 #11 yeni-silah ayrımı ve #15 regresyonu için sabit referans) */
const ORIGINAL_19 = ['tabanca','midye','zipkin','taramali','pompali','vampir','levye','kurek','yumruk','bumerang',
  'asa','yildirim','zehir','buz','murekkep','alev','testere','mancinik','diken'];

function q(arr, p){
  const s = arr.filter(Number.isFinite).sort((a, b) => a - b);
  if(!s.length) return NaN;
  const pos = (s.length - 1) * p, lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}
const f1 = x => Number.isFinite(x) ? (Math.round(x * 10) / 10).toString() : '-';
const pct = x => Number.isFinite(x) ? (x * 100).toFixed(1) + '%' : '-';
const pad = (s, n) => { s = String(s); return s.length >= n ? s : s + ' '.repeat(n - s.length); };
const lpad = (s, n) => { s = String(s); return s.length >= n ? s : ' '.repeat(n - s.length) + s; };
const inR = (x, a, b) => Number.isFinite(x) && x >= a && x <= b;

/* Koşu → ölüm dalgası (cap'e ulaşan = maxWave+1, sansürlü) ve dakika */
const dw = (r, opts) => r.reachedCap ? opts.maxWave + 1 : (r.deathWave ?? NaN);
const mins = r => r.estRealSec / 60;

function botStats(runs, opts){
  const out = {};
  for(const b of F1_BOTS.concat(REF_BOTS)){
    const rs = runs.filter(r => r.bot === b && !r.cheat);
    if(!rs.length) continue;
    const w = rs.map(r => dw(r, opts)), m = rs.map(mins);
    const deaths = rs.filter(r => r.deathWave != null);
    out[b] = {
      n: rs.length, wMed: q(w, .5), wP10: q(w, .1), wP90: q(w, .9), wMin: Math.min(...w), wMax: Math.max(...w),
      mMed: q(m, .5), mP10: q(m, .1), mP90: q(m, .9), mMin: Math.min(...m), mMax: Math.max(...m),
      bossWaveDeath: deaths.length ? deaths.filter(r => r.deathWave % 5 === 0).length / deaths.length : NaN,
      bossAlive: deaths.length ? deaths.filter(r => r.bossAliveAtDeath).length / deaths.length : NaN,
      cap: rs.filter(r => r.reachedCap).length,
      errors: rs.reduce((a, r) => a + r.errors.length + r.anomalies.length, 0)
    };
  }
  return out;
}

function computeMetrics(ctx){
  const { runs, cheatRuns, crowd, perf, opts } = ctx;
  const S = botStats(runs, opts);
  const std = runs.filter(r => !r.cheat && F1_BOTS.includes(r.bot));      // referans botlar (iyi2n/ortan) hariç
  const M = [];
  const add = (id, name, value, target, pass, note) => M.push({ id, name, value, target, pass, note: note || '' });
  const need = b => S[b] || { n: 0 };

  /* 1–3 orta */
  const o = need('orta');
  add(1, 'orta medyan ölüm dalgası', f1(o.wMed), '21–24', inR(o.wMed, 21, 24));
  add(2, 'orta medyan süre (dk)', f1(o.mMed), '27–33', inR(o.mMed, 27, 33));
  add(3, 'orta p10 / p90 dalga', `${f1(o.wP10)} / ${f1(o.wP90)}`, 'p10 ≥ 17, p90 ≤ 27', o.wP10 >= 17 && o.wP90 <= 27);
  /* 4 zayıf */
  const z = need('zayif');
  add(4, 'zayıf medyan süre (dalga)', `${f1(z.mMed)} dk (dalga ${f1(z.wMed)})`, '16–21 dk (dalga 12–15)',
      inR(z.mMed, 16, 21) && inR(z.wMed, 12, 15));
  /* 5 kötü */
  const k = need('kotu');
  add(5, 'kötü en erken ölüm', `dalga ${f1(k.wMin)}, ${f1(k.mMin)} dk (n=${k.n})`, 'hiçbiri < dalga 8, ≥ 10 dk',
      k.wMin >= 8 && k.mMin >= 10);
  /* 6 iyi2 */
  const i2 = need('iyi2');
  add(6, 'iyi2 medyan', `dalga ${f1(i2.wMed)}, ${f1(i2.mMed)} dk`, 'dalga 28–31, ≥ 38 dk', inR(i2.wMed, 28, 31) && i2.mMed >= 38);
  /* 7 en uzun koşu + hileli bot */
  const allW = std.map(r => dw(r, opts)), allM = std.map(mins);
  const maxW = Math.max(...allW), maxM = Math.max(...allM);
  const capped = std.filter(r => r.reachedCap).length;
  const chW = cheatRuns.map(r => dw(r, opts));
  const chMax = chW.length ? Math.max(...chW) : NaN;
  add(7, 'en uzun koşu / hileli bot', `dalga ${f1(maxW)} (${f1(maxM)} dk); hileli maks dalga ${f1(chMax)} (med ${f1(q(chW, .5))}, n=${chW.length})`,
      'tüm botlar ≤ 37 ve < 52 dk; hileli ≤ 38',
      maxW <= 37 && maxM < 52 && capped === 0 && chW.length > 0 && chMax <= 38,
      capped ? `${capped} koşu maxWave=${opts.maxWave} sınırına ulaştı` : '');
  /* 8 archetype çeşitliliği */
  const arch = Object.keys(ARCHETYPES).filter(a => S[a]);
  const am = arch.map(a => S[a].wMed);
  const over20 = am.filter(x => x > 20).length, spread = Math.max(...am) - Math.min(...am);
  add(8, 'strateji çeşitliliği', `${over20}/${arch.length} archetype > 20; fark ${f1(spread)} (${arch.map(a => `${a} ${f1(S[a].wMed)}`).join(', ')})`,
      `≥ 5/${arch.length} medyanı > 20; en iyi–en kötü ≤ 5 (Kontrol dahil)`, over20 >= Math.ceil(arch.length * 0.7) && spread <= 5);
  /* 9 tek silah hakimiyeti (son dalga, silah örneği) */
  const ts = std.map(r => r.lastWaveTopShare).filter(Number.isFinite);
  const over60 = ts.filter(x => x > 0.60).length / Math.max(1, ts.length), maxTs = Math.max(...ts);
  add(9, 'tek silah hakimiyeti (son dalga)', `medyan ${pct(q(ts, .5))}; >%60: ${pct(over60)}; maks ${pct(maxTs)}`,
      'medyan ≤ %35; >%60 ≤ %5; hiçbiri > %75', q(ts, .5) <= 0.35 && over60 <= 0.05 && maxTs <= 0.75);
  /* 10 boss ölüm payı (tüm F1 botları) */
  const deaths = std.filter(r => r.deathWave != null);
  const bossShare = deaths.filter(r => r.deathWave % 5 === 0).length / Math.max(1, deaths.length);
  add(10, 'boss dalgasında ölüm payı', `${pct(bossShare)} (orta ${pct(o.bossWaveDeath)}; boss canlıyken ölüm ${pct(deaths.filter(r => r.bossAliveAtDeath).length / Math.max(1, deaths.length))})`,
      '%15–40', inR(bossShare, 0.15, 0.40));
  /* 11 silah kullanılabilirliği (kalabalık testi) */
  const lv3 = Object.fromEntries(Object.entries(crowd.mean).map(([id, v]) => [id, v[3]]));
  const lv1 = Object.fromEntries(Object.entries(crowd.mean).map(([id, v]) => [id, v[1]]));
  const med3 = median(Object.values(lv3)), med1 = median(Object.values(lv1));
  const weak = Object.keys(lv3).filter(id => lv3[id] < 0.6 * med3);
  const newIds = Object.keys(lv1).filter(id => !ORIGINAL_19.includes(id));
  const newBad = newIds.filter(id => !inR(lv1[id] / med1, 0.7, 1.3));
  add(11, 'silah kullanılabilirliği (dalga ' + opts.wtestWave + ' kalabalık)',
      `Lv3 medyan ${f1(med3)}; <0,6×: ${weak.length ? weak.map(id => `${id} ${(lv3[id] / med3).toFixed(2)}×`).join(', ') : 'yok'}; ` +
      `yeni silah: ${newIds.length ? newIds.map(id => `${id} ${(lv1[id] / med1).toFixed(2)}×`).join(', ') : 'yok'}`,
      'her silah Lv3 ≥ 0,6×medyan; yeniler Lv1 0,7–1,3×', weak.length === 0 && newBad.length === 0,
      newIds.length ? '' : 'yeni silah yok → ikinci koşul uygulanmadı');
  /* 12 dalga süresi */
  const normal = [], boss = [];
  let over90 = 0;
  for(const r of std){
    let any90 = false;
    r.waves.forEach((t, j) => {
      const w = r.startWave + j;
      if(t > 90) any90 = true;
      if(r.deathWave === w) return;                       // ölünen dalga yarım kalır
      if(w % 5 === 0) boss.push(t); else if(w >= 3) normal.push(t);
    });
    if(any90) over90++;
  }
  const o90 = over90 / Math.max(1, std.length);
  add(12, 'dalga süresi (1x, sn)', `normal med ${f1(q(normal, .5))} (p10 ${f1(q(normal, .1))}, p90 ${f1(q(normal, .9))}); ` +
      `boss p95 ${f1(q(boss, .95))} (maks ${f1(Math.max(...boss))}); >90 sn dalgalı koşu ${pct(o90)}`,
      'normal 40–58; boss ≤ 75; >90 sn < %2', inR(q(normal, .5), 40, 58) && q(boss, .95) <= 75 && o90 < 0.02,
      'normal = boss dışı w≥3 tamamlanan dalga (medyan); boss = p95');
  /* 13 ilerleme */
  const g20 = runs.filter(r => r.bot === 'orta' && !r.cheat && r.goldAfterShop[20] != null).map(r => r.goldAfterShop[20]);
  add(13, 'orta dalga 20 market sonu kalan altın', g20.length ? `medyan ${f1(q(g20, .5))} (n=${g20.length})` : 'ölçülemedi: orta hiç dalga 20\'ye ulaşmadı',
      '< 40', g20.length > 0 && q(g20, .5) < 40);
  /* 14 performans: fps (Playwright) + aynı anda düşman (headless zirve testi) */
  const simMax = std.reduce((a, r) => r.maxEnemies > a.n ? { n: r.maxEnemies, w: r.maxEnemiesWave } : a, { n: 0, w: 0 });
  const pk = ctx.peak ? ctx.peak.peak : NaN;
  const enemyOk = Number.isFinite(pk) && pk <= 140;
  const simTxt = `dalga ${opts.perfWave} zirve (ölümsüz, 90 sn) ${f1(pk)}; bot oyunlarında maks ${simMax.n} @dalga ${simMax.w}`;
  if(perf && !perf.error){
    add(14, 'performans (dalga ' + perf.wave + ', telefon)', `fps ${f1(perf.fpsThrottled)} @${perf.cpuThrottle}x CPU (${f1(perf.fps)} @1x, p95 kare ${f1(perf.p95Throttled)} ms); ${simTxt}`,
        '≥ 45 fps; düşman ≤ 140', perf.fpsThrottled >= 45 && enemyOk,
        'headless Chromium yazılım rasterı + CPU kısıtlama; fps kaba, gerçek cihazda doğrulanmalı');
  }else{
    add(14, 'performans (yalnız düşman sayısı)', (perf && perf.error ? 'fps HATA: ' + perf.error + '; ' : 'fps atlandı; ') + simTxt,
        '≥ 45 fps; düşman ≤ 140', enemyOk ? null : false, enemyOk ? 'fps ölçülmedi' : '');
  }
  /* 15 regresyon: her orijinal silah ≥1 archetype'ın son kadrosunda ≥ %20 koşuda */
  const pres = {};
  for(const id of ORIGINAL_19){
    let best = { a: null, p: 0 };
    for(const a of arch){
      const rs = runs.filter(r => r.bot === a && !r.cheat);
      const p = rs.filter(r => (r.finalBuild.arms || []).some(x => x && x.split(':')[0] === id)).length / Math.max(1, rs.length);
      if(p > best.p) best = { a, p };
    }
    pres[id] = best;
  }
  const missing = ORIGINAL_19.filter(id => pres[id].p < 0.20);
  add(15, 'regresyon (19 silah archetype kadrosunda)', missing.length ? 'eksik: ' + missing.map(id => `${id} ${pct(pres[id].p)}`).join(', ') : 'hepsi ≥ %20',
      'her silah ≥1 archetype\'ta ≥ %20', missing.length === 0);
  /* ---- Yeni ölçütler (mekanik paketi) ---- */
  /* 16 sıfır-hasar dalga payı (w6–20, hayatta tamamlanan dalgalar; kalkansız eşitler dahil) */
  let zw = 0, tw = 0;
  for(const r of std.filter(r => ['orta','iyi2'].concat(Object.keys(ARCHETYPES)).includes(r.bot))){
    r.waves.forEach((t, j) => {
      const w = r.startWave + j;
      if(w < 6 || w > 20 || r.deathWave === w || !r.waveTaken) return;
      tw++; if(r.waveTaken[j] <= 0.001) zw++;
    });
  }
  const zeroShare = tw ? zw / tw : NaN;
  add(16, 'sıfır-hasar dalga payı (w6–20)', `${pct(zeroShare)} (${zw}/${tw} dalga)`, '≤ %50 (önceki ≈ %67–91)', Number.isFinite(zeroShare) && zeroShare <= 0.50);
  /* 17 boss etkisi: w10–20 boss karşılaşmalarında ahtapota ulaşma + verdiği hasar (maks canın %'si) */
  const bl = std.filter(r => ['orta','iyi2'].concat(Object.keys(ARCHETYPES)).includes(r.bot))
                .flatMap(r => (r.bossLog || []).filter(b => b.wave >= 10 && b.wave <= 20).map(b => Object.assign({ maxHp: r.finalBuild.maxHp || 100 }, b)));
  const reachShare = bl.length ? bl.filter(b => b.reach).length / bl.length : NaN;
  const dealtPct = bl.map(b => b.dealt / Math.max(1, b.maxHp));
  const dealtMed = q(dealtPct, .5);
  add(17, 'boss etkisi (w10–20)', `ahtapota ulaşma ${pct(reachShare)}, verdiği hasar medyan maks canın ${pct(dealtMed)} (p90 ${pct(q(dealtPct, .9))}), n=${bl.length}; ` +
      `boss-dalga ölüm w10–20 ${pct(bossDeathMid(std))}`, 'ulaşma ≥ %50 ve medyan hasar ≥ %8 maks can; w10–20 boss-dalga ölümü %5–20',
      reachShare >= 0.5 && dealtMed >= 0.08 && inR(bossDeathMid(std), 0.05, 0.20));
  /* 18 kalkan etkisi: iyi2 (kalkan 0,8) − iyi2n (kalkansız) medyan dalga farkı */
  const i2n = S.iyi2n, on = S.ortan;
  if(i2n && i2n.n){
    const d = i2.wMed - i2n.wMed, d2 = (S.orta && on) ? S.orta.wMed - on.wMed : NaN;
    add(18, 'aktif girdi etkisi (kalkan+işaret)', `iyi2 ${f1(i2.wMed)} vs kalkansız ${f1(i2n.wMed)} (Δ ${f1(d)}); orta ${f1(S.orta.wMed)} vs ${f1(on ? on.wMed : NaN)} (Δ ${f1(d2)}); ` +
        `iyi2 savuş/koşu ${f1(avg(std.filter(r => r.bot === 'iyi2').map(r => r.parries)))}`, '0 ≤ Δ ≤ +3 dalga (oyun kolaylaşmasın, anlamlı olsun)', d >= 0 && d <= 3);
  }else add(18, 'aktif girdi etkisi (kalkan+işaret)', 'referans bot koşusu yok (--refRuns 0)', '0 ≤ Δ ≤ +3 dalga', null);
  /* 19 hasar kaynağı çeşitliliği: en çok hasar veren 3 kaynak payı + tek kaynak payı */
  const tkSum = {};
  for(const r of std) for(const k in (r.taken || {})) tkSum[k] = (tkSum[k] || 0) + r.taken[k];
  const tkTot = Object.values(tkSum).reduce((a, b) => a + b, 0);
  const tkSorted = Object.entries(tkSum).sort((a, b) => b[1] - a[1]);
  const top3 = tkSorted.slice(0, 3).reduce((a, [, v]) => a + v, 0) / Math.max(1, tkTot);
  const top1 = tkSorted.length ? tkSorted[0][1] / Math.max(1, tkTot) : NaN;
  add(19, 'hasar kaynağı çeşitliliği', `ilk 3 kaynak ${pct(top3)} (${tkSorted.slice(0, 5).map(([k, v]) => `${k} ${pct(v / tkTot)}`).join(', ')})`,
      'ilk 3 ≤ %60 ve tek kaynak ≤ %30 (önceki %76 / %36)', top3 <= 0.60 && top1 <= 0.30);
  /* 20 Fener Balığı / boss hasarsızlığı: her boss türü ahtapota en az bir kez hasar vermiş mi */
  const bt = {};
  for(const r of std) for(const b of (r.bossLog || [])){ const o = bt[b.type] = bt[b.type] || { n: 0, dealt: 0, hit: 0 }; o.n++; o.dealt += b.dealt; if(b.dealt > 0) o.hit++; }
  const noHit = Object.keys(bt).filter(k => bt[k].hit / bt[k].n < 0.5);
  add(20, 'boss türü başına hasar', Object.entries(bt).map(([k, o]) => `${k} ${pct(o.hit / o.n)} hasar verdi (ort ${Math.round(o.dealt / o.n)})`).join('; ') || 'boss karşılaşması yok',
      'her boss türü karşılaşmaların ≥ %50\'sinde hasar vermeli (Fener Balığı 0 olmasın)', Object.keys(bt).length > 0 && noHit.length === 0);
  return { metrics: M, botStats: S, presence: pres, crowdLv1: lv1, crowdLv3: lv3 };
}

const avg = a => { const x = a.filter(Number.isFinite); return x.length ? x.reduce((s, v) => s + v, 0) / x.length : NaN; };
/* w10–20 boss dalgalarında ölenlerin, o dalgaya ulaşanlara oranı */
function bossDeathMid(std){
  let reached = 0, died = 0;
  for(const r of std){
    for(const w of [10, 15, 20]){
      const last = r.deathWave != null ? r.deathWave : (r.reachedCap ? 99 : 0);
      if(last >= w){ reached++; if(r.deathWave === w) died++; }
    }
  }
  return reached ? died / reached : NaN;
}

function printAccept(res, ctx, elapsedMs){
  const { opts, gameInfo } = ctx;
  const L = [];
  L.push('');
  L.push(`=== F2 KABUL ÖLÇÜTLERİ — index.html ${gameInfo.hash} (${gameInfo.lines} satır) ===`);
  L.push(`bot başına ${opts.runs} koşu, hileli ${opts.cheatRuns} koşu, maxWave ${opts.maxWave}, dt=1/${opts.fps}, viewport ${opts.viewport}, ` +
         `market ${opts.shopEarly} sn (≤w${opts.shopEarlyUntil}) / ${opts.shopLate} sn, puan=${opts.rating}, süre ${(elapsedMs / 1000).toFixed(0)} sn`);
  L.push('');
  L.push(pad('bot', 9) + lpad('n', 4) + lpad('dalga p10/med/p90', 20) + lpad('min–maks', 10) + lpad('dk p10/med/p90', 20) + lpad('boss-dalga ölüm', 17) + lpad('hata', 6));
  for(const b in res.botStats){
    const s = res.botStats[b];
    L.push(pad(b, 9) + lpad(s.n, 4) + lpad(`${f1(s.wP10)}/${f1(s.wMed)}/${f1(s.wP90)}`, 20) + lpad(`${s.wMin}–${s.wMax}`, 10) +
           lpad(`${f1(s.mP10)}/${f1(s.mMed)}/${f1(s.mP90)}`, 20) + lpad(pct(s.bossWaveDeath), 17) + lpad(s.errors, 6));
  }
  L.push('');
  L.push(lpad('#', 3) + '  ' + pad('metrik', 46) + pad('sonuç', 8) + 'ölçülen  |  hedef');
  for(const m of res.metrics){
    const st = m.pass === null ? 'ATLANDI' : m.pass ? 'GEÇTİ' : 'KALDI';
    L.push(lpad(m.id, 3) + '  ' + pad(m.name, 46) + pad(st, 8) + m.value + '  |  ' + m.target + (m.note ? `  [${m.note}]` : ''));
  }
  const ok = res.metrics.filter(m => m.pass === true).length, bad = res.metrics.filter(m => m.pass === false).length;
  L.push('');
  L.push(`TOPLAM: ${ok} GEÇTİ, ${bad} KALDI, ${res.metrics.length - ok - bad} ATLANDI`);
  L.push('');
  L.push('Kalabalık DPS (tek silah, dalga ' + opts.wtestWave + ', ' + opts.wtestSec + ' sn, ' + opts.wtestReps + ' tekrar) Lv1 / Lv3:');
  const ids = Object.keys(res.crowdLv3).sort((a, b) => res.crowdLv3[b] - res.crowdLv3[a]);
  for(let j = 0; j < ids.length; j += 4)
    L.push('  ' + ids.slice(j, j + 4).map(id => pad(`${id} ${f1(res.crowdLv1[id])}/${f1(res.crowdLv3[id])}`, 24)).join(''));
  const errs = ctx.runs.concat(ctx.cheatRuns).flatMap(r => r.errors.concat(r.anomalies).map(e => `[${r.strategy}#${r.run}] ${e}`));
  if(errs.length){ L.push(''); L.push(`Hata/anomali: ${errs.length}`); errs.slice(0, 10).forEach(e => L.push('  ' + e)); }
  console.log(L.join('\n'));
}

/* perf.mjs'i alt süreç olarak çalıştır; sonuç son satırdaki PERF_JSON */
function runPerf(opts, build, log){
  const perfPath = path.join(__dirname, '..', 'perf.mjs');
  if(!fs.existsSync(path.join(__dirname, '..', 'node_modules', 'playwright'))) return { error: 'playwright kurulu değil (npm install)' };
  const dir = path.join(__dirname, '..', '.cache');
  fs.mkdirSync(dir, { recursive: true });
  const bf = path.join(dir, 'perf-build.json');
  fs.writeFileSync(bf, JSON.stringify(build));
  if(log) log(`Performans ölçümü (Playwright, dalga ${build.wave})...`);
  const r = spawnSync(process.execPath, [perfPath, '--file', opts.file, '--build', bf, '--wave', String(build.wave),
    '--cpu', String(opts.perfCpu), '--seconds', String(opts.perfSec)], { encoding: 'utf8', timeout: 10 * 60 * 1000 });
  const line = (r.stdout || '').split('\n').find(l => l.startsWith('PERF_JSON '));
  if(!line) return { error: ((r.stderr || '') + (r.stdout || '')).trim().split('\n').slice(-3).join(' | ') || 'çıktı yok' };
  return JSON.parse(line.slice(10));
}

async function runAccept(html, gameInfo, opts, log){
  let ctxPeak = null;
  const t0 = Date.now();
  const prog = label => (d, n) => { if(!opts.quiet && (d % 25 === 0 || d === n)) process.stderr.write(`  ${label} ${d}/${n}\r`); };
  log(`[1/4] Tek silah kalabalık testi: ${opts.wtestReps} tekrar × Lv1+Lv3`);
  const crowd = await crowdTable(html, opts, [1, 3], opts.wtestReps, opts.workers, prog('kalabalık'));
  const lv1 = {}; for(const id in crowd.mean) lv1[id] = crowd.mean[id][1];
  const ratings = ratingsFrom(crowd.probe, lv1, opts.rating);
  log('\n  puanlar: ' + Object.entries(ratings).filter(([k]) => k[0] !== '_').sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(', '));
  log(`[2/4] ${F1_BOTS.length} bot × ${opts.runs} koşu + hileli ${opts.cheatRuns} koşu`);
  const jobs = [];
  /* uzun koşan botlar önce kuyruğa (yük dengesi) */
  const order = ['iyi2','kontrol','yakin','cubuk','kan','mermi','uzun','buyuates','orta','zayif','kotu'].filter(b => F1_BOTS.includes(b));
  for(let i = 0; i < opts.cheatRuns; i++) jobs.push({ type: 'run', bot: 'orta', i, cheat: true });
  for(const b of order) for(let i = 0; i < opts.runs; i++) jobs.push({ type: 'run', bot: b, i });
  for(const b of REF_BOTS) for(let i = 0; i < (opts.refRuns || 0); i++) jobs.push({ type: 'run', bot: b, i });
  const all = await runPool(jobs, { html, opts, ratings, workers: opts.workers, onProgress: prog('koşu') });
  const runs = all.filter(r => !r.cheat), cheatRuns = all.filter(r => r.cheat);
  /* sim'den alınmış build: en derine inen orta/iyi2 koşusunun son kadrosu */
  const src = runs.filter(r => r.bot === 'iyi2' || r.bot === 'orta').sort((a, b) => dw(b, opts) - dw(a, opts))[0];
  const build = { wave: opts.perfWave, arms: src ? src.finalBuild.arms : [], trinkets: src ? src.finalBuild.trinkets : {},
                  from: src ? `${src.bot}#${src.run} (öldüğü dalga ${src.deathWave})` : 'yok' };
  log(`\n[3/4] Dalga ${opts.perfWave} düşman zirvesi (headless, ölümsüz, build: ${build.from})` + (opts.noPerf ? '' : ' + Playwright fps'));
  const peaks = await runPool([0, 1, 2].map(rep => ({ type: 'peak', wave: opts.perfWave, build, rep, sec: 90 })), { html, opts, workers: opts.workers });
  const peak = Math.max(...peaks.map(p => p.maxEnemies));
  let perf = opts.noPerf ? null : runPerf(opts, build, log);
  if(perf) perf.build = build.from;
  ctxPeak = { peak, errors: peaks.filter(p => p.error).map(p => p.error) };
  log('[4/4] Metrikler');
  const ctx = { runs, cheatRuns, crowd, perf, opts, gameInfo, peak: ctxPeak };
  const res = computeMetrics(ctx);
  printAccept(res, ctx, Date.now() - t0);
  if(opts.json){
    fs.writeFileSync(opts.json, JSON.stringify({ meta: { mode: 'accept', htmlHash: gameInfo.hash, date: new Date().toISOString(), opts, ratings, perf },
      metrics: res.metrics, botStats: res.botStats, presence: res.presence, crowd: crowd.mean, runs, cheatRuns }, null, 1));
    console.log(`\nJSON yazıldı: ${path.resolve(opts.json)}`);
  }
  return res;
}

module.exports = { runAccept, computeMetrics, ORIGINAL_19 };
