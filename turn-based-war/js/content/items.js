// items.js — Tasarımcı: eşya tanımları (ITEM_DEFS) ve mağaza stokları (SHOP_STOCK)
// Şema CONTRACT.md §4.3. Ekonomi: ch1 savaş ödülleri ~25-70 altın/savaş,
// ch4'e gelindiğinde ekip toplam ~700-900 altın biriktirmiş olur.

const ITEM_DEFS = {
  // ---------- TÜKETİLEBİLİRLER ----------
  potion_heal: {
    name: "İyileşme İksiri", type: "consumable", price: 25,
    effect: { heal: "2d4+2" }, ap: 1,
    desc: "Ekşi ama etkili. Savaş içinde kendine veya bitişik bir müttefike kullanılır."
  },
  potion_greater: {
    name: "Büyük İyileşme İksiri", type: "consumable", price: 65,
    effect: { heal: "4d4+4" }, ap: 1,
    desc: "Cam şişede parıldayan altın renkli bir iksir. Ciddi yaraları kapatır."
  },
  potion_slot: {
    name: "Büyü Tozu", type: "consumable", price: 55,
    effect: { restoreSlot: 1 }, ap: 1,
    desc: "Yutulduğunda tüketiciye tek bir büyü slotu geri kazandırır."
  },
  bomb_fire: {
    name: "Ateş Bombası", type: "consumable", price: 35,
    effect: { damage: { dmg: "2d6", area: 1, element: "ateş", range: 6 } }, ap: 2,
    desc: "Fitili yakıp fırlat; çarptığı yerin etrafını ateşe verir."
  },
  bomb_acid: {
    name: "Asit Bombası", type: "consumable", price: 40,
    effect: { damage: { dmg: "2d8", area: 1, element: "asit", range: 6 } }, ap: 2,
    desc: "Balçık avcılarının favorisi; zırhı bile eritir."
  },
  bomb_holy: {
    name: "Kutsal Şişe", type: "consumable", price: 50,
    effect: { damage: { dmg: "2d6", area: 1, element: "kutsal", range: 6 } }, ap: 2,
    desc: "Kutsanmış su dolu bir şişe. Yürüyen ölülere karşı özellikle acımasız."
  },
  potion_bless: {
    name: "Kutsama İksiri", type: "consumable", price: 30,
    effect: { buff: { name: "Kutsama", atkDie: 4, turns: 3 } }, ap: 1,
    desc: "İçtiğinde bir süre isabet zarına ekstra şans katar."
  },
  potion_speed: {
    name: "Çeviklik İksiri", type: "consumable", price: 30,
    effect: { buff: { name: "Çeviklik", speedBonus: 2, turns: 2 } }, ap: 1,
    desc: "Bacaklarını karıncalandırır; birkaç tur daha hızlı koşarsın."
  },

  // ---------- SİLAHLAR (+1 / +2) ----------
  sword_plus1: { name: "+1 Uzun Kılıç", type: "weapon", price: 80, weapon: { weapon: "longsword", bonus: 1 }, desc: "Bileği taze yapılmış, dengeli bir kılıç." },
  sword_plus2: { name: "+2 Uzun Kılıç", type: "weapon", price: 230, weapon: { weapon: "longsword", bonus: 2 }, desc: "Ağzında hafif mavi bir parıltı var." },
  shortsword_plus1: { name: "+1 Kısa Kılıç", type: "weapon", price: 70, weapon: { weapon: "shortsword", bonus: 1 }, desc: "Hafif, hızlı, güvenilir." },
  club_plus1: { name: "+1 Topuz", type: "weapon", price: 65, weapon: { weapon: "club", bonus: 1 }, desc: "Ucuna demir bantlar eklenmiş bir topuz." },
  spear_plus1: { name: "+1 Mızrak", type: "weapon", price: 75, weapon: { weapon: "spear", bonus: 1 }, desc: "Menzili ve dengesiyle her ele uyar." },
  dagger_plus1: { name: "+1 Hançer", type: "weapon", price: 55, weapon: { weapon: "dagger", bonus: 1 }, desc: "Küçük ama sivri; büyücüler için ideal." },
  bow_plus1: { name: "+1 Uzun Yay", type: "weapon", price: 90, weapon: { weapon: "longbow", bonus: 1 }, desc: "Gerdiğinde hafifçe uğuldar." },

  // ---------- ZIRHLAR (+1 / +2) ----------
  armor_leather_plus1: { name: "+1 Deri Zırh", type: "armor", price: 65, armor: { armor: "leather", bonus: 1 }, desc: "Yağlanmış, dikişleri sağlamlaştırılmış deri." },
  armor_chain_plus1: { name: "+1 Zincir Zırh", type: "armor", price: 110, armor: { armor: "chain", bonus: 1 }, desc: "Halkaları sıkıca örülmüş, parlak bir zincir zırh." },
  armor_chain_plus2: { name: "+2 Zincir Zırh", type: "armor", price: 260, armor: { armor: "chain", bonus: 2 }, desc: "Bir cüce ustanın son eseri." },
  armor_plate_plus1: { name: "+1 Plaka Zırh", type: "armor", price: 190, armor: { armor: "plate", bonus: 1 }, desc: "Ağır ama neredeyse hiçbir darbeyi içeri geçirmiyor." },

  // ---------- TRİNKET'LER ----------
  trinket_ring_might: { name: "Güç Yüzüğü", type: "trinket", price: 90, mods: { might: 1 }, desc: "Takana ham bir güç hissi verir." },
  trinket_ring_agility: { name: "Çeviklik Yüzüğü", type: "trinket", price: 90, mods: { agility: 1 }, desc: "Parmakta neredeyse tartısız duruyor." },
  trinket_amulet_will: { name: "İrade Tılsımı", type: "trinket", price: 90, mods: { will: 1 }, desc: "Korkuyu bastıran sakin bir sıcaklık yayar." },
  trinket_amulet_mind: { name: "Zihin Tılsımı", type: "trinket", price: 90, mods: { mind: 1 }, desc: "Takıldığında büyü formülleri daha net akar." },
  trinket_boots: { name: "Rüzgar Çizmeleri", type: "trinket", price: 75, mods: { speed: 1 }, desc: "Adımların neredeyse ses çıkarmaz." },
  trinket_cloak: { name: "Gölge Pelerini", type: "trinket", price: 85, mods: { dodge: 1 }, desc: "Göz ucunda bir titreşim gibi kalır." },
  trinket_heart: { name: "Dayanıklılık Kalbi", type: "trinket", price: 100, mods: { hpMax: 5 }, desc: "Cebinde taşırken kalp atışların güçlenir." },
  trinket_charm: { name: "Savaş Muskası", type: "trinket", price: 60, mods: { initiative: 2 }, desc: "Savaş başlar başlamaz bileklerine bir ürperti yayılır." },
  trinket_focus: { name: "Büyücü Odağı", type: "trinket", price: 165, mods: { slots: 1 }, classes: ["Wizard", "Cleric"], desc: "Kristal bir odak taşı; bir büyü slotu daha açar." },

  // ---------- HEDİYE / ÖZEL EŞYALAR (savaş ödülü, dükkânda satılmaz) ----------
  wolf_fang_charm: { name: "Kurt Dişi Muskası", type: "trinket", price: 70, mods: { agility: 1, initiative: 1 }, desc: "Kurt Reisi'nin dişinden yapılmış bir kolye." },
  troll_hide_cloak: { name: "Troll Derisi Pelerin", type: "trinket", price: 110, mods: { hpMax: 6, dodge: -1 }, desc: "Ağır ama şaşırtıcı derecede dayanıklı." }
};

