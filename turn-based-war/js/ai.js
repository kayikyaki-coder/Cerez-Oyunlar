// ai.js — düşman yapay zekası (ai tipleri + yetenekler)
// CONTRACT §4.2. Her adım setTimeout ile ilerler (animasyon hızına göre ölçeklenir),
// her koşulda nextTurn()'e ulaşacak şekilde guard'lanmıştır (takılmayı engeller).

function aiDelay(ms) { return scaledDelay(ms); }

function alivePartyOf(u) { return State.units.filter(t => t.side === "party" && !t.dead); }
function alivEnemiesOf(u) { return State.units.filter(t => t.side !== "party" && t !== u && !t.dead); }

function nearestTarget(u, pool) {
  let best = null, bc = 1e9;
  for (const t of pool) { const c = hexDist(u, t); if (c < bc) { bc = c; best = t; } }
  return best;
}
function lowestHpTarget(pool) {
  return pool.slice().sort((a, b) => a.hp - b.hp)[0] || null;
}
function lowestDodgeTarget(u, pool) {
  return pool.slice().sort((a, b) => (effDodge(a, true)) - (effDodge(b, true)))[0] || null;
}

// hedefe bitişik mi
function isAdjacent(u, t) { return hexDist(u, t) === 1; }

// bir birimi hedefe doğru en fazla `allow` maliyet kadar hareket ettirir; hareket ettiyse true döner
function stepToward(u, target, allow) {
  if (!canMove(u) || u.ap < 1) return false;
  const dest = bestStepToward(u, target, allow);
  if (dest.q === u.q && dest.r === u.r) return false;
  u.q = dest.q; u.r = dest.r; u.movesUsed++; u.ap -= 1;
  return true;
}
// hedeften uzaklaşacak en iyi hex'e kaç (ranged/caster/healer mesafe koruma)
function stepAway(u, target, allow) {
  if (!canMove(u) || u.ap < 1) return false;
  const dist = bfsDist(u.q, u.r, u, allow, u);
  let best = { q: u.q, r: u.r }, bestC = hexDist(u, target);
  for (const [k, dd] of dist) {
    const parts = k.split(","); const q = parseInt(parts[0], 10), r = parseInt(parts[1], 10);
    const c = hexDist({ q, r }, target);
    if (c > bestC) { bestC = c; best = { q, r }; }
  }
  if (best.q === u.q && best.r === u.r) return false;
  u.q = best.q; u.r = best.r; u.movesUsed++; u.ap -= 1;
  return true;
}

// düşmanın büyülerinden en iyisini seçer: alan büyüsü ≥2 hedef tutuyorsa onu, yoksa en yüksek beklenen hasarı
function pickEnemySpell(u, targets) {
  if (!u.spells || !u.spells.length) return null;
  let best = null, bestScore = -1, bestTarget = null;
  for (const id of u.spells) {
    const sp = SPELLBOOK[id];
    if (!sp || !canCast(u, sp)) continue;
    if (sp.target === "enemy") {
      for (const t of targets) {
        if (hexDist(u, t) > sp.range) continue;
        let score = sp.dmg ? parseInt(sp.dmg, 10) : (sp.missiles ? sp.missiles.n : 1);
        if (sp.area) {
          const hitCount = State.units.filter(x => !x.dead && x.side === "party" && hexDist(x, t) <= sp.area).length;
          score *= hitCount;
          if (hitCount < 2 && sp.area) score *= 0.6;
        }
        if (score > bestScore) { bestScore = score; best = sp; bestTarget = t; }
      }
    }
  }
  return best ? { sp: best, target: bestTarget } : null;
}
function pickHealSpell(u) {
  if (!u.spells) return null;
  const wounded = State.units.filter(t => !t.dead && t.side === u.side && t.hp / t.hpMax < 0.6);
  if (!wounded.length) return null;
  const target = lowestHpTarget(wounded);
  for (const id of u.spells) {
    const sp = SPELLBOOK[id];
    if (sp && sp.resolve === "heal" && canCast(u, sp) && hexDist(u, target) <= sp.range) return { sp, target };
  }
  return null;
}

