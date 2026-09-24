// main.js — arayüz güncelleme, oyun olayları, klavye kısayolları, hover, debug kancası

function refresh() {
  draw();
  updatePanel();
  // Savaş bittiğinde kampanya akışına (varsa) bir kez haber ver
  if (State.phase === "over" && !State._resultShown) {
    State._resultShown = true;
    // GameState yalnızca kampanya akışı (campaign-flow.js initTitleFlow) başlatıldıysa var olur;
    // headless/motor testlerinde (sim.js) tanımsız kalır — o durumda sonuç ekranına geçiş yok.
    if (typeof GameState !== "undefined" && GameState) {
      guardedTimeout(() => { if (typeof onBattlePhaseOver === "function") onBattlePhaseOver(); }, scaledDelay(900));
    }
  }
}

function apPips(n) {
  let s = "";
  for (let i = 0; i < 4; i++) s += '<span class="pip' + (i < n ? "" : " off") + '">●</span>';
  return s;
}

function updatePanel() {
  const u = cur();

  document.getElementById("turnround").textContent = "Round " + State.round;
  const tn = document.getElementById("turnname");
  const turnbox = document.getElementById("turnbox");
  if (State.phase === "over") {
    tn.innerHTML = State.winner === "party"
      ? '<span style="color:#57c96a">ZAFER 🎉</span>'
      : '<span style="color:#d9534f">YENİLGİ 💀</span>';
  } else {
    const cls = u.side === "party" ? "side-party" : "side-enemy";
    tn.innerHTML = '<span class="' + cls + '">' + u.name + "</span> <span class='muted'>· " + u.cls + "</span>";
    turnbox.classList.remove("party", "enemy");
    turnbox.classList.add(u.side === "party" ? "party" : "enemy");
  }

  // Aktif birimin portresi/sprite'ı (64px)
  if (u) {
    const portraitCv = document.getElementById("unitPortrait");
    document.getElementById("unitName").textContent = u.name;
    document.getElementById("unitCls").textContent = u.cls || "";
    portraitCv.classList.remove("party", "enemy");
    portraitCv.classList.add(u.side === "party" ? "party" : "enemy");
    const pctx = portraitCv.getContext("2d");
    pctx.clearRect(0, 0, portraitCv.width, portraitCv.height);
    pctx.imageSmoothingEnabled = false;
    const spr = (typeof Sprites !== "undefined") ? (Sprites[u.sprite] || Sprites.wolf || Sprites.fighter) : null;
    if (spr && typeof drawSpriteGrid === "function") drawSpriteGrid(pctx, spr, 32, 34, 3, u.side !== "party");
  }

  const box = document.getElementById("unitstats");
  const gt = (typeof glossaryTip === "function") ? glossaryTip : () => "";
  if (u) {
    box.innerHTML =
      '<div class="row"><span' + gt("ap") + '>HP</span><b>' + u.hp + " / " + u.hpMax + "</b></div>" +
      '<div class="row"><span' + gt("ap") + '>AP</span><b>' + apPips(u.ap) + "</b></div>" +
      '<div class="row"><span' + gt("might") + '>Might / <span' + gt("agility") + '>Agility</span></span><b>' + u.stats.might + " / " + u.stats.agility + "</b></div>" +
      '<div class="row"><span>Saldırı</span><b>' + u.attack.name + " (" + u.attack.dmg + ")</b></div>" +
      '<div class="row"><span>Menzil / Hız</span><b>' + u.attack.range + " hex / " + u.speed + "</b></div>" +
      (u.armorName ? '<div class="row"><span' + gt("dr") + '>Zırh</span><b>' + u.armorName + "</b></div>" : "") +
      (u.spells ? '<div class="row"><span>Büyü slotu</span><b>' + (u.slots || 0) + " / " + (u.slotsMax || 0) + "</b></div>" : "") +
      (u.secondWindMax ? '<div class="row"><span>Second Wind</span><b>' + (u.secondWind || 0) + " / " + u.secondWindMax + "</b></div>" : "") +
      (u.statuses && u.statuses.length ? '<div class="row"><span>Etkiler</span><b>' + u.statuses.map(s => '<span' + gt(s.name) + '>' + s.name + '</span>').join(", ") + "</b></div>" : "");
  }

  const isPlayer = State.phase === "playerInput" && u && u.side === "party";
  const btnMove = document.getElementById("btnMove");
  const btnAttack = document.getElementById("btnAttack");
  const btnSpell = document.getElementById("btnSpell");
  const btnAbility = document.getElementById("btnAbility");
  const btnItem = document.getElementById("btnItem");
  const btnEnd = document.getElementById("btnEnd");

  btnMove.disabled = !(isPlayer && u.ap >= 1 && u.movesUsed < 2);
  btnAttack.disabled = !(isPlayer && u.ap >= 2 && !u.hasAttacked && !hasStatus(u, "cantAttack"));
  btnEnd.disabled = !isPlayer;

  const caster = u && u.spells;
  btnSpell.style.display = caster ? "" : "none";
  btnSpell.disabled = !(isPlayer && caster && u.ap >= 1);

  const abilities = (isPlayer && typeof unitAbilities === "function") ? unitAbilities(u).filter(a => !a.passive) : [];
  btnAbility.style.display = abilities.length ? "" : "none";
  btnAbility.disabled = !(isPlayer && abilities.some(a => a.ready));

  const items = (isPlayer && typeof battleUsableItems === "function") ? battleUsableItems() : [];
  btnItem.style.display = items.length ? "" : "none";
  btnItem.disabled = !(isPlayer && u.ap >= 1 && items.length);

  btnMove.classList.toggle("active", State.mode === "move");
  btnAttack.classList.toggle("active", State.mode === "attack");
  btnSpell.classList.toggle("active", spellMenuOpen || State.mode === "spell");
  btnAbility.classList.toggle("active", abilityMenuOpen || State.mode === "ability");
  btnItem.classList.toggle("active", itemMenuOpen || State.mode === "item");

  renderSpellMenu();
  renderAbilityMenu(abilities);
  renderItemMenu(items);

  if (u && u.side === "party") {
    if (u.movesUsed === 0) btnMove.textContent = "Hareket (" + u.speed + ")";
    else if (u.movesUsed === 1) btnMove.textContent = "Dash (" + Math.floor(u.speed / 2) + ")";
    else btnMove.textContent = "Hareket ✓";
  } else {
    btnMove.textContent = "Hareket";
  }

  const hint = document.getElementById("hint");
  if (State.phase === "enemy") hint.textContent = "Düşman hamle yapıyor...";
  else if (State.phase === "over") hint.textContent = "Sonuç ekranına geçiliyor...";
  else if (State.mode === "move") hint.textContent = "Yeşil bir kareye tıkla.";
  else if (State.mode === "attack") hint.textContent = "Kırmızı çerçeveli düşmana tıkla.";
  else if (State.mode === "heal") hint.textContent = "Mavi çerçeveli dostuna tıkla.";
  else if (State.mode === "spell") hint.textContent = (State.pendingSpell && State.pendingSpell.target === "enemy") ? "Kırmızı çerçeveli düşmana büyü at." : "Mavi çerçeveli dostuna büyü at.";
  else if (State.mode === "item") hint.textContent = "Hedefe tıkla.";
  else if (State.mode === "ability") hint.textContent = "Hedefe tıkla.";
  else if (spellMenuOpen) hint.textContent = "Listeden bir büyü seç.";
  else if (abilityMenuOpen) hint.textContent = "Listeden bir yetenek seç.";
  else if (itemMenuOpen) hint.textContent = "Listeden bir eşya seç.";
  else hint.textContent = "Bir aksiyon seç. (Kısayollar: 1-5, E, Esc)";

  const bannerText = document.getElementById("bannerText");
  if (State.phase === "over") {
    bannerText.textContent = State.winner === "party" ? "Zafer! Düşmanlar temizlendi." : "Ekip düştü...";
  } else if (State.phase === "enemy") {
    bannerText.textContent = u.name + " saldırıyor.";
  } else {
    bannerText.textContent = u.name + " sırası — " + u.ap + " AP kaldı.";
  }
  const ffBtnEl = document.getElementById("btnFast");
  if (ffBtnEl) { ffBtnEl.style.display = (State.phase === "enemy") ? "" : "none"; ffBtnEl.classList.toggle("active", !!State._ffActive); }

  const ol = document.getElementById("orderlist");
  ol.innerHTML = "";
  State.order.forEach((unit, idx) => {
    const li = document.createElement("li");
    if (idx === State.turnPtr && State.phase !== "over") li.classList.add("now");
    if (unit.dead) li.classList.add("dead");
    const side = unit.side === "party" ? "side-party" : "side-enemy";
    li.innerHTML = '<span class="' + side + '">' + unit.name + "</span><span class='muted'>" + unit.init + "</span>";
    ol.appendChild(li);
  });

  const logEl = document.getElementById("log");
  logEl.innerHTML = State.log.map(e => '<div class="' + e.cls + '">' + e.text + "</div>").join("");
  logEl.scrollTop = logEl.scrollHeight;
}

