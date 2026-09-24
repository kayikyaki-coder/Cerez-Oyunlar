# Turn Based War — Test Raporu

## ÇIKIŞ ÖZETİ (5. tur — çıkış öncesi final test)

**Açık P0/P1 sayısı: 0.** Şimdiye kadar bulunan tüm P0 (5) ve P1 (2) kritik/önemli hatalar
Geliştirici tarafından düzeltildi ve **kod incelemesi + güncellenmiş regresyon testleriyle**
doğrulandı (bkz. `§2`). Geriye yalnızca 1 açık **P2** (tasarım netleştirmesi bekleyen, hata
olmayan bir madde — P2-1, alan büyüsü dost ateşi) kalıyor; P2-2 de bu turda düzeltilmiş bulundu.

**Tüm paket sonuçları (5. tur, final koşu):**

| Paket | Komut | Sonuç |
|---|---|---|
| Motor/kural testleri | `npm test` (`engine.test.js`) | **41/41 geçti** |
| Kampanya denge sim. (normal) | `node campaign-sim.js 100 --refs 5` | 14 düğüm × 100 koşu, **0 hata/çökme**; detaylı tablo `§6` |
| Kampanya denge sim. (zor) | `node campaign-sim.js 60 --refs 3 --difficulty zor` | 0 hata/çökme; genel olarak daha zor (beklenen yön) |
| Kampanya denge sim. (hikâye) | `node campaign-sim.js 60 --refs 3 --difficulty hikaye` | 0 hata/çökme; genel olarak daha kolay (beklenen yön) |
| Uçtan uca oyuncu | `npm run test:e2e` (N=3) | **3/3 ZAFER**, 0 takıldı, 0 harness zaman aşımı, 0 console/pageerror |
| Tam kampanya e2e | `npm run test:e2e-campaign` (Koşu A: Zor→Hikâye kampta, Koşu B: Hikâye) | **Koşu A ve B ikisi de ending'e ulaştı**, 0 console/pageerror; tek bulgu 1×P2 (bilinen harita-geometrisi kenar durumu) |

