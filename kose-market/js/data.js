// data.js — Köşe Market'in tüm içeriği ve denge sayıları (DOM yok, Node'da da çalışır)
// Denge sayıları tools/sim.js ile ayarlandı (rapor: tools/BALANCE_REPORT.md). Şema: CONTRACT.md
// Motorda "sihirli sayı" yok: engine.js her anahtarı B(k, d) ile okur ve d burada yazılanla aynıdır.

// =====================================================================
// DENGE SAYILARI
// =====================================================================
const BALANCE = {
  // --- Gün ---
  dayLength: 75,              // sn (1x hızda bir iş günü)
  skipTickDt: 0.25,           // "Hızlı Geç" headless simülasyonda tick adımı (sn)
  closingQuietSec: 3,         // son N sn yeni müşteri/baloncuk doğmaz

  // --- Para ---
  startMoney: 40,             // yeni oyunda cepteki para (₺) — zorluk seviyesi ezer
  startStock: { elma: 4, ekmek: 4 },
  piggyBank: 25,              // "Pamuk'un kumbarası": para < en ucuz ürün ve stok yok → +₺ (günde 1, oyun boyu sınırlı: DIFFICULTIES.piggy)
  emergencyCostMult: 1.7,     // "📦 bitti" baloncuğuna basınca acil tedarik alış çarpanı
  emergencyQty: 3,            // acil tedarikte en fazla kaç adet gelir
  fillZ: 2,                 // "Dengeli Doldur": hedef stok = beklenen talep + z·√talep (rastgele dalgalanmaya pay)

  // --- Raf yuvası (toplam depo) ---
  totalSlotsBase: 44,         // dükkânın toplam raf yuvası (ürünler `slots` yuva kaplar; Ek Raf/Depo artırır)

  // --- Müşteri ---
  baseCustomers: 16,
  customerGrowthPerDay: 0.12,
  customerGrowthPerLevel: 1.1,
  customersMax: 90,
  minCustomers: 4,
  customerJitter: 0.1,
  itemsPerCustomer: 1,
  extraItemChance: 0.3,
  maxItemsPerCustomer: 3,
  customerSpawnJitter: 0.35,
  browseSec: 2.5,
  customerStartSec: 1,
  customerLeaveSec: 1.2,
  regLostCustomerShare: 0.3,  // kasa bozukken gelen müşterinin eli boş dönme ihtimali
  trafficMax: 0.45,           // ürün çeşitliliğinin (rafta duran açık ürünler) müşteri artışı tavanı

  // --- Fiyat ayarı ve esnek talep ---
  priceTiers: [0.85, 1, 1.2], // Ucuz / Normal / Pahalı çarpanları
  priceTierNames: ["Ucuz", "Normal", "Pahalı"],
  priceStoreGamma: 1.0,       // 1 = her ürünün talebi kendi fiyatına bağımsız tepki verir (üs)
  priceStoreMin: 0.4,
  priceStoreMax: 1.5,
  heatHot: 1.3,               // talep/standart oranı bu kadarsa ürün "aranıyor" → müşteri fiyata daha az duyarlı
  heatCold: 0.6,              // bu kadarsa "ilgi yok" → daha duyarlı
  heatHotMult: 0.55,
  heatColdMult: 1.35,
  rivalCompare: 0.9,          // rakip varken fiyat duyarlılığı bu kadar artar (karşılaştırma yapılır)
  demandFloor: 0.05,

  // --- Memnuniyet (sat, 0..100) ---
  satStart: 70,
  satFloor: 15,
  satMax: 100,
  satPerSale: 0.4,
  satPerMiss: -1.5,
  satNightTarget: 65,
  satNightPull: 0.5,
  satMid: 60,
  satCustomerSwing: 0.22,     // sat 100'de +%22, sat 20'de -%22 müşteri
  rivalLoyaltyHi: 1.5,        // rakip payı çarpanı = clamp(1.5 - sat/100, 0.5, 1.5): memnun müşteri rakibe gitmez
  rivalLoyaltyLo: 0.5,

  // --- Kombo ---
  comboWindow: 2.5,
  comboStep: 0.25,
  comboMax: 2.0,
  comboResetOnMiss: true,

  // --- İtibar (rep XP) ---
  repPerSale: 1,
  repPerSatPoint: 0.1,
  repPerGoal: 8,
  repPerRegular: 3,
  repPerBubble: 0.2,
  repPerCatch: 1.5,           // hırsız yakalayınca

  // --- Baloncuklar ---
  bubbleStartSec: 2,
  bubbleRateBase: 0.11,       // sn başına sabit baloncuk doğma hızı
  bubbleRatePerLevel: 0.012,
  bubbleRatePerDay: 0.0015,
  bubbleRateMax: 0.27,
  bubbleMaxOnScreen: 7,
  bubbleMinGapSec: 0.6,
  bubbleDeferSec: 0.5,
  bubbleRewardPerLevel: 0.03,
  bubblePenaltyPerLevel: 0.07, // para cezaları 1 + (level-1)*0.07 ile büyür
  bubbleLifeMinSec: 2.0,
  bubbleLifePerLevel: -0.012, // seviye başına baloncuk ömrü çarpanı değişimi (en çok -%20)
  bubbleLifeFloorMult: 0.8,
  bubbleRewardMult: 1.0,
  lostSalesSecDefault: 10,
  lostCustomersMult: 1,
  restockMaxPerProduct: 3,
  zoneSlots: { shelf: 6, floor: 4, register: 2, door: 2, fridge: 1, window: 2, cat: 1 },

  // --- Salvo (yoğun saat: art arda doğan baloncuk grupları) ---
  salvoStartDay: 6,
  salvoBase: 0.5,             // günlük beklenen salvo sayısı = base + perDay*gün (tavan max)
  salvoPerDay: 0.03,
  salvoMax: 2.6,
  salvoMinSize: 2,
  salvoMaxSize: 4,
  salvoSpacingSec: 0.28,

  // --- Hırsızlık ---
  theftStartDay: 5,
  theftBase: 0.6,            // günlük beklenen hırsız sayısı = base + perDay*gün (tavan max)
  theftPerDay: 0.015,
  theftMax: 1.6,
  theftSkipMult: 1.8,         // başıboş dükkân (Hızlı Geç): hırsız sayısı ×1,8
  theftQtyBase: 3,            // çalınan adet = base + seviye/levelDiv
  theftLevelDiv: 4,
  thiefLife: 3.2,

  // --- Ekipman (dolap / kasa) ---
  equipWearFridge: 12,        // günlük yıpranma (durum puanı)
  equipWearRegister: 8,
  equipWearJitter: 0.4,
  equipBreakFrom: 65,         // durum bunun altına inince arıza riski başlar
  equipBreakMaxChance: 0.55,  // durum 0'da günlük arıza ihtimali
  equipQuickFixCond: 45,      // baloncuğa basınca durum en az bu olur (arıza önlenir)
  equipServiceFridge: 90,     // bakım/tamir taban ücreti (₺) — seviye ile artar
  equipServiceRegister: 60,
  equipServiceLevelStep: 0.07,
  equipMaintainFrac: 0.55,    // arızasızken bakım ücreti = tamirin bu kadarı
  equipMinMaintainCond: 90,   // durum bundan yüksekse bakım gerekmez

  // --- Raf ömrü ---
  fridgeLifeMult: 2.5,        // buzdolabı taze ürünlerin ömrünü çarpar
  noFridgeMult: 0.7,          // soğuk ürünlerin (süt, peynir, dondurma, pasta, çiçek) talebi dolap yoksa/bozuksa bu kadar
  freshLifeMax: 12,           // shelfLife bu değerin altındaysa "taze" sayılır (UI etiketi)

  // --- Giderler / borç / iflas ---
  utilityStartDay: 3,         // günlük sabit gider başlangıcı
  utilityBase: 6,             // günlük elektrik/su (₺); yükseltmelerin `upkeep`i eklenir (maaş, elektrik, bakım)
  rentFirstDay: 14,           // ilk kira günü (Pazar akşamı); sonra her 7 günde
  rentBase: 130,              // haftalık kira (Sv.1)
  rentPerLevel: 140,           // her seviye +₺
  rentWeekday: 7,             // gün % 7 === 0 → Pazar akşamı
  debtInterest: 0.03,         // günlük borç faizi (zorluk çarpanı ile)
  debtRepayFrac: 0.4,         // pozitif günlük kârın bu kadarı otomatik borca gider
  debtLimitBase: 150,         // iflas sınırı = base + perLevel*(sv-1) (zorluk çarpanı ile)
  debtLimitPerLevel: 90,
  debtMaxDays: 14,            // kesintisiz bu kadar gün borçluysa iflas
  checkpointEvery: 7,         // "Son Kayıttan Devam" noktası: her Pazartesi sabahı

  // --- Bahşiş & sakinler ---
  tipChance: 0.08,
  tipMin: 1, tipMax: 4,
  regularsPerDayMax: 2,
  regularChance: 0.6,
  regularQty: 1,
  regularTip: 3,
  regularColor: "#ffd6e0",
  regularNoStockTipMult: 0.5,
  regularSat: 2,
  regularMissSat: 0,
  regularLife: 6,
  regularReward: 3,

  // --- Günün hedefi ---
  goalScalePerDay: 0.025,
  eventChance: 0.55,
  eventStartDay: 2,

  // --- Kriz kartları ---
  crisisStartDay: 4,
  crisisBase: 0.45,           // günlük beklenen kriz sayısı = base + perDay*gün (tavan max)
  crisisPerDay: 0.012,
  crisisMax: 1.6,
  crisisBubbleLife: 6.5,
  crisisDecideSec: 9,         // kart açıldıktan sonra karar süresi (dolunca "görmezden gel")
  crisisMinGapSec: 16,
  crisisMoneyPerLevel: 0.1,   // kriz ₺ tutarları 1 + (sv-1)*0.1 ile büyür
  crisisSatValue: 2.5,        // bot hesabı: 1 memnuniyet puanı ≈ ₺
  crisisCustomerValue: 14,    // bot hesabı: 1 müşteri ≈ ₺

  // --- Sonsuz mod (final sonrası) ---
  seasonLen: 10,              // gün
  seasonGoalBase: 4200,       // 1. sezon kâr hedefi (₺, operasyonel kâr toplamı)
  seasonGoalGrowth: 1.15,
  seasonReward: 0.12,         // hedefin %12'si ödül
  seasonRivalStep: 0.04,      // her sezon rakip payı +
  seasonRentStep: 0.12,       // her sezon kira +%

  // --- Çırak otomatiği ---
  autoSolveMax: 0.9,
  perfectReactSec: 0.6,
  tapGapSec: 0.18
};

