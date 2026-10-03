# Köşe Market — Ekip Sözleşmesi (CONTRACT)

Bu dosya alt ajanların paralel çalışırken uyacağı TEK doğruluk kaynağıdır.
Bir arayüzü değiştirmen gerekiyorsa bunu raporunda açıkça yaz; sessizce değiştirme.

## Vizyon
- Chill, tatlış, pastel bir mahalle marketi oyunu. Oyunun toplamı **1–2 saat** sürer (hedef ~75–95 dk, ~45–55 oyun günü).
- Temel görsel dil: `reference/prototip-v0.html` (kırmızı-krem tente, Fredoka + Nunito fontları, krem kartlar, yumuşak gölgeler).
  Oradaki ürün listesi, yükseltme fikirleri ve renk paleti devralınır ama kod yeniden yazılır.
- Dil: Türkçe arayüz. Para birimi `₺`.
- Dükkân kedisi **Pamuk** 🐈 maskot.

## Temel döngü
1. **Sabah (morning)**: Gün kartı (gün no, haftanın günü, hava, günün olayı, günün küçük hedefi). Stok al, ürün kilidi aç, yükseltme al.
   Seçim: **"Dükkânı Aç ▶" (oyna)** veya **"Günü Hızlı Geç ⏩" (atla)**.
2. **Gün (day)**: ~60 sn gerçek zamanlı. Müşteriler otomatik gelir, raftan alır.
   Dükkânın üzerinde **problem baloncukları** çıkar (ürün bitti, yeri sil, parayı bozdur, kedi kutuyu devirdi…).
   Oyuncu hızlıca basar → küçük para + sorun çözülür. Çözülmeyen baloncuk süresi dolunca **ceza** (kaçan müşteri, memnuniyet düşüşü, kayıp satış).
   Hızlı art arda basış **kombo** verir (x1.0 → x2.0).
3. **Akşam (evening)**: Rapor (ciro, baloncuk kazancı, kombo, memnuniyet, itibar XP), "oynayarak kazandığın fark" satırı.
   Sonra yeni sabaha geçilir.
- **Atlama** aynı simülasyonu baloncuklara hiç basılmadan (headless) koşturur. Böylece fark mekanik olarak doğal çıkar.
- **KESİN KURAL**: Erken oyunda (gün 1–15) oynanan gün, atlanan güne göre **en az %20** daha fazla net kazanç vermeli. Orta/geç oyunda da en az ~%12 fark kalmalı (çırak yükseltmesi farkı biraz azaltabilir ama kapatamaz).
- Günler birbirinden farklı hissettirmeli: haftanın günü + hava + olay + günün hedefi + mahalle sakinlerinin (regulars) istekleri.
- Gelişim zorlayıcıdır ve **kaybedilebilir** (v2): kira, günlük gider, borç ve iflas vardır (aşağıdaki "Mekanik v2" bölümü). "Pamuk'un kumbarası" oyun boyu sınırlı hak veren küçük bir güvenlik ağıdır.
- Final hedef: **"Mahallenin Yıldızı"** — son yükseltme "Büyük Açılış / Dükkânı Genişlet" alınınca final sahnesi + istatistik ekranı, sonra sonsuz mod.

