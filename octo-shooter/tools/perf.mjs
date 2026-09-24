#!/usr/bin/env node
/* =========================================================================
   Octo-Shooter PERFORMANS ÖLÇÜMÜ (DESIGN.md F2 #14) — Playwright + Chromium
   -------------------------------------------------------------------------
   Telefon viewport'unda (390x844, DPR 2, dokunmatik) sayfayı açar, sim'den
   alınmış bir build'i (kollar + tılsımlar) oyunun kendi global'leriyle
   (P, applyTrinket, startWave — sayfa bağlamındaki top-level let/const'lar
   page.evaluate'ten erişilebilir; index.html'e hook gerekmez) yükler, dalgayı
   N'e ayarlar, ahtapotu ölümsüz yapar ve dalgayı başlatır. Sonra rAF kare
   aralıklarını ve aynı anda ekrandaki düşman sayısını ölçer:
     geçiş 1: CPU kısıtlaması yok   geçiş 2: CDP CPU kısıtlaması (varsayılan 4x ≈ orta telefon)
   Çıktı: insan okunur satırlar + son satırda "PERF_JSON {...}".

   Kullanım: node perf.mjs [--file ../index.html] [--build build.json] [--wave 30]
                           [--cpu 4] [--seconds 20] [--shot]
   build.json: {"arms":["tabanca:3",...], "trinkets":{"dmg":10,...}}
   (verilmezse: en pahalı 10 türden Lv3, tüm tılsımlar tavanda)
========================================================================= */
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const FILE = path.resolve(arg('--file', path.join(__dirname, '..', 'index.html')));
const WAVE = Number(arg('--wave', 30));
const CPU = Number(arg('--cpu', 4));
const SECONDS = Number(arg('--seconds', 20));
const buildPath = arg('--build', null);
const build = buildPath ? JSON.parse(fs.readFileSync(buildPath, 'utf8')) : null;
if(!process.env.PLAYWRIGHT_BROWSERS_PATH) process.env.PLAYWRIGHT_BROWSERS_PATH = '/opt/pw-browsers';

async function launch(){
  try { return await chromium.launch(); }
  catch(e){
    const cands = fs.readdirSync('/opt/pw-browsers').filter(d => /^chromium-\d+$/.test(d)).map(d => `/opt/pw-browsers/${d}/chrome-linux/chrome`);
    for(const p of cands) if(fs.existsSync(p)) return chromium.launch({ executablePath: p });
    throw e;
  }
}

async function pass(browser, throttle){
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(FILE).href, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  const setup = await page.evaluate(({ build, wave }) => {
    const Tn = Array.isArray(TRINKETS) ? TRINKETS : [];
    const want = build ? (build.trinkets || {}) : Object.fromEntries(Tn.map(t => [t.id, t.cap]));
    for(const t of Tn){
      const n = Math.min(want[t.id] || 0, t.cap ?? 99);
      for(let k = (P.trkCount[t.id] || 0); k < n; k++) applyTrinket(t);
    }
    let arms = build ? (build.arms || []) : [];
    if(!arms.length){
      const ids = Object.keys(WEAPONS).sort((a, b) => WEAPONS[b].price - WEAPONS[a].price);
      arms = P.arms.map((_, i) => ids[i % ids.length] + ':3');
    }
    while(P.arms.length < arms.length) P.arms.push(null);
    arms.forEach((a, i) => {
      if(!a){ P.arms[i] = null; return; }
      const [type, lv] = a.split(':');
      if(!WEAPONS[type]) return;
      P.arms[i] = { type, lv: +lv, cdT: 0, aim: 0, uid: 50000 + i };
    });
    P.wave = wave;
    P.maxHp = P.hp = 1e15;                 // ölümsüz: dalga boyunca en kötü durum (düşmanlar yığılır)
    startWave();
    return { arms: P.arms.filter(Boolean).map(a => a.type + ':' + a.lv), trk: P.trkList.length };
  }, { build, wave: WAVE });
  let cdp = null;
  if(throttle > 1){ cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle }); }
  await page.waitForTimeout(1000);
  const m = await page.evaluate(sec => new Promise(res => {
    const ft = []; let last = performance.now(), maxEn = 0, maxEnT = 0; const t0 = last;
    function f(now){
      ft.push(now - last); last = now;
      const n = (typeof enemies !== 'undefined' && enemies) ? enemies.length : 0;
      if(n > maxEn){ maxEn = n; maxEnT = (now - t0) / 1000; }
      if(now - t0 < sec * 1000 && state === WAVE_STATE) requestAnimationFrame(f);
      else res({ frames: ft.length, elapsed: (now - t0) / 1000, ft, maxEn, maxEnT, state, waveT });
    }
    requestAnimationFrame(f);
  }), SECONDS);
  const s = [...m.ft].sort((a, b) => a - b);
  const p95 = s[Math.floor(s.length * 0.95)] || 0;
  if(argv.includes('--shot')){
    fs.mkdirSync(path.join(__dirname, 'shots'), { recursive: true });
    await page.screenshot({ path: path.join(__dirname, 'shots', `perf-w${WAVE}-cpu${throttle}x.png`) });
  }
  if(cdp) await cdp.detach();
  await ctx.close();
  return { throttle, fps: m.frames / m.elapsed, p95, frames: m.frames, elapsed: m.elapsed, maxEnemies: m.maxEn,
           maxEnemiesAt: m.maxEnT, endState: m.state, setup, errors };
}

const browser = await launch();
const a = await pass(browser, 1);
const b = CPU > 1 ? await pass(browser, CPU) : a;
await browser.close();
const r = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d;
console.log(`Dalga ${WAVE}, kollar: ${a.setup.arms.join(' ')} | tılsım ${a.setup.trk}`);
console.log(`1x CPU : ${r(a.fps)} fps, p95 kare ${r(a.p95)} ms, aynı anda düşman maks ${a.maxEnemies} (${r(a.maxEnemiesAt)} sn)`);
if(CPU > 1) console.log(`${CPU}x CPU : ${r(b.fps)} fps, p95 kare ${r(b.p95)} ms, aynı anda düşman maks ${b.maxEnemies}`);
if(a.errors.length || b.errors.length) console.log('Sayfa hataları: ' + [...a.errors, ...b.errors].slice(0, 3).join(' | '));
const out = { wave: WAVE, cpuThrottle: CPU, fps: r(a.fps), p95: r(a.p95), fpsThrottled: r(b.fps), p95Throttled: r(b.p95),
              maxEnemies: Math.max(a.maxEnemies, b.maxEnemies), seconds: SECONDS, arms: a.setup.arms, errors: [...a.errors, ...b.errors] };
console.log('PERF_JSON ' + JSON.stringify(out));
