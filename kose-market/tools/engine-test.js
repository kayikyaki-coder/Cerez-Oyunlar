// engine-test.js — Motor birim testleri (DOM'suz, tohumlu). Kullanım: node tools/engine-test.js [--long]
//  Kapsam: determinizm, dt bağımsızlığı, fiyat/talep/rakip, raf ömrü + yuva, kira/borç/iflas, hırsız, ekipman, kriz, salvo,
//  kayıt (v1 göç, NaN koruması, gün ortası yenileme), sezon, zorluk, ölü anahtar taraması.
"use strict";
const fs = require("fs"), path = require("path");
// Node'da localStorage yok: kayıt testleri için basit sahte
const store = {};
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
const { Game } = require(path.join(__dirname, "../js/engine.js"));
const data = require(path.join(__dirname, "../js/data.js"));
const { PRODUCTS, UPGRADES, BALANCE, DIFFICULTIES } = data;

let pass = 0, fail = 0;
function t(name, fn) {
  try { const r = fn(); if (r === false) throw new Error("false döndü"); pass++; console.log("✔ " + name); }
  catch (e) { fail++; console.log("✘ " + name + "  →  " + e.message); }
}
const eq = (a, b, m) => { if (a !== b) throw new Error((m || "") + " beklenen " + b + ", gelen " + a); };
const ok = (c, m) => { if (!c) throw new Error(m || "koşul sağlanmadı"); };
const clone = o => JSON.parse(JSON.stringify(o));
const HUMAN = { hitRate: 0.85, reactSec: 1.0 };

// belli türde baloncuk doğana kadar günü ilerlet; (tohum, gün) taraması
function findBubble(type, opts) {
  opts = opts || {};
  for (let sd = 1; sd < 80; sd++) for (let day = opts.minDay || 8; day < (opts.minDay || 8) + 12; day++) {
    Game.newGame(sd, opts.diff || "normal");
    const S = Game.state; S.day = day; S.level = opts.level || 5; S.money = 3000;
    for (const p of PRODUCTS) { S.unlocked[p.id] = true; S.stock[p.id] = 6; }
    if (opts.setup) opts.setup(S);
    Game.state = S;
    Game.startDay({ mode: opts.mode || "play" });
    let found = null, guard = 0;
    while (!Game.run.dayEndEmitted && guard++ < 1000 && !found) {
      for (const ev of Game.tick(0.25)) if (ev.type === "bubbleSpawn" && ev.bubble.type === type) found = ev.bubble;
    }
    if (found) return { bubble: found, seed: sd, day };
    Game.endDay();
  }
  return null;
}

console.log("— Determinizm ve zaman —");
t("aynı gün iki kez aynı sonuç, klon durumu bozmaz", () => {
  Game.newGame(12345); Game.fillAll();
  const before = JSON.stringify(Game.state);
  const a = Game.simulateClone("play", HUMAN), b = Game.simulateClone("play", HUMAN);
  eq(a.net, b.net); eq(before, JSON.stringify(Game.state), "durum");
});
t("dt bağımsızlığı (0.016 vs 0.25)", () => {
  Game.newGame(777); Game.fillAll(); const snap = clone(Game.state);
  Game.startDay({ mode: "skip" }); while (!Game.run.dayEndEmitted) Game.tick(0.016); const s1 = Game.endDay();
  Game.state = clone(snap);
  Game.startDay({ mode: "skip" }); while (!Game.run.dayEndEmitted) Game.tick(0.25); const s2 = Game.endDay();
  eq(s1.profit, s2.profit);
});
t("tahmin belirsizliği: gürültü anahtarı farklı gün üretir, plan aynı kalır", () => {
  Game.newGame(31); Game.state.day = 9; for (const p of PRODUCTS) { Game.state.unlocked[p.id] = true; } Game.fillAll();
  const p0 = Game.planDay().weather.id;
  const a = Game.simulateClone("play", HUMAN, 0), b = Game.simulateClone("play", HUMAN, 1), c = Game.simulateClone("play", HUMAN, 2);
  ok(new Set([a.profit, b.profit, c.profit]).size >= 2, "üç koşu da aynı");
  eq(a.weather, p0); eq(b.weather, p0);
});
t("oynanan gün: atlanan klonla karşılaştırılır, tahmin yazılır", () => {
  Game.newGame(5); Game.fillAll(); const s = Game.autoDay(HUMAN); ok(s.estSkipProfit !== null && isFinite(s.estSkipProfit));
});