## Dosyalar ve sahiplik
| Dosya | Sahip | Açıklama |
|---|---|---|
| `index.html`, `style.css` | UI ajanı | Ekranlar, HUD, paneller, CSS |
| `js/data.js` | İçerik ajanı | Tüm içerik + denge sayıları (DOM yok) |
| `js/engine.js` | Motor ajanı | Durum, ekonomi, gün simülasyonu, kayıt (DOM yok, Node'da çalışmalı) |
| `js/bubbles.js` | Baloncuk ajanı | Baloncuk katmanı (DOM), dokunma, kombo, efekt |
| `js/sfx.js` | Baloncuk ajanı | WebAudio ile minik sesler (dosya yok) |
| `js/render.js` | UI ajanı | Canvas'ta dükkân sahnesi, müşteri animasyonu, bölge koordinatları |
| `js/ui.js`, `js/main.js` | UI ajanı | Ekran akışı, paneller, ana döngü |
| `tools/sim.js` | Denge ajanı (2. faz) | Node ile oyna vs atla simülasyonu |

Yükleme sırası (`index.html`):
```html
<script src="js/data.js"></script>
<script src="js/engine.js"></script>
<script src="js/sfx.js"></script>
<script src="js/bubbles.js"></script>
<script src="js/render.js"></script>
<script src="js/ui.js"></script>
<script src="js/main.js"></script>
```
Hepsi düz global script (modül/bundler yok). `data.js` ve `engine.js` en sonda şunu yapar:
```js
if (typeof module !== "undefined") module.exports = { ... };
```
ve `engine.js` Node'da `require("./data.js")` ile veriyi alabilmeli (browser'da globaller zaten var):
```js
if (typeof module !== "undefined" && typeof PRODUCTS === "undefined") { Object.assign(globalThis, require("./data.js")); }
```

