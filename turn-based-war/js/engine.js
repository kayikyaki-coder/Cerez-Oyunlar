// engine.js — oyun durumu, zar, initiative, hareket, saldırı, büyü, tur akışı
// Veri güdümlü savaş: setupBattle(cfg) bir CAMPAIGN düğümünden (map/enemies/objective/reinforcements)
// veya cfg verilmezse eski prototip verisinden (data.js) kurulum yapar.

const State = {
  cols: 0, rows: 0, size: 0, margin: 0, originX: 0, originY: 0, width: 0, height: 0,
  blocked: new Set(),     // geçilmez hex'ler (water/wall) — hızlı bakım için
  terrain: new Map(),     // key(q,r) -> terrainId
  biome: "forest",
  units: [],
  order: [],
  turnPtr: 0,
  round: 1,
  phase: "setup",     // setup | playerInput | enemy | over
  mode: "idle",       // idle | move | attack | heal | spell | ability | item
  reachable: new Map(),
  targets: [],
  winner: null,
  log: [],
  objective: { type: "kill" },
  reinforcements: [],
  battleId: 0,            // P0-1: her setupBattle()'da artar; eski savaşın gecikmeli callback'leri bunu kontrol edip sessizce çıkar
  fx: [],              // {type,from,to,color,start,dur}
  floatTexts: [],       // {text,x,y,color,start,dur}
  animSpeed: 1,         // 1 | 2 | 3(anında) — ayarlar ekranından
  turnCount: 0,          // istatistik: toplam tur (rapor için)
  deathCount: 0,
  dmgDealt: 0, dmgTaken: 0, critCount: 0   // sonuç ekranı .battle-stats için
};

// ---------- ZAR ----------
function d(n) { return 1 + Math.floor(Math.random() * n); }
function d20() { return d(20); }

function parseDmg(str) { // "2d6" -> {num:2, sides:6}
  const m = str.split("d");
  return { num: parseInt(m[0], 10), sides: parseInt(m[1], 10) };
}
function rollDmg(str, crit) {
  const p = parseDmg(str);
  const times = crit ? p.num * 2 : p.num;
  let total = 0;
  for (let i = 0; i < times; i++) total += d(p.sides);
  return total;
}

// Save DC = 8 + ilgili skill + max(1, floor(level/3))
function saveDC(caster, skillKey) {
  const lvl = caster.level || 1;
  return 8 + (caster.stats[skillKey] || 0) + Math.max(1, Math.floor(lvl / 3));
}

// ---------- LOG ----------
function log(text, cls) {
  State.log.push({ text, cls: cls || "" });
  if (State.log.length > 80) State.log.shift();
}

// ---------- ARAZİ ----------
// hazard: tur sonunda 1d4 hasar · shrine: tur sonunda ekip 1d4 iyileşir
const TERRAIN_DEFS = {
  ground: { name: "Zemin", passable: true, cost: 1 },
  road:   { name: "Yol", passable: true, cost: 1 },
  forest: { name: "Orman", passable: true, cost: 2, rangedDodge: 2 },
  rough:  { name: "Zorlu Arazi", passable: true, cost: 2 },
  water:  { name: "Su", passable: false },
  wall:   { name: "Duvar", passable: false },
  bridge: { name: "Köprü", passable: true, cost: 1 },
  hazard: { name: "Tehlike", passable: true, cost: 1, hazard: true },
  shrine: { name: "Kutsal Alan", passable: true, cost: 1, shrine: true }
};
const TERRAIN_CHARS = { ".": "ground", ",": "road", "T": "forest", "%": "rough", "~": "water", "#": "wall", "=": "bridge", "^": "hazard", "+": "shrine", "P": "ground" };

function terrainAt(q, r) {
  const t = State.terrain.get(key(q, r));
  return TERRAIN_DEFS[t || "ground"] || TERRAIN_DEFS.ground;
}
function terrainIdAt(q, r) { return State.terrain.get(key(q, r)) || "ground"; }

// map satırlarını ayrıştırır: terrain Map + P konumları
function parseMap(mapLines) {
  const rows = mapLines.length;
  const cols = Math.max(...mapLines.map(l => l.length));
  const terrain = new Map();
  const spawns = [];
  for (let r = 0; r < rows; r++) {
    const line = mapLines[r];
    for (let q = 0; q < cols; q++) {
      const ch = line[q] || ".";
      const id = TERRAIN_CHARS[ch] || "ground";
      terrain.set(key(q, r), id);
      if (ch === "P") spawns.push({ q, r });
    }
  }
  return { cols, rows, terrain, spawns };
}

// ---------- KURULUM ----------
// cfg: { map:[..lines], enemies:[{type,q,r,name}], objective, reinforcements, biome, party:[unit,...] } (opsiyonel)
function setupBattle(cfg) {
  cfg = cfg || null;
  State.battleId = (State.battleId || 0) + 1; // P0-1: eski savaşın zamanlanmış callback'lerini geçersiz kıl

  if (cfg && cfg.map) {
    const parsed = parseMap(cfg.map);
    State.cols = parsed.cols;
    State.rows = parsed.rows;
    State.terrain = parsed.terrain;
    State.size = Math.max(14, Math.min(24, Math.floor(380 / Math.max(parsed.cols, 10))));
    State.margin = 10;
    State.biome = cfg.biome || "forest";

    const partyUnits = cfg.party && cfg.party.length ? cfg.party : buildParty(defaultHeroes());
    partyUnits.forEach((u, i) => {
      const sp = parsed.spawns[i] || parsed.spawns[0] || { q: 1, r: 1 };
      u.q = sp.q; u.r = sp.r;
    });

    const enemyDefs = getEnemyDefs();
    const enemyUnits = (cfg.enemies || []).map((e, i) => {
      const def = enemyDefs[e.type] || enemyDefs.wolf || Object.values(enemyDefs)[0];
      return makeEnemyUnit(def, e, i);
    });

    State.objective = cfg.objective || { type: "kill" };
    State.reinforcements = (cfg.reinforcements || []).map(r => ({ round: r.round, enemies: r.enemies, fired: false }));
    State.units = partyUnits.concat(enemyUnits);
    State.blocked = new Set(); // artık geçilmezlik terrain'den geliyor
    State.battleTitle = cfg.title || "Savaş";
  } else {
    // ---- Eski prototip fallback (test/geliştirme kolaylığı) ----
    State.cols = CONFIG.cols;
    State.rows = CONFIG.rows;
    State.size = CONFIG.size;
    State.margin = CONFIG.margin;
    State.biome = "forest";
    State.terrain = new Map();
    State.blocked = new Set(BLOCKED.map(([q, r]) => key(q, r)));
    State.objective = { type: "kill" };
    State.reinforcements = [];
    State.units = makeUnits().map(u => (u.side === "wolf" ? Object.assign(u, { side: "enemy" }) : u));
    State.battleTitle = "Savaş (test arenası)";
  }

  State.originX = State.margin + State.size;
  State.originY = State.margin + State.size;
  // Genişlik: tek (odd-r) satırlar +0.5 hex sağa kayar, bu yüzden en sağdaki hex'in sağ kenarı
  // origin + size*SQRT3*cols noktasına kadar uzanır (sadece merkezine göre hesaplarsak son hex kırpılır).
  State.width = Math.ceil(State.originX + State.size * SQRT3 * State.cols + State.margin);
  State.height = Math.ceil(State.originY + State.size * 1.5 * (State.rows - 1) + State.size + State.margin);

  State.units = State.units.map(u => Object.assign({
    hp: u.hpMax, ap: 4, hasAttacked: false, movesUsed: 0, hasHealed: false,
    timesAttacked: 0, dead: false, init: 0, level: u.level || 1,
    slots: (u.slots != null ? u.slots : u.slotsMax) || 0, secondWind: u.secondWindMax || 0, statuses: [],
    abilitiesUsed: {}
  }, u, { hp: (u.hp != null ? Math.min(u.hp, u.hpMax) : u.hpMax), dead: false, ap: 4, statuses: [], timesAttacked: 0 }));

  State.round = 1;
  State.mode = "idle";
  State.reachable = new Map();
  State.targets = [];
  State.winner = null;
  State.log = [];
  State.fx = [];
  State.floatTexts = [];
  State.turnCount = 0;
  State._hintFlags = {};
  State.inspectUnit = null;
  State.shakeUntil = 0;
  State._resultShown = false;
  State.dmgDealt = 0; State.dmgTaken = 0; State.critCount = 0; State.dmgByHero = {};

  rollInitiative();
  State.turnPtr = 0;
  State.phase = "setup";
  startTurn(State.order[0]);
}

