# Köşe Market — Denge Raporu (Mekanik v2)

Bu rapor `node tools/sim.js` çıktılarından derlenmiştir. Tüm sayılar **Normal** zorlukta, 75 sn'lik gün, tohumlar 1000+ (deterministik) içindir; aksi belirtilmedikçe 32 tohum / en çok 130 gün.
Yeniden üretmek için:

```
node tools/sim.js --seeds 32 --days 130 --dominance --table dikkatli
node tools/sim.js --seeds 16 --days 130 --players dikkatli --diffs
node tools/sim.js --seeds 16 --days 5 --roi --players dikkatli
node tools/engine-test.js            # 55 birim testi
```

## 1. Önceki durum (v1) ve neden "kolay"dı

- Zorluk yalnızca gelir çarpanıydı: oyuncu para kaybetmiyor, sadece geç alıyordu. Kira/gider/borç yoktu; iflas mümkün değildi.
- Oyuncu stoğu, fiyatı, rafı umursamasa bile dükkân kendiliğinden büyüyordu; baloncuklar "bonus"tu, kaçırmanın gerçek bedeli yoktu.
- Ölü içerik: etkisiz yükseltmeler, kâr düşüren ürün kilitleri, anlamsız Sv.9, ölü BALANCE anahtarları/istatistikleri.
- Hata (B1–B10): gün ortasında Ana Menü/yenileme ile "save-scum", akşam raporunun kaybolması, tahminin kesin olması vb.

## 2. Eklenen gerçek mekanikler

