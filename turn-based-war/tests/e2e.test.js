// e2e.test.js — uçtan uca OTOMATİK OYUNCU (Playwright + sistem Chromium).
// Oyunu file:// ile açar, konsol hatalarını/pageerror'ları toplar, GERÇEK UI tıklamalarıyla
// (buton + canvas) bir savaşı sonuna kadar oynatmayı dener. N kez tekrarlar; kazanma oranı,
// ortalama round, takılma (60sn ilerlemedi) ve hata sayısını raporlar.
//
// Not: Bu dosya yazıldığı sırada oyun aktif olarak kampanyaya dönüştürülüyordu; ekranlar arası
// geçiş (js/campaign-flow.js) ve bazı erişimciler (getEnemyDefs/getItemDefs) eksikti (bkz.
// TEST_REPORT.md). Bot bu yüzden İKİ AŞAMALI çalışır: önce GERÇEK tıklamalarla başlık→yaratım
// ekranlarından savaşa ulaşmayı dener; belirli bir sürede ulaşamazsa (geliştirme henüz bitmemiş
// olabileceğinden) doğrudan startGame()/setupBattle() çağrısıyla savaş ekranına düşer ve SAVAŞIN
// KENDİSİNİ yine tamamen GERÇEK tıklamalarla oynatır — asıl amaç savaş UI'sının uçtan uca
// çalıştığını doğrulamaktır.
"use strict";
const path = require("path");
const fs = require("fs");

const N_RUNS = parseInt(process.argv[2], 10) || 20;
// NOT: gerçek headless Chromium'da her aksiyon gerçek bir DOM tıklaması + ~120-200ms bekleme
// olduğundan, çok sayıda round içeren (özellikle takviye/reinforcements gelen) savaşlar 90sn'yi
// kolayca aşabiliyor (bkz. TEST_REPORT.md §5 — 20 koşudan 12'si bu yüzden "genel koşu zaman
// aşımı" ile sonuçlandı, hiçbiri hata/console.error değildi). Bu yüzden varsayılan 150sn'ye
// çıkarıldı; gerekirse `PER_RUN_TIMEOUT_MS` ortam değişkeniyle de ayarlanabilir.
const PER_RUN_TIMEOUT_MS = parseInt(process.env.PER_RUN_TIMEOUT_MS, 10) || 150_000;
const STUCK_AFTER_MS = 60_000; // "tur ilerlemedi" eşiği (gerçek takılmayı — sonsuz döngü/deadlock — yakalar)

const GAME_URL = "file://" + path.join(__dirname, "..", "index.html");

function findChromiumExecutable() {
  const candidates = [
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    process.env.CHROMIUM_PATH
  ].filter(Boolean);
  for (const c of candidates) if (fs.existsSync(c)) return c;
  // /opt/pw-browsers altında herhangi bir chromium-* sürümünü ara
  const root = "/opt/pw-browsers";
  if (fs.existsSync(root)) {
    for (const d of fs.readdirSync(root)) {
      if (d.startsWith("chromium-")) {
        const p = path.join(root, d, "chrome-linux", "chrome");
        if (fs.existsSync(p)) return p;
      }
    }
  }
  return null;
}

async function main() {
  let chromium;
  try {
    ({ chromium } = require("playwright-core"));
  } catch (e) {
    console.log("playwright-core bulunamadı — `npm install` çalıştırıldı mı? (tests/package.json)");
    process.exit(1);
  }
  const execPath = findChromiumExecutable();
  if (!execPath) {
    console.log("Sistem Chromium bulunamadı (/opt/pw-browsers). e2e testleri atlanıyor.");
    process.exit(0);
  }

  console.log("=== Turn Based War — e2e otomatik oyuncu ===");
  console.log("URL: " + GAME_URL);
  console.log("Chromium: " + execPath);
  console.log("Koşu sayısı: " + N_RUNS + "\n");

  const browser = await chromium.launch({ executablePath: execPath, headless: true });

  const results = [];
  for (let i = 1; i <= N_RUNS; i++) {
    process.stdout.write("Koşu " + i + "/" + N_RUNS + " ... ");
    let res;
    try {
      res = await withTimeout(runOnce(browser, i), PER_RUN_TIMEOUT_MS, "genel koşu zaman aşımı (" + PER_RUN_TIMEOUT_MS + "ms)");
    } catch (e) {
      res = { outcome: "harness-error", error: String(e && e.message || e), consoleErrors: [], pageErrors: [], rounds: 0, reachedBattle: false };
    }
    results.push(res);
    console.log(summarizeOne(res));
  }

  await browser.close();
  printReport(results);
}

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(label)), ms);
    promise.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

