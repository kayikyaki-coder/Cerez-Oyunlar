// campaign-sim.js — KAMPANYA DENGESİ simülatörü.
// Motoru (hex/data/content/*/dev-fixtures/engine/ai/campaign-flow'un saf kısımları) node vm'de
// yükler, CAMPAIGN'daki HER savaş düğümü için (bu yazıldığı anda 14 tanesi vardı) gerçek
// setupBattle(cfg) ile kurar. Ekip durumu (seviye/ekipman/altın/envanter), TEK bir "referans
// kampanya koşusu" gerçekten oynanarak hesaplanır: XP_TABLE + önceki savaşların düşman xp
// toplamı → seviye; LEVEL_UPS ile HP/slot/feature/statPoints (statPoint sınıfın ana statına
// gider); kamplarda makul alışveriş (en iyi silah/zırh yükseltmesi + 2 iksir). Sonra HER savaş
// düğümü için, o düğüme referans koşuda GİRERKEN ölçülen ekip durumundan başlayarak 200 bağımsız
// koşu çalıştırılır (AKILLI bot: odak ateşi, büyü/heal/second-wind/iksir kullanır).
"use strict";
const { loadEngine, setGlobal, getGlobal } = require("./load-engine");

const N_PER_NODE = parseInt(process.argv[2], 10) || 200;
// --refs N: N BAĞIMSIZ referans kampanya koşusu (her biri kendi rastgele zar/AI sonuçlarıyla
// farklı bir "ekip düğüme girerken nasıldı" durumu üretir). Tek referans çok gürültülü çıkabiliyor
// (ör. b10/b11 tek koşuda %22-93 arası salınabiliyor) — varsayılan 5, her düğüm için ref'ler
// arası ortalama + min/max raporlanır. `node campaign-sim.js 200 --refs 5`
function argAfter(flag, def) {
  const i = process.argv.indexOf(flag);
  if (i >= 0 && process.argv[i + 1] != null) { const v = parseInt(process.argv[i + 1], 10); if (!isNaN(v)) return v; }
  return def;
}
const N_REFS = Math.max(1, argAfter("--refs", 5));
// --difficulty zor|normal|hikaye (8. tur, tek seferlik tests/ istisnası): gerçek oyundaki
// GameState.difficulty'yi taklit eder — mekanik TEK yerde (js/engine.js makeEnemyUnit) uygulanıyor,
// burada sadece referans/istatistik koşularının GameState'ine aynı değer yazılıyor.
function argAfterStr(flag, def) {
  const i = process.argv.indexOf(flag);
  if (i >= 0 && process.argv[i + 1] != null) return process.argv[i + 1];
  return def;
}
const DIFFICULTY_ARG = (() => {
  const v = argAfterStr("--difficulty", "normal");
  return ["zor", "normal", "hikaye"].indexOf(v) >= 0 ? v : "normal";
})();
const N_PER_REF = Math.max(10, Math.round(N_PER_NODE / N_REFS));
const MAX_TURNS_PER_BATTLE = 500;
const SEC_PER_ROUND = 45; // süre tahmini için round başına varsayılan gerçek oyuncu süresi (40-50sn ortası)