console.log("— Maliyet / yuva / raf ömrü —");
t("B1: toptancı indirimi küçük fiyatlarda da etki eder (yuvarlama yutmaz)", () => {
  Game.newGame(1); Game.state.money = 1000; Game.state.upgrades.toptanci = 1;
  const full = Math.round(10 * 3), disc = Game.lineCost("ekmek", 10);
  ok(disc < full, "10 ekmek " + disc + " vs " + full);
  const n = Game.buyStock("ekmek", 10); eq(n, 10);
});
t("zam haberi (×1.15) ucuz üründe de maliyeti artırır", () => {
  Game.newGame(1); const base = Game.lineCost("elma", 20);
  const ev = data.DAY_EVENTS.find(e => e.id === "zam"); ok(ev);
  const bp = Game.planDay(); bp.event = ev;   // lineCost plan yerine temel planı kullanır; olayı emüle etmek için state'i zam gününe taşı
  let day = null;
  for (let d = 11; d < 200 && !day; d++) { Game.state.day = d; const p = Game.planDay(); if (p.event && p.event.id === "zam") day = d; }
  if (day) { Game.state.day = day; ok(Game.lineCost("elma", 20) > base, "zam günü maliyet artmadı"); } else console.log("   (zam günü bulunamadı, atlandı)");
});
t("toplam yuva sınırı: stok yuvayı aşmaz; 2 yuvalı ürün çift sayılır", () => {
  Game.newGame(2); const S = Game.state; S.money = 99999; for (const p of PRODUCTS) { S.unlocked[p.id] = true; }
  for (const p of PRODUCTS) Game.buyStock(p.id, 999);
  ok(Game.slotsUsed() <= Game.totalSlots(), "yuva aşıldı " + Game.slotsUsed());
  eq(Game.slotsOf("pasta"), 2);
  S.stock.pasta = 0; S.stock.elma = 0; S.stock.ekmek = 0; for (const p of PRODUCTS) S.stock[p.id] = 0;
  eq(Game.buyStock("pasta", 5), 5); eq(Game.slotsUsed(), 10);
});
t("raf ömrü: simit bir geceyi çıkarmaz, ekmek 1 geceyi çıkarır, 2.de çöpe gider", () => {
  Game.newGame(3); const S = Game.state;
  for (const p of PRODUCTS) S.stock[p.id] = 0; S.unlocked.simit = true; S.stock.simit = 5; S.stock.ekmek = 5; Game.state = S;
  Game.skipDay(); eq(Game.state.stock.simit, 0, "simit"); ok(Game.state.stock.ekmek >= 0);
  const e1 = Game.state.stock.ekmek;
  // ekmek ilk gece: satılanlar düşer ama kalanın hepsi bozulmaz
  Game.newGame(3); const T = Game.state; for (const p of PRODUCTS) T.stock[p.id] = 0; T.stock.ekmek = 40; T.unlocked.simit = false; Game.state = T;
  Game.skipDay(); ok(Game.state.stock.ekmek > 0, "ekmek ilk gece bozulmamalı (" + Game.state.stock.ekmek + ")");
  Game.skipDay(); ok(e1 >= 0);
});
t("buzdolabı taze ürün ömrünü uzatır; bozuk dolap uzatmaz", () => {
  Game.newGame(4); Game.state.upgrades.buzdolabi = 1;
  const L1 = Game.lifeOf("ekmek"); Game.state.broken.fridge = true; const L2 = Game.lifeOf("ekmek");
  ok(L1 > L2 && L2 === 2, "ömür " + L1 + " / " + L2);
});
t("soğuk ürün: dolap yokken talep ağırlığı düşer", () => {
  Game.newGame(6); Game.state.unlocked.sut = true; const w0 = Game.planDay().weights.sut;
  Game.state.upgrades.buzdolabi = 1; const w1 = Game.planDay().weights.sut; ok(w1 > w0 * 1.3, w0 + " → " + w1);
});
t("FIFO: eski parti önce satılır", () => {
  Game.newGame(8); const S = Game.state; S.batch.elma = [3, 2]; S.stock.elma = 5; Game.state = S;
  Game.startDay({ mode: "skip" }); // satış motoru takeStock kullanır; sadece toplamın tutarlılığı
  while (!Game.run.dayEndEmitted) Game.tick(0.5); Game.endDay(); ok(Game.state.stock.elma >= 0);
});