// Bölüm id'sine göre mağaza stoğu — sonraki bölümlerde daha iyi eşyalar açılır.
const SHOP_STOCK = {
  ch1: [
    "potion_heal", "potion_heal", "potion_bless", "bomb_fire",
    "sword_plus1", "club_plus1", "dagger_plus1",
    "armor_leather_plus1",
    "trinket_ring_might", "trinket_ring_agility", "trinket_boots", "trinket_cloak", "trinket_charm"
  ],
  ch2: [
    "potion_heal", "potion_heal", "potion_greater", "potion_slot", "potion_bless", "potion_speed",
    "bomb_fire", "bomb_acid",
    "sword_plus1", "shortsword_plus1", "spear_plus1", "bow_plus1", "dagger_plus1",
    "armor_leather_plus1", "armor_chain_plus1",
    "trinket_amulet_will", "trinket_amulet_mind", "trinket_heart", "trinket_cloak"
  ],
  ch3: [
    "potion_heal", "potion_greater", "potion_greater", "potion_slot", "potion_bless",
    "bomb_fire", "bomb_acid", "bomb_holy",
    "sword_plus1", "sword_plus2", "club_plus1", "bow_plus1",
    "armor_chain_plus1", "armor_plate_plus1",
    "trinket_focus", "trinket_heart", "trinket_amulet_mind", "trinket_ring_might"
  ],
  ch4: [
    "potion_greater", "potion_greater", "potion_slot", "potion_slot", "potion_bless", "potion_speed",
    "bomb_acid", "bomb_holy",
    "sword_plus2", "bow_plus1", "spear_plus1",
    "armor_chain_plus2", "armor_plate_plus1",
    "trinket_focus", "trinket_amulet_will", "trinket_amulet_mind", "trinket_heart", "trinket_ring_agility"
  ]
};
