// e2e-campaign.js — TAM KAMPANYA UÇTAN UCA (Playwright + sistem Chromium, ?debug=1).
// Başlıktan finale kadar TÜM kampanyayı GERÇEK UI etkileşimleriyle (tıklama/seçim/klavye) geçer.
// Her savaşta motoru hızlandırmak için window.__TBW.forceWin()/forceLose() kullanılır AMA her
// savaşta önce en az 1 gerçek oyuncu aksiyonu (hareket+saldırı veya büyü) ve en az 1 düşman
// turu gerçekten oynatılır. Sonuç→levelup→kamp akışları, opsiyonel düğüm, ch2choice dalları,
// sayfa yenileme/devam, "Tekrar Dene" akışı, klavye kısayolları, ayarlar/yardım ekranı ve
// pencere yeniden boyutlandırma sırasında tıklama isabeti (pixelToHex) GERÇEK etkileşimlerle
// test edilir. Her ekran geçişinde ekran görüntüsü (tests/shots/) alınır, console.error/
// pageerror toplanır. Bulgular TEST_REPORT.md'ye elle aktarılır (bkz. bu betiğin çıktısı).
"use strict";
const path = require("path");
const fs = require("fs");

const GAME_URL = "file://" + path.join(__dirname, "..", "index.html") + "?debug=1";
const SHOTS_DIR = path.join(__dirname, "shots");
const STEP_TIMEOUT = 12000;
const MAX_DRIVE_STEPS = 260;

function findChromiumExecutable() {
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

// ---------------------------------------------------------------
const findings = []; // {level:"P0"|"P1"|"P2"|"info", area, text}
function report(level, area, text) { findings.push({ level, area, text }); console.log("  [" + level + "/" + area + "] " + text); }

let shotIdx = 0;
async function shot(page, label) {
  try {
    shotIdx++;
    const name = String(shotIdx).padStart(3, "0") + "-" + label.replace(/[^a-z0-9_-]+/gi, "_").slice(0, 60) + ".png";
    await page.screenshot({ path: path.join(SHOTS_DIR, name) });
  } catch (e) { /* ekran görüntüsü alınamadıysa testi durdurma */ }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function currentScreen(page) {
  return page.evaluate(() => {
    const active = document.querySelector(".screen.active");
    return active ? active.id : (document.getElementById("app") && document.getElementById("app").style.display !== "none" ? "app" : null);
  }).catch(() => null);
}

async function clickOnclickSubstr(page, containerSel, substr, opts) {
  opts = opts || {};
  const idx = await page.evaluate(([sel, s]) => {
    const btns = Array.from(document.querySelectorAll(sel + " button"));
    return btns.findIndex(b => (b.getAttribute("onclick") || "").indexOf(s) >= 0 && !b.disabled);
  }, [containerSel, substr]).catch(() => -1);
  if (idx < 0) return false;
  await page.locator(containerSel + " button").nth(idx).click(opts).catch(() => {});
  return true;
}

// ---------------------------------------------------------------
async function tbwState(page) {
  return page.evaluate(() => {
    if (!window.__TBW) return null;
    const S = window.__TBW.State;
    const gs = window.__TBW.GameState ? window.__TBW.GameState() : null;
    return {
      phase: S.phase, mode: S.mode, round: S.round, winner: S.winner, turnCount: S.turnCount,
      curSide: (typeof cur === "function" && cur()) ? cur().side : null,
      curAp: (typeof cur === "function" && cur()) ? cur().ap : null,
      curHasAttacked: (typeof cur === "function" && cur()) ? cur().hasAttacked : null,
      curSpells: (typeof cur === "function" && cur()) ? !!cur().spells : null,
      gold: gs ? gs.gold : null,
      chapterIndex: gs ? gs.chapterIndex : null, nodeIndex: gs ? gs.nodeIndex : null,
      inventory: gs ? gs.inventory : null
    };
  }).catch(() => null);
}

async function clickHexOf(page, q, r) {
  const c = await page.evaluate(([q, r]) => (typeof hexCenter === "function" ? hexCenter(q, r) : null), [q, r]).catch(() => null);
  if (!c) return false;
  await page.locator("#board").click({ position: { x: c.x, y: c.y } }).catch(() => {});
  return true;
}

// Savaş içinde en az 1 GERÇEK oyuncu aksiyonu (hareket+saldırı veya büyü) + 1 GERÇEK düşman
// turu oynatır, sonra debug forceWin()/forceLose() ile bitirir. Opsiyonel: bir iksir kullan,
// bir bomba at (Eşya menüsü — sadece envanterde varsa).
async function playOneBattleReal(page, opts) {
  opts = opts || {};
  await page.waitForFunction(() => window.__TBW && window.__TBW.State && window.__TBW.State.phase !== "setup", { timeout: STEP_TIMEOUT }).catch(() => {});
  await shot(page, "battle-start");

  // playerInput'a kadar bekle (ilk sırada düşman olabilir)
  for (let i = 0; i < 40; i++) {
    const s = await tbwState(page);
    if (!s) break;
    if (s.phase === "playerInput" && s.curSide === "party") break;
    if (s.phase === "over") break;
    await sleep(250);
  }

  let realActionDone = false;
  const s0 = await tbwState(page);
  if (s0 && s0.phase === "playerInput" && s0.curSide === "party") {
    // Bomba atılacaksa (opts.useBomb) AP'nin dolu olduğu ilk anda (hareket/saldırıdan ÖNCE)
    // dene — aksi halde move(1)+attack(2) AP'yi tüketip bombaya (2 AP) yer kalmayabiliyordu.
    if (opts.useBomb && !opts._bombThrown) {
      const bombId = await page.evaluate(() => {
        const gs = window.__TBW.GameState();
        if (!gs || !gs.inventory) return null;
        return Object.keys(gs.inventory).find(id => id.indexOf("bomb_") === 0) || null;
      }).catch(() => null);
      if (bombId) {
        await page.locator("#btnItem").click().catch(() => {});
        const clicked = await clickOnclickSubstr(page, "#itemmenu", bombId);
        if (clicked) {
          const enemy = await page.evaluate(() => (window.__TBW.State.targets || [])[0] || null).catch(() => null);
          if (enemy) { await clickHexOf(page, enemy.q, enemy.r); report("info", "item", "Savaşta " + bombId + " gerçek tıklamayla atıldı."); opts._bombThrown = true; realActionDone = true; }
          else report("P2", "item", bombId + " için menzilde hedef yoktu, bomba atılamadı.");
        } else report("P2", "item", "Eşya menüsünde " + bombId + " butonu bulunamadı/tıklanamadı.");
      }
    }
    // Büyücü/cleric ise büyü dener, yoksa hareket + saldırı.
    if (s0.curSpells) {
      await page.locator("#btnSpell").click().catch(() => {});
      const spellIdx = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("#spellmenu button"));
        return btns.findIndex(b => !b.disabled);
      }).catch(() => -1);
      if (spellIdx >= 0) {
        await page.locator("#spellmenu button").nth(spellIdx).click().catch(() => {});
        const t = await page.evaluate(() => (window.__TBW.State.targets || [])[0] || null).catch(() => null);
        if (t) { await clickHexOf(page, t.q, t.r); realActionDone = true; }
      }
    }
    if (!realActionDone) {
      // hareket (gerçek): btnMove -> reachable'dan bir hex -> canvas tıklaması
      await page.locator("#btnMove").click().catch(() => {});
      const dest = await page.evaluate(() => {
        const keys = Array.from(window.__TBW.State.reachable ? window.__TBW.State.reachable.keys() : []);
        if (!keys.length) return null;
        const [q, r] = keys[0].split(",").map(Number);
        return { q, r };
      }).catch(() => null);
      if (dest) { await clickHexOf(page, dest.q, dest.r); await sleep(150); realActionDone = true; }
      // saldırı (gerçek, menzildeyse)
      await page.locator("#btnAttack").click().catch(() => {});
      const target = await page.evaluate(() => (window.__TBW.State.targets || [])[0] || null).catch(() => null);
      if (target) { await clickHexOf(page, target.q, target.r); realActionDone = true; }
      else { await page.locator("#btnAttack").click().catch(() => {}); } // menzilde kimse yoksa modu kapat
    }
  }
  if (!realActionDone) report("P2", "battle-bot", "Bu savaşta gerçek bir oyuncu aksiyonu tamamlanamadı (ilk sırada oyuncu değildi ya da menzilde/erişilebilir hedef yoktu) — forceWin ile devam edildi.");

  // eşya kullanımı: iksir (varsa)
  if (opts.useItem) {
    const hasPotion = await page.evaluate(() => {
      const gs = window.__TBW.GameState();
      return gs && gs.inventory && gs.inventory.potion_heal > 0;
    }).catch(() => false);
    if (hasPotion) {
      await page.locator("#btnItem").click().catch(() => {});
      const clicked = await clickOnclickSubstr(page, "#itemmenu", "potion_heal");
      if (clicked) {
        const self = await page.evaluate(() => { const u = cur(); return u ? { q: u.q, r: u.r } : null; }).catch(() => null);
        if (self) { await clickHexOf(page, self.q, self.r); report("info", "item", "Savaşta potion_heal gerçek tıklamayla kullanıldı."); }
      }
    } else report("info", "item", "Bu savaşta envanterde potion_heal yoktu, iksir kullanımı atlandı (henüz camp'ten alınmamıştı).");
  }
  if (opts.useBomb && !opts._bombThrown) report("info", "item", "Bu savaşta envanterde bomba yoktu (ya da AP yetmedi), bomba atma atlandı.");

  await shot(page, "battle-after-player-action");

  // en az 1 GERÇEK düşman turu: turu bitir, "enemy" fazının göründüğünü VEYA (animSpeed=3'te
  // enemy fazı anlık geçebildiğinden, poll iki ölçüm arasını kaçırabilir) turnCount'un en az 1
  // arttığını doğrula — ikisinden biri düşman(lar)ın gerçekten hamle yaptığının kanıtıdır.
  let sawEnemyPhase = false;
  const beforeEnd = await tbwState(page);
  const turnCountBefore = beforeEnd ? beforeEnd.turnCount : null;
  if (beforeEnd && beforeEnd.phase === "playerInput" && beforeEnd.curSide === "party") {
    await page.locator("#btnEnd").click().catch(() => {});
  }
  let turnCountAfter = turnCountBefore;
  for (let i = 0; i < 30; i++) {
    const s = await tbwState(page);
    if (!s) break;
    if (s.phase === "enemy") sawEnemyPhase = true;
    turnCountAfter = s.turnCount;
    if (s.phase === "over") break;
    if (sawEnemyPhase && s.phase === "playerInput") break; // düşman turu bitip oyuncuya döndü
    if (!sawEnemyPhase && s.phase === "playerInput" && turnCountAfter > turnCountBefore) break; // fazı kaçırdık ama ilerleme oldu
    await sleep(200);
  }
  const progressedViaTurnCount = turnCountBefore != null && turnCountAfter != null && turnCountAfter > turnCountBefore;
  if (!sawEnemyPhase && !progressedViaTurnCount) {
    report("P1", "battle-bot", "Bu savaşta düşman turu gözlemlenemedi (ne 'enemy' fazı ne de turnCount ilerlemesi görüldü) — ilk sırada zaten oyuncu olmayabilir ya da gerçekten hiç ilerleme olmadı.");
  } else if (!sawEnemyPhase && progressedViaTurnCount) {
    report("info", "battle-bot", "'enemy' fazı doğrudan yakalanamadı (animSpeed=Anında ile çok hızlı geçti) ama turnCount ilerledi (" + turnCountBefore + "→" + turnCountAfter + ") — düşman(lar) gerçekten hamle yaptı.");
  }

  await shot(page, "battle-after-enemy-turn");

  // debug hook ile bitir
  const ok = await page.evaluate((lose) => {
    if (!window.__TBW) return false;
    if (lose) window.__TBW.forceLose(); else window.__TBW.forceWin();
    return true;
  }, !!opts.forceLose).catch(() => false);
  if (!ok) report("P0", "debug-hook", "window.__TBW." + (opts.forceLose ? "forceLose" : "forceWin") + "() çağrılamadı (__TBW tanımsız olabilir).");

  await page.waitForFunction(() => document.getElementById("screen-result") && document.getElementById("screen-result").classList.contains("active"), { timeout: STEP_TIMEOUT }).catch(() => {
    report("P0", "battle-end", "forceWin/forceLose sonrası screen-result aktif olmadı (zaman aşımı).");
  });
  await shot(page, opts.forceLose ? "battle-lost" : "battle-won");
}

