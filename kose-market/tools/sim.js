// sim.js — Denge simülasyonu. Oyuncu modelleri (dikkatli / ortalama / kötü / ihmalkâr / hep atla / karışık) tam oyun oynar;
// kazanma, iflas, süre dağılımı; mekanik kullanım istatistikleri; "dominant strateji var mı" testleri; yükseltme/ürün ROI'si.
// Kullanım: node tools/sim.js [--seeds 16] [--days 120] [--diff normal] [--players dikkatli,ortalama,...]
//           [--roi] [--dominance] [--diffs] [--table dikkatli] [--set anahtar=değer ...] [--strict] [--quick]
//   Varsayılan koşu: oyuncu tablosu + hedef kontrolü. --roi, --dominance, --diffs ek raporlar. --strict: ✘ varsa çıkış kodu 1.
"use strict";
const path = require("path");
const { Game } = require(path.join(__dirname, "../js/engine.js"));

// ---------- argümanlar ----------
const argv = process.argv.slice(2);
const opt = { seeds: 16, days: 120, diff: "normal", players: null, roi: false, dominance: false, diffs: false, table: null, sets: [], strict: false, quick: false, verbose: false };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--seeds") opt.seeds = +argv[++i];
  else if (a === "--days") opt.days = +argv[++i];
  else if (a === "--diff") opt.diff = argv[++i];
  else if (a === "--players") opt.players = argv[++i].split(",");
  else if (a === "--set") opt.sets.push(argv[++i]);
  else if (a === "--roi") opt.roi = true;
  else if (a === "--dominance") opt.dominance = true;
  else if (a === "--diffs") opt.diffs = true;
  else if (a === "--table") opt.table = argv[++i];
  else if (a === "--strict") opt.strict = true;
  else if (a === "--quick") { opt.quick = true; opt.seeds = Math.min(opt.seeds, 6); }
  else if (a === "--verbose") opt.verbose = true;
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
const pc = (n, d) => (d ? Math.round(100 * n / d) + "%" : "—");
const pad = (s, n) => String(s).padStart(n), padE = (s, n) => String(s).padEnd(n);
const clone = o => JSON.parse(JSON.stringify(o));

const FINAL = UPGRADES.find(u => u.cat === "final" || (u.levels[0].effect || {}).final);

// ---------- yükseltme öncelik listeleri ("id:seviye") ----------
// Dikkatli oyuncunun sırası ROI raporuna (--roi) göre seçildi; ortalama/kötü oyuncu aynı listeyi daha az seçici kullanır.
const PRIORITY = ["tabela:1", "raf:1", "kediyatagi:1", "yazarkasa:1", "guvenlik:1", "tabela:2", "raf:2", "buzdolabi:1", "toptanci:1", "sadakat:1", "tabela:3",
  "raf:3", "guvenlik:2", "vitrin:1", "yazarkasa:2", "onluk:1", "tente:1", "toptanci:2", "sadakat:2", "tabela:4", "raf:4", "vitrin:2", "depo:1",
  "lamba:1", "paspas:1", "bitkiler:1", "onluk:2", "muzik:1", "cirak:1", "paspas:2", "bitkiler:2", "cirak:2", "muzik:2", "onluk:3", "cirak:3"];

// ---------- oyuncu modelleri ----------
// hit/react: baloncuk isabeti ve tepki süresi; crisis: "ev" (akıllı) | 0..1 (o olasılıkla akıllı) | "ignore"
// upgrades: "smart" | "random" | "none" | "all"; products: "smart" | "all" | "none"; pricing: "smart" | "normal" | "random" | "high" | "low"
// service: "smart" | "broken" | "never"; fill: stok doldurma çarpanı; rentAware: kira için nakit ayırır
const PLAYERS = [
  { name: "dikkatli", attn: 1, hit: 0.98, react: 0.9, jitter: 0.15, playFrac: 1, crisis: "ev", decide: 1.5, upgrades: "smart", products: "smart", pricing: "smart", service: "smart", repay: true, fill: 1, rentAware: true, skipUpg: ["cirak", "muzik"] },
  { name: "ortalama", attn: 0.3, hit: 0.66, react: 1.5, jitter: 0.3, playFrac: 1, crisis: 0.4, decide: 2.5, upgrades: "mixed", products: "smart", pricing: "smart", service: "smart", repay: true, fill: 1, rentAware: true, skipUpg: [] },
  { name: "kötü", attn: 0.15, hit: 0.5, react: 2.0, jitter: 0.4, playFrac: 1, crisis: 0.25, decide: 4, upgrades: "random", products: "all", pricing: "random", service: "never", repay: false, fill: 0.7, rentAware: false, skipUpg: [] },
  { name: "ihmalkâr", attn: 0, hit: 0, react: 0, jitter: 0, playFrac: 0, crisis: "ignore", decide: 0, upgrades: "none", products: "smart", pricing: "normal", service: "never", repay: false, fill: 1, rentAware: false, skipUpg: [] },
  { name: "hep atla", attn: 0.55, hit: 0, react: 0, jitter: 0, playFrac: 0, crisis: "ignore", decide: 0, upgrades: "smart", products: "smart", pricing: "normal", service: "broken", repay: true, fill: 1, rentAware: true, skipUpg: ["onluk", "cirak:x"] },
  { name: "karışık %70", attn: 0.6, hit: 0.9, react: 1.0, jitter: 0.2, playFrac: 0.7, crisis: 0.8, decide: 2, upgrades: "smart", products: "smart", pricing: "smart", service: "smart", repay: true, fill: 1, rentAware: true, skipUpg: [] }
];
const byName = n => PLAYERS.find(p => p.name === n);