// ---------- BÜYÜ / YETENEK / EŞYA MENÜLERİ ----------
let spellMenuOpen = false, abilityMenuOpen = false, itemMenuOpen = false;

function spellInfo(sp) {
  const area = sp.area ? " · alan" : "";
  if (sp.resolve === "heal") return "+" + sp.dmg;
  if (sp.dmg) return sp.dmg + area;
  if (sp.missiles) return sp.missiles.n + "d" + sp.missiles.die;
  if (sp.status) return statusDesc(sp.status) + area;
  return "";
}

function renderSpellMenu() {
  const box = document.getElementById("spellmenu");
  const u = cur();
  const show = spellMenuOpen && State.phase === "playerInput" && u && u.spells;
  if (!show) { spellMenuOpen = false; box.style.display = "none"; box.innerHTML = ""; return; }
  box.style.display = "block";
  let html = '<div class="spell-title">Büyüler <span class="muted">· slot ' + (u.slots || 0) + "/" + (u.slotsMax || 0) + "</span></div>";
  for (const id of u.spells) {
    const sp = SPELLBOOK[id];
    if (!sp) continue;
    const ok = canCast(u, sp);
    const slotTag = sp.level >= 1 ? "◈ " : "";
    html += '<button class="spell-item" ' + (ok ? "" : "disabled") + ' onclick="pickSpell(\'' + id + '\')">' +
      '<span class="sp-name">' + slotTag + sp.name + "</span>" +
      '<span class="sp-meta">' + spellInfo(sp) + " · " + sp.ap + "AP" + (sp.range > 1 ? " · " + sp.range + "hex" : "") + "</span></button>";
  }
  box.innerHTML = html;
}
function pickSpell(id) { spellMenuOpen = false; enterSpell(id); refresh(); }

