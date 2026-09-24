# Köşe Market 🛒🐈

Mahallenin en tatlı köşe dükkânını işlettiğin, sakin ve sevimli bir tarayıcı oyunu.
Rafları doldur, kepenkleri aç, dükkânın üstünde beliren **baloncuklara** dokunarak sorunları çöz ve
dükkân kedisi **Pamuk**'la birlikte "Mahallenin Yıldızı" ol. Bir oyun ~45–55 gün, yaklaşık **1–1,5 saat** sürer.

## Nasıl çalıştırılır?
Kurulum yok, kütüphane yok. `index.html` dosyasını tarayıcıda açman yeterli (file:// da çalışır).
İstersen yerel sunucuyla:

```bash
cd kose-market
python3 -m http.server 8000   # sonra http://localhost:8000
```

Fontlar (Fredoka, Nunito) Google Fonts'tan gelir; internet yoksa oyun yuvarlak sistem fontlarıyla aynen çalışır.
Kayıt tarayıcının `localStorage`'ında tutulur ve her akşam otomatik yapılır.

## Nasıl oynanır?
Her oyun günü üç bölümden oluşur:

1. **Sabah** – Gün kartına bak: haftanın günü, hava, günün olayı, **günün hedefi** ve bugün uğrayacak komşular.
   Stok al (`+1`, `+5`, `Doldur` ya da **Dengeli Doldur**), yeni ürünlerin kilidini aç, yükseltme al.
   Sonra seç: **Dükkânı Aç ▶** ya da **Hızlı Geç ⏩**.
2. **Gün** (~75 sn) – Müşteriler kendiliğinden gelir, raftan alır, kasada öder. Dükkânda bir şey ters gidince
   üstünde **baloncuk** çıkar: ürün bitti 📦, yer kirlendi 🧽, bozuk para lazım 🪙, Pamuk kutuyu devirdi 🐈, kapıda kurye…
   Dokun → küçük bir ödül ve sorun çözülür. Süresi dolan baloncuk küçük bir ceza verir (kaçan müşteri, memnuniyet düşüşü, satış durması).
   Art arda hızlı dokunuşlar **kombo** yapar (x1.0 → x2.0). Komşu 👋, Pamuk'u sev 🐈 ve altın ⭐ baloncukları ceza vermez.
3. **Akşam** – Rapor: ciro, baloncuk kazancı, kombo, memnuniyet, itibar ve
   **"Oynayarak +₺X fazla kazandın"** satırı (aynı günü hızlı geçseydin ne kazanacağının tahmini).

İtibar kazandıkça seviye atlarsın; yeni ürünler, yükseltmeler ve olaylar açılır.
Son yükseltme **Büyük Açılış** alınınca final sahnesi ve istatistikler gelir, ardından dükkân sonsuz modda açık kalır.
Paran biterse iflas yok: Pamuk'un kumbarası küçük bir destek verir 🐷.

## Tasarım: oyna mı, hızlı geç mi?
- **Hızlı Geç**, oynanan günle *aynı* tohumlu simülasyonu baloncuklara hiç dokunmadan çalıştırır. Aradaki fark bu yüzden
  mekanik olarak doğal çıkar: baloncuk ödülleri, acil tedarik, kaçmayan müşteriler, günün hedefi ve daha yüksek memnuniyet.
- Hedef: erken oyunda oynanan gün, atlanan günden en az **%20** daha kârlı; orta/geç oyunda en az ~%12.
  Sabah ekranındaki butonlar bugünün tahmini kârını gösterir (ör. "tahmini kâr ~₺190" / "~₺135 · baloncuk yok").
- Acelen varsa hızlı geçmek serbest: dükkân yine açılır, sadece sorunlar çözülmez ve memnuniyet biraz düşer.
- Günler birbirinden farklıdır: haftanın günü (müşteri sayısı, talep), hava (pencereden görünür; yağmurda şemsiye ve çamur,
  sıcakta dondurma), günün olayı (maç, festival, denetim, elektrik kesintisi… sahnede dekoruyla), günün hedefi ve komşuların istekleri.

## Kontroller
| Tuş / hareket | İş |
|---|---|
| Baloncuğa dokun / tıkla | Sorunu çöz (inatçı leke 3 dokunuş ister) |
| **Space** | Başlıkta devam · sabah dükkânı aç · gün içinde mola · akşam yeni güne geç |
| **P** / **Esc** | Gün içinde mola (çay molası ☕) |
| `1x` / `2x` | Oyun hızı (2x'te baloncuklar da hızlanır, adil kalır) |
| ⚙️ | Ses aç/kapa, ana menü, oyunu sıfırla |

Sekme gizlenince gün otomatik duraklar. Telefonda dikey ve yatay çalışır (360 px genişliğe kadar);
dikey ekranda sahne kenarlardan hafifçe kırpılıp büyütülür.

## Dosyalar
| Dosya | İçerik |
|---|---|
| `index.html`, `style.css`, `bubbles.css` | Ekranlar, HUD, paneller, baloncuk stilleri |
| `js/data.js` | Tüm içerik ve denge sayıları (ürünler, yükseltmeler, baloncuklar, hava, olaylar, komşular, seviyeler, hikâye) |
| `js/engine.js` | DOM'suz motor (`Game`): durum, ekonomi, tohumlu gün simülasyonu, kayıt — Node'da da çalışır |
| `js/bubbles.js`, `js/sfx.js` | Baloncuk katmanı ve WebAudio ile minik sesler |
| `js/render.js` | Canvas dükkân sahnesi (960×540 mantıksal) |
| `js/ui.js`, `js/main.js` | Ekran akışı, paneller, ana döngü, kısayollar |
| `tools/sim.js` | Denge simülasyonu |
| `CONTRACT.md`, `tools/BALANCE_REPORT.md` | Ekip sözleşmesi ve denge raporu |

## Denge simülasyonu (`tools/sim.js`)
Node ile farklı oyuncu modellerini (gündelik, iyi, hep atla, karışık) onlarca gün oynatır ve hedefleri kontrol eder:

```bash
node tools/sim.js --seeds 4            # hızlı kontrol (hepsi ✔ olmalı)
node tools/sim.js --seeds 16 --days 90 # raporda kullanılan ayrıntılı koşu
node tools/sim.js --decomp             # oyna−atla farkının kaynakları
node tools/sim.js --days-table         # ilk tohumun gün gün tablosu
node tools/sim.js --set dayLength=60   # BALANCE'ı geçici değiştirip dene
node tools/engine-test.js              # motorun temel testleri
```

Çıktının sonundaki **HEDEF KONTROLÜ** bölümünde oyna/atla oranları, kazanma günü, tahmini oyun süresi ve
baloncuk sayıları için ✔/✘ listelenir.

## Hata ayıklama
Tarayıcı konsolunda `Game` (motor) ve `KM` (ekran akışı) globalleri var. Örnekler:
`Game.state.money += 1000; KM.goMorning()` · `Game.autoDay({hitRate: .7, reactSec: 1.3})` · `KM.skipDay()`.
