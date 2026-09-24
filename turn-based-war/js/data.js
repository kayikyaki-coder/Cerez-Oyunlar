// data.js — arena config, engeller, sınıf tanımları ve birim üretimi
// Tüm sayılar PLACEHOLDER'dır; denge testlerle ayarlanacak.

const CONFIG = { cols: 18, rows: 9, size: 24, margin: 10 };

// Engeller (etrafından dolanılır) — [q, r]
// Dağınık siperler: duvar oluşturmaz, kurtların yolunu tıkamaz ama etrafından dolanılır.
const BLOCKED = [
  [10, 1], [7, 3], [11, 3],
  [9, 5], [13, 5], [7, 7], [11, 7]
];

// Sınıf tanımları (yaratma ekranı bunları kullanır)
const CLASS_DEFS = {
  Fighter: {
    sprite: "fighter", hpBase: 10, hpDie: "d10", suggest: "might",
    attack: { name: "Uzun Kılıç", range: 1, dmg: "1d8", stat: "might", ranged: false },
    canHeal: false, blurb: "Dayanıklı, yakın dövüş. Might önemli."
  },
  Cleric: {
    sprite: "cleric", hpBase: 8, hpDie: "d8", suggest: "will", spellStat: "will",
    attack: { name: "Topuz", range: 1, dmg: "1d6", stat: "might", ranged: false },
    canHeal: true, heal: { name: "Healing Word", range: 12, dmg: "2d4" },
    blurb: "Destek + iyileştirme. Will/Might önemli."
  },
  Wizard: {
    sprite: "wizard", hpBase: 6, hpDie: "d6", suggest: "mind", spellStat: "mind",
    // Firebolt bir büyü: isabette Mind bonusu var, hasarda YOK (isSpell)
    attack: { name: "Firebolt", range: 12, dmg: "1d8", stat: "mind", ranged: true, isSpell: true },
    canHeal: false, blurb: "Menzilli hasar, düşük can. Mind önemli."
  }
};

// ---------- SİLAHLAR (başlangıçta en fazla Longsword) ----------
// stat: sabit bonus statı · finesse: true ise max(Might,Agility) · hands: 2 ise kalkan takılmaz
const WEAPONS = {
  dagger:     { name: "Hançer",     dmg: "1d4",  hands: 1, cat: "simple",  stat: "might",   finesse: true,  range: 1,  ranged: false },
  club:       { name: "Topuz",      dmg: "1d6",  hands: 1, cat: "simple",  stat: "might",   finesse: false, range: 1,  ranged: false },
  greatclub:  { name: "Balyoz",     dmg: "1d8",  hands: 2, cat: "simple",  stat: "might",   finesse: false, range: 1,  ranged: false },
  spear:      { name: "Mızrak",     dmg: "1d6",  hands: 1, cat: "simple",  stat: "might",   finesse: false, range: 1,  ranged: false, versatile: { one: "1d6", two: "1d8" } },
  shortbow:   { name: "Kısa Yay",   dmg: "1d6",  hands: 2, cat: "simple",  stat: "agility", finesse: false, range: 12, ranged: true },
  shortsword: { name: "Kısa Kılıç", dmg: "1d6",  hands: 1, cat: "martial", stat: "might",   finesse: true,  range: 1,  ranged: false },
  // Longsword: Finesse (Might/Agility yükseği, eşitse Might) + versatile (kalkansız çift elli → 1d10)
  longsword:  { name: "Uzun Kılıç", dmg: "1d8",  hands: 1, cat: "martial", stat: "might",   finesse: true,  range: 1,  ranged: false, versatile: { one: "1d8", two: "1d10" } },
  longbow:    { name: "Uzun Yay",   dmg: "1d8",  hands: 2, cat: "martial", stat: "agility", finesse: false, range: 18, ranged: true }
};

// ---------- ZIRHLAR ----------
const ARMORS = {
  none:    { name: "Zırhsız",       dodge: 0,  dr: 0,    tier: "none" },
  leather: { name: "Deri (Hafif)",  dodge: 1,  dr: 0,    tier: "light" },
  chain:   { name: "Zincir (Orta)", dodge: 0,  dr: 0.15, tier: "medium" },
  plate:   { name: "Plaka (Ağır)",  dodge: -1, dr: 0.25, tier: "heavy" }
};

