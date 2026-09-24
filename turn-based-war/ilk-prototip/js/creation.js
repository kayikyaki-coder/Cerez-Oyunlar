// creation.js — "Ekibini Kur" ekranı

const STAT_KEYS = ["might", "agility", "will", "mind", "influence"];
const STAT_LABEL = { might: "Might", agility: "Agility", will: "Will", mind: "Mind", influence: "Influence" };
const CREATE_POINTS = 7;
const STAT_CAP = 3;

const CREATE = { heroes: [] };

const CLASS_DEFAULT_GEAR = {
  Fighter: { atk: "longsword", armor: "leather", shield: true },
  Cleric:  { atk: "club",      armor: "leather", shield: true },
  Wizard:  { atk: "dagger",    armor: "none",    shield: false }
};

function createInit() {
  CREATE.heroes = defaultHeroes().map(h => ({
    name: h.name, cls: h.cls, stats: { ...h.stats },
    atk: h.atk, armor: h.armor, shield: h.shield
  }));
  document.getElementById("btnStart").addEventListener("click", createStart);
  createRender();
}

// Bir silahın okunur etiketi (versatile: kalkansız büyük zar)
function attackLabel(id) {
  const w = WEAPONS[id] || WEAPONS.dagger;
  const dmg = w.versatile ? (w.versatile.one + "/" + w.versatile.two) : w.dmg;
  return w.name + " · " + dmg + (w.ranged ? " (menzil " + w.range + ")" : "") + (w.finesse ? " · Finesse" : "");
}

function statSum(h) { return STAT_KEYS.reduce((s, k) => s + (h.stats[k] || 0), 0); }
function remaining(h) { return CREATE_POINTS - statSum(h); }

function createRender() {
  const wrap = document.getElementById("heroes");
  let html = "";
  CREATE.heroes.forEach((h, i) => {
    const def = CLASS_DEFS[h.cls];
    const rem = remaining(h);
    const hp = def.hpBase + (h.stats.might || 0);

    let classBtns = "";
    for (const c of ["Fighter", "Cleric", "Wizard"]) {
      classBtns += '<button class="' + (h.cls === c ? "on" : "") + '" onclick="createSetClass(' + i + ',\'' + c + '\')">' + c + "</button>";
    }

    let statRows = "";
    for (const k of STAT_KEYS) {
      const v = h.stats[k] || 0;
      const sug = (def.suggest === k) ? '<span class="sug">★</span>' : "";
      statRows +=
        '<div class="stat-row">' +
          '<span class="sname">' + STAT_LABEL[k] + " " + sug + "</span>" +
          '<button onclick="createStat(' + i + ',\'' + k + '\',-1)" ' + (v <= 0 ? "disabled" : "") + ">−</button>" +
          '<span class="sval">' + v + "</span>" +
          '<button onclick="createStat(' + i + ',\'' + k + '\',1)" ' + ((v >= STAT_CAP || rem <= 0) ? "disabled" : "") + ">+</button>" +
        "</div>";
    }

    // ---- Donanım: saldırı seçimi ----
    let atkOpts = "";
    for (const id of ATTACK_OPTIONS[h.cls]) {
      atkOpts += '<option value="' + id + '"' + (h.atk === id ? " selected" : "") + ">" + attackLabel(id) + "</option>";
    }
    const atkTitle = h.cls === "Wizard" ? "Saldırı Büyüsü" : (h.cls === "Cleric" ? "Saldırı" : "Silah");
    let gear =
      '<div class="gear-row"><span class="glabel">' + atkTitle + '</span>' +
      '<select onchange="createSetAttack(' + i + ', this.value)">' + atkOpts + "</select></div>";

    // ---- Donanım: zırh seçimi ----
    if (ARMOR_OPTIONS[h.cls].length > 1) {
      let arOpts = "";
      for (const id of ARMOR_OPTIONS[h.cls]) {
        const a = ARMORS[id];
        let d = a.name;
        if (a.dodge) d += " (kaçınma " + (a.dodge > 0 ? "+" : "") + a.dodge + ")";
        if (a.dr) d += " (hasar -%" + Math.round(a.dr * 100) + ")";
        arOpts += '<option value="' + id + '"' + (h.armor === id ? " selected" : "") + ">" + d + "</option>";
      }
      gear += '<div class="gear-row"><span class="glabel">Zırh</span>' +
        '<select onchange="createSetArmor(' + i + ', this.value)">' + arOpts + "</select></div>";
    }

    // ---- Donanım: kalkan ----
    if (h.cls !== "Wizard") {
      const canS = canUseShield(h);
      gear += '<label class="shieldlbl' + (canS ? "" : " off") + '">' +
        '<input type="checkbox" ' + (h.shield && canS ? "checked" : "") + " " + (canS ? "" : "disabled") +
        ' onchange="createToggleShield(' + i + ', this.checked)"> Kalkan (+2 kaçınma)' +
        (canS ? "" : ' <span class="muted">— çift elli silahla takılmaz</span>') + "</label>";
    }

    // ---- Büyüler / yetenekler özeti ----
    if (SPELL_OPTIONS[h.cls]) {
      const opt = SPELL_OPTIONS[h.cls];
      gear += '<div class="weap">✦ ' + opt.cantrips.length + ' cantrip + ' + opt.leveled.length +
        ' seviyeli büyü biliyor <span class="muted">(savaşta Büyü butonu · ' + opt.slots + ' slot)</span></div>';
    }
    if (h.cls === "Fighter") {
      gear += '<div class="weap">💪 Second Wind · d10+level (savaş başına 2×)</div>';
    }

    html +=
      '<div class="hero-card">' +
        '<div class="hero-top">' +
          '<canvas class="mini" id="mini' + i + '" width="60" height="60"></canvas>' +
          '<div class="hero-name">' +
            '<input value="' + escapeAttr(h.name) + '" oninput="createName(' + i + ', this.value)" maxlength="14">' +
            '<div class="hero-hp">Can: <b>' + hp + "</b> (" + def.hpDie + "+Might)</div>" +
          "</div>" +
        "</div>" +
        '<div class="class-row">' + classBtns + "</div>" +
        '<div class="pts' + (rem === 0 ? " done" : "") + '">Kalan puan: <b>' + rem + "</b> / " + CREATE_POINTS + "</div>" +
        statRows +
        '<div class="gear">' + gear + "</div>" +
      "</div>";
  });
  wrap.innerHTML = html;

  // mini sprite'ları çiz
  CREATE.heroes.forEach((h, i) => {
    const cv = document.getElementById("mini" + i);
    const mctx = cv.getContext("2d");
    mctx.imageSmoothingEnabled = false;
    mctx.clearRect(0, 0, 60, 60);
    drawSpriteGrid(mctx, Sprites[CLASS_DEFS[h.cls].sprite], 30, 34, 3);
  });

  updateStart();
}