// ---------------------------------------------------------------
// BUG WORKAROUND (bkz. TEST_REPORT.md P0-4): js/campaign-flow.js'teki heroToBattleUnit,
// satın alınan +N silah/zırh eşyalarının bonus'unu `bonusItem.effect.bonus`/`.effect.weapon`
// üzerinden okuyor, ama gerçek ITEM_DEFS şeması (items.js, CONTRACT §4.3) bunu doğrudan
// `bonusItem.weapon.bonus`/`.weapon.weapon` (ve zırh için `.armor.bonus`/`.armor.armor`)
// altında tutuyor — `.effect` alanı sadece consumable/trinket'lerde var. Sonuç: bir kahraman
// camp'ten aldığı +1 silah/zırhı kuşanınca BİR SONRAKİ SAVAŞ KURULURKEN (heroToBattleUnit)
// istisna fırlatıyor, yani ekipman yükseltmesi alan HER kampanya oyunu çöküyor. Oyun kodunu
// DEĞİŞTİRMİYORUZ (kurallar gereği); bunun yerine burada, SADECE bu simülasyon için, aynı
// fonksiyonun DÜZELTİLMİŞ bir kopyasını runtime'da (bellekte) enjekte ediyoruz — ki denge
// ölçümü gerçek oyuncunun (silah/zırh yükseltmesi kuşanmış) deneyimini yansıtsın. Gerçek
// düzeltme (dosyada) Geliştirici'nin işi.
function installHeroToBattleUnitFix(ctx) {
  ctx.heroToBattleUnit = function (hero, idx) {
    const defs = ctx.getItemDefs();
    let attack;
    const bonusItem = hero.weaponItem ? defs[hero.weaponItem] : null;
    const wbonus = bonusItem && bonusItem.weapon ? (bonusItem.weapon.bonus || 0) : 0;
    if (bonusItem && bonusItem.weapon && bonusItem.weapon.weaponDef) {
      const wd = bonusItem.weapon.weaponDef;
      attack = { name: wd.name, dmg: wd.dmg, range: wd.range, ranged: wd.ranged, stat: wd.stat, finesse: !!wd.finesse, isSpell: false, bonus: wbonus };
    } else {
      const weaponId = (bonusItem && bonusItem.weapon && bonusItem.weapon.weapon) ? bonusItem.weapon.weapon : hero.atk;
      attack = ctx.makeAttack(hero.cls, weaponId, hero.shield);
      attack.bonus = wbonus;
      attack.name = (wbonus ? ("+" + wbonus + " ") : "") + attack.name;
    }
    const armorDef = ctx.ARMORS[hero.armor] || ctx.ARMORS.none;
    const armorItem = hero.armorItem ? defs[hero.armorItem] : null;
    const abonus = armorItem && armorItem.armor ? (armorItem.armor.bonus || 0) : 0;
    let dodgeBonus = armorDef.dodge + abonus + (hero.shield && ctx.canUseShield(hero) ? 2 : 0);
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
      armorName: (armorDef.tier === "none" ? "Zırhsız" : armorDef.name) + (hero.shield && ctx.canUseShield(hero) ? " + Kalkan" : ""),
      spells: hero.spells ? hero.spells.slice() : null, slotsMax, slots: Math.min(hero.slots, slotsMax),
      secondWindMax: hero.secondWindMax, secondWind: hero.secondWind,
      features: (hero.features || []).slice(), canHeal: hero.cls === "Cleric", heal: ctx.CLASS_DEFS.Cleric.heal,
      _initBonus: initiative
    };
  };
}

function attachSyncTimers(sandbox) {
  const queue = [];
  sandbox.setTimeout = (fn) => { queue.push(fn); return queue.length; };
  sandbox.clearTimeout = () => {};
  return {
    drain(maxSteps) {
      let steps = 0;
      while (queue.length && steps < maxSteps) { const fn = queue.shift(); fn(); steps++; }
      return { steps, stuck: queue.length > 0 };
    }
  };
}

function deepClone(x) { return JSON.parse(JSON.stringify(x)); }