// ---------- BÜYÜLER ("Büyü" butonuyla kullanılır; silahtan AYRI bir sistem) ----------
// resolve: attack (isabet zarı) | save (rakip d20+stat vs DC) | auto (otomatik) | heal | buff | debuff
// Büyü hasarında skill bonusu YOK; isabet zarında caster'ın büyü statı (Wizard Mind / Cleric Will) var.
const SPELLBOOK = {
  // -- Cantrip'ler (level 0, slot harcamaz) --
  firebolt:    { name: "Firebolt",       level: 0, ap: 2, range: 12, target: "enemy", resolve: "attack", dmg: "1d8",  element: "ateş" },
  shock:       { name: "Electric Shock", level: 0, ap: 2, range: 1,  target: "enemy", resolve: "attack", dmg: "1d8",  element: "şimşek" },
  necro:       { name: "Necro Touch",    level: 0, ap: 2, range: 1,  target: "enemy", resolve: "attack", dmg: "1d10", element: "nekrotik" },
  acid:        { name: "Acid Splash",    level: 0, ap: 2, range: 12, target: "enemy", resolve: "attack", dmg: "1d6",  element: "asit" },
  blast:       { name: "Spell Blast",    level: 0, ap: 2, range: 18, target: "enemy", resolve: "attack", dmg: "1d4",  element: "element" },
  snow:        { name: "Snow",           level: 0, ap: 2, range: 12, target: "enemy", resolve: "save",   saveStat: "agility", half: true,  dmg: "1d4", element: "soğuk", area: 1, status: { name: "Yavaş", speedBonus: -1, turns: 1 } },
  soundshock:  { name: "Soundshock",     level: 0, ap: 2, range: 6,  target: "enemy", resolve: "save",   saveStat: "might",   half: false, dmg: "1d6", element: "ses", area: 1, push: 1 },
  speed:       { name: "Speed",          level: 0, ap: 1, range: 6,  target: "ally",  resolve: "buff",   status: { name: "Speed", speedBonus: 2, turns: 1 } },
  sacredflame: { name: "Sacred Flame",   level: 0, ap: 2, range: 6,  target: "enemy", resolve: "save",   saveStat: "agility", half: false, dmg: "1d8", element: "kutsal" },
  wordpain:    { name: "Word of Pain",   level: 0, ap: 2, range: 6,  target: "enemy", resolve: "attack", dmg: "1d8",  element: "nekrotik" },
  guide:       { name: "Guide",          level: 0, ap: 1, range: 6,  target: "ally",  resolve: "buff",   status: { name: "Guide", atkDie: 4, oneRoll: true, turns: 2 } },
  resistance:  { name: "Resistance",     level: 0, ap: 1, range: 1,  target: "ally",  resolve: "buff",   status: { name: "Resistance", reduceDie: 4, oneHit: true, turns: 2 } },
  minorcurse:  { name: "Minor Curse",    level: 0, ap: 2, range: 6,  target: "enemy", resolve: "debuff", saveStat: "will", status: { name: "Minor Curse", penaltyDie: 4, oneRoll: true, turns: 2 } },
  // -- 1. seviye (slot harcar) --
  magicmissile:{ name: "Magic Missile",  level: 1, ap: 2, range: 12, target: "enemy", resolve: "auto",   missiles: { n: 3, die: 4 }, element: "force" },
  iceknife:    { name: "Ice Knife",      level: 1, ap: 2, range: 12, target: "enemy", resolve: "attack", dmg: "2d6",  element: "soğuk" },
  chromatic:   { name: "Chromatic Orb",  level: 1, ap: 2, range: 12, target: "enemy", resolve: "attack", dmg: "3d8",  element: "element" },
  burninghands:{ name: "Burning Hands",  level: 1, ap: 2, range: 3,  target: "enemy", resolve: "save",   saveStat: "agility", half: true, dmg: "3d6", element: "ateş", area: 1 },
  sleep:       { name: "Sleep",          level: 1, ap: 3, range: 12, target: "enemy", resolve: "save",   saveStat: "will",    half: false, area: 1, status: { name: "Uyku", incapacitated: true, turns: 2 } },
  charm:       { name: "Charm Person",   level: 1, ap: 2, range: 6,  target: "enemy", resolve: "debuff", saveStat: "will",    status: { name: "Charm", cantAttack: true, turns: 2 } },
  grease:      { name: "Grease",         level: 1, ap: 2, range: 12, target: "enemy", resolve: "save",   saveStat: "agility", half: false, area: 1, status: { name: "Prone", prone: true, dodge: -2, turns: 1 } },
  magearmor:   { name: "Mage Armor",     level: 1, ap: 2, range: 0,  target: "self",  resolve: "buff",   status: { name: "Mage Armor", dodge: 3, turns: 5 } },
  shield:      { name: "Shield",         level: 1, ap: 2, range: 0,  target: "self",  resolve: "buff",   status: { name: "Shield", dodge: 5, turns: 1 } },
  healingword: { name: "Healing Word",   level: 1, ap: 1, range: 12, target: "ally",  resolve: "heal",   dmg: "2d4" },
  healingtouch:{ name: "Healing Touch",  level: 1, ap: 2, range: 1,  target: "ally",  resolve: "heal",   dmg: "2d8" },
  bless:       { name: "Bless",          level: 1, ap: 2, range: 6,  target: "ally",  resolve: "buff",   status: { name: "Bless", atkDie: 4, turns: 3 } },
  inflict:     { name: "Inflict Wounds", level: 1, ap: 2, range: 1,  target: "enemy", resolve: "attack", dmg: "3d8",  element: "nekrotik" },
  guidingbolt: { name: "Guiding Bolt",   level: 1, ap: 2, range: 12, target: "enemy", resolve: "attack", dmg: "2d6",  element: "radyant", rider: "advantage" },
  bane:        { name: "Bane",           level: 1, ap: 2, range: 6,  target: "enemy", resolve: "debuff", saveStat: "will", status: { name: "Bane", penaltyDie: 4, turns: 3 } },
  shieldfaith: { name: "Shield of Faith",level: 1, ap: 2, range: 12, target: "ally",  resolve: "buff",   status: { name: "Shield of Faith", dodge: 1, turns: 7 } }
};

