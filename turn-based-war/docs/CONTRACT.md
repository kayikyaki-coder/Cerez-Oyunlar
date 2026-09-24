# Turn Based War — Ekip Sözleşmesi (v1)

Bu belge, paralel çalışan ajanların (Oyun Tasarımcısı, Grafik Tasarımcısı, Geliştirici, Tester)
birbirini ezmeden çalışabilmesi için **dosya sahipliğini** ve **veri şemalarını** sabitler.
Şema değişikliği gerekiyorsa kendi dosyanda uydurma — raporunda "şema değişikliği önerisi" olarak yaz.

Oyun saf HTML/CSS/vanilla JS'dir (build yok, modül yok, `<script>` sırası ile global'ler).
`oyun/index.html` doğrudan tarayıcıda (file://) açılabilmeli. Harici kütüphane / CDN / font YOK.
Tüm oyun içi metinler **Türkçe**. Kod yorumları Türkçe (mevcut stil).

Hedef: prototipten **çıkışa hazır** bir oyuna — en az **30 dakikalık** kampanya
(≈10–12 savaş + hikâye + kamp/alışveriş + seviye atlama), başlık ekranı, kayıt/yükleme, ses, son ekranı.

---

## 1. Dosya sahipliği

| Dosya | Sahibi | Not |
|---|---|---|
| `js/content/enemies.js` | Tasarımcı | `ENEMY_DEFS` |
| `js/content/items.js` | Tasarımcı | `ITEM_DEFS`, `SHOP_STOCK` |
| `js/content/progression.js` | Tasarımcı | `XP_TABLE`, `LEVEL_UPS`, `CLASS_FEATURES` |
| `js/content/campaign.js` | Tasarımcı | `CAMPAIGN` (bölümler, savaşlar, haritalar, diyaloglar) |
| `docs/DESIGN.md` | Tasarımcı | Tasarım belgesi, denge notları |
| `js/sprites.js` | Grafik | Tüm sprite'lar + `drawSpriteGrid` (imza korunur) |
| `js/art.js` | Grafik | Arazi karo çizimi, portreler, efekt çizim fonksiyonları |
| `js/audio.js` | Grafik | WebAudio ile sentezlenmiş ses efektleri + müzik (dosya yok) |
| `style.css` | Grafik | Tüm ekranların görünümü |
| `js/data.js`, `js/engine.js`, `js/ai.js`, `js/render.js`, `js/main.js`, `js/creation.js`, `js/campaign-flow.js`, `js/save.js`, `index.html` | Geliştirici | Oyun mantığı + ekran akışı |
| `docs/TEST_REPORT.md`, `tests/*` | Tester | Playwright testleri, hata raporu |

Grafik ajanı `index.html`'deki yapıyı değiştirmez; CSS sınıf adları aşağıdaki listede.
Geliştirici `style.css`'e dokunmaz; yeni bir sınıfa ihtiyaç olursa `index.html` içinde kullanır ve raporlar
(entegrasyonu patron yapar). Geçici ihtiyaç için geliştirici `style-dev.css` açabilir (sonra birleştirilir).

---

## 2. Script sırası (index.html)

```
js/hex.js, js/sprites.js, js/art.js, js/audio.js,
js/data.js, js/content/enemies.js, js/content/items.js, js/content/progression.js, js/content/campaign.js,
js/engine.js, js/ai.js, js/render.js, js/save.js, js/creation.js, js/campaign-flow.js, js/main.js
```
Content dosyaları yalnızca **sabit veri** tanımlar (fonksiyon çağırmaz, DOM'a dokunmaz).
`data.js`'deki `WEAPONS`, `ARMORS`, `SPELLBOOK`, `CLASS_DEFS` kullanılabilir id'lerdir.

---

## 3. Mevcut kural sistemi (değişmez çekirdek)

- Hex ızgara (pointy-top, odd-r). Birim başına tur: **4 AP**. Hareket 1 AP (hız kadar), Dash 1 AP (hız/2), turda en çok 1 hareket + 1 dash.
- Saldırı 2 AP, turda 1 saldırı. İsabet: `d20 + stat (+bonus)` vs savunma `min(N×d20) + agility + dodge` — N = o round bu birimin kaç kez saldırıya uğradığı + 1 (çok saldırılan kaçamaz).
- nat 20 kritik (zar ikiye katlanır), nat 1 ıska. Zırh `dr` = yüzde hasar azaltma.
- Statlar: `might, agility, will, mind, influence`. Sınıflar: Fighter, Cleric, Wizard.
- Büyü: cantrip (slotsuz), 1. seviye (slot). Save DC = 8 + stat + max(1, floor(level/3)).

---

## 4. Şemalar

### 4.1 Arazi (terrain)

Harita karakterleri (campaign.js `map` satırlarında):

| Karakter | id | Geçilir | Hareket maliyeti | Etki |
|---|---|---|---|---|
| `.` | `ground` | evet | 1 | biyoma göre çim/toprak/taş zemin |
| `,` | `road` | evet | 1 | yol / patika / döşeme |
| `T` | `forest` | evet | 2 | içindeki birime **menzilli** saldırılara karşı +2 dodge |
| `%` | `rough` | evet | 2 | bataklık/moloz/kar — zor arazi |
| `~` | `water` | hayır | — | su (menzilli saldırı üzerinden geçer) |
| `#` | `wall` | hayır | — | kaya/duvar, görüş engellemez (basitlik) |
| `=` | `bridge` | evet | 1 | köprü |
| `^` | `hazard` | evet | 1 | ateş/zehir: turunu burada **bitiren** birim 1d4 hasar alır |
| `+` | `shrine` | evet | 1 | turunu burada bitiren **ekip** birimi 1d4 iyileşir |
| `P` | `ground` | evet | 1 | ekip başlangıç konumu (en az 3, en çok 4 adet) |

Biyomlar: `forest`, `road`, `swamp`, `cave`, `ruins`, `crypt`, `snow`, `castle`, `village`.
Haritalar **en çok 20 sütun × 11 satır**, en az 12×7. Tüm satırlar aynı uzunlukta.

### 4.2 `ENEMY_DEFS` (enemies.js)

```js
const ENEMY_DEFS = {
  wolf: {
    name: "Kurt", cls: "Dire Wolf", sprite: "wolf",
    hpMax: 11, speed: 7, level: 1,
    stats: { might: 1, agility: 3, will: 0, mind: 0, influence: 0 },
    attack: { name: "Isırık", range: 1, dmg: "1d6", stat: "agility", ranged: false },
    dodgeBonus: 0, dr: 0,
    ai: "melee",               // melee | skirmisher | ranged | caster | healer | brute | boss
    spells: [],                // SPELLBOOK id'leri (caster/healer/boss) — hedef "enemy" ise ekibe atılır
    slotsMax: 0,
    abilities: ["packTactics"], // aşağıdaki listeden
    xp: 50,
    desc: "Sürü halinde avlanır."
  }
};
```

`ai` davranışları (Geliştirici uygular):
- `melee`: en yakın ekip üyesine gider, vurur.
- `skirmisher`: en düşük HP'li / en düşük dodge'lu hedefe gider (kurt, haydut bıçakçı).
- `ranged`: menzilde kalır, bitişikteyse uzaklaşıp atar, ormana (T) girmeyi sever.
- `caster`: büyü listesinden en iyi olanı kullanır (alan büyüsü ≥2 hedef tutuyorsa onu), mesafeyi korur.
- `healer`: yaralı dostu (<%60) iyileştirir, yoksa caster gibi davranır.
- `brute`: en yakın hedefe gider, yavaş ama ağır vurur.
- `boss`: melee + yetenekleri öncelikli kullanır.

`abilities` (yalnızca bu id'ler; Geliştirici hepsini uygular):
| id | Etki |
|---|---|
| `packTactics` | Hedefe bitişik başka bir müttefik varsa isabete +2 |
| `poison` | İsabette hedefe "Zehir" statüsü: turu başında 1d4 hasar, 2 tur |
| `regenerate` | Tur başında 3 HP yenilenir (ateş/radyant hasarı aldığı tur hariç) |
| `undead` | Radyant/kutsal hasardan ×1.5; Sleep/Charm'a bağışık |
| `howl` | Savaşta 1 kez, 1 AP: tüm müttefiklere 2 tur "Uluma" (+1 isabet, +1 hız) |
| `frenzy` | HP %50 altına inince hasar zarına +2 |
| `shieldWall` | Bitişik müttefikleri +1 dodge (pasif aura) |
| `cleave` | İsabette hedefe bitişik 2. bir ekip üyesine yarı hasar |
| `summon:<enemyId>` | Savaşta 1 kez (HP %50 altına inince) yanına 2 adet <enemyId> çağırır |
| `enrage` | HP %50 altına inince AP 5 olur (tur başı) |
| `webShot` | 2 AP, menzil 6: save (agility, DC 12) başarısızsa "Ağ": hız 0, 1 tur |
| `explode` | Ölünce bitişik herkese 1d6 ateş hasarı |
| `fly` | Arazi maliyetini ve `~` suyu yok sayar |
| `phase` | Her tur %25 şansla ilk gelen saldırıyı tamamen boşa çıkarır |

### 4.3 `ITEM_DEFS` / `SHOP_STOCK` (items.js)

```js
const ITEM_DEFS = {
  potion_heal: { name: "İyileşme İksiri", type: "consumable", price: 25,
                 effect: { heal: "2d4+2" }, ap: 1, desc: "..." },
  // type: consumable | weapon | armor | trinket
  // consumable effect anahtarları: heal ("XdY+Z"), restoreSlot (sayı), buff (status objesi, SPELLBOOK status şeması),
  //   damage ({dmg:"2d6", area:1, element:"ateş", range:6})  → fırlatılabilir bomba
  // weapon: { weapon: "longsword", bonus: 1 }  → WEAPONS id + isabet/hasar +bonus (ör. "+1 Uzun Kılıç")
  //   veya yeni silah: { weaponDef: {name,dmg,hands,cat,stat,finesse,range,ranged}, bonus }
  // armor:  { armor: "chain", bonus: 1 }       → ARMORS id + dodge bonusu
  // trinket: { mods: { hpMax: 3, speed: 1, dodge: 1, might: 1, ..., slots: 1, initiative: 2 } }
  //   classes: ["Fighter"] (opsiyonel kısıt)
};
const SHOP_STOCK = { ch1: ["potion_heal", ...], ch2: [...], ... };  // bölüm id'sine göre mağaza
```
Ekipte ortak envanter (gold + eşyalar). Her kahraman: 1 silah, 1 zırh, 1 kalkan (bool), 2 trinket yuvası.
Savaşta iksir kullanımı: 1 AP, kendine veya bitişik müttefike.

### 4.4 İlerleme (progression.js)

```js
const MAX_LEVEL = 6;
const XP_TABLE = [0, 0, 300, 700, 1300, 2100, 3200]; // XP_TABLE[level] = o seviyeye gereken toplam XP
// XP ekibe ortak verilir (düşman xp toplamı, hayatta olan-olmayan herkes alır).
const LEVEL_UPS = {
  Fighter: { hpDie: 10, perLevel: { 2: {features:["actionSurge"]}, 3: {statPoints:1}, 4: {features:["extraAttack"]}, 5: {statPoints:1}, 6: {features:["indomitable"]} } },
  Cleric:  { hpDie: 8,  perLevel: { 2: {slots:1, features:["turnUndead"]}, ... } },
  Wizard:  { hpDie: 6,  perLevel: { 2: {slots:1, features:["arcaneRecovery"]}, ... } }
};
// Her seviyede HP artışı: floor(hpDie/2)+1 + might. statPoints: oyuncunun dağıtacağı puan (stat tavanı 5).
// learnSpells: {cantrips: n, leveled: n}  → o seviyede seçilebilecek yeni büyü sayısı
```
`CLASS_FEATURES` (Geliştirici uygular, tasarımcı açıklama metnini yazar):
| id | Etki |
|---|---|
| `actionSurge` | Savaşta 1 kez: +2 AP (saldırı limiti 2 olur o tur) |
| `extraAttack` | Turda 2 saldırı (her biri 2 AP) |
| `indomitable` | Savaşta 1 kez başarısız save'i tekrar at |
| `cleave` | (Fighter opsiyonel) isabette bitişik 2. düşmana yarı hasar |
| `turnUndead` | Savaşta 1 kez, 2 AP: 3 hex içindeki undead'ler will save, başarısızsa 2 tur saldıramaz+kaçar |
| `divineStrike` | Silah isabetinde +1d8 radyant (turda 1) |
| `preserveLife` | Savaşta 1 kez, 2 AP: 3 hex içindeki tüm müttefikler 2d6 iyileşir |
| `arcaneRecovery` | Savaşta 1 kez, 1 AP: 1 büyü slotu geri kazan |
| `empoweredEvocation` | Hasar büyülerine +mind hasar |
| `spellSurge` | Savaşta 1 kez: bu tur seviyeli büyü sınırı yok + 2 AP |

Yeni büyüler (2. seviye) gerekirse tasarımcı `SPELLBOOK_EXT` adıyla `progression.js` içinde, **mevcut SPELLBOOK
şemasıyla birebir aynı alanlarla** tanımlar (`level: 2`); geliştirici bunları SPELLBOOK'a ekler.
Seviye 2 büyüler 1. seviye slotlarını kullanır (tek slot havuzu, basitlik).

### 4.5 `CAMPAIGN` (campaign.js)

```js
const CAMPAIGN = {
  title: "…", intro: [ {speaker: "Anlatıcı", portrait: "narrator", text: "…"} ],
  chapters: [
    {
      id: "ch1", title: "Bölüm 1 — …", biome: "forest",
      nodes: [
        { id: "b1", type: "battle", title: "…", biome: "forest",
          intro: [ {speaker, portrait, text} ], outro: [ ... ],
          map: [ "....", "...." ],             // bkz. 4.1
          enemies: [ { type: "wolf", q: 15, r: 4, name: "Kurt A" } ],
          reinforcements: [ { round: 3, enemies: [ {type, q, r} ] } ],   // opsiyonel
          objective: { type: "kill" },         // kill | boss {target:"<enemy name>"} | survive {rounds:N} | escort? YOK
          rewards: { gold: 40, items: ["potion_heal"] },
          optional: false },                    // true ise oyuncu atlayabilir (yan görev)
        { id: "c1", type: "camp", title: "Kamp", text: "…", shop: "ch1" },   // kamp: tam iyileşme, alışveriş, seviye atlama
        { id: "s1", type: "story", pages: [ {speaker, portrait, text} ] },
        { id: "ch1choice", type: "choice", text: "…", options: [
            { label: "…", goto: "b3a", effect: { gold: 20 } }, { label: "…", goto: "b3b" } ] }   // opsiyonel dallanma
      ]
    }
  ],
  ending: [ {speaker, portrait, text} ]
};
```
Düğümler sırayla oynanır; `choice` seçeneğindeki `goto` aynı bölüm içindeki bir düğüm id'sine atlar ve
oradan sırayla devam eder (dallanan düğümlerin sonunda `next: "<nodeId>"` alanı ile birleşme yapılabilir).
`portrait` değerleri: `narrator, fighter, cleric, wizard, villager, elder, bandit, witch, knight, lich, …`
(grafik ajanı `art.js` içinde `drawPortrait(ctx, id, x, y, size)` ile bu id'leri çizer; bilinmeyen id → gölge silüeti).
Diyalogda kahraman isimleri için `{fighter}`, `{cleric}`, `{wizard}` yer tutucuları kullanılabilir
(ekipte o sınıf yoksa ilk kahramanın adı yazılır).

---

## 5. Grafik API'si (art.js / sprites.js / audio.js)

```js
Sprites[id] = { pal: {...}, grid: [16 string × 16 char] }   // mevcut format, 16×16
drawSpriteGrid(ctx, spr, cx, cy, px)                          // mevcut imza korunur
// Opsiyonel animasyon: Sprites[id].frames = [grid, grid]  (idle 2 kare) — drawSpriteGrid frame'i seçmek için
//   drawSpriteFrame(ctx, spr, cx, cy, px, frameIndex) sağlanır.

drawTile(ctx, terrainId, biome, cx, cy, size, q, r)          // hex karo (fillHexPath benzeri kendi çizer), q/r ile varyasyon
drawPortrait(ctx, portraitId, x, y, size)                    // diyalog portresi (kare), canvas'a
drawFx(ctx, fx, t)                                           // fx: {type:"slash"|"arrow"|"bolt"|"heal"|"explosion"|"magic", from:{x,y}, to:{x,y}, color}, t: 0..1
drawFloatText(ctx, text, x, y, color, t)                      // yüzen hasar/iyileşme sayısı, t: 0..1
BIOME_PALETTE[biome] = { bg: "#..", ... }                    // arena arka planı vb.

Audio.play(name)   // "click","move","hit","miss","crit","heal","spell","death","victory","defeat","levelup","coin","turn"
Audio.music(track) // "title","battle","boss","camp","none" — basit prosedürel döngü, düşük ses
Audio.setMuted(bool), Audio.muted
```
Gerekli sprite id'leri: tüm `ENEMY_DEFS[*].sprite` değerleri + `fighter, cleric, wizard` (+ tercihen her sınıf
için 2 renk varyasyonu değil; oyuncu kahramanları yan işareti ile ayrılır).
Tasarımcının kullanacağı sprite id listesi (grafik ajanı hepsini çizer):
`wolf, direwolf_alpha, bandit, bandit_archer, bandit_chief, goblin, goblin_shaman, spider, giant_spider,
skeleton, skeleton_archer, zombie, ghoul, cultist, cultist_priest, bog_troll, slime, fire_imp, wraith,
orc_brute, knight_fallen, lich` — tasarımcı bunların dışında sprite kullanmaz.

---

## 6. Ekranlar ve CSS sınıfları (index.html — Geliştirici kurar, Grafik stiller)

Ekran kapsayıcıları: `#screen-title`, `#screen-create`, `#screen-story`, `#screen-map`, `#screen-camp`,
`#screen-levelup`, `#screen-battle` (mevcut `#app`), `#screen-result`, `#screen-ending`. Aktif olan `.screen.active`.
Ortak sınıflar: `.screen`, `.panel`, `.card`, `.btn`, `.btn-primary`, `.btn-danger`, `.muted`, `.label`,
`.dialog-box`, `.dialog-portrait` (canvas), `.dialog-name`, `.dialog-text`, `.choice-list`,
`.node-list`, `.node`, `.node.done`, `.node.current`, `.node.locked`,
`.shop-grid`, `.item-card`, `.item-card .price`, `.inv-list`, `.hero-card`, `.hero-card .portrait`,
`.stat-row`, `.xp-bar`, `.xp-bar > span`, `.hp-bar`, `.hp-bar > span`, `.gold`, `.tooltip`,
`.side-party`, `.side-enemy`, `.toast`, `#settings` (ses aç/kapa, hız).
Log satırları: `.dmg`, `.heal`, `.miss`, `.sys`, `.crit`.
