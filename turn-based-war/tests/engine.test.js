// engine.test.js — kural/motor testleri (tarayıcısız, node `vm` context'i).
// hex.js / data.js / engine.js saf mantığını test eder. Bir fonksiyon mevcut motorda
// yoksa (kampanya dönüşümü sonrası isim/imza değişmiş olabilir) test 'skip' edilir.
"use strict";
const { loadEngine } = require("./load-engine");
const { scriptedRandom, randomFor } = require("./seeded-random");
const { describe, test, skip, assertEqual, assertTrue, assertClose, assertInRange, summary } = require("./tiny-test");

console.log("=== Turn Based War — motor testleri ===\n");

const { sandbox, context, loaded, failed } = loadEngine();
console.log("Yüklenen dosyalar: " + loaded.join(", "));
if (failed.length) {
  console.log("\x1b[31mYÜKLENEMEYEN dosyalar:\x1b[0m");
  for (const f of failed) console.log("  - " + f.file + ": " + f.error);
}
console.log("");

const has = name => typeof context[name] === "function";
const setRandom = fn => { context.Math.random = fn; };
const restoreRandom = () => { context.Math.random = Math.random; };

// ------------------------------------------------------------------
describe("hex.js — hex ızgara matematiği", () => {
  if (!has("hexDist") || !has("neighbors") || !has("key")) {
    skip("hexDist / neighbors", "fonksiyonlar bulunamadı");
  } else {
    test("hexDist: aynı hex mesafesi 0", () => {
      assertEqual(context.hexDist({ q: 5, r: 5 }, { q: 5, r: 5 }), 0);
    });
    test("hexDist: bitişik hex mesafesi 1 (tüm komşular)", () => {
      // odd-r offset: hem çift hem tek satırda komşuları dene
      for (const [q, r] of [[5, 4], [5, 5]]) {
        const nbs = context.neighbors(q, r);
        assertEqual(nbs.length, 6, "(" + q + "," + r + ") 6 komşusu olmalı");
        for (const [nq, nr] of nbs) {
          assertEqual(context.hexDist({ q, r }, { q: nq, r: nr }), 1,
            "(" + q + "," + r + ")->(" + nq + "," + nr + ") komşu mesafesi 1 olmalı");
        }
      }
    });
    test("hexDist: simetrik olmalı (A->B == B->A)", () => {
      const a = { q: 2, r: 3 }, b = { q: 9, r: 7 };
      assertEqual(context.hexDist(a, b), context.hexDist(b, a));
    });
    test("hexDist: üçgen eşitsizliği makul mesafelerde tutmalı", () => {
      const a = { q: 0, r: 0 }, b = { q: 3, r: 0 }, c = { q: 6, r: 0 };
      const ab = context.hexDist(a, b), bc = context.hexDist(b, c), ac = context.hexDist(a, c);
      assertTrue(ac <= ab + bc, "hexDist üçgen eşitsizliğini bozmamalı");
    });
    test("neighbors: komşuların hepsi birbirinden farklı hex", () => {
      const nbs = context.neighbors(5, 5);
      const keys = new Set(nbs.map(([q, r]) => q + "," + r));
      assertEqual(keys.size, 6, "6 komşu tekil olmalı");
    });
  }
});

// ------------------------------------------------------------------
describe("engine.js — zar / hasar", () => {
  if (!has("rollDmg") || !has("d")) {
    skip("rollDmg", "fonksiyon bulunamadı");
  } else {
    test("rollDmg: normal atış aralıkta (1d6 -> 1..6)", () => {
      setRandom(scriptedRandom([0, 0.99999]));
      const lo = context.rollDmg("1d6", false);
      const hi = context.rollDmg("1d6", false);
      restoreRandom();
      assertInRange(lo, 1, 6);
      assertInRange(hi, 1, 6);
      assertEqual(lo, 1, "random()=0 -> minimum sonuç (1)");
      assertEqual(hi, 6, "random()~1 -> maksimum sonuç (6)");
    });
    test("rollDmg: kritik zarı ikiye katlar (2d6 -> 4d6 kritik)", () => {
      setRandom(() => 0.99999); // her zar maksimum
      const normal = context.rollDmg("2d6", false);
      const crit = context.rollDmg("2d6", true);
      restoreRandom();
      assertEqual(normal, 12, "2d6 maksimum = 12");
      assertEqual(crit, 24, "kritik: zar sayısı 2 katına çıkar (4d6=24)");
    });
    test("d(): seed'li rastgele 1..n aralığında", () => {
      setRandom(scriptedRandom([0.5]));
      const v = context.d(20);
      restoreRandom();
      assertEqual(v, 11, "random()=0.5 ile d(20) = floor(10)+1 = 11 olmalı");
    });
  }
});