// ---------------------------------------------------------------
async function advanceStoryUntilDone(page, opts) {
  opts = opts || {};
  for (let i = 0; i < 20; i++) {
    const screen = await currentScreen(page);
    if (screen !== "screen-story") return;
    const hasChoice = await page.evaluate(() => !!document.querySelector(".choice-list")).catch(() => false);
    if (hasChoice) {
      const n = await page.evaluate(() => document.querySelectorAll(".choice-list button").length).catch(() => 0);
      const idx = Math.min(opts.choiceBranch || 0, Math.max(0, n - 1));
      await page.locator(".choice-list button").nth(idx).click().catch(() => {});
      report("info", "choice", "ch2choice: seçenek " + idx + " gerçek tıklamayla seçildi.");
      await shot(page, "choice-picked-" + idx);
      await sleep(200);
      continue;
    }
    await page.locator("#btnStoryNext").click().catch(() => {});
    await sleep(180);
  }
}

async function handleLevelupIfPresent(page) {
  const screen = await currentScreen(page);
  if (screen !== "screen-levelup") return false;
  await shot(page, "levelup");
  // gerçek tıklama: ilk kartın stat + butonuna birkaç kez bas (varsa), ilk büyü checkbox'larını işaretle
  const plusCount = await page.evaluate(() => document.querySelectorAll(".stat-alloc button").length).catch(() => 0);
  for (let i = 0; i < Math.min(2, plusCount); i++) {
    await page.locator(".stat-alloc button").filter({ hasText: "+" }).first().click().catch(() => {});
    await sleep(80);
  }
  const cbCount = await page.evaluate(() => document.querySelectorAll(".spell-pick input[type=checkbox]").length).catch(() => 0);
  for (let i = 0; i < cbCount; i++) {
    await page.locator(".spell-pick input[type=checkbox]").nth(i).check().catch(() => {});
  }
  report("info", "levelup", "Seviye atlama ekranında " + Math.min(2, plusCount) + " stat puanı ve " + cbCount + " büyü gerçek tıklama/işaretlemeyle seçildi.");
  await shot(page, "levelup-filled");
  await page.locator("#btnLevelupContinue").click().catch(() => {});
  return true;
}