function renderAbilityMenu(abilities) {
  const box = document.getElementById("abilitymenu");
  const show = abilityMenuOpen && State.phase === "playerInput" && abilities && abilities.length;
  if (!show) { abilityMenuOpen = false; box.style.display = "none"; box.innerHTML = ""; return; }
  box.style.display = "block";
  let html = '<div class="spell-title">Yetenekler</div>';
  for (const a of abilities) {
    html += '<button class="ability-item" ' + (a.ready ? "" : "disabled") + ' onclick="pickAbility(\'' + a.id + '\')">' +
      '<span class="sp-name">' + a.name + (a.uses != null ? " (" + a.uses + ")" : "") + "</span>" +
      '<span class="ab-meta">' + a.desc + "</span></button>";
  }
  box.innerHTML = html;
}
function pickAbility(id) { abilityMenuOpen = false; enterAbility(id); refresh(); }

function renderItemMenu(items) {
  const box = document.getElementById("itemmenu");
  const show = itemMenuOpen && State.phase === "playerInput" && items && items.length;
  if (!show) { itemMenuOpen = false; box.style.display = "none"; box.innerHTML = ""; return; }
  box.style.display = "block";
  const defs = getItemDefs();
  let html = '<div class="spell-title">Eşyalar</div>';
  for (const id of items) {
    const it = defs[id];
    const n = GameState.inventory[id];
    html += '<button class="ability-item" onclick="pickItem(\'' + id + '\')">' +
      '<span class="sp-name">' + it.name + " ×" + n + "</span>" +
      '<span class="ab-meta">' + (it.desc || "") + "</span></button>";
  }
  box.innerHTML = html;
}
function pickItem(id) { itemMenuOpen = false; enterItem(id); refresh(); }

// ---------- OYUNU BAŞLAT (bağımsız / test amaçlı) ----------
let gameEventsBound = false;