// =====================================================================
// ZORLUK SEVİYELERİ — sadece gelir çarpanı değil, mekaniklerin yoğunluğu da değişir.
//  rent: kira + günlük gider · rival: rakip baskısı · rivalOpen: rakibin açılış günü kayması
//  life: raf ömrü çarpanı · crisis/theft/breakdown: sıklık · bubbleLife: baloncuk ömrü · penalty: kaçırma cezası
//  priceSens: fiyat duyarlılığı · debtLimit: iflas sınırı · interest: faiz · customers: müşteri çarpanı
//  piggy: Pamuk kumbarası hakkı (oyun boyu) · checkpoint: iflasta "Son Kayıttan Devam" var mı · rentFirstShift: ilk kira gününü kaydırır
// =====================================================================
const DIFFICULTIES = {
  kolay:  { id: "kolay", name: "Kolay", emoji: "🌱", tag: "Rahat başlangıç",
    desc: "Ucuz kira, geç gelen ve yumuşak bir rakip, uzun ömürlü baloncuklar, bol kumbara. Hikâyeyi keyifle gör.",
    startMoney: 80, rentFirstShift: 7, rent: 0.65, rivalAggro: 0.6, rivalOpen: 5, life: 1.3, crisis: 0.6, theft: 0.6, breakdown: 0.6,
    bubbleLife: 1.3, penalty: 0.7, priceSens: 0.85, debtLimit: 1.7, interest: 0.5, customers: 1.06, piggy: 5, checkpoint: true, utility: 0.6 },
  normal: { id: "normal", name: "Normal", emoji: "🛒", tag: "Dikkatli oyuncuya adil",
    desc: "Kira ve borç gerçek, rakip 12. günde açılır, hırsız ve kriz var. Dikkatli oynarsan kazanırsın; ihmal edersen batarsın.",
    startMoney: 40, rentFirstShift: 0, rent: 1, rivalAggro: 1, rivalOpen: 0, life: 1, crisis: 1, theft: 1, breakdown: 1,
    bubbleLife: 1, penalty: 1, priceSens: 1, debtLimit: 1, interest: 1, customers: 1, piggy: 3, checkpoint: true, utility: 1 },
  zor:    { id: "zor", name: "Zor", emoji: "🔥", tag: "Her karar önemli",
    desc: "Ağır kira, erken ve saldırgan rakip, sık hırsız/arıza, kısa baloncuklar, tek kumbara. Hata affetmez.",
    startMoney: 40, rentFirstShift: -7, rent: 1.3, rivalAggro: 1.4, rivalOpen: -3, life: 0.8, crisis: 1.35, theft: 1.35, breakdown: 1.35,
    bubbleLife: 0.85, penalty: 1.3, priceSens: 1.15, debtLimit: 0.75, interest: 1.4, customers: 0.97, piggy: 1, checkpoint: true, utility: 1.25 },
  efsane: { id: "efsane", name: "Mahalle Efsanesi", emoji: "👑", tag: "Tek can",
    desc: "Çok ağır kira, 7. günde rakip, kısacık baloncuklar, kumbara yok, iflasta 'Son Kayıttan Devam' yok. Sadece efsaneler.",
    startMoney: 30, rentFirstShift: -7, rent: 1.6, rivalAggro: 1.8, rivalOpen: -5, life: 0.65, crisis: 1.7, theft: 1.7, breakdown: 1.7,
    bubbleLife: 0.72, penalty: 1.6, priceSens: 1.3, debtLimit: 0.55, interest: 1.8, customers: 0.94, piggy: 0, checkpoint: false, utility: 1.5 }
};
const DIFF_ORDER = ["kolay", "normal", "zor", "efsane"];

// =====================================================================
// RAKİP: ZİNCİR MARKET (kalıcı, gün 12'de açılır) — fiyatı karşılaştırılır, müşteri çeker
// =====================================================================
const RIVAL = {
  name: "Zincir Market", emoji: "🏬",
  openDay: 12,
  baseShare: 0.12,            // açıldığında müşterilerin bu kadarı rakibe gider
  shareGrowthPerDay: 0.004,   // her gün +
  shareMax: 0.30,
  catMult: { temel: 0.93, atistirmalik: 0.96, icecek: 0.95, sarkuteri: 0.99 },   // rakibin fiyatı = bizim standart fiyat × bu (özel ürünleri satmaz)
  campaignChance: 0.16,       // günlük kampanya ihtimali (× zorluk rival)
  campaignMult: 0.85,         // kampanyalı kategoride rakip fiyatı çarpanı
  campaignShareBonus: 0.04,
  campaignCats: ["temel", "atistirmalik", "icecek", "sarkuteri"],
  catNames: { temel: "temel gıda", atistirmalik: "atıştırmalık", icecek: "içecek", sarkuteri: "şarküteri" }
};

// =====================================================================
// ÜRÜNLER
// cat: "temel" | "atistirmalik" | "icecek" | "sarkuteri" | "ozel"
// el: fiyat esnekliği (düşük = zorunlu ihtiyaç, zamma dayanır; yüksek = dürtü alışverişi, indirimde çok artar)
// shelfLife: kaç gece dayanır (1 = ilk gece biter); buzdolabı taze ürünlerin ömrünü uzatır
// cold: soğuk ürün (buzdolabı şart) · slots: kapladığı raf yuvası · traffic: rafta bulunursa müşteri sayısına katkı (çeşitlilik çeker)
// =====================================================================
const PRODUCTS = [
  { id: "elma",     name: "Elma",           emoji: "🍎", cat: "temel",        cost: 2,  price: 5,  demand: 1.2,  el: 1.5, shelfLife: 5,  slots: 1, traffic: 0,    unlockLevel: 1, unlockCost: 0,    desc: "Kıpkırmızı, mis kokulu." },
  { id: "ekmek",    name: "Ekmek",          emoji: "🥖", cat: "temel",        cost: 3,  price: 6,  demand: 1.4,  el: 1.25, shelfLife: 2,  slots: 1, traffic: 0,    unlockLevel: 1, unlockCost: 0,    desc: "Fırından sıcacık geldi." },
  { id: "simit",    name: "Simit",          emoji: "🥯", cat: "atistirmalik", cost: 2,  price: 5,  demand: 1.1,  el: 2.2, shelfLife: 1,  slots: 1, traffic: 0.035, unlockLevel: 1, unlockCost: 60,   desc: "Susamlı, çıtır çıtır. Bir geceyi çıkarmaz!" },
  { id: "sut",      name: "Süt",            emoji: "🥛", cat: "temel",        cost: 4,  price: 9,  demand: 1.0,  el: 1.2, shelfLife: 2,  slots: 1, cold: true, traffic: 0.04, unlockLevel: 2, unlockCost: 120,  desc: "Tam yağlı, cam şişede." },
  { id: "meyvesuyu",name: "Meyve Suyu",     emoji: "🧃", cat: "icecek",       cost: 5,  price: 11, demand: 0.9,  el: 2.35, shelfLife: 40, slots: 1, traffic: 0.03, unlockLevel: 2, unlockCost: 150,  desc: "Vişneli, pipetli." },
  { id: "cikolata", name: "Çikolata",       emoji: "🍫", cat: "atistirmalik", cost: 6,  price: 13, demand: 0.9,  el: 2.25, shelfLife: 60, slots: 1, traffic: 0.04, unlockLevel: 3, unlockCost: 220,  desc: "Fındıklı, bir kare daha…" },
  { id: "dondurma", name: "Dondurma",       emoji: "🍦", cat: "atistirmalik", cost: 6,  price: 14, demand: 0.6,  el: 2.2, shelfLife: 2,  slots: 1, cold: true, traffic: 0.02, unlockLevel: 3, unlockCost: 260,  desc: "Sıcakta kapış kapış!" },
  { id: "peynir",   name: "Beyaz Peynir",   emoji: "🧀", cat: "sarkuteri",    cost: 10, price: 21, demand: 0.8,  el: 1.25, shelfLife: 3,  slots: 1, cold: true, traffic: 0.03, unlockLevel: 4, unlockCost: 350,  desc: "Kahvaltının yıldızı." },
  { id: "semsiye",  name: "Şemsiye",        emoji: "☂️", cat: "ozel",         cost: 16, price: 36, demand: 0.15, el: 1.15, shelfLife: 999,slots: 2, traffic: 0,    unlockLevel: 4, unlockCost: 300,  desc: "Yağmurda altın değerinde. 2 yuva kaplar." },
  { id: "kahve",    name: "Kahve",          emoji: "☕", cat: "icecek",       cost: 9,  price: 20, demand: 0.8,  el: 1.6, shelfLife: 60, slots: 1, traffic: 0.04, unlockLevel: 5, unlockCost: 450,  desc: "Taze çekilmiş, köpüklü." },
  { id: "salep",    name: "Sıcak Salep",    emoji: "🍵", cat: "icecek",       cost: 6,  price: 15, demand: 0.35, el: 1.1, shelfLife: 30, slots: 1, traffic: 0.01, unlockLevel: 5, unlockCost: 380,  desc: "Tarçınlı; soğukta içini ısıtır." },
  { id: "sucuk",    name: "Sucuk",          emoji: "🌭", cat: "sarkuteri",    cost: 14, price: 29, demand: 0.7,  el: 1.7, shelfLife: 25, slots: 1, traffic: 0.03, unlockLevel: 6, unlockCost: 600,  desc: "Pazar kahvaltısına şart." },
  { id: "pasta",    name: "Pasta",          emoji: "🎂", cat: "ozel",         cost: 24, price: 50, demand: 0.45, el: 1.7, shelfLife: 1,  slots: 2, cold: true, traffic: 0.03, unlockLevel: 7, unlockCost: 900,  desc: "Çilekli, mumu bizden. 2 yuva kaplar, çabuk bayatlar." },
  { id: "cicek",    name: "Çiçek Buketi",   emoji: "💐", cat: "ozel",         cost: 22, price: 48, demand: 0.4,  el: 1.6, shelfLife: 2,  slots: 2, cold: true, traffic: 0.03, unlockLevel: 8, unlockCost: 1100, desc: "Mahallenin gönlünü çalar. 2 yuva kaplar." }
];

