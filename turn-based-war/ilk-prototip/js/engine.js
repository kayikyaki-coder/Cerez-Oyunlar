// engine.js — oyun durumu, zar, initiative, hareket, saldırı, AI, tur akışı

const State = {
  cols: 0, rows: 0, size: 0, margin: 0, originX: 0, originY: 0, width: 0, height: 0,
  blocked: new Set(),
  units: [],
  order: [],
  turnPtr: 0,
  round: 1,
  phase: "setup",     // setup | playerInput | enemy | over
  mode: "idle",       // idle | move | attack | heal
  reachable: new Map(),
  targets: [],
  winner: null,
  log: []
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
  if (State.log.length > 60) State.log.shift();
}

// ---------- KURULUM ----------
function setupBattle() {
  State.cols = CONFIG.cols;
  State.rows = CONFIG.rows;
  State.size = CONFIG.size;
  State.margin = CONFIG.margin;
  State.originX = State.margin + State.size;
  State.originY = State.margin + State.size;
  State.width = Math.ceil(State.originX + State.size * SQRT3 * (State.cols - 0.5) + State.margin);
  State.height = Math.ceil(State.originY + State.size * 1.5 * (State.rows - 1) + State.size + State.margin);

  State.blocked = new Set(BLOCKED.map(([q, r]) => key(q, r)));
  State.units = makeUnits().map(u => ({
    ...u, hp: u.hpMax, ap: 4, hasAttacked: false, movesUsed: 0, hasHealed: false,
    timesAttacked: 0, dead: false, init: 0, level: u.level || 1,
    slots: u.slotsMax || 0, secondWind: u.secondWindMax || 0, statuses: []
  }));

  State.round = 1;
  State.mode = "idle";
  State.reachable = new Map();
  State.targets = [];
  State.winner = null;
  State.log = [];

  rollInitiative();
  State.turnPtr = 0;
  State.phase = "setup";
  startTurn(State.order[0]);
}

// ---------- INITIATIVE (d20 + agility; eşitlikte agility'siz d20, bozulana kadar) ----------
function rollInitiative() {
  for (const u of State.units) u.init = d20() + u.stats.agility;
  log("— İnisiyatif atılıyor (d20 + Agility) —", "sys");

  // önce init'e göre azalan sırala
  let arr = State.units.slice().sort((a, b) => b.init - a.init);

  // eşit init gruplarını agility'siz d20 ile boz
  const result = [];
  let i = 0;
  while (i < arr.length) {
    let j = i;
    while (j < arr.length && arr[j].init === arr[i].init) j++;
    if (j - i === 1) {
      result.push(arr[i]);
    } else {
      const tied = arr.slice(i, j);
      log("Beraberlik (" + arr[i].init + "): " + tied.map(u => u.name).join(", ") + " tekrar atıyor", "sys");
      result.push(...breakTies(tied));
    }
    i = j;
  }

  State.order = result;
  for (const u of State.order) log(u.name + " : " + u.init, u.side === "party" ? "heal" : "dmg");
}

// beraberliği agility'siz d20 ile, bozulana kadar recursive çöz
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
    else out.push(...breakTies(rolled.slice(i, j).map(x => x.u))); // hâlâ eşitse tekrar at
    i = j;
  }
  return out;
}

// ---------- IZGARA / HAREKET ----------
function unitAt(q, r) {
  for (const u of State.units) if (!u.dead && u.q === q && u.r === r) return u;
  return null;
}

function passable(q, r, ignore) {
  if (q < 0 || r < 0 || q >= State.cols || r >= State.rows) return false;
  if (State.blocked.has(key(q, r))) return false;
  const occ = unitAt(q, r);
  if (occ && occ !== ignore) return false;
  return true;
}

// BFS mesafe haritası (start dahil, dist 0)
function bfsDist(sq, sr, ignore, maxSteps) {
  const dist = new Map();
  dist.set(key(sq, sr), 0);
  let frontier = [[sq, sr]];
  let step = 0;
  while (frontier.length && step < maxSteps) {
    step++;
    const next = [];
    for (const [cq, cr] of frontier) {
      for (const [nq, nr] of neighbors(cq, cr)) {
        const k = key(nq, nr);
        if (dist.has(k)) continue;
        if (!passable(nq, nr, ignore)) continue;
        dist.set(k, step);
        next.push([nq, nr]);
      }
    }
    frontier = next;
  }
  return dist;
}

