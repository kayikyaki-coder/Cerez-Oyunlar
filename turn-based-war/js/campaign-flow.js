// campaign-flow.js — ekran akışı, kampanya durumu, kamp/mağaza/seviye atlama/son ekranı
// Kural: bu dosya İÇERİK üretmez, sadece CAMPAIGN/ENEMY_DEFS/ITEM_DEFS/ilerleme verisini TÜKETİR.

// Tasarımcı SPELLBOOK_EXT tanımladıysa mevcut SPELLBOOK'a katıl (aynı şema, level:2)
if (typeof SPELLBOOK_EXT !== "undefined") Object.assign(SPELLBOOK, SPELLBOOK_EXT);

// ---------- İÇERİK ERİŞİMCİLERİ (gerçek içerik yoksa dev-fixtures'a düşer) ----------
function getEnemyDefs() { return (typeof ENEMY_DEFS !== "undefined") ? ENEMY_DEFS : DEV_ENEMY_DEFS; }
function getItemDefs() { return (typeof ITEM_DEFS !== "undefined") ? ITEM_DEFS : DEV_ITEM_DEFS; }
function getShopStock() { return (typeof SHOP_STOCK !== "undefined") ? SHOP_STOCK : DEV_SHOP_STOCK; }
function getXpTable() { return (typeof XP_TABLE !== "undefined") ? XP_TABLE : DEV_XP_TABLE; }
function getLevelUps() { return (typeof LEVEL_UPS !== "undefined") ? LEVEL_UPS : DEV_LEVEL_UPS; }
function getMaxLevel() { return (typeof MAX_LEVEL !== "undefined") ? MAX_LEVEL : DEV_MAX_LEVEL; }
function getCampaign() { return (typeof CAMPAIGN !== "undefined") ? CAMPAIGN : DEV_CAMPAIGN; }

// ---------- ZORLUK SEÇENEĞİ (8. tur) ----------
// Tüm düşman ölçekleme burada TANIMLANIR; gerçek uygulaması TEK yerde: engine.js makeEnemyUnit().
// Yeni Oyun+ ile çarpımsal birleşir (bkz. makeEnemyUnit). shortRestMult, applyShortRest()'te kullanılır.
const DIFFICULTY_DEFS = {
  hikaye: { name: "Hikâye", enemyHpMult: 0.8, enemyHitBonus: -1, enemyDmgBonus: 0, shortRestMult: 0.5, fullHealOnRetry: true },
  normal: { name: "Normal", enemyHpMult: 1,   enemyHitBonus: 0,  enemyDmgBonus: 0, shortRestMult: 0.5, fullHealOnRetry: false },
  zor:    { name: "Zor",    enemyHpMult: 1.15, enemyHitBonus: 1, enemyDmgBonus: 1, shortRestMult: 0.25, fullHealOnRetry: false }
};
function getDifficultyDef() {
  const key = (typeof GameState !== "undefined" && GameState && GameState.difficulty) || "normal";
  return DIFFICULTY_DEFS[key] || DIFFICULTY_DEFS.normal;
}
// Kamp ekranından zorluk DEĞİŞTİRME (oyun ortasında): değişiklik saveGame'e yazılır ve
// bir SONRAKİ savaştan itibaren geçerli olur (makeEnemyUnit her savaş kurulumunda okur).
function setDifficulty(key) {
  if (!DIFFICULTY_DEFS[key] || !GameState) return;
  GameState.difficulty = key;
  saveGame();
  renderCampDifficulty();
}
function renderCampDifficulty() {
  const box = document.getElementById("campDifficulty");
  if (!box || !GameState) return;
  const cur = GameState.difficulty || "normal";
  box.innerHTML = Object.keys(DIFFICULTY_DEFS).map(k =>
    '<button class="btn' + (k === cur ? ' btn-primary' : '') + '" onclick="setDifficulty(\'' + k + '\')">' +
    DIFFICULTY_DEFS[k].name + '</button>'
  ).join("");
}

// ---------- OYUN DURUMU (kampanya boyunca kalıcı) ----------
let GameState = null;

function freshGameState() {
  return {
    version: 1,
    party: [], gold: 20, inventory: {},
    chapterIndex: 0, nodeIndex: 0,
    difficulty: "normal",
    settings: { muted: false, animSpeed: 1, tutorialHints: true },
    stats: { startTime: Date.now(), rounds: 0, deaths: 0, battles: 0, goldCollected: 0, heroDamage: {} },
    pendingLevelUps: [],
    currentBattleNode: null,
    _partySnapshot: null
  };
}

// ---------- ÖĞRETİCİ İPUÇLARI (TUTORIAL_HINTS) ----------
function maybeHint(trigger) {
  try {
    if (typeof TUTORIAL_HINTS === "undefined" || !GameState || !GameState.currentBattleNode) return;
    if (GameState.settings && GameState.settings.tutorialHints === false) return;
    if (!State._hintFlags) State._hintFlags = {};
    if (State._hintFlags[trigger]) return;
    const hints = TUTORIAL_HINTS[GameState.currentBattleNode.id];
    if (!hints) return;
    const h = hints.find(x => x.trigger === trigger);
    if (!h) return;
    State._hintFlags[trigger] = true;
    showToast(h.text, 4500);
  } catch (e) { /* öğretici ipucu asla oyunu bozmasın */ }
}
function showToast(text, ms) {
  const t = document.getElementById("tutorialToast");
  if (!t) return;
  const txt = document.getElementById("tutorialToastText");
  if (txt) txt.textContent = text; else t.textContent = text;
  t.classList.remove("hidden");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.classList.add("hidden"); }, ms || 4500);
}
function randomLoadingTip() {
  if (typeof LOADING_TIPS === "undefined" || !LOADING_TIPS.length) return "";
  return LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)];
}

// ---------- NASIL OYNANIR (HELP_PAGES) ----------
let helpPageIdx = 0, helpReturnScreen = "screen-title";
function openHelp(returnScreen) {
  if (typeof HELP_PAGES === "undefined" || !HELP_PAGES.length) return;
  helpReturnScreen = returnScreen || "screen-title";
  helpPageIdx = 0;
  showScreen("screen-help");
  renderHelpPage();
}
function renderHelpPage() {
  const p = HELP_PAGES[helpPageIdx];
  document.getElementById("helpPageTitle").textContent = p.title;
  document.getElementById("helpPageBody").innerHTML = p.body;
  document.getElementById("helpPageIndex").textContent = (helpPageIdx + 1) + " / " + HELP_PAGES.length;
  document.getElementById("btnHelpPrev").disabled = helpPageIdx === 0;
  document.getElementById("btnHelpNext").disabled = helpPageIdx === HELP_PAGES.length - 1;
}
function initHelpFlow() {
  if (typeof HELP_PAGES === "undefined") { document.getElementById("btnOpenHelp").style.display = "none"; return; }
  document.getElementById("btnOpenHelp").addEventListener("click", () => openHelp("screen-title"));
  document.getElementById("btnHelpPrev").addEventListener("click", () => { if (helpPageIdx > 0) { helpPageIdx--; renderHelpPage(); } });
  document.getElementById("btnHelpNext").addEventListener("click", () => { if (helpPageIdx < HELP_PAGES.length - 1) { helpPageIdx++; renderHelpPage(); } });
  document.getElementById("btnHelpClose").addEventListener("click", () => showScreen(helpReturnScreen));
}
// GLOSSARY sözlüğünden bir title tooltip metni üretir (yoksa boş)
function glossaryTip(key) {
  if (typeof GLOSSARY === "undefined" || !GLOSSARY[key]) return "";
  return ' title="' + String(GLOSSARY[key]).replace(/"/g, "&quot;") + '"';
}

// ---------- GENEL TOAST / ONAY DİYALOĞU ----------
function showGlobalToast(text, ms) {
  const el = document.getElementById("globalToast");
  if (!el) return;
  const txt = document.getElementById("globalToastText");
  if (txt) txt.textContent = text; else el.textContent = text;
  el.style.display = "flex";
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.style.display = "none"; }, ms || 5000);
}
function initGlobalToast() {
  const close = document.getElementById("globalToastClose");
  if (close) close.addEventListener("click", () => { document.getElementById("globalToast").style.display = "none"; });
}
// Basit onay diyaloğu — text gösterir, "Evet"e tıklanınca onYes() çağrılır.
function showConfirm(text, onYes) {
  const overlay = document.getElementById("confirmOverlay");
  if (!overlay) { onYes(); return; }
  document.getElementById("confirmText").textContent = text;
  overlay.style.display = "flex";
  const yesBtn = document.getElementById("confirmYes"), noBtn = document.getElementById("confirmNo");
  const close = () => { overlay.style.display = "none"; yesBtn.onclick = null; noBtn.onclick = null; };
  yesBtn.onclick = () => { close(); onYes(); };
  noBtn.onclick = () => { close(); };
}

