#!/usr/bin/env node
/* =========================================================================
   Octo-Shooter GÖRSEL / UX KALİTE KONTROLÜ (Playwright)
   -------------------------------------------------------------------------
   Oyunun kendi global'leriyle (P, startWave, spawnEnemy, spawnBoss, endWave,
   pickMutation, offerMutations, renderShop ...) sahneler kurar, ekran görüntüsü
   alır ve ölçülebilir kontrolleri (taşma, sayaç metni, localStorage, konsol
   hatası, resize sonrası konum) yazdırır. Görseller: tools/shots/qa/.
   index.html'i değiştirmez. Kullanım: node qa.mjs [--file ../index.html] [--only 1,2]
========================================================================= */
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const FILE = path.resolve(arg('--file', path.join(__dirname, '..', 'index.html')));
const ONLY = arg('--only', null)?.split(',').map(Number) || null;
const OUT = path.join(__dirname, 'shots', 'qa');
fs.mkdirSync(OUT, { recursive: true });
if(!process.env.PLAYWRIGHT_BROWSERS_PATH) process.env.PLAYWRIGHT_BROWSERS_PATH = '/opt/pw-browsers';

const VPS = {
  phone:   { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false }
};
const log = [];                 // ölçülen kontroller
const note = (sec, vp, ok, msg) => { log.push({ sec, vp, ok, msg }); console.log(`${ok === true ? 'OK  ' : ok === false ? 'SORUN' : 'BİLGİ'} [${sec}|${vp}] ${msg}`); };
const consoleLog = [];

const browser = await chromium.launch();
async function open(vp){
  const ctx = await browser.newContext(VPS[vp]);
  const page = await ctx.newPage();
  page.on('console', m => { if(m.type() === 'error' || m.type() === 'warning') consoleLog.push(`[${vp}] ${m.type()}: ${m.text()}`); });
  page.on('pageerror', e => consoleLog.push(`[${vp}] pageerror: ${e.message}`));
  await page.goto(pathToFileURL(FILE).href, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  return { ctx, page };
}
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name + '.png') });
const wait = (page, ms) => page.waitForTimeout(ms);
/* Taşma: kutunun içeriği kutudan büyük mü (kesilen metin) */
const overflowOf = (page, sel) => page.evaluate(sel => [...document.querySelectorAll(sel)].filter(e => e.offsetParent)
  .map(e => ({ t: (e.textContent || '').trim().slice(0, 40), sw: e.scrollWidth, cw: e.clientWidth, sh: e.scrollHeight, ch: e.clientHeight,
              r: e.getBoundingClientRect().right }))
  .filter(o => o.sw > o.cw + 1 || o.sh > o.ch + 1), sel);
/* Dalga sahnesi: ahtapot ölümsüz, kollar boş (düşmanlar ölmesin), kuyruk boş */
async function stage(page, wave, opts = {}){
  await page.evaluate(({ wave, keepArms }) => {
    P.wave = wave; P.maxHp = P.hp = 1e9;
    if(!keepArms) P.arms = P.arms.map(() => null);
    startWave();
    /* sahte uzak-gelecek kuyruk öğesi: düşman listesi boşalsa da dalga bitmesin */
    spawnQueue = [{ t: 1e9, type: 'karides' }]; spawnIdx = 0; bossSpawned = true;
  }, { wave, keepArms: !!opts.keepArms });
}
async function place(page, list){
  /* list: [{type, ang(derece), d(dünya birimi), elite, affix}] */
  return page.evaluate(list => list.map(o => {
    const a = o.ang * Math.PI / 180;
    const e = spawnEnemy(o.type, { x: CX + Math.cos(a) * o.d * S, y: CY + Math.sin(a) * o.d * S, elite: o.elite, affix: o.affix });
    e.age = 1;
    return e.type;
  }), list);
}
const sections = {};