function startGame() {
  setupBattle();
  if (typeof layoutBoard === "function") layoutBoard();
  initCanvas();
  bindGameEvents();
  refresh();
  startRenderLoop();
}

function bindGameEvents() {
  startRenderLoop();
  if (gameEventsBound) return;
  gameEventsBound = true;

  canvasEl.addEventListener("click", (e) => {
    const rect = canvasEl.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const h = pixelToHex(px, py);
    if (!h) return;
    // Mod yokken bir birime tıklamak onu panelde "incele" olarak sabitler (düşman dahil).
    if (State.mode === "idle") {
      const u = unitAt(h.q, h.r);
      if (u) { State.inspectUnit = u; updateHoverTooltip(h, e.clientX, e.clientY); return; }
    }
    handleHexClick(h.q, h.r);
  });
  canvasEl.addEventListener("mousemove", (e) => {
    const rect = canvasEl.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    State.hoverPx = { x: e.clientX, y: e.clientY };
    const h = pixelToHex(px, py);
    State.hoverHex = h;
    updateHoverTooltip(h, e.clientX, e.clientY);
  });
  canvasEl.addEventListener("mouseleave", () => {
    State.hoverHex = null;
    // İncelenen bir birim varsa tooltip'i tamamen gizlemek yerine onu göstermeye devam et.
    if (State.inspectUnit && !State.inspectUnit.dead) updateHoverTooltip(null, State.hoverPx ? State.hoverPx.x : 0, State.hoverPx ? State.hoverPx.y : 0);
    else hideHoverTooltip();
  });
  // Sağ tıklama: Esc gibi mevcut modu iptal eder.
  canvasEl.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    clearMode(); spellMenuOpen = false; abilityMenuOpen = false; itemMenuOpen = false;
    refresh();
  });

  document.getElementById("btnMove").addEventListener("click", () => {
    spellMenuOpen = false; abilityMenuOpen = false; itemMenuOpen = false;
    if (State.mode === "move") { clearMode(); refresh(); } else enterMove();
  });
  document.getElementById("btnAttack").addEventListener("click", () => {
    spellMenuOpen = false; abilityMenuOpen = false; itemMenuOpen = false;
    if (State.mode === "attack") { clearMode(); refresh(); } else enterAttack();
  });
  document.getElementById("btnSpell").addEventListener("click", () => {
    if (State.mode === "spell") clearMode();
    abilityMenuOpen = false; itemMenuOpen = false;
    spellMenuOpen = !spellMenuOpen;
    refresh();
  });
  document.getElementById("btnAbility").addEventListener("click", () => {
    if (State.mode === "ability") clearMode();
    spellMenuOpen = false; itemMenuOpen = false;
    abilityMenuOpen = !abilityMenuOpen;
    refresh();
  });
  document.getElementById("btnItem").addEventListener("click", () => {
    if (State.mode === "item") clearMode();
    spellMenuOpen = false; abilityMenuOpen = false;
    itemMenuOpen = !itemMenuOpen;
    refresh();
  });
  document.getElementById("btnEnd").addEventListener("click", () => endTurn());
  const helpBtn = document.getElementById("btnBattleHelp");
  if (helpBtn) helpBtn.addEventListener("click", () => { if (typeof openHelp === "function") openHelp("app"); });
  document.getElementById("btnRebuild").addEventListener("click", () => {
    const goHome = () => {
      if (typeof showScreen === "function") { saveGame(); showScreen("screen-title"); playMusic("title"); }
      else backToCreate();
    };
    if (State.phase !== "over" && typeof showConfirm === "function") {
      showConfirm("Savaştan çıkarsan ilerleme savaş başına döner. Emin misin?", goHome);
    } else {
      goHome();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (!document.getElementById("app").classList.contains("active") && document.getElementById("app").style.display === "none") return;
    // Space basılı tutulurken (düşman turunda) her şeyi anında ilerlet.
    if (e.code === "Space" && State.phase === "enemy") { e.preventDefault(); State._ffActive = true; const b = document.getElementById("btnFast"); if (b) b.classList.add("active"); return; }
    if (State.phase !== "playerInput") return;
    if (e.key === "1") document.getElementById("btnMove").click();
    else if (e.key === "2") document.getElementById("btnAttack").click();
    else if (e.key === "3" && document.getElementById("btnSpell").style.display !== "none") document.getElementById("btnSpell").click();
    else if (e.key === "4" && document.getElementById("btnAbility").style.display !== "none") document.getElementById("btnAbility").click();
    else if (e.key === "5" && document.getElementById("btnItem").style.display !== "none") document.getElementById("btnItem").click();
    else if (e.key === "e" || e.key === "E" || e.key === "Enter") document.getElementById("btnEnd").click();
    else if (e.key === "Escape") { clearMode(); spellMenuOpen = false; abilityMenuOpen = false; itemMenuOpen = false; refresh(); }
  });
  document.addEventListener("keyup", (e) => { if (e.code === "Space") { State._ffActive = false; const b = document.getElementById("btnFast"); if (b) b.classList.remove("active"); } });
  const ffBtn = document.getElementById("btnFast");
  if (ffBtn) ffBtn.addEventListener("click", (e) => { e.stopPropagation(); State._ffActive = true; ffBtn.classList.add("active"); });
}

