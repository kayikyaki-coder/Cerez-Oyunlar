# Octo-Shooter test araçları

`index.html`'e **dokunmadan** çalışan araçlar:

| Dosya | Ne yapar | Bağımlılık |
|---|---|---|
| `sim.js` | Headless denge simülatörü (CLI). Normal özet, **`--accept` (DESIGN.md F2, 20 metrik)**, `--cheat`, `--wtest` | Yok (Node 22) |
| `lib/game.js` | index.html → `node:vm` (sahte DOM/canvas, seed'li `Math.random`, köprü script'i) | |
| `lib/bots.js` | F1 botları (kotu, zayif, orta, iyi2, **7** archetype: +kontrol) + referans botlar (`iyi2n`, `ortan`: kalkan/işaret yok) + deney botları (`iyi2s`, `iyi2m`) + eski botlar, mutasyon seçimi, **`makeInputBot`** (autoShield/autoMark), **`arrange`** (Komşu Bağı yerleşimi), **`repairTo`** (Kabuk Onarımı) | |
| `lib/run.js` | Tek koşu, hileli bot kurulumu, tek silah kalabalık testi, düşman zirve testi | |
| `lib/pool.js`, `lib/worker.js` | `worker_threads` havuzu (iş çekme, yük dengeli) | |
| `lib/ratings.js` | Botların silah puanı (oyunun içinde ölçülür, `.cache/` altına yazılır) | |
| `lib/accept.js` | F2 metrikleri → GEÇTİ/KALDI tablosu | |
| `exp.js` | Sabit-yapı deneyleri (bot yok): `syn` (sınıf sinerjisi aç/kapa), `bond` (Komşu Bağı en iyi/en kötü yerleşim), `trk` (tılsım etkisi) | Yok |
| `analyze.js` | `sim.js --json` çıktısı: bot başına medyan/tehditsiz dalga/savuş, alınan hasar kaynakları, boss kaydı, silah seçilme + hasar payı, tılsım alımı (iki dosya = önce/sonra) | Yok |
| `perf.mjs` | F2 #14: Playwright ile dalga N'de fps (1x ve kısıtlı CPU); `--keep N` ekranda N düşman tutar; tavansız tılsımda (`inci`) artık çökmez | `playwright` |
| `smoke.mjs` | Tarayıcı smoke testi (telefon + masaüstü) | `playwright` |
| `mech.mjs` | **Mekanik testi** (masaüstü + telefon dikey/yatay): Komşu Bağı, Kabuk Kalkanı (klavye/dokunma, bekleme, savuş %35 iade, duraklat/2x), Odak İşareti, telegraflar, Kement, baskın, onarım, Kızışan Sular, 44 px dokunma hedefleri, yapışkan Başlat | `playwright` |
| `flow.mjs` | **Gerçek akış testi** (masaüstü, telefon dikey/yatay, 320 px): market → sürükle-bırak → onar → dalga → kalkan/işaret → 4x gerçek dalgalar → boss + mutasyon → oyun bitti → rekor → yeniden başlat; konsol hatası, yatay taşma, kare süresi | `playwright` |
| `qa.mjs` | Görsel/UX kalite kontrolü: düşman/boss sahneleri, mutasyon, market, HUD/banner/rekor, döndürme, metin taraması → `shots/qa/` + `qa-log.json` (`--only 1,3`) | `playwright` |

```bash
cd octo-shooter/tools            # (Playwright araçları için önce başka bir klasöre kopyalayıp orada npm install)
npm install                                   # yalnız playwright (tarayıcı indirmez)
node sim.js --accept                          # F2 kabul tablosu (20 metrik; bot başına 50 koşu, kalkansız referans 16 koşu)
node sim.js --runs 50 --strategy all --json out.json    # normal özet
node smoke.mjs                                # smoke testi
node mech.mjs                                 # mekanik testi (bağ, kalkan, işaret, telegraf, Kement, baskın, onarım, cila, G0 hataları)
node flow.mjs                                 # gerçek akış: market → dalga → boss → mutasyon → oyun bitti → yeniden başlat (4 görünüm)
node exp.js syn|bond|trk                      # sabit-yapı deneyleri
node analyze.js out.json [eski.json]          # sim --json çıktısı özeti / önce-sonra
```
`playwright install` **çalıştırmayın**; Chromium `/opt/pw-browsers` altında hazır. **Repo içinde `npm install` etmeyin**: `tools/` klasörünü geçici bir yere kopyalayıp orada kurun (`node_modules` repoya girmesin).

