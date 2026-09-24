# Turn Based War — Gölge Kalesi'nin Laneti

Hex ızgarada oynanan, D&D esintili, sıra tabanlı bir taktik RPG. Üç kahramanlık ekibini kur,
4 bölüm ve 14 savaş boyunca Karataş köyünü tehdit eden Lich Kadir'e ulaş.

## Nasıl oynanır?

Kurulum yok. `index.html` dosyasına çift tıkla, oyun tarayıcıda açılır (Chrome / Edge / Firefox).
İnternet bağlantısı gerekmez. İlerleme tarayıcıya otomatik kaydedilir ("Devam Et").

**Klavye kısayolları:** `1` Hareket · `2` Saldırı · `3` Büyü · `4` Yetenek · `5` Eşya ·
`E` / `Enter` Turu Bitir · `Esc` / sağ tık İptal · düşman turunda `Space` basılı tut = hızlandır.
Oyun içindeki **? Nasıl Oynanır** ekranında tüm kurallar anlatılıyor.

## İçerik

- 4 bölüm: Uğultulu Orman → Bataklık / Örümcek Mağarası (seçimli yol) → Kripta → Gölge Kalesi
- 14 savaş (4 boss, 1 "hayatta kal" görevi, takviye dalgaları, 1 yan görev), ~45–75 dk oynanış
- 22 düşman tipi, 25 eşya, mağaza ve kamp, seviye 6'ya kadar ilerleme, yeni büyüler ve sınıf yetenekleri
- Pixel-art grafikler, sentezlenmiş müzik ve ses efektleri (ayarlardan açılıp kapatılabilir)
- 3 zorluk: **Hikâye** / **Normal** / **Zor** (kampta istediğin an değiştirebilirsin)
- Her zaferden sonra kısa mola, her yeni bölümde tam dinlenme
- Bitiş istatistikleri ve **Yeni Oyun+** (seviyeni koruyarak, daha güçlü düşmanlarla)

## Klasör yapısı

| Yol | İçerik |
|---|---|
| `index.html`, `style.css` | Oyun sayfası ve görünüm |
| `js/` | Motor (`engine.js`), düşman yapay zekâsı (`ai.js`), çizim (`render.js`, `art.js`, `sprites.js`), ses (`audio.js`), akış (`campaign-flow.js`), kayıt (`save.js`) |
| `js/content/` | Oyun içeriği: düşmanlar, eşyalar, ilerleme, kampanya, yardım metinleri |
| `docs/` | Tasarım belgesi, ekip sözleşmesi, test raporu, grafik önizleme |
| `tests/` | Otomatik testler (geliştiriciler için) |

## Geliştiriciler için: testler

```
cd tests && npm install
npm test                    # motor/kural testleri
npm run test:campaign       # her savaş için denge simülasyonu
npm run test:e2e            # tarayıcıda otomatik oyuncu
npm run test:e2e-campaign   # tam kampanya uçtan uca
```
Hata ayıklama modu: `index.html?debug=1` (konsolda `window.__TBW`).