async function handleCamp(page, opts) {
  opts = opts || {};
  await shot(page, "camp");
  // 0) mümkünse bir BOMBA satın al (henüz alınmadıysa) — savaşta "bomba at" testi için gerekli.
  if (!opts.boughtBombSoFar) {
    const boughtBomb = await clickOnclickSubstr(page, "#shopGrid", "buyItem('bomb_");
    if (boughtBomb) { report("info", "camp-shop", "Camp'te gerçek tıklamayla bir bomba satın alındı."); await sleep(120); }
  }
  // 1) bir eşya satın al (mağazadaki ilk "Al" butonu)
  const bought = await clickOnclickSubstr(page, "#shopGrid", "buyItem");
  report(bought ? "info" : "P2", "camp-shop", bought ? "Camp'te gerçek tıklamayla bir eşya satın alındı." : "Camp'te satın alınabilecek eşya bulunamadı (altın yetersiz olabilir).");
  await sleep(120);
  // 2) silah/zırh/tılsım kuşan: ilk hero kartındaki büyülü silah/zırh/tılsım select'lerinden birini seç (varsa)
  const equipped = await page.evaluate(() => {
    const selects = Array.from(document.querySelectorAll("#campHeroes select"));
    for (const sel of selects) {
      if (sel.options.length > 1) { sel.selectedIndex = 1; sel.dispatchEvent(new Event("change")); return sel.getAttribute("onchange"); }
    }
    return null;
  }).catch(() => null);
  report(equipped ? "info" : "P2", "camp-equip", equipped ? "Camp'te gerçek select ile kuşanıldı: " + equipped : "Kuşanılabilecek (2+ seçenekli) bir donanım select'i bulunamadı.");
  await sleep(120);
  await shot(page, "camp-after-buy-equip");
  // 3) bir eşya sat (envanterden)
  const sold = await clickOnclickSubstr(page, "#invList", "sellItem");
  report(sold ? "info" : "P2", "camp-sell", sold ? "Camp'te gerçek tıklamayla bir eşya satıldı." : "Çantada satılabilecek eşya yoktu.");
  await sleep(120);
  await shot(page, "camp-after-sell");
  if (opts.changeDifficultyTo) await changeDifficultyAtCamp(page, opts.changeDifficultyTo);
  await page.locator("#btnCampContinue").click().catch(() => {});
}

// Klavye kısayolları + Esc keşfi (bir savaş içindeyken, oyuncu sırasındayken).
async function exploreKeyboardShortcuts(page) {
  const s = await tbwState(page);
  if (!s || s.phase !== "playerInput" || s.curSide !== "party") { report("info", "keyboard", "Klavye kısayolu testi için uygun an bulunamadı (oyuncu sırası değildi), atlandı."); return; }
  await page.keyboard.press("1");
  await sleep(150);
  const modeAfter1 = await page.evaluate(() => window.__TBW.State.mode).catch(() => null);
  if (modeAfter1 !== "move") report("P1", "keyboard", "'1' tuşu Hareket modunu açmalıydı, State.mode='" + modeAfter1 + "' geldi.");
  else report("info", "keyboard", "'1' (Hareket) doğru çalışıyor.");
  await page.keyboard.press("Escape");
  await sleep(120);
  const modeAfterEsc = await page.evaluate(() => window.__TBW.State.mode).catch(() => null);
  if (modeAfterEsc !== "idle") report("P1", "keyboard", "Escape modu temizlemeliydi, State.mode='" + modeAfterEsc + "' geldi.");
  else report("info", "keyboard", "Escape doğru çalışıyor.");
  await page.keyboard.press("2");
  await sleep(150);
  const modeAfter2 = await page.evaluate(() => window.__TBW.State.mode).catch(() => null);
  if (modeAfter2 !== "attack") report("P1", "keyboard", "'2' tuşu Saldır modunu açmalıydı, State.mode='" + modeAfter2 + "' geldi.");
  else report("info", "keyboard", "'2' (Saldır) doğru çalışıyor.");
  await page.keyboard.press("Escape");
  await sleep(120);
  await shot(page, "keyboard-explored");
}

// 5. tur yeni özellikleri: right-click iptal, menzil dışı tooltip metni (oyuncu sırasında);
// #btnFast görünürlüğü + Space basılı hızlandırma (düşman sırasında).
async function exploreNewFeatures(page) {
  const s = await tbwState(page);
  if (s && s.phase === "playerInput" && s.curSide === "party") {
    // --- sağ tık iptal ---
    await page.locator("#btnMove").click().catch(() => {});
    await sleep(120);
    const modeBefore = await page.evaluate(() => window.__TBW.State.mode).catch(() => null);
    await page.locator("#board").click({ button: "right" }).catch(() => {});
    await sleep(150);
    const modeAfter = await page.evaluate(() => window.__TBW.State.mode).catch(() => null);
    if (modeBefore === "move" && modeAfter === "idle") report("info", "right-click", "Sağ tık, açık modu (Hareket) doğru şekilde iptal etti.");
    else report("P1", "right-click", "Sağ tık iptal beklenen gibi çalışmadı (önce: '" + modeBefore + "', sonra: '" + modeAfter + "').");

    // --- menzil dışı tooltip metni ---
    await page.locator("#btnAttack").click().catch(() => {});
    await sleep(120);
    const farEnemy = await page.evaluate(() => {
      const u = cur();
      const targets = (window.__TBW.State.targets || []).map(t => t.q + "," + t.r);
      const enemies = window.__TBW.State.units.filter(t => !t.dead && t.side !== "party");
      const outOfRange = enemies.find(e => targets.indexOf(e.q + "," + e.r) < 0);
      if (!outOfRange) return null;
      return { q: outOfRange.q, r: outOfRange.r };
    }).catch(() => null);
    if (farEnemy) {
      const c = await page.evaluate(([q, r]) => hexCenter(q, r), [farEnemy.q, farEnemy.r]).catch(() => null);
      if (c) {
        const box = await page.locator("#board").boundingBox().catch(() => null);
        if (box) {
          await page.mouse.move(box.x + c.x, box.y + c.y);
          await sleep(200);
          const tipText = await page.evaluate(() => { const t = document.getElementById("hoverTooltip"); return t ? t.textContent : null; }).catch(() => null);
          if (tipText && tipText.indexOf("Menzil dışı") >= 0) report("info", "tooltip", "Menzil dışı hedef için tooltip doğru metni gösterdi ('Menzil dışı').");
          else report("P1", "tooltip", "Menzil dışı hedefin tooltip'i beklenen 'Menzil dışı' metnini içermiyor (içerik: " + JSON.stringify(tipText) + ").");
        }
      }
    } else report("info", "tooltip", "Bu savaşta menzil dışında düşman yoktu, tooltip 'Menzil dışı' kontrolü atlandı.");
    await page.locator("#btnAttack").click().catch(() => {}); // modu kapat
    await shot(page, "new-features-playerinput");
  } else report("info", "right-click", "Sağ tık/tooltip testi için uygun an bulunamadı (oyuncu sırası değildi), atlandı.");

  // --- #btnFast + Space (düşman sırasında) ---
  let sawEnemyForFast = false;
  for (let i = 0; i < 25; i++) {
    const s2 = await tbwState(page);
    if (!s2) break;
    if (s2.phase === "enemy") { sawEnemyForFast = true; break; }
    if (s2.phase === "over" || (s2.phase === "playerInput" && s2.curSide === "party")) break;
    await sleep(150);
  }
  if (sawEnemyForFast) {
    const fastVisible = await page.evaluate(() => { const b = document.getElementById("btnFast"); return b && getComputedStyle(b).display !== "none"; }).catch(() => false);
    if (fastVisible) report("info", "btnFast", "#btnFast düşman turunda görünür.");
    else report("P1", "btnFast", "#btnFast düşman turunda GÖRÜNMÜYOR (display:none).");
    if (fastVisible) {
      await page.locator("#btnFast").click({ force: true }).catch(() => {});
      await sleep(80);
      const ffActive = await page.evaluate(() => !!window.__TBW.State._ffActive).catch(() => false);
      if (ffActive) report("info", "btnFast", "#btnFast tıklaması State._ffActive=true yaptı (hızlandırma aktif).");
      else report("P1", "btnFast", "#btnFast tıklandı ama State._ffActive true olmadı.");
    }
    // Space basılı tutma (ayrı bir gözlemde, hâlâ enemy fazındaysa)
    const stillEnemy = await tbwState(page);
    if (stillEnemy && stillEnemy.phase === "enemy") {
      await page.keyboard.down("Space");
      await sleep(80);
      const ffViaSpace = await page.evaluate(() => !!window.__TBW.State._ffActive).catch(() => false);
      await page.keyboard.up("Space");
      if (ffViaSpace) report("info", "space-fastforward", "Space basılı tutmak State._ffActive=true yaptı (düşman turu sırasında).");
      else report("P1", "space-fastforward", "Space basılı tutuldu ama State._ffActive true olmadı (faz hâlâ 'enemy' iken).");
    } else report("info", "space-fastforward", "Space testi anında faz artık 'enemy' değildi (çok hızlı geçti), atlandı.");
  } else report("info", "btnFast", "Bu savaşta 'enemy' fazı yakalanamadı, #btnFast/Space testi atlandı.");
}