// ---------- fiyat politikası ----------
// İnsanın arayüzden okuyabileceği ipuçlarıyla: kampanya, "aranıyor" etiketi, ihtiyaç/dürtü ürünü, rakibin varlığı
function setPrices(P, plan) {
  const S = Game.state, R = plan.rival;
  for (const p of PRODUCTS) {
    if (!S.unlocked[p.id]) continue;
    let t = 1;
    if (P.pricing === "high") t = 2;
    else if (P.pricing === "low") t = 0;
    else if (P.pricing === "random") t = Math.floor(P.prng() * 3);
    else if (P.pricing === "smart" && P.prng() < P.attn) {
      const heat = plan.heat[p.id] || 1;
      const camp = R && R.campaign && (R.campaign.cat === "all" || R.campaign.cat === p.cat);
      if (camp) t = p.el >= 1.5 ? 0 : 1;
      else if (heat >= 1.3) t = 2;
      else if (R && R.active && p.el >= 2.0) t = 0;
      else if (p.el <= 1.3) t = 2;
      else t = 1;
    }
    Game.setPrice(p.id, t);
  }
}

// ---------- sabah politikası ----------
function reserveFor(P, ctx) {
  const fin = Game.finance();
  let r = Math.max(15, Math.round(0.35 * (ctx.lastStock || 30)));
  if (P.rentAware && fin.rentIn <= 1 && P.prng() < 0.3 + 0.7 * P.attn) r += Math.round(fin.rentAmount * 0.55);
  if (P.rentAware) r += fin.utility * 2;
  return r;
}
function wantsUpgrade(P, id, lv, ctx) {
  const key = id + ":" + lv;
  if (P.upgrades === "none") return false;
  if (P.skipUpg.includes(id) || P.skipUpg.includes(key)) return false;
  const S = Game.state;
  if (P.upgrades === "smart") {
    // kural-tabanlı ihtiyaç: raf yuvası sıkışıyorsa, hırsız görüldüyse, rakip açıldıysa
    if (id === "raf" && Game.slotsFree() > 0.25 * Game.totalSlots() && S.level < 6) return false;
    if (id === "guvenlik" && S.day < 7) return false;
    if (id === "sadakat" && !(Game.planDay().rival.active || Game.planDay().rival.open - S.day <= 4)) return false;
  }
  return true;
}
function morning(P, ctx) {
  const S = Game.state;
  if (S.bankrupt) return;
  const buy = (id) => Game.buyUpgrade(id);
  // 1) Final
  if (FINAL && P.upgrades !== "none" && Game.upgradeAvailable(FINAL.id) && Game.canAfford(Game.nextUpgradeCost(FINAL.id))) buy(FINAL.id);
  if (S.won && S.uiFinaleSeen === false) S.uiFinaleSeen = true;
  // 2) Ekipman bakımı
  if (P.service !== "never") for (const eq of Game.equipInfo()) {
    if (eq.broken || (P.service === "smart" && eq.cond < 55 && P.prng() < P.attn)) Game.service(eq.id);
  }
  // 3) Borç
  const fin = Game.finance();
  const reserve = reserveFor(P, ctx);
  if (P.repay && fin.debt > 0 && S.money > reserve) Game.repayDebt(S.money - reserve);
  // 4) Fiyat + stok
  const plan = Game.planDay();
  setPrices(P, plan);
  Game.fillAll(P.fill);
  if (S.won) return;
  const savingForFinal = FINAL && P.upgrades !== "none" && (Game.upgradeAvailable(FINAL.id) || S.level >= 9);   // Sv.9'dan itibaren büyük açılışa biriktirir
  // 5) Ürün kilitleri (para yedek dahil)
  if (P.products !== "none" && !savingForFinal) {
    for (const p of PRODUCTS.slice().sort((a, b) => a.unlockCost - b.unlockCost)) {
      if (!Game.canUnlock(p.id)) continue;
      if (P.products === "all" || S.money - p.unlockCost >= reserve + 20) { Game.unlockProduct(p.id); Game.setPrice(p.id, 1); Game.fillAll(P.fill); }
    }
  }
  // 6) Yükseltmeler
  if (savingForFinal || P.upgrades === "none") return;
  if (P.upgrades === "random") {
    const cands = UPGRADES.filter(u => u.cat !== "final" && Game.upgradeAvailable(u.id));
    for (let g = 0; g < 4 && cands.length; g++) {
      const u = cands[Math.floor(P.prng() * cands.length)];
      if (S.money - Game.nextUpgradeCost(u.id) >= reserve) Game.buyUpgrade(u.id);
    }
    return;
  }
  for (let guard = 0; guard < 8; guard++) {
    let target = null;
    const smart = P.upgrades === "smart" || (P.upgrades === "mixed" && P.prng() < P.attn);
    if (smart) {
      for (const key of PRIORITY) {
        const [id, lv] = key.split(":"); const u = UPGRADES.find(x => x.id === id);
        if (!u || Game.upgradeLevel(id) !== +lv - 1 || !Game.upgradeAvailable(id)) continue;
        if (!wantsUpgrade(P, id, +lv, ctx)) continue;
        target = id; break;
      }
    } else {   // "en ucuzunu al" (rastgele sıradan oyuncu davranışı)
      let best = Infinity;
      for (const u of UPGRADES) {
        if (u.cat === "final" || !Game.upgradeAvailable(u.id) || P.skipUpg.includes(u.id)) continue;
        const c = Game.nextUpgradeCost(u.id); if (c < best) { best = c; target = u.id; }
      }
    }
    if (!target) break;
    const cost = Game.nextUpgradeCost(target);
    if (S.money - cost >= reserve) { Game.buyUpgrade(target); continue; }
    break;   // hedefe biriktir
  }
}

