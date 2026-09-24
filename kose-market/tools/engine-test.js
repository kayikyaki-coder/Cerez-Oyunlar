// engine-test.js — Motor testi: 50 gün "hep atla" vs "hep oyna (hitRate .85, react 1.0 sn)" net karşılaştırması
// Kullanım: node tools/engine-test.js [seed] [days]
const path = require("path");
const { Game } = require(path.join(__dirname, "../js/engine.js"));

const SEED = +(process.argv[2] || 12345), DAYS = +(process.argv[3] || 50);
const HUMAN = { hitRate: 0.85, reactSec: 1.0 };

// Basit sabah politikası: dengeli doldur → en ucuz alınabilir yükseltme → en ucuz ürün kilidi
function morning() {
  Game.fillAll();
  const ups = UPGRADES.filter(u => Game.upgradeAvailable(u.id) && Game.canAfford(Game.nextUpgradeCost(u.id)))
    .sort((a, b) => Game.nextUpgradeCost(a.id) - Game.nextUpgradeCost(b.id));
  if (ups.length) Game.buyUpgrade(ups[0].id);
  const prods = PRODUCTS.filter(p => Game.canUnlock(p.id)).sort((a, b) => a.unlockCost - b.unlockCost);
  if (prods.length) Game.unlockProduct(prods[0].id);
}

function runGame(policy) {
  Game.newGame(SEED);
  const rows = [];
  for (let d = 1; d <= DAYS; d++) {
    morning();
    const s = Game.autoDay(policy);
    rows.push({ day: s.day, net: s.net, est: s.estSkipNet, prof: s.profit, estP: s.estSkipProfit, lvl: Game.state.level, money: Game.state.money,
      bub: s.bubbleIncome, pop: s.popped, miss: s.missedBubbles, lost: s.lostCustomers, cm: s.missed, ev: s.event, goal: s.goalDone });
  }
  return { rows, state: Game.state };
}

// Determinizm: aynı gün iki kez planlanınca aynı sonuç, klon gerçek durumu değiştirmez
Game.newGame(SEED); Game.fillAll();
const before = JSON.stringify(Game.state);
const a = Game.simulateClone("play", HUMAN), b = Game.simulateClone("play", HUMAN), k = Game.simulateClone("skip");
console.log("determinizm:", a.net === b.net ? "OK" : "FARKLI!", "| klon durumu bozmadı:", before === JSON.stringify(Game.state) ? "OK" : "BOZDU!",
  `| gün1 oyna=${a.net} atla=${k.net} mükemmel=${Game.simulateClone("play", "perfect").net}`);
// dt bağımsızlığı: skip'i farklı dt ile koştur
Game.newGame(SEED); Game.fillAll();
const snap = JSON.parse(JSON.stringify(Game.state));
Game.startDay({ mode: "skip" }); while (!Game.run.dayEndEmitted) Game.tick(0.016); const s1 = Game.endDay();
Game.state = JSON.parse(JSON.stringify(snap));
Game.startDay({ mode: "skip" }); while (!Game.run.dayEndEmitted) Game.tick(0.25); const s2 = Game.endDay();
console.log("dt bağımsızlığı (0.016 vs 0.25):", s1.net === s2.net ? "OK" : `FARKLI ${s1.net} / ${s2.net}`);

const skip = runGame("skip"), play = runGame(HUMAN);
console.log("\ngün | atla net (sv) | oyna net (sv, est.atla) | oyna/tahmin | olay");
for (let i = 0; i < DAYS; i++) {
  const s = skip.rows[i], p = play.rows[i];
  console.log(`${String(p.day).padStart(3)} | ${String(s.net).padStart(6)} (${s.lvl}) | ${String(p.net).padStart(6)} (${p.lvl}, ${String(p.est).padStart(5)}) | ${(p.net / Math.max(1, p.est)).toFixed(2).padStart(5)} | ${p.ev || ""}${p.goal ? " ✓hedef" : ""}`);
}
const sum = (rows, f, a, b) => rows.slice(a - 1, b).reduce((t, r) => t + f(r), 0);
for (const [a, b] of [[1, 15], [16, DAYS]]) {
  const sN = sum(skip.rows, r => r.net, a, b), pN = sum(play.rows, r => r.net, a, b), eN = sum(play.rows, r => r.est, a, b);
  const pP = sum(play.rows, r => r.prof, a, b), eP = sum(play.rows, r => r.estP, a, b);
  console.log(`\nGün ${a}-${b}: atla toplam net=${sN}  oyna toplam net=${pN}  oran=${(pN / sN).toFixed(3)}` +
    `  | eşli (aynı durumdan klon-atla) net oranı=${(pN / eN).toFixed(3)}  kâr oranı (raf değeri dahil)=${(pP / eP).toFixed(3)}`);
}
const fin = (st) => `kazanma günü=${st.wonDay} para=${Math.round(st.money)} sv=${st.level} itibar=${st.rep} yükseltme=${Object.values(st.upgrades).reduce((a, b) => a + b, 0)} kazandı=${st.won}`;
console.log("\nSon durum ATLA:", fin(skip.state));
console.log("Son durum OYNA:", fin(play.state));