---

## Kabul modu: `node sim.js --accept`

Adımlar (her biri worker havuzunda paralel):
1. **Tek silah kalabalık testi**: her silah Lv1 ve Lv3, `--wtestReps` (4) tekrar. Tek kol, ölümsüz ahtapot,
   dalga 8 kalabalığı, 40 oyun-sn. Hem #11'i ölçer hem de botların silah puanını üretir.
2. **10 F1 botu × `--runs` (50)** + **hileli bot × `--cheatRuns` (20)**. `maxWave` varsayılanı 45'tir
   (37/38 sınırlarının üstünde; daha geç dalgalar çok pahalı). 45'e ulaşan koşu #7'yi zaten KALDIRIR.
3. **Dalga 30 düşman zirvesi**: sim'deki en derin orta/iyi2 koşusunun son kadrosu, ölümsüz ahtapot, 90 sn, 3 tekrar
   (headless). Ardından aynı build ile `perf.mjs` (Playwright) fps ölçer (`--noPerf` ile atlanır).
4. Metrik tablosu + bot tablosu + kalabalık DPS tablosu; `--json` ile tüm ham veri.

Çıkış kodu: herhangi bir metrik KALDI ise 1.

### Metriklerin tam olarak nasıl ölçüldüğü

| # | Ölçüm | Not |
|---|---|---|
| 1–3 | `orta` botunun ölüm dalgası medyan / p10 / p90 ve medyan süre | yüzdelikler doğrusal ara değerlemeli |
| 4 | `zayif` medyan süre **ve** medyan dalga | ikisi de aralıkta olmalı |
| 5 | `kotu` en erken ölüm dalgası ≥ 8 **ve** en kısa süre ≥ 10 dk | |
| 6 | `iyi2` medyan dalga 28–31 ve medyan süre ≥ 38 dk | |
| 7 | Tüm F1 botlarında en uzun koşu ≤ 37 dalga ve < 52 dk; **hileli bot**: dalga `--cheatWave` (15) başında tüm tılsımlar tavanda (Ek Kol dahil → 10 kol), tüm kollar `--cheatLv` (4) ile en yüksek puanlı farklı türlerle dolu, sonra `orta` gibi oynar; en uzun koşu ≤ 38 | `node sim.js --cheat --runs 20` ayrı mod |
| 8 | **7** archetype (+Kontrol) medyanı: ≥5'i > 20 ve en iyi–en kötü ≤ 5 | Kontrol ailesi artık ölçülüyor (denetimde ölçülmüyordu ve en güçlüsüydü) |
| 9 | Her koşunun **son** dalgasında (ölünen dalga) en çok hasar veren silah **örneğinin** (uid) payı; tüm F1 koşuları | medyan / >%60 oranı / maks |
| 10 | F1 botlarının tüm ölümleri içinde ölüm dalgası 5'in katı olanların oranı | "boss canlıyken ölüm" ayrıca bilgi olarak |
| 11 | Kalabalık testi (dalga 8): Lv3 DPS ≥ 0,6×medyan; ilk 19 dışındaki (yeni) silahlar Lv1'de 0,7–1,3×medyan | `node sim.js --wtest` ayrı mod (Lv1–3 tablosu); dalga 15 varyantı için `--wtestWave 15` (varsayılan 8) |
| 12 | Normal = boss dışı, w≥3, **tamamlanan** dalgaların süre medyanı 40–58 sn; boss dalgası süresi p95 ≤ 75 sn; herhangi bir dalgası > 90 sn süren koşu oranı < %2 | 90 sn güvencesinin "tetiklenmesi" süreden ölçülür |
| 13 | `orta` botunun dalga 20 marketinden sonra elde kalan altın medyanı < 40 | orta 20'ye ulaşmazsa "ölçülemedi" → KALDI. **Altın yutakları** (Kol Cilası, enflasyon, Onar) eklenince bot da harcıyor; eski "1244 altın" sorunu bot politikası değil, oyunda harcanacak yer olmamasıydı |
| 14 | fps: `perf.mjs`, 390x844 DPR2, dalga 30, ölümsüz, 20 sn; **4x CPU kısıtlaması** ile ölçülen fps ≥ 45. Düşman: headless zirve testi ≤ 140 | fps kaba; bkz. sınırlamalar |
| 15 | İlk 19 silahın her biri için: en az bir archetype'ın koşularının ≥ %20'sinde son kadroda (kollarda) var mı | |
| 16 | **Tehditsiz dalga payı** (orta, iyi2, 7 archetype; w6–20; ölünen dalga hariç): hasar yok **ve** kalkan kullanılmadı → ≤ %50 | önceki oyun ≈ %67–91 |
| 17 | **Boss etkisi** (w10–20 boss karşılaşmaları): ahtapota verdiği hasar medyanı ≥ maks canın %8'i **ve** w10/15/20 boss-dalga ölüm payı %5–20 | "ulaşma oranı" yalnız bilgi (Kalamar/Fener menzilden vurur) |
| 18 | **Aktif girdi etkisi**: iyi2 (kalkan 0,8 + işaret) − iyi2n (kalkansız) medyan dalga farkı 0…+3 | `--refRuns` (varsayılan 20; 0 = atla). Orta/ortan farkı da yazılır |
| 19 | **Hasar kaynağı çeşitliliği**: ilk 3 kaynak ≤ %60, tek kaynak ≤ %30 | önceki oyun %76 / %36 (okçu) |
| 20 | **Boss türü başına hasar**: her boss türü karşılaşmaların ≥ %50'sinde ahtapota hasar vermeli | Fener Balığı 0 hasar veriyordu |

