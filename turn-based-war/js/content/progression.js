// progression.js — Tasarımcı: seviye atlama, XP tablosu, sınıf özellik metinleri, 2. seviye büyüler
// Şema CONTRACT.md §4.4. XP ekibe ortak verilir (ölü/canlı fark etmez).

const MAX_LEVEL = 6;

// XP_TABLE[level] = o seviyeye ulaşmak için gereken TOPLAM (kümülatif) XP.
// TEST_REPORT.md §6 (bot simülasyonu) sonrası kalibre edildi: hedef ilerleme eğrisi
// Lv2 ~b1 sonrası, Lv3 Bölüm1 sonu (b3 boss sonrası), Lv4 Bölüm2 sonu (b6 boss sonrası),
// Lv5 Bölüm3 ortası (b8 sonrası, b9 boss'tan ÖNCE), Lv6 final öncesi kamp (c4, b11 sonrası,
// b12'den ÖNCE) — eskisinden daha YAVAŞ bir eğri (eski tablo ekibi kampanyanın ortasından
// önce Lv6 tavana çıkarıyordu). Kümülatif düşman XP'si (ana yol, b1..b12) ile doğrulandı:
// b1=150, b2=485, b3=945, b4=1200, b5=1465, b6=2170, b7=2530, b8=2875, b9=3760,
// b10=4238, b11=5368, b12=6522 (ana yol, b1opt hariç). NOT: kampanya-sim referans koşusu
// "completionist" (b1opt dahil) oynuyor — b1opt'un ekstra XP'si (~210) bir sonraki gate'i
// ERKEN tetiklemesin diye eşikler hem ana yol HEM b1opt'lu yol için ayrı hesaplanıp kesişimi
// alındı (TEST_REPORT.md §6 sonrası: b1opt alan bot b3'e zaten Lv3 ile giriyordu → b3 %97'ye
// düştü). bkz. DESIGN.md §4 ve §8.
const XP_TABLE = [0, 0, 130, 600, 1600, 2550, 5000];

const LEVEL_UPS = {
  Fighter: {
    hpDie: 10,
    perLevel: {
      2: { features: ["actionSurge"], statPoints: 1 },
      3: { features: ["cleave"], statPoints: 1 },
      4: { features: ["extraAttack"] },
      5: { statPoints: 2 },
      6: { features: ["indomitable"], statPoints: 1 }
    }
  },
  Cleric: {
    hpDie: 8,
    perLevel: {
      2: { slots: 1, features: ["turnUndead"], learnSpells: { leveled: 1 } },
      3: { statPoints: 1, learnSpells: { cantrips: 1 } },
      4: { features: ["divineStrike"], learnSpells: { leveled: 1 } },
      5: { slots: 1, statPoints: 1, learnSpells: { cantrips: 1 } },
      6: { features: ["preserveLife"], learnSpells: { leveled: 1 } }
    }
  },
  Wizard: {
    hpDie: 6,
    perLevel: {
      2: { slots: 1, features: ["arcaneRecovery"], learnSpells: { leveled: 1, cantrips: 1 } },
      3: { statPoints: 1, learnSpells: { cantrips: 1 } },
      4: { features: ["empoweredEvocation"], learnSpells: { leveled: 1 } },
      5: { slots: 1, statPoints: 1, learnSpells: { leveled: 1 } },
      6: { features: ["spellSurge"], learnSpells: { leveled: 1 } }
    }
  }
};

// Her seviyede HP artışı (Geliştirici uygular): floor(hpDie/2)+1 + might.
// statPoints: oyuncunun dağıtacağı serbest puan (stat tavanı 5).
// learnSpells: o seviyede seçilebilecek yeni büyü sayısı (cantrip / 1.-2. seviye büyü).