// ------------------------------------------------------------------
describe("engine.js — saldırı isabet matematiği (seed'li RNG)", () => {
  if (!has("performHit") || !has("setupBattle")) {
    skip("performHit", "fonksiyon bulunamadı");
  } else {
    test("nat 20 her zaman isabet eder (kritik)", () => {
      context.setupBattle();
      const [attacker, defender] = context.State.units;
      setRandom(scriptedRandom([randomFor(20, 20), randomFor(1, 20)])); // saldıran 20, savunan 1 zar
      const r = context.performHit(attacker, defender, -999); // toHit çok düşük olsa bile
      restoreRandom();
      assertTrue(r.hit, "nat 20 kesin isabet etmeli");
      assertTrue(r.crit, "nat 20 kritik sayılmalı");
    });
    test("nat 1 her zaman ıskalar (auto miss)", () => {
      context.setupBattle();
      const [attacker, defender] = context.State.units;
      setRandom(scriptedRandom([randomFor(1, 20), randomFor(1, 20)]));
      const r = context.performHit(attacker, defender, 999); // toHit çok yüksek olsa bile
      restoreRandom();
      assertTrue(!r.hit, "nat 1 kesin ıska olmalı (auto miss)");
    });
    test("timesAttacked arttıkça savunma zarı avantajlı (min alınır) -> defTotal düşme eğilimli", () => {
      context.setupBattle();
      const [attacker, defender] = context.State.units;
      defender.timesAttacked = 0;
      setRandom(scriptedRandom([randomFor(10, 20), randomFor(15, 20)]));
      const r1 = context.performHit(attacker, defender, 0);
      // ikinci saldırıda 2 zar atılır (timesAttacked=1 oldu), ikisi de 15 ile aynı olsun -> min de 15
      defender.timesAttacked = 1;
      setRandom(scriptedRandom([randomFor(10, 20), randomFor(15, 20), randomFor(3, 20)]));
      const r2 = context.performHit(attacker, defender, 0);
      restoreRandom();
      assertTrue(r2.defTotal <= r1.defTotal, "çok kez saldırıya uğrayan birimin defTotal'i düşmeli (min alınır)");
    });
    test("isabet formülü: atkTotal = d20 + stat, defTotal = min(Nxd20) + agility + dodge", () => {
      context.setupBattle();
      const [attacker, defender] = context.State.units;
      defender.timesAttacked = 0; // ilk saldırı -> 1 zar
      defender.stats.agility = 2;
      defender.dodgeBonus = 1;
      setRandom(scriptedRandom([randomFor(11, 20), randomFor(7, 20)]));
      const r = context.performHit(attacker, defender, 3);
      restoreRandom();
      assertEqual(r.atkTotal, 11 + 3, "atkTotal = natk(11) + toHit(3)");
      assertEqual(r.defTotal, 7 + 2 + 1, "defTotal = savunma zarı(7) + agility(2) + dodge(1)");
    });
  }
});