// Savaş sırasında (reinforcements/summon) sahaya SONRADAN giren bir düşmanı tam donanımlı
// (setupBattle'daki units.map ile aynı alan kümesi) canlı bir birime çevirir. P2-2 düzeltmesi:
// tek fabrika fonksiyonu kullanılır ki abilitiesUsed vb. alanlar hiçbir yerde unutulmasın.
function instantiateLiveEnemy(def, placement, idx) {
  const unit = makeEnemyUnit(def, placement, idx);
  return Object.assign({
    hp: unit.hpMax, ap: 4, hasAttacked: false, movesUsed: 0, hasHealed: false,
    timesAttacked: 0, dead: false, init: d20() + unit.stats.agility, level: unit.level,
    slots: unit.slotsMax || 0, secondWind: 0, statuses: [], abilitiesUsed: {}
  }, unit);
}

// ENEMY_DEFS girdisinden savaş birimi üretir
// TÜM zorluk (GameState.difficulty) ve Yeni Oyun+ (GameState.ngPlus) düşman-ölçekleme
// mantığı KASITLI olarak sadece burada uygulanır — başka hiçbir yerde tekrarlanmaz.
function makeEnemyUnit(def, placement, idx) {
  const ngPlus = (typeof GameState !== "undefined" && GameState && GameState.ngPlus);
  const diff = (typeof getDifficultyDef === "function") ? getDifficultyDef()
    : { enemyHpMult: 1, enemyHitBonus: 0, enemyDmgBonus: 0 };
  // Yeni Oyun+ (×1.25) ve zorluk HP çarpanı çarpımsal olarak birleşir.
  const hpMult = (ngPlus ? 1.25 : 1) * (diff.enemyHpMult != null ? diff.enemyHpMult : 1);
  const hpMax = Math.round(def.hpMax * hpMult);
  return {
    id: "e" + idx + "_" + (placement.type || def.name), name: placement.name || def.name,
    side: "enemy", cls: def.cls, sprite: def.sprite, level: def.level || 1,
    q: placement.q, r: placement.r, hpMax, speed: def.speed,
    stats: Object.assign({ might: 0, agility: 0, will: 0, mind: 0, influence: 0 }, def.stats),
    attack: Object.assign({}, def.attack),
    dodgeBonus: def.dodgeBonus || 0, dr: def.dr || 0,
    ai: def.ai || "melee", spells: (def.spells || []).slice(), slotsMax: def.slotsMax || 0,
    abilities: (def.abilities || []).slice(), xp: def.xp || 0, defId: placement.type,
    // Zorluk seviyesinin isabet/hasar bonusları; performHit/doAttack/doSpell* bunları
    // sadece side==="enemy" olduğunda ekler (bkz. o fonksiyonlar).
    diffHitBonus: diff.enemyHitBonus || 0, diffDmgBonus: diff.enemyDmgBonus || 0
  };
}

// ---------- INITIATIVE (d20 + agility; eşitlikte agility'siz d20, bozulana kadar) ----------
// Log kompakt tutulur: tek başlık satırı + tek özet satırı.
function rollInitiative() {
  for (const u of State.units) u.init = d20() + u.stats.agility;

  let arr = State.units.slice().sort((a, b) => b.init - a.init);

  const result = [];
  let i = 0;
  while (i < arr.length) {
    let j = i;
    while (j < arr.length && arr[j].init === arr[i].init) j++;
    if (j - i === 1) {
      result.push(arr[i]);
    } else {
      result.push(...breakTies(arr.slice(i, j)));
    }
    i = j;
  }

  State.order = result;
  log("— Savaş başladı: " + (State.battleTitle || "Savaş") + " —", "sys");
  log("Sıra: " + State.order.map(u => u.name + "(" + u.init + ")").join(" → "), "sys");
}

function breakTies(group) {
  if (group.length === 1) return group;
  const rolled = group.map(u => ({ u, r: d20() }));
  rolled.sort((a, b) => b.r - a.r);
  const out = [];
  let i = 0;
  while (i < rolled.length) {
    let j = i;
    while (j < rolled.length && rolled[j].r === rolled[i].r) j++;
    if (j - i === 1) out.push(rolled[i].u);
    else out.push(...breakTies(rolled.slice(i, j).map(x => x.u)));
    i = j;
  }
  return out;
}

// ---------- IZGARA / HAREKET ----------
function unitAt(q, r) {
  for (const u of State.units) if (!u.dead && u.q === q && u.r === r) return u;
  return null;
}

function passable(q, r, ignore, unit) {
  if (q < 0 || r < 0 || q >= State.cols || r >= State.rows) return false;
  if (State.blocked.has(key(q, r))) return false;
  const t = terrainAt(q, r);
  if (!t.passable && !(unit && hasAbility(unit, "fly"))) return false;
  const occ = unitAt(q, r);
  if (occ && occ !== ignore) return false;
  return true;
}
function moveCost(q, r, unit) {
  if (unit && hasAbility(unit, "fly")) return 1;
  return terrainAt(q, r).cost || 1;
}

// Dijkstra mesafe/maliyet haritası (start dahil, maliyet 0). maxCost'a kadar genişler.
function bfsDist(sq, sr, ignore, maxCost, unit) {
  const dist = new Map();
  const startKey = key(sq, sr);
  dist.set(startKey, 0);
  const frontier = [[sq, sr, 0]];
  // basit öncelik kuyruğu (küçük haritalar için yeterli)
  while (frontier.length) {
    frontier.sort((a, b) => a[2] - b[2]);
    const [cq, cr, cd] = frontier.shift();
    if (cd > (dist.get(key(cq, cr)) ?? 1e9)) continue;
    for (const [nq, nr] of neighbors(cq, cr)) {
      const k = key(nq, nr);
      if (!passable(nq, nr, ignore, unit)) continue;
      const nd = cd + moveCost(nq, nr, unit);
      if (nd > maxCost) continue;
      if (!dist.has(k) || nd < dist.get(k)) {
        dist.set(k, nd);
        frontier.push([nq, nr, nd]);
      }
    }
  }
  return dist;
}

function moveAllowance(u) {
  if (u.movesUsed === 0) return u.speed + statusSpeed(u);
  return Math.floor(u.speed / 2);
}