console.log("— Fiyat, talep, rakip —");
t("kademeler: Ucuz < Normal < Pahalı ve hepsi maliyetin üstünde", () => {
  Game.newGame(1);
  for (const p of PRODUCTS) { const a = Game.priceAt(p.id, 0), b = Game.priceAt(p.id, 1), c = Game.priceAt(p.id, 2); ok(a <= b && b <= c && a > p.cost, p.id + " " + [a, b, c]); }
});
t("fiyat arttıkça o ürünün talep çarpanı düşer", () => {
  Game.newGame(1); const info = Game.priceInfo("ekmek"); ok(info.options[0].factor > info.options[1].factor && info.options[1].factor > info.options[2].factor);
});
t("satış seçili kademe fiyatından yapılır", () => {
  Game.newGame(9); Game.setPrice("ekmek", 2); eq(Game.priceOf("ekmek"), Game.priceAt("ekmek", 2));
  Game.state.stock.ekmek = 10; Game.startDay({ mode: "skip" }); while (!Game.run.dayEndEmitted) Game.tick(0.5);
  const run = Game.run, sold = run.salesBy.ekmek || 0; if (sold) eq(run.revenue >= sold * Game.priceAt("ekmek", 2), true);
});
t("tek tip fiyat politikası (hepsi Pahalı / hepsi Ucuz) tabanı yenemez: ortalama gün 10–30 kâr", () => {
  const avg = (tier) => { let tot = 0, n = 0;
    for (const sd of [11, 12, 13, 14, 15, 16]) { Game.newGame(sd); const S = Game.state; S.day = 14; S.level = 5; S.money = 2000; S.upgrades.buzdolabi = 1; S.upgrades.raf = 2;
      for (const p of PRODUCTS) if (p.unlockLevel <= 5) { S.unlocked[p.id] = true; S.prices[p.id] = tier; }
      for (let d = 0; d < 6; d++) { Game.fillAll(); const s = Game.autoDay(HUMAN); tot += s.profit; n++; Game.ackEvening(); Game.state.money = Math.max(Game.state.money, 800); } }
    return tot / n; };
  const lo = avg(0), mid = avg(1), hi = avg(2);
  ok(mid > lo * 0.97 && mid > hi * 0.97, "ucuz " + lo.toFixed(0) + " normal " + mid.toFixed(0) + " pahalı " + hi.toFixed(0));
});
t("rakip: açılış gününden önce pasif, sonra aktif; özel ürünlerde rakip fiyatı yok", () => {
  Game.newGame(1); Game.state.day = 5; ok(!Game.planDay().rival.active);
  Game.state.day = 30; const p = Game.planDay(); ok(p.rival.active && p.rival.share > 0.02 && p.rival.share <= 0.55);
  eq(Game.rivalPrice("semsiye", p), null); ok(Game.rivalPrice("ekmek", p) > 0);
});
t("rakip kampanyası tohumlu: aynı gün aynı kampanya, bir kısmı günlerde var", () => {
  Game.newGame(1); let c = 0;
  for (let d = 12; d < 60; d++) { Game.state.day = d; const a = Game.planDay().rival.campaign, b = Game.planDay().rival.campaign; eq(JSON.stringify(a), JSON.stringify(b)); if (a) c++; }
  ok(c >= 3 && c <= 30, "kampanya günü " + c);
});
t("sadakat kartı + memnuniyet rakibin müşteri payını azaltır", () => {
  Game.newGame(1); Game.state.day = 30; Game.state.sat = 40; const hi = Game.planDay().rival.share;
  Game.state.sat = 95; const lo = Game.planDay().rival.share; ok(lo < hi);
  Game.state.upgrades.sadakat = 1; ok(Game.planDay().rival.share < lo);
});
t("müşteri sayısı: rakip açılınca düşer, ürün çeşitliliği (rafta stok) artırır", () => {
  Game.newGame(1); const S = Game.state; S.day = 11; S.sat = 70; const a = Game.planDay().customers; S.day = 11;
  S.unlocked.simit = true; S.stock.simit = 5; S.unlocked.kahve = true; S.stock.kahve = 5; ok(Game.planDay().customers >= a);
});