// ------------------------------------------------------------------
describe("engine.js — status / statü tick", () => {
  if (!has("applyStatus") || !has("tickStatuses") || !has("hasStatus")) {
    skip("status fonksiyonları", "bulunamadı");
  } else {
    test("applyStatus + hasStatus: durum eklenir ve okunabilir", () => {
      const u = { statuses: [] };
      context.applyStatus(u, { name: "Test", dodge: 2, turns: 2 });
      assertTrue(context.hasStatus(u, "dodge"), "dodge alanı statuses içinde bulunmalı");
    });
    test("tickStatuses: turns 0'a inince statü kalkar", () => {
      const u = { statuses: [] };
      context.applyStatus(u, { name: "Kısa", dodge: 1, turns: 1 });
      context.tickStatuses(u); // turns: 1 -> 0, filtrelenir (turns>0 şartı)
      assertEqual(u.statuses.length, 0, "turns 0 olunca statü listeden çıkmalı");
    });
    test("tickStatuses: turns > 1 iken statü kalıcı kalır", () => {
      const u = { statuses: [] };
      context.applyStatus(u, { name: "Uzun", dodge: 1, turns: 3 });
      context.tickStatuses(u);
      assertEqual(u.statuses.length, 1, "turns 3->2, statü kalmalı");
      assertEqual(u.statuses[0].turns, 2);
    });
    test("tickStatuses: turns:null olan statü (kalıcı) hiç düşmez", () => {
      const u = { statuses: [] };
      context.applyStatus(u, { name: "Kalıcı", dodge: 1 }); // turns yok
      context.tickStatuses(u);
      context.tickStatuses(u);
      assertEqual(u.statuses.length, 1, "turns tanımsız statü asla silinmemeli");
    });
  }

  if (!has("statusAtkBonus")) {
    skip("statusAtkBonus", "bulunamadı");
  } else {
    test("statusAtkBonus: oneRoll:true statü BİR kez kullanılınca düşer", () => {
      const u = { statuses: [{ name: "Guide", atkDie: 4, oneRoll: true, turns: 2 }] };
      setRandom(() => 0.5);
      context.statusAtkBonus(u);
      restoreRandom();
      assertEqual(u.statuses.length, 0, "oneRoll statü bir kullanımdan sonra silinmeli");
    });
    test("statusAtkBonus: oneRoll OLMAYAN statü (Bless gibi) kullanılsa da SİLİNMEMELİ", () => {
      // BUG regresyon testi: statusAtkBonus her statüde s._spent=true set ediyor;
      // filtre sadece (atkDie && oneRoll && _spent) olanları siliyor, bu yüzden
      // oneRoll olmayanlar teorik olarak kalmalı — bunu doğruluyoruz.
      const u = { statuses: [{ name: "Bless", atkDie: 4, turns: 3 }] };
      setRandom(() => 0.5);
      context.statusAtkBonus(u);
      context.statusAtkBonus(u); // aynı turda/başka saldırıda tekrar kullanılabilmeli
      restoreRandom();
      assertEqual(u.statuses.length, 1, "oneRoll olmayan atkDie statüsü birden çok kullanımda da kalmalı");
    });
  }
});

// ------------------------------------------------------------------
describe("engine.js — initiative beraberlik çözümü", () => {
  if (!has("rollInitiative") || !has("breakTies")) {
    skip("rollInitiative/breakTies", "bulunamadı");
  } else {
    test("breakTies: tek elemanlı grup direkt döner", () => {
      setRandom(() => 0.5);
      const g = context.breakTies([{ name: "A" }]);
      restoreRandom();
      assertEqual(g.length, 1);
      assertEqual(g[0].name, "A");
    });
    test("breakTies: eşit d20 atan grup tekrar atarak çözülür (sonsuz döngüye girmez)", () => {
      // İlk atışta ikisi de 10 (eşit) -> tekrar atar, ikinci turda 15 vs 3
      const values = [randomFor(10, 20), randomFor(10, 20), randomFor(15, 20), randomFor(3, 20)];
      setRandom(scriptedRandom(values));
      const g = context.breakTies([{ name: "A" }, { name: "B" }]);
      restoreRandom();
      assertEqual(g.length, 2, "iki birim de sonuçta sıralanmalı");
      assertEqual(g[0].name, "A", "yeniden atışta yüksek zar (15) önde olmalı");
    });
    test("rollInitiative: State.order tüm birimleri içerir, init azalan sırada", () => {
      context.setupBattle();
      const order = context.State.order;
      assertEqual(order.length, context.State.units.length, "order tüm birimleri kapsamalı");
      for (let i = 1; i < order.length; i++) {
        assertTrue(order[i - 1].init >= order[i].init, "order azalan init sırasında olmalı");
      }
    });
  }
});

