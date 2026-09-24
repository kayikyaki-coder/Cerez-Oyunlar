# Octo-Shooter v2 — Denge ve İçerik Tasarım Dokümanı

Kaynak: `index.html` (2741 satır), tamamı okundu. Sayılar koddan alındı. Bazı değerler ölçüm: oyun kodu değiştirilmeden headless (Node `vm`, DOM stub) çalıştırıldı, dt = 1/60 ile gerçek `updateWave` kullanıldı ve market kararlarını botlar verdi. Botlar ve ölçüm yöntemi F bölümünde.

**Süre tanımı:** Tüm dakikalar **1x oyun zamanıdır**: dalga süresi + market süresi. Market süresi ilk 5 dalgada 45 sn, sonrasında 30 sn varsayıldı. 2x/4x hız düğmesi gerçek süreyi 2–4 kat kısaltır; hedef süre 1x içindir. Oyun bitti ekranı oyun zamanını göstermeli.

---

## A. Mevcut durum analizi

### A1. Temel kurallar (koddan)
- `LVL_MULT = 1.55^(lv-1)`: Lv1 ×1, Lv2 ×1,55, Lv3 ×2,40. Lv3'e ulaşan silah türü marketten çıkar (`rollShop`), dolayısıyla pratikte **seviye tavanı Lv3**.
- Menzil ahtapot merkezinden ölçülür, `range*S`. Düşmanlar `hypot(W,H)/2+40` px uzakta doğar. Bu, dünya biriminde masaüstünde ~900, telefon dikeyde ~1010 birimdir (S, 0,5'te kırpılıyor).
- Doğma penceresi 0,5–24,5 sn. Tüm düşmanlar ölmeden dalga bitmez. Boss `waveT<=5` anında (25. sn) doğar.
- Her dalga sonunda can tamamen dolar. Ölüm yalnızca **tek bir dalga içinde** gerçekleşir.
- Kol: 8 başlangıç, +2 "Ek Kol" ile 10. Yedek kol +2. Tılsım toplam alım tavanı 54.
- Boss: `hp = 380·hpMul·(1+0,4(w/5−1))`, `dmg = 17·dmgMul`, saldırı 1/sn, altın `30·w/5`.

### A2. Silah tablosu (sinerjisiz)
Teorik DPS tek hedefe göredir. Bumerang için gidiş-dönüş (2 isabet / 1,39 sn), taramalı için rampa tavanında 5 hasar, zehir için +3 zehir DPS (seviyeyle ölçeklenmez) alındı. "Kalabalık DPS" ölçümdür: tek silah, ölümsüz ahtapot, dalga 8 kalabalığı, 40 sn, 4 tekrar ortalaması (yığılma nedeniyle yakın/alan silahlarına avantajlıdır).

| id | sınıf | fiyat | menzil | Lv1 DPS | Lv2 | Lv3 | fiyat/DPS (Lv1) | Kalabalık DPS Lv1 / Lv3 |
|---|---|---|---|---|---|---|---|---|
| tabanca | Mermi+Uzun | 12 | 300 | 18,2 | 28,2 | 43,7 | 0,66 | 13,8 / 32,9 |
| midye | Mermi+Büyü | 14 | 240 | 15,0 | 23,3 | 36,0 | 0,93 | 15,7 / 34,0 |
| zipkin | Mermi+Uzun | 20 | 430 | 14,7 | 22,7 | 35,2 | 1,36 | 12,2 / 27,7 |
| taramali | Mermi+Ateş | 15 | 280 | 16,7 | 25,8 | 40,0 | 0,90 | 11,8 / 26,6 |
| pompali | Mermi+Kontrol | 15 | 130 | 9,9/hedef | 15,4 | 23,8 | 1,51 | 32,8 / 48,9 |
| vampir | Mermi+Kan | 16 | 220 | 11,3 | 17,4 | 27,0 | 1,42 | 8,7 / 20,5 |
| levye | Çubuk+Yakın | 12 | 95 | 17,8/hedef | 27,6 | 42,7 | 0,67 | 50,3 / 70,8 |
| kurek | Çubuk+Kontrol | 16 | 118 | 14,4/hedef | 22,3 | 34,6 | 1,11 | 50,0 / 77,3 |
| yumruk | Çubuk+Kan | 14 | 70 | 21,7 | 33,6 | 52,1 | 0,65 | 15,6 / 33,2 |
| bumerang | Çubuk+Uzun | 16 | 250 | 13,0/hedef | 20,1 | 31,1 | 1,23 | 36,7 / 60,0 |
| asa | Büyü+Ateş | 18 | 240 | 12,9 (+%50 sıçrama) | 20,1 | 31,1 | 1,39 | 43,0 / 65,1 |
| yildirim | Büyü+Uzun | 20 | 450 | 12,6/hedef | 19,5 | 30,2 | 1,59 | 38,8 / 68,4 |
| zehir | Büyü+Ateş | 17 | 200 | 9,0/hedef | 12,3 | 17,4 | 1,89 | 36,4 / 55,1 |
| buz | Büyü+Kontrol | 14 | 350 | 7,0 | 10,8 | 16,8 | 2,00 | **5,9 / 14,0** |
| murekkep | Büyü+Kontrol | 13 | 140 | 3,0/hedef | 4,7 | 7,2 | 4,33 | 11,9 / 28,0 |
| alev | Ateş+Yakın | 18 | 140 | 13,8/hedef | 21,3 | 33,0 | 1,31 | 28,3 / 48,2 |
| testere | Yakın+Kan | 16 | 150 | 17,5 | 27,1 | 42,0 | 0,92 | 12,3 / 26,5 |
| mancinik | Ateş+Uzun | 22 | 500 | 15,0/hedef | 23,2 | 36,0 | 1,47 | **56,5 / 83,1** |
| diken | Yakın+Kan | 16 | 60 | 18,8 (+diken) | 29,1 | 45,0 | 0,85 | 56,8 / 66,4 |

### A3. Sinerji güç sıralaması (güçlüden zayıfa)
1. **Yakın** (4 silah): 2/4 eşikte +%15/+%35 düz hasar. En temiz çarpan. Yakın odaklı bot en iyi archetype.
2. **Kan** (4): düşman hasarı −%15/−%35. Ölüm tek dalgada can bitmesi olduğu için savunmada en değerli sinerji.
3. **Çubuk** (4): yakın vuruşta 14 itme ve koni ×1,25. Yakın yapıları hem hasar hem hayatta kalma açısından destekler.
4. **Uzun** (5): +20/+50 düz menzil. Kısa menzilli silahlarda göreli etkisi büyük (yumruk 70→120).
5. **Ateş** (5): yakma = **tek vuruşun** %15/%30'u. Mancınık ve asada iyi, alevde (1,1/tik → 0,17 DPS) ve taramalıda anlamsız.
6. **Büyü** (6): yalnızca `orb/bolt/artillery` alanını büyütür. Tier3 süre +%50.
7. **Mermi** (6): yalnızca `kind:'bullet'` için her 5./4. mermi ×2 (+%20/+%25). **Pompalı Mermi sınıfında olduğu hâlde faydalanmıyor** (cone_shot).
8. **Kontrol** (4): süre ×1,5 (kürek sersemletmesi 0,1→0,15 sn, etkisi yok denecek kadar az) ve kontroldeki düşmana +%15. En zayıf sinerji.

### A4. Düşman eğrisi (mevcut, dalga 1-30)
Karışım: karides %35; balon (w≥3) `0,15+0,02w`, tavan %40; kalanı yengeç. HP bütçesi = adet × ortalama HP × hpMul (+ boss).

| w | adet | hpMul | dmgMul | yengeç HP | balon HP | boss HP | dalga HP bütçesi | vuruş başı ort. hasar | öldürme altını | ödül | küm. altın |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 11 | 1,00 | 1,00 | 24 | 78 | – | 214 | 5,9 | 18 | 10 | 58 |
| 3 | 17 | 2,00 | 1,36 | 48 | 156 | – | 1 047 | 9,8 | 35 | 14 | 142 |
| 5 | 23 | 3,00 | 1,72 | 72 | 234 | 1 140 | 3 414 | 12,8 | 79 | 18 | 298 |
| 8 | 32 | 4,50 | 2,26 | 108 | 351 | – | 5 211 | 17,7 | 73 | 24 | 558 |
| 10 | 38 | 5,50 | 2,62 | 132 | 429 | 2 926 | 10 941 | 21,1 | 149 | 28 | 842 |
| 11 | 46 | 8,28 | 3,16 | 199 | 646 | – | 15 018 | 25,8 | 110 | 30 | 982 |
| 12 | 54 | 12,4 | 3,81 | 297 | 966 | – | 27 079 | 31,5 | 131 | 32 | 1 146 |
| 13 | 62 | 18,4 | 4,56 | 442 | 1 435 | – | 46 821 | 38,1 | 152 | 34 | 1 332 |
| 15 | 78 | 40,0 | 6,49 | 961 | 3 123 | 27 387 | 155 588 | 54,2 | 281 | 38 | 1 858 |
| 20 | 118 | 263 | 15,0 | 6 312 | 20 515 | 219 880 | 1,49 M | 125 | 409 | 48 | 3 448 |
| 25 | 158 | 1 630 | 33,3 | 39 115 | 127 123 | 1,61 M | 12,2 M | 278 | 537 | 58 | 5 607 |
| 30 | 198 | 9 726 | 71,7 | 233 413 | 758 592 | 11,1 M | 90 M | 599 | 665 | 68 | 8 337 |

Dalga 10'dan sonra HP her dalga ×1,38 ve adet +5 artıyor. Bütçe **dalga başına ~×1,6** büyüyor, oyuncu gücü ise ~dalga 12'de tavana ulaşıyor.

### A5. Altın ekonomisi (mevcut, "orta" bot, 10 koşu ortalaması)
| dalga başı | dolu kol | ort. Lv | Lv3 silah | tılsım | toplam kazanılan altın |
|---|---|---|---|---|---|
| 3 | 4,9 | 1,26 | 0,1 | 0,1 | 93 |
| 5 | 7,6 | 1,41 | 0,2 | 1,3 | 197 |
| 8 | 8,9 | 1,98 | 2,0 | 7,2 | 458 |
| 10 | 9,4 | 2,12 | 3,1 | 12,8 | 662 |

Tam doluluk (10 kol × Lv3 ≈ 640 altın ve 54 tılsım ≈ 610 altın), toplam ~1 300–1 500 altın gerektiriyor. Bu tutar hem eski hem yeni eğride dalga ~14–15'te birikiyor (yeni eğride orta bot, dalga 15'te 1 511 altın). **Lv3 tavanı ve tılsım tavanları, 30 dakikalık bir koşuda dalga ~18'den sonra harcanacak hiçbir şey bırakmıyor.**

