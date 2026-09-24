// data.js — Köşe Market'in tüm içeriği ve denge sayıları (DOM yok, Node'da da çalışır)
// Denge sayıları tools/sim.js ile ayarlandı (rapor: tools/BALANCE_REPORT.md). Şema: CONTRACT.md

// =====================================================================
// DENGE SAYILARI — motor içinde "sihirli sayı" olmasın, hepsi burada
// =====================================================================
const BALANCE = {
  // --- Gün ---
  dayLength: 75,              // sn (1x hızda bir iş günü) — ~50 oyun günü × (75 sn + sabah/akşam) ≈ 80 dk
  skipTickDt: 0.25,           // "Hızlı Geç" headless simülasyonda tick adımı (sn)
  speedOptions: [1, 2],       // oyun hızı seçenekleri (2x'te baloncuk ömrü de hızlanır)
  closingQuietSec: 3,         // son N sn yeni müşteri/baloncuk doğmaz (gün toparlansın)

  // --- Para ---
  startMoney: 40,             // yeni oyunda cepteki para (₺)
  startStock: { elma: 4, ekmek: 4 }, // yeni oyunda rafta hazır duran ürünler (Pamuk'un sürprizi)
  piggyBank: 20,              // "Pamuk'un kumbarası": para < en ucuz ürün ve stok yok → +20₺ (günde 1)
  emergencyCostMult: 1.5,     // "📦 bitti" baloncuğuna basınca acil tedarik alış çarpanı
  emergencyQty: 3,            // acil tedarikte en fazla kaç adet gelir
  fillHeadroom: 1.2,          // "Dengeli Doldur" beklenen talebin bu katı kadar alır (+1)
  spoilFraction: 0.35,        // buzdolabı yoksa taze ürünlerin gün sonu kaybolan oranı (~üçte biri)

  // --- Müşteri ---
  baseCustomers: 18,          // gün 1 taban müşteri sayısı
  customerGrowthPerDay: 0.15, // her gün +0.15 müşteri (mahalle dükkânı tanıdıkça)
  customerGrowthPerLevel: 1.2,// her itibar seviyesi +1.2 müşteri
  customersMax: 80,           // güvenlik tavanı (tüm çarpanlardan sonra)
  customerJitter: 0.1,        // günlük müşteri sayısına ±%10 tohumlu sapma
  itemsPerCustomer: 1,        // müşteri başına taban alınan ürün adedi
  extraItemChance: 0.3,       // her müşteri %30 ihtimalle 1 ürün daha alır (tekrar denenir, en fazla maxItems)
  maxItemsPerCustomer: 3,     // bir müşterinin sepeti en fazla
  shelfCapBase: 10,           // ürün başı raf kapasitesi (Ek Raf yükseltmesiyle artar)
  customerSpawnJitter: 0.35,  // müşteri geliş aralıklarına ±%35 rastgelelik
  browseSec: 2.5,             // müşterinin rafta dolaşma süresi (görsel + satış zamanlaması)

  // --- Kombo ---
  comboWindow: 2.5,           // sn — son pop'tan bu kadar süre içinde basılırsa kombo artar (baloncuklar seyrek doğduğu için geniş)
  comboStep: 0.25,            // her ardışık pop +0.25 (x1.25 → x1.5 → x1.75 → x2.0)
  comboMax: 2.0,              // kombo tavanı
  comboResetOnMiss: true,     // bir baloncuk patlayıp kaçarsa kombo 1.0'a döner

  // --- Memnuniyet (sat, 0..100) ---
  satStart: 70,               // yeni oyunda memnuniyet
  satFloor: 15,               // en düşük memnuniyet (upgrade'ler satFloor ile yükseltir)
  satMax: 100,                // tavan
  satPerSale: 0.4,            // mutlu satış başına +0.4
  satPerMiss: -1.5,           // istediğini bulamayan müşteri başına -1.5
  satNightTarget: 65,         // gece memnuniyet bu değere doğru yavaşça döner
  satNightPull: 0.3,          // gece dönüş oranı (%30 yaklaşır)
  satMid: 60,                 // bu değerde yarının müşteri çarpanı 1.0
  satCustomerSwing: 0.15,     // sat 100'de +%15, sat 20'de -%15 müşteri (doğrusal, ±0.15'e kırpılır)

  // --- İtibar (rep XP) ---
  repPerSale: 1,              // satılan her ürün adedi +1 XP
  repPerSatPoint: 0.1,        // gün sonu memnuniyetinin %10'u XP (sat 70 → +7)
  repPerGoal: 8,              // hedef tamamlanınca (goal.reward.rep yoksa) varsayılan XP
  repPerRegular: 3,           // mahalle sakininin isteği karşılanınca +3 XP
  repPerBubble: 0.2,          // pop edilen her baloncuk +0.2 XP (oynamanın küçük bir itibar ödülü)

  // --- Baloncuklar ---
  bubbleRateBase: 0.10,       // sn başına baloncuk doğma hızı (gün 1: ~7 sabit + raf/sakin baloncukları ≈ 11–13/gün)
  bubbleRatePerLevel: 0.012,  // her itibar seviyesi +0.012/sn
  bubbleRatePerDay: 0.0015,   // her gün +0.0015/sn (yavaş yavaş hareketlenir)
  bubbleRateMax: 0.25,        // tavan (~18 sabit + raf/sakin ≈ 22–24 baloncuk/gün; olay/hava bubbleMult ile ±%25)
  bubbleMaxOnScreen: 5,       // aynı anda ekranda en fazla baloncuk (dinamikler dahil)
  bubbleMinGapSec: 0.6,       // iki baloncuk arası en az süre
  bubbleRewardPerLevel: 0.03, // günlük ödül çarpanı = 1 + (level-1)*0.03 (düz tutuldu: geç oyunda fark ~%20–25 kalsın, erken %35–40)
  bubblePenaltyPerLevel: 0.05, // "money" cezaları da 1 + (level-1)*0.05 ile büyür
  lostSalesSecDefault: 10,    // penalty.lostSalesSec belirtilmemiş ama ürün bağlı baloncukta varsayılan
  bubbleRewardMult: 1.0,      // tüm baloncuk ödüllerine global çarpan (oyna/atla farkı ayar düğmesi; <1 farkı azaltır)

  // --- Bahşiş & sakinler ---
  tipChance: 0.08,            // mutlu müşterinin bahşiş bırakma ihtimali
  tipMin: 1, tipMax: 4,       // bahşiş aralığı (₺), seviye ile bubbleRewardPerLevel çarpanıyla büyür
  regularsPerDayMax: 2,       // bir günde en fazla kaç mahalle sakini uğrar
  regularChance: 0.6,         // uygun her sakinin o gün gelme ihtimali (sonra max'a kırpılır)
  regularQty: 1,              // sakin baloncuğuna basınca sevdiği üründen kaç adet alır
  regularTip: 3,              // sakinin baloncuğuna basınca taban bahşiş (₺, seviye çarpanlı)

  // --- Günün hedefi ---
  goalScalePerDay: 0.025,     // scaleWithDay:true hedeflerde hedef ve para ödülü × (1 + 0.025*(gün-1))
  eventChance: 0.55,          // sabit olmayan günlerde bir olay çıkma ihtimali (yoksa GENERIC_GOALS)

  // --- Fiyat / talep ---
  demandFloor: 0.05,          // hava/olay çarpanlarından sonra en düşük talep ağırlığı
  unlockRepHint: true         // UI: kilitli ürünlerde "Sv. N'de açılır" göster
};