/* ---------------- 1. Düşmanlar ve bosslar ---------------- */
sections[1] = async vp => {
  const { ctx, page } = await open(vp);
  const types = await page.evaluate(() => Object.keys(ENEMY_TYPES).filter(t => !ENEMY_TYPES[t].boss));
  await stage(page, 16);
  const n = types.length;
  await place(page, types.map((t, i) => ({ type: t, ang: i * 360 / n, d: 230 })));
  await wait(page, 300); await page.evaluate(() => { paused = true; clearBanners(); });
  await wait(page, 200); await shot(page, `1-dusmanlar-${vp}`);
  note(1, vp, null, `normal düşman türleri sahnede: ${types.join(', ')}`);
  /* elitler + affix'ler */
  await page.evaluate(() => { paused = false; enemies = []; });
  await place(page, [{ type: 'yengec', ang: 0, d: 200, elite: true }, { type: 'yengec', ang: 90, d: 200, elite: true, affix: 'hizli' },
                     { type: 'kaplumbaga', ang: 180, d: 200, elite: true, affix: 'zirhli' }, { type: 'balon', ang: 270, d: 200, elite: true, affix: 'yenilenen' }]);
  await wait(page, 200); await page.evaluate(() => { paused = true; clearBanners(); }); await wait(page, 150);
  await shot(page, `1-elitler-${vp}`);
  /* barakuda telegrafı + okçu atışı */
  await page.evaluate(() => { paused = false; enemies = []; });
  await place(page, [{ type: 'barakuda', ang: 0, d: 380 }, { type: 'okcu', ang: 180, d: 240 }]);
  let tele = false, shots = 0;
  for(let i = 0; i < 25 && !tele; i++){ await wait(page, 40); tele = await page.evaluate(() => enemies.some(e => e.beh === 'dash' && e.ph === 1)); }
  if(tele){ await page.evaluate(() => { paused = true; }); await wait(page, 120); await shot(page, `1-barakuda-telegraf-${vp}`); await page.evaluate(() => { paused = false; }); }
  note(1, vp, tele, `barakuda telegrafı (ph=1) ${tele ? 'oluştu' : 'oluşmadı'}`);
  await wait(page, 2600); shots = await page.evaluate(() => eShots.length + enemies.filter(e => e.type === 'okcu').reduce((a, e) => a + e.shots, 0));
  await page.evaluate(() => { paused = true; }); await wait(page, 100); await shot(page, `1-okcu-${vp}`); await page.evaluate(() => { paused = false; });
  note(1, vp, shots > 0, `okçu su jeti atışı: ${shots}`);
  /* bosslar */
  const bosses = [[5, 'boss'], [10, 'yengecKral'], [15, 'kalamar'], [20, 'fener'], [25, 'boss (Öfkeli)']];
  for(const [w, nm] of bosses){
    await page.evaluate(() => { paused = false; });
    await stage(page, w);
    const info = await page.evaluate(() => {
      spawnBoss(); const b = enemies.find(e => e.isBoss);
      const a = 0.6, d = b.beh === 'squid' ? 250 : b.beh === 'angler' ? 310 : 440;
      b.x = CX + Math.cos(a) * d * S; b.y = CY + Math.sin(a) * d * S; b.age = 1;
      if(b.beh === 'squid') b.inkCd = 0.3;
      return { type: b.type, enraged: !!b.enraged };
    });
    await wait(page, 900);
    const st = await page.evaluate(() => {
      const b = enemies.find(e => e.isBoss);
      if(b && b.beh === 'kingcrab'){ b.hp = b.maxHp * 0.74; bossOnDamaged(b); }
      if(b) { b.hp = Math.min(b.hp, b.maxHp * 0.5 + 1); }
      return null;
    });
    await wait(page, 250);
    const hud = await page.evaluate(() => {
      const b = enemies.find(e => e.isBoss);
      return { label: document.getElementById('bossLabel').textContent, wrap: getComputedStyle(document.getElementById('bossWrap')).display,
               fill: document.getElementById('bossFill').style.width, ph: b && b.ph, invul: b && b.invulT, eshots: eShots.length,
               blind: P.blindT, summons: enemies.filter(e => e.summoner).length, hpPct: b ? Math.round(b.hp / b.maxHp * 100) : null,
               labelOverflow: (() => { const e = document.getElementById('bossLabel'); return e.scrollWidth > e.clientWidth + 1; })() };
    });
    await page.evaluate(() => { paused = true; }); await wait(page, 120);
    await shot(page, `1-boss-w${w}-${info.type}${info.enraged ? '-ofkeli' : ''}-${vp}`);
    note(1, vp, hud.wrap === 'block' && Math.abs(parseFloat(hud.fill) - hud.hpPct) < 3,
         `w${w} ${nm}: etiket "${hud.label}", bar ${hud.wrap}/${hud.fill} (can %${hud.hpPct}), ph=${hud.ph}, invul=${(hud.invul||0).toFixed(2)}, ` +
         `eShots=${hud.eshots}, blind=${(hud.blind||0).toFixed(2)}, çağrılan=${hud.summons}${hud.labelOverflow ? ', ETİKET TAŞIYOR' : ''}`);
    await page.evaluate(() => { paused = false; });
  }
  await ctx.close();
};