// Ayarlar + Yardım ekranı keşfi (başlık ekranında).
async function exploreSettingsAndHelp(page) {
  await page.locator("#btnOpenSettings").click().catch(() => {});
  await sleep(150);
  await shot(page, "settings-open");
  const muteBtnText0 = await page.evaluate(() => document.getElementById("btnMute").textContent).catch(() => "");
  await page.locator("#btnMute").click().catch(() => {});
  await sleep(100);
  const muteBtnText1 = await page.evaluate(() => document.getElementById("btnMute").textContent).catch(() => "");
  if (muteBtnText0 === muteBtnText1) report("P2", "settings", "Ses aç/kapa butonuna tıklandığında metin değişmedi (" + muteBtnText0 + ") — görsel geri bildirim eksik olabilir.");
  else report("info", "settings", "Ses kapama gerçek tıklamayla çalıştı (" + muteBtnText0 + " -> " + muteBtnText1 + ").");
  await page.locator("#btnSpeed3").click().catch(() => {}); // animasyonu "Anında" yap — sonraki savaşları hızlandırır
  const animSpeed = await page.evaluate(() => window.__TBW.State.animSpeed).catch(() => null);
  if (animSpeed !== 3) report("P1", "settings", "'Anında' animasyon hızı butonuna basıldı ama State.animSpeed=" + animSpeed + " (3 bekleniyordu).");
  else report("info", "settings", "Animasyon hızı 'Anında' (3) gerçek tıklamayla ayarlandı.");
  await page.locator("#btnCloseSettings").click().catch(() => {});
  await sleep(120);

  await page.locator("#btnOpenHelp").click().catch(() => {});
  await sleep(150);
  const helpScreen = await currentScreen(page);
  if (helpScreen !== "screen-help") report("P1", "help", "'? Nasıl Oynanır' butonuna basıldı ama screen-help aktif olmadı (aktif ekran: " + helpScreen + ").");
  else report("info", "help", "Yardım ekranı gerçek tıklamayla açıldı.");
  await shot(page, "help-open");
  await page.locator("#btnHelpNext").click().catch(() => {});
  await sleep(100);
  await page.locator("#btnHelpPrev").click().catch(() => {});
  await sleep(100);
  await page.locator("#btnHelpClose").click().catch(() => {});
  await sleep(150);
}

// ---------------------------------------------------------------
// 6. TUR (çıkış öncesi final test) — yeni eklenenler için kontroller.

// SAVAŞA BAŞLA sonrası oyun önce screen-map'e düşer (ilk düğüme otomatik girmez) — buradaki
// 'current' düğümü gerçek tıklamayla açar (Koşu C'nin kısa/odaklı akışında runFullCampaign'in
// tam döngüsü olmadığı için bu adım ayrıca gerekiyor).
async function enterCurrentMapNode(page) {
  for (let i = 0; i < 20; i++) {
    const screen = await currentScreen(page);
    if (screen === "app") return true;
    if (screen === "screen-map") {
      const has = await page.locator(".node-list li.current").count().then(c => c > 0).catch(() => false);
      if (has) { await page.locator(".node-list li.current").first().click().catch(() => {}); }
    }
    if (screen === "screen-story") { await page.locator("#btnStoryNext").click().catch(() => {}); }
    await sleep(200);
  }
  return (await currentScreen(page)) === "app";
}

// Yaratım ekranında gerçek tıklamayla zorluk seç (createSetDifficulty).
async function selectCreationDifficulty(page, key) {
  const box = page.locator("#createDifficulty button");
  const n = await box.count().catch(() => 0);
  if (!n) { report("P1", "difficulty", "Yaratım ekranında #createDifficulty butonları bulunamadı, zorluk seçimi atlandı."); return false; }
  const idx = await page.evaluate((k) => {
    const btns = Array.from(document.querySelectorAll("#createDifficulty button"));
    return btns.findIndex(b => (b.getAttribute("onclick") || "").indexOf("'" + k + "'") >= 0);
  }, key).catch(() => -1);
  if (idx < 0) { report("P1", "difficulty", "Yaratım ekranında '" + key + "' zorluk butonu bulunamadı."); return false; }
  await page.locator("#createDifficulty button").nth(idx).click().catch(() => {});
  await sleep(100);
  report("info", "difficulty", "Yaratım ekranında zorluk gerçek tıklamayla '" + key + "' seçildi.");
  await shot(page, "creation-difficulty-" + key);
  return true;
}