// ---------------------------------------------------------------
// AKILLI oyuncu botu — ai.js'in hazır yardımcılarını (pickEnemySpell/pickHealSpell/stepToward/
// stepAway/lowestHpTarget) yeniden kullanır (bunlar side'a göre GENEL çalışır, düşmana özgü değil).
function smartPlayerTurn(ctx, u) {
  const State = ctx.State;
  const GameState = ctx.GameState;
  let guard = 0;
  while (State.phase === "playerInput" && ctx.cur() === u && !u.dead && guard < 24) {
    guard++;
    const enemies = State.units.filter(t => !t.dead && t.side !== "party");
    if (!enemies.length) { ctx.endTurn(); return; }

    // 0) ücretsiz/öncelikli sınıf yetenekleri
    const abilities = ctx.unitAbilities(u);
    const surge = abilities.find(a => a.id === "actionSurge" && a.ready);
    if (surge) { ctx.resolveAbility(u, "actionSurge", null); continue; }
    const arcane = abilities.find(a => a.id === "arcaneRecovery" && a.ready);
    if (arcane && (u.slots || 0) === 0) { ctx.resolveAbility(u, "arcaneRecovery", null); continue; }
    const preserve = abilities.find(a => a.id === "preserveLife" && a.ready);
    if (preserve) {
      const wounded2 = State.units.filter(t => !t.dead && t.side === "party" && t.hp / t.hpMax < 0.6 && ctx.hexDist(u, t) <= 3);
      if (wounded2.length >= 2) { ctx.resolveAbility(u, "preserveLife", null); continue; }
    }
    const turnU = abilities.find(a => a.id === "turnUndead" && a.ready);
    if (turnU && enemies.some(e => ctx.hasAbility(e, "undead") && ctx.hexDist(u, e) <= 3)) {
      ctx.resolveAbility(u, "turnUndead", null); continue;
    }

    // 1) innate heal (slot harcamaz) — müttefik <%50
    if (u.canHeal && !u.hasHealed && u.ap >= 1) {
      const wounded = State.units.filter(t => !t.dead && t.side === "party" && t.hp / t.hpMax < 0.5 && ctx.hexDist(u, t) <= u.heal.range);
      if (wounded.length) { ctx.doHeal(u, wounded.sort((a, b) => a.hp - b.hp)[0]); continue; }
    }

    // 2) kendine iksir (<%35 HP)
    if (u.hp / u.hpMax < 0.35 && u.ap >= 1 && GameState && GameState.inventory && GameState.inventory.potion_heal > 0) {
      ctx.useItemOn(u, "potion_heal", u); continue;
    }

    // 3) Second Wind (<%50 HP)
    if (u.secondWindMax && u.secondWind > 0 && u.hp / u.hpMax < 0.5 && u.ap >= 1 && !u.swUsed) {
      ctx.doSecondWind(u); continue;
    }

    // 4) büyü (alan ≥2 hedef veya en yüksek beklenen hasar — pickEnemySpell zaten bunu skorluyor)
    if (u.spells && u.spells.length && u.ap >= 1 && !u.hasAttacked) {
      const spellChoice = ctx.pickEnemySpell(u, enemies);
      if (spellChoice) { ctx.castSpell(u, spellChoice.sp, spellChoice.target); continue; }
    }

    // 5) silah saldırısı — odak ateşi (menzildeki en düşük HP hedef)
    if (u.ap >= 2 && !u.hasAttacked) {
      const inRange = enemies.filter(e => ctx.hexDist(u, e) <= u.attack.range);
      if (inRange.length) {
        const target = ctx.lowestHpTarget(inRange);
        ctx.doAttack(u, target); u.ap -= 2; u.hasAttacked = true;
        if (ctx.applyFighterExtraAttackCheck) ctx.applyFighterExtraAttackCheck(u);
        ctx.checkEnd();
        continue;
      }
    }

    // 6) hareket: menzilli birim bitişikte ise mesafe korur, değilse en yakın hedefe yaklaş
    if (u.ap >= 1 && ctx.canMove(u)) {
      const target = ctx.nearestTarget(u, enemies);
      const allow = ctx.moveAllowance(u);
      let moved = false;
      if (u.attack.ranged && ctx.hexDist(u, target) <= 1) moved = ctx.stepAway(u, target, allow);
      if (!moved) moved = ctx.stepToward(u, target, allow);
      if (moved) continue;
    }
    break;
  }
  if (State.phase === "playerInput" && ctx.cur() === u) ctx.endTurn();
}

// Bir savaşı (zaten setupBattle ile kurulmuş) sonuna kadar sürer.
//
// BUG WORKAROUND (bkz. TEST_REPORT.md P0-5): `nextTurn()`, `checkSurvive()` round sonunda
// State.winner="party" + State.phase="over" ayarladıktan SONRA da koşulsuz `startTurn(cur())`
// çağırıyor — bu da phase'i tekrar "playerInput"/"enemy"ye çeviriyor (State.winner "party" olarak
// KALIYOR ama savaş asla gerçekten bitmiyor). Yani "survive" tipi savaşlar (ör. b11) şu an ASLA
// zafer ekranına düşmüyor, ekip yok olana kadar sonsuza kadar sürüyor. Oyun kodunu DEĞİŞTİRMİYORUZ;
// bunun yerine burada NİYET EDİLEN davranışı (round eşiği aşıldıysa ve ekip hayattaysa savaş
// KAZANILMIŞ sayılır) manuel olarak tespit edip ölçüme onu yansıtıyoruz.
function runBattleToEnd(ctx, timers) {
  const State = ctx.State;
  let turns = 0;
  while (State.phase !== "over" && turns < MAX_TURNS_PER_BATTLE) {
    if (State.objective && State.objective.type === "survive" && State.round > State.objective.rounds &&
      State.units.some(u => u.side === "party" && !u.dead)) {
      State.phase = "over"; State.winner = "party"; // bkz. yukarıdaki P0-5 notu
      break;
    }
    if (State.phase === "playerInput") {
      smartPlayerTurn(ctx, ctx.cur());
      turns++;
    } else if (State.phase === "enemy") {
      const r = timers.drain(3000);
      if (r.stuck) return { stuck: true, turns };
      turns++;
    } else {
      const r = timers.drain(50);
      turns++;
      if (r.steps === 0) break;
    }
  }
  timers.drain(3000);
  if (turns >= MAX_TURNS_PER_BATTLE && State.phase !== "over") return { stuck: true, turns };
  return { stuck: false, turns };
}