function summarizeOne(r) {
  if (r.outcome === "won") return "ZAFER (round " + r.rounds + ")";
  if (r.outcome === "lost") return "YENİLGİ (round " + r.rounds + ")";
  if (r.outcome === "stuck") return "TAKILDI (" + r.stuckReason + ")";
  if (r.outcome === "no-battle") return "SAVAŞA ULAŞILAMADI (" + (r.error || "?") + ")";
  return "HATA: " + (r.error || r.outcome);
}

// ---------------------------------------------------------------
async function runOnce(browser, runIdx) {
  const page = await browser.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", msg => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  page.on("pageerror", err => pageErrors.push(String(err && err.message || err)));

  await page.goto(GAME_URL);
  await page.waitForTimeout(300);

  // 1) GERÇEK tıklamalarla başlık → yaratım → savaş akışını dene (kısa bir süre içinde).
  let reachedBattle = await tryRealNavigationToBattle(page).catch(() => false);

  // 2) Olmadıysa (akış henüz bağlanmamış/eksik olabilir) motoru doğrudan tetikleyip
  //    yine de SAVAŞ EKRANINI GERÇEK tıklamalarla oynatmaya devam et.
  if (!reachedBattle) {
    reachedBattle = await forceStartBattle(page).catch(() => false);
  }

  if (!reachedBattle) {
    await page.close();
    return { outcome: "no-battle", error: "savaş ekranına ulaşılamadı", consoleErrors, pageErrors, rounds: 0, reachedBattle: false };
  }

  const play = await playBattleWithRealClicks(page);
  await page.close();
  return Object.assign({ consoleErrors, pageErrors, reachedBattle: true }, play);
}

// Başlık ekranından gerçek tıklamalarla savaşa ulaşmayı dener (campaign-flow.js varsa çalışır).
async function tryRealNavigationToBattle(page) {
  const btnNewGame = page.locator("#btnNewGame");
  if (await btnNewGame.count() && await btnNewGame.isVisible().catch(() => false)) {
    await btnNewGame.click().catch(() => {});
  }
  // Yaratım ekranı: varsayılan istatistik dağılımı zaten geçerliyse "SAVAŞA BAŞLA" tıklanabilir olur.
  const btnStart = page.locator("#btnStart");
  try {
    await btnStart.waitFor({ state: "visible", timeout: 4000 });
  } catch (e) {
    return false;
  }
  // buton enabled olana kadar bekle (varsayılan puanlar zaten dağıtılmışsa hemen olur)
  try {
    await page.waitForFunction(() => {
      const b = document.getElementById("btnStart");
      return b && !b.disabled;
    }, { timeout: 4000 });
  } catch (e) { /* devam et, yine de tıklamayı dene */ }
  await btnStart.click().catch(() => {});

  // Savaş ekranı (#app) ya da bir kampanya haritası/hikaye ekranı açılmış olabilir; #app aktif
  // olana kadar birkaç saniye bekle. Ara ekranlar (story/map) varsa basit "ilerle" tıklamaları dene.
  // Bölüm başına birden çok düğüm (ör. s1 story -> b1 battle) ve her diyalog sayfasının kendisi
  // 2 tıklama gerektirdiğinden (1. tık daktilo animasyonunu bitirir, 2. tık sayfayı ilerletir)
  // eskiden 15×500ms (7.5sn) yetersiz kalabiliyordu — 40×400ms (16sn)'ye çıkarıldı.
  for (let i = 0; i < 40; i++) {
    if (await isBattleScreenActive(page)) return true;
    await clickCommonAdvanceButtons(page);
    await page.waitForTimeout(400);
  }
  return await isBattleScreenActive(page);
}

