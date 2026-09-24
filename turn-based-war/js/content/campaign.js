// campaign.js — Tasarımcı: CAMPAIGN (bölümler, savaşlar, haritalar, diyaloglar)
// Şema CONTRACT.md §4.5. Tüm haritalar /tmp doğrulama scriptiyle test edildi:
// satır uzunlukları eşit, tam 3 'P', düşman koordinatları geçilebilir ve çakışmasız,
// her P'den her düşmana (takviyeler dahil) BFS ile yol var.
//
// Hikâye: Karataş köyü yakınlarındaki ormanda tuhaf saldırılar başlar. İzler; bataklığa,
// oradan unutulmuş bir kripta, en sonunda "Gölge Kalesi"nde uyanmakta olan bir Lich'e
// (Kadir) çıkar. Kadir, yüzyıllar önce parçalanmış "Kırık Taç"ın parçalarını topluyor —
// tacın son parçası köyün altında, bu yüzden köy tehdit altında. Üç kahraman (fighter,
// cleric, wizard yer tutucuları) bu tehdidi kökünden kesmek zorunda.

const CAMPAIGN = {
  title: "Gölge Kalesi'nin Laneti",
  intro: [
    { speaker: "Anlatıcı", portrait: "narrator", text: "Karataş köyü, ormanın eteğinde sakin bir yer olarak bilinirdi — ta ki kurtlar insan gibi taktik yapmaya başlayana kadar." },
    { speaker: "Anlatıcı", portrait: "narrator", text: "Köy ihtiyarı, üç garip ama gönüllü maceracıyı köyün hanında ağırlıyor." },
    { speaker: "İhtiyar", portrait: "elder", text: "Ormanın derinliklerinde bir şey uyandı. Kurtlar sürü değil, ordu gibi saldırıyor. Sizden istediğim tek şey: kaynağı bulun ve durdurun." },
    { speaker: "{fighter}", portrait: "fighter", text: "Kurt ordusu mu? Güzel, sabahtan beri kılıcım kaşınıyordu." },
    { speaker: "{cleric}", portrait: "cleric", text: "Kaşınan bir şey varsa önce ona bakmamı ister misin?" },
    { speaker: "{wizard}", portrait: "wizard", text: "Kitaplarımda böyle bir şeyden bahsedilmiyor. Yani ya çok eski, ya da... daha da kötüsü, yeni bir şey." },
    { speaker: "İhtiyar", portrait: "elder", text: "Tanrılar yardımcınız olsun. Ve lütfen — hanın masalarını kırmadan dönün." }
  ],

  chapters: [
    // ==================================================================
    // BÖLÜM 1 — ORMAN (seviye 1-2)
    // ==================================================================
    {
      id: "ch1", title: "Bölüm 1 — Uğultulu Orman", biome: "forest",
      nodes: [
        {
          id: "s1", type: "story",
          pages: [
            { speaker: "Anlatıcı", portrait: "narrator", text: "Orman girişinde hava ağır, kuşlar susmuş. Toprakta taze pençe izleri var — çok fazla pençe izi." },
            { speaker: "{wizard}", portrait: "wizard", text: "Bunlar tek bir sürünün izi değil. Sanki birileri onları... yönlendiriyor." },
            { speaker: "{fighter}", portrait: "fighter", text: "Yönlendiren kimse, önce onunla tanışacağım gibi." }
          ]
        },
        {
          id: "b1", type: "battle", title: "Kurt Pususu", biome: "forest",
          intro: [
            { speaker: "Anlatıcı", portrait: "narrator", text: "Ağaçların arasından hırıltılar yükseliyor. Üç kurt aynı anda çevreyi sarıyor — bu tesadüf değil." },
            { speaker: "{cleric}", portrait: "cleric", text: "Sırtınızı birbirinize verin! Sürü halinde saldırıyorlar." }
          ],
          outro: [
            { speaker: "{fighter}", portrait: "fighter", text: "İyiydi ama bunlar henüz genç kurtlarmış. Sürünün geri kalanı daha derinde olmalı." },
            { speaker: "{wizard}", portrait: "wizard", text: "Umarım 'geri kalan' daha az dişlidir. Ama pek umutlu değilim." }
          ],
          map: [
            "................",
            "..T...........T.",
            "P...T.......T...",
            "P............T..",
            "P...T...........",
            "....T..........T",
            "..............T.",
            "................",
            "................"
          ],
          enemies: [
            { type: "wolf_young", q: 13, r: 2, name: "Kurt A" },
            { type: "wolf_young", q: 13, r: 4, name: "Kurt B" },
            { type: "wolf_young", q: 13, r: 6, name: "Kurt C" }
          ],
          objective: { type: "kill" },
          rewards: { gold: 25, items: ["potion_heal"] },
          optional: false
        },
        {
          id: "b1opt", type: "battle", title: "Haydut Kampı (Yan Görev)", biome: "forest",
          intro: [
            { speaker: "Anlatıcı", portrait: "narrator", text: "Patikadan biraz saparsanız dumanı görebilirsiniz: gizli bir haydut kampı. Kurtlarla ilgisi olmayabilir ama altınları kesin gerçek." },
            { speaker: "{fighter}", portrait: "fighter", text: "Kestirmeden gitmek isteyen var mı, yoksa keseleri de mi kontrol edelim?" }
          ],
          outro: [
            { speaker: "{cleric}", portrait: "cleric", text: "Reisin cebinde bir muska var. Kime saldığını hiç bilmek istemiyorum." }
          ],
          map: [
            "...T~...........",
            "...T~.%.........",
            "...T~...#.......",
            "P..T~...#.......",
            "P..=.......^....",
            "P..T~...#.......",
            "...T~...#.......",
            "...T~.%.........",
            "...T~..........."
          ],
          enemies: [
            { type: "bandit_chief", q: 12, r: 4, name: "Haydut Reisi" },
            { type: "bandit", q: 9, r: 3, name: "Haydut" }
          ],
          objective: { type: "kill" },
          rewards: { gold: 45, items: ["wolf_fang_charm"] },
          optional: true
        },
        {
          id: "b2", type: "battle", title: "Haydut Pususu", biome: "forest",
          intro: [
            { speaker: "Anlatıcı", portrait: "narrator", text: "Yol daralıyor. Ağaçların gerisinden bir ıslık sesi — pusu klasikleri." },
            { speaker: "{wizard}", portrait: "wizard", text: "Islık mı çaldılar? Amatörce." }
          ],
          outro: [
            { speaker: "{fighter}", portrait: "fighter", text: "Bu haydutlar da tuhaf derecede iyi organizeydi. Kurtlar gibi." },
            { speaker: "{cleric}", portrait: "cleric", text: "Ormanın derinliklerinde birileri herkesi kışkırtıyor gibi." }
          ],
          map: [
            ".................",
            ".....T......T....",
            ".........T.......",
            "P................",
            "P,,,,,,,,,,,,,,,,",
            "P................",
            ".........T.......",
            ".....T......T....",
            "................."
          ],
          enemies: [
            { type: "bandit", q: 14, r: 3, name: "Haydut" },
            { type: "bandit", q: 14, r: 5, name: "Haydut" },
            { type: "bandit_archer", q: 15, r: 4, name: "Haydut Okçu" },
            { type: "bandit_archer", q: 9, r: 4, name: "Haydut Okçu" }
          ],
          objective: { type: "kill" },
          rewards: { gold: 40, items: ["potion_bless"] },
          optional: false
        },
        {
          id: "c1", type: "camp", title: "Orman Kenarı Kampı",
          text: "Ateşin başında biraz dinlenip envanteri gözden geçirme vakti. İleride ormanın efendisi bekliyor olabilir.",
          shop: "ch1"
        },
        {
          id: "b3", type: "battle", title: "Kurt Reisi", biome: "forest",
          intro: [
            { speaker: "Anlatıcı", portrait: "narrator", text: "Devasa bir kurt gölgeden çıkıyor — boynunda kemikten bir kolye, gözlerinde insan zekâsına benzer bir parıltı." },
            { speaker: "Kurt Reisi", portrait: "boss_wolf", text: "Grrrr... etinizi kokladım daha siz bu ormana adım atmadan. Sürüm açtı." },
            { speaker: "{cleric}", portrait: "cleric", text: "Bu... normal bir hayvan değil. Birisi ona güç vermiş." },
            { speaker: "{fighter}", portrait: "fighter", text: "Kimin verdiği umurumda değil. Vermesini durduracağım." }
          ],
          outro: [
            { speaker: "Kurt Reisi", portrait: "boss_wolf", text: "Uluma... bataklığa... duyacak... o duyacak..." },
            { speaker: "Anlatıcı", portrait: "narrator", text: "Kurt Reisi son nefesinde ormanın çok ötesine, bataklığa doğru bir uluma bırakıyor — sanki birini uyarıyormuş gibi." },
            { speaker: "{wizard}", portrait: "wizard", text: "'Ormanın efendisi' başkasının emrindeymiş. Bu iş göründüğünden büyük." }
          ],
          map: [
            ".................",
            ".......T.........",
            "...T.............",
            "...........#.....",
            "PP......+........",
            "P................",
            "...........#.....",
            "...T.............",
            ".......T.........",
            "................."
          ],
          enemies: [
            { type: "direwolf_alpha", q: 13, r: 4, name: "Kurt Reisi" },
            { type: "wolf", q: 13, r: 3, name: "Kurt Muhafız" },
            { type: "wolf", q: 13, r: 5, name: "Kurt Muhafız" }
          ],
          objective: { type: "boss", target: "Kurt Reisi" },
          rewards: { gold: 70, items: ["sword_plus1"] },
          optional: false
        }
      ]
    },

    // ==================================================================
    // BÖLÜM 2 — SİSLİ BATAKLIK (seviye 3-4)
    // ==================================================================
    {
      id: "ch2", title: "Bölüm 2 — Sisli Bataklık", biome: "swamp",
      nodes: [
        {
          id: "s2", type: "story",
          pages: [
            { speaker: "Anlatıcı", portrait: "narrator", text: "Uluma bataklığa kadar sizi izlermiş gibi yankılanıyor. Sis o kadar yoğun ki üç adım ötesi görünmüyor." },
            { speaker: "{wizard}", portrait: "wizard", text: "İki yol var: sis içinde bataklığı yürüyerek aşmak, ya da şu kayalıktaki mağaradan kestirmeden geçmek." },
            { speaker: "{cleric}", portrait: "cleric", text: "İkisi de 'güvenli' kelimesine hakaret gibi duruyor." }
          ]
        },
        {
          id: "ch2choice", type: "choice",
          text: "Hangi yoldan gidilsin?",
          options: [
            { label: "Bataklığı yürüyerek geç (açık arazi, zehirli gaz cepleri)", goto: "b4" },
            { label: "Mağara kısayolundan git (dar geçitler, örümcek ağları)", goto: "b4cave" }
          ]
        },
        {
          id: "b4", type: "battle", title: "Balçık Geçidi", biome: "swamp",
          next: "b5",
          intro: [
            { speaker: "Anlatıcı", portrait: "narrator", text: "Ayaklarınız her adımda çamura batıyor. Balçık yığınları hareket etmeye başlıyor — hiç iyi değil." },
            { speaker: "{fighter}", portrait: "fighter", text: "Neden her zaman 'hareket eden çamur' oluyor? Neden hiç 'hareket eden hazine sandığı' olmuyor?" }
          ],
          outro: [
            { speaker: "{cleric}", portrait: "cleric", text: "Gulyabani kokusu da var burada. Bu bataklık tam bir canavar pazarı." }
          ],
          map: [
            ".......%%.......",
            ".....%.%%.......",
            ".......%%.......",
            "P..^...%%.......",
            "P......%%.......",
            "P......%%...^...",
            ".......%%.......",
            ".....%.%%.......",
            ".......%%......."
          ],
          enemies: [
            { type: "slime", q: 13, r: 2, name: "Balçık" },
            { type: "slime", q: 13, r: 6, name: "Balçık" },
            { type: "spider", q: 13, r: 4, name: "Örümcek" },
            { type: "ghoul", q: 11, r: 4, name: "Gulyabani" }
          ],
          reinforcements: [
            { round: 2, enemies: [ { type: "slime", q: 14, r: 4, name: "Balçık" } ] }
          ],
          objective: { type: "kill" },
          rewards: { gold: 40, items: ["bomb_acid"] },
          optional: false
        },
        {
          id: "b4cave", type: "battle", title: "Örümcek Mağarası", biome: "cave",
          next: "b5",
          intro: [
            { speaker: "Anlatıcı", portrait: "narrator", text: "Mağara kısa ama tavanı ağlarla kaplı. Her adımda bir şey tıkırdıyor — sizi izliyorlar." },
            { speaker: "{wizard}", portrait: "wizard", text: "Kısayol derken 'kısa süreliğine hayatta kalırız' demek istemişsindir umarım." }
          ],
          outro: [
            { speaker: "{fighter}", portrait: "fighter", text: "Sekiz bacaklı olsalar da düşüyorlar. Bu beni rahatlatıyor." }
          ],
          map: [
            ".........#......",
            "....#...........",
            "....#...........",
            "P........#......",
            "P.....^.........",
            "P........#......",
            "....#...........",
            "....#...........",
            ".........#......"
          ],
          enemies: [
            { type: "giant_spider", q: 12, r: 4, name: "Dev Örümcek" },
            { type: "spider", q: 12, r: 2, name: "Örümcek" },
            { type: "spider", q: 12, r: 6, name: "Örümcek" },
            { type: "spider", q: 13, r: 4, name: "Örümcek" }
          ],
          objective: { type: "kill" },
          rewards: { gold: 45, items: ["trinket_cloak"] },
          optional: false
        },
        {
          id: "b5", type: "battle", title: "Goblin Kampı", biome: "swamp",
          intro: [
            { speaker: "Anlatıcı", portrait: "narrator", text: "Çamurdan kulübelerin arasında goblinler koşuşturuyor. Bir şamanları var ve sizi fark ettiler." },
            { speaker: "{cleric}", portrait: "cleric", text: "Şamanı önce susturun, yoksa arkadaşlarını büyüyle güçlendirecek." }
          ],
          outro: [
            { speaker: "Anlatıcı", portrait: "narrator", text: "Kampın en derin çadırında bir harita buluyorsunuz: bataklığın ortasındaki 'Trol Batağı' işaretli — ve altında bir uyarı: 'ONU UYANDIRMAYIN'." },
            { speaker: "{fighter}", portrait: "fighter", text: "Şey, geç kaldık galiba." }
          ],
          map: [
            "......%..........",
            "......%..........",
            ".................",
            "P.........#......",
            "P............+...",
            "P.........#......",
            ".................",
            "......%..........",
            "......%.........."
          ],
          enemies: [
            { type: "goblin", q: 12, r: 2, name: "Goblin" },
            { type: "goblin", q: 12, r: 6, name: "Goblin" },
            { type: "goblin", q: 9, r: 4, name: "Goblin" },
            { type: "goblin_shaman", q: 15, r: 4, name: "Goblin Şamanı" }
          ],
          objective: { type: "kill" },
          rewards: { gold: 45, items: ["potion_slot"] },
          optional: false
        },
        {
          id: "c2", type: "camp", title: "Bataklık Kenarı Kampı",
          text: "Çamuru üzerinizden temizleyip silahları biliyorsunuz. Trol Batağı'na inmeden önce son bir hazırlık.",
          shop: "ch2"
        },
        {
          id: "b6", type: "battle", title: "Bataklık Trolü", biome: "swamp",
          intro: [
            { speaker: "Anlatıcı", portrait: "narrator", text: "Suların ortasında devasa bir gölge doğruluyor. Bataklık Trolü, yüzyıllardır burada uyuyormuş — artık uyanık." },
            { speaker: "Bataklık Trolü", portrait: "boss_troll", text: "UYUUU... UYANDIRDINIZ... EZECEĞİM..." },
            { speaker: "{wizard}", portrait: "wizard", text: "Yaraları kapanıyor! Ateş ya da hızlı hasarla bitirmeliyiz." },
            { speaker: "{fighter}", portrait: "fighter", text: "Köprüde durup gelenleri tek tek karşılayalım, açık arazide bize dört koldan saldırmasın." }
          ],
          outro: [
            { speaker: "Bataklık Trolü", portrait: "boss_troll", text: "Efendi... affetmez... sizi..." },
            { speaker: "Anlatıcı", portrait: "narrator", text: "Trol düştüğünde, göğsünde eski bir demir anahtar buluyorsunuz — üzerinde kripta mühürlerine benzeyen işaretler var." },
            { speaker: "{cleric}", portrait: "cleric", text: "Bu bataklık sadece bir engeldi. Asıl mesele önümüzde, yerin altında." }
          ],
          map: [
            "........~~........",
            "........~~........",
            "...%....~~........",
            "........~~........",
            "P.......==...^....",
            "PP...........^....",
            "........~~........",
            "...%....~~........",
            "........~~........",
            "........~~........"
          ],
          enemies: [
            { type: "bog_troll", q: 11, r: 4, name: "Bataklık Trolü" },
            { type: "slime", q: 11, r: 3, name: "Balçık" },
            { type: "slime", q: 11, r: 6, name: "Balçık" }
          ],
          reinforcements: [
            { round: 3, enemies: [
              { type: "giant_spider", q: 15, r: 4, name: "Mağara Örümceği" }
            ] }
          ],
          objective: { type: "boss", target: "Bataklık Trolü" },
          rewards: { gold: 90, items: ["armor_chain_plus1"] },
          optional: false
        }
      ]
    },

    // ==================================================================
    // BÖLÜM 3 — UNUTULMUŞ KRİPTA (seviye 4-5)
    // ==================================================================
    {
      id: "ch3", title: "Bölüm 3 — Unutulmuş Kripta", biome: "ruins",
      nodes: [
        {
          id: "s3", type: "story",
          pages: [
            { speaker: "Anlatıcı", portrait: "narrator", text: "Anahtar sizi yıkık bir tapınağa, oradan yerin altına inen taş merdivenlere götürüyor. Duvarlarda tanımadığınız bir alfabeyle yazılar var." },
            { speaker: "{wizard}", portrait: "wizard", text: "Bu yazılar bir kral hakkında — tacı kırılmış, gücü mühürlenmiş bir kral." },
            { speaker: "{fighter}", portrait: "fighter", text: "Mühürlenmiş kralların hep dostane çıkma alışkanlığı var, değil mi?" }
          ]
        },
        {
          id: "b7", type: "battle", title: "Mezar Soyguncuları", biome: "ruins",
          intro: [
            { speaker: "Anlatıcı", portrait: "narrator", text: "Meşale ışığında kara cüppeli figürler bir tören yapıyor. Sizi görünce törene ara veriyorlar — memnuniyetsizce." },
            { speaker: "{cleric}", portrait: "cleric", text: "Kara tarikat. Rahiplerini önce halledin, yoksa yaralılarını iyileştirip duracak." }
          ],
          outro: [
            { speaker: "Anlatıcı", portrait: "narrator", text: "Rahibin cübbesinde bir amblem var: kırık bir taç. Aynı sembol duvarlardaki yazılarda da tekrarlanıyor." }
          ],
          map: [
            "......#...#......",
            "......#...#......",
            "...%..#...#.%....",
            "P.....#...#......",
            "P.....=...=..+...",
            "P.....#...#......",
            "...%..#...#.%....",
            "......#...#......",
            "......#...#......"
          ],
          enemies: [
            { type: "cultist", q: 8, r: 3, name: "Kültist" },
            { type: "cultist", q: 8, r: 5, name: "Kültist" },
            { type: "cultist", q: 9, r: 4, name: "Kültist" },
            { type: "cultist_priest", q: 13, r: 4, name: "Kültist Rahibi" },
            { type: "skeleton_archer", q: 14, r: 4, name: "Mezar Nişancısı" }
          ],
          objective: { type: "kill" },
          rewards: { gold: 65, items: ["potion_greater"] },
          optional: false
        },
        {
          id: "b8", type: "battle", title: "İskelet Muhafızları", biome: "crypt",
          intro: [
            { speaker: "Anlatıcı", portrait: "narrator", text: "Koridorun sonunda kemikler birbirine tutunup ayağa kalkıyor. Kriptanın kadim muhafızları görevlerine hâlâ sadık." },
            { speaker: "{wizard}", portrait: "wizard", text: "Okçular arkada, kalkanlılar önde — klasik bir düzen. Dar koridoru kullanalım." }
          ],
          outro: [
            { speaker: "{fighter}", portrait: "fighter", text: "Kemiklerin bu kadar iyi nişan alması hiç adil değil." }
          ],
          map: [
            "......#..........",
            "......#..........",
            "......#..........",
            "P..........^.....",
            "P................",
            "P..........^.....",
            "......#..........",
            "......#..........",
            "......#.........."
          ],
          enemies: [
            { type: "skeleton", q: 9, r: 4, name: "İskelet" },
            { type: "skeleton", q: 12, r: 4, name: "İskelet" },
            { type: "skeleton", q: 13, r: 4, name: "İskelet" },
            { type: "skeleton_archer", q: 15, r: 3, name: "İskelet Okçu" },
            { type: "skeleton_archer", q: 15, r: 5, name: "İskelet Okçu" }
          ],
          objective: { type: "kill" },
          rewards: { gold: 55, items: ["bomb_holy"] },
          optional: false
        },
        {
          id: "c3", type: "camp", title: "Kripta Girişi Kampı",
          text: "Nefes almak için bir an duruyorsunuz. Kriptanın en derininde bir şey — ya da birisi — sizi bekliyor.",
          shop: "ch3"
        },
        {
          id: "b9", type: "battle", title: "Düşmüş Şövalye", biome: "crypt",
          intro: [
            { speaker: "Anlatıcı", portrait: "narrator", text: "Büyük salonun ortasında paslı bir zırh, elinde kara bir kılıçla dikiliyor. Gözlerinde hâlâ bir insan acısı var." },
            { speaker: "Düşmüş Şövalye", portrait: "boss_knight", text: "Bu kriptayı... yüzyıllardır koruyorum. Geçemeyeceksiniz — kimse geçemez." },
            { speaker: "{cleric}", portrait: "cleric", text: "Bu bir şövalye... bir zamanlar birini korumaya yemin etmiş biri. Kriptaya hapsolmuş." },
            { speaker: "{fighter}", portrait: "fighter", text: "O zaman ona bir iyilik yapalım — huzura kavuştur." }
          ],
          outro: [
            { speaker: "Düşmüş Şövalye", portrait: "boss_knight", text: "Teşekkür ederim... sonunda... Kadir... kaleyi... durdurun." },
            { speaker: "Anlatıcı", portrait: "narrator", text: "Şövalye toza dönüşürken son sözleri havada asılı kalıyor. Kırık Taç'ın son parçası göğsünde parlıyor." },
            { speaker: "{wizard}", portrait: "wizard", text: "Kadir. Artık bir isim biliyoruz. Ve bir kale." }
          ],
          map: [
            "..................",
            "......#...........",
            "......#.....#.....",
            "......#...........",
            "PP.......+........",
            "P.................",
            "......#...........",
            "......#.....#.....",
            "......#...........",
            ".................."
          ],
          enemies: [
            { type: "knight_fallen", q: 14, r: 4, name: "Düşmüş Şövalye" },
            { type: "skeleton", q: 14, r: 3, name: "İskelet" },
            { type: "skeleton", q: 14, r: 5, name: "İskelet" },
            { type: "skeleton", q: 14, r: 2, name: "İskelet" }
          ],
          reinforcements: [
            { round: 2, enemies: [
              { type: "zombie", q: 16, r: 3, name: "Çürümüş Ceset" },
              { type: "zombie", q: 16, r: 5, name: "Çürümüş Ceset" }
            ] }
          ],
          objective: { type: "boss", target: "Düşmüş Şövalye" },
          rewards: { gold: 90, items: ["armor_plate_plus1"] },
          optional: false
        }
      ]
    },

    // ==================================================================
    // BÖLÜM 4 — GÖLGE KALESİ (seviye 5-6, final)
    // ==================================================================
    {
      id: "ch4", title: "Bölüm 4 — Gölge Kalesi", biome: "castle",
      nodes: [
        {
          id: "s4", type: "story",
          pages: [
            { speaker: "Anlatıcı", portrait: "narrator", text: "Kırık Taç'ın son parçası elinizdeyken kaleye varıyorsunuz. Duvarlar canlıymış gibi nabız atıyor." },
            { speaker: "{wizard}", portrait: "wizard", text: "Kadir bir Lich. Tacı tamamlayıp ölümsüzlüğünü kalıcı kılmak istiyor. Onu durdurmazsak..." },
            { speaker: "{cleric}", portrait: "cleric", text: "...bu diyar bir daha hiç sabah görmez. Anladık, {wizard}. Gidelim." },
            { speaker: "{fighter}", portrait: "fighter", text: "Kapıyı çalalım mı, yoksa direkt kıralım mı?" }
          ]
        },
        {
          id: "b10", type: "battle", title: "Kale Kapısı", biome: "castle",
          intro: [
            { speaker: "Anlatıcı", portrait: "narrator", text: "Kapıda ork muhafızlar ve kara tarikatın son üyeleri bekliyor. Kadir konuklarını ciddiye alıyor." },
            { speaker: "{fighter}", portrait: "fighter", text: "Kırdık galiba, evet." }
          ],
          outro: [
            { speaker: "{cleric}", portrait: "cleric", text: "İçeride bir şey bizi bekliyor. Hazırlıklı olun." }
          ],
          map: [
            "........#...#.....",
            "........#...#.....",
            "....%...#...#.....",
            "P.......#.........",
            "P.......=.........",
            "P.......#.........",
            "....%...#...#.....",
            "........#...#.....",
            "........#...#....."
          ],
          enemies: [
            { type: "orc_brute", q: 9, r: 3, name: "Ork Azgını" },
            { type: "orc_brute", q: 9, r: 5, name: "Ork Azgını" },
            { type: "orc_brute", q: 15, r: 4, name: "Yan Kol Muhafızı" },
            { type: "cultist", q: 13, r: 3, name: "Kültist" }
          ],
          objective: { type: "kill" },
          rewards: { gold: 75, items: ["potion_greater"] },
          optional: false
        },
        {
          id: "b11", type: "battle", title: "Alev İmpleri", biome: "castle",
          intro: [
            { speaker: "Anlatıcı", portrait: "narrator", text: "Avluda ateşten yaratıklar süzülüyor, üstlerinde bir hayalet dönüyor. 'Efendimiz hazırlanana kadar oyalayın onları!' diye tısladığını duyuyorsunuz." },
            { speaker: "{wizard}", portrait: "wizard", text: "Oyalanmayı reddediyoruz! Ama önce hayatta kalalım — birkaç tur dayanmamız yeter." }
          ],
          outro: [
            { speaker: "{fighter}", portrait: "fighter", text: "Dayandık! Şimdi sıra Kadir'de." }
          ],
          map: [
            "................",
            "......^..^......",
            "................",
            "P...............",
            "P......+........",
            "P...............",
            "................",
            "......^..^......",
            "................"
          ],
          enemies: [
            { type: "fire_imp", q: 10, r: 2, name: "Ateş İmp'i" },
            { type: "fire_imp", q: 10, r: 6, name: "Ateş İmp'i" },
            { type: "fire_imp", q: 12, r: 4, name: "Ateş İmp'i" },
            { type: "wraith", q: 9, r: 4, name: "Hayalet" }
          ],
          reinforcements: [
            { round: 3, enemies: [ { type: "fire_imp", q: 13, r: 4, name: "Ateş İmp'i" } ] }
          ],
          objective: { type: "survive", rounds: 7 },
          rewards: { gold: 65, items: ["trinket_focus"] },
          optional: false
        },
        {
          id: "c4", type: "camp", title: "Kale Avlusu — Son Hazırlık",
          text: "Kalenin en tepesine çıkmadan önce son bir mola. Ne alacaksanız şimdi alın; bir daha dönemeyebilirsiniz.",
          shop: "ch4"
        },
        {
          id: "b12", type: "battle", title: "Lich Kadir", biome: "castle",
          intro: [
            { speaker: "Anlatıcı", portrait: "narrator", text: "Taht odasında Kadir sizi bekliyor, elinde Kırık Taç'ın diğer parçaları parıldıyor. Sesi kemiklerinizde yankılanıyor." },
            { speaker: "Kadir", portrait: "boss_lich", text: "Üç ölümlü, bunca yolu bir taç parçası için mi geldiniz? Ona sizden daha çok ihtiyacım var." },
            { speaker: "{cleric}", portrait: "cleric", text: "O taç kimseyi ölümsüz yapmayacak. Sadece daha uzun süre yalnız kalacaksın." },
            { speaker: "{wizard}", portrait: "wizard", text: "Slotlarım dolu, cesaretim tam. Başlayalım." }
          ],
          outro: [
            { speaker: "Kadir", portrait: "boss_lich", text: "Yüzyıllar... boşa mı... hayır, bu... son değil..." },
            { speaker: "Anlatıcı", portrait: "narrator", text: "Kadir'in kemikleri toza dönüşürken Kırık Taç parçalara ayrılıp söner. Kale sarsılıyor, sonra... sessizlik. Gerçek bir sessizlik." },
            { speaker: "{fighter}", portrait: "fighter", text: "Bitti mi? Bittiğine inanamıyorum." },
            { speaker: "{cleric}", portrait: "cleric", text: "Bitti. Şimdi eve, hanın masalarını kırmadan dönme vaktimiz." },
            { speaker: "{wizard}", portrait: "wizard", text: "Vaat etmiyorum ama denerim." }
          ],
          map: [
            "..................",
            ".......#..........",
            ".......#..........",
            "..............^...",
            ".P.........#......",
            "P...+......#......",
            ".P.........#......",
            "..............^...",
            ".......#..........",
            ".......#..........",
            ".................."
          ],
          enemies: [
            { type: "lich", q: 13, r: 5, name: "Kadir" },
            { type: "skeleton_archer", q: 13, r: 3, name: "İskelet Okçu" },
            { type: "skeleton_archer", q: 13, r: 7, name: "İskelet Okçu" },
            { type: "zombie", q: 15, r: 4, name: "Çürümüş Muhafız" },
            { type: "zombie", q: 15, r: 6, name: "Çürümüş Muhafız" }
          ],
          reinforcements: [
            { round: 4, enemies: [
              { type: "skeleton", q: 16, r: 3, name: "İskelet" },
              { type: "skeleton", q: 16, r: 5, name: "İskelet" }
            ] }
          ],
          objective: { type: "boss", target: "Kadir" },
          rewards: { gold: 140, items: ["armor_chain_plus2"] },
          optional: false
        }
      ]
    }
  ],

  ending: [
    { speaker: "Anlatıcı", portrait: "narrator", text: "Karataş köyüne döndüğünüzde ihtiyar sizi kapıda karşılıyor, gözlerinde inanmayan bir sevinç var." },
    { speaker: "İhtiyar", portrait: "elder", text: "Kurtlar... durdu. Ormandan hiç bu kadar sessiz bir gece geçmemiştik." },
    { speaker: "{fighter}", portrait: "fighter", text: "Masaları kırmadık, söz verdiğim gibi. Sandalyeler konusunda söz veremem." },
    { speaker: "{cleric}", portrait: "cleric", text: "Bir Lich, bir troll, sayısız iskelet ve bir sürü çamurlu canavar. Bence bu, bir bardak bedava biradan fazlasını hak ediyor." },
    { speaker: "{wizard}", portrait: "wizard", text: "Günlüğüme yazacağım çok şey var. 'Disiplinli kurtlar'dan başlayıp 'konuşan kral kemikleri'yle bitiriyorum." },
    { speaker: "Anlatıcı", portrait: "narrator", text: "Kırık Taç'ın parçaları artık sonsuza dek sönük. Karataş köyü yeniden nefes alıyor — ve üç kahraman, bir sonraki masalın kapısını aralıyor." }
  ]
};