// =====================================================================
// YÜKSELTMELER — her seviyenin kendi (artımlı) efekti; motor alınan tüm seviyeleri toplar/çarpar.
//  toplanan: customers, slots, bubbleLife, tipChance, autoSolve, satFloor, extraItemChance, upkeep (günlük gider ₺),
//            lifeBonus (taze ürün ömrü +gece), rivalGuard, thiefAuto, weatherShield
//  çarpan:   costMult, bubbleReward, satGain, theftMult, wearMult, regWear, rentMult, bubbleWeightMult.x
//  mantıksal: fridge, final
//            comboWindow (kombo penceresi +sn)
//  Ek: levels[i].minLevel · req: başka yükseltmenin alınmış olması · scene: sahnede görünen öğe
//  Her yükseltmenin hem faydası hem günlük gideri (upkeep) / riski vardır.
// =====================================================================
const UPGRADES = [
  // ---------- DÜKKÂN ----------
  { id: "raf", name: "Ek Raf", emoji: "🧺", cat: "dukkan", unlockLevel: 1, scene: "raf",
    desc: "Toplam raf yuvası artar: daha çok çeşit/stok, daha az 'bitti!'. Fazla stok bozulur ve nakit bağlar.",
    levels: [
      { cost: 180,  effect: { slots: 12 }, desc: "+12 yuva" },
      { cost: 450,  effect: { slots: 18 }, desc: "+18 yuva", minLevel: 3 },
      { cost: 900,  effect: { slots: 26 }, desc: "+26 yuva", minLevel: 5 },
      { cost: 1600, effect: { slots: 36 }, desc: "+36 yuva", minLevel: 7 }
    ] },
  { id: "tabela", name: "Tabela & Reklam", emoji: "📣", cat: "dukkan", unlockLevel: 1, scene: "tabela",
    desc: "Mahalle seni duysun! Her gün daha çok müşteri (rafın yetişmesi lazım).",
    levels: [
      { cost: 150,  effect: { customers: 2 }, desc: "El yazısı tabela: +2 müşteri" },
      { cost: 400,  effect: { customers: 3 }, desc: "Kapıya balon: +3 müşteri", minLevel: 3 },
      { cost: 1000, effect: { customers: 3 }, desc: "Mahalle grubuna ilan: +3 müşteri", minLevel: 5 },
      { cost: 2200, effect: { customers: 4, upkeep: 4 }, desc: "Işıklı neon tabela: +4 müşteri, günlük −₺4 elektrik", minLevel: 7 }
    ] },
  { id: "yazarkasa", name: "Yazar Kasa", emoji: "🧾", cat: "dukkan", unlockLevel: 2, scene: "yazarkasa",
    desc: "Kasa daha az bozulur, bozuk para ve kuyruk derdi azalır.",
    levels: [
      { cost: 300, effect: { bubbleWeightMult: { change: 0.5, queue: 0.8 }, regWear: 0.6, extraItemChance: 0.05 }, desc: "Barkod okuyucu: sepete +ürün, bozuk para yarıya iner, kasa %40 az yıpranır" },
      { cost: 900, effect: { bubbleWeightMult: { change: 0.6, queue: 0.6 }, customers: 1, extraItemChance: 0.03, upkeep: 3 }, desc: "Temassız ödeme: kuyruk azalır, +1 müşteri, sepet büyür · günlük −₺3", minLevel: 5 }
    ] },
  { id: "paspas", name: "Paspas → Robot Süpürge", emoji: "🧹", cat: "dukkan", unlockLevel: 2, scene: "paspas",
    desc: "Yerler daha az kirlenir: kaygan zemin tazminatı ve 'leke' baloncukları azalır.",
    levels: [
      { cost: 180, effect: { bubbleWeightMult: { clean: 0.6, stain: 0.7 } }, desc: "Kapıya paspas: çamur ve leke azalır" },
      { cost: 700, effect: { bubbleWeightMult: { clean: 0.5, stain: 0.6 }, upkeep: 2 }, desc: "Robot süpürge 'Vınvın' (günlük −₺2 şarj)", minLevel: 6 }
    ] },
  { id: "buzdolabi", name: "Buzdolabı", emoji: "🧊", cat: "dukkan", unlockLevel: 3, scene: "buzdolabi",
    desc: "Soğuk ürünler (süt, peynir, dondurma, pasta, çiçek) dolap olmadan %30 az satar; taze ürünlerin ömrü 2,5 kat uzar. Ama elektrik yer, yıpranır, bozulabilir.",
    levels: [ { cost: 650, effect: { fridge: true, upkeep: 6 }, desc: "Soğuk ürün talebi korunur, taze ömrü ×2,5 · günlük −₺6 elektrik · bakım ister" } ] },
  { id: "toptanci", name: "Toptancı Anlaşması", emoji: "🤝", cat: "dukkan", unlockLevel: 3, scene: null,
    desc: "Hasan Abi'yle el sıkıştın: alış fiyatları düşer, ama üyelik aidatı var.",
    levels: [
      { cost: 500,  effect: { costMult: 0.92, upkeep: 4 }, desc: "Alışta %8 indirim · günlük −₺4 aidat" },
      { cost: 1400, effect: { costMult: 0.92, upkeep: 4 }, desc: "Alışta toplam ~%15 indirim · günlük −₺8", minLevel: 6 }
    ] },
  { id: "vitrin", name: "Işıklı Vitrin", emoji: "🪟", cat: "dukkan", unlockLevel: 5, scene: "vitrin",
    desc: "Göz alıcı vitrin: yoldan geçen içeri girer, sepetler dolar. Elektrik yer.",
    levels: [
      { cost: 1200, effect: { customers: 2, extraItemChance: 0.08, upkeep: 7 }, desc: "+2 müşteri, sepete ekstra ürün · günlük −₺7" },
      { cost: 2800, effect: { customers: 2, extraItemChance: 0.06, upkeep: 5 }, desc: "Mevsimlik süsleme · günlük −₺12 toplam", minLevel: 8 }
    ] },
  { id: "guvenlik", name: "Kamera & Alarm", emoji: "📹", cat: "dukkan", unlockLevel: 2, scene: "guvenlik",
    desc: "Hırsız gelme sıklığı azalır; kaçırılan hırsızı bazen kamera yakalar. Hızlı Geç günlerinde asıl koruma budur.",
    levels: [
      { cost: 350, effect: { theftMult: 0.6, thiefAuto: 0.15, upkeep: 3 }, desc: "Kamera: hırsız −%40, kaçanı %15 yakalar · günlük −₺3" },
      { cost: 900, effect: { theftMult: 0.55, thiefAuto: 0.2, upkeep: 4 }, desc: "Alarm: hırsız toplam −%67, %35 yakalar · günlük −₺7", minLevel: 5 }
    ] },
  { id: "sadakat", name: "Sadakat Kartı", emoji: "💳", cat: "dukkan", unlockLevel: 4, scene: null,
    desc: "Mahalleli kartını cebinden çıkarmadan rakibe gitmez: Zincir Market'in müşteri çekmesi azalır.",
    levels: [
      { cost: 450,  effect: { rivalGuard: 0.18, upkeep: 2 }, desc: "Rakibe giden müşteri −%18 · günlük −₺2 basım" },
      { cost: 1100, effect: { rivalGuard: 0.17, upkeep: 4 }, desc: "Puan toplama: rakip etkisi toplam −%35 · günlük −₺6", minLevel: 7 }
    ] },
  { id: "depo", name: "Soğuk Hava Deposu", emoji: "🏭", cat: "dukkan", unlockLevel: 9, scene: null, req: "buzdolabi",
    desc: "Arkadaki depoyu soğutucuya çevir: devasa raf alanı ve taze ürünlere +1 gece ömür. Pahalı işletilir.",
    levels: [ { cost: 3200, effect: { slots: 44, lifeBonus: 1, upkeep: 14 }, desc: "+44 yuva, taze ürün +1 gece · günlük −₺14" } ] },

  // ---------- PERSONEL ----------
  { id: "cirak", name: "Çırak Ali", emoji: "🧑‍🍳", cat: "personel", unlockLevel: 3, scene: "cirak",
    desc: "Sen yetişemezsen o yetişir: kaçan baloncukların cezasını bazen önler, ekipman bakımını yapar. Maaşı var!",
    levels: [
      { cost: 500,  effect: { autoSolve: 0.15, wearMult: 0.8, upkeep: 7 }, desc: "%15 ihtimalle cezayı önler, aşınma −%20 · maaş −₺7/gün" },
      { cost: 1100, effect: { autoSolve: 0.15, wearMult: 0.8, upkeep: 6 }, desc: "%30 · aşınma −%36 · maaş toplam −₺13/gün", minLevel: 6 },
      { cost: 2000, effect: { autoSolve: 0.15, wearMult: 0.8, upkeep: 6 }, desc: "%45 · aşınma −%49 · maaş toplam −₺19/gün", minLevel: 8 }
    ] },
  { id: "onluk", name: "Tezgâhtar Önlüğü", emoji: "🎽", cat: "personel", unlockLevel: 2, scene: "onluk",
    desc: "Rozetli önlük giyince eller daha çevik: baloncuk ve hırsız yakalama ödülleri artar. Yalnız oynayanlara yarar.",
    levels: [
      { cost: 300,  effect: { bubbleReward: 1.15 }, desc: "Baloncuk ödülü +%15" },
      { cost: 1000, effect: { bubbleReward: 1.15 }, desc: "Toplam +%32", minLevel: 5 },
      { cost: 2000, effect: { bubbleReward: 1.15 }, desc: "Toplam +%52", minLevel: 8 }
    ] },

  // ---------- DEKOR ----------
  { id: "kediyatagi", name: "Pamuk'un Yatağı", emoji: "🛏️", cat: "dekor", unlockLevel: 1, scene: "kediyatagi",
    desc: "Pamuk iyi uyuyunca nöbette gözü açık olur: hırsız azalır, kutu devirme azalır, Pamuk daha çok mırıldanır.",
    levels: [ { cost: 120, effect: { theftMult: 0.85, satFloor: 3, bubbleWeightMult: { catbox: 0.6, pet: 1.3 } }, desc: "Hırsız −%15, kutu devirme azalır" } ] },
  { id: "bitkiler", name: "Saksı Bitkileri", emoji: "🪴", cat: "dekor", unlockLevel: 2, scene: "bitkiler",
    desc: "Çiçekli giriş mahalleliyi mutlu eder: memnuniyet kolay artar, rakibe giden müşteri azalır. Sulamak masraf.",
    levels: [
      { cost: 200, effect: { satGain: 1.15, satFloor: 3, rivalGuard: 0.05, upkeep: 1 }, desc: "Fesleğen: rakip etkisi −%5 · günlük −₺1" },
      { cost: 650, effect: { satGain: 1.1, satFloor: 4, rivalGuard: 0.05, upkeep: 1 }, desc: "Monstera: rakip −%10 toplam · günlük −₺2", minLevel: 5 }
    ] },
  { id: "lamba", name: "Sarı Işıklı Lamba", emoji: "💡", cat: "dekor", unlockLevel: 3, scene: "lamba",
    desc: "Sıcacık ışık: müşteriler oyalanır, bahşiş bırakır, cam buğulanmaz. Elektrik yer.",
    levels: [ { cost: 400, effect: { tipChance: 0.05, customers: 1, upkeep: 3, bubbleWeightMult: { fog: 0.7 } }, desc: "+1 müşteri, bahşiş şansı · günlük −₺3" } ] },
  { id: "muzik", name: "Müzik Kutusu", emoji: "🎵", cat: "dekor", unlockLevel: 4, scene: "muzik",
    desc: "Hafif bir melodi: baloncuklar daha sabırlı, art arda dokunmak kolaylaşır (kombo). Salvoda yetişemeyenlerin kurtarıcısı.",
    levels: [
      { cost: 450,  effect: { bubbleLife: 0.5, comboWindow: 0.6, satGain: 1.05, upkeep: 2 }, desc: "Baloncuk ömrü +0,5 sn, kombo penceresi +0,6 sn · günlük −₺2" },
      { cost: 1100, effect: { bubbleLife: 0.5, comboWindow: 0.6, satGain: 1.05, upkeep: 1 }, desc: "Pikap! Toplam +1 sn ömür, +1,2 sn kombo · günlük −₺3", minLevel: 7 }
    ] },
  { id: "tente", name: "Yeni Tente", emoji: "⛱️", cat: "dekor", unlockLevel: 4, scene: "tente",
    desc: "Kırmızı-krem tente: yağmurda ve karda müşteri kaybı yarıya iner, tavan damlatmaz.",
    levels: [ { cost: 700, effect: { customers: 2, weatherShield: 0.5, bubbleWeightMult: { leak: 0.4 } }, desc: "+2 müşteri, kötü havada müşteri kaybı yarıya" } ] },

  // ---------- FİNAL ----------
  { id: "buyukacilis", name: "Büyük Açılış — Dükkânı Genişlet", emoji: "🎉", cat: "final", unlockLevel: 10, scene: "buyukacilis",
    desc: "Yan dükkânı da kirala, duvarı yık, kurdeleyi kes! Köşe Market mahallenin yıldızı olur. Kira ve giderler büyür.",
    levels: [ { cost: 5000, effect: { final: true, slots: 40, customers: 10, rentMult: 1.3, upkeep: 12 }, desc: "+40 yuva, +10 müşteri · kira ×1,3 · günlük −₺12" } ] }
];