// ---------- EKRAN GEÇİŞİ ----------
function showScreen(id) {
  const wasBattle = document.getElementById("app") && document.getElementById("app").classList.contains("active");
  document.querySelectorAll(".screen").forEach(el => { el.classList.remove("active"); el.style.display = "none"; });
  const el = document.getElementById(id);
  if (el) { el.classList.add("active"); el.style.display = (id === "app") ? "flex" : ""; }
  // P0-1: savaş ekranından çıkılıyorsa (ana menü/harita/vb.) battleId'yi artır — eski savaşın
  // henüz ateşlenmemiş setTimeout'ları (guardedTimeout) artık sessizce iptal olsun.
  if (wasBattle && id !== "app" && typeof State !== "undefined" && State) State.battleId = (State.battleId || 0) + 1;
  // Tam ekran sahne canvas'ları (başlık/kamp/bitiş/bölüm afişi) az önce görünür olduysa boyutunu al
  if (typeof resizeSceneCanvases === "function") setTimeout(resizeSceneCanvases, 0);
}

// ---------- BAŞLIK EKRANI ----------
function initTitleFlow() {
  GameState = freshGameState();
  showScreen("screen-title");
  refreshTitleSaveUI();
  const sub = document.getElementById("titleSubtitle");
  if (sub) sub.textContent = getCampaign().title || "";

  document.getElementById("btnNewGame").addEventListener("click", startNewGame);
  document.getElementById("btnContinue").addEventListener("click", continueGame);
  const delBtn = document.getElementById("btnDeleteSave");
  if (delBtn) delBtn.addEventListener("click", () => {
    showConfirm("Kayıtlı oyun silinsin mi? Bu geri alınamaz.", () => { clearSaveGame(); refreshTitleSaveUI(); });
  });
  initGlobalToast();
  document.getElementById("btnOpenSettings").addEventListener("click", () => { document.getElementById("settings").style.display = "block"; });
  document.getElementById("btnCloseSettings").addEventListener("click", () => { document.getElementById("settings").style.display = "none"; });
  document.getElementById("btnMute").addEventListener("click", () => {
    try { if (typeof Audio !== "undefined" && Audio && Audio.setMuted) { Audio.setMuted(!Audio.muted); document.getElementById("btnMute").textContent = Audio.muted ? "Kapalı" : "Açık"; } } catch (e) { /* yok say */ }
  });
  document.getElementById("btnSpeed1").addEventListener("click", () => setAnimSpeed(1));
  document.getElementById("btnSpeed2").addEventListener("click", () => setAnimSpeed(2));
  document.getElementById("btnSpeed3").addEventListener("click", () => setAnimSpeed(3));
  document.getElementById("btnTutorialToggle").addEventListener("click", () => {
    GameState.settings.tutorialHints = !GameState.settings.tutorialHints;
    document.getElementById("btnTutorialToggle").textContent = GameState.settings.tutorialHints ? "Açık" : "Kapalı";
  });
  const toastClose = document.getElementById("tutorialToastClose");
  if (toastClose) toastClose.addEventListener("click", () => document.getElementById("tutorialToast").classList.add("hidden"));
  const musicSlider = document.getElementById("sldMusicVol"), sfxSlider = document.getElementById("sldSfxVol");
  if (musicSlider) musicSlider.addEventListener("input", (e) => { try { if (typeof Audio !== "undefined" && Audio && Audio.setMusicVolume) Audio.setMusicVolume(e.target.value / 100); } catch (err) { /* yok say */ } });
  if (sfxSlider) sfxSlider.addEventListener("input", (e) => { try { if (typeof Audio !== "undefined" && Audio && Audio.setSfxVolume) Audio.setSfxVolume(e.target.value / 100); } catch (err) { /* yok say */ } });
  initHelpFlow();
  playMusic("title");
}
function setAnimSpeed(n) { State.animSpeed = n; if (GameState) GameState.settings.animSpeed = n; }

// Başlık ekranındaki "Devam Et" / kayıt özeti / "Kaydı Sil" durumunu günceller.
function refreshTitleSaveUI() {
  const contBtn = document.getElementById("btnContinue");
  const summary = document.getElementById("saveSummary");
  const delBtn = document.getElementById("btnDeleteSave");
  if (hasUnreadableSave()) {
    showGlobalToast("Kayıt okunamadı — bozuk ya da eski sürüm. Yeni oyun başlatabilirsiniz.", 6000);
    clearSaveGame();
  }
  const ok = hasSaveGame();
  if (contBtn) contBtn.style.display = ok ? "" : "none";
  if (delBtn) delBtn.style.display = ok ? "" : "none";
  if (summary) {
    if (ok) {
      const data = loadGame();
      const ch = data && getCampaign().chapters[data.chapterIndex];
      const node = ch && ch.nodes[data.nodeIndex];
      const avgLvl = (data.party && data.party.length) ? Math.round(data.party.reduce((s, h) => s + (h.level || 1), 0) / data.party.length) : 1;
      const mins = (data.stats && data.stats.startTime) ? Math.max(0, Math.round((Date.now() - data.stats.startTime) / 60000)) : 0;
      const diffName = (DIFFICULTY_DEFS[data.difficulty] || DIFFICULTY_DEFS.normal).name;
      summary.textContent = (ch ? ch.title : "?") + (node ? " · " + (node.title || node.type) : "") + " · Lv" + avgLvl + " · ~" + mins + " dk" + " · " + diffName;
      summary.style.display = "block";
    } else {
      summary.style.display = "none";
    }
  }
}

// Not: Audio tanımsız/bozuk kalabilir (bkz. playSfx notu) — try/catch ile koruyoruz.
function playMusic(track) { try { if (typeof Audio !== "undefined" && Audio && Audio.music) Audio.music(track); } catch (e) { /* yok say */ } }

function startNewGame() {
  GameState = freshGameState();
  playDialogue(getCampaign().intro, goToCreation, { skippable: true, scene: "intro" });
}

function continueGame() {
  const data = loadGame();
  if (!data) { showGlobalToast("Kayıt okunamadı — yeni oyun başlatılıyor.", 4500); startNewGame(); return; }
  GameState = Object.assign(freshGameState(), data);
  State.animSpeed = GameState.settings.animSpeed || 1;
  showMapScreen();
}

// ---------- HİKÂYE / DİYALOG OYNATICI ----------
let dialogState = null;
let typewriterTimer = null; // dialogState'ten BAĞIMSIZ tutulur — eski sayfanın zamanlayıcısı yeni
                             // dialogState atanınca "öksüz" kalıp null/başka objeye yazmaya çalışmasın.
