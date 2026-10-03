# Köşe Market 🛒🐈

Mahallenin en tatlı dükkânını işlettiğin tarayıcı oyunu: rafları doldur, **fiyatları ayarla**, kira ve faturayı çıkar, rakip markete karşı ayakta kal,
dükkânın üstünde beliren **baloncuklara** dokun, hırsızı yakala, kriz kartlarında karar ver ve dükkân kedisi **Pamuk**'la "Mahallenin Yıldızı" ol.
Oyun tatlı ama **kaybedilebilir**: ihmal edersen borca batarsın. Bir oyun dikkatli oyuncuda ~45–55 gün (≈1–1,5 saat), rahat oynayanda daha uzun sürer.

## Nasıl çalıştırılır?
Kurulum yok, kütüphane yok. `index.html` dosyasını tarayıcıda açman yeterli (file:// da çalışır). İstersen yerel sunucuyla:

```bash
cd kose-market
python3 -m http.server 8000   # sonra http://localhost:8000
```

Fontlar (Fredoka, Nunito) Google Fonts'tan gelir; internet yoksa oyun yuvarlak sistem fontlarıyla aynen çalışır.
Kayıt tarayıcının `localStorage`'ında tutulur (`koseMarket.v2`); eski v1 kayıtlar otomatik taşınır (bildirimle).

## Zorluk seviyeleri (yeni oyunda seçilir)
Zorluk sadece gelir çarpanı değildir; **mekaniklerin yoğunluğunu** değiştirir: kira, rakibin açılış günü ve saldırganlığı, hırsız/arıza/kriz sıklığı,
baloncuk ömrü, kaçırma cezası, raf ömrü, fiyat duyarlılığı, borç limiti, faiz, kumbara hakkı ve iflasta "Son Kayıttan Devam".

| Seviye | Kime göre |
|---|---|
| 🌱 Kolay | Rahat başlangıç; ucuz kira, geç ve yumuşak rakip, uzun baloncuklar, bol kumbara |
| 🛒 Normal | **Dikkatli oyuncuya adil, ihmale acımasız.** Önerilen |
| 🔥 Zor | Ağır kira, erken ve saldırgan rakip, sık hırsız/arıza, kısa baloncuklar |
| 👑 Mahalle Efsanesi | Tek can: kumbara yok, iflasta son kayıt yok. Dikkatli oyuncu bile çoğu zaman batar |

## Nasıl oynanır?
Her oyun günü üç bölümden oluşur:

1. **Sabah** – Gün kartı (hava, olay, hedef, rakip kampanyası, uğrayacak komşular), **finans şeridi** (Pazar kirası, günlük gider, borç, kumbara),
   **ekipman paneli** (dolap/kasa durumu, bakım), **raf yuvası** çubuğu ve ürün kartları. Her ürün kartında **Ucuz / Normal / Pahalı** fiyat düğmeleri,
   rakibin fiyatı, "ihtiyaç/dürtü" etiketi ve "yarın bozulur" uyarısı var. Stok al, ürün aç, yükseltme al; sonra **Dükkânı Aç ▶** ya da **Hızlı Geç ⏩**.
   Tahmin kutusu kesin sonuç değil, olası aralıktır.
2. **Gün** (~75 sn) – Müşteriler gelir, raftan alır, kasada öder. Baloncuklar: ürün bitti 📦, yer kirli 🧽, bozuk para 🪙, kuyruk 🧍…
   Dokun → küçük ödül ve sorun çözülür. **Kaçırırsan gerçek zarar** (para, kaçan müşteri, memnuniyet, durmuş satış). Zaman zaman **yoğun saat (salvo)** olur:
   baloncuklar art arda gelir, önce halkası kırmızıya dönene bas. Özel baloncuklar:
   🕵️ **şüpheli müşteri** (basmazsan en pahalı raftan mal çalar), 🧊/🧾 **ekipman arızası** (basmazsan bozulur), ❓ **kriz kartı** (9 sn içinde karar ver;
   seçmezsen "görmezden gel" gerçekleşir; klavyede 1–3 / 0). Art arda hızlı dokunuşlar **kombo** yapar.
3. **Akşam** – Rapor ve **akşam hesabı**: elektrik/maaş, (Pazar) kira, faiz, depolama gideri; ödenemeyen kısım **borca** yazılır. Rapor kalıcıdır (yenilesen de gelir).

### Ekonomi kuralları (kısa)
- **Fiyat:** her ürünün talebi kendi fiyatına bağımsız tepki verir (esneklik ürüne göre). Zorunlu ürünlerde zam, dürtü ürünlerinde indirim çoğu zaman kazandırır;
  "aranıyor" 🔥 ürünlerde müşteri zamma daha toleranslıdır. Rakip varken fiyat karşılaştırması sertleşir.
- **Zincir Market (rakip):** 12. gün civarı açılır, müşterinin bir kısmını çeker, kampanya yapar. Memnuniyet, Sadakat Kartı ve Bitkiler seni korur.
- **Kira + borç + iflas:** her Pazar akşamı kira (zamanla ve dükkân/raf büyüdükçe artar); günlük elektrik/maaş; ödenemezse borç (günlük faiz). Borç limitini aşarsan ya da
  14 gün kesintisiz borçlu kalırsan **iflas**: *Yeniden Başla* ya da (Efsane hariç) *Son Kayıttan Devam* (Pazartesi sabahı). Pamuk'un kumbarası oyun boyu sınırlı hak.
- **Raf yuvası + raf ömrü:** toplam yuva sınırlı (Ek Raf / Soğuk Hava Deposu artırır); taze ürünler birkaç gece dayanır, buzdolabı ömrü uzatır; soğuk ürünler
  (süt, peynir, dondurma, pasta, çiçek) dolap olmadan %30 az satar. Fazla stok bozulur ve depolama gideri yapar.
- **Hırsız ve arıza:** Hızlı Geç günlerinde dükkân başıboştur → hırsız ~×1,8, baloncuklar kaçar, kriz kartları "görmezden gel" olur. Dolap/kasa yıprandıkça arıza riski artar; sabah ucuz *bakım*, arıza sonrası pahalı *tamir*.
- Her yükseltmenin faydası ve bir bedeli (günlük gider/kira/risk) vardır; hiçbiri "al ve unut" değildir. Sonsuz modda (final sonrası) 10 günlük **sezon hedefleri** vardır.

İtibar kazandıkça seviye atlarsın; yeni ürünler, yükseltmeler ve olaylar açılır. Son yükseltme **Büyük Açılış** alınınca final sahnesi ve istatistikler gelir.

## Kontroller
| Tuş / hareket | İş |
|---|---|
| Baloncuğa dokun / tıkla | Sorunu çöz (inatçı leke 3 dokunuş ister) |
| **Space** | Başlıkta devam · sabah dükkânı aç · gün içinde mola · akşam yeni güne geç |
| **P** / **Esc** | Gün içinde mola (çay molası ☕) |
| **1 / 2 / 3 / 0** | Kriz kartı açıkken seçenekler / görmezden gel |
| `1x` / `2x` | Oyun hızı (2x'te baloncuklar da hızlanır, adil kalır) |
| ⚙️ | Ses, ana menü (gün içindeyse "günü bırak"), oyunu sıfırla |

Sekme gizlenince gün otomatik duraklar. **Gün ortasında sayfayı yenilemek ya da kapatmak o günü "başıboş" geçirir** (kaçış yok). Telefonda dikey ve yatay çalışır.

## Dosyalar
| Dosya | İçerik |
|---|---|
| `index.html`, `style.css`, `bubbles.css`, `mech.css` | Ekranlar, HUD, paneller; `mech.css` mekanik panelleri (style.css'ten önce yüklenir) |
| `js/data.js` | Tüm içerik ve denge sayıları (ürünler, yükseltmeler, baloncuklar, kriz kartları, zorluklar, rakip, hava, olaylar, komşular, seviyeler, hikâye, öğretici satırlar) |
| `js/engine.js` | DOM'suz motor (`Game`): durum, ekonomi, tohumlu gün simülasyonu, kayıt — Node'da da çalışır |
| `js/bubbles.js`, `js/sfx.js` | Baloncuk katmanı ve WebAudio sesleri |
| `js/render.js` | Canvas dükkân sahnesi (960×540 mantıksal) |
| `js/ui.js`, `js/main.js` | Ekran akışı, paneller, ana döngü, kısayollar |
| `tools/sim.js`, `tools/engine-test.js` | Denge simülasyonu ve birim testleri |
| `CONTRACT.md`, `tools/BALANCE_REPORT.md`, `HANDOFF_RENDER.md` | Ekip sözleşmesi, denge raporu, görsel ajan devir notu |

## Test ve denge simülasyonu
```bash
node tools/engine-test.js                 # 50+ birim testi (determinizm, fiyat/rakip, kira/borç/iflas, hırsız, kriz, kayıt, ölü içerik taraması)
node tools/sim.js --seeds 16 --days 120   # oyuncu modelleri: dikkatli / ortalama / kötü / ihmalkâr / hep atla / karışık
node tools/sim.js --dominance             # "baskın strateji var mı?" (fiyat, stok, yükseltme, ürün, bakım, kriz politikaları)
node tools/sim.js --roi                   # her yükseltme/ürün için günlük kâr katkısı ve geri dönüş süresi
node tools/sim.js --diffs --players dikkatli   # zorluk seviyeleri karşılaştırması
node tools/sim.js --table dikkatli        # ilk tohumun gün gün tablosu
node tools/sim.js --set rentPerDay=20     # BALANCE'ı geçici değiştirip dene
```
Çıktının sonundaki **HEDEF KONTROLÜ** ✔/✘ listeler (`--strict` ile ✘ varsa çıkış kodu 1).

## Hata ayıklama
Tarayıcı konsolunda `Game` (motor) ve `KM` (ekran akışı) globalleri var. Örnekler:
`Game.state.money += 1000; KM.goMorning()` · `Game.autoDay({hitRate: .7, reactSec: 1.3})` · `KM.skipDay()` · `Game.state.debt = 9999`.
