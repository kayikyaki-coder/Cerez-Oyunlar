// sim.js — Denge simülasyonu: farklı oyuncu tipleriyle (gündelik / iyi / hep atla / karışık) tam oyun koşturur,
// oyna-vs-atla eşli kâr oranını, kazanma gününü, seviye/para eğrilerini, baloncuk/müşteri sayılarını ve tahmini oyun süresini raporlar.
// Kullanım: node tools/sim.js [--seeds 12] [--days 90] [--set anahtar=değer ...] [--days-table] [--quiet]
//   --set: BALANCE üzerinde geçici değişiklik (ör. --set bubbleRewardMult=0.5) — hızlı deneme için; kalıcı sayılar data.js'te.
"use strict";
const path = require("path");
const { Game } = require(path.join(__dirname, "../js/engine.js"));

// ---------- argümanlar ----------
const argv = process.argv.slice(2);
const opt = { seeds: 12, days: 90, daysTable: false, quiet: false, sets: [], decomp: false };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--seeds") opt.seeds = +argv[++i];
  else if (a === "--days") opt.days = +argv[++i];
  else if (a === "--set") opt.sets.push(argv[++i]);
  else if (a === "--days-table") opt.daysTable = true;
  else if (a === "--quiet") opt.quiet = true;
  else if (a === "--decomp") opt.decomp = true;
}
for (const s of opt.sets) {
  const [k, v] = s.split("=");
  BALANCE[k] = isNaN(+v) ? JSON.parse(v) : +v;
}
const SEEDS = Array.from({ length: opt.seeds }, (_, i) => 1000 + i * 7919);

// ---------- yardımcılar ----------
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const median = a => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pct = (a, p) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const f1 = x => (isFinite(x) ? x.toFixed(1) : "—"), f2 = x => (isFinite(x) ? x.toFixed(2) : "—"), f0 = x => (isFinite(x) ? String(Math.round(x)) : "—");
const pad = (s, n) => String(s).padStart(n);

// ---------- sabah politikası ----------
// Öncelik: ürün kilidi (talep getirir) > müşteri/raf > memnuniyet/konfor > personel/dekor. Final alınabiliyorsa ona biriktir.
const PRIORITY = ["tabela", "raf", "kediyatagi", "onluk", "buzdolabi", "bitkiler", "yazarkasa", "toptanci", "paspas",
  "lamba", "vitrin", "tente", "muzik", "cirak"];
const FINAL = UPGRADES.find(u => u.cat === "final" || (u.levels[0].effect || {}).final);

function morning(P) {
  const S = Game.state;
  // 1) Final: alınabiliyorsa hemen al
  if (FINAL && Game.upgradeAvailable(FINAL.id) && Game.canAfford(Game.nextUpgradeCost(FINAL.id))) { Game.buyUpgrade(FINAL.id); }
  // 2) Rafları doldur (stok önce gelir)
  Game.fillAll();
  if (S.won) return;
  const savingForFinal = FINAL && Game.upgradeAvailable(FINAL.id);
  // Stok için yedek: dünkü stok harcamasının bir kısmı (ertesi sabah raflar dolabilsin, acil tedarik yapılabilsin)
  const reserve = Math.max(15, Math.round(0.35 * (P.lastStock || 30)));
  // 3) Ürün kilitleri: seviye yetiyor ve para (yedek dahil) yetiyorsa aç
  if (!savingForFinal) {
    for (const p of PRODUCTS.slice().sort((a, b) => a.unlockCost - b.unlockCost)) {
      if (Game.canUnlock(p.id) && S.money - p.unlockCost >= reserve) { Game.unlockProduct(p.id); Game.fillAll(); }
    }
  }
  // 4) Yükseltmeler
  if (savingForFinal) return;
  // Hedef seçimi: maliyet × öncelik çarpanı (listede öndekiler biraz daha "ucuz" görünür) → en düşük skor hedeftir.
  for (let guard = 0; guard < 10; guard++) {
    const score = id => Game.nextUpgradeCost(id) * (1 + 0.12 * PRIORITY.indexOf(id));
    const cands = PRIORITY.filter(id => Game.upgradeAvailable(id)).sort((a, b) => score(a) - score(b));
    if (!cands.length) break;
    const target = cands[0], cost = Game.nextUpgradeCost(target);
    if (S.money - cost >= reserve) { Game.buyUpgrade(target); continue; }
    break;   // parası yetmiyor → hedefe biriktir
  }
}