function moveAllowance(u) {
  if (u.movesUsed === 0) return u.speed + statusSpeed(u); // Speed büyüsü sadece ilk yürümede
  return Math.floor(u.speed / 2);
}

// Bir turda en fazla 1 hareket + 1 dash. movesUsed >= 2 ise artık yürünemez.
function canMove(u) {
  return u.movesUsed < 2;
}

function cur() { return State.order[State.turnPtr]; }

// ---------- OYUNCU MODLARI ----------
function enterMove() {
  const u = cur();
  if (State.phase !== "playerInput" || u.ap < 1 || !canMove(u)) return;
  const allow = moveAllowance(u);
  const dist = bfsDist(u.q, u.r, u, allow);
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

// Büyü moduna gir: hedefleri hesapla (self anında uygulanır)
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

function clearMode() { State.mode = "idle"; State.reachable = new Map(); State.targets = []; State.pendingSpell = null; }

// ---------- TIKLAMA (main.js'ten çağrılır) ----------
function handleHexClick(q, r) {
  if (State.phase !== "playerInput") return;
  const u = cur();
  const k = key(q, r);

  if (State.mode === "move" && State.reachable.has(k)) {
    u.q = q; u.r = r; u.movesUsed++; u.ap -= 1;
    log(u.name + " hareket etti.", "");
    clearMode();
    refresh();
    return;
  }
  if (State.mode === "attack") {
    const t = State.targets.find(x => x.q === q && x.r === r);
    if (t) { doAttack(u, t); u.ap -= 2; u.hasAttacked = true; clearMode(); checkEnd(); refresh(); }
    return;
  }
  if (State.mode === "heal") {
    const t = State.targets.find(x => x.q === q && x.r === r);
    if (t) { doHeal(u, t); u.ap -= 1; clearMode(); refresh(); }
    return;
  }
  if (State.mode === "spell") {
    const t = State.targets.find(x => x.q === q && x.r === r);
    if (t && State.pendingSpell) { castSpell(u, State.pendingSpell, t); clearMode(); refresh(); }
    return;
  }
}

// ---------- SALDIRI ----------
// Saldırı statı: Finesse silahlar Might/Agility'nin yükseğini kullanır (eşitse fark yok)
function attackStat(attacker) {
  const a = attacker.attack;
  if (a.finesse) return Math.max(attacker.stats.might || 0, attacker.stats.agility || 0);
  return attacker.stats[a.stat] || 0;
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
// Hasar alınca uyku bozulur (Sleep)
function onDamaged(u) { if (hasStatus(u, "incapacitated")) { removeStatus(u, "incapacitated"); log(u.name + " uyandı!", "sys"); } }
// Hedefi büyücüden uzağa iter (Soundshock)
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
function effDodge(u) {
  let d = u.dodgeBonus || 0;
  if (u.statuses) for (const s of u.statuses) d += (s.dodge || 0);
  return d;
}
function statusSpeed(u) {
  let b = 0;
  if (u.statuses) for (const s of u.statuses) b += (s.speedBonus || 0);
  return b;
}
// Saldıranın isabet zarına eklenen bonus zarlar (Bless/Guide); oneRoll olanlar kullanılınca düşer
function statusAtkBonus(u) {
  let b = 0;
  if (!u.statuses) return 0;
  for (const s of u.statuses) if (s.atkDie) { b += d(s.atkDie); s._spent = true; }
  u.statuses = u.statuses.filter(s => !(s.atkDie && s.oneRoll && s._spent));
  return b;
}
// Ceza zarları (Bane/Minor Curse) — saldırı ve save'lerde düşer
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
  if (st.dodge) return "kaçınma " + (st.dodge > 0 ? "+" : "") + st.dodge + " (" + st.turns + " tur)";
  if (st.atkDie) return "saldırı +d" + st.atkDie;
  if (st.penaltyDie) return "zarlara -d" + st.penaltyDie + " (" + st.turns + " tur)";
  if (st.speedBonus) return "hız " + (st.speedBonus > 0 ? "+" : "") + st.speedBonus;
  if (st.reduceDie) return "sonraki hasar -d" + st.reduceDie;
  return st.name;
}

// Hasar sonrası: Resistance (bir kerelik d4 azaltma) + zırh DR
function applyDamageMods(defender, dmg) {
  const red = consumeResistance(defender);
  if (red) dmg = Math.max(0, dmg - red);
  if (defender.dr && dmg > 0) dmg = Math.max(1, Math.round(dmg * (1 - defender.dr)));
  return Math.max(0, dmg);
}
function killCheck(u) {
  if (u.hp <= 0) { u.hp = 0; u.dead = true; log(u.name + " öldü!", "sys"); }
}

// Ortak isabet çözümü (silah ve isabet-zarlı büyüler). toHit = saldıranın stat bonusu.
function performHit(attacker, defender, toHit) {
  let natk = d20();
  if (consumeAdvantage(defender)) natk = Math.max(natk, d20()); // Guiding Bolt riderı
  const bonus = toHit + statusAtkBonus(attacker) - statusPenalty(attacker);
  const atkTotal = natk + bonus;

  const nDice = defender.timesAttacked + 1;
  let low = 99;
  for (let i = 0; i < nDice; i++) low = Math.min(low, d20());
  const defTotal = low + defender.stats.agility + effDodge(defender);
  defender.timesAttacked++;

  const crit = (natk === 20), autoMiss = (natk === 1);
  const hit = !autoMiss && (crit || atkTotal >= defTotal);
  return { hit, crit, atkTotal, defTotal, disTag: nDice > 1 ? " [" + nDice + " zar dez.]" : "" };
}

// Silah saldırısı: bonus hem isabette hem hasarda.
function doAttack(attacker, defender) {
  const atkStat = attackStat(attacker);
  const r = performHit(attacker, defender, atkStat);
  if (!r.hit) {
    log(attacker.name + " → " + defender.name + ": ıska (" + r.atkTotal + " vs " + r.defTotal + ")" + r.disTag, "miss");
    return;
  }
  let dmg = rollDmg(attacker.attack.dmg, r.crit) + Math.max(0, atkStat);
  dmg = applyDamageMods(defender, dmg);
  defender.hp -= dmg;
  onDamaged(defender);
  log(attacker.name + " → " + defender.name + ": " + (r.crit ? "" : r.atkTotal + " vs " + r.defTotal + " · ") + "-" + dmg + " HP" + (r.crit ? " KRİTİK!" : "") + r.disTag, "dmg");
  killCheck(defender);
}

// ---------- BÜYÜ ÇÖZÜMLERİ ----------
function doSpellAttack(caster, defender, sp) {
  const r = performHit(caster, defender, spellStatVal(caster));
  if (!r.hit) {
    log(caster.name + " → " + defender.name + ": " + sp.name + " ıskaladı (" + r.atkTotal + " vs " + r.defTotal + ")" + r.disTag, "miss");
    return;
  }
  let dmg = rollDmg(sp.dmg, r.crit); // BÜYÜ: hasara stat bonusu YOK
  dmg = applyDamageMods(defender, dmg);
  defender.hp -= dmg;
  onDamaged(defender);
  log(caster.name + " → " + defender.name + ": " + sp.name + " -" + dmg + " " + (sp.element || "") + (r.crit ? " KRİTİK!" : ""), "dmg");
  if (sp.rider === "advantage") applyStatus(defender, { name: "İşaretli", incomingAdvantage: true, oneHit: true, turns: 2 });
  killCheck(defender);
}
function doSpellSave(caster, defender, sp) {
  const dc = saveDC(caster, spellStatKey(caster));
  const roll = d20() + (defender.stats[sp.saveStat] || 0) - statusPenalty(defender);
  const success = roll >= dc;
  let dmg = rollDmg(sp.dmg, false);
  if (success) dmg = sp.half ? Math.floor(dmg / 2) : 0;
  if (dmg > 0) { dmg = applyDamageMods(defender, dmg); defender.hp -= dmg; onDamaged(defender); }
  log(caster.name + " → " + defender.name + ": " + sp.name + " save " + roll + " vs DC" + dc + " → " + (dmg > 0 ? "-" + dmg + " " + (sp.element || "") : "etkisiz"), "dmg");
  killCheck(defender);
}
function doSpellAuto(caster, defender, sp) {
  let total = 0;
  for (let i = 0; i < sp.missiles.n; i++) total += d(sp.missiles.die);
  total = applyDamageMods(defender, total);
  defender.hp -= total;
  onDamaged(defender);
  log(caster.name + " → " + defender.name + ": " + sp.name + " -" + total + " " + (sp.element || "") + " (otomatik)", "dmg");
  killCheck(defender);
}
// Alan büyüsü: tıklanan hedef merkez; menzil-içi tüm düşmanlar (merkez + komşular) etkilenir.
// Her hedef ayrı save atar; başarılıysa yarı/etkisiz. Statü/itme başarısız save'de uygulanır.
function doSpellArea(caster, center, sp) {
  const rad = sp.area || 1;
  const affected = State.units.filter(t => !t.dead && t.side !== caster.side && hexDist(t, center) <= rad);
  if (!affected.length) { log(sp.name + ": alanda hedef yok.", "miss"); return; }
  log(caster.name + " " + sp.name + " (alan · " + affected.length + " hedef)", "sys");
  const dmgRoll = sp.dmg ? rollDmg(sp.dmg, false) : 0;
  const dc = saveDC(caster, spellStatKey(caster));
  for (const t of affected) {
    const roll = d20() + (t.stats[sp.saveStat] || 0) - statusPenalty(t);
    const saved = roll >= dc;
    if (sp.dmg) {
      let dmg = saved ? (sp.half ? Math.floor(dmgRoll / 2) : 0) : dmgRoll;
      if (dmg > 0) { dmg = applyDamageMods(t, dmg); t.hp -= dmg; onDamaged(t); }
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
  const amt = rollDmg(sp.dmg, false);
  const before = target.hp;
  target.hp = Math.min(target.hpMax, target.hp + amt);
  log(caster.name + " → " + target.name + ": " + sp.name + " +" + (target.hp - before) + " HP", "heal");
}
function doSpellDebuff(caster, defender, sp) {
  const dc = saveDC(caster, spellStatKey(caster));
  const roll = d20() + (defender.stats[sp.saveStat] || 0);
  if (roll >= dc) {
    log(caster.name + " → " + defender.name + ": " + sp.name + " save " + roll + " vs DC" + dc + " → dayandı", "miss");
    return;
  }
  applyStatus(defender, sp.status);
  log(caster.name + " → " + defender.name + ": " + sp.name + " tuttu · " + statusDesc(sp.status), "dmg");
}

// Bir büyü atılabilir mi? (AP, slot, saldırı limiti)
// Saldırgan büyüler (hasar + düşmana etki eden save/debuff) "turda 1 saldırı" kuralına dahildir.
// Destek/heal (buff, heal) ek olarak kullanılabilir.
function usesAttackAction(sp) {
  return sp.resolve === "attack" || sp.resolve === "save" || sp.resolve === "auto" || sp.resolve === "debuff";
}
function canCast(u, sp) {
  if (!u.spells || u.spells.indexOf(spellIdOf(sp)) < 0) return false;
  if (u.ap < sp.ap) return false;
  if (sp.level >= 1 && (u.slots || 0) <= 0) return false;
  if (sp.level >= 1 && u.leveledCast) return false; // turda sadece 1 seviyeli büyü
  if (usesAttackAction(sp) && u.hasAttacked) return false;
  return true;
}
function spellIdOf(sp) {
  for (const id in SPELLBOOK) if (SPELLBOOK[id] === sp) return id;
  return null;
}
function castSpell(caster, sp, target) {
  caster.ap -= sp.ap;
  if (sp.level >= 1) { caster.slots = Math.max(0, (caster.slots || 0) - 1); caster.leveledCast = true; }
  if (usesAttackAction(sp)) caster.hasAttacked = true;
  if (sp.area) doSpellArea(caster, target, sp);      // alan büyüsü: hedef = merkez hex
  else if (sp.resolve === "attack") doSpellAttack(caster, target, sp);
  else if (sp.resolve === "save") doSpellSave(caster, target, sp);
  else if (sp.resolve === "auto") doSpellAuto(caster, target, sp);
  else if (sp.resolve === "heal") doSpellHeal(caster, target, sp);
  else if (sp.resolve === "debuff") doSpellDebuff(caster, target, sp);
  else if (sp.resolve === "buff") {
    applyStatus(target, sp.status);
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
  u.swUsed = true; // turda 1 kez
  u.ap -= 1;
  log(u.name + " Second Wind · +" + (u.hp - before) + " HP", "heal");
}

function doHeal(cleric, ally) {
  const amt = rollDmg(cleric.heal.dmg, false);
  const before = ally.hp;
  ally.hp = Math.min(ally.hpMax, ally.hp + amt);
  cleric.hasHealed = true;
  log(cleric.name + " → " + ally.name + " iyileştirdi +" + (ally.hp - before) + " HP", "heal");
}

// ---------- TUR AKIŞI ----------
function startTurn(u) {
  u.ap = 4; u.hasAttacked = false; u.movesUsed = 0; u.hasHealed = false;
  u.leveledCast = false; u.swUsed = false; // turda 1 seviyeli büyü, 1 Second Wind
  tickStatuses(u); // süreli buff/debuff'lar bu birimin turu başında azalır
  clearMode();
  // Uyku/etkisizleştirme: bu birim turunu tamamen kaçırır
  if (hasStatus(u, "incapacitated")) {
    log(u.name + " uyuyor — turunu kaçırıyor.", "sys");
    State.phase = u.side === "wolf" ? "enemy" : "playerInput";
    refresh();
    setTimeout(nextTurn, 700);
    return;
  }
  if (u.side === "wolf") {
    State.phase = "enemy";
    refresh();
    runWolf(u);
  } else {
    State.phase = "playerInput";
    refresh();
  }
}

function endTurn() {
  if (State.phase === "over") return;
  nextTurn();
}

function nextTurn() {
  if (State.phase === "over") return;
  let guard = 0;
  do {
    State.turnPtr++;
    if (State.turnPtr >= State.order.length) {
      State.turnPtr = 0;
      State.round++;
      for (const u of State.units) u.timesAttacked = 0;
    }
    guard++;
    if (guard > 100) return;
  } while (State.order[State.turnPtr].dead);
  startTurn(cur());
}

function checkEnd() {
  const partyAlive = State.units.some(u => u.side === "party" && !u.dead);
  const wolfAlive = State.units.some(u => u.side === "wolf" && !u.dead);
  if (!wolfAlive) { State.phase = "over"; State.winner = "party"; log("ZAFER! Tüm kurtlar öldü.", "sys"); }
  else if (!partyAlive) { State.phase = "over"; State.winner = "wolf"; log("YENİLGİ! Ekip yok oldu.", "sys"); }
}

// ---------- KURT AI (en yakına saldır) ----------
function nearestParty(u) {
  let best = null, bc = 1e9;
  for (const t of State.units) {
    if (t.side === "party" && !t.dead) {
      const c = hexDist(u, t);
      if (c < bc) { bc = c; best = t; }
    }
  }
  return best;
}

// hedefe en çok yaklaştıran ulaşılabilir hex
function bestStepToward(u, target, allow) {
  const dist = bfsDist(u.q, u.r, u, allow);
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

function runWolf(u) {
  function act() {
    if (State.phase === "over") return;
    const target = nearestParty(u);
    if (!target) { checkEnd(); nextTurn(); return; }

    const adjacent = hexDist(u, target) === 1;

    // bitişikteyse ısır (Charm Person → saldıramaz, sadece dolanır)
    if (adjacent && u.ap >= 2 && !u.hasAttacked && !hasStatus(u, "cantAttack")) {
      doAttack(u, target); u.ap -= 2; u.hasAttacked = true;
      checkEnd(); refresh();
      setTimeout(act, 650);
      return;
    }

    // değilse yaklaş (en fazla 1 hareket + 1 dash)
    if (u.ap >= 1 && canMove(u)) {
      const allow = moveAllowance(u);
      const dest = bestStepToward(u, target, allow);
      if (dest.q !== u.q || dest.r !== u.r) {
        u.q = dest.q; u.r = dest.r; u.movesUsed++; u.ap -= 1;
        refresh();
        setTimeout(act, 450);
        return;
      }
    }
    // yapacak bir şey kalmadı
    nextTurn();
  }
  setTimeout(act, 500);
}