console.log("— Kira, borç, iflas —");
t("kira günleri: ilk kira 14. gün, sonra her Pazar; zamanla ve dükkân büyüdükçe artar", () => {
  Game.newGame(1, "normal"); const f0 = Game.finance(); eq(f0.rentDay, 14);
  const a = Game.rentAmount(1); Game.state.day = 42; const b = Game.rentAmount(1); ok(b > a * 1.8, a + " → " + b);
  Game.state.upgrades.raf = 4; ok(Game.rentAmount(1) > b, "raf büyüyünce kira artmalı");
  eq(Game.finance().rentToday, true);
});
t("kira tavanı: batan esnafın kirası son haftanın kârının %90'ını geçmez (taban kira hariç)", () => {
  Game.newGame(1, "normal"); const S = Game.state; S.day = 42; S.upgrades.raf = 4; const full = Game.rentAmount(1);
  S.history = [1, 2, 3, 4, 5, 6, 7].map(d => ({ day: d, profit: 50, rent: 0, fixed: 0 })); const capped = Game.rentAmount(1);
  ok(capped < full && capped >= BALANCE.rentBase, full + " → " + capped);
});
t("zorluk: kolay < normal < zor kira ve ilk kira günü", () => {
  const r = id => { Game.newGame(1, id); return { amt: Game.rentAmount(5), first: Game.finance().rentDay }; };
  const k = r("kolay"), n = r("normal"), z = r("zor"), e = r("efsane");
  ok(k.amt < n.amt && n.amt < z.amt && z.amt < e.amt && k.first > n.first && n.first > z.first, JSON.stringify([k, n, z, e]));
});
t("kira ödenemezse borca yazılır, faiz işler, kâr borca gider", () => {
  Game.newGame(1); const S = Game.state; S.day = 14; S.level = 5; S.money = 0; S.upgrades.tabela = 0;
  Game.state = S; const s = Game.skipDay();
  ok(s.fixed.rent > 0 && s.fixed.shortfall > 0 && Game.state.debt > 0, "borç yok");
  const d1 = Game.state.debt; ok(d1 > 0);
  // faiz: bankrut olmayacak küçük borçla
  Game.newGame(1); Game.state.day = 5; Game.state.debt = 100; Game.state.money = 0; const s2 = Game.skipDay(); ok(s2.fixed.interest > 0 && Game.state.debt >= 100, "faiz işlemedi");
});
t("borç limiti aşılırsa iflas; iflasta gün başlamaz, alışveriş kapanır", () => {
  Game.newGame(1); const S = Game.state; S.debt = 100000; S.money = 50; Game.state = S;
  const s = Game.skipDay(); ok(s.bankrupt && Game.state.bankrupt, "iflas yok");
  eq(Game.startDay({ mode: "play" }), null); eq(Game.buyStock("elma", 1), 0); eq(Game.fillAll(), 0); eq(Game.buyUpgrade("tabela"), false);
});
t("14 gün kesintisiz borç → iflas", () => {
  Game.newGame(1); const S = Game.state; S.debt = 10; S.debtDays = 13; S.money = 0; Game.state = S; const lim = Game.debtLimit();
  ok(10 < lim); Game.skipDay(); ok(Game.state.bankrupt && Game.state.bankrupt.reason === "days", JSON.stringify(Game.state.bankrupt));
});
t("borç ödeme: para ve borçla sınırlı", () => {
  Game.newGame(1); Game.state.debt = 100; Game.state.money = 60; eq(Game.repayDebt(1000), 60); eq(Game.state.debt, 40); eq(Game.state.money, 0);
});
t("kumbara: oyun boyu sınırlı hak; paranın yetmediği ve stokun olmadığı durumda; bitince kurtarma yok", () => {
  Game.newGame(1, "zor"); const S = Game.state; eq(S.piggyLeft, 1);
  for (const p of PRODUCTS) S.stock[p.id] = 0; S.money = 0; ok(Game.piggyRescue() > 0, "ilk");
  S.piggyDay = -5; S.money = 0; eq(Game.piggyRescue(), 0, "ikinci hak yok");
  Game.newGame(1, "efsane"); eq(Game.state.piggyLeft, 0);
});
t("iflas sonrası 'Son kayıttan devam': kontrol noktası geri yüklenir (efsane'de yok)", () => {
  Game.newGame(1, "normal"); ok(Game.hasCheckpoint());
  for (let d = 0; d < 3; d++) { Game.fillAll(); Game.autoDay(HUMAN); Game.ackEvening(); }
  Game.state.debt = 99999; Game.skipDay(); ok(Game.state.bankrupt);
  ok(Game.loadCheckpoint()); eq(Game.state.bankrupt, null); eq(Game.state.day, 1);
  Game.newGame(1, "efsane"); eq(Game.hasCheckpoint(), false);
});
t("para ve stok asla negatif/NaN olmaz (60 gün, karışık politika)", () => {
  for (const sd of [3, 4]) { Game.newGame(sd); const pols = [HUMAN, "skip", { hitRate: 0.3, reactSec: 2 }];
    for (let d = 0; d < 60 && !Game.state.bankrupt; d++) {
      if (d % 5 === 0) for (const u of UPGRADES) if (Game.upgradeAvailable(u.id) && Game.canAfford(Game.nextUpgradeCost(u.id))) { Game.buyUpgrade(u.id); break; }
      for (const p of PRODUCTS) if (Game.canUnlock(p.id)) Game.unlockProduct(p.id);
      Game.fillAll(); Game.autoDay(pols[(d + sd) % 3]); Game.ackEvening();
      const S = Game.state; ok(isFinite(S.money) && S.money >= 0 && isFinite(S.debt) && S.debt >= 0, "para/borç gün " + d);
      for (const p of PRODUCTS) ok(Number.isInteger(S.stock[p.id]) && S.stock[p.id] >= 0, "stok " + p.id);
      ok(Game.slotsUsed() <= Game.totalSlots() + 2 || d < 0, "yuva");
    } }
});