function playDialogue(pages, onComplete, opts) {
  opts = opts || {};
  clearTypewriterTimer();
  showScreen("screen-story");
  dialogState = { pages: pages || [], idx: 0, onComplete, scene: opts.scene || "chapter", typing: false, fullText: "" };
  document.getElementById("btnStorySkip").style.display = opts.skippable === false ? "none" : "";
  renderDialoguePage();

  const box = document.getElementById("dialogBox");
  const nextBtn = document.getElementById("btnStoryNext");
  const skipBtn = document.getElementById("btnStorySkip");
  box.onclick = advanceDialogue;
  nextBtn.onclick = (e) => { e.stopPropagation(); advanceDialogue(); };
  skipBtn.onclick = (e) => { e.stopPropagation(); finishDialogue(); };
}
function resolveDialogueText(text) {
  if (!text) return "";
  const map = { "{fighter}": heroNameForClass("Fighter"), "{cleric}": heroNameForClass("Cleric"), "{wizard}": heroNameForClass("Wizard") };
  return text.replace(/\{fighter\}|\{cleric\}|\{wizard\}/g, m => map[m] || m);
}
function heroNameForClass(cls) {
  if (GameState && GameState.party && GameState.party.length) {
    const h = GameState.party.find(p => p.cls === cls);
    if (h) return h.name;
    return GameState.party[0].name;
  }
  return cls;
}
function renderDialoguePage() {
  const p = dialogState.pages[dialogState.idx];
  if (!p) { finishDialogue(); return; }
  document.getElementById("dialogName").textContent = resolveDialogueText(p.speaker || "");
  drawPortraitSafe(document.getElementById("dialogPortrait"), p.portrait);
  startTypewriter(resolveDialogueText(p.text || ""));
}
// Metni daktilo efektiyle yazdırır. Animasyon hızı "anında" (3) ise direkt tam metni gösterir.
// Tıklandığında (skipTypewriter) metin anında tamamlanır; ikinci tıklamada sayfa ilerler.
function startTypewriter(text) {
  clearTypewriterTimer();
  const myState = dialogState; // bu sayfaya özel referans — sonradan dialogState değişse de güvenli
  myState.fullText = text;
  const textEl = document.getElementById("dialogText");
  if (State.animSpeed === 3) { textEl.textContent = text; myState.typing = false; return; }
  textEl.textContent = "";
  myState.typing = true;
  let i = 0;
  const stepMs = State.animSpeed === 2 ? 9 : 18;
  typewriterTimer = setInterval(() => {
    if (dialogState !== myState) { clearInterval(typewriterTimer); typewriterTimer = null; return; } // sayfa/diyalog değişti
    i += 2;
    if (i >= text.length) { textEl.textContent = text; clearTypewriterTimer(); myState.typing = false; return; }
    textEl.textContent = text.slice(0, i);
  }, stepMs);
}
function clearTypewriterTimer() {
  if (typewriterTimer) { clearInterval(typewriterTimer); typewriterTimer = null; }
}
function skipTypewriter() {
  clearTypewriterTimer();
  document.getElementById("dialogText").textContent = dialogState.fullText;
  dialogState.typing = false;
}
function advanceDialogue() {
  if (!dialogState) return;
  if (dialogState.typing) { skipTypewriter(); return; }
  dialogState.idx++;
  if (dialogState.idx >= dialogState.pages.length) { finishDialogue(); return; }
  renderDialoguePage();
}
function finishDialogue() {
  clearTypewriterTimer();
  const cb = dialogState && dialogState.onComplete;
  dialogState = null;
  if (cb) cb();
}
function drawPortraitSafe(canvas, id) {
  const ctx2 = canvas.getContext("2d");
  ctx2.clearRect(0, 0, canvas.width, canvas.height);
  if (typeof drawPortrait === "function") {
    try { drawPortrait(ctx2, id, 0, 0, canvas.width); return; } catch (e) { /* düş */ }
  }
  ctx2.fillStyle = "#2a2f40"; ctx2.fillRect(0, 0, canvas.width, canvas.height);
  ctx2.fillStyle = "#5a6070"; ctx2.font = "12px sans-serif"; ctx2.fillText((id || "?").slice(0, 10), 6, canvas.height / 2);
}

// klavye: Space/Enter ile diyalog ilerlet
document.addEventListener("keydown", (e) => {
  if (document.getElementById("screen-story").classList.contains("active") && (e.code === "Space" || e.code === "Enter")) {
    e.preventDefault(); advanceDialogue();
  }
});

// ---------- EKİBİNİ KUR → KAMPANYA BAŞLANGICI ----------
let creationInitDone = false;
function goToCreation() {
  showScreen("screen-create");
  if (!creationInitDone && typeof createInit === "function") { createInit(); creationInitDone = true; }
  else if (typeof createRender === "function") createRender();
}

// creation.js createStart() bunu çağırır (varsa)
function onCreateComplete(heroes) {
  GameState.party = heroes.map((h, i) => heroToPersistent(h, i));
  GameState.chapterIndex = 0; GameState.nodeIndex = 0;
  saveGame();
  showMapScreen();
}

// Yaratma verisinden kalıcı (kampanya boyunca yaşayan) kahraman nesnesi üretir
function heroToPersistent(h) {
  const tmp = buildParty([h])[0];
  return {
    name: tmp.name, cls: tmp.cls, sprite: tmp.sprite, level: 1, xp: 0,
    stats: tmp.stats, baseStats: Object.assign({}, tmp.stats),
    hpMax: tmp.hpMax, hp: tmp.hpMax, speed: tmp.speed,
    atk: h.atk, armor: h.armor, shield: h.shield,
    weaponItem: null, armorItem: null, trinkets: [],
    spells: tmp.spells ? tmp.spells.slice() : null, slotsMax: tmp.slotsMax || 0, slots: tmp.slotsMax || 0,
    secondWindMax: tmp.secondWindMax || 0, secondWind: tmp.secondWindMax || 0,
    features: [], statPoints: 0
  };
}

// ---------- ENVANTER ----------
function addInventoryItem(id, n) { GameState.inventory[id] = (GameState.inventory[id] || 0) + (n || 1); }
function consumeInventoryItem(id) {
  if (!GameState || !GameState.inventory[id]) return;
  GameState.inventory[id]--; if (GameState.inventory[id] <= 0) delete GameState.inventory[id];
}

// ---------- KAHRAMAN → SAVAŞ BİRİMİ ----------
function heroToBattleUnit(hero, idx) {
  const defs = getItemDefs();
  let attack;
  // P0-4 düzeltmesi: gerçek ITEM_DEFS şeması (items.js) bonus'u .effect ALTINDA değil, doğrudan
  // .weapon (silah eşyaları) / .armor (zırh eşyaları) altında tutuyor; trinket mod'ları da .mods
  // (top-level), .effect.mods değil. .effect yalnızca consumable eşyalarda var.
  const bonusItem = hero.weaponItem ? defs[hero.weaponItem] : null;
  const bonusWeapon = bonusItem ? bonusItem.weapon : null;
  const wbonus = bonusWeapon ? (bonusWeapon.bonus || 0) : 0;
  if (bonusWeapon && bonusWeapon.weaponDef) {
    const wd = bonusWeapon.weaponDef;
    attack = { name: wd.name, dmg: wd.dmg, range: wd.range, ranged: wd.ranged, stat: wd.stat, finesse: !!wd.finesse, isSpell: false, bonus: wbonus };
  } else {
    const weaponId = (bonusWeapon && bonusWeapon.weapon) ? bonusWeapon.weapon : hero.atk;
    attack = makeAttack(hero.cls, weaponId, hero.shield);
    attack.bonus = wbonus;
    attack.name = (wbonus ? ("+" + wbonus + " ") : "") + attack.name;
  }
  const armorDef = ARMORS[hero.armor] || ARMORS.none;
  const armorItem = hero.armorItem ? defs[hero.armorItem] : null;
  const abonus = (armorItem && armorItem.armor) ? (armorItem.armor.bonus || 0) : 0;
  let dodgeBonus = armorDef.dodge + abonus + (hero.shield && canUseShield(hero) ? 2 : 0);
  let dr = armorDef.dr;
  let stats = Object.assign({}, hero.stats);
  let hpMax = hero.hpMax, speed = hero.speed, initiative = 0, slotsMax = hero.slotsMax;
  for (const tid of (hero.trinkets || [])) {
    const it = defs[tid]; if (!it || !it.mods) continue;
    const m = it.mods;
    for (const k in m) {
      if (k === "hpMax") hpMax += m[k];
      else if (k === "speed") speed += m[k];
      else if (k === "dodge") dodgeBonus += m[k];
      else if (k === "slots") slotsMax += m[k];
      else if (k === "initiative") initiative += m[k];
      else if (stats.hasOwnProperty(k)) stats[k] += m[k];
    }
  }
  return {
    id: "hero" + idx, name: hero.name, side: "party", cls: hero.cls, sprite: hero.sprite, level: hero.level,
    q: 0, r: 0, hpMax, hp: Math.min(hero.hp, hpMax), speed,
    stats, attack, dodgeBonus, dr,
    armorName: (armorDef.tier === "none" ? "Zırhsız" : armorDef.name) + (hero.shield && canUseShield(hero) ? " + Kalkan" : ""),
    spells: hero.spells ? hero.spells.slice() : null, slotsMax, slots: Math.min(hero.slots, slotsMax),
    secondWindMax: hero.secondWindMax, secondWind: hero.secondWind,
    features: (hero.features || []).slice(), canHeal: hero.cls === "Cleric", heal: CLASS_DEFS.Cleric.heal,
    _initBonus: initiative
  };
}

function heroesToBattleParty() {
  return GameState.party.map((h, i) => heroToBattleUnit(h, i));
}

// Savaş bitince ekip birimlerinin durumunu kalıcı kahramanlara geri yaz
function syncBattleResultsToParty() {
  State.units.filter(u => u.side === "party").forEach((u, i) => {
    const hero = GameState.party[i];
    if (!hero) return;
    hero.hp = u.dead ? Math.max(1, Math.floor(hero.hpMax * 0.25)) : u.hp;
    hero.slots = u.slots || 0;
    hero.secondWind = u.secondWind || 0;
  });
  GameState.stats.rounds += State.round;
  GameState.stats.deaths += State.deathCount;
  GameState.stats.battles++;
  if (!GameState.stats.heroDamage) GameState.stats.heroDamage = {};
  for (const name in (State.dmgByHero || {})) {
    GameState.stats.heroDamage[name] = (GameState.stats.heroDamage[name] || 0) + State.dmgByHero[name];
  }
}