### A6. Süre ve ölüm (ölçüm, mevcut oyun)
- Gerçek dalga süresi 30 sn değil. Ölçülen: w1–2 **36 sn**, w3–4 **44 sn**, normal **47–51 sn**, boss dalgası **57–62 sn**. Nedeni: ~900 birimlik yürüme mesafesi, balonun 30 hızla gelmesi ve bossun 25. sn'de doğup ~57. sn'de merkeze ulaşması.
- Tahmini ölüm (bot başına 10–20 koşu):

| bot | medyan ölüm dalgası | p10–p90 | medyan süre |
|---|---|---|---|
| kötü (rastgele) | 9 | 8–10 | 12,9 dk |
| zayıf | 10 | 9–11 | 14,1 dk |
| orta | 10–11 | 10–12 | 14,4–15,2 dk |
| iyi2 | 10 | 10–13 | 14,3 dk |
| archetype'lar (6) | 11–13 | 8–14 | 15–18 dk |

**Sonuç: mevcut oyunda ölüm dalga 10–11'de, ~14–15 dakikada. Beceri neredeyse fark yaratmıyor:** en iyi bot ile zayıf bot aynı dalgada ölüyor. Ölümlerin büyük kısmı boss-10'da (zayıf bot 8/10, iyi2 7/10, orta 2/10), kalanı dalga 11'deki ×1,38 sıçramasında.

### A7. Denge sorunları
1. **Boss ikili bir sınav.** Dalga 10'da bossun temas hasarı 17×2,62 = 44/sn, oyuncunun canı ise 100–200. Boss temas ettikten sonra 3–4 sn içinde ölünüyor. Beceri değil, anlık tek hedef DPS'i ölçüyor.
2. **Dalga 10 → 11 uçurumu.** hpMul ×1,5, adet +8. Oyuncu gücü sabitken ölüm kaçınılmaz.
3. **Güç tavanı çok erken.** Lv3 sonrası silah marketten çıkıyor, tılsımlar ~dalga 18–20'de doluyor (yeni eğride ölçüm: dalga 20'de 43,8/54 tılsım).
4. **İşe yaramayan silahlar:** buz (kalabalık DPS 5,9, sonuncu), vampir (8,7), mürekkep (yalnızca destek, 3 hasar), zehir (zehir DPS'i seviye/tılsımla ölçeklenmiyor: Lv3'te bile 3/sn), zıpkın (fiyat/DPS 1,36, kalabalıkta 12).
5. **Güçlü olanlar:** levye (fiyat 12, fiyat/DPS 0,67, kalabalık 2.), kürek, mancınık (kalabalık 1.), diken (diken pasifi her temas eden düşmana her saldırıda ayrı vuruş yapıyor, kalabalıkta katlanıyor). En iyi kombinasyon **Yakın+Kan+Çubuk yakın dövüş** yapısı (levye/testere/diken/yumruk).
6. **Sinerji hataları:** Pompalı Mermi bonusu almıyor. Ateş yakması tik silahlarında sıfıra yakın. Kontrol tier1 kürekte 0,05 sn ekliyor.
7. **Tılsım dengesi:** Keskin Göz (+%2,5 kritik ≈ +%1,9 hasar/10 altın), Güç Tılsımı'nın (+%5) yarısı kadar etkili. Altın Kesesi 30+ dalgalık bir koşuda 10 adet × 3 × 25 = 750 altın getirir, yani uzun koşuda aşırı güçlü.
8. **İlk dalgada ölüm mümkün.** Başlangıçta silah takılı değil; rastgele bot 1/12 koşuda dalga 1'de öldü.
9. **Cihaz farkı:** Telefonda doğma mesafesi ~%12 daha uzun olduğundan dalgalar ~2–3 sn uzuyor ve menzilde geçen süre artıyor. Küçük bir fark, kabul edilebilir.

---

## B. Hedef eğri

### B1. Süre → dalga dönüşümü
Ölçülen dalga süreleri (yeni eğriyle): w1–2 36 sn, w3–4 44 sn, normal 50 sn, boss dalgası 57 sn. Market: w1–5 45 sn, sonra 30 sn. Dalga sonundaki kümülatif süre:

| dalga sonu | 7 | 10 | 13 | 15 | 20 | 22 | 23 | 25 | 29 | 30 | 35 | 40 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| dk | 10,0 | 14,2 | 18,1 | 20,9 | 27,7 | 30,4 | 31,7 | 34,5 | 39,8 | 41,3 | 48,1 | 54,9 |

- **30 dk ≈ dalga 22–23 → hedef medyan ölüm dalgası: 23** (medyan aralığı 21–24 ↔ 27–33 dk).
- Kötü oyuncu 18–20 dk → dalga 13–15. İyi oyuncu 40+ dk → dalga 29–30+.
- 10 dk = dalga 7 sonu → **hiç kimse dalga 8'den önce ölmemeli.**
- 60 dk ≈ dalga 44 → sert duvar dalga 33'ten başlar; pratik tavan ~dalga 36–37 (~50 dk).