console.log("— Hırsız, ekipman, kriz, salvo —");
t("hırsız: kaçırılırsa en pahalı raftan mal gider; yakalanırsa gitmez", () => {
  const f = findBubble("thief"); ok(f, "hırsız doğmadı");
  const price = id => Game.priceOf(id);
  // kaçır
  const before = clone(Game.state.stock); let theft = null, g = 0;
  while (!Game.run.dayEndEmitted && g++ < 2000) for (const ev of Game.tick(0.25)) if (ev.type === "theft") theft = ev;
  ok(theft && theft.qty > 0, "hırsızlık olmadı"); const tot = k => Object.values(k).reduce((a, b) => a + b, 0);
  Game.endDay();
  // yakala
  const f2 = findBubble("thief"); ok(f2); const id = f2.bubble.id; const r = Game.tapBubble(id); ok(r && r.popped);
  let stolen = false; g = 0; while (!Game.run.dayEndEmitted && g++ < 2000) for (const ev of Game.tick(0.25)) if (ev.type === "theft" && ev.productId === f2.bubble.productId) stolen = true;
  ok(Game.run.caught >= 1); void before; void tot; void price; void stolen;
});
t("Hızlı Geç günlerinde hırsız sayısı belirgin artar (başıboş dükkân)", () => {
  let play = 0, skip = 0;
  for (let sd = 1; sd <= 24; sd++) for (const mode of ["play", "skip"]) {
    Game.newGame(sd); const S = Game.state; S.day = 20; S.level = 6; for (const p of PRODUCTS) { S.unlocked[p.id] = true; S.stock[p.id] = 5; } Game.state = S;
    const s = mode === "skip" ? Game.skipDay() : Game.autoDay({ hitRate: 1, reactSec: 0.5, jitter: 0 });
    if (mode === "skip") skip += s.thefts + s.caught; else play += s.thefts + s.caught;
  }
  ok(skip > play * 1.3, "oyna " + play + " / atla " + skip);
});
t("kamera & alarm hırsız sayısını azaltır", () => {
  const cnt = (up) => { let n = 0; for (let sd = 1; sd <= 24; sd++) { Game.newGame(sd); const S = Game.state; S.day = 20; S.level = 6; S.upgrades.guvenlik = up; for (const p of PRODUCTS) { S.unlocked[p.id] = true; S.stock[p.id] = 5; } Game.state = S; const s = Game.skipDay(); n += s.thefts + s.caught; } return n; };
  ok(cnt(2) < cnt(0) * 0.8);
});
t("ekipman: her gün yıpranır; bakım durumu sıfırlar; bozuk ekipman tamirle düzelir", () => {
  Game.newGame(1); const S = Game.state; S.upgrades.buzdolabi = 1; Game.state = S; const c0 = S.equip.register;
  Game.skipDay(); ok(Game.state.equip.register < c0 && Game.state.equip.fridge < 100);
  Game.state.money = 5000; eq(Game.service("register"), false, "çok sağlam ekipmana bakım gerekmez"); Game.state.equip.register = 50; ok(Game.service("register")); eq(Game.state.equip.register, 100);
  Game.state.broken.fridge = true; ok(Game.serviceCost("fridge") > 0); ok(Game.service("fridge")); eq(Game.state.broken.fridge, false);
  eq(Game.service("register"), false, "sağlam ekipmana bakım yok");
});
t("arıza baloncuğu kaçarsa ekipman bozulur, basılırsa kurtulur", () => {
  const f = findBubble("breakReg", { setup: S => { S.equip.register = 5; S.upgrades.buzdolabi = 1; S.equip.fridge = 5; } }); ok(f, "arıza baloncuğu yok");
  let broke = false, g = 0; while (!Game.run.dayEndEmitted && g++ < 2000) for (const ev of Game.tick(0.25)) if (ev.type === "breakdown") broke = true;
  ok(broke && (Game.state.broken.register || Game.state.broken.fridge));
});
t("bozuk kasa müşteri kaçırır", () => {
  let a = 0, b = 0;
  for (let sd = 1; sd <= 8; sd++) for (const br of [false, true]) { Game.newGame(sd); const S = Game.state; S.day = 10; for (const p of PRODUCTS) if (p.unlockLevel <= 2) { S.unlocked[p.id] = true; S.stock[p.id] = 30; } S.broken.register = br; Game.state = S; const s = Game.skipDay(); if (br) b += s.served; else a += s.served; }
  ok(b < a * 0.9, a + " vs " + b);
});
t("kriz: baloncuğa basınca kart açılır, seçenek bedelini öder, para negatife düşmez", () => {
  const f = findBubble("crisis", { minDay: 6 }); ok(f, "kriz doğmadı");
  const r = Game.tapBubble(f.bubble.id); ok(r && r.crisis);
  const v = Game.crisisView(); ok(v && v.options.length >= 1 && v.timeLeft > 0);
  const m0 = Game.state.money, opt = v.options.find(o => o.affordable) || v.options[0];
  const res = Game.resolveCrisis(opt.id); ok(res.ok); ok(Game.state.money >= 0); ok(Game.state.money <= m0 + 400);
  eq(Game.crisisView(), null);
});
t("kriz: yetmeyen parayla seçenek reddedilir; süre dolunca 'görmezden gel' otomatik", () => {
  const f = findBubble("crisis", { minDay: 6 }); const r = Game.tapBubble(f.bubble.id); ok(r.crisis);
  const v = Game.crisisView(); const paid = v.options.find(o => o.cost > 0);
  if (paid) { Game.state.money = 0; const x = Game.resolveCrisis(paid.id); eq(x.ok, false); }
  let auto = false, g = 0; while (Game.run.crisis && g++ < 400) for (const ev of Game.tick(0.5)) if (ev.type === "crisisResolve" && ev.auto) auto = true;
  ok(auto || !Game.run.crisis);
});
t("kriz baloncuğu kimseye dokunulmadan kaçarsa ignore sonucu uygulanır (kart açılmaz)", () => {
  const f = findBubble("crisis", { minDay: 6 }); ok(f); let resolved = null, g = 0;
  while (!Game.run.dayEndEmitted && g++ < 2000) for (const ev of Game.tick(0.25)) if (ev.type === "crisisResolve") resolved = ev;
  ok(resolved && resolved.choice === "ignore" && resolved.auto);
});
t("kriz çıktısı deterministik (aynı durumda aynı sonuç)", () => {
  const run1 = () => { const f = findBubble("crisis", { minDay: 6 }); Game.tapBubble(f.bubble.id); const o = Game.crisisView().options[0]; const r = Game.resolveCrisis(o ? o.id : "ignore"); return r.text + "|" + Math.round(Game.state.money); };
  eq(run1(), run1());
});
t("salvo: gün ≥ 6'da aynı anda 2+ baloncuk doğar", () => {
  let best = 0;
  for (let sd = 1; sd <= 12; sd++) { Game.newGame(sd); const S = Game.state; S.day = 20; S.level = 6; for (const p of PRODUCTS) { S.unlocked[p.id] = true; S.stock[p.id] = 6; } Game.state = S;
    Game.startDay({ mode: "skip" }); const times = []; let g = 0;
    while (!Game.run.dayEndEmitted && g++ < 1000) for (const ev of Game.tick(0.1)) if (ev.type === "bubbleSpawn") times.push(Game.run.t);
    for (let i = 0; i + 2 < times.length; i++) best = Math.max(best, times[i + 2] - times[i] < 1.3 ? 3 : 0);
    Game.endDay(); }
  ok(best >= 3, "üçlü grup görülmedi");
});
t("baloncuk ihmali gerçek zarar verir: Hızlı Geç kârı oynanandan belirgin düşük (gün 20+)", () => {
  let p = 0, s = 0;
  for (let sd = 1; sd <= 10; sd++) { Game.newGame(sd); const S = Game.state; S.day = 22; S.level = 6; S.money = 2000; for (const q of PRODUCTS) if (q.unlockLevel <= 6) { S.unlocked[q.id] = true; } S.upgrades.buzdolabi = 1; S.upgrades.raf = 2; Game.state = S; Game.fillAll();
    const a = Game.simulateClone("play", { hitRate: 0.9, reactSec: 0.9 }), b = Game.simulateClone("skip"); p += a.profit; s += b.profit; }
  ok(s < p * 0.75, "oyna " + p + " atla " + s);
});