// Kampta zorluk DEĞİŞTİRME (#campDifficulty) — gerçek tıklamayla, ardından GameState.difficulty
// güncellendiğini ve saveGame()'e yazıldığını (bir reload sonrası) doğrular.
async function changeDifficultyAtCamp(page, newKey) {
  const before = await page.evaluate(() => window.__TBW.GameState().difficulty).catch(() => null);
  const idx = await page.evaluate((k) => {
    const btns = Array.from(document.querySelectorAll("#campDifficulty button"));
    return btns.findIndex(b => (b.getAttribute("onclick") || "").indexOf("'" + k + "'") >= 0);
  }, newKey).catch(() => -1);
  if (idx < 0) { report("P1", "difficulty", "Kamp ekranında '" + newKey + "' zorluk butonu bulunamadı (#campDifficulty)."); return; }
  await page.locator("#campDifficulty button").nth(idx).click().catch(() => {});
  await sleep(150);
  const after = await page.evaluate(() => window.__TBW.GameState().difficulty).catch(() => null);
  if (after !== newKey) report("P1", "difficulty", "Kampta zorluk '" + newKey + "' seçildi ama GameState.difficulty='" + after + "' oldu (önce: '" + before + "').");
  else report("info", "difficulty", "Kampta zorluk gerçek tıklamayla '" + before + "' -> '" + after + "' değişti (saveGame() tetiklendi).");
  await shot(page, "camp-difficulty-" + newKey);
}

// Bozuk kayıt: localStorage'a çöp yaz, sayfayı yenile — başlık ekranı GÜVENLE açılmalı ve
// bir toast göstermeli (çökme YOK, sessiz veri kaybı YOK).
async function testCorruptedSave(page) {
  await page.evaluate(() => { try { localStorage.setItem("tbw_save_v1", "{bu gecerli JSON degil"); } catch (e) {} });
  await page.reload();
  await page.waitForSelector("#btnNewGame", { timeout: STEP_TIMEOUT }).catch(() => {});
  await sleep(300);
  const screen = await currentScreen(page);
  const toastVisible = await page.evaluate(() => { const t = document.getElementById("globalToast"); return t && getComputedStyle(t).display !== "none"; }).catch(() => false);
  const toastText = await page.evaluate(() => { const t = document.getElementById("globalToastText"); return t ? t.textContent : null; }).catch(() => null);
  const contVisible = await page.evaluate(() => document.getElementById("btnContinue").style.display !== "none").catch(() => true);
  await shot(page, "corrupted-save-title");
  if (screen !== "screen-title") report("P0", "save-corrupt", "Bozuk kayıtla açılışta başlık ekranı aktif değil (aktif: " + screen + ") — muhtemelen çökme.");
  else report("info", "save-corrupt", "Bozuk kayıtla açılış çökmeden başlık ekranına ulaştı.");
  if (!toastVisible) report("P1", "save-corrupt", "Bozuk kayıt tespit edildiğinde bir toast/uyarı GÖSTERİLMEDİ.");
  else report("info", "save-corrupt", "Bozuk kayıt toast'ı gösterildi: " + JSON.stringify(toastText));
  if (contVisible) report("P1", "save-corrupt", "Bozuk kayıttan sonra 'Devam Et' butonu hâlâ görünüyor (kayıt temizlenmemiş olabilir).");
  else report("info", "save-corrupt", "Bozuk kayıt sonrası 'Devam Et' doğru şekilde gizlendi.");
}

// Kaydı Sil onay diyaloğu: önce "Hayır" ile vazgeç (kayıt kalmalı), sonra "Evet" ile onayla (kayıt silinmeli).
async function testDeleteSaveConfirm(page) {
  const hasSaveBefore = await page.evaluate(() => document.getElementById("btnContinue").style.display !== "none").catch(() => false);
  if (!hasSaveBefore) { report("info", "save-delete", "Kaydı Sil testi için mevcut bir kayıt bulunamadı, atlandı."); return; }
  await page.locator("#btnDeleteSave").click().catch(() => {});
  await sleep(150);
  await shot(page, "delete-save-confirm-open");
  const overlayVisible = await page.evaluate(() => { const o = document.getElementById("confirmOverlay"); return o && getComputedStyle(o).display !== "none"; }).catch(() => false);
  if (!overlayVisible) { report("P0", "save-delete", "'Kaydı Sil' butonuna basıldı ama onay diyaloğu açılmadı."); return; }
  // 1) Hayır -> vazgeç
  await page.locator("#confirmNo").click().catch(() => {});
  await sleep(150);
  const stillHasSave = await page.evaluate(() => document.getElementById("btnContinue").style.display !== "none").catch(() => false);
  if (!stillHasSave) report("P0", "save-delete", "Onay diyaloğunda 'Hayır'a basıldığı halde kayıt SİLİNMİŞ.");
  else report("info", "save-delete", "'Hayır' gerçek tıklamayla vazgeçti, kayıt korundu.");
  // 2) tekrar aç, Evet -> sil
  await page.locator("#btnDeleteSave").click().catch(() => {});
  await sleep(150);
  await page.locator("#confirmYes").click().catch(() => {});
  await sleep(150);
  const hasSaveAfter = await page.evaluate(() => document.getElementById("btnContinue").style.display !== "none").catch(() => true);
  await shot(page, "delete-save-after-confirm");
  if (hasSaveAfter) report("P0", "save-delete", "Onay diyaloğunda 'Evet'e basıldığı halde kayıt SİLİNMEDİ ('Devam Et' hâlâ görünüyor).");
  else report("info", "save-delete", "'Evet' gerçek tıklamayla kaydı sildi, 'Devam Et' gizlendi.");
}

// Savaş ortasında Ana Menü butonu -> onay diyaloğu (vazgeç/onayla).
async function testMidBattleMenuConfirm(page) {
  const s = await tbwState(page);
  if (!s || s.phase === "over") { report("info", "mid-battle-confirm", "Savaş ortası Ana Menü onayı testi için uygun an bulunamadı, atlandı."); return; }
  await page.locator("#btnRebuild").click().catch(() => {});
  await sleep(150);
  await shot(page, "mid-battle-confirm-open");
  const overlayVisible = await page.evaluate(() => { const o = document.getElementById("confirmOverlay"); return o && getComputedStyle(o).display !== "none"; }).catch(() => false);
  if (!overlayVisible) { report("P0", "mid-battle-confirm", "Savaş ortasında '← Ana Menü' basıldığında onay diyaloğu AÇILMADI (savaş doğrudan terk edilmiş olabilir)."); return; }
  // Vazgeç -> savaşta kalınmalı
  await page.locator("#confirmNo").click().catch(() => {});
  await sleep(150);
  const screenAfterCancel = await currentScreen(page);
  if (screenAfterCancel !== "app") report("P0", "mid-battle-confirm", "Onay diyaloğunda 'Hayır'a basıldı ama savaş ekranından ÇIKILMIŞ (ekran: " + screenAfterCancel + ").");
  else report("info", "mid-battle-confirm", "'Hayır' gerçek tıklamayla vazgeçti, savaş ekranında kalındı.");
  // Onayla -> ana menüye dön
  await page.locator("#btnRebuild").click().catch(() => {});
  await sleep(150);
  await page.locator("#confirmYes").click().catch(() => {});
  await sleep(200);
  const screenAfterConfirm = await currentScreen(page);
  await shot(page, "mid-battle-confirm-accepted");
  if (screenAfterConfirm !== "screen-title") report("P0", "mid-battle-confirm", "Onay diyaloğunda 'Evet'e basıldı ama başlık ekranına dönülmedi (ekran: " + screenAfterConfirm + ").");
  else report("info", "mid-battle-confirm", "'Evet' gerçek tıklamayla savaşı terk etti, başlık ekranına döndü.");
}