// ---------- KAMPANYA HARİTASI ----------
function currentChapter() { return getCampaign().chapters[GameState.chapterIndex]; }
function currentNode() { const ch = currentChapter(); return ch ? ch.nodes[GameState.nodeIndex] : null; }

function showMapScreen() {
  saveGame();
  const ch = currentChapter();
  if (!ch) { showEndingScreen(); return; }
  showScreen("screen-map");
  document.getElementById("mapChapterTitle").textContent = ch.title;
  document.getElementById("mapGold").textContent = GameState.gold;
  const bannerTitle = document.getElementById("chapterBannerTitle");
  if (bannerTitle) bannerTitle.textContent = ch.title;
  const note = document.getElementById("chapterBannerNote");
  if (note) {
    if (GameState._justRestedChapter) { note.textContent = "Ekip dinlendi"; note.style.display = "block"; GameState._justRestedChapter = false; }
    else note.style.display = "none";
  }
  renderMapParty();
  renderNodeList(ch);
  playMusic("camp");
}
function renderMapParty() {
  const wrap = document.getElementById("mapParty");
  const xpTable = getXpTable();
  wrap.innerHTML = GameState.party.map(h => {
    const need = xpTable[h.level + 1];
    const cur = xpTable[h.level] || 0;
    const xpPct = need ? Math.round(100 * Math.max(0, h.xp - cur) / Math.max(1, need - cur)) : 100;
    return '<div class="hero-card compact"><canvas class="portrait" width="48" height="48" data-sprite="' + h.sprite + '"></canvas>' +
    '<div class="hero-name">' + h.name + ' <span class="muted">Lv' + h.level + " " + h.cls + '</span></div>' +
    '<div class="hp-bar"><span style="width:' + Math.round(100 * h.hp / h.hpMax) + '%"></span></div>' +
    '<div class="xp-bar"><span style="width:' + xpPct + '%"></span></div></div>';
  }).join("");
  wrap.querySelectorAll("canvas[data-sprite]").forEach(cv => {
    const c2 = cv.getContext("2d"); c2.imageSmoothingEnabled = false;
    const spr = (typeof Sprites !== "undefined" && (Sprites[cv.dataset.sprite] || Sprites.fighter));
    if (spr && typeof drawSpriteGrid === "function") drawSpriteGrid(c2, spr, 24, 26, 2);
  });
}
function renderNodeList(ch) {
  const ol = document.getElementById("nodeList");
  ol.innerHTML = "";
  ch.nodes.forEach((n, i) => {
    const li = document.createElement("li");
    li.className = "node " + (i < GameState.nodeIndex ? "done" : i === GameState.nodeIndex ? "current" : "locked");
    let extra = "";
    if (i === GameState.nodeIndex && n.optional) extra = ' <button class="btn" id="btnSkipNode">Atla (yan görev)</button>';
    li.innerHTML = "<span>" + nodeTypeIcon(n.type) + " " + (n.title || nodeTypeLabel(n.type)) + (n.optional ? " <span class='muted'>(opsiyonel)</span>" : "") + "</span><span class='muted'>" + nodeTypeLabel(n.type) + extra + "</span>";
    if (i === GameState.nodeIndex) li.addEventListener("click", (e) => { if (e.target.id === "btnSkipNode") return; openNode(n); });
    ol.appendChild(li);
  });
  const skipBtn = document.getElementById("btnSkipNode");
  if (skipBtn) skipBtn.addEventListener("click", (e) => { e.stopPropagation(); advanceToNextNode(); });
}
function nodeTypeLabel(t) { return { battle: "Savaş", camp: "Kamp", story: "Hikâye", choice: "Seçim" }[t] || t; }
function nodeTypeIcon(t) { return { battle: "⚔️", camp: "🏕️", story: "📜", choice: "🔀" }[t] || "•"; }

function openNode(node) {
  if (node.type === "battle") startBattleNode(node);
  else if (node.type === "camp") startCampNode(node);
  else if (node.type === "story") startStoryNode(node);
  else if (node.type === "choice") startChoiceNode(node);
}

function advanceToNextNode(explicitId) {
  const ch = currentChapter();
  if (explicitId) {
    const idx = ch.nodes.findIndex(n => n.id === explicitId);
    GameState.nodeIndex = idx >= 0 ? idx : GameState.nodeIndex + 1;
  } else {
    GameState.nodeIndex++;
  }
  let chapterChanged = false;
  if (GameState.nodeIndex >= ch.nodes.length) {
    GameState.chapterIndex++; GameState.nodeIndex = 0; chapterChanged = true;
    if (GameState.chapterIndex >= getCampaign().chapters.length) { showEndingScreen(); return; }
  }
  // BÖLÜM DİNLENMESİ (tasarım kararı, 7. tur): yeni bölüme geçişte kamp gibi tam iyileşme.
  if (chapterChanged) {
    GameState.party.forEach(h => { h.hp = h.hpMax; h.slots = h.slotsMax; h.secondWind = h.secondWindMax; });
    GameState._justRestedChapter = true;
  }
  saveGame();
  showMapScreen();
}

// ---------- STORY NODE ----------
function startStoryNode(node) { playDialogue(node.pages, () => advanceToNextNode(node.next)); }

// ---------- CHOICE NODE ----------
function startChoiceNode(node) {
  clearTypewriterTimer();
  dialogState = null;
  showScreen("screen-story");
  document.getElementById("dialogName").textContent = "";
  document.getElementById("dialogText").textContent = resolveDialogueText(node.text);
  drawPortraitSafe(document.getElementById("dialogPortrait"), "narrator");
  const footer = document.querySelector(".story-footer");
  footer.innerHTML = "";
  const list = document.createElement("div");
  list.className = "choice-list";
  node.options.forEach(opt => {
    const b = document.createElement("button");
    b.className = "btn btn-primary";
    b.textContent = opt.label;
    b.onclick = () => {
      if (opt.effect && opt.effect.gold) { GameState.gold += opt.effect.gold; GameState.stats.goldCollected = (GameState.stats.goldCollected || 0) + opt.effect.gold; }
      restoreStoryFooter();
      advanceToNextNode(opt.goto);
    };
    list.appendChild(b);
  });
  footer.appendChild(list);
  document.getElementById("dialogBox").onclick = null;
}
function restoreStoryFooter() {
  const footer = document.querySelector(".story-footer");
  footer.innerHTML = '<button id="btnStorySkip" class="btn muted">Atla ⏭</button><button id="btnStoryNext" class="btn btn-primary">İlerle ▸</button>';
}

// ---------- BATTLE NODE ----------
function startBattleNode(node) {
  GameState.currentBattleNode = node;
  GameState._partySnapshot = JSON.parse(JSON.stringify(GameState.party));
  if (node.intro && node.intro.length) playDialogue(node.intro, () => launchBattle(node));
  else launchBattle(node);
}
function launchBattle(node) {
  const partyUnits = heroesToBattleParty();
  setupBattle({ map: node.map, enemies: node.enemies, objective: node.objective, reinforcements: node.reinforcements, biome: node.biome, party: partyUnits, title: node.title });
  document.getElementById("battleTitle").textContent = "— " + (node.title || "Savaş");
  showScreen("app");
  if (typeof layoutBoard === "function") layoutBoard();
  initCanvas();
  bindGameEvents();
  refresh();
  playMusic(node.objective && node.objective.type === "boss" ? "boss" : "battle");
  maybeHint("battleStart");
}

// main.js'in refresh() döngüsünden çağrılır (State.phase === "over" olunca bir kez)
function onBattlePhaseOver() {
  const node = GameState.currentBattleNode;
  if (!node) return; // kenar durum: kampanya akışı dışında (headless/test) tetiklenmiş olabilir
  const win = State.winner === "party";
  if (win) {
    syncBattleResultsToParty();
    lastShortRestHeal = applyShortRest();
    const defs = getEnemyDefs();
    const xp = State.units.filter(u => u.side !== "party").reduce((s, u) => s + (defs[u.defId] ? defs[u.defId].xp : (u.xp || 0)), 0);
    applyRewards(node, xp);
  }
  showResultScreen(win, node, win ? lastXpAwarded : 0);
}
let lastXpAwarded = 0;
let lastShortRestHeal = 0;

