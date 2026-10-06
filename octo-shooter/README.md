# Octo-Shooter v3

Derin denizde geçen, tek dosyalık bir tarayıcı **dalga-savunma** oyunu. Ekranın ortasında bir ahtapotsun. Her kolunda bir silah var ve silahlar kendiliğinden ateş ediyor. Dalgalar arasındaki markette doğru silahları, tılsımları ve birleştirmeleri seçerek, dalga içinde de **kalkan ve işaretle** düşman saldırılarını yöneterek olabildiğince derine inmeye çalışırsın.

## Nasıl oynanır
- **Dalga:** Kollar menzildeki düşmana kendiliğinden saldırır. Sağ üstte duraklat, 1x/2x/4x hız ve hasar sayısı düğmeleri var. Sayaç önce son düşmanın doğmasına kalan süreyi, sonra kalan düşman sayısını gösterir. Bir dalgada can biterse oyun biter.
- **Aktif yetenekler (dalga içinde sen oynarsın):**
  - **Kabuk Kalkanı** — `Q` ya da `Boşluk` tuşu, ya da ekrandaki yuvarlak kalkan düğmesi. 1 sn boyunca tüm hasarı yutar; bekleme 12 sn. Kırmızı çizgi (telegraf) görüp tam çarpmadan önce açarsan **savuş** olur ve bekleme %35 kısalır. Sedef Pul tılsımı ve Sığınak mutasyonu beklemeyi kısaltır. 2x/4x hızda kalkanın süresi oyun zamanıyla akar: zamanlaması zorlaşır, 1x'te savuşmak kolaydır.
  - **Odak İşareti** — bir düşmana dokun/tıkla: kollar önce onu vurur. Aynı düşmana tekrar dokunmak işareti kaldırır. Kement Balığı, boss çağrıları ve elitler için.
- **Telegraflar:** Tehlikeli saldırılar önceden uyarır (en az 0,35 sn): okçunun nişan çizgisi, kalamarın mürekkep yelpazesi, Fener Balığı'nın ışık huzmesi, köpekbalığı/barakuda hücumu, Kement Balığı'nın ağı. Ekran dışından gelen tehditler kenar okuyla gösterilir. **Baskın**: kırmızı bir yay belirirse 1 sn sonra o yönden düşman akını gelir.
- **Kızışan Sular:** Dalgayı hasarsız bitirirsen sular kızışır: sonraki normal dalgada +%14 düşman, +%8 can (seviye başına, en çok 4 seviye), karşılığında +%15 düşman altını. Maks canın %12'sinden fazla hasar yersen seviye düşer. Boss dalgalarında düşman çarpanı uygulanmaz.
- **Market:** Kart alınca silah boş bir kola takılır. Silahı **sürükle-bırak** ile taşıyabilir, yer değiştirebilir ya da aynı tür ve seviyedeki iki silahı birleştirebilirsin (Lv2, Lv3; 15. dalgadan sonra Lv4). Hem fareyle hem dokunmatikle çalışır. "Başlat" düğmesi üstte yapışkan şeritte, her zaman ekranda. Tılsımlar kalıcı bonus verir. "Derin Deniz İncisi"nin tavanı yoktur ve fiyatı her alımda artar. Dalga 6'dan sonra can tam dolmaz: dalga arası eksik canın %70'i + maks canın %8'i döner; **Kabuk Onar** (6+2×dalga altın, +%25 can, market başına 2 kez) ile tamamlarsın. Biriken altının gideri: **✨ Kol Cilası** (seçili kola kademe başına +%5 hasar, en çok 6 kademe; 25+20×kademe altın). Silah fiyatları dalga 12'den sonra dalga başına +%4 artar.
- **Kol sırası önemlidir (Komşu Bağı):** Çemberde yan yana duran iki kol ortak sınıf paylaşıyorsa her ikisi komşu başına +%7 hasar alır (en çok +%14). Boş yuva bağı keser. Bağlar markette teal çizgi ve rozetle görünür; silahları sürükleyip yer değiştirmek gerçek bir karardır.
- **Sinerji:** Her silahın iki sınıfı var (Mermi, Büyü, Ateş, Uzun Menzil, Yakın Dövüş, Çubuk, Kontrol, Kan). Aynı sınıftan **farklı** silahlar eşiğe ulaşınca bonus açılır.
- **Boss ve mutasyon:** Her 5. dalgada dönüşümlü bir boss gelir: Köpekbalığı, Yengeç Kral, Dev Kalamar, Fener Balığı (artık dördü de ahtapota hasar verir). 25. dalgadan sonra bosslar Öfkeli olur. 10. dalgadan itibaren boss yenilince 3 karttan 1 kalıcı **mutasyon** seçersin.
- **Derinlik:** Her dalga 25 m derinlik demek. Sığ Resif'ten sonra Alacakaranlık Bölgesi (elit düşmanlar), Gece Bölgesi ve Uçurum gelir. Oyun bitti ekranı ulaşılan derinliği, oyun süresini, seni en çok vuran düşmanları ve rekoru gösterir. Rekor tarayıcıda saklanır; eşitlikte daha hızlı olan geçer.

## Paylaşım
Oyunun tamamı `index.html` dosyasıdır. Kurulum ya da sunucu gerekmez: dosyayı tarayıcıda açman (ya da herhangi bir statik barındırmaya koyman) yeterli. Telefonda (dikey/yatay) ve masaüstünde çalışır. İnternet bağlantısı gerekmez.

## Denge nasıl ölçülür
`tools/` klasöründe araçlar var:
- `sim.js`: oyunu Node içinde olduğu gibi çalıştırıp bot stratejileriyle yüzlerce koşu oynatır (botlar kalkan/işaret/kol yerleşimi/onarım dahil insanı modeller). `--accept` seçeneğiyle DESIGN.md'deki kabul ölçütlerini puanlar.
- `exp.js`, `analyze.js`: sabit-yapı deneyleri (sinerji/bağ/tılsım aç-kapa) ve önce/sonra dağılım tabloları.
- `smoke.mjs`, `mech.mjs`, `qa.mjs`: Playwright ile telefon ve masaüstünde uçtan uca, mekanik ve görsel/arayüz testi.
- `perf.mjs`: dalga 30'da fps ölçümü.

Tasarım hedefleri ve ayar günlüğü [DESIGN.md](DESIGN.md) dosyasında. Kullanım ayrıntıları için [tools/README.md](tools/README.md).