### B2. Formüller (mevcut imzalarla)
```js
/* Zorluk eğrisi: 1-25 polinom (oyuncu gücüyle paralel), 26+ üstel duvar, 33+ sert duvar */
function hpMul(w){   return (1 + 0.25*(w-1) + 0.015*(w-1)*(w-1))
                          * Math.pow(1.12, Math.max(0, w-25))
                          * Math.pow(1.30, Math.max(0, w-32)); }
function dmgMul(w){  return (1 + 0.10*(w-1))
                          * Math.pow(1.06, Math.max(0, w-25))
                          * Math.pow(1.10, Math.max(0, w-32)); }
function enemyCount(w){ return Math.min(90, 10 + 3*w); }          // "slot" sayısı; elit = 2 slot
function eliteChance(w){ return w < 10 ? 0 : Math.min(0.12, 0.04 + 0.005*(w-10)); }

// endWave — değişmez:
const reward = 8 + P.wave*2 + P.trk.gold;          // (+ "Hazine Avcısı" perk'i: ×1.3)

// spawnBoss — k = P.wave/5, boss türü BOSS_ORDER[(k-1)%4]
const bMul = 0.8 + 0.1*(k-1);                        // eski: 1 + 0.4*(k-1)
hp  = BOSS.hp  * hpMul(P.wave) * bMul;
dmg = BOSS.dmg * dmgMul(P.wave);                     // köpekbalığı dmg 17 → 10
b.gold = 30 * k;
// Boss doğma anı: waveT <= 10 (eski 5) — faz mekaniklerine zaman kalsın
```
Ek kurallar (eğrinin parçası, simülasyonda doğrulandı):
- **Başlangıç:** Kol 0'da Tabanca Lv1 takılı gelir, `gold: 30 → 18` (net aynı). Dalga-1 ölümü önlenir.
- **Lv4 (Efsane):** `P.wave >= 15` olduğunda Lv3 türleri markete geri döner. Lv3+Lv3 → Lv4 (`LVL_MULT(4)=3,72`). Market filtresi `lv>=4` olur. Geç oyuna altın yutağı sağlar.
- **Uzun dalga güvencesi:** `WAVE_DURATION - waveT > 90` olduğunda kalan boss dışı düşmanlar hız ×2 alır (okçu/kalamar gibi durmalı yapılar dalgayı kilitlemesin).

### B3. Hedef tablo (dalga 1-40)
"Slot ort. HP" = C'deki yeni karışımın taban HP ortalaması × hpMul. Bütçe elitleri (×2,5 HP, 2 slot) ve bossu içerir.

| Dalga | hpMul | dmgMul | enemyCount | Elit % | Slot ort. HP | Dalga HP bütçesi | Boss (HP) | Ödül | Tah. öldürme altını | Küm. altın | Dalga sonu küm. dk |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1,00 | 1,00 | 13 | 0 | 19 | 253 |  | 10 | 21 | 61 | 1,4 |
| 2 | 1,26 | 1,10 | 16 | 0 | 25 | 394 |  | 12 | 26 | 100 | 2,7 |
| 3 | 1,56 | 1,20 | 19 | 0 | 47 | 897 |  | 14 | 39 | 153 | 4,2 |
| 4 | 1,89 | 1,30 | 22 | 0 | 57 | 1 254 |  | 16 | 45 | 214 | 5,7 |
| 5 | 2,24 | 1,40 | 25 | 0 | 68 | 2 375 | Köpekbalığı (681) | 18 | 81 | 313 | 7,4 |
| 6 | 2,62 | 1,50 | 28 | 0 | 82 | 2 292 |  | 20 | 60 | 393 | 8,7 |
| 7 | 3,04 | 1,60 | 31 | 0 | 95 | 2 938 |  | 22 | 66 | 481 | 10,0 |
| 8 | 3,48 | 1,70 | 34 | 0 | 116 | 3 946 |  | 24 | 81 | 586 | 11,4 |
| 9 | 3,96 | 1,80 | 37 | 0 | 132 | 4 879 |  | 26 | 88 | 700 | 12,7 |
| 10 | 4,46 | 1,90 | 40 | 4,0 | 149 | 7 910 | Yengeç Kral (1 849) | 28 | 159 | 887 | 14,2 |
| 11 | 5,00 | 2,00 | 43 | 4,5 | 166 | 7 314 |  | 30 | 107 | 1 024 | 15,5 |
| 12 | 5,56 | 2,10 | 46 | 5,0 | 228 | 10 735 |  | 32 | 128 | 1 184 | 16,8 |
| 13 | 6,16 | 2,20 | 49 | 5,5 | 252 | 12 686 |  | 34 | 137 | 1 354 | 18,1 |
| 14 | 6,79 | 2,30 | 52 | 6,0 | 278 | 14 861 |  | 36 | 146 | 1 536 | 19,5 |
| 15 | 7,44 | 2,40 | 55 | 6,5 | 305 | 20 248 | Dev Kalamar (2 976) | 38 | 245 | 1 819 | 20,9 |
| 16 | 8,12 | 2,50 | 58 | 7,0 | 347 | 20 785 |  | 40 | 166 | 2 024 | 22,3 |
| 17 | 8,84 | 2,60 | 61 | 7,5 | 378 | 23 834 |  | 42 | 175 | 2 241 | 23,6 |
| 18 | 9,59 | 2,70 | 64 | 8,0 | 409 | 27 170 |  | 44 | 184 | 2 469 | 24,9 |
| 19 | 10,36 | 2,80 | 67 | 8,5 | 442 | 30 807 |  | 46 | 194 | 2 709 | 26,3 |
| 20 | 11,16 | 2,90 | 70 | 9,0 | 477 | 39 916 | Fener Balığı (5 158) | 48 | 323 | 3 080 | 27,7 |
| 21 | 12,00 | 3,00 | 73 | 9,5 | 513 | 39 037 |  | 50 | 213 | 3 343 | 29,1 |
| 22 | 12,86 | 3,10 | 76 | 10,0 | 549 | 43 657 |  | 52 | 222 | 3 617 | 30,4 |
| 23 | 13,76 | 3,20 | 79 | 10,5 | 588 | 48 633 |  | 54 | 232 | 3 903 | 31,7 |
| 24 | 14,68 | 3,30 | 82 | 11,0 | 627 | 53 978 |  | 56 | 242 | 4 200 | 33,0 |
| 25 | 15,64 | 3,40 | 85 | 11,5 | 668 | 66 839 | Köpekbalığı* (7 132) | 58 | 401 | 4 659 | 34,5 |
| 26 | 18,62 | 3,71 | 88 | 12,0 | 795 | 73 732 |  | 60 | 261 | 4 981 | 35,8 |
| 27 | 22,13 | 4,04 | 90 | 12,0 | 945 | 89 613 |  | 62 | 267 | 5 310 | 37,2 |
| 28 | 26,25 | 4,41 | 90 | 12,0 | 1 121 | 106 312 |  | 64 | 267 | 5 641 | 38,5 |
| 29 | 31,09 | 4,80 | 90 | 12,0 | 1 328 | 125 920 |  | 66 | 267 | 5 974 | 39,8 |
| 30 | 36,77 | 5,22 | 90 | 12,0 | 1 571 | 170 906 | Yengeç Kral* (21 989) | 68 | 447 | 6 489 | 41,3 |
| 31 | 43,42 | 5,67 | 90 | 12,0 | 1 855 | 175 860 |  | 70 | 267 | 6 826 | 42,6 |
| 32 | 51,21 | 6,16 | 90 | 12,0 | 2 187 | 207 393 |  | 72 | 267 | 7 165 | 44,0 |
| 33 | 78,41 | 7,36 | 90 | 12,0 | 3 349 | 317 542 |  | 74 | 267 | 7 506 | 45,3 |
| 34 | 119,9 | 8,79 | 90 | 12,0 | 5 121 | 485 591 |  | 76 | 267 | 7 849 | 46,6 |
| 35 | 183,1 | 10,49 | 90 | 12,0 | 7 822 | 844 262 | Dev Kalamar* (102 561) | 78 | 477 | 8 404 | 48,1 |
| 36 | 279,4 | 12,51 | 90 | 12,0 | 11 934 | 1,13 M |  | 80 | 267 | 8 751 | 49,4 |
| 37 | 425,9 | 14,91 | 90 | 12,0 | 18 189 | 1,72 M |  | 82 | 267 | 9 100 | 50,7 |
| 38 | 648,4 | 17,76 | 90 | 12,0 | 27 693 | 2,63 M |  | 84 | 267 | 9 451 | 52,1 |
| 39 | 986,2 | 21,15 | 90 | 12,0 | 42 121 | 3,99 M |  | 86 | 267 | 9 804 | 53,4 |
| 40 | 1 499 | 25,17 | 90 | 12,0 | 64 008 | 7,01 M | Fener Balığı* (944 157) | 88 | 507 | 10 399 | 54,9 |