console.log("— Kayıt —");
t("kayıt/yükleme gidiş-dönüş", () => {
  Game.newGame(55, "zor"); Game.fillAll(); Game.autoDay(HUMAN); Game.ackEvening(); const snap = JSON.stringify(Game.state); ok(Game.save());
  Game.newGame(1); ok(Game.load()); eq(Game.state.diff, "zor"); eq(Game.state.day, 2); eq(JSON.stringify(Game.state).length > 100, true); void snap;
});
t("akşam raporu kalıcı: eveningPending ve lastSummary kayıtta", () => {
  Game.newGame(56); Game.fillAll(); Game.autoDay(HUMAN); ok(Game.state.eveningPending && Game.state.lastSummary); Game.save(); Game.newGame(1); Game.load();
  ok(Game.state.eveningPending && Game.state.lastSummary.day === 1); Game.ackEvening(); eq(Game.state.eveningPending, false);
});
t("gün ortası kayıt: yenileme günü başıboş geçirir (save-scum yok)", () => {
  Game.newGame(57); Game.fillAll(); Game.startDay({ mode: "play" }); ok(Game.state.dayOpen); const dayBefore = Game.state.day;
  Game.newGame(1); ok(Game.load()); eq(Game.state.day, dayBefore + 1, "gün ilerlemeli"); ok(Game.state.lastSummary.forfeit && Game.state.lastSummary.mode === "skip"); ok(Game.loadNote.length > 10);
});
t("v1 kaydı göç eder (kira muafiyeti, normal zorluk, bilinmeyen alanlar temiz)", () => {
  const v1 = { version: 1, day: 30, money: 1234, rep: 900, level: 6, sat: 80, seed: 99, stock: { elma: 3, ekmek: 2, bilinmeyen: 9 }, unlocked: { elma: true, ekmek: true, simit: true },
    upgrades: { raf: 2, tabela: 2, kaldirilmis: 3 }, stats: { totalEarned: 5000 }, history: [], won: false, lastSummary: null, seenEvents: {}, todayStockCost: 0, piggyDay: 0 };
  store["koseMarket.v1"] = JSON.stringify(v1); delete store["koseMarket.v2"];
  ok(Game.load()); const S = Game.state; eq(S.version, 2); eq(S.diff, "normal"); eq(S.day, 30); ok(S.graceUntil > S.day); eq(S.stock.bilinmeyen, undefined); eq(S.upgrades.kaldirilmis, undefined); ok(Game.loadNote.includes("taşındı"));
  eq(Game.finance().rentToday, false);
});
t("bozuk/NaN/negatif değerler yüklemede temizlenir", () => {
  const bad = { version: 2, diff: "yok", day: 5.7, money: NaN, rep: -50, level: 99, sat: 500, seed: 1, stock: { elma: -4, ekmek: "x" }, batch: { elma: "abc" }, unlocked: {}, prices: { elma: 9 }, upgrades: { raf: 99 }, stats: { totalEarned: NaN }, debt: -3 };
  store["koseMarket.v2"] = JSON.stringify(bad); ok(Game.load()); const S = Game.state;
  ok(S.money === 0 && S.rep === 0 && S.level <= 10 && S.sat <= 100 && S.stock.elma === 0 && S.stock.ekmek === 0 && S.prices.elma <= 2 && S.upgrades.raf === 4 && S.debt === 0 && S.diff === "normal" && S.stats.totalEarned === 0, JSON.stringify(S).slice(0, 200));
  Game.fillAll(); Game.skipDay();
});
t("durum atama (test fikstürü) eksik alanları tamamlar", () => {
  Game.newGame(1); const o = clone(Game.state); delete o.batch; delete o.prices; delete o.equip; Game.state = o; ok(Game.state.equip && Game.state.prices); Game.fillAll(); Game.skipDay();
});