// Tur başında kısa "SIRA: <isim>" bannerı (~400ms) — engine.js startTurn() çağırır.
function announceTurn(u) {
  const el = document.getElementById("turnAnnounce");
  if (!el || !u) return;
  const isRoundStart = State.turnPtr === 0;
  el.textContent = isRoundStart ? ("ROUND " + State.round + " — " + u.name) : ("SIRA: " + u.name);
  el.className = "turn-banner " + (u.side === "party" ? "party" : "enemy") + (isRoundStart ? " round" : "");
  el.style.display = "block";
  clearTimeout(el._timer);
  const ms = scaledDelay(400) || 150;
  el._timer = setTimeout(() => { el.style.display = "none"; }, ms);
}

// ---------- HOVER TOOLTIP (.dmg-tooltip) ----------
function updateHoverTooltip(hex, cx, cy) {
  const tip = document.getElementById("hoverTooltip");
  if (!tip) return;
  let t = hex ? unitAt(hex.q, hex.r) : null;
  const terr = hex ? ((typeof terrainAt === "function") ? terrainAt(hex.q, hex.r) : null) : null;
  // hex boşsa ama sabitlenmiş bir inceleme birimi varsa onu göstermeye devam et
  if (!t && State.inspectUnit && !State.inspectUnit.dead) t = State.inspectUnit;
  let html = "";
  if (hex && terr && !t) html = "<div class='muted'>" + terr.name + "</div>";
  if (t) {
    const dodgeVal = t.stats.agility + effDodge(t);
    html = "<span class='t-name'>" + t.name + " <span class='muted'>(" + t.cls + ")</span></span>" +
      "<div class='t-row'><span>HP</span><b>" + t.hp + "/" + t.hpMax + "</b></div>" +
      "<div class='t-row'><span>Kaçınma</span><b>" + dodgeVal + "</b></div>";
    const atk = cur();
    if (atk && atk.side === "party" && (State.mode === "attack" || State.mode === "spell") && atk !== t) {
      const usingSpell = State.mode === "spell" && State.pendingSpell;
      const range = usingSpell ? State.pendingSpell.range : atk.attack.range;
      const dist = hexDist(atk, t);
      if (dist > range) {
        html += "<div class='t-row out-of-range'><span>Menzil dışı</span><span>" + dist + " hex</span></div>";
      } else {
        const pct = hitChanceEstimate(atk, t, usingSpell ? State.pendingSpell : null);
        const cls = pct < 35 ? "low" : (pct < 65 ? "mid" : "");
        html += "<div class='t-row'><span>İsabet</span><span class='hit-chance " + cls + "'>%" + pct + "</span></div>";
        const dr = estimateDamageRange(atk, usingSpell ? State.pendingSpell : null);
        if (dr) html += "<div class='t-row'><span>Hasar</span><span class='dmg-range'>" + dr.min + "–" + dr.max + "</span></div>";
      }
    }
  }
  if (!html) { hideHoverTooltip(); return; }
  tip.className = "dmg-tooltip";
  tip.innerHTML = html;
  tip.style.display = "block";
  positionTooltip(tip, cx, cy);
}
function positionTooltip(tip, cx, cy) {
  const appEl = document.getElementById("app");
  const panelRect = appEl.getBoundingClientRect();
  const tipW = tip.offsetWidth || 200;
  let left = cx - panelRect.left + 14;
  if (cx + tipW + 24 > window.innerWidth) left = cx - panelRect.left - tipW - 14; // sağ kenarda taşmasın, sola aç
  if (left < 0) left = 4;
  tip.style.left = left + "px";
  tip.style.top = (cy - panelRect.top + 14) + "px";
}
function hideHoverTooltip() { const tip = document.getElementById("hoverTooltip"); if (tip) tip.style.display = "none"; }
// kaba isabet şansı tahmini (gerçek zar mekaniğini birebir yansıtmaz, bilgi amaçlı)
function hitChanceEstimate(attacker, defender, spell) {
  const atkBonus = spell ? spellStatVal(attacker) : attackStat(attacker);
  const ranged = spell ? spell.range > 1 : !!attacker.attack.ranged;
  const defBonus = defender.stats.agility + effDodge(defender, ranged);
  const diff = (10 + atkBonus) - (10 + defBonus);
  const pct = Math.max(5, Math.min(95, 50 + diff * 5));
  return Math.round(pct);
}
// kaba hasar aralığı tahmini (zırh/dr sonrası mitigasyonu hesaba katmaz, bilgi amaçlı)
function estimateDamageRange(attacker, spell) {
  let dmgStr = null, bonus = 0;
  if (spell) {
    if (spell.dmg) dmgStr = spell.dmg;
    else if (spell.missiles) return { min: spell.missiles.n, max: spell.missiles.n * spell.missiles.die };
    else return null;
  } else {
    dmgStr = attacker.attack.dmg;
    bonus = Math.max(0, attackStat(attacker));
  }
  if (!dmgStr) return null;
  const p = parseDmg(dmgStr);
  return { min: p.num + bonus, max: p.num * p.sides + bonus };
}