/* ---------------- 2. Mutasyon ekranı ---------------- */
sections[2] = async vp => {
  const { ctx, page } = await open(vp);
  await stage(page, 10);
  await page.evaluate(() => { enemies = []; spawnQueue = []; spawnIdx = 0; bossSpawned = true; });
  await wait(page, 300);
  const o = await page.evaluate(() => ({ open: isMutationOpen(), vis: document.getElementById('mutation').classList.contains('show'),
    n: document.querySelectorAll('#mutCards .card').length, choices: mutationChoices, wave: P.wave, state }));
  note(2, vp, o.open && o.vis && o.n === 3, `dalga 10 sonu: açık=${o.open}, görünür=${o.vis}, kart=${o.n} ${JSON.stringify(o.choices)}, P.wave=${o.wave}`);
  const geo = await page.evaluate(() => [...document.querySelectorAll('#mutCards .card')].map(c => { const r = c.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; }));
  const vw = VPS[vp].viewport.width, vh = VPS[vp].viewport.height;
  const fitsW = geo.every(g => g.l >= 0 && g.r <= vw), fitsH = geo.every(g => g.b <= vh);
  note(2, vp, fitsW && fitsH, `kartlar ${vw}x${vh}'e sığıyor mu: yatay=${fitsW}, dikey (kaydırmasız)=${fitsH} (${geo.map(g => `${Math.round(g.l)}-${Math.round(g.r)}/${Math.round(g.t)}-${Math.round(g.b)}`).join(' ')})`);
  const ovf = await overflowOf(page, '#mutCards .card, #mutCards .nm, #mutCards .ds');
  if(ovf.length) note(2, vp, false, 'mutasyon kartında taşma: ' + JSON.stringify(ovf));
  await shot(page, `2-mutasyon-${vp}`);
  /* fazlaKol'u zorla sun ve dokunarak seç */
  await page.evaluate(() => { mutationChoices = ['fazlaKol', 'basinc', 'kitin']; renderMutations(15); document.getElementById('mutation').classList.add('show'); });
  await wait(page, 150);
  const before = await page.evaluate(() => ({ arms: P.arms.length, slots: document.querySelectorAll('#armCircle .slot').length }));
  const card = page.locator('#mutCards .card').first();
  if(VPS[vp].hasTouch) await card.tap(); else await card.click();
  await wait(page, 200);
  const after = await page.evaluate(() => ({ arms: P.arms.length, slots: document.querySelectorAll('#armCircle .slot').length, perks: P.perks.slice(),
    open: isMutationOpen(), shop: document.getElementById('shop').classList.contains('show'), msg: document.getElementById('shopMsg').textContent,
    chip: [...document.querySelectorAll('#trkList .trkChip')].map(e => e.textContent.replace(/\s+/g, ' ').trim()).join(' | ') }));
  note(2, vp, after.perks.includes('fazlaKol') && !after.open && after.shop && after.arms === before.arms + 1 && after.slots === before.slots + 1,
       `${VPS[vp].hasTouch ? 'dokunma' : 'tık'} ile Fazladan Dokunaç: perks=${after.perks}, kol ${before.arms}→${after.arms}, yuva ${before.slots}→${after.slots}, market=${after.shop}, mesaj="${after.msg}"`);
  note(2, vp, /Fazladan|🦾/.test(after.chip) ? true : null, `markette perk göstergesi: "${after.chip.slice(0, 160)}"`);
  await page.locator('#armCircle').scrollIntoViewIfNeeded(); await shot(page, `2-mutasyon-sonrasi-${vp}`);
  await ctx.close();
};

