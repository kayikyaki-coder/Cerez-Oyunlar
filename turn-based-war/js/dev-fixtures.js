// dev-fixtures.js — GELİŞTİRME/TEST İÇERİĞİ
// Tasarımcının js/content/*.js dosyaları henüz yoksa (veya eksikse) buradaki örnek içerik kullanılır.
// Gerçek içerik geldiğinde bu dosyaya HİÇ dokunmaya gerek yok: erişimciler (getEnemyDefs vb.)
// önce gerçek global'i arar, yoksa DEV_* içine düşer. window.X yerine gerçek dosyalar `const` kullanıyor
// olabileceğinden burada da global lexical scope'a `var` ile yazıyoruz (typeof kontrolü ile).

if (typeof ENEMY_DEFS === "undefined") {
  var DEV_ENEMY_DEFS = {
    wolf: {
      name: "Kurt", cls: "Dire Wolf", sprite: "wolf", hpMax: 11, speed: 7, level: 1,
      stats: { might: 1, agility: 3, will: 0, mind: 0, influence: 0 },
      attack: { name: "Isırık", range: 1, dmg: "1d6", stat: "agility", ranged: false },
      dodgeBonus: 0, dr: 0, ai: "melee", spells: [], slotsMax: 0,
      abilities: ["packTactics"], xp: 50, desc: "Sürü halinde avlanır."
    },
    direwolf_alpha: {
      name: "Alfa Kurt", cls: "Dire Wolf", sprite: "direwolf_alpha", hpMax: 20, speed: 7, level: 2,
      stats: { might: 3, agility: 3, will: 1, mind: 0, influence: 0 },
      attack: { name: "Isırık", range: 1, dmg: "1d8", stat: "agility", ranged: false },
      dodgeBonus: 0, dr: 0, ai: "melee", spells: [], slotsMax: 0,
      abilities: ["packTactics", "howl"], xp: 120, desc: "Sürünün lideri."
    },
    bandit: {
      name: "Haydut", cls: "Bandit", sprite: "bandit", hpMax: 14, speed: 6, level: 1,
      stats: { might: 2, agility: 2, will: 0, mind: 0, influence: 0 },
      attack: { name: "Kısa Kılıç", range: 1, dmg: "1d6", stat: "might", ranged: false },
      dodgeBonus: 0, dr: 0, ai: "melee", spells: [], slotsMax: 0,
      abilities: [], xp: 55, desc: "Sıradan bir yol kesici."
    },
    bandit_archer: {
      name: "Haydut Okçu", cls: "Bandit", sprite: "bandit_archer", hpMax: 12, speed: 6, level: 1,
      stats: { might: 1, agility: 3, will: 0, mind: 0, influence: 0 },
      attack: { name: "Kısa Yay", range: 10, dmg: "1d6", stat: "agility", ranged: true },
      dodgeBonus: 0, dr: 0, ai: "ranged", spells: [], slotsMax: 0,
      abilities: [], xp: 60, desc: "Mesafeyi korur, oklarla vurur."
    },
    bandit_chief: {
      name: "Haydut Reisi", cls: "Bandit", sprite: "bandit_chief", hpMax: 26, speed: 6, level: 2,
      stats: { might: 3, agility: 2, will: 1, mind: 0, influence: 0 },
      attack: { name: "Balta", range: 1, dmg: "1d10", stat: "might", ranged: false },
      dodgeBonus: 0, dr: 0.1, ai: "brute", spells: [], slotsMax: 0,
      abilities: ["frenzy", "cleave"], xp: 140, desc: "Çete lideri, sert vurur."
    },
    goblin: {
      name: "Goblin", cls: "Goblin", sprite: "goblin", hpMax: 9, speed: 6, level: 1,
      stats: { might: 0, agility: 2, will: 0, mind: 0, influence: 0 },
      attack: { name: "Mızrak", range: 1, dmg: "1d6", stat: "might", ranged: false },
      dodgeBonus: 1, dr: 0, ai: "skirmisher", spells: [], slotsMax: 0,
      abilities: [], xp: 40, desc: "Küçük ama çevik."
    },
    goblin_shaman: {
      name: "Goblin Şaman", cls: "Goblin", sprite: "goblin_shaman", hpMax: 12, speed: 6, level: 2,
      stats: { might: 0, agility: 1, will: 1, mind: 3, influence: 0 },
      attack: { name: "Asa", range: 1, dmg: "1d4", stat: "mind", ranged: false },
      dodgeBonus: 0, dr: 0, ai: "caster", spells: ["firebolt", "snow", "burninghands"], slotsMax: 2,
      abilities: [], xp: 90, desc: "Alan büyüleri kullanır."
    },
    spider: {
      name: "Örümcek", cls: "Spider", sprite: "spider", hpMax: 10, speed: 6, level: 1,
      stats: { might: 0, agility: 3, will: 0, mind: 0, influence: 0 },
      attack: { name: "Isırık", range: 1, dmg: "1d4", stat: "agility", ranged: false },
      dodgeBonus: 1, dr: 0, ai: "skirmisher", spells: [], slotsMax: 0,
      abilities: ["poison"], xp: 45, desc: "Zehirli ısırığı vardır."
    },
    giant_spider: {
      name: "Dev Örümcek", cls: "Spider", sprite: "giant_spider", hpMax: 22, speed: 6, level: 2,
      stats: { might: 2, agility: 3, will: 0, mind: 0, influence: 0 },
      attack: { name: "Isırık", range: 1, dmg: "1d8", stat: "agility", ranged: false },
      dodgeBonus: 1, dr: 0, ai: "skirmisher", spells: [], slotsMax: 0,
      abilities: ["poison", "webShot"], xp: 130, desc: "Ağ atar, zehirler."
    },
    skeleton: {
      name: "İskelet", cls: "Undead", sprite: "skeleton", hpMax: 10, speed: 5, level: 1,
      stats: { might: 1, agility: 1, will: 0, mind: 0, influence: 0 },
      attack: { name: "Kılıç", range: 1, dmg: "1d6", stat: "might", ranged: false },
      dodgeBonus: 0, dr: 0, ai: "melee", spells: [], slotsMax: 0,
      abilities: ["undead"], xp: 45, desc: "Kutsal hasara zayıf."
    },
    skeleton_archer: {
      name: "İskelet Okçu", cls: "Undead", sprite: "skeleton_archer", hpMax: 8, speed: 5, level: 1,
      stats: { might: 0, agility: 2, will: 0, mind: 0, influence: 0 },
      attack: { name: "Yay", range: 8, dmg: "1d6", stat: "agility", ranged: true },
      dodgeBonus: 0, dr: 0, ai: "ranged", spells: [], slotsMax: 0,
      abilities: ["undead"], xp: 50, desc: "Uzaktan vurur."
    },
    zombie: {
      name: "Zombi", cls: "Undead", sprite: "zombie", hpMax: 18, speed: 3, level: 1,
      stats: { might: 2, agility: 0, will: 0, mind: 0, influence: 0 },
      attack: { name: "Pençe", range: 1, dmg: "1d8", stat: "might", ranged: false },
      dodgeBonus: -1, dr: 0, ai: "brute", spells: [], slotsMax: 0,
      abilities: ["undead"], xp: 60, desc: "Yavaş ama dayanıklı."
    },
    ghoul: {
      name: "Gul", cls: "Undead", sprite: "ghoul", hpMax: 14, speed: 6, level: 2,
      stats: { might: 1, agility: 2, will: 0, mind: 0, influence: 0 },
      attack: { name: "Pençe", range: 1, dmg: "1d6", stat: "agility", ranged: false },
      dodgeBonus: 0, dr: 0, ai: "melee", spells: [], slotsMax: 0,
      abilities: ["undead", "poison"], xp: 75, desc: "Zehirli pençeleri var."
    },
    cultist: {
      name: "Tarikatçı", cls: "Cultist", sprite: "cultist", hpMax: 11, speed: 6, level: 1,
      stats: { might: 1, agility: 1, will: 1, mind: 1, influence: 0 },
      attack: { name: "Hançer", range: 1, dmg: "1d4", stat: "might", ranged: false },
      dodgeBonus: 0, dr: 0, ai: "melee", spells: [], slotsMax: 0,
      abilities: [], xp: 40, desc: "Sıradan yandaş."
    },
    cultist_priest: {
      name: "Tarikat Rahibi", cls: "Cultist", sprite: "cultist_priest", hpMax: 16, speed: 6, level: 2,
      stats: { might: 0, agility: 1, will: 3, mind: 1, influence: 0 },
      attack: { name: "Asa", range: 1, dmg: "1d4", stat: "will", ranged: false },
      dodgeBonus: 0, dr: 0, ai: "healer", spells: ["healingword", "sacredflame", "bane"], slotsMax: 2,
      abilities: [], xp: 95, desc: "Yandaşlarını iyileştirir."
    },
    bog_troll: {
      name: "Bataklık Trolü", cls: "Troll", sprite: "bog_troll", hpMax: 34, speed: 5, level: 3,
      stats: { might: 3, agility: 0, will: 0, mind: 0, influence: 0 },
      attack: { name: "Yumruk", range: 1, dmg: "1d10", stat: "might", ranged: false },
      dodgeBonus: -1, dr: 0.1, ai: "brute", spells: [], slotsMax: 0,
      abilities: ["regenerate"], xp: 180, desc: "Kendini yeniler."
    },
    slime: {
      name: "Balçık", cls: "Ooze", sprite: "slime", hpMax: 16, speed: 3, level: 1,
      stats: { might: 1, agility: -1, will: 0, mind: 0, influence: 0 },
      attack: { name: "Sıçrama", range: 1, dmg: "1d6", stat: "might", ranged: false },
      dodgeBonus: -1, dr: 0, ai: "melee", spells: [], slotsMax: 0,
      abilities: [], xp: 40, desc: "Yavaş ama ısrarcı."
    },
    fire_imp: {
      name: "Ateş İblisi", cls: "Imp", sprite: "fire_imp", hpMax: 9, speed: 7, level: 2,
      stats: { might: 0, agility: 2, will: 0, mind: 2, influence: 0 },
      attack: { name: "Alev", range: 6, dmg: "1d6", stat: "mind", ranged: true },
      dodgeBonus: 1, dr: 0, ai: "caster", spells: ["firebolt", "burninghands"], slotsMax: 2,
      abilities: ["fly", "explode"], xp: 85, desc: "Uçar, ölünce patlar."
    },
    wraith: {
      name: "Hayalet", cls: "Undead", sprite: "wraith", hpMax: 20, speed: 6, level: 3,
      stats: { might: 0, agility: 2, will: 2, mind: 2, influence: 0 },
      attack: { name: "Soğuk Dokunuş", range: 1, dmg: "1d8", stat: "will", ranged: false },
      dodgeBonus: 2, dr: 0, ai: "melee", spells: [], slotsMax: 0,
      abilities: ["undead", "phase", "fly"], xp: 150, desc: "Saldırıları bazen boşa çıkar."
    },
    orc_brute: {
      name: "Ork Vahşisi", cls: "Orc", sprite: "orc_brute", hpMax: 28, speed: 5, level: 2,
      stats: { might: 3, agility: 0, will: 0, mind: 0, influence: 0 },
      attack: { name: "Balyoz", range: 1, dmg: "1d10", stat: "might", ranged: false },
      dodgeBonus: 0, dr: 0.1, ai: "brute", spells: [], slotsMax: 0,
      abilities: ["enrage"], xp: 140, desc: "Yaralandıkça öfkelenir."
    },
    knight_fallen: {
      name: "Düşmüş Şövalye", cls: "Undead", sprite: "knight_fallen", hpMax: 30, speed: 5, level: 3,
      stats: { might: 3, agility: 1, will: 1, mind: 0, influence: 0 },
      attack: { name: "Uzun Kılıç", range: 1, dmg: "1d10", stat: "might", ranged: false },
      dodgeBonus: 0, dr: 0.15, ai: "melee", spells: [], slotsMax: 0,
      abilities: ["undead", "shieldWall"], xp: 170, desc: "Ağır zırhlı, dostlarını korur."
    },
    lich: {
      name: "Lich", cls: "Boss", sprite: "lich", hpMax: 60, speed: 6, level: 6,
      stats: { might: 0, agility: 1, will: 2, mind: 4, influence: 1 },
      attack: { name: "Nekrotik Dokunuş", range: 1, dmg: "1d10", stat: "mind", ranged: false },
      dodgeBonus: 1, dr: 0.1, ai: "boss", spells: ["chromatic", "sleep", "iceknife", "grease"], slotsMax: 4,
      abilities: ["undead", "summon:skeleton"], xp: 500, desc: "Kampanyanın son patronu."
    }
  };
}