## js/data.js — veri şeması
```js
const BALANCE = {
  dayLength: 60,          // sn (1x hızda)
  startMoney: 40,
  baseCustomers: 14,      // gün 1 taban müşteri sayısı
  shelfCapBase: 8,        // ürün başı raf kapasitesi
  comboWindow: 1.3,       // sn — bu süre içinde basılırsa kombo artar
  comboStep: 0.1, comboMax: 2.0,
  satStart: 70,           // memnuniyet 0..100
  // ... motorun ihtiyaç duyduğu diğer tüm sayılar burada (magic number motor içinde olmasın)
};

const PRODUCTS = [
  // id, name, emoji, cat ("temel"|"atistirmalik"|"icecek"|"sarkuteri"|"ozel"), cost (alış), price (satış),
  // demand (göreli talep ağırlığı), fresh (true → gün sonunda buzdolabı yoksa bozulur),
  // unlockLevel (itibar seviyesi şartı), unlockCost (₺, 0 = başta açık)
  { id: "ekmek", name: "Ekmek", emoji: "🥖", cat: "temel", cost: 3, price: 5, demand: 1.4, fresh: true, unlockLevel: 1, unlockCost: 0 },
  // ~12–14 ürün: elma, ekmek, süt, simit, meyve suyu, çikolata, dondurma, peynir, kahve, şemsiye(!), sıcak çikolata, pasta, çiçek, ...
];

const UPGRADES = [
  // id, name, emoji, desc, cat ("dukkan"|"personel"|"dekor"|"final"),
  // levels: [{ cost, effect: {...} }, ...]  (tek seviyeliyse 1 elemanlı)
  // unlockLevel: itibar seviyesi şartı
  // effect anahtarları (motor bunları toplar):
  //   customers: +N müşteri/gün, shelfCap: +N kapasite, costMult: alış çarpanı (0.9),
  //   bubbleReward: çarpan (1.2), bubbleLife: +sn baloncuk ömrü, tipChance: +0.05,
  //   bubbleWeightMult: { typeId: çarpan }  (ör. yazar kasa → "bozuk" baloncuğu azalır),
  //   autoSolve: 0..1 (çırak: atlanan/kaçırılan baloncuğu otomatik çözme ihtimali; ödül vermez, sadece cezayı önler)
  //   fridge: true, satFloor: +N, satGain: çarpan, extraItemChance: +0.1
  //   final: true → alındığında oyun kazanılır
];

const BUBBLE_TYPES = {
  // id: { emoji, label, zone, taps, life, reward, penalty, weight }
  //  zone: "shelf" | "floor" | "register" | "door" | "fridge" | "window" | "cat"
  //  taps: kaç kez basılmalı (inatçı leke = 3)
  //  life: sn (süre dolunca patlar → penalty)
  //  reward: ₺ taban ödül
  //  penalty: { sat: -N, lostCustomers: N, lostSalesSec: N (ilgili ürünün satışı N sn durur), money: -N }
  //  weight: günlük spawn ağırlığı; dynamic:true olanlar ağırlıkla değil olayla doğar
  restock:  { emoji: "📦", label: "Raf boşaldı!", zone: "shelf", taps: 1, life: 5, reward: 2, penalty: { lostSalesSec: 12 }, dynamic: true },
  clean:    { emoji: "🧽", label: "Yer kirlendi", zone: "floor", taps: 2, life: 5, reward: 2, penalty: { sat: -4 }, weight: 3 },
  change:   { emoji: "🪙", label: "Bozuk para lazım", zone: "register", taps: 1, life: 3.5, reward: 3, penalty: { lostCustomers: 1 }, weight: 3 },
  // ~12+ tür: kuyruk uzadı (register), kedi kutuyu devirdi (cat), kapıda kurye (door), buzdolabı kapağı açık (fridge),
  // cam buğulandı (window), fiyat etiketi düştü (shelf), çocuk ağlıyor 🍭 (floor), komşu selam veriyor 👋 (bonus, ceza yok),
  // altın baloncuk ⭐ (nadir, yüksek ödül, kısa ömür), Pamuk'u sev 🐈 (kalp/memnuniyet), vb.
};

const WEEKDAYS = [ { id: "pzt", name: "Pazartesi", customerMult: 0.9, flavor: "..." }, /* ... 7 gün */ ];

const WEATHERS = [
  // id, name, emoji, customerMult, demandMods: { productId|cat: çarpan }, bubbleMods: { typeId: ağırlıkÇarpanı }, weight, banner
  { id: "gunes", name: "Güneşli", emoji: "☀️", customerMult: 1.1, demandMods: { dondurma: 2.0, icecek: 1.4 }, bubbleMods: {}, weight: 4 },
  // yagmur (şemsiye talebi, çamur → clean x2), kar, bulut, sicak (dondurma çok, buzdolabı baloncuğu), ruzgar...
];

const DAY_EVENTS = [
  // id, name, emoji, desc, minDay, weight, once?: true, fixedDay?: N (belli günde garanti),
  // customerMult, demandMods, bubbleMods, costMult,
  // goal?: { type: "pop", bubble: "clean", count: 8, reward: { money: 40, rep: 10 }, text: "Denetçi gelmeden 8 leke temizle" }
  //   goal tipleri: "pop" (belli türden N baloncuk), "combo" (x1.5 komboya ulaş), "sales" (N ürün sat), "noMiss" (hiç baloncuk kaçırma), "earn" (₺N ciro)
  // ~15+ olay: Maç Akşamı, Okul Açılışı, Sağlık Denetimi, Elektrik Kesintisi, Pazar Kahvaltısı, Doğum Günü Siparişi,
  // Mahalle Pikniği, Influencer Ziyareti (altın baloncuk bol), Kedi Yavruları, Toptancı İndirimi (costMult 0.8),
  // Yağmur Sonrası Gökkuşağı, Bayram Arifesi, Yeni Komşu, Kurye Grevi, Dizi Finali Gecesi...
];
// Olaysız sıradan günler de olmalı ama sıradan gün bile en az bir "günün mini hedefi" taşır (GENERIC_GOALS).
const GENERIC_GOALS = [ { type: "combo", value: 1.5, reward: { money: 15, rep: 4 }, text: "x1.5 komboya ulaş" }, /* ... */ ];

const REGULARS = [
  // Mahalle sakinleri: id, name, emoji, likes: productId, minDay, line (gelince baloncukta çıkan cümle)
  // Oyunda "regular" baloncuğu çıkar: basarsan istediğini sen verirsin (bonus bahşiş + itibar).
  { id: "ayse", name: "Ayşe Teyze", emoji: "👵", likes: "ekmek", minDay: 1, line: "Evladım iki ekmek ayırdın mı?" },
  // Mehmet Amca, Öğrenci Zeynep, Kurye Burak, Ressam Deniz, Bebek arabalı Elif...
];

const LEVELS = [
  // itibar seviyeleri: level, rep (bu seviyeye gereken toplam itibar XP), title, unlockText
  { level: 1, rep: 0, title: "Köşedeki Dükkân", unlockText: "" },
  // ... 10 seviye civarı, son seviye "Mahallenin Yıldızı"
];

const STORY = { intro: [...], levelUp: {...}, finale: [...], tips: [...] };   // kısa tatlış metinler
```