// ---------- tam oyun ----------
function polOf(P) {
  if (P.playFrac === 0) return null;
  return { hitRate: P.hit, reactSec: P.react, jitter: P.jitter, crisis: P.crisis, decideSec: P.decide, busy: true, reserve: 0 };
}
function playGame(P, seed, maxDays, diff) {
  Game.newGame(seed, diff || opt.diff);
  const prng = rng(seed ^ 0xABCD), choose = rng(seed ^ 0x1234);
  P = Object.assign({}, P, { prng });
  const ctx = { lastStock: 30 };
  const days = []; const pol = polOf(P);
  let wonDay = null, bankruptDay = null, playSec = 0, bankruptReason = null;
  for (let d = 1; d <= maxDays; d++) {
    const S = Game.state;
    morning(P, ctx);
    if (S.won && wonDay === null) { wonDay = S.wonDay; playSec += 25; break; }
    ctx.lastStock = S.todayStockCost;
    const play = !!pol && choose() < P.playFrac;
    const plan = Game.planDay();
    const sum = Game.autoDay(play ? pol : "skip");
    if (!sum) break;
    playSec += play ? BALANCE.dayLength + 25 : 15;
    days.push({ day: d, play, profit: sum.profit, skipProfit: play ? sum.estSkipProfit : sum.profit, level: S.level, rep: S.rep, money: S.money, debt: S.debt,
      satEnd: sum.satEnd, bubbles: sum.bubblesSpawned, popped: sum.popped, missed: sum.missedBubbles, revenue: sum.revenue, bubbleIncome: sum.bubbleIncome,
      customers: sum.customers, planCust: plan.customers, lost: sum.lostCustomers, missCust: sum.missed, fixed: sum.fixed.utility + sum.fixed.rent + sum.fixed.interest + sum.fixed.storage,
      rent: sum.fixed.rent, interest: sum.fixed.interest, thefts: sum.thefts, theftLoss: sum.theftLoss, caught: sum.caught, crises: sum.crises.length,
      crisisNet: sum.crisisGain - sum.crisisLoss - sum.crisisSpend, breakdowns: sum.breakdowns.length, spoiled: sum.spoiled, spoiledValue: sum.spoiledValue,
      rivalShare: sum.rivalShare, rivalLost: sum.rivalLost, salvos: sum.salvos, pen: sum.moneyPenalty, emerg: sum.emergencyCost,
      weather: sum.weather, event: sum.event, slotsUsed: Game.slotsUsed(), slots: Game.totalSlots(), upgrades: Object.keys(S.upgrades).length });
    Game.ackEvening();
    if (S.bankrupt) { bankruptDay = S.bankrupt.day; bankruptReason = S.bankrupt.reason; break; }
  }
  const S = Game.state;
  return { days, wonDay, bankruptDay, bankruptReason, playSec, final: clone({ level: S.level, rep: S.rep, money: S.money, debt: S.debt, upgrades: S.upgrades, unlocked: S.unlocked, stats: S.stats, day: S.day }) };
}