// ---------------------------------------------------------------
function findNodeById(campaign, id) {
  for (let ci = 0; ci < campaign.chapters.length; ci++) {
    const ch = campaign.chapters[ci];
    for (let ni = 0; ni < ch.nodes.length; ni++) if (ch.nodes[ni].id === id) return { chapterIndex: ci, nodeIndex: ni, node: ch.nodes[ni] };
  }
  return null;
}

function snapshotGameState(gs) {
  return { party: deepClone(gs.party), gold: gs.gold, inventory: deepClone(gs.inventory) };
}

// Kamp: tam iyileşme + "makul alışveriş" (her kahramana en iyi silah/zırh yükseltmesi + 2 iksir)
function doShoppingAtCamp(ctx, node) {
  const GameState = ctx.GameState;
  GameState.party.forEach(h => { h.hp = h.hpMax; h.slots = h.slotsMax; h.secondWind = h.secondWindMax; });
  const stock = (ctx.getShopStock()[node.shop] || []);
  const defs = ctx.getItemDefs();

  GameState.party.forEach(h => {
    let bestWeapon = null;
    for (const id of stock) {
      const it = defs[id];
      if (!it || it.type !== "weapon" || !it.weapon) continue;
      if (it.weapon.weapon && ctx.ATTACK_OPTIONS[h.cls] && ctx.ATTACK_OPTIONS[h.cls].indexOf(it.weapon.weapon) < 0) continue;
      if (it.price > GameState.gold) continue;
      const curBonus = h.weaponItem && defs[h.weaponItem] ? defs[h.weaponItem].weapon.bonus : -1;
      if (it.weapon.bonus > curBonus && (!bestWeapon || it.weapon.bonus > defs[bestWeapon].weapon.bonus)) bestWeapon = id;
    }
    if (bestWeapon) { GameState.gold -= defs[bestWeapon].price; ctx.addInventoryItem(bestWeapon, 1); h.weaponItem = bestWeapon; }

    let bestArmor = null;
    for (const id of stock) {
      const it = defs[id];
      if (!it || it.type !== "armor" || !it.armor) continue;
      if (ctx.ARMOR_OPTIONS[h.cls] && ctx.ARMOR_OPTIONS[h.cls].indexOf(it.armor.armor) < 0) continue;
      if (it.price > GameState.gold) continue;
      const curBonus = h.armorItem && defs[h.armorItem] ? defs[h.armorItem].armor.bonus : -1;
      if (it.armor.bonus > curBonus && (!bestArmor || it.armor.bonus > defs[bestArmor].armor.bonus)) bestArmor = id;
    }
    if (bestArmor) { GameState.gold -= defs[bestArmor].price; ctx.addInventoryItem(bestArmor, 1); h.armorItem = bestArmor; }
  });

  if (stock.indexOf("potion_heal") >= 0) {
    for (let i = 0; i < 2; i++) {
      if (GameState.gold >= defs.potion_heal.price) { GameState.gold -= defs.potion_heal.price; ctx.addInventoryItem("potion_heal", 1); }
    }
  }
}

function applyLevelUpsAuto(ctx) {
  const GameState = ctx.GameState;
  (GameState.pendingLevelUps || []).forEach(change => {
    const suggest = ctx.CLASS_DEFS[change.hero.cls].suggest;
    while (change.statPoints > 0 && change.hero.stats[suggest] < 5) { change.hero.stats[suggest]++; change.statPoints--; }
    while (change.statPoints > 0 && change.hero.stats.agility < 5) { change.hero.stats.agility++; change.statPoints--; }
    if (change.spellChoice) {
      change.spellChoice.cantripPicked = change.spellChoice.cantripPool.slice(0, change.spellChoice.cantripMax);
      change.spellChoice.leveledPicked = change.spellChoice.leveledPool.slice(0, change.spellChoice.leveledMax);
    }
  });
  ctx.applyPendingSpellChoices();
  GameState.pendingLevelUps = [];
}

