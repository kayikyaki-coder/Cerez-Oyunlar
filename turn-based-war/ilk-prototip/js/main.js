// main.js — akış (yaratma → oyun), arayüz güncelleme, oyun olayları

function refresh() {
  draw();
  updatePanel();
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
  if (State.phase === "over") {
    tn.innerHTML = State.winner === "party"
      ? '<span style="color:#57c96a">ZAFER 🎉</span>'
      : '<span style="color:#d9534f">YENİLGİ 💀</span>';
  } else {
    const cls = u.side === "party" ? "side-party" : "side-wolf";
    tn.innerHTML = '<span class="' + cls + '">' + u.name + "</span> <span class='muted'>· " + u.cls + "</span>";
  }

  const box = document.getElementById("unitstats");
  if (u) {
    box.innerHTML =
      '<div class="row"><span>HP</span><b>' + u.hp + " / " + u.hpMax + "</b></div>" +
      '<div class="row"><span>AP</span><b>' + apPips(u.ap) + "</b></div>" +
      '<div class="row"><span>Might / Agility</span><b>' + u.stats.might + " / " + u.stats.agility + "</b></div>" +
      '<div class="row"><span>Saldırı</span><b>' + u.attack.name + " (" + u.attack.dmg + ")</b></div>" +
      '<div class="row"><span>Menzil / Hız</span><b>' + u.attack.range + " hex / " + u.speed + "</b></div>" +
      (u.armorName ? '<div class="row"><span>Zırh</span><b>' + u.armorName + "</b></div>" : "") +
      (u.spells ? '<div class="row"><span>Büyü slotu</span><b>' + (u.slots || 0) + " / " + (u.slotsMax || 0) + "</b></div>" : "") +
      (u.secondWindMax ? '<div class="row"><span>Second Wind</span><b>' + (u.secondWind || 0) + " / " + u.secondWindMax + "</b></div>" : "") +
      (u.statuses && u.statuses.length ? '<div class="row"><span>Etkiler</span><b>' + u.statuses.map(s => s.name).join(", ") + "</b></div>" : "");
  }

  const isPlayer = State.phase === "playerInput" && u && u.side === "party";
  const btnMove = document.getElementById("btnMove");
  const btnAttack = document.getElementById("btnAttack");
  const btnSpell = document.getElementById("btnSpell");
  const btnAbility = document.getElementById("btnAbility");
  const btnEnd = document.getElementById("btnEnd");

  btnMove.disabled = !(isPlayer && u.ap >= 1 && u.movesUsed < 2);
  btnAttack.disabled = !(isPlayer && u.ap >= 2 && !u.hasAttacked && !hasStatus(u, "cantAttack"));
  btnEnd.disabled = !isPlayer;

  // Büyü butonu: sadece büyücü sınıflar
  const caster = u && u.spells;
  btnSpell.style.display = caster ? "" : "none";
  btnSpell.disabled = !(isPlayer && caster && u.ap >= 1);

  // Yetenek butonu: Fighter → Second Wind
  const hasAbility = u && u.secondWindMax;
  btnAbility.style.display = hasAbility ? "" : "none";
  if (hasAbility) {
    btnAbility.textContent = "Second Wind (" + (u.secondWind || 0) + ")";
    btnAbility.disabled = !(isPlayer && u.ap >= 1 && u.secondWind > 0 && u.hp < u.hpMax && !u.swUsed);
  }

  btnMove.classList.toggle("active", State.mode === "move");
  btnAttack.classList.toggle("active", State.mode === "attack");
  btnSpell.classList.toggle("active", spellMenuOpen || State.mode === "spell");

  renderSpellMenu();

  // Hareket butonu: ilk hareketten sonra "Dash"e döner, gidilebilecek hex sayısını gösterir
  if (u && u.side === "party") {
    if (u.movesUsed === 0) btnMove.textContent = "Hareket (" + u.speed + ")";
    else if (u.movesUsed === 1) btnMove.textContent = "Dash (" + Math.floor(u.speed / 2) + ")";
    else btnMove.textContent = "Hareket ✓";
  } else {
    btnMove.textContent = "Hareket";
  }

  const hint = document.getElementById("hint");
  if (State.phase === "enemy") hint.textContent = "Kurtlar hamle yapıyor...";
  else if (State.phase === "over") hint.textContent = "↻ Yeni Savaş ile tekrar başla.";
  else if (State.mode === "move") hint.textContent = "Yeşil bir kareye tıkla.";
  else if (State.mode === "attack") hint.textContent = "Kırmızı çerçeveli düşmana tıkla.";
  else if (State.mode === "heal") hint.textContent = "Mavi çerçeveli dostuna tıkla.";
  else if (State.mode === "spell") hint.textContent = (State.pendingSpell && State.pendingSpell.target === "enemy") ? "Kırmızı çerçeveli düşmana büyü at." : "Mavi çerçeveli dostuna büyü at.";
  else if (spellMenuOpen) hint.textContent = "Listeden bir büyü seç.";
  else hint.textContent = "Bir aksiyon seç.";

  const banner = document.getElementById("banner");
  if (State.phase === "over") {
    banner.textContent = State.winner === "party" ? "Kurtlar temizlendi! Ekip ayakta." : "Ekip düştü... Yeni savaş dene.";
  } else if (State.phase === "enemy") {
    banner.textContent = u.name + " (kurt) saldırıyor.";
  } else {
    banner.textContent = u.name + " sırası — " + u.ap + " AP kaldı.";
  }

  const ol = document.getElementById("orderlist");
  ol.innerHTML = "";
  State.order.forEach((unit, idx) => {
    const li = document.createElement("li");
    if (idx === State.turnPtr && State.phase !== "over") li.classList.add("now");
    if (unit.dead) li.classList.add("dead");
    const side = unit.side === "party" ? "side-party" : "side-wolf";
    li.innerHTML = '<span class="' + side + '">' + unit.name + "</span><span class='muted'>" + unit.init + "</span>";
    ol.appendChild(li);
  });

  const logEl = document.getElementById("log");
  logEl.innerHTML = State.log.map(e => '<div class="' + e.cls + '">' + e.text + "</div>").join("");
  logEl.scrollTop = logEl.scrollHeight;
}