// ---------- ROI ölçümü ----------
// Aynı oyun durumundan (ortalama oyuncunun gün N sabahı) "alınmış" ve "alınmamış" kopyayı 5 gün oynatır; fark = günlük kâr − günlük gider.
function snapshots(P, seed, daysList) {
  const snaps = [];
  Game.newGame(seed, opt.diff);
  const prng = rng(seed ^ 0xABCD), ctx = { lastStock: 30 };
  const P2 = Object.assign({}, P, { prng }), pol = polOf(P2);
  for (let d = 1; d <= Math.max(...daysList); d++) {
    morning(P2, ctx);
    if (Game.state.won) break;
    if (daysList.includes(d)) snaps.push({ day: d, st: clone(Game.state), ctx: Object.assign({}, ctx) });
    ctx.lastStock = Game.state.todayStockCost;
    if (!Game.autoDay(pol)) break;
    Game.ackEvening();
    if (Game.state.bankrupt) break;
  }
  return snaps;
}
function evalFrom(st, P, nDays, seed, mod) {
  Game.state = clone(st);
  const S = Game.state;
  if (mod) mod(S);
  const prng = rng(seed ^ 0x77), ctx = { lastStock: 30 };
  const P2 = Object.assign({}, P, { prng, upgrades: "none", products: "none" }), pol = polOf(P2) || "skip";
  let tot = 0;
  for (let d = 0; d < nDays; d++) {
    if (Game.state.bankrupt) break;
    morning(P2, ctx);
    ctx.lastStock = Game.state.todayStockCost;
    const sum = Game.autoDay(pol); if (!sum) break;
    tot += sum.profit - sum.fixed.utility - sum.fixed.storage; Game.ackEvening();
  }
  return tot / nDays;
}
function roiReport(log) {
  // Anlık görüntüler iki yoldan alınır (dikkatli ve ortalama oyuncu); her kalem uygun görüntülerde iki oyun tarzıyla (dikkatli/ortalama) denenir.
  const DAYS = [10, 16, 24, 32, 40, 48], N = opt.quick ? 4 : 6;
  const seeds = SEEDS.slice(0, Math.min(opt.quick ? 4 : 8, SEEDS.length));
  const snaps = [];
  for (const sd of seeds) for (const who of ["dikkatli", "ortalama"]) for (const s of snapshots(byName(who), sd, DAYS)) snaps.push(Object.assign(s, { seed: sd }));
  const styles = [byName("dikkatli"), byName("ortalama"), byName("hep atla")];
  log("ROI: " + snaps.length + " anlık görüntü (gün " + DAYS.join("/") + "; dikkatli+ortalama yollar), her biri " + N + " gün, iki oyun tarzı; Δ = günlük (kâr − günlük gider) farkı; geri dönüş = maliyet/Δ (gün)");
  log("kalem                    | maliyet | Δ dikkatli | geri dön. | Δ ortalama | geri dön. | Δ atla | geri dön. | örnek | hüküm (en iyi tarz)");
  const rows = [];
  const evalItem = (label, cost, apply, canApply) => {
    const ds = [[], [], []];
    for (const s of snaps) {
      Game.state = clone(s.st);
      if (!canApply(Game.state)) continue;
      styles.forEach((P, k) => {
        const base = evalFrom(s.st, P, N, s.seed, null), with_ = evalFrom(s.st, P, N, s.seed, S0 => apply(S0));
        ds[k].push(with_ - base);
      });
    }
    if (!ds[0].length) return;
    const dC = mean(ds[0]), dA = mean(ds[1]), dS = mean(ds[2]), best = Math.max(dC, dA, dS), roi = best > 0 ? cost / best : Infinity;
    const verdict = best <= 0.5 ? "ÖLÜ/ZARARLI" : roi > 100 ? "zayıf" : roi > 45 ? "orta" : "iyi";
    const roiC = dC > 0 ? cost / dC : Infinity, roiA = dA > 0 ? cost / dA : Infinity, roiS = dS > 0 ? cost / dS : Infinity;
    rows.push({ label, cost, d: best, dC, dA, dS, roi, n: ds[0].length, verdict });
    log(`${padE(label, 24)} | ${pad(cost, 7)} | ${pad(f1(dC), 10)} | ${pad(isFinite(roiC) ? f0(roiC) : "∞", 9)} | ${pad(f1(dA), 10)} | ${pad(isFinite(roiA) ? f0(roiA) : "∞", 9)} | ${pad(f1(dS), 6)} | ${pad(isFinite(roiS) ? f0(roiS) : "∞", 9)} | ${pad(ds[0].length, 5)} | ${verdict}`);
  };
  for (const u of UPGRADES) {
    if (u.cat === "final") continue;
    u.levels.forEach((lv, i) => evalItem(`${u.id}-${i + 1}`, lv.cost, S0 => { S0.upgrades[u.id] = i + 1; },
      S0 => (S0.upgrades[u.id] || 0) === i && S0.level >= Math.max(u.unlockLevel || 1, lv.minLevel || 1) && (!u.req || S0.upgrades[u.req])));
  }
  for (const p of PRODUCTS) {
    if (!(p.unlockCost > 0)) continue;
    evalItem("ürün:" + p.id, p.unlockCost, S0 => { S0.unlocked[p.id] = true; S0.prices[p.id] = 1; },
      S0 => !S0.unlocked[p.id] && S0.level >= p.unlockLevel && (!p.cold || (S0.upgrades.buzdolabi || 0) > 0));
  }
  return rows;
}