| Mekanik | Gerçek bedel / karar |
|---|---|
| Fiyat (Ucuz/Normal/Pahalı) + esnek talep + sıcak/soğuk etkisi | Her ürünün esnekliği farklı; yanlış fiyat ciroyu düşürür (tüm-Ucuz −%11, tüm-Pahalı −%5, akıllı +%11) |
| Rakip zincir (Zincir Market, gün ~12) | Müşteri çalar; sadakat, kampanya ve rafın doluluğu payı belirler |
| Sabit gider: günlük elektrik + yükseltme aidatı, haftalık kira (gün ve ek raf yuvasına bağlı, haftalık kârın %90'ıyla sınırlı) | Büyümek de maliyet getirir; boş raf yuvası ve depo "bedava" değil |
| Borç + faiz (%3/gün) + iflas (limit aşımı ya da 14 borçlu gün) | Yeniden Başla / Son Kayıttan; pazartesi kontrol noktası |
| Kriz kartları (11 adet), baloncuk salvoları | Seçim yapılmazsa/ıskalanırsa gerçek ceza; tek "doğru" seçenek yok |
| Hırsızlık + güvenlik, ekipman aşınması (buzdolabı/yazarkasa) + bakım | Atlanan günde ×1,8 hırsız; arızada ürün bozulur / müşteri kaçar |
| Raf ömrü (FIFO parti) + toplam raf yuvası | Fazla stok bozulur; az stok müşteri kaçırır; yuva sınırı akıllı doldurmayı zorunlu kılar |
| Zorluk seviyeleri Kolay / Normal / Zor / Mahalle Efsanesi | Kira, rakip, hırsız, kriz, arıza, baloncuk ömrü, ceza, kumbara, kontrol noktası değişir |

Düzeltilen ölü içerik: etkisiz yükseltmeler ya yeni etki ya da kaldırıldı; her ürün kilidi kâr ekliyor (ROI testi); her stat ve BALANCE anahtarı kullanılıyor (engine-test doğrular); sonsuz modda mevsimler ve hedefler var.

## 3. Oyuncu modelleri — sonuçlar (Normal, 32 tohum, 130 gün)

| Oyuncu | Kazanan | İflas | Bitmedi | Kazanma günü (medyan [min–max]) | Süre (dk) | İflas günü |
|---|---|---|---|---|---|---|
| dikkatli | **%100** | %0 | %0 | 50 [49–53] | ~82 | — |
| ortalama | **%63** | %9 | %28 | 80 [63–126] | ~131 | 62 |
| karışık %70 (dikkatli, günlerin %30'unu atlar) | %84 | %9 | %6 | 74 [59–105] | ~90 | 70 |
| kötü | %0 | %100 | %0 | — | — | 27 |
| ihmalkâr | %0 | %100 | %0 | — | — | 24 |
| hep atla | %0 | %100 | %0 | — | — | 24 |

Hedef kontrolü: dikkatli ≥%85 ✔ (%100), kazanma günü 45–60 ✔ (50), süre ~1–1,5 saat ✔ (~82 dk), ortalama %55–75 ✔ (%63), ihmalkâr/kötü/hep-atla batar ✔.

Dikkatli oyuncuda: ~30 baloncuk/gün (0,5 kaçırır), salvo 1,4/gün, kriz 0,8/gün, bozulan ürün ~1,8/gün, negatif kârlı gün 0/1575, borçlu gün %0.

## 4. Beceri / atlama duyarlılığı (24 tohum)

Ortalama oyuncunun isabet oranı (react 1,5):

| isabet | .95 | .85 | .75 | .70 | .66 | .60 | .50 |
|---|---|---|---|---|---|---|---|
| kazanan | %100 | %100 | %100 | %96 | %58 | %0 | %0 |
| iflas | %0 | %0 | %0 | %4 | %13 | %92 | %100 |
| gün | 54 | 58 | 62 | 69 | 84 | — | — |

Gün atlama (playFrac = oynanan gün oranı):

| oyuncu | 0,95 | 0,90 | 0,70 | 0,50 |
|---|---|---|---|---|
| dikkatli | — | %100 kazan, gün 53 | %100, gün 63 | %21 kazan / %71 iflas |
| ortalama | %13 kazan / %67 iflas | %0 / %92 iflas | — | — |

Yorum: beceri gerçekten ödüllendiriliyor (isabet .75 → gün 62, .66 → %58, .60 → iflas). **Dürüst uyarı:** ortalama oyuncu bir "yoksulluk tuzağı" eşiğinin kenarında (gelir ≈ gider); isabeti ~%66'nın altına inen ya da günlerin ≥%5'ini atlayan ortalama oyuncu çoğunlukla batar. Bu, "her an tetikte ol" isteğine uygun ama geçiş keskin.

## 5. Zorluk seviyeleri (16 tohum)

| Seviye | dikkatli | ortalama | ihmalkâr |
|---|---|---|---|
| Kolay | %100, gün 47 | %100, gün 59 | %0 (iflas %100) |
| Normal | %100, gün 50 | %56 (iflas %13, bitmedi %31), gün 84 | %0 (iflas %100) |
| Zor | %100, gün 63 | %0 (iflas %100) | %0 (iflas %100) |
| Mahalle Efsanesi | %50 kazan / %31 iflas / %19 bitmedi, gün 98 | %0 | %0 |

## 6. "Baskın strateji var mı?" (dikkatli beceri, gün 1–40 net kâr)

| Strateji | Net ₺ | Taban |
|---|---|---|
| Taban (Normal fiyat, dengeli doldur, akıllı yükseltme) | 12 371 | 0% |
| Hepsi Ucuz | 11 069 | −11% |
| Hepsi Pahalı | 11 809 | −5% |
| Akıllı fiyat (ipuçlarına göre) | 13 699 | +11% |
| Stok ×0,5 | 10 380 | −16% |
| Stok ×1,6 | 11 761 | −5% |
| Stok ×2,5 | 11 561 | −7% |
| Hiç yükseltme alma | 8 925 | −28% |

Hiçbir basit politika tabanı geçemiyor (yalnızca ipuçlarını okuyan akıllı fiyat %11 fazla: beklenen ödül). Hiçbiri iflasa sokmuyor çünkü beceri taban.

## 7. Yükseltme / ürün ROI (128 anlık görüntü × 6 gün, 3 oyun tarzı)

- Ölü (≈₺0/zararlı) yükseltme: **yok**. Kâr düşüren ürün kilidi: **yok**.
- En yüksek ek kâr: tabela-4, ₺52/gün (aşırı değil; maliyet 2200 → geri dönüş 42 gün).
- Geri dönüşü 120 günden uzun kalem: 3 (paspas-2: 200, depo-1: 132, bitkiler-1: 123) — bunlar konfor/dayanıklılık kalemleri; yeniden tasarım yerine bilinçli bırakıldı (≤4 sınırı içinde).
- Güvenlik, çırak, paspas-1, kedi yatağı dikkatli oyuncuda ≈0/negatif görünür; çünkü dikkatli oyuncu hırsızı zaten yakalar/atlanmış günlerde etkisi çıkar ("atla" tarzında +₺7…25/gün). Yani etkileri gerçek ama beceriyle ikame edilebilir.
- Erken ürünler (simit/süt/meyve suyu) 3–14 günde geri döner; pasta ve çiçek sadece iyi oyuncu/ortalama için kâr getirir.

## 8. Bilinen sınırlamalar (dürüst)

1. Ortalama oyuncunun kazananları medyan gün ~80 (~2 saat+); hedef ortalama oyuncu için gün sayısı verilmemişti ama uzun.
2. Dikkatli oyuncu Normal/Zor'da neredeyse hiç kaybetmiyor; yalnızca Mahalle Efsanesi onu gerçekten zorluyor (%50).
3. Ortalama oyuncu sonuçları bir uçuruma yakın: küçük beceri değişimi büyük kazanma farkı yaratıyor (bkz. §4).
4. Hırsızlık ve ekipman arızası dikkatli oyuncuyu çok az etkiliyor (bakım yapıyor, hırsızı yakalıyor); atlayan/beceriksiz oyuncuyu ciddi etkiliyor.
5. ROI ölçümü gürültülü (6 günlük klon penceresi); paspas-2/depo-1/bitkiler-1 ölçülen tarzlarda >120 gün.
6. `dist/KoseMarket.html` yeniden üretilmedi (görsel ajanın `render.js` düzenlemeleriyle çakışmamak için).