// Referans koşuda TEK bir savaşı oynar (kayıpta gerçek "Tekrar Dene" gibi ekip anlık görüntüsüne
// dönüp tekrar dener); kazanınca xp/ödül/seviye atlamayı gerçek fonksiyonlarla uygular.
function playReferenceBattle(ctx, timers, node) {
  const GameState = ctx.GameState;
  const preSnapshot = snapshotGameState(GameState);
  let attempts = 0, lastStats = null;
  while (attempts < 15) {
    attempts++;
    const partyUnits = GameState.party.map((h, i) => ctx.heroToBattleUnit(h, i));
    ctx.setupBattle({ map: node.map, enemies: node.enemies, objective: node.objective, reinforcements: node.reinforcements, biome: node.biome, party: partyUnits });
    const res = runBattleToEnd(ctx, timers);
    lastStats = res;
    if (ctx.State.phase === "over" && ctx.State.winner === "party") {
      ctx.syncBattleResultsToParty();
      // KISA MOLA (tasarım kararı, 7. tur — js/campaign-flow.js applyShortRest ile birebir aynı
      // kural): gerçek fonksiyon varsa onu çağır (asıl kaynak), yoksa (eski build) burada tekrar et.
      if (typeof ctx.applyShortRest === "function") ctx.applyShortRest();
      else GameState.party.forEach(h => { h.hp = Math.min(h.hpMax, h.hp + Math.ceil((h.hpMax - h.hp) * 0.5)); h.slots = Math.min(h.slotsMax || 0, (h.slots || 0) + 1); });
      const defs = ctx.getEnemyDefs();
      const xp = ctx.State.units.filter(u => u.side !== "party").reduce((s, u) => s + (defs[u.defId] ? defs[u.defId].xp : (u.xp || 0)), 0);
      const rw = node.rewards || {};
      if (rw.gold) GameState.gold += rw.gold;
      (rw.items || []).forEach(id => ctx.addInventoryItem(id, 1));
      ctx.awardXpToParty(xp);
      applyLevelUpsAuto(ctx);
      return { win: true, attempts, stuck: res.stuck };
    }
    // kayıp (ya da takılma) — ekibi anlık görüntüye döndür, tekrar dene (gerçek oyundaki "Tekrar Dene")
    GameState.party = deepClone(preSnapshot.party);
    GameState.gold = preSnapshot.gold;
    GameState.inventory = deepClone(preSnapshot.inventory);
  }
  return { win: false, attempts, stuck: lastStats && lastStats.stuck };
}

// ---------------------------------------------------------------
// Referans kampanya koşusunu baştan sona oynar; her savaş düğümüne GİRERKEN ölçülen ekip
// durumunu (party/gold/inventory) döner (200x istatistik koşuları bunlardan başlayacak).
function buildReferencePlaythrough(ctx, timers) {
  const campaign = ctx.getCampaign();
  const nodeEntryState = {};
  const visitLog = [];
  let pos = { chapterIndex: 0, nodeIndex: 0 };
  let guard = 0;

  while (pos.chapterIndex < campaign.chapters.length && guard < 200) {
    guard++;
    const ch = campaign.chapters[pos.chapterIndex];
    const node = ch.nodes[pos.nodeIndex];
    let nextExplicit = null;

    if (node.type === "battle") {
      nodeEntryState[node.id] = snapshotGameState(ctx.GameState);
      const r = playReferenceBattle(ctx, timers, node);
      visitLog.push({ id: node.id, title: node.title, attempts: r.attempts, stuck: r.stuck });
      nextExplicit = node.next || null;
    } else if (node.type === "camp") {
      doShoppingAtCamp(ctx, node);
      nextExplicit = node.next || null;
    } else if (node.type === "story") {
      nextExplicit = node.next || null;
    } else if (node.type === "choice") {
      const opt = node.options[0];
      if (opt.effect && opt.effect.gold) ctx.GameState.gold += opt.effect.gold;
      nextExplicit = opt.goto;
      // dallanmanın diğer kolundaki savaş düğümü için de aynı ayrım-noktası durumunu kaydet
      for (let oi = 1; oi < node.options.length; oi++) {
        const alt = findNodeById(campaign, node.options[oi].goto);
        if (alt && alt.node.type === "battle" && !nodeEntryState[alt.node.id]) {
          nodeEntryState[alt.node.id] = snapshotGameState(ctx.GameState);
        }
      }
    }

    const chapterBefore = pos.chapterIndex;
    if (nextExplicit) {
      const found = findNodeById(campaign, nextExplicit);
      if (!found) break;
      pos = { chapterIndex: found.chapterIndex, nodeIndex: found.nodeIndex };
    } else {
      pos.nodeIndex++;
      if (pos.nodeIndex >= ch.nodes.length) { pos.chapterIndex++; pos.nodeIndex = 0; }
    }
    // BÖLÜM DİNLENMESİ (tasarım kararı, 7. tur): yeni bölüme geçişte tam iyileşme + slot/secondWind.
    if (pos.chapterIndex !== chapterBefore) {
      ctx.GameState.party.forEach(h => { h.hp = h.hpMax; h.slots = h.slotsMax; h.secondWind = h.secondWindMax; });
    }
  }
  return { nodeEntryState, visitLog };
}