// =====================================================================
// ÜRÜNLER
// cat: "temel" | "atistirmalik" | "icecek" | "sarkuteri" | "ozel"
// Ek (opsiyonel) alanlar: desc (kısa tatlı açıklama)
// =====================================================================
const PRODUCTS = [
  { id: "elma",     name: "Elma",           emoji: "🍎", cat: "temel",        cost: 2,  price: 5,  demand: 1.2,  fresh: false, unlockLevel: 1, unlockCost: 0,   desc: "Kıpkırmızı, mis kokulu." },
  { id: "ekmek",    name: "Ekmek",          emoji: "🥖", cat: "temel",        cost: 3,  price: 6,  demand: 1.4,  fresh: true,  unlockLevel: 1, unlockCost: 0,   desc: "Fırından sıcacık geldi." },
  { id: "simit",    name: "Simit",          emoji: "🥯", cat: "atistirmalik", cost: 2,  price: 5,  demand: 1.1,  fresh: true,  unlockLevel: 1, unlockCost: 60,  desc: "Susamlı, çıtır çıtır." },
  { id: "sut",      name: "Süt",            emoji: "🥛", cat: "temel",        cost: 4,  price: 9,  demand: 1.0,  fresh: true,  unlockLevel: 2, unlockCost: 120, desc: "Tam yağlı, cam şişede." },
  { id: "meyvesuyu",name: "Meyve Suyu",     emoji: "🧃", cat: "icecek",       cost: 5,  price: 11, demand: 0.9,  fresh: false, unlockLevel: 2, unlockCost: 150, desc: "Vişneli, pipetli." },
  { id: "cikolata", name: "Çikolata",       emoji: "🍫", cat: "atistirmalik", cost: 6,  price: 13, demand: 0.9,  fresh: false, unlockLevel: 3, unlockCost: 220, desc: "Fındıklı, bir kare daha…" },
  { id: "dondurma", name: "Dondurma",       emoji: "🍦", cat: "atistirmalik", cost: 6,  price: 14, demand: 0.6,  fresh: true,  unlockLevel: 3, unlockCost: 260, desc: "Sıcakta kapış kapış!" },
  { id: "peynir",   name: "Beyaz Peynir",   emoji: "🧀", cat: "sarkuteri",    cost: 10, price: 21, demand: 0.8,  fresh: true,  unlockLevel: 4, unlockCost: 350, desc: "Kahvaltının yıldızı." },
  { id: "semsiye",  name: "Şemsiye",        emoji: "☂️", cat: "ozel",         cost: 16, price: 36, demand: 0.15, fresh: false, unlockLevel: 4, unlockCost: 300, desc: "Yağmurda altın değerinde." },
  { id: "kahve",    name: "Kahve",          emoji: "☕", cat: "icecek",       cost: 9,  price: 20, demand: 0.8,  fresh: false, unlockLevel: 5, unlockCost: 450, desc: "Taze çekilmiş, köpüklü." },
  { id: "salep",    name: "Sıcak Salep",    emoji: "🍵", cat: "icecek",       cost: 6,  price: 15, demand: 0.35, fresh: false, unlockLevel: 5, unlockCost: 380, desc: "Tarçınlı; soğukta içini ısıtır." },
  { id: "sucuk",    name: "Sucuk",          emoji: "🌭", cat: "sarkuteri",    cost: 14, price: 29, demand: 0.7,  fresh: false, unlockLevel: 6, unlockCost: 600, desc: "Pazar kahvaltısına şart." },
  { id: "pasta",    name: "Pasta",          emoji: "🎂", cat: "ozel",         cost: 24, price: 50, demand: 0.45, fresh: true,  unlockLevel: 7, unlockCost: 900, desc: "Çilekli, mumu bizden." },
  { id: "cicek",    name: "Çiçek Buketi",   emoji: "💐", cat: "ozel",         cost: 22, price: 48, demand: 0.4,  fresh: true,  unlockLevel: 8, unlockCost: 1100,desc: "Mahallenin gönlünü çalar." }
];