/* ---------------- 3. Market ---------------- */
sections[3] = async vp => {
  const { ctx, page } = await open(vp);
  const ids = await page.evaluate(() => { const orig = ['tabanca','midye','zipkin','taramali','pompali','vampir','levye','kurek','yumruk','bumerang','asa','yildirim','zehir','buz','murekkep','alev','testere','mancinik','diken'];
    return Object.keys(WEAPONS).filter(id => !orig.includes(id)); });
  await page.evaluate(ids => { P.gold = 999; shopCards = ids.map(id => ({ kind: 'weapon', id, sold: false })); renderShop(); }, ids);
  await wait(page, 150); await shot(page, `3-yeni-silahlar-${vp}`);
  let ovf = await overflowOf(page, '#cards .card, #cards .card .nm, #cards .card .cl, #cards .card .ds');
  note(3, vp, !ovf.length, `yeni silah kartları (${ids.join(', ')}) taşma: ${ovf.length ? JSON.stringify(ovf) : 'yok'}`);
  const icons = await page.evaluate(() => [...document.querySelectorAll('#cards .card img')].map(i => i.naturalWidth > 0 && i.src.length > 200));
  note(3, vp, icons.every(Boolean), `yeni silah ikonları üretildi: ${icons.join(',')}`);
  const trk = await page.evaluate(() => ['guard','regen','reach'].map(id => TRINKETS.findIndex(t => t.id === id)));
  await page.evaluate(trk => { shopCards = trk.filter(i => i >= 0).map(idx => ({ kind: 'trinket', idx, sold: false })); renderShop(); }, trk);
  await wait(page, 150); await shot(page, `3-yeni-tilsimlar-${vp}`);
  ovf = await overflowOf(page, '#cards .card, #cards .card .nm, #cards .card .ds');
  note(3, vp, !ovf.length, `yeni tılsım kartları taşma: ${ovf.length ? JSON.stringify(ovf) : 'yok'}`);
  /* satın al → tılsım çipleri */
  await page.evaluate(() => { for(let i = 0; i < shopCards.length; i++) buyCard(i); });
  ovf = await overflowOf(page, '#trkList .trkChip, #trkList .trkTx');
  note(3, vp, !ovf.length, `tılsım çipleri taşma: ${ovf.length ? JSON.stringify(ovf) : 'yok'}`);
  /* reroll ücreti (hazine perk'i ile 1) */
  const rr = await page.evaluate(() => { const a = document.getElementById('btnReroll').textContent; P.perks.push('hazine'); renderShop();
    const b = document.getElementById('btnReroll').textContent; const g0 = P.gold; document.getElementById('btnReroll').click(); const paid = g0 - P.gold; P.perks.pop(); renderShop(); return { a, b, paid }; });
  note(3, vp, /2/.test(rr.a) && /1/.test(rr.b) && rr.paid === 1, `reroll: normal "${rr.a}", hazine "${rr.b}", ödenen ${rr.paid}`);
  /* Lv4: dalga 14'te ve 16'da Lv3+Lv3 */
  const lv = await page.evaluate(() => {
    const r = {};
    for(const w of [14, 16]){
      P.wave = w; P.arms = P.arms.map(() => null);
      P.arms[0] = { type: 'tabanca', lv: 3, cdT: 0, aim: 0, uid: newUid('tabanca') };
      P.arms[1] = { type: 'tabanca', lv: 3, cdT: 0, aim: 0, uid: newUid('tabanca') };
      document.getElementById('btnAutoMerge').click();
      r['w' + w + '_merge'] = P.arms.filter(Boolean).map(a => a.type + ':' + a.lv).join(',');
      /* tek Lv3 tabanca varken tür markete dönüyor mu (tasarım: dalga ≥ 15) */
      P.arms = P.arms.map(() => null); P.arms[0] = { type: 'tabanca', lv: 3, cdT: 0, aim: 0, uid: newUid('tabanca') };
      let seen = false; for(let k = 0; k < 80; k++){ rollShop(false); if(shopCards.some(c => c.kind === 'weapon' && c.id === 'tabanca')) seen = true; }
      r['w' + w + '_lv3inShop'] = seen;
    }
    renderShop();
    return r;
  });
  note(3, vp, null, `Lv4: ${JSON.stringify(lv)}`);
  await page.locator('#armCircle').scrollIntoViewIfNeeded(); await shot(page, `3-lv4-${vp}`);
  /* yedek kol + sürükleme (bench → arm) */
  await page.evaluate(() => { P.wave = 5; P.arms = P.arms.map(() => null); const b = TRINKETS.find(t => t.id === 'bench');
    if(P.bench.length === 0) applyTrinket(b);
    P.arms[0] = { type: 'buhar', lv: 1, cdT: 0, aim: 0, uid: newUid('buhar') };
    P.bench[0] = { type: 'buhar', lv: 1, cdT: 0, aim: 0, uid: newUid('buhar') }; renderShop(); });
  await page.locator('#benchRow').scrollIntoViewIfNeeded();
  const fb = await page.locator('#benchRow .slot').first().boundingBox(), tb = await page.locator('#armCircle .slot[data-i="0"]').boundingBox();
  const x0 = fb.x + fb.width / 2, y0 = fb.y + fb.height / 2, x1 = tb.x + tb.width / 2, y1 = tb.y + tb.height / 2;
  if(VPS[vp].hasTouch){
    const cdp = await ctx.newCDPSession(page);
    const tp = (x, y) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(x0, y0) });
    for(let k = 1; k <= 10; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(x0 + (x1 - x0) * k / 10, y0 + (y1 - y0) * k / 10) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }else{
    await page.mouse.move(x0, y0); await page.mouse.down();
    for(let k = 1; k <= 10; k++) await page.mouse.move(x0 + (x1 - x0) * k / 10, y0 + (y1 - y0) * k / 10);
    await page.mouse.up();
  }
  await wait(page, 150);
  const dm = await page.evaluate(() => ({ a0: P.arms[0] && P.arms[0].type + ':' + P.arms[0].lv, b0: P.bench[0] }));
  note(3, vp, dm.a0 === 'buhar:2' && !dm.b0, `yedek→kol sürükle-birleştir (${VPS[vp].hasTouch ? 'dokunma' : 'fare'}): kol0=${dm.a0}, yedek0=${JSON.stringify(dm.b0)}`);
  await shot(page, `3-yedek-surukle-${vp}`);
  await page.evaluate(() => window.scrollTo(0, 0));
  ovf = await overflowOf(page, '#synPanel, #slotInfo, .statRow span, button');
  note(3, vp, !ovf.length, `market genel taşma: ${ovf.length ? JSON.stringify(ovf).slice(0, 300) : 'yok'}`);
  await ctx.close();
};

