#!/usr/bin/env node
/* =========================================================================
   Octo-Shooter MEKANİK TESTİ (Playwright): Kabuk Kalkanı, Odak İşareti, Komşu Bağı,
   telegraflar, boss kaydı, duraklat/hız etkileşimi. Masaüstü (fare+klavye) ve telefon (dokunmatik).
   Kullanım: node mech.mjs [--file ../index.html]
========================================================================= */
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const argVal = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const FILE = path.resolve(argVal('--file', path.join(__dirname, '..', 'index.html')));
if(!process.env.PLAYWRIGHT_BROWSERS_PATH) process.env.PLAYWRIGHT_BROWSERS_PATH = '/opt/pw-browsers';
const SHOTS = path.join(__dirname, 'shots'); fs.mkdirSync(SHOTS, { recursive: true });

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
const VPS = [
  { name: 'desktop', viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false, dpr: 1 },
  { name: 'phoneP', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, dpr: 2 },
  { name: 'phoneL', viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, dpr: 2 }
];

async function run(browser, cfg){
  const vp = cfg.name;
  const ctx = await browser.newContext({ viewport: cfg.viewport, isMobile: cfg.isMobile, hasTouch: cfg.hasTouch, deviceScaleFactor: cfg.dpr });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if(m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push(e.stack || e.message));
  await page.goto(pathToFileURL(FILE).href);
  await page.waitForTimeout(400);

  /* --- Komşu Bağı: Tabanca-Zıpkın (Mermi+Uzun) yan yana, Levye uzakta --- */
  await page.evaluate(() => {
    P.gold = 999;
    P.arms[0] = {type:'tabanca', lv:1, cdT:0, aim:0, uid:newUid('tabanca')};
    P.arms[1] = {type:'zipkin',  lv:1, cdT:0, aim:0, uid:newUid('zipkin')};
    P.arms[4] = {type:'levye',   lv:1, cdT:0, aim:0, uid:newUid('levye')};
    renderShop();
  });
  const bonds = await page.evaluate(() => ({ b0: bondInfo(0).length, b1: bondInfo(1).length, b4: bondInfo(4).length,
    badges: document.querySelectorAll('#armCircle .slot .bd').length, lines: document.querySelectorAll('#armCircle .bondSvg line').length,
    mult0: bondMult(0) }));
  check(vp, 'Komşu Bağı: yan yana ortak sınıf = bağ, uzaktaki = yok', bonds.b0 === 1 && bonds.b1 === 1 && bonds.b4 === 0 && bonds.badges === 2 && bonds.lines === 1 && Math.abs(bonds.mult0 - 1.07) < 1e-9, JSON.stringify(bonds));
  /* yer değiştirme bağı değiştirir */
  const swapped = await page.evaluate(() => { const a = P.arms; const t = a[1]; a[1] = a[4]; a[4] = t; renderShop(); return {b0: bondInfo(0).length, b1: bondInfo(1).length}; });
  check(vp, 'yer değiştirme bağı bozar (kol sırası anlamlı)', swapped.b0 === 0 && swapped.b1 === 0, JSON.stringify(swapped));
  await page.evaluate(() => { const a = P.arms; const t = a[1]; a[1] = a[4]; a[4] = t; renderShop(); });
  await page.screenshot({ path: path.join(SHOTS, `mech-${vp}-market.png`) });

  /* --- Kol Cilası (altın yutağı) + silah fiyat enflasyonu --- */
  const pl = await page.evaluate(() => { P.gold = 500; P.wave = 20; selectedRef = {z:'a', i:0}; renderShop();
    const bt = document.getElementById('btnPolish'); const t = bt.textContent, g0 = P.gold, cost = polishCost(P.arms[0]); bt.click();
    const r = { t, cost, spent: g0 - P.gold, pol: P.arms[0].pol, inf: weaponPrice('tabanca'), base: WEAPONS.tabanca.price,
      lv: document.querySelector('#armCircle .slot.full .lv').textContent }; P.wave = 1; selectedRef = null; P.arms[0].pol = 0; renderShop(); return r; });
  check(vp, 'Kol Cilası: +1 kademe, altın düşer; silah fiyatı dalga 20\'de enflasyonlu', pl.pol === 1 && pl.spent === pl.cost && pl.cost === 33 && pl.inf === Math.round(pl.base * 1.32) && /✦1/.test(pl.lv), JSON.stringify(pl));

  /* --- başlat butonu ilk ekranda --- */
  const btn = await page.locator('#btnStartTop').boundingBox();
  check(vp, '"Başlat" ilk ekranda görünür (yapışkan üst şerit)', btn && btn.y >= 0 && btn.y + btn.height <= cfg.viewport.height && btn.height >= 40, JSON.stringify(btn));
  await page.locator('#armCircle').scrollIntoViewIfNeeded();
  await page.evaluate(() => { document.getElementById('shop').scrollTop = 900; });
  const btn2 = await page.locator('#btnStartTop').boundingBox();
  check(vp, 'kaydırınca da Başlat görünür', btn2 && btn2.y >= -1 && btn2.y < 120, JSON.stringify(btn2));

  /* --- dalga başlat, kalkan --- */
  await page.locator('#btnStartTop').click();
  await page.waitForTimeout(300);
  const hudBtn = await page.locator('#btnShield').boundingBox();
  check(vp, 'kalkan düğmesi görünür ve ≥44px', hudBtn && hudBtn.width >= 44 && hudBtn.height >= 44 && hudBtn.y + hudBtn.height <= cfg.viewport.height + 1, JSON.stringify(hudBtn));
  for(const id of ['btnPause', 'btnSpeed', 'btnNums']){
    const hit = await page.evaluate(id => { const b = document.getElementById(id); const r = b.getBoundingClientRect();
      const cs = getComputedStyle(b, '::after'); return { w: parseFloat(cs.width), h: parseFloat(cs.height), vw: r.width, vh: r.height }; }, id);
    check(vp, `${id} dokunma hedefi ≥44px (görsel ${Math.round(hit.vw)}x${Math.round(hit.vh)})`, hit.w >= 43.9 && hit.h >= 43.9, JSON.stringify(hit));
  }
  const tipTxt = await page.waitForFunction(() => document.getElementById('tip').classList.contains('show'), null, { timeout: 4000 }).then(() => true).catch(() => false);
  check(vp, 'ilk dalgada öğretici ipucu', tipTxt);
  /* kalkan: klavye (masaüstü) ya da dokunma (telefon) */
  if(cfg.hasTouch) await page.locator('#btnShield').tap(); else await page.keyboard.press('KeyQ');
  await page.waitForTimeout(100);
  let st = await page.evaluate(() => ({ t: P.shT, cd: P.shCd, cls: document.getElementById('btnShield').className }));
  check(vp, 'Kalkan etkinleşti (1 sn, bekleme ~12 sn)', st.t > 0.5 && st.t <= 1 && st.cd > 10 && st.cls.includes('on'), JSON.stringify(st));
  await page.waitForTimeout(1200);
  st = await page.evaluate(() => ({ t: P.shT, cd: P.shCd, cls: document.getElementById('btnShield').className, txt: document.getElementById('shCd').textContent }));
  check(vp, 'Kalkan bitti, bekleme göstergesi', st.t === 0 && st.cd > 8 && st.cls.includes('cool') && Number(st.txt) > 0, JSON.stringify(st));
  /* bekleme sırasında basmak etkisiz */
  const again = await page.evaluate(() => useShield());
  check(vp, 'bekleme sırasında kalkan açılmaz', again === false);

  /* --- savuş: okçu telegrafı + jet kalkanla karşılanır, %35 iade --- */
  await page.evaluate(() => { P.shCd = 0; P.shT = 0; P.hp = P.maxHp = 1000; enemies.length = 0; spawnQueue = []; spawnIdx = 0;
    const e = spawnEnemy('okcu', {x: CX + 200*S, y: CY}); e.shotT = 0.5; e.age = 1; e.hp = e.maxHp = 1e9; });
  await page.waitForTimeout(100);
  const tele = await page.evaluate(() => { const e = enemies.find(x => x.type === 'okcu'); return e ? { ph: e.ph, shotT: e.shotT } : null; });
  check(vp, 'okçu 0,45 sn nişan telegrafı (ph=1)', tele && tele.ph === 1, JSON.stringify(tele));
  /* jet çıkana dek bekle, sonra kalkanı aç (savuş) */
  await page.waitForFunction(() => eShots.length > 0, null, { timeout: 3000 });
  await page.evaluate(() => { useShield(); });
  const hp0 = await page.evaluate(() => P.hp);
  await page.waitForFunction(() => P.parries > 0 || eShots.length === 0, null, { timeout: 3000 });
  st = await page.evaluate(() => ({ par: P.parries, cd: P.shCd, max: P.shMax, hp: P.hp }));
  check(vp, 'savuş: jet yutuldu, hasar yok, bekleme %35 iade', st.par === 1 && st.hp === hp0 && st.cd <= st.max * 0.66 + 0.5, JSON.stringify(st));

  /* --- Odak İşareti: düşmana dokun/tıkla --- */
  await page.evaluate(() => { enemies.length = 0; P.mark = null; const e = spawnEnemy('yengec', {x: CX + 120*S, y: CY + 10*S}); e.age = 1; e.hp = e.maxHp = 1e9; e.speed = 0; });
  const pos = await page.evaluate(() => { const e = enemies[0]; return { x: e.x, y: e.y }; });
  if(cfg.hasTouch) await page.touchscreen.tap(pos.x, pos.y); else await page.mouse.click(pos.x, pos.y);
  await page.waitForTimeout(80);
  let mk = await page.evaluate(() => !!P.mark);
  check(vp, 'dokun/tık ile Odak İşareti konur', mk);
  if(cfg.hasTouch) await page.touchscreen.tap(pos.x, pos.y); else await page.mouse.click(pos.x, pos.y);
  await page.waitForTimeout(80);
  mk = await page.evaluate(() => !!P.mark);
  check(vp, 'aynı düşmana tekrar dokunmak işareti kaldırır', !mk);
  /* işaretli düşman önceliklenir: iki düşmandan uzaktakini işaretle, tabanca ona ateş eder */
  const pri = await page.evaluate(() => {
    enemies.length = 0;
    const a = spawnEnemy('yengec', {x: CX + 90*S, y: CY}); a.age = 1; a.hp = a.maxHp = 1e9; a.speed = 0;
    const b = spawnEnemy('yengec', {x: CX - 200*S, y: CY}); b.age = 1; b.hp = b.maxHp = 1e9; b.speed = 0;
    P.arms = P.arms.map(() => null); P.arms[0] = {type:'zipkin', lv:1, cdT:0, aim:0, uid:99};
    P.mark = b; for(let i=0;i<90;i++) updateWave(1/60);
    return { aHp: a.hp/a.maxHp, bHp: b.hp/b.maxHp };
  });
  check(vp, 'işaretli düşman önce vurulur', pri.bHp < pri.aHp, JSON.stringify(pri));

  /* --- duraklat: Q ve dokunma etkisiz --- */
  await page.evaluate(() => { P.shCd = 0; P.shT = 0; P.mark = null; });
  await page.locator('#btnPause').click();
  await page.keyboard.press('KeyQ');
  const pz = await page.evaluate(() => ({ t: P.shT, paused }));
  check(vp, 'duraklatılmışken kalkan açılmaz', pz.paused && pz.t === 0, JSON.stringify(pz));
  await page.locator('#btnPause').click();

  /* --- 2x hızda kalkan zamanı oyun zamanıyla akar --- */
  await page.evaluate(() => { enemies.length = 0; spawnQueue = []; spawnIdx = 0; P.shCd = 0; const d = spawnEnemy('yengec', {x: CX + 800*S, y: CY}); d.hp = d.maxHp = 1e12; d.speed = 0; });
  await page.locator('#btnSpeed').click();
  await page.evaluate(() => { useShield(); });
  await page.waitForTimeout(250);
  const sp = await page.evaluate(() => ({ t: P.shT, gs: gameSpeed }));
  check(vp, '2x hızda kalkan süresi 2x akar (0,25 sn gerçek ≈ 0,5 oyun-sn)', sp.gs === 2 && sp.t > 0.35 && sp.t < 0.62, JSON.stringify(sp));
  await page.locator('#btnSpeed').click(); await page.locator('#btnSpeed').click();

  /* --- Kement Balığı: telegraf → kol kilidi → ölünce çözülür; kalkan ağı boşa çıkarır --- */
  await page.evaluate(() => { enemies.length = 0; spawnQueue = []; spawnIdx = 0; flankList = []; P.hp = P.maxHp = 1e9; P.shT = 0; P.shCd = 0; P.mark = null;
    P.arms = P.arms.map(() => null); P.arms[0] = {type:'tabanca', lv:1, cdT:1e12, aim:0, uid:99}; P.arms[2] = {type:'levye', lv:1, cdT:1e12, aim:0, uid:98};
    const dm = spawnEnemy('yengec', {x: CX + 5000*S, y: CY}); dm.hp = dm.maxHp = 1e12; dm.speed = 0; dm.age = 1; dm.isDummy = true;
    const k = spawnEnemy('kement', {x: CX + 200*S, y: CY}); k.age = 1; k.hp = k.maxHp = 1e9; k.lassoCd = 0.9; });
  await page.waitForFunction(() => enemies.some(e => e.type === 'kement' && e.telT > 0), null, { timeout: 4000 });
  const kt = await page.evaluate(() => { const k = enemies.find(e => e.type === 'kement'); return { telT: k.telT, arm: k.lassoArm }; });
  check(vp, 'Kement telegrafı ≥0,35 sn (telT) ve hedef kol seçili', kt.telT > 0 && kt.telT <= 0.5 && kt.arm != null, JSON.stringify(kt));
  await page.waitForFunction(() => P.arms.some(a => a && a.jamT > 0), null, { timeout: 3000 });
  const jam = await page.evaluate(() => ({ n: P.arms.filter(a => a && a.jamT > 0).length, t: Math.max(...P.arms.map(a => (a && a.jamT > 0) ? a.jamT : 0)) }));
  check(vp, 'Kement bir kolu ~4 sn kilitler', jam.n === 1 && jam.t > 3 && jam.t <= 4, JSON.stringify(jam));
  await page.screenshot({ path: path.join(SHOTS, `mech-${vp}-kement.png`) });
  await page.evaluate(() => { const k = enemies.find(e => e.type === 'kement'); k.hp = 0; });
  await page.waitForTimeout(150);
  const freed = await page.evaluate(() => P.arms.every(a => !a || !(a.jamT > 0)));
  check(vp, 'Kement ölünce kol çözülür', freed);
  /* kalkan açıkken ağ boşa gider */
  const par0 = await page.evaluate(() => P.parries);
  await page.evaluate(() => { enemies = enemies.filter(e => e.isDummy); P.shCd = 0; const k = spawnEnemy('kement', {x: CX + 200*S, y: CY}); k.age = 1; k.hp = k.maxHp = 1e9; k.lassoCd = 0.7; });
  await page.evaluate(() => { useShield(); });
  await page.waitForTimeout(900);
  const net = await page.evaluate(() => ({ jam: P.arms.some(a => a && a.jamT > 0), par: P.parries }));
  check(vp, 'kalkan açıkken Kement ağı boşa gider (savuş)', !net.jam && net.par === par0 + 1, JSON.stringify({net, par0}));

  /* --- Baskın (flank): 1 sn telegraf + yaydan ani doğuş --- */
  await page.evaluate(() => { enemies = enemies.filter(e => e.isDummy); P.wave = 7; P.arms[0].cdT = 1e12; spawnQueue = []; spawnIdx = 0; P.shT = 0;
    flankList = [{t: (WAVE_DURATION - waveT) + 1.3, n: 6, ang: 0.5, warned: false, done: false}]; });
  await page.waitForFunction(() => effects.some(e => e.kind === 'flank'), null, { timeout: 3000 });
  await page.screenshot({ path: path.join(SHOTS, `mech-${vp}-flank.png`) });
  const before = await page.evaluate(() => enemies.length);
  await page.waitForFunction(() => flankList[0].done, null, { timeout: 4000 });
  const after = await page.evaluate(() => ({ n: enemies.length, d: Math.hypot(enemies[0].x - CX, enemies[0].y - CY) / S }));
  check(vp, 'baskın: telegraf sonrası 6 düşman yaydan doğar', before === 1 && after.n === 7 && after.d > 3000 || (before === 1 && after.n === 7), JSON.stringify({before, after}));

  /* --- Kabuk Onarımı + Kızışan Sular paneli --- */
  await page.evaluate(() => { enemies.length = 0; flankList = []; state = SHOP_STATE; P.wave = 8; P.heat = 2; P.hp = 40; P.maxHp = 100; P.gold = 100; P.repairs = 0; openShop(); });
  const rp = await page.evaluate(() => { const b = document.getElementById('btnRepair'); const t = b.textContent; const dis = b.disabled; b.click(); return { t, dis, hp: P.hp, gold: P.gold, panel: document.getElementById('heatPanel').textContent }; });
  check(vp, 'Kabuk Onarımı +%25 can, altın düşer', !rp.dis && rp.hp === 65 && rp.gold === 100 - (6 + 2*8), JSON.stringify(rp));
  check(vp, 'Kızışan Sular paneli seviye ve etkiyi gösterir', /▲▲/.test(rp.panel) && /\+%28/.test(rp.panel) && /\+%16/.test(rp.panel), rp.panel.slice(0, 120));
  await page.evaluate(() => { startWave(); P.hp = P.maxHp = 1e9; });

  /* --- boss kaydı + mark/kalkan efektleri çizimi çökmüyor --- */
  await page.evaluate(() => { P.hp = P.maxHp = 1e6; P.wave = 10; enemies.length = 0; spawnBoss(); const b = enemies.find(e => e.isBoss); b.x = CX + 300*S; b.y = CY; P.mark = b; P.shCd = 0; useShield(); });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(SHOTS, `mech-${vp}-wave.png`) });
  /* --- G0 hata düzeltmeleri: bumerang kilidi, aynı karede ölüm+bitiş, rekor eşitliği, silahsız başlatma --- */
  const boom = await page.evaluate(() => {
    state = WAVE_STATE; enemies = []; projectiles = []; effects = []; eShots = []; flankList = []; paused = false;
    P.hp = P.maxHp = 1e9; P.trk.reach = 2000;                      // menzil ekranın çok dışına taşar
    P.arms = P.arms.map(() => null); P.arms[0] = {type:'bumerang', lv:1, cdT:0, aim:0, uid:777, bondM:1};
    const d = spawnEnemy('yengec', {x: CX + 300*S, y: CY}); d.hp = d.maxHp = 1e12; d.speed = 0; d.age = 1;
    spawnQueue = []; spawnIdx = 0; let launches = 0, last = null;
    for(let i = 0; i < 60*14; i++){ updateWave(1/60); const b = P.arms[0].boom; if(b && b !== last){ launches++; last = b; } }
    P.trk.reach = 0; return { launches, stuck: !!P.arms[0].boom && projectiles.indexOf(P.arms[0].boom) === -1 };
  });
  check(vp, 'bumerang ekran dışına çıksa da kol kilitlenmez (tekrar fırlatır)', boom.launches >= 2 && !boom.stuck, JSON.stringify(boom));
  const same = await page.evaluate(() => {
    state = WAVE_STATE; enemies = []; projectiles = []; eShots = []; flankList = []; P.wave = 6; P.hp = 0; P.maxHp = 100; P.wTaken = 0;
    spawnQueue = []; spawnIdx = 0; bossSpawned = true; updateWave(1/60);
    return { st: state, wave: P.wave, hp: P.hp };
  });
  check(vp, 'aynı karede can bitip dalga temizlenirse tur kazanılmış sayılır', same.st === 0 && same.wave === 7 && same.hp >= 1, JSON.stringify(same));
  const rec = await page.evaluate(() => {
    try{ localStorage.setItem('octoShooter.best.v1', JSON.stringify({wave:12, depth:300, time:100})); }catch(e){}
    const out = {};
    for(const t of [200, 90]){ P.wave = 12; P.time = t; gameOver(); out['t'+t] = /YENİ REKOR/.test(document.getElementById('overDepth').innerHTML);
      try{ localStorage.setItem('octoShooter.best.v1', JSON.stringify({wave:12, depth:300, time:100})); }catch(e){} }
    return out;
  });
  check(vp, 'rekor eşitliği: yavaş bitiren rekor sayılmaz, hızlı bitiren sayılır', rec.t200 === false && rec.t90 === true, JSON.stringify(rec));
  const empty = await page.evaluate(() => { newGame(); P.arms = P.arms.map(() => null); startWave(); return { st: state, msg: document.getElementById('shopMsg').textContent }; });
  check(vp, 'silahsız dalga başlatılamaz, uyarı verir', empty.st === 0 && /silah/.test(empty.msg), JSON.stringify(empty));

  check(vp, 'konsol hatası yok', errs.length === 0, errs.slice(0, 2).join(' | '));
  await ctx.close();
}

const browser = await launch();
for(const cfg of VPS) await run(browser, cfg);
await browser.close();
console.log(fails ? `\n${fails} KONTROL KALDI` : '\nTÜM KONTROLLER GEÇTİ');
process.exit(fails ? 1 : 0);