// ---------------------------------------------------------------
// Bir savaş düğümü için N bağımsız koşu (entry state sabit, her koşu bağımsız).
function simulateNode(ctx, timers, node, entryState, n) {
  let wins = 0, totalRounds = 0, totalHpPct = 0, totalDeaths = 0, stuckCount = 0, errorCount = 0;
  const errors = [];
  for (let i = 0; i < n; i++) {
    try {
      const partyClone = deepClone(entryState.party);
      ctx.GameState.inventory = deepClone(entryState.inventory);
      const partyUnits = partyClone.map((h, idx) => ctx.heroToBattleUnit(h, idx));
      ctx.setupBattle({ map: node.map, enemies: node.enemies, objective: node.objective, reinforcements: node.reinforcements, biome: node.biome, party: partyUnits });
      const res = runBattleToEnd(ctx, timers);
      if (res.stuck) { stuckCount++; continue; }
      const State = ctx.State;
      totalRounds += State.round;
      if (State.winner === "party") {
        wins++;
        const alive = State.units.filter(u => u.side === "party");
        const hpSum = alive.reduce((s, u) => s + Math.max(0, u.hp), 0);
        const hpMaxSum = alive.reduce((s, u) => s + u.hpMax, 0);
        totalHpPct += hpMaxSum ? (100 * hpSum / hpMaxSum) : 0;
        totalDeaths += alive.filter(u => u.dead).length;
      }
    } catch (e) {
      errorCount++;
      if (errors.length < 3) errors.push(e.message);
    }
  }
  return {
    n, wins, winRate: n ? (100 * wins / n) : 0,
    avgRounds: n ? (totalRounds / n) : 0,
    avgHpPct: wins ? (totalHpPct / wins) : 0,
    avgDeaths: wins ? (totalDeaths / wins) : 0,
    stuckCount, errorCount, errors
  };
}

// ---------------------------------------------------------------
function band(node) {
  const t = node.objective && node.objective.type;
  if (t === "boss") return { lo: 60, hi: 85, roundsLo: 5, roundsHi: 9, label: "boss" };
  if (t === "survive") return { lo: 70, hi: 90, roundsLo: null, roundsHi: null, label: "survive" };
  return { lo: 75, hi: 95, roundsLo: 4, roundsHi: 7, label: "normal" };
}

function suggestFix(node, stats, b) {
  const enemyCount = (node.enemies || []).length;
  if (stats.winRate < b.lo) {
    return "Çok zor: düşman HP'sini ~%10-15 azaltın (veya " + Math.max(1, enemyCount - 1) + " düşmana indirin)" +
      (node.reinforcements && node.reinforcements.length ? ", takviye roundunu 1-2 tur geciktirin" : "") +
      ", ya da rewards.gold/items'ı artırıp önceki kampta daha iyi ekipman alınmasını sağlayın.";
  }
  if (stats.winRate > b.hi) {
    return "Çok kolay: düşman HP'sini ~%10-20 artırın" +
      (enemyCount < 4 ? " veya 1 düşman daha ekleyin" : "") +
      (!node.reinforcements ? "; erken bir round'da (ör. round 2-3) küçük bir takviye eklemeyi düşünün" : "") + ".";
  }
  if (b.roundsLo != null && stats.avgRounds < b.roundsLo) {
    return "Savaş çok kısa sürüyor (round " + stats.avgRounds.toFixed(1) + "): düşman HP'sini biraz artırın ki taktik/AP yönetimi anlamlı olsun.";
  }
  if (b.roundsLo != null && stats.avgRounds > b.roundsHi) {
    return "Savaş çok uzun sürüyor (round " + stats.avgRounds.toFixed(1) + "): düşman HP'sini biraz azaltın veya ekibin hasar çıktısını (silah/büyü) gözden geçirin.";
  }
  return null;
}