/* ---------------- 4. HUD, banner, game over, rekor ---------------- */
sections[4] = async vp => {
  const { ctx, page } = await open(vp);
  await page.evaluate(() => { try{ localStorage.removeItem('octoShooter.best.v1'); }catch(e){} });
  await page.evaluate(() => { P.maxHp = P.hp = 1e9; startWave(); });
  await wait(page, 600);
  const h1 = await page.evaluate(() => ({ l: document.getElementById('hudTimeLbl').textContent, v: document.getElementById('hudTime').textContent }));
  note(4, vp, h1.l === '⏳' && +h1.v > 0, `dalga başı sayaç: "${h1.l} ${h1.v}"`);
  await page.evaluate(() => { P.arms = P.arms.map(() => null); spawnIdx = spawnQueue.length; if(!enemies.length) spawnEnemy('yengec', {}); });
  await wait(page, 200);
  const h2 = await page.evaluate(() => ({ l: document.getElementById('hudTimeLbl').textContent, v: document.getElementById('hudTime').textContent, n: enemies.length }));
  note(4, vp, h2.l === 'KALAN' && +h2.v === h2.n, `doğum bitti: "${h2.l} ${h2.v}" (düşman ${h2.n})`);
  await page.evaluate(() => { waveT = WAVE_DURATION - OVERTIME_SEC - 1; });
  await wait(page, 200);
  const h3 = await page.evaluate(() => ({ l: document.getElementById('hudTimeLbl').textContent, v: document.getElementById('hudTime').textContent, sp: enemies.map(e => Math.round(e.speed / S)) }));
  note(4, vp, /⏩/.test(h3.l), `90 sn sonrası: "${h3.l} ${h3.v}"`);
  const hudOvf = await overflowOf(page, '#hud .hudBox, #hud button');
  const hudW = await page.evaluate(() => { const h = document.getElementById('hud'); return { sw: h.scrollWidth, cw: h.clientWidth,
    items: [...h.children].map(c => { const r = c.getBoundingClientRect(); return [c.id || c.className, Math.round(r.left), Math.round(r.right)]; }) }; });
  note(4, vp, !hudOvf.length && hudW.sw <= hudW.cw + 1, `HUD taşma: ${hudOvf.length ? JSON.stringify(hudOvf) : 'yok'}; hud genişlik ${hudW.sw}/${hudW.cw} ${JSON.stringify(hudW.items)}`);
  await shot(page, `4-hud-overtime-${vp}`);
  /* derinlik banner'ı 10 / 20 + ilk karşılaşma */
  for(const w of [6, 10, 20]){
    await page.evaluate(w => { state = SHOP_STATE; P.wave = w; P.seen = {}; P.maxHp = P.hp = 1e9; startWave(); }, w);
    const seq = [];
    for(let k = 0; k < 16; k++){
      const b = await page.evaluate(() => { const el = document.getElementById('banner'); return el.classList.contains('show') ? document.getElementById('bannerT').textContent + ' / ' + document.getElementById('bannerS').textContent : null; });
      if(b && seq[seq.length - 1] !== b){ seq.push(b); if(seq.length === 1) await shot(page, `4-banner-w${w}-${vp}`); }
      await wait(page, 350);
    }
    note(4, vp, seq.length > 0, `dalga ${w} banner sırası: ${seq.join('  →  ') || 'YOK'}`);
  }
  /* banner taşması */
  const bo = await overflowOf(page, '#banner, #bannerT, #bannerS');
  if(bo.length) note(4, vp, false, 'banner taşma: ' + JSON.stringify(bo));
  /* game over + rekor */
  await page.evaluate(() => { state = SHOP_STATE; P.wave = 12; P.time = 1000; P.maxHp = 100; startWave(); P.hp = 0; });
  await wait(page, 300);
  const g1 = await page.evaluate(() => ({ over: document.getElementById('over').classList.contains('show'), depth: document.getElementById('overDepth').innerText,
    ls: localStorage.getItem('octoShooter.best.v1') }));
  note(4, vp, g1.over && /300 m/.test(g1.depth) && /YENİ REKOR/.test(g1.depth) && g1.ls, `game over #1: "${g1.depth.replace(/\n/g, ' | ')}", localStorage=${g1.ls}`);
  const oo = await overflowOf(page, '#overBox, #overBox p');
  const ob = await page.evaluate(() => { const r = document.getElementById('overBox').getBoundingClientRect(); return { b: Math.round(r.bottom), h: innerHeight }; });
  note(4, vp, ob.b <= ob.h, `game over kutusu alt kenarı ${ob.b} / ekran ${ob.h}${oo.length ? ' taşma ' + JSON.stringify(oo).slice(0, 200) : ''}`);
  await shot(page, `4-gameover-rekor-${vp}`);
  await page.locator('#btnRestart').click();
  await wait(page, 200);
  await page.evaluate(() => { P.wave = 3; startWave(); P.hp = 0; });
  await wait(page, 300);
  const g2 = await page.evaluate(() => document.getElementById('overDepth').innerText);
  note(4, vp, /Dalga 12/.test(g2) && !/YENİ/.test(g2), `yeniden başlat + daha kısa koşu: "${g2.replace(/\n/g, ' | ')}"`);
  await page.reload(); await wait(page, 300);
  const g3 = await page.evaluate(() => localStorage.getItem('octoShooter.best.v1'));
  note(4, vp, /"wave":12/.test(g3 || ''), `sayfa yenilendikten sonra rekor: ${g3}`);
  await shot(page, `4-gameover-2-${vp}`);
  await ctx.close();
};