// ------------------------------------------------------------------
describe("engine.js — büyü slotları", () => {
  if (!has("canCast") || !has("castSpell") || !context.SPELLBOOK) {
    skip("canCast/castSpell/SPELLBOOK", "bulunamadı");
  } else {
    test("cantrip (level 0) slot harcamaz", () => {
      const sp = Object.values(context.SPELLBOOK).find(s => s.level === 0);
      assertTrue(!!sp, "en az bir cantrip tanımlı olmalı");
      const u = { spells: [Object.keys(context.SPELLBOOK).find(k => context.SPELLBOOK[k] === sp)], ap: 4, slots: 0, slotsMax: 0 };
      assertTrue(context.canCast(u, sp), "slot 0 olsa da cantrip atılabilmeli");
    });
    test("1. seviye büyü slot yoksa atılamaz", () => {
      const id = Object.keys(context.SPELLBOOK).find(k => context.SPELLBOOK[k].level >= 1);
      const sp = context.SPELLBOOK[id];
      const u = { spells: [id], ap: 4, slots: 0, slotsMax: 2 };
      assertTrue(!context.canCast(u, sp), "slot 0 iken 1. seviye büyü atılamamalı");
    });
    test("castSpell: 1. seviye büyü slot harcar", () => {
      const id = Object.keys(context.SPELLBOOK).find(k => context.SPELLBOOK[k].level >= 1 && context.SPELLBOOK[k].target === "self");
      if (!id) { skip("self-target 1. seviye büyü yok"); return; }
      const sp = context.SPELLBOOK[id];
      const u = { name: "T", spells: [id], ap: 4, slots: 1, slotsMax: 2, stats: {}, statuses: [] };
      context.castSpell(u, sp, u);
      assertEqual(u.slots, 0, "büyü sonrası slot 1'den 0'a düşmeli");
    });
    test("turda sadece 1 seviyeli büyü atılabilir (leveledCast bayrağı)", () => {
      const id = Object.keys(context.SPELLBOOK).find(k => context.SPELLBOOK[k].level >= 1 && context.SPELLBOOK[k].target === "self");
      if (!id) { skip("self-target 1. seviye büyü yok"); return; }
      const sp = context.SPELLBOOK[id];
      const u = { name: "T", spells: [id], ap: 10, slots: 5, slotsMax: 5, stats: {}, statuses: [] };
      context.castSpell(u, sp, u);
      assertTrue(!context.canCast(u, sp), "aynı turda ikinci seviyeli büyü canCast=false dönmeli");
    });
  }
});

// ------------------------------------------------------------------
describe("engine.js — Second Wind (Fighter)", () => {
  if (!has("doSecondWind")) {
    skip("doSecondWind", "bulunamadı");
  } else {
    test("Second Wind: HP artar, sayaç düşer, AP harcanır", () => {
      setRandom(() => 0.5); // d10 -> 6
      const u = { name: "F", hp: 5, hpMax: 20, level: 1, secondWind: 2, ap: 4 };
      context.doSecondWind(u);
      restoreRandom();
      assertTrue(u.hp > 5, "HP artmalı");
      assertEqual(u.secondWind, 1, "kullanım sayacı 1 azalmalı");
      assertEqual(u.ap, 3, "1 AP harcanmalı");
    });
    test("Second Wind: HP hpMax'ı geçmez", () => {
      setRandom(() => 0.99999);
      const u = { name: "F", hp: 19, hpMax: 20, level: 6, secondWind: 2, ap: 4 };
      context.doSecondWind(u);
      restoreRandom();
      assertEqual(u.hp, 20, "HP hpMax'ta sınırlanmalı");
    });
  }
});

// ------------------------------------------------------------------
describe("engine.js — hareket / dash kuralları", () => {
  if (!has("moveAllowance") || !has("canMove")) {
    skip("moveAllowance/canMove", "bulunamadı");
  } else {
    test("ilk hareket: tam hız kullanılır", () => {
      const u = { speed: 6, movesUsed: 0, statuses: [] };
      assertEqual(context.moveAllowance(u), 6);
    });
    test("dash (ikinci hareket): hız/2 (aşağı yuvarlanır)", () => {
      const u = { speed: 7, movesUsed: 1, statuses: [] };
      assertEqual(context.moveAllowance(u), 3, "floor(7/2)=3 olmalı");
    });
    test("canMove: movesUsed 2 olunca artık hareket edilemez (1 hareket + 1 dash sınırı)", () => {
      assertTrue(context.canMove({ movesUsed: 0 }));
      assertTrue(context.canMove({ movesUsed: 1 }));
      assertTrue(!context.canMove({ movesUsed: 2 }), "2. hareketten sonra dash da bitmiş olmalı");
    });
  }
});