Süre = Σ gerçek dalga süresi (1x) + market süresi (dalga 1–5 için 45 sn, sonrası 30 sn; `--shopEarly/--shopLate/--shopEarlyUntil`).
Mutasyon ekranı için ek süre eklenmez.

## Botlar (DESIGN.md F1)

Tasarımcının `bots.js` politikası taşındı. **Tek fark:** statik `RATING` tablosu yerine puan oyundan ölçülür.

**Tılsım fiyatı:** botlar artık `H.price(c)` üzerinden oyunun `trkPrice(t)` fonksiyonunu kullanıyor (varsa);
katlanan fiyatlı (`grow` alanlı, örn. tavansız "inci") tılsımlarda statik `d.price` yerine güncel fiyat okunur.
**Tavansız tılsım (`cap:Infinity`, örn. "inci"):** F1 botları bunu yalnızca kollar doluyken **ve** tavanı olan
diğer tüm tılsımlar zaten tavandayken (harcanacak başka bir şey kalmayınca) alır — aksi halde sonsuza kadar
altın yutup #13 gibi metrikleri anlamsızlaştırırdı.

**#13 (altın birikmesi) çözüldü:** `orta` botunun dalga 20'de ~1200 altın taşıması bot politikası değil, oyunda harcanacak
yer kalmamasıydı. Artık altın yutakları var (Kol Cilası: kol başına 5 kademe +%6 hasar; silah fiyat enflasyonu dalga 12'den
sonra +%4/dalga; Kabuk Onarımı; tavansız İnci) ve botlar cila/onarım alıyor; dalga 20'de elde kalan altın ≈ 40–70.