/* ---------------- 5. Resize / döndürme ---------------- */
sections[5] = async vp => {
  if(vp !== 'phone') return;
  const { ctx, page } = await open(vp);
  await stage(page, 16);
  await place(page, [0, 60, 120, 180, 240, 300].map((a, i) => ({ type: ['yengec','okcu','barakuda','kaplumbaga','denizanasi','balon'][i], ang: a, d: 300 })));
  await page.evaluate(() => { paused = true; });
  const rel = () => page.evaluate(() => ({ S, CX, CY, e: enemies.map(e => [(e.x - CX) / S, (e.y - CY) / S, e.r / S]) }));
  const a = await rel(); await shot(page, `5-dikey-${vp}`);
  await page.setViewportSize({ width: 844, height: 390 }); await wait(page, 400);
  const b = await rel(); await shot(page, `5-yatay-${vp}`);
  const maxDev = Math.max(...a.e.map((p, i) => Math.hypot(p[0] - b.e[i][0], p[1] - b.e[i][1])));
  const offscreen = await page.evaluate(() => enemies.filter(e => e.x < 0 || e.x > W || e.y < 0 || e.y > H).length);
  note(5, vp, maxDev < 1, `döndürme 390x844→844x390: S ${a.S}→${b.S}, merkez (${a.CX},${a.CY})→(${b.CX},${b.CY}), oyun-birimi konum sapması maks ${maxDev.toFixed(2)}, ekran dışı ${offscreen}/6`);
  await page.setViewportSize({ width: 390, height: 844 }); await wait(page, 300);
  const c = await rel();
  const dev2 = Math.max(...a.e.map((p, i) => Math.hypot(p[0] - c.e[i][0], p[1] - c.e[i][1])));
  note(5, vp, dev2 < 1, `geri döndürme sonrası sapma ${dev2.toFixed(2)}`);
  /* Market açıkken döndürme */
  await page.evaluate(() => { paused = false; enemies = []; state = SHOP_STATE; openShop(); });
  await page.setViewportSize({ width: 844, height: 390 }); await wait(page, 300);
  await shot(page, `5-market-yatay-${vp}`);
  const mo = await overflowOf(page, '#cards .card .ds, #cards .card .nm');
  note(5, vp, !mo.length, `yatay market taşma: ${mo.length ? JSON.stringify(mo).slice(0, 200) : 'yok'}`);
  await ctx.close();
};