## js/engine.js — API (global `Game` nesnesi)
DOM'a DOKUNMAZ. Rastgelelik tohumlu (`Game.state.seed` + gün no) ki aynı günü atla/oyna karşılaştırması adil olsun ve sayfa yenilemek günü değiştirmesin.

```js
Game.state            // serileştirilebilir düz obje (JSON.stringify edilebilir)
  // { day, money, rep, level, sat, seed, stock: {id: n}, unlocked: {id: true},
  //   upgrades: {id: seviye}, stats: { totalEarned, bubblesPopped, bestCombo, daysPlayed, daysSkipped, ... },
  //   history: [ summary, ... son 7 ], won: false, lastSummary }

Game.newGame(seed?)            // yeni oyun
Game.save() / Game.load() -> bool   // localStorage "koseMarket.v1" (Node'da no-op)
Game.effects()                 // yükseltmelerden toplanmış efekt objesi
Game.shelfCap()                // ürün başı kapasite
Game.planDay() -> DayPlan      // bugünün planı (tohumlu, aynı gün için hep aynı sonuç)
  // DayPlan: { day, weekday, weather, event|null, goal, customers (beklenen sayı), demand: {productId: ağırlık},
  //            regulars: [regularId...], forecastText }
Game.buyStock(productId, qty) -> number   // kaç adet alındı (para/kapasite sınırı)
Game.fillAll() -> number                  // dengeli otomatik doldur (talebe göre ağırlıklı)
Game.unlockProduct(id) -> bool
Game.buyUpgrade(id) -> bool               // bir sonraki seviyeyi alır
Game.canAfford(cost) / Game.upgradeLevel(id) / Game.nextUpgradeCost(id) -> number|null

// --- Gün simülasyonu (tek kod yolu: hem oyna hem atla bunu kullanır) ---
Game.startDay({ mode: "play" | "skip" })  // Game.run oluşturur
Game.run  // { t, length, mode, customersSpawned, sales, revenue, bubbleIncome, tips, combo, maxCombo, popped, missed,
          //   bubbles: { id: Bubble }, goalProgress, events: [] }
Game.tick(dt) -> Event[]                  // dt sn (oyun hızı uygulanmış). Olay listesi döndürür:
  // { type: "customerEnter", cid, look: {face, color} }
  // { type: "customerBuy", cid, productId, qty, amount }
  // { type: "customerMiss", cid, productId }        // istediği ürün yok / raf boş → üzgün gider
  // { type: "customerLeave", cid, happy }
  // { type: "bubbleSpawn", bubble }  // Bubble: { id, type, zone, zoneIndex, productId?, regularId?, taps, tapsLeft, life, age, reward, label, emoji }
  // { type: "bubbleExpire", bubbleId, autoSolved: bool }   // ceza uygulandı (autoSolved ise uygulanmadı)
  // { type: "tip", amount }  { type: "goalProgress", value, target }  { type: "goalDone", reward }
  // { type: "satChange", sat }  { type: "dayEnd" }
Game.tapBubble(bubbleId) -> { popped: bool, tapsLeft, reward, combo } | null
  // Kombo motor tarafında tutulur: son başarılı pop'tan beri geçen süre < BALANCE.comboWindow → combo += comboStep (max comboMax)
  // reward = round(type.reward * combo * effects.bubbleReward * (günlük çarpan)) ; paraya eklenir, run.bubbleIncome'a yazılır
Game.endDay() -> Summary
  // Summary: { day, mode, customers, served, missed, revenue, bubbleIncome, tips, goalDone, goalReward, spoiled,
  //            stockCost (bugün harcanan stok), net, repGained, levelUp: null|{level,title}, satEnd, maxCombo, popped, missedBubbles,
  //            estSkipNet (oynanan gün için: aynı günün atlanmış hâlinin tahmini net kazancı — headless klon simülasyonla hesaplanır) }
Game.skipDay() -> Summary      // startDay({mode:"skip"}) + tick döngüsü (dt=0.25) + endDay; baloncuklara basılmaz
Game.simulateClone(mode, policy?) -> Summary   // state'i klonlayıp o günü headless oynatır; policy: "skip" | "perfect" | {hitRate, reactSec}
```
Kurallar:
- Skip modunda ve baloncuk süresi dolduğunda `effects.autoSolve` ihtimaliyle otomatik çözülür (ödül yok, ceza yok).
- `restock` baloncuğu dinamik: bir ürünün raf stoğu 0 olunca ve **depoda** stok varsa... (sade tut:) raf = stok; `restock` yerine
  ürün bitince "📦 {Ürün} bitti!" baloncuğu çıkar; basılırsa **acil tedarik**: en fazla 3 adet otomatik alınır (alış fiyatının 1.2 katı, para yetiyorsa), satış devam eder. Basılmazsa o ürün gün sonuna kadar yok.
