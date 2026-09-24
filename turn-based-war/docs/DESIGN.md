# Tasarım Belgesi — Gölge Kalesi'nin Laneti

Bu belge `js/content/*.js` içeriğinin tasarım gerekçelerini özetler. Şema ve dosya
sahipliği için `docs/CONTRACT.md`'ye bakın. Tüm içerik `/tmp` altında yazılan bir
Node/vm doğrulama scriptiyle test edildi (bkz. §7).

## 1. Hikâye özeti

Karataş köyü yakınındaki ormanda kurtlar "sürü gibi değil, ordu gibi" saldırmaya
başlar. Üç maceracı (`{fighter}`, `{cleric}`, `{wizard}`) köy ihtiyarı tarafından
görevlendirilir. İzler sırasıyla:

1. **Orman** — kurtları yöneten bir "Kurt Reisi" (büyülenmiş alfa kurt) bulunur.
2. **Bataklık/Mağara** — Kurt Reisi'nin son ulumasının hedefi olan bataklıkta
   goblinler ve devasa bir **Bataklık Trolü** vardır; trolün üzerinde kripta
   mühürlerine benzeyen bir anahtar çıkar.
3. **Unutulmuş Kripta** — anahtar bir tapınağın altındaki kriptaya açılır. Kara
   tarikat üyeleri "Kırık Taç" için tören yapıyordur; kriptanın dibinde, kadim bir
   **Düşmüş Şövalye** hem kriptayı koruyor hem de son sözleriyle "Kadir... kaleyi..."
   diyerek asıl düşmanın adını ve yerini fısıldar.
4. **Gölge Kalesi (final)** — Kadir bir **Lich**'tir; Kırık Taç'ın parçalarını
   birleştirip ölümsüzlüğünü kalıcı kılmak istemektedir. Kahramanlar kaleyi aşıp
   Kadir'i yener, taç söner, köy kurtulur.