\* İkinci döngü: "Öfkeli" varyant (C3).

### B4. Doğrulama (bu eğri + Lv4 + elitler + perk yaklaşık +%10 hasar/perk, mevcut 19 silah, 12 koşu/bot)
| bot | medyan dalga | p10–p90 | medyan dk | hedef |
|---|---|---|---|---|
| kötü (rastgele) | 10 | 8–12 | 14,0 (p10 11,1) | ≥ 8. dalga, >10 dk ✅ |
| zayıf | 12 | 10–13 | 16,2 | 13–15 / 18–20 dk ⚠ (1 dalga kısa) |
| **orta** | **23** | 18–25 | **31,2** | 21–24 / 27–33 dk ✅ |
| iyi | 27 | 24–27 | 36,6 | — |
| iyi2 | 28 | 26–28 | 38,5 | ≥ 29 / 40 dk ⚠ (sınırda) |
| archetype: yakın / çubuk / kan / mermi / uzun / büyü-ateş | 28 / 28 / 27 / 26 / 25 / 25 | 19–30 | 33–39 | ≥ 4 yapı > 20 ✅ |
| en uzun koşu | 30 | – | ~41 | < 60 dk ✅ |

Yeni düşmanlar, bosslar ve silahlar eklendikten sonra eğri yeniden ayarlanacak. Tek ayar düğmesi quadratic katsayı `0.015`: ±0,002 orta botun ölümünü ≈ ±1,5 dalga kaydırır. Zayıf oyuncu için düğme `bMul`'un ilk döngüsüdür.

---

## C. Yeni içerik spec'i

### C0. Ortak altyapı (yeni kod noktaları)
- `ENEMY_TYPES[x]` yeni opsiyonel alanları: `armor`, `beh` (davranış id), `ranged{}`, `dash{}`, `split{}`, `boss:true`.
- **Zırh kuralı** (`hitEnemy` içinde, kritik ve çarpanlardan sonra, `e.hp -= d` öncesinde): `if(e.armor) d = Math.max(d*0.3, d - e.armor);`. DoT'lar (yakma/zehir/kanama) zırhı yok sayar.
- **Düşman mermileri:** yeni dizi `eShots[] {x,y,vx,vy,dmg,r,onHit}`. Merkeze `BODY_R*S` mesafesinde isabet eder. Hasar `dmg × (1−weaken) × (1−guard)` olur. Ahtapotun silahları bu mermileri vuramaz.
- **Sersemletme/yavaşlatma direnci:** boss `stunT×0,25`, `slowPct×0,5`; elit `stunT×0,5`.
- Her yeni düşman için `ECHAR[id]` çizimi, her yeni silah için `WICON[id]`, her yeni tılsım için `TICON[id]` gerekir (emoji yalnızca metadata).

### C1. Yeni düşmanlar
| id | isim | ikon | hp | speed | dmg | gold | r | kbRes | özel |
|---|---|---|---|---|---|---|---|---|---|
| barakuda | Barakuda | 🐟 | 16 | 40 | 6 | 2 | 12 | 1,2 | `dash:{trig:420, tele:0.35, spd:320, dur:0.5, cd:2.5}` |
| okcu | Okçu Balığı | 🐠 | 26 | 45 | 5 | 3 | 12 | 1,0 | `ranged:{stop:230, cd:2.0, projSpd:220, shotsBeforeAdvance:3, advanceTo:110}` |
| kaplumbaga | Deniz Kaplumbağası | 🐢 | 110 | 20 | 12 | 5 | 20 | 0,2 | `armor:5` |
| denizanasi | Denizanası | 🪼 | 36 | 34 | 8 | 3 | 15 | 0,8 | `split:{type:'yavru', n:3, spread:25}` |
| yavru | Yavru Denizanası | 🫧 | 9 | 70 | 3 | 0 | 8 | 1,5 | bölünmez; yalnızca `split` ile doğar |

Davranışlar (hepsi `stunT>0` iken durur, `slowT` uygulanır):
- **Barakuda:** Merkeze mesafe ≤ 420 ve `dashCd≤0` olduğunda 0,35 sn durur (telegraf: kırmızı çizgi/parlama). Ardından 0,5 sn boyunca 320 hızla merkeze atılır (≈160 birim) ve `dashCd = 2,5` olur. Atılma sırasında temas etse bile normal saldırı döngüsü (`atkT`) uygulanır. Sersemletme atılmayı iptal eder.
- **Okçu Balığı:** Merkeze mesafe ≤ `230 + r` olana kadar yürür, sonra durur ve her 2,0 sn'de bir merkeze su jeti atar (`eShots`, hız 220, hasar `dmg×dmgMul`). 3 atıştan sonra `stop = 110` yapıp yeniden yaklaşır ve atışa devam eder. HP ilk kez %50'nin altına düştüğünde 1,2 sn boyunca 45 hızla dışarı kaçar (bir kez). İtilirse aynı mantık sürer.
- **Deniz Kaplumbağası:** Düz yürür, zırh 5. Tik silahlarına (alev, testere, midye) sert karşı durur; yakma ve zehir tam işler.
- **Denizanası:** Düz yürür. Hangi yolla ölürse ölsün (DoT dahil) kendi konumunda ±25 birim dağılmış 3 yavru doğurur. Yavru HP = `9×hpMul(w)` olur ve elit olamaz.

**Doğma ağırlıkları** (`buildSpawnQueue` içinde ağırlıklı rastgele seçim; mevcut `balonThr` kaldırılır):

| dalga | karides | yengeç | balon | barakuda | okçu | kaplumbağa | denizanası |
|---|---|---|---|---|---|---|---|
| 1–2 | 35 | 65 | – | – | – | – | – |
| 3–5 | 35 | 45 | 20 | – | – | – | – |
| 6–7 | 30 | 38 | 22 | 10 | – | – | – |
| 8–11 | 22 | 29 | 24 | 13 | 12 | – | – |
| 12–15 | 20 | 25 | 17 | 13 | 12 | 13 | – |
| 16+ | 18 | 20 | 15 | 13 | 12 | 11 | 11 |

Slot başına ortalama taban HP: 19 → 31 → 33 → 41 → 42,7 (yavrular dahil). Eski karışım (w≥13: 41) ile uyumludur, dolayısıyla B'deki bütçe tutarlı kalır. Bir dalgaya ilk kez giren türün adı dalga başında 2 sn banner olarak gösterilir.

### C2. Elit varyantlar (dalga 10+)
- Olasılık `eliteChance(w)` (B2). Kuyruk kurulurken her slot bu olasılıkla elit olur. Elit **2 slot** tüketir. Boss, yavru ve boss çağrıları elit olamaz.
- Çarpanlar: `hp×2.5, dmg×1.3, gold×3, r×1.2, kbRes×0.5`, sersemletme süresi ×0,5. Görsel: altın hale ve can barı altın rengi.
- **Ek (affix), dalga 15+ (rastgele 1 tane):**

| affix | etki | renk |
|---|---|---|
| hizli (Hızlı) | speed ×1,35 | mavi |
| zirhli (Zırhlı) | armor +5 (mevcutla toplanır) | gri |
| yenilenen (Yenilenen) | saniyede maxHp'nin %1,5'i kadar iyileşir | yeşil |

### C3. Bosslar (her 5. dalgada dönüşümlü)
`BOSS_ORDER = ['boss','yengecKral','kalamar','fener']`, `k = w/5`, tür = `BOSS_ORDER[(k-1)%4]`. Dalga 25+ (ikinci döngü) **Öfkeli**'dir: speed ×1,2, tüm mekanik bekleme süreleri ×0,75 ve etiket "◤ ÖFKELİ BOSS ◥". HP/dmg/altın formülleri B2'de.