// =====================================================================
// BALONCUK TÜRLERİ
// zone: "shelf" | "floor" | "register" | "door" | "fridge" | "window" | "cat"
// penalty alanları: sat, money (₺, seviye×zorlukla büyür), lostCustomers, lostSalesSec, steal (adet), breakEquip, spoil (taze stoğun oranı)
// Ek: labelTpl, bonus (ceza yok), satGain, rep, requires, minDay, productLinked, dynamic (olayla doğar), special: thief|break|crisis
// =====================================================================
const BUBBLE_TYPES = {
  restock:  { emoji: "📦", label: "Raf boşaldı!", labelTpl: "{name} bitti!", zone: "shelf", taps: 1, life: 5, reward: 2,
              penalty: { lostSalesSec: 60, money: -3, sat: -2 }, dynamic: true, productLinked: true },
  clean:    { emoji: "🧽", label: "Yer kirlendi", zone: "floor", taps: 2, life: 5, reward: 2,
              penalty: { sat: -4, money: -4 }, weight: 3 },
  stain:    { emoji: "🟤", label: "İnatçı leke!", zone: "floor", taps: 3, life: 6, reward: 5,
              penalty: { sat: -5, money: -6 }, weight: 1, minDay: 3 },
  change:   { emoji: "🪙", label: "Bozuk para lazım", zone: "register", taps: 1, life: 3.5, reward: 3,
              penalty: { sat: -2, lostCustomers: 1 }, weight: 3 },
  queue:    { emoji: "🧍", label: "Kuyruk uzadı", zone: "register", taps: 2, life: 4.5, reward: 3,
              penalty: { lostCustomers: 1, sat: -3 }, weight: 2, minDay: 2 },
  catbox:   { emoji: "🙀", label: "Pamuk kutuyu devirdi", zone: "cat", taps: 2, life: 5, reward: 3,
              penalty: { money: -5, sat: -2 }, weight: 1.5 },
  courier:  { emoji: "🛵", label: "Kapıda kurye", zone: "door", taps: 1, life: 4, reward: 4,
              penalty: { money: -6 }, weight: 1.5, minDay: 2 },
  fridgeDoor:{ emoji: "🚪", label: "Dolap kapağı açık!", zone: "fridge", taps: 1, life: 4, reward: 3,
              penalty: { money: -4, sat: -1, spoil: 0.1 }, weight: 1.5, requires: "fridge" },
  fog:      { emoji: "🌫️", label: "Cam buğulandı", zone: "window", taps: 2, life: 5.5, reward: 2,
              penalty: { sat: -3, money: -2 }, weight: 1 },
  priceTag: { emoji: "🏷️", label: "Etiket düştü", zone: "shelf", taps: 1, life: 4.5, reward: 2,
              penalty: { lostSalesSec: 25, money: -3 }, weight: 2, productLinked: true },
  kid:      { emoji: "🍭", label: "Çocuk ağlıyor", zone: "floor", taps: 1, life: 4, reward: 3,
              penalty: { sat: -6, money: -3 }, weight: 1.2, minDay: 2 },
  phone:    { emoji: "☎️", label: "Telefonla sipariş!", zone: "register", taps: 1, life: 3.5, reward: 6,
              penalty: { lostCustomers: 1, money: -4 }, weight: 1, minDay: 4 },
  leak:     { emoji: "💧", label: "Tavan damlıyor", zone: "floor", taps: 2, life: 5, reward: 3,
              penalty: { sat: -4, money: -8 }, weight: 0.2 },
  neighbor: { emoji: "👋", label: "Komşu selam veriyor", zone: "window", taps: 1, life: 4, reward: 2,
              penalty: {}, weight: 1, bonus: true, satGain: 2 },
  pet:      { emoji: "🐈", label: "Pamuk'u sev", zone: "cat", taps: 1, life: 4.5, reward: 1,
              penalty: {}, weight: 1.6, bonus: true, satGain: 3 },
  golden:   { emoji: "⭐", label: "Altın fırsat!", zone: "window", taps: 1, life: 2.2, reward: 15,
              penalty: {}, weight: 0.25, bonus: true, rep: 2 },
  regular:  { emoji: "🙋", label: "Mahalleli uğradı", zone: "door", taps: 1, life: 6, reward: 5,
              penalty: { sat: -3 }, dynamic: true },
  // --- yeni mekanik baloncukları (olayla doğarlar) ---
  thief:    { emoji: "🕵️", label: "Şüpheli müşteri!", zone: "shelf", taps: 1, life: 3.2, reward: 8,
              penalty: { steal: 1 }, dynamic: true, special: "thief", rep: 1.5 },
  breakFridge:{ emoji: "🧊", label: "Dolap arızalandı!", zone: "fridge", taps: 2, life: 5, reward: 0,
              penalty: { breakEquip: "fridge" }, dynamic: true, special: "break", equip: "fridge" },
  breakReg: { emoji: "🧾", label: "Kasa dondu!", zone: "register", taps: 2, life: 5, reward: 0,
              penalty: { breakEquip: "register" }, dynamic: true, special: "break", equip: "register" },
  crisis:   { emoji: "❓", label: "Karar ver!", zone: "door", taps: 1, life: 6.5, reward: 0,
              penalty: {}, dynamic: true, special: "crisis" }
};