// ---------------------------------------------------------------
function mean(arr) { return arr.reduce((s, v) => s + v, 0) / arr.length; }
function main() {
  console.log("=== Turn Based War — KAMPANYA DENGESİ simülatörü ===");
  console.log("Savaş başına koşu sayısı: " + N_PER_NODE + " (referans başına " + N_PER_REF + " × " + N_REFS + " referans) · Zorluk: " + DIFFICULTY_ARG + "\n");

  const { sandbox, context, loaded, failed } = loadEngine();
  console.log("Yüklenen dosyalar: " + loaded.join(", "));
  if (failed.length) { console.log("YÜKLENEMEYEN dosyalar:"); for (const f of failed) console.log("  - " + f.file + ": " + f.error); }

  if (typeof context.getCampaign !== "function" || typeof context.setupBattle !== "function") {
    console.log("\ngetCampaign()/setupBattle() bulunamadı — campaign-sim uygulanabilir değil (skip).");
    process.exit(0);
  }

  const timers = attachSyncTimers(sandbox);
  installHeroToBattleUnitFix(context); // artık gereksiz (P0-4 dosyada düzeltildi) ama zararsız — bkz. yorum yukarıda

  const campaign = context.getCampaign();
  const battleNodeIds = new Set();
  for (const ch of campaign.chapters) for (const n of ch.nodes) if (n.type === "battle") battleNodeIds.add(n.id);
  console.log("CAMPAIGN'da " + battleNodeIds.size + " savaş düğümü bulundu (" + campaign.chapters.length + " bölüm).\n");

  // ---- N_REFS bağımsız referans koşusu ----
  const nodeEntryStatesByRef = []; // [{nodeId: entryState}, ...] N_REFS elemanlı
  for (let r = 0; r < N_REFS; r++) {
    const freshGS = context.freshGameState();
    freshGS.difficulty = DIFFICULTY_ARG;
    setGlobal(context, "GameState", freshGS);
    context.GameState.party = context.defaultHeroes().map(h => context.heroToPersistent(h));
    console.log("--- Referans #" + (r + 1) + "/" + N_REFS + " oynanıyor ---");
    const { nodeEntryState, visitLog } = buildReferencePlaythrough(context, timers);
    for (const v of visitLog) {
      console.log("  " + v.id + " (" + v.title + "): " + v.attempts + " denemede kazanıldı" + (v.stuck ? " [TAKILDI!]" : ""));
    }
    console.log("  Sonu ekip seviyeleri: " + context.GameState.party.map(h => h.name + " Lv" + h.level + " " + h.cls).join(", "));
    nodeEntryStatesByRef.push(nodeEntryState);
  }
  const missing = [...battleNodeIds].filter(id => !nodeEntryStatesByRef.every(m => m[id]));
  if (missing.length) console.log("UYARI: en az bir referansta entry-state alınamayan düğümler: " + missing.join(", "));

  console.log("\n--- Her savaş düğümü için " + N_REFS + " referans × " + N_PER_REF + " koşu (ortalama + min-max) ---\n");
  const rows = [];
  let totalAvgRounds = 0, nodeCountForDuration = 0;
  for (const ch of campaign.chapters) {
    for (const node of ch.nodes) {
      if (node.type !== "battle") continue;
      const entries = nodeEntryStatesByRef.map(m => m[node.id]).filter(Boolean);
      if (!entries.length) { console.log(node.id + ": hiçbir referansta entry-state yok, atlanıyor."); continue; }
      const perRefStats = entries.map(entry => simulateNode(context, timers, node, entry, N_PER_REF));
      const winRates = perRefStats.map(s => s.winRate);
      const avgRoundsArr = perRefStats.map(s => s.avgRounds);
      const stats = {
        n: N_PER_REF * entries.length,
        winRate: mean(winRates), winRateMin: Math.min(...winRates), winRateMax: Math.max(...winRates),
        avgRounds: mean(avgRoundsArr), avgRoundsMin: Math.min(...avgRoundsArr), avgRoundsMax: Math.max(...avgRoundsArr),
        avgHpPct: mean(perRefStats.map(s => s.avgHpPct)),
        avgDeaths: mean(perRefStats.map(s => s.avgDeaths)),
        stuckCount: perRefStats.reduce((s, x) => s + x.stuckCount, 0),
        errorCount: perRefStats.reduce((s, x) => s + x.errorCount, 0),
        errors: perRefStats.flatMap(s => s.errors)
      };
      const partyLevelStr = entries[0].party.map(h => "Lv" + h.level).join("/");
      const b = band(node);
      const inBand = stats.winRate >= b.lo && stats.winRate <= b.hi &&
        (b.roundsLo == null || (stats.avgRounds >= b.roundsLo && stats.avgRounds <= b.roundsHi));
      const fix = inBand ? null : suggestFix(node, stats, b);
      const highVariance = (stats.winRateMax - stats.winRateMin) > 25;
      rows.push({ id: node.id, title: node.title, chapter: ch.id, type: b.label, partyLevelStr, stats, inBand, fix, optional: !!node.optional, highVariance });
      if (!node.optional) { totalAvgRounds += stats.avgRounds; nodeCountForDuration++; }
      console.log(
        node.id.padEnd(10) + " " + (node.title || "").padEnd(22) + " [" + b.label + "]" +
        "  kazanma:" + stats.winRate.toFixed(1) + "% (" + stats.winRateMin.toFixed(0) + "-" + stats.winRateMax.toFixed(0) + ")" +
        "  round:" + stats.avgRounds.toFixed(1) + " (" + stats.avgRoundsMin.toFixed(1) + "-" + stats.avgRoundsMax.toFixed(1) + ")" +
        "  HP%:" + stats.avgHpPct.toFixed(0) + "  ölüm:" + stats.avgDeaths.toFixed(2) +
        "  stuck:" + stats.stuckCount + "  hata:" + stats.errorCount +
        (inBand ? "  [BANT İÇİNDE]" : "  [BANT DIŞI!]") + (highVariance ? "  [YÜKSEK VARYANS]" : "")
      );
      if (fix) console.log("    -> Öneri: " + fix);
    }
  }

  const estSeconds = totalAvgRounds * SEC_PER_ROUND;
  console.log("\n--- Süre tahmini ---");
  console.log("Zorunlu savaş düğümü sayısı (b1opt/b4cave hariç, ana yol): " + nodeCountForDuration);
  console.log("Toplam ortalama round (ana yol): " + totalAvgRounds.toFixed(1));
  console.log("Round başına varsayım: ~" + SEC_PER_ROUND + " sn (gerçek oyuncu)");
  console.log("Tahmini toplam savaş süresi: ~" + Math.round(estSeconds / 60) + " dakika" +
    " (yalnızca savaşlar; hikâye/kamp/mağaza ekranları dahil değil — CONTRACT'taki 30dk hedefi bunlarla birlikte değerlendirilmeli)");

  console.log("\n=== ÖZET (bant dışı savaşlar) ===");
  const offBand = rows.filter(r => !r.inBand);
  if (!offBand.length) console.log("Tüm savaşlar hedef bant içinde.");
  else for (const r of offBand) console.log("  " + r.id + " (" + r.title + ", " + r.type + "): kazanma %" + r.stats.winRate.toFixed(1) + ", round " + r.stats.avgRounds.toFixed(1) + " — " + r.fix);

  console.log("\n=== ÖZET (referanslar arası yüksek varyans, >25 puan kazanma farkı) ===");
  const highVar = rows.filter(r => r.highVariance);
  if (!highVar.length) console.log(N_REFS > 1 ? (N_REFS + " referans arasında yüksek varyanslı düğüm yok.") : "Tek referans ile varyans ölçülemedi (--refs 1).");
  else for (const r of highVar) console.log("  " + r.id + " (" + r.title + "): kazanma " + r.stats.winRateMin.toFixed(0) + "%-" + r.stats.winRateMax.toFixed(0) + "% arası (referanslar arası ekip durumu farkı tek koşuyu güvenilmez kılıyor)");

  console.log("\n(exit code 0 — keşif/rapor betiği; sonuçlar docs/TEST_REPORT.md'ye elle aktarılır.)");
}

main();