function canMove(u) {
  return u.movesUsed < 2;
}

function cur() { return State.order[State.turnPtr]; }

// ---------- OYUNCU MODLARI ----------
function enterMove() {
  const u = cur();
  if (State.phase !== "playerInput" || u.ap < 1 || !canMove(u)) return;
  const allow = moveAllowance(u);
  const dist = bfsDist(u.q, u.r, u, allow, u);
  State.reachable = new Map();
  for (const [k, dd] of dist) if (dd >= 1 && dd <= allow) State.reachable.set(k, dd);
  State.targets = [];
  State.mode = "move";
  refresh();
}

function enterAttack() {
  const u = cur();
  if (State.phase !== "playerInput" || u.ap < 2 || u.hasAttacked) return;
  State.targets = State.units.filter(t => !t.dead && t.side !== u.side && hexDist(u, t) <= u.attack.range);
  State.reachable = new Map();
  State.mode = "attack";
  if (State.targets.length === 0) log("Menzilde hedef yok.", "miss");
  refresh();
}

function enterHeal() {
  const u = cur();
  if (State.phase !== "playerInput" || !u.canHeal || u.ap < 1 || u.hasHealed) return;
  State.targets = State.units.filter(t => !t.dead && t.side === u.side && hexDist(u, t) <= u.heal.range);
  State.reachable = new Map();
  State.mode = "heal";
  refresh();
}

function enterSpell(spellId) {
  const u = cur();
  if (State.phase !== "playerInput") return;
  const sp = SPELLBOOK[spellId];
  if (!sp || !canCast(u, sp)) return;
  State.pendingSpell = sp;
  if (sp.target === "self") {
    castSpell(u, sp, u);
    clearMode();
    refresh();
    return;
  }
  const wantEnemy = sp.target === "enemy";
  State.targets = State.units.filter(t =>
    !t.dead &&
    (wantEnemy ? t.side !== u.side : t.side === u.side) &&
    hexDist(u, t) <= sp.range);
  State.reachable = new Map();
  State.mode = "spell";
  if (State.targets.length === 0) log(sp.name + ": menzilde hedef yok.", "miss");
  refresh();
}

// Eşya kullanım modu: consumable heal/buff -> dost hedef, damage -> düşman hedef
function enterItem(itemId) {
  const u = cur();
  if (State.phase !== "playerInput" || u.ap < 1) return;
  const defs = getItemDefs();
  const it = defs[itemId];
  if (!it || it.type !== "consumable") return;
  State.pendingItem = itemId;
  const wantEnemy = !!(it.effect && it.effect.damage);
  const range = (it.effect && it.effect.damage) ? (it.effect.damage.range || 1) : 1;
  State.targets = State.units.filter(t => !t.dead && (wantEnemy ? t.side !== u.side : t.side === u.side) && hexDist(u, t) <= range);
  State.reachable = new Map();
  State.mode = "item";
  if (!State.targets.length) log(it.name + ": menzilde hedef yok.", "miss");
  refresh();
}

function clearMode() { State.mode = "idle"; State.reachable = new Map(); State.targets = []; State.pendingSpell = null; State.pendingItem = null; State.pendingAbility = null; }

// ---------- TIKLAMA ----------
function handleHexClick(q, r) {
  if (State.phase !== "playerInput") return;
  const u = cur();
  const k = key(q, r);

  if (State.mode === "move" && State.reachable.has(k)) {
    addFx({ type: "move", from: { x: u.q, y: u.r }, to: { x: q, y: r } });
    u.q = q; u.r = r; u.movesUsed++; u.ap -= 1;
    playSfx("move");
    log(u.name + " hareket etti.", "");
    clearMode();
    refresh();
    if (typeof maybeHint === "function") maybeHint("firstMove");
    return;
  }
  if (State.mode === "attack") {
    const t = State.targets.find(x => x.q === q && x.r === r);
    if (t) { doAttack(u, t); u.ap -= 2; u.hasAttacked = true; applyFighterExtraAttackCheck(u); clearMode(); checkEnd(); refresh(); if (typeof maybeHint === "function") maybeHint("firstAttack"); }
    return;
  }
  if (State.mode === "heal") {
    const t = State.targets.find(x => x.q === q && x.r === r);
    if (t) { doHeal(u, t); u.ap -= 1; clearMode(); refresh(); }
    return;
  }
  if (State.mode === "spell") {
    const t = State.targets.find(x => x.q === q && x.r === r);
    if (t && State.pendingSpell) { castSpell(u, State.pendingSpell, t); clearMode(); refresh(); if (typeof maybeHint === "function") maybeHint("firstSpell"); }
    return;
  }
  if (State.mode === "item") {
    const t = State.targets.find(x => x.q === q && x.r === r);
    if (t && State.pendingItem) { useItemOn(u, State.pendingItem, t); clearMode(); checkEnd(); refresh(); }
    return;
  }
  if (State.mode === "ability") {
    const t = State.targets.find(x => x.q === q && x.r === r);
    if (State.pendingAbility) { resolveAbility(u, State.pendingAbility, t); clearMode(); checkEnd(); refresh(); }
    return;
  }
}

// Fighter extraAttack: turda 2 saldırı hakkı varsa hasAttacked'i tekrar açabilir (main.js UI bunu kullanır)
function applyFighterExtraAttackCheck(u) {
  if (hasFeature(u, "extraAttack") && !u._extraUsed) { u._extraUsed = true; u.hasAttacked = false; }
}
function hasFeature(u, id) { return !!(u.features && u.features.indexOf(id) >= 0); }
function hasAbility(u, id) {
  if (!u.abilities) return false;
  return u.abilities.some(a => a === id || (typeof a === "string" && a.indexOf(id + ":") === 0));
}

// ---------- SALDIRI ----------
function attackStat(attacker) {
  const a = attacker.attack;
  const bonus = a.bonus || 0;
  let extra = attacker._frenzy ? 2 : 0;
  if (a.finesse) return Math.max(attacker.stats.might || 0, attacker.stats.agility || 0) + bonus + extra;
  return (attacker.stats[a.stat] || 0) + bonus + extra;
}
function spellStatKey(u) { return u.cls === "Wizard" ? "mind" : "will"; }
function spellStatVal(u) { return u.stats[spellStatKey(u)] || 0; }

