#!/usr/bin/env node
/* =========================================================================
   Octo-Shooter GERÇEK AKIŞ TESTİ (Playwright): masaüstü + telefon dikey/yatay + küçük ekran.
   Arayüz tıklamalarıyla: market (kart al, sürükle-bırak, otomatik birleştir, onar) → dalga başlat → kalkan/işaret
   → 4x hızla gerçek dalgalar → boss + mutasyon seçimi → oyun bitti → rekor → yeniden başlat.
   Kontroller: konsol/sayfa hatası yok, yatay taşma yok, takılma yok (kare süresi), yerleşim sınırları.
   Kullanım: node flow.mjs [--file ../index.html] [--only desktop,phoneP]
========================================================================= */
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const argVal = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const FILE = path.resolve(argVal('--file', path.join(__dirname, '..', 'index.html')));
const ONLY = argVal('--only', null)?.split(',');
if(!process.env.PLAYWRIGHT_BROWSERS_PATH) process.env.PLAYWRIGHT_BROWSERS_PATH = '/opt/pw-browsers';
const SHOTS = path.join(__dirname, 'shots', 'flow'); fs.mkdirSync(SHOTS, { recursive: true });
const VPS = [
  { name: 'desktop', viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false, dpr: 1 },
  { name: 'phoneP', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, dpr: 2 },
  { name: 'phoneL', viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, dpr: 2 },
  { name: 'small', viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, dpr: 2 }
].filter(v => !ONLY || ONLY.includes(v.name));

async function launch(){
  try { return await chromium.launch(); }
  catch(e){
    const c = fs.readdirSync('/opt/pw-browsers').filter(d => /^chromium-\d+$/.test(d)).map(d => `/opt/pw-browsers/${d}/chrome-linux/chrome`);
    for(const p of c) if(fs.existsSync(p)) return chromium.launch({ executablePath: p });
    throw e;
  }
}
let fails = 0;
const check = (vp, name, ok, detail) => { if(!ok) fails++; console.log(`${ok ? 'GEÇTİ ' : 'KALDI '} [${vp}] ${name}${detail ? ' — ' + detail : ''}`); };

