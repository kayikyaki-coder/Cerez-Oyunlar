// engine.js — Köşe Market motoru: durum, ekonomi, tohumlu gün simülasyonu, baloncuk/kombo mantığı, kayıt.
// DOM'a dokunmaz; tarayıcıda global `Game`, Node'da module.exports = { Game }.

if (typeof module !== "undefined" && typeof PRODUCTS === "undefined") {
  try { Object.assign(globalThis, require("./data.js")); } catch (e) { /* veri yoksa test fikstürü kullanılır */ }
}

const Game = (() => {
  "use strict";

  const SAVE_KEY = "koseMarket.v1";
  const SAVE_VERSION = 1;

  // ---------- VERİ ERİŞİMİ (tarayıcıda top-level const'lar globalThis'te değil → typeof ile) ----------
  const BAL = () => (typeof BALANCE !== "undefined" ? BALANCE : {});
  const PRODS = () => (typeof PRODUCTS !== "undefined" ? PRODUCTS : []);
  const UPGS = () => (typeof UPGRADES !== "undefined" ? UPGRADES : []);
  const BTYPES = () => (typeof BUBBLE_TYPES !== "undefined" ? BUBBLE_TYPES : {});
  const WDAYS = () => (typeof WEEKDAYS !== "undefined" && WEEKDAYS.length ? WEEKDAYS : [{ id: "gun", name: "Gün", customerMult: 1 }]);
  const WTHRS = () => (typeof WEATHERS !== "undefined" && WEATHERS.length ? WEATHERS : [{ id: "normal", name: "Açık", emoji: "🌤️", customerMult: 1, weight: 1 }]);
  const EVENTS = () => (typeof DAY_EVENTS !== "undefined" ? DAY_EVENTS : []);
  const GGOALS = () => (typeof GENERIC_GOALS !== "undefined" ? GENERIC_GOALS : []);
  const REGS = () => (typeof REGULARS !== "undefined" ? REGULARS : []);
  const LVLS = () => (typeof LEVELS !== "undefined" && LEVELS.length ? LEVELS : [{ level: 1, rep: 0, title: "Köşedeki Dükkân" }]);

  // BALANCE[k] ?? varsayılan
  const B = (k, d) => { const v = BAL()[k]; return v === undefined || v === null ? d : v; };

  const product = id => PRODS().find(p => p.id === id) || null;
  const upgradeDef = id => UPGS().find(u => u.id === id) || null;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const clone = o => JSON.parse(JSON.stringify(o));

  // ---------- TOHUMLU RNG ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(...nums) {
    let h = 0x811C9DC5;
    for (const n of nums) { h = Math.imul(h ^ (n | 0), 0x9E3779B1); h ^= h >>> 15; }
    return h >>> 0;
  }
  // Akışlar: aynı gün için plan/müşteri/baloncuk dizisi hep aynı → oyna/atla adil karşılaştırılır
  const STREAM = { plan: 11, customers: 23, bubbles: 37, run: 41, policy: 59 };
  const rngFor = stream => mulberry32(hash(S.seed, S.day, stream));
  function weightedPick(rng, list, wf) {
    let tot = 0; for (const x of list) tot += Math.max(0, wf(x));
    if (tot <= 0) return list.length ? list[Math.floor(rng() * list.length)] : null;
    let r = rng() * tot;
    for (const x of list) { r -= Math.max(0, wf(x)); if (r < 0) return x; }
    return list[list.length - 1];
  }

  // ---------- DURUM ----------
  let S = null;            // kalıcı durum
  let run = null;          // aktif gün
  let runSnapshot = null;  // startDay anındaki durum (estSkipNet için)
  let headless = false;    // klon simülasyonunda kayıt/tahmin yok

  function blankStats() {
    return { totalEarned: 0, bubblesPopped: 0, bubblesMissed: 0, bestCombo: 1, daysPlayed: 0, daysSkipped: 0,
      customersServed: 0, customersMissed: 0, itemsSold: 0, goalsDone: 0, regularsServed: 0, tips: 0,
      stockSpent: 0, spoiled: 0, playBonus: 0, bestDayNet: 0, piggyUsed: 0, upgradesBought: 0 };
  }

  function newGame(seed) {
    const sd = (seed === undefined || seed === null) ? ((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0) : (seed >>> 0);
    S = {
      version: SAVE_VERSION, day: 1, money: B("startMoney", 40), rep: 0, level: 1, sat: B("satStart", 70), seed: sd,
      stock: {}, unlocked: {}, upgrades: {}, stats: blankStats(), history: [], won: false, wonDay: null,
      lastSummary: null, seenEvents: {}, lastEventId: null, todayStockCost: 0, piggyDay: 0
    };
    const ss = B("startStock", 3);
    for (const p of PRODS()) {
      S.stock[p.id] = 0;
      if ((p.unlockLevel || 1) <= 1 && !(p.unlockCost > 0)) S.unlocked[p.id] = true;
      if (S.unlocked[p.id]) S.stock[p.id] = typeof ss === "number" ? ss : (ss[p.id] || 0);
    }
    run = null; runSnapshot = null;
    return S;
  }

  // ---------- YÜKSELTME EFEKTLERİ ----------
  const MULT_KEYS = { costMult: 1, bubbleReward: 1, satGain: 1 };
  function effects(st) {
    st = st || S;
    const e = { customers: 0, shelfCap: 0, costMult: 1, bubbleReward: 1, bubbleLife: 0, tipChance: 0, bubbleWeightMult: {},
      autoSolve: 0, fridge: false, satFloor: 0, satGain: 1, extraItemChance: 0, final: false };
    for (const u of UPGS()) {
      const lvl = (st.upgrades && st.upgrades[u.id]) || 0;
      for (let i = 0; i < lvl && i < (u.levels || []).length; i++) {
        const ef = u.levels[i].effect || {};
        for (const k in ef) {
          const v = ef[k];
          if (typeof v === "boolean") e[k] = e[k] || v;
          else if (v && typeof v === "object") { e[k] = e[k] || {}; for (const s in v) e[k][s] = (e[k][s] === undefined ? 1 : e[k][s]) * v[s]; }
          else if (typeof v === "number") { if (k in MULT_KEYS) e[k] *= v; else e[k] = (e[k] || 0) + v; }
          else e[k] = v;
        }
      }
    }
    e.autoSolve = clamp(e.autoSolve, 0, B("autoSolveMax", 0.9));
    return e;
  }
  const shelfCap = () => B("shelfCapBase", 8) + effects().shelfCap;

  // ---------- GÜN PLANI ----------
  // Memnuniyet → yarının müşteri çarpanı (satMid'de 1.0, satMax'ta +swing; ±swing'e kırpılır)
  function satMult(sat) {
    const mid = B("satMid", 60), swing = B("satCustomerSwing", 0.15), top = B("satMax", 100);
    return 1 + clamp(((sat - mid) / Math.max(1, top - mid)) * swing, -swing, swing);
  }
  // demandMods: ürün id'si ve kategori ikisi de eşleşirse çarpılır
  const modFor = (mods, p) => (mods ? (mods[p.id] !== undefined ? mods[p.id] : 1) * (mods[p.cat] !== undefined ? mods[p.cat] : 1) : 1);
  const bmod = (mods, id) => (mods && mods[id] !== undefined ? mods[id] : 1);
  const COUNT_GOALS = { pop: 1, sales: 1, earn: 1, serve: 1, regulars: 1 };

  function normGoal(g, src, day) {
    if (!g) return null;
    let target = g.count !== undefined ? g.count : g.value !== undefined ? g.value : g.target !== undefined ? g.target : g.amount;
    if (target === undefined) target = 0;
    const scale = g.scaleWithDay ? 1 + B("goalScalePerDay", 0.03) * (day - 1) : 1;
    if (COUNT_GOALS[g.type]) target = Math.round(target * scale);   // kombo/sat hedefi ölçeklenmez (tavanı aşmasın)
    const reward = { money: Math.round(((g.reward && g.reward.money) || 0) * scale),
      rep: (g.reward && g.reward.rep !== undefined) ? g.reward.rep : B("repPerGoal", 8) };
    const orig = g.count !== undefined ? g.count : g.value;
    let text = String(g.text || "").replace(/\{n\}/g, target);
    if (orig !== undefined && target !== orig) text = text.replace(String(orig), String(target));
    return { type: g.type, target, bubble: g.bubble && g.bubble !== "any" ? g.bubble : null, productId: g.productId || null,
      cat: g.cat || null, reward, text, source: src };
  }

  function planDay() {
    const rng = rngFor(STREAM.plan), day = S.day, e = effects();
    const wds = WDAYS(), weekday = wds[(day - 1) % wds.length];
    const weather = weightedPick(rng, WTHRS().filter(w => (w.minDay || 1) <= day), w => (w.weight === undefined ? 1 : w.weight));

    // Olay: sabit günlü garanti, yoksa şansla ağırlıklı seçim (rng tüketimi sabit sırada)
    const eligible = ev => !(ev.once && S.seenEvents[ev.id]) && (ev.minDay || 1) <= day && (ev.minLevel || 1) <= S.level &&
      (!ev.weekday || ev.weekday === weekday.id) && (!ev.weather || ev.weather === weather.id) &&
      (!ev.weathers || ev.weathers.includes(weather.id));
    let event = EVENTS().find(ev => ev.fixedDay === day && eligible(ev)) || null;
    const roll = rng();
    const pool = EVENTS().filter(ev => !ev.fixedDay && eligible(ev) && ev.id !== S.lastEventId);
    const pick = weightedPick(rng, pool, ev => (ev.weight === undefined ? 1 : ev.weight));
    if (!event && day >= B("eventStartDay", 2) && roll < B("eventChance", 0.4)) event = pick;

    // Hedef: olayın hedefi yoksa genel hedeften seç
    const gg = GGOALS().filter(g => (g.minDay || 1) <= day && (g.minLevel || 1) <= S.level);
    const gU = rng();
    const goal = (event && event.goal) ? normGoal(event.goal, "event", day)
      : (gg.length ? normGoal(gg[Math.floor(gU * gg.length)], "generic", day) : null);

    // Beklenen müşteri
    const base = B("baseCustomers", 14) + B("customerGrowthPerDay", 0.35) * (day - 1) +
      B("customerGrowthPerLevel", 1.5) * (S.level - 1) + e.customers;
    const mult = (weekday.customerMult || 1) * (weather.customerMult || 1) * ((event && event.customerMult) || 1) * satMult(S.sat);
    const customers = clamp(Math.round(base * mult), B("minCustomers", 4), B("customersMax", 80));

    // Talep ağırlıkları (kilitli ürünler dahil — tahmin ekranı için)
    const demand = {};
    for (const p of PRODS()) {
      const d = p.demand * modFor(weekday.demandMods, p) * modFor(weather.demandMods, p) * modFor(event && event.demandMods, p);
      demand[p.id] = +Math.max(B("demandFloor", 0.05), d).toFixed(3);
    }

    // Mahalle sakinleri: olay garantisi + her uygun sakin şansla (her sakin tam 1 rng tüketir)
    const regulars = (event && event.regulars ? event.regulars.slice() : []);
    for (const r of REGS()) {
      const u = rng();
      if (regulars.includes(r.id) || (r.minDay || 1) > day) continue;
      if (r.likes && !S.unlocked[r.likes]) continue;
      if (u < B("regularChance", 0.6)) regulars.push(r.id);
    }
    const nFix = event && event.regulars ? event.regulars.length : 0;
    const rest = regulars.slice(nFix);
    for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
    const regs = regulars.slice(0, nFix).concat(rest).slice(0, B("regularsPerDayMax", 2));

    const bits = [weekday.name, `${weather.emoji || ""} ${weather.name}`.trim(), `~${customers} müşteri`];
    if (event) bits.push(`${event.emoji || ""} ${event.name}`.trim());
    return { day, weekday, weather, event, goal, customers, demand, regulars: regs, forecastText: bits.join(" · ") };
  }

  // ---------- SABAH: ALIŞVERİŞ ----------
  function unitCost(id, plan) {
    const p = product(id); if (!p) return Infinity;
    plan = plan || planDay();
    const evMult = (plan.event && plan.event.costMult) || 1;
    return Math.max(1, Math.round(p.cost * effects().costMult * evMult));
  }
  function buyStock(id, qty) {
    if (!S.unlocked[id] || !(qty > 0)) return 0;
    const c = unitCost(id), cap = shelfCap();
    const n = Math.max(0, Math.min(Math.floor(qty), cap - (S.stock[id] || 0), Math.floor(S.money / c)));
    if (n <= 0) return 0;
    S.money -= n * c; S.stock[id] = (S.stock[id] || 0) + n;
    S.todayStockCost += n * c; S.stats.stockSpent += n * c;
    return n;
  }
  // Müşteri başına beklenen ürün adedi (taban + ardışık ekstra atışlar)
  function avgItems(e) {
    const base = B("itemsPerCustomer", 1), max = B("maxItemsPerCustomer", 3), ch = clamp(B("extraItemChance", 0.3) + e.extraItemChance, 0, 1);
    let tot = base, p = 1;
    for (let k = base; k < max; k++) { p *= ch; tot += p; }
    return tot;
  }
  // Dengeli doldur: beklenen talebe göre hedef miktar (kapasiteye kadar), en "eksik" olana 1'er 1'er
  function fillAll() {
    const plan = planDay(), cap = shelfCap();
    const ids = PRODS().filter(p => S.unlocked[p.id]).map(p => p.id);
    let wsum = 0; for (const id of ids) wsum += plan.demand[id] || 0;
    const avgQty = avgItems(effects());
    const target = {};
    for (const id of ids) {
      const exp = plan.customers * ((plan.demand[id] || 0) / (wsum || 1)) * avgQty;
      target[id] = Math.min(cap, Math.ceil(exp * B("fillHeadroom", 1.3)) + 1);
    }
    const costs = {}; for (const id of ids) costs[id] = unitCost(id, plan);
    let bought = 0;
    for (let guard = 0; guard < 5000; guard++) {
      let best = null, bestScore = Infinity;
      for (const id of ids) {
        const have = S.stock[id] || 0;
        if (have >= target[id] || costs[id] > S.money) continue;
        const score = (have + 1) / Math.max(0.01, target[id]);
        if (score < bestScore) { bestScore = score; best = id; }
      }
      if (!best) break;
      S.money -= costs[best]; S.stock[best]++; S.todayStockCost += costs[best]; S.stats.stockSpent += costs[best]; bought++;
    }
    return bought;
  }
  function canUnlock(id) {
    const p = product(id);
    return !!p && !S.unlocked[id] && S.level >= (p.unlockLevel || 1) && S.money >= (p.unlockCost || 0);
  }
  function unlockProduct(id) {
    if (!canUnlock(id)) return false;
    S.money -= product(id).unlockCost || 0; S.unlocked[id] = true;
    return true;
  }
  const upgradeLevel = id => S.upgrades[id] || 0;
  function nextUpgradeCost(id) {
    const u = upgradeDef(id); if (!u) return null;
    const l = upgradeLevel(id);
    return l < (u.levels || []).length ? u.levels[l].cost : null;
  }
  function upgradeAvailable(id) {
    const u = upgradeDef(id); if (!u) return false;
    const l = upgradeLevel(id); if (l >= (u.levels || []).length) return false;
    return S.level >= Math.max(u.unlockLevel || 1, u.levels[l].minLevel || 1, u.levels[l].unlockLevel || 1);
  }
  const canAfford = c => c !== null && c !== undefined && S.money >= c;
  function buyUpgrade(id) {
    if (!upgradeAvailable(id)) return false;
    const u = upgradeDef(id), l = upgradeLevel(id), cost = u.levels[l].cost;
    if (S.money < cost) return false;
    S.money -= cost; S.upgrades[id] = l + 1; S.stats.upgradesBought++;
    const ef = u.levels[l].effect || {};
    if ((ef.final || u.final || u.cat === "final") && !S.won) { S.won = true; S.wonDay = S.day; }
    return true;
  }
  // Pamuk'un kumbarası: para en ucuz ürüne yetmiyor ve hiç stok yoksa, günde bir kez
  function piggyRescue() {
    if (S.piggyDay === S.day) return 0;
    const costs = PRODS().filter(p => S.unlocked[p.id]).map(p => unitCost(p.id));
    const cheapest = costs.length ? Math.min(...costs) : 0;
    const anyStock = Object.keys(S.stock).some(id => S.unlocked[id] && S.stock[id] > 0);
    if (S.money >= cheapest || anyStock) return 0;
    const amt = B("piggyBank", B("piggyAmount", 20));
    S.money += amt; S.piggyDay = S.day; S.stats.piggyUsed++;
    return amt;
  }

  // Raftaki stoğun alış değeri (taban fiyatla) — oyna/atla karşılaştırmasında kalan stok da hesaba katılsın
  const stockValue = () => PRODS().reduce((a, p) => a + (S.stock[p.id] || 0) * p.cost, 0);

  // ---------- GÜN SİMÜLASYONU ----------
  // Zamanlanmış işler kuyruğu: sonuç dt'den bağımsız (sadece zaman sırasına bağlı)
  function qPush(item) {
    item.seq = run.seq++;
    const q = run.queue; let lo = 0, hi = q.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (q[m].t < item.t || (q[m].t === item.t && q[m].seq < item.seq)) lo = m + 1; else hi = m; }
    q.splice(lo, 0, item);
  }
  const bubbleDayMult = () => (1 + B("bubbleRewardPerLevel", 0.15) * (S.level - 1)) * ((run.plan.event && run.plan.event.bubbleRewardMult) || 1);
  // Baloncuk ödülü = tür ödülü × global çarpan × yükseltme × seviye/olay çarpanı (× kombo)
  const bubbleBase = bt => (bt.reward || 1) * B("bubbleRewardMult", 1) * run.eff.bubbleReward * bubbleDayMult();
  const penaltyMult = () => 1 + B("bubblePenaltyPerLevel", 0.1) * (S.level - 1);

  const FACES = ["🧑", "👩", "🧓", "👨", "🧕", "👱", "🧔", "👧", "👦", "👩‍🦱", "👨‍🦳", "👩‍🦰"];
  const COLORS = ["#f7b2bd", "#a8d8ea", "#ffd3a5", "#c3e6a8", "#d5b8f0", "#ffe29a", "#b8e0d2", "#f5c6a5"];

  function startDay(opts) {
    const mode = (opts && opts.mode) === "skip" ? "skip" : "play";
    if (run && !run.ended) return run;
    piggyRescue();
    if (mode === "play" && !headless) runSnapshot = clone(S); else if (!headless) runSnapshot = null;
    const plan = planDay(), e = effects(), len = B("dayLength", 60);
    run = {
      day: S.day, t: 0, length: len, mode, plan, eff: e, queue: [], seq: 0, out: [],
      customersSpawned: 0, served: 0, missedCustomers: 0, lostCustomers: 0, sales: 0, revenue: 0, bubbleIncome: 0, tips: 0,
      combo: 1, maxCombo: 1, lastPopT: -999, popped: 0, missed: 0, autoSolved: 0, bubbles: {}, nextBid: 1,
      goal: plan.goal, goalProgress: 0, goalDone: false, goalFailed: false, goalReward: null,
      paused: {}, pausedAll: 0, emergencyCost: 0, moneyPenalty: 0, repBonus: 0, regularsServed: 0,
      restockCount: {}, restockActive: {}, popsByType: {}, custList: [], salesBy: {},
      moneyStart: S.money, stockValueStart: stockValue(), satStart: S.sat, satShown: Math.round(S.sat), events: [], ended: false, dayEndEmitted: false,
      rngRun: rngFor(STREAM.run)
    };

    // Müşteri takvimi (tohumlu; stoktan bağımsız → oyna/atla aynı müşterileri görür)
    const rc = rngFor(STREAM.customers);
    const n = Math.max(0, Math.round(plan.customers * (1 + (rc() - 0.5) * 2 * B("customerJitter", 0.1))));
    const quiet = B("closingQuietSec", 3);
    const t0 = B("customerStartSec", 1), t1 = len - quiet - B("browseSec", 2.5);
    const avail = PRODS().filter(p => S.unlocked[p.id]);
    const exChance = B("extraItemChance", 0.3) + e.extraItemChance, maxItems = B("maxItemsPerCustomer", 3);
    const jit = B("customerSpawnJitter", 0.35), gap = (t1 - t0) / Math.max(1, n);
    for (let i = 0; i < n; i++) {
      const t = clamp(t0 + (i + 0.5 + jit * (rc() * 2 - 1)) * gap, t0, t1);
      // Sepet: taban adet + her başarılı ekstra atışta 1 ürün daha (aynı ya da farklı ürün)
      const want = [];
      const add = p => { if (!p) return; const w = want.find(x => x.pid === p.id); if (w) w.qty++; else want.push({ pid: p.id, qty: 1 }); };
      const first = weightedPick(rc, avail, p => plan.demand[p.id] || 0);
      for (let k = 0; k < B("itemsPerCustomer", 1); k++) add(first);
      let items = B("itemsPerCustomer", 1);
      while (items < maxItems && rc() < exChance) { add(weightedPick(rc, avail, p => plan.demand[p.id] || 0)); items++; }
      const tipU = rc(), tipAmtU = rc();
      const look = { face: FACES[Math.floor(rc() * FACES.length)], color: COLORS[Math.floor(rc() * COLORS.length)] };
      if (!want.length) continue;
      const c = { cid: "c" + i, t, want, tipU, tipAmtU, look, lost: false, entered: false };
      run.custList.push(c);
      qPush({ t, kind: "cEnter", c });
    }

    // Baloncuk takvimi: hız (sn başına) × süre; tür ağırlığı × gün/hava/olay/yükseltme çarpanları
    const rb = rngFor(STREAM.bubbles), types = BTYPES();
    const modsList = [plan.weekday.bubbleMods, plan.weather.bubbleMods, plan.event && plan.event.bubbleMods, e.bubbleWeightMult];
    const pool = Object.keys(types).filter(id => {
      const bt = types[id];
      if (bt.dynamic || !(bt.weight > 0)) return false;
      if ((bt.minLevel || 1) > S.level || (bt.minDay || 1) > S.day) return false;
      if (bt.requires && !(e[bt.requires] || upgradeLevel(bt.requires) > 0)) return false;
      return true;
    });
    const wOf = id => modsList.reduce((w, m) => w * bmod(m, id), types[id].weight);
    const b0 = B("bubbleStartSec", 2), b1 = len - quiet;
    const rate = Math.min(B("bubbleRateMax", 0.42),
      B("bubbleRateBase", 0.2) + B("bubbleRatePerLevel", 0.015) * (S.level - 1) + B("bubbleRatePerDay", 0.002) * (S.day - 1));
    const nb = Math.round(rate * (b1 - b0) * ((plan.event && plan.event.bubbleMult) || 1) * (plan.weather.bubbleMult || 1));
    const minGap = B("bubbleMinGapSec", 0.6);
    let last = -Infinity;
    for (let i = 0; i < nb && pool.some(id => wOf(id) > 0); i++) {
      let t = b0 + ((i + 0.1 + 0.8 * rb()) / nb) * (b1 - b0);
      t = Math.max(t, last + minGap); last = t;
      const type = weightedPick(rb, pool, wOf);
      const it = { t, kind: "bSpawn", type, zi: rb(), pu: rb(), au: rb() };
      if (t < b1 && wOf(type) > 0) qPush(it);
    }
    // Mahalle sakinleri: günün içine dağıt
    plan.regulars.forEach((rid, i) => {
      const t = len * (0.12 + 0.7 * ((i + rb()) / Math.max(1, plan.regulars.length)));
      qPush({ t, kind: "rSpawn", rid, zi: rb(), au: rb() });
    });
    return run;
  }

  function emit(out, ev) { out.push(ev); run.events.push(ev); if (run.events.length > 400) run.events.shift(); }
  function changeSat(delta, out) {
    if (!delta) return;
    const e = run.eff, gain = delta > 0 ? e.satGain : 1;
    const top = B("satMax", 100);
    S.sat = clamp(S.sat + delta * gain, clamp(B("satFloor", 15) + e.satFloor, 0, top), top);
    const r = Math.round(S.sat);
    if (r !== run.satShown) { run.satShown = r; emit(out, { type: "satChange", sat: r }); }
    goalCheck(out);
  }

  // Hedef ilerlemesi
  function goalValue() {
    const g = run.goal; if (!g) return 0;
    switch (g.type) {
      case "pop": return g.bubble ? (run.popsByType[g.bubble] || 0) : run.popped;
      case "combo": return +run.maxCombo.toFixed(2);
      case "sales":
        if (g.productId) return run.salesBy[g.productId] || 0;
        if (g.cat) return PRODS().reduce((a, p) => a + (p.cat === g.cat ? (run.salesBy[p.id] || 0) : 0), 0);
        return run.sales;
      case "earn": return run.revenue;
      case "serve": return run.served;
      case "regulars": return run.regularsServed;
      case "sat": return Math.round(S.sat);
      case "noMiss": return run.missed;
      default: return 0;
    }
  }
  function goalCheck(out, final) {
    const g = run.goal; if (!g || run.goalDone || run.goalFailed) return;
    const v = goalValue();
    if (g.type === "noMiss") {
      if (v > 0) { run.goalFailed = true; emit(out, { type: "goalProgress", value: v, target: 0, failed: true }); return; }
      if (!final) return;
    } else {
      if (v !== run.goalProgress) { run.goalProgress = v; emit(out, { type: "goalProgress", value: v, target: g.target }); }
      if (v < g.target) return;
    }
    run.goalDone = true;
    run.goalReward = { money: g.reward.money, rep: g.reward.rep };
    S.money += g.reward.money; run.repBonus += g.reward.rep;
    emit(out, { type: "goalDone", reward: run.goalReward });
  }

  // Müşteri alışverişi
  function sell(pid, qty, cid, out) {
    const p = product(pid), have = S.stock[pid] || 0;
    const q = Math.min(qty, have); if (q <= 0) return 0;
    const amount = q * p.price;
    S.stock[pid] = have - q; S.money += amount;
    run.revenue += amount; run.sales += q; run.salesBy[pid] = (run.salesBy[pid] || 0) + q;
    emit(out, { type: "customerBuy", cid, productId: pid, qty: q, amount });
    if (S.stock[pid] <= 0) spawnRestock(pid, out);
    return amount;
  }
  function customerBuy(c, out) {
    let spent = 0, missPid = null;
    c.want.forEach((w, i) => {
      const blocked = run.pausedAll > run.t || (run.paused[w.pid] || 0) > run.t;
      const amt = blocked ? 0 : sell(w.pid, w.qty, c.cid, out);
      if (amt > 0) spent += amt;
      else if (i === 0) { missPid = w.pid; emit(out, { type: "customerMiss", cid: c.cid, productId: w.pid, reason: blocked ? "paused" : "empty" }); }
    });
    const happy = spent > 0;
    if (happy) {
      run.served++;
      changeSat(missPid ? 0 : B("satPerSale", 0.4), out);
      if (c.tipU < B("tipChance", 0.08) + run.eff.tipChance) {
        const a = B("tipMin", 1), b = B("tipMax", 4);
        const amount = Math.round((a + c.tipAmtU * (b - a)) * bubbleDayMult());
        S.money += amount; run.tips += amount;
        emit(out, { type: "tip", amount, cid: c.cid });
      }
    } else { run.missedCustomers++; changeSat(B("satPerMiss", -2), out); }
    goalCheck(out);
    return happy;
  }

  // Baloncuk oluştur
  function makeBubble(typeId, extra, lifeBase) {
    const bt = BTYPES()[typeId] || {};
    const id = "b" + run.nextBid++;
    const zone = bt.zone || "floor", slots = (B("zoneSlots", {})[zone]) || 3;
    const life = (lifeBase !== undefined ? lifeBase : (bt.life || 5)) + run.eff.bubbleLife;
    const b = Object.assign({
      id, type: typeId, zone, zoneIndex: Math.floor((extra.zi || 0) * slots), taps: bt.taps || 1, tapsLeft: bt.taps || 1,
      life, age: 0, spawnT: run.t, reward: Math.max(1, Math.round(bubbleBase(bt))),
      label: bt.label || "", emoji: bt.emoji || "❓", au: extra.au === undefined ? run.rngRun() : extra.au
    }, extra.fields || {});
    run.bubbles[id] = b;
    qPush({ t: run.t + life, kind: "bExp", id });
    return b;
  }
  function spawnRestock(pid, out) {
    if (!BTYPES().restock || run.restockActive[pid] || run.t >= run.length - B("closingQuietSec", 3)) return;
    if ((run.restockCount[pid] || 0) >= B("restockMaxPerProduct", 3)) return;
    const p = product(pid), idx = PRODS().filter(x => S.unlocked[x.id]).findIndex(x => x.id === pid);
    run.restockCount[pid] = (run.restockCount[pid] || 0) + 1;
    const tpl = BTYPES().restock.labelTpl || "{name} bitti!";
    const b = makeBubble("restock", { zi: 0, fields: { productId: pid, zoneIndex: Math.max(0, idx), label: tpl.replace("{name}", p.name), productEmoji: p.emoji } });
    run.restockActive[pid] = b.id;
    emit(out, { type: "bubbleSpawn", bubble: publicBubble(b) });
  }
  const publicBubble = b => { const o = Object.assign({}, b); delete o.au; return o; };

  // Acil tedarik (restock baloncuğu): alış × çarpan, para yettiği kadar
  function emergencyRestock(pid, out) {
    const cap = run.plan && shelfCap();
    const c = Math.ceil(unitCost(pid, run.plan) * B("emergencyCostMult", 1.2));
    const q = Math.max(0, Math.min(B("emergencyQty", 3), cap - (S.stock[pid] || 0), Math.floor(S.money / c)));
    if (q > 0) {
      S.money -= q * c; S.stock[pid] = (S.stock[pid] || 0) + q; run.emergencyCost += q * c; S.stats.stockSpent += q * c;
      emit(out, { type: "restock", productId: pid, qty: q, cost: q * c });
    }
    return q;
  }

  // Mahalle sakini gelir: istediğini alır (+bonus: bahşiş, itibar)
  function serveRegular(rid, bonus, out) {
    const r = REGS().find(x => x.id === rid); if (!r) return;
    const cid = "reg-" + rid;
    run.customersSpawned++;   // sakin de müşteri sayılır (served/customers tutarlı olsun)
    emit(out, { type: "customerEnter", cid, look: { face: r.emoji, color: B("regularColor", "#ffd6e0"), regularId: rid } });
    const blocked = run.pausedAll > run.t || (run.paused[r.likes] || 0) > run.t;
    const amt = (S.unlocked[r.likes] && !blocked) ? sell(r.likes, B("regularQty", 2), cid, out) : 0;
    if (amt <= 0) { run.missedCustomers++; emit(out, { type: "customerMiss", cid, productId: r.likes, reason: blocked ? "paused" : "empty" }); }
    if (bonus) {
      const tip = Math.round(B("regularTip", 5) * (r.tipMult || 1) * bubbleDayMult() * (amt > 0 ? 1 : B("regularNoStockTipMult", 0.5)));
      S.money += tip; run.tips += tip; emit(out, { type: "tip", amount: tip, cid });
      run.repBonus += amt > 0 ? B("repPerRegular", 3) : 0; run.regularsServed += amt > 0 ? 1 : 0;
      changeSat(B("regularSat", 2), out);
    }
    if (amt > 0) run.served++;
    emit(out, { type: "customerLeave", cid, happy: amt > 0 || bonus });
    goalCheck(out);
  }

  function popBubble(b, out) {
    const bt = BTYPES()[b.type] || {};
    const cw = B("comboWindow", 1.3);
    run.combo = (run.t - run.lastPopT <= cw) ? Math.min(B("comboMax", 2), +(run.combo + B("comboStep", 0.1)).toFixed(2)) : 1;
    run.lastPopT = run.t;
    run.maxCombo = Math.max(run.maxCombo, run.combo);
    const reward = Math.max(1, Math.round(bubbleBase(bt) * run.combo));
    S.money += reward; run.bubbleIncome += reward; run.popped++;
    run.popsByType[b.type] = (run.popsByType[b.type] || 0) + 1;
    delete run.bubbles[b.id];
    if (b.productId && run.restockActive[b.productId] === b.id) { delete run.restockActive[b.productId]; emergencyRestock(b.productId, out); }
    if (b.regularId) serveRegular(b.regularId, true, out);
    // Basınca ekstra etki: satGain / rep (bonus baloncuklar), onPop.customers (ek müşteri)
    if (bt.satGain) changeSat(bt.satGain, out);
    if (bt.rep) run.repBonus += bt.rep;
    if (bt.onPop && bt.onPop.customers) addCustomers(bt.onPop.customers);
    run.repBonus += B("repPerBubble", 0.2);
    goalCheck(out);
    return reward;
  }
  // Bonus müşteri (ör. komşu selamı/influencer) → yakın zamana eklenir
  function addCustomers(n) {
    const rc = run.rngRun, avail = PRODS().filter(p => S.unlocked[p.id]);
    for (let i = 0; i < n && avail.length; i++) {
      const p = weightedPick(rc, avail, x => run.plan.demand[x.id] || 0);
      const c = { cid: "x" + run.nextBid++, t: run.t + 0.5 + i * 0.7, want: [{ pid: p.id, qty: 1 + Math.floor(rc() * 2) }], tipU: rc(), tipAmtU: rc(),
        look: { face: FACES[Math.floor(rc() * FACES.length)], color: COLORS[Math.floor(rc() * COLORS.length)] }, lost: false, entered: false };
      if (c.t < run.length - 1) { run.custList.push(c); qPush({ t: c.t, kind: "cEnter", c }); }
    }
  }

  function expireBubble(b, out) {
    delete run.bubbles[b.id];
    const bt = BTYPES()[b.type] || {};
    if (b.productId && run.restockActive[b.productId] === b.id) delete run.restockActive[b.productId];
    const noPenalty = bt.bonus || (!bt.penalty && !b.regularId);
    const auto = !noPenalty && b.au < run.eff.autoSolve;
    if (auto) {
      run.autoSolved++;
      if (b.type === "restock" && b.productId) emergencyRestock(b.productId, out);   // çırak acil tedarik yapar (bedeli ödenir)
      if (b.regularId) serveRegular(b.regularId, false, out);                         // çırak servis eder (bonus yok)
      emit(out, { type: "bubbleExpire", bubbleId: b.id, autoSolved: true });
      return;
    }
    if (noPenalty) { emit(out, { type: "bubbleExpire", bubbleId: b.id, autoSolved: false, penalty: null }); return; }
    run.missed++;
    if (B("comboResetOnMiss", true)) run.combo = 1;
    const pen = Object.assign({}, bt.penalty || {});
    if (b.regularId) pen.sat = (pen.sat || 0) + B("regularMissSat", 0);
    emit(out, { type: "bubbleExpire", bubbleId: b.id, autoSolved: false, penalty: pen });
    if (pen.sat) changeSat(pen.sat, out);
    if (pen.money) { const m = Math.min(S.money, Math.round(Math.abs(pen.money) * penaltyMult())); S.money -= m; run.moneyPenalty += m; }
    if (bt.productLinked && b.productId && !pen.lostSalesSec) pen.lostSalesSec = B("lostSalesSecDefault", 10);
    if (pen.lostSalesSec) {
      if (b.productId) run.paused[b.productId] = Math.max(run.paused[b.productId] || 0, run.t + pen.lostSalesSec);
      else run.pausedAll = Math.max(run.pausedAll, run.t + pen.lostSalesSec);
    }
    if (pen.lostCustomers) {
      // sıradaki N müşteri hiç gelmez
      let k = Math.round(pen.lostCustomers * B("lostCustomersMult", 1));
      for (const c of run.custList) { if (k <= 0) break; if (!c.entered && !c.lost && c.t > run.t) { c.lost = true; run.lostCustomers++; k--; } }
    }
    goalCheck(out);
  }

  function handle(it, out) {
    switch (it.kind) {
      case "cEnter": {
        const c = it.c; if (c.lost) return;
        c.entered = true; run.customersSpawned++;
        emit(out, { type: "customerEnter", cid: c.cid, look: c.look, wants: c.want[0].pid });
        qPush({ t: run.t + B("browseSec", 2.5), kind: "cBuy", c });
        return;
      }
      case "cBuy": { const h = customerBuy(it.c, out); qPush({ t: run.t + B("customerLeaveSec", 1.2), kind: "cLeave", c: it.c, happy: h }); return; }
      case "cLeave": emit(out, { type: "customerLeave", cid: it.c.cid, happy: it.happy }); return;
      case "bSpawn": {
        const bt = BTYPES()[it.type] || {};
        // Ekranda çok baloncuk varsa biraz ertele (sessiz saate kadar), sonra vazgeç
        if (Object.keys(run.bubbles).length >= B("bubbleMaxOnScreen", 5)) {
          const t2 = run.t + B("bubbleDeferSec", 0.5);
          if (t2 < run.length - B("closingQuietSec", 3)) qPush(Object.assign({}, it, { t: t2 }));
          return;
        }
        const fields = {};
        if (bt.productLinked) {
          const unl = PRODS().filter(p => S.unlocked[p.id]);
          const inStock = unl.filter(p => S.stock[p.id] > 0);
          const list = inStock.length ? inStock : unl;
          if (list.length) {
            const p = list[Math.floor(it.pu * list.length)];
            fields.productId = p.id; fields.productEmoji = p.emoji; fields.zoneIndex = unl.indexOf(p);
          }
        }
        const b = makeBubble(it.type, { zi: it.zi, au: it.au, fields });
        emit(out, { type: "bubbleSpawn", bubble: publicBubble(b) });
        return;
      }
      case "rSpawn": {
        const r = REGS().find(x => x.id === it.rid); if (!r) return;
        const bt = BTYPES().regular;
        const lines = [r.line].concat(r.lines || []).filter(Boolean);
        const fields = { regularId: r.id, emoji: r.emoji, label: lines.length ? lines[Math.floor(it.zi * 7919) % lines.length] : r.name,
          name: r.name, likes: r.likes, thanks: r.thanks || "" };
        const typeId = bt ? "regular" : "__regular";
        const b = makeBubble(typeId, { zi: it.zi, au: it.au, fields }, bt ? bt.life : B("regularLife", 6));
        if (!bt) { b.zone = "door"; b.reward = Math.max(1, Math.round(B("regularReward", 3) * run.eff.bubbleReward * bubbleDayMult())); }
        emit(out, { type: "bubbleSpawn", bubble: publicBubble(b) });
        return;
      }
      case "bExp": { const b = run.bubbles[it.id]; if (b) expireBubble(b, out); return; }
    }
  }

  function tick(dt) {
    if (!run || run.ended) return [];
    const out = run.out.splice(0);   // tapBubble'dan birikenler
    if (run.dayEndEmitted) return out;
    const target = Math.min(run.length, run.t + Math.max(0, +dt || 0));
    while (run.queue.length && run.queue[0].t <= target) {
      const it = run.queue.shift();
      run.t = Math.max(run.t, it.t);
      handle(it, out);
    }
    run.t = target;
    for (const id in run.bubbles) run.bubbles[id].age = run.t - run.bubbles[id].spawnT;
    if (run.combo > 1 && run.t - run.lastPopT > B("comboWindow", 1.3)) run.combo = 1;
    if (run.t >= run.length) finishDay(out);
    return out;
  }
  // Gün bitti: kalan müşteri işlerini tamamla, baloncukları cezasız temizle
  function finishDay(out) {
    if (run.dayEndEmitted) return;
    let guard = 0;
    while (run.queue.length && guard++ < 10000) {
      const it = run.queue.shift();
      if (it.kind === "cBuy" || it.kind === "cLeave") { run.t = Math.max(run.t, Math.min(it.t, run.length)); handle(it, out); }
    }
    run.t = run.length;
    run.bubbles = {};
    goalCheck(out, true);
    emit(out, { type: "dayEnd" });
    run.dayEndEmitted = true;
  }

  function tapBubble(id) {
    if (!run || run.ended || run.dayEndEmitted) return null;
    const b = run.bubbles[id]; if (!b) return null;
    b.tapsLeft--;
    if (b.tapsLeft > 0) return { popped: false, tapsLeft: b.tapsLeft, reward: 0, combo: run.combo };
    const out = [];
    const reward = popBubble(b, out);
    run.out.push(...out);
    return { popped: true, tapsLeft: 0, reward, combo: run.combo };   // yan olaylar (restock, tip, goalDone…) sonraki tick()'te gelir
  }

  function endDay() {
    if (!run || run.ended) return null;
    const out = [];
    if (!run.dayEndEmitted) { run.t = run.length; finishDay(out); }
    run.ended = true;
    const e = run.eff, day = S.day;

    // Taze ürün bozulması
    let spoiled = 0;
    if (!e.fridge) for (const p of PRODS()) if (p.fresh && S.stock[p.id] > 0) {
      const keep = Math.floor(S.stock[p.id] * (1 - B("spoilFraction", 0.5))); spoiled += S.stock[p.id] - keep; S.stock[p.id] = keep;
    }

    const stockCost = S.todayStockCost + run.emergencyCost;
    const net = (S.money - run.moneyStart) - S.todayStockCost;   // gün içi para değişimi − sabah stok harcaması

    // İtibar
    const repGained = Math.max(0, Math.round(run.sales * B("repPerSale", 1) + S.sat * B("repPerSatPoint", 0.1) + run.repBonus));
    S.rep += repGained;
    const oldLevel = S.level;
    for (const L of LVLS()) if (S.rep >= L.rep && L.level > S.level) S.level = L.level;
    let levelUp = null;
    if (S.level > oldLevel) {
      const L = LVLS().find(x => x.level === S.level);
      levelUp = { level: S.level, title: L.title, unlockText: L.unlockText || "" };
      for (const p of PRODS()) if (!S.unlocked[p.id] && (p.unlockLevel || 1) <= S.level && !(p.unlockCost > 0)) S.unlocked[p.id] = true;
    }

    const goalMoney = run.goalDone ? run.goalReward.money : 0;
    const st = S.stats;
    st.totalEarned += run.revenue + run.bubbleIncome + run.tips + goalMoney;
    st.bubblesPopped += run.popped; st.bubblesMissed += run.missed;
    st.bestCombo = Math.max(st.bestCombo, run.maxCombo);
    if (run.mode === "play") st.daysPlayed++; else st.daysSkipped++;
    st.customersServed += run.served; st.customersMissed += run.missedCustomers + run.lostCustomers;
    st.itemsSold += run.sales; st.goalsDone += run.goalDone ? 1 : 0; st.regularsServed += run.regularsServed;
    st.tips += run.tips; st.spoiled += spoiled; st.bestDayNet = Math.max(st.bestDayNet, net);

    const summary = {
      day, mode: run.mode, customers: run.customersSpawned, served: run.served, missed: run.missedCustomers,
      lostCustomers: run.lostCustomers, itemsSold: run.sales,
      revenue: run.revenue, bubbleIncome: run.bubbleIncome, tips: run.tips,
      goal: run.goal ? run.goal.text : null, goalDone: run.goalDone, goalReward: run.goalReward,
      spoiled, stockCost, stockDelta: stockValue() - run.stockValueStart,
      profit: (S.money - run.moneyStart) + stockValue() - run.stockValueStart,   // gün içi para + raf değeri değişimi
      emergencyCost: run.emergencyCost, moneyPenalty: run.moneyPenalty, net, repGained, levelUp,
      satStart: Math.round(run.satStart), satEnd: Math.round(S.sat), maxCombo: run.maxCombo, popped: run.popped,
      missedBubbles: run.missed, autoSolved: run.autoSolved, regularsServed: run.regularsServed,
      weather: run.plan.weather.id, event: run.plan.event ? run.plan.event.id : null, estSkipNet: null, estSkipProfit: null, piggy: 0
    };

    // Gece: yeni güne geç
    if (run.plan.event) { S.seenEvents[run.plan.event.id] = true; S.lastEventId = run.plan.event.id; } else S.lastEventId = null;
    S.sat = S.sat + (B("satNightTarget", 65) - S.sat) * B("satNightPull", 0.3);
    S.day++; S.todayStockCost = 0;
    summary.piggy = piggyRescue();

    // Oynanan gün: aynı günün atlanmış hâlini klondan tahmin et
    if (run.mode === "play" && !headless && runSnapshot) {
      const snap = runSnapshot;
      const est = simulateFrom(snap, "skip");
      summary.estSkipNet = est.net; summary.estSkipProfit = est.profit;
      st.playBonus += net - summary.estSkipNet;
    }
    S.lastSummary = summary;
    S.history.push(summary); if (S.history.length > 7) S.history.shift();
    if (!headless) { runSnapshot = null; save(); }
    return summary;
  }

  function skipDay() {
    startDay({ mode: "skip" });
    const dt = B("skipTickDt", B("skipDt", 0.25));
    let guard = 0;
    while (!run.dayEndEmitted && guard++ < 100000) tick(dt);
    return endDay();
  }

  // ---------- HEADLESS KLON ----------
  // policy: "skip" | "perfect" | { hitRate, reactSec }
  function runPolicy(mode, policy) {
    startDay({ mode });
    const dt = B("skipTickDt", B("skipDt", 0.25));
    let pol = null;
    if (mode === "play" && policy && policy !== "skip") {
      pol = policy === "perfect" ? { hitRate: 1, reactSec: B("perfectReactSec", 0.6), jitter: 0 } : Object.assign({ jitter: 0.3 }, policy);
    }
    const pr = rngFor(STREAM.policy), gap = B("tapGapSec", 0.18);
    const taps = [];
    const addTap = (t, id) => { let i = taps.length; while (i > 0 && taps[i - 1].t > t) i--; taps.splice(i, 0, { t, id }); };
    let guard = 0;
    while (!run.dayEndEmitted && guard++ < 200000) {
      const next = taps.length ? taps[0].t : Infinity;
      const step = Math.min(dt, Math.max(1e-4, next - run.t));
      const evs = tick(step);
      if (pol) for (const ev of evs) if (ev.type === "bubbleSpawn") {
        const b = ev.bubble;
        if (pr() >= pol.hitRate) { pr(); continue; }
        let t = b.spawnT + pol.reactSec * (1 - pol.jitter + 2 * pol.jitter * pr());
        for (let k = 0; k < b.taps; k++) addTap(t + k * gap, b.id);
      }
      while (taps.length && taps[0].t <= run.t + 1e-9) tapBubble(taps.shift().id);
    }
    return endDay();
  }
  function simulateFrom(stateObj, mode, policy) {
    const saved = { S, run, runSnapshot, headless };
    try {
      S = clone(stateObj); run = null; headless = true;
      return runPolicy(mode === "skip" || policy === "skip" ? "skip" : "play", policy);
    } finally { S = saved.S; run = saved.run; runSnapshot = saved.runSnapshot; headless = saved.headless; }
  }
  // Gerçek durum üzerinde günü politikayla otomatik koştur (test/denge araçları için; kalıcıdır)
  function autoDay(policy) {
    if (run && !run.ended) return null;
    return runPolicy(policy === "skip" ? "skip" : "play", policy);
  }
  // Aktif gün varsa gün başı anlık görüntüsünden, yoksa şimdiki durumdan simüle eder; gerçek durum değişmez
  function simulateClone(mode, policy) {
    const base = (run && !run.ended && runSnapshot) ? runSnapshot : S;
    if (policy === undefined) policy = mode === "skip" ? "skip" : "perfect";
    return simulateFrom(base, mode, policy);
  }

  // ---------- KAYIT ----------
  const hasLS = () => { try { return typeof localStorage !== "undefined" && localStorage !== null; } catch (e) { return false; } };
  function save() {
    if (headless || !hasLS() || !S) return false;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); return true; } catch (e) { return false; }
  }
  function load() {
    if (!hasLS()) return false;
    try {
      const raw = localStorage.getItem(SAVE_KEY); if (!raw) return false;
      const o = JSON.parse(raw);
      if (!o || o.version !== SAVE_VERSION || typeof o.day !== "number") return false;
      const fresh = newGame(o.seed);
      S = Object.assign(fresh, o);
      S.stats = Object.assign(blankStats(), o.stats || {});
      for (const p of PRODS()) if (S.stock[p.id] === undefined) S.stock[p.id] = 0;
      run = null; runSnapshot = null;
      return true;
    } catch (e) { return false; }
  }
  function clearSave() { if (hasLS()) try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* yok say */ } }

  // ---------- YARDIMCILAR (UI için) ----------
  function levelInfo() {
    const L = LVLS(), cur = L.find(x => x.level === S.level) || L[0], next = L.find(x => x.level === S.level + 1) || null;
    const progress = next ? clamp((S.rep - cur.rep) / Math.max(1, next.rep - cur.rep), 0, 1) : 1;
    return { level: S.level, title: cur.title, rep: S.rep, cur: cur.rep, next: next ? next.rep : null, nextTitle: next ? next.title : null, progress };
  }

  newGame(1);

  return {
    get state() { return S; },
    set state(v) { S = v; run = null; runSnapshot = null; },
    get run() { return run; },
    newGame, save, load, clearSave, effects, shelfCap, planDay,
    buyStock, fillAll, unlockProduct, canUnlock, buyUpgrade, upgradeAvailable, canAfford, upgradeLevel, nextUpgradeCost,
    unitCost: id => unitCost(id), product, levelInfo, piggyRescue,
    startDay, tick, tapBubble, endDay, skipDay, simulateClone, autoDay,
    _rng: { mulberry32, hash }
  };
})();

if (typeof module !== "undefined") module.exports = { Game };