// ---------- DURUM ETKİLERİ (status) ----------
function applyStatus(u, st) {
  if (!u.statuses) u.statuses = [];
  u.statuses.push(Object.assign({}, st));
}
function hasStatus(u, flag) { return !!(u.statuses && u.statuses.some(s => s[flag])); }
function removeStatus(u, flag) { if (u.statuses) u.statuses = u.statuses.filter(s => !s[flag]); }
function onDamaged(u) { if (hasStatus(u, "incapacitated")) { removeStatus(u, "incapacitated"); log(u.name + " uyandı!", "sys"); } }
function pushUnit(fromU, target, n) {
  for (let i = 0; i < n; i++) {
    let best = null, bd = hexDist(target, fromU);
    for (const [nq, nr] of neighbors(target.q, target.r)) {
      if (!passable(nq, nr, target)) continue;
      const dd = hexDist({ q: nq, r: nr }, fromU);
      if (dd > bd) { bd = dd; best = { q: nq, r: nr }; }
    }
    if (!best) break;
    target.q = best.q; target.r = best.r;
  }
}
// Ormandaki birime menzilli saldırılara karşı +2 kaçınma
function terrainDodgeBonus(defender, ranged) {
  if (!ranged) return 0;
  const t = terrainAt(defender.q, defender.r);
  return t.rangedDodge || 0;
}
function effDodge(u, attackerRanged) {
  let dd = u.dodgeBonus || 0;
  if (u.statuses) for (const s of u.statuses) dd += (s.dodge || 0);
  dd += terrainDodgeBonus(u, attackerRanged);
  return dd;
}
function statusSpeed(u) {
  let b = 0;
  if (u.statuses) for (const s of u.statuses) b += (s.speedBonus || 0);
  return b;
}
function statusAtkBonus(u) {
  let b = 0;
  if (!u.statuses) return 0;
  for (const s of u.statuses) if (s.atkDie) { b += d(s.atkDie); s._spent = true; }
  u.statuses = u.statuses.filter(s => !(s.atkDie && s.oneRoll && s._spent));
  return b;
}
function statusPenalty(u) {
  let p = 0;
  if (!u.statuses) return 0;
  for (const s of u.statuses) if (s.penaltyDie) { p += d(s.penaltyDie); s._spent = true; }
  u.statuses = u.statuses.filter(s => !(s.penaltyDie && s.oneRoll && s._spent));
  return p;
}
function consumeAdvantage(defender) {
  if (!defender.statuses) return false;
  const i = defender.statuses.findIndex(s => s.incomingAdvantage);
  if (i < 0) return false;
  if (defender.statuses[i].oneHit) defender.statuses.splice(i, 1);
  return true;
}
function consumeResistance(defender) {
  if (!defender.statuses) return 0;
  const i = defender.statuses.findIndex(s => s.reduceDie);
  if (i < 0) return 0;
  const amt = d(defender.statuses[i].reduceDie);
  if (defender.statuses[i].oneHit) defender.statuses.splice(i, 1);
  return amt;
}
function tickStatuses(u) {
  if (!u.statuses) return;
  for (const s of u.statuses) if (s.turns != null) s.turns--;
  u.statuses = u.statuses.filter(s => s.turns == null || s.turns > 0);
}
function statusDesc(st) {
  if (st.incapacitated) return "uyuyor (tur atlar)";
  if (st.cantAttack) return "büyülenmiş (saldıramaz)";
  if (st.prone) return "yerde (kaçınma " + st.dodge + ")";
  if (st.rooted) return "ağa yakalandı (hız 0)";
  if (st.poison) return "zehirli";
  if (st.dodge) return "kaçınma " + (st.dodge > 0 ? "+" : "") + st.dodge + " (" + st.turns + " tur)";
  if (st.atkDie) return "saldırı +d" + st.atkDie;
  if (st.penaltyDie) return "zarlara -d" + st.penaltyDie + " (" + st.turns + " tur)";
  if (st.speedBonus) return "hız " + (st.speedBonus > 0 ? "+" : "") + st.speedBonus;
  if (st.reduceDie) return "sonraki hasar -d" + st.reduceDie;
  return st.name;
}

function applyDamageMods(defender, dmg, element) {
  const red = consumeResistance(defender);
  if (red) dmg = Math.max(0, dmg - red);
  if (defender.dr && dmg > 0) dmg = Math.max(1, Math.round(dmg * (1 - defender.dr)));
  if (element && (element === "radyant" || element === "kutsal") && hasAbility(defender, "undead")) dmg = Math.round(dmg * 1.5);
  return Math.max(0, dmg);
}
function killCheck(u) {
  if (u.hp <= 0 && !u.dead) {
    u.hp = 0; u.dead = true; State.deathCount++;
    log(u.name + " öldü!", "sys");
    playSfx("death");
    addFx({ type: "explosion", from: { q: u.q, r: u.r }, to: { q: u.q, r: u.r }, color: "#7a7a82", dur: 260 }); // toz/parçacık
    if (hasAbility(u, "explode")) explodeOnDeath(u);
    if (u.side !== "party" && typeof maybeHint === "function") maybeHint("firstKill");
  }
}
function explodeOnDeath(u) {
  const near = State.units.filter(t => !t.dead && t !== u && hexDist(t, u) <= 1);
  for (const t of near) {
    const dmg = applyDamageMods(t, rollDmg("1d6", false), "ateş");
    t.hp -= dmg; onDamaged(t);
    log(u.name + " patladı → " + t.name + " -" + dmg + " ateş", "dmg");
    killCheck(t);
  }
}

// phase yeteneği: %25 ilk saldırıyı boşa çıkarır (savaş başına bir kez tetiklenir gibi basitleştirildi: her tur ilk saldırıya karşı şans)
function tryPhaseDodge(defender) {
  if (!hasAbility(defender, "phase")) return false;
  if (defender._phaseUsedRound === State.round) return false;
  defender._phaseUsedRound = State.round;
  if (Math.random() < 0.25) { log(defender.name + " Faz Kayması ile saldırıyı boşa çıkardı!", "miss"); return true; }
  return false;
}

// packTactics: hedefe bitişik başka bir müttefik varsa saldırganın isabetine +2
function packTacticsBonus(attacker, defender) {
  if (!hasAbility(attacker, "packTactics")) return 0;
  const ally = State.units.some(u => !u.dead && u !== attacker && u.side === attacker.side && hexDist(u, defender) === 1);
  return ally ? 2 : 0;
}
// shieldWall: bitişik müttefiklere +1 dodge (pasif aura)
function shieldWallBonus(defender) {
  let b = 0;
  for (const u of State.units) if (!u.dead && u !== defender && u.side === defender.side && hasAbility(u, "shieldWall") && hexDist(u, defender) === 1) b += 1;
  return b;
}

// Zorluk seviyesinin düşman isabet/hasar bonusu — sadece "enemy" tarafına uygulanır (makeEnemyUnit'te atanır).
function diffHitBonus(u) { return (u && u.side === "enemy") ? (u.diffHitBonus || 0) : 0; }
function diffDmgBonus(u) { return (u && u.side === "enemy") ? (u.diffDmgBonus || 0) : 0; }
function performHit(attacker, defender, toHit, opts) {
  opts = opts || {};
  if (tryPhaseDodge(defender)) return { hit: false, crit: false, atkTotal: 0, defTotal: 0, disTag: "", phased: true };
  let natk = d20();
  if (consumeAdvantage(defender)) natk = Math.max(natk, d20());
  const bonus = toHit + statusAtkBonus(attacker) - statusPenalty(attacker) + packTacticsBonus(attacker, defender) + diffHitBonus(attacker);
  const atkTotal = natk + bonus;

  const nDice = defender.timesAttacked + 1;
  let low = 99;
  for (let i = 0; i < nDice; i++) low = Math.min(low, d20());
  const defTotal = low + defender.stats.agility + effDodge(defender, !!opts.ranged) + shieldWallBonus(defender);
  defender.timesAttacked++;

  const crit = (natk === 20), autoMiss = (natk === 1);
  const hit = !autoMiss && (crit || atkTotal >= defTotal);
  if (crit && hit) triggerCritShake();
  return { hit, crit, atkTotal, defTotal, disTag: nDice > 1 ? " [" + nDice + " zar dez.]" : "" };
}