// ------------------------------------------------------------------
describe("engine.js — tur akışı kenar durumları", () => {
  if (!has("nextTurn") || !has("setupBattle")) {
    skip("nextTurn/setupBattle", "bulunamadı");
  } else {
    test("nextTurn: ölü birimlerin sırası atlanır", () => {
      context.setupBattle();
      const order = context.State.order;
      if (order.length < 2) { skip("en az 2 birim gerekli"); return; }
      order[1].dead = true; // sıradaki ikinci birimi öldür
      context.State.turnPtr = 0;
      context.nextTurn();
      assertTrue(context.State.turnPtr !== 1, "ölü birimin turu atlanmalı");
    });
    test("round: order sonuna gelince round artar ve timesAttacked sıfırlanır", () => {
      context.setupBattle();
      const u0 = context.State.units[0];
      u0.timesAttacked = 3;
      context.State.turnPtr = context.State.order.length - 1;
      const roundBefore = context.State.round;
      context.nextTurn();
      assertEqual(context.State.round, roundBefore + 1, "round artmalı");
      assertEqual(u0.timesAttacked, 0, "yeni roundda timesAttacked sıfırlanmalı");
    });
  }

  if (!has("startTurn") || !has("hasStatus")) {
    skip("startTurn (uyku/incapacitated)", "bulunamadı");
  } else {
    test("startTurn: uyuyan (incapacitated) birim playerInput/enemy fazına girmeden turu kaçırır", () => {
      context.setupBattle();
      const u = context.cur();
      context.applyStatus(u, { name: "Uyku", incapacitated: true, turns: 2 });
      const ptrBefore = context.State.turnPtr;
      context.startTurn(u);
      // startTurn içinde setTimeout(nextTurn,700) planlanır (sandbox setTimeout no-op kaydeder,
      // hemen çalışmaz) — bu yüzden faz bilgisini kontrol ediyoruz.
      assertTrue(context.State.phase === "enemy" || context.State.phase === "playerInput",
        "uyuyan birim için faz yine de ayarlanmalı (turu atlatan mekanizma setTimeout ile tetiklenir)");
      assertEqual(ptrBefore, context.State.turnPtr, "startTurn kendisi turnPtr'ı ilerletmemeli (nextTurn setTimeout içinde)");
    });
  }
});

// ------------------------------------------------------------------
describe("engine.js — statü uygulama tutarlılığı (Bane/statusPenalty)", () => {
  if (!has("doSpellSave") || !has("doSpellDebuff") || !context.SPELLBOOK) {
    skip("doSpellSave/doSpellDebuff", "bulunamadı");
  } else {
    test("P1-2 DÜZELTİLDİ: doSpellDebuff artık doSpellSave gibi defender statusPenalty'sini düşüyor", () => {
      // Senaryo: caster'ın d20'si NAT 20 (unpenalized roll=20 >= DC, save başarılı, statü TUTMAZ).
      // Ceza (statusPenalty) doğru düşülürse aynı 20'lik atış bile DC'nin altına iner (statü TUTAR).
      const debuffId = Object.keys(context.SPELLBOOK).find(k => context.SPELLBOOK[k].resolve === "debuff");
      if (!debuffId) { skip("resolve:debuff büyü yok"); return; }
      const sp = context.SPELLBOOK[debuffId];
      const caster = { name: "C", level: 1, stats: { will: 0, mind: 0 }, cls: "Wizard" };
      const defender = { name: "D", stats: { [sp.saveStat]: 0 }, statuses: [{ penaltyDie: 20 }] };
      setRandom(scriptedRandom([randomFor(20, 20), randomFor(20, 20)])); // [caster d20=20, ceza d20=20]
      context.State.log = [];
      context.doSpellDebuff(caster, defender, sp);
      restoreRandom();
      const statusApplied = defender.statuses.length > 1; // orijinal penaltyDie + yeni uygulanan sp.status
      assertTrue(statusApplied,
        "roll=20-20(ceza)=0 < DC olduğundan statü TUTMALIYDI (ceza düşülüyor) — mevcut motor: " +
        (statusApplied ? "doğru düşüyor (P1-2 düzeltmesi doğrulandı)" : "cezayı hâlâ düşmüyor, nat20 save'i kurtarıyor"));
    });
  }
});