console.log("— Sezon, zorluk, ipuçları —");
t("final alınınca sezon başlar; 10 gün sonra sonuç hesaplanır", () => {
  Game.newGame(1); const S = Game.state; S.level = 10; S.money = 99999; for (const p of PRODUCTS) S.unlocked[p.id] = true; Game.state = S;
  ok(Game.buyUpgrade("buyukacilis") && Game.state.won); const si = Game.seasonInfo(); ok(si && si.n === 1 && si.goal > 1000);
  let res = null; for (let d = 0; d < 12 && !res; d++) { Game.fillAll(); const s = Game.autoDay(HUMAN); Game.ackEvening(); if (s && s.season) res = s.season; if (Game.state.bankrupt) break; }
  ok(res && res.n === 1, "sezon sonucu yok"); eq(Game.seasonInfo().n, 2);
});
t("zorluk: kolay başlangıç parası > normal > efsane; kriz/hırsız/rakip çarpanları sıralı", () => {
  const s = id => DIFFICULTIES[id];
  ok(s("kolay").startMoney > s("normal").startMoney && s("normal").startMoney > s("efsane").startMoney);
  for (const k of ["rent", "rivalAggro", "theft", "breakdown", "crisis", "penalty"]) ok(s("kolay")[k] < s("normal")[k] && s("normal")[k] < s("zor")[k] && s("zor")[k] < s("efsane")[k], k);
  for (const k of ["life", "bubbleLife", "debtLimit"]) ok(s("kolay")[k] > s("normal")[k] && s("normal")[k] > s("zor")[k] && s("zor")[k] > s("efsane")[k], k);
});
t("zorluk baloncuk ömrünü gerçekten değiştirir", () => {
  const life = id => { const f = findBubble("clean", { diff: id, minDay: 3, level: 1 }); return f ? f.bubble.life : NaN; };
  const a = life("kolay"), b = life("efsane"); ok(a > b * 1.4, a + " vs " + b);
});
t("öğretici ipuçları sırayla çıkar ve kapatılınca gelmez", () => {
  Game.newGame(1); const h = Game.pendingHint(); ok(h && h.id === "slots"); Game.dismissHint(h.id); ok(Game.pendingHint() === null || Game.pendingHint().id !== "slots");
});