// ---------- BÜYÜ MENÜSÜ ----------
let spellMenuOpen = false;

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

function pickSpell(id) {
  spellMenuOpen = false;
  enterSpell(id);
  refresh();
}

// ---------- OYUNU BAŞLAT ----------
let gameEventsBound = false;

function startGame() {
  setupBattle();
  initCanvas();
  bindGameEvents();
  refresh();
}

function bindGameEvents() {
  if (gameEventsBound) return;
  gameEventsBound = true;

  canvasEl.addEventListener("click", (e) => {
    const rect = canvasEl.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const h = pixelToHex(px, py);
    if (h) handleHexClick(h.q, h.r);
  });

  document.getElementById("btnMove").addEventListener("click", () => {
    spellMenuOpen = false;
    if (State.mode === "move") { clearMode(); refresh(); } else enterMove();
  });
  document.getElementById("btnAttack").addEventListener("click", () => {
    spellMenuOpen = false;
    if (State.mode === "attack") { clearMode(); refresh(); } else enterAttack();
  });
  document.getElementById("btnSpell").addEventListener("click", () => {
    if (State.mode === "spell") clearMode();
    spellMenuOpen = !spellMenuOpen;
    refresh();
  });
  document.getElementById("btnAbility").addEventListener("click", () => {
    const u = cur();
    if (u && u.secondWindMax && u.secondWind > 0 && u.ap >= 1 && u.hp < u.hpMax && !u.swUsed) { doSecondWind(u); refresh(); }
  });
  document.getElementById("btnEnd").addEventListener("click", () => endTurn());
  document.getElementById("btnNew").addEventListener("click", () => { setupBattle(); refresh(); });
  document.getElementById("btnRebuild").addEventListener("click", () => backToCreate());
}

window.addEventListener("DOMContentLoaded", createInit);