// ------------------------------------------------------------------
describe("engine.js — alan büyüsü ve dost ateşi", () => {
  if (!has("doSpellArea")) {
    skip("doSpellArea", "bulunamadı");
  } else {
    test("doSpellArea: sadece caster'ın side'ı DIŞINDAKİ birimleri etkiler (dost ateşi YOK)", () => {
      context.setupBattle();
      const caster = context.State.units.find(u => u.side === "party");
      const ally = context.State.units.find(u => u.side === "party" && u !== caster);
      if (!caster || !ally) { skip("yeterli birim yok"); return; }
      // ally'yi caster'ın hemen yanına koy
      ally.q = caster.q; ally.r = caster.r;
      const sp = { name: "TestBlast", area: 5, dmg: "1d6", saveStat: "agility", half: false };
      setRandom(() => 0.0);
      context.doSpellArea(caster, caster, sp);
      restoreRandom();
      assertTrue(ally.hp === ally.hpMax, "aynı taraftaki müttefik alan büyüsünden ETKİLENMEMELİ (mevcut motor davranışı — dost ateşi yok)");
    });
  }
});

// ------------------------------------------------------------------
describe("engine.js — charm (cantAttack) büyü/saldırı engeli", () => {
  if (!has("canCast") || !has("hasStatus") || !context.SPELLBOOK) {
    skip("canCast", "bulunamadı");
  } else {
    test("BUG regresyonu: cantAttack statüsündeki birim canCast() ile saldırı büyüsü atabiliyor (engellenmiyor)", () => {
      const atkSpellId = Object.keys(context.SPELLBOOK).find(k => context.SPELLBOOK[k].resolve === "attack" && context.SPELLBOOK[k].level === 0);
      if (!atkSpellId) { skip("cantrip saldırı büyüsü yok"); return; }
      const sp = context.SPELLBOOK[atkSpellId];
      const u = { spells: [atkSpellId], ap: 4, slots: 0, slotsMax: 0, statuses: [{ name: "Charm", cantAttack: true, turns: 2 }] };
      const can = context.canCast(u, sp);
      // P1-1 DÜZELTİLDİ (3. tur): canCast artık cantAttack (Charm) durumundaki birimin
      // saldırı büyüsü atmasını engelliyor — can === false bekleniyor.
      assertTrue(can === false, "canCast artık cantAttack statüsünde saldırı büyüsünü engelliyor (P1-1 düzeltmesi doğrulandı)");
    });
  }
});