// KISA MOLA (tasarım kararı, 7. tur): her zaferden sonra ekip yarı yarıya toparlanır ve 1 büyü
// slotu geri kazanır — savaşlar arası kamp olmayan uzun zincirlerin (ör. b9→b10) birikerek
// oynanamaz hale gelmesini önler. "Tekrar Dene" savaş başı snapshot'ından devam ettiği için
// (bkz. showResultScreen'deki retry) bu iyileşmeden ETKİLENMEZ.
function applyShortRest() {
  let totalHealed = 0;
  const pct = getDifficultyDef().shortRestMult;
  GameState.party.forEach(h => {
    const before = h.hp;
    h.hp = Math.min(h.hpMax, h.hp + Math.ceil((h.hpMax - h.hp) * pct));
    totalHealed += (h.hp - before);
    h.slots = Math.min(h.slotsMax || 0, (h.slots || 0) + 1);
  });
  return totalHealed;
}
function applyRewards(node, xp) {
  if (!node) return;
  lastXpAwarded = xp;
  const rw = node.rewards || {};
  if (rw.gold) { GameState.gold += rw.gold; GameState.stats.goldCollected = (GameState.stats.goldCollected || 0) + rw.gold; }
  (rw.items || []).forEach(id => addInventoryItem(id, 1));
  awardXpToParty(xp);
}
function awardXpToParty(xp) {
  const table = getXpTable();
  const maxLvl = getMaxLevel();
  GameState.pendingLevelUps = [];
  GameState.party.forEach(h => {
    h.xp = (h.xp || 0) + xp;
    while (h.level < maxLvl && h.xp >= (table[h.level + 1] != null ? table[h.level + 1] : Infinity)) {
      levelUpHero(h);
    }
  });
}
// SPELL_POOL girdisi ya "id" (string) ya {id, minLevel} olabilir; minLevel yoksa her zaman uygun.
// Bilinmeyen VE minLevel<=level olan id'lerin düz listesini döner.
function poolIdsForLevel(list, level, known) {
  if (!list) return [];
  return list
    .map(entry => (typeof entry === "string" ? { id: entry, minLevel: 1 } : entry))
    .filter(e => (e.minLevel || 1) <= level && known.indexOf(e.id) < 0)
    .map(e => e.id);
}
function levelUpHero(h) {
  h.level++;
  const lu = getLevelUps()[h.cls];
  if (!lu) return;
  const hpGain = Math.floor(lu.hpDie / 2) + 1 + Math.max(0, h.stats.might || 0);
  h.hpMax += hpGain; h.hp += hpGain;
  const step = lu.perLevel && lu.perLevel[h.level];
  // spells alanı KESİNLEŞEN (uygulanmış) büyüleri tutar; spellChoice ise oyuncunun henüz seçmediği,
  // seviye atlama ekranında checkbox listesiyle seçeceği havuzu tutar (learnSpells varsa).
  const change = { hero: h, level: h.level, hpGain, features: [], statPoints: 0, slots: 0, spells: [], spellChoice: null };
  if (step) {
    if (step.slots) { h.slotsMax += step.slots; h.slots += step.slots; change.slots = step.slots; }
    if (step.statPoints) { h.statPoints += step.statPoints; change.statPoints = step.statPoints; }
    if (step.features) { h.features.push(...step.features); change.features = step.features; }
    if (step.learnSpells && h.spells) {
      // SPELL_POOL (progression.js) tanımlıysa oradan — {id,minLevel} girdileri filtrelenir —
      // yoksa eski SPELL_OPTIONS'a (minLevel'sız) düşülür.
      const known = h.spells;
      const pool = (typeof SPELL_POOL !== "undefined" && SPELL_POOL[h.cls]) ? SPELL_POOL[h.cls] : SPELL_OPTIONS[h.cls];
      if (pool) {
        const cantripPool = poolIdsForLevel(pool.cantrips, h.level, known);
        const leveledPool = poolIdsForLevel(pool.leveled, h.level, known);
        const cantripMax = Math.min(step.learnSpells.cantrips || 0, cantripPool.length);
        const leveledMax = Math.min(step.learnSpells.leveled || 0, leveledPool.length);
        if (cantripMax > 0 || leveledMax > 0) {
          change.spellChoice = { cantripPool, cantripMax, cantripPicked: [], leveledPool, leveledMax, leveledPicked: [] };
        }
      }
    }
  }
  GameState.pendingLevelUps.push(change);
}
// Seviye atlama ekranında oyuncunun seçtiği büyüleri kahramana kalıcı olarak öğretir.
function applyPendingSpellChoices() {
  GameState.pendingLevelUps.forEach(c => {
    if (!c.spellChoice) return;
    const picked = c.spellChoice.cantripPicked.concat(c.spellChoice.leveledPicked);
    picked.forEach(id => { if (c.hero.spells.indexOf(id) < 0) c.hero.spells.push(id); });
    c.spells = picked;
  });
}

// ---------- SONUÇ EKRANI ----------
function showResultScreen(win, node, xp) {
  showScreen("screen-result");
  document.getElementById("resultTitle").textContent = win ? "ZAFER!" : "YENİLGİ";
  document.getElementById("resultTitle").className = win ? "" : "muted";
  const rw = (node && node.rewards) || {};
  const defs = getItemDefs();
  const table = getXpTable();
  const leveledNames = (GameState.pendingLevelUps || []).map(c => c.hero.name);
  let body = "";
  if (win) {
    if (leveledNames.length) playSfx("levelup");
    // ---- kahraman kartları: portre + XP barı (dolma animasyonu) + seviye rozeti ----
    body += '<div class="result-heroes">' + GameState.party.map(h => {
      const needXp = table[h.level + 1], curXp = table[h.level] || 0;
      const xpPct = needXp ? Math.round(100 * Math.max(0, h.xp - curXp) / Math.max(1, needXp - curXp)) : 100;
      const leveled = leveledNames.indexOf(h.name) >= 0;
      return '<div class="hero-card compact">' +
        '<canvas class="portrait" width="48" height="48" data-sprite="' + h.sprite + '"></canvas>' +
        '<div class="hero-name">' + h.name + (leveled ? ' <span class="badge-lvl">Seviye atladı!</span>' : '') + ' <span class="muted">Lv' + h.level + '</span></div>' +
        '<div class="xp-bar"><span class="xp-anim" data-pct="' + xpPct + '" style="width:0%"></span></div>' +
        '</div>';
    }).join("") + '</div>';
    body += "<p>+" + xp + " XP paylaşıldı.</p>";
    // ---- ganimet listesi ----
    if (rw.gold || (rw.items && rw.items.length) || lastShortRestHeal > 0) {
      body += '<ul class="loot-list">';
      if (rw.gold) body += '<li><span class="gold">' + rw.gold + '</span> altın</li>';
      (rw.items || []).forEach(id => { const it = defs[id]; body += '<li>' + (it ? it.name : id) + (it ? ' <span class="item-type">' + itemTypeLabel(it) + '</span>' : '') + '</li>'; });
      if (lastShortRestHeal > 0) body += '<li class="muted">Kısa mola: ekip toparlandı (+' + lastShortRestHeal + ' HP)</li>';
      body += '</ul>';
    }
    // ---- savaş istatistiği ----
    body += '<div class="battle-stats"><span>Round: <b>' + State.round + '</b></span>' +
      '<span>Verilen hasar: <b>' + Math.round(State.dmgDealt) + '</b></span>' +
      '<span>Alınan hasar: <b>' + Math.round(State.dmgTaken) + '</b></span>' +
      '<span>Kritik: <b>' + State.critCount + '</b></span></div>';
  } else {
    body += "<p>Ekip yenildi. Tekrar dene ya da ana menüye dön.</p>";
    body += '<div class="battle-stats"><span>Round: <b>' + State.round + '</b></span>' +
      '<span>Verilen hasar: <b>' + Math.round(State.dmgDealt) + '</b></span>' +
      '<span>Alınan hasar: <b>' + Math.round(State.dmgTaken) + '</b></span></div>';
  }
  const tip = randomLoadingTip();
  if (tip) body += "<p class='muted'>💡 " + tip + "</p>";
  document.getElementById("resultBody").innerHTML = body;
  // portreler + XP barı dolma animasyonu (CSS transition varsa onu tetikler; yoksa direkt dolar)
  const resBody = document.getElementById("resultBody");
  resBody.querySelectorAll("canvas[data-sprite]").forEach(cv => {
    const c2 = cv.getContext("2d"); c2.imageSmoothingEnabled = false;
    const spr = (typeof Sprites !== "undefined" && (Sprites[cv.dataset.sprite] || Sprites.fighter));
    if (spr && typeof drawSpriteGrid === "function") drawSpriteGrid(c2, spr, 24, 26, 3);
  });
  requestAnimationFrame(() => requestAnimationFrame(() => {
    resBody.querySelectorAll(".xp-anim").forEach(el => { el.style.width = el.dataset.pct + "%"; });
  }));
  const footer = document.getElementById("resultFooter");
  footer.innerHTML = "";
  if (win) {
    const b = document.createElement("button");
    b.className = "btn btn-primary";
    b.textContent = "Devam Et ▸";
    b.onclick = () => afterResultContinue(node);
    footer.appendChild(b);
  } else {
    const retry = document.createElement("button");
    retry.className = "btn btn-primary";
    retry.textContent = "Tekrar Dene";
    retry.onclick = () => {
      GameState.party = JSON.parse(JSON.stringify(GameState._partySnapshot));
      // Hikâye modu: "Tekrar Dene" ekibi tam can/slot ile başlatır (daha affedici mod).
      if (getDifficultyDef().fullHealOnRetry) {
        GameState.party.forEach(h => { h.hp = h.hpMax; h.slots = h.slotsMax || 0; h.secondWind = 0; });
      }
      launchBattle(node);
    };
    const menu = document.createElement("button");
    menu.className = "btn";
    menu.textContent = "Ana Menüye Dön";
    menu.onclick = () => { saveGame(); showScreen("screen-title"); document.getElementById("btnContinue").style.display = hasSaveGame() ? "" : "none"; playMusic("title"); };
    footer.appendChild(retry); footer.appendChild(menu);
  }
}
function afterResultContinue(node) {
  if (GameState.pendingLevelUps && GameState.pendingLevelUps.length) { showLevelupScreen(node); return; }
  proceedAfterBattle(node);
}
function proceedAfterBattle(node) {
  if (node.outro && node.outro.length) playDialogue(node.outro, () => advanceToNextNode(node.next));
  else advanceToNextNode(node.next);
}

