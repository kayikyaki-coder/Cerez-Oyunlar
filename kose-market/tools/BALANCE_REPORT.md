# Köşe Market — Denge Raporu

`node tools/sim.js --seeds 16 --days 90` çıktısından alındı (16 tohum; 30 tohumla da tüm hedefler geçiyor).
Hızlı deneme için: `node tools/sim.js --set anahtar=değer` (BALANCE'ı geçici değiştirir), `--decomp` (oyna−atla farkının kaynakları), `--days-table` (ilk tohumun gün gün tablosu).

## Oyuncu modelleri
| Oyuncu | Davranış |
|---|---|
| gündelik | her gün oynar, baloncukların %70'ine ~1.3 sn'de basar (tek parmak, sırayla) |
| iyi | her gün oynar, %90 isabet, ~0.8 sn tepki |
| hep atla | her günü "Hızlı Geç" ile geçer |
| karışık | günlerin %70'ini oynar (gündelik gibi), kalanını atlar |

Sabah politikası: önce Dengeli Doldur, sonra seviye yettiğinde ve stok yedeği kalıyorsa ürün kilitleri açılır; yükseltmelerde "maliyet × öncelik" skoru en iyi olan hedef seçilir ve parası yetene kadar ona biriktirilir (en ucuzu değil). Final alınabilir olunca başka bir şey alınmaz, finale biriktirilir.
Süre tahmini: oynanan gün = `dayLength` + 25 sn (sabah/akşam), atlanan gün = 15 sn.

## 1. Oyna / atla eşli kâr oranı
Oynanan günün kârı ÷ aynı sabah durumundan klonlanıp atlanan günün kârı (raf değeri dahil). Tohum ortalaması [min–max].

| Oyuncu | Gün 1–15 | Gün 16–35 | Gün 36+ |
|---|---|---|---|
| gündelik | **1.41** [1.31–1.52] | **1.30** [1.25–1.40] | **1.21** [1.19–1.24] |
| iyi | 1.51 [1.40–1.64] | 1.37 [1.33–1.41] | 1.28 [1.23–1.36] |
| karışık %70 | 1.48 [1.35–1.65] | 1.34 [1.27–1.44] | 1.22 [1.18–1.26] |

Farkın kaynakları (gündelik, gün başına): gün 1–15'te kâr 190 vs 135 → baloncuk +31, ek ciro +29 (acil tedarik, sakinler, kaçmayan müşteri; acil tedarik maliyeti −20), hedef ödülü +9, önlenen para cezası +3, bahşiş +4.
Günün hedefini tamamlama oranı: gündelik %55, iyi %67, hep atla %12.

## 2. Kazanma günü ve oyun süresi
| Oyuncu | Kazanan | Kazanma günü medyanı (min–max) | Tahmini süre (dk) |
|---|---|---|---|
| gündelik | 16/16 | **50** (48–51) | **82** (79–84) |
| iyi | 16/16 | **46** (45–47) | 75 (74–77) |
| hep atla | 16/16 | **77** (76–80) | 19 |
| karışık %70 | 16/16 | 56 (52–58) | 67 |

Hep atlayan oyuncu da hiçbir zaman çıkmaza girmiyor: negatif kârlı gün yok, Sv.10'a ~70. günde varıyor.

## 3. Seviye / para / günlük kâr eğrisi (medyan; ₺ = gün sonu kasa)
| Gün | gündelik sv / ₺ / kâr | iyi sv / ₺ / kâr | hep atla sv / ₺ / kâr |
|---|---|---|---|
| 1 | 1 / 149 / 94 | 1 / 159 / 104 | 1 / 111 / 54 |
| 5 | 3 / 299 / 152 | 3 / 366 / 183 | 2 / 186 / 86 |
| 10 | 4 / 532 / 255 | 4 / 566 / 277 | 3 / 307 / 93 |
| 15 | 5 / 618 / 219 | 6 / 680 / 254 | 4 / 328 / 98 |
| 20 | 6 / 982 / 409 | 6 / 1057 / 472 | 5 / 448 / 166 |
| 25 | 7 / 1489 / 722 | 7 / 1710 / 784 | 5 / 704 / 247 |
| 30 | 8 / 1320 / 404 | 8 / 1442 / 543 | 6 / 567 / 153 |
| 35 | 9 / 1611 / 736 | 9 / 2084 / 821 | 6 / 923 / 285 |
| 40 | 9 / 2584 / 1239 | 10 / 2718 / 1332 | 7 / 1062 / 378 |
| 45 | 10 / 3234 / 834 | 10 / 6701 / 884 | 7 / 1153 / 276 |
| 50 | 10 / 6863 / 793 (final alınıyor) | — | 8 / 1130 / 375 |

Para Sv.10'a kadar yükseltmelere gidiyor; ancak Sv.10'dan sonra ~5–6 gün finale (₺6500) biriktiriliyor. Oyun kazanıldığında bile alınmamış yükseltmeler kalıyor (sonsuz mod için).

## 4. Günlük ortalamalar (gündelik oyuncu)
| Gün aralığı | Baloncuk/gün (p10–p90) | Müşteri/gün (p10–p90) | Memnuniyet (gün sonu) | Baloncuk ₺ | Ciro | Kâr |
|---|---|---|---|---|---|---|
| 1–15 | 13.5 (9–17) | 26 (18–35) | 84 | 31 | 288 | 190 |
| 16–35 | 19.9 (16–25) | 43 (28–60) | 96 | 62 | 807 | 475 |
| 36+ | 23.3 (20–27) | 60 (45–77) | 98 | 84 | 1326 | 841 |

Karışık oyuncuda memnuniyet: oynanan günler 84, atlanan günler 59 (atlamak yarının müşterisini de azaltır).
Ekranda en fazla 5 baloncuk (`bubbleMaxOnScreen`).

## 5. Günler farklı mı? (gündelik, gün 16–40; m = müşteri, b = baloncuk)
- Hafta günü: Cuma 55m · Pazar 49m · Cumartesi 49m · Perşembe 47m · Çarşamba 40m · Salı 38m · Pazartesi 37m
- Hava: Güneşli 50m/20b · Sıcak 49m/21b · Bulutlu 46m/18b · Rüzgârlı 43m/22b · Yağmurlu 42m/23b · Karlı 35m/21b
- Olay: Gazete 76m/26b · Derbi 66m/26b · Bayram 60m/23b · Festival 58m/22b · Maç 50m/23b · olaysız 41m/19b · Dizi Finali 42m/17b · Kesinti 31m/22b
- Yayılım: müşteri p10–p90 = 29–65, baloncuk p10–p90 = 16–26
- Baloncuk karışımı havaya göre değişiyor: yağmur/kar → silme %13–16, rüzgâr → etiket %13, sıcak → Pamuk/kuyruk, güneş → bozuk para.

## 6. Yükseltme zamanlaması (gündelik, medyan satın alma günü)
Pamuk'un Yatağı 6 · Tabela 9 · Ek Raf 12 · Bitkiler 13 · Önlük 16 · Tabela-2 21 · Paspas 23 · Raf-2 24 · Yazar Kasa 25 · Lamba 27 · Tabela-3 31 · Toptancı 32 · Buzdolabı 34 · Raf-3 35 · Bitkiler-2 36 · Müzik 36 · Önlük-2 38 · Tabela-4 41 · Çırak 41 · Yazar Kasa-2 42 · Paspas-2 42 · Tente 43 · **Büyük Açılış 50**
İlk günlerde para ürün kilitlerine gidiyor (simit, süt, meyve suyu, çikolata…); sonra yükseltmeler arası ~2–3 gün birikim var, orta oyunda ~1–2 gün.

## Yapılan başlıca değişiklikler (js/data.js)
- **Gün:** `dayLength` 60 → 75 sn (toplam süre ~80 dk olsun diye).
- **Fiyatlar:** satış fiyatları ~%20–37 arttı, alış aynı (birim kâr ~%40–100 arttı) → atlanan günün kârı da anlamlı.
- **Kilit ve yükseltme fiyatları** yaklaşık 2–3 katına çıktı; final (Büyük Açılış) ₺6500; Sv. eşikleri 60/170/350/600/900/1300/1800/2450/3300.
- **Müşteri:** taban 18, gün başına +0.15, seviye başına +1.2; tabela/vitrin müşteri artışları biraz düştü; raf kapasitesi 10.
- **Cezalar yumuşadı:** bozuk para ve buğu → sadece memnuniyet (−2), inatçı leke müşteri kaçırmıyor, kuyruk 1 müşteri; para cezaları küçüldü, `bubblePenaltyPerLevel` 0.05; `satPerMiss` −1.5.
- **Baloncuk ödülü:** seviye çarpanı 0.15 → 0.03 (düz; geç oyunda fark şişmesin). `bubbleRewardMult` düğmesi 1.0.
- **Baloncuk sayısı:** hız 0.10 + 0.012/seviye + 0.0015/gün, tavan 0.25; olay ve havalara `bubbleMult` (sakin günler 0.85–0.9, festival/derbi/denetim 1.15–1.25).
- **Kombo:** pencere 2.5 sn, adım 0.25 (eskiden x1.5'e neredeyse hiç ulaşılamıyordu, kombo hedefleri %0'dı). Kombo hedefleri x1.5 / x1.75.
- **Hedefler:** baloncuk türü hedefleri, o türün o günkü beklenen sayısına göre ayarlandı (ör. denetimde 3 silme + silme ağırlığı ×3.5); tür hedefleri artık günle ölçeklenmiyor; `goalScalePerDay` 0.025.
- **Diğer:** acil tedarik alış çarpanı 1.5, taze ürün bozulması %35, `fillHeadroom` 1.2, sakin 1 adet alır, sakin bahşişi 3.
- **engine.js'e dokunulmadı** (tüm düğmeler motorun zaten okuduğu anahtarlar).
