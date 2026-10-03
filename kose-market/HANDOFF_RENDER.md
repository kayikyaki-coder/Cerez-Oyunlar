# Görsel ajan için devir notu (mekanik → render.js / style.css / bubbles.css / sfx.js)

Mekanik ajan `render.js`, `style.css`, `bubbles.css`, `sfx.js` dosyalarına **dokunmadı**. Aşağıdakiler motorun (`js/engine.js`) yaydığı
yeni olaylar, durumlar ve çizilmesi gereken şeylerdir. `main.js` tüm `Render.*` çağrılarını "varsa çağır" ile yapar: render.js güncellenmeden de oyun kırılmaz.
Bilinmeyen olay tipleri `Render.handle` içinde yok sayılmalı (switch'te `default` yok → sorun değil).

## 1) `Render.handle(ev)` — yeni olaylar (payload → ne çizilmeli)
| olay | payload | çizim önerisi |
|---|---|---|
| `bubblePop` | `{x, y, reward, combo, golden, special}` (mantıksal 960×540 baloncuk konumu) | Para parçacıkları HUD kasasına uçsun; `special:"crisis"` ise (reward 0) bozuk para yerine soru işareti parıltısı |
| `theft` | `{productId, qty, value, emoji}` | Şüpheli müşteri (şapka/gözlük) ilgili ürün rafından `qty` adet kapıp kapıdan koşsun; raf zaten `Game.state.stock`'tan azalır |
| `thiefCaught` | `{auto, productId}` | `auto:true` → kamera flaşı/alarm; değilse Pamuk/tezgâhtar yakalasın (yıldız, "yakalandı!") |
| `breakdown` | `{equip: "fridge"\|"register"}` | Dolap: ışık söner, kıvılcım/buz damlası, "ARIZALI" etiketi; Kasa: ekran kararır, duman. Kalıcı durum: `Game.state.broken.fridge/register` (bozuk olduğu sürece çizin) |
| `repair` | `{equip, quick}` | Anahtar/tamir animasyonu, kıvılcım biter |
| `salvo` | `{count}` | "Yoğun saat": kapıda kalabalık, zil sesi (sfx) |
| `restock` | `{productId, qty, cost, bulk?}` | `bulk:true` (kriz: toptancı kamyonu) → koli yığını rafa; mevcut acil tedarikte kurye kutusu |
| `spoil` | `{units, now:true}` | Raftaki taze ürünler yeşile/gri solsun (elektrik kesintisi krizi) |
| `crisisOpen` | `{crisis:{id,emoji,title,…}}` | İsteğe bağlı: kriz kimliğine göre dışarıda sahne (aşağıda) |
| `crisisResolve` | `{id, emoji, choice, text, auto, cost}` | Sonuç efekti (jeneratör gürültüsü, kasa kuyruğu erimesi…) |
| `customerMiss` | `reason: "empty" \| "paused" \| "register"` | `register`: müşteri kuyrukta sabırsızlanıp çıksın (bozuk kasa) |

Kriz kimlikleri (`bubble.crisisId` / `crisisOpen.crisis.id`): `kamyon` (kapıda kamyon), `elektrik` (lambalar/dolap ışığı sönsün), `kalabalik` (kapıda yığılma),
`pazarlik` (gezgin satıcı), `denetci` (clipboard'lu memur), `rakipanons` (karşıdan hoparlör), `siparis` (koli), `sizinti` (dolap altında su),
`veresiye` (komşu), `vip` (takım elbiseli), `baskin` (tavandan su).

## 2) Yeni baloncuk türleri (`Render.zonePos(b.zone, b.zoneIndex, b.productId)` ile konumlanır)
`thief` (bölge `shelf`, `b.productId` = hedef ürün: baloncuk o ürünün rafında), `breakFridge` (`fridge`), `breakReg` (`register`), `crisis` (`door`).
Hırsız baloncuğu doğunca o rafın yanında şüpheli bir figür belirmeli (ömrü `b.life` ≈ 3 sn).

## 3) `Render.setDay(plan, state)` — plan'a eklenen alanlar
- `plan.rival = { active, open, share, campaign: {cat, text} | null, lost }` — rakip **Zincir Market** gün 12'de açılır (zorluğa göre 7–17):
  pencerede/karşı köşede mağaza tabelası; `campaign` varsa "KAMPANYA %15" afişi. `share` müşteri payı (0–0.55).
- `plan.heat[productId]` (talep/standart oran), `plan.weights`, `plan.factors` (fiyat çarpanları).

## 4) Durum (`Game.state`) — çizimde okunabilecekler
- `state.prices[id]` (0 Ucuz / 1 Normal / 2 Pahalı) ve `Game.priceOf(id)`: **raf fiyat etiketi artık `p.price` değil `Game.priceOf(id)`** olmalı (indirimde yeşil, zamda kırmızı).
- `state.stock[id]` toplamı yuva sınırlı: `Game.totalSlots()`, `Game.slotsUsed()`, `Game.slotsOf(id)` (şemsiye/pasta/çiçek 2 yuva: daha büyük çizilebilir). `Game.shelfCap()` artık "ürün başına adil pay"dır; raf doluluk ölçeği için `Game.stockTargets(plan)[id]` daha doğru.
- `Game.stockAging(id)` → `{life, tonight, fresh}`: yarın bozulacak adet (rafta "bayat/uyarı" ışıltısı).
- `state.equip.fridge/register` (0–100 durum): düşükse paslı/titreyen görünüm. `state.broken.*` bozuk.
- `state.debt > 0`: kasada/tezgâhta borç defteri; `state.bankrupt` doluysa **kepenk inik + "KAPANDI" tabelası** (akşam `Render.idle(state,"evening")` ve iflas overlay'i arkasında).
- `Game.seasonInfo()` (sonsuz mod sezonu) — köşe tahtasında sezon hedefi gösterilebilir.
- `Game.effects()` yeni anahtarlar: `slots, upkeep, lifeBonus, rivalGuard, thiefAuto, weatherShield, theftMult, wearMult, regWear, rentMult, comboWindow`.

## 5) Yükseltme kimlikleri (sahnede görünmesi gerekenler; `UPGRADES[].scene`)
Yeni: `guvenlik` (köşede kamera + alarm kutusu), `sadakat` (kasada kart standı, `scene: null` → eklenebilir), `depo` (arka kapı/soğuk oda, `scene: null`).
Mevcut sahne anahtarları aynen: `raf, tabela, yazarkasa, paspas, buzdolabi, vitrin, cirak, onluk, kediyatagi, bitkiler, lamba, muzik, tente, buyukacilis`.
`Ek Raf` artık toplam yuvayı artırır (4 seviye) → seviyeye göre ek raf/sepet çizilebilir (`Game.upgradeLevel("raf")`).

## 6) §4 kancaları (brief) — uygulananlar
1. `Render.handle({type:"bubblePop",…})` → `main.js` `Bubbles.onTap` (yalnız pop olduğunda).
2. `#app[data-weather]` (`yagmur|kar|gunes|sicak|bulut|ruzgar`), `#app[data-event]` (olay id'si, boş olabilir), `#app[data-phase]` = `title|morning|day|dusk|evening|finale` (gün ilerlemesi > %72 → `dusk`).
3. `hearts()` → `<i class="hp full|half|empty">` ×5 (`mech.css` içinde yedek ♥ çizimi var; `style.css` kendi `.hp`'sini tanımlarsa o geçerli — mech.css style.css'ten ÖNCE yüklenir).
4. `bubbles.js` kaçırma metni: "Müşteri kaçtı / Satış durdu / ~₺N zarar / Memnuniyet −N / Hırsız mal götürdü / Arıza! Sabah tamir / Fırsat kaçtı" (önde tire yok).
5. `bubbles.js` `minDist`: yatay 64, dikey 84 (elips).
6. Kombo rozeti: `.km-combo-txt > b ("x1.7")` + `<small>KOMBO</small>`.
7. Sahne geçiş sınıfı: gün ekranı açılırken `.stage-card.open`, akşam açılırken `.stage-card.close` (600 ms) eklenir.
8. `index.html` seviye atlama overlay'inde `.lv-confetti` içinde 12 boş `<i>` (mech.css'te yedek konfeti animasyonu var).
9. `DAY_EVENTS[].emoji` hepsi dolu.
10. `UPGRADES[].sceneLevels` eklenmedi (render seviye numarasından türetebilir).

## 7) Ses önerileri (sfx.js)
Hırsız: `Sfx.alarm()` (kaçırılınca) / `Sfx.catch()`; arıza: kısa "pzzt"; kriz kartı açılışı: hafif zil (şu an `Sfx.tap`); salvo: çifte zil; kira günü akşamı: bozuk para sesi; iflas: alçalan nota (`Sfx.miss` kullanılıyor).

## 8) Yeni DOM (style.css'e dokunmadan mech.css ile stillendi; isterseniz üstüne yazın)
`#fin-strip, #equip-panel, #hint-box, #slot-bar, #mech-bar, #crisis-card (sabit alt kart), #ov-diff (zorluk), #ov-bankrupt, .tiers/.tier (fiyat kademesi), .pinfo/.pi (ürün ipuçları), .costs/.crow (akşam hesabı), .weekly/.wk-bars`.
Kriz kartı sabit konumlu (alt-orta); alçak yatay telefonda tam genişlikte alt şerit olur. Dokunma hedefleri ≥ 44 px.