// ---------- SEVİYE ATLAMA EKRANI ----------
function showLevelupScreen(node) {
  showScreen("screen-levelup");
  playMusic("none");
  renderLevelupList();
  document.getElementById("btnLevelupContinue").onclick = () => {
    applyPendingSpellChoices();
    GameState.pendingLevelUps.forEach(c => { c.hero.statPoints = Math.max(0, c.hero.statPoints); });
    GameState.pendingLevelUps = [];
    proceedAfterBattle(node);
  };
}
function renderLevelupList() {
  const wrap = document.getElementById("levelupList");
  wrap.className = "levelup-grid";
  wrap.innerHTML = GameState.pendingLevelUps.map((c, ci) => {
    const featTxt = (typeof CLASS_FEATURE_TEXT !== "undefined") ? CLASS_FEATURE_TEXT : null;
    const featureLabel = (id) => featTxt && featTxt[id] ? featTxt[id].name : id;
    const featureDesc = (id) => featTxt && featTxt[id] ? featTxt[id].desc : "";
    let html = '<div class="card levelup-card">' +
      '<div class="unit-head"><canvas class="portrait" width="48" height="48" data-sprite="' + c.hero.sprite + '"></canvas>' +
      '<div class="unit-info"><b>' + c.hero.name + '</b> — Seviye ' + c.level + '<br>' +
      '<span class="muted">+' + c.hpGain + ' HP' + (c.slots ? " · +" + c.slots + " büyü slotu" : "") +
      (c.features.length ? " · " + c.features.map(featureLabel).join(", ") : "") + '</span></div></div>';
    if (c.features.length) {
      html += '<div class="muted sc-desc">' + c.features.map(id => featureDesc(id)).join(" ") + "</div>";
    }
    if (c.spellChoice) {
      const sc = c.spellChoice;
      if (sc.cantripMax > 0) {
        html += '<div class="muted">Yeni cantrip seç (' + sc.cantripPicked.length + '/' + sc.cantripMax + '):</div><div class="spell-choice-grid">' +
          sc.cantripPool.map(id => spellCheckbox(ci, "cantrip", id)).join("") + '</div>';
      }
      if (sc.leveledMax > 0) {
        html += '<div class="muted">Yeni seviyeli büyü seç (' + sc.leveledPicked.length + '/' + sc.leveledMax + '):</div><div class="spell-choice-grid">' +
          sc.leveledPool.map(id => spellCheckbox(ci, "leveled", id)).join("") + '</div>';
      }
    }
    if (c.statPoints > 0) {
      html += '<div class="stat-alloc" data-ci="' + ci + '">';
      STAT_KEYS.forEach(k => {
        html += '<div class="stat-row"><span>' + STAT_LABEL[k] + '</span>' +
          '<button onclick="allocStat(' + ci + ',\'' + k + '\',-1)">−</button>' +
          '<span id="lu-' + ci + "-" + k + '">' + c.hero.stats[k] + '</span>' +
          '<button onclick="allocStat(' + ci + ',\'' + k + '\',1)">+</button></div>';
      });
      html += '<div class="muted">Kalan puan: <span id="lu-rem-' + ci + '">' + c.statPoints + '</span></div></div>';
    }
    html += "</div>";
    return html;
  }).join("");
  wrap.querySelectorAll("canvas[data-sprite]").forEach(cv => {
    const c2 = cv.getContext("2d"); c2.imageSmoothingEnabled = false;
    const spr = (typeof Sprites !== "undefined" && (Sprites[cv.dataset.sprite] || Sprites.fighter));
    if (spr && typeof drawSpriteGrid === "function") drawSpriteGrid(c2, spr, 24, 26, 3);
  });
}
// Büyünün kısa açıklaması: GLOSSARY'de adı varsa onu kullanır, yoksa resolve/element'ten üretir.
function spellShortDesc(sp) {
  if (typeof GLOSSARY !== "undefined" && GLOSSARY[sp.name]) return GLOSSARY[sp.name];
  if (sp.resolve === "heal") return "Müttefiği iyileştirir.";
  if (sp.resolve === "buff") return (typeof statusDesc === "function") ? statusDesc(sp.status) : "Olumlu etki verir.";
  if (sp.resolve === "debuff") return "Hedefe olumsuz etki verir (kurtarma zarı ile)" + (sp.saveStat ? " · " + sp.saveStat : "") + ".";
  if (sp.resolve === "save") return (sp.dmg ? sp.dmg + " " + (sp.element || "") + " hasar" : "Etki") + " (kurtarma: " + (sp.saveStat || "?") + (sp.half ? ", başarılıysa yarı" : "") + ")" + (sp.area ? " · alan" : "") + ".";
  if (sp.resolve === "attack") return (sp.dmg || "") + " " + (sp.element || "") + " hasar (isabet zarı).";
  if (sp.resolve === "auto") return (sp.missiles ? sp.missiles.n + "d" + sp.missiles.die : "") + " hasar (otomatik isabet).";
  return "";
}
function spellMetaLine(sp) {
  const parts = [];
  if (sp.dmg) parts.push(sp.dmg + (sp.element ? " " + sp.element : ""));
  else if (sp.missiles) parts.push(sp.missiles.n + "d" + sp.missiles.die);
  parts.push(sp.ap + " AP");
  parts.push((sp.range > 1 ? sp.range + " hex" : "bitişik"));
  parts.push(sp.level >= 1 ? "Seviye " + sp.level : "Cantrip");
  return parts.join(" · ");
}
function spellCheckbox(ci, group, id) {
  const sp = SPELLBOOK[id];
  if (!sp) return "";
  const c = GameState.pendingLevelUps[ci];
  const sc = c && c.spellChoice;
  const pickedArr = sc ? (group === "cantrip" ? sc.cantripPicked : sc.leveledPicked) : [];
  const maxN = sc ? (group === "cantrip" ? sc.cantripMax : sc.leveledMax) : 0;
  const selected = pickedArr.indexOf(id) >= 0;
  const limitReached = !selected && pickedArr.length >= maxN;
  const elId = "sp-" + ci + "-" + group + "-" + id;
  return '<label class="spell-choice' + (selected ? " selected" : "") + (limitReached ? " disabled" : "") + '" for="' + elId + '">' +
    '<input type="checkbox" id="' + elId + '" hidden' + (selected ? " checked" : "") + (limitReached ? " disabled" : "") +
    ' onchange="toggleSpellPick(' + ci + ',\'' + group + '\',\'' + id + '\',this.checked)">' +
    '<span class="sc-name">' + sp.name + '</span>' +
    '<span class="sc-meta">' + spellMetaLine(sp) + '</span>' +
    '<span class="sc-desc">' + spellShortDesc(sp) + '</span></label>';
}
function toggleSpellPick(ci, group, id, checked) {
  const c = GameState.pendingLevelUps[ci];
  if (!c || !c.spellChoice) return;
  const sc = c.spellChoice;
  const pickedKey = group === "cantrip" ? "cantripPicked" : "leveledPicked";
  const maxKey = group === "cantrip" ? "cantripMax" : "leveledMax";
  const picked = sc[pickedKey];
  if (checked) {
    if (picked.length >= sc[maxKey]) { renderLevelupList(); return; } // limit dolu, checkbox geri alınır
    if (picked.indexOf(id) < 0) picked.push(id);
  } else {
    const i = picked.indexOf(id); if (i >= 0) picked.splice(i, 1);
  }
  renderLevelupList();
}
function allocStat(ci, k, delta) {
  const c = GameState.pendingLevelUps[ci];
  if (!c) return;
  if (delta > 0) { if (c.statPoints <= 0 || c.hero.stats[k] >= 5) return; c.hero.stats[k]++; c.statPoints--; }
  else { if (c.hero.stats[k] <= (c.hero.baseStats ? c.hero.baseStats[k] : 0)) return; c.hero.stats[k]--; c.statPoints++; }
  document.getElementById("lu-" + ci + "-" + k).textContent = c.hero.stats[k];
  document.getElementById("lu-rem-" + ci).textContent = c.statPoints;
}

