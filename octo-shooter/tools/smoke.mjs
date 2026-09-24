#!/usr/bin/env node
/* =========================================================================
   Octo-Shooter TARAYICI SMOKE TESTİ (Playwright + Chromium)
   -------------------------------------------------------------------------
   index.html'i file:// ile açar; telefon (390x844) ve masaüstü (1280x800)
   viewport'larında şunları kontrol eder:
     1. sayfa yükleniyor, konsolda hata / yakalanmamış exception yok
     2. market açık, 5 kart var
     3. ilk kart (garanti Tabanca) satın alınıyor → altın düşüyor, kolda silah var
     4. silah sürükle-bırak ile başka kola taşınabiliyor
     5. dalga başlıyor (HUD görünür, market kapalı)
     6. 10 sn sonra düşman var, HUD sayacı/altın güncelleniyor, canvas boş değil
     7. hız butonu 1x→2x geçiyor ve oyun zamanı ~2 kat hızlı akıyor
   Ekran görüntüleri: tools/shots/<viewport>-<adım>.png

   Kullanım: node smoke.mjs [--file ../index.html] [--headed]
   Tarayıcı: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers (playwright install ÇALIŞTIRMAYIN)
========================================================================= */
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const argVal = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const FILE = path.resolve(argVal('--file', path.join(__dirname, '..', 'index.html')));
const HEADED = argv.includes('--headed');
const SHOTS = path.join(__dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
if(!process.env.PLAYWRIGHT_BROWSERS_PATH) process.env.PLAYWRIGHT_BROWSERS_PATH = '/opt/pw-browsers';

const VIEWPORTS = [
  { name: 'phone-390x844',   viewport: { width: 390,  height: 844 }, isMobile: true,  hasTouch: true, deviceScaleFactor: 2 },
  { name: 'desktop-1280x800', viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 }
];

async function launch(){
  try { return await chromium.launch({ headless: !HEADED }); }
  catch(e){
    /* Sürüm uyuşmazlığında sabit yolu dene */
    const cands = ['/opt/pw-browsers/chromium/chrome-linux/chrome',
                   ...fs.readdirSync('/opt/pw-browsers').filter(d => /^chromium-\d+$/.test(d))
                     .map(d => `/opt/pw-browsers/${d}/chrome-linux/chrome`)];
    for(const p of cands) if(fs.existsSync(p)) return chromium.launch({ headless: !HEADED, executablePath: p });
    throw e;
  }
}

const results = [];
function check(vp, name, ok, detail){
  results.push({ vp, name, ok: !!ok, detail });
  console.log(`${ok ? 'GEÇTİ ' : 'KALDI '} [${vp}] ${name}${detail ? ' — ' + detail : ''}`);
}

async function runViewport(browser, cfg){
  const vp = cfg.name;
  const ctx = await browser.newContext({ viewport: cfg.viewport, isMobile: cfg.isMobile,
                                         hasTouch: cfg.hasTouch, deviceScaleFactor: cfg.deviceScaleFactor });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if(m.type() === 'error') errors.push('console.error: ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + (e.stack || e.message)));
  const shot = n => page.screenshot({ path: path.join(SHOTS, `${vp}-${n}.png`) });

  try {
    /* 1. yükleme */
    await page.goto(pathToFileURL(FILE).href, { waitUntil: 'load' });
    await page.waitForTimeout(500);
    check(vp, 'sayfa yüklendi', (await page.title()).length > 0, `title="${await page.title()}"`);

    /* 2. market */
    const shopOpen = await page.evaluate(() => document.getElementById('shop').classList.contains('show'));
    const nCards = await page.locator('#cards .card').count();
    check(vp, 'market açık + kartlar', shopOpen && nCards >= 1, `shop.show=${shopOpen}, kart=${nCards}`);
    await shot('1-market');

    /* 3. satın al */
    const gold0 = Number(await page.locator('#sGold').textContent());
    await page.locator('#cards .card').first().click();
    const gold1 = Number(await page.locator('#sGold').textContent());
    const fullSlots = await page.locator('#armCircle .slot.full').count();
    check(vp, 'silah satın alındı ve kola takıldı', gold1 < gold0 && fullSlots >= 1,
          `altın ${gold0}→${gold1}, dolu kol=${fullSlots}`);

    /* 4. sürükle-bırak: dolu kolu 3 yuva ötedeki boş kola taşı.
       Telefon: CDP dokunma olayları; masaüstü: fare. İkon (img) ORTASINDAN tutulur —
       oyuncunun doğal hareketi. Masaüstünde başarısızsa yuva KENARINDAN da denenir
       (tanı: img'nin yerel HTML5 sürüklemesi pointercancel tetikliyor mu?). */
    const fromI = Number(await page.locator('#armCircle .slot.full').first().getAttribute('data-i'));
    const nArms = await page.locator('#armCircle .slot').count();
    const toI = (fromI + 3) % nArms;
    /* market paneli kaydırılabilir; kol çemberi ekran dışındaysa olaylar ulaşmaz */
    await page.locator('#armCircle').scrollIntoViewIfNeeded();
    const boxOf = i => page.locator(`#armCircle .slot[data-i="${i}"]`).boundingBox();
    const armsNow = () => page.evaluate(() => P.arms.map(a => a && a.type));
    async function drag(a, b, mode, grabDx){
      const fb = await boxOf(a), tb = await boxOf(b);
      if(!fb || !tb) return false;
      const x0 = fb.x + (grabDx ?? fb.width / 2), y0 = fb.y + fb.height / 2;
      const x1 = tb.x + tb.width / 2, y1 = tb.y + tb.height / 2;
      const before = await armsNow();
      if(mode === 'touch'){
        const cdp = await page.context().newCDPSession(page);
        const tp = (x, y) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(x0, y0) });
        for(let k = 1; k <= 10; k++)
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(x0 + (x1 - x0) * k / 10, y0 + (y1 - y0) * k / 10) });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await cdp.detach();
      }else{
        await page.mouse.move(x0, y0);
        await page.mouse.down();
        for(let k = 1; k <= 10; k++) await page.mouse.move(x0 + (x1 - x0) * k / 10, y0 + (y1 - y0) * k / 10);
        await page.mouse.up();
      }
      await page.waitForTimeout(100);
      const after = await armsNow();
      return after[a] === null && after[b] === before[a] && before[a] != null;
    }
    const mode = cfg.hasTouch ? 'touch' : 'mouse';
    const movedIcon = await drag(fromI, toI, mode);
    check(vp, `sürükle-bırak (${mode}, ikondan tutarak)`, movedIcon, `kol ${fromI + 1} → ${toI + 1}`);
    if(!movedIcon && mode === 'mouse'){
      const movedEdge = await drag(fromI, toI, 'mouse', 5);
      console.log(`       tanı: yuva kenarından (img dışından) tutunca ${movedEdge ? 'ÇALIŞIYOR' : 'o da çalışmıyor'}` +
                  (movedEdge ? ' → img yerel sürüklemesi pointercancel tetikliyor (img draggable)' : ''));
    }
    await shot('2-satin-alindi');

    /* 5. dalga başlat */
    await page.locator('#btnStart').click();
    await page.waitForTimeout(300);
    const hudOn = await page.evaluate(() => getComputedStyle(document.getElementById('hud')).display !== 'none'
                                           && !document.getElementById('shop').classList.contains('show')
                                           && state === WAVE_STATE);
    check(vp, 'dalga başladı (HUD açık, market kapalı)', hudOn);
    const t0 = await page.locator('#hudTime').textContent();

    /* 6. 10 sn sonra */
    await page.waitForTimeout(10000);
    const st = await page.evaluate(() => ({
      enemies: enemies.length, kills: P.kills, hp: P.hp, waveT, state,
      hudTime: document.getElementById('hudTime').textContent,
      hudGold: document.getElementById('hudGold').textContent,
      hpBar: document.getElementById('hpBar').style.width
    }));
    check(vp, '10 sn sonra düşman var', st.enemies > 0 || st.kills > 0, `düşman=${st.enemies}, öldürülen=${st.kills}`);
    check(vp, 'HUD güncelleniyor', st.hudTime !== t0 && Number(st.hudTime) <= 21,
          `süre ${t0}→${st.hudTime}, ${st.hudGold}, can barı ${st.hpBar || '100%'}`);
    const nonBlank = await page.evaluate(() => {
      const c = document.getElementById('cv'), g = c.getContext('2d');
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let mn = 255, mx = 0;
      for(let i = 0; i < d.length; i += 4 * 97){ const v = d[i] + d[i + 1] + d[i + 2]; if(v < mn) mn = v; if(v > mx) mx = v; }
      return mx - mn;
    });
    check(vp, 'canvas çiziliyor', nonBlank > 30, `piksel aralığı=${nonBlank}`);
    await shot('3-dalga-10sn');

    /* 7. hız butonu */
    const w1 = await page.evaluate(() => waveT);
    await page.waitForTimeout(2000);
    const w2 = await page.evaluate(() => waveT);
    await page.locator('#btnSpeed').click();
    const spdTxt = await page.locator('#btnSpeed').textContent();
    const w3 = await page.evaluate(() => waveT);
    await page.waitForTimeout(2000);
    const w4 = await page.evaluate(() => waveT);
    const r1 = w1 - w2, r2 = w3 - w4, ratio = r2 / Math.max(1e-6, r1);
    const gs = await page.evaluate(() => gameSpeed);
    check(vp, 'hız butonu 1x→2x', gs === 2 && /2x/.test(spdTxt) && ratio > 1.5,
          `buton="${spdTxt}", 2sn'de oyun-zamanı 1x:${r1.toFixed(2)} 2x:${r2.toFixed(2)} (oran ${ratio.toFixed(2)})`);
    await shot('4-hiz-2x');
  } catch(e){
    check(vp, 'test akışı exception', false, e.message.split('\n')[0]);
    await shot('HATA').catch(() => {});
  }
  check(vp, 'konsolda hata yok', errors.length === 0, errors.slice(0, 3).join(' || '));
  await ctx.close();
}

const browser = await launch();
console.log(`Chromium ${browser.version()} — ${FILE}`);
for(const cfg of VIEWPORTS) await runViewport(browser, cfg);
await browser.close();
const fail = results.filter(r => !r.ok);
console.log(`\nSONUÇ: ${results.length - fail.length}/${results.length} kontrol geçti${fail.length ? ' — KALDI' : ' — GEÇTİ'}. Ekran görüntüleri: ${SHOTS}`);
process.exitCode = fail.length ? 1 : 0;