// Seçilebilir büyüler (yaratma ekranı için) ve varsayılan 1. seviye kitler
const SPELL_OPTIONS = {
  Wizard: { cantrips: ["firebolt", "snow", "speed", "necro", "acid", "blast", "soundshock", "shock"], leveled: ["magicmissile", "burninghands", "magearmor", "shield", "sleep", "iceknife", "charm", "grease", "chromatic"], slots: 2 },
  Cleric: { cantrips: ["sacredflame", "guide", "resistance", "necro", "shock", "minorcurse", "wordpain"], leveled: ["healingword", "healingtouch", "shield", "sleep", "bless", "inflict", "guidingbolt", "bane", "shieldfaith"], slots: 2 }
};
// Tüm büyüler motorda kayıtlı ve çalışır; henüz yaratma ekranında seçici yok, o yüzden
// karakterler sınıflarının BÜTÜN büyülerini biliyor (slot sınırı seviyeli kullanımı zaten kısıtlar).
const DEFAULT_SPELLS = {
  Wizard: SPELL_OPTIONS.Wizard.cantrips.concat(SPELL_OPTIONS.Wizard.leveled),
  Cleric: SPELL_OPTIONS.Cleric.cantrips.concat(SPELL_OPTIONS.Cleric.leveled)
};

// Silah saldırı seçenekleri (Büyü ayrı bir buton). Wizard/Cleric sadece Simple; Wizard tek elli (büyü için el boş).
const ATTACK_OPTIONS = {
  Fighter: ["longsword", "shortsword", "longbow", "spear", "shortbow", "greatclub", "club", "dagger"],
  Cleric:  ["club", "spear", "greatclub", "shortbow", "dagger"],
  Wizard:  ["dagger", "club"]
};
const ARMOR_OPTIONS = {
  Fighter: ["leather", "chain", "plate", "none"],
  Cleric:  ["leather", "none"],
  Wizard:  ["none"]
};

// Bir silah id'sinden savaş attack nesnesini üretir. Versatile silah: kalkan yoksa çift elli (büyük zar).
function makeAttack(cls, atkId, shield) {
  const w = WEAPONS[atkId] || WEAPONS.dagger;
  let dmg = w.dmg;
  if (w.versatile) dmg = shield ? w.versatile.one : w.versatile.two;
  return { name: w.name, dmg: dmg, range: w.range, ranged: w.ranged, stat: w.stat, finesse: !!w.finesse, isSpell: false, twoHanded: (w.versatile && !shield) };
}

// Seçilen saldırı kaç el kullanır (cantrip = 1 el kabul edilir → kalkan takılabilir)
function attackHands(atkId) {
  const w = WEAPONS[atkId];
  return w ? w.hands : 1;
}
function canUseShield(h) {
  if (h.cls === "Wizard") return false;
  return attackHands(h.atk) <= 1;
}