// CLASS_FEATURE_TEXT — CONTRACT §4.4'teki CLASS_FEATURES id'lerinin Türkçe adı/açıklaması.
// Geliştirici mekaniği uygular, tasarımcı sadece sunum metnini yazar.
const CLASS_FEATURE_TEXT = {
  actionSurge: {
    name: "Ani Atılım",
    desc: "Savaşta bir kez, bir anlığına sınırlarını zorlarsın: o tur +2 AP kazanır ve aynı turda 2 saldırı yapabilirsin."
  },
  cleave: {
    name: "Yarma Vuruşu",
    desc: "Silahın isabet ettiğinde hedefine bitişik ikinci bir düşmana da yarı hasar savurur."
  },
  extraAttack: {
    name: "Ekstra Saldırı",
    desc: "Deneyimin artık silahını iki kez savurmana yetiyor: her turda 2 ayrı saldırı yapabilirsin."
  },
  indomitable: {
    name: "Yılmaz İrade",
    desc: "Savaşta bir kez, başarısız olduğun bir kurtarma zarını yeniden atarsın — pes etmek bilmezsin."
  },
  turnUndead: {
    name: "Ölüleri Kovma",
    desc: "Savaşta bir kez, kutsal bir ışık saçarsın: 3 hex içindeki yürüyen ölüler irade kurtarması atar, başaramazlarsa 2 tur boyunca saldıramaz ve senden kaçarlar."
  },
  divineStrike: {
    name: "İlahi Darbe",
    desc: "Silahın isabet ettiğinde (turda bir kez) ekstra 1d8 radyant hasar ekler."
  },
  preserveLife: {
    name: "Hayatı Koru",
    desc: "Savaşta bir kez, 3 hex içindeki tüm müttefiklerine kutsal bir enerji dalgası göndererek 2d6 can iyileştirirsin."
  },
  arcaneRecovery: {
    name: "Arkan Toparlanma",
    desc: "Savaşta bir kez, kısa bir odaklanmayla harcanmış bir büyü slotunu geri kazanırsın."
  },
  empoweredEvocation: {
    name: "Güçlendirilmiş Büyü",
    desc: "Hasar veren büyülerine Mind bonusun kadar ekstra hasar eklersin."
  },
  spellSurge: {
    name: "Büyü Dalgası",
    desc: "Savaşta bir kez, o tur seviyeli büyü sınırın kalkar ve +2 AP kazanırsın — art arda güçlü büyüler savurabilirsin."
  }
};

// SPELLBOOK_EXT — 2. seviye büyüler (CONTRACT §4.4). SPELLBOOK ile birebir aynı şema.
// Geliştirici bunları SPELLBOOK'a ekler; 2. seviye büyüler de 1. seviye slot havuzunu kullanır.
const SPELLBOOK_EXT = {
  // -- Wizard --
  scorchingray: {
    name: "Scorching Ray", level: 2, ap: 2, range: 12, target: "enemy",
    resolve: "attack", dmg: "3d6", element: "ateş"
  },
  mistyleap: {
    name: "Sisli Sıçrayış", level: 2, ap: 1, range: 0, target: "self",
    resolve: "buff", status: { name: "Sisli Sıçrayış", speedBonus: 3, dodge: 2, turns: 1 }
  },
  webspell: {
    name: "Örümcek Ağı", level: 2, ap: 2, range: 12, target: "enemy",
    resolve: "save", saveStat: "agility", half: false, area: 1,
    status: { name: "Ağa Takıldı", speedBonus: -3, turns: 2 }
  },
  // -- Cleric --
  spiritualweapon: {
    name: "Ruhani Silah", level: 2, ap: 2, range: 6, target: "enemy",
    resolve: "attack", dmg: "1d8", element: "kutsal"
  },
  holdperson: {
    name: "Hold Person", level: 2, ap: 2, range: 12, target: "enemy",
    resolve: "debuff", saveStat: "will",
    status: { name: "Tutuklandı", incapacitated: true, turns: 2 }
  },
  aid: {
    name: "Yardım Et", level: 2, ap: 1, range: 6, target: "ally",
    resolve: "buff", status: { name: "Yardım", reduceDie: 6, oneHit: true, turns: 3 }
  }
};