- Gün sonunda ürünler **partiler halinde yaşlanır**: `shelfLife` gece dolan parti tamamen bozulur (buzdolabı taze ürün ömrünü ×2,5 uzatır). Stok, ürün başı kapasiteyle değil **toplam raf yuvasıyla** sınırlıdır (`Game.totalSlots()`).
- İtibar XP: satış + memnuniyet + hedef. Seviye atlayınca yeni ürün/yükseltme/olay açılır.
- Memnuniyet (sat) yarının müşteri sayısını etkiler (±%15 aralığında).
- Para asla negatif olmaz (ödenemeyen gider borca yazılır). Para < en ucuz ürün ve hiç stok yoksa: "Pamuk'un kumbarası" +₺25 (günde bir kez, oyun boyu sınırlı hak: zorluğa göre 5/3/1/0).

## js/bubbles.js — API (global `Bubbles`)
```js
Bubbles.init(layerEl)     // #bubble-layer: canvas'ın üstünde, aynı boyutta mutlak konumlu div
Bubbles.spawn(bubble, pos)    // pos: {x, y} MANTIKSAL koordinat (960x540 sahne). Katman ölçeklenir.
Bubbles.expire(bubbleId, autoSolved)
Bubbles.update(dt)        // ömür halkası/küçülme animasyonu (Game.run.bubbles[id].age/life'tan okur)
Bubbles.clear()
Bubbles.onTap = (bubbleId) => {}   // main.js bağlar → Game.tapBubble çağırır → sonucu Bubbles.feedback(id, result) ile geri verir
Bubbles.feedback(bubbleId, result) // pop animasyonu, "+₺3 x1.4" yüzen yazı, çok-dokunuşluda sallanma
Bubbles.comboFlash(combo)
```
- Pointer events (`pointerdown`) kullan: mobilde hızlı basış çalışmalı, 300ms gecikme olmasın (`touch-action: manipulation`).
- Baloncuklar yuvarlak, pastel, içinde emoji + altında küçük etiket; ömür halkası (conic-gradient) azalır; son 1 sn titrer.
- Baloncuk dokunma alanı en az 56px.
- `sfx.js`: `Sfx.pop(combo)`, `Sfx.coin()`, `Sfx.miss()`, `Sfx.levelUp()`, `Sfx.dayStart()`, `Sfx.dayEnd()`, `Sfx.click()`, `Sfx.setMuted(b)`, `Sfx.muted` — WebAudio osilatör ile yumuşak, tatlı sesler; ilk kullanıcı etkileşiminde AudioContext başlatılır.