// =====================================================================
// YÜKSELTMELER
// levels: her eleman o seviyenin KENDİ (artımlı) efekti. Motor alınan tüm seviyeleri toplar:
//   toplanabilir anahtarlar (customers, shelfCap, bubbleLife, tipChance, autoSolve, satFloor, extraItemChance) → toplanır
//   çarpan anahtarlar (costMult, bubbleReward, satGain, bubbleWeightMult.x) → çarpılır
//   fridge / final → true ise true
// Ek (opsiyonel) alanlar: levels[i].minLevel (o seviye için ek itibar şartı), levels[i].desc (seviye açıklaması),
//   scene (render için sahnede görünen öğe anahtarı)
// =====================================================================
const UPGRADES = [
  // ---------- DÜKKÂN ----------
  { id: "raf", name: "Ek Raf", emoji: "🧺", cat: "dukkan", unlockLevel: 1, scene: "raf",
    desc: "Ürün başı raf kapasitesi artar; daha çok stok, daha az 'bitti!'",
    levels: [
      { cost: 180,  effect: { shelfCap: 3 }, desc: "+3 kapasite" },
      { cost: 450, effect: { shelfCap: 4 }, desc: "+4 kapasite", minLevel: 3 },
      { cost: 900, effect: { shelfCap: 5 }, desc: "+5 kapasite", minLevel: 5 },
      { cost: 1600, effect: { shelfCap: 6 }, desc: "+6 kapasite", minLevel: 7 }
    ] },
  { id: "tabela", name: "Tabela & Reklam", emoji: "📣", cat: "dukkan", unlockLevel: 1, scene: "tabela",
    desc: "Mahalle seni duysun! Her gün daha çok müşteri.",
    levels: [
      { cost: 150,  effect: { customers: 2 }, desc: "El yazısı tabela: +2 müşteri" },
      { cost: 400, effect: { customers: 3 }, desc: "Kapıya balon: +3 müşteri", minLevel: 3 },
      { cost: 850, effect: { customers: 4 }, desc: "Mahalle grubuna ilan: +4 müşteri", minLevel: 5 },
      { cost: 1500, effect: { customers: 5 }, desc: "Işıklı neon tabela: +5 müşteri", minLevel: 7 }
    ] },
  { id: "yazarkasa", name: "Yazar Kasa", emoji: "🧾", cat: "dukkan", unlockLevel: 2, scene: "yazarkasa",
    desc: "Bozuk para derdi ve kuyruk azalır.",
    levels: [
      { cost: 300, effect: { bubbleWeightMult: { change: 0.5, queue: 0.8 } }, desc: "Bozuk para baloncuğu yarıya iner" },
      { cost: 900, effect: { bubbleWeightMult: { change: 0.6, queue: 0.6 }, customers: 1 }, desc: "Temassız ödeme: kuyruk da azalır", minLevel: 5 }
    ] },
  { id: "paspas", name: "Paspas → Robot Süpürge", emoji: "🧹", cat: "dukkan", unlockLevel: 2, scene: "paspas",
    desc: "Yerler daha az kirlenir, lekeler seni daha az uğraştırır.",
    levels: [
      { cost: 220,  effect: { bubbleWeightMult: { clean: 0.7, stain: 0.8 } }, desc: "Kapıya paspas: çamur azalır" },
      { cost: 800, effect: { bubbleWeightMult: { clean: 0.7, stain: 0.6 }, satFloor: 3 }, desc: "Robot süpürge 'Vınvın' işbaşında", minLevel: 6 }
    ] },
  { id: "buzdolabi", name: "Buzdolabı", emoji: "🧊", cat: "dukkan", unlockLevel: 3, scene: "buzdolabi",
    desc: "Taze ürünler (ekmek, süt, peynir, dondurma, pasta…) gece bozulmaz. Ama kapağı açık kalabilir!",
    levels: [ { cost: 650, effect: { fridge: true } } ] },
  { id: "toptanci", name: "Toptancı Anlaşması", emoji: "🤝", cat: "dukkan", unlockLevel: 3, scene: null,
    desc: "Hasan Abi'yle el sıkıştın: alış fiyatları düşer.",
    levels: [
      { cost: 500, effect: { costMult: 0.92 }, desc: "Alışta %8 indirim" },
      { cost: 1400, effect: { costMult: 0.92 }, desc: "Alışta toplam ~%15 indirim", minLevel: 6 }
    ] },
  { id: "vitrin", name: "Işıklı Vitrin", emoji: "🪟", cat: "dukkan", unlockLevel: 5, scene: "vitrin",
    desc: "Göz alıcı vitrin: yoldan geçen içeri girer, sepetler dolar.",
    levels: [
      { cost: 1000, effect: { customers: 2, extraItemChance: 0.08 }, desc: "+2 müşteri, sepete ekstra ürün" },
      { cost: 2000, effect: { customers: 3, extraItemChance: 0.07 }, desc: "Mevsimlik vitrin süslemesi", minLevel: 8 }
    ] },

  // ---------- PERSONEL ----------
  { id: "cirak", name: "Çırak Ali", emoji: "🧑‍🍳", cat: "personel", unlockLevel: 3, scene: "cirak",
    desc: "Sen yetişemezsen o yetişir: kaçan baloncukların cezasını bazen önler (ödül vermez).",
    levels: [
      { cost: 600, effect: { autoSolve: 0.12 }, desc: "%12 ihtimalle cezayı önler" },
      { cost: 1300, effect: { autoSolve: 0.12 }, desc: "%24", minLevel: 6 },
      { cost: 2400, effect: { autoSolve: 0.11 }, desc: "%35 (en fazla)", minLevel: 8 }
    ] },
  { id: "onluk", name: "Tezgâhtar Önlüğü", emoji: "🎽", cat: "personel", unlockLevel: 2, scene: "onluk",
    desc: "Rozetli önlük giyince eller daha çevik: baloncuk ödülleri artar.",
    levels: [
      { cost: 250,  effect: { bubbleReward: 1.15 }, desc: "Baloncuk ödülü +%15" },
      { cost: 900, effect: { bubbleReward: 1.15 }, desc: "Toplam +%32", minLevel: 5 },
      { cost: 1900, effect: { bubbleReward: 1.15 }, desc: "Toplam +%52", minLevel: 8 }
    ] },

  // ---------- DEKOR ----------
  { id: "kediyatagi", name: "Pamuk'un Yatağı", emoji: "🛏️", cat: "dekor", unlockLevel: 1, scene: "kediyatagi",
    desc: "Pamuk mutlu, dükkân huzurlu. Kutu devirme azalır, müşteriler gülümser.",
    levels: [ { cost: 120, effect: { satFloor: 5, bubbleWeightMult: { catbox: 0.6, pet: 1.3 } } } ] },
  { id: "bitkiler", name: "Saksı Bitkileri", emoji: "🪴", cat: "dekor", unlockLevel: 2, scene: "bitkiler",
    desc: "Yeşillik iyi gelir: memnuniyet daha hızlı artar.",
    levels: [
      { cost: 200,  effect: { satGain: 1.15, satFloor: 3 }, desc: "Pencere önüne fesleğen" },
      { cost: 650, effect: { satGain: 1.1,  satFloor: 4 }, desc: "Köşeye kocaman monstera", minLevel: 5 }
    ] },
  { id: "lamba", name: "Sarı Işıklı Lamba", emoji: "💡", cat: "dekor", unlockLevel: 3, scene: "lamba",
    desc: "Sıcacık ışık: müşteriler oyalanır, bahşiş bırakır.",
    levels: [ { cost: 400, effect: { tipChance: 0.05, customers: 1, bubbleWeightMult: { fog: 0.7 } } } ] },
  { id: "muzik", name: "Müzik Kutusu", emoji: "🎵", cat: "dekor", unlockLevel: 4, scene: "muzik",
    desc: "Hafif bir melodi: baloncuklar biraz daha sabırlı, müşteriler daha keyifli.",
    levels: [
      { cost: 450, effect: { bubbleLife: 0.5, satGain: 1.05 }, desc: "Baloncuk ömrü +0.5 sn" },
      { cost: 1100, effect: { bubbleLife: 0.5, satGain: 1.05 }, desc: "Pikap! Toplam +1 sn", minLevel: 7 }
    ] },
  { id: "tente", name: "Yeni Tente", emoji: "⛱️", cat: "dekor", unlockLevel: 4, scene: "tente",
    desc: "Kırmızı-krem çizgili yepyeni tente: yağmurda da güneşte de gelen olur.",
    levels: [ { cost: 700, effect: { customers: 2, satFloor: 3, bubbleWeightMult: { leak: 0.4 } } } ] },

  // ---------- FİNAL ----------
  { id: "buyukacilis", name: "Büyük Açılış — Dükkânı Genişlet", emoji: "🎉", cat: "final", unlockLevel: 10, scene: "buyukacilis",
    desc: "Yan dükkânı da kirala, duvarı yık, kurdeleyi kes! Köşe Market mahallenin yıldızı olur.",
    levels: [ { cost: 6500, effect: { final: true, shelfCap: 10, customers: 10 } } ] }
];