function doAttack(attacker, defender) {
  flashAttack(attacker);
  const atkStat = attackStat(attacker);
  const ranged = !!attacker.attack.ranged;
  const r = performHit(attacker, defender, atkStat, { ranged });
  addFx({ type: ranged ? "arrow" : "slash", from: attacker, to: defender });
  if (!r.hit) {
    if (!r.phased) log(attacker.name + " → " + defender.name + ": ıska (" + r.atkTotal + " vs " + r.defTotal + ")" + r.disTag, "miss");
    playSfx("miss");
    addFloat(defender, "ıska", "#9aa1ad");
    return;
  }
  let dmg = rollDmg(attacker.attack.dmg, r.crit) + Math.max(0, atkStat) + diffDmgBonus(attacker);
  if (hasFeature(attacker, "divineStrike") && !attacker._divineUsed) { dmg += rollDmg("1d8", false); attacker._divineUsed = true; }
  dmg = applyDamageMods(defender, dmg);
  defender.hp -= dmg;
  onDamaged(defender);
  playSfx(r.crit ? "crit" : "hit");
  flashHurt(defender);
  recordDamage(attacker, dmg, r.crit);
  addFloat(defender, "-" + dmg, r.crit ? "#f5d23e" : "#d9534f");
  log(attacker.name + " → " + defender.name + ": " + (r.crit ? "" : r.atkTotal + " vs " + r.defTotal + " · ") + "-" + dmg + " HP" + (r.crit ? " KRİTİK!" : "") + r.disTag, "dmg");
  killCheck(defender);
  // Fighter cleave / kurt cleave ability: bitişik 2. bir düşmana yarı hasar
  if ((hasFeature(attacker, "cleave") || hasAbility(attacker, "cleave")) && !attacker._cleaveUsedTurn) {
    const other = State.units.find(t => !t.dead && t !== defender && t.side !== attacker.side && hexDist(t, defender) === 1 && hexDist(t, attacker) <= attacker.attack.range);
    if (other) {
      attacker._cleaveUsedTurn = true;
      const half = Math.max(1, Math.floor(dmg / 2));
      const half2 = applyDamageMods(other, half);
      other.hp -= half2; onDamaged(other);
      log(attacker.name + " (cleave) → " + other.name + ": -" + half2 + " HP", "dmg");
      addFloat(other, "-" + half2, "#d9534f");
      killCheck(other);
    }
  }
  // Zehir isabeti (kurt/örümcek türleri)
  if (hasAbility(attacker, "poison") && !defender.dead) {
    applyStatus(defender, { name: "Zehir", poison: true, turns: 2 });
    log(defender.name + " zehirlendi!", "dmg");
  }
}

// ---------- BÜYÜ ÇÖZÜMLERİ ----------
function doSpellAttack(caster, defender, sp) {
  flashAttack(caster);
  const r = performHit(caster, defender, spellStatVal(caster), { ranged: sp.range > 1 });
  addFx({ type: "bolt", from: caster, to: defender, color: elementColor(sp.element) });
  if (!r.hit) {
    if (!r.phased) log(caster.name + " → " + defender.name + ": " + sp.name + " ıskaladı (" + r.atkTotal + " vs " + r.defTotal + ")" + r.disTag, "miss");
    addFloat(defender, "ıska", "#9aa1ad");
    return;
  }
  let dmg = rollDmg(sp.dmg, r.crit) + diffDmgBonus(caster);
  if (hasFeature(caster, "empoweredEvocation")) dmg += Math.max(0, caster.stats.mind || 0);
  dmg = applyDamageMods(defender, dmg, sp.element);
  defender.hp -= dmg;
  onDamaged(defender);
  flashHurt(defender);
  recordDamage(caster, dmg, r.crit);
  addFloat(defender, "-" + dmg, "#c46be0");
  log(caster.name + " → " + defender.name + ": " + sp.name + " -" + dmg + " " + (sp.element || "") + (r.crit ? " KRİTİK!" : ""), "dmg");
  if (sp.rider === "advantage") applyStatus(defender, { name: "İşaretli", incomingAdvantage: true, oneHit: true, turns: 2 });
  killCheck(defender);
}
function doSpellSave(caster, defender, sp) {
  flashAttack(caster);
  const dc = saveDC(caster, spellStatKey(caster));
  const roll = d20() + (defender.stats[sp.saveStat] || 0) - statusPenalty(defender);
  const success = roll >= dc;
  let dmg = sp.dmg ? rollDmg(sp.dmg, false) + diffDmgBonus(caster) : 0;
  if (hasFeature(caster, "empoweredEvocation") && dmg) dmg += Math.max(0, caster.stats.mind || 0);
  if (success) dmg = sp.half ? Math.floor(dmg / 2) : 0;
  if (dmg > 0) { dmg = applyDamageMods(defender, dmg, sp.element); defender.hp -= dmg; onDamaged(defender); flashHurt(defender); recordDamage(caster, dmg, false); addFloat(defender, "-" + dmg, "#c46be0"); }
  addFx({ type: "magic", from: caster, to: defender, color: elementColor(sp.element) });
  log(caster.name + " → " + defender.name + ": " + sp.name + " save " + roll + " vs DC" + dc + " → " + (dmg > 0 ? "-" + dmg + " " + (sp.element || "") : "etkisiz"), "dmg");
  if (!success && sp.status) applyStatus(defender, sp.status);
  killCheck(defender);
}
function doSpellAuto(caster, defender, sp) {
  flashAttack(caster);
  let total = 0;
  for (let i = 0; i < sp.missiles.n; i++) total += d(sp.missiles.die);
  total += diffDmgBonus(caster);
  total = applyDamageMods(defender, total, sp.element);
  defender.hp -= total;
  onDamaged(defender);
  addFx({ type: "magic", from: caster, to: defender, color: elementColor(sp.element) });
  flashHurt(defender);
  recordDamage(caster, total, false);
  addFloat(defender, "-" + total, "#c46be0");
  log(caster.name + " → " + defender.name + ": " + sp.name + " -" + total + " " + (sp.element || "") + " (otomatik)", "dmg");
  killCheck(defender);
}
function doSpellArea(caster, center, sp) {
  flashAttack(caster);
  const rad = sp.area || 1;
  const affected = State.units.filter(t => !t.dead && t.side !== caster.side && hexDist(t, center) <= rad);
  if (!affected.length) { log(sp.name + ": alanda hedef yok.", "miss"); return; }
  addFx({ type: "explosion", from: center, to: center, color: elementColor(sp.element) });
  log(caster.name + " " + sp.name + " (alan · " + affected.length + " hedef)", "sys");
  const dmgRoll = sp.dmg ? rollDmg(sp.dmg, false) + diffDmgBonus(caster) : 0;
  const dc = saveDC(caster, spellStatKey(caster));
  for (const t of affected) {
    const roll = d20() + (t.stats[sp.saveStat] || 0) - statusPenalty(t);
    const saved = roll >= dc;
    if (sp.dmg) {
      let dmg = saved ? (sp.half ? Math.floor(dmgRoll / 2) : 0) : dmgRoll;
      if (dmg > 0) { dmg = applyDamageMods(t, dmg, sp.element); t.hp -= dmg; onDamaged(t); flashHurt(t); recordDamage(caster, dmg, false); addFloat(t, "-" + dmg, "#c46be0"); }
      log("  " + t.name + ": save " + roll + "/" + dc + " → " + (dmg > 0 ? "-" + dmg + " " + (sp.element || "") : "etkisiz"), dmg > 0 ? "dmg" : "miss");
    } else {
      log("  " + t.name + ": save " + roll + "/" + dc + " → " + (saved ? "dayandı" : "tuttu"), saved ? "miss" : "dmg");
    }
    if (!saved && sp.status) applyStatus(t, sp.status);
    if (!saved && sp.push) pushUnit(caster, t, sp.push);
    killCheck(t);
  }
}
function doSpellHeal(caster, target, sp) {
  let amt = rollDmg(sp.dmg, false);
  const before = target.hp;
  target.hp = Math.min(target.hpMax, target.hp + amt);
  addFx({ type: "heal", from: caster, to: target });
  addFloat(target, "+" + (target.hp - before), "#57c96a");
  log(caster.name + " → " + target.name + ": " + sp.name + " +" + (target.hp - before) + " HP", "heal");
}
function doSpellDebuff(caster, defender, sp) {
  const dc = saveDC(caster, spellStatKey(caster));
  // P1-2: doSpellSave/doSpellArea ile tutarlı olsun diye hedefin statusPenalty'si (Bane/Minor Curse) de düşer.
  const roll = d20() + (defender.stats[sp.saveStat] || 0) - statusPenalty(defender);
  if (roll >= dc) {
    log(caster.name + " → " + defender.name + ": " + sp.name + " save " + roll + " vs DC" + dc + " → dayandı", "miss");
    return;
  }
  applyStatus(defender, sp.status);
  log(caster.name + " → " + defender.name + ": " + sp.name + " tuttu · " + statusDesc(sp.status), "dmg");
}
function elementColor(el) {
  const map = { "ateş": "#e8642a", "soğuk": "#5aa9e6", "şimşek": "#f5d23e", "nekrotik": "#7a5aa8", "asit": "#7bc96a", "kutsal": "#f2e6b0", "radyant": "#f2e6b0", "ses": "#c9c9c9", "force": "#a0a8ff" };
  return map[el] || "#c46be0";
}

