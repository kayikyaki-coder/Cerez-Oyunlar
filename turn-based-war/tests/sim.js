// sim.js — headless denge simülatörü.
// Motoru node vm'de yükler, setTimeout'u ANINDA çalıştıracak şekilde stub'lar (böylece
// runEnemyTurn/ai.js'in setTimeout zinciri senkron gibi ilerler), basit bir oyuncu AI'sı ile
// oynatıp N savaş simüle eder. CAMPAIGN tanımlıysa (ileride) her düğümü ayrı ayrı da
// çalıştırabilecek şekilde tasarlanmıştır (bkz. runCampaignIfPresent).
"use strict";
const { loadEngine } = require("./load-engine");

const N_BATTLES = parseInt(process.argv[2], 10) || 500;
const MAX_TURNS_PER_BATTLE = 400; // takılmayı tespit etmek için sert üst sınır

// ---------------------------------------------------------------
// setTimeout'u SENKRON kuyruk olarak çalıştıran bir "mikro event loop" kur.
// ai.js act() zincirleri setTimeout(act, ms) ile ilerliyor; burada her setTimeout çağrısı
// hemen bir kuyruğa yazılır ve drainQueue() FIFO olarak hepsini (yenileri de dahil) tüketir.
function attachSyncTimers(sandbox) {
  const queue = [];
  sandbox.setTimeout = (fn, ms) => { queue.push(fn); return queue.length; };
  sandbox.clearTimeout = () => {};
  return {
    drain(maxSteps) {
      let steps = 0;
      while (queue.length && steps < maxSteps) {
        const fn = queue.shift();
        fn();
        steps++;
      }
      return { steps, stuck: queue.length > 0 };
    }
  };
}

// ---------------------------------------------------------------
// Basit oyuncu AI'sı: en yakın düşmana yaklaş/saldır, büyücü/cleric ise uygun büyü/heal kullan,
// mümkünse önce saldır (menzildeyse), sonra hareket et, AP kalmayınca turu bitir.
function playPartyTurn(ctx, u) {
  const State = ctx.State;
  let guard = 0;
  while (State.phase === "playerInput" && ctx.cur() === u && !u.dead && guard < 12) {
    guard++;
    const enemies = State.units.filter(t => !t.dead && t.side !== "party");
    if (!enemies.length) { ctx.endTurn(); return; }

    // 1) Menzildeyse ve saldırı hakkı varsa saldır (cleric/wizard önce heal/spell dener)
    if (u.canHeal && !u.hasHealed && u.ap >= 1) {
      const wounded = State.units.filter(t => !t.dead && t.side === "party" && t.hp / t.hpMax < 0.5 && ctx.hexDist(u, t) <= u.heal.range);
      if (wounded.length) { ctx.doHeal(u, wounded.sort((a, b) => a.hp - b.hp)[0]); continue; }
    }
    if (u.ap >= 2 && !u.hasAttacked) {
      const inRange = enemies.filter(t => ctx.hexDist(u, t) <= u.attack.range);
      if (inRange.length) {
        const target = inRange.sort((a, b) => a.hp - b.hp)[0];
        ctx.doAttack(u, target);
        u.ap -= 2; u.hasAttacked = true;
        if (ctx.applyFighterExtraAttackCheck) ctx.applyFighterExtraAttackCheck(u);
        ctx.checkEnd();
        continue;
      }
    }
    // 2) Menzilde değilse en yakın düşmana doğru hareket et
    if (u.ap >= 1 && ctx.canMove(u)) {
      const target = enemies.slice().sort((a, b) => ctx.hexDist(u, a) - ctx.hexDist(u, b))[0];
      const allow = ctx.moveAllowance(u);
      const dest = ctx.bestStepToward(u, target, allow);
      if (dest.q !== u.q || dest.r !== u.r) {
        u.q = dest.q; u.r = dest.r; u.movesUsed++; u.ap -= 1;
        continue;
      }
    }
    // 3) Fighter: HP düşükse Second Wind
    if (u.secondWindMax && u.secondWind > 0 && u.hp < u.hpMax * 0.5 && u.ap >= 1 && !u.swUsed) {
      ctx.doSecondWind(u);
      continue;
    }
    break;
  }
  if (State.phase === "playerInput" && ctx.cur() === u) ctx.endTurn();
}