// ---------- KAMP EKRANI ----------
function startCampNode(node) {
  // tam iyileşme + slot/yetenek yenileme
  GameState.party.forEach(h => { h.hp = h.hpMax; h.slots = h.slotsMax; h.secondWind = h.secondWindMax; });
  showScreen("screen-camp");
  document.getElementById("campTitle").textContent = node.title || "Kamp";
  const tip = randomLoadingTip();
  document.getElementById("campText").textContent = (node.text || "") + (tip ? "  💡 " + tip : "");
  renderCampHeroes();
  initShopSession(node.shop);
  renderShop();
  renderInventory();
  document.getElementById("campGold").textContent = GameState.gold;
  document.getElementById("btnCampContinue").onclick = () => advanceToNextNode(node.next);
  renderCampDifficulty();
  playMusic("camp");
  saveGame();
}
// Kamp ekranındaki "efektif" saldırı/kaçınma özeti — heroToBattleUnit ile AYNI yardımcıdan
// beslenir (P0-4 düzeltmesiyle tutarlı tek kaynak; iki ayrı hesaplama yazıp tekrar şema hatasına düşmeyelim).
function campEffectiveStatsLine(hero, idx) {
  try {
    const u = heroToBattleUnit(hero, idx);
    const dmgTxt = u.attack.name + " (" + u.attack.dmg + (u.attack.bonus ? " +" + u.attack.bonus : "") + ")";
    const drTxt = u.dr ? " · hasar -%" + Math.round(u.dr * 100) : "";
    return '<div class="stat-row"><span>Etkin Saldırı</span><b>' + dmgTxt + '</b></div>' +
      '<div class="stat-row"><span>Etkin Kaçınma</span><b>' + (u.dodgeBonus >= 0 ? "+" : "") + u.dodgeBonus + drTxt + '</b></div>';
  } catch (e) { return ""; }
}
function renderCampHeroes() {
  const wrap = document.getElementById("campHeroes");
  const defs = getItemDefs();
  wrap.innerHTML = GameState.party.map((h, i) => {
    const atkOpts = (ATTACK_OPTIONS[h.cls] || []).map(id => '<option value="' + id + '"' + (h.atk === id ? " selected" : "") + ">" + WEAPONS[id].name + "</option>").join("");
    const armOpts = (ARMOR_OPTIONS[h.cls] || []).map(id => '<option value="' + id + '"' + (h.armor === id ? " selected" : "") + ">" + ARMORS[id].name + "</option>").join("");
    const invWeapons = Object.keys(GameState.inventory).filter(id => defs[id] && defs[id].type === "weapon");
    const invArmors = Object.keys(GameState.inventory).filter(id => defs[id] && defs[id].type === "armor");
    const invTrinkets = Object.keys(GameState.inventory).filter(id => defs[id] && defs[id].type === "trinket");
    const table = getXpTable();
    const needXp = table[h.level + 1], curXp = table[h.level] || 0;
    const xpPct = needXp ? Math.round(100 * Math.max(0, h.xp - curXp) / Math.max(1, needXp - curXp)) : 100;
    return '<div class="hero-card">' +
      '<div class="unit-head"><canvas class="portrait" width="48" height="48" data-sprite="' + h.sprite + '"></canvas>' +
      '<div class="unit-info"><b>' + h.name + '</b> <span class="muted">Lv' + h.level + " " + h.cls + '</span></div></div>' +
      '<div class="hp-bar"><span style="width:' + Math.round(100 * h.hp / h.hpMax) + '%"></span></div>' +
      '<div class="stat-row"><span>HP</span><b>' + h.hp + "/" + h.hpMax + '</b></div>' +
      '<div class="xp-bar"><span style="width:' + xpPct + '%"></span></div>' +
      '<div class="stat-row"><span>XP</span><b>' + h.xp + (needXp ? " / " + needXp : "") + '</b></div>' +
      campEffectiveStatsLine(h, i) +
      '<div class="gear-row"><span class="glabel">Silah</span><select onchange="campSetAtk(' + i + ',this.value)">' + atkOpts + '</select></div>' +
      (armOpts ? '<div class="gear-row"><span class="glabel">Zırh</span><select onchange="campSetArmor(' + i + ',this.value)">' + armOpts + '</select></div>' : "") +
      '<div class="gear-row"><span class="glabel">Büyülü Silah</span><select onchange="campSetWeaponItem(' + i + ',this.value)">' +
        '<option value="">(yok)</option>' + invWeapons.map(id => '<option value="' + id + '"' + (h.weaponItem === id ? " selected" : "") + ">" + defs[id].name + "</option>").join("") + '</select></div>' +
      '<div class="gear-row"><span class="glabel">Büyülü Zırh</span><select onchange="campSetArmorItem(' + i + ',this.value)">' +
        '<option value="">(yok)</option>' + invArmors.map(id => '<option value="' + id + '"' + (h.armorItem === id ? " selected" : "") + ">" + defs[id].name + "</option>").join("") + '</select></div>' +
      '<div class="gear-row"><span class="glabel">Tılsım 1</span><select onchange="campSetTrinket(' + i + ',0,this.value)">' +
        '<option value="">(yok)</option>' + invTrinkets.map(id => '<option value="' + id + '"' + (h.trinkets[0] === id ? " selected" : "") + ">" + defs[id].name + "</option>").join("") + '</select></div>' +
      '<div class="gear-row"><span class="glabel">Tılsım 2</span><select onchange="campSetTrinket(' + i + ',1,this.value)">' +
        '<option value="">(yok)</option>' + invTrinkets.map(id => '<option value="' + id + '"' + (h.trinkets[1] === id ? " selected" : "") + ">" + defs[id].name + "</option>").join("") + '</select></div>' +
      "</div>";
  }).join("");
  wrap.querySelectorAll("canvas[data-sprite]").forEach(cv => {
    const c2 = cv.getContext("2d"); c2.imageSmoothingEnabled = false;
    const spr = (typeof Sprites !== "undefined" && (Sprites[cv.dataset.sprite] || Sprites.fighter));
    if (spr && typeof drawSpriteGrid === "function") drawSpriteGrid(c2, spr, 24, 26, 3);
  });
}
function campSetAtk(i, v) { GameState.party[i].atk = v; if (!canUseShield(GameState.party[i])) GameState.party[i].shield = false; }
function campSetArmor(i, v) { GameState.party[i].armor = v; }
function campSetWeaponItem(i, v) { GameState.party[i].weaponItem = v || null; }
function campSetArmorItem(i, v) { GameState.party[i].armorItem = v || null; }
function campSetTrinket(i, slot, v) { GameState.party[i].trinkets[slot] = v || null; GameState.party[i].trinkets = GameState.party[i].trinkets.filter(x => x); if (v) { /* zaten atandı */ } renderCampHeroes(); }