function usesAttackAction(sp) {
  return sp.resolve === "attack" || sp.resolve === "save" || sp.resolve === "auto" || sp.resolve === "debuff";
}
function canCast(u, sp) {
  if (!u.spells || u.spells.indexOf(spellIdOf(sp)) < 0) return false;
  if (u.ap < sp.ap) return false;
  if (sp.level >= 1 && (u.slots || 0) <= 0 && !u._spellSurge) return false;
  if (sp.level >= 1 && u.leveledCast && !u._spellSurge) return false;
  if (usesAttackAction(sp) && u.hasAttacked) return false;
  // P1-1: Büyülenmiş (Charm/cantAttack) birim saldırı büyüsü atamaz; buff/heal serbest kalır.
  if (usesAttackAction(sp) && hasStatus(u, "cantAttack")) return false;
  return true;
}
function spellIdOf(sp) {
  for (const id in SPELLBOOK) if (SPELLBOOK[id] === sp) return id;
  return null;
}
function castSpell(caster, sp, target) {
  caster.ap -= sp.ap;
  if (sp.level >= 1 && !caster._spellSurge) { caster.slots = Math.max(0, (caster.slots || 0) - 1); caster.leveledCast = true; }
  if (usesAttackAction(sp)) caster.hasAttacked = true;
  if (sp.area) doSpellArea(caster, target, sp);
  else if (sp.resolve === "attack") doSpellAttack(caster, target, sp);
  else if (sp.resolve === "save") doSpellSave(caster, target, sp);
  else if (sp.resolve === "auto") doSpellAuto(caster, target, sp);
  else if (sp.resolve === "heal") doSpellHeal(caster, target, sp);
  else if (sp.resolve === "debuff") doSpellDebuff(caster, target, sp);
  else if (sp.resolve === "buff") {
    applyStatus(target, sp.status);
    addFx({ type: "magic", from: caster, to: target, color: "#57c96a" });
    log(caster.name + " → " + target.name + ": " + sp.name + " · " + statusDesc(sp.status), "heal");
  }
  checkEnd();
}

// ---------- FIGHTER: SECOND WIND ----------
function doSecondWind(u) {
  const amt = d(10) + (u.level || 1);
  const before = u.hp;
  u.hp = Math.min(u.hpMax, u.hp + amt);
  u.secondWind -= 1;
  u.swUsed = true;
  u.ap -= 1;
  addFloat(u, "+" + (u.hp - before), "#57c96a");
  log(u.name + " Second Wind · +" + (u.hp - before) + " HP", "heal");
}

function doHeal(cleric, ally) {
  const amt = rollDmg(cleric.heal.dmg, false);
  const before = ally.hp;
  ally.hp = Math.min(ally.hpMax, ally.hp + amt);
  cleric.hasHealed = true;
  addFx({ type: "heal", from: cleric, to: ally });
  addFloat(ally, "+" + (ally.hp - before), "#57c96a");
  log(cleric.name + " → " + ally.name + " iyileştirdi +" + (ally.hp - before) + " HP", "heal");
}

// ---------- EŞYA KULLANIMI (savaş içi) ----------
function useItemOn(user, itemId, target) {
  const defs = getItemDefs();
  const it = defs[itemId];
  if (!it) return;
  user.ap -= (it.ap || 1);
  consumeInventoryItem(itemId);
  if (it.effect.heal) {
    const amt = rollDmg(it.effect.heal.replace(/\+(\d+)$/, ""), false) + (parseInt((it.effect.heal.match(/\+(\d+)$/) || [0, 0])[1], 10) || 0);
    const before = target.hp;
    target.hp = Math.min(target.hpMax, target.hp + amt);
    addFx({ type: "heal", from: user, to: target });
    addFloat(target, "+" + (target.hp - before), "#57c96a");
    log(user.name + " → " + target.name + ": " + it.name + " +" + (target.hp - before) + " HP", "heal");
  } else if (it.effect.restoreSlot) {
    target.slots = Math.min(target.slotsMax || 0, (target.slots || 0) + it.effect.restoreSlot);
    log(user.name + " → " + target.name + ": " + it.name + " · +" + it.effect.restoreSlot + " slot", "heal");
  } else if (it.effect.buff) {
    applyStatus(target, it.effect.buff);
    log(user.name + " → " + target.name + ": " + it.name + " · " + statusDesc(it.effect.buff), "heal");
  } else if (it.effect.damage) {
    const dmgDef = it.effect.damage;
    const area = dmgDef.area || 0;
    const affected = area > 0 ? State.units.filter(t => !t.dead && hexDist(t, target) <= area && t.side !== user.side) : [target];
    addFx({ type: "explosion", from: target, to: target, color: elementColor(dmgDef.element) });
    for (const t of affected) {
      const dmg = applyDamageMods(t, rollDmg(dmgDef.dmg, false), dmgDef.element);
      t.hp -= dmg; onDamaged(t);
      flashHurt(t);
      recordDamage(user, dmg, false);
      addFloat(t, "-" + dmg, "#e8642a");
      log(user.name + " → " + t.name + ": " + it.name + " -" + dmg + " " + (dmgDef.element || ""), "dmg");
      killCheck(t);
    }
  }
}