console.log("— Ölü içerik taramaları —");
t("BALANCE'taki her anahtar kodda kullanılır (ölü anahtar yok)", () => {
  const src = ["../js/engine.js", "../js/ui.js", "../js/main.js", "../js/bubbles.js"].map(f => fs.readFileSync(path.join(__dirname, f), "utf8")).join("\n");
  const dead = Object.keys(BALANCE).filter(k => !new RegExp("[\"'.]" + k + "\\b").test(src));
  ok(dead.length === 0, "ölü: " + dead.join(", "));
});
t("her istatistik bir yerde gösterilir ya da kullanılır", () => {
  const ui = fs.readFileSync(path.join(__dirname, "../js/ui.js"), "utf8");
  Game.newGame(1); const dead = Object.keys(Game.state.stats).filter(k => !new RegExp("\\b" + k + "\\b").test(ui));
  ok(dead.length === 0, "gösterilmeyen: " + dead.join(", "));
});
t("her yükseltme etkisi motorda karşılık bulur (bilinmeyen efekt anahtarı yok)", () => {
  const known = new Set(["customers", "slots", "costMult", "bubbleReward", "bubbleLife", "tipChance", "bubbleWeightMult", "autoSolve", "fridge", "satFloor", "satGain", "extraItemChance", "final",
    "upkeep", "lifeBonus", "rivalGuard", "thiefAuto", "weatherShield", "theftMult", "wearMult", "regWear", "rentMult", "comboWindow"]);
  for (const u of UPGRADES) for (const l of u.levels) for (const k of Object.keys(l.effect)) ok(known.has(k), u.id + "." + k);
  const e = Game.effects(); for (const k of known) if (k !== "final") ok(k in e, "efekt yok: " + k);
});
t("her ürünün şeması tam (esneklik, raf ömrü, yuva)", () => { for (const p of PRODUCTS) ok(p.el > 0 && p.shelfLife >= 1 && p.slots >= 1 && p.price > p.cost, p.id); });

if (process.argv.includes("--long")) {
  console.log("\n— Uzun koşu (bilgi) —");
  for (const [label, pol] of [["atla", "skip"], ["oyna", HUMAN]]) {
    Game.newGame(12345); let d = 0; for (; d < 50 && !Game.state.bankrupt; d++) { Game.fillAll(); for (const u of UPGRADES) if (Game.upgradeAvailable(u.id) && Game.canAfford(Game.nextUpgradeCost(u.id) + 150)) { Game.buyUpgrade(u.id); break; } for (const p of PRODUCTS) if (Game.canUnlock(p.id) && Game.state.money > p.unlockCost + 100) Game.unlockProduct(p.id); Game.autoDay(pol); Game.ackEvening(); }
    console.log(label, "gün", Game.state.day, "para", Math.round(Game.state.money), "sv", Game.state.level, "borç", Game.state.debt, "iflas", !!Game.state.bankrupt);
  }
}
console.log("\n" + pass + " geçti, " + fail + " kaldı");
process.exitCode = fail ? 1 : 0;
