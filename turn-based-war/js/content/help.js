// help.js — Tasarımcı: "Nasıl Oynanır" sayfaları, ilk savaş ipuçları, sözlük, yükleme ipuçları.
// Yalnızca sabit veri (fonksiyon çağırmaz, DOM'a dokunmaz) — CONTRACT.md §2.

// ---------- 1) HELP_PAGES — "Nasıl Oynanır" ekranı ----------
// body basit HTML olabilir: <b>, <br>, <ul><li>.
const HELP_PAGES = [
  {
    title: "Sıra ve AP (Aksiyon Puanı)",
    body: "Her birimin turunda <b>4 AP</b>'si vardır. Sıra, savaş başında atılan <b>d20 + Agility</b> inisiyatifine göre belirlenir.<br><br>" +
      "AP harcamaları:<ul>" +
      "<li><b>Hareket:</b> 1 AP</li>" +
      "<li><b>Dash (ek hareket):</b> 1 AP</li>" +
      "<li><b>Saldırı:</b> 2 AP</li>" +
      "<li><b>Büyü:</b> büyüye göre 1-3 AP</li>" +
      "<li><b>Eşya kullanımı:</b> genelde 1 AP</li></ul>" +
      "AP harcamadıysan bile boşa gidebilir — kullanmadığın AP bir sonraki tura taşınmaz."
  },
  {
    title: "Hareket ve Dash",
    body: "Bir turda en fazla <b>1 hareket + 1 dash</b> yapabilirsin (toplam 2 AP'lik hareket).<br><br>" +
      "İlk hareketinde <b>tüm hızını</b> kullanabilirsin; dash'te ise sadece <b>hızının yarısı</b> kadar gidersin.<br><br>" +
      "Arazi bazı karolarda hareketi pahalılaştırır (bkz. <i>Arazi Tipleri</i>) — kestirme her zaman en hızlı yol değildir."
  },
  {
    title: "Saldırı ve 'Çok Saldırılan Kaçamaz' Kuralı",
    body: "İsabet: <b>d20 + saldırı statı</b> (+varsa bonus) karşısında hedefin savunması: <b>min(N × d20) + Agility + Dodge</b>.<br><br>" +
      "<b>N</b>, o round içinde hedefin kaçıncı kez saldırıya uğradığıdır (+1). Yani bir birim ard arda saldırıya uğradıkça, savunma zarını <b>birden fazla d20 atıp en düşüğünü</b> almak zorunda kalır — çok saldırılan biri gitgide daha kolay isabet alır!<br><br>" +
      "<b>Doğal 20</b> her zaman isabet eder ve hasarı ikiye katlar (kritik). <b>Doğal 1</b> her zaman ıskadır."
  },
  {
    title: "Büyüler ve Slotlar",
    body: "İki tür büyü vardır:<ul>" +
      "<li><b>Cantrip'ler</b> (seviye 0): slot harcamaz, sınırsız kullanılabilir.</li>" +
      "<li><b>Seviyeli büyüler</b> (1. ve 2. seviye): bir <b>büyü slotu</b> harcar, turda sadece <b>1 seviyeli büyü</b> atılabilir.</li></ul>" +
      "Slotlar kampta ve yeni bölüm başında tamamen dolar; her zaferden sonraki kısa molada 1 slot geri gelir. Bazı sınıf özellikleri (<i>Arkan Toparlanma</i> gibi) savaş içinde de slot geri kazandırır.<br><br>" +
      "Hasar veren büyülerde silahlardan farklı olarak <b>hasar zarına stat bonusu eklenmez</b> — sadece isabet zarına eklenir.<br><br>Alan büyüleri <b>yalnızca düşmanları</b> etkiler — dostlarının yanına rahatça atabilirsin."
  },
  {
    title: "Arazi Tipleri",
    body: "<ul>" +
      "<li><b>Zemin / Yol:</b> normal hareket, ekstra etki yok.</li>" +
      "<li><b>Orman:</b> hareketi yavaşlatır ama içindeki birime menzilli saldırılara karşı +2 kaçınma verir.</li>" +
      "<li><b>Zor arazi (bataklık/moloz):</b> hareketi yavaşlatır.</li>" +
      "<li><b>Su:</b> geçilemez (menzilli saldırılar üzerinden gidebilir).</li>" +
      "<li><b>Duvar/Kaya:</b> geçilemez.</li>" +
      "<li><b>Köprü:</b> su üzerinde güvenli, normal hızda geçit.</li>" +
      "<li><b>Tehlike (ateş/zehir):</b> turunu bu karoda bitirirsen hasar alırsın.</li>" +
      "<li><b>Sunak:</b> turunu bu karoda bitiren ekip üyesi iyileşir.</li></ul>"
  },
  {
    title: "Statüler",
    body: "Savaş sırasında karşına çıkacak olumlu/olumsuz durumlar için sağ paneldeki simgelerin üzerine gel — kısa açıklaması çıkar.<br><br>" +
      "Genel mantık: <b>iyileştirici/güçlendirici</b> statüler (Kutsama, Speed, Zırh gibi) yeşil-mavi tonda, <b>zayıflatıcı</b> statüler (Yavaş, Zehir, Uyku gibi) kırmızı-mor tonda gösterilir.<br><br>" +
      "Uyuyan/etkisizleşen bir birim hasar aldığında genelde uyanır — bu yüzden 'Uyku' atılan bir hedefi vurmadan önce iki kez düşün."
  },
  {
    title: "Eşyalar ve Ekip Envanteri",
    body: "Altın ve eşyalar <b>ekipçe ortaktır</b>. Her kahramanın 1 silah, 1 zırh, isteğe bağlı 1 kalkan ve 2 trinket yuvası vardır.<br><br>" +
      "Savaş içinde iksir/bomba kullanmak <b>1 AP</b> tutar (bombalar genelde 2 AP) — kendine veya bitişik bir müttefike/alana kullanılır.<br><br>" +
      "Kamp düğümlerinde mağazadan alışveriş yapabilir, tam iyileşir ve seviye atlarsın."
  },
  {
    title: "Seviye Atlama ve Klavye Kısayolları",
    body: "Her bölüm sonunda (ve savaşlar arasında biriken deneyimle) seviye atlarsın: canın artar, bazı seviyelerde yeni özellik/büyü slotu/statik puan kazanırsın.<br><br>" +
      "<b>Klavye kısayolları:</b><ul>" +
      "<li><b>1</b> Hareket</li>" +
      "<li><b>2</b> Saldırı</li>" +
      "<li><b>3</b> Büyü</li>" +
      "<li><b>4</b> Yetenek</li>" +
      "<li><b>5</b> Eşya</li>" +
      "<li><b>E / Enter</b> Tur Bitir</li>" +
      "<li><b>Esc</b> İptal</li></ul>"
  }
];