function escapeAttr(s) { return String(s).replace(/"/g, "&quot;"); }

function createSetClass(i, cls) {
  const h = CREATE.heroes[i];
  h.cls = cls;
  const g = CLASS_DEFAULT_GEAR[cls];
  h.atk = g.atk; h.armor = g.armor; h.shield = g.shield;
  createRender();
}
function createSetAttack(i, id) {
  const h = CREATE.heroes[i];
  h.atk = id;
  if (!canUseShield(h)) h.shield = false; // çift elli silah → kalkan düşer
  createRender();
}
function createSetArmor(i, id) {
  CREATE.heroes[i].armor = id;
  createRender();
}
function createToggleShield(i, val) {
  CREATE.heroes[i].shield = val;
  createRender();
}
function createStat(i, k, delta) {
  const h = CREATE.heroes[i];
  const v = h.stats[k] || 0;
  if (delta > 0 && (v >= STAT_CAP || remaining(h) <= 0)) return;
  if (delta < 0 && v <= 0) return;
  h.stats[k] = v + delta;
  createRender();
}
function createName(i, val) {
  CREATE.heroes[i].name = val;
  updateStart();
}

function allValid() {
  return CREATE.heroes.every(h => remaining(h) === 0 && (h.name || "").trim().length > 0);
}
function updateStart() {
  const btn = document.getElementById("btnStart");
  const warn = document.getElementById("create-warn");
  const ok = allValid();
  btn.disabled = !ok;
  if (ok) { warn.textContent = "Ekip hazır!"; }
  else { warn.textContent = "Her kahramanın 7 puanı dağıtılmalı ve ismi olmalı."; }
}

function createStart() {
  if (!allValid()) return;
  CUSTOM_PARTY = buildParty(CREATE.heroes.map(h => ({
    name: h.name, cls: h.cls, stats: { ...h.stats },
    atk: h.atk, armor: h.armor, shield: h.shield
  })));
  document.getElementById("screen-create").style.display = "none";
  document.getElementById("app").style.display = "flex";
  startGame();
}

function backToCreate() {
  document.getElementById("app").style.display = "none";
  document.getElementById("screen-create").style.display = "flex";
  createRender();
}