// ---------- tek gün (oyna ya da atla) ----------
function runDay(mode, pol, prng) {
  const S = Game.state;
  const startMoney = S.money;
  Game.startDay({ mode });
  const run = Game.run;
  const dt = 0.25, gap = 0.18;
  const taps = []; let busy = 0;
  const bubbleTypes = {}; let bubbles = 0, customers = 0;
  const addTap = (t, id) => { let i = taps.length; while (i > 0 && taps[i - 1].t > t) i--; taps.splice(i, 0, { t, id }); };
  let guard = 0;
  while (!run.dayEndEmitted && guard++ < 200000) {
    const next = taps.length ? taps[0].t : Infinity;
    const evs = Game.tick(Math.min(dt, Math.max(1e-4, next - run.t)));
    for (const ev of evs) {
      if (ev.type === "customerEnter" && !String(ev.cid).startsWith("reg-")) customers++;
      if (ev.type !== "bubbleSpawn") continue;
      const b = ev.bubble; bubbles++; bubbleTypes[b.type] = (bubbleTypes[b.type] || 0) + 1;
      if (!pol || prng() >= pol.hitRate) continue;
      // İnsan tek parmakla sırayla basar: tepki süresi (±%30) ama önceki baloncuğu bitirmeden başlayamaz
      let t = Math.max(b.spawnT + pol.reactSec * (0.7 + 0.6 * prng()), busy);
      for (let k = 0; k < b.taps; k++) addTap(t + k * gap, b.id);
      busy = t + b.taps * gap;
    }
    while (taps.length && taps[0].t <= run.t + 1e-9) Game.tapBubble(taps.shift().id);
  }
  const s = Game.endDay();
  s._bubbles = bubbles; s._bubbleTypes = bubbleTypes; s._customers = customers;
  return s;
}

// ---------- tam oyun ----------
const PLAYERS = [
  { name: "gündelik", pol: { hitRate: 0.7, reactSec: 1.3 }, playFrac: 1 },
  { name: "iyi", pol: { hitRate: 0.9, reactSec: 0.8 }, playFrac: 1 },
  { name: "hep atla", pol: null, playFrac: 0 },
  { name: "karışık %70", pol: { hitRate: 0.7, reactSec: 1.3 }, playFrac: 0.7 }
];

function playGame(P, seed, maxDays) {
  Game.newGame(seed);
  const prng = rng(seed ^ 0xABCD), choose = rng(seed ^ 0x1234);
  const ctx = { lastStock: 30 };
  const days = [];
  let wonDay = null, playSec = 0;
  for (let d = 1; d <= maxDays; d++) {
    const moneyBefore = Game.state.money;
    morning(ctx);
    if (Game.state.won && wonDay === null) { wonDay = Game.state.wonDay; playSec += 25; break; }  // final alındı → final sahnesi
    ctx.lastStock = Game.state.todayStockCost;
    const play = P.pol && choose() < P.playFrac;
    const plan = Game.planDay();
    const sk = play && opt.decomp ? Game.simulateClone("skip") : null;
    const s = runDay(play ? "play" : "skip", play ? P.pol : null, prng);
    playSec += play ? BALANCE.dayLength + 25 : 15;
    days.push({ day: d, play, profit: s.profit, skipProfit: play ? s.estSkipProfit : s.profit, net: s.net,
      level: Game.state.level, rep: Game.state.rep, money: Game.state.money, bubbles: s._bubbles, types: s._bubbleTypes, customers: s._customers,
      satEnd: s.satEnd, popped: s.popped, missed: s.missedBubbles, bubbleIncome: s.bubbleIncome, revenue: s.revenue,
      weather: s.weather, event: s.event, weekday: plan.weekday.id, planCust: plan.customers, lost: s.lostCustomers, missCust: s.missed,
      goal: s.goal, goalDone: s.goalDone, tips: s.tips, goalMoney: s.goalDone ? s.goalReward.money : 0, emerg: s.emergencyCost, pen: s.moneyPenalty, stockDelta: s.stockDelta, sk });
  }
  return { days, wonDay, playSec, final: Game.state };
}