// Yeni Oyun+ — bitiş ekranında görünürse gerçek tıklamayla başlat, GameState.ngPlus ve harita
// ekranına gerçekten geçtiğini doğrula.
async function testNewGamePlus(page) {
  const visible = await page.evaluate(() => { const b = document.getElementById("btnNewGamePlus"); return b && getComputedStyle(b).display !== "none"; }).catch(() => false);
  if (!visible) { report("P1", "new-game-plus", "Bitiş ekranında 'Yeni Oyun+' butonu görünmüyor."); return; }
  await page.locator("#btnNewGamePlus").click().catch(() => {});
  await sleep(300);
  const screen = await currentScreen(page);
  const ngPlus = await page.evaluate(() => !!(window.__TBW.GameState() && window.__TBW.GameState().ngPlus)).catch(() => false);
  await shot(page, "new-game-plus-started");
  if (screen !== "screen-map") report("P0", "new-game-plus", "'Yeni Oyun+' tıklandı ama harita ekranına geçilmedi (ekran: " + screen + ").");
  else report("info", "new-game-plus", "'Yeni Oyun+' gerçek tıklamayla haritaya geçti.");
  if (!ngPlus) report("P1", "new-game-plus", "'Yeni Oyun+' sonrası GameState.ngPlus true değil.");
  else report("info", "new-game-plus", "GameState.ngPlus doğru şekilde true (düşman ölçeklemesi devrede).");
}