// =====================================================================
// BALONCUK TÜRLERİ
// zone: "shelf" | "floor" | "register" | "door" | "fridge" | "window" | "cat"
// Ek (opsiyonel) alanlar:
//   labelTpl: "{name}" → ürün adıyla doldurulur (dinamik restock)
//   bonus: true → pozitif baloncuk, kaçırılınca ceza yok ve kombo sıfırlanmaz
//   satGain: +N memnuniyet (basınca), rep: +N XP (basınca)
//   requires: "fridge" → sadece o efekt varsa doğar
//   minDay: bu günden önce doğmaz
//   productLinked: true → rastgele açık bir ürüne bağlanır (lostSalesSec o ürünü durdurur)
// =====================================================================
const BUBBLE_TYPES = {
  restock:  { emoji: "📦", label: "Raf boşaldı!", labelTpl: "{name} bitti!", zone: "shelf", taps: 1, life: 5, reward: 2,
              penalty: { lostSalesSec: 60 }, dynamic: true, productLinked: true },
  clean:    { emoji: "🧽", label: "Yer kirlendi", zone: "floor", taps: 2, life: 5, reward: 2,
              penalty: { sat: -4 }, weight: 3 },
  stain:    { emoji: "🟤", label: "İnatçı leke!", zone: "floor", taps: 3, life: 6, reward: 5,
              penalty: { sat: -5 }, weight: 1, minDay: 3 },
  change:   { emoji: "🪙", label: "Bozuk para lazım", zone: "register", taps: 1, life: 3.5, reward: 3,
              penalty: { sat: -2 }, weight: 3 },
  queue:    { emoji: "🧍", label: "Kuyruk uzadı", zone: "register", taps: 2, life: 4.5, reward: 3,
              penalty: { lostCustomers: 1, sat: -2 }, weight: 2, minDay: 2 },
  catbox:   { emoji: "🙀", label: "Pamuk kutuyu devirdi", zone: "cat", taps: 2, life: 5, reward: 3,
              penalty: { money: -3, sat: -2 }, weight: 1.5 },
  courier:  { emoji: "🛵", label: "Kapıda kurye", zone: "door", taps: 1, life: 4, reward: 4,
              penalty: { money: -4 }, weight: 1.5, minDay: 2 },
  fridgeDoor:{ emoji: "🚪", label: "Dolap kapağı açık!", zone: "fridge", taps: 1, life: 4, reward: 3,
              penalty: { money: -4, sat: -1 }, weight: 1.5, requires: "fridge" },
  fog:      { emoji: "🌫️", label: "Cam buğulandı", zone: "window", taps: 2, life: 5.5, reward: 2,
              penalty: { sat: -2 }, weight: 1 },
  priceTag: { emoji: "🏷️", label: "Etiket düştü", zone: "shelf", taps: 1, life: 4.5, reward: 2,
              penalty: { lostSalesSec: 12 }, weight: 2, productLinked: true },
  kid:      { emoji: "🍭", label: "Çocuk ağlıyor", zone: "floor", taps: 1, life: 4, reward: 3,
              penalty: { sat: -5 }, weight: 1.2, minDay: 2 },
  phone:    { emoji: "☎️", label: "Telefonla sipariş!", zone: "register", taps: 1, life: 3.5, reward: 6,
              penalty: { lostCustomers: 1 }, weight: 1, minDay: 4 },
  leak:     { emoji: "💧", label: "Tavan damlıyor", zone: "floor", taps: 2, life: 5, reward: 3,
              penalty: { sat: -3, money: -2 }, weight: 0.2 },
  neighbor: { emoji: "👋", label: "Komşu selam veriyor", zone: "window", taps: 1, life: 4, reward: 2,
              penalty: {}, weight: 1, bonus: true, satGain: 2 },
  pet:      { emoji: "🐈", label: "Pamuk'u sev", zone: "cat", taps: 1, life: 4.5, reward: 1,
              penalty: {}, weight: 1.6, bonus: true, satGain: 3 },
  golden:   { emoji: "⭐", label: "Altın fırsat!", zone: "window", taps: 1, life: 2.2, reward: 15,
              penalty: {}, weight: 0.25, bonus: true, rep: 2 },
  regular:  { emoji: "🙋", label: "Mahalleli uğradı", zone: "door", taps: 1, life: 6, reward: 5,
              penalty: { sat: -3 }, dynamic: true }
  // regular: emoji/label çalışma anında sakinin emoji + line'ı ile değiştirilir; reward yerine BALANCE.regularTip kullanılabilir
};

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
    desc: "Hasan Abi depoyu boşaltıyor: bugün tüm alışlar %20 ucuz! Stok yapma zamanı.",
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
  { level: 2,  rep: 60,   title: "Tanıdık Yüz",           unlockText: "Süt ve meyve suyu satılabilir; yazar kasa, önlük ve bitkiler açıldı." },
  { level: 3,  rep: 170,  title: "Mahallenin Bakkalı",    unlockText: "Çikolata ve dondurma! Buzdolabı, toptancı ve çırak Ali seni bekliyor." },
  { level: 4,  rep: 350,  title: "Güler Yüzlü Esnaf",     unlockText: "Peynir ve şemsiye açıldı. Müzik kutusu ve yeni tente de geldi." },
  { level: 5,  rep: 600,  title: "Sokağın Sevgilisi",     unlockText: "Kahve ve sıcak salep! Işıklı vitrin artık alınabilir." },
  { level: 6,  rep: 900,  title: "Güvenilir Market",      unlockText: "Sucuk rafı açıldı. Toptancıyla ikinci anlaşma, robot süpürge!" },
  { level: 7,  rep: 1300, title: "Semtin Gözdesi",        unlockText: "Pasta satabilirsin! Neon tabela ve pikap müzik kutusu açıldı." },
  { level: 8,  rep: 1800, title: "Mahallenin Kalbi",      unlockText: "Çiçek buketleri! Çırak Ali ustalaşabilir, vitrin süslenebilir." },
  { level: 9,  rep: 2450, title: "Efsane Esnaf",          unlockText: "Herkes seni konuşuyor. Büyük hedef çok yakın…" },
  { level: 10, rep: 3300, title: "Mahallenin Yıldızı",    unlockText: "Büyük Açılış — Dükkânı Genişlet artık alınabilir! 🎉" }
];