// ---------- rapor ----------
function main() {
const RANGES = [[1, 15], [16, 35], [36, 999]];
const results = {};
for (const P of PLAYERS) results[P.name] = SEEDS.map(sd => playGame(P, sd, opt.days));

function pairedRatio(games, a, b) {
  const per = games.map(g => {
    const ds = g.days.filter(x => x.play && x.day >= a && x.day <= b);
    if (!ds.length) return NaN;
    return ds.reduce((t, x) => t + x.profit, 0) / Math.max(1, ds.reduce((t, x) => t + x.skipProfit, 0));
  }).filter(isFinite);
  return { mean: mean(per), min: Math.min(...per), max: Math.max(...per) };
}

const out = [];
const log = s => out.push(s);
log(`Köşe Market denge simülasyonu — ${SEEDS.length} tohum, en fazla ${opt.days} gün, dayLength=${BALANCE.dayLength}s` + (opt.sets.length ? `  [--set ${opt.sets.join(" ")}]` : ""));
log("");
log("1) EŞLİ KÂR ORANI (oynanan günün kârı / aynı başlangıçtan klon-atla kârı), tohum ortalaması [min–max]");
log("oyuncu          | gün 1–15            | gün 16–35           | gün 36+");
for (const P of PLAYERS) {
  if (!P.pol) continue;
  const cells = RANGES.map(([a, b]) => { const r = pairedRatio(results[P.name], a, b); return `${f2(r.mean)} [${f2(r.min)}–${f2(r.max)}]`.padEnd(19); });
  log(`${P.name.padEnd(15)} | ${cells.join(" | ")}`);
}
log("");
log("2) KAZANMA GÜNÜ (final alındı) ve TAHMİNİ OYUN SÜRESİ (oynanan gün = dayLength+25 sn, atlanan = 15 sn)");
log("oyuncu          | kazanan | medyan | min–max   | süre dk medyan [min–max]");
for (const P of PLAYERS) {
  const g = results[P.name], wins = g.map(x => x.wonDay).filter(x => x !== null);
  const mins = g.filter(x => x.wonDay !== null).map(x => x.playSec / 60);
  log(`${P.name.padEnd(15)} | ${pad(wins.length + "/" + g.length, 7)} | ${pad(f0(median(wins)), 6)} | ${pad(wins.length ? Math.min(...wins) + "–" + Math.max(...wins) : "—", 9)} | ${mins.length ? f0(median(mins)) + " [" + f0(Math.min(...mins)) + "–" + f0(Math.max(...mins)) + "]" : "—"}`);
}
log("");
log("3) SEVİYE / PARA / GÜNLÜK KÂR EĞRİSİ (tohum medyanı; kazananlar oyundan çıkınca listeden düşer)");
const CHECK = [1, 3, 5, 8, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 90].filter(d => d <= opt.days);
log("gün  | " + PLAYERS.map(P => `${P.name} sv/itibar/₺/kâr`.padEnd(26)).join(" | "));
for (const d of CHECK) {
  const cells = PLAYERS.map(P => {
    const rows = results[P.name].map(g => g.days.find(x => x.day === d)).filter(Boolean);
    if (!rows.length) return "(bitti)".padEnd(26);
    return `${f1(median(rows.map(r => r.level)))}/${f0(median(rows.map(r => r.rep)))}/${f0(median(rows.map(r => r.money)))}/${f0(median(rows.map(r => r.profit)))}`.padEnd(26);
  });
  log(`${pad(d, 4)} | ${cells.join(" | ")}`);
}
log("");
log("4) GÜNLÜK ORTALAMALAR (oynanan / atlanan günler, gündelik & hep atla)");
for (const [name, playFlag] of [["gündelik", true], ["hep atla", false]]) {
  for (const [a, b] of RANGES) {
    const rows = results[name].flatMap(g => g.days.filter(x => x.day >= a && x.day <= b && x.play === playFlag));
    if (!rows.length) continue;
    log(`${name.padEnd(9)} gün ${a}–${b === 999 ? "son" : b}: baloncuk/gün=${f1(mean(rows.map(r => r.bubbles)))} (p10 ${pct(rows.map(r => r.bubbles), 0.1)}, p90 ${pct(rows.map(r => r.bubbles), 0.9)})` +
      `  müşteri/gün=${f1(mean(rows.map(r => r.customers)))} (p10 ${pct(rows.map(r => r.customers), 0.1)}, p90 ${pct(rows.map(r => r.customers), 0.9)})` +
      `  kaçan müşteri=${f1(mean(rows.map(r => r.lost)))} bulamayan=${f1(mean(rows.map(r => r.missCust)))}` +
      `  memnuniyet(gün sonu)=${f1(mean(rows.map(r => r.satEnd)))}  baloncuk ₺=${f0(mean(rows.map(r => r.bubbleIncome)))} ciro=${f0(mean(rows.map(r => r.revenue)))} kâr=${f0(mean(rows.map(r => r.profit)))}`);
  }
}
{
  const rows = results["karışık %70"].flatMap(g => g.days);
  const pl = rows.filter(r => r.play), sk = rows.filter(r => !r.play);
  log(`karışık: oynanan gün memnuniyet=${f1(mean(pl.map(r => r.satEnd)))}  atlanan gün memnuniyet=${f1(mean(sk.map(r => r.satEnd)))}`);
}
{
  const all = results["gündelik"].flatMap(g => g.days);
  const neg = all.filter(r => r.profit < 0);
  log(`gündelik: negatif kârlı gün = ${neg.length}/${all.length}` + (neg.length ? ` (örn. gün ${neg.slice(0, 6).map(r => r.day + ":" + r.profit + (r.event ? "/" + r.event : "")).join(", ")})` : ""));
  const skAll = results["hep atla"].flatMap(g => g.days), skNeg = skAll.filter(r => r.profit < 0);
  log(`hep atla: negatif kârlı gün = ${skNeg.length}/${skAll.length}`);
}
log("");
log("5) GÜN ÇEŞİTLİLİĞİ (gündelik, gün 16–40): müşteri ve baloncuk sayısının hafta günü / hava / olaya göre ortalaması");
{
  const rows = results["gündelik"].flatMap(g => g.days.filter(x => x.day >= 16 && x.day <= 40));
  const group = (key) => {
    const m = {};
    for (const r of rows) { const k = r[key] || "(olaysız)"; (m[k] = m[k] || []).push(r); }
    return Object.entries(m).sort((a, b) => mean(b[1].map(r => r.customers)) - mean(a[1].map(r => r.customers)))
      .map(([k, rs]) => `${k}:${f0(mean(rs.map(r => r.customers)))}m/${f0(mean(rs.map(r => r.bubbles)))}b(n${rs.length})`).join("  ");
  };
  log("hafta günü: " + group("weekday"));
  log("hava:       " + group("weather"));
  log("olay:       " + group("event"));
  const cs = rows.map(r => r.customers), bs = rows.map(r => r.bubbles);
  log(`yayılım: müşteri p10–p90 = ${pct(cs, 0.1)}–${pct(cs, 0.9)} (min ${Math.min(...cs)}, max ${Math.max(...cs)}); baloncuk p10–p90 = ${pct(bs, 0.1)}–${pct(bs, 0.9)}`);
  // Baloncuk karışımı: havaya göre en baskın 3 tür
  const byW = {};
  for (const r of rows) { const m = (byW[r.weather] = byW[r.weather] || {}); for (const [t, n] of Object.entries(r.types)) m[t] = (m[t] || 0) + n; }
  log("hava → en sık baloncuklar: " + Object.entries(byW).map(([w, m]) => {
    const tot = Object.values(m).reduce((a, b) => a + b, 0);
    return `${w}[` + Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t, n]) => `${t} ${Math.round(100 * n / tot)}%`).join(", ") + "]";
  }).join("  "));
}
log("");
log("6) YÜKSELTME ZAMANLAMASI (gündelik, medyan satın alma günü)");
{
  // Her tohum için yeniden oynatmak yerine son durumdan değil — gün gün izle
  const buyDays = {};
  for (const sd of SEEDS) {
    Game.newGame(sd);
    const prng = rng(sd ^ 0xABCD), ctx = { lastStock: 30 };
    let prev = {};
    for (let d = 1; d <= opt.days; d++) {
      morning(ctx);
      for (const [id, l] of Object.entries(Game.state.upgrades)) for (let k = (prev[id] || 0) + 1; k <= l; k++) (buyDays[id + ":" + k] = buyDays[id + ":" + k] || []).push(d);
      prev = Object.assign({}, Game.state.upgrades);
      if (Game.state.won) break;
      ctx.lastStock = Game.state.todayStockCost;
      runDay("play", PLAYERS[0].pol, prng);
    }
  }
  const items = Object.entries(buyDays).sort((a, b) => median(a[1]) - median(b[1]));
  log(items.map(([k, ds]) => `${k}@${f0(median(ds))}${ds.length < SEEDS.length ? "(" + ds.length + "/" + SEEDS.length + ")" : ""}`).join("  "));
  const md = items.map(([, ds]) => median(ds));
  const gaps = md.slice(1).map((x, i) => x - md[i]);
  log(`ardışık alımlar arası medyan gün farkı: ${f1(median(gaps))}  (toplam ${items.length} alım)`);
}