// =====================================================================
// KRİZ KARTLARI — baloncuğa basınca açılır; 9 sn içinde seç. Seçmezsen/baloncuk kaçarsa "ignore" olur.
// options[].cost: peşin ₺ (seviyeyle büyür) · outcomes: [{p, text, fx}] (tohumlu, deterministik)
// fx: money, sat, rep, customers (±), stockBuy {n, discount}, spoilFresh (oran), breakEquip, fixEquip, sellPremium (çarpan)
// =====================================================================
const CRISES = [
  { id: "kamyon", emoji: "🚚", title: "Toptancı kamyonu geçiyor!", text: "Hasan Abi'nin kamyonu kapıda: bugüne özel %30 indirimli koli. Rafta yer ve kasada para var mı?",
    weight: 3, minDay: 3,
    options: [ { id: "al", label: "Koli al", hint: "14 ürün %30 ucuz (yuva/para yettiği kadar)", outcomes: [{ p: 1, text: "Koliler rafa girdi!", fx: { stockBuy: { n: 14, discount: 0.3 } } }] } ],
    ignore: { text: "Kamyon geçti gitti.", outcomes: [{ p: 1, text: "Fırsat kaçtı.", fx: {} }] } },
  { id: "elektrik", emoji: "⚡", title: "Elektrik kesildi!", text: "Dolap ısınıyor, kasa durdu, müşteriler karanlıkta. Ne yapacaksın?",
    weight: 2, minDay: 6,
    options: [
      { id: "jenerator", label: "Jeneratör kirala", cost: 30, hint: "−₺30, hiçbir şey kaybetmezsin", outcomes: [{ p: 1, text: "Dükkân ışıl ışıl, kimse fark etmedi.", fx: {} }] },
      { id: "mum", label: "Mum yak", cost: 5, hint: "−₺5; taze ürün biraz bozulur, müşteri hoşnutsuz", outcomes: [{ p: 1, text: "Romantik ama pek kârlı değil.", fx: { sat: -3, spoilFresh: 0.12 } }] }
    ],
    ignore: { text: "Müşteri kaybı, bozulan taze ürün, memnuniyet düşüşü.", outcomes: [{ p: 1, text: "Karanlıkta herkes kaçtı.", fx: { customers: -4, sat: -4, spoilFresh: 0.2 } }] } },
  { id: "kalabalik", emoji: "👥", title: "Kalabalık bastı!", text: "Otobüs yolcuları aynı anda daldı. Kasada kuyruk büyüyor!",
    weight: 2.5, minDay: 5,
    options: [ { id: "kasa", label: "İkinci kasa aç", cost: 15, hint: "−₺15, +5 müşteri alışveriş yapar", outcomes: [{ p: 1, text: "Hepsi memnun ayrıldı!", fx: { customers: 5 } }] } ],
    ignore: { text: "3 müşteri beklemeyip gider, memnuniyet düşer.", outcomes: [{ p: 1, text: "Kuyruk dayanılmaz oldu.", fx: { customers: -3, sat: -2 } }] } },
  { id: "pazarlik", emoji: "🎲", title: "Gezgin satıcı: Altın fırsat!", text: "'Bugün şanslı gününüz, abla/abi!' diyor. Peşin ver, belki iki katını kazanırsın… belki de hiç.",
    weight: 1.5, minDay: 5,
    options: [ { id: "risk", label: "Risk al", cost: 25, hint: "−₺25; %45 ihtimalle +₺75", outcomes: [
      { p: 0.45, text: "Tuttu! Satıcı doğru söylemiş.", fx: { money: 75 } }, { p: 0.55, text: "Pişman oldun…", fx: {} } ] } ],
    ignore: { text: "Satıcıyı geçtin.", outcomes: [{ p: 1, text: "Ne olduğunu hiç öğrenemeyeceksin.", fx: {} }] } },
  { id: "denetci", emoji: "🕵️", title: "Belediye denetimi!", text: "Hikmet Bey habersiz geldi. Etiketler, tarihler, temizlik… hepsine bakacak.",
    weight: 2, minDay: 8,
    options: [ { id: "duzelt", label: "Hemen düzelt", cost: 20, hint: "−₺20 ama ceza riski yok", outcomes: [{ p: 1, text: "Hikmet Bey tam puan verdi.", fx: { sat: 1 } }] } ],
    ignore: { text: "%50 ihtimalle ağır ceza (−₺45) ve memnuniyet kaybı.", outcomes: [
      { p: 0.5, text: "Ceza yedin!", fx: { money: -45, sat: -5 } }, { p: 0.5, text: "Neyse ki bu sefer bakmadı.", fx: {} } ] } },
  { id: "rakipanons", emoji: "📣", title: "Zincir Market anons yapıyor!", text: "Karşı köşeden hoparlörle 'Hepsi yarı fiyatına!' diye bağırıyorlar. Mahalle kulak kabarttı.",
    weight: 3, minDay: 12, requires: "rival",
    options: [ { id: "tabela", label: "'Bugüne özel' tabelası as", cost: 12, hint: "−₺12, +4 müşteri kazanırsın", outcomes: [{ p: 1, text: "Tabela tuttu, mahalle sende kaldı.", fx: { customers: 4 } }] } ],
    ignore: { text: "5 müşteri rakibe gider.", outcomes: [{ p: 1, text: "Müşteriler karşıya akın etti.", fx: { customers: -5, sat: -1 } }] } },
  { id: "siparis", emoji: "📦", title: "Yanlış sipariş geldi!", text: "Kurye başka dükkânın kolisini bırakmış, müşteri de kızgın.",
    weight: 1.5, minDay: 6,
    options: [ { id: "duzelt", label: "Hemen düzelt", cost: 12, hint: "−₺12; müşteri memnun", outcomes: [{ p: 1, text: "Özür dilediler, herkes güldü.", fx: { sat: 1 } }] } ],
    ignore: { text: "−₺20 zarar, memnuniyet düşer.", outcomes: [{ p: 1, text: "Koli geri gitti, müşteri trip attı.", fx: { money: -20, sat: -2 } }] } },
  { id: "sizinti", emoji: "💧", title: "Dolap su sızdırıyor!", text: "Buzdolabının altında göl oluştu, motor garip ses çıkarıyor.",
    weight: 2, minDay: 8, requires: "fridge",
    options: [
      { id: "tamirci", label: "Tamirci çağır", cost: 30, hint: "−₺30; dolap sapasağlam olur", outcomes: [{ p: 1, text: "Usta dolabı yenisi gibi yaptı.", fx: { fixEquip: "fridge" } }] },
      { id: "bez", label: "Bez koy", hint: "Bedava ama %40 ihtimalle dolap bozulur", outcomes: [
        { p: 0.4, text: "Dolap bozuldu!", fx: { breakEquip: "fridge" } }, { p: 0.6, text: "Şimdilik idare etti.", fx: {} } ] }
    ],
    ignore: { text: "%70 ihtimalle dolap bozulur.", outcomes: [
      { p: 0.7, text: "Dolap bozuldu!", fx: { breakEquip: "fridge" } }, { p: 0.3, text: "Şansın yaver gitti.", fx: {} } ] } },
  { id: "veresiye", emoji: "🤝", title: "Komşu veresiye istiyor", text: "Bakkal Hüsnü Amca: 'Evladım ay sonuna kadar yaz, söz veriyorum.'",
    weight: 1.5, minDay: 6,
    options: [ { id: "ver", label: "Ver", cost: 20, hint: "−₺20; %70 ihtimalle ₺32 geri döner", outcomes: [
      { p: 0.7, text: "Borcunu faiziyle ödedi, bahşiş de bıraktı!", fx: { money: 32, sat: 2 } }, { p: 0.3, text: "Bir daha uğramadı…", fx: {} } ] } ],
    ignore: { text: "Hayır dedin; kırgın gitti.", outcomes: [{ p: 1, text: "Biraz surat astı.", fx: { sat: -1 } }] } },
  { id: "vip", emoji: "🧐", title: "Mahalleye VIP müşteri geldi", text: "Şık takım elbiseli bir bey: 'Elinizdeki en iyi ürünü alırım.'",
    weight: 1, minDay: 10, minLevel: 5,
    options: [ { id: "ozel", label: "Özel ürünü ayır", hint: "En pahalı ürünü 2,2 katına satarsın (stokta varsa)", outcomes: [{ p: 1, text: "Kasa bir güzel çınladı!", fx: { sellPremium: 2.2 } }] } ],
    ignore: { text: "Bey başka dükkâna yöneldi.", outcomes: [{ p: 1, text: "Fırsat kaçtı.", fx: {} }] } },
  { id: "baskin", emoji: "💦", title: "Su baskını!", text: "Üst kattaki daire musluğu açık unutmuş; tavandan şelale akıyor.",
    weight: 1, minDay: 10,
    options: [ { id: "vana", label: "Vanayı kapat + sil", cost: 25, hint: "−₺25; büyük zarar önlenir", outcomes: [{ p: 1, text: "Sadece birkaç koli ıslandı.", fx: { sat: -1 } }] } ],
    ignore: { text: "−₺40, memnuniyet −5, 3 müşteri kaçar.", outcomes: [{ p: 1, text: "Dükkân göle döndü!", fx: { money: -40, sat: -5, customers: -3 } }] } }
];

// =====================================================================
// HAFTANIN GÜNLERİ (gün 1 = Pazartesi)
// Ek (opsiyonel): demandMods, bubbleMods
// =====================================================================
const WEEKDAYS = [
  { id: "pzt", name: "Pazartesi", short: "Pzt", customerMult: 0.9,  flavor: "Haftanın ilk günü; mahalle biraz uykulu.", demandMods: { kahve: 1.3 } },
  { id: "sal", name: "Salı",      short: "Sal", customerMult: 0.95, flavor: "Sakin bir salı. Rafları düzenlemek için ideal.", demandMods: {} },
  { id: "car", name: "Çarşamba",  short: "Çar", customerMult: 1.0,  flavor: "Semt pazarı günü! Meyve ve peynir çok gider.", demandMods: { elma: 1.3, peynir: 1.2 } },
  { id: "per", name: "Perşembe",  short: "Per", customerMult: 1.0,  flavor: "Okul çıkışı çocuklar akın eder.", demandMods: { atistirmalik: 1.25 }, bubbleMods: { kid: 1.5 } },
  { id: "cum", name: "Cuma",      short: "Cum", customerMult: 1.1,  flavor: "Hafta sonu havası başladı, sepetler kabarık.", demandMods: { cikolata: 1.2, cicek: 1.3 } },
  { id: "cmt", name: "Cumartesi", short: "Cmt", customerMult: 1.25, flavor: "Herkes dışarıda! En kalabalık gün.", demandMods: { icecek: 1.2, pasta: 1.3 }, bubbleMods: { queue: 1.4, clean: 1.2 } },
  { id: "paz", name: "Pazar",     short: "Paz", customerMult: 1.2,  flavor: "Pazar kahvaltısı: ekmek, simit, peynir, sucuk!", demandMods: { ekmek: 1.4, simit: 1.4, peynir: 1.3, sucuk: 1.4, sarkuteri: 1.1 } }
];

// =====================================================================
// HAVA DURUMU
// demandMods anahtarları productId veya cat olabilir (ikisi de eşleşirse çarpılır)
// Ek (opsiyonel): minDay (bu günden önce seçilmez), bubbleMult (o gün doğan baloncuk sayısı çarpanı)
// =====================================================================
const WEATHERS = [
  { id: "gunes", name: "Güneşli", emoji: "☀️", customerMult: 1.1, weight: 4,
    demandMods: { dondurma: 1.8, icecek: 1.3, salep: 0.4, semsiye: 0.2 },
    bubbleMods: { neighbor: 1.3 },
    banner: "Güneş pırıl pırıl, mahalle sokakta!" },
  { id: "bulut", name: "Bulutlu", emoji: "⛅", customerMult: 1.0, bubbleMult: 0.9, weight: 4,
    demandMods: { kahve: 1.1, semsiye: 0.6 },
    bubbleMods: {},
    banner: "Kapalı ama tatlı bir gün." },
  { id: "yagmur", name: "Yağmurlu", emoji: "🌧️", customerMult: 0.9, bubbleMult: 1.15, weight: 3,
    demandMods: { semsiye: 7.0, salep: 1.5, kahve: 1.3, dondurma: 0.4 },
    bubbleMods: { clean: 2.0, stain: 1.5, leak: 6.0, fog: 1.8 },
    banner: "Şıpır şıpır… Şemsiyeler kapış kapış, yerler çamur!" },
  { id: "kar", name: "Karlı", emoji: "❄️", customerMult: 0.8, bubbleMult: 1.1, weight: 1.5, minDay: 8,
    demandMods: { salep: 3.0, kahve: 1.4, sut: 1.2, dondurma: 0.15, semsiye: 1.5 },
    bubbleMods: { fog: 2.5, clean: 1.5, pet: 1.5 },
    banner: "Lapa lapa kar! Pamuk sobanın dibinden kalkmıyor." },
  { id: "sicak", name: "Kavurucu Sıcak", emoji: "🥵", customerMult: 1.05, bubbleMult: 1.05, weight: 2, minDay: 4,
    demandMods: { dondurma: 3.0, icecek: 1.6, salep: 0.2, kahve: 0.7, cikolata: 0.7 },
    bubbleMods: { fridgeDoor: 2.0, kid: 1.3 },
    banner: "Termometre 36°! Dondurma dolabı nöbette." },
  { id: "ruzgar", name: "Rüzgârlı", emoji: "🌬️", customerMult: 0.95, bubbleMult: 1.15, weight: 2,
    demandMods: { semsiye: 1.5, salep: 1.3 },
    bubbleMods: { priceTag: 2.0, clean: 1.4, courier: 1.3 },
    banner: "Rüzgâr etiketleri uçuruyor, kapı çarpıyor!" }
];

