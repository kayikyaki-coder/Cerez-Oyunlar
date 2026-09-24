// enemies.js — Tasarımcı: tüm düşman tanımları (ENEMY_DEFS)
// Sadece CONTRACT.md §5'te izin verilen sprite id'leri, §4.2'deki ability id'leri kullanılır.
// Sayılar 4.3 kural sistemine göre dengelendi (isabet d20+stat vs min(Nxd20)+agility+dodge).

const ENEMY_DEFS = {
  // ---------- BÖLÜM 1: ORMAN (seviye 1-2) ----------
  wolf: {
    name: "Kurt", cls: "Kır Kurdu", sprite: "wolf",
    hpMax: 9, speed: 7, level: 1,
    stats: { might: 1, agility: 3, will: 0, mind: 0, influence: 0 },
    attack: { name: "Isırık", range: 1, dmg: "1d6", stat: "agility", ranged: false },
    dodgeBonus: 0, dr: 0,
    ai: "melee", spells: [], slotsMax: 0,
    abilities: ["packTactics"],
    xp: 50,
    desc: "Sürü halinde avlanır; yalnız yakalanan avı bırakmaz."
  },
  // b1'e ÖZEL: aynı sprite, packTactics YOK — "ilk savaş" ekibi için daha yumuşak açılış
  // (TEST_REPORT.md §6 sim turu: b1 %74.5 idi, hedef %86-92; henüz eşyasız/statPoints'siz
  // Sv1 ekip için packTactics'in +2 isabet sinerjisi çok sert kalıyordu).
  wolf_young: {
    name: "Kurt", cls: "Genç Kır Kurdu", sprite: "wolf",
    hpMax: 9, speed: 7, level: 1,
    stats: { might: 1, agility: 3, will: 0, mind: 0, influence: 0 },
    attack: { name: "Isırık", range: 1, dmg: "1d6", stat: "agility", ranged: false },
    dodgeBonus: 0, dr: 0,
    ai: "melee", spells: [], slotsMax: 0,
    abilities: [],
    xp: 45,
    desc: "Henüz sürü taktiği öğrenmemiş genç bir kurt; tek başına saldırır."
  },
  direwolf_alpha: {
    name: "Kurt Reisi", cls: "Alfa Kurt", sprite: "direwolf_alpha",
    hpMax: 36, speed: 7, level: 2,
    stats: { might: 3, agility: 4, will: 1, mind: 0, influence: 0 },
    attack: { name: "Parçalayan Isırık", range: 1, dmg: "2d6", stat: "agility", ranged: false },
    dodgeBonus: 1, dr: 0,
    ai: "boss", spells: [], slotsMax: 0,
    abilities: ["packTactics", "howl", "frenzy"],
    xp: 250,
    desc: "Ormanın efendisi. Ulumasıyla sürüsünü çılgına çevirir."
  },
  bandit: {
    name: "Haydut", cls: "Yol Kesici", sprite: "bandit",
    hpMax: 11, speed: 6, level: 1,
    stats: { might: 2, agility: 2, will: 0, mind: 0, influence: 0 },
    attack: { name: "Kısa Kılıç", range: 1, dmg: "1d6", stat: "might", ranged: false },
    dodgeBonus: 0, dr: 0,
    ai: "melee", spells: [], slotsMax: 0,
    abilities: [],
    xp: 50,
    desc: "Orman yolunu kesen paralı bir serseri."
  },
  bandit_archer: {
    name: "Haydut Okçu", cls: "Pusucu", sprite: "bandit_archer",
    hpMax: 10, speed: 6, level: 1,
    stats: { might: 1, agility: 3, will: 0, mind: 0, influence: 0 },
    attack: { name: "Kısa Yay", range: 8, dmg: "1d6", stat: "agility", ranged: true },
    dodgeBonus: 0, dr: 0,
    ai: "ranged", spells: [], slotsMax: 0,
    abilities: [],
    xp: 55,
    desc: "Ağaçların arasından ok yağdırır, mesafeyi korur."
  },
  bandit_chief: {
    name: "Haydut Reisi", cls: "Çete Başı", sprite: "bandit_chief",
    hpMax: 32, speed: 6, level: 2,
    stats: { might: 3, agility: 2, will: 1, mind: 0, influence: 0 },
    attack: { name: "Savaş Baltası", range: 1, dmg: "1d8", stat: "might", ranged: false },
    dodgeBonus: 0, dr: 0.1,
    ai: "brute", spells: [], slotsMax: 0,
    abilities: ["cleave", "frenzy"],
    xp: 160,
    desc: "Ormanın gizli kampını yöneten acımasız çete başı."
  },

  // ---------- BÖLÜM 2: BATAKLIK / MAĞARA (seviye 2-3) ----------
  slime: {
    name: "Balçık", cls: "Asit Balçığı", sprite: "slime",
    hpMax: 13, speed: 4, level: 1,
    stats: { might: 2, agility: 0, will: 0, mind: 0, influence: 0 },
    attack: { name: "Sıçratma", range: 1, dmg: "1d6", stat: "might", ranged: false },
    dodgeBonus: -1, dr: 0,
    ai: "melee", spells: [], slotsMax: 0,
    abilities: ["explode"],
    xp: 37,
    desc: "Yavaş ama ölünce etrafa asit saçar."
  },
  goblin: {
    name: "Goblin", cls: "Bataklık Goblini", sprite: "goblin",
    hpMax: 19, speed: 6, level: 1,
    stats: { might: 1, agility: 2, will: 0, mind: 0, influence: 0 },
    attack: { name: "Kısa Mızrak", range: 1, dmg: "1d6", stat: "might", ranged: false },
    dodgeBonus: 1, dr: 0,
    ai: "skirmisher", spells: [], slotsMax: 0,
    abilities: [],
    xp: 58,
    desc: "Küçük, çevik, en zayıf hedefe dalar."
  },
  goblin_shaman: {
    name: "Goblin Şamanı", cls: "Bataklık Büyücüsü", sprite: "goblin_shaman",
    hpMax: 19, speed: 6, level: 2,
    stats: { might: 0, agility: 1, will: 1, mind: 3, influence: 0 },
    attack: { name: "Çamur Patlaması", range: 12, dmg: "1d10", stat: "mind", ranged: true, isSpell: true },
    dodgeBonus: 0, dr: 0,
    ai: "caster", spells: ["firebolt", "minorcurse"], slotsMax: 0,
    abilities: [],
    xp: 100,
    desc: "Kabilesine uzaktan büyüyle destek olur."
  },
  spider: {
    name: "Örümcek", cls: "Mağara Örümceği", sprite: "spider",
    hpMax: 9, speed: 7, level: 1,
    stats: { might: 0, agility: 3, will: 0, mind: 0, influence: 0 },
    attack: { name: "Zehirli Isırık", range: 1, dmg: "1d4", stat: "agility", ranged: false },
    dodgeBonus: 1, dr: 0,
    ai: "skirmisher", spells: [], slotsMax: 0,
    abilities: ["poison"],
    xp: 47,
    desc: "Tavandan sarkar, karanlıkta pusuya yatar."
  },
  giant_spider: {
    name: "Dev Örümcek", cls: "Mağara Anası", sprite: "giant_spider",
    hpMax: 38, speed: 6, level: 3,
    stats: { might: 2, agility: 3, will: 0, mind: 0, influence: 0 },
    attack: { name: "Zehirli Çene", range: 1, dmg: "1d8", stat: "agility", ranged: false },
    dodgeBonus: 1, dr: 0,
    ai: "brute", spells: [], slotsMax: 0,
    abilities: ["poison", "webShot"],
    xp: 190,
    desc: "Mağaranın derinliklerindeki dev ana örümcek."
  },
  bog_troll: {
    name: "Bataklık Trolü", cls: "Troll", sprite: "bog_troll",
    hpMax: 52, speed: 6, level: 3,
    stats: { might: 4, agility: 0, will: 1, mind: 0, influence: 0 },
    attack: { name: "Pençe Darbesi", range: 1, dmg: "2d6", stat: "might", ranged: false },
    dodgeBonus: -1, dr: 0.1,
    ai: "boss", spells: [], slotsMax: 0,
    abilities: ["regenerate", "frenzy"],
    xp: 340,
    desc: "Bataklığın en derin çukurunda yaşayan devasa troll; yaraları kapanır."
  },
  ghoul: {
    name: "Gulyabani", cls: "Leş Yiyici", sprite: "ghoul",
    hpMax: 17, speed: 7, level: 2,
    stats: { might: 2, agility: 3, will: 0, mind: 0, influence: 0 },
    attack: { name: "Pençeler", range: 1, dmg: "1d8", stat: "agility", ranged: false },
    dodgeBonus: 1, dr: 0,
    ai: "skirmisher", spells: [], slotsMax: 0,
    abilities: ["undead", "poison"],
    xp: 78,
    desc: "Mağara girişlerinde leş kokan bir yaratık; çürük pençeleri zehirlidir."
  },

  // ---------- BÖLÜM 3: HARABE / KRİPTA (seviye 3-4) ----------
  cultist: {
    name: "Kültist", cls: "Kara Rahip Uşağı", sprite: "cultist",
    hpMax: 26, speed: 6, level: 2,
    stats: { might: 2, agility: 1, will: 1, mind: 1, influence: 0 },
    attack: { name: "Töreni Kaması", range: 1, dmg: "1d10", stat: "might", ranged: false },
    dodgeBonus: 0, dr: 0,
    ai: "melee", spells: [], slotsMax: 0,
    abilities: [],
    xp: 105,
    desc: "Harabelerde yasak törenler yapan bir tarikat üyesi."
  },
  cultist_priest: {
    name: "Kültist Rahibi", cls: "Kara Rahip", sprite: "cultist_priest",
    hpMax: 34, speed: 6, level: 3,
    stats: { might: 1, agility: 1, will: 3, mind: 1, influence: 0 },
    attack: { name: "Nekrotik Dokunuş", range: 6, dmg: "2d6", stat: "will", ranged: true, isSpell: true },
    dodgeBonus: 0, dr: 0,
    ai: "healer", spells: ["wordpain", "healingword"], slotsMax: 0,
    abilities: [],
    xp: 170,
    desc: "Yaralı kardeşlerini kara büyüyle iyileştirir."
  },
  skeleton: {
    name: "İskelet", cls: "Mezar Muhafızı", sprite: "skeleton",
    hpMax: 22, speed: 6, level: 2,
    stats: { might: 2, agility: 1, will: 0, mind: 0, influence: 0 },
    attack: { name: "Pas Tutmuş Kılıç", range: 1, dmg: "1d8", stat: "might", ranged: false },
    dodgeBonus: 0, dr: 0,
    ai: "melee", spells: [], slotsMax: 0,
    abilities: ["undead"],
    xp: 95,
    desc: "Kriptayı bekleyen kadim bir iskelet asker."
  },
  skeleton_archer: {
    name: "İskelet Okçu", cls: "Mezar Nişancısı", sprite: "skeleton_archer",
    hpMax: 17, speed: 6, level: 2,
    stats: { might: 0, agility: 3, will: 0, mind: 0, influence: 0 },
    attack: { name: "Çürük Yay", range: 10, dmg: "1d8", stat: "agility", ranged: true },
    dodgeBonus: 0, dr: 0,
    ai: "ranged", spells: [], slotsMax: 0,
    abilities: ["undead"],
    xp: 95,
    desc: "Koridorların gerisinden ok yağdırır."
  },
  zombie: {
    name: "Zombi", cls: "Çürümüş Ceset", sprite: "zombie",
    hpMax: 26, speed: 3, level: 2,
    stats: { might: 3, agility: -1, will: 0, mind: 0, influence: 0 },
    attack: { name: "Çürük Yumruk", range: 1, dmg: "1d8", stat: "might", ranged: false },
    dodgeBonus: -1, dr: 0,
    ai: "brute", spells: [], slotsMax: 0,
    abilities: ["undead"],
    xp: 72,
    desc: "Ağır ve yavaş ama darbeleri can yakıcı."
  },
  knight_fallen: {
    name: "Düşmüş Şövalye", cls: "Lanetli Şövalye", sprite: "knight_fallen",
    hpMax: 116, speed: 6, level: 4,
    stats: { might: 4, agility: 1, will: 2, mind: 0, influence: 0 },
    attack: { name: "Kara Kılıç", range: 1, dmg: "2d8", stat: "might", ranged: false },
    dodgeBonus: 0, dr: 0.15,
    ai: "boss", spells: [], slotsMax: 0,
    abilities: ["undead", "shieldWall", "frenzy", "cleave", "enrage"],
    xp: 540,
    desc: "Bir zamanlar bu diyarı koruyan şövalye; şimdi kriptasının lanetli bekçisi."
  },

  // ---------- BÖLÜM 4: KALE / FİNAL (seviye 4-6) ----------
  orc_brute: {
    name: "Ork Azgını", cls: "Kale Muhafızı", sprite: "orc_brute",
    hpMax: 30, speed: 6, level: 4,
    stats: { might: 4, agility: 1, will: 0, mind: 0, influence: 0 },
    attack: { name: "Savaş Baltası", range: 1, dmg: "3d6", stat: "might", ranged: false },
    dodgeBonus: 0, dr: 0.1,
    ai: "brute", spells: [], slotsMax: 0,
    abilities: ["enrage"],
    xp: 150,
    desc: "Kale kapısını koruyan iri yarı bir ork."
  },
  fire_imp: {
    name: "Ateş İmp'i", cls: "Cehennem Uşağı", sprite: "fire_imp",
    hpMax: 48, speed: 7, level: 4,
    stats: { might: 0, agility: 2, will: 0, mind: 3, influence: 0 },
    attack: { name: "Alev Topu", range: 12, dmg: "1d10", stat: "mind", ranged: true, isSpell: true },
    dodgeBonus: 1, dr: 0,
    ai: "caster", spells: ["firebolt", "blast"], slotsMax: 0,
    abilities: ["fly"],
    xp: 210,
    desc: "Uçarak dolaşır, yukarıdan alev yağdırır."
  },
  wraith: {
    name: "Hayalet", cls: "Kara Ruh", sprite: "wraith",
    hpMax: 62, speed: 7, level: 5,
    stats: { might: 0, agility: 3, will: 1, mind: 3, influence: 0 },
    attack: { name: "Ruh Dokunuşu", range: 1, dmg: "2d6", stat: "mind", ranged: false, isSpell: true },
    dodgeBonus: 2, dr: 0,
    ai: "skirmisher", spells: [], slotsMax: 0,
    abilities: ["undead", "phase"],
    xp: 290,
    desc: "Duvarlardan süzülür, en zayıf hedefe saldırır."
  },
  lich: {
    name: "Lich", cls: "Kara Büyücü Kral", sprite: "lich",
    hpMax: 95, speed: 6, level: 6,
    stats: { might: 1, agility: 1, will: 3, mind: 5, influence: 1 },
    attack: { name: "Ölüm Dokunuşu", range: 6, dmg: "1d10", stat: "mind", ranged: true, isSpell: true },
    dodgeBonus: 1, dr: 0.15,
    ai: "boss", spells: ["chromatic", "inflict", "bane", "sleep"], slotsMax: 3,
    abilities: ["undead", "summon:skeleton"],
    xp: 580,
    desc: "Kalenin en tepesinde, yüzyıllardır ölümü bekleyen kara büyücü kral."
  }
};