// ---------- 2) TUTORIAL_HINTS — ilk 2 savaşta toast olarak çıkan ipuçları ----------
// trigger: "battleStart" | "firstPlayerTurn" | "firstMove" | "firstAttack" | "firstSpell" | "lowHp" | "firstKill"
const TUTORIAL_HINTS = {
  b1: [
    { trigger: "battleStart", text: "Üç kurt aynı anda geldi — sırt sırta durursan hepsini aynı anda karşılamak zorunda kalmazsın." },
    { trigger: "firstPlayerTurn", text: "Sıra sende! Alt kısımdaki butonlarla ya da 1-5 tuşlarıyla Hareket, Saldırı, Büyü, Yetenek veya Eşya seçebilirsin." },
    { trigger: "firstMove", text: "Güzel hareket. Unutma: bir turda en fazla 1 hareket + 1 dash yapabilirsin, ikisi de AP harcar." },
    { trigger: "firstAttack", text: "İlk vuruşun! İsabet d20 + statına karşı hedefin kaçınma zarıyla kıyaslanıyor — kritik (doğal 20) hasarı ikiye katlar." },
    { trigger: "firstSpell", text: "Büyü attın! Seviyeli büyüler slot harcar ve turda sadece bir tane atılabilir, cantrip'ler ise sınırsız." },
    { trigger: "lowHp", text: "Canı azalan biri var — Cleric'in iyileştirmesi ya da bir İyileşme İksiri tam zamanında gelebilir." },
    { trigger: "firstKill", text: "Bir kurt daha az! Ama diğerleri hâlâ etrafta — sırayı ve konumunu unutma." }
  ],
  b2: [
    { trigger: "battleStart", text: "Bu haydutların bir okçusu var — açık arazide durursan uzaktan vurulmaya devam edersin, örtü ya da mesafe kullan." },
    { trigger: "firstAttack", text: "Bir birim art arda saldırıya uğrarsa savunma zarını birden fazla atıp en düşüğünü almak zorunda kalır — çok saldırılan hedef gitgide daha kolay vurulur." },
    { trigger: "firstSpell", text: "Menzilli büyüler yolu boyunca engel olup olmadığına bakmaz ama hedefin menzil içinde olması gerekir — üst paneldeki menzil sayısını kontrol et." },
    { trigger: "lowHp", text: "Zor durumdaysan geri çekilip mesafe açmak da bir seçenek — her savaşı göğüs göğüse bitirmek zorunda değilsin." },
    { trigger: "firstKill", text: "Temiz iş! Kalan düşmanların konumunu ve menzilini kontrol etmeyi unutma." }
  ]
};

