# Octo-Shooter v3

Derin denizde geçen, tek dosyalık bir tarayıcı **dalga-savunma** oyunu. Ekranın ortasında bir ahtapotsun. Her kolunda bir silah var ve silahlar kendiliğinden ateş ediyor. Dalgalar arasındaki markette doğru silahları, tılsımları ve birleştirmeleri seçerek olabildiğince derine inmeye çalışırsın.

## Nasıl oynanır
- **Dalga:** Kollar menzildeki düşmana kendiliğinden saldırır. Sağ üstte duraklat, 1x/2x/4x hız ve hasar sayısı düğmeleri var. Sayaç önce son düşmanın doğmasına kalan süreyi, sonra kalan düşman sayısını gösterir. Bir dalgada can biterse oyun biter. Dalga sonunda can tamamen dolar.
- **Market:** Kart alınca silah boş bir kola takılır. Silahı **sürükle-bırak** ile taşıyabilir, yer değiştirebilir ya da aynı tür ve seviyedeki iki silahı birleştirebilirsin (Lv2, Lv3; 15. dalgadan sonra Lv4). Bu hem fareyle hem dokunmatikle çalışır. Tılsımlar kalıcı bonus verir. "Derin Deniz İncisi"nin tavanı yoktur ve fiyatı her alımda artar.
- **Sinerji:** Her silahın iki sınıfı var (Mermi, Büyü, Ateş, Uzun Menzil, Yakın Dövüş, Çubuk, Kontrol, Kan). Aynı sınıftan **farklı** silahlar eşiğe ulaşınca bonus açılır.
- **Boss ve mutasyon:** Her 5. dalgada dönüşümlü bir boss gelir: Köpekbalığı, Yengeç Kral, Dev Kalamar, Fener Balığı. 25. dalgadan sonra bosslar Öfkeli olur. 10. dalgadan itibaren boss yenilince 3 karttan 1 kalıcı **mutasyon** seçersin.
- **Derinlik:** Her dalga 25 m derinlik demek. Sığ Resif'ten sonra Alacakaranlık Bölgesi (elit düşmanlar), Gece Bölgesi ve Uçurum gelir. Oyun bitti ekranı ulaşılan derinliği, oyun süresini ve rekoru gösterir. Rekor tarayıcıda saklanır.

## Paylaşım
Oyunun tamamı `index.html` dosyasıdır. Kurulum ya da sunucu gerekmez: dosyayı tarayıcıda açman (ya da herhangi bir statik barındırmaya koyman) yeterli. Telefonda (dikey/yatay) ve masaüstünde çalışır. İnternet bağlantısı gerekmez.

## Denge nasıl ölçülür
`tools/` klasöründe üç araç var:
- `sim.js`: oyunu Node içinde olduğu gibi çalıştırıp bot stratejileriyle yüzlerce koşu oynatır. `--accept` seçeneğiyle DESIGN.md'deki kabul ölçütlerini puanlar.
- `smoke.mjs`: Playwright ile telefon ve masaüstünde uçtan uca test yapar.
- `qa.mjs`: görsel ve arayüz kontrolü yapar.

Tasarım hedefleri ve ayar günlüğü [DESIGN.md](DESIGN.md) dosyasında. Kullanım ayrıntıları için [tools/README.md](tools/README.md).