// =====================================================================
// HİKÂYE METİNLERİ
// =====================================================================
const STORY = {
  intro: [
    "🐈 Miyav! Ben Pamuk. Bu köşedeki minik dükkân artık senin!",
    "Rafları doldur, kepenkleri aç, mahalleli akın akın gelsin.",
    "Dükkânda bir şeyler ters gidince üstünde baloncuk belirir. Hemen dokun!",
    "Hızlı hızlı dokunursan kombo yaparsın. Kombo = daha çok ₺ 💰",
    "İstersen günü hızlı da geçebilirsin, ama baloncuklar kendi kendine çözülmez…",
    "Hedefimiz? Mahallenin Yıldızı olmak ve dükkânı büyütmek! Hadi başlayalım 🎀"
  ],
  levelUp: {
    2:  "Mahalleli seni tanımaya başladı! Ayşe Teyze herkese anlatıyor 👵",
    3:  "Artık gerçek bir bakkalsın! Pamuk gururla kuyruğunu dikti 🐈",
    4:  "Güler yüzün dillere destan. Kapının zili hiç susmuyor 🔔",
    5:  "Sokağın sevgilisi oldun! Çocuklar dükkânın önünde seksek oynuyor.",
    6:  "Güvenilir market rozeti! Hasan Abi sana özel fiyat veriyor 🤝",
    7:  "Semtin gözdesisin. Karşı sokaktan bile müşteri geliyor!",
    8:  "Mahallenin kalbi burada atıyor 💗 Pamuk'un bile hayran kulübü var.",
    9:  "Efsane esnaf! Belediye başkanı bile uğrayıp simit aldı.",
    10: "⭐ MAHALLENİN YILDIZI! Artık Büyük Açılış için her şey hazır…"
  },
  finale: [
    "🎉 Kurdele kesildi! Köşe Market artık iki katı büyüklükte.",
    "Ayşe Teyze gözyaşlarını siliyor, Mehmet Amca simidini havaya kaldırıyor.",
    "Kerem'in buketi işe yaramış: nişan pastası bizden!",
    "Pamuk yeni vitrinin tam ortasına kıvrıldı. Burası onun krallığı.",
    "Sen de artık resmen… Mahallenin Yıldızı'sın ⭐",
    "Teşekkürler! Dükkân açık kalmaya devam ediyor — istediğin kadar oynayabilirsin."
  ],
  tips: [
    "Baloncuklara art arda hızlı dokun: kombo x2.0'a kadar çıkar!",
    "📦 'Bitti!' baloncuğuna basarsan 3 adet acil tedarik gelir (biraz pahalı ama satış durmaz).",
    "Buzdolabın yoksa ekmek, süt, simit gibi taze ürünlerin üçte biri gece bozulur. Az al!",
    "Yağmurlu günlerde şemsiye rafını doldur — 7 kat talep!",
    "Sıcak günlerde dondurma, karlı günlerde salep kral.",
    "👋 Komşu ve 🐈 Pamuk baloncukları ceza vermez ama memnuniyeti artırır.",
    "⭐ Altın baloncuk çok kısa yaşar ama büyük ödül verir. Gözünü dört aç!",
    "🟤 İnatçı leke 3 dokunuş ister; erken başla.",
    "Memnuniyet yüksekse yarın daha çok müşteri gelir.",
    "Hızlı Geç günü atlar ama baloncuk kazancını kaçırırsın (~%20+ daha az).",
    "Çırak Ali kaçırdığın baloncukların cezasını bazen önler — ama ödülü sen alırsın, o almaz.",
    "Toptancı İndirimi günlerinde stok yapmak çok kârlı.",
    "Pazar günü kahvaltılıkları, cumartesi içecekleri doldur.",
    "Mahalle sakinlerinin sevdiği ürünü rafta tut; bahşişleri cömerttir.",
    "Paran biterse üzülme: Pamuk'un kumbarasında hep biraz bozukluk vardır 🐷",
    "Günün hedefi ekstra ₺ ve itibar verir; sabah kartına göz at.",
    "2x hızda baloncuklar da hızlanır, dikkat!",
    "Yazar kasa bozuk para derdini, paspas yer silme işini azaltır."
  ],
  // Ek: sabah kartında olaysız günler için rastgele küçük cümleler
  quietDay: [
    "Sakin bir gün. Pamuk güneşlenmeye çıktı.",
    "Mahallede her şey yolunda, çaylar demlendi.",
    "Bugün sıradan ama güzel bir gün olacak.",
    "Kuşlar tentede cıvıldıyor."
  ],
  piggyBank: "🐷 Pamuk kumbarasını devirdi: +₺20! Yeniden başlamak için yeter."
};

if (typeof module !== "undefined") module.exports = { BALANCE, PRODUCTS, UPGRADES, BUBBLE_TYPES, WEEKDAYS, WEATHERS, DAY_EVENTS, GENERIC_GOALS, REGULARS, LEVELS, STORY };