async function clickCommonAdvanceButtons(page) {
  const ids = ["btnStoryNext", "btnCampContinue", "btnLevelupContinue", "btnEndingNext"];
  for (const id of ids) {
    const loc = page.locator("#" + id);
    if (await loc.count() && await loc.isVisible().catch(() => false)) { await loc.click().catch(() => {}); return; }
  }
  // harita ekranında yalnızca "current" (tıklanabilir) düğüme tıkla — sıradaki node BUG
  // REGRESYON NOTU: eskiden ".node-list .node" ilk (index 0) elemanı seçiyordu; çok-düğümlü
  // bölümlerde ilk düğüm genelde bir 'story' düğümü olup tıklanınca (campaign-flow.js
  // renderNodeList) sadece i===GameState.nodeIndex olan <li>'ye click listener eklendiği için
  // sonraki düğümlere hiç tıklanamıyor, oyun ekranı sonsuza dek screen-map'te kalıp "TAKILDI"
  // görünüyordu (motor/oyun hatası DEĞİL, bu test scriptinin seçici hatasıydı).
  const node = page.locator(".node-list li.current");
  if (await node.count() && await node.isVisible().catch(() => false)) { await node.click().catch(() => {}); }
}

async function isBattleScreenActive(page) {
  return page.evaluate(() => {
    const app = document.getElementById("app");
    if (!app) return false;
    const visible = app.style.display !== "none" && getComputedStyle(app).display !== "none";
    return visible && typeof State !== "undefined" && State.units && State.units.length > 0 && State.phase !== "setup";
  }).catch(() => false);
}