// Bir savaşı sonuna kadar sürer. Döner: {winner, rounds, turns, stuck, classDamage}
function runOneBattle(ctx, timers, cfg) {
  const State = ctx.State;
  const classDamage = {}; // cls -> verilen toplam hasar (yaklaşık, log parse)
  ctx.setupBattle(cfg);

  // İlk startTurn zaten setupBattle içinde çağrıldı; eğer ilk birim enemy ise runEnemyTurn
  // setTimeout kuyruğuna act() koymuş olabilir — sync drain onu da tüketecek.
  let turns = 0;
  while (State.phase !== "over" && turns < MAX_TURNS_PER_BATTLE) {
    if (State.phase === "playerInput") {
      const u = ctx.cur();
      const hpBefore = {};
      for (const t of State.units) hpBefore[t.id] = t.hp;
      playPartyTurn(ctx, u);
      // sınıf-bazlı verilen hasarı kabaca ölç: düşmanların bu "adımda" kaybettiği HP
      for (const t of State.units) {
        if (t.side !== "party" && hpBefore[t.id] != null) {
          const dealt = Math.max(0, hpBefore[t.id] - t.hp);
          if (dealt > 0) classDamage[u.cls] = (classDamage[u.cls] || 0) + dealt;
        }
      }
      turns++;
    } else if (State.phase === "enemy") {
      // runEnemyTurn zaten startTurn/nextTurn içinden tetiklenmiş, setTimeout kuyruğunu boşalt
      const r = timers.drain(2000);
      if (r.stuck) return { winner: "stuck", rounds: State.round, turns, stuck: true, classDamage };
      turns++;
    } else {
      // beklenmeyen faz (setup vb.) — bir adım ilerlemeyi dene
      const r = timers.drain(50);
      turns++;
      if (r.steps === 0) break;
    }
  }
  // kalan zamanlayıcıları da tüket (savaş bitmiş olsa bile — sonraki savaşı kirletmesin)
  timers.drain(2000);

  if (turns >= MAX_TURNS_PER_BATTLE && State.phase !== "over") {
    return { winner: "timeout", rounds: State.round, turns, stuck: true, classDamage };
  }
  return { winner: State.winner, rounds: State.round, turns, stuck: false, classDamage };
}

function main() {
  console.log("=== Turn Based War — denge simülatörü ===");
  console.log("Savaş sayısı: " + N_BATTLES + "\n");

  const { sandbox, context, loaded, failed } = loadEngine();
  console.log("Yüklenen dosyalar: " + loaded.join(", "));
  if (failed.length) {
    console.log("YÜKLENEMEYEN dosyalar:");
    for (const f of failed) console.log("  - " + f.file + ": " + f.error);
  }
  if (typeof context.setupBattle !== "function") {
    console.log("\nsetupBattle bulunamadı — motor testi/sim uygulanabilir değil (skip).");
    process.exit(0);
  }
  const timers = attachSyncTimers(sandbox);

  // CAMPAIGN tanımlıysa (ileride) her savaş düğümünü kendi cfg'siyle ayrı simüle et.
  const nodes = collectCampaignBattleNodes(context);
  const runs = nodes.length ? nodes : [{ label: "varsayılan (data.js fallback)", cfg: undefined }];

  for (const run of runs) {
    console.log("\n--- " + run.label + " ---");
    simulateSet(context, timers, run.cfg, N_BATTLES);
  }
}

function collectCampaignBattleNodes(context) {
  const CAMPAIGN = context.CAMPAIGN;
  if (!CAMPAIGN || !Array.isArray(CAMPAIGN.chapters)) return [];
  const out = [];
  for (const ch of CAMPAIGN.chapters) {
    for (const node of (ch.nodes || [])) {
      if (node.type === "battle") {
        out.push({
          label: ch.id + "/" + node.id + " (" + (node.title || "") + ")",
          cfg: { map: node.map, enemies: node.enemies, objective: node.objective, biome: node.biome, reinforcements: node.reinforcements }
        });
      }
    }
  }
  return out;
}

function simulateSet(context, timers, cfg, n) {
  let wins = 0, losses = 0, stuckCount = 0, timeoutCount = 0, errorCount = 0;
  let totalRounds = 0;
  const classDamageTotal = {};
  const errors = [];

  for (let i = 0; i < n; i++) {
    try {
      const res = runOneBattle(context, timers, cfg);
      if (res.winner === "party") wins++;
      else if (res.winner === "enemy" || res.winner === "wolf") losses++;
      else if (res.winner === "stuck") { stuckCount++; }
      else if (res.winner === "timeout") { timeoutCount++; }
      totalRounds += res.rounds;
      for (const cls in res.classDamage) classDamageTotal[cls] = (classDamageTotal[cls] || 0) + res.classDamage[cls];
    } catch (e) {
      errorCount++;
      if (errors.length < 5) errors.push(e.message);
    }
  }

  console.log("Toplam savaş: " + n);
  console.log("Kazanma oranı (party): " + pct(wins, n) + "  (" + wins + "/" + n + ")");
  console.log("Kayıp oranı: " + pct(losses, n) + "  (" + losses + "/" + n + ")");
  console.log("Takılma (stuck — 2000 timer adımında bitmedi): " + stuckCount);
  console.log("Zaman aşımı (" + MAX_TURNS_PER_BATTLE + " tur sınırı): " + timeoutCount);
  console.log("Çalıştırma hatası (exception): " + errorCount + (errors.length ? "  örnek: " + errors.join(" | ") : ""));
  console.log("Ortalama round sayısı: " + (totalRounds / n).toFixed(1));
  console.log("Sınıf başına toplam verilen hasar (yaklaşık):");
  for (const cls in classDamageTotal) console.log("  " + cls + ": " + classDamageTotal[cls] + " (savaş başı ort. " + (classDamageTotal[cls] / n).toFixed(1) + ")");
}

function pct(a, b) { return b ? (100 * a / b).toFixed(1) + "%" : "n/a"; }

main();