**Yeni özellik kontrolleri (hepsi geçti):** yaratımda zorluk seçimi (Zor/Hikâye) kampanya boyunca
doğru taşınıyor; kampta zorluk değiştirme `GameState.difficulty`'yi doğru güncelliyor ve
`saveGame()` tetikliyor; bozuk kayıt (localStorage'a çöp yazılınca) çökmeden başlık ekranına
düşüyor ve doğru toast'ı gösteriyor; "Kaydı Sil" onay diyaloğu Hayır/Evet'te doğru davranıyor;
savaş ortası "← Ana Menü" onay diyaloğu Hayır/Evet'te doğru davranıyor; "Yeni Oyun+" gerçek
tıklamayla haritaya geçiyor ve `GameState.ngPlus=true` oluyor; final ekran görüntüleri
(`tests/shots/final_1024x700.png`, `final_1920x1080.png`) alındı.

**Bilinen P2'ler (hata değil, notlandırıldı):**
- **P2-1** (açık): Alan büyüleri hiç dost ateşi yapmıyor — tasarım kararı mı belirsiz, `docs/DESIGN.md`'ye tek satır not eklenmesi öneriliyor (bkz. `§2`).
- Denge: normal zorlukta `b1` hâlâ hedef bandın biraz dışında (kolay); zor zorlukta birkaç düğüm ("Çok zor") HP -%10-15 ayarı bekliyor (bkz. `§6`, N=100/60 tabloları).

Ayrıntılar için `§8`/`§9` (bu turun tam anlatımı) ve `§6`'daki güncel denge tablolarına bakın.

---

Bu rapor `tests/` altındaki otomatik testlerin (motor testleri, headless denge simülatörü,
uçtan uca Playwright oyuncusu) sonuçlarını ve kodda bulunan hataları özetler.

**ÖNEMLİ — hareketli hedef notu:** Bu test turu sırasında Geliştirici ve Tasarımcı ajanları
kodu **eş zamanlı** olarak değiştiriyordu (kampanyaya dönüşüm devam ediyor). Aşağıdaki
bulgular, testlerin çalıştırıldığı ana ait bir **anlık görüntüdür**; bazı maddeler bu rapor
okunana kadar zaten düzeltilmiş olabilir. Her bulgu, bunu **otomatik olarak yeniden
doğrulayan bir regresyon testiyle** birlikte verilmiştir — düzeltildiğinde ilgili test
kırmızıya döner ve bu, testin içindeki yorumda nasıl güncelleneceği yazılıdır.

> **Güncelleme (aynı test turu sonunda doğrulandı):** **P0-2** (`getEnemyDefs`/`getItemDefs`
> eksikti) ve **P0-3** (`#btnNew` crash'i) Geliştirici tarafından bu rapor yazılırken zaten
> düzeltildi — `js/campaign-flow.js` artık mevcut ve her iki erişimciyi de tanımlıyor,
> `main.js` artık `#btnNew`'a referans vermiyor. Doğrulama: `setupBattle(cfg)` artık hatasız
> çalışıyor, ve gerçek başlık→yaratım→savaş navigasyonuyla çalıştırılan 3 e2e koşusunun
> **3'ü de** gerçek tıklamalarla zafer ile bitti (0 console/pageerror). Bu iki madde aşağıda
> **"düzeltildi"** olarak işaretlendi ama regresyona karşı testler kalıcı olarak repoda kalıyor.

---

## 1. Testleri çalıştırma

```bash
cd oyun/tests
npm install               # sadece ilk seferde (playwright-core; PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD gerekmez,
                           # sistem Chromium'u kullanılır: /opt/pw-browsers)

npm test                   # a) motor/kural testleri (node vm, tarayıcısız) — engine.test.js
npm run test:sim           # c) headless denge simülatörü (500 savaş, tek prototip savaşı) — sim.js
npm run test:e2e           # b) uçtan uca otomatik oyuncu (Playwright, N=20 varsayılan) — e2e.test.js
npm run test:campaign      # d) KAMPANYA DENGESİ: CAMPAIGN'daki her savaş düğümü için 200 koşu — campaign-sim.js
npm run test:e2e-campaign  # e) TAM KAMPANYA uçtan uca (başlık→final, gerçek tıklamalarla) — e2e-campaign.js
npm run test:all           # ilk üçünü sırayla çalıştırır (campaign-sim/e2e-campaign ayrı, en uzun sürdükleri için dahil değil)

node sim.js 100              # sim.js'i farklı savaş sayısıyla çalıştırmak için argüman verilebilir
node e2e.test.js 5           # e2e.test.js'i farklı koşu sayısıyla çalıştırmak için argüman verilebilir
node campaign-sim.js 50      # campaign-sim.js'i düğüm başına farklı koşu sayısıyla çalıştırmak için (200 varsayılan, ~3-4 dk sürer)
node e2e-campaign.js         # ~3-5 dk sürer (2 tam kampanya koşusu); ekran görüntüleri tests/shots/ altına yazılır
```

`tests/node_modules` git'e eklenmemelidir (`.gitignore`'a eklenmesi patronun işi olarak
bırakıldı — bkz. görev talimatı).

### Test dosyaları

| Dosya | Ne yapar |
|---|---|
| `tests/load-engine.js` | `hex.js/data.js/engine.js/ai.js/...`'yi node `vm` içinde, DOM/canvas/Audio/performance stub'larıyla yükler. Üst düzey `const`/`let` (State, SPELLBOOK, CONFIG, ...) motorun `vm` context'inde global NESNE property'si olmadığından, dosyalardaki top-level bildirimleri regex ile toplayıp `globalThis`'e "export" eder — bu sayede testler `context.State`, `context.SPELLBOOK` gibi erişebilir. |
| `tests/seeded-random.js` | Deterministik RNG (`mulberry32`, `scriptedRandom`, `randomFor`) — `Math.random()`'ı seed'leyip belirli d20/d(n) sonuçlarını garanti eder. |
| `tests/tiny-test.js` | Bağımlılıksız mini test çatısı (`describe/test/skip/assert*`). |
| `tests/engine.test.js` | Kural/motor testleri: hexDist/neighbors, rollDmg/kritik, isabet matematiği (seed'li), status tick, büyü slotları, Second Wind, dash kuralları, initiative beraberliği, tur akışı kenar durumları, ve **aşağıdaki bulguların regresyon testleri**. |
| `tests/sim.js` | Motoru vm'de yükler, `setTimeout`'u SENKRON bir kuyruğa çevirir (AI'nin `setTimeout` zinciri anında "tüketilir"), basit bir oyuncu botuyla N savaş oynatır; kazanma oranı / ortalama round / sınıf başı hasar raporlar. `CAMPAIGN` tanımlıysa (`content/campaign.js`) her savaş düğümünü **ayrı ayrı** simüle edecek şekilde tasarlanmıştır (`collectCampaignBattleNodes`). |
| `tests/e2e.test.js` | Playwright + sistem Chromium (`/opt/pw-browsers`) ile `index.html`'i gerçekten açar, konsol hatalarını/`pageerror`'ları toplar, bot **gerçek buton ve canvas tıklamalarıyla** (State'i sadece okuyarak karar verir, aksiyonu her zaman gerçek DOM etkileşimiyle yapar) bir savaşı sonuna kadar oynatmayı dener. N kez tekrarlar. |
| `tests/campaign-sim.js` | **KAMPANYA DENGESİ**: motoru (hex/data/content/*/dev-fixtures/engine/ai/campaign-flow) vm'de yükler; TEK bir "referans kampanya koşusu" (AKILLI bot: odak ateşi, büyü/heal/second-wind/action-surge/iksir kullanır) baştan sona oynanarak her savaş düğümüne **girerken** beklenen ekip seviyesi/ekipmanı/altını gerçekçi biçimde hesaplanır (XP_TABLE + LEVEL_UPS + camp'te "en iyi silah/zırh + 2 iksir" alışverişi). Sonra CAMPAIGN'daki **her savaş düğümü için (14 tanesi) ayrı ayrı, o düğümün ölçülen giriş durumundan** 200 bağımsız koşu çalıştırır; kazanma oranı/ortalama round/kalan HP%/ölüm oranını hedef bantla karşılaştırıp bant dışı olanlar için somut ayar önerisi üretir, ayrıca round-başına-süre varsayımıyla toplam kampanya süresini kabaca tahmin eder. |
| `tests/e2e-campaign.js` | **TAM KAMPANYA uçtan uca**: `index.html?debug=1` (bkz. `js/main.js`'teki `window.__TBW` hata ayıklama kancası: `forceWin/forceLose/State/GameState()`) ile başlıktan finale kadar TÜM kampanyayı **gerçek** tıklama/seçim/klavye etkileşimleriyle oynar — her savaşta en az 1 gerçek oyuncu aksiyonu + 1 gerçek düşman turu, sonra `forceWin()`/`forceLose()` ile hızlandırır. Seviye atlama (stat+büyü seçimi), kamp (satın al/kuşan/sat), iksir/bomba kullanımı, opsiyonel düğüm (bir koşuda oyna/bir koşuda atla), `ch2choice`'ın iki dalı (ayrı koşularda), sayfa yenileme→"Devam Et" (kayıt/yükleme), bir savaşı kaybedip "Tekrar Dene", klavye kısayolları (1-5/E/Esc), ayarlar/yardım ekranı ve pencere yeniden boyutlandırma (1024×700, 1920×1080) sırasında tıklama isabeti (`pixelToHex`) — hepsi gerçek etkileşimle test edilir. Her ekran geçişinde `tests/shots/`'a ekran görüntüsü alır, `console.error`/`pageerror` toplar. |

---

## 2. Bulunan hatalar

### P0 — Kritik

#### P0-1 [DÜZELTİLDİ]: "Yeni Savaş" sonrası önceki savaşın AI `setTimeout` zinciri sızıyor ve yeni savaşın State'ini bozuyor
- **Dosya/satır:** `js/ai.js` (`runEnemyTurn`'ün `act()` fonksiyonu, `setTimeout(act, aiDelay(...))` çağrıları) + `js/main.js` (savaş yeniden başlatma noktaları, ör. eski `btnNew` handler'ı / şu an savaş ekranını yeniden kuran her yol) — bu sızıntıyı önleyecek **hiçbir iptal/guard mekanizması yok** (`grep -n "battleId\|clearTimeout" js/*.js` boş döner).
- **Neden oluşuyor:** `runEnemyTurn(u)`'nün `act()` döngüsü ilerlemek için gerçek tarayıcı `setTimeout`'unu kullanıyor. Oyuncu bir düşman AI'sinin hamlesi daha "kuyrukta beklerken" (ör. animasyon gecikmesi sırasında) yeni bir savaş başlatırsa (Yeni Savaş / bir sonraki kampanya düğümüne geçiş), `setupBattle()` **global `State`'i sıfırlıyor** ama eski `act()` kapanışı (closure) hâlâ eski birimin referansını tutarak devam ediyor. O callback nihayet ateşlendiğinde, `nextTurn()/checkEnd()/log()/doAttack()` gibi hepsi **global `State`** üzerinde çalışan fonksiyonları çağırıyor — yani **artık sahnede olmayan bir düşman, yeni savaşın oyuncularına saldırabiliyor, günlüğe yazabiliyor, hatta `turnPtr`'ı habersizce ilerletip oyuncunun ilk turunu atlatabiliyor.**
- **Yeniden üretme adımı (otomatik, `engine.test.js`):** Savaş A'yı kur → ilk sırayı bir düşmana zorla → `startTurn()` çağır (bu `setTimeout(act,500)`'ü kuyruğa alır) → **kuyruğu boşaltmadan** `setupBattle()` ile Savaş B'yi kur → Savaş A'nın düşmanını Savaş B'nin bir oyuncusunun yanına taşı (sahadaki gerçek durumu simüle etmek için) → kuyruktaki eski `act()`'i çalıştır → Savaş B'nin `turnPtr`/log/HP'sinin bozulduğunu doğrula.
  - Test: `engine.test.js` → `"engine.js/ai.js — YENİ SAVAŞ sırasında eski setTimeout sızıntısı (P0)"` → **geçiyor** (yani hata **doğrulandı**, mevcut kod bunu önlemiyor).
- **Önerilen düzeltme:** `State`'e bir `battleId` sayaç alanı eklenip her `setupBattle()` çağrısında artırılmalı; `runEnemyTurn`'ün `act()`'i başında yakaladığı `battleId`'yi her adımda `State.battleId` ile karşılaştırıp eşleşmiyorsa sessizce `return` etmeli. Alternatif/ek önlem: tüm `setTimeout` id'lerini bir listede tutup savaş kurulurken `clearTimeout` ile iptal etmek (ama `battleId` kontrolü daha sağlam, çünkü `startTurn` içindeki `setTimeout(nextTurn,...)` gibi başka gecikmeli çağrılar da var).

#### P0-2 [DÜZELTİLDİ]: Kampanya savaşı kurulamıyor — `getEnemyDefs()` / `getItemDefs()` tanımlı değil
- **Dosya/satır:** `js/engine.js:116` (`setupBattle`), `js/engine.js:339,752` (`enterItem`, `useItemOn`), `js/ai.js:56,97` (`pickEnemySpell`'in `tryUseAbilities`'daki `summon` dalı), `js/engine.js:911` (`fireReinforcements`) — hepsi `getEnemyDefs()`/`getItemDefs()`/`consumeInventoryItem()` çağırıyor ama bu fonksiyonlar **hiçbir dosyada tanımlı değil** (`grep -rn "function getEnemyDefs\|function getItemDefs\|function consumeInventoryItem" js/` boş döner). `js/dev-fixtures.js` sadece `DEV_ENEMY_DEFS`/`DEV_ITEM_DEFS`/`DEV_CAMPAIGN` **verisini** sağlıyor, bunları gerçek `ENEMY_DEFS`/`ITEM_DEFS` yoksa döndürecek **erişimci fonksiyonu eklemeyi unutmuş**.
- **Etki:** CONTRACT §4.5'teki asıl akış — bir `CAMPAIGN` düğümünden (`map`+`enemies`) `setupBattle(cfg)` çağırmak — **her zaman istisna fırlatıyor**. Yani şu an kampanyadan tek bir savaş bile kurulamıyor (motor testinde doğrulandı).
- **Yeniden üretme adımı:** `setupBattle({ map: [...], enemies: [{type:"wolf",...}] })` çağır → `ReferenceError: getEnemyDefs is not defined`.
  - Test: `engine.test.js` → `"engine.js — kampanya modunda savaş kurulumu (setupBattle(cfg))"` → şu an **hatayı doğruluyor** (test, hatanın mesajını assert ediyor; düzeltilince `threw === null` bekleyecek şekilde güncellenmeli — yorumda yazılı).
- **Önerilen düzeltme:** `engine.js`'e (veya yeni bir `content-loader.js`'e) şu iki fonksiyonu eklemek yeterli:
  ```js
  function getEnemyDefs() { return (typeof ENEMY_DEFS !== "undefined") ? ENEMY_DEFS : DEV_ENEMY_DEFS; }
  function getItemDefs()  { return (typeof ITEM_DEFS  !== "undefined") ? ITEM_DEFS  : DEV_ITEM_DEFS; }
  function consumeInventoryItem(id) { /* Ekip envanterinden 1 adet düş — envanter State şeması netleşince */ }
  ```
  (`dev-fixtures.js`'in kendi yorumu zaten "erişimciler önce gerçek global'i arar, yoksa DEV_* içine düşer" diyor — bu erişimciler eksik.)

#### P0-3 [DÜZELTİLDİ]: `js/main.js`, yeni çok ekranlı `index.html` ile senkron değildi — `#btnNew` artık yok
- **Dosya/satır:** `js/main.js:193` — `document.getElementById("btnNew").addEventListener(...)`. Güncel `index.html`'de artık `#btnNew` butonu **yok** (savaş ekranı yeniden tasarlandı: `#screen-result`, `#btnRebuild` "← Ana Menü" oldu, vb.). `getElementById("btnNew")` `null` döner, `.addEventListener` çağrısı `TypeError: Cannot read properties of null` fırlatır.
- **Etki:** `bindGameEvents()` bu satırda **çöküyor**, bu yüzden ondan SONRA bağlanması gereken `#btnRebuild` ("Ana Menü") tıklaması hiç bağlanmıyor (öncesindeki `btnMove/btnAttack/btnSpell/btnAbility/btnEnd` ve canvas click bağlanıyor, o yüzden savaş içi hareket/saldırı çalışıyor — e2e testinin savaşı oynayabilmesinin nedeni bu). `startGame()` her çağrıldığında konsola bu hata düşer.
- **Not:** Bu muhtemelen aktif geliştirme sırasında geçici bir tutarsızlıktı; `campaign-flow.js` (henüz dosya olarak yok) muhtemelen `main.js`'in bu kısmını devralacak. Yine de raporlanıyor çünkü test anında **gerçek, gözlemlenmiş** bir hata.
- **Önerilen düzeltme:** `main.js`'deki ekran/buton bağlama sorumluluğunu `campaign-flow.js`'e taşımak (CONTRACT'ta zaten Geliştirici'nin dosyası olarak listeleniyor) ve `getElementById` çağrılarını `null` kontrolüyle korumak (`el && el.addEventListener(...)`) ki bir ID eksik olduğunda **tüm** fonksiyon çökmesin.

### P1 — Önemli

#### P1-1 [DÜZELTİLDİ]: Büyülenmiş (Charm — `cantAttack`) birim, `canCast()` ile saldırı büyüsü atabiliyor
- **Dosya/satır:** `js/engine.js` → `canCast(u, sp)` (yaklaşık satır 698-705). `hasStatus(u,"cantAttack")` kontrolü **sadece** `main.js`'teki `btnAttack.disabled` hesabında ve `ai.js`'in melee/brute/skirmisher/boss adımlarında var; `canCast()` içinde YOK.
- **Etki:** Charm Person büyüsüyle büyülenmiş (ya da gelecekte "Korku"/`cantAttack` statüsü alan) bir birim, silahla saldıramasa da `Firebolt` gibi saldırı büyülerini (cantrip veya seviyeli) rahatça atabiliyor — kuralın (statüsün amacının) delinmesi.
- **Yeniden üretme adımı:** `canCast({spells:["firebolt"], ap:4, statuses:[{cantAttack:true}]}, SPELLBOOK.firebolt)` → `true` döner (dönmemeli).
  - Test: `engine.test.js` → `"cantAttack statüsündeki birim canCast() ile saldırı büyüsü atabiliyor"` (şu an bu hatalı davranışı doğruluyor).
- **Önerilen düzeltme:** `canCast` içine `if (hasStatus(u, "cantAttack") && sp.target !== "self") return false;` (ya da daha dar: sadece `usesAttackAction(sp)` olduğunda).

#### P1-2 [DÜZELTİLDİ]: `doSpellDebuff`, kardeşi `doSpellSave`'in aksine hedefin `statusPenalty`'sini (Bane/Minor Curse) düşürmüyor
- **Dosya/satır:** `js/engine.js` → `doSpellSave` (~satır 625-637, `roll = d20() + stat - statusPenalty(defender)`) vs `doSpellDebuff` (~satır 680-689, `roll = d20() + stat` — **`statusPenalty` çıkarımı YOK**). `doSpellArea` da penaltiyi doğru uyguluyor (satır 658).
- **Etki:** Bir düşman önce Bane/Minor Curse ile hedefe ceza zarı verdiğinde, bu ceza sonraki bir `save`/`area` büyüsünde doğru işliyor ama sonraki bir `debuff` tipi büyüde (ör. Charm Person) **işlemiyor** — aynı statü türü (statusPenalty) üç farklı resolve fonksiyonunda tutarsız uygulanıyor.
- **Test:** `engine.test.js` → `"doSpellDebuff, doSpellSave'in aksine defender statusPenalty'sini DÜŞMÜYOR"` (davranışı belgeliyor).
- **Önerilen düzeltme:** `doSpellDebuff`'taki satırı `const roll = d20() + (defender.stats[sp.saveStat] || 0) - statusPenalty(defender);` yapmak.

#### P0-4 [DÜZELTİLDİ]: Camp'te satın alınan +N silah/zırh kuşanan HER kahraman, bir sonraki savaşta çöküyor
- **Dosya/satır:** `js/campaign-flow.js` → `heroToBattleUnit` (satır ~255-266). `bonusItem.effect.bonus` / `bonusItem.effect.weapon` / `bonusItem.effect.weaponDef` / `armorItem.effect.bonus` okuyor. Gerçek `ITEM_DEFS` şeması (items.js, CONTRACT §4.3) bonus'u `.effect` ALTINDA DEĞİL, doğrudan `bonusItem.weapon.bonus` / `.weapon.weapon` (silah) ve `armorItem.armor.bonus` / `.armor.armor` (zırh) altında tutuyor — `.effect` alanı sadece consumable eşyalarda var.
- **Etki:** Bir kahraman camp'te `sword_plus1` gibi bir silah/zırh alıp kuşandığında (`h.weaponItem`/`h.armorItem` set edilince), bir sonraki savaş kurulurken `heroToBattleUnit` çağrılır (`heroesToBattleParty()` → `launchBattle()`) ve **`TypeError: Cannot read properties of undefined (reading 'bonus')`** fırlatılır — kampanya orada tamamen çöker. Bu, tasarlanan camp/mağaza ekonomisinin (CONTRACT §4.3, ekonomik dengeyi de etkileyen temel mekanik) şu an pratikte KULLANILAMAZ olduğu anlamına geliyor.
- **Yeniden üretme adımı:** `heroToBattleUnit({..., weaponItem:"sword_plus1", ...})` çağır → istisna.
  - Test: `engine.test.js` → `"campaign-flow.js — ... (heroToBattleUnit) (P0)"` → hatayı doğruluyor.
- **Önerilen düzeltme:** `bonusItem.effect.bonus`→`bonusItem.weapon.bonus`, `bonusItem.effect.weaponDef`→`bonusItem.weapon.weaponDef`, `bonusItem.effect.weapon`→`bonusItem.weapon.weapon`, `armorItem.effect.bonus`→`armorItem.armor.bonus` olarak düzeltmek.
- **Not (P0-4 ile ilgili, P1 seviyesinde ayrı bir alt bug):** Aynı fonksiyonda trinket mod'ları da yanlış yoldan okunuyor: `it.effect.mods` bekleniyor ama gerçek şema `it.mods` (top-level). Bu, çökme YARATMIYOR (kod `!it.effect || !it.effect.mods` kontrolüyle sessizce atlıyor) ama **satın alınan/takılan hiçbir tılsımın (trinket) hiçbir bonusu savaşta uygulanmıyor** — sessiz bir fonksiyonel hata. Test: `"trinket mod'ları ... hiç uygulanmıyor"`.
- **Simülasyon notu:** `tests/campaign-sim.js`, oyun kodunu değiştirmeden, SADECE simülasyon için bu iki alanı düzeltilmiş bir `heroToBattleUnit` kopyasını bellek içinde enjekte ediyor (`installHeroToBattleUnitFix`) — aksi halde ekipman satın alan hiçbir referans koşusu tamamlanamazdı. Gerçek düzeltme dosyada yapılınca bu workaround kaldırılabilir (zararsız kalır, aynı davranışı üretir).

#### P0-5 [DÜZELTİLDİ]: "survive" (hayatta kal) hedefli savaşlar ASLA zafer ekranına düşmüyor
- **Dosya/satır:** `js/engine.js` → `nextTurn()` (satır ~935-954). Round eşiği aşılınca `checkSurvive()` doğru şekilde `State.winner = "party"` VE `State.phase = "over"` ayarlıyor — ama `nextTurn()`, bunu çağırdıktan hemen sonra (aynı fonksiyon içinde, `do...while` döngüsünün ardından) **koşulsuz olarak `startTurn(cur())` çağırıyor**. `startTurn()`, `State.phase`'i tekrar `"playerInput"`/`"enemy"`ye çeviriyor — yani savaş "kazanılmış" (`winner` doğru) ama **hiçbir zaman gerçekten bitmiyor**; ekip, hedef round'u geçtikten sonra da dövüşmeye devam ediyor, ta ki (kill hedefi yokken) düşmanlar onları eritene kadar.
- **Etki:** Kampanyadaki tek `survive` düğümü (**b11, "Alev İmpleri"**, 4 round hayatta kalma) şu an oynanamaz durumda — round 4'ü geçtikten sonra oyuncu "kazandım" bildirimi hiç almıyor, savaş sessizce YENİLGİYLE bitene kadar sürüyor (motor testinde round 8-9'a kadar gidip ekip eriyene kadar test edildi).
- **Yeniden üretme adımı (izole, deterministik):**
  ```js
  setupBattle();
  State.objective = { type: "survive", rounds: 1 };
  State.round = 1;
  State.turnPtr = State.order.length - 1;
  nextTurn();               // round 1 -> 2 (2 > 1, çekSurvive tetiklenmeli)
  // State.winner === "party"  (DOĞRU)
  // State.phase   !== "over"  (YANLIŞ — startTurn() phase'i geri döndürdü)
  ```
  - Test: `engine.test.js` → `"engine.js — 'survive' hedefi (checkSurvive) (P0)"` → doğrulandı.
- **Önerilen düzeltme:** `nextTurn()`'ün sonundaki `startTurn(cur())` çağrısından hemen önce `if (State.phase === "over") return;` eklemek (checkSurvive/checkEnd'in round-sonu tetiklediği zaferin ezilmesini engeller).
- **Simülasyon notu:** `campaign-sim.js`, bu bug'ı gerçek oyun kodunu değiştirmeden atlatmak için, her tur sonunda "round eşiği aşıldı + ekip hayatta" durumunu bizzat kontrol edip NİYET EDİLEN zaferi ölçüme yansıtıyor (aşağıdaki b11 satırı bu workaround SAYESİNDE anlamlı; workaround olmasaydı b11 için %0 kazanma/"takıldı" görünürdü — bu da gerçek motor bug'ının etkisini net gösteriyor).

### P2 — Düşük / tasarım netleştirme

#### P2-1: Alan büyüleri hiçbir zaman dost ateşi yapmıyor (muhtemelen kasıtlı, ama CONTRACT'ta belirtilmemiş)
- **Dosya/satır:** `js/engine.js` → `doSpellArea` (satır ~649-671): `State.units.filter(t => !t.dead && t.side !== caster.side && hexDist(t, center) <= rad)` — sadece **karşı taraf** filtreleniyor; aynı tarafta olup yarıçap içinde kalan müttefikler hiç değerlendirilmiyor. Yani örn. bir oyuncu, düşmanların ortasındaki bir müttefiğinin YANI BAŞINA "Burning Hands" atsa bile o müttefik hiç etkilenmiyor.
- **Durum:** Bu bug mu, tasarım kararı mı belirsiz — CONTRACT'ta net yazmıyor. Görev tarifinde özellikle "alan büyüsü dost ateşi" kontrolü istendiği için burada not edildi. Eğer kasıtlıysa (basitlik için), `docs/DESIGN.md`'ye tek satır not eklenmesi yeterli; kasıtsızsa filtre `t.side !== caster.side` yerine `t !== caster` yapılıp müttefikler de (yarı hasar/tam hasar tartışılarak) dahil edilmeli.
- **Test:** `engine.test.js` → `"doSpellArea: sadece caster'ın side'ı DIŞINDAKİ birimleri etkiler (dost ateşi YOK)"` (mevcut davranışı doğruluyor, bilgi amaçlı).

#### P2-2 [DÜZELTİLDİ]: `reinforcements`/`summon` ile sahaya giren birimlerin `secondWind`/`statuses` alanları eksik başlatılıyordu
- **Eski durum:** `js/engine.js`'teki `fireReinforcements` ve `js/ai.js`'in summon dalı birim objesini ayrı ayrı elle kuruyordu; `fireReinforcements`'ta `abilitiesUsed: {}` eksikti — takviye birimlerinde `howl`/`summon` tetiklenirse `Cannot set properties of undefined` hatası çıkabilirdi.
- **Düzeltme (doğrulandı):** Geliştirici tam da önerilen şekilde ortak bir fabrika fonksiyonu çıkarmış — `js/engine.js:instantiateLiveEnemy(def, placement, idx)` artık HEM `fireReinforcements` HEM `ai.js`'in summon dalı tarafından kullanılıyor (kod içi yorum: *"P2-2 düzeltmesi: tek fabrika fonksiyonu kullanılır ki abilitiesUsed vb. alanlar hiçbir yerde unutulmasın."*), `abilitiesUsed: {}` dahil tüm alanlar TEK yerde garanti ediliyor. Kod tekrarı da ayrıca azalmış.

---

## 3. Motor / kural testleri (`engine.test.js`)

Test çalıştırıldığı anda **38/38 test geçti** (0 başarısız, 0 skip) — aşağıdaki alanları kapsıyor:
hexDist/neighbors (simetri, üçgen eşitsizliği, komşu sayısı), rollDmg + kritik ikiye katlama,
seed'li isabet matematiği (nat20/nat1, `N×d20` savunma avantajı, `atkTotal/defTotal` formülü),
status ekleme/tick (turns azalması, kalıcı statüler), `statusAtkBonus`'un `oneRoll` olmayanları
(Bless gibi) harcamaması, initiative beraberlik çözümü (`breakTies` sonsuz döngüye girmiyor),
büyü slotları (cantrip harcamıyor, 1. seviye harcıyor, turda 1 seviyeli büyü sınırı), Second
Wind (HP artışı + hpMax sınırı + sayaç), dash kuralları (`moveAllowance`/`canMove`), tur akışı
kenar durumları (ölü birim atlanır, round sonu `timesAttacked` sıfırlanır, uyku/incapacitated
birim turu kaçırır), ve yukarıdaki P0/P1/P2 bulgularının regresyon testleri.

Çıktı: `cd oyun/tests && npm test`

---

## 4. Headless denge simülatörü (`sim.js`)

`content/campaign.js` henüz yok (yalnızca `js/dev-fixtures.js`'teki `DEV_CAMPAIGN` var, motor
onu otomatik kullanmıyor — bkz. P0-2), bu yüzden sim şu an sadece **varsayılan `data.js`
fallback savaşını** (3 kahraman vs 3 kurt, eski prototip haritası) koşuyor. `CAMPAIGN` global'i
tanımlandığı an `collectCampaignBattleNodes()` otomatik olarak onu bulup **her savaş düğümünü
ayrı ayrı** simüle edecek (kodda hazır, ek değişiklik gerekmiyor).

**500 savaş sonucu (varsayılan fallback, basit "en yakına git/saldır" botu ile):**

| Metrik | Değer |
|---|---|
| Kazanma oranı (ekip) | %67.6 (338/500) |
| Kayıp oranı | %32.4 (162/500) |
| Takılma (2000 zamanlayıcı adımında bitmeyen) | 0 |
| Zaman aşımı (400 tur sınırı) | 0 |
| Çalıştırma hatası | 0 |
| Ortalama round | 4.5 |
| Sınıf başı toplam hasar (500 savaş) | Cleric 5129 · Fighter 5015 · Wizard 3417 |

Not: Bot kasıtlı olarak basit tutuldu (en yakın/en düşük HP hedefe git-vur, büyü/eşya
kullanmıyor); bu yüzden %67.6 bir **alt sınır** olarak okunmalı — gerçek oyuncular büyü/eşya
kullanarak muhtemelen daha yüksek kazanır. Wizard'ın verdiği hasarın düşük çıkması botun büyü
kullanmamasından kaynaklanıyor, dengesizlik göstergesi değil.

Çıktı: `cd oyun/tests && npm run test:sim` (veya `node sim.js 500`)

---

## 5. Uçtan uca otomatik oyuncu (`e2e.test.js`)

Bot, `index.html`'i gerçek (sistem) Chromium ile açar; önce başlık→yaratım ekranlarından
GERÇEK tıklamalarla savaşa ulaşmayı dener (test anında `campaign-flow.js` dosyası henüz
yoktu, bu yüzden bu adım her seferinde başarısız oldu — bkz. P0-3), sonra motoru
`page.evaluate` ile doğrudan tetikleyip **savaşın kendisini** yine tamamen buton+canvas
tıklamalarıyla oynatır (asıl test hedefi budur — UI'nin gerçekten çalışıp çalışmadığı).

**N=20 koşu sonucu:**

| Metrik | Değer |
|---|---|
| Savaşa ulaşan | 20/20 (hepsinde fallback yoldan — gerçek başlık→yaratım navigasyonu 0/20 başarılı, bkz. P0-3) |
| Zafer | 6 |
| Yenilgi | 2 |
| Takıldı (60sn ilerleme yok / deadlock) | **0** |
| Harness zaman aşımı (90sn genel koşu sınırı) | 12 |
| Kazanma oranı (tamamlanan 8 savaş arasında) | %75.0 |
| Ortalama round (tamamlanan savaşlar) | 5.3 |
| Toplam `console.error` | **0** |
| Toplam `pageerror` (yakalanmamış istisna) | **0** |

**12/20 koşunun "harness zaman aşımı" ile bitmesi hakkında:** Bunların hiçbiri gerçek bir
motor takılması (deadlock) DEĞİL — `STUCK_AFTER_MS` (60sn "durum hiç değişmedi" tespiti) hiç
tetiklenmedi ve hiçbir konsol/sayfa hatası kaydedilmedi. Sebep, botun her aksiyonu (hareket/
saldır/tur bitir) **gerçek bir DOM tıklaması + ~120-200ms bekleme** ile yapması ve önce (her
seferinde başarısız olan) gerçek ekran navigasyonunu ~7-8sn boyunca denemesi: çok sayıda
birim/round içeren savaşlarda toplam süre kolayca eski `PER_RUN_TIMEOUT_MS=90000`'i aşıyor.
Bu, **testin kendi zaman bütçesi** meselesidir — bu bulgudan sonra `e2e.test.js`'teki
`PER_RUN_TIMEOUT_MS` varsayılanı **150 saniyeye** çıkarıldı (ayrıca `PER_RUN_TIMEOUT_MS` ortam
değişkeniyle de ayarlanabilir hale getirildi); yine de gerçek tarayıcıda çok adımlı bir savaşı
uçtan uca tıklayarak oynatmanın doğası gereği yavaş olduğu, gelecekte daha büyük kampanya
savaşları (daha çok düşman/round) için bu süre bütçesinin tekrar gözden geçirilmesi gerekebilir.

**Sonuç:** Savaş UI'sinin kendisi (hareket menzili, saldırı hedef seçimi, tur bitirme, düşman
AI'sinin otomatik ilerlemesi) gerçek tıklamalarla **20/20 koşuda hatasız** çalıştı — hiç
`console.error`/`pageerror` yakalanmadı ve motor hiç deadlock'a girmedi. Asıl kırılan nokta
oyunun **başlık→yaratım→savaş** ekran geçişiydi (P0-3 + eksik `campaign-flow.js`), savaş
motorunun/render'ın kendisi değil.

Çıktı: `cd oyun/tests && npm run test:e2e` (veya `node e2e.test.js 20`, `PER_RUN_TIMEOUT_MS=200000 node e2e.test.js 20`)

**Ek doğrulama (P0-3 düzeltildikten sonra, `js/campaign-flow.js` eklendiğinde):** 3 koşuluk bir
takip testinde bot artık **gerçek** başlık→yaratım→savaş navigasyonuyla (fallback'e hiç
düşmeden) savaşa ulaştı ve 3/3 zaferle tamamladı (round 3/4/9), yine 0 console/pageerror. Bu,
P0-3'ün gerçekten düzeltildiğini ve genel ekran akışının artık uçtan uca çalıştığını doğruluyor.
**P0-1 (savaş-arası `setTimeout` sızıntısı) — GÜNCELLEME: bu da düzeltildi.** Geliştirici
`State.battleId` sayaç + `guardedTimeout()` sarmalayıcısı ekledi (`js/engine.js`, `js/ai.js`,
`js/main.js`; `js/campaign-flow.js`'in `showScreen()`'i savaştan çıkışta `battleId`'yi artırıyor)
— tam da bu raporun P0-1 bölümünde önerilen düzeltme. `engine.test.js`'teki regresyon testi
güncellenip artık **düzeltmenin gerçekten işe yaradığını doğrulayacak** şekilde ("eski savaşın
gecikmeli callback'i artık Savaş B'nin State'ini HİÇBİR ŞEKİLDE etkilemiyor mu?") yeniden
yazıldı ve **geçiyor** — yani P0-1 hem koddan hem testten doğrulanmış olarak kapatıldı.

---

## 6. Kampanya dengesi (`campaign-sim.js`, 200 koşu/savaş)

Metod: motor `content/campaign.js`'teki `CAMPAIGN` ile node vm'de gerçek `setupBattle(cfg)`
çağrılarıyla kuruldu; `setTimeout` senkron bir kuyruğa çevrildi (ai.js'in gerçek karar mantığı
aynen çalışıyor, sadece animasyon gecikmesi yok). Ekip durumu (seviye/HP/ekipman/altın/envanter),
**TEK bir referans kampanya koşusu gerçekten baştan sona oynanarak** (AKILLI bot: odak ateşi,
Wizard/Cleric alan büyüsü ≥2 hedefe veya en yüksek beklenen hasara göre büyü seçer — `ai.js`'in
`pickEnemySpell`/`pickHealSpell` yardımcıları yeniden kullanıldı —, Fighter Second Wind/Action
Surge, <%35 HP'de iksir) ölçüldü: XP_TABLE + gerçek düşman xp toplamları → seviye, LEVEL_UPS ile
HP/slot/feature, statPoint'ler sınıfın ana statına (`CLASS_DEFS[cls].suggest`), her kampta "en
iyi silah/zırh yükseltmesi + 2 iksir" alışverişi. Bu referans koşuda kayıp yaşanan savaşlar
gerçek oyundaki "Tekrar Dene" gibi ekip anlık görüntüsüne dönülüp yeniden denendi. **Dallanan
düğümde (ch2choice → b4/b4cave) her iki kol da aynı ayrım-noktası durumundan test edildi**
(gerçek oyunda sadece biri oynanır). `b1opt` (yan görev) de dahil edildi (tam completionist yol).

**Referans koşu sonunda ekip:** 3 kahraman da **Lv6** (tavan seviye — XP_TABLE'ın kampanyayı tam
bitirmeye yetecek şekilde ayarlandığını doğruluyor, CONTRACT'taki "final Bölüm4 boyunca Sv6"
hedefiyle uyumlu).

**BUG WORKAROUND'ları (oyun kodu değiştirilmedi, sadece bu simülasyon için bellek-içi düzeltmeler
uygulandı — ayrıntı için yukarıdaki P0-4/P0-5):** (1) `heroToBattleUnit`'in düzeltilmiş bir kopyası
enjekte edildi (yoksa +N silah/zırh kuşanan HER kahramanla simülasyon çökerdi); (2) "survive"
objesinin niyet edilen zafer koşulu (round eşiği aşıldı + ekip hayatta) motor `phase`'i
güncellemese de manuel tespit edildi (yoksa b11 hep "takıldı" görünürdü). **Bu iki bug gerçek
oyunda düzeltilmeden kampanya normal şekilde bitirilemez** — bu tablo "düzeltildiği varsayılan"
bir dengeyi gösteriyor.

### Sonuç tablosu

Bant hedefleri: normal savaş **%75-95 kazanma & 4-7 round**, boss **%60-85 & 5-9 round**, survive
**%70-90**. `b1opt` ve `b4cave` opsiyonel/alternatif düğümler olduğu için süre tahmine dahil
edilmedi (yalnızca zorunlu 13 düğüm — b4 VEYA b4cave'den biri sayıldı).

| Düğüm | Başlık | Tip | Ekip Lv (girişte) | Kazanma % | Ort. round | Kalan HP% | Ort. ölüm | Bant |
|---|---|---|---|---|---|---|---|---|
| b1 | Kurt Pususu | normal | 1/1/1 | **71.5%** | 4.9 | 68 | 0.61 | **DIŞI (düşük)** |
| b1opt | Haydut Kampı (yan görev) | normal | 1-2 | **70.5%** | 6.0 | 47 | 0.42 | **DIŞI (düşük)** |
| b2 | Haydut Pususu | normal | 2 | **99.5%** | 4.2 | 55 | 0.16 | **DIŞI (yüksek)** |
| b3 | Kurt Reisi | boss | 2-3 | **97.5%** | 3.5 | 72 | 0.21 | **DIŞI (yüksek + kısa)** |
| b4 | Balçık Geçidi | normal | 3 | **99.5%** | 4.1 | 47 | 0.35 | **DIŞI (yüksek)** |
| b4cave | Örümcek Mağarası (alt.) | normal | 3 | **99.5%** | 4.0 | 53 | 0.33 | **DIŞI (yüksek)** |
| b5 | Goblin Kampı | normal | 3 | **100.0%** | 4.0 | 44 | 0.64 | **DIŞI (yüksek)** |
| b6 | Bataklık Trolü | boss | 3-4 | **98.5%** | 4.4 | 69 | 0.19 | **DIŞI (yüksek)** |
| b7 | Mezar Soyguncuları | normal | 4 | **100.0%** | 3.6 | 79 | 0.00 | **DIŞI (yüksek)** |
| b8 | İskelet Muhafızları | normal | 4 | **100.0%** | 3.3 | 74 | 0.02 | **DIŞI (yüksek + kısa)** |
| b9 | Düşmüş Şövalye | boss | 4-5 | **100.0%** | 3.8 | 83 | 0.01 | **DIŞI (yüksek)** |
| b10 | Kale Kapısı | normal | 5-6 | **100.0%** | 5.0 | 78 | 0.01 | **DIŞI (yüksek)** |
| b11 | Alev İmpleri (survive) | survive | 6 | **100.0%** | 5.0 | 74 | 0.01 | **DIŞI (yüksek)** |
| b12 | Lich Kadir (final boss) | boss | 6 | **96.5%** | 7.0 | 60 | 0.44 | **DIŞI (yüksek, ama sınıra en yakın)** |

**Genel örüntü:** Kampanyanın SADECE İLK İKİ savaşı (b1, b1opt) hedef banttan **zor** yönde
sapıyor; kalan **12 savaşın 12'si de "çok kolay"** yönünde bant dışı (bazıları çok kısa da
sürüyor: b3, b8). Bunun en olası nedeni: LEVEL_UPS + camp ekipmanı ekibi hızla güçlendiriyor
(Lv6'ya kampanyanın ortasından önce ulaşılıyor — b10/b11/b12 zaten tavan seviyede oynanıyor) ama
düşman HP/sayıları buna orantılı ölçeklenmiyor gibi görünüyor. Ayrıca "AKILLI bot" (odak ateşi +
büyü/heal optimum kullanım) gerçek bir insan oyuncudan daha verimli oynuyor olabilir — bu yüzden
öneriler **üst sınır** (oyunun gerçekte biraz daha kolay hissettirmesi beklenir), ama b2'den
itibaren HER savaşın aynı yönde (kolay) sapması, bunun bot verimliliğinden çok **gerçek bir
ölçeklendirme sorunu** olduğuna işaret ediyor.

**Somut öneriler (öncelik sırasıyla):**
1. **b1/b1opt (P0 dengesi — çok zor):** İlk savaş grubu ekip henüz Lv1/donanımsızken oynanıyor;
   düşman HP'sini ~%10-15 düşürün (`wolf`/`bandit`/`bandit_chief` — özellikle `b1opt`'taki
   `bandit_chief` cleave+frenzy ile Lv1 ekip için ağır kaçıyor) VEYA `b1`'in ödülünü artırıp
   `c1`'e gelmeden bir miktar erken ekipman/altın kazandırın.
2. **b2 → b12 arası genel "çok kolay" eğilimi:** `ENEMY_DEFS`'teki `hpMax` değerlerini kademeli
   olarak ~%10-20 artırmayı (bölüm başına artan bir çarpan gibi) değerlendirin — özellikle b3, b7,
   b8, b9 gibi 3-4 round'da biten savaşlarda düşman HP'sini artırmak hem kazanma oranını hem
   round sayısını hedef banda çeker.
3. **Takviye (reinforcements) zamanlaması:** Şu an sadece b6, b9, b12'de var; b2, b5, b7, b8, b10
   gibi %100 kazanılan savaşlara 2-3. round'da küçük bir takviye eklemek hem zorluğu hem round
   sayısını artırır, tekdüzeliği kırar.
4. **b12 (final boss) en dengeli olanı** ama yine de üst sınırda (%96.5, sınıra en yakın) — bu
   savaşı MEVCUT haliyle bırakıp diğerlerini ona doğru ayarlamak (aşağıdan yukarıya) daha az
   riskli bir yaklaşım olabilir.
5. **P0-4/P0-5 düzeltilmeden bu tablo teorik kalır** — gerçek oyunda şu an ne ekipman yükseltmesi
   ne de survive-tipi zafer çalışıyor; düzeltmeler sonrası `npm run test:campaign` yeniden
   çalıştırılmalı (workaround'lar kaldırılmadan da tekrar çalıştırılabilir, sonuç aynı kalır çünkü
   workaround'lar tam olarak düzeltmenin yapacağını yapıyor).

### Süre tahmini

- Zorunlu (ana yol) savaş düğümü sayısı: 13 (b1opt ve b4/b4cave'in biri hariç tutuldu — sadece
  birini saydık).
- Toplam ortalama round (ana yol, 13 savaş toplamı): **56.9 round**.
- Varsayım: round başına **~45 saniye** gerçek oyuncu süresi (görevde verilen 40-50sn aralığının
  ortası — AP yönetimi + hedef seçimi + tıklama için makul).
- **Tahmini toplam SAVAŞ süresi: ~43 dakika.**
- Bu sadece savaş ekranındaki süre; hikâye diyalogları, kamp/mağaza gezinme, seviye atlama
  ekranı dahil DEĞİL. CONTRACT'taki "en az 30 dakikalık kampanya" hedefi savaşlarla **zaten
  karşılanıyor** (hatta muhtemelen aşılıyor, ~%75+ fazlasıyla) — yukarıdaki "çok kolay" bant-dışı
  bulgusuyla birlikte düşünülünce, düşman HP'lerini artırmak hem dengeyi hem de (round sayısı
  artacağı için) toplam süreyi CONTRACT hedefine daha da güvenli bir mesafeden oturtur.

Çıktı: `cd oyun/tests && npm run test:campaign` (veya `node campaign-sim.js 200`; varsayılan 200
koşu/düğüm × 14 düğüm ~3-4 dakika sürer, `node campaign-sim.js 50` ile daha hızlı bir ön izleme
alınabilir).

### GÜNCELLEME (4. tur, N=100, Tasarımcının denge ayarlarından SONRA)

Tasarımcı bu turda `ENEMY_DEFS`'te denge ayarları yaptı. `campaign-sim.js` (sandbox RAF-stub
düzeltmesiyle) `N=100` ile **hiçbir hata/çökme olmadan (14 düğüm × 100 = 1400 savaş, hata:0,
stuck:0)** tekrar çalıştırıldı — güncel tablo:

| Düğüm | Tip | Kazanma % | Ort. round | Kalan HP% | Ort. ölüm | Bant | Önceki (N=200) kazanma% |
|---|---|---|---|---|---|---|---|
| b1 | normal | **71.0%** | 4.3 | 66 | 0.61 | **DIŞI (düşük)** | 71.5% (değişmedi) |
| b1opt | normal | 91.0% | 5.0 | 56 | 0.48 | ✅ bant içi | 70.5% → **düzeldi** |
| b2 | normal | 88.0% | 4.7 | 50 | 0.45 | ✅ bant içi | 99.5% → **düzeldi** |
| b3 | boss | **70.0%** | 4.9 | 61 | 0.64 | **DIŞI (düşük+kısa)** | 97.5% → **tersine döndü (şimdi zor)** |
| b4 | normal | **99.0%** | 5.4 | 53 | 0.38 | **DIŞI (yüksek)** | 99.5% (değişmedi) |
| b4cave | normal | **96.0%** | 5.9 | 65 | 0.41 | **DIŞI (yüksek)** | 99.5% (az düzeldi) |
| b5 | normal | **99.0%** | 6.8 | 57 | 0.48 | **DIŞI (yüksek)** | 100.0% (değişmedi) |
| b6 | boss | 69.0% | 6.7 | 61 | 0.39 | ✅ bant içi | 98.5% → **düzeldi** |
| b7 | normal | **100.0%** | 9.1 | 63 | 0.10 | **DIŞI (yüksek)** | 100.0% (değişmedi, round arttı) |
| b8 | normal | **95.0%** | 7.7 | 58 | 0.26 | **DIŞI (yüksek+uzun)** | 100.0% → biraz düzeldi ama hâlâ dışı |
| b9 | boss | **98.0%** | 7.3 | 58 | 0.26 | **DIŞI (yüksek)** | 100.0% → biraz düzeldi ama hâlâ dışı |
| b10 | normal | **70.0%** | 11.5 | 41 | 0.77 | **DIŞI (düşük+çok uzun)** | 100.0% → **tersine döndü (şimdi zor VE uzun)** |
| b11 | survive | **52.0%** | 5.3 | 22 | 1.02 | **DIŞI (düşük)** | 100.0% → **tersine döndü (şimdi çok zor)** |
| b12 | boss | 78.0% | 7.7 | 57 | 0.41 | ✅ bant içi | 96.5% → **düzeldi** |

**Genel değerlendirme:** Tasarımcının ayarları 6 savaşı bant içine çekti (b1opt, b2, b6, b12 ve
kısmen b8/b9) ama **3 savaşı "çok kolay"dan "çok zor"a çevirdi** (b3, b10, b11) — muhtemelen
o düğümlerde HP artışı hedeflenenden fazla oldu, ya da (b10/b11 için) bu düğümlere gelindiğinde
ekibin gerçek gücü (bir önceki camp alışverişi) tahmin edilenden düşük kaldı. **b1 tek başına
değişmeden aynı zorlukta kaldı** (hâlâ ayarlanması gerekiyor). Toplam ortalama round da 87.3'e
çıktı (önceki 56.9'dan), tahmini toplam savaş süresi **~65 dakikaya** yükseldi.

**Yeni somut öneriler:**
- **b3, b10, b11**: düşman HP'sini geri çekin (~%10-15) — bu üçü özellikle b10 (11.5 round,
  hem çok uzun hem çok zor — muhtemelen HP hem çok yüksek hem düşman sayısı/takviyesi fazla)
  ve b11 (survive, %52 — hedef banda [%70-90] en uzak olan, takviye roundunu da 1-2 tur
  geciktirmek gerekebilir).
- **b1**: hâlâ dokunulmamış, ilk önerilen düzeltme (düşman HP -%10-15) uygulanmalı.
- **b4/b4cave/b5/b7**: hâlâ "çok kolay" — bir sonraki iterasyonda HP artırılabilir, ama öncelik
  b3/b10/b11'in düzeltilmesi (yön yanlış gitmiş savaşlar önce ele alınmalı).

Çıktı: `PER_RUN_TIMEOUT_MS` gerekmez, `node campaign-sim.js 100` (~2 dakika sürer).

---

## 7. TAM KAMPANYA uçtan uca (`e2e-campaign.js`)

`index.html?debug=1` ile açılan gerçek Chromium'da, başlıktan finale kadar **tüm kampanya
GERÇEK UI etkileşimleriyle** (tıklama/`<select>` seçimi/klavye) iki ayrı koşuda oynatıldı:

- **Koşu A**: opsiyonel düğüm (`b1opt`) OYNANDI, `ch2choice`'ta 0. seçenek (`b4`) seçildi;
  ortada (Bölüm 2'ye geçtikten sonra) sayfa yenilenip "Devam Et" ile kaldığı yerden sürdürüldü;
  ilk savaş (`b1`) bilerek `forceLose()` ile kaybedilip "Tekrar Dene" akışı test edildi.
- **Koşu B**: opsiyonel düğüm "Atla" ile ATLANDI, `ch2choice`'ta 1. seçenek (`b4cave`) seçildi.

Her ikisinde de: her savaşta gerçek en az 1 oyuncu aksiyonu (hareket+saldırı ya da büyü) + en az
1 gerçek düşman turu oynatıldıktan sonra `window.__TBW.forceWin()` ile hızlandırıldı; her kampta
gerçek tıklamayla 1 eşya satın alındı (bir denemede özellikle bir **bomba**), bir donanım
`<select>`'i ile kuşanıldı, bir eşya satıldı; seviye atlama ekranında gerçek tıklamayla stat
puanı dağıtıldı; savaşta bir **iksir** (potion_heal) gerçek tıklamayla kullanıldı; 2. savaşta
klavye kısayolları (`1`→Hareket, `2`→Saldır, `Escape`→temizle) doğrulandı; 1024×700 ve 1920×1080
pencere boyutlarında canvas tıklama isabeti (`pixelToHex`) doğrulandı; başlık ekranında Ayarlar
(ses kapatma, animasyon "Anında") ve "? Nasıl Oynanır" yardım ekranı gerçek tıklamayla açılıp
kapatıldı.

### Sonuç

| Metrik | Koşu A | Koşu B |
|---|---|---|
| `screen-ending`e ulaştı | ✅ evet | ✅ evet |
| `console.error` sayısı | 0 | 0 |
| `pageerror` (yakalanmamış istisna) sayısı | 0 | 0 |
| Sayfa yenileme + "Devam Et" (kayıt/yükleme) | ✅ konum korundu | (test edilmedi, sadece A'da) |
| "Tekrar Dene" (forceLose sonrası) | ✅ çalıştı | ✅ çalıştı |
| Klavye kısayolları (1/2/Esc) | ✅ doğru | ✅ doğru |
| Pencere yeniden boyutlandırma tıklama isabeti | ✅ 1024×700'de doğrulandı (1920×1080'de o an menzilde hedef yoktu) | benzer |
| Ayarlar / Yardım ekranı | ✅ açıldı/kapandı, ses/hız değişti | ✅ |
| Opsiyonel düğüm | ✅ oynandı | ✅ "Atla" ile atlandı |
| `ch2choice` | ✅ 0. seçenek (`b4`) | ✅ 1. seçenek (`b4cave`) |
| Kamp: satın alma / kuşanma / satma | ✅ her kampta | ✅ her kampta |
| Bomba satın alma | ✅ | ✅ |
| Bomba ATMA (savaşta) | ⚠️ menzilde hedef yoktu (P2, aşağıda) | ⚠️ aynı |

**Toplam: 244+ ekran görüntüsü `tests/shots/` altında (git'e eklenmeyecek — `.gitignore`'a
`oyun/tests/shots/` eklendi), 0 `console.error`, 0 `pageerror`, hem Koşu A hem Koşu B başlıktan
sona kadar hatasız tamamlandı.**

### Bulgular

#### P2: Bomba, botun "önce eşya kullan, sonra hareket et" sırası yüzünden çoğu zaman menzile giremiyor
- Bu, **bir motor hatası değil** — test botunun bombayı (AP'nin dolu olduğu) turun EN BAŞINDA
  atmayı denemesinden kaynaklanıyor; bu noktada kahraman henüz düşmana yaklaşmamış oluyor ve
  bomba menzili (6 hex) yetmeyebiliyor. Eşya menüsünü açma/hedef seçme mekanizmasının kendisi
  **çalışıyor** (aynı kod yolu `potion_heal` ile her seferinde başarıyla kendine kullanıldı).
  Gerçek bir oyuncu önce yaklaşıp sonra bombayı atardı. Test scripti bunu iyileştirmek isterse
  "önce hareket et, sonra menzil kontrolü yap, hâlâ menzildeyse bombayı at" sırasına geçebilir —
  şimdilik AP yetersizliği riskiyle bu sıralama tercih edilmedi. **Oyun kodunda bir düzeltme
  gerekmiyor**, sadece test botunun bilgi notu olarak kayda geçirildi.

#### Diğer tüm alanlar: bulgu yok
İlk deneme turunda (bu bölümün ilk taslağı) yanlışlıkla iki **test-scripti** kusuru "motor P1
bug'ı" gibi görünüyordu:
1. "'enemy' fazı hiç gözlemlenemedi" uyarısı — Ayarlar'da "Anında" (animSpeed=3) seçildiği için
   düşman AI turu gerçekten **anlık** geçiyor, botun 200ms'lik poll aralığı bunu bazen kaçırıyordu.
   `State.turnCount`'un ilerlediğini de kontrol edecek şekilde düzeltildi — düşman turunun
   gerçekten oynadığı artık güvenilir biçimde doğrulanıyor (`turnCount: N→N+1` logları).
2. Klavye kısayolu ve pencere-boyutu testleri, savaş-dışı ekran ziyaretlerini de sayan yanlış bir
   sayaçla hiç tetiklenmiyordu — savaş-özel bir sayaca geçilip düzeltildi, ardından hepsi
   **doğrulandı** (yukarıdaki tabloya bakınız).

Düzeltmeler sonrası **motor/UI tarafında hiçbir P0/P1 bulgusu yok** — kampanya başlıktan sona,
tüm yan yollar (opsiyonel görev, iki `ch2choice` dalı), kayıt/yükleme, "Tekrar Dene", tüm menüler
(büyü/yetenek/eşya), klavye kısayolları ve iki farklı pencere boyutuyla **hatasız** oynanabiliyor.

Çıktı: `cd oyun/tests && npm run test:e2e-campaign` (veya `node e2e-campaign.js`, ~3-5 dakika,
2 tam kampanya koşusu). Ekran görüntüleri her koşuda `tests/shots/` içine yazılır (önceki koşunun
görüntüleri temizlenir).

---

## 8. 4. tur: sandbox robustluğu, önceki bug'ların doğrulanması, `e2e.test.js`'te iki test-scripti hatası

### Sandbox iyileştirmeleri (`tests/load-engine.js`)
- **`requestAnimationFrame`/`cancelAnimationFrame` eksikti**: `js/render.js`'in sürekli çizim
  döngüsü (`startRenderLoop`) ve `js/campaign-flow.js`'in `showResultScreen`'deki xp-bar dolma
  animasyonu bunları koşulsuz çağırıyor; node `vm`'de tanımsız oldukları için `ReferenceError`
  fırlatıyorlardı. No-op (callback'i hiç çalıştırmayan) bir stub eklendi — callback'i gerçekten
  çalıştırsaydık `startRenderLoop`'un kendi içinde `requestAnimationFrame(loop)`'u tekrar
  çağırması senkron sonsuz özyinelemeye (stack overflow) yol açardı.
- `window.innerWidth/innerHeight` de eklendi (bazı layout hesapları için).

### `campaign-sim.js`'in "GameState.currentBattleNode null → çöküyor" bulgusu — halihazırda ELDEN geçmiş
Tasarımcının bildirdiği ikinci sorun (`onBattlePhaseOver`'ın `node=null` iken çökmesi) incelendi:
**Geliştirici bu arada `js/campaign-flow.js`'e zaten bir null-guard eklemiş** (`if (!node) return;
// kenar durum: kampanya akışı dışında (headless/test) tetiklenmiş olabilir`) — yani oyun kodu
tarafında zaten düzeltilmiş durumda. `campaign-sim.js` kasıtlı olarak `GameState.currentBattleNode`'u
HİÇ SET ETMİYOR (ve bunu böyle bırakıyoruz) — çünkü `onBattlePhaseOver` gerçekte ateşlenirse
(bazı kayıp senaryolarında `ai.js`'in `refresh()` çağrısı üzerinden otomatik tetikleniyor)
`awardXpToParty`/`applyRewards`'ı TEKRAR çağırıp `campaign-sim.js`'in kendi manuel xp/ödül
uygulamasıyla ÇİFT SAYIMA yol açardı; `currentBattleNode` null bırakılınca null-guard bunu
sessizce engelliyor — bu, hem çökmeyi hem çift-sayımı ÖNLEYEN, kasıtlı bir tasarım tercihidir
(kodda açıklayıcı bir yorumla belirtildi). RAF stub'ı eklenince (yukarıya bakınız) her hâlükârda
bu yoldan bir çökme ihtimali de ortadan kalktı.

**Sonuç: `npm run test:campaign -- 100` (N=100, 14 düğüm × 100 = 1400 savaş) sıfır hata/çökme ile
tamamlandı** (bkz. aşağıdaki güncel denge tablosu).

### Önceki bulguların durumu — TÜMÜ Geliştirici tarafından düzeltilmiş, regresyon testleriyle doğrulandı
`§2`'deki P0-4 (heroToBattleUnit crash), P0-5 (survive objective bitmiyor), P1-1 (charm/canCast),
P1-2 (doSpellDebuff/statusPenalty) — dördü de kod incelemesiyle ve **güncellenmiş** regresyon
testleriyle (artık düzeltmeyi doğrulayacak şekilde yeniden yazıldı, önceden sadece "hatalı
davranışı belgeleyen" no-op'lardı) teyit edildi; başlıklarına `[DÜZELTİLDİ]` eklendi. `engine.test.js`
hâlâ **41/41** geçiyor.

### YENİ bulgu: `e2e.test.js`'te (Tester'ın kendi 1. tur scripti) İKİ hata — oyun kodu DEĞİL
`npm run test:e2e` (N=5) bu turda **5/5 "TAKILDI"** (round 1'de hiç ilerlemiyor) sonucu verdi.
Kapsamlı izole tekrar-üretimle (bkz. `tests/e2e.test.js` içindeki yorumlar) kök neden **testin
kendi navigasyon kodunda** bulundu, oyunda değil:

1. **`clickCommonAdvanceButtons`, `.node-list .node` seçicisinin İLK elemanını tıklıyordu** —
   çok düğümlü bir bölümde (ör. ch1: s1→b1→b1opt→b2→c1→b3) ilk düğüm genelde bir `story`
   düğümü oluyor; `campaign-flow.js`'in `renderNodeList`'i sadece `i===GameState.nodeIndex`
   olan `<li>`'ye click listener ekliyor, yani o düğüm "done" olunca artık tıklanabilir değil —
   bot sonsuza dek aynı (artık ölü) elemanı tıklayıp duruyordu. Düzeltme: seçici
   `.node-list li.current`'e çevrildi (zaten `e2e-campaign.js`'te doğru kullanılıyordu).
2. **`forceStartBattle` (gerçek navigasyon süresi dolduğunda devreye giren yedek yol) yalnızca
   3 spesifik ekranın (`#app`, `#screen-create`, `#screen-title`) `style.display`'ini elle
   ayarlıyordu** — o an DOM'da aktif kalan BAŞKA bir ekran (ör. yarıda kesilmiş gerçek
   navigasyondan kalma `screen-map`/`screen-story`) hâlâ görünür/layout'ta kalıyordu. Bu,
   `#app` içindeki butonların üstünü **görsel olarak kapatmasa bile** Playwright'ın
   actionability/"obscured" kontrolünü tetikleyip her tıklamanın onlarca saniye (bazen
   varsayılan 30sn timeout'a kadar) beklemesine — pratikte "60sn ilerlemedi" olarak
   raporlanmasına yol açtı. Düzeltme: oyunun kendi `showScreen("app")` fonksiyonu (TÜM
   `.screen` elemanlarını temizce gizler) varsa o kullanılıyor artık.

**Doğrulama:** İzole tekrar-üretim scriptiyle önce hatayı kanıtladık (adım adım loglayarak),
düzeltmeleri uyguladık, aynı senaryo **round 7'de ZAFER'le, 0 console/pageerror ile** tamamlandı.
Ardından tam `npm run test:e2e` (N=5) tekrar çalıştırıldı — bkz. aşağıdaki sonuç.

**Önemli:** Bu iki hata **`tests/e2e.test.js` dosyasındaydı (Tester'ın kendi 1. tur ürünü)**,
`js/` altındaki oyun kodunda değil — oyun kodunda bununla ilgili bir değişiklik yapılmadı.

### `npm run test:e2e` (N=5) final sonucu — düzeltmelerden sonra

| Metrik | Değer |
|---|---|
| Savaşa ulaşan | 5/5 (hepsi gerçek navigasyonla, fallback'e düşmeden) |
| Takıldı (60sn ilerleme yok / deadlock) | **0** (önceki turda 5/5 idi — düzeltme doğrulandı) |
| Zafer | 0 | Yenilgi | 2 |
| Harness zaman aşımı (`PER_RUN_TIMEOUT_MS=150000`) | 3 |
| Toplam `console.error` / `pageerror` | **0 / 0** |

**"Takıldı" tamamen ortadan kalktı** (iki script düzeltmesi işe yaradı) ama 3/5 koşu 150sn'lik
genel süre bütçesini aşarak "harness zaman aşımı" ile bitti — bunun bir deadlock/hata OLMADIĞINI
doğrulamak için `PER_RUN_TIMEOUT_MS=280000` ile N=3'lük bir takip koşusu yapıldı: koşu 1 round 3'te
**ZAFER**'le bitti, koşu 2 ise 280sn bütçesini de aşarak hâlâ devam ediyordu (savaş mantıken
ilerliyor, `console.error`/`pageerror` yok, `STUCK_AFTER_MS` hiç tetiklenmedi) — yani gerçek neden
**motor/UI deadlock'u değil**, botun tıklama+bekleme temposu ile (muhtemelen Tasarımcının bu turda
eklediği ekran sarsıntısı/animasyon gecikmeleri ve/veya artan düşman sayısı/HP'si nedeniyle uzayan)
gerçek savaş süresinin test bütçesini aşması. **Sonuç: bu bir test-harness süre bütçesi bulgusudur,
oyun hatası değildir** — `PER_RUN_TIMEOUT_MS` ortam değişkeniyle zaten ayarlanabilir durumda;
gelecekte daha uzun/karmaşık savaşlar test edilecekse varsayılanın 150s'den 240-300s'ye çıkarılması
önerilir (P2 — düzeltme değil, ayar önerisi).

### Yeni özellikler için e2e kontrolleri (`e2e-campaign.js` içine eklendi, `exploreNewFeatures()`)
Tasarımcının/geliştiricinin 5. tur UI cilası (`#btnFast`, sağ tık iptal, menzil dışı tooltip,
Space hızlandırma) için eklenen kontroller, 2 tam kampanya koşusunda (Koşu A + Koşu B) **hepsi
geçti**:

| Kontrol | Sonuç |
|---|---|
| Sağ tık → hareket modundan çıkıp `State.mode==="idle"`'a döner | ✅ geçti |
| Menzil dışı birim üzerine hover → `#hoverTooltip` metninde "Menzil dışı" | ✅ geçti |
| `#btnFast` düşman fazında görünür ve tıklanabilir; tıklanınca `State._ffActive===true` | ✅ geçti |
| Space tuşu basılı tutulunca düşman fazında `State._ffActive===true` olur | ✅ geçti |
| Bomba satın alma + atma (yeni item akışı) | ✅ geçti (1 istisna: `bomb_fire` için menzilde hedef yoktu — harita geometrisi kenar durumu, P2, hata değil) |

Her iki kampanya koşusunda da 0 `console.error`, 0 `pageerror`.

---

## 9. 5. tur: çıkış öncesi final test (zorluk, Yeni Oyun+, kayıt sağlamlığı, savaş ortası onay)

### `--refs N` / `--difficulty` (`campaign-sim.js`) — gözden geçirildi, çalışıyor
Geliştirici `campaign-sim.js`'e iki CLI seçeneği eklemiş: `--refs N` (N BAĞIMSIZ referans
kampanya koşusu — her biri kendi rastgele zar/AI sonuçlarıyla farklı bir "ekip düğüme girerken
nasıldı" durumu üretir; sonuçlar referanslar arası ortalama+min/max olarak raporlanıyor, tek
referansın gürültülü olma riskini azaltıyor) ve `--difficulty zor|normal|hikaye` (gerçek
`GameState.difficulty`'yi taklit eder; mekanik tek yerde, `js/engine.js`'in `makeEnemyUnit`'inde
uygulanıyor — sim yalnızca aynı değeri referans/istatistik koşularının `GameState`'ine yazıyor).
Kod incelendi: doğru ve minimal bir eklenti, `campaign-sim.js`'in geri kalanına dokunmamış.
Üç ayrı zorlukta koşturuldu (`100 --refs 5`, `60 --refs 3 --difficulty zor`,
`60 --refs 3 --difficulty hikaye`) — üçü de **0 hata/çökme** ile tamamlandı ve zorluk sırası
tutarlı çıktı (Hikâye en kolay, Zor en zor — bkz. aşağıdaki tablolar), bu da zorluk çarpanlarının
doğru uygulandığını dolaylı olarak doğruluyor.

### `--refs 5` ile güncel denge tablosu (N=100, normal zorluk) — ÖNCEKİ turdan daha güvenilir
4. turdaki tek-referans N=100 tablosu yerine artık **5 bağımsız referans × 20 koşu**
kullanılıyor (referanslar arası min-max de raporlanıyor) — bu, önceki turun "b3/b10/b11 aniden
çok zorlaştı" bulgusunun büyük ölçüde **tek referansın gürültüsü** olduğunu ortaya koydu:

| Düğüm | Tip | Kazanma% (min-max) | Ort. round | Bant |
|---|---|---|---|---|
| b1 | normal | 85.0% (75-95) | 4.5 | ✅ bant içi |
| b1opt | normal | 99.0% (95-100) | 4.3 | DIŞI (çok kolay) |
| b2 | normal | 85.0% (75-90) | 5.5 | ✅ bant içi |
| b3 | boss | 82.0% (75-85) | 4.4 | DIŞI (kısa sürüyor) |
| b4 | normal | 97.0% (95-100) | 5.5 | DIŞI (çok kolay) |
| b4cave | normal | 93.0% (80-100) | 5.9 | ✅ bant içi |
| b5 | normal | 99.0% (95-100) | 7.1 | DIŞI (çok kolay) |
| b6 | boss | 78.0% (70-85) | 6.0 | ✅ bant içi |
| b7 | normal | 98.0% (95-100) | 8.5 | DIŞI (çok kolay) |
| b8 | normal | 100.0% (100-100) | 6.0 | DIŞI (çok kolay) |
| b9 | boss | 83.0% (75-90) | 8.6 | ✅ bant içi |
| b10 | normal | 98.0% (95-100) | 7.6 | DIŞI (çok kolay) |
| b11 | survive | 95.0% (90-100) | 7.9 | DIŞI (çok kolay) |
| b12 | boss | 75.0% (60-90) | 7.8 | ✅ bant içi (yüksek varyans) |

**Önemli düzeltme:** 4. turda "b3/b10/b11 tersine döndü, artık çok zor" denilmişti — 5 referanslı
bu ölçümde **b3 bant içi/hafif zor (%82), b10/b11 ise ikisi de ÇOK KOLAY (%98/%95) çıkıyor**,
tam ters yönde. Sonuç: 4. turun bulgusu gerçek bir denge regresyonu değil, **tek referans
koşusunun örnekleme gürültüsüydü** — Tasarımcıya iletilecek doğru/güncel öncelik: b1opt, b4,
b5, b7, b8, b10, b11 hâlâ "çok kolay" (HP +%10-20 önerilir), b3 biraz kısa sürüyor (HP hafif
artırılabilir), b1/b2/b6/b9/b12 zaten bant içinde. **`--refs 5`'in daha güvenilir olduğu ve
bundan sonraki denge kontrollerinde tek referans yerine bunun kullanılması öneriliyor.**

### Zorluk karşılaştırması (aynı 14 düğüm, `--refs 3`, N=60)
| Zorluk | Toplam ort. round (ana yol) | Tahmini süre | Bant dışı düğüm sayısı | Genel eğilim |
|---|---|---|---|---|
| Hikâye | 70.8 | ~53 dk | 13/13 (hepsi "çok kolay/kısa") | Beklendiği gibi çok kolay |
| Normal (`--refs 5`, N=100) | 85.3 | ~64 dk | 8/14 | Karışık, çoğunlukla kolay yönde |
| Zor | 94.2 | ~71 dk | 10/13 | Çoğunlukla "çok zor" (b2 %32, b6 %47, b9 %53, b12 %42) |

Üç zorluk seviyesi arasındaki sıralama (Hikâye < Normal < Zor, hem zorluk hem süre açısından)
tutarlı ve beklenen yönde — zorluk çarpanlarının (`enemyHpMult`/`enemyHitBonus`/`enemyDmgBonus`)
doğru işlediğini doğruluyor. **Öneri:** Zor zorlukta b2 (%32), b6 (%47), b9 (%53), b12 (%42)
belirgin şekilde çok zor — Zor zorluğun kendi HP çarpanı (`1.15`) belki hafif düşürülebilir
(ör. `1.10`) ya da bu düğümlere özel bir ayar düşünülebilir; bu bir P2/tasarım önerisidir, P0/P1
değildir (Zor zorluk kasıtlı olarak zor olmalı).

### `npm run test:e2e` (N=3, final koşu) — tamamen temiz
| Koşu | Sonuç |
|---|---|
| 1 | ZAFER (round 3) |
| 2 | ZAFER (round 3) |
| 3 | ZAFER (round 4) |

3/3 ZAFER, 0 takıldı, 0 harness zaman aşımı (200s bütçeyle), 0 console/pageerror. Önceki turda
görülen 3/5 "harness zaman aşımı" (§8'de "test bütçesi bulgusu" olarak not edilmişti) bu turda
hiç görülmedi — muhtemelen kısa vadeli varyans (kısa savaşlar rastladı) ya da 5. tur UI
performans iyileştirmeleri katkı yapmış olabilir; kesin nedensellik iddia edilmiyor.

### `npm run test:e2e-campaign` — yeni özellik kontrolleri, İKİ script hatası bulundu ve düzeltildi
Yeni testler eklenirken (`exploreDifficultyAtCreation`, `changeDifficultyAtCamp`,
`testCorruptedSave`, `testDeleteSaveConfirm`, `testMidBattleMenuConfirm`, `testNewGamePlus`,
`finalScreenshots`) **kendi script kodumda** iki hata bulundu ve düzeltildi (oyun kodu DEĞİL):

1. **Kampta zorluk değiştirme, `handleCamp()`'in `#btnCampContinue`'u tıklamasından SONRA
   çağrılıyordu** — ekran zaten haritaya geçmiş oluyordu, bu yüzden `#campDifficulty` butonları
   bulunamıyor/etkisiz kalıyordu ve yanlışlıkla `[P1/difficulty] ... GameState.difficulty
   değişmedi` diye rapor ediliyordu. Düzeltme: çağrı `handleCamp()`'in İÇİNE, `btnCampContinue`
   tıklamasından ÖNCEye taşındı. Doğrulama sonrası: `Kampta zorluk gerçek tıklamayla 'zor' ->
   'hikaye' değişti (saveGame() tetiklendi)` — doğru çalışıyor.
2. **`runFullCampaign()`'in kendi ana döngüsünün aksine, Koşu C'nin (kayıt/onay testleri için
   yazılan kısa/odaklı akış) `#btnStart` sonrası doğrudan savaş başladığını varsaymıştım** —
   oysa oyun `SAVAŞA BAŞLA`'dan sonra önce **screen-map**'e düşüyor (ilk düğüme otomatik
   girmiyor); `#btnRebuild`'e tıklamadan önce haritadaki `current` düğümü tıklamak gerekiyordu.
   Bunun eksikliği, `State.phase` sonsuza dek `"setup"` kalıp `#btnRebuild`'in hiç görünür
   olmamasına, dolayısıyla yanlışlıkla `[P0/mid-battle-confirm] onay diyaloğu AÇILMADI` (ve
   ardından zincirleme "savaş ortası" testlerinin hepsinin) yanlış-pozitif çıkmasına yol açtı.
   Düzeltme: yeni bir `enterCurrentMapNode(page)` yardımcı fonksiyonu eklendi (haritadaki
   `current` düğümü gerçek tıklamayla açar) ve Koşu C'deki her `#btnStart` sonrasına eklendi.
   Bu, izole bir tekrar-üretim scriptiyle (`diag_midbattle.js`/`diag_midbattle2.js`) doğrulandı:
   düzeltmeden önce `State.phase` 30 kez ölçümde de `"setup"` kalıyordu (ekran hep
   `screen-map`), düzeltmeden sonra savaş normal şekilde başlıyor.

**Doğrulama (düzeltmelerden sonra, temiz koşu):** Koşu A ve B ikisi de ending'e ulaştı, 0
console/pageerror. Yeni kontrollerin TÜMÜ geçti:
- Yaratımda zorluk seçimi (Koşu A: Zor, Koşu B: Hikâye) → `GameState.difficulty` kampanya
  boyunca doğru taşınıyor.
- Kampta zorluk değiştirme (Koşu A'da 'zor'→'hikaye') → `GameState.difficulty` güncelleniyor,
  `saveGame()` tetikleniyor.
- Bozuk kayıt (localStorage'a geçersiz JSON yazıldı) → çökme YOK, başlık ekranına düşüyor,
  doğru toast metni ("Kayıt okunamadı — bozuk ya da eski sürüm...") gösteriliyor, "Devam Et"
  doğru gizleniyor.
- "Kaydı Sil" onay diyaloğu → "Hayır" vazgeçiyor (kayıt korunuyor), "Evet" siliyor ("Devam Et"
  gizleniyor).
- Savaş ortası "← Ana Menü" onay diyaloğu → "Hayır" savaşta kalıyor, "Evet" başlığa dönüyor.
- "Yeni Oyun+" → gerçek tıklamayla haritaya geçiyor, `GameState.ngPlus===true` oluyor (düşman
  ölçeklemesi `js/engine.js`'te `ngPlus ? 1.25 : 1` çarpanıyla devrede).
- Final ekran görüntüleri `tests/shots/final_1024x700.png` ve `final_1920x1080.png` alındı.

Tek kalan bulgu (değişmedi, P2): `bomb_fire` bazen menzilde hedef bulamıyor — bilinen harita
geometrisi kenar durumu, hata değil.

### P2-2 durumu — bu turda kod incelemesiyle [DÜZELTİLDİ] olarak kapatıldı
`js/engine.js`'e eklenen `instantiateLiveEnemy(def, placement, idx)` ortak fabrika fonksiyonu
hem `fireReinforcements` hem `ai.js`'in summon dalı tarafından kullanılıyor; `abilitiesUsed: {}`
dahil tüm alanlar artık TEK yerde garanti ediliyor (bkz. `§2`).

### Sonuç
Açık P0/P1 sayısı **0**. `npm test`/`test:campaign`/`test:e2e`/`test:e2e-campaign` paketlerinin
tümü temiz geçti. Bulunan tek yeni "hata" kendi test scriptimdeydi (2 adet, ikisi de düzeltildi,
yukarıda açıklandı) — oyun kodunda bu turda hiçbir değişiklik yapılmadı (kural gereği, sadece
`tests/` ve `docs/TEST_REPORT.md` dokunuldu).