if (typeof ITEM_DEFS === "undefined") {
  var DEV_ITEM_DEFS = {
    potion_heal: { name: "İyileşme İksiri", type: "consumable", price: 25, effect: { heal: "2d4+2" }, ap: 1, desc: "2d4+2 can iyileştirir." },
    potion_greater: { name: "Büyük İyileşme İksiri", type: "consumable", price: 60, effect: { heal: "4d4+4" }, ap: 1, desc: "4d4+4 can iyileştirir." },
    scroll_recall: { name: "Slot Parşömeni", type: "consumable", price: 40, effect: { restoreSlot: 1 }, ap: 1, desc: "1 büyü slotu geri kazandırır." },
    bomb_fire: { name: "Ateş Bombası", type: "consumable", price: 35, effect: { damage: { dmg: "2d6", area: 1, element: "ateş", range: 6 } }, ap: 1, desc: "Alana ateş hasarı verir." },
    sword_plus1: { name: "+1 Uzun Kılıç", type: "weapon", price: 80, effect: { weapon: "longsword", bonus: 1 }, desc: "İsabet ve hasara +1." },
    bow_plus1: { name: "+1 Uzun Yay", type: "weapon", price: 80, effect: { weapon: "longbow", bonus: 1 }, desc: "İsabet ve hasara +1." },
    armor_chain_plus1: { name: "+1 Zincir Zırh", type: "armor", price: 70, effect: { armor: "chain", bonus: 1 }, desc: "Kaçınmaya +1." },
    ring_might: { name: "Güç Yüzüğü", type: "trinket", price: 90, effect: { mods: { might: 1 } }, desc: "Might +1." },
    amulet_ward: { name: "Koruma Tılsımı", type: "trinket", price: 90, effect: { mods: { dodge: 1, hpMax: 3 } }, desc: "Kaçınma +1, Can +3." },
    boots_speed: { name: "Hız Çizmeleri", type: "trinket", price: 75, effect: { mods: { speed: 1 } }, desc: "Hız +1." }
  };
  var DEV_SHOP_STOCK = {
    ch1: ["potion_heal", "scroll_recall", "bomb_fire", "ring_might"],
    ch2: ["potion_heal", "potion_greater", "sword_plus1", "armor_chain_plus1", "boots_speed", "amulet_ward"]
  };
}