// Ekip başlangıç konumları (sol taraf)
const PARTY_POS = [{ q: 2, r: 4 }, { q: 1, r: 3 }, { q: 2, r: 6 }];

// Yaratma ekranından gelen ekip (null ise varsayılan kullanılır)
let CUSTOM_PARTY = null;

// heroes: [{name, cls, stats:{...}, atk, armor, shield}]
function buildParty(heroes) {
  return heroes.map((h, i) => {
    const def = CLASS_DEFS[h.cls];
    const pos = PARTY_POS[i] || { q: 1, r: 1 };
    const armor = ARMORS[h.armor] || ARMORS.none;
    const shield = !!h.shield && canUseShield(h);
    const u = {
      id: "hero" + i, name: (h.name || ("Kahraman " + (i + 1))).trim(),
      side: "party", cls: h.cls, sprite: def.sprite, level: 1,
      q: pos.q, r: pos.r, hpMax: def.hpBase + (h.stats.might || 0), speed: 6,
      stats: Object.assign({ might: 0, agility: 0, will: 0, mind: 0, influence: 0 }, h.stats),
      attack: makeAttack(h.cls, h.atk, shield),
      dodgeBonus: armor.dodge + (shield ? 2 : 0),
      dr: armor.dr,
      armorName: (armor.tier === "none" ? "Zırhsız" : armor.name) + (shield ? " + Kalkan" : "")
    };
    // Büyücü sınıfları: bilinen büyüler + 1. seviye slotları
    // Tasarımcı STARTING_SPELLS tanımladıysa (progression.js) başlangıç büyüleri oradan gelir —
    // böylece seviye atlamadaki learnSpells gerçekten yeni büyü öğretir (DEFAULT_SPELLS'te
    // karakter zaten sınıfının TÜM büyülerini biliyordu). Yoksa eski DEFAULT_SPELLS'e düşülür.
    const opt = SPELL_OPTIONS[h.cls];
    if (opt) {
      const startingPool = (typeof STARTING_SPELLS !== "undefined" && STARTING_SPELLS[h.cls]) ? STARTING_SPELLS[h.cls] : DEFAULT_SPELLS[h.cls];
      u.spells = (h.spells && h.spells.length ? h.spells.slice() : startingPool.slice());
      u.slotsMax = opt.slots;
    }
    // Fighter: Second Wind (kendini iyileştirme, savaş başına 2 kez)
    if (h.cls === "Fighter") u.secondWindMax = 2;
    return u;
  });
}

// Varsayılan ekip (yaratma yapılmazsa) — kullanıcı istediği başlangıç dağılımı
function defaultHeroes() {
  return [
    { name: "Kael", cls: "Fighter", stats: { might: 3, agility: 3, will: 1, mind: 0, influence: 0 }, atk: "longsword", armor: "leather", shield: true },
    { name: "Bran", cls: "Cleric",  stats: { might: 3, agility: 1, will: 3, mind: 0, influence: 0 }, atk: "club",      armor: "leather", shield: true },
    { name: "Lira", cls: "Wizard",  stats: { might: 1, agility: 3, will: 0, mind: 3, influence: 0 }, atk: "dagger",    armor: "none",    shield: false }
  ];
}

function makeWolves() {
  const base = { side: "wolf", cls: "Dire Wolf", sprite: "wolf", hpMax: 11, speed: 7,
    stats: { might: 1, agility: 3, will: 0, mind: 0, influence: 0 },
    attack: { name: "Isırık", range: 1, dmg: "1d6", stat: "agility", ranged: false }, canHeal: false };
  return [
    Object.assign({ id: "wolf1", name: "Kurt A", q: 15, r: 4 }, base, { stats: { ...base.stats }, attack: { ...base.attack } }),
    Object.assign({ id: "wolf2", name: "Kurt B", q: 14, r: 2 }, base, { stats: { ...base.stats }, attack: { ...base.attack } }),
    Object.assign({ id: "wolf3", name: "Kurt C", q: 14, r: 6 }, base, { stats: { ...base.stats }, attack: { ...base.attack } })
  ];
}

function makeUnits() {
  const party = CUSTOM_PARTY ? CUSTOM_PARTY : buildParty(defaultHeroes());
  return party.concat(makeWolves());
}