**İnsan girdisi modeli (autoShield / autoMark / arrange / repair / polish):** gerçek oyunda dalga içi girdi (kalkan, işaret) ve
market kararları (kol yerleşimi, onarım, cila) botların sonuçlarını etkiler; botlar bunları puanlı biçimde modeller:
- `shield` (0–1): büyük (≥ maks canın %4'ü) ve telegraflı/uçan bir hasar 0,55 sn içinde çarpacaksa o tehdit için **bir kez** bu olasılıkla `useShield()` basar; can < %40 iken saniyede ≈ shield/2 panik basışı. kotu 0, zayif 0,2, orta 0,5, iyi/archetype 0,8.
- `mark`: menzildeki Kement > boss > elit hedefi işaretler (orta ve üstü).
- `arrange`: market sonunda kol çiftlerini takas eden tırmanışla Komşu Bağı sayısını artırır (orta ve üstü).
- `repair`: can eşiğin altındaysa (orta 0,5; iyi 0,65; zayif 0,3) Kabuk Onar basar. `polish`: artan altınla en güçlü kolların cilasını alır.
- Referans botlar `iyi2n` / `ortan`: aynı politika ama kalkan/işaret yok → F2 #18 aktif girdinin etkisini ölçer. `iyi2s` (yalnız kalkan), `iyi2m` (yalnız işaret) deney içindir.

- **Silah puanı** = √(tahmini tek hedef DPS × ölçülen kalabalık DPS Lv1), karekök sıkıştırmalı, medyan 18
  (tasarımcı tablosunun ≈6–20 yayılımına yakın). Yeni silah eklenince ya da sayılar değişince kendiliğinden güncellenir.
  Tasarımcının tablosuyla karşılaştırmak için `--rating designer` (bilinen 19 id statik, yeniler ölçülen).
- **Archetype odak listeleri** sınıflardan türetilir: `mermi`=Mermi, `buyuates`=Büyü|Ateş, `yakin`=Yakın, `cubuk`=Çubuk,
  `uzun`=Uzun, `kan`=Kan sınıfındaki türler puana göre ilk 8 (8'den azsa en yüksek puanlı diğerleriyle tamamlanır).
  `iyi2` = en yüksek puanlı 10 tür.
- **Tılsım öncelikleri** id'ye göre (tasarımcı tablosu + `guard/regen/reach` için makul değerler);
  bilinmeyen tılsım id'si `_default` önceliği alır.
- Market: her turda oyunun "Otomatik Birleştir" butonu; alım `buyCard`, satış `#btnSell` (Lv3+ onayı dahil),
  yenileme `#btnReroll` (ücret oyundan okunur). Birleştirmeden sonra yedekteki silah boş kola taşınır (`setSlot`).

| Bot | Kural |
|---|---|
| `kotu` | Rastgele silah, %30 rastgele tılsım, satış/yenileme yok, sadece otomatik birleştirme; mutasyon rastgele |
| `zayif` | Puana göre açgözlü alım, satış/yenileme yok; mutasyon rastgele |
| `orta` | Açgözlü; tekrar eden türe +8, kopya için Lv1 satar, 2 yenileme (≥14 altın), tılsımları kollar dolunca |
| `iyi2` | En güçlü 10 türe odak (+25), 10 yenileme (≥6 altın), Lv2 satabilir |
| `mermi, buyuates, yakin, cubuk, uzun, kan, kontrol` | `iyi` ayarları + 8 türe odak, 6 yenileme (**kontrol** yeni: Kontrol sınıfı 8 tür) |
| `iyi2n`, `ortan` | referans: kalkan/işaret kullanmayan eşler |
| eski: `random, focus, greedy, trinket` | ilk sürümdeki botlar (`--strategy legacy`) |

**Mutasyon seçimi:** `kotu`/`zayif` rastgele; diğerleri hasar > saldırı hızı > can (`basinc` > `refleks` > `ucYurek`;
bilinmeyen id'lerde açıklama metninden: "hasar +" > "saldırı hızı" > "can"; "alınan hasar" hasar sayılmaz).

### Mutasyon hook'u (C6) — gerçek oyunla eşleşiyor (düzeltildi)

Önceki sürüm `MUTATION_STATE` adlı bir state bekliyordu; oyunda öyle bir şey yok, bu yüzden botların
mutasyon tercihleri hiç uygulanmıyor, koşu kaydındaki `mutations` boş kalıyordu. Gerçek hook'lar
(index.html top-level):
- `mutationChoices` — sunulan id dizisi, ekran kapalıyken `null`.
- `isMutationOpen()` — ekran açık mı.
- `pickMutation(idx)` — `idx`'inciyi seçer (`true`/`false` döner), ekranı kapatır; **state SHOP_STATE'te
  kalır** (mutasyon ekranı için ayrı bir state yok).
- `applyMutation(id)`, `MUTATIONS` tablosu (`[{id,name,desc,...}]`), seçilenler `P.perks`'e eklenir.

`lib/game.js`'teki `A.isMutationOpen()` önce oyunun kendi `isMutationOpen()`'ını, yoksa `MUTATION_STATE`'i,
yoksa kart dizisinin doluluğunu kullanır; `A.mutationCards()` zaten `mutationChoices`'ı tanıyordu.
`lib/run.js` artık dalga bitince state'e değil `A.isMutationOpen()`'a bakarak seçim döngüsüne giriyor —
düzeltmeden önce state zaten SHOP_STATE olduğu için döngü hiç çalışmıyordu ve seçilmeden `startWave`
çağrılınca oyun **rastgele** seçiyordu (bkz. index.html 1018: "seçilmeden başlatıldıysa (sim/otomasyon)").

Bot tercihleri (`lib/bots.js`): `kotu`/`zayif` rastgele; diğerleri hasar > saldırı hızı > can
(`basinc` > `refleks` > `ucYurek`; bilinmeyenlerde açıklama metninden çıkarım) — bu kısım zaten doğruydu,
sadece hiç çağrılmıyordu.

Dalga sonunda 5 denemeden sonra ekran hâlâ açıksa ya da `pickMutation` yoksa koşu anomaliyle kesilir.
Seçilen mutasyonlar koşu kaydında `mutations: ["<sonraki dalga>:<id>", ...]`.

## Normal mod

```
node sim.js --runs 50 --strategy all|legacy|every|orta,iyi2 [--json out.json]
```
Strateji başına ölüm dalgası/süre yüzdelikleri, histogram, silah başına hasar payı, hiç alınmayan silahlar,
koşu sonu sinerjiler, hata/anomali listesi. Silah puanları ilk koşuda ölçülüp `.cache/` altına yazılır.

Diğer seçenekler: `node sim.js --help`. Önemliler: `--file` (başka bir index.html), `--viewport 390x844|1280x800`,
`--fps 60` (30 daha hızlı ama oyunu değiştirir), `--workers`, `--seed`.

Sağlamlık: her 5 oyun-sn'de NaN/Infinity kontrolü; tek dalga 600 oyun-sn'yi aşarsa "takılma"; exception'lar
yığın iziyle kaydedilir. Aynı seed = aynı sonuç (worker sayısından bağımsız). index.html ana iş parçacığında **bir kez**
okunur, yani koşu sırasında dosya kaydedilse bile karışık sürüm koşulmaz. Başlıktaki hash hangi sürümün koşulduğunu gösterir.

## perf.mjs

```
node perf.mjs [--file ../index.html] [--build build.json] [--wave 30] [--cpu 4] [--seconds 20] [--shot]
```
Sayfanın kendi global'leri (`P`, `applyTrinket`, `startWave`) `page.evaluate` ile kullanılır; hook gerekmez.
Build verilmezse en pahalı 10 tür Lv3 ve tüm tılsımlar tavanda. Çıktının son satırı `PERF_JSON {...}`.

## smoke.mjs

390x844 (dokunmatik) ve 1280x800 (fare): yükleme, konsol/pageerror yok, market, satın alma, sürükle-bırak
(ikondan tutarak), dalga başlatma, 10 sn sonra düşman + HUD + canvas, hız butonu. Ekran görüntüleri `shots/`.

## Süre

4 çekirdekte, 1/60 adımla. Koşu maliyeti ulaşılan dalgayla hızla artar, çünkü oyunun `nearestEnemy` döngüsü
kol × düşman kadar döner.
- Mevcut eğride (ölüm ≈ dalga 10–13) `--accept` ≈ 6–8 dk.
- DESIGN B eğrisinde (ölüm ≈ 23–29) bot başına 50 koşu ≈ 30–40 dk.

Hızlı kontrol için `--runs 20` ya da `--fps 30` kullanılabilir. `--fps 30` sonuçları hafifçe kaydırır.

## Bilinen sınırlamalar (dürüst not)

- **Bot ≠ oyuncu.** Hedefleme otomatik olduğu için dalga içi davranış birebir aynıdır. Fark markettedir: botlar
  basit puan kurallarıyla alır, dalga raporuna bakıp düzeltmez, boss'a özel hazırlık yapmaz. Mutlak dalga sayıları
  bot tanımına bağlıdır; F2 hedefleri de bu botlar için tanımlandığından tutarlıdır ama gerçek oyuncu dağılımı değildir.
- **Silah puanı** ölçüme dayanır (tasarımcının elle tahmininden farklı). Bu, özellikle `iyi2` ve archetype listelerini
  değiştirebilir. Tasarımcının tablosuyla karşılaştırmak için `--rating designer`.
- **fps ölçümü kaba.** Headless Chromium bu konteynerde yazılım rasterı kullanır ve CPU'yu paylaşır. 4x CPU kısıtlaması
  "orta telefon" yaklaşımıdır. Gerçek cihazda doğrulanmalıdır. Düşman sayısı ölçümü ise deterministik ve güvenilirdir.
- **Hileli bot** dalga 15'e "ışınlanır"; o ana kadar kazanılacak altın/mutasyon verilmez (tılsımlar/kollar tavanda olduğu için önemsiz).
- **Viewport:** Varsayılan 390x844. Yeni sürümde doğma yarıçapı oyun-biriminde sabit olduğundan fark küçüktür.
- Sahte DOM görsel çıktıyı doğrulamaz; onu smoke testi kapsar. HTML'de olmayan bir id istenirse uyarı yazılır.