// ---------- BAŞLANGIÇ BÜYÜLERİ VE ÖĞRENME HAVUZU ----------
// data.js'teki DEFAULT_SPELLS, Wizard/Cleric'in sınıflarının TÜM büyülerini bilmesine
// sebep oluyordu (bkz. data.js §"DEFAULT_SPELLS" yorumu) — bu yüzden seviye atlamadaki
// learnSpells anlamsızdı. Çözüm: karakter yaratma STARTING_SPELLS'ten başlar (3 cantrip +
// 2 seviye-1 büyü, dengeli ve eğlenceli bir açılış seti), geri kalan büyüler LEVEL_UPS'taki
// learnSpells sayılarınca SPELL_POOL'dan (geliştirici arayüzünde) seçilerek öğrenilir.
// NOT (Geliştiriciye): data.js'te DEFAULT_SPELLS yerine STARTING_SPELLS kullanılmalı;
// SPELL_OPTIONS/DEFAULT_SPELLS güncellemesi data.js sahipliğinde olduğu için burada
// sadece veri sağlanıyor, dosya değiştirilmedi (CONTRACT §1).
const STARTING_SPELLS = {
  // Wizard: hasar (firebolt), kontrol (snow) ve mobilite (speed) cantrip'leri +
  // güvenilir hasar (magicmissile, hiç ıskalamaz) ve alan kontrolü (sleep).
  Wizard: ["firebolt", "snow", "speed", "magicmissile", "sleep"],
  // Cleric: hasar (sacredflame), destek (guide) ve savunma (resistance) cantrip'leri +
  // hızlı iyileştirme (healingword) ve ekip buff'ı (bless).
  Cleric: ["sacredflame", "guide", "resistance", "healingword", "bless"]
};

// SPELL_POOL — seviye atlamada (learnSpells sayısı kadar) seçilebilecek büyü havuzu.
// Girdi ya bir SPELLBOOK/SPELLBOOK_EXT id'si (string) ya da {id, minLevel} objesidir;
// minLevel verilmemişse o büyü seviye 1'den itibaren seçilebilir. 2. seviye büyüler
// (SPELLBOOK_EXT) yalnızca karakter seviye >= 3 olduğunda seçilebilir olsun.
const SPELL_POOL = {
  Wizard: {
    cantrips: ["firebolt", "snow", "speed", "necro", "acid", "blast", "soundshock", "shock"],
    leveled: [
      "magicmissile", "burninghands", "magearmor", "shield", "sleep", "iceknife", "charm", "grease", "chromatic",
      { id: "scorchingray", minLevel: 3 },
      { id: "mistyleap", minLevel: 3 },
      { id: "webspell", minLevel: 3 }
    ]
  },
  Cleric: {
    cantrips: ["sacredflame", "guide", "resistance", "necro", "shock", "minorcurse", "wordpain"],
    leveled: [
      "healingword", "healingtouch", "shield", "sleep", "bless", "inflict", "guidingbolt", "bane", "shieldfaith",
      { id: "spiritualweapon", minLevel: 3 },
      { id: "holdperson", minLevel: 3 },
      { id: "aid", minLevel: 3 }
    ]
  }
};
// Beklenen toplam bilinen büyü sayısı (5 başlangıç + LEVEL_UPS.learnSpells toplamı):
// Wizard: 5 + (lvl2: leveled1+cantrip1) + (lvl3: cantrip1) + (lvl4: leveled1) + (lvl5: leveled1) + (lvl6: leveled1) = 11
// Cleric: 5 + (lvl2: leveled1) + (lvl3: cantrip1) + (lvl4: leveled1) + (lvl5: cantrip1) + (lvl6: leveled1) = 10