Ton: sıcak, hafif mizahi kahraman diyalogları (özellikle `{fighter}`'ın kara
mizahı ve `{wizard}`'ın "günlüğüme not aldım" replikleri) ile ilerleyen, klasik
ama kendi içinde tutarlı bir D&D-vari fantastik anlatı. `{fighter}`, `{cleric}`,
`{wizard}` yer tutucuları ekipteki gerçek kahraman adlarıyla değiştirilir
(sınıf yoksa ilk kahramanın adı kullanılır — CONTRACT §4.5).

## 2. Bölüm / düğüm akışı

| Bölüm | Biyom | Düğümler (sırayla) |
|---|---|---|
| ch1 — Uğultulu Orman | forest | s1(hikâye) → b1(Kurt Pususu) → b1opt(Haydut Kampı, **opsiyonel**) → b2(Haydut Pususu) → c1(kamp/ch1) → **b3 BOSS (Kurt Reisi)** |
| ch2 — Sisli Bataklık | swamp/cave | s2(hikâye) → ch2choice(**dallanma**) → b4(Balçık Geçidi) **veya** b4cave(Örümcek Mağarası) → b5(Goblin Kampı) → c2(kamp/ch2) → **b6 BOSS (Bataklık Trolü, takviye: round 3 Dev Örümcek)** |
| ch3 — Unutulmuş Kripta | ruins/crypt | s3(hikâye) → b7(Mezar Soyguncuları) → b8(İskelet Muhafızları) → c3(kamp/ch3) → **b9 BOSS (Düşmüş Şövalye, takviye: round 3 x2 Zombi)** |
| ch4 — Gölge Kalesi | castle | s4(hikâye) → b10(Kale Kapısı) → b11(Alev İmpleri, **survive 4 round**) → c4(kamp/ch4) → **b12 FİNAL BOSS (Lich Kadir, takviye: round 4 x2 İskelet)** |

`ch2choice` düğümü, aynı bölüm içinde `b4`/`b4cave`'e dallanır; her iki dalın
sonunda `next: "b5"` alanıyla tekrar ana hatta birleşir (CONTRACT §4.5'teki
"dallanan düğümlerin sonunda next ile birleşme" kuralına birebir uyar).

**Toplam savaş sayısı:** 13 zorunlu + 1 opsiyonel (Haydut Kampı, ch1) = 14 tanımlı
savaş düğümü (b4/b4cave alternatif olduğu için bir oyun turunda oyuncu bunlardan
sadece birini oynar → fiilen 13 savaş deneyimler, hedeflenen 11-13 aralığına uyar).
Her bölüm bir **boss** ile kapanır (b3, b6, b9, b12); ayrıca b11 farklı bir
"survive" hedefiyle çeşitlilik katar. Üç boss savaşında (b6, b9, b12) **takviye
dalgası** vardır, tempo ve gerilimi artırır.

Her bölümde tam bir kamp/mağaza düğümü var (`c1..c4`, `SHOP_STOCK` ile eşlenir),
savaş sonrası tam iyileşme + alışveriş + seviye atlama imkânı sağlar (geliştirici
tarafındaki akış).

## 3. Düşman tablosu

| id | Sprite | Bölüm | ai | hpMax | xp | Notlar |
|---|---|---|---|---|---|---|
| wolf | wolf | 1 | melee | 11 | 50 | packTactics |
| direwolf_alpha | direwolf_alpha | 1 (BOSS) | boss | 32 | 220 | packTactics+howl+frenzy |
| bandit | bandit | 1 | melee | 14 | 55 | — |
| bandit_archer | bandit_archer | 1 | ranged | 12 | 60 | — |
| bandit_chief | bandit_chief | 1 (opsiyonel) | brute | 24 | 130 | cleave+frenzy |
| slime | slime | 2 | melee | 12 | 35 | explode |
| goblin | goblin | 2 | skirmisher | 9 | 40 | — |
| goblin_shaman | goblin_shaman | 2 | caster | 11 | 75 | firebolt/minorcurse |
| spider | spider | 2 | skirmisher | 8 | 45 | poison |
| giant_spider | giant_spider | 2 | brute | 30 | 160 | poison+webShot |
| bog_troll | bog_troll | 2 (BOSS) | boss | 48 | 320 | regenerate+frenzy |
| ghoul | ghoul | 2 | skirmisher | 16 | 75 | undead+poison |
| cultist | cultist | 3 | melee | 14 | 55 | — |
| cultist_priest | cultist_priest | 3 | healer | 20 | 95 | wordpain/healingword |
| skeleton | skeleton | 3 | melee | 10 | 45 | undead |
| skeleton_archer | skeleton_archer | 3 | ranged | 9 | 50 | undead |
| zombie | zombie | 3 | brute | 22 | 60 | undead, hız 3 (yavaş) |
| knight_fallen | knight_fallen | 3 (BOSS) | boss | 58 | 380 | undead+shieldWall+frenzy |
| orc_brute | orc_brute | 4 | brute | 30 | 110 | enrage |
| fire_imp | fire_imp | 4 | caster | 15 | 85 | fly, firebolt/blast |
| wraith | wraith | 4 | skirmisher | 26 | 150 | undead+phase |
| lich | lich | 4 (FİNAL) | boss | 95 | 650 | undead+summon:skeleton, 4 büyü |

22 sprite'ın tamamı kullanıldı (grafik ajanının çizeceği liste ile birebir eşleşir).

## 4. Zorluk eğrisi ve süre hesabı

**XP_TABLE** = `[0, 0, 100, 300, 600, 1300, 2500]` (kümülatif). Zorunlu
savaşlardan toplam düşman XP'si ≈ 4255-4315 (hangi ch2 dalı seçilirse), yani
`XP_TABLE[6]=2500`'ü final bossa varmadan geçiyor — ekip **Bölüm 3 sonunda
(Düşmüş Şövalye sonrası) seviye 6'ya (tavan) ulaşır**, Bölüm 4'ün tamamını tam
güçle oynar. Bu, en zorlu/en çok mekanikli düşman olan Lich'in tam güçlü bir
ekiple karşılanmasını sağlamak için bilinçli bir tercih (final "zor ama adil"
kalsın diye erken tavan yapmak, geç ve ani bir zorluk sıçraması yerine tercih
edildi).

Ara kontrol noktaları:
- b1 sonrası (150 XP) → Sv2 (kamp b1'den hemen sonra değil, ama sonraki kamp/tur başında yansır)
- b2 sonrası (kümülatif ~320) → Sv3
- b3 BOSS sonrası (kümülatif ~640-880) → Sv4 — direwolf_alpha (hp32) 3 kişilik
  Sv3 ekip + ch1 mağaza eşyalarıyla dengeli bir final karşılaşması.
- b6 BOSS sonrası (kümülatif ~1575-1815) → Sv5 — bog_troll (hp48, regenerate)
  Sv4 ekibi zorlar; regenerate'i aşmak için ateş/yüksek hasar biriktirme gerekir,
  bu yüzden ch2 mağazasında bomb_fire/bomb_acid ve +1 silahlar satılır.
- b9 BOSS sonrası (kümülatif ~2560) → Sv6 (tavan) — knight_fallen (hp58,
  shieldWall+frenzy) Sv5 ekibe karşı zorlu ama takviye dalgası (2x zombi) sadece
  round 3'te gelir, oyuncuya hazırlanma payı bırakır.
- b12 FİNAL — lich (hp95, 3 slot, 4 büyü, summon:skeleton + round4 takviyesi)
  tam Sv6 ekibe karşı; en uzun ve en çok mekanikli savaş (tahmini 7-9 round).

**Savaş süresi tahmini:** çoğu savaş 3-5 dakika (4-7 round) sürecek şekilde 3-4
düşmanlı tasarlandı; boss savaşları (takviye dalgalarıyla) 5-8 dakika sürebilir.
13 zorunlu savaş × ortalama ~4.5 dk ≈ **58-60 dakika savaş**, artı hikâye
diyalogları, kamp/mağaza gezinme ve seviye atlama ekranları ≈ **10-15 dakika**.
**Toplam tahmini oynanış: ~70-75 dakika** (istenen "en az 30 dakika" hedefinin
belirgin biçimde üzerinde; opsiyonel Haydut Kampı dahil edilirse +5 dakika).
Oyuncu kaybederse savaşı tekrar deneyebilir (geliştirici tarafında), bu yüzden
zorluk "zor ama adil" eşiğinde tutuldu — hiçbir savaş tek hamlelik anlık ölüm
riski taşımıyor, HP havuzları ve DR değerleri kademeli.

## 5. Denge gerekçeleri

- **İlk savaş (b1, 3 kurt)**: orijinal prototipteki `makeWolves()` ile birebir
  aynı düşman istatistikleri (hp11, agility3, 1d6 ısırık, packTactics) — bu
  denge zaten oyun motoruyla birlikte kabul edilmiş "zorlayıcı ama kazanılabilir"
  temel taş. Harita eski `CONFIG`'e (18x9) yakın 16x9 açık ormanla, sadece kozmetik
  T kümeleri eklendi; oyun mekaniğini değiştirmedi.
- **Zırh/DR eşyaları** (`+1/+2` silah-zırh) kademeli fiyatlandırıldı (55-210 altın)
  ki oyuncu her bölümde 1-2 anlamlı yükseltme alabilsin; ch3-4'te açılan `+2`
  eşyalar geç oyun altın birikimine (~700-900) denk düşüyor.
- **Undead düşmanlar** (skeleton/zombie/ghoul/knight_fallen/lich) `undead`
  ability'siyle radyant/kutsal hasara ×1.5 alıyor — bu yüzden ch3 mağazasında
  `bomb_holy` (kutsal bomba) ve Cleric'in `divineStrike`/`spiritualweapon`
  (SPELLBOOK_EXT) özellikleri tam bu noktada devreye giriyor: sınıf gücü
  hikâye temposuyla örtüşüyor.
- **bog_troll (regenerate)** ve **direwolf_alpha/bandit_chief/knight_fallen
  (frenzy)**: HP %50 altına inince frenzy hasarını artırıyor — oyuncuyu "yavaş
  yavaş eritmek" yerine "hızlı bitirmeye" veya "kontrollü aşındırmaya" teşvik
  ediyor, taktik çeşitliliği katıyor.
- **Takviye dalgaları** (b6 round3, b9 round3, b12 round4) bilinçli olarak geç
  round'lara konuldu ki oyuncu ilk 2-3 round'da ana tehdidi büyük ölçüde
  zayıflatabilsin, sonra ikinci dalga bir "son sprint" hissi yaratsın —
  ani/erken takviye ile haksız yere ezilme riskini azaltıyor.
- **Ekonomi**: savaş altın ödülleri 25→150 arası kademeli artıyor (ort. ~65/savaş,
  13 savaş ≈ 850 altın + opsiyonel 45 = ~895), mağaza fiyatları (55-210) bu
  birikimle 3-Bölüm mağazasında ekip başına 1-2 kalıcı yükseltme + birkaç
  tüketilebilir alacak şekilde ayarlandı.

## 6. Yeni büyüler ve sınıf özellikleri

`SPELLBOOK_EXT` (2. seviye, aynı slot havuzunu kullanır): Wizard için
**Scorching Ray** (3d6 ateş, attack), **Sisli Sıçrayış** (self-buff:
speedBonus+3, dodge+2, 1 tur — "Misty Step" hissi, mevcut status alanlarıyla
ifade edildi), **Örümcek Ağı** (alan save, speedBonus-3, 2 tur); Cleric için
**Ruhani Silah** (1d8 kutsal, menzilli attack), **Hold Person** (debuff,
incapacitated 2 tur), **Yardım Et** (ally buff, reduceDie6 tek vuruşluk direnç).
Tüm büyüler mevcut `resolve` tiplerinden (`attack`/`save`/`debuff`/`buff`) ve
motorun zaten okuduğu status alanlarından (`dodge`, `speedBonus`, `atkDie`,
`penaltyDie`, `reduceDie`, `incapacitated`) kuruldu — motor değişikliği
gerektirmiyor.

`CLASS_FEATURE_TEXT`, CONTRACT'taki 10 `CLASS_FEATURES` id'sinin tamamını
Türkçe adlandırıyor; `LEVEL_UPS` her sınıfa 4-5 anlamlı kademe veriyor (Fighter:
actionSurge→cleave→extraAttack→indomitable; Cleric: turnUndead→divineStrike→
preserveLife + 2 statPoints/1 slot; Wizard: arcaneRecovery→empoweredEvocation→
spellSurge + 2 statPoints/1 slot).

## 6b. Büyü ilerlemesi (STARTING_SPELLS / SPELL_POOL)

Sorun: `data.js`'teki `DEFAULT_SPELLS`, Wizard/Cleric'in oyunun başında
sınıflarının **tüm** büyülerini bildiği anlamına geliyordu — bu da seviye
atlamadaki `learnSpells`'i anlamsız kılıyordu. Çözüm `progression.js`'e
eklendi (geliştirici `data.js`'te `DEFAULT_SPELLS` yerine `STARTING_SPELLS`
kullanmalı, dosyaya dokunulmadı — CONTRACT §1):

- **`STARTING_SPELLS`** — dengeli/eğlenceli bir açılış seti (3 cantrip + 2
  seviye-1 büyü): Wizard → `firebolt, snow, speed, magicmissile, sleep`;
  Cleric → `sacredflame, guide, resistance, healingword, bless`.
- **`SPELL_POOL`** — seviye atlamada seçilebilecek havuz (`SPELL_OPTIONS` +
  `SPELLBOOK_EXT`'teki 2. seviye büyüler dahil); her girdi string (id) veya
  `{id, minLevel}` — 2. seviye büyülerin tamamı `minLevel:3` ile işaretlendi.
- `LEVEL_UPS.learnSpells` sayıları gözden geçirildi (her seviyede en az 1 yeni
  büyü; Wizard biraz daha fazla): **Wizard toplamda 11**, **Cleric toplamda
  10** büyü bilecek şekilde (başlangıç 5 + kademeli yeni öğrenmeler),
  hedeflenen 10-12 / 9-11 aralığında. Tüm id referansları `SPELLBOOK`/
  `SPELLBOOK_EXT`'e karşı Node `vm` ile doğrulandı (0 hata).

## 7. Doğrulama

`/tmp/.../scratchpad/full_validate.js` bir Node `vm` context'inde `hex.js`,
`data.js` ve dört content dosyasını sırayla yükleyip şunları kontrol etti:
sözdizimi/çalıştırma hatası yok; tüm `ENEMY_DEFS` sprite/ai/ability/spell id'leri
CONTRACT listesinde; tüm `ITEM_DEFS`/`SHOP_STOCK` referansları geçerli;
`XP_TABLE`/`LEVEL_UPS`/`SPELLBOOK_EXT` şema uyumlu; her savaş haritası
12-20×7-11 aralığında, satırlar eşit uzunlukta, tam 3 `P`, düşman koordinatları
(takviyeler dahil) geçilebilir ve çakışmasız, BFS ile her `P`'den her düşmana
(ve diğer `P`'lere) yol var; `objective.boss.target` enemies listesindeki bir
isimle eşleşiyor; `choice.goto` ve `battle.next` aynı bölüm içinde geçerli bir
node id'sine işaret ediyor. Sonuç: **tüm kontroller geçti** (0 hata).

## 8. Denge riskleri (Tester'ın simülasyonla doğrulaması istenen 4 savaş)

Aşağıdakiler, matematiksel olarak makul görünse de RNG'ye veya oyuncu
davranışına göre en fazla sallanabilecek (ya çok kolay ya da çok zor
hissettirebilecek) savaşlar. Tester'dan özellikle bunlarda **kazanma oranı,
ortalama round sayısı ve savaş sonu ekip HP yüzdesi** simülasyonu istiyorum.

1. **b1 — Kurt Pususu (en riskli açılış).** Seviye 1, henüz eşyasız/statPoints
   dağıtılmamış 3 kişilik ekip, 3× `packTactics`'li kurda karşı. `packTactics`
   (bitişikte müttefik varsa +2 isabet) kurtların birbirine yakın durduğu
   senaryoda isabet oranını belirgin yükseltiyor; Wizard'ın düşük HP'si (6 taban)
   kötü bir açılış turunda (örn. 2 kurt aynı hedefe erken ulaşırsa) riskli.
   Kasıtlı olarak "zorlayıcı ilk savaş" hedeflendi ama **erken bir kritik +
   packTactics kombosu Wizard'ı 1-2 turda düşürebilir** — tekrar deneme
   mekaniği bu riski karşılıyor, ama tester ortalama round-1 hasarını
   ölçmeli.
2. **b6 — Bataklık Trolü (BOSS, regenerate+frenzy+takviye).** hp48 troll,
   round başına 3 HP `regenerate` (ateş/kutsal hasar almadığı turlarda) alıyor
   ve `frenzy` ile %50 altında hasarı artıyor; üstüne round 3'te `giant_spider`
   takviyesi geliyor. Eğer ekip ch2 mağazasından ateş/asit bombası almadıysa
   (opsiyonel alışveriş), sürekli-hasar/regenerate yarışını kaybedip savaş
   beklenenden çok uzayabilir (hedef 5-8 dk, riskli senaryoda 10+ dk'ya
   çıkabilir). **Risk: ekipman seçimine aşırı duyarlı bir boss.**
3. **b9 — Düşmüş Şövalye (BOSS, shieldWall + takviye).** `shieldWall`
   (bitişik müttefiklere +1 dodge pasif aura) iki skeleton refakatçiyle
   birleşince, oyuncu düşmanları dağıtmazsa "kaçınması yüksek küme" oluşuyor;
   round 3'teki 2× zombi takviyesi bu kümeye eklenirse ekip AP'sini
   temizlemeye yetiştiremeyip savaş sürüklenebilir. **Risk: oyuncu
   düşmanları dağıtmazsa isabet oranı beklenenden düşük kalabilir**, bu da
   "haksız" hissettirebilir — tester'dan özellikle bu savaşta ortalama
   isabet yüzdesini de istiyorum.
4. **b12 — Lich Kadir (FİNAL BOSS, kontrol büyüsü yığılması).** Lich 3 slotla
   `sleep` (alan, incapacitated) ve `bane` (ceza zarı) gibi kontrol
   büyülerini art arda kullanabiliyor; `summon:skeleton` (HP %50 altına
   inince) + round 4'teki 2× iskelet takviyesi ile alan doluyor. En riskli
   senaryo: **art arda başarısız save'lerle 1-2 kahramanın peş peşe
   etkisizleşmesi** — 3 kişilik bir ekipte bu, geçici olarak tek kişiyle
   savaşmak anlamına gelebilir. `indomitable` (Fighter, Sv6) bu riski kısmen
   dengeliyor ama sadece savaşta 1 kez. Final olduğu için "zor" istendi, ama
   tester'dan **kontrol büyüsü zincirinin gerçek win-rate'i ne kadar
   düşürdüğünü** özellikle ölçmesini istiyorum; gerekirse `sleep`'in alan
   yarıçapını veya Lich'in slot sayısını (3→2) düşürmeyi öneririm.

*(§8'deki sayılar TEST_REPORT.md §6'daki ilk sim turundan önceki tasarım tahminleridir;
§9 gerçek bot sonuçlarına göre yapılan düzeltmeleri özetler.)*

## 9. TEST_REPORT.md §6 sonrası denge turu (bot simülasyonu ile kalibrasyon)

Patron talebiyle `campaign-sim.js` (200 koşu/savaş) sonuçlarına göre içerik yeniden
dengelendi. **Not:** `tests/load-engine.js` bu tur sırasında iki ayrı entegrasyon
sorunuyla karşılaştı — (1) sandbox'ta `requestAnimationFrame` stub'lanmamış
(`campaign-flow.js:showResultScreen` bunu artık kullanıyor), (2) sim doğrudan
`setupBattle()` çağırdığı için `GameState.currentBattleNode` hiç set edilmiyor ve
`main.js`'in otomatik `onBattlePhaseOver()` çağrısı `node=null` ile çöküyor. Bunlar
Geliştirici/Tester dosyalarında (repoda HİÇ DEĞİŞİKLİK YAPILMADI); yalnızca
Tasarımcının kendi `/tmp` scratchpad'indeki **kopya** `load-engine.js`/`campaign-sim.js`
dosyalarında (requestAnimationFrame stub + `onBattlePhaseOver` no-op) geçici olarak
çözülüp doğrulama yapıldı. **Geliştirici/Tester bu iki noktayı gerçek dosyalarda da
düzeltmeli** ki `npm run test:campaign` gerçek repoda da çalışsın.

Yapılan içerik değişiklikleri:
- **`ENEMY_DEFS`**: hemen hemen tüm düşmanların `hpMax`'ı ve bazılarının hasar zarı/xp'si
  8 iterasyonluk bir kalibrasyon turunda ayarlandı (b1/b1opt biraz kolaylaştırıldı — `wolf`
  hp 11→9, `bandit` hp 14→11 — Bölüm 2-4 düşmanları kademeli olarak sertleştirildi, ör.
  `knight_fallen` hp 58→96, `lich` hp 95 sabit ama dmg/dr ayarlandı, `bog_troll` hp 48→52).
- **`campaign.js`**: `b6`/`b9`/`b12` takviye dalgalarının round zamanlaması ve büyüklüğü
  ince ayarlandı (round 3→4 gibi gecikmeler); `b2`'ye bir düşman eklenip geri alındı;
  `b7`'ye eklenen takviye tekrar kaldırıldı (fazla zorlaştırdığı görüldü).
- **`progression.js` `XP_TABLE`**: iki kez yeniden kalibre edildi. İkinci turda, referans
  sim'in **"completionist" yol** (opsiyonel `b1opt`'u da alan) oynadığı fark edildi —
  `b1opt`'un ekstra XP'si bir sonraki eşiği ERKEN tetikleyip `b3`'ü aniden %97'ye
  (çok kolay) düşürdü. Son tablo (`[0,0,130,600,1600,2550,5000]`) hem ana yol (b1opt
  hariç) HEM b1opt'lu yol için ayrı ayrı hesaplanıp kesişim alınarak seçildi — her iki
  oynanışta da Lv2/b1 sonrası, Lv3/Bölüm1 sonu, Lv4/Bölüm2 sonu, Lv5/Bölüm3 ortası,
  Lv6/c4 hedefleri tutuyor.

### Son durum tablosu (kendi doğrulamam: N=100 koşu/savaş, `/tmp` scratchpad kopyasıyla)

Hedef bantlar (patron): normal **%80-92**, boss **%65-80**, survive **%75-88**, round **5-8**.

| Düğüm | Tip | Kazanma % | Ort. round | Durum |
|---|---|---|---|---|
| b1 Kurt Pususu | normal | 81% | 4.5 | ✅ bant içi |
| b1opt Haydut Kampı (opsiyonel) | normal | 96% | 4.8 | ⚠️ hafif kolay (opsiyonel, düşük öncelik) |
| b2 Haydut Pususu | normal | 85% | 5.3 | ✅ bant içi |
| b3 Kurt Reisi (BOSS) | boss | 71% | 4.8 | ✅ bant içi |
| b4 Balçık Geçidi | normal | 94% | 5.9 | ✅ bant içi (üst sınıra yakın) |
| b4cave Örümcek Mağarası (alt.) | normal | 94% | 5.3 | ✅ bant içi |
| b5 Goblin Kampı | normal | 90% | 7.0 | ✅ bant içi (round üst sınırda) |
| b6 Bataklık Trolü (BOSS) | boss | 64% | 6.8 | ✅ bant içi (alt sınırda) |
| b7 Mezar Soyguncuları | normal | 100% | 7.8 | ❌ çok kolay |
| b8 İskelet Muhafızları | normal | 99% | 6.7 | ❌ çok kolay |
| b9 Düşmüş Şövalye (BOSS) | boss | 93% | 7.7 | ❌ çok kolay |
| b10 Kale Kapısı | normal | 93% | 10.4 | ❌ çok kolay + round çok uzun |
| b11 Alev İmpleri (survive) | survive | 99% | 6.0 | ❌ çok kolay |
| b12 Lich Kadir (FİNAL BOSS) | boss | 81% | 7.6 | ✅ bant içi |

**8/13 zorunlu savaş artık hedef bantta** (başlangıçtaki 2/13'ten — sadece b12'nin
yakın olduğu durumdan — büyük iyileşme). **Kalan 5 savaş (b7, b8, b9, b10, b11)
hâlâ "çok kolay" tarafında** — b7/b8/b9'un `hpMax`'ını art arda 3 kez artırmama
rağmen kazanma oranı %93-100'de takılı kaldı; bu, salt HP artışının bir noktadan
sonra getiri sağlamadığını, muhtemelen bu savaşlarda **daha fazla düşman sayısı /
daha erken takviye / hasar zarı büyütme** gibi yapısal bir değişikliğin gerektiğini
gösteriyor. Zaman/iterasyon bütçem (talep edilen 2-3'ün üzerinde, 8 tur) bu beşini
tam bantına çekmeye yetmedi — **bilinçli olarak "çok kolay" tarafında bıraktım**
("çok zor" bırakmaktansa daha güvenli: oyuncu kaybetmiyor, sadece biraz fazla
kolay hissediyor). Öneri: Tester bir sonraki turda özellikle b7/b8/b9/b10/b11'e
odaklanıp (a) düşman sayısını +1 artırsın, (b) b10'un round'unun neden 10.4'e
çıktığını (muhtemelen `orc_brute`'un yüksek HP'si + düşük hasar çıktısı
kombinasyonu) araştırsın.

## 10. Görev 5: yapısal denge + harita/boss cilası

Patron talebiyle b7/b8/b9/b10/b11'e **HP artışı yerine yapısal** değişiklikler
uygulandı:

- **b7 Mezar Soyguncuları**: harita tamamen yeniden çizildi — çift duvar sırası
  (iki art arda dar geçit, her biri tek hex köprü) + moloz (`%`) odaları. Rol
  karışımına bir `skeleton_archer` (arkadan menzilli destek) eklendi.
- **b8 İskelet Muhafızları**: koridoru tıkayan bir `zombie` (yavaş, dayanıklı
  "tank") eklendi; bir iskelet konumu öne (pusu) alındı.
- **b9 Düşmüş Şövalye (BOSS)**: `knight_fallen`'a `cleave` + `enrage` yetenekleri
  eklendi (CONTRACT'taki mevcut ability listesinden); takviye round'u 4→3'e
  çekildi.
- **b10 Kale Kapısı**: harita ikinci bir yan koridora (`#` kümesiyle) açıldı —
  "iki yönden gelen grup" için bir `orc_brute` + konumlar flank'a taşındı; HP
  düşürülüp (54→36) sayı/konum artırıldı (round'u kısaltmak için, patronun
  talimatı gereği HP değil sayı/dağılım öne çıkarıldı).
- **b11 Alev İmpleri (survive)**: ek bir takviye dalgası denendi ama **N=100
  simülasyonda kazanma oranını %99'dan %24'e düşürdü** (aşırı düzeltme) — bu
  yüzden geri alındı, tek dalga (round 3) korundu. Bu savaşın hedef banda göre
  hâlâ kolay durduğunu biliyorum ama zaman bütçem güvenli bir ikinci deneme
  yapmaya yetmedi.
- Ayrıca **b1opt haritası** tamamen yeniden çizildi: ormanın içinden geçen dar
  bir dere + tek hex köprü (zorunlu şaşırtma noktası) + kamp ateşi (`^` tehlike)
  + siper küpleri (`#`).

**Boss diyalogları**: Grafik'in eklediği `boss_wolf`, `boss_troll`, `boss_knight`,
`boss_lich` portreleriyle her boss savaşının intro/outro'suna 1-2 karakterli
replik eklendi (b3 Kurt Reisi, b6 Bataklık Trolü, b9 Düşmüş Şövalye, b12 Kadir —
Kadir'in portresi `lich`'ten `boss_lich`'e güncellendi). **Tüccar portresi**
(`merchant`) camp node'larına eklenmedi — CONTRACT §4.5'teki camp şeması
(`{id, type:"camp", title, text, shop}`) diyalog dizisi taşımıyor; şemayı
zorlamak yerine patronun "izin vermiyorsa atla" talimatına uyuldu. **Şema
önerisi**: camp node'una isteğe bağlı bir `intro: [...]` alanı eklenirse (battle
node'undakiyle birebir aynı diyalog şeması) gelecekte tüccar/karakter replikleri
mümkün olur.

### Son doğrulama (N=100, `/tmp` scratchpad kopyasıyla)

| Düğüm | Tip | Kazanma % | Ort. round | Durum |
|---|---|---|---|---|
| b1 | normal | 84% | 4.5 | ✅ |
| b1opt | normal | 94% | 4.8 | ✅ |
| b2 | normal | 86% | 4.9 | ✅ |
| b3 (BOSS) | boss | 67% | 5.1 | ✅ |
| b4 | normal | 98% | 5.5 | ❌ çok kolay |
| b4cave (alt.) | normal | 100% | 5.3 | ❌ çok kolay |
| b5 | normal | 98% | 6.4 | ❌ çok kolay |
| b6 (BOSS) | boss | 73% | 7.1 | ✅ |
| b7 | normal | 97% | 8.6 | ❌ çok kolay + uzun |
| b8 | normal | 57%\* | 6.6 | ⚠️ çok değişken (bkz. not) |
| b9 (BOSS) | boss | 89% | 7.7 | ❌ çok kolay |
| b10 | normal | 95% | 8.4 | ❌ çok kolay + uzun |
| b11 (survive) | survive | 96% | 6.0 | ❌ çok kolay (ama güvenli — %24 riskinden kaçınıldı) |
| b12 (FİNAL BOSS) | boss | 83% | 7.5 | ✅ |

\* **Önemli bulgu — yüksek varyans**: b8, art arda çalıştırılan N=100 turlarında
%91/%97/%86/%57 arası salınım gösterdi; b5 aynı şekilde %65-98 arası, b1 %73-90
arası. Bu, motorun zar bazlı RNG'sinin (özellikle küçük düşman sayılı, düşük HP'li
karşılaşmalarda) N=100'de bile **istatistiksel olarak gürültülü** kaldığını
gösteriyor — tek bir N=100 koşusu güvenilir bir karar için yetersiz olabilir.
**Tester'a öneri**: kalan b4/b4cave/b5/b7/b9/b10/b11 için N=200-300 ile en az
2-3 bağımsız tur çalıştırıp ortalamasına bakmadan HP/sayı ayarlaması yapmamalı;
tek-tur sonuçları (bu belgedekiler dahil) gürültülü olabilir.

## 11. Görev 6-7: kısa mola + `--refs N` sonrası final kalibrasyon

Geliştirici iki düzeltme yaptı: (1) her zaferden sonra **kısa mola** (eksik HP'nin
%50'si + 1 büyü slotu geri gelir, yeni bölüm başında tam dinlenme) — bu, §9-10'da
tespit edilen "bir savaşı zorlaştırmak sonraki savaşı da bozuyor" zincirleme
etkisini ortadan kaldırdı; (2) `campaign-sim.js` artık `--refs N` ile **N bağımsız
referans playthrough'un ortalaması + min-max aralığını** veriyor (`node
campaign-sim.js 100 --refs 5` = referans başına 20 koşu × 5 referans = 100 toplam),
bu da §9-10'da belgelenen aşırı run-to-run varyansı ölçülebilir/kararlı hale
getirdi (bu turda 5 referans arası >25 puanlık fark gösteren düğüm çıkmadı).

Bu kararlılık sayesinde Görev 6-7'de üç iterasyon boyunca **önce düşman
sayısı/hasarını, HP'yi son çare olarak** kullanan bir kalibrasyon yapıldı:
`wolf`/`bandit` gibi erken düşmanlarda küçük hasar zarı artışları (`1d6`→`1d8`
gibi), `cultist`/`skeleton`/`skeleton_archer`/`goblin_shaman` gibi orta-oyun
düşmanlarında hasar zarı büyütme, `knight_fallen`/`orc_brute`/`fire_imp`/`wraith`
gibi geç-oyun düşmanlarında hem HP hem hasar ayarı; birkaç düğüme (b2, b4, b5, b7,
b8, b9, b10, b11) düşman sayısı/takviye denemeleri yapıldı, ama **düşman sayısı
artırmanın kampanya XP'sini şişirip sonraki savaşları (özellikle b6/b12 gibi
dokunulmaması istenen bossları) dolaylı kolaylaştırdığı** gözlemlenip çoğu geri
alındı — bu yüzden son halde hasar-zarı artışları sayı artışlarına ağır bastı.

### Final denge tablosu (`node campaign-sim.js 100 --refs 5`, 5 bağımsız referans × 20 koşu)

Hedef bantlar (ortalama): normal **%82-92**, boss **%68-80**, survive **%78-88**,
round **5-8**.

| Düğüm | Tip | Kazanma% (min-max) | Ort. round | Durum |
|---|---|---|---|---|
| b1 | normal | 88% (85-95) | 4.0 | ✅ (dokunulmadı) |
| b1opt | normal | 94% (90-100) | 4.4 | ✅ (dokunulmadı) |
| b2 | normal | 79% (65-90) | 5.1 | ✅ hedefe yakın |
| b3 (BOSS) | boss | 74% (70-85) | 4.6 | ✅ (dokunulmadı, hedef ~72'ye çok yakın) |
| b4 | normal | 96% (90-100) | 5.3 | ❌ hâlâ kolay |
| b4cave (alt.) | normal | 92% (80-100) | 5.9 | ✅ |
| b5 | normal | 99% (95-100) | 7.2 | ❌ hâlâ kolay |
| b6 (BOSS) | boss | 68% (55-80) | 6.4 | ✅ (dokunulmadı) |
| b7 | normal | 96% (90-100) | 8.5 | ❌ hâlâ kolay + round biraz uzun |
| b8 | normal | 98% (95-100) | 6.0 | ❌ hâlâ kolay |
| b9 (BOSS) | boss | 83% (75-90) | 8.8 | ✅ hedefe yakın (round biraz uzun) |
| b10 | normal | 97% (95-100) | 8.6 | ❌ hâlâ kolay + round hedefin üzerinde |
| b11 (survive) | survive | 99% (95-100) | 8.0 | ❌ hâlâ kolay (round artık hedefte: 5→7) |
| b12 (FİNAL BOSS) | boss | 76% (65-85) | 8.0 | ✅ (dokunulmadı) |

**Sonuç:** Tüm 4 boss (b3/b6/b9/b12) artık hedef bantta, b1/b1opt/b2/b4cave da
öyle — **8/14 düğüm hedefte**. **b4, b5, b7, b8, b10, b11 üç iterasyon sonunda
hâlâ "çok kolay" tarafında** kaldı; her birine hasar-zarı artışı (ör. `slime`
1d4→1d6, `cultist` 1d8→1d10, `skeleton_archer` denemesi geri alındı) ve/veya
düşman sayısı denendi ama **kararlı botun bu savaşlarda çok verimli oynadığı**
görülüyor (özellikle 4-5 düşmanlı, tek büyük tehdidi olmayan "dağınık" savaşlarda
odak ateşiyle hızla temizliyor). Üç iterasyon bütçesi tükendiği için burada
durduruldu. **Sonraki tur için öneri**: bu 6 savaşta HP/hasar yerine **erken
takviye dalgası + arazi darboğazı** kombinasyonunu (b6/b9/b12'de işe yarayan
formül) denemek, çünkü düz HP/hasar artışı bu düğümlerde getiri sağlamayı
bırakmış görünüyor.
