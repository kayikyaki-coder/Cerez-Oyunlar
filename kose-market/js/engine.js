// engine.js — Köşe Market motoru: durum, ekonomi (fiyat/talep/rakip, kira/borç/iflas), tohumlu gün simülasyonu,
// baloncuk/kombo/kriz/hırsız/arıza mantığı, raf ömrü ve yuva, kayıt. DOM'a dokunmaz.
// Tarayıcıda global `Game`, Node'da module.exports = { Game }.

if (typeof module !== "undefined" && typeof PRODUCTS === "undefined") {
  try { Object.assign(globalThis, require("./data.js")); } catch (e) { /* veri yoksa test fikstürü kullanılır */ }
}

const Game = (() => {
  "use strict";

  const SAVE_KEY = "koseMarket.v2";
  const OLD_KEY = "koseMarket.v1";
  const CHECK_KEY = "koseMarket.v2.check";
  const SAVE_VERSION = 2;

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
  const DIFFS = () => (typeof DIFFICULTIES !== "undefined" ? DIFFICULTIES : {});
  const RIV = () => (typeof RIVAL !== "undefined" ? RIVAL : null);
  const CRISIS_DEFS = () => (typeof CRISES !== "undefined" ? CRISES : []);
  const HINT_DEFS = () => (typeof HINTS !== "undefined" ? HINTS : []);

  // BALANCE[k] ?? varsayılan (varsayılanlar data.js ile aynıdır)
  const B = (k, d) => { const v = BAL()[k]; return v === undefined || v === null ? d : v; };

  const product = id => PRODS().find(p => p.id === id) || null;
  const upgradeDef = id => UPGS().find(u => u.id === id) || null;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const clone = o => JSON.parse(JSON.stringify(o));
  const num = (v, d) => (Number.isFinite(+v) ? +v : d);

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
  // Akışlar: aynı gün için plan/müşteri/baloncuk/hırsız/kriz dizisi hep aynı → oyna/atla adil karşılaştırılır.
  // `noise` yalnızca tahmin ekranı içindir (günün aynısını değil, benzerini koşturur): plan akışını etkilemez.
  const STREAM = { plan: 11, customers: 23, bubbles: 37, run: 41, policy: 59, theft: 67, crisis: 71, equip: 73, salvo: 79, crisisOut: 83 };
  let noise = 0;
  const rngFor = stream => mulberry32(hash(S.seed, S.day, stream, stream === STREAM.plan ? 0 : noise));
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
  let checkpointJson = null;
  let lastLoadNote = "";
  let forfeitFlag = false;

  const DIFF_FALLBACK = { id: "normal", name: "Normal", startMoney: 40, piggy: 3, checkpoint: true };
  const cfg = () => (S && DIFFS()[S.diff]) || DIFFS().normal || DIFF_FALLBACK;
  const D = (k, d) => { const v = cfg()[k]; return v === undefined || v === null ? (d === undefined ? 1 : d) : v; };

  function blankStats() {
    return { totalEarned: 0, bubblesPopped: 0, bubblesMissed: 0, bestCombo: 1, daysPlayed: 0, daysSkipped: 0,
      customersServed: 0, customersMissed: 0, itemsSold: 0, goalsDone: 0, regularsServed: 0, tips: 0,
      stockSpent: 0, spoiled: 0, playBonus: 0, bestDayNet: 0, piggyUsed: 0, upgradesBought: 0,
      thievesCaught: 0, theftLoss: 0, rentPaid: 0, interestPaid: 0, debtPeak: 0, crisesResolved: 0, breakdowns: 0,
      repairSpent: 0, seasonsWon: 0, rivalLost: 0 };
  }

  function newGame(seed, diffId) {
    const sd = (seed === undefined || seed === null) ? ((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0) : (seed >>> 0);
    const did = DIFFS()[diffId] ? diffId : "normal";
    const c = DIFFS()[did] || DIFF_FALLBACK;
    S = {
      version: SAVE_VERSION, diff: did, day: 1, money: c.startMoney !== undefined ? c.startMoney : B("startMoney", 40), rep: 0, level: 1,
      sat: B("satStart", 70), seed: sd, stock: {}, batch: {}, unlocked: {}, prices: {}, upgrades: {}, stats: blankStats(), history: [],
      won: false, wonDay: null, lastSummary: null, seenEvents: {}, lastEventId: null, todayStockCost: 0, piggyDay: 0,
      piggyLeft: c.piggy !== undefined ? c.piggy : 3, debt: 0, debtDays: 0, bankrupt: null,
      equip: { fridge: 100, register: 100 }, broken: { fridge: false, register: false },
      eveningPending: false, dayOpen: false, hints: {}, season: null, graceUntil: 0, uiFinaleSeen: false
    };
    const ss = B("startStock", { elma: 4, ekmek: 4 });
    for (const p of PRODS()) {
      S.stock[p.id] = 0; S.prices[p.id] = 1;
      if ((p.unlockLevel || 1) <= 1 && !(p.unlockCost > 0)) S.unlocked[p.id] = true;
      if (S.unlocked[p.id]) S.stock[p.id] = typeof ss === "number" ? ss : (ss[p.id] || 0);
    }
    run = null; runSnapshot = null; basePlanCache = null; effCache = null;
    takeCheckpoint();
    return S;
  }

  // Eksik alanları tamamla, bozuk/negatif/NaN değerleri düzelt (kayıt, test fikstürü ve klonlar için)
  function sanitize(st) {
    const maxLevel = LVLS()[LVLS().length - 1].level;
    st.version = SAVE_VERSION;
    if (!DIFFS()[st.diff]) st.diff = "normal";
    st.seed = num(st.seed, 1) >>> 0;
    st.day = Math.max(1, Math.floor(num(st.day, 1)));
    st.money = Math.max(0, num(st.money, 0));
    st.rep = Math.max(0, num(st.rep, 0));
    st.level = clamp(Math.floor(num(st.level, 1)), 1, maxLevel);
    st.sat = clamp(num(st.sat, B("satStart", 70)), 0, 100);
    st.debt = Math.max(0, Math.round(num(st.debt, 0)));
    st.debtDays = Math.max(0, Math.floor(num(st.debtDays, 0)));
    st.todayStockCost = Math.max(0, num(st.todayStockCost, 0));
    st.piggyDay = num(st.piggyDay, 0);
    st.piggyLeft = Math.max(0, Math.floor(num(st.piggyLeft, (DIFFS()[st.diff] || DIFF_FALLBACK).piggy)));
    st.graceUntil = num(st.graceUntil, 0);
    st.stock = st.stock || {}; st.batch = st.batch || {}; st.unlocked = st.unlocked || {}; st.prices = st.prices || {};
    st.upgrades = st.upgrades || {}; st.seenEvents = st.seenEvents || {}; st.hints = st.hints || {}; st.history = Array.isArray(st.history) ? st.history : [];
    const ids = {}; for (const p of PRODS()) ids[p.id] = true;
    for (const k of Object.keys(st.stock)) if (!ids[k]) delete st.stock[k];
    for (const k of Object.keys(st.unlocked)) if (!ids[k]) delete st.unlocked[k];
    for (const k of Object.keys(st.batch)) if (!ids[k]) delete st.batch[k];
    const nTier = B("priceTiers", [0.85, 1, 1.2]).length;
    for (const p of PRODS()) {
      st.stock[p.id] = Math.max(0, Math.floor(num(st.stock[p.id], 0)));
      st.prices[p.id] = clamp(Math.round(num(st.prices[p.id], 1)), 0, nTier - 1);
      if ((p.unlockLevel || 1) <= 1 && !(p.unlockCost > 0) && st.unlocked[p.id] === undefined) st.unlocked[p.id] = true;
    }
    const ups = {};
    for (const u of UPGS()) ups[u.id] = u;
    for (const k of Object.keys(st.upgrades)) {
      if (!ups[k]) { delete st.upgrades[k]; continue; }
      st.upgrades[k] = clamp(Math.floor(num(st.upgrades[k], 0)), 0, (ups[k].levels || []).length);
    }
    st.equip = Object.assign({ fridge: 100, register: 100 }, st.equip || {});
    st.broken = Object.assign({ fridge: false, register: false }, st.broken || {});
    for (const k of ["fridge", "register"]) { st.equip[k] = clamp(num(st.equip[k], 100), 0, 100); st.broken[k] = !!st.broken[k]; }
    st.stats = Object.assign(blankStats(), st.stats || {});
    for (const k of Object.keys(st.stats)) st.stats[k] = num(st.stats[k], 0);
    if (st.bankrupt && typeof st.bankrupt !== "object") st.bankrupt = { day: st.day, reason: "limit", debt: st.debt };
    if (!st.bankrupt) st.bankrupt = null;
    if (st.season && typeof st.season !== "object") st.season = null;
    st.eveningPending = !!st.eveningPending; st.dayOpen = !!st.dayOpen; st.won = !!st.won;
    return st;
  }

  // ---------- YÜKSELTME EFEKTLERİ ----------
  const MULT_KEYS = { costMult: 1, bubbleReward: 1, satGain: 1, theftMult: 1, wearMult: 1, regWear: 1, rentMult: 1 };
  let effCache = null;
  function effects(st) {
    st = st || S;
    let key = "";
    for (const u of UPGS()) key += u.id + ":" + ((st.upgrades && st.upgrades[u.id]) || 0) + ",";
    if (st === S && effCache && effCache.key === key) return effCache.e;
    const e = { customers: 0, slots: 0, costMult: 1, bubbleReward: 1, bubbleLife: 0, tipChance: 0, bubbleWeightMult: {},
      autoSolve: 0, fridge: false, satFloor: 0, satGain: 1, extraItemChance: 0, final: false,
      upkeep: 0, lifeBonus: 0, rivalGuard: 0, thiefAuto: 0, weatherShield: 0, comboWindow: 0, theftMult: 1, wearMult: 1, regWear: 1, rentMult: 1 };
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
    e.thiefAuto = clamp(e.thiefAuto, 0, 0.9); e.rivalGuard = clamp(e.rivalGuard, 0, 0.8); e.weatherShield = clamp(e.weatherShield, 0, 1);
    if (st === S) effCache = { key, e };
    return e;
  }

  // ---------- RAF YUVASI + PARTİLER (raf ömrü) ----------
  const totalSlots = () => B("totalSlotsBase", 44) + effects().slots;
  const slotsOf = id => { const p = product(id); return (p && p.slots) || 1; };
  function slotsUsed() { let n = 0; for (const p of PRODS()) n += (S.stock[p.id] || 0) * (p.slots || 1); return n; }
  const slotsFree = () => Math.max(0, totalSlots() - slotsUsed());
  // Görsel/uyumluluk için "ürün başına adil pay" (render çizim ölçeği); gerçek sınır toplam yuvadır
  function shelfCap() {
    const n = Math.max(4, PRODS().filter(p => S.unlocked[p.id]).length);
    return Math.max(6, Math.round(totalSlots() / n));
  }
  function batchOf(pid) {
    let b = S.batch[pid]; if (!Array.isArray(b)) b = S.batch[pid] = [];
    const st = Math.max(0, Math.floor(S.stock[pid] || 0)); let sum = 0;
    for (let i = 0; i < b.length; i++) { b[i] = Math.max(0, Math.floor(b[i] || 0)); sum += b[i]; }
    if (sum < st) b[0] = (b[0] || 0) + st - sum;
    else if (sum > st) { let ex = sum - st; for (let i = b.length - 1; i >= 0 && ex > 0; i--) { const t = Math.min(b[i], ex); b[i] -= t; ex -= t; } }
    return b;
  }
  function addStock(pid, n) { if (!(n > 0)) return; const b = batchOf(pid); b[0] = (b[0] || 0) + n; S.stock[pid] = (S.stock[pid] || 0) + n; }
  function takeStock(pid, n) {   // en eski partiden başlar (FIFO)
    const have = S.stock[pid] || 0; n = Math.min(Math.floor(n), have); if (n <= 0) return 0;
    const b = batchOf(pid); let r = n;
    for (let i = b.length - 1; i >= 0 && r > 0; i--) { const t = Math.min(b[i] || 0, r); b[i] -= t; r -= t; }
    S.stock[pid] = have - n; return n;
  }
  const isFresh = p => (p.shelfLife || 999) <= B("freshLifeMax", 12);
  const fridgeOk = e => !!(e || effects()).fridge && !S.broken.fridge;
  // Bir ürünün kaç gece dayandığı (zorluk, buzdolabı, depo)
  function lifeOf(p, e) {
    e = e || effects();
    let L = p.shelfLife || 999;
    if (!isFresh(p)) return L;
    L = Math.max(1, Math.round(L * D("life", 1)));
    if (fridgeOk(e)) L = Math.max(L, Math.floor(L * B("fridgeLifeMult", 2.5)) + (e.lifeBonus || 0));
    return L;
  }
  // Gece: partiler yaşlanır, ömrü dolanlar tamamen bozulur
  function ageStock(e) {
    let units = 0, value = 0; const by = {};
    for (const p of PRODS()) {
      if ((S.stock[p.id] || 0) <= 0) continue;
      const b = batchOf(p.id), L = lifeOf(p, e), nb = [0]; let lost = 0;
      for (let i = 0; i < b.length; i++) {
        const n = b[i] || 0; if (!n) continue;
        const age = i + 1;
        if (age >= L) lost += n; else nb[age] = (nb[age] || 0) + n;
      }
      for (let i = 0; i < nb.length; i++) nb[i] = nb[i] || 0;
      S.batch[p.id] = nb; S.stock[p.id] -= lost;
      if (lost > 0) { units += lost; value += lost * p.cost; by[p.id] = lost; }
    }
    return { units, value, by };
  }
  // UI: bu ürünün bu gece kaç adedi bozulur?
  function stockAging(pid) {
    const p = product(pid); if (!p || !isFresh(p)) return { life: p ? (p.shelfLife || 999) : 999, tonight: 0, fresh: false };
    const e = effects(), L = lifeOf(p, e), b = batchOf(pid); let t = 0;
    for (let i = 0; i < b.length; i++) if ((b[i] || 0) && i + 1 >= L) t += b[i];
    return { life: L, tonight: t, fresh: true };
  }

  // ---------- FİYAT / TALEP / RAKİP ----------
  const tiers = () => B("priceTiers", [0.85, 1, 1.2]);
  const tierOf = id => { const t = S.prices && S.prices[id]; return Number.isInteger(t) && t >= 0 && t < tiers().length ? t : 1; };
  function priceAt(id, t) {
    const p = product(id); if (!p) return 0;
    const m = tiers()[t] === undefined ? 1 : tiers()[t];
    if (m === 1) return p.price;
    return Math.max(Math.floor(p.cost) + 1, Math.round(p.price * m));
  }
  const priceOf = id => priceAt(id, tierOf(id));
  function setPrice(id, t) {
    if (!product(id) || !S.unlocked[id]) return false;
    S.prices[id] = clamp(Math.round(num(t, 1)), 0, tiers().length - 1); return true;
  }
  // Rakibin o ürüne verdiği fiyat (özel ürünleri satmaz → null)
  function rivalPrice(id, plan) {
    const R = RIV(); if (!R || !plan || !plan.rival || !plan.rival.active) return null;
    const p = product(id); if (!p) return null;
    const cm = R.catMult && R.catMult[p.cat]; if (cm === undefined) return null;
    let m = cm; const c = plan.rival.campaign;
    if (c && (c.cat === "all" || c.cat === p.cat)) m *= R.campaignMult;
    return Math.max(1, Math.round(p.price * m * 10) / 10);
  }
  // Fiyatın talebe etkisi: (bizim fiyat / referans) ^ -esneklik. Referans: rakibin fiyatı, yoksa standart fiyat.
  function priceFactor(id, plan, t) {
    const p = product(id); if (!p) return 1;
    const rp = rivalPrice(id, plan), ref = rp != null ? rp : p.price;
    const ratio = (t === undefined ? priceOf(id) : priceAt(id, t)) / ref;
    const heat = (plan && plan.heat && plan.heat[id]) || 1;
    let el = (p.el || 1) * D("priceSens", 1);
    if (heat >= B("heatHot", 1.3)) el *= B("heatHotMult", 0.55); else if (heat <= B("heatCold", 0.6)) el *= B("heatColdMult", 1.35);
    if (rp != null) el *= 1 + B("rivalCompare", 0.9);
    return clamp(Math.pow(ratio, -el), 0.12, 3);
  }

  // ---------- GÜN PLANI ----------
  function satMult(sat) {
    const mid = B("satMid", 60), swing = B("satCustomerSwing", 0.15), top = B("satMax", 100);
    return 1 + clamp(((sat - mid) / Math.max(1, top - mid)) * swing, -swing, swing);
  }
  const modFor = (mods, p) => (mods ? (mods[p.id] !== undefined ? mods[p.id] : 1) * (mods[p.cat] !== undefined ? mods[p.cat] : 1) : 1);
  const bmod = (mods, id) => (mods && mods[id] !== undefined ? mods[id] : 1);
  const COUNT_GOALS = { pop: 1, sales: 1, earn: 1, serve: 1, regulars: 1 };

  function normGoal(g, src, day) {
    if (!g) return null;
    let target = g.count !== undefined ? g.count : g.value !== undefined ? g.value : g.target !== undefined ? g.target : g.amount;
    if (target === undefined) target = 0;
    const scale = g.scaleWithDay ? 1 + B("goalScalePerDay", 0.025) * (day - 1) : 1;
    if (COUNT_GOALS[g.type]) target = Math.round(target * scale);
    const reward = { money: Math.round(((g.reward && g.reward.money) || 0) * scale),
      rep: (g.reward && g.reward.rep !== undefined) ? g.reward.rep : B("repPerGoal", 8) };
    const orig = g.count !== undefined ? g.count : g.value;
    let text = String(g.text || "").replace(/\{n\}/g, target);
    if (orig !== undefined && target !== orig) text = text.replace(String(orig), String(target));
    return { type: g.type, target, bubble: g.bubble && g.bubble !== "any" ? g.bubble : null, productId: g.productId || null,
      cat: g.cat || null, reward, text, source: src };
  }

  // Tohumlu, stoktan/fiyattan bağımsız gün iskeleti (hava, olay, hedef, sakinler, rakip kampanyası) — önbellekli
  let basePlanCache = null;
  function basePlan() {
    let key = S.seed + "|" + S.day + "|" + S.level + "|" + S.lastEventId + "|" + S.diff;
    for (const r of REGS()) key += S.unlocked[r.likes] ? "1" : "0";
    for (const k in S.seenEvents) key += k;
    if (basePlanCache && basePlanCache.key === key) return basePlanCache.plan;
    const rng = rngFor(STREAM.plan), day = S.day;
    const wds = WDAYS(), weekday = wds[(day - 1) % wds.length];
    const weather = weightedPick(rng, WTHRS().filter(w => (w.minDay || 1) <= day), w => (w.weight === undefined ? 1 : w.weight));

    const eligible = ev => !(ev.once && S.seenEvents[ev.id]) && (ev.minDay || 1) <= day && (ev.minLevel || 1) <= S.level &&
      (!ev.weekday || ev.weekday === weekday.id) && (!ev.weather || ev.weather === weather.id) &&
      (!ev.weathers || ev.weathers.includes(weather.id));
    let event = EVENTS().find(ev => ev.fixedDay === day && eligible(ev)) || null;
    const roll = rng();
    const pool = EVENTS().filter(ev => !ev.fixedDay && eligible(ev) && ev.id !== S.lastEventId);
    const pick = weightedPick(rng, pool, ev => (ev.weight === undefined ? 1 : ev.weight));
    if (!event && day >= B("eventStartDay", 2) && roll < B("eventChance", 0.55)) event = pick;

    const gg = GGOALS().filter(g => (g.minDay || 1) <= day && (g.minLevel || 1) <= S.level);
    const gU = rng();
    const goal = (event && event.goal) ? normGoal(event.goal, "event", day)
      : (gg.length ? normGoal(gg[Math.floor(gU * gg.length)], "generic", day) : null);

    const demand = {}, heat = {};
    for (const p of PRODS()) {
      const d = p.demand * modFor(weekday.demandMods, p) * modFor(weather.demandMods, p) * modFor(event && event.demandMods, p);
      demand[p.id] = +Math.max(B("demandFloor", 0.05), d).toFixed(3);
      heat[p.id] = +(demand[p.id] / (p.demand || 1)).toFixed(3);
    }

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

    // Rakip kampanyası (her günde aynı 3 sayı çekilir)
    const R = RIV(), cu = rng(), cc = rng(), ca = rng();
    const open = R ? Math.max(2, R.openDay + D("rivalOpen", 0)) : 9999;
    let campaign = null;
    if (R && day >= open && cu < (R.campaignChance || 0) * D("rivalAggro", 1)) {
      const cats = R.campaignCats || [];
      const cat = ca < 0.12 ? "all" : cats[Math.floor(cc * cats.length)];
      const nm = cat === "all" ? "tüm ürünlerde" : (R.catNames && R.catNames[cat]) ? R.catNames[cat] + " ürünlerinde" : cat + " ürünlerinde";
      campaign = { cat, text: (R.name || "Rakip") + " bugün " + nm + " %" + Math.round((1 - R.campaignMult) * 100) + " indirimde!" };
    }
    const plan = { day, weekday, weather, event, goal, demand, heat, regulars: regs, rival: { active: !!R && day >= open, open, campaign } };
    basePlanCache = { key, plan };
    return plan;
  }

  function rivalShare(bp, e) {
    const R = RIV(); if (!R || !bp.rival.active) return 0;
    let share = Math.min(R.shareMax, R.baseShare + R.shareGrowthPerDay * (S.day - bp.rival.open)) * D("rivalAggro", 1);
    if (S.season) share += (S.season.n - 1) * B("seasonRivalStep", 0.04);
    share *= clamp(B("rivalLoyaltyHi", 1.3) - S.sat / 100, B("rivalLoyaltyLo", 0.65), B("rivalLoyaltyHi", 1.3));
    if (bp.rival.campaign) share += R.campaignShareBonus || 0;
    share *= 1 - clamp(e.rivalGuard, 0, 0.8);
    if (S.graceUntil && S.day <= S.graceUntil) share *= 0.5;
    return clamp(share, 0, 0.55);
  }

  function planDay() {
    const bp = basePlan(), e = effects(), day = S.day;
    const { weekday, weather, event } = bp;
    const unl = PRODS().filter(p => S.unlocked[p.id]);
    // Fiyata göre ağırlıklar + mağaza düzeyinde fiyat etkisi + çeşitlilik (rafta bulunan açık ürünler müşteri çeker)
    const weights = {}, factors = {}; let sumD = 0, sumDF = 0, traffic = 0;
    for (const p of PRODS()) {
      let f = S.unlocked[p.id] ? priceFactor(p.id, bp) : 1;
      if (p.cold && !fridgeOk(e)) f *= B("noFridgeMult", 0.7);   // soğuk ürün: dolap yoksa/bozuksa müşteri güvenmez
      factors[p.id] = +f.toFixed(3);
      weights[p.id] = bp.demand[p.id] * f;
      if (S.unlocked[p.id]) {
        sumD += bp.demand[p.id]; sumDF += bp.demand[p.id] * f;
        if ((S.stock[p.id] || 0) > 0) traffic += p.traffic || 0;
      }
    }
    traffic = Math.min(traffic, B("trafficMax", 0.45));
    const store = sumD > 0 ? clamp(Math.pow(sumDF / sumD, B("priceStoreGamma", 1)), B("priceStoreMin", 0.4), B("priceStoreMax", 1.5)) : 1;

    const base = B("baseCustomers", 16) + B("customerGrowthPerDay", 0.12) * (day - 1) +
      B("customerGrowthPerLevel", 1.1) * (S.level - 1) + e.customers;
    const wm = weather.customerMult || 1, wmEff = wm < 1 ? wm + (1 - wm) * e.weatherShield : wm;
    const mult0 = (weekday.customerMult || 1) * wmEff * ((event && event.customerMult) || 1) * satMult(S.sat) * (1 + traffic) * store * D("customers", 1);
    const share = rivalShare(bp, e);
    const cMin = B("minCustomers", 4), cMax = B("customersMax", 90);
    const customers = clamp(Math.round(base * mult0 * (1 - share)), cMin, cMax);
    const noRival = clamp(Math.round(base * mult0), cMin, cMax);

    const bits = [weekday.name, `${weather.emoji || ""} ${weather.name}`.trim(), `~${customers} müşteri`];
    if (event) bits.push(`${event.emoji || ""} ${event.name}`.trim());
    return { day, weekday, weather, event, goal: bp.goal, customers, demand: bp.demand, heat: bp.heat, weights, factors,
      regulars: bp.regulars, traffic, store, forecastText: bits.join(" · "),
      rival: { active: bp.rival.active, open: bp.rival.open, share, campaign: bp.rival.campaign, lost: noRival - customers } };
  }

  // ---------- SABAH: ALIŞVERİŞ ----------
  const costMult = plan => effects().costMult * ((plan && plan.event && plan.event.costMult) || 1);
  const lineCost = (id, n, plan) => { const p = product(id); return n > 0 ? Math.max(1, Math.round(n * p.cost * costMult(plan))) : 0; };
  const unitCostExact = (id, plan) => { const p = product(id); return p ? p.cost * costMult(plan || basePlan()) : Infinity; };

  function buyStock(id, qty) {
    const p = product(id);
    if (!p || !S.unlocked[id] || !(qty > 0) || S.bankrupt) return 0;
    const plan = basePlan();
    let n = Math.min(Math.floor(qty), Math.floor(slotsFree() / (p.slots || 1)));
    while (n > 0 && lineCost(id, n, plan) > S.money) n--;
    if (n <= 0) return 0;
    const c = lineCost(id, n, plan);
    S.money -= c; addStock(id, n); S.todayStockCost += c; S.stats.stockSpent += c;
    return n;
  }
  function avgItems(e) {
    const base = B("itemsPerCustomer", 1), max = B("maxItemsPerCustomer", 3), ch = clamp(B("extraItemChance", 0.3) + e.extraItemChance, 0, 1);
    let tot = base, p = 1;
    for (let k = base; k < max; k++) { p *= ch; tot += p; }
    return tot;
  }
  // Bugün her ürün için beklenen satış adedi (müşteri sayısı × ürünün ağırlık payı × sepet büyüklüğü)
  function expectedSales(plan) {
    plan = plan || planDay();
    const ids = PRODS().filter(p => S.unlocked[p.id]).map(p => p.id), out = {};
    let wsum = 0; for (const id of ids) wsum += plan.weights[id] || 0;
    const avgQty = avgItems(effects());
    for (const id of ids) out[id] = plan.customers * ((plan.weights[id] || 0) / (wsum || 1)) * avgQty;
    return out;
  }
  // Hedef stok = beklenen satış + z·√satış (rastgele dalgalanmaya pay); ömrü 1 geceyse yarım pay (artan bozulur)
  function stockTargets(plan, mult) {
    const exp = expectedSales(plan), e = effects(), z = B("fillZ", 2), t = {};
    for (const id in exp) t[id] = Math.ceil((exp[id] + (lifeOf(product(id), e) <= 1 ? 0.5 : 1) * z * Math.sqrt(exp[id])) * (mult > 0 ? mult : 1));
    return t;
  }
  // Dengeli doldur: hedefe doğru en "eksik" ürüne birer birer; yuva ve para sınırı
  function fillAll(mult, only) {
    if (S.bankrupt) return 0;
    const plan = planDay();
    const target = stockTargets(plan, mult), ids = only ? [only] : Object.keys(target);
    const bought = {}; let total = 0, free = slotsFree();
    const marginal = id => lineCost(id, (bought[id] || 0) + 1, plan) - lineCost(id, bought[id] || 0, plan);
    for (let guard = 0; guard < 5000; guard++) {
      let best = null, bestScore = Infinity, bestC = 0;
      for (const id of ids) {
        if (!(id in target)) continue;
        const have = (S.stock[id] || 0) + (bought[id] || 0);
        if (have >= target[id] || slotsOf(id) > free) continue;
        const c = marginal(id); if (c > S.money) continue;
        const score = (have + 1) / Math.max(0.01, target[id]);
        if (score < bestScore) { bestScore = score; best = id; bestC = c; }
      }
      if (!best) break;
      S.money -= bestC; addStock(best, 1); bought[best] = (bought[best] || 0) + 1; free -= slotsOf(best);
      S.todayStockCost += bestC; S.stats.stockSpent += bestC; total++;
    }
    return total;
  }
  function canUnlock(id) {
    const p = product(id);
    return !!p && !S.unlocked[id] && !S.bankrupt && S.level >= (p.unlockLevel || 1) && S.money >= (p.unlockCost || 0);
  }
  function unlockProduct(id) {
    if (!canUnlock(id)) return false;
    S.money -= product(id).unlockCost || 0; S.unlocked[id] = true; S.prices[id] = 1;
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
    if (u.req && !upgradeLevel(u.req)) return false;
    return S.level >= Math.max(u.unlockLevel || 1, u.levels[l].minLevel || 1, u.levels[l].unlockLevel || 1);
  }
  const canAfford = c => c !== null && c !== undefined && S.money >= c;
  function buyUpgrade(id) {
    if (S.bankrupt || !upgradeAvailable(id)) return false;
    const u = upgradeDef(id), l = upgradeLevel(id), cost = u.levels[l].cost;
    if (S.money < cost) return false;
    S.money -= cost; S.upgrades[id] = l + 1; S.stats.upgradesBought++; effCache = null;
    const ef = u.levels[l].effect || {};
    if ((ef.final || u.final || u.cat === "final") && !S.won) {
      S.won = true; S.wonDay = S.day;
      S.season = { n: 1, start: S.day, profit: 0, goal: seasonGoal(1) };
    }
    return true;
  }
  // Pamuk'un kumbarası: para en ucuz ürüne yetmiyor ve hiç stok yoksa, günde bir kez, oyun boyu sınırlı hak
  function piggyRescue() {
    if (S.piggyDay === S.day || S.piggyLeft <= 0 || S.bankrupt) return 0;
    const costs = PRODS().filter(p => S.unlocked[p.id]).map(p => unitCostExact(p.id));
    const cheapest = costs.length ? Math.min(...costs) : 0;
    const anyStock = Object.keys(S.stock).some(id => S.unlocked[id] && S.stock[id] > 0);
    if (S.money >= cheapest || anyStock) return 0;
    const amt = B("piggyBank", 25);
    S.money += amt; S.piggyDay = S.day; S.piggyLeft--; S.stats.piggyUsed++;
    return amt;
  }
  const stockValue = () => PRODS().reduce((a, p) => a + (S.stock[p.id] || 0) * p.cost, 0);

  // ---------- GİDERLER, BORÇ, İFLAS ----------
  const inGrace = () => !!S.graceUntil && S.day <= S.graceUntil;
  function utilityCost(day) {
    if (day < B("utilityStartDay", 3) || inGrace()) return 0;
    return Math.round((B("utilityBase", 6) + effects().upkeep) * D("utility", 1));
  }
  function rentAmount(level) {
    const seasonM = 1 + (S.season ? (S.season.n - 1) * B("seasonRentStep", 0.12) : 0);
    const extraSlots = Math.max(0, totalSlots() - B("totalSlotsBase", 44));   // dükkân büyüdükçe kira da büyür
    const full = (B("rentBase", 130) + B("rentPerLevel", 0) * ((level || S.level) - 1) + B("rentPerDay", 17) * S.day + B("rentPerSlot", 6) * extraSlots) * D("rent", 1) * effects().rentMult * seasonM;
    // Mahalle ev sahibi anlayışlıdır: batmakta olan esnafın kirası son 7 günün kârının belli bir oranını geçmez (taban: temel kira)
    const hist = (S.history || []).slice(-7), cap = B("rentProfitCap", 0.9);
    if (cap > 0 && hist.length >= 3) {
      const weekly = hist.reduce((a, h) => a + Math.max(0, h.profit || 0), 0) * 7 / hist.length;
      return Math.round(Math.max(Math.min(full, cap * weekly), B("rentBase", 130) * D("rent", 1)));
    }
    return Math.round(full);
  }
  const rentFirstDay = () => Math.max(7, B("rentFirstDay", 14) + D("rentFirstShift", 0));
  const rentDue = day => day >= rentFirstDay() && day % B("rentWeekday", 7) === 0 && !(S.graceUntil && day <= S.graceUntil);
  function nextRentDay(from) {
    let d = Math.max(from, rentFirstDay());
    const w = B("rentWeekday", 7);
    d = Math.ceil(d / w) * w;
    if (S.graceUntil && d <= S.graceUntil) d = Math.ceil((S.graceUntil + 1) / w) * w;
    return d;
  }
  const debtLimit = level => Math.round((B("debtLimitBase", 150) + B("debtLimitPerLevel", 90) * ((level || S.level) - 1)) * D("debtLimit", 1));
  function finance() {
    const nd = nextRentDay(S.day);
    return { money: S.money, debt: S.debt, debtLimit: debtLimit(), debtDays: S.debtDays, debtMaxDays: B("debtMaxDays", 14),
      utility: utilityCost(S.day), upkeep: effects().upkeep, rentDay: nd, rentIn: nd - S.day, rentAmount: rentAmount(),
      rentToday: rentDue(S.day), interest: S.debt > 0 ? Math.round(S.debt * B("debtInterest", 0.03) * D("interest", 1)) : 0,
      piggyLeft: S.piggyLeft, grace: inGrace() ? S.graceUntil - S.day + 1 : 0 };
  }
  function repayDebt(n) {
    const amt = Math.floor(Math.min(num(n, 0), S.money, S.debt));
    if (amt <= 0) return 0;
    S.money -= amt; S.debt -= amt; if (S.debt <= 0) S.debtDays = 0;
    return amt;
  }

  // ---------- EKİPMAN (dolap / kasa) ----------
  const EQUIP = { fridge: { name: "Buzdolabı", emoji: "🧊" }, register: { name: "Yazar Kasa", emoji: "🧾" } };
  const equipOwned = eq => eq === "register" || (eq === "fridge" && upgradeLevel("buzdolabi") > 0);
  function breakChance(cond) {
    return clamp((B("equipBreakFrom", 65) - cond) / B("equipBreakFrom", 65), 0, 1) * B("equipBreakMaxChance", 0.7) * D("breakdown", 1);
  }
  function serviceCost(eq) {
    const base = eq === "fridge" ? B("equipServiceFridge", 90) : B("equipServiceRegister", 60);
    const full = base * (1 + B("equipServiceLevelStep", 0.07) * (S.level - 1));
    return Math.max(1, Math.round(S.broken[eq] ? full : full * B("equipMaintainFrac", 0.55)));
  }
  function equipInfo() {
    return ["fridge", "register"].filter(equipOwned).map(eq => ({ id: eq, name: EQUIP[eq].name, emoji: EQUIP[eq].emoji, cond: Math.round(S.equip[eq]),
      broken: !!S.broken[eq], cost: serviceCost(eq), risk: S.broken[eq] ? 1 : breakChance(S.equip[eq]),
      needed: !!S.broken[eq] || S.equip[eq] < B("equipMinMaintainCond", 90) }));
  }
  function service(eq) {
    if (S.bankrupt || !equipOwned(eq)) return false;
    if (!S.broken[eq] && S.equip[eq] >= B("equipMinMaintainCond", 90)) return false;
    const c = serviceCost(eq); if (S.money < c) return false;
    S.money -= c; S.equip[eq] = 100; S.broken[eq] = false; S.stats.repairSpent += c;
    return true;
  }
  function wearEquipment() {
    const e = effects(), u = rngFor(STREAM.equip);
    for (const eq of ["fridge", "register"]) {
      const r = u();
      if (!equipOwned(eq)) continue;
      const base = eq === "fridge" ? B("equipWearFridge", 16) : B("equipWearRegister", 11);
      let w = base * (1 + B("equipWearJitter", 0.4) * (r * 2 - 1)) * e.wearMult * (eq === "register" ? e.regWear : 1);
      if (S.broken[eq]) w = 0;
      S.equip[eq] = clamp(S.equip[eq] - w, 0, 100);
    }
  }

  // ---------- GÜN SİMÜLASYONU ----------
  function qPush(item) {
    item.seq = run.seq++;
    const q = run.queue; let lo = 0, hi = q.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (q[m].t < item.t || (q[m].t === item.t && q[m].seq < item.seq)) lo = m + 1; else hi = m; }
    q.splice(lo, 0, item);
  }
  const bubbleDayMult = () => (1 + B("bubbleRewardPerLevel", 0.03) * (S.level - 1)) * ((run.plan.event && run.plan.event.bubbleRewardMult) || 1);
  const bubbleBase = bt => (bt.reward || 0) * B("bubbleRewardMult", 1) * run.eff.bubbleReward * bubbleDayMult();
  const penaltyMult = () => (1 + B("bubblePenaltyPerLevel", 0.07) * (S.level - 1)) * D("penalty", 1);
  const moneyScale = () => 1 + B("crisisMoneyPerLevel", 0.1) * (S.level - 1);
  const lifeScale = () => clamp(1 + B("bubbleLifePerLevel", -0.012) * (S.level - 1), B("bubbleLifeFloorMult", 0.8), 1.3) * D("bubbleLife", 1);

  const FACES = ["🧑", "👩", "🧓", "👨", "🧕", "👱", "🧔", "👧", "👦", "👩‍🦱", "👨‍🦳", "👩‍🦰"];
  const COLORS = ["#f7b2bd", "#a8d8ea", "#ffd3a5", "#c3e6a8", "#d5b8f0", "#ffe29a", "#b8e0d2", "#f5c6a5"];

  const crisisDef = id => CRISIS_DEFS().find(c => c.id === id) || null;
  function crisisEligible(c, plan) {
    if ((c.minDay || 1) > S.day || (c.minLevel || 1) > S.level) return false;
    if (c.requires === "rival" && !(plan.rival && plan.rival.active)) return false;
    if (c.requires === "fridge" && !equipOwned("fridge")) return false;
    return true;
  }

  function startDay(opts) {
    const mode = (opts && opts.mode) === "skip" ? "skip" : "play";
    if (run && !run.ended) return run;
    if (S.bankrupt) return null;
    piggyRescue();
    if (mode === "play" && !headless) runSnapshot = clone(S); else if (!headless) runSnapshot = null;
    const plan = planDay(), e = effects(), len = B("dayLength", 75);
    run = {
      day: S.day, t: 0, length: len, mode, plan, eff: e, queue: [], seq: 0, out: [], forfeit: forfeitFlag,
      customersSpawned: 0, served: 0, missedCustomers: 0, lostCustomers: 0, sales: 0, revenue: 0, bubbleIncome: 0, tips: 0,
      combo: 1, maxCombo: 1, lastPopT: -999, popped: 0, missed: 0, autoSolved: 0, bubbles: {}, nextBid: 1,
      goal: plan.goal, goalProgress: 0, goalDone: false, goalFailed: false, goalReward: null,
      paused: {}, pausedAll: 0, emergencyCost: 0, moneyPenalty: 0, repBonus: 0, regularsServed: 0,
      restockCount: {}, restockActive: {}, popsByType: {}, custList: [], salesBy: {},
      spawned: 0, spawnedBy: {}, thefts: 0, theftUnits: 0, theftLoss: 0, caught: 0, breakdowns: [], crisis: null, crisisSeq: 0, crisisLog: [],
      crisisSpend: 0, crisisGain: 0, crisisLoss: 0, spoilNow: 0, spoilNowValue: 0, regLost: 0, salvos: 0, partialMiss: 0,
      moneyStart: S.money, stockValueStart: stockValue(), satStart: S.sat, satShown: Math.round(S.sat), events: [], ended: false, dayEndEmitted: false,
      rngRun: rngFor(STREAM.run)
    };
    forfeitFlag = false;
    if (mode === "play" && !headless) { S.dayOpen = true; save(); }

    // Müşteri takvimi (tohumlu; stoktan bağımsız → oyna/atla aynı müşterileri görür; fiyatı plan hesaba kattı)
    const rc = rngFor(STREAM.customers);
    const n = Math.max(0, Math.round(plan.customers * (1 + (rc() - 0.5) * 2 * B("customerJitter", 0.1))));
    const quiet = B("closingQuietSec", 3);
    const t0 = B("customerStartSec", 1), t1 = len - quiet - B("browseSec", 2.5);
    const avail = PRODS().filter(p => S.unlocked[p.id]);
    const exChance = B("extraItemChance", 0.3) + e.extraItemChance, maxItems = B("maxItemsPerCustomer", 3);
    const jit = B("customerSpawnJitter", 0.35), gap = (t1 - t0) / Math.max(1, n);
    const wf = p => plan.weights[p.id] || 0;
    for (let i = 0; i < n; i++) {
      const t = clamp(t0 + (i + 0.5 + jit * (rc() * 2 - 1)) * gap, t0, t1);
      const want = [];
      const add = p => { if (!p) return; const w = want.find(x => x.pid === p.id); if (w) w.qty++; else want.push({ pid: p.id, qty: 1 }); };
      const first = weightedPick(rc, avail, wf);
      for (let k = 0; k < B("itemsPerCustomer", 1); k++) add(first);
      let items = B("itemsPerCustomer", 1);
      while (items < maxItems && rc() < exChance) { add(weightedPick(rc, avail, wf)); items++; }
      const tipU = rc(), tipAmtU = rc();
      const look = { face: FACES[Math.floor(rc() * FACES.length)], color: COLORS[Math.floor(rc() * COLORS.length)] };
      const regU = rc();
      if (!want.length) continue;
      const c = { cid: "c" + i, t, want, tipU, tipAmtU, look, regU, lost: false, entered: false };
      run.custList.push(c);
      qPush({ t, kind: "cEnter", c });
    }

    // Baloncuk takvimi: hız × süre; tür ağırlığı × gün/hava/olay/yükseltme çarpanları
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
    const rate = Math.min(B("bubbleRateMax", 0.27),
      B("bubbleRateBase", 0.11) + B("bubbleRatePerLevel", 0.012) * (S.level - 1) + B("bubbleRatePerDay", 0.0015) * (S.day - 1));
    // Yükseltmeler (paspas, yazar kasa, lamba…) sadece karışımı değil, sorun sayısını da azaltır
    const wBase = id => [plan.weekday.bubbleMods, plan.weather.bubbleMods, plan.event && plan.event.bubbleMods].reduce((w, m) => w * bmod(m, id), types[id].weight);
    let sumNow = 0, sumBase = 0; for (const id of pool) { sumNow += wOf(id); sumBase += wBase(id); }
    const upgRatio = sumBase > 0 ? clamp(sumNow / sumBase, 0.3, 1.3) : 1;
    const nb = Math.round(rate * (b1 - b0) * ((plan.event && plan.event.bubbleMult) || 1) * (plan.weather.bubbleMult || 1) * upgRatio);
    const minGap = B("bubbleMinGapSec", 0.6);
    let last = -Infinity;
    for (let i = 0; i < nb && pool.some(id => wOf(id) > 0); i++) {
      let t = b0 + ((i + 0.1 + 0.8 * rb()) / nb) * (b1 - b0);
      t = Math.max(t, last + minGap); last = t;
      const type = weightedPick(rb, pool, wOf);
      const it = { t, kind: "bSpawn", type, zi: rb(), pu: rb(), au: rb() };
      if (t < b1 && wOf(type) > 0) qPush(it);
    }
    // Mahalle sakinleri
    plan.regulars.forEach((rid, i) => {
      const t = len * (0.12 + 0.7 * ((i + rb()) / Math.max(1, plan.regulars.length)));
      qPush({ t, kind: "rSpawn", rid, zi: rb(), au: rb() });
    });

    // Salvo: yoğun saat (aynı anda 2–4 baloncuk)
    {
      const rs = rngFor(STREAM.salvo);
      const lam = S.day >= B("salvoStartDay", 6) ? Math.min(B("salvoMax", 2.6), B("salvoBase", 0.5) + B("salvoPerDay", 0.03) * S.day) * D("crisis", 1) : 0;
      const u0 = rs(), cnt = Math.floor(lam) + (u0 < lam - Math.floor(lam) ? 1 : 0);
      const sp = B("salvoSpacingSec", 0.28), minS = B("salvoMinSize", 2), maxS = B("salvoMaxSize", 4);
      for (let k = 0; k < Math.min(4, cnt); k++) {
        const t = clamp(len * (0.14 + 0.62 * ((k + rs()) / Math.max(1, cnt))), 6, len - quiet - 8);
        const size = minS + Math.floor(rs() * (maxS - minS + 1));
        qPush({ t, kind: "salvoStart", size });
        for (let j = 0; j < size && pool.length; j++) {
          const type = weightedPick(rs, pool, wOf);
          qPush({ t: t + 0.05 + j * sp, kind: "bSpawn", type, zi: rs(), pu: rs(), au: rs(), salvo: true });
        }
      }
    }

    // Hırsızlar (Hızlı Geç = başıboş dükkân → ×2)
    {
      const rt = rngFor(STREAM.theft);
      let lam = S.day >= B("theftStartDay", 5) ? Math.min(B("theftMax", 1.6), B("theftBase", 0.6) + B("theftPerDay", 0.015) * S.day) * D("theft", 1) * e.theftMult : 0;
      if (mode === "skip") lam *= B("theftSkipMult", 1.8);
      const u0 = rt(), times = [rt(), rt(), rt(), rt(), rt(), rt()], zis = [rt(), rt(), rt(), rt(), rt(), rt()], aus = [rt(), rt(), rt(), rt(), rt(), rt()];
      const cnt = Math.floor(lam) + (u0 < lam - Math.floor(lam) ? 1 : 0);
      for (let k = 0; k < Math.min(6, cnt); k++) qPush({ t: len * (0.1 + 0.8 * times[k]), kind: "tSpawn", zi: zis[k], au: aus[k] });
    }
    // Ekipman arızaları (yıpranmış ekipman → risk)
    {
      const re = rngFor(STREAM.equip + 1000);
      for (const eq of ["fridge", "register"]) {
        const u = re(), tu = re();
        if (!equipOwned(eq) || S.broken[eq]) continue;
        if (u < breakChance(S.equip[eq])) qPush({ t: len * (0.2 + 0.6 * tu), kind: "eSpawn", eq, zi: tu, au: re() });
      }
    }
    // Kriz kartları
    {
      const rz = rngFor(STREAM.crisis);
      const lam = S.day >= B("crisisStartDay", 4) ? Math.min(B("crisisMax", 1.6), B("crisisBase", 0.45) + B("crisisPerDay", 0.012) * S.day) * D("crisis", 1) : 0;
      const u0 = rz(), cnt = Math.floor(lam) + (u0 < lam - Math.floor(lam) ? 1 : 0);
      const defs = CRISIS_DEFS().filter(c => crisisEligible(c, plan));
      for (let k = 0; k < Math.min(3, cnt) && defs.length; k++) {
        const t = len * (0.12 + 0.62 * ((k + rz()) / Math.max(1, cnt)));
        const def = weightedPick(rz, defs, c => (c.weight === undefined ? 1 : c.weight));
        qPush({ t, kind: "cSpawn", cid: def.id, zi: rz(), au: rz() });
      }
    }
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
    const amount = q * priceOf(pid);
    takeStock(pid, q); S.money += amount;
    run.revenue += amount; run.sales += q; run.salesBy[pid] = (run.salesBy[pid] || 0) + q;
    emit(out, { type: "customerBuy", cid, productId: pid, qty: q, amount });
    if (S.stock[pid] <= 0) spawnRestock(pid, out);
    void p;
    return amount;
  }
  function customerBuy(c, out) {
    // Kasa bozukken kuyruk uzar: bazı müşteriler beklemeden gider
    if (S.broken.register && c.regU < B("regLostCustomerShare", 0.4)) {
      run.missedCustomers++; run.regLost++;
      emit(out, { type: "customerMiss", cid: c.cid, productId: c.want[0].pid, reason: "register" });
      changeSat(B("satPerMiss", -1.5), out); goalCheck(out);
      return false;
    }
    let spent = 0, missed = 0;
    c.want.forEach((w, i) => {
      const blocked = run.pausedAll > run.t || (run.paused[w.pid] || 0) > run.t;
      const amt = blocked ? 0 : sell(w.pid, w.qty, c.cid, out);
      if (amt > 0) spent += amt;
      else { missed++; if (i === 0) emit(out, { type: "customerMiss", cid: c.cid, productId: w.pid, reason: blocked ? "paused" : "empty" }); }
    });
    const happy = spent > 0;
    if (happy) {
      run.served++;
      if (missed) { run.partialMiss += missed; changeSat(B("satPerMiss", -1.5) * 0.5 * missed, out); }
      else changeSat(B("satPerSale", 0.4), out);
      if (c.tipU < B("tipChance", 0.08) + run.eff.tipChance) {
        const a = B("tipMin", 1), b = B("tipMax", 4);
        const amount = Math.round((a + c.tipAmtU * (b - a)) * bubbleDayMult());
        S.money += amount; run.tips += amount;
        emit(out, { type: "tip", amount, cid: c.cid });
      }
    } else { run.missedCustomers++; changeSat(B("satPerMiss", -1.5), out); }
    goalCheck(out);
    return happy;
  }

  // Baloncuk oluştur
  function makeBubble(typeId, extra, lifeBase) {
    const bt = BTYPES()[typeId] || {};
    const id = "b" + run.nextBid++;
    const zone = bt.zone || "floor", slots = (B("zoneSlots", {})[zone]) || 3;
    const life = Math.max(B("bubbleLifeMinSec", 2), (lifeBase !== undefined ? lifeBase : (bt.life || 5)) * lifeScale() + run.eff.bubbleLife);
    const b = Object.assign({
      id, type: typeId, zone, zoneIndex: Math.floor((extra.zi || 0) * slots), taps: bt.taps || 1, tapsLeft: bt.taps || 1,
      life, age: 0, spawnT: run.t, reward: bt.reward > 0 ? Math.max(1, Math.round(bubbleBase(bt))) : 0,
      label: bt.label || "", emoji: bt.emoji || "❓", au: extra.au === undefined ? run.rngRun() : extra.au
    }, extra.fields || {});
    if (extra.salvo) b.salvo = true;
    run.bubbles[id] = b; run.spawned++; run.spawnedBy[typeId] = (run.spawnedBy[typeId] || 0) + 1;
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

  // Acil tedarik (restock baloncuğu): alış × çarpan, para ve yuva yettiği kadar
  function emergencyRestock(pid, out) {
    const p = product(pid); if (!p) return 0;
    const c = Math.ceil(unitCostExact(pid, run.plan) * B("emergencyCostMult", 1.7));
    const q = Math.max(0, Math.min(B("emergencyQty", 3), Math.floor(slotsFree() / (p.slots || 1)), Math.floor(S.money / c)));
    if (q > 0) {
      S.money -= q * c; addStock(pid, q); run.emergencyCost += q * c; S.stats.stockSpent += q * c;
      emit(out, { type: "restock", productId: pid, qty: q, cost: q * c });
    }
    return q;
  }

  // Mahalle sakini gelir
  function serveRegular(rid, bonus, out) {
    const r = REGS().find(x => x.id === rid); if (!r) return;
    const cid = "reg-" + rid;
    run.customersSpawned++;
    emit(out, { type: "customerEnter", cid, look: { face: r.emoji, color: B("regularColor", "#ffd6e0"), regularId: rid } });
    const blocked = run.pausedAll > run.t || (run.paused[r.likes] || 0) > run.t;
    const amt = (S.unlocked[r.likes] && !blocked) ? sell(r.likes, B("regularQty", 1), cid, out) : 0;
    if (amt <= 0) { run.missedCustomers++; emit(out, { type: "customerMiss", cid, productId: r.likes, reason: blocked ? "paused" : "empty" }); }
    if (bonus) {
      const tip = Math.round(B("regularTip", 3) * (r.tipMult || 1) * bubbleDayMult() * (amt > 0 ? 1 : B("regularNoStockTipMult", 0.5)));
      S.money += tip; run.tips += tip; emit(out, { type: "tip", amount: tip, cid });
      run.repBonus += amt > 0 ? B("repPerRegular", 3) : 0; run.regularsServed += amt > 0 ? 1 : 0;
      changeSat(B("regularSat", 2), out);
    }
    if (amt > 0) run.served++;
    emit(out, { type: "customerLeave", cid, happy: amt > 0 || bonus });
    goalCheck(out);
  }

  // ---- yeni mekanik yardımcıları ----
  function mostValuableStocked() {
    let best = null;
    for (const p of PRODS()) if (S.unlocked[p.id] && (S.stock[p.id] || 0) > 0 && (!best || priceOf(p.id) > priceOf(best.id))) best = p;
    return best;
  }
  function loseCustomers(k) {
    k = Math.round(k * B("lostCustomersMult", 1));
    for (const c of run.custList) { if (k <= 0) break; if (!c.entered && !c.lost && c.t > run.t) { c.lost = true; run.lostCustomers++; k--; } }
  }
  function addCustomers(n) {
    const rc = run.rngRun, avail = PRODS().filter(p => S.unlocked[p.id]);
    for (let i = 0; i < n && avail.length; i++) {
      const p = weightedPick(rc, avail, x => run.plan.weights[x.id] || 0);
      const c = { cid: "x" + run.nextBid++, t: run.t + 0.5 + i * 0.7, want: [{ pid: p.id, qty: 1 + Math.floor(rc() * 2) }], tipU: rc(), tipAmtU: rc(),
        look: { face: FACES[Math.floor(rc() * FACES.length)], color: COLORS[Math.floor(rc() * COLORS.length)] }, regU: rc(), lost: false, entered: false };
      if (c.t < run.length - 1) { run.custList.push(c); qPush({ t: c.t, kind: "cEnter", c }); }
    }
  }
  function spoilFresh(frac, out) {
    let units = 0, value = 0;
    for (const p of PRODS()) {
      if (!isFresh(p)) continue;
      const have = S.stock[p.id] || 0, lose = Math.min(have, Math.round(have * frac));
      if (lose > 0) { takeStock(p.id, lose); units += lose; value += lose * p.cost; }
    }
    if (units) { run.spoilNow += units; run.spoilNowValue += value; emit(out, { type: "spoil", units, now: true }); }
  }
  function breakEquip(eq, out) {
    if (!equipOwned(eq) || S.broken[eq]) return;
    S.broken[eq] = true; S.equip[eq] = Math.min(S.equip[eq], 25); run.breakdowns.push(eq);
    S.stats.breakdowns++;
    emit(out, { type: "breakdown", equip: eq });
  }
  function stockBuy(spec, out) {
    const plan = run.plan, list = PRODS().filter(p => S.unlocked[p.id]).sort((a, b) => (plan.weights[b.id] || 0) - (plan.weights[a.id] || 0)).slice(0, 2);
    let n = spec.n || 0, bought = 0, spent = 0, i = 0;
    while (n > 0 && list.length && i < 200) {
      const p = list[i++ % list.length];
      const c = Math.max(1, Math.round(p.cost * costMult(plan) * (1 - (spec.discount || 0))));
      if (slotsOf(p.id) > slotsFree() || c > S.money) { if (i > list.length * 3) break; continue; }
      S.money -= c; addStock(p.id, 1); spent += c; bought++; n--;
    }
    if (bought) { S.todayStockCost += spent; S.stats.stockSpent += spent; emit(out, { type: "restock", productId: list[0].id, qty: bought, cost: spent, bulk: true }); }
  }
  function sellPremium(mult, out) {
    const p = mostValuableStocked(); if (!p) return;
    const amount = Math.round(priceOf(p.id) * mult);
    takeStock(p.id, 1); S.money += amount; run.revenue += amount; run.sales++; run.salesBy[p.id] = (run.salesBy[p.id] || 0) + 1;
    emit(out, { type: "tip", amount, cid: "vip" });
  }
  function applyFx(fx, out) {
    if (!fx) return;
    const ms = moneyScale();
    if (fx.money) {
      const m = Math.round(fx.money * ms);
      if (m > 0) { S.money += m; run.crisisGain += m; } else { const l = Math.min(S.money, -m); S.money -= l; run.crisisLoss += l; }
    }
    if (fx.sat) changeSat(fx.sat, out);
    if (fx.rep) run.repBonus += fx.rep;
    if (fx.customers > 0) addCustomers(fx.customers); else if (fx.customers < 0) loseCustomers(-fx.customers);
    if (fx.spoilFresh) spoilFresh(fx.spoilFresh, out);
    if (fx.stockBuy) stockBuy(fx.stockBuy, out);
    if (fx.breakEquip) breakEquip(fx.breakEquip, out);
    if (fx.fixEquip && equipOwned(fx.fixEquip)) { S.equip[fx.fixEquip] = 100; S.broken[fx.fixEquip] = false; }
    if (fx.sellPremium) sellPremium(fx.sellPremium, out);
  }

  // ---- kriz kartları ----
  const optCost = opt => Math.round((opt.cost || 0) * moneyScale());
  function crisisView() {
    if (!run || !run.crisis) return null;
    const c = run.crisis, def = c.def;
    return { id: def.id, emoji: def.emoji, title: def.title, text: def.text, total: B("crisisDecideSec", 9),
      timeLeft: Math.max(0, c.deadline - run.t),
      options: (def.options || []).map(o => ({ id: o.id, label: o.label, hint: o.hint || "", cost: optCost(o), affordable: S.money >= optCost(o) })),
      ignore: { label: "Görmezden gel", hint: def.ignore ? def.ignore.text : "" } };
  }
  function openCrisis(b, out) {
    const def = crisisDef(b.crisisId); if (!def) return;
    run.crisis = { id: def.id, bid: b.id, def, openedT: run.t, deadline: run.t + B("crisisDecideSec", 9), seq: run.crisisSeq++ };
    emit(out, { type: "crisisOpen", crisis: crisisView() });
  }
  function pickOutcome(outcomes, r) {
    let x = r(); for (const o of outcomes) { x -= (o.p === undefined ? 1 : o.p); if (x < 0) return o; }
    return outcomes[outcomes.length - 1];
  }
  function resolveCrisis(optId, auto) {
    if (!run || !run.crisis) return null;
    const c = run.crisis, def = c.def;
    const opt = optId && optId !== "ignore" ? (def.options || []).find(o => o.id === optId) : null;
    if (opt && S.money < optCost(opt)) return { ok: false, error: "para yetmiyor" };
    let outcomes, cost = 0;
    if (opt) { cost = optCost(opt); S.money -= cost; run.crisisSpend += cost; outcomes = opt.outcomes; }
    else outcomes = (def.ignore && def.ignore.outcomes) || [{ p: 1, text: "", fx: {} }];
    const r = mulberry32(hash(S.seed, S.day, STREAM.crisisOut, c.seq, opt ? def.options.indexOf(opt) + 1 : 0, noise));
    const o = pickOutcome(outcomes, r), out = [];
    applyFx(o.fx, out);
    run.crisisLog.push({ id: def.id, choice: opt ? opt.id : "ignore", text: o.text, auto: !!auto });
    S.stats.crisesResolved++;
    run.crisis = null;
    emit(out, { type: "crisisResolve", id: def.id, emoji: def.emoji, choice: opt ? opt.id : "ignore", label: opt ? opt.label : "Görmezden gel", text: o.text, auto: !!auto, cost });
    run.out.push(...out);
    return { ok: true, text: o.text, cost, choice: opt ? opt.id : "ignore" };
  }
  // Bot/akıllı oyuncu için seçeneklerin parasal değeri
  function fxValue(fx) {
    if (!fx) return 0;
    const ms = moneyScale(); let v = 0;
    if (fx.money) v += fx.money * ms;
    if (fx.sat) v += fx.sat * B("crisisSatValue", 2.5);
    if (fx.customers) v += fx.customers * B("crisisCustomerValue", 14) * (1 + 0.08 * (S.level - 1));
    if (fx.spoilFresh) { let fv = 0; for (const p of PRODS()) if (isFresh(p)) fv += (S.stock[p.id] || 0) * p.cost; v -= fv * fx.spoilFresh; }
    if (fx.stockBuy) v += Math.min(fx.stockBuy.n, slotsFree()) * 4 * fx.stockBuy.discount;
    if (fx.breakEquip) v -= serviceCost(fx.breakEquip) * 1.8;
    if (fx.fixEquip) v += serviceCost(fx.fixEquip) * (S.broken[fx.fixEquip] ? 1 : 0.9);
    if (fx.sellPremium) { const p = mostValuableStocked(); if (p) v += priceOf(p.id) * (fx.sellPremium - 1); }
    return v;
  }
  const outcomesValue = outs => outs.reduce((a, o) => a + (o.p === undefined ? 1 : o.p) * fxValue(o.fx), 0);
  function crisisAdvice(reserve) {
    if (!run || !run.crisis) return null;
    const def = run.crisis.def; let best = "ignore", bv = outcomesValue((def.ignore && def.ignore.outcomes) || []);
    for (const o of def.options || []) {
      const cost = optCost(o); if (S.money - cost < (reserve || 0)) continue;
      const v = -cost + outcomesValue(o.outcomes);
      if (v > bv + 0.01) { bv = v; best = o.id; }
    }
    return best;
  }

  function popBubble(b, out) {
    const bt = BTYPES()[b.type] || {};
    if (bt.special === "crisis") {   // karar kartı aç: ödül/kombo yok
      delete run.bubbles[b.id];
      if (run.crisis) { run.crisis = null; }
      openCrisis(b, out);
      return 0;
    }
    const cw = B("comboWindow", 2.5) + run.eff.comboWindow;
    run.combo = (run.t - run.lastPopT <= cw) ? Math.min(B("comboMax", 2), +(run.combo + B("comboStep", 0.25)).toFixed(2)) : 1;
    run.lastPopT = run.t;
    run.maxCombo = Math.max(run.maxCombo, run.combo);
    const reward = bt.reward > 0 ? Math.max(1, Math.round(bubbleBase(bt) * run.combo)) : 0;
    S.money += reward; run.bubbleIncome += reward; run.popped++;
    run.popsByType[b.type] = (run.popsByType[b.type] || 0) + 1;
    delete run.bubbles[b.id];
    if (b.productId && run.restockActive[b.productId] === b.id) { delete run.restockActive[b.productId]; emergencyRestock(b.productId, out); }
    if (b.regularId) serveRegular(b.regularId, true, out);
    if (bt.special === "thief") { run.caught++; S.stats.thievesCaught++; run.repBonus += B("repPerCatch", 1.5); emit(out, { type: "thiefCaught", bubbleId: b.id, auto: false, productId: b.productId }); }
    if (bt.special === "break" && bt.equip) {
      S.equip[bt.equip] = Math.max(S.equip[bt.equip], B("equipQuickFixCond", 45));
      emit(out, { type: "repair", equip: bt.equip, quick: true });
    }
    if (bt.satGain) changeSat(bt.satGain, out);
    if (bt.rep) run.repBonus += bt.rep;
    if (bt.onPop && bt.onPop.customers) addCustomers(bt.onPop.customers);
    run.repBonus += B("repPerBubble", 0.2);
    goalCheck(out);
    return reward;
  }

  function expireBubble(b, out) {
    delete run.bubbles[b.id];
    const bt = BTYPES()[b.type] || {};
    if (b.productId && run.restockActive[b.productId] === b.id) delete run.restockActive[b.productId];
    if (bt.special === "crisis") {   // kimse dokunmadı: "görmezden gel" gerçekleşir
      run.crisis = { id: b.crisisId, bid: b.id, def: crisisDef(b.crisisId), openedT: run.t, deadline: run.t, seq: run.crisisSeq++ };
      emit(out, { type: "bubbleExpire", bubbleId: b.id, autoSolved: false, penalty: null, crisis: true });
      if (run.crisis.def) resolveCrisis("ignore", true); else run.crisis = null;
      return;
    }
    const noPenalty = bt.bonus || (!bt.penalty && !b.regularId);
    let autoP = run.eff.autoSolve;
    if (bt.special === "thief") autoP = 1 - (1 - autoP) * (1 - run.eff.thiefAuto);
    const auto = !noPenalty && b.au < autoP;
    if (auto) {
      run.autoSolved++;
      if (b.type === "restock" && b.productId) emergencyRestock(b.productId, out);
      if (b.regularId) serveRegular(b.regularId, false, out);
      if (bt.special === "thief") { run.caught++; S.stats.thievesCaught++; emit(out, { type: "thiefCaught", bubbleId: b.id, auto: true }); }
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
    if (pen.lostCustomers) loseCustomers(pen.lostCustomers);
    if (pen.spoil) spoilFresh(pen.spoil, out);
    if (pen.breakEquip) breakEquip(pen.breakEquip, out);
    if (pen.steal) {
      const p = mostValuableStocked();
      if (p) {
        const q = Math.min(S.stock[p.id] || 0, B("theftQtyBase", 3) + Math.floor(S.level / B("theftLevelDiv", 4)));
        takeStock(p.id, q);
        run.thefts++; run.theftUnits += q; run.theftLoss += q * p.cost;
        S.stats.theftLoss += q * p.cost;
        emit(out, { type: "theft", productId: p.id, qty: q, value: q * p.price, emoji: p.emoji });
      }
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
      case "salvoStart": run.salvos++; emit(out, { type: "salvo", count: it.size }); return;
      case "bSpawn": {
        const bt = BTYPES()[it.type] || {};
        if (Object.keys(run.bubbles).length >= B("bubbleMaxOnScreen", 7)) {
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
        const b = makeBubble(it.type, { zi: it.zi, au: it.au, fields, salvo: it.salvo });
        emit(out, { type: "bubbleSpawn", bubble: publicBubble(b) });
        return;
      }
      case "tSpawn": {
        const p = mostValuableStocked();
        if (!p) return;   // çalacak mal yok
        if (Object.keys(run.bubbles).length >= B("bubbleMaxOnScreen", 7) + 1) {
          const t2 = run.t + B("bubbleDeferSec", 0.5);
          if (t2 < run.length - B("closingQuietSec", 3)) qPush(Object.assign({}, it, { t: t2 }));
          return;
        }
        const unl = PRODS().filter(x => S.unlocked[x.id]);
        const b = makeBubble("thief", { zi: it.zi, au: it.au, fields: { productId: p.id, productEmoji: p.emoji, zoneIndex: Math.max(0, unl.indexOf(p)) } },
          B("thiefLife", 3.2));
        emit(out, { type: "bubbleSpawn", bubble: publicBubble(b) });
        return;
      }
      case "eSpawn": {
        if (S.broken[it.eq]) return;
        const b = makeBubble(it.eq === "fridge" ? "breakFridge" : "breakReg", { zi: it.zi, au: it.au });
        emit(out, { type: "bubbleSpawn", bubble: publicBubble(b) });
        return;
      }
      case "cSpawn": {
        const def = crisisDef(it.cid); if (!def) return;
        const open = Object.values(run.bubbles).some(x => x.type === "crisis") || run.crisis;
        if (open) {
          const t2 = run.t + 1.5;
          if (t2 < run.length - B("closingQuietSec", 3) - 4) qPush(Object.assign({}, it, { t: t2 }));
          return;
        }
        const b = makeBubble("crisis", { zi: it.zi, au: it.au, fields: { crisisId: def.id, emoji: def.emoji, label: def.title } }, B("crisisBubbleLife", 6.5));
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
    const out = run.out.splice(0);
    if (run.dayEndEmitted) return out;
    const target = Math.min(run.length, run.t + Math.max(0, +dt || 0));
    while (run.queue.length && run.queue[0].t <= target) {
      const it = run.queue.shift();
      run.t = Math.max(run.t, it.t);
      if (run.crisis && run.t >= run.crisis.deadline) resolveCrisis("ignore", true);
      handle(it, out);
    }
    run.t = target;
    if (run.crisis && run.t >= run.crisis.deadline) resolveCrisis("ignore", true);
    for (const id in run.bubbles) run.bubbles[id].age = run.t - run.bubbles[id].spawnT;
    if (run.combo > 1 && run.t - run.lastPopT > B("comboWindow", 2.5) + run.eff.comboWindow) run.combo = 1;
    if (run.t >= run.length) finishDay(out);
    run.out.length && out.push(...run.out.splice(0));
    return out;
  }
  // Gün bitti: kalan müşteri işlerini tamamla, baloncukları cezasız temizle (açık kriz → görmezden gel)
  function finishDay(out) {
    if (run.dayEndEmitted) return;
    let guard = 0;
    while (run.queue.length && guard++ < 10000) {
      const it = run.queue.shift();
      if (it.kind === "cBuy" || it.kind === "cLeave") { run.t = Math.max(run.t, Math.min(it.t, run.length)); handle(it, out); }
    }
    run.t = run.length;
    if (run.crisis) resolveCrisis("ignore", true);
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
    const bt = BTYPES()[b.type] || {};
    const out = [];
    const reward = popBubble(b, out);
    run.out.push(...out);
    return { popped: true, tapsLeft: 0, reward, combo: run.combo, crisis: bt.special === "crisis" ? true : undefined, special: bt.special };
  }

  // Gün ortasında bırakılan gün: kalan süre başıboş geçer (kriz kartı açıksa görmezden gelinir)
  function abandonDay() {
    if (!run || run.ended) return null;
    const dt = B("skipTickDt", 0.25); let guard = 0;
    while (!run.dayEndEmitted && guard++ < 100000) tick(dt);
    return endDay();
  }

  // ---------- SEZON (sonsuz mod) ----------
  const seasonGoal = n => Math.round(B("seasonGoalBase", 4200) * Math.pow(B("seasonGoalGrowth", 1.15), n - 1) * (0.7 + 0.3 * D("rent", 1)) / 10) * 10;
  function seasonInfo() {
    if (!S.season) return null;
    const len = B("seasonLen", 10), left = Math.max(0, S.season.start + len - S.day);
    return { n: S.season.n, goal: S.season.goal, profit: Math.round(S.season.profit), daysLeft: left, len, reward: Math.round(S.season.goal * B("seasonReward", 0.12)), won: S.stats.seasonsWon };
  }

  function endDay() {
    if (!run || run.ended) return null;
    const out = [];
    if (!run.dayEndEmitted) { run.t = run.length; finishDay(out); }
    run.ended = true;
    const e = run.eff, day = S.day;

    // Gece: raf ömrü (partiler yaşlanır, ömrü dolanlar tamamen bozulur), ekipman yıpranır
    const sp = ageStock(e);
    const spoiled = sp.units + run.spoilNow, spoiledValue = sp.value + run.spoilNowValue;
    wearEquipment();

    const stockCost = S.todayStockCost + run.emergencyCost;
    const net = (S.money - run.moneyStart) - S.todayStockCost;
    const profit = (S.money - run.moneyStart) + stockValue() - run.stockValueStart;   // gün içi para + raf değeri (hırsızlık/bozulma dahil), giderlerden ÖNCE

    // İtibar
    const repGained = Math.max(0, Math.round(run.sales * B("repPerSale", 0.6) + S.sat * B("repPerSatPoint", 0.1) + B("repPerDay", 26) + run.repBonus));
    S.rep += repGained;
    const oldLevel = S.level;
    for (const L of LVLS()) if (S.rep >= L.rep && L.level > S.level) S.level = L.level;
    let levelUp = null;
    if (S.level > oldLevel) {
      const L = LVLS().find(x => x.level === S.level);
      levelUp = { level: S.level, title: L.title, unlockText: L.unlockText || "" };
      for (const p of PRODS()) if (!S.unlocked[p.id] && (p.unlockLevel || 1) <= S.level && !(p.unlockCost > 0)) S.unlocked[p.id] = true;
    }

    // Akşam hesabı: elektrik/maaş, kira, faiz → borç
    const fixed = { utility: utilityCost(day), rent: rentDue(day) ? rentAmount(oldLevel) : 0, interest: 0, storage: inGrace() ? 0 : Math.round(stockValue() * B("stockHoldRate", 0.012)), repaid: 0, shortfall: 0, paid: 0 };
    if (S.debt > 0) fixed.interest = Math.round(S.debt * B("debtInterest", 0.03) * D("interest", 1));
    const need = fixed.utility + fixed.rent + fixed.interest + fixed.storage;
    fixed.paid = Math.min(Math.floor(S.money), need);
    S.money -= fixed.paid;
    fixed.shortfall = need - fixed.paid;
    S.debt += fixed.shortfall;
    S.stats.rentPaid += fixed.rent; S.stats.interestPaid += fixed.interest;
    if (S.debt > 0 && profit > 0 && S.money > 0) {
      fixed.repaid = Math.min(S.debt, Math.floor(S.money), Math.floor(profit * B("debtRepayFrac", 0.4)));
      S.money -= fixed.repaid; S.debt -= fixed.repaid;
    }
    S.debtDays = S.debt > 0 ? S.debtDays + 1 : 0;
    S.stats.debtPeak = Math.max(S.stats.debtPeak, S.debt);
    let bankrupt = null;
    if (!S.bankrupt && (S.debt > debtLimit(S.level) || S.debtDays >= B("debtMaxDays", 14))) {
      bankrupt = { day, reason: S.debt > debtLimit(S.level) ? "limit" : "days", debt: S.debt };
      S.bankrupt = bankrupt;
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
    st.rivalLost += run.plan.rival.lost || 0;

    const summary = {
      day, mode: run.mode, forfeit: !!run.forfeit, customers: run.customersSpawned, served: run.served, missed: run.missedCustomers,
      lostCustomers: run.lostCustomers, itemsSold: run.sales,
      revenue: run.revenue, bubbleIncome: run.bubbleIncome, tips: run.tips,
      goal: run.goal ? run.goal.text : null, goalDone: run.goalDone, goalReward: run.goalReward,
      spoiled, spoiledValue, stockCost, stockDelta: stockValue() - run.stockValueStart,
      profit, emergencyCost: run.emergencyCost, moneyPenalty: run.moneyPenalty, net, repGained, levelUp,
      satStart: Math.round(run.satStart), satEnd: Math.round(S.sat), maxCombo: run.maxCombo, popped: run.popped,
      missedBubbles: run.missed, autoSolved: run.autoSolved, regularsServed: run.regularsServed,
      weather: run.plan.weather.id, event: run.plan.event ? run.plan.event.id : null, estSkipNet: null, estSkipProfit: null, piggy: 0,
      // yeni mekanikler
      fixed, debt: S.debt, debtLimit: debtLimit(S.level), debtDays: S.debtDays, bankrupt,
      thefts: run.thefts, theftUnits: run.theftUnits, theftLoss: Math.round(run.theftLoss), caught: run.caught,
      breakdowns: run.breakdowns.slice(), brokenNow: { fridge: !!S.broken.fridge, register: !!S.broken.register }, regLost: run.regLost,
      crises: run.crisisLog.slice(), crisisSpend: run.crisisSpend, crisisGain: run.crisisGain, crisisLoss: run.crisisLoss,
      bubblesSpawned: run.spawned, bubbleTypes: Object.assign({}, run.spawnedBy), salvos: run.salvos,
      rivalActive: !!run.plan.rival.active, rivalShare: run.plan.rival.share, rivalLost: run.plan.rival.lost, rivalCampaign: run.plan.rival.campaign ? run.plan.rival.campaign.text : null,
      priceTiers: Object.assign({}, S.prices), season: null, cash: Math.round(S.money)
    };

    // Sezon (sonsuz mod)
    if (S.season && S.won && day >= S.season.start) {
      S.season.profit += profit;
      if (day - S.season.start + 1 >= B("seasonLen", 10)) {
        const ok = S.season.profit >= S.season.goal, reward = ok ? Math.round(S.season.goal * B("seasonReward", 0.12)) : 0;
        if (ok) { S.money += reward; S.stats.seasonsWon++; }
        summary.season = { n: S.season.n, ok, goal: S.season.goal, profit: Math.round(S.season.profit), reward };
        S.season = { n: S.season.n + 1, start: day + 1, profit: 0, goal: seasonGoal(S.season.n + 1) };
      }
    }

    // Gece: yeni güne geç
    if (run.plan.event) { S.seenEvents[run.plan.event.id] = true; S.lastEventId = run.plan.event.id; } else S.lastEventId = null;
    S.sat = S.sat + (B("satNightTarget", 65) - S.sat) * B("satNightPull", 0.5);
    S.day++; S.todayStockCost = 0;
    summary.piggy = piggyRescue();

    // Oynanan gün: aynı günün atlanmış hâlini klondan tahmin et
    if (run.mode === "play" && !headless && runSnapshot) {
      const est = simulateFrom(runSnapshot, "skip");
      summary.estSkipNet = est.net; summary.estSkipProfit = est.profit;
      st.playBonus += net - summary.estSkipNet;
    }
    S.lastSummary = summary;
    S.history.push({ day, profit: Math.round(profit), cash: Math.round(S.money), mode: run.mode, rent: fixed.rent, fixed: fixed.utility + fixed.rent + fixed.interest });
    if (S.history.length > 7) S.history.shift();
    S.eveningPending = true; S.dayOpen = false;
    if (!headless) { runSnapshot = null; save(); }
    return summary;
  }

  function skipDay() {
    if (!startDay({ mode: "skip" })) return null;
    const dt = B("skipTickDt", 0.25);
    let guard = 0;
    while (!run.dayEndEmitted && guard++ < 100000) tick(dt);
    return endDay();
  }
  // Akşam raporu görüldü: yeni sabaha geçilir (kayıtta rapor, kullanıcı geçene kadar kalır)
  function ackEvening() {
    S.eveningPending = false;
    if (!S.bankrupt && (S.day - 1) % B("checkpointEvery", 7) === 0) takeCheckpoint();
    save();
  }

  // ---------- HEADLESS KLON ----------
  // policy: "skip" | "perfect" | { hitRate, reactSec, jitter, crisis: "ev"|"ignore"|0..1, decideSec, busy, reserve }
  function runPolicy(mode, policy) {
    if (!startDay({ mode })) return null;
    const dt = B("skipTickDt", 0.25);
    let pol = null;
    if (mode === "play" && policy && policy !== "skip") {
      pol = policy === "perfect" ? { hitRate: 1, reactSec: B("perfectReactSec", 0.6), jitter: 0, crisis: "ev", decideSec: 1.5, busy: true }
        : Object.assign({ jitter: 0.3, crisis: "ev", decideSec: 2, busy: true }, policy);
    }
    const pr = rngFor(STREAM.policy), gap = B("tapGapSec", 0.18);
    const acts = []; let busyUntil = 0;
    const addAct = (t, kind, id) => { let i = acts.length; while (i > 0 && acts[i - 1].t > t) i--; acts.splice(i, 0, { t, kind, id }); };
    let guard = 0;
    while (!run.dayEndEmitted && guard++ < 200000) {
      const next = acts.length ? acts[0].t : Infinity;
      const step = Math.min(dt, Math.max(1e-4, next - run.t));
      const evs = tick(step);
      if (pol) for (const ev of evs) if (ev.type === "bubbleSpawn") {
        const b = ev.bubble;
        if (pr() >= pol.hitRate) { pr(); continue; }
        if (b.type === "crisis" && pol.crisis === "ignore") { pr(); continue; }
        let t = b.spawnT + pol.reactSec * (1 - pol.jitter + 2 * pol.jitter * pr());
        if (pol.busy) t = Math.max(t, busyUntil);
        for (let k = 0; k < b.taps; k++) addAct(t + k * gap, "tap", b.id);
        if (pol.busy) busyUntil = t + b.taps * gap;
        if (b.type === "crisis") { addAct(t + b.taps * gap + pol.decideSec, "crisis"); if (pol.busy) busyUntil = t + b.taps * gap + pol.decideSec * 0.3; }
      }
      while (acts.length && acts[0].t <= run.t + 1e-9) {
        const a = acts.shift();
        if (a.kind === "tap") tapBubble(a.id);
        else if (a.kind === "crisis" && run.crisis) {
          let choice = "ignore";
          if (typeof pol.crisis === "number") { if (pr() < pol.crisis) choice = crisisAdvice(pol.reserve || 0); }
          else choice = crisisAdvice(pol.reserve || 0);
          resolveCrisis(choice, false);
        }
      }
    }
    return endDay();
  }
  function simulateFrom(stateObj, mode, policy, noiseKey) {
    const saved = { S, run, runSnapshot, headless, noise, basePlanCache, effCache, forfeitFlag };
    try {
      S = clone(stateObj); sanitize(S); run = null; headless = true; noise = noiseKey || 0; basePlanCache = null; effCache = null; forfeitFlag = false;
      return runPolicy(mode === "skip" || policy === "skip" ? "skip" : "play", policy);
    } finally { S = saved.S; run = saved.run; runSnapshot = saved.runSnapshot; headless = saved.headless; noise = saved.noise; basePlanCache = saved.basePlanCache; effCache = saved.effCache; forfeitFlag = saved.forfeitFlag; }
  }
  function autoDay(policy) {
    if (run && !run.ended) return null;
    return runPolicy(policy === "skip" ? "skip" : "play", policy);
  }
  // Aktif gün varsa gün başı anlık görüntüsünden, yoksa şimdiki durumdan simüle eder; gerçek durum değişmez.
  // noiseKey ≠ 0: aynı günün değil, benzer bir günün (farklı müşteri/baloncuk tohumu) sonucu → tahmin ekranı için belirsizlik.
  function simulateClone(mode, policy, noiseKey) {
    const base = (run && !run.ended && runSnapshot) ? runSnapshot : S;
    if (policy === undefined) policy = mode === "skip" ? "skip" : "perfect";
    return simulateFrom(base, mode, policy, noiseKey);
  }

  // ---------- KAYIT ----------
  const hasLS = () => { try { return typeof localStorage !== "undefined" && localStorage !== null; } catch (e) { return false; } };
  function save() {
    if (headless || !hasLS() || !S) return false;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); return true; } catch (e) { return false; }
  }
  function takeCheckpoint() {
    if (headless || !S) return;
    const c = clone(S); c.eveningPending = false; c.dayOpen = false;
    checkpointJson = JSON.stringify(c);
    if (hasLS()) try { localStorage.setItem(CHECK_KEY, checkpointJson); } catch (e) { /* yok say */ }
  }
  const hasCheckpoint = () => {
    if (!cfg().checkpoint) return false;
    if (checkpointJson) return true;
    if (hasLS()) try { return !!localStorage.getItem(CHECK_KEY); } catch (e) { /* yok say */ }
    return false;
  };
  function loadCheckpoint() {
    if (!cfg().checkpoint && S && S.bankrupt) return false;
    let raw = checkpointJson;
    if (!raw && hasLS()) try { raw = localStorage.getItem(CHECK_KEY); } catch (e) { raw = null; }
    if (!raw) return false;
    try {
      S = sanitize(JSON.parse(raw)); run = null; runSnapshot = null; basePlanCache = null; effCache = null;
      S.bankrupt = null; S.eveningPending = false; S.dayOpen = false;
      checkpointJson = raw; save();
      return true;
    } catch (e) { return false; }
  }
  function migrateV1(o) {
    const fresh = newGame(o.seed, "normal");
    S = Object.assign(fresh, o);
    S.version = SAVE_VERSION; S.diff = "normal";
    S.batch = {}; S.prices = {}; S.debt = 0; S.debtDays = 0; S.bankrupt = null; S.piggyLeft = (DIFFS().normal || DIFF_FALLBACK).piggy;
    S.equip = { fridge: 100, register: 100 }; S.broken = { fridge: false, register: false };
    S.eveningPending = false; S.dayOpen = false; S.hints = {}; S.season = null;
    S.graceUntil = S.day + 6;   // eski kayıt: ilk günler kira/gider/rakip yumuşak
    if (S.won && !S.season) S.season = { n: 1, start: S.day, profit: 0, goal: seasonGoal(1) };
    return S;
  }
  function load() {
    lastLoadNote = "";
    if (!hasLS()) return false;
    try {
      let raw = localStorage.getItem(SAVE_KEY), migrated = false;
      if (!raw) { raw = localStorage.getItem(OLD_KEY); migrated = !!raw; }
      if (!raw) return false;
      const o = JSON.parse(raw);
      if (!o || typeof o.day !== "number" || !Number.isFinite(o.day)) return false;
      if (migrated) { if (o.version !== 1) return false; migrateV1(o); }
      else {
        if (o.version !== SAVE_VERSION) return false;
        const fresh = newGame(o.seed, o.diff);
        S = Object.assign(fresh, o);
      }
      sanitize(S);
      run = null; runSnapshot = null; basePlanCache = null; effCache = null;
      if (migrated) {
        lastLoadNote = "Eski kaydın yeni sürüme taşındı: artık kira, borç, rakip ve hırsız var (zorluk: Normal). İlk günlerde giderler yumuşak.";
        save();
      } else {
        checkpointJson = null;
        try { checkpointJson = localStorage.getItem(CHECK_KEY); } catch (e) { /* yok say */ }
        if (S.dayOpen) {   // gün ortasında kapatılmış/yenilenmiş: o gün başıboş geçti (save-scum engeli)
          S.dayOpen = false; forfeitFlag = true;
          const sum = skipDay();
          if (sum) lastLoadNote = "Dükkânı açık bırakıp çıkmıştın: gün başıboş geçti (Hızlı Geç gibi, daha çok hırsız). Rapor aşağıda.";
        }
      }
      return true;
    } catch (e) { return false; }
  }
  function clearSave() {
    if (hasLS()) try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem(CHECK_KEY); localStorage.removeItem(OLD_KEY); } catch (e) { /* yok say */ }
    checkpointJson = null;
  }

  // ---------- İPUÇLARI (öğretici) ----------
  function pendingHint() {
    const bp = basePlan();
    for (const h of HINT_DEFS()) {
      if (S.hints[h.id] || S.day < (h.minDay || 1)) continue;
      let ok = false;
      switch (h.when) {
        case "day": case "salvo": ok = true; break;
        case "rivalSoon": ok = !!RIV() && bp.rival.open - S.day <= 2 && bp.rival.open - S.day >= -1; break;
        case "rentSoon": { const d = nextRentDay(S.day) - S.day; ok = d <= 3 && S.day >= rentFirstDay() - 3; break; }
        case "debt": ok = S.debt > 0; break;
        case "fridge": ok = upgradeLevel("buzdolabi") > 0; break;
        default: ok = false;
      }
      if (ok) return h;
    }
    return null;
  }
  function dismissHint(id) { if (S) S.hints[id] = true; save(); }

  // ---------- YARDIMCILAR (UI için) ----------
  function levelInfo() {
    const L = LVLS(), cur = L.find(x => x.level === S.level) || L[0], next = L.find(x => x.level === S.level + 1) || null;
    const progress = next ? clamp((S.rep - cur.rep) / Math.max(1, next.rep - cur.rep), 0, 1) : 1;
    return { level: S.level, title: cur.title, rep: S.rep, cur: cur.rep, next: next ? next.rep : null, nextTitle: next ? next.title : null, progress };
  }
  function priceInfo(id, plan) {
    plan = plan || planDay();
    const p = product(id); if (!p) return null;
    const rp = rivalPrice(id, plan), t = tierOf(id);
    const opts = tiers().map((m, i) => ({ tier: i, price: priceAt(id, i), factor: +priceFactor(id, plan, i).toFixed(2) }));
    return { tier: t, price: priceOf(id), base: p.price, rival: rp, heat: (plan.heat && plan.heat[id]) || 1, factor: opts[t].factor, options: opts,
      names: B("priceTierNames", ["Ucuz", "Normal", "Pahalı"]), campaign: !!(plan.rival && plan.rival.campaign && (plan.rival.campaign.cat === "all" || plan.rival.campaign.cat === p.cat)) };
  }
  function setDifficultyInfo() { return DIFF_ORDER_LIST().map(id => DIFFS()[id]).filter(Boolean); }
  const DIFF_ORDER_LIST = () => (typeof DIFF_ORDER !== "undefined" ? DIFF_ORDER : Object.keys(DIFFS()));

  newGame(1);

  return {
    get state() { return S; },
    set state(v) { S = sanitize(v); run = null; runSnapshot = null; basePlanCache = null; effCache = null; },
    get run() { return run; },
    get loadNote() { return lastLoadNote; },
    newGame, save, load, clearSave, effects, shelfCap, planDay,
    buyStock, fillAll, fillProduct: id => fillAll(1, id), expectedSales, stockTargets, unlockProduct, canUnlock, buyUpgrade, upgradeAvailable, canAfford, upgradeLevel, nextUpgradeCost,
    unitCost: id => unitCostExact(id), lineCost: (id, n) => lineCost(id, n, basePlan()), product, levelInfo, piggyRescue,
    startDay, tick, tapBubble, endDay, skipDay, abandonDay, ackEvening, simulateClone, autoDay,
    // fiyat / rakip
    setPrice, priceOf, priceAt, priceInfo, rivalPrice: (id, plan) => rivalPrice(id, plan || planDay()), tierOf,
    // yuva / raf ömrü
    totalSlots, slotsUsed, slotsFree, slotsOf, stockAging, lifeOf: id => lifeOf(product(id)), isFresh: id => isFresh(product(id)),
    // giderler / borç / ekipman
    finance, repayDebt, debtLimit, rentAmount, utilityCost, equipInfo, service, serviceCost,
    // kriz
    crisisView, resolveCrisis, crisisAdvice,
    // kayıt kontrol
    hasCheckpoint, loadCheckpoint, takeCheckpoint, sanitize,
    // sezon / ipuçları / zorluk
    seasonInfo, pendingHint, dismissHint, difficulties: setDifficultyInfo, get difficulty() { return cfg(); },
    _rng: { mulberry32, hash }
  };
})();

if (typeof module !== "undefined") module.exports = { Game };