## js/render.js — API (global `Render`)
```js
Render.init(canvasEl)          // mantıksal çözünürlük 960x540, CSS ile responsive ölçek, devicePixelRatio desteği
Render.zones                   // { shelf: [{x,y,productId?}...], floor: [{x,y}], register: [{x,y}], door: [{x,y}], fridge: [{x,y}], window: [{x,y}], cat: [{x,y}] }
Render.zonePos(zone, index, productId?) -> {x, y}   // baloncuğun konacağı nokta (biraz rastgele sapma ile)
Render.setDay(plan, state)     // hava (pencereden yağmur/kar/güneş), olay dekoru (maç bayrakları, balonlar…), açılmış ürünler rafta
Render.handle(event)           // Game.tick olaylarını görselleştirir (müşteri gir/al/üzgün çık)
Render.update(dt) / Render.draw()
Render.idle(state)             // sabah/akşam ekranlarında arka planda dükkân sakin hâlde çizilsin (Pamuk uyur, zzz)
```
Görsel: önden görünüm, kırmızı-krem tenteli iç mekan, ahşap raflar (ürün emojileri dizili, stok azaldıkça boşalır),
buzdolabı (yükseltmeyle belirir), kasa + tezgâhtar, kapı + pencere (dışarıda hava), yerde Pamuk.
Müşteriler: yuvarlak tatlı karakterler (emoji yüz veya çizim), kapıdan girer → rafa gider → kasaya → çıkar.
Yükseltmeler sahnede görünmeli (bitki, lamba, kedi yatağı, ikinci raf, tabela…).