// ---------- 3) GLOSSARY — tooltip metinleri ----------
const GLOSSARY = {
  // -- Statlar --
  might: "Ham güç. Yakın dövüş silahlarının çoğunda isabet/hasar statı; HP hesabına da katkı sağlar.",
  agility: "Çeviklik. İnisiyatifi, kaçınmayı (dodge) ve bazı menzilli/ince silahların isabetini belirler.",
  will: "İrade. Cleric'in büyü statı; korku/etki bazlı kurtarma zarlarında kullanılır.",
  mind: "Zihin. Wizard'ın büyü statı; büyü isabetinde ve kurtarma DC'sinde kullanılır.",
  influence: "Etki. Sosyal/ikna odaklı bir stat; bazı diyalog/etkileşim seçeneklerinde fark yaratır.",
  dodge: "Kaçınma bonusu. Savunma zarına (agility'ye ek olarak) eklenir; zırh, kalkan ve bazı statülerden gelir.",
  dr: "Zırh Azaltımı (Damage Reduction). Alınan hasarı yüzdesel olarak azaltır (ör. 0.15 = %15 daha az hasar).",
  ap: "Aksiyon Puanı. Her birimin turunda 4 AP'si vardır; hareket, saldırı, büyü ve eşya kullanımı AP harcar.",
  initiative: "İnisiyatif. d20 + Agility ile atılır; savaştaki sıra düzenini belirler.",

  // -- İyileştirici / destek statüler --
  "Speed": "Hız artışı. Bir sonraki hareketinde daha fazla hex kat edersin.",
  "Çeviklik": "Hız artışı. Bir süreliğine daha uzun hareket edebilirsin.",
  "Bless": "Kutsama. İsabet zarına ekstra bir zar (d4) eklenir.",
  "Kutsama": "İsabet zarına ekstra bir zar eklenir; birkaç tur sürer.",
  "Guide": "Rehberlik. Bir sonraki isabet zarına ekstra bir zar (d4) eklenir.",
  "Resistance": "Direnç. Bir sonraki alınan hasar bir zar (d4) kadar azalır.",
  "Yardım": "Bir sonraki alınan darbenin hasarı azalır (tek seferlik direnç).",
  "Mage Armor": "Büyücü Zırhı. Geçici olarak kaçınmayı belirgin biçimde artırır.",
  "Shield": "Kalkan Büyüsü. Çok kısa süreli ama güçlü bir kaçınma artışı.",
  "Shield of Faith": "İnanç Kalkanı. Uzun süreli, orta seviyede bir kaçınma artışı.",
  "Sisli Sıçrayış": "Anlık bir hamle: hız ve kaçınma birlikte artar, bir tur sürer.",

  // -- Zayıflatıcı statüler --
  "Yavaş": "Hız düşer; hedef daha az hex hareket edebilir.",
  "Uyku": "Etkisizleşme. Hedef turunu tamamen kaçırır; hasar alırsa uyanır.",
  "Tutuklandı": "Etkisizleşme. Hedef bir süre hareket edemez/saldıramaz; hasar alırsa etki bozulabilir.",
  "Charm": "Büyülenme. Hedef saldıramaz ama hareket edebilir.",
  "Prone": "Yerde. Kaçınması düşer, vurulması kolaylaşır.",
  "Bane": "Lanet. Hedefin zarlarına (isabet/kurtarma) bir ceza zarı (d4) eklenir.",
  "Minor Curse": "Küçük Lanet. Bane'e benzer, daha kısa süreli bir ceza zarı.",
  "Zehir": "Zehirlenme. Her tur başında ek hasar verir, birkaç tur sürer.",
  "Ağ": "Ağa yakalanma. Hedefin hızı geçici olarak sıfırlanır.",
  "Ağa Takıldı": "Hız belirgin biçimde düşer; kaçmak zorlaşır.",
  "İşaretli": "Bir sonraki saldırı bu hedefe karşı avantajlı (iki isabet zarından iyisi) atılır.",
  "Uluma": "Bir kurt sürüsünün savaş narası: isabet ve hız geçici olarak artar (düşman tarafı için)."
};