// Eşya tipi etiketi (İksir/Silah/Zırh/Tılsım/Bomba) — consumable damage'lı olanlar "Bomba" sayılır.
function itemTypeLabel(it) {
  if (it.type === "consumable") return (it.effect && it.effect.damage) ? "Bomba" : "İksir";
  if (it.type === "weapon") return "Silah";
  if (it.type === "armor") return "Zırh";
  if (it.type === "trinket") return "Tılsım";
  return it.type || "";
}
// Bonus/etki özeti (ör. "+1 isabet/hasar · 1d8", "2d4+2 iyileştirme")
function itemStatsLine(it) {
  // P0-4 ile aynı şema düzeltmesi: consumable -> .effect, weapon -> .weapon, armor -> .armor, trinket -> .mods (top-level).
  if (it.type === "consumable") {
    const e = it.effect || {};
    if (e.heal) return e.heal + " iyileştirme";
    if (e.damage) return e.damage.dmg + " " + (e.damage.element || "") + " hasar" + (e.damage.area ? " · alan" : "");
    if (e.restoreSlot) return "+" + e.restoreSlot + " büyü slotu";
    if (e.buff) return (typeof statusDesc === "function") ? statusDesc(e.buff) : "";
    return "";
  }
  if (it.type === "weapon" && it.weapon) {
    const base = it.weapon.weaponDef || WEAPONS[it.weapon.weapon];
    const dmg = base ? base.dmg : "?";
    return "+" + (it.weapon.bonus || 0) + " isabet/hasar · " + dmg;
  }
  if (it.type === "armor" && it.armor) {
    const base = ARMORS[it.armor.armor];
    const dodge = (base ? base.dodge : 0) + (it.armor.bonus || 0);
    return "Kaçınma " + (dodge >= 0 ? "+" : "") + dodge + (base && base.dr ? " · hasar -%" + Math.round(base.dr * 100) : "");
  }
  if (it.type === "trinket" && it.mods) {
    return Object.keys(it.mods).map(k => (STAT_LABEL[k] || k) + " " + (it.mods[k] >= 0 ? "+" : "") + it.mods[k]).join(", ");
  }
  return "";
}
function heroClassMatches(it) {
  if (!it.classes || !it.classes.length) return true;
  return GameState.party.some(h => it.classes.indexOf(h.cls) >= 0);
}

let shopSession = null; // { shopId, counts: {itemId: kalan stok} } — kamp ziyareti boyunca yaşar
function initShopSession(shopId) {
  const stock = getShopStock()[shopId] || [];
  const counts = {};
  stock.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
  shopSession = { shopId, counts };
}
function renderShop() {
  const defs = getItemDefs();
  const wrap = document.getElementById("shopGrid");
  if (!shopSession) { wrap.innerHTML = ""; return; }
  const ids = Object.keys(shopSession.counts).filter(id => shopSession.counts[id] > 0);
  if (!ids.length) { wrap.innerHTML = '<div class="muted">Mağaza boşaldı.</div>'; return; }
  wrap.innerHTML = ids.map(id => {
    const it = defs[id]; if (!it) return "";
    const n = shopSession.counts[id];
    const affordable = GameState.gold >= it.price;
    const classOk = heroClassMatches(it);
    const disabled = !affordable || !classOk;
    return '<div class="item-card"><div><b>' + it.name + '</b> <span class="item-type">' + itemTypeLabel(it) + '</span>' +
      (n > 1 ? ' <span class="stock">×' + n + ' stok</span>' : '') +
      '<div class="muted item-stats">' + itemStatsLine(it) + '</div>' +
      (it.desc ? '<div class="muted">' + it.desc + '</div>' : '') +
      (!classOk ? '<div class="muted">Sınıf kısıtı: ' + it.classes.join(", ") + '</div>' : '') + '</div>' +
      '<div><span class="price">' + it.price + '</span> <button class="btn" ' + (disabled ? "disabled" : "") + ' onclick="buyItem(\'' + id + '\')">Al</button></div></div>';
  }).join("");
}
function buyItem(id) {
  const it = getItemDefs()[id];
  if (!it || GameState.gold < it.price || !heroClassMatches(it)) return;
  if (!shopSession || !(shopSession.counts[id] > 0)) return;
  GameState.gold -= it.price;
  shopSession.counts[id]--;
  addInventoryItem(id, 1);
  document.getElementById("campGold").textContent = GameState.gold;
  renderShop(); renderInventory(); renderCampHeroes();
}
function renderInventory() {
  const defs = getItemDefs();
  const wrap = document.getElementById("invList");
  const keys = Object.keys(GameState.inventory);
  if (!keys.length) { wrap.innerHTML = '<div class="muted">Çanta boş.</div>'; return; }
  wrap.innerHTML = keys.map(id => {
    const it = defs[id]; if (!it) return "";
    const n = GameState.inventory[id];
    return '<div class="item-card"><div><b>' + it.name + '</b> ×' + n + ' <span class="item-type">' + itemTypeLabel(it) + '</span>' +
      '<div class="muted item-stats">' + itemStatsLine(it) + '</div></div>' +
      '<div><button class="btn" onclick="sellItem(\'' + id + '\')">Sat (' + Math.floor(it.price / 2) + ')</button></div></div>';
  }).join("");
}
function sellItem(id) {
  const it = getItemDefs()[id];
  if (!it || !GameState.inventory[id]) return;
  consumeInventoryItem(id);
  GameState.gold += Math.floor(it.price / 2);
  document.getElementById("campGold").textContent = GameState.gold;
  renderShop(); renderInventory(); renderCampHeroes();
}

// ---------- SAVAŞ İÇİ "EŞYA" MENÜSÜ (main.js çağırır) ----------
function battleUsableItems() {
  if (!GameState) return [];
  const defs = getItemDefs();
  return Object.keys(GameState.inventory).filter(id => defs[id] && defs[id].type === "consumable");
}

// ---------- SON EKRANI ----------
function showEndingScreen() {
  clearSaveGame();
  showScreen("screen-ending");
  playMusic("ending");
  const pages = (getCampaign().ending || []).slice();
  const idxRef = { i: 0 };
  document.getElementById("btnEndingNext").style.display = "";
  document.getElementById("btnEndingMenu").style.display = "none";
  function renderPage() {
    const p = pages[idxRef.i];
    if (!p) { showEndingStats(); return; }
    document.getElementById("endingName").textContent = resolveDialogueText(p.speaker || "");
    document.getElementById("endingText").textContent = resolveDialogueText(p.text || "");
    drawPortraitSafe(document.getElementById("endingPortrait"), p.portrait);
  }
  document.getElementById("btnEndingNext").onclick = () => { idxRef.i++; if (idxRef.i >= pages.length) { showEndingStats(); } else renderPage(); };
  renderPage();
  function showEndingStats() {
    document.getElementById("btnEndingNext").style.display = "none";
    document.getElementById("btnEndingMenu").style.display = "";
    const mins = Math.round((Date.now() - GameState.stats.startTime) / 60000);
    const hd = GameState.stats.heroDamage || {};
    let topHero = "-", topDmg = 0;
    for (const name in hd) if (hd[name] > topDmg) { topDmg = hd[name]; topHero = name; }
    document.getElementById("endingStats").innerHTML =
      "<div>" + statBox("Süre", "~" + mins + " dk") + "</div>" +
      "<div>" + statBox("Toplam Tur", GameState.stats.rounds) + "</div>" +
      "<div>" + statBox("Düşen Kahraman", GameState.stats.deaths) + "</div>" +
      "<div>" + statBox("Savaş", GameState.stats.battles) + "</div>" +
      "<div>" + statBox("Toplanan Altın", GameState.stats.goldCollected || 0) + "</div>" +
      "<div>" + statBox("En Çok Hasar Veren", topHero + (topDmg ? " (" + topDmg + ")" : "")) + "</div>";
    const ngBtn = document.getElementById("btnNewGamePlus");
    if (ngBtn) { ngBtn.style.display = ""; ngBtn.onclick = startNewGamePlus; }
  }
  document.getElementById("btnEndingMenu").onclick = () => { GameState = freshGameState(); showScreen("screen-title"); refreshTitleSaveUI(); playMusic("title"); };
}
function statBox(label, val) { return "<span class='stat-label'>" + label + "</span><b>" + val + "</b>"; }

// "Yeni Oyun+": aynı ekip (seviye/ekipman korunur, tam iyileşir) ile kampanya baştan başlar;
// düşmanlar setupBattle'da +%25 HP ile kurulur (bkz. makeEnemyUnit / instantiateLiveEnemy).
function startNewGamePlus() {
  if (!GameState || !GameState.party || !GameState.party.length) return;
  const party = GameState.party;
  party.forEach(h => { h.hp = h.hpMax; h.slots = h.slotsMax; h.secondWind = h.secondWindMax; });
  GameState = Object.assign(freshGameState(), { party, ngPlus: true });
  saveGame();
  showMapScreen();
}