// =====================================================================
// GÜNÜN OLAYLARI
// goal tipleri: "pop" (bubble + count), "combo" (value), "sales" (count, ops. productId/cat),
//               "noMiss" (hiç kaçırma), "earn" (value = ₺ ciro)
// Hedef sayısı hem "count" hem "value" alanında (motor hangisini okursa).
// Ek (opsiyonel): once (tek sefer), fixedDay, weekday (sadece o günde), weather (sadece o havada),
//   goal.scaleWithDay, regulars: [id...] (o gün garanti uğrar), unlockBubble,
//   bubbleMult (o gün doğan baloncuk sayısı çarpanı: yoğun günler >1, sakin günler <1)
// =====================================================================
const DAY_EVENTS = [
  // --- Hikâye günleri (sabit) ---
  { id: "acilis", name: "Açılış Günü", emoji: "🎀", fixedDay: 1, once: true, minDay: 1, weight: 0,
    desc: "Kepenkleri ilk kez kaldırıyorsun! Pamuk kapıda nöbette. Baloncuklara dokunmayı dene.",
    customerMult: 1.0, bubbleMult: 0.85, demandMods: {}, bubbleMods: { clean: 1.3, pet: 1.5 },
    goal: { type: "pop", bubble: "any", count: 6, value: 6, reward: { money: 15, rep: 6 }, text: "İlk 6 baloncuğu patlat" } },
  { id: "denetim", name: "İlk Sağlık Denetimi", emoji: "📋", fixedDay: 3, once: true, minDay: 3, weight: 0,
    desc: "Belediyeden denetçi Hikmet Bey gelecek. Yerler pırıl pırıl olmalı!",
    customerMult: 1.0, bubbleMult: 1.15, demandMods: {}, bubbleMods: { clean: 3.5, stain: 1.5 },
    goal: { type: "pop", bubble: "clean", count: 3, value: 3, reward: { money: 30, rep: 10 }, text: "Denetçi gelmeden 3 yeri sil" } },
  { id: "yenikomsu", name: "Yeni Komşu", emoji: "📦", fixedDay: 6, once: true, minDay: 6, weight: 0,
    desc: "Karşı apartmana yeni bir aile taşındı. Kolilerden yorulmuşlar, acıkmışlar!",
    customerMult: 1.1, demandMods: { ekmek: 1.3, sut: 1.3, meyvesuyu: 1.3 }, bubbleMods: { neighbor: 6.0, courier: 1.5 },
    goal: { type: "pop", bubble: "neighbor", count: 2, value: 2, reward: { money: 20, rep: 8 }, text: "Yeni komşulara 2 kez selam ver" } },
  { id: "okul", name: "Okul Açılışı", emoji: "🎒", fixedDay: 10, once: true, minDay: 10, weight: 0,
    desc: "Zil çaldı, beslenme çantaları dolacak! Simit ve meyve suyu çok gider.",
    customerMult: 1.2, bubbleMult: 1.15, demandMods: { simit: 1.8, meyvesuyu: 1.8, cikolata: 1.4 }, bubbleMods: { kid: 2.5, queue: 1.4 },
    goal: { type: "sales", count: 30, value: 30, reward: { money: 45, rep: 12 }, text: "30 ürün sat" } },
  { id: "denetim2", name: "Sürpriz Denetim", emoji: "🧐", fixedDay: 18, once: true, minDay: 18, weight: 0,
    desc: "Hikmet Bey yine geldi, bu sefer habersiz! Hiçbir şey gözünden kaçmaz.",
    customerMult: 1.0, bubbleMult: 1.2, demandMods: {}, bubbleMods: { clean: 1.6, stain: 1.6, priceTag: 1.6 },
    goal: { type: "noMiss", reward: { money: 80, rep: 18 }, text: "Hiç baloncuk kaçırma" } },
  { id: "festival", name: "Mahalle Festivali", emoji: "🎪", fixedDay: 25, once: true, minDay: 25, weight: 0,
    desc: "Sokak bayraklarla süslendi, bando çalıyor! Yılın en kalabalık günü.",
    customerMult: 1.6, bubbleMult: 1.25, demandMods: { icecek: 1.5, dondurma: 1.6, cikolata: 1.4, cicek: 1.5 }, bubbleMods: { queue: 1.8, clean: 1.6, golden: 2.5, neighbor: 1.5 },
    goal: { type: "earn", value: 900, reward: { money: 150, rep: 30 }, text: "Festivalde ₺900 ciro yap" } },
  { id: "derbi", name: "Büyük Derbi Akşamı", emoji: "⚽", fixedDay: 33, once: true, minDay: 33, weight: 0,
    desc: "Mahallenin iki takımı karşı karşıya! Çekirdek, içecek, sucuk-ekmek… herkes hazırlık yapıyor.",
    customerMult: 1.35, bubbleMult: 1.2, demandMods: { icecek: 1.8, sucuk: 1.8, ekmek: 1.4, atistirmalik: 1.4 }, bubbleMods: { queue: 1.6, change: 1.4 },
    goal: { type: "combo", value: 1.75, reward: { money: 120, rep: 25 }, text: "Gol sevinci gibi x1.75 kombo yap" } },
  { id: "gazete", name: "Gazeteye Çıktık!", emoji: "📰", fixedDay: 40, once: true, minDay: 40, weight: 0,
    desc: "Semt gazetesi 'Mahallenin En Tatlı Dükkânı' diye yazdı. Uzaktan bile gelen var!",
    customerMult: 1.4, bubbleMult: 1.15, demandMods: { pasta: 1.5, cicek: 1.5, kahve: 1.3 }, bubbleMods: { golden: 2.0, neighbor: 1.5 },
    goal: { type: "earn", value: 1500, reward: { money: 200, rep: 35 }, text: "₺1500 ciro yap" } },

  // --- Rastgele olaylar ---
  { id: "mac", name: "Maç Akşamı", emoji: "📺", minDay: 5, weight: 3,
    desc: "Akşam milli maç var! İçecek ve atıştırmalık rafları boşalacak.",
    customerMult: 1.2, bubbleMult: 1.1, demandMods: { icecek: 1.6, atistirmalik: 1.5, sucuk: 1.3 }, bubbleMods: { queue: 1.5 },
    goal: { type: "sales", cat: "atistirmalik", count: 12, value: 12, reward: { money: 40, rep: 10 }, text: "12 atıştırmalık sat", scaleWithDay: true } },
  { id: "kesinti", name: "Elektrik Kesintisi", emoji: "🕯️", minDay: 7, weight: 2,
    desc: "Öğleden sonra elektrikler gitti. Mumlar yandı, dolap ısınıyor, kasa el yazısıyla!",
    customerMult: 0.85, bubbleMult: 1.2, demandMods: { dondurma: 0.5 }, bubbleMods: { fridgeDoor: 2.5, change: 3.0, fog: 1.3 },
    goal: { type: "pop", bubble: "change", count: 3, value: 3, reward: { money: 35, rep: 10 }, text: "Elle 3 kez para üstü ver" } },
  { id: "kahvalti", name: "Pazar Kahvaltısı", emoji: "🍳", minDay: 4, weight: 4, weekday: "paz",
    desc: "Bütün mahalle serpme kahvaltıda! Ekmek, peynir, sucuk, süt uçup gidiyor.",
    customerMult: 1.15, demandMods: { ekmek: 1.6, peynir: 1.6, sucuk: 1.6, sut: 1.4, simit: 1.5 }, bubbleMods: {},
    goal: { type: "sales", cat: "temel", count: 15, value: 15, reward: { money: 35, rep: 10 }, text: "15 temel ürün sat", scaleWithDay: true } },
  { id: "dogumgunu", name: "Doğum Günü Siparişi", emoji: "🎈", minDay: 12, weight: 2,
    desc: "3. kattaki Ece 7 yaşına basıyor! Pasta, meyve suyu, çikolata lazım.",
    customerMult: 1.05, demandMods: { pasta: 3.0, meyvesuyu: 1.6, cikolata: 1.6 }, bubbleMods: { phone: 3.5, kid: 1.5 },
    goal: { type: "pop", bubble: "phone", count: 2, value: 2, reward: { money: 50, rep: 12 }, text: "2 telefon siparişini yetiştir" } },
  { id: "piknik", name: "Mahalle Pikniği", emoji: "🧺", minDay: 8, weight: 2, weather: "gunes",
    desc: "Parkta toplu piknik! Herkes sepetini doldurmaya sende.",
    customerMult: 1.25, bubbleMult: 0.9, demandMods: { elma: 1.5, meyvesuyu: 1.6, ekmek: 1.3, peynir: 1.3, dondurma: 1.4 }, bubbleMods: { neighbor: 1.8 },
    goal: { type: "earn", value: 300, reward: { money: 45, rep: 12 }, text: "₺300 ciro yap", scaleWithDay: true } },
  { id: "influencer", name: "Influencer Ziyareti", emoji: "🤳", minDay: 14, weight: 1.5,
    desc: "Ünlü yemek fenomeni 'Tatlı Tuba' dükkânı çekiyor! Işıklar, kamera, altın fırsatlar!",
    customerMult: 1.2, bubbleMult: 1.1, demandMods: { pasta: 1.5, kahve: 1.4, cicek: 1.4 }, bubbleMods: { golden: 8.0 },
    goal: { type: "pop", bubble: "golden", count: 2, value: 2, reward: { money: 60, rep: 15 }, text: "2 altın ⭐ yakala" } },
  { id: "yavrular", name: "Kedi Yavruları", emoji: "🐾", minDay: 9, weight: 1.5, once: true,
    desc: "Pamuk'un arka sokaktaki arkadaşı yavruladı! Minik patiler her yerde.",
    customerMult: 1.1, bubbleMult: 1.15, demandMods: { sut: 1.5 }, bubbleMods: { pet: 5.0, catbox: 2.0 },
    goal: { type: "pop", bubble: "pet", count: 3, value: 3, reward: { money: 40, rep: 12 }, text: "Kedileri 3 kez sev" } },
  { id: "toptanciindirim", name: "Toptancı İndirimi", emoji: "🏷️", minDay: 4, weight: 2.5,
    desc: "Hasan Abi depoyu boşaltıyor: bugün tüm alışlar %20 ucuz! Stok yapma zamanı (raf ömrüne dikkat).",
    customerMult: 1.0, bubbleMult: 0.9, costMult: 0.8, demandMods: {}, bubbleMods: { courier: 3.5 },
    goal: { type: "pop", bubble: "courier", count: 2, value: 2, reward: { money: 30, rep: 8 }, text: "2 kurye teslimatını karşıla" } },
  { id: "zam", name: "Zam Haberi", emoji: "📈", minDay: 11, weight: 1.5,
    desc: "Toptancı fiyatları %15 artırdı… Ama merak etme, yarın her şey normale döner.",
    customerMult: 1.0, bubbleMult: 0.9, costMult: 1.15, demandMods: {}, bubbleMods: {},
    goal: { type: "combo", value: 1.5, reward: { money: 45, rep: 10 }, text: "Moral bozma: x1.5 kombo yap" } },
  { id: "gokkusagi", name: "Yağmur Sonrası Gökkuşağı", emoji: "🌈", minDay: 6, weight: 1.5, weather: "bulut",
    desc: "Sabah yağan yağmurdan sonra kocaman bir gökkuşağı! Herkes pencerede.",
    customerMult: 1.15, bubbleMult: 0.9, demandMods: { semsiye: 2.0, dondurma: 1.3 }, bubbleMods: { neighbor: 4.0, golden: 2.0, clean: 1.4 },
    goal: { type: "pop", bubble: "neighbor", count: 2, value: 2, reward: { money: 30, rep: 10 }, text: "2 komşuya el salla" } },
  { id: "bayram", name: "Bayram Arifesi", emoji: "🍬", minDay: 20, weight: 1, once: true,
    desc: "Yarın bayram! Şeker, çikolata, çiçek, pasta… herkes misafir hazırlığında.",
    customerMult: 1.4, bubbleMult: 1.15, demandMods: { cikolata: 2.0, pasta: 1.8, cicek: 2.0, kahve: 1.3 }, bubbleMods: { queue: 1.6, kid: 1.5, neighbor: 1.5 },
    goal: { type: "earn", value: 700, reward: { money: 90, rep: 20 }, text: "₺700 ciro yap", scaleWithDay: true } },
  { id: "kuryegrevi", name: "Kurye Grevi", emoji: "🚫", minDay: 13, weight: 1.2,
    desc: "Kuryeler bugün çalışmıyor. Herkes siparişini kendi almaya geliyor!",
    customerMult: 1.2, bubbleMult: 1.1, demandMods: {}, bubbleMods: { courier: 0, phone: 0.3, queue: 3.5 },
    goal: { type: "pop", bubble: "queue", count: 3, value: 3, reward: { money: 45, rep: 12 }, text: "Kuyruğu 3 kez erit" } },
  { id: "dizifinali", name: "Dizi Finali Gecesi", emoji: "📺", minDay: 16, weight: 1.5,
    desc: "Herkesin izlediği dizinin finali bu akşam! Çikolata ve salep stoklansın.",
    customerMult: 1.1, bubbleMult: 0.85, demandMods: { cikolata: 1.8, salep: 1.8, kahve: 1.3, meyvesuyu: 1.2 }, bubbleMods: {},
    goal: { type: "sales", productId: "cikolata", count: 5, value: 5, reward: { money: 45, rep: 12 }, text: "5 çikolata sat", scaleWithDay: true } },
  { id: "sevgililer", name: "Sevgililer Günü", emoji: "💘", minDay: 22, weight: 1, once: true,
    desc: "Kalpler, balonlar, utangaç gülümsemeler… Çiçek ve çikolata günü!",
    customerMult: 1.2, demandMods: { cicek: 3.0, cikolata: 1.8, pasta: 1.4 }, bubbleMods: { golden: 1.5 },
    goal: { type: "sales", productId: "cicek", count: 5, value: 5, reward: { money: 80, rep: 15 }, text: "5 buket çiçek sat" } },
  { id: "marathon", name: "Mahalle Koşusu", emoji: "🏃", minDay: 15, weight: 1.2,
    desc: "Sokaktan maraton geçiyor! Koşucular susuz, seyirciler aç.",
    customerMult: 1.25, bubbleMult: 1.15, demandMods: { icecek: 2.0, elma: 1.5 }, bubbleMods: { clean: 1.5, courier: 1.3 },
    goal: { type: "combo", value: 1.75, reward: { money: 55, rep: 14 }, text: "Koşucular gibi hızlı ol: x1.75 kombo" } }
];