// Gerçek navigasyon başarısız olursa motoru doğrudan tetikle (yine de battle UI'sini gerçek
// tıklamalarla test edebilmek için) — index.html'in mevcut/geçmiş global fonksiyonlarını dener.
async function forceStartBattle(page) {
  const ok = await page.evaluate(() => {
    try {
      // BUG REGRESYON NOTU: eskiden burada sadece #app/#screen-create/#screen-title'ın
      // style.display'i elle poke ediliyordu — o an aktif olan BAŞKA bir ekran (ör.
      // screen-map/screen-story, gerçek navigasyon yarıda kesilip buraya düşüldüğünde) DOM'da
      // "active" ve görünür KALIYORDU. O ekran #app'in üstünde/yanında hâlâ layout'ta yer
      // kaplayınca Playwright'ın click() actionability kontrolü hedef butonun "obscured"
      // olduğunu düşünüp gerçek tıklamaların onlarca saniye (bazen varsayılan 30sn timeout'a
      // kadar) beklemesine, pratikte savaşın "takıldı" görünmesine yol açıyordu. Oyunun kendi
      // showScreen() fonksiyonu TÜM .screen elemanlarını temizce gizleyip sadece hedefi
      // gösterdiği için varsa onu kullanmak bu sınıfın hatalarını kökten önler.
      if (typeof showScreen === "function") { showScreen("app"); }
      else {
        const app = document.getElementById("app");
        if (app) app.style.display = "flex";
        const create = document.getElementById("screen-create");
        if (create) create.style.display = "none";
        const title = document.getElementById("screen-title");
        if (title) title.style.display = "none";
      }
      if (typeof startGame === "function") { startGame(); return true; }
      if (typeof setupBattle === "function" && typeof initCanvas === "function") {
        setupBattle();
        initCanvas();
        if (typeof bindGameEvents === "function") { try { bindGameEvents(); } catch (e) { /* main.js eski id'lere bağlanmaya çalışıp patlayabilir, yine de devam */ } }
        if (typeof refresh === "function") refresh();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }).catch(() => false);
  if (!ok) return false;
  await page.waitForTimeout(300);
  return isBattleScreenActive(page);
}

// ---------------------------------------------------------------
// Savaşı GERÇEK tıklamalarla (buton + canvas) sonuna kadar oynatır.
async function playBattleWithRealClicks(page) {
  const board = page.locator("#board");
  let lastProgressAt = Date.now();
  let lastSignature = "";
  let steps = 0;
  const MAX_STEPS = 4000;

  while (steps < MAX_STEPS) {
    steps++;
    const snap = await page.evaluate(() => {
      if (typeof State === "undefined") return null;
      const u = (typeof cur === "function") ? cur() : null;
      const enemies = State.units.filter(t => !t.dead && t.side !== "party").map(t => ({ q: t.q, r: t.r, hp: t.hp }));
      const inRangeNow = !!(u && enemies.length && enemies.some(e => hexDist(u, e) <= u.attack.range));
      return {
        phase: State.phase,
        mode: State.mode,
        round: State.round,
        turnCount: State.turnCount || 0,
        winner: State.winner,
        curId: u ? u.id : null,
        curSide: u ? u.side : null,
        curAp: u ? u.ap : null,
        curHasAttacked: u ? u.hasAttacked : null,
        curMovesUsed: u ? u.movesUsed : null,
        targets: (State.targets || []).map(t => ({ q: t.q, r: t.r, hp: t.hp })),
        reachable: Array.from(State.reachable ? State.reachable.keys() : []),
        enemies,
        inRangeNow,
        allDead: enemies.length === 0,
        totalHpSum: State.units.filter(t => !t.dead).reduce((s, t) => s + t.hp, 0)
      };
    }).catch(() => null);

    if (!snap) return { outcome: "stuck", stuckReason: "State okunamadı (sayfa hatası olabilir)", rounds: 0 };

    if (snap.phase === "over") {
      return { outcome: snap.winner === "party" ? "won" : "lost", rounds: snap.round };
    }

    // ilerleme takibi (takılma tespiti): faz + tur numarası + AP + mod + toplam HP birlikte imza oluşturur —
    // hem "round hiç ilerlemiyor" hem "bot aynı modda takla atıyor" durumlarını yakalar.
    const signature = [snap.phase, snap.turnCount, snap.curId, snap.curAp, snap.mode, snap.curHasAttacked, snap.curMovesUsed, snap.totalHpSum].join("|");
    if (signature !== lastSignature) { lastSignature = signature; lastProgressAt = Date.now(); }
    if (Date.now() - lastProgressAt > STUCK_AFTER_MS) {
      return { outcome: "stuck", stuckReason: "60sn boyunca oyun durumu ilerlemedi (round " + snap.round + ", phase " + snap.phase + ", mode " + snap.mode + ")", rounds: snap.round };
    }

    if (snap.phase === "enemy") {
      // düşman AI'sının kendi setTimeout zincirini bitirmesini bekle
      await page.waitForTimeout(200);
      continue;
    }

    if (snap.phase !== "playerInput" || snap.curSide !== "party") {
      await page.waitForTimeout(150);
      continue;
    }
    if (snap.allDead) { await page.waitForTimeout(150); continue; } // checkEnd henüz işlenmemiş olabilir

    // ---- OYUNCU SIRASI: basit durum makinesi (idle/attack/move) — asla iki modu birden aç/kapa yapıp salınmaz ----
    if (snap.mode === "attack") {
      if (snap.targets.length) {
        const t = snap.targets.slice().sort((a, b) => a.hp - b.hp)[0];
        await clickHex(page, board, t.q, t.r);
      } else {
        await page.locator("#btnAttack").click().catch(() => {}); // hedef yok -> modu kapat (toggle)
      }
      await page.waitForTimeout(120);
      continue;
    }
    if (snap.mode === "move") {
      if (snap.reachable.length) {
        const dest = await page.evaluate((enemies) => {
          let best = null, bestC = 1e9;
          for (const k of Array.from(State.reachable.keys())) {
            const [q, r] = k.split(",").map(Number);
            for (const e of enemies) {
              const c = hexDist({ q, r }, e);
              if (c < bestC) { bestC = c; best = { q, r }; }
            }
          }
          return best;
        }, snap.enemies).catch(() => null);
        if (dest) { await clickHex(page, board, dest.q, dest.r); await page.waitForTimeout(120); continue; }
      }
      await page.locator("#btnMove").click().catch(() => {}); // gidecek yer yok -> modu kapat
      await page.waitForTimeout(120);
      continue;
    }

    // mode === "idle": sırayla dene — menzildeyse saldır, değilse yaklaş, ikisi de olmuyorsa turu bitir
    if (snap.curAp >= 2 && !snap.curHasAttacked && snap.inRangeNow) {
      await page.locator("#btnAttack").click().catch(() => {});
    } else if (snap.curAp >= 1 && snap.curMovesUsed < 2 && snap.enemies.length) {
      await page.locator("#btnMove").click().catch(() => {});
    } else if (snap.curAp >= 2 && !snap.curHasAttacked && snap.enemies.length) {
      // menzilde değil ama hareket hakkı da bitti — yine de dene (menzili geniş silahlar için)
      await page.locator("#btnAttack").click().catch(() => {});
    } else {
      await page.locator("#btnEnd").click().catch(() => {});
    }
    await page.waitForTimeout(120);
  }
  return { outcome: "stuck", stuckReason: "MAX_STEPS (" + MAX_STEPS + ") aşıldı", rounds: 0 };
}

async function clickHex(page, board, q, r) {
  const c = await page.evaluate(([q, r]) => hexCenter(q, r), [q, r]).catch(() => null);
  if (!c) return;
  await board.click({ position: { x: c.x, y: c.y } }).catch(() => {});
}

// ---------------------------------------------------------------
function printReport(results) {
  const n = results.length;
  const won = results.filter(r => r.outcome === "won").length;
  const lost = results.filter(r => r.outcome === "lost").length;
  const stuck = results.filter(r => r.outcome === "stuck").length;
  const noBattle = results.filter(r => r.outcome === "no-battle").length;
  const harnessErr = results.filter(r => r.outcome === "harness-error").length;
  const finished = results.filter(r => r.outcome === "won" || r.outcome === "lost");
  const avgRounds = finished.length ? (finished.reduce((s, r) => s + (r.rounds || 0), 0) / finished.length).toFixed(1) : "n/a";

  const allConsoleErrors = results.flatMap(r => r.consoleErrors || []);
  const allPageErrors = results.flatMap(r => r.pageErrors || []);
  const uniq = arr => Array.from(new Set(arr));

  console.log("\n" + "=".repeat(60));
  console.log("E2E ÖZET (" + n + " koşu)");
  console.log("=".repeat(60));
  console.log("Savaşa ulaşan: " + (n - noBattle) + "/" + n);
  console.log("Zafer: " + won + "   Yenilgi: " + lost + "   Takıldı: " + stuck + "   Savaşa ulaşılamadı: " + noBattle + "   Harness hatası: " + harnessErr);
  console.log("Kazanma oranı (tamamlanan savaşlar arasında): " + (finished.length ? (100 * won / finished.length).toFixed(1) + "%" : "n/a"));
  console.log("Ortalama round (tamamlanan savaşlar): " + avgRounds);
  console.log("\nToplam console.error sayısı: " + allConsoleErrors.length);
  console.log("Toplam pageerror (yakalanmamış istisna) sayısı: " + allPageErrors.length);

  const uniqPage = uniq(allPageErrors);
  if (uniqPage.length) {
    console.log("\nBenzersiz pageerror mesajları (" + uniqPage.length + "):");
    for (const m of uniqPage.slice(0, 20)) console.log("  - " + m);
  }
  const uniqConsole = uniq(allConsoleErrors);
  if (uniqConsole.length) {
    console.log("\nBenzersiz console.error mesajları (" + uniqConsole.length + ", ilk 20):");
    for (const m of uniqConsole.slice(0, 20)) console.log("  - " + m);
  }

  const stuckDetails = results.filter(r => r.outcome === "stuck");
  if (stuckDetails.length) {
    console.log("\nTakılma detayları:");
    for (const r of stuckDetails.slice(0, 10)) console.log("  - " + r.stuckReason);
  }
  const noBattleDetails = results.filter(r => r.outcome === "no-battle" || r.outcome === "harness-error");
  if (noBattleDetails.length) {
    console.log("\nSavaşa ulaşamama / harness hata detayları:");
    for (const r of noBattleDetails.slice(0, 10)) console.log("  - " + (r.error || r.outcome));
  }

  console.log("\n(exit code 0 — bu bir keşif/rapor betiğidir, CI 'fail' anlamına gelmez; " +
    "bulgular docs/TEST_REPORT.md içine elle aktarılır.)");
}

main().catch(e => { console.error("e2e.test.js çöktü:", e); process.exit(1); });