// ---------- YETENEK TETİKLEYİCİLERİ ----------
function tryUseAbilities(u) {
  // howl: savaşta 1 kez, tur başında (ilk hamleden önce)
  if (hasAbility(u, "howl") && !u.abilitiesUsed.howl && u.ap >= 1) {
    u.abilitiesUsed.howl = true; u.ap -= 1;
    for (const t of State.units) if (!t.dead && t.side === u.side) applyStatus(t, { name: "Uluma", speedBonus: 1, turns: 2 });
    log(u.name + " uludu — sürü güçlendi!", "dmg");
    return true;
  }
  // summon:<enemyId> — HP %50 altına inince
  const summonAbility = (u.abilities || []).find(a => typeof a === "string" && a.indexOf("summon:") === 0);
  if (summonAbility && !u.abilitiesUsed.summon && u.hp <= u.hpMax / 2) {
    u.abilitiesUsed.summon = true;
    const enemyId = summonAbility.split(":")[1];
    const defs = getEnemyDefs();
    const def = defs[enemyId];
    if (def) {
      for (let i = 0; i < 2; i++) {
        const dist = bfsDist(u.q, u.r, null, 3);
        let spot = null;
        for (const [k] of dist) { const p = k.split(","); const q = parseInt(p[0], 10), r = parseInt(p[1], 10); if (!unitAt(q, r)) { spot = { q, r }; break; } }
        if (!spot) break;
        const full = instantiateLiveEnemy(def, { type: enemyId, q: spot.q, r: spot.r, name: def.name }, State.units.length);
        State.units.push(full);
        State.order.splice(State.turnPtr + 1, 0, full);
      }
      log(u.name + " yardım çağırdı!", "sys");
    }
    return true;
  }
  return false;
}

// webShot: 2 AP, menzil 6, save(agility,DC12) başarısızsa hız 0 (1 tur)
function tryWebShot(u, targets) {
  if (!hasAbility(u, "webShot") || u.ap < 2 || u.hasAttacked) return false;
  const t = targets.find(x => hexDist(u, x) <= 6);
  if (!t) return false;
  u.ap -= 2; u.hasAttacked = true;
  const roll = d20() + (t.stats.agility || 0);
  addFx({ type: "magic", from: u, to: t, color: "#c9c9c9" });
  if (roll < 12) { applyStatus(t, { name: "Ağ", rooted: true, speedBonus: -99, turns: 1 }); log(u.name + " → " + t.name + ": Ağ tuttu! (hız 0)", "dmg"); }
  else log(u.name + " → " + t.name + ": Ağ atışı ıskaladı.", "miss");
  return true;
}

// ---------- ANA DAVRANIŞ FONKSİYONU ----------
function runEnemyTurn(u) {
  let guard = 0;
  function act() {
    guard++;
    if (State.phase === "over") return;
    if (guard > 40) { log(u.name + " kararsız kaldı, turu geçiyor.", "sys"); nextTurn(); return; }
    if (u.dead) { nextTurn(); return; }

    const targets = alivePartyOf(u);
    if (!targets.length) { checkEnd(); nextTurn(); return; }

    if (tryUseAbilities(u)) { refresh(); guardedTimeout(act, aiDelay(500)); return; }

    const ai = u.ai || "melee";
    let acted = false;

    if (ai === "healer") acted = healerStep(u, targets);
    else if (ai === "caster") acted = casterStep(u, targets);
    else if (ai === "ranged") acted = rangedStep(u, targets);
    else if (ai === "skirmisher") acted = skirmisherStep(u, targets);
    else if (ai === "brute") acted = bruteStep(u, targets);
    else if (ai === "boss") acted = bossStep(u, targets);
    else acted = meleeStep(u, targets);

    checkEnd();
    refresh();
    if (State.phase === "over") return;
    if (acted) { guardedTimeout(act, aiDelay(550)); return; }
    // yapacak bir şey kalmadı
    nextTurn();
  }
  guardedTimeout(act, aiDelay(500));
}

// melee: en yakına gider, vurur
function meleeStep(u, targets) {
  const target = nearestTarget(u, targets);
  if (!target) return false;
  if (isAdjacent(u, target) && u.ap >= 2 && !u.hasAttacked && !hasStatus(u, "cantAttack")) {
    doAttack(u, target); u.ap -= 2; u.hasAttacked = true;
    return true;
  }
  const allow = moveAllowance(u);
  if (stepToward(u, target, allow)) return true;
  if (u.ap >= 2 && !u.hasAttacked && hexDist(u, target) <= u.attack.range) { doAttack(u, target); u.ap -= 2; u.hasAttacked = true; return true; }
  return false;
}