// ---------- hedef kontrolü ----------
  log("");
  log("7) HEDEF KONTROLÜ");
  {
    const ok = (c, t) => log(`${c ? "✔" : "✘"} ${t}`);
    const cas = results["gündelik"], good = results["iyi"], skip = results["hep atla"];
    const r1 = pairedRatio(cas, 1, 15), r2 = pairedRatio(cas, 16, 35), r3 = pairedRatio(cas, 36, 999);
    ok(r1.mean >= 1.25 && r1.mean <= 1.6 && r1.min >= 1.2, `gündelik eşli oran gün 1–15 = ${f2(r1.mean)} (min ${f2(r1.min)}) ∈ [1.25, 1.6], her tohum ≥ 1.20`);
    ok(Math.min(r2.mean, r3.mean) >= 1.15 && Math.max(r2.mean, r3.mean) <= 1.45, `gündelik eşli oran gün 16+ = ${f2(r2.mean)} / ${f2(r3.mean)} ∈ [1.15, 1.45]`);
    const g1 = pairedRatio(good, 1, 15), g2 = pairedRatio(good, 16, 35);
    ok(g1.mean > r1.mean + 0.05 && g2.mean > r2.mean + 0.03, `iyi oyuncu farkı belirgin: ${f2(g1.mean)} vs ${f2(r1.mean)} (erken), ${f2(g2.mean)} vs ${f2(r2.mean)} (orta)`);
    const wd = g => median(g.map(x => x.wonDay).filter(x => x !== null));
    ok(wd(cas) >= 45 && wd(cas) <= 55, `gündelik kazanma günü medyanı ${wd(cas)} ∈ [45, 55]`);
    ok(wd(good) >= 40 && wd(good) <= 48, `iyi oyuncu kazanma günü medyanı ${wd(good)} ∈ [40, 48]`);
    const sw = skip.map(x => x.wonDay);
    ok(sw.every(x => x === null || x > 70), `hep atla 70. günden önce kazanmıyor (medyan ${f0(median(sw.filter(x => x !== null)))}, ${sw.filter(x => x !== null).length}/${sw.length} kazandı)`);
    ok(skip.every(g => g.final.level >= 5), `hep atla da ilerliyor (son seviye min ${Math.min(...skip.map(g => g.final.level))})`);
    const mins = median(cas.map(x => x.playSec / 60));
    ok(mins >= 75 && mins <= 100, `gündelik tahmini süre ${f0(mins)} dk ∈ [75, 100]`);
    const early = cas.flatMap(g => g.days.filter(x => x.day <= 10)).map(r => r.bubbles), late = cas.flatMap(g => g.days.filter(x => x.day >= 36)).map(r => r.bubbles);
    ok(mean(early) >= 10 && mean(early) <= 14.5 && mean(late) >= 18 && mean(late) <= 24.5, `baloncuk/gün erken(1–10) ${f1(mean(early))}, geç(36+) ${f1(mean(late))}; ekranda en fazla ${BALANCE.bubbleMaxOnScreen}`);
    const neg = cas.flatMap(g => g.days).filter(r => r.profit < 0).length;
    ok(neg === 0, `gündelik oyuncuda negatif kârlı gün: ${neg}`);
  }