// Olaysız günlerin mini hedefleri (sıradan gün bile bir hedef taşır)
const GENERIC_GOALS = [
  { type: "combo", value: 1.5, reward: { money: 15, rep: 4 }, text: "x1.5 komboya ulaş", scaleWithDay: true },
  { type: "combo", value: 1.75, reward: { money: 25, rep: 6 }, text: "x1.75 komboya ulaş", minDay: 10, scaleWithDay: true },
  { type: "pop", bubble: "any", count: 6, value: 6, reward: { money: 15, rep: 4 }, text: "6 baloncuk patlat", scaleWithDay: true },
  { type: "pop", bubble: "clean", count: 2, value: 2, reward: { money: 20, rep: 4 }, text: "Yerleri 2 kez sil" },
  { type: "pop", bubble: "pet", count: 2, value: 2, reward: { money: 20, rep: 5 }, text: "Pamuk'u 2 kez sev" },
  { type: "sales", count: 20, value: 20, reward: { money: 18, rep: 5 }, text: "20 ürün sat", scaleWithDay: true },
  { type: "earn", value: 120, reward: { money: 20, rep: 5 }, text: "₺120 ciro yap", scaleWithDay: true },
  { type: "noMiss", reward: { money: 25, rep: 7 }, text: "Hiç baloncuk kaçırma", scaleWithDay: true },
  { type: "pop", bubble: "restock", count: 2, value: 2, reward: { money: 25, rep: 4 }, text: "2 acil tedarik yetiştir", minDay: 3 }
];

// =====================================================================
// MAHALLE SAKİNLERİ (regulars)
// Ek (opsiyonel): lines (ekstra cümleler, rastgele seçilir), thanks (teşekkür), tipMult
// =====================================================================
const REGULARS = [
  { id: "ayse", name: "Ayşe Teyze", emoji: "👵", likes: "ekmek", minDay: 1, tipMult: 1.0,
    line: "Evladım iki ekmek ayırdın mı?",
    lines: ["Aman sıcak olsun, torunlar geliyor!", "Pamuk'a da bir selam söyle."],
    thanks: "Allah bereket versin yavrum!" },
  { id: "mehmet", name: "Mehmet Amca", emoji: "🧓", likes: "simit", minDay: 2, tipMult: 1.0,
    line: "Simitle çay olmazsa gün başlamaz!",
    lines: ["Gazete geldi mi? Neyse, simit yeter.", "Bizim zamanımızda simit 25 kuruştu…"],
    thanks: "Eline sağlık aslanım." },
  { id: "zeynep", name: "Öğrenci Zeynep", emoji: "👩‍🎓", likes: "cikolata", minDay: 4, tipMult: 0.8,
    line: "Vize haftası… Çikolatasız ders çalışılmıyor!",
    lines: ["Bir tane daha alsam mı? Alayım.", "Kütüphaneye yetişmem lazım!"],
    thanks: "Hayat kurtardın, gerçekten!" },
  { id: "burak", name: "Kurye Burak", emoji: "🛵", likes: "meyvesuyu", minDay: 6, tipMult: 1.1,
    line: "Hızlı bir meyve suyu kaptım, gidiyorum!",
    lines: ["Bugün 40 paket dağıttım abi!", "Motor kontakta, çabuk çabuk!"],
    thanks: "Sağ ol usta, rüzgâr gibi!" },
  { id: "elif", name: "Elif ve Bebek Arda", emoji: "👩‍🍼", likes: "sut", minDay: 8, tipMult: 1.1,
    line: "Arda uyanmadan bir süt alayım…",
    lines: ["Şşşt, bebek uyuyor!", "Pamuk'u görünce Arda gülüyor."],
    thanks: "Çok tatlısınız, teşekkürler!" },
  { id: "deniz", name: "Ressam Deniz", emoji: "🎨", likes: "kahve", minDay: 11, tipMult: 1.3,
    line: "Işık çok güzel bugün, kahveyle resim yapmalı.",
    lines: ["Dükkânının resmini yapsam mı?", "Tentenin kırmızısı tam ilham."],
    thanks: "Sana bir eskiz borçluyum!" },
  { id: "can", name: "Futbolcu Can", emoji: "⚽", likes: "dondurma", minDay: 13, tipMult: 0.9,
    line: "Antrenmandan çıktım, dondurma hakkım!",
    lines: ["Bugün iki gol attım!", "Hocam görmesin ama…"],
    thanks: "Gooool! Sağ ol abla/abi!" },
  { id: "nuri", name: "Emekli Öğretmen Nuri Bey", emoji: "👴", likes: "peynir", minDay: 16, tipMult: 1.4,
    line: "Ezine peyniri var mı evladım? Kahvaltı sofrası ona emanet.",
    lines: ["Eskiden burası tuhafiyeydi, bilir misin?", "Aferin, dükkân pırıl pırıl."],
    thanks: "Tam puan, yüz üzerinden yüz!" },
  { id: "kerem", name: "Utangaç Kerem", emoji: "🧑‍💼", likes: "cicek", minDay: 28, tipMult: 1.6,
    line: "Şey… en güzel buketiniz hangisi? Bugün önemli bir gün.",
    lines: ["Sizce papatya mı gül mü?", "Evet dedi! Yani… diyecek inşallah."],
    thanks: "Dua edin bana!" }
];

// =====================================================================
// İTİBAR SEVİYELERİ — rep: bu seviyeye gereken TOPLAM XP
// Hedef: çoğu günü oynayan oyuncu Sv.10'a ~40–48. günde ulaşır
// (erken ~30 XP/gün → geç ~100 XP/gün)
// =====================================================================
const LEVELS = [
  { level: 1,  rep: 0,    title: "Köşedeki Dükkân",       unlockText: "" },
  { level: 2,  rep: 60,   title: "Tanıdık Yüz",           unlockText: "Süt ve meyve suyu satılabilir; yazar kasa, önlük, bitkiler ve Kamera & Alarm açıldı." },
  { level: 3,  rep: 170,  title: "Mahallenin Bakkalı",    unlockText: "Çikolata ve dondurma! Buzdolabı, toptancı ve çırak Ali seni bekliyor." },
  { level: 4,  rep: 350,  title: "Güler Yüzlü Esnaf",     unlockText: "Peynir ve şemsiye açıldı. Müzik kutusu, yeni tente ve Sadakat Kartı da geldi." },
  { level: 5,  rep: 600,  title: "Sokağın Sevgilisi",     unlockText: "Kahve ve sıcak salep! Işıklı vitrin artık alınabilir." },
  { level: 6,  rep: 900,  title: "Güvenilir Market",      unlockText: "Sucuk rafı açıldı. Toptancıyla ikinci anlaşma, robot süpürge!" },
  { level: 7,  rep: 1300, title: "Semtin Gözdesi",        unlockText: "Pasta satabilirsin! Neon tabela ve pikap müzik kutusu açıldı." },
  { level: 8,  rep: 1800, title: "Mahallenin Kalbi",      unlockText: "Çiçek buketleri! Çırak Ali ustalaşabilir, vitrin süslenebilir." },
  { level: 9,  rep: 2450, title: "Efsane Esnaf",          unlockText: "Herkes seni konuşuyor. Soğuk Hava Deposu açıldı; büyük hedef çok yakın…" },
  { level: 10, rep: 3300, title: "Mahallenin Yıldızı",    unlockText: "Büyük Açılış — Dükkânı Genişlet artık alınabilir! 🎉" }
];