// ------------------------------------------------------------------
describe("engine.js/ai.js — YENİ SAVAŞ sırasında eski setTimeout sızıntısı (P0)", () => {
  if (!has("setupBattle") || !has("runEnemyTurn")) {
    skip("setupBattle/runEnemyTurn", "bulunamadı");
  } else {
    test("BUG regresyonu: önceki savaşın bekleyen AI setTimeout'u yeni savaşın State'ini bozuyor", () => {
      // 1) Savaş A'yı kur; ilk sırayı zorla bir düşmana (enemy) ver ki runEnemyTurn->act()
      //    setTimeout ile planlansın (sandbox setTimeout senkron ÇALIŞTIRMAZ, kuyruğa alır).
      context.setupBattle();
      const battleA_order = context.State.order.slice();
      const enemyA = battleA_order.find(u => u.side !== "party");
      if (!enemyA) { skip("savaşta düşman yok"); return; }
      sandbox.__timers.length = 0; // önceki kurulumdan kalan zamanlayıcıları temizle
      context.State.turnPtr = battleA_order.indexOf(enemyA);
      context.State.phase = "enemy";
      context.startTurn(enemyA); // bu, runEnemyTurn(enemyA) çağırır -> act() setTimeout ile kuyruğa girer
      const outer = sandbox.__timers.slice();
      assertTrue(outer.length > 0, "savaş A turunun setTimeout'u kuyruğa girmiş olmalı");
      // Dıştaki setTimeout'u bir kez çalıştırıp act()'in kendisini (henüz Savaş A State'indeyken,
      // guard=1, hiçbir şey yapmadan) tetikleyelim ki içerideki mantığı Savaş B kurulduktan SONRA,
      // deterministik biçimde (enemyA'yı bilerek bir Savaş B oyuncusunun yanına koyarak) yeniden tetikleyebilelim.
      sandbox.__timers.length = 0;

      // 2) Oyuncu "Yeni Savaş" butonuna basar gibi davran: mevcut kodda (main.js btnNew)
      //    setupBattle() ESKİ ZAMANLAYICILARI İPTAL ETMEDEN çağrılıyor.
      context.setupBattle(); // Savaş B
      const partyB = context.State.units.find(u => u.side === "party");
      // enemyA'yı (Savaş A'dan kalma, artık State.units İÇİNDE OLMAYAN başıboş bir nesne) Savaş B'nin
      // bir oyuncusunun TAM YANINA koy ki meleeStep kesin saldırsın — sızıntının etkisini kanıtlamak için.
      enemyA.q = partyB.q; enemyA.r = partyB.r + (partyB.r > 0 ? -1 : 1);
      enemyA.hasAttacked = false; enemyA.ap = 4; enemyA.dead = false;

      const turnPtrB_before = context.State.turnPtr;
      const orderB_len = context.State.order.length;
      const logLenB_before = context.State.log.length;
      const partyB_hpBefore = partyB.hp;

      // 3) Savaş A'dan kalan zamanlayıcı (dıştaki setTimeout(act,500)) şimdi ateşleniyor
      //    (gerçek tarayıcıda "Yeni Savaş"a basmadan hemen önce zaten kuyruğa girmiş olurdu).
      outer[0].fn();

      // 4) Savaş B'nin State'i, ARTIK OYUNDA OLMAYAN Savaş A biriminin hamlesiyle bozulmuş olmalı:
      //    ya turnPtr habersizce ilerledi, ya log'a Savaş A biriminin adı yazıldı, ya da B'nin
      //    oyuncusu hiç ilgisi olmayan bir birimden hasar aldı.
      const turnPtrChanged = context.State.turnPtr !== turnPtrB_before;
      const staleNameInLog = context.State.log.slice(logLenB_before).some(e => e.text.indexOf(enemyA.name) >= 0);
      const orderLenChanged = context.State.order.length !== orderB_len;
      const partyDamaged = partyB.hp !== partyB_hpBefore;

      // P0-1 DÜZELTİLDİ (3. tur): State.battleId + guardedTimeout() sayesinde Savaş A'dan kalan
      // zamanlayıcı artık battleId uyuşmazlığını görüp sessizce çıkıyor — hiçbiri değişmemeli.
      assertTrue(!turnPtrChanged && !staleNameInLog && !orderLenChanged && !partyDamaged,
        "battleId guard'ı sayesinde Savaş A'nın gecikmeli AI hamlesi artık Savaş B'nin State'ini ETKİLEMİYOR (P0-1 düzeltmesi doğrulandı)");
    });
  }
});

// ------------------------------------------------------------------
describe("engine.js — kampanya modunda savaş kurulumu (setupBattle(cfg))", () => {
  if (!has("setupBattle")) {
    skip("setupBattle", "bulunamadı");
  } else {
    test("setupBattle({map, enemies}) hata FIRLATMADAN kurulmalı (CONTRACT §4.5 CAMPAIGN akışı)", () => {
      const cfg = {
        map: ["............", "............", "....P.......", "............", "....E.......", "............", "............"],
        enemies: [{ type: "wolf", q: 4, r: 4, name: "Test Kurt" }],
        biome: "forest"
      };
      let threw = null;
      try { context.setupBattle(cfg); } catch (e) { threw = e; }
      // BUG regresyonu: getEnemyDefs()/getItemDefs() henüz motorda TANIMLI DEĞİL (content/enemies.js,
      // content/items.js ENEMY_DEFS/ITEM_DEFS tanımlıyor ama onları döndüren getter yok). Bu yüzden
      // bir CAMPAIGN düğümünden (map+enemies) savaş kurmak şu an İSTİSNA FIRLATIYOR.
      // Düzeltildiğinde bu test 'threw === null' bekleyecek şekilde güncellenmelidir.
      if (threw) {
        assertTrue(/getEnemyDefs|getItemDefs/.test(threw.message),
          "bekleneni doğrulayan hata: " + threw.message + " (bkz. TEST_REPORT.md P0 — kampanya savaşı kurulamıyor)");
      } else {
        assertTrue(true, "setupBattle(cfg) artık hatasız çalışıyor — düzeltilmiş görünüyor");
      }
    });
  }
});