// ---------- CLASS FEATURE / YETENEK MENÜSÜ ----------
// Bir birimin savaşta kullanabileceği aktif yetenek listesi (id, ad, açıklama, hedef tipi)
function unitAbilities(u) {
  const out = [];
  if (u.secondWindMax) out.push({ id: "secondWind", name: "Second Wind", desc: "Kendini iyileştir", target: "none", ap: 1, uses: u.secondWind, ready: u.ap >= 1 && u.secondWind > 0 && u.hp < u.hpMax && !u.swUsed });
  if (hasFeature(u, "actionSurge") && !u._surgeUsed) out.push({ id: "actionSurge", name: "Action Surge", desc: "+2 AP (bu tur)", target: "none", ap: 0, ready: true });
  if (hasFeature(u, "indomitable") && !u._indomUsed) out.push({ id: "indomitable", name: "Indomitable", desc: "Başarısız save'i tekrar at (pasif — otomatik)", target: "none", ap: 0, ready: false, passive: true });
  if (hasFeature(u, "turnUndead") && !u._turnUndeadUsed) out.push({ id: "turnUndead", name: "Turn Undead", desc: "3 hex içi undead'ler will save yapar", target: "none", ap: 2, ready: u.ap >= 2 });
  if (hasFeature(u, "preserveLife") && !u._preserveUsed) out.push({ id: "preserveLife", name: "Preserve Life", desc: "3 hex içi müttefikler 2d6 iyileşir", target: "none", ap: 2, ready: u.ap >= 2 });
  if (hasFeature(u, "arcaneRecovery") && !u._arcaneUsed) out.push({ id: "arcaneRecovery", name: "Arcane Recovery", desc: "1 büyü slotu geri kazan", target: "none", ap: 1, ready: u.ap >= 1 && (u.slots || 0) < (u.slotsMax || 0) });
  if (hasFeature(u, "spellSurge") && !u._surgeSpellUsed) out.push({ id: "spellSurge", name: "Spell Surge", desc: "Bu tur seviyeli büyü sınırı yok +2 AP", target: "none", ap: 0, ready: true });
  if (hasAbility(u, "howl") && !u._howlUsed) out.push({ id: "howl", name: "Uluma", desc: "Tüm müttefiklere +1 isabet/+1 hız (2 tur)", target: "none", ap: 1, ready: u.ap >= 1 });
  return out;
}
function enterAbility(id) {
  const u = cur();
  const list = unitAbilities(u);
  const ab = list.find(a => a.id === id);
  if (!ab || !ab.ready) return;
  State.pendingAbility = id;
  if (ab.target === "none") { resolveAbility(u, id, null); clearMode(); refresh(); return; }
  State.mode = "ability";
  refresh();
}
function resolveAbility(u, id, target) {
  if (id === "secondWind") return doSecondWind(u);
  if (id === "actionSurge") { u.ap += 2; u._surgeUsed = true; u._extraAttacksAllowed = 2; log(u.name + " Action Surge! +2 AP", "heal"); return; }
  if (id === "turnUndead") {
    u.ap -= 2; u._turnUndeadUsed = true;
    const dc = saveDC(u, "will");
    const near = State.units.filter(t => !t.dead && t.side !== u.side && hasAbility(t, "undead") && hexDist(t, u) <= 3);
    for (const t of near) {
      const roll = d20() + (t.stats.will || 0);
      if (roll < dc) { applyStatus(t, { name: "Korku", cantAttack: true, fleeing: true, turns: 2 }); log(t.name + " Turn Undead'den korktu!", "dmg"); }
    }
    return;
  }
  if (id === "preserveLife") {
    u.ap -= 2; u._preserveUsed = true;
    const near = State.units.filter(t => !t.dead && t.side === u.side && hexDist(t, u) <= 3);
    for (const t of near) { const before = t.hp; t.hp = Math.min(t.hpMax, t.hp + rollDmg("2d6", false)); addFloat(t, "+" + (t.hp - before), "#57c96a"); }
    log(u.name + " Preserve Life · yakındaki müttefikler iyileşti", "heal");
    return;
  }
  if (id === "arcaneRecovery") { u.ap -= 1; u._arcaneUsed = true; u.slots = Math.min(u.slotsMax || 0, (u.slots || 0) + 1); log(u.name + " Arcane Recovery · +1 slot", "heal"); return; }
  if (id === "spellSurge") { u._spellSurge = true; u.ap += 2; u._surgeSpellUsed = true; log(u.name + " Spell Surge!", "heal"); return; }
  if (id === "howl") {
    u.ap -= 1; u._howlUsed = true;
    for (const t of State.units) if (!t.dead && t.side === u.side) applyStatus(t, { name: "Uluma", atkDie: 0, speedBonus: 1, turns: 2, howlHit: true });
    log(u.name + " uludu — sürü güçlendi!", "heal");
    return;
  }
}

// ---------- TUR AKIŞI ----------
function startTurn(u) {
  if (State.phase === "over") return; // P0-5 ek güvence: savaş bittiyse tur asla yeniden başlamaz
  State.turnCount++;
  if (typeof announceTurn === "function") announceTurn(u);
  u.ap = 4; u.hasAttacked = false; u.movesUsed = 0; u.hasHealed = false;
  u.leveledCast = false; u.swUsed = false; u._extraUsed = false; u._cleaveUsedTurn = false; u._spellSurge = false; u._divineUsed = false;
  tickStatuses(u);
  clearMode();

  // regenerate: ateş/radyant hasarı almadığı tur başında 3 HP
  if (hasAbility(u, "regenerate") && !u._tookFireThisRound && u.hp > 0 && u.hp < u.hpMax) {
    u.hp = Math.min(u.hpMax, u.hp + 3);
    log(u.name + " kendini yeniledi (+3 HP)", "heal");
  }
  u._tookFireThisRound = false;
  // enrage: HP %50 altına inince AP 5
  if (hasAbility(u, "enrage") && u.hp > 0 && u.hp <= u.hpMax / 2) u.ap = 5;
  // frenzy pasif hasar bonusu doAttack'te ele alınmaz; basitleştirme: burada işaretleriz
  u._frenzy = hasAbility(u, "frenzy") && u.hp <= u.hpMax / 2;

  if (hasStatus(u, "incapacitated") || hasStatus(u, "rooted") === "__never__") {
    log(u.name + " uyuyor — turunu kaçırıyor.", "sys");
    State.phase = u.side === "party" ? "playerInput" : "enemy";
    refresh();
    guardedTimeout(nextTurn, scaledDelay(700));
    return;
  }
  // Zehir tur başı hasarı
  if (hasStatus(u, "poison") && !u.dead) {
    const dmg = rollDmg("1d4", false);
    u.hp -= dmg; addFloat(u, "-" + dmg, "#7bc96a");
    log(u.name + " zehirden -" + dmg + " HP aldı.", "dmg");
    killCheck(u);
  }
  if (u.dead) { refresh(); guardedTimeout(nextTurn, scaledDelay(300)); return; }

  if (typeof maybeHint === "function") {
    if (State.units.some(x => x.side === "party" && !x.dead && x.hp / x.hpMax < 0.5)) maybeHint("lowHp");
  }

  if (u.side !== "party") {
    State.phase = "enemy";
    refresh();
    runEnemyTurn(u);
  } else {
    State.phase = "playerInput";
    State._ffActive = false; // oyuncu turu başlayınca hızlandırmayı sıfırla
    refresh();
    if (typeof maybeHint === "function") maybeHint("firstPlayerTurn");
  }
}

function endTurn() {
  if (State.phase === "over") return;
  nextTurn();
}