// skirmisher: en düşük HP/dodge hedefe gider
function skirmisherStep(u, targets) {
  const target = lowestDodgeTarget(u, lowestHpTarget(targets) ? targets : targets) || nearestTarget(u, targets);
  const pick = lowestHpTarget(targets) || target;
  if (isAdjacent(u, pick) && u.ap >= 2 && !u.hasAttacked && !hasStatus(u, "cantAttack")) { doAttack(u, pick); u.ap -= 2; u.hasAttacked = true; return true; }
  const allow = moveAllowance(u);
  if (stepToward(u, pick, allow)) return true;
  if (u.ap >= 2 && !u.hasAttacked && hexDist(u, pick) <= u.attack.range) { doAttack(u, pick); u.ap -= 2; u.hasAttacked = true; return true; }
  return false;
}

// ranged: menzilde kalır, bitişikse uzaklaşıp atar
function rangedStep(u, targets) {
  if (tryWebShot(u, targets)) return true;
  const target = nearestTarget(u, targets);
  if (!target) return false;
  const dist = hexDist(u, target);
  if (dist <= u.attack.range && dist > 1 && u.ap >= 2 && !u.hasAttacked) { doAttack(u, target); u.ap -= 2; u.hasAttacked = true; return true; }
  if (dist === 1) {
    const allow = moveAllowance(u);
    if (stepAway(u, target, allow)) return true;
  }
  if (dist > u.attack.range) {
    const allow = moveAllowance(u);
    if (stepToward(u, target, allow)) return true;
  }
  if (u.ap >= 2 && !u.hasAttacked && hexDist(u, target) <= u.attack.range) { doAttack(u, target); u.ap -= 2; u.hasAttacked = true; return true; }
  return false;
}

// caster: en iyi büyüyü at, mesafeyi koru
function casterStep(u, targets) {
  const spellChoice = pickEnemySpell(u, targets);
  if (spellChoice) { castSpell(u, spellChoice.sp, spellChoice.target); return true; }
  const target = nearestTarget(u, targets);
  if (!target) return false;
  const dist = hexDist(u, target);
  if (dist <= 2) {
    const allow = moveAllowance(u);
    if (stepAway(u, target, allow)) return true;
  } else {
    const allow = moveAllowance(u);
    if (stepToward(u, target, allow)) return true;
  }
  if (u.ap >= 2 && !u.hasAttacked && dist <= u.attack.range) { doAttack(u, target); u.ap -= 2; u.hasAttacked = true; return true; }
  return false;
}

// healer: yaralı dostu iyileştirir, yoksa caster gibi
function healerStep(u, targets) {
  const healChoice = pickHealSpell(u);
  if (healChoice) { castSpell(u, healChoice.sp, healChoice.target); return true; }
  return casterStep(u, targets);
}

// brute: en yakın hedefe gider, ağır vurur (yavaş)
function bruteStep(u, targets) {
  const target = nearestTarget(u, targets);
  if (!target) return false;
  if (isAdjacent(u, target) && u.ap >= 2 && !u.hasAttacked && !hasStatus(u, "cantAttack")) {
    doAttack(u, target); u.ap -= 2; u.hasAttacked = true;
    return true;
  }
  const allow = moveAllowance(u);
  if (stepToward(u, target, allow)) return true;
  return false;
}

// boss: melee + yetenekler öncelikli (tryUseAbilities zaten act() içinde önce çağrılıyor)
function bossStep(u, targets) {
  const spellChoice = pickEnemySpell(u, targets);
  const target = nearestTarget(u, targets);
  if (spellChoice && (!target || hexDist(u, target) > 1)) { castSpell(u, spellChoice.sp, spellChoice.target); return true; }
  if (!target) return false;
  if (isAdjacent(u, target) && u.ap >= 2 && !u.hasAttacked && !hasStatus(u, "cantAttack")) { doAttack(u, target); u.ap -= 2; u.hasAttacked = true; return true; }
  const allow = moveAllowance(u);
  if (stepToward(u, target, allow)) return true;
  if (spellChoice) { castSpell(u, spellChoice.sp, spellChoice.target); return true; }
  return false;
}

// Eski isim geriye dönük uyumluluk için (varsa çağıran kod kırılmasın)
function runWolf(u) { runEnemyTurn(u); }