if (typeof XP_TABLE === "undefined") {
  var DEV_MAX_LEVEL = 6;
  var DEV_XP_TABLE = [0, 0, 300, 700, 1300, 2100, 3200];
  var DEV_LEVEL_UPS = {
    Fighter: { hpDie: 10, perLevel: { 2: { features: ["actionSurge"] }, 3: { statPoints: 1 }, 4: { features: ["extraAttack"] }, 5: { statPoints: 1 }, 6: { features: ["indomitable"] } } },
    Cleric: { hpDie: 8, perLevel: { 2: { slots: 1, features: ["turnUndead"] }, 3: { statPoints: 1, features: ["divineStrike"] }, 4: { slots: 1, learnSpells: { cantrips: 1, leveled: 1 } }, 5: { statPoints: 1 }, 6: { features: ["preserveLife"] } } },
    Wizard: { hpDie: 6, perLevel: { 2: { slots: 1, features: ["arcaneRecovery"] }, 3: { statPoints: 1, learnSpells: { cantrips: 1, leveled: 1 } }, 4: { slots: 1, features: ["empoweredEvocation"] }, 5: { statPoints: 1 }, 6: { features: ["spellSurge"] } } }
  };
}

if (typeof CAMPAIGN === "undefined") {
  var DEV_CAMPAIGN = {
    title: "Kurt Diyarının Gölgesi",
    intro: [
      { speaker: "Anlatıcı", portrait: "narrator", text: "Kuzey ormanlarında kurt sürüleri köyleri basmaya başladı. Küçük bir ekip yola çıktı." },
      { speaker: "Anlatıcı", portrait: "narrator", text: "{fighter}, {cleric} ve {wizard} — üçü de tehlikenin kaynağını bulmaya kararlı." }
    ],
    chapters: [
      {
        id: "ch1", title: "Bölüm 1 — Kurt Ormanı", biome: "forest",
        nodes: [
          { id: "s0", type: "story", pages: [
              { speaker: "{fighter}", portrait: "fighter", text: "Orman sessiz... fazla sessiz." },
              { speaker: "{cleric}", portrait: "cleric", text: "Dikkatli olalım. İz var." }
            ] },
          { id: "b1", type: "battle", title: "Pusu", biome: "forest",
            intro: [ { speaker: "Anlatıcı", portrait: "narrator", text: "Kurtlar pusudan çıktı!" } ],
            outro: [ { speaker: "{fighter}", portrait: "fighter", text: "Bu daha başlangıç..." } ],
            map: [
              "..T..%....,....",
              ".T.T......,.....",
              "P...#.....,.T...",
              ".P..#..~~.,.....",
              "P...%..~~......",
              ".....%.........",
              "..T.......T....."
            ],
            enemies: [ { type: "wolf", q: 11, r: 2, name: "Kurt A" }, { type: "wolf", q: 12, r: 4, name: "Kurt B" }, { type: "goblin", q: 13, r: 5, name: "Goblin" } ],
            objective: { type: "kill" },
            rewards: { gold: 40, items: ["potion_heal"] }, optional: false },
          { id: "c1", type: "camp", title: "Orman Kampı", text: "Ateşin başında bir mola.", shop: "ch1" },
          { id: "ch1choice", type: "choice", text: "Yol ikiye ayrılıyor.", options: [
              { label: "Kısa yol — mağara", goto: "b2a" },
              { label: "Güvenli yol — köy", goto: "b2b" }
            ] },
          { id: "b2a", type: "battle", title: "Mağara Pusuşu", biome: "cave", next: "b3",
            map: [ "....,....^....", ".T..,....^.T..", "P...,........", ".P..,....%...", "P...#........", "...........#." ],
            enemies: [ { type: "spider", q: 10, r: 1, name: "Örümcek A" }, { type: "spider", q: 11, r: 3, name: "Örümcek B" }, { type: "giant_spider", q: 12, r: 2, name: "Dev Örümcek" } ],
            objective: { type: "kill" }, rewards: { gold: 30, items: [] } },
          { id: "b2b", type: "battle", title: "Köy Baskını", biome: "village", next: "b3",
            map: [ "....,,....T...", ".T..,,........", "P.........T...", ".P..,,........", "P...,,........" ],
            enemies: [ { type: "bandit", q: 10, r: 0, name: "Haydut A" }, { type: "bandit_archer", q: 11, r: 2, name: "Haydut Okçu" } ],
            objective: { type: "kill" }, rewards: { gold: 35, items: ["potion_heal"] } },
          { id: "b3", type: "battle", title: "Sürü Lideri", biome: "forest",
            intro: [ { speaker: "Anlatıcı", portrait: "narrator", text: "Alfa kurt sürüsüyle karşınızda!" } ],
            map: [ "..T..%....,T...", ".T.T......,....", "P...#.....,.T..", ".P..#..~~.,....", "P...%..~~......", "....T..........", "..T.......T...." ],
            enemies: [ { type: "direwolf_alpha", q: 12, r: 2, name: "Alfa Kurt" }, { type: "wolf", q: 11, r: 4, name: "Kurt C" }, { type: "wolf", q: 13, r: 5, name: "Kurt D" } ],
            reinforcements: [ { round: 3, enemies: [ { type: "wolf", q: 12, r: 6 } ] } ],
            objective: { type: "boss", target: "Alfa Kurt" },
            rewards: { gold: 60, items: ["sword_plus1"] } }
        ]
      },
      {
        id: "ch2", title: "Bölüm 2 — Unutulmuş Kript", biome: "crypt",
        nodes: [
          { id: "s2", type: "story", pages: [ { speaker: "{wizard}", portrait: "wizard", text: "Kurtları bir şey yönetiyor. İz kripte kayboluyor." } ] },
          { id: "c2", type: "camp", title: "Kript Girişi", text: "Son hazırlıklar.", shop: "ch2" },
          { id: "b4", type: "battle", title: "Kript Muhafızları", biome: "crypt",
            map: [ "....#....^....", ".#..#....^....", "P........#....", ".P.......#....", "P.............", "....#.........." ],
            enemies: [ { type: "skeleton", q: 10, r: 0, name: "İskelet A" }, { type: "skeleton_archer", q: 11, r: 2, name: "İskelet Okçu" }, { type: "zombie", q: 12, r: 4, name: "Zombi" } ],
            objective: { type: "kill" }, rewards: { gold: 50, items: ["potion_greater"] } },
          { id: "b5", type: "battle", title: "Lich'in Odası", biome: "crypt",
            intro: [ { speaker: "Lich", portrait: "lich", text: "Ölüm size de gelecek, ölümlüler." } ],
            map: [ ".....+.......", ".#.........#.", "P............", ".P...........", "P............", ".......#....." ],
            enemies: [ { type: "lich", q: 10, r: 2, name: "Lich" } ],
            objective: { type: "boss", target: "Lich" },
            rewards: { gold: 150, items: ["amulet_ward"] } }
        ]
      }
    ],
    ending: [
      { speaker: "Anlatıcı", portrait: "narrator", text: "Lich düştü, kurtların laneti çözüldü. Ekip zaferle köye döndü." }
    ]
  };
}