// tur bitince arazi etkisi (hazard/shrine) uygulanır, sonra sıradaki birime geçilir
function applyTerrainEndEffects(u) {
  if (!u || u.dead) return;
  const t = terrainAt(u.q, u.r);
  if (t.hazard) {
    const dmg = rollDmg("1d4", false);
    u.hp -= dmg; addFloat(u, "-" + dmg, "#e8642a");
    log(u.name + " tehlikeli zeminde -" + dmg + " HP aldı.", "dmg");
    u._tookFireThisRound = true;
    killCheck(u);
  } else if (t.shrine && u.side === "party") {
    const amt = rollDmg("1d4", false);
    const before = u.hp;
    u.hp = Math.min(u.hpMax, u.hp + amt);
    if (u.hp > before) { addFloat(u, "+" + (u.hp - before), "#57c96a"); log(u.name + " kutsal alanda +" + (u.hp - before) + " HP", "heal"); }
  }
}

function fireReinforcements() {
  for (const rf of State.reinforcements) {
    if (rf.fired || rf.round !== State.round) continue;
    rf.fired = true;
    const defs = getEnemyDefs();
    for (const e of rf.enemies) {
      const def = defs[e.type] || defs.wolf;
      let spot = { q: e.q, r: e.r };
      if (unitAt(spot.q, spot.r)) {
        // dolu ise en yakın boş hex
        const near = bfsDist(spot.q, spot.r, null, 6);
        let best = null, bd = 1e9;
        for (const [k, dd] of near) {
          const parts = k.split(","); const qq = parseInt(parts[0], 10), rr = parseInt(parts[1], 10);
          if (!unitAt(qq, rr) && dd < bd) { bd = dd; best = { q: qq, r: rr }; }
        }
        if (best) spot = best;
      }
      const full = instantiateLiveEnemy(def, { type: e.type, q: spot.q, r: spot.r, name: def.name }, State.units.length);
      State.units.push(full);
      // inisiyatif sırasında şu anki turdan hemen sonraya ekle
      State.order.splice(State.turnPtr + 1, 0, full);
      log(full.name + " takviye olarak sahaya girdi!", "sys");
    }
  }
}

function nextTurn() {
  if (State.phase === "over") return;
  applyTerrainEndEffects(cur());
  checkEnd();
  if (State.phase === "over") { refresh(); return; }
  let guard = 0;
  do {
    State.turnPtr++;
    if (State.turnPtr >= State.order.length) {
      State.turnPtr = 0;
      State.round++;
      for (const u of State.units) u.timesAttacked = 0;
      fireReinforcements();
      checkSurvive();
    }
    guard++;
    if (guard > 300) { State.phase = "over"; State.winner = "party"; return; }
  } while (State.order[State.turnPtr].dead);
  // P0-5: checkSurvive() (round sonunda tetiklenir) phase'i "over" yapmış olabilir —
  // startTurn() bunu geri "playerInput"/"enemy"ye çevirmesin diye burada çıkıyoruz.
  if (State.phase === "over") { refresh(); return; }
  startTurn(cur());
}

function checkSurvive() {
  if (State.objective && State.objective.type === "survive" && State.round > State.objective.rounds) {
    if (State.phase !== "over") { State.phase = "over"; State.winner = "party"; log("ZAFER! Hayatta kalındı.", "sys"); playSfx("victory"); }
  }
}

function checkEnd() {
  const partyAlive = State.units.some(u => u.side === "party" && !u.dead);
  const enemyAlive = State.units.some(u => u.side !== "party" && !u.dead);
  const obj = State.objective || { type: "kill" };
  if (!partyAlive) { State.phase = "over"; State.winner = "enemy"; log("YENİLGİ! Ekip yok oldu.", "sys"); playSfx("defeat"); return; }
  if (obj.type === "boss") {
    const bossAlive = State.units.some(u => u.side !== "party" && !u.dead && (u.name === obj.target || u.defId === obj.target));
    if (!bossAlive) { State.phase = "over"; State.winner = "party"; log("ZAFER! Boss düştü.", "sys"); playSfx("victory"); }
    return;
  }
  if (obj.type === "survive") return; // checkSurvive round sonunda kontrol eder
  // varsayılan: kill (tüm düşmanlar)
  if (!enemyAlive) { State.phase = "over"; State.winner = "party"; log("ZAFER! Tüm düşmanlar temizlendi.", "sys"); playSfx("victory"); }
}

// ---------- FX / FLOATTEXT ----------
function addFx(fx) { State.fx.push(Object.assign({ start: performance.now(), dur: 380 }, fx)); }
function addFloat(unit, text, color) { State.floatTexts.push({ text, x: unit.q, y: unit.r, color, start: performance.now(), dur: 900 }); }
// Saldıran birim 150ms "attack" karesiyle çizilir; vurulan birim 120ms beyaz flaş alır (render.js kullanır).
function flashAttack(u) { if (u) u._atkAnimUntil = performance.now() + 150; }
function flashHurt(u) { if (u) u._hurtAnimUntil = performance.now() + 120; }
// Sonuç ekranının .battle-stats bölümü için: ekibin verdiği/aldığı toplam hasar + kritik sayısı.
// Kritik isabette hafif ekran sarsıntısı (animasyon hızı "anında" değilse) — render.js draw() okur.
function triggerCritShake() {
  if (State.animSpeed === 3) return;
  State.shakeUntil = performance.now() + 180;
}
function recordDamage(unit, dmg, crit) {
  if (unit.side === "party") {
    State.dmgDealt += dmg; if (crit) State.critCount++;
    if (!State.dmgByHero) State.dmgByHero = {};
    State.dmgByHero[unit.name] = (State.dmgByHero[unit.name] || 0) + dmg;
  } else {
    State.dmgTaken += dmg;
  }
}

// ---------- ANİMASYON HIZI ----------
function scaledDelay(ms) {
  if (State._ffActive || State.animSpeed === 3) return 0; // "Hızlandır" butonu/Space basılıyken anında
  if (State.animSpeed === 2) return Math.round(ms / 2);
  return ms;
}
// P0-1: battleId'yi çağrı anında yakalayıp ateşlendiğinde karşılaştırır — savaş değiştiyse (yeni
// setupBattle veya savaş ekranından çıkış) sessizce hiçbir şey yapmaz. Tüm AI/tur-akışı gecikmeli
// çağrıları bunun üzerinden geçmeli.
function guardedTimeout(fn, ms) {
  const bid = State.battleId;
  return setTimeout(() => { if (State.battleId === bid) fn(); }, ms);
}
// Not: Audio (audio.js) bir hata nedeniyle tanımsız kalabilir; typeof bile TDZ durumunda
// fırlatabildiği için try/catch ile koruyoruz — ses asla oyunu durdurmamalı.
function playSfx(name) { try { if (typeof Audio !== "undefined" && Audio && Audio.play) Audio.play(name); } catch (e) { /* yok say */ } }

// ---------- eski yardımcılar (ai.js tarafından kullanılır) ----------
function bestStepToward(u, target, allow) {
  const dist = bfsDist(u.q, u.r, u, allow, u);
  let best = { q: u.q, r: u.r }, bestC = hexDist(u, target), bestSteps = 0;
  for (const [k, dd] of dist) {
    const parts = k.split(",");
    const q = parseInt(parts[0], 10), r = parseInt(parts[1], 10);
    const c = hexDist({ q, r }, target);
    if (c < bestC || (c === bestC && dd < bestSteps)) {
      bestC = c; best = { q, r }; bestSteps = dd;
    }
  }
  return best;
}