/* ---------------- 6. Metin / dil ---------------- */
sections[6] = async vp => {
  if(vp !== 'phone') return;
  const { ctx, page } = await open(vp);
  const texts = await page.evaluate(() => {
    const out = [];
    for(const id in WEAPONS) out.push(['WEAPONS.' + id, WEAPONS[id].name + ' | ' + WEAPONS[id].desc]);
    for(const t of TRINKETS) out.push(['TRINKETS.' + t.id, t.name + ' | ' + t.desc]);
    for(const m of MUTATIONS) out.push(['MUTATIONS.' + m.id, m.name + ' | ' + m.desc]);
    for(const id in ENEMY_TYPES) out.push(['ENEMY_TYPES.' + id, (ENEMY_TYPES[id].name || '') + ' | ' + (ENEMY_TYPES[id].intro || '')]);
    for(const c in CLASSES) out.push(['CLASSES.' + c, CLASSES[c].disp + ' | ' + CLASSES[c].txt.join(' / ')]);
    for(const z of ZONES) out.push(['ZONES', z.name]);
    out.push(['DOM', document.body.innerText]);
    return out;
  });
  const EN = /\b(the|and|damage|range|speed|wave|boss|shop|reroll|level|enemy|attack|health|gold|crit|armor|slow|stun|merge|sell|start|pause|record|best)\b/i;
  const BAD = /[ÃÄÅ�]|Ä±|ÅŸ|`/;
  const ASCII_TR = /\b(Dalgayi|dalgasi|Oyun Bitti|Yeniden Basla|Satin|altin|dusman|Dusman|Kilic|Buyu\b|Ates\b|Yakin\b|Cubuk\b|Kucuk|Sag\b)\b/;
  let n = 0;
  for(const [k, t] of texts){
    const s = t.replace(/\s+/g, ' ');
    if(BAD.test(s)){ n++; note(6, vp, false, `bozuk karakter/backtick: ${k}: "${s.match(new RegExp('.{0,30}' + BAD.source + '.{0,30}'))[0]}"`); }
    if(k !== 'DOM' && EN.test(s)){ n++; note(6, vp, false, `İngilizce kelime: ${k}: "${s.match(new RegExp('.{0,25}' + EN.source + '.{0,25}', 'i'))[0]}"`); }
    if(ASCII_TR.test(s)){ n++; note(6, vp, false, `Türkçe karakter eksik: ${k}: "${s.match(ASCII_TR)[0]}"`); }
  }
  /* sayı biçimi: ondalık nokta (Türkçede virgül) */
  for(const [k, t] of texts) if(k !== 'DOM' && /\d\.\d/.test(t)){ n++; note(6, vp, false, `ondalık nokta (virgül olmalı): ${k}: "${t.match(/.{0,20}\d\.\d.{0,20}/)[0]}"`); }
  /* ekrana giden dinamik metinler: rapor/HUD etiketleri */
  const dyn = await page.evaluate(() => [trkTotal('guard', 3), trkTotal('regen', 2), trkTotal('reach', 5), trkTotal('crit', 3)]);
  note(6, vp, null, `tılsım toplam metinleri: ${dyn.join(' | ')}`);
  note(6, vp, n === 0, `metin taraması: ${texts.length} kaynak, ${n} şüpheli`);
  await ctx.close();
};

const order = [1, 2, 3, 4, 5, 6].filter(s => !ONLY || ONLY.includes(s));
for(const s of order) for(const vp of ['phone', 'desktop']){
  try { await sections[s](vp); }
  catch(e){ note(s, vp, false, 'BETİK HATASI: ' + e.message.split('\n')[0]); }
}
await browser.close();
console.log('\n--- Konsol hata/uyarıları (' + consoleLog.length + ') ---');
for(const c of [...new Set(consoleLog)].slice(0, 30)) console.log('  ' + c);
fs.writeFileSync(path.join(OUT, 'qa-log.json'), JSON.stringify({ log, console: consoleLog }, null, 1));
console.log(`\nSORUN: ${log.filter(l => l.ok === false).length}, OK: ${log.filter(l => l.ok === true).length}. Görseller: ${OUT}`);