if (opt.decomp) {
  log("");
  log("FARK AYRIŞTIRMA (gündelik, oynanan − klon-atla, gün başına ortalama)");
  for (const [a, b] of RANGES) {
    const rows = results["gündelik"].flatMap(g => g.days.filter(x => x.play && x.sk && x.day >= a && x.day <= b));
    if (!rows.length) continue;
    const d = f => f0(mean(rows.map(f)));
    log(`gün ${a}–${b}: kâr ${d(r => r.profit)} vs ${d(r => r.sk.profit)} | ciro +${d(r => r.revenue - r.sk.revenue)} baloncuk +${d(r => r.bubbleIncome)} bahşiş +${d(r => r.tips - r.sk.tips)}` +
      ` hedef +${d(r => r.goalMoney - (r.sk.goalDone ? r.sk.goalReward.money : 0))} acil tedarik −${d(r => r.emerg - r.sk.emergencyCost)} para cezası ${d(r => r.sk.moneyPenalty - r.pen)} raf değeri ${d(r => r.stockDelta - r.sk.stockDelta)}` +
      ` | kaçan müşteri atla=${d(r => r.sk.lostCustomers)} oyna=${d(r => r.lost)}  bulamayan atla=${d(r => r.sk.missed)} oyna=${d(r => r.missCust)}`);
  }
}

if (opt.daysTable) {
  log("");
  log("GÜN TABLOSU (gündelik, ilk tohum): gün | sv | ₺ | kâr | klon-atla kâr | oran | baloncuk | müşteri | memn. | olay");
  for (const r of results["gündelik"][0].days)
    log(`${pad(r.day, 3)} | ${pad(r.level, 2)} | ${pad(Math.round(r.money), 6)} | ${pad(r.profit, 5)} | ${pad(r.skipProfit, 5)} | ${pad(f2(r.profit / Math.max(1, r.skipProfit)), 5)} | ${pad(r.bubbles, 3)} | ${pad(r.customers, 3)} | ${pad(r.satEnd, 3)} | ${r.weekday} ${r.weather} ${r.event || ""}`);
}
console.log(out.join("\n"));
}

if (require.main === module) main();
module.exports = { morning, runDay, playGame, rng, PLAYERS };