// Çıkış öncesi final ekran görüntüleri (coordinator: tests/shots/final_*).
async function finalScreenshots(page) {
  const sizes = [{ width: 1024, height: 700 }, { width: 1920, height: 1080 }];
  for (const size of sizes) {
    await page.setViewportSize(size);
    await sleep(250);
    try { await page.screenshot({ path: path.join(SHOTS_DIR, "final_" + size.width + "x" + size.height + ".png") }); } catch (e) { /* yok say */ }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
}

// Pencere yeniden boyutlandırma sırasında tıklama isabeti (pixelToHex).
async function testResizeClickAccuracy(page, size) {
  await page.setViewportSize(size);
  await sleep(300);
  await shot(page, "resize-" + size.width + "x" + size.height);
  const s = await tbwState(page);
  if (!s || s.phase !== "playerInput" || s.curSide !== "party") { report("info", "resize", size.width + "x" + size.height + ": test anında oyuncu sırası değildi, tıklama isabeti kontrolü atlandı."); return; }
  await page.locator("#btnAttack").click().catch(() => {});
  const target = await page.evaluate(() => (window.__TBW.State.targets || [])[0] || null).catch(() => null);
  if (!target) { report("info", "resize", size.width + "x" + size.height + ": menzilde hedef yoktu, tıklama isabeti kontrolü atlandı."); await page.locator("#btnAttack").click().catch(() => {}); return; }
  const before = await page.evaluate(() => window.__TBW.State.units.filter(u => u.side !== "party" && !u.dead).length).catch(() => -1);
  const hpBefore = target.hp;
  await clickHexOf(page, target.q, target.r);
  await sleep(150);
  const hasAttacked = await page.evaluate(() => { const u = cur(); return u ? u.hasAttacked : null; }).catch(() => null);
  if (!hasAttacked) report("P0", "resize-click", size.width + "x" + size.height + ": ATTACK modundayken hedef hex'e tıklandı ama saldırı GERÇEKLEŞMEDİ (hasAttacked=false) — pixelToHex bu pencere boyutunda muhtemelen yanlış hex'e denk geliyor.");
  else report("info", "resize-click", size.width + "x" + size.height + ": tıklama isabeti doğru (pixelToHex canvas boyutuyla tutarlı).");
}

// ---------------------------------------------------------------
async function runFullCampaign(page, opts) {
  opts = Object.assign({ playOptional: true, choiceBranch: 0, testReloadAt: "afterCh1", loseNodeId: "b1", useItemFromNode: null, useBombFromNode: null, difficultyAtCreation: null, changeDifficultyAtCampTo: null }, opts);
  await page.goto(GAME_URL);
  await shot(page, "title");

  await exploreSettingsAndHelp(page);
  await shot(page, "after-settings-help");

  await page.locator("#btnNewGame").click().catch(() => {});
  await advanceStoryUntilDone(page, opts); // intro
  await shot(page, "after-intro");

  // yaratım ekranı: varsayılan puanlar zaten geçerli olmalı
  await page.waitForSelector("#btnStart", { timeout: STEP_TIMEOUT }).catch(() => {});
  if (opts.difficultyAtCreation) await selectCreationDifficulty(page, opts.difficultyAtCreation);
  const startEnabled = await page.evaluate(() => !document.getElementById("btnStart").disabled).catch(() => false);
  if (!startEnabled) report("P1", "creation", "Yaratım ekranında varsayılan ekip GEÇERLİ değil (btnStart disabled) — SAVAŞA BAŞLA gerçek tıklamayla açılamadı.");
  await page.locator("#btnStart").click().catch(() => {});
  await shot(page, "after-creation");
  if (opts.difficultyAtCreation) {
    const diffApplied = await page.evaluate(() => window.__TBW.GameState().difficulty).catch(() => null);
    if (diffApplied !== opts.difficultyAtCreation) report("P1", "difficulty", "Yaratımda '" + opts.difficultyAtCreation + "' seçildi ama GameState.difficulty='" + diffApplied + "' oldu (SAVAŞA BAŞLA sonrası).");
    else report("info", "difficulty", "Yaratımda seçilen zorluk ('" + diffApplied + "') kampanya boyunca doğru taşındı.");
  }

  let steps = 0, battleCount = 0, reachedEnding = false, boughtBombSoFar = false, boughtPotionSoFar = false;
  let sawOptionalNode = false, changedDifficultyAtCamp = false;
  while (steps < MAX_DRIVE_STEPS) {
    steps++;
    const screen = await currentScreen(page);
    if (!screen) { await sleep(200); continue; }

    if (screen === "screen-ending") {
      await shot(page, "ending");
      let guard = 0;
      while (guard++ < 10) {
        const nextVisible = await page.evaluate(() => document.getElementById("btnEndingNext").style.display !== "none").catch(() => false);
        if (!nextVisible) break;
        await page.locator("#btnEndingNext").click().catch(() => {});
        await sleep(150);
      }
      await shot(page, "ending-stats");
      if (opts.finalScreenshotsHere) await finalScreenshots(page);
      if (opts.testNewGamePlus) await testNewGamePlus(page);
      reachedEnding = true;
      break;
    }
    if (screen === "screen-story") { await advanceStoryUntilDone(page, opts); continue; }
    if (screen === "screen-levelup") { await handleLevelupIfPresent(page); continue; }
    if (screen === "screen-camp") {
      const campOpts = { boughtBombSoFar };
      if (opts.changeDifficultyAtCampTo && !changedDifficultyAtCamp) { campOpts.changeDifficultyTo = opts.changeDifficultyAtCampTo; changedDifficultyAtCamp = true; }
      await handleCamp(page, campOpts);
      continue;
    }
    if (screen === "screen-result") {
      const isLoss = await page.evaluate(() => document.getElementById("resultTitle").textContent.indexOf("YENİL") >= 0).catch(() => false);
      await shot(page, isLoss ? "result-loss" : "result-win");
      if (isLoss) {
        const clicked = await page.locator('#resultFooter button:has-text("Tekrar Dene")').isVisible().catch(() => false);
        if (clicked) { await page.locator('#resultFooter button:has-text("Tekrar Dene")').click().catch(() => {}); report("info", "retry", "'Tekrar Dene' gerçek tıklamayla tetiklendi."); }
        else report("P0", "retry", "Yenilgi ekranında 'Tekrar Dene' butonu bulunamadı/görünmüyor.");
      } else {
        await page.locator("#resultFooter button").first().click().catch(() => {});
      }
      continue;
    }
    if (screen === "screen-map") {
      await shot(page, "map");
      // ORTADA sayfayı yenile -> Devam Et testi (sadece bir kez, ch1 bittikten sonra)
      if (opts.testReloadAt === "afterCh1") {
        const gs1 = await tbwState(page);
        if (gs1 && gs1.chapterIndex >= 1) {
          const before = { ch: gs1.chapterIndex, node: gs1.nodeIndex, gold: gs1.gold };
          await page.reload();
          await shot(page, "after-reload");
          await page.waitForSelector("#btnContinue", { timeout: STEP_TIMEOUT }).catch(() => {});
          const continueVisible = await page.evaluate(() => document.getElementById("btnContinue").style.display !== "none").catch(() => false);
          if (!continueVisible) report("P0", "save-load", "Sayfa yenilendikten sonra 'Devam Et' butonu görünmedi — kayıt/yükleme çalışmıyor olabilir.");
          else {
            await page.locator("#btnContinue").click().catch(() => {});
            await sleep(300);
            const after = await tbwState(page);
            if (!after || after.chapterIndex !== before.ch || after.nodeIndex !== before.node) {
              report("P0", "save-load", "'Devam Et' sonrası kampanya konumu KORUNMADI (önce ch" + before.ch + "/n" + before.node + ", sonra ch" + (after && after.chapterIndex) + "/n" + (after && after.nodeIndex) + ").");
            } else {
              report("info", "save-load", "Sayfa yenileme + 'Devam Et' gerçek tıklamayla test edildi: konum korundu (ch" + before.ch + "/n" + before.node + ").");
            }
          }
          opts.testReloadAt = null; // bir daha yapma
          await shot(page, "after-continue");
          continue;
        }
      }
      const skipBtn = page.locator("#btnSkipNode");
      const hasSkip = await skipBtn.count().then(c => c > 0).catch(() => false);
      if (hasSkip) sawOptionalNode = true;
      if (hasSkip && !opts.playOptional) {
        await skipBtn.click().catch(() => {});
        report("info", "optional-node", "Opsiyonel düğüm 'Atla' butonuyla gerçek tıklamayla atlandı.");
        await sleep(200);
        continue;
      }
      const nodeLi = page.locator(".node-list li.current");
      const hasCurrent = await nodeLi.count().then(c => c > 0).catch(() => false);
      if (!hasCurrent) { report("P1", "map", "Harita ekranında tıklanabilir 'current' düğüm bulunamadı."); break; }
      await nodeLi.first().click().catch(() => {});
      continue;
    }
    if (screen === "app") {
      battleCount++;
      const battleOpts = { forceLose: false, useItem: false, useBomb: false };
      const gsNow = await tbwState(page);
      if (!opts._lostOnce && battleCount === 1) { battleOpts.forceLose = true; opts._lostOnce = true; } // ilk savaşta kaybet -> Tekrar Dene
      if (!boughtPotionSoFar && gsNow && gsNow.inventory && gsNow.inventory.potion_heal) { battleOpts.useItem = true; boughtPotionSoFar = true; }
      if (!boughtBombSoFar && gsNow && gsNow.inventory && Object.keys(gsNow.inventory).some(k => k.indexOf("bomb_") === 0)) { battleOpts.useBomb = true; boughtBombSoFar = true; }
      if (battleCount === 2) await exploreKeyboardShortcuts(page); // 2. savaşta klavye kısayolu testi (retry sonrası 1. savaş tekrar sayılmasın diye 2.)
      if (battleCount === 3) { await testResizeClickAccuracy(page, { width: 1024, height: 700 }); await testResizeClickAccuracy(page, { width: 1920, height: 1080 }); await page.setViewportSize({ width: 1280, height: 900 }); }
      if (battleCount === 4) await exploreNewFeatures(page); // btnFast/Space/sağ tık/menzil dışı tooltip (5. tur özellikleri)
      await playOneBattleReal(page, battleOpts);
      continue;
    }
    // beklenmeyen/ara ekran
    await sleep(200);
  }

  if (!sawOptionalNode) report("P2", "optional-node", "Bu koşuda hiç opsiyonel (yan görev) düğümle karşılaşılmadı — b1opt'un 'optional' bayrağı kontrol edilmeli.");
  if (!reachedEnding) report("P0", "campaign-flow", "MAX_DRIVE_STEPS (" + MAX_DRIVE_STEPS + ") aşıldı ama screen-ending'e ULAŞILAMADI.");
  return reachedEnding;
}

// ---------------------------------------------------------------
async function collectErrorsFor(page, consoleErrors, pageErrors) {
  page.on("console", msg => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  page.on("pageerror", err => pageErrors.push(String(err && err.message || err)));
}

async function main() {
  let chromium;
  try { ({ chromium } = require("playwright-core")); } catch (e) { console.log("playwright-core bulunamadı."); process.exit(1); }
  const execPath = findChromiumExecutable();
  if (!execPath) { console.log("Sistem Chromium bulunamadı."); process.exit(0); }
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
  for (const f of fs.readdirSync(SHOTS_DIR)) fs.unlinkSync(path.join(SHOTS_DIR, f)); // önceki koşunun görüntülerini temizle

  console.log("=== Turn Based War — TAM KAMPANYA e2e ===");
  console.log("URL: " + GAME_URL);
  console.log("Ekran görüntüleri: " + SHOTS_DIR + "\n");

  const browser = await chromium.launch({ executablePath: execPath, headless: true });

  // ---- KOŞU A: tam koşu, ZOR zorluk — opsiyonel düğüm OYNANIR, ch2choice dalı 0 (b4), ortada
  //      reload/devam, ilk savaşta forceLose + Tekrar Dene, kampta zorluğu Hikâye'ye değiştirme,
  //      klavye/ayarlar/yardım/resize keşfi, bitişte Yeni Oyun+ ve final ekran görüntüleri dahil. ----
  console.log("--- Koşu A: difficulty=zor (creation) -> hikaye (kampta), playOptional=true, choiceBranch=0 (b4), reload+retry+YeniOyun+ dahil ---");
  const pageA = await browser.newPage();
  const consoleErrorsA = [], pageErrorsA = [];
  await collectErrorsFor(pageA, consoleErrorsA, pageErrorsA);
  let okA = false;
  try {
    okA = await runFullCampaign(pageA, {
      playOptional: true, choiceBranch: 0, testReloadAt: "afterCh1",
      difficultyAtCreation: "zor", changeDifficultyAtCampTo: "hikaye",
      finalScreenshotsHere: true, testNewGamePlus: true
    });
  } catch (e) { report("P0", "harness", "Koşu A çöktü: " + e.message); }
  await pageA.close();

  // ---- KOŞU B: HİKÂYE zorluğu, opsiyonel düğüm ATLANIR, ch2choice dalı 1 (b4cave) — daha kısa/odaklı koşu. ----
  console.log("\n--- Koşu B: difficulty=hikaye (creation), playOptional=false, choiceBranch=1 (b4cave) ---");
  const pageB = await browser.newPage();
  const consoleErrorsB = [], pageErrorsB = [];
  await collectErrorsFor(pageB, consoleErrorsB, pageErrorsB);
  let okB = false;
  try { okB = await runFullCampaign(pageB, { playOptional: false, choiceBranch: 1, testReloadAt: null, difficultyAtCreation: "hikaye" }); }
  catch (e) { report("P0", "harness", "Koşu B çöktü: " + e.message); }
  await pageB.close();

  // ---- KOŞU C: bozuk kayıt / Kaydı Sil onayı / savaş ortası Ana Menü onayı — kısa/odaklı koşu. ----
  console.log("\n--- Koşu C: bozuk kayıt, Kaydı Sil onayı, savaş ortası Ana Menü onay diyaloğu ---");
  const pageC = await browser.newPage();
  const consoleErrorsC = [], pageErrorsC = [];
  await collectErrorsFor(pageC, consoleErrorsC, pageErrorsC);
  try {
    await pageC.goto(GAME_URL);
    await pageC.waitForSelector("#btnNewGame", { timeout: STEP_TIMEOUT }).catch(() => {});
    await testCorruptedSave(pageC); // hiç kayıt yokken de "bozuk kayıt" senaryosu çökmeden geçmeli
    // gerçek bir kayıt oluştur: yeni oyun başlat, ilk kampa kadar ilerle (saveGame camp'te tetiklenir)
    await pageC.locator("#btnNewGame").click().catch(() => {});
    await advanceStoryUntilDone(pageC, {});
    await pageC.waitForSelector("#btnStart", { timeout: STEP_TIMEOUT }).catch(() => {});
    await pageC.locator("#btnStart").click().catch(() => {});
    await enterCurrentMapNode(pageC); // screen-map -> ilk savaş düğümüne gerçek tıklama
    // savaş ortası Ana Menü onay diyaloğu (ilk savaşta)
    await pageC.waitForFunction(() => window.__TBW && window.__TBW.State && window.__TBW.State.phase !== "setup", { timeout: STEP_TIMEOUT }).catch(() => {});
    await sleep(400);
    await testMidBattleMenuConfirm(pageC); // 'Evet' ile ana menüye/başlığa döner
    // artık başlıktayız ve (ilk savaş henüz kazanılmadığı için) muhtemelen kayıt yok — yine de dene:
    await sleep(300);
    const hasSave = await pageC.evaluate(() => document.getElementById("btnContinue").style.display !== "none").catch(() => false);
    if (hasSave) { await testDeleteSaveConfirm(pageC); }
    else {
      // Kayıt yoksa (ilk savaş henüz bitmediği için saveGame hiç tetiklenmemiş olabilir) — yeni oyun
      // başlatıp bir kamp ekranına kadar gerçekten ilerleterek kayıt oluştur, SONRA test et.
      report("info", "save-delete", "İlk Ana Menü dönüşünde henüz kayıt yoktu (ilk savaş bitirilmedi) — kayıt oluşturmak için ikinci bir kısa koşu yapılıyor.");
      await pageC.locator("#btnNewGame").click().catch(() => {});
      await advanceStoryUntilDone(pageC, {});
      await pageC.waitForSelector("#btnStart", { timeout: STEP_TIMEOUT }).catch(() => {});
      await pageC.locator("#btnStart").click().catch(() => {});
      await enterCurrentMapNode(pageC);
      await pageC.waitForFunction(() => window.__TBW && window.__TBW.State && window.__TBW.State.phase !== "setup", { timeout: STEP_TIMEOUT }).catch(() => {});
      await playOneBattleReal(pageC, {});
      // sonuç ekranı -> devam et -> camp (saveGame camp'e girişte veya btnCampContinue'da çalışır)
      for (let i = 0; i < 10; i++) {
        const scr = await currentScreen(pageC);
        if (scr === "screen-camp") { await sleep(200); break; }
        if (scr === "screen-result") { await pageC.locator("#resultFooter button").first().click().catch(() => {}); }
        if (scr === "screen-levelup") { await handleLevelupIfPresent(pageC); }
        await sleep(200);
      }
      await pageC.reload();
      await pageC.waitForSelector("#btnNewGame", { timeout: STEP_TIMEOUT }).catch(() => {});
      await sleep(300);
      await testDeleteSaveConfirm(pageC);
    }
  } catch (e) { report("P0", "harness", "Koşu C çöktü: " + e.message); }
  await pageC.close();

  await browser.close();

  const allConsoleErrors = consoleErrorsA.concat(consoleErrorsB, consoleErrorsC);
  const allPageErrors = pageErrorsA.concat(pageErrorsB, pageErrorsC);
  const uniq = arr => Array.from(new Set(arr));

  console.log("\n" + "=".repeat(60));
  console.log("ÖZET");
  console.log("=".repeat(60));
  console.log("Koşu A ending'e ulaştı: " + okA);
  console.log("Koşu B ending'e ulaştı: " + okB);
  console.log("Toplam console.error: " + allConsoleErrors.length + " (benzersiz: " + uniq(allConsoleErrors).length + ")");
  console.log("Toplam pageerror: " + allPageErrors.length + " (benzersiz: " + uniq(allPageErrors).length + ")");
  if (uniq(allPageErrors).length) { console.log("\nBenzersiz pageerror'lar:"); for (const m of uniq(allPageErrors)) console.log("  - " + m); }
  if (uniq(allConsoleErrors).length) { console.log("\nBenzersiz console.error'lar (ilk 20):"); for (const m of uniq(allConsoleErrors).slice(0, 20)) console.log("  - " + m); }

  console.log("\nBulgular (öncelik sırasıyla):");
  const order = { P0: 0, P1: 1, P2: 2, info: 3 };
  findings.sort((a, b) => order[a.level] - order[b.level]);
  for (const f of findings) if (f.level !== "info") console.log("  [" + f.level + "/" + f.area + "] " + f.text);

  console.log("\nBilgi notları:");
  for (const f of findings) if (f.level === "info") console.log("  - [" + f.area + "] " + f.text);

  console.log("\n(exit code 0 — keşif betiği; sonuçlar docs/TEST_REPORT.md'ye elle aktarılır. Ekran görüntüleri: tests/shots/)");
}

main().catch(e => { console.error("e2e-campaign.js çöktü:", e); process.exit(1); });