| id | isim | ikon | hp | speed | dmg | r | kbRes | dalga | sınadığı şey |
|---|---|---|---|---|---|---|---|---|---|
| boss (mevcut id) | Köpekbalığı | 🦈 | 380 | 26 | 10 | 30 | 0,1 | 5, 25 | tek hedef DPS, anlık hasar |
| yengecKral | Yengeç Kral | 🦀 | 460 | 20 | 12 | 36 | 0 | 10, 30 | patlama hasarı, alan (çağrılar), zırh |
| kalamar | Dev Kalamar | 🦑 | 400 | 34 | 8 | 32 | 0,2 | 15, 35 | menzil, mermiyle hasar |
| fener | Fener Balığı | 🏮 | 420 | 24 | 10 | 30 | 0,2 | 20, 40 | kalabalık temizleme, iyileştirme yarışı |

- **Köpekbalığı:** Mesafe ≤ 450 ve `chargeCd≤0` olduğunda 0,6 sn durur (merkeze uzanan kırmızı çizgi), ardından 1,0 sn boyunca hız ×4 ile hücum eder ve `chargeCd = 5` olur. Hücum sırasındaki ilk temas bir kez `2×dmg` vurur. HP %30'un altındayken speed ×1,4 ve `chargeCd = 3,5` olur.
- **Yengeç Kral:** `armor: 6`. HP %75/%50/%25 eşiklerini geçtiği anda 1,5 sn hasar almaz (vuruşlar 0, DoT durur, görsel kabuk parlaması) ve 40 birim çevresine 4 normal yengeç (`gold:1`) çağırır. Temas saldırısı normaldir.
- **Dev Kalamar:** Faz 1: `stop = 240` noktasına gelince 30 hızla merkez etrafında döner. Her 3,5 sn'de merkeze doğru 40°'lik yelpazede 5 mürekkep atar (`eShots`, hız 180, her biri `0,5×dmg`). İsabet ahtapota **Mürekkep Körlüğü** verir: tüm silah menzilleri ×0,75, 2,5 sn (yenilenir, yığılmaz). Faz 2 (HP ≤ %50 **veya** faz 1'de 12 sn): normal yürüyüşle temasa gelir ve 2,5 sn'de bir atmaya devam eder. Böylece saf yakın yapılar da kalamara ulaşır.
- **Fener Balığı:** Varınca `stop = 300` noktasında 10 sn bekler (yem fazı). Aura yarıçapı 150: içindeki müttefikler saniyede maxHp'nin %2'si kadar iyileşir ve speed ×1,2 alır. Her 4 sn'de kendi konumuna 3 karides çağırır (aynı anda en fazla 12 çağrılmış, `gold:0`). 10 sn sonra **veya** HP ≤ %60 olunca temasa yürür. Çağırma ve aura sürer.

### C4. Yeni silahlar (5)
Mevcut 28 sınıf çiftinin 15'i kullanılıyor. Bu 5 silah 5 yeni çift ekliyor. Yeni sınıf sayıları: Mermi 6, Büyü 7, Ateş 6, Uzun 6, Yakın 6, Çubuk 5, Kontrol 7, Kan 5.

| id | isim | ikon | cls | price | range | cd | dmg | kind | özel alanlar | Lv1 DPS | fiyat/DPS |
|---|---|---|---|---|---|---|---|---|---|---|---|
| buhar | Kaynar Buhar | ♨️ | Ates+Kontrol | 16 | 150 | 0,90 | 8 | cone_shot | `cone:30, slow:{pct:0.35, dur:1.0}` | 8,9/hedef | 1,80 |
| suluk | Sülük Atar | 🩸 | Kontrol+Kan | 15 | 260 | 0,85 | 6 | bullet | `slow:{pct:0.2, dur:1.5}, bleed:{mult:0.8, dur:3}` | 7,1 + 4,8 kanama | 1,26 |
| mizrak | Kılıçbalığı Mızrağı | 🗡️ | Uzun+Yakin | 18 | 200 | 1,20 | 20 | **lance (YENİ)** | `width:16` | 16,7/hat | 1,08 |
| girdap | Girdap Asası | 🌀 | Buyu+Cubuk | 19 | 110 | 1,80 | 14 | **nova (YENİ)** | `knock:20` | 7,8/çevredeki herkes | 2,44 |
| kiskac | Mengene Kıskaç | 🦞 | Yakin+Kontrol | 15 | 80 | 0,75 | 13 | melee_single | `stun:0.25` | 17,3 | 0,87 |

Açıklamalar (`desc`) ve gereken kod değişiklikleri:
- **buhar:** "Geniş buhar konisi; vurduklarını 1sn %35 yavaşlatır". `cone_shot` dalı `hitEnemy`'ye `slow: w.slow||null` geçirmeli (şu an geçirmiyor).
- **suluk:** "Kanama: vuruş hasarının %80'i/sn, 3sn; hafif yavaşlatır". Yeni DoT alanı `e.bleed={dps,t,uid}`. Değer `dps = d_final × 0.8` (seviye, tılsım ve kritik dahil). Aynı kaynakta süre yenilenir, farklı kaynaktan gelirse en güçlüsü kalır (zehir kuralı). `updateWave`'de burn/poison ile aynı şekilde işler. Durum noktası `#d23b4a`. Hasar raporu yeni etiket `_bleed` "Kanama (DoT)".
- **mizrak (`kind:'lance'`):** Hedef varsa ve `cdT≤0` ise nişan açısı `aim` olur. Uç noktadan `aim` yönünde uzunluğu `range+rangeBonus()` olan bir hat çizilir. Tüm düşmanlar için `t = (e−tip)·dir` ve `perp = |(e−tip)×dir|` hesaplanır. `0 ≤ t ≤ L` ve `perp ≤ width·S + e.r` ise `hitEnemy(e, base, w, {melee:true, uid})` çağrılır. Efekt: 0,2 sn ince parlak hat.
- **girdap (`kind:'nova'`):** Yarıçap `R = (range + rangeBonus())·aoeMult(w)·S`. Merkeze `≤ R + e.r` mesafede en az bir düşman varsa ve `cdT≤0` ise o yarıçaptaki herkese `hitEnemy(e, base, w, {knock:20, melee:true, uid})` uygulanır. Efekt: merkezden genişleyen halka (`boom`, 0,35 sn). Hedef seçimi gerekmez, `aim` döndürülmez.
- **kiskac:** "Kısa menzil; vurduğunu 0,25sn sıkıştırır (sersemletir)". `melee_single` dalı `stun: w.stun||0` geçirmeli.

### C5. Yeni tılsımlar (3)
| id | isim | ikon | price | cap | desc | uygulama |
|---|---|---|---|---|---|---|
| guard | Sedef Pul | 🪸 | 12 | 8 | Alınan hasar −%4 | `P.trk.guard += 0.04`. Temas, düşman mermisi ve hücum hasarı `×(1−guard)` |
| regen | İnci Özü | 🦪 | 12 | 5 | Dalga sırasında saniyede maks. canın %0,4'ü kadar iyileşme | `updateWave`: `P.hp = min(maxHp, hp + maxHp*0.004*n*dt)` |
| reach | Uzun Vantuz | 📏 | 12 | 5 | Tüm menziller +8 | `rangeBonus()` sonucuna `+8*n` eklenir |

`trkTotal` metinleri: "Hasar −%X", "Saniyede %Y can", "Menzil +Z".

### C6. İlerleme: Mutasyonlar ve Derinlik
**Mutasyon ekranı:** Dalga 10, 15, 20, 25, 30, 35... (boss dalgası kazanıldıktan sonra, marketten önce) açılır. Havuzdan rastgele 3 kart gelir, 1 tanesi seçilir ve tekrar gelmez. Ekran mevcut `.overlay`/`.card` stilini kullanır, telefonda 3 kart tek sütunda dizilir. `P.perks = []`. Simülasyonda her mutasyon ≈ +%10 hasar olarak modellendi, kartlar bu güç bandında tutuldu.

| id | isim | ikon | etki | ne zamandan |
|---|---|---|---|---|
| basinc | Derin Basınç | 🌊 | Tüm hasar +%12 | 10 |
| refleks | Sinir Ağı | ⚡ | Saldırı hızı +%10 | 10 |
| ucYurek | Üç Yürek | ❤️ | Maks. can +%35 | 10 |
| kitin | Kitin Deri | 🛡️ | Alınan hasar −%12 | 10 |
| uzanti | Uzayan Kollar | 🦑 | Menzil +25, alan yarıçapı +%10 | 10 |
| kanEmici | Kan Emici | 🩸 | Öldürme başına +1 can (elit +4, boss +20) | 10 |
| bulut | Mürekkep Bulutu | 🌫️ | Dalga başına 1 kez: can < %35 olunca 4 sn tüm düşmanlar mürekkeplenir (+%20 hasar alır) ve %40 yavaşlar | 10 |
| asitKan | Asit Kan | 🧪 | Yakma/zehir/kanama DPS'i +%60 | 10 |
| keskin | Keskin Uç | 🎯 | Kritik şansı +%8, kritik çarpanı 1,75 → 2,1 | 10 |
| hazine | Hazine Avcısı | 💰 | Dalga ödülü ×1,3, yenileme 1💰 | 10 (en fazla dalga 20'ye kadar sunulur) |
| katalizor | Sinerji Katalizörü | ✨ | En çok benzersiz silahı olan sınıfın sayısı +1 (eşitlikte `CLASSES` sırası) | 15 |
| fazlaKol | Fazladan Dokunaç | 🦾 | +1 aktif kol (tavan 11) | 15 |

**Derinlik bölgeleri** (her 10 dalgada kilometre taşı; yalnızca görsel ve metin, ucuz):

| dalga | bölge | derinlik (dalga×25 m) | etki |
|---|---|---|---|
| 1–9 | Sığ Resif | 25–225 m | mevcut arka plan |
| 10–19 | Alacakaranlık Bölgesi | 250–475 m | arka plan tonu koyulaşır, elitler başlar |
| 20–29 | Gece Bölgesi | 500–725 m | biyolüminesan partiküller |
| 30+ | Uçurum | 750 m+ | en koyu ton, "sert duvar" |

Bölge geçişinde 2,5 sn banner gösterilir: "🌊 ALACAKARANLIK BÖLGESİ — 250 m". Oyun bitti ekranına "Ulaşılan derinlik", "Süre (dk:sn, oyun zamanı)" ve "Rekor" (`localStorage`, try/catch ile; okunamazsa gösterilmez) eklenir.

---

## D. Mevcut silah/tılsım/kural değişiklikleri
| id | alan: eski → yeni | gerekçe |
|---|---|---|
| buz | dmg 7 → 10; slow.pct 0,30 → 0,35; price 14 → 13 | Kalabalık DPS'te sonuncu (5,9). Hedef ~%60 bandı |
| vampir | dmg 9 → 10; cd 0,80 → 0,70 | DPS 11,3 → 14,3. Kalabalıkta sondan 2. |
| murekkep | dmg 3 → 5; cone 30 → 35; price 13 → 12 | Destek silahı, tek başına işe yaramıyor |
| zehir | poison.dps 3 → `3×LVL_MULT(lv)` (mermiye seviye ile geçir); dmg 12 → 13 | Zehir seviyeyle ölçeklenmiyor (Lv3'te bile 3/sn) |
| zipkin | dmg 22 → 28 | fiyat/DPS 1,36 → 1,07. Ağır tek vuruş kimliği korunuyor |
| taramali | ramp.max 5 → 6 | Tank/boss uzmanı rolü (sürekli 20 DPS) |
| levye | price 12 → 14 | fiyat/DPS 0,67 ve kalabalıkta 3.; en verimli alım |
| kurek | stun 0,1 → 0,2 | Kontrol sinerjisi hissedilsin |
| pompali | Mermi çift vuruşu cone_shot'a da uygulanır (atış başına `bulletCounter++`, çift ise tüm saçma ×2) | Sınıf etiketi ile davranış tutarsız |
| mancinik, diken | değişiklik yok, **izlemede** | Kalabalık DPS 1.–2. F'deki payı %60 sınırı yakalar |
| trinket crit | +%2,5 → +%4 / adet | 10 altın başına etkisi hasar tılsımının yarısıydı |
| trinket gold | cap 10 → 5 | 25+ dalgalık koşuda aşırı getiri (≈750 altın) |
| boss (düşman) | dmg 17 → 10; `bMul` 1+0,4(k−1) → 0,8+0,1(k−1); doğma `waveT<=5` → `<=10` | İkili ölüm sınavını kaldırmak. Ölçüm: boss kaynaklı ölüm payı %20–80 → %8–50 (bota göre; orta botta %33) |
| newGame | Tabanca Lv1 kol 0'da takılı; gold 30 → 18 | Dalga 1 ölümü (rastgele botta 1/12) |
| rollShop | `lv>=3` filtresi → `lv>=4 \|\| (lv>=3 && wave<15)` | Lv4 altın yutağı |
| Ateş sinerjisi (isteğe bağlı) | tick kind'larında yakma DPS'i `0,15 × d / w.cd` (vuruş başı değil) | Alev ve testereye Ateş bonusu sıfır |

---

## E. Uygulama sırası
**Kesin (sırayla):**
1. **Eğri ve bitiş kuralları:** B2 formülleri, boss dmg/bMul/doğma anı, başlangıç Tabanca, Lv4 filtresi, 90 sn güvencesi. *Tester bu adımdan sonra B4'ü yeniden üretmeli.*
2. **D tablosu** (mevcut silah/tılsım sayıları). Küçük değişiklik, büyük denge etkisi.
3. **Düşman altyapısı:** ağırlıklı doğma tablosu, `armor`, `eShots`, direnç kuralları.
4. **4 yeni düşman** (barakuda → okçu → kaplumbağa → denizanası/yavru) ve çizimleri.
5. **Elitler** (önce çarpanlar, sonra dalga 15+ affix'ler).
6. **4 boss** ve rotasyon. Önce Köpekbalığı hücumu, sonra Yengeç Kral, Kalamar, Fener. Öfkeli varyant en son.
7. **Mutasyon ekranı** ve 12 kart.
8. **5 yeni silah** (önce kiskac/buhar/suluk: mevcut kind'larla küçük ekler; sonra lance, nova).
9. **3 yeni tılsım.**
10. **Tester ayarı:** F ölçütleri tutana kadar quadratic katsayı ve `bMul` ayarı.

**İsteğe bağlı:**
- Derinlik bölgeleri görsel tonu ve banner (metin ve rekor kısmı kesine yakın; ucuz, ilerleme hissi için önerilir).
- Ateş sinerjisi tik düzeltmesi.
- İlk karşılaşmada tür tanıtım banner'ı.
- Elit affix'leri (yalnızca çarpanlarla da hedef tutuyor).

---

## F. Tester kabul ölçütleri

### F1. Simülasyon yöntemi
- Gerçek `index.html` script'i headless çalıştırılır (DOM/canvas stub, `updateWave(1/60)`). Market kararlarını botlar verir. Her bot için **en az 50 koşu**, toplam dalga+market süresi (market w1–5 45 sn, sonrası 30 sn).
- Botlar:
  - **kötü:** Rastgele silah alır, %30 ihtimalle rastgele tılsım alır, satış ve yenileme yapmaz, yalnızca otomatik birleştirme yapar.
  - **zayıf:** DPS puanına göre açgözlü alım yapar, satış ve yenileme yapmaz.
  - **orta:** Açgözlü alım; tekrar eden türe +8 puan, kopya için Lv1 satar, 2 yenileme (≥14 altın), tılsımları kollar dolunca alır.
  - **iyi2:** En güçlü 10 türe odaklanır, 10 yenileme yapar, Lv2 satabilir.
  - **Archetype'lar (6):** mermi, büyü-ateş, yakın, çubuk, uzun, kan. Her biri 8 türe odaklanır.
- Mutasyonlarda bot rastgele seçer (kötü/zayıf) ya da sabit öncelik kullanır: hasar > saldırı hızı > can.

### F2. Metrikler ve hedef aralıklar
| # | metrik | hedef |
|---|---|---|
| 1 | orta bot medyan ölüm dalgası | **21–24** |
| 2 | orta bot medyan süre | **27–33 dk** |
| 3 | orta bot p10 / p90 dalga | p10 ≥ 17, p90 ≤ 27 |
| 4 | zayıf bot medyan süre | 16–21 dk (dalga 12–15) |
| 5 | kötü bot en erken ölüm | 50 koşunun **hiçbirinde < dalga 8** (≥ 10 dk) |
| 6 | iyi2 bot medyan | dalga 28–31, ≥ 38 dk |
| 7 | tüm botlarda en uzun koşu | ≤ dalga 37 (< 52 dk). Üst sınır testi: dalga 15'te 10 kol × Lv4 ve tüm tılsımlar tavanda verilmiş hileli bot da ≤ dalga 38'de ölmeli |
| 8 | strateji çeşitliliği | 6 archetype'tan **en az 4'ünün medyanı > dalga 20**; en iyi ile en kötü archetype medyan farkı ≤ 5 dalga |
| 9 | tek silah hakimiyeti | Son dalgada tek silah örneğinin hasar payı: medyan ≤ %35; koşuların ≤ %5'inde > %60; hiçbir koşuda > %75 |
| 10 | boss ölüm payı | Ölümlerin %15–40'ı boss dalgasında (spike var ama ikili değil) |
| 11 | silah kullanılabilirliği | Tek silah kalabalık testi (dalga 8, Lv3): her silah ≥ medyanın 0,6 katı. Yeni 5 silah Lv1'de medyanın 0,7–1,3 katı |
| 12 | dalga süresi (1x) | Normal dalga 40–58 sn, boss dalgası ≤ 75 sn, 90 sn güvencesi koşuların < %2'sinde tetiklenir |
| 13 | ilerleme | Orta bot dalga 20'de altın harcanacak bir şey buluyor olmalı: market sonunda elde kalan altın medyanı < 40 |
| 14 | performans | Dalga 30, orta segment telefon: ≥ 45 fps; aynı anda düşman ≤ 140 (yavrular dahil) |
| 15 | regresyon | Mevcut 19 silahın her biri en az bir archetype'ın son kadrosunda ≥ %20 koşuda bulunmalı |

### F3. Referans (bu dokümandaki ölçümler)
- Mevcut oyun: orta 10–11 (14–15 dk). Zayıf ile iyi2 arasında fark ≤ 1 dalga. Boss ölüm payı %20–80 (bota göre).
- Simülasyon düzeneği (bu çalışmada kullanılan, depo dışında): `harness.js` (vm + DOM stub), `bots.js` (bot politikaları), `sweep.js` (yüzdelikler), `wtest.js` (tek silah kalabalık DPS). Tester aynı yaklaşımı `tools/` altında yeniden kurabilir.
- B eğrisi, mevcut içerikle: B4 tablosu. Yeni içerik sonrası sapma ±2 dalgayı geçerse önce quadratic katsayı (`0.015`), sonra elit oranı ayarlanır.

---

## G. Ayar günlüğü

Yöntem: `tools/sim.js --accept --runs 20 --noPerf` (bot başına 20 koşu, seed 1, 390x844). Tanı için index.html'in **kopyası** üzerinde `hurtPlayer`'a kaynak sayacı eklendi; oyun kodu değişmedi. Yalnızca sayılar ve formüller değişti.

### Başlangıç (geliştiricinin uygulaması, fb3aa522)
5 GEÇTİ / 9 KALDI. Botların medyan ölüm dalgası: kotu 9, zayif 10, orta 12,5 (p10–p90 8,9–26), iyi2 24, yakin 10. Tanı: dalga 8–12 arası ölümlerin **%90+'ı Okçu Balığı su jetinden**. Okçu 3 atıştan sonra 110 birime yaklaşıp orada duruyor ve bu mesafe tüm yakın silahların (60–95) menzili dışında kalıyor. Böylece kimse okçuya ulaşamıyor ve okçu dalga boyunca ateş ediyor.

### Tur 1: okçu, eğri, boss, silahlar (sonuç: 10 GEÇTİ / 4 KALDI)
| id | alan: eski → yeni | sebep |
|---|---|---|
| okcu | dmg 5→3, ranged.cd 2,0→2,5, shotsBeforeAdvance 3→2, advanceTo 110→55 | 55+r = 67 birim: tüm yakın silahlar okçuya yetişiyor. Erken ölümlerin ana kaynağı |
| SPAWN_TABLE 8/12/16 | okcu 12→8 (fark yengece) | Geç dalgalarda okçu yığılması |
| hpMul | `1.12^max(0,w-25)` → `1.12^min(6,max(0,w-18))` | Dik bölge 19–24'e çekildi (orta burada elenir). 25–31 yalnız polinom, böylece iyi oyuncular ayrışıyor. Ardışık tek dik duvarda tüm iyi botlar dalga 25'te ölüyordu |
| dmgMul | `1.06^max(0,w-25)` → `1.06^min(6,max(0,w-18))` | aynı |
| eliteChance | tavan 0,12→0,10, eğim 0,005→0,004 | Dalga 25'te zırhlı/balon elitleri duvar oluşturuyordu |
| boss (Köpekbalığı) | dmg 10→8 | Dalga 25 öfkeli hücum ölümleri |
| bMul | 0,8+0,1(k−1) → 0,8+0,06(k−1) | Boss dalgası ölüm payı |
| yengecKral | hp 460→400, dmg 12→10, armor 6→4 | Zayıf/kötü botların yarısı dalga 10'da ölüyordu. Zırh 6 düşük seviyeli silahları cezalandırıyor |
| suluk | dmg 6→12, bleed.mult 0,8→1,0 | Lv1 0,38× → 0,72× |
| kiskac | dmg 13→19, cd 0,75→0,65 | Lv1 0,48× → 0,72× |
| mizrak | dmg 20→17 | Lv1 1,38× → 1,25× |
| girdap | dmg 14→9, range 110→100 | Lv1 1,43× → 1,27× (kalabalık testinde doygun, hasar düşüşü DPS'e zayıf yansıyor) |
| buz | dmg 10→14 | Lv3 0,45× |
| vampir | dmg 10→11 | Lv3 0,60× (sınırda) |
| murekkep | dmg 5→6 | Archetype kadrosu (#15) |

### Tur 2: denendi, geri alındı (5 GEÇTİ)
Denenenler: `bMul` 0,75+0,03(k−1), hpMul quadratic 0,015→0,016, buz cd 1,0→0,85 ve dmg 14→16. Boss yumuşaması orta'yı dalga 25'e çıkardı (#1–3 KALDI). Buz, Büyü|Ateş ilk 8'ine girip mürekkebi dışarı itti. **Sonuç:** bMul geri alındı. Quadratic 0,016 ve buz 0,85/16 tutuldu.

### Tur 3 (8 GEÇTİ)
| id | alan | sebep |
|---|---|---|
| levye | dmg 16→14 | Kalabalık 1,9× medyan. Yakın archetype farkı |
| kurek | dmg 18→16 | aynı |
| murekkep | dmg 6→7 | #15 |
| buhar | dmg 8→7 | Mürekkebe yer açmak (buhar Lv1 1,0× → 0,86×) |
| kiskac 20, suluk 13 | +1 | Medyan yükseldi, 0,69× |

### Tur 4 (11 GEÇTİ)
| id | alan | sebep |
|---|---|---|
| enemyCount | `min(90,10+3w)` → `round(min(90,10+3w) × (w%5===0 ? 0,8 : 1))` | Boss dalgasındaki ek yük. Boss dalgası ölüm payı %54 → %28 |
| hpMul/dmgMul sert duvar | `max(0,w-32)` → `max(0,w-31)` | En uzun koşu 52,2 dk → 47,8 dk |
| balon | speed 30→34 | Dalga süresi. Normal dalga medyanı 52,8 → 47,7 sn, orta süresi 33,9 → 31,2 dk |
| kaplumbaga | speed 20→25 | aynı |
| kalamar | dmg 8→6 | Orta'nın dalga 15 ölümleri (p10 15 → 21,8) |
| suluk 14, kiskac 21,5 | +1/+1,5 | #11 sınırı |

### Tur 5 (11 GEÇTİ)
| id | alan | sebep |
|---|---|---|
| vampir | dmg 11→12,5 | Lv3 0,56× (medyan yükseldi) |
| testere | dmg 2,5→2,8 | Lv3 0,57× |
| diken | dmg 15→13 | Yakın archetype 30'da, diğerleri 24 |
| levye | dmg 14→13 | aynı |
| tabanca | dmg 10→11 | Mermi archetype 24 |
| midye | dmg 2,7→3,0 | aynı |

Sonuç: #11 geçti. #8 farkı 7 oldu (uzun 23). Midye puanı buzu Büyü|Ateş listesinden itti (#15).

### Tur 6
| id | alan | sebep |
|---|---|---|
| mizrak | dmg 17→15 | Yakın archetype'ın en çok kullandığı silah (20 koşunun 23 kolunda) |
| zipkin | dmg 28→32 | Uzun/Mermi archetype zayıf |
| buz | dmg 16→19 | Büyü\|Ateş ilk 8 eşiği puan 17; buz 16'da kalıyordu |
| murekkep | dmg 7→7,5 | Buzla yer değiştirmesin |

Sonuç: 11 GEÇTİ. #15 çözüldü, #11'de kıskaç 0,70× sınırda kaldı. #8 farkı 5,5 (yakın 28,5; büyü-ateş ve uzun 23).

### Tur 7 (11 GEÇTİ)
| id | alan | sebep |
|---|---|---|
| kiskac | dmg 21,5→22 | #11 sınırı (0,70× → 0,71×) |
| yildirim | dmg 18→19,5 | Büyü+Uzun: iki geride kalan archetype'ı birlikte besliyor |

Sonuç: #11 geçti. #3 orta p10 15,9: 20 koşudan 2'si dalga 15'teki Dev Kalamar'da öldü (boss canlıyken).

### Tur 8: son durum (12 GEÇTİ / 2 KALDI / 1 ATLANDI)
| id | alan | sebep |
|---|---|---|
| kalamar | hp 400→360, dmg 6→5 | Orta'nın dalga 15 boss ölümleri |
| diken | dmg 13→12 | Yakın archetype |

**Son kabul tablosu** (`--accept --runs 20 --noPerf`, index.html f2fce42e3183):

| bot | dalga p10/med/p90 | dk p10/med/p90 | boss-dalga ölüm |
|---|---|---|---|
| kotu | 10 / 11,5 / 12,1 | 13,3 / 15,5 / 16,5 | %30 |
| zayif | 11,9 / 13 / 16,2 | 15,6 / 17,3 / 22,1 | %15 |
| orta | 21,9 / 23,5 / 26,1 | 29,2 / 32,0 / 35,6 | %10 |
| iyi2 | 25 / 29,5 / 32,1 | 34,1 / 40,4 / 44,4 | %45 |
| mermi / buyuates / yakin / cubuk / uzun / kan | medyan 24 / 23 / 29 / 25 / 24 / 27 | | |

| # | sonuç | ölçülen |
|---|---|---|
| 1 | GEÇTİ | orta medyan 23,5 |
| 2 | GEÇTİ | 32,0 dk |
| 3 | GEÇTİ | p10 21,9 / p90 26,1 |
| 4 | GEÇTİ | zayıf 17,3 dk, dalga 13 |
| 5 | GEÇTİ | kötü en erken dalga 10, 13 dk |
| 6 | GEÇTİ | iyi2 dalga 29,5, 40,4 dk |
| 7 | GEÇTİ | en uzun dalga 34 (47,6 dk); hileli maks 33 |
| 8 | **KALDI** | 6/6 archetype > 20, fark 6 (yakın 29 – büyü-ateş 23) |
| 9 | GEÇTİ | tek silah payı medyan %19,9, maks %32,4 |
| 10 | GEÇTİ | boss dalgası ölüm payı %26 |
| 11 | GEÇTİ | Lv3 < 0,6× yok; yeniler 0,71–1,19× |
| 12 | GEÇTİ | normal dalga 47,4 sn; boss p95 64,5 sn |
| 13 | **KALDI** | orta dalga 20 kalan altın 1171 |
| 14 | ATLANDI | fps ölçülmedi; düşman zirvesi 50 (sim maks 73) |
| 15 | GEÇTİ | 19 silahın hepsi ≥ %20 |

**Güncel eğri formülleri** (B2'nin yerine geçer):
```js
function hpMul(w){  return (1 + 0.25*(w-1) + 0.016*(w-1)*(w-1))
                         * Math.pow(1.12, Math.min(6, Math.max(0, w-18)))
                         * Math.pow(1.30, Math.max(0, w-31)); }
function dmgMul(w){ return (1 + 0.10*(w-1))
                         * Math.pow(1.06, Math.min(6, Math.max(0, w-18)))
                         * Math.pow(1.10, Math.max(0, w-31)); }
function enemyCount(w){ return Math.round(Math.min(90, 10 + 3*w) * (w % 5 === 0 ? 0.8 : 1)); }
function eliteChance(w){ return w < 10 ? 0 : Math.min(0.10, 0.04 + 0.004*(w-10)); }
bMul = 0.8 + 0.06*(k-1)
```

### Tur 9: son dokunuş (geliştirici)
| id | alan | sebep |
|---|---|---|
| girdap | dmg 9→7,5 | Tam doğrulamada Lv1 kalabalık DPS'i medyanın 1,56 katı çıktı (hedef ≤ 1,3×) |

### Sayıyla çözülemeyen sorunlar (geliştiriciye)
1. **#13 altın birikmesi (mekanik):** Orta bot dalga 20'de ~1 170 altın taşıyor, çünkü tüm tılsımlar tavanda ve kollar Lv3 dolu. Lv4 için aynı türden 4 kopya daha gerekiyor: yuva hokkabazlığı ya da Lv2 satışı. Öneri: sonsuz bir altın yutağı. Örneğin fiyatı her alımda +%15 artan, tavansız bir "Derin Yatırım" tılsımı (+%3 hasar), ya da Lv3 bir silahın üstüne tek alımla Lv4'e çıkaran "Efsane Parşömeni" (≈ 4× fiyat). Tılsım tavanlarını yükseltmek sayısal bir çözüm olurdu ama tüm botları aynı oranda güçlendirir, eğriyi yeniden kaydırır ve iyi/orta farkını daraltır; bu yüzden yapmadım.
2. **#8 yakın dövüş üstünlüğü (sınıf eşiği):** Yakın sınıfı 4 silahtan 6'ya çıktı (mızrak, kıskaç), bu yüzden tier-2 +%35 artık çok kolay tutuluyor. Silah hasarlarını kısmak (levye 16→13, diken 15→12, mızrak 20→15) farkı 20→6'ya indirdi; daha fazla kısmak orta/zayıf botları da vuruyor. Öneri: `CLASSES.Yakin.thr` [2,4] → [2,5] ya da tier-2 çarpanı 1,35 → 1,25 (`hitEnemy`). Büyü-ateş archetype'ı en geride (23), çünkü Büyü ve Ateş sinerjileri hasarı doğrudan artırmıyor (A3).
3. **Simülatör–mutasyon entegrasyonu:** Oyunda `MUTATION_STATE` yok. Mutasyon ekranı market üstünde açılıyor ve `startWave` seçilmemiş mutasyonu **rastgele** seçiyor. Sim bunu tanımadığı için bot tercihleri (hasar > hız > can) uygulanmıyor ve `rec.mutations` boş kalıyor (173 koşuda 0 kayıt). Bu ayar rastgele mutasyonlarla yapıldı. Araç `isMutationOpen()`/`mutationChoices` üzerinden seçim yapacak şekilde düzeltilirse orta/iyi2 ~0,5–1 dalga yükselebilir.
4. **Okçu Balığı hedeflemesi:** `advanceTo 55` ile çözüldü. Yine de okçu jeti tüm geç ölümlerde en büyük tek kaynak. İsteğe bağlı mekanik: silahlar menzildeki uzaktan saldıran düşmanlara (beh `ranged`) en yakından önce öncelik versin.
5. **Kalabalık testi doygunluğu:** Girdap ve levye gibi alan silahlarında hasarın düşürülmesi, dalga 8 testinde DPS'e zayıf yansıyor (düşman arzı sınırlı). #11 bu silahlar için güvenilir değil; dalga 15 kalabalığıyla ek bir test önerilir.