// ---------- rapor ----------
function main() {
  const out = []; const log = s => out.push(s);
  const names = opt.players || ["dikkatli", "ortalama", "kötü", "ihmalkâr", "hep atla", "karışık %70"];
  const results = {};
  for (const n of names) { const P = byName(n); if (P) results[n] = SEEDS.map(sd => playGame(P, sd, opt.days)); }
  const all = results;
  let fails = 0;
  const ok = (c, t) => { if (!c) fails++; log(`${c ? "✔" : "✘"} ${t}`); };

  log(`Köşe Market denge simülasyonu — ${SEEDS.length} tohum, en fazla ${opt.days} gün, zorluk=${opt.diff}, dayLength=${BALANCE.dayLength}s` + (opt.sets.length ? `  [--set ${opt.sets.join(" ")}]` : ""));
  log("");
  log("1) SONUÇLAR (kazandı = Büyük Açılış alındı; iflas; zaman aşımı = bitiremedi)");
  log("oyuncu       | kazanan | iflas | bitmedi | kazanma günü medyan [min–max] | süre dk medyan | iflas günü medyan");
  const stat = {};
  for (const n of Object.keys(all)) {
    const g = all[n], wins = g.filter(x => x.wonDay !== null), bk = g.filter(x => x.bankruptDay !== null), un = g.filter(x => x.wonDay === null && x.bankruptDay === null);
    const wd = wins.map(x => x.wonDay), mins = wins.map(x => x.playSec / 60);
    stat[n] = { win: wins.length / g.length, bk: bk.length / g.length, un: un.length / g.length, wd: median(wd), min: median(mins), n: g.length };
    log(`${padE(n, 12)} | ${pad(pc(wins.length, g.length), 7)} | ${pad(pc(bk.length, g.length), 5)} | ${pad(pc(un.length, g.length), 7)} | ${padE(wins.length ? f0(median(wd)) + " [" + Math.min(...wd) + "–" + Math.max(...wd) + "]" : "—", 29)} | ${pad(wins.length ? f0(median(mins)) : "—", 14)} | ${bk.length ? f0(median(bk.map(x => x.bankruptDay))) : "—"}`);
  }
  log("");
  log("2) GÜNLÜK KÂR / KASA EĞRİSİ (medyan; ₺ = gün sonu kasa; oyundan çıkanlar listeden düşer)");
  const CHECK = [1, 5, 10, 14, 20, 28, 35, 42, 50, 60, 75, 90].filter(d => d <= opt.days);
  log("gün  | " + Object.keys(all).map(n => `${n} sv/₺/kâr`.padEnd(24)).join(" | "));
  for (const d of CHECK) {
    const cells = Object.keys(all).map(n => {
      const rows = all[n].map(g => g.days.find(x => x.day === d)).filter(Boolean);
      if (!rows.length) return "(bitti)".padEnd(24);
      return `${f0(median(rows.map(r => r.level)))}/${f0(median(rows.map(r => r.money)))}/${f0(median(rows.map(r => r.profit)))} (n${rows.length})`.padEnd(24);
    });
    log(`${pad(d, 4)} | ${cells.join(" | ")}`);
  }
  log("");
  log("3) MEKANİK KULLANIM (günlük ortalama; dikkatli ve ortalama oyuncu, gün 10+)");
  for (const n of ["dikkatli", "ortalama", "ihmalkâr"]) {
    if (!all[n]) continue;
    const rows = all[n].flatMap(g => g.days.filter(x => x.day >= 10));
    if (!rows.length) continue;
    log(`${padE(n, 9)} baloncuk ${f1(mean(rows.map(r => r.bubbles)))}/gün (kaçan ${f1(mean(rows.map(r => r.missed)))}), salvo ${f1(mean(rows.map(r => r.salvos)))}, hırsız ${f2(mean(rows.map(r => r.thefts)))} (kayıp ₺${f0(mean(rows.map(r => r.theftLoss)))}), ` +
      `yakalanan ${f2(mean(rows.map(r => r.caught)))}, kriz ${f2(mean(rows.map(r => r.crises)))} (net ₺${f0(mean(rows.map(r => r.crisisNet)))}), arıza ${f2(mean(rows.map(r => r.breakdowns)))}, ` +
      `bozulan ${f1(mean(rows.map(r => r.spoiled)))} ürün (₺${f0(mean(rows.map(r => r.spoiledValue)))}), rakip payı ${f2(mean(rows.map(r => r.rivalShare)))}, kaçan müşteri ${f1(mean(rows.map(r => r.lost)))}, ` +
      `para cezası ₺${f0(mean(rows.map(r => r.pen)))}, gider ₺${f0(mean(rows.map(r => r.fixed)))}/gün, yuva doluluk ${pc(mean(rows.map(r => r.slotsUsed)), mean(rows.map(r => r.slots)))}`);
  }
  log("");
  {
    const g = all["dikkatli"], b = all["ortalama"];
    if (g) {
      const nbk = g.flatMap(x => x.days).filter(r => r.profit < 0).length;
      log(`dikkatli: negatif kârlı gün ${nbk}/${g.flatMap(x => x.days).length}; en yüksek borç medyan ₺${f0(median(g.map(x => x.final.stats.debtPeak)))}; borçlu gün oranı ${pc(g.flatMap(x => x.days).filter(r => r.debt > 0).length, g.flatMap(x => x.days).length)}`);
    }
    if (b) log(`ortalama: negatif kârlı gün ${b.flatMap(x => x.days).filter(r => r.profit < 0).length}/${b.flatMap(x => x.days).length}; borçlu gün oranı ${pc(b.flatMap(x => x.days).filter(r => r.debt > 0).length, b.flatMap(x => x.days).length)}; en yüksek borç medyan ₺${f0(median(b.map(x => x.final.stats.debtPeak)))}`);
  }
  // Eşli oyna-atla oranı (dikkatli oyuncu)
  if (all["dikkatli"]) {
    log("");
    log("4) EŞLİ KÂR ORANI: oynanan günün kârı ÷ aynı sabahtan klon-atla kârı (dikkatli / ortalama)");
    for (const n of ["dikkatli", "ortalama"]) {
      if (!all[n]) continue;
      const cells = [[1, 15], [16, 35], [36, 999]].map(([a, b]) => {
        const per = all[n].map(g => { const ds = g.days.filter(x => x.play && x.day >= a && x.day <= b); return ds.length ? ds.reduce((t, x) => t + x.profit, 0) / Math.max(1, ds.reduce((t, x) => t + x.skipProfit, 0)) : NaN; }).filter(isFinite);
        return per.length ? `${f2(mean(per))} [${f2(Math.min(...per))}–${f2(Math.max(...per))}]` : "—";
      });
      log(`${padE(n, 9)} gün 1–15: ${cells[0]} | 16–35: ${cells[1]} | 36+: ${cells[2]}`);
    }
  }

  // ---------- hedef kontrolü ----------
  log("");
  log("5) HEDEF KONTROLÜ (zorluk: " + opt.diff + ")");
  if (opt.diff === "normal" && stat["dikkatli"]) {
    const st = stat;
    ok(st["dikkatli"].win >= 0.85, `dikkatli oyuncu kazanma oranı ${pc(st["dikkatli"].win * st["dikkatli"].n, st["dikkatli"].n)} ≥ %85`);
    ok(!isFinite(st["dikkatli"].wd) || (st["dikkatli"].wd >= 42 && st["dikkatli"].wd <= 65), `dikkatli kazanma günü medyanı ${f0(st["dikkatli"].wd)} ∈ [42, 65]`);
    ok(!isFinite(st["dikkatli"].min) || (st["dikkatli"].min >= 55 && st["dikkatli"].min <= 100), `dikkatli tahmini süre ${f0(st["dikkatli"].min)} dk ∈ [55, 100] (hedef ~1–1,5 saat)`);
    if (st["ortalama"]) ok(st["ortalama"].win >= 0.5 && st["ortalama"].win <= 0.8, `ortalama oyuncu kazanma oranı ${pc(st["ortalama"].win * st["ortalama"].n, st["ortalama"].n)} ∈ [%50, %80]`);
    if (st["ihmalkâr"]) ok(st["ihmalkâr"].bk >= 0.5 || st["ihmalkâr"].win <= 0.2, `ihmalkâr (hep hızlı geç, yükseltme yok): iflas ${pc(st["ihmalkâr"].bk * st["ihmalkâr"].n, st["ihmalkâr"].n)}, kazanan ${pc(st["ihmalkâr"].win * st["ihmalkâr"].n, st["ihmalkâr"].n)} — çoğunlukla iflas ya da çok zorlanır`);
    if (st["kötü"]) ok(st["kötü"].win <= 0.15, `kötü oyuncu kaybeder: kazanma ${pc(st["kötü"].win * st["kötü"].n, st["kötü"].n)} ≤ %15, iflas ${pc(st["kötü"].bk * st["kötü"].n, st["kötü"].n)}`);
    if (st["dikkatli"] && st["hep atla"]) ok(st["hep atla"].win <= st["dikkatli"].win - 0.2 || st["hep atla"].win < 0.5, `hep atla, dikkatliden belirgin zayıf: ${pc(st["hep atla"].win * st["hep atla"].n, st["hep atla"].n)} vs ${pc(st["dikkatli"].win * st["dikkatli"].n, st["dikkatli"].n)}`);
    if (st["dikkatli"] && st["ortalama"]) ok(st["dikkatli"].win > st["ortalama"].win + 0.1, `beceri ödüllendiriliyor: dikkatli ${pc(st["dikkatli"].win * st["dikkatli"].n, st["dikkatli"].n)} > ortalama ${pc(st["ortalama"].win * st["ortalama"].n, st["ortalama"].n)} + %10`);
    const dk = all["dikkatli"].flatMap(g => g.days.filter(x => x.day >= 10));
    ok(mean(dk.map(r => r.bubbles)) >= 14, `baloncuk yoğunluğu (dikkatli) ${f1(mean(dk.map(r => r.bubbles)))}/gün ≥ 14`);
    ok(mean(dk.map(r => r.missed)) >= 0.3, `dikkatli oyuncu da arada kaçırıyor: ${f1(mean(dk.map(r => r.missed)))} baloncuk/gün (≥ 0.3: baskı gerçek)`);
    ok(mean(dk.map(r => r.thefts + r.caught)) >= 0.3 && mean(dk.map(r => r.crises)) >= 0.3, `hırsız (${f2(mean(dk.map(r => r.thefts + r.caught)))}/gün, ${f2(mean(dk.map(r => r.thefts)))} götürdü) ve kriz (${f2(mean(dk.map(r => r.crises)))}/gün) gerçekten oluyor`);
  } else if (stat["dikkatli"]) {
    log(`(bilgi) ${opt.diff}: dikkatli kazanma ${pc(stat["dikkatli"].win * stat["dikkatli"].n, stat["dikkatli"].n)}, iflas ${pc(stat["dikkatli"].bk * stat["dikkatli"].n, stat["dikkatli"].n)}; ortalama ${stat["ortalama"] ? pc(stat["ortalama"].win * stat["ortalama"].n, stat["ortalama"].n) : "—"}`);
  }

  // ---------- zorluk karşılaştırması ----------
  if (opt.diffs) {
    log("");
    log("6) ZORLUK SEVİYELERİ KARŞILAŞTIRMASI (dikkatli / ortalama / ihmalkâr)");
    log("seviye   | oyuncu    | kazanan | iflas | bitmedi | kazanma günü medyan");
    for (const dn of ["kolay", "normal", "zor", "efsane"]) for (const pn of ["dikkatli", "ortalama", "ihmalkâr"]) {
      const g = SEEDS.map(sd => playGame(byName(pn), sd, opt.days, dn));
      const w = g.filter(x => x.wonDay !== null), b = g.filter(x => x.bankruptDay !== null);
      log(`${padE(dn, 8)} | ${padE(pn, 9)} | ${pad(pc(w.length, g.length), 7)} | ${pad(pc(b.length, g.length), 5)} | ${pad(pc(g.length - w.length - b.length, g.length), 7)} | ${w.length ? f0(median(w.map(x => x.wonDay))) : "—"}`);
    }
  }

  // ---------- baskın strateji testleri ----------
  if (opt.dominance) {
    log("");
    log("7) 'DOMİNANT STRATEJİ VAR MI?' (dikkatli beceri; taban = Normal fiyat; aynı tohumlar; ölçüt: gün 1–40 toplam kâr − gider, ve kazanma/iflas)");
    const total = (variant, n) => {
      const P0 = Object.assign({}, byName("dikkatli"), { pricing: "normal", attn: 1 }, variant);
      const rs = SEEDS.slice(0, n || SEEDS.length).map(sd => playGame(P0, sd, 40));
      const net = rs.map(g => g.days.reduce((t, d) => t + d.profit - d.fixed, 0));
      return { net: mean(net), bk: rs.filter(g => g.bankruptDay !== null).length / rs.length };
    };
    const rows = [];
    const addRow = (label, v) => { const r = total(v); rows.push({ label, r }); };
    addRow("taban (dikkatli, Normal fiyat, Dengeli Doldur, akıllı yükseltme)", {});
    addRow("fiyat: hepsi Ucuz", { pricing: "low" });
    addRow("fiyat: hepsi Pahalı", { pricing: "high" });
    addRow("fiyat: akıllı (ipuçlarına göre)", { pricing: "smart", attn: 1 });
    addRow("stok: ×0,5", { fill: 0.5 });
    addRow("stok: ×1,6", { fill: 1.6 });
    addRow("stok: ×2,5", { fill: 2.5 });
    addRow("yükseltme: hiç alma", { upgrades: "none" });
    addRow("yükseltme: rastgele", { upgrades: "random" });
    addRow("ürün: hiç açma", { products: "none" });
    addRow("ürün: hemen hepsini aç", { products: "all" });
    addRow("bakım: hiç yaptırma", { service: "never" });
    addRow("kriz: hep görmezden gel", { crisis: "ignore" });
    addRow("kriz: hep akıllı", { crisis: "ev" });
    const base = rows[0].r.net;
    for (const x of rows) log(`${padE(x.label, 52)} net ₺${pad(f0(x.r.net), 6)}  (${pad((x.r.net / base * 100 - 100).toFixed(0) + "%", 5)} taban)  iflas ${pc(x.r.bk * SEEDS.length, SEEDS.length)}`);
    const best = rows.slice().sort((a, b) => b.r.net - a.r.net)[0];
    const smartPrice = rows.find(r => r.label.startsWith("fiyat: akıllı")), allHigh = rows.find(r => r.label.includes("Pahalı")), allLow = rows.find(r => r.label.includes("Ucuz"));
    log("");
    ok(smartPrice.r.net > base * 1.02, `akıllı fiyatlama taban fiyattan en az %2 iyi (${(smartPrice.r.net / base * 100 - 100).toFixed(0)}%)`);
    ok(smartPrice.r.net > allHigh.r.net && smartPrice.r.net > allLow.r.net, `tek tip fiyat (hepsi Ucuz/Pahalı) akıllı fiyatlamayı geçemiyor (Ucuz ${(allLow.r.net / base * 100 - 100).toFixed(0)}%, Pahalı ${(allHigh.r.net / base * 100 - 100).toFixed(0)}%)`);
    const stk = rows.filter(r => r.label.startsWith("stok"));
    ok(stk.every(r => r.r.net < base * 1.03), `stok çarpanı tabanı %3'ten fazla geçmiyor (${stk.map(r => (r.r.net / base * 100 - 100).toFixed(0) + "%").join(", ")})`);
    ok(stk.find(r => r.label.includes("0,5")).r.net < base * 0.9 && stk.filter(r => !r.label.includes("0,5")).every(r => r.r.net <= base * 1.01), "çok az stok (×0,5) en az %10 zararlı; fazla stok (×1,6 / ×2,5) tabanı geçmiyor (yuva + depolama gideri)");
    const up = rows.find(r => r.label.includes("hiç alma")), upr = rows.find(r => r.label.includes("rastgele"));
    ok(up.r.net < base * 0.85, `yükseltme almamak en az %15 zararlı (${(up.r.net / base * 100 - 100).toFixed(0)}%)`);
    ok(upr.r.net < base * 1.03, `rastgele yükseltme seçmek öncelikli seçimi geçmiyor (${(upr.r.net / base * 100 - 100).toFixed(0)}%)`);
    const pall = rows.find(r => r.label.includes("hemen hepsini")), pnone = rows.find(r => r.label.includes("hiç açma"));
    ok(pall.r.net < base * 1.04 && pnone.r.net < base * 0.9, `'hepsini aç' baskın değil (${(pall.r.net / base * 100 - 100).toFixed(0)}%), hiç açmamak zararlı (${(pnone.r.net / base * 100 - 100).toFixed(0)}%)`);
    const cr = rows.find(r => r.label.includes("görmezden")), ce = rows.find(r => r.label.includes("hep akıllı"));
    ok(ce.r.net > cr.r.net, `kriz kartlarında akıllı seçim görmezden gelmeden iyi (${(ce.r.net / base * 100 - 100).toFixed(0)}% vs ${(cr.r.net / base * 100 - 100).toFixed(0)}%)`);
    log("en iyi varyant: " + best.label);
  }

  if (opt.roi) {
    log("");
    log("8) YÜKSELTME / ÜRÜN ROI");
    const rows = roiReport(log);
    log("");
    const ups = rows.filter(r => !r.label.startsWith("ürün:")), prods = rows.filter(r => r.label.startsWith("ürün:"));
    const weak = ups.filter(r => r.d <= 0.5), slow = ups.filter(r => r.roi > 120 && r.d > 0.5);
    ok(weak.length === 0, `hiçbir yükseltme ≈₺0/zararlı değil (ölü: ${weak.map(r => r.label).join(", ") || "yok"})`);
    ok(slow.length <= 4, `geri dönüşü 120 günden uzun yükseltme sayısı ${slow.length} ≤ 4 (${slow.map(r => r.label + ":" + f0(r.roi)).join(", ") || "yok"})`);
    ok(ups.every(r => r.d < 80), `hiçbir yükseltme tek başına aşırı kâr getirmiyor (en yüksek ${f1(Math.max(...ups.map(r => r.d)))} ₺/gün: ${ups.slice().sort((a, b) => b.d - a.d)[0].label})`);
    const negProd = prods.filter(r => r.d <= 0);
    ok(negProd.length === 0, `hiçbir ürün kilidi kâr düşürmüyor (negatif: ${negProd.map(r => r.label).join(", ") || "yok"})`);
  }

  if (opt.table && all[opt.table]) {
    log("");
    log(`GÜN TABLOSU (${opt.table}, ilk tohum): gün | sv | ₺ | borç | kâr | gider | müşteri | baloncuk(kaçan) | hırsız | kriz | arıza | bozulan | memn.`);
    for (const r of all[opt.table][0].days)
      log(`${pad(r.day, 3)} | ${pad(r.level, 2)} | ${pad(Math.round(r.money), 6)} | ${pad(r.debt, 4)} | ${pad(r.profit, 5)} | ${pad(r.fixed, 4)} | ${pad(r.customers, 3)} | ${pad(r.bubbles, 2)}(${r.missed}) | ${r.thefts} | ${r.crises} | ${r.breakdowns} | ${pad(r.spoiled, 2)} | ${pad(r.satEnd, 3)} | ${r.weather} ${r.event || ""}`);
  }
  console.log(out.join("\n"));
  if (opt.strict && fails) process.exitCode = 1;
}

if (require.main === module) main();
module.exports = { morning, playGame, rng, PLAYERS, PRIORITY, setPrices, polOf };