// =====================================================================
// ÖĞRETİCİ SATIRLAR — yeni bir mekanik ilk göründüğünde sabah ekranında tek tek çıkar (kapatılabilir)
// when: day (minDay'den itibaren) | rivalSoon (rakip açılışına ≤2 gün) | rentSoon (ilk kira ≤3 gün) | debt | fridge | salvo
// =====================================================================
const HINTS = [
  { id: "slots", when: "day", minDay: 1, emoji: "🧺", title: "Raf yuvası sınırlı",
    text: "Dükkânın toplam raf yuvası var (rafın altındaki çubuk). Pasta, çiçek ve şemsiye 2 yuva kaplar. Yer bitince stok alamazsın: neyi satacağını seç." },
  { id: "shelf", when: "day", minDay: 2, emoji: "⏳", title: "Taze ürün bozulur",
    text: "Simit ve pasta bir geceyi, ekmek ve süt iki geceyi çıkarmaz. Kartlardaki '⏳ yarın bozulur' uyarısına bak; fazla alırsan paran çöpe gider. Buzdolabı ömrü uzatır." },
  { id: "prices", when: "day", minDay: 3, emoji: "💲", title: "Fiyatı sen belirle",
    text: "Her ürünün altındaki Ucuz / Normal / Pahalı düğmeleri satış fiyatını değiştirir. 🔥 aranan ve zorunlu ürünlerde zam çoğu zaman kazandırır; dürtü ürünlerinde (çikolata, dondurma) indirim müşteri çeker." },
  { id: "bills", when: "day", minDay: 4, emoji: "🔌", title: "Sabit giderler",
    text: "Her akşam elektrik/maaş giderin düşer, her Pazar akşamı kira ödenir. Kasa yetmezse Hasan Abi'den faizli borç alırsın; borç limiti aşılırsa iflas edersin!" },
  { id: "crisis", when: "day", minDay: 5, emoji: "❓", title: "Karar anları",
    text: "Soru işaretli baloncuğa dokunursan 9 saniyelik bir karar kartı açılır. Seçmezsen ya da baloncuk kaçarsa en kötü seçenek ('görmezden gel') gerçekleşir." },
  { id: "thief", when: "day", minDay: 6, emoji: "🕵️", title: "Hırsız var!",
    text: "Şüpheli müşteri baloncuğuna zamanında bas; yoksa en pahalı raftan ürün çalar. 'Hızlı Geç' günlerinde dükkân başıboş kalır ve hırsız iki kat gelir. Kamera & Alarm gelen hırsızı azaltır." },
  { id: "equip", when: "day", minDay: 7, emoji: "🔧", title: "Dolap ve kasa yıpranır",
    text: "Her gün biraz yıpranırlar; durum çubuğu azalınca arıza riski artar. Sabah 'Bakım yaptır' ucuzdur, arıza sonrası tamir pahalıdır. Bozuk kasa müşteri kaçırır, bozuk dolap taze ürünü çürütür." },
  { id: "salvo", when: "salvo", minDay: 8, emoji: "⚡", title: "Yoğun saatler",
    text: "Zaman zaman baloncuklar art arda gelir. Önce halkası kırmızıya dönen en kısa ömürlüyü çöz; hepsine yetişemezsen en pahalı cezası olanı seç." },
  { id: "rival", when: "rivalSoon", minDay: 1, emoji: "🏬", title: "Zincir Market geliyor!",
    text: "Köşeye Zincir Market açılacak: fiyatları senden ucuz, müşterinin bir kısmını çeker ve zaman zaman kampanya yapar. Kartlarda rakibin fiyatı görünür; pahalı kalırsan müşteri onlara gider. Memnun müşteri ve Sadakat Kartı seni korur." },
  { id: "rent", when: "rentSoon", minDay: 1, emoji: "🧾", title: "İlk kira geliyor",
    text: "Pazar akşamı haftalık kira düşer; seviyen yükseldikçe artar. Kasada bu kadar para bırak, yoksa borca girersin." },
  { id: "debt", when: "debt", minDay: 1, emoji: "⚠️", title: "Borcun var",
    text: "Her gün faiz işler; pozitif günlük kârının %40'ı otomatik borca gider. Sabah elindeki parayla 'Borcu öde' diyebilirsin. Limiti aşarsan ya da 14 gün kesintisiz borçlu kalırsan iflas!" },
  { id: "fridge", when: "fridge", minDay: 1, emoji: "🧊", title: "Buzdolabı masraflıdır",
    text: "Dolap taze ürünlerin ömrünü uzatır ama elektrik yer ve yıpranır. Çok taze ürün satmıyorsan bakım masrafı kazancını yiyebilir." }
];

// =====================================================================
// HİKÂYE METİNLERİ
// =====================================================================
const STORY = {
  intro: [
    "🐈 Miyav! Ben Pamuk. Bu köşedeki minik dükkân artık senin!",
    "Rafları doldur, fiyatları ayarla, kepenkleri aç. Ama dikkat: kira, fatura ve borç gerçek!",
    "Dükkânda bir şeyler ters gidince üstünde baloncuk belirir. Hemen dokun, yoksa zarar edersin.",
    "Hırsız, arıza, kriz kartları, rakip market… Tetikte ol. Günü hızlı geçersen dükkân başıboş kalır!",
    "Hızlı hızlı dokunursan kombo yaparsın. Kombo = daha çok ₺ 💰",
    "Hedefimiz? Mahallenin Yıldızı olmak ve batmadan dükkânı büyütmek! Hadi başlayalım 🎀"
  ],
  levelUp: {
    2:  "Mahalleli seni tanımaya başladı! Ayşe Teyze herkese anlatıyor 👵",
    3:  "Artık gerçek bir bakkalsın! Pamuk gururla kuyruğunu dikti 🐈",
    4:  "Güler yüzün dillere destan. Kapının zili hiç susmuyor 🔔",
    5:  "Sokağın sevgilisi oldun! Çocuklar dükkânın önünde seksek oynuyor.",
    6:  "Güvenilir market rozeti! Hasan Abi sana özel fiyat veriyor 🤝",
    7:  "Semtin gözdesisin. Karşı sokaktan bile müşteri geliyor!",
    8:  "Mahallenin kalbi burada atıyor 💗 Pamuk'un bile hayran kulübü var.",
    9:  "Efsane esnaf! Belediye başkanı bile uğrayıp simit aldı. Arka depo soğutucuya çevrilebilir.",
    10: "⭐ MAHALLENİN YILDIZI! Artık Büyük Açılış için her şey hazır…"
  },
  finale: [
    "🎉 Kurdele kesildi! Köşe Market artık iki katı büyüklükte.",
    "Ayşe Teyze gözyaşlarını siliyor, Mehmet Amca simidini havaya kaldırıyor.",
    "Kerem'in buketi işe yaramış: nişan pastası bizden!",
    "Pamuk yeni vitrinin tam ortasına kıvrıldı. Burası onun krallığı.",
    "Sen de artık resmen… Mahallenin Yıldızı'sın ⭐",
    "Dükkân açık kalıyor: büyük dükkânın kirası da büyük. Sezon hedeflerini tutturup efsane olabilir misin?"
  ],
  // Erken günler için sırayla gösterilen ipuçları; sonrası `tips` içinden döner
  earlyTips: [
    "Raf yuvaların sınırlı: hangi ürünü kaç tane alacağını sen seç. Dengeli Doldur iyi bir başlangıçtır.",
    "Baloncuklara art arda hızlı dokun: kombo x2.0'a kadar çıkar!",
    "Taze ürün (simit, ekmek, pasta…) geceyi çıkarmayabilir. Kartlardaki '⏳ yarın bozulur' uyarısına bak.",
    "Hızlı Geç günleri dükkân başıboş kalır: baloncuklar kaçar, hırsız iki kat gelir.",
    "🕵️ Şüpheli müşteri baloncuğuna basmazsan raftan ürün çalar.",
    "Pazar akşamı kira düşer. Kasada para bırak, yoksa faizli borca girersin.",
    "❓ Soru işaretli baloncuk bir karar kartı açar; 9 saniyen var.",
    "Her ürünün altındaki Ucuz/Normal/Pahalı düğmesi fiyatı değiştirir: aranan üründe zam çoğu zaman kazandırır."
  ],
  tips: [
    "Baloncuklara art arda hızlı dokun: kombo x2.0'a kadar çıkar!",
    "📦 'Bitti!' baloncuğuna basarsan 3 adet acil tedarik gelir (pahalı ama satış durmaz).",
    "Buzdolabı taze ürünlerin ömrünü uzatır ama elektrik yer ve bozulabilir; çok taze ürün satmıyorsan alma.",
    "Yağmurlu günlerde şemsiye rafını doldur — 7 kat talep, zam bile kabul eder!",
    "Sıcak günlerde dondurma, karlı günlerde salep kral.",
    "👋 Komşu ve 🐈 Pamuk baloncukları ceza vermez ama memnuniyeti artırır.",
    "⭐ Altın baloncuk çok kısa yaşar ama büyük ödül verir. Gözünü dört aç!",
    "🟤 İnatçı leke 3 dokunuş ister; erken başla.",
    "Memnuniyet yüksekse yarın daha çok müşteri gelir ve rakibe giden müşteri azalır.",
    "Hızlı Geç günü atlar: baloncuk cezalarını, hırsızı ve arızayı sen karşılarsın.",
    "Çırak Ali kaçırdığın baloncukların cezasını bazen önler ama maaş ister; sen zaten yetişiyorsan gereksiz.",
    "Toptancı İndirimi günlerinde stok yap, ama raf ömrüne ve yuvana dikkat.",
    "Pazar günü kahvaltılıkları, cumartesi içecekleri doldur.",
    "Mahalle sakinlerinin sevdiği ürünü rafta tut; bahşişleri cömerttir.",
    "Zincir Market kampanya yaptığı kategoride fiyatını düşürmezsen müşteri kaçar; ama her indirim kârından yer.",
    "Günün hedefi ekstra ₺ ve itibar verir; sabah kartına göz at.",
    "2x hızda baloncuklar da hızlanır, dikkat!",
    "Kamera & Alarm, hırsızın en iyi ilacıdır; Pamuk'un yatağı da azıcık yardım eder 🐈",
    "Dolap ve kasa için sabah 'Bakım yaptır': arıza sonrası tamir iki kat pahalı.",
    "Borcunu erken öde: faiz her gün işler.",
    "Salvo geldiğinde önce halkası kırmızıya dönen baloncuğa bas."
  ],
  // Ek: sabah kartında olaysız günler için rastgele küçük cümleler
  quietDay: [
    "Sakin bir gün. Pamuk güneşlenmeye çıktı.",
    "Mahallede her şey yolunda, çaylar demlendi.",
    "Bugün sıradan ama güzel bir gün olacak.",
    "Kuşlar tentede cıvıldıyor."
  ],
  piggyBank: "🐷 Pamuk kumbarasını devirdi: +₺{n}! Yeniden başlamak için yeter. (Kalan kumbara hakkı: {left})",
  bankrupt: [
    "Hasan Abi kepenkleri kapattı: borcu ödeyemedin…",
    "Pamuk ağır ağır kutusuna kıvrıldı. Ama her iflas bir ders; yarın yeni bir köşe, yeni bir şans!"
  ]
};

if (typeof module !== "undefined") module.exports = { BALANCE, DIFFICULTIES, DIFF_ORDER, RIVAL, PRODUCTS, UPGRADES, BUBBLE_TYPES, CRISES, HINTS, WEEKDAYS, WEATHERS, DAY_EVENTS, GENERIC_GOALS, REGULARS, LEVELS, STORY };