window.addEventListener("DOMContentLoaded", () => {
  if (typeof initSceneCanvases === "function") initSceneCanvases();
  if (typeof initTitleFlow === "function") { initTitleFlow(); bindDebugHook(); }
  else createInit();
  installErrorShield();
});

// ---------- HATA KALKANI ----------
// Beklenmeyen bir istisna oyunu kilitlemesin: küçük, kapatılabilir bir toast göster, konsola yaz,
// ve savaş ortasındaysak (mevcut tur işlem yapamaz duruma düştüyse) turu güvenle bitirmeyi dene.
let _errorShieldBusy = false;
function installErrorShield() {
  window.onerror = function (msg, src, line, col, err) {
    console.error("[TBW hata kalkanı]", msg, src, line, col, err);
    try { if (typeof showGlobalToast === "function") showGlobalToast("Beklenmeyen bir hata oluştu. Devam etmeye çalışılıyor…", 5000); } catch (e) { /* yut */ }
    if (!_errorShieldBusy && typeof State !== "undefined" && (State.phase === "playerInput" || State.phase === "enemy")) {
      _errorShieldBusy = true;
      try { endTurn(); } catch (e) { /* yut — en azından oyun kilitlenmedi */ }
      setTimeout(() => { _errorShieldBusy = false; }, 500);
    }
    return false; // tarayıcı konsoluna da yazmaya devam etsin
  };
  window.addEventListener("unhandledrejection", (ev) => {
    console.error("[TBW hata kalkanı] unhandled promise rejection:", ev.reason);
    try { if (typeof showGlobalToast === "function") showGlobalToast("Beklenmeyen bir hata oluştu.", 5000); } catch (e) { /* yut */ }
  });
}

// ---------- DEBUG KANCASI (?debug=1) ----------
function bindDebugHook() {
  try {
    const params = new URLSearchParams(location.search);
    if (params.get("debug") !== "1") return;
    window.__TBW = {
      State,
      forceWin() { if (State.phase !== "over") { State.units.forEach(u => { if (u.side !== "party") u.dead = true; }); State.phase = "over"; State.winner = "party"; refresh(); } },
      forceLose() { if (State.phase !== "over") { State.units.forEach(u => { if (u.side === "party") u.dead = true; }); State.phase = "over"; State.winner = "enemy"; refresh(); } },
      gotoNode(id) {
        const ch = currentChapter();
        const n = ch && ch.nodes.find(x => x.id === id);
        if (n) openNode(n);
      },
      GameState: () => GameState
    };
  } catch (e) { /* URLSearchParams desteklenmiyorsa yut */ }
}