async function flow(browser, cfg){
  const vp = cfg.name, VW = cfg.viewport.width, VH = cfg.viewport.height;
  const ctx = await browser.newContext({ viewport: cfg.viewport, isMobile: cfg.isMobile, hasTouch: cfg.hasTouch, deviceScaleFactor: cfg.dpr });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if(m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.stack || e.message));
  const shot = n => page.screenshot({ path: path.join(SHOTS, `${vp}-${n}.png`) });
  const click = async sel => { const l = page.locator(sel).first(); if(cfg.hasTouch) await l.tap(); else await l.click(); };
  const noHScroll = async name => {
    const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
      shop: (() => { const s = document.getElementById('shop'); return s ? [s.scrollWidth, s.clientWidth] : null; })() }));
    check(vp, `yatay taşma yok (${name})`, o.sw <= o.cw + 1 && (!o.shop || o.shop[0] <= o.shop[1] + 1), JSON.stringify(o));
  };

  await page.goto(pathToFileURL(FILE).href);
  await page.waitForTimeout(500);
  await noHScroll('açılış'); await shot('1-market');

  /* --- market: kart al, birleştir, sürükle-bırak, onar --- */
  await page.evaluate(() => { P.gold = 400; renderShop(); });
  const gold0 = Number(await page.locator('#sGold').textContent());
  for(let i = 0; i < 3; i++){ await page.locator('#cards .card:not(.sold)').first().scrollIntoViewIfNeeded(); await click('#cards .card:not(.sold)'); }
  const gold1 = Number(await page.locator('#sGold').textContent());
  check(vp, 'kartlar tıklanarak alındı (altın düştü)', gold1 < gold0, `${gold0}→${gold1}`);
  await page.locator('#btnAutoMerge').scrollIntoViewIfNeeded(); await click('#btnAutoMerge');
  await page.locator('#armCircle').scrollIntoViewIfNeeded();
  const slotsFull = await page.evaluate(() => P.arms.map((a, i) => a ? i : -1).filter(i => i >= 0));
  const emptyIdx = await page.evaluate(() => P.arms.findIndex(a => !a));
  if(slotsFull.length && emptyIdx >= 0){
    const fb = await page.locator(`#armCircle .slot[data-i="${slotsFull[0]}"]`).boundingBox();
    const tb = await page.locator(`#armCircle .slot[data-i="${emptyIdx}"]`).boundingBox();
    const x0 = fb.x + fb.width / 2, y0 = fb.y + fb.height / 2, x1 = tb.x + tb.width / 2, y1 = tb.y + tb.height / 2;
    if(cfg.hasTouch){
      const cdp = await ctx.newCDPSession(page);
      const tp = (x, y) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(x0, y0) });
      for(let k = 1; k <= 10; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(x0 + (x1 - x0) * k / 10, y0 + (y1 - y0) * k / 10) });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await cdp.detach();
    }else{
      await page.mouse.move(x0, y0); await page.mouse.down();
      for(let k = 1; k <= 10; k++) await page.mouse.move(x0 + (x1 - x0) * k / 10, y0 + (y1 - y0) * k / 10);
      await page.mouse.up();
    }
    await page.waitForTimeout(150);
    const moved = await page.evaluate(([a, b]) => !P.arms[a] && !!P.arms[b], [slotsFull[0], emptyIdx]);
    check(vp, 'sürükle-bırak ile kol taşındı', moved, `${slotsFull[0]}→${emptyIdx}`);
    const ghosts = await page.evaluate(() => document.querySelectorAll('#dragGhost').length);
    check(vp, 'sürükleme hayaleti kalmadı', ghosts === 0);
  }
  await page.evaluate(() => { P.hp = 40; P.maxHp = 100; P.gold = 200; P.wave = 7; renderShop(); });
  await page.locator('#btnRepair').scrollIntoViewIfNeeded(); await click('#btnRepair');
  const hp1 = await page.evaluate(() => P.hp);
  check(vp, 'Kabuk Onar çalıştı', hp1 === 65, `hp ${hp1}`);
  await page.evaluate(() => { P.wave = 1; P.hp = P.maxHp = 100; renderShop(); });
  await shot('2-market-dolu');

  /* --- dalga: gerçek başlat, kalkan, işaret --- */
  await page.evaluate(() => { document.getElementById('shop').scrollTop = 0; });
  await click('#btnStartTop');
  await page.waitForTimeout(2500);
  const inWave = await page.evaluate(() => state === WAVE_STATE);
  check(vp, 'dalga başladı (üstteki Başlat)', inWave);
  /* kare süresi ölçümü */
  await page.evaluate(() => { window.__ft = []; let last = performance.now(); (function f(n){ window.__ft.push(n - last); last = n; requestAnimationFrame(f); })(last); });
  if(cfg.hasTouch) await page.locator('#btnShield').tap(); else await page.keyboard.press('Space');
  await page.waitForTimeout(200);
  const sh = await page.evaluate(() => ({ t: P.shT, uses: P.shUses }));
  check(vp, 'kalkan kullanıldı', sh.uses >= 1, JSON.stringify(sh));
  const ep = await page.evaluate(() => { const e = enemies.find(x => x.hp > 0); return e ? { x: e.x, y: e.y } : null; });
  if(ep){ if(cfg.hasTouch) await page.touchscreen.tap(ep.x, ep.y); else await page.mouse.click(ep.x, ep.y); await page.waitForTimeout(100); }
  await shot('3-dalga');
  /* HUD/yerleşim sınırları */
  const lay = await page.evaluate(() => { const r = id => { const e = document.getElementById(id); const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
    return { shield: r('btnShield'), pause: r('btnPause'), hud: r('hud'), tip: r('tip') }; });
  check(vp, 'kalkan düğmesi ekran içinde', lay.shield.l >= 0 && lay.shield.r <= VW && lay.shield.b <= VH && lay.shield.t >= 0, JSON.stringify(lay.shield));
  const ov = !(lay.shield.r < lay.pause.l || lay.shield.l > lay.pause.r || lay.shield.b < lay.pause.t || lay.shield.t > lay.pause.b);
  check(vp, 'kalkan düğmesi HUD düğmeleriyle çakışmıyor', !ov);

  /* --- 4x hızla gerçek dalgalar (ahtapot ölümsüz, kollar güçlü) --- */
  await page.evaluate(() => { for(let i = 0; i < P.arms.length; i++) P.arms[i] = P.arms[i] || null;
    const ids = ['kurek', 'levye', 'asa', 'kiskac', 'alev', 'pompali', 'buz', 'murekkep'];
    ids.forEach((id, i) => { P.arms[i] = { type: id, lv: 3, cdT: 0, aim: 0, uid: newUid(id) }; });
    P.maxHp = P.hp = 1e9; });
  await page.locator('#btnSpeed').click(); await page.locator('#btnSpeed').click();   // 4x
  /* 3 dalga gerçekten oynansın: her dalga sonunda market → Başlat */
  for(let w = 0; w < 3; w++){
    await page.waitForFunction(() => state === SHOP_STATE, null, { timeout: 90000 });
    await page.evaluate(() => { P.maxHp = P.hp = 1e9; });
    await click('#btnStartTop');
    await page.waitForTimeout(300);
  }
  const wv = await page.evaluate(() => P.wave);
  check(vp, 'dalgalar akıyor (4x hız)', wv >= 4, `P.wave=${wv}`);
  const ft = await page.evaluate(() => window.__ft.slice(5));
  const s = [...ft].sort((a, b) => a - b), p95 = s[Math.floor(s.length * 0.95)] || 0, mx = s[s.length - 1] || 0;
  check(vp, 'takılma yok (p95 kare < 120 ms, maks < 800 ms)', p95 < 120 && mx < 800, `p95 ${p95.toFixed(1)} ms, maks ${mx.toFixed(0)} ms, n=${ft.length}`);

  /* --- boss + mutasyon: dalga 10'a ışınlan, boss'u yen, mutasyon seç --- */
  await page.waitForFunction(() => state === SHOP_STATE, null, { timeout: 90000 });
  await page.evaluate(() => { P.wave = 10; P.maxHp = P.hp = 1e9; renderShop(); });
  await click('#btnStartTop');
  await page.waitForFunction(() => enemies.some(e => e.isBoss), null, { timeout: 30000 });
  await page.waitForTimeout(600); await shot('4-boss');
  const bossHud = await page.evaluate(() => ({ wrap: getComputedStyle(document.getElementById('bossWrap')).display, lbl: document.getElementById('bossLabel').textContent }));
  check(vp, 'boss çubuğu görünür', bossHud.wrap === 'block', JSON.stringify(bossHud));
  await page.waitForFunction(() => state === SHOP_STATE, null, { timeout: 150000 });
  const mutOpen = await page.evaluate(() => isMutationOpen());
  check(vp, 'boss sonrası mutasyon ekranı açıldı', mutOpen);
  await shot('5-mutasyon');
  await click('#mutCards .card');
  await page.waitForTimeout(200);
  const perk = await page.evaluate(() => ({ perks: P.perks.slice(), open: isMutationOpen() }));
  check(vp, 'mutasyon seçildi', perk.perks.length === 1 && !perk.open, JSON.stringify(perk));
  await page.evaluate(() => { P.maxHp = P.hp = 300; renderShop(); });     // test için 1e9 can yazısı yatay taşma yapmasın
  await noHScroll('mutasyon sonrası market');

  /* --- oyun bitti + rekor + yeniden başlat --- */
  await page.evaluate(() => { try{ localStorage.removeItem('octoShooter.best.v1'); }catch(e){} P.maxHp = 100; P.hp = 100; });
  await click('#btnStartTop');
  await page.waitForTimeout(400);
  await page.evaluate(() => { P.hp = 0; });
  await page.waitForFunction(() => state === GAMEOVER_STATE, null, { timeout: 5000 });
  const go = await page.evaluate(() => ({ txt: document.getElementById('overBox').innerText.slice(0, 300), ls: localStorage.getItem('octoShooter.best.v1') }));
  check(vp, 'oyun bitti ekranı + rekor kaydı', /YENİ REKOR/.test(go.txt) && !!go.ls, go.txt.replace(/\n/g, ' | ').slice(0, 140));
  await shot('6-oyun-bitti');
  const ob = await page.evaluate(() => { const r = document.getElementById('overBox').getBoundingClientRect(); return { b: r.bottom, h: innerHeight, sh: document.getElementById('over').scrollHeight }; });
  check(vp, 'oyun bitti kutusu ekrana sığıyor ya da kaydırılabilir', ob.b <= ob.h + 1 || ob.sh > ob.h, JSON.stringify(ob));
  await click('#btnRestart');
  await page.waitForTimeout(300);
  const rs = await page.evaluate(() => ({ wave: P.wave, shop: document.getElementById('shop').classList.contains('show'), speed: gameSpeed, arms: P.arms.filter(Boolean).length, heat: P.heat }));
  check(vp, 'yeniden başlatıldı (dalga 1, hız 1x, tek silah)', rs.wave === 1 && rs.shop && rs.speed === 1 && rs.arms === 1 && rs.heat === 0, JSON.stringify(rs));
  await page.reload(); await page.waitForTimeout(400);
  const best = await page.evaluate(() => localStorage.getItem('octoShooter.best.v1'));
  check(vp, 'sayfa yenilenince rekor duruyor', !!best, best);

  check(vp, 'konsol/sayfa hatası yok', errs.length === 0, errs.slice(0, 2).join(' | '));
  await ctx.close();
}

const browser = await launch();
for(const cfg of VPS) await flow(browser, cfg);
await browser.close();
console.log(fails ? `\n${fails} KONTROL KALDI` : '\nTÜM KONTROLLER GEÇTİ');
process.exit(fails ? 1 : 0);