## UI akışı (index.html / ui.js / main.js)
Ekranlar: `#screen-title` (Devam / Yeni Oyun), `#screen-morning`, `#screen-day`, `#screen-evening`, `#screen-finale`, overlay'ler (seviye atladı, ipucu).
- Sabah: gün kartı (hava + olay + hedef + bugün gelecek mahalle sakinleri), stok ızgarası (+1 / +5 / Doldur, kapasite çubuğu),
  "Dengeli Doldur" butonu, yükseltme kartları (kilitli olanlar "Sv. N'de açılır"), iki büyük buton: **Dükkânı Aç ▶** ve **Hızlı Geç ⏩**
  (Hızlı Geç'in altında küçük uyarı: "Baloncuklar çözülmez, ~%20+ daha az kazanırsın").
- Gün: üstte HUD (kasa, saat çubuğu, memnuniyet kalpleri, kombo göstergesi, hedef ilerlemesi), ortada canvas + baloncuk katmanı,
  altta ürün stok çipleri. Hız: 1x / 2x (2x'te baloncuklar da hızlanır, adil kalır). Duraklat butonu.
- Akşam: rapor kartları + "Oynayarak +₺X fazla kazandın 🎉 (atlasaydın ~₺Y)" satırı + hedef sonucu + seviye çubuğu → "Yeni Güne Geç 🌅".
- Otomatik kayıt her akşam. Ayarlar: ses aç/kapa, sıfırla.
- Mobil uyumlu (360px genişlikte çalışmalı), klavye kısayolu: Space = dükkânı aç / yeni gün.

## Kod stili
- Türkçe yorumlar, kısa ve yerinde. Dosya başında 1–2 satır açıklama (mevcut `js/*.js` dosyalarındaki gibi).
- Harici kütüphane yok (Google Fonts hariç). Tüm oyun `kose-market/index.html` açılarak (file:// dahil) çalışmalı.


---

# Mekanik v2 (güncel sözleşme — mekanik ajan)

Motor API'si geriye dönük uyumludur; aşağıdakiler EKLENDİ. Kayıt sürümü **2** (`koseMarket.v2`; v1 otomatik taşınır, `Game.loadNote` kullanıcıya gösterilir).

## Durum (`Game.state`) eklemeleri
`diff` ("kolay"|"normal"|"zor"|"efsane"), `prices{id:0|1|2}`, `batch{id:[adet_yaş0, adet_yaş1…]}` (stok partileri; `stock` toplamdır), `debt`, `debtDays`, `bankrupt:null|{day,reason,debt}`,
`equip{fridge,register}` (0–100), `broken{fridge,register}`, `piggyLeft`, `eveningPending`, `dayOpen`, `hints{}`, `season`, `graceUntil`.

## Yeni/Değişen API
```js
Game.newGame(seed?, diffId?)         // zorluk seçilir
Game.setPrice(id, 0|1|2) / priceOf(id) / priceAt(id,t) / priceInfo(id, plan?) / rivalPrice(id)
Game.planDay()  // + customers (fiyat, rakip, çeşitlilik dahil), weights, heat, factors, rival:{active,open,share,campaign,lost}
Game.totalSlots() / slotsUsed() / slotsFree() / slotsOf(id) / stockAging(id) / lifeOf(id)
Game.expectedSales(plan?) / stockTargets(plan?, mult?) / fillAll(mult?) / fillProduct(id) / buyStock(id,n) / lineCost(id,n) / unitCost(id) // ondalıklı
Game.finance()                       // {money, debt, debtLimit, debtDays, utility, rentDay, rentIn, rentAmount, rentToday, interest, piggyLeft, grace}
Game.repayDebt(n) / Game.service("fridge"|"register") / Game.serviceCost(eq) / Game.equipInfo()
Game.crisisView() / Game.resolveCrisis(optionId|"ignore") / Game.crisisAdvice()   // kriz kartı
Game.tapBubble(id) // + {crisis:true} (kart açıldı) / {special:"thief"|"break"|"crisis"}
Game.abandonDay()                    // gün ortasında bırak → kalan süre başıboş
Game.ackEvening()                    // akşam raporu görüldü (rapor kalıcı: eveningPending)
Game.simulateClone(mode, policy, noiseKey?)   // noiseKey≠0: tahmin ekranı için "benzer gün" (belirsizlik)
Game.hasCheckpoint() / loadCheckpoint()       // iflasta "Son Kayıttan Devam" (her Pazartesi sabahı)
Game.seasonInfo() / pendingHint() / dismissHint(id) / difficulties()
```
`Game.tick` yeni olaylar: `theft, thiefCaught, breakdown, repair, salvo, spoil, crisisOpen, crisisResolve`; `customerMiss.reason` ayrıca `"register"`.

## data.js eklemeleri
`BALANCE` (kira, borç, hırsız, ekipman, kriz, salvo, sezon, fiyat/talep anahtarları — motorda `B(k, d)` varsayılanı data ile aynıdır), `DIFFICULTIES`, `DIFF_ORDER`, `RIVAL`, `CRISES`, `HINTS`;
`PRODUCTS[]`: `el` (fiyat esnekliği), `shelfLife`, `slots`, `traffic`, `cold`; `UPGRADES[].levels[].effect`: `slots, upkeep, lifeBonus, rivalGuard, thiefAuto, weatherShield, theftMult, wearMult, regWear, rentMult, comboWindow`; `UPGRADES[].req`;
`BUBBLE_TYPES[].penalty`: `money, lostCustomers, lostSalesSec, steal, breakEquip, spoil, sat`; yeni türler `thief, breakFridge, breakReg, crisis`.

## Kurallar
- Her akşam: gider (elektrik+maaş+aidat, depolama), Pazar kira, borç faizi; ödenemeyen borca yazılır; pozitif kârın %40'ı borca gider; limit/14 gün → iflas (`Game.state.bankrupt`, `startDay` null döner).
- Tüm mekanikler tohumludur (`hash(seed, gün, akış, noise)`); oyna ve atla aynı müşteri/baloncuk/kriz dizisini görür (Hızlı Geç'te hırsız sayısı ayrıca ×1,8, kriz kartları "ignore").
- Gün başlayınca kayıt `dayOpen:true` yazılır; gün ortasında yenileme o günü `skipDay` ile (başıboş) bitirir.
- `mech.css` style.css'ten önce yüklenir; yeni DOM kimlikleri `HANDOFF_RENDER.md`'de.