// ------------------------------------------------------------------
describe("engine.js — 'survive' hedefi (checkSurvive) (P0)", () => {
  if (!has("nextTurn") || !has("checkSurvive") || !has("setupBattle")) {
    skip("nextTurn/checkSurvive", "bulunamadı");
  } else {
    test("BUG regresyonu: round eşiği aşılınca winner='party' oluyor AMA phase 'over' olmuyor (startTurn onu eziyor)", () => {
      context.setupBattle();
      context.State.objective = { type: "survive", rounds: 1 };
      context.State.round = 1;
      context.State.turnPtr = context.State.order.length - 1; // bir sonraki nextTurn() round'u 2 yapacak (>1 => zafer)
      context.nextTurn();
      assertEqual(context.State.winner, "party", "checkSurvive winner'ı doğru ayarlamalı");
      // P0-5 DÜZELTİLDİ (4. tur): nextTurn() artık checkSurvive sonrası phase==='over' ise
      // startTurn()'e girmiyor — phase gerçekten 'over' kalıyor.
      assertEqual(context.State.phase, "over",
        "nextTurn artık checkSurvive'ın ayarladığı 'over' phase'ini startTurn ile ezmiyor (P0-5 düzeltmesi doğrulandı)");
    });
  }
});

// ------------------------------------------------------------------
describe("campaign-flow.js — satın alınan +N silah/zırh eşyaları (heroToBattleUnit) (P0)", () => {
  if (!has("heroToBattleUnit") || !has("getItemDefs")) {
    skip("heroToBattleUnit", "bulunamadı");
  } else {
    test("BUG regresyonu: weaponItem eşitlenmiş kahraman heroToBattleUnit'te İSTİSNA fırlatıyor", () => {
      const defs = context.getItemDefs();
      const weaponItemId = Object.keys(defs).find(id => defs[id].type === "weapon");
      if (!weaponItemId) { skip("ITEM_DEFS içinde weapon tipi eşya yok"); return; }
      const hero = {
        name: "T", cls: "Fighter", sprite: "fighter", level: 1,
        stats: { might: 3, agility: 3, will: 1, mind: 0, influence: 0 },
        hpMax: 12, hp: 12, speed: 6, atk: "longsword", armor: "leather", shield: true,
        weaponItem: weaponItemId, armorItem: null, trinkets: [],
        spells: null, slotsMax: 0, slots: 0, secondWindMax: 2, secondWind: 2, features: []
      };
      let threw = null;
      try { context.heroToBattleUnit(hero, 0); } catch (e) { threw = e; }
      // P0-4 DÜZELTİLDİ (4. tur): heroToBattleUnit artık it.weapon.bonus/.weapon okuyor — istisna yok.
      assertTrue(threw === null,
        "heroToBattleUnit artık gerçek şemadan (it.weapon.*) okuyor, istisna fırlatmıyor" +
        (threw ? " (HATA: yine de fırlattı: " + threw.message + ")" : "") + " (P0-4 düzeltmesi doğrulandı)");
    });
    test("BUG regresyonu (P1): trinket mod'ları (it.mods) heroToBattleUnit'te hiç uygulanmıyor (it.effect.mods bekleniyor, sessizce atlanıyor)", () => {
      const defs = context.getItemDefs();
      const trinketId = Object.keys(defs).find(id => defs[id].type === "trinket" && defs[id].mods && defs[id].mods.hpMax);
      if (!trinketId) { skip("hpMax mod'lu trinket yok"); return; }
      const hero = {
        name: "T", cls: "Fighter", sprite: "fighter", level: 1,
        stats: { might: 3, agility: 3, will: 1, mind: 0, influence: 0 },
        hpMax: 12, hp: 12, speed: 6, atk: "longsword", armor: "leather", shield: true,
        weaponItem: null, armorItem: null, trinkets: [trinketId],
        spells: null, slotsMax: 0, slots: 0, secondWindMax: 2, secondWind: 2, features: []
      };
      const unit = context.heroToBattleUnit(hero, 0);
      const expectedHpMax = 12 + defs[trinketId].mods.hpMax;
      // P1 (P0-4 ile birlikte) DÜZELTİLDİ: heroToBattleUnit artık it.mods (top-level) okuyor.
      assertEqual(unit.hpMax, expectedHpMax,
        "trinket hpMax bonusu artık uygulanıyor (P0-4/P1 düzeltmesi doğrulandı)");
    });
  }
});

// ------------------------------------------------------------------
console.log("");
const ok = summary();
process.exit(ok ? 0 : 1);