// ---------- 4) LOADING_TIPS — sonuç/kamp ekranında rastgele gösterilecek ipuçları ----------
const LOADING_TIPS = [
  "Aynı hedefe art arda saldırmak, onun savunma zarını zorlaştırır — 'çok saldırılan kaçamaz' kuralını unutma.",
  "Orman karoları (T) menzilli saldırılara karşı +2 kaçınma verir; okçulara karşı sığınak olarak kullan.",
  "Zehir gibi süreli hasar veren statüler biriktikçe tehlikeli olur — mümkünse erken temizle ya da öncelikli hedef al.",
  "Bir birim uyandırılmadan (Uyku/Tutuklandı) önce dikkatli seç: hasar verirsen etki hemen bozulur.",
  "Cleric'in İyileşme Sözü'nü (Healing Word) sadece 1 AP tutar — acil durumda hızlı bir çözüm.",
  "Zırh Azaltımı (dr) yüzdesel çalışır; ağır zırh küçük darbelere karşı orantısız derecede etkilidir.",
  "Finesse silahlar (hançer, kısa kılıç, uzun kılıç) Might ve Agility'den yükseğini kullanır — karma yapılara uygundur.",
  "Kalkan takmak +2 kaçınma verir ama iki elli silah kullanamazsın — versatile silahlar kalkansız daha çok hasar verir.",
  "Bir savaşı kaybetmenden korkma: kampa dönüp daha iyi ekipmanla tekrar deneyebilirsin.",
  "Yürüyen ölülere (undead) karşı kutsal/radyant hasar 1.5 kat işler — Cleric'in İlahi Darbe'si ya da kutsal bombalar tam zamanında.",
  "Regenerate (kendini yenileme) yeteneğine sahip düşmanlara karşı hasarı yoğunlaştırıp hızlı bitirmek, yavaş yavaş yıpratmaktan daha etkilidir.",
  "Frenzy yeteneği düşmanı %50 canın altında daha tehlikeli yapar — o eşiğe yaklaşırken tetikte ol.",
  "Menzilli düşmanlar (okçu, büyücü) genelde mesafeyi korur; üzerlerine hızlı kapanmak onları köşeye sıkıştırır.",
  "Tehlikeli karolarda (^) turunu bitirme — sadece üzerinden geçmek güvenlidir, orada durmak hasar verir.",
  "Sunak karoları (+) üzerinde turunu bitiren ekip üyesi iyileşir — geri çekilirken hedef olarak seç.",
  "Büyü slotların kampta tam dolar; savaş öncesi 'yarım slotla' başlamak yerine kampta dinlenmeyi unutma.",
  "Second Wind (Fighter) savaş başına 2 kez kullanılabilir — erkenden harcamak yerine kritik anlar için sakla.",
  "Alan büyüleri (Burning Hands, Sleep, Örümcek Ağı gibi) birden fazla düşman bir arada durduğunda çok daha değerlidir.",
  "Ekip envanteri ortaktır — bir iksiri kimin taşıdığı değil, kimin bitişiğinde olduğun önemlidir.",
  "Boss savaşlarında geç round'larda takviye gelebilir — gücünü savaşın başında tüketmemeye dikkat et."
];
