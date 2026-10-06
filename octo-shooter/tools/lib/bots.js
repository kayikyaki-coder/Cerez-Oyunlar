'use strict';
/* =========================================================================
   lib/bots.js — market botları
   - Yardımcılar (makeHelpers): oyunun kendi buyCard/chainMerge/setSlot/
     reroll/sell/autoMerge yollarını kullanır.
   - F1 botları (DESIGN.md F1): kotu, zayif, orta, iyi2 + 6 archetype
   - Eski botlar: random, focus, greedy, trinket
   Tüm botlar WEAPONS/TRINKETS/CLASSES tablolarını oyundan dinamik okur.
========================================================================= */
/* ---------------------------------------------------------------------
   BOT YARDIMCILARI — WEAPONS/TRINKETS tabloları dinamik okunur
--------------------------------------------------------------------- */
function makeHelpers(A, rng, rec, ratings){
  const g = A.g;
  ratings = ratings || {};
  const H = {
    rng, rec,
    /* Silah puanı (≈ etkin Lv1 DPS, medyan 18'e ölçekli). Tablo yoksa kaba tahmin. */
    rating(id){
      if(ratings[id] != null) return ratings[id];
      const w = H.W()[id];
      return H.estDps(w, 1) * (ratings.__estScale || 1);
    },
    /* Oyunun "Otomatik Birleştir" butonu + yedekten boş kola taşıma */
    autoMerge(){
      try { A.el('btnAutoMerge').click(); } catch(e){ rec.errors.push('autoMerge: ' + e); }
      H.compact();
    },
    P: () => g('P'),
    W: () => g('WEAPONS'),
    T: () => g('TRINKETS'),
    C: () => g('CLASSES'),
    cards: () => g('shopCards') || [],
    gold: () => H.P().gold,
    wave: () => H.P().wave,
    call: (n, ...a) => A.fn(n)(...a),
    lvlMult(lv){ const f = A.fn('LVL_MULT'); return typeof f === 'function' ? f(lv) : Math.pow(1.55, lv-1); },
    refs: () => H.call('allRefs'),
    slot: r => H.call('getSlot', r),
    items(){ return H.refs().map(r => ({ r, it: H.slot(r) })).filter(x => x.it); },
    armItems(){ return H.P().arms.map((it,i) => ({ r:{z:'a',i}, it })).filter(x => x.it); },
    emptyArm: () => H.P().arms.findIndex(a => a === null),
    emptyBench: () => H.P().bench.findIndex(a => a === null),
    weaponCount: () => H.P().arms.filter(Boolean).length,
    ownsType: id => H.items().some(x => x.it.type === id),
    hasLv1: id => H.items().some(x => x.it.type === id && x.it.lv === 1),
    cardDef(c){
      if(c.kind === 'weapon') return H.W()[c.id];
      const T = H.T();
      return c.idx != null ? T[c.idx] : T.find(t => t.id === c.id);
    },
    price(c){
      const d = H.cardDef(c); if(!d) return Infinity;
      if(c.kind === 'weapon'){
        const wp = A.fn('weaponPrice');                 // enflasyonlu fiyat
        if(typeof wp === 'function'){ try { return wp(c.id); } catch(e){} }
      }
      if(c.kind !== 'weapon'){
        const tp = A.fn('trkPrice');
        if(typeof tp === 'function'){ try { return tp(d); } catch(e){} }
      }
      return d.price;
    },
    trkCount: id => (H.P().trkCount || {})[id] || 0,
    feasible(c){
      if(c.sold) return false;
      const d = H.cardDef(c); if(!d) return false;
      if(c.kind === 'weapon'){
        if(H.emptyArm() >= 0 || H.emptyBench() >= 0) return true;
        return H.hasLv1(c.id);
      }
      return H.trkCount(d.id) < (d.cap ?? Infinity);
    },
    buy(i){
      const c = H.cards()[i];
      const before = H.gold();
      try { H.call('buyCard', i); }
      catch(e){ rec.errors.push(`buyCard: ${e && e.stack ? e.stack.split('\n').slice(0,2).join(' | ') : e}`); return false; }
      const ok = !!(c && c.sold);
      if(ok){
        const d = H.cardDef(c);
        const key = c.kind === 'weapon' ? c.id : 'trk:' + (d && d.id);
        rec.bought[key] = (rec.bought[key] || 0) + 1;
        rec.spent += before - H.gold();
      }
      return ok;
    },
    rerollCost: 2,
    reroll(){
      const before = H.gold();
      try { A.el('btnReroll').click(); }
      catch(e){ rec.errors.push('reroll: ' + e); return false; }
      const spent = before - H.gold();
      if(spent > 0){ H.rerollCost = spent; rec.rerolls++; return true; }
      return false;
    },
    sell(ref){
      const it = H.slot(ref); if(!it) return false;
      try {
        for(let k=0;k<3 && H.slot(ref);k++){       // Lv3+ iki adımlı onay
          A.set('selectedRef', { z: ref.z, i: ref.i });
          A.el('btnSell').click();
        }
      } catch(e){ rec.errors.push('sell: ' + e); return false; }
      if(!H.slot(ref)){ rec.sold++; return true; }
      return false;
    },
    /* Tüm eş silahları zincirleme birleştir (oyunun chainMerge'ü) */
    mergeAll(){
      let changed = true, guard = 0;
      while(changed && guard++ < 20){
        changed = false;
        for(const r of H.refs()){
          const it = H.slot(r); if(!it) continue;
          const lv0 = it.lv;
          try { H.call('chainMerge', r); } catch(e){ rec.errors.push('chainMerge: ' + e); return; }
          if(H.slot(r) && H.slot(r).lv !== lv0){ changed = true; rec.merges++; }
        }
      }
      H.compact();
    },
    /* Yedekteki silahları boş kollara taşı (setSlot) */
    compact(){
      const P = H.P();
      for(let i=0;i<P.bench.length;i++){
        const it = P.bench[i]; if(!it) continue;
        const ea = H.emptyArm(); if(ea < 0) return;
        H.call('setSlot', { z:'a', i:ea }, it);
        H.call('setSlot', { z:'b', i }, null);
        try { it.aim = H.call('armAngle', ea); } catch(e){}
      }
    },
    /* Kol Cilası: artan altınla en güçlü kolların cilasını al (altın yutağı) */
    polishAll(reserve){
      const pa = A.fn('polishArm'), pc = A.fn('polishCost');
      if(typeof pa !== 'function') return;
      for(let guard = 0; guard < 80; guard++){
        const arms = H.armItems().filter(x => (x.it.pol || 0) < 5)
          .sort((a, b) => H.estDps(H.W()[b.it.type], b.it.lv) - H.estDps(H.W()[a.it.type], a.it.lv) || (a.it.pol||0) - (b.it.pol||0));
        const x = arms.find(y => y.it.lv >= 2) || arms[0];
        if(!x || H.gold() < pc(x.it) + reserve) break;
        if(!pa(x.r)) break;
        H.rec.polish = (H.rec.polish || 0) + 1;
      }
    },
    /* Kabuk Onarımı (market düğmesi): can eşiğin altındaysa en çok 2 kez (altın yetiyorsa) */
    repairTo(frac){
      for(let k = 0; k < 2; k++){
        const P = H.P();
        if(!(P.hp < frac * P.maxHp)) break;
        const g0 = P.gold;
        try { A.el('btnRepair').click(); } catch(e){ rec.errors.push('repair: ' + e); break; }
        if(H.P().gold >= g0) break;               // yetmedi / yapılamadı
      }
    },
    /* Komşu Bağı yerleşimi: kol çiftlerini takas eden tırmanış (oyunun bondScore'u). Bağ sayısı artmayana dek. */
    arrange(){
      const P = H.P(), score = A.fn('bondScore');
      if(typeof score !== 'function') return;
      let best = score(P.arms), improved = true, guard = 0;
      while(improved && guard++ < 30){
        improved = false;
        for(let i = 0; i < P.arms.length; i++) for(let j = i + 1; j < P.arms.length; j++){
          if(!P.arms[i] && !P.arms[j]) continue;
          const t = P.arms[i]; P.arms[i] = P.arms[j]; P.arms[j] = t;
          const sc = score(P.arms);
          if(sc > best){ best = sc; improved = true; }
          else { const u = P.arms[i]; P.arms[i] = P.arms[j]; P.arms[j] = u; }
        }
      }
      const aa = A.fn('armAngle');
      P.arms.forEach((a, i) => { if(a){ try { a.aim = aa(i); } catch(e){} } });
    },
    /* Kaba DPS tahmini — yalnız tablodaki alanlara bakar, bilinmeyen tür = dmg/cd */
    estDps(w, lv){
      if(!w) return 0;
      const L = H.lvlMult(lv || 1);
      const cd = Math.max(0.05, w.cd || 1);
      let d = (w.dmg || 0) * L / cd;
      if(w.ramp && w.ramp.max) d = ((w.dmg + w.ramp.max) / 2) * L / cd;
      switch(w.kind){
        case 'boomerang': {
          const cdEff = Math.max(cd, 2 * (w.range || 250) / (w.speed || 360));
          d = (w.dmg || 0) * L / cdEff * 2 * 1.4; break;
        }
        case 'cone_shot': case 'melee_cone': case 'tick_cone': d *= 1.6; break;
        case 'orb': case 'bolt': case 'artillery':
          d *= 1 + (w.splash ?? 1) * ((w.aoe || 0) / 60);
          if(w.kind === 'artillery') d *= 0.7;
          break;
      }
      if(w.poison) d += (w.poison.dps || 0) * (w.poison.dur || 0) / cd;
      if(w.rico) d *= 1 + (w.rico.mult || 0) * 0.5;
      if(w.slow || w.stun || w.ink || w.heal || w.knock) d *= 1.1;
      if((w.range || 0) < 100) d *= 0.85;            // yalnız ahtapota yapışanlara vurur
      return d;
    },
    teamDps(){ return H.armItems().reduce((s,x) => s + H.estDps(H.W()[x.it.type], x.it.lv), 0); },
    weakestArm(){
      let best = null;
      for(const x of H.armItems()){
        const v = H.estDps(H.W()[x.it.type], x.it.lv);
        if(!best || v < best.v) best = { ...x, v };
      }
      return best;
    }
  };
  return H;
}

/* Genel market döngüsü: fazlar sırayla; her fazda en yüksek skorlu uygun kart
   alınır, bir şey alınamazsa makeRoom → reroll → sonraki faz. */
function shopLoop(H, bot){
  const phases = bot.phases;
  for(const ph of phases){
    let rerolls = 0;
    for(let guard=0; guard<80; guard++){
      const gold = H.gold();
      let best = null;
      H.cards().forEach((c, i) => {
        if(c.sold || H.price(c) > gold || !H.feasible(c)) return;
        const s = ph.score(H, c);
        if(s > 0 && (!best || s > best.s)) best = { i, s, c };
      });
      if(best){
        if(!H.buy(best.i)) break;
        if(H.emptyArm() < 0) H.mergeAll(); else H.compact();
        continue;
      }
      if(ph.makeRoom && ph.makeRoom(H)) continue;
      const maxR = ph.maxRerolls ? ph.maxRerolls(H) : 0;
      if(rerolls < maxR && gold - H.rerollCost >= (ph.reserve ? ph.reserve(H) : 0) && H.reroll()){
        rerolls++; continue;
      }
      break;
    }
  }
  if(H.emptyArm() < 0) H.mergeAll(); else H.compact();
}

/* ---------------------------------------------------------------------
   STRATEJİLER
--------------------------------------------------------------------- */
function trinketUtility(H, t){
  /* Tılsım faydası "eşdeğer DPS" cinsinden — bilinmeyen id'ler küçük değer alır */
  const team = Math.max(10, H.teamDps());
  const wave = H.wave();
  const avgDpsPerGold = 0.9;
  switch(t.id){
    case 'dmg':  return team * 0.05;
    case 'spd':  return team * 0.04;
    case 'crit': return team * 0.025 * 0.75;
    case 'hp':   return team * (wave > 8 ? 0.03 : 0.01);
    case 'gold': return wave <= 6 ? 3 * Math.max(0, 10 - wave) * avgDpsPerGold * 0.6 : 0;
    case 'arm':  return H.emptyArm() < 0 ? team / Math.max(1, H.weaponCount()) * 0.9 : 0;
    case 'bench':return 0;
    default:     return team * 0.01;
  }
}

const STRATEGIES = {
  /* (a) Rastgele-uygun: bütçe yettiğince en ucuz silahı al (eşitlikte rastgele),
     yer yoksa aynı türü alıp geliştir/birleştir; ara sıra rastgele tılsım. */
  random: {
    desc: 'Ucuz silah önce, yer yoksa merge/level, %25 ihtimalle rastgele tılsım',
    phases: [{
      score(H, c){
        if(c.kind === 'weapon') return 100 / H.price(c) + H.rng() * 0.5;
        return H.rng() < 0.25 ? 0.5 : 0;
      },
      maxRerolls: () => 2,
      reserve: () => 0
    }]
  },

  /* (b) Sınıf odaklı: --focus sınıflarını (varsayılan Mermi+Uzun) taşıyan
     benzersiz silahları kovalar; alakasız silahları yer açmak için satar. */
  focus: {
    desc: 'Odak sınıf(lar)ı taşıyan benzersiz silahları kovalar, alakasızı satar',
    init(H, opts){ this.F = new Set(String(opts.focus || 'Mermi+Uzun').split(/[+,]/)); },
    phases: [
      {
        score(H, c){
          if(c.kind !== 'weapon') return 0;
          const w = H.W()[c.id], F = H.bot.F;
          const m = (w.cls || []).filter(x => F.has(x)).length;
          if(m === 0) return (H.weaponCount() < 2 && H.emptyArm() >= 0) ? 0.1 : 0;
          let s = m * 10 + (H.ownsType(c.id) ? 0 : 6) - H.price(c) / 10;
          if(H.emptyArm() < 0 && H.emptyBench() < 0) s = H.hasLv1(c.id) ? 3 : 0;
          return s;
        },
        makeRoom(H){
          if(H.emptyArm() >= 0) return false;
          const F = H.bot.F, W = H.W();
          const want = H.cards().some(c => !c.sold && c.kind === 'weapon' && H.price(c) <= H.gold()
                        && !H.ownsType(c.id) && (W[c.id].cls || []).some(x => F.has(x)));
          if(!want) return false;
          const off = H.armItems().find(x => !(W[x.it.type].cls || []).some(k => F.has(k)));
          return off ? H.sell(off.r) : false;
        },
        maxRerolls: H => H.emptyArm() >= 0 ? 4 : 2,
        reserve: () => 10
      },
      {   /* artan altın: güç/hız/kritik, ek kol */
        score(H, c){
          if(c.kind === 'weapon') return 0;
          const t = H.cardDef(c);
          return ({ arm: 5, dmg: 3, spd: 2.5, crit: 2 })[t.id] || 0;
        }
      }
    ]
  },

  /* (c) Açgözlü: eşdeğer-DPS / fiyat oranı en yüksek kartı alır (silah, seviye
     farkı veya tılsım); belirgin daha iyi silah varsa en zayıf kolu satar. */
  greedy: {
    desc: 'Tahmini DPS kazancı / fiyat en yüksek kart; zayıf kolu gerekirse satar',
    phases: [{
      score(H, c){
        const d = H.cardDef(c);
        if(c.kind === 'weapon'){
          let gain;
          if(H.emptyArm() >= 0) gain = H.estDps(d, 1);
          else if(H.hasLv1(c.id)) gain = H.estDps(d, 2) - H.estDps(d, 1);
          else return 0;                       // yedeğe gider, işe yaramaz
          return gain / d.price;
        }
        return trinketUtility(H, d) / H.price(c);
      },
      makeRoom(H){
        if(H.emptyArm() >= 0) return false;
        const weak = H.weakestArm(); if(!weak) return false;
        const W = H.W();
        const better = H.cards().some(c => !c.sold && c.kind === 'weapon' && !H.ownsType(c.id)
          && H.price(c) <= H.gold() + H.call('sellPrice', weak.it)
          && H.estDps(W[c.id], 1) > weak.v * 1.6);
        return better ? H.sell(weak.r) : false;
      },
      maxRerolls: H => H.gold() >= 12 ? 3 : 0,
      reserve: () => 8
    }]
  },

  /* (d) Tılsım ağırlıklı: az sayıda silah (4 + dalga/4), altının kalanı
     dmg/crit/spd (+ ek kol) tılsımlarına; tılsım bulmak için reroll. */
  trinket: {
    desc: 'Birkaç silah, sonra dmg/crit/spd tılsımları yığar',
    phases: [
      {   /* asgari silah */
        score(H, c){
          if(c.kind !== 'weapon') return 0;
          const target = Math.min(H.P().arms.length, 5 + Math.floor(H.wave() / 3));
          if(H.weaponCount() >= target && !(H.emptyArm() < 0 && H.hasLv1(c.id))) return 0;
          return H.estDps(H.cardDef(c), 1) / H.price(c);
        }
      },
      {   /* tılsımlar */
        score(H, c){
          if(c.kind === 'weapon') return 0;
          const t = H.cardDef(c);
          const pref = { dmg: 10, crit: 9, spd: 8, arm: 3, hp: 2, bench: 0, gold: H.wave() <= 4 ? 4 : 0 };
          return pref[t.id] != null ? pref[t.id] : 1;
        },
        maxRerolls: H => H.gold() >= 12 ? 3 : 0,
        reserve: () => 10
      },
      {   /* kalan altın → geliştirme */
        score(H, c){
          if(c.kind !== 'weapon') return 0;
          if(H.emptyArm() >= 0) return H.estDps(H.cardDef(c), 1) / H.price(c) * 0.5;
          return H.hasLv1(c.id) ? 1 : 0;
        }
      }
    ]
  }
};


/* =========================================================================
   F1 BOTLARI (DESIGN.md F1) — tasarımcının bots.js politikasının taşınmış hâli.
   Farklar: RATING statik tablo değil, oyundan ölçülen puan (H.rating);
   archetype odak listeleri sınıflardan türetilir; satış/yenileme oyunun
   butonlarıyla; birleştirmeden sonra yedekteki silah boş kola taşınır.
========================================================================= */
/* Tılsım öncelikleri (e = boş yuva sayısı). Bilinmeyen id → _default. */
const TR = {
  base: { arm:(P,e)=>P.gold>=45?40:-1, hp:(P,e)=>e?-1:12, dmg:(P,e)=>e?-1:14, spd:(P,e)=>e?-1:13,
          crit:(P,e)=>e?-1:9, bench:(P,e)=>e?-1:6, gold:(P,e)=>P.wave<=5?15:-1,
          guard:(P,e)=>e?-1:12, regen:(P,e)=>e?-1:10, reach:(P,e)=>e?-1:8, _default:(P,e)=>e?-1:8 },
  good: { arm:(P,e)=>e>1?-1:35, hp:(P,e)=>e>1?-1:9, dmg:(P,e)=>e>1?-1:18, spd:(P,e)=>e>1?-1:17,
          crit:(P,e)=>e>1?-1:12, bench:(P,e)=>e>1?-1:14, gold:(P,e)=>(P.wave<=4&&e<=5)?20:-1,
          guard:(P,e)=>e>1?-1:13, regen:(P,e)=>e>1?-1:11, reach:(P,e)=>e>1?-1:11, _default:(P,e)=>e>1?-1:10 }
};
const POL = {};
/* shield: Kabuk Kalkanı kullanma becerisi (0..1; büyük/telegraflı tehditte basma olasılığı),
   mark: Odak İşareti (Kement/boss/elit), arrange: Komşu Bağı yerleşimi. İnsan oyuncuyu modeller. */
POL.kotu  = { name:'kotu', shield:0, mark:false, arrange:false, repair:0, randomWeapons:true, randomTrinkets:true, randomMutation:true, dupBonus:0, sell:false,
              rerolls:0, rerollMin:99, trk:TR.base, goldUntil:0,
              desc:'Rastgele silah, %30 rastgele tılsım, satış/yenileme yok, sadece otomatik birleştirme' };
POL.orta  = { name:'orta', shield:0.5, mark:true, arrange:true, repair:0.5, polish:true, polishReserve:0, dupBonus:8, sell:true, sellLv2:false, rerolls:2, rerollMin:14, trk:TR.base, goldUntil:5,
              desc:'Açgözlü puan; tekrar eden türe +8, kopya için Lv1 satar, 2 yenileme (≥14💰), tılsım kollar dolunca' };
POL.zayif = Object.assign({}, POL.orta, { name:'zayif', shield:0.2, mark:false, arrange:false, repair:0.3, polish:false, dupBonus:0, sell:false, rerolls:0, rerollMin:99, goldUntil:0,
              randomMutation:true, desc:'Puana göre açgözlü alım, satış/yenileme yok' });
POL.iyi   = { name:'iyi', shield:0.8, mark:true, arrange:true, repair:0.65, polish:true, polishReserve:0, dupBonus:14, sell:true, sellLv2:true, rerolls:6, rerollMin:8, trk:TR.good, goldUntil:6 };
POL.iyi2  = Object.assign({}, POL.iyi, { name:'iyi2', rerolls:10, rerollMin:6, focusTop:10,
              desc:'En güçlü 10 türe odaklanır, 10 yenileme, Lv2 satabilir' });
/* Archetype'lar: sınıf(lar)a göre 8 tür (sınıftakiler puana göre, eksikse en iyi diğerleri) */
const ARCHETYPES = { mermi:['Mermi'], buyuates:['Buyu','Ates'], yakin:['Yakin'], cubuk:['Cubuk'], uzun:['Uzun'], kan:['Kan'], kontrol:['Kontrol'] };
for(const [k, cls] of Object.entries(ARCHETYPES))
  POL[k] = Object.assign({}, POL.iyi, { name:k, focusClasses:cls, desc:`Archetype: ${cls.join('+')} sınıflı 8 türe odak` });

/* Referans botlar: kalkan/işaret kullanmayan eşler (aktif girdinin etkisini ölçmek için) */
POL.iyi2n = Object.assign({}, POL.iyi2, { name:'iyi2n', shield:0, mark:false, desc:'iyi2, ama kalkan/işaret kullanmaz (referans)' });
/* Deney varyantları: yalnız kalkan / yalnız işaret */
POL.iyi2s = Object.assign({}, POL.iyi2, { name:'iyi2s', mark:false, desc:'iyi2, yalnız kalkan (deney)' });
POL.iyi2m = Object.assign({}, POL.iyi2, { name:'iyi2m', shield:0, desc:'iyi2, yalnız işaret (deney)' });
POL.ortan = Object.assign({}, POL.orta, { name:'ortan', shield:0, mark:false, desc:'orta, ama kalkan/işaret kullanmaz (referans)' });

/* İnsan girdisi modeli (autoShield/autoMark): her sim adımında çağrılır.
   Kalkan: büyük (≥ maks canın %4'ü) ve telegraflı/uçan bir hasar 0,55 sn içinde geliyorsa, o tehdit için
   bir kez `shield` olasılığıyla basar (beceri). Panik: can < %40 iken saniyede ~shield/2 olasılıkla basar.
   İşaret: menzildeki Kement > boss > elit. */
function makeInputBot(A, rng, pol){
  const sk = pol.shield || 0;
  let decided = null, markT = 0;
  return function tick(dt){
    if(!sk && !pol.mark) return;
    const P = A.g('P');
    if(pol.mark){
      markT -= dt;
      if(markT <= 0){
        markT = 0.5;
        if(!P.mark || P.mark.hp <= 0){
          const t = A.fn('bestMarkTarget')(300 * A.g('S'));
          if(t) A.fn('markAt')(t.x, t.y);
        }
      }
    }
    if(sk && P.shT <= 0 && P.shCd <= 0){
      let tmin = Infinity;
      const thr = 0.04 * P.maxHp;
      for(const th of A.fn('shieldThreats')()) if(th.d >= thr && th.t < tmin) tmin = th.t;
      if(tmin > 0.9) decided = null;
      else if(tmin <= 0.55 && tmin >= 0.03){
        if(decided === null) decided = rng() < sk;
        if(decided){ A.fn('useShield')(); decided = null; }
      }else if(P.hp < 0.4 * P.maxHp && rng() < sk * 0.5 * dt) A.fn('useShield')();
    }
  };
}

function focusList(H, pol){
  const W = H.W(), ids = Object.keys(W);
  const byR = (a,b) => H.rating(b) - H.rating(a);
  if(pol.focusTop) return ids.sort(byR).slice(0, pol.focusTop);
  if(pol.focusClasses){
    const has = id => (W[id].cls || []).some(c => pol.focusClasses.includes(c));
    const prim = ids.filter(has).sort(byR);
    const rest = ids.filter(id => !has(id)).sort(byR);
    return prim.slice(0, 8).concat(rest).slice(0, 8);
  }
  return null;
}

function f1ShopTurn(H, pol){
  const P = H.P();
  if(pol.repair) H.repairTo(pol.repair);           // önce can: hasar kalıcı
  let rerolls = 0;
  const skip = new Set();
  for(let guard=0; guard<60; guard++){
    H.autoMerge();
    const S = H.refs().map(r => ({ r, it: H.slot(r) }));
    const empty = S.filter(s => !s.it), owned = S.filter(s => s.it);
    const ownTypes = new Set(owned.map(s => s.it.type));
    let best = null, bs = -1e9;
    H.cards().forEach((c, i) => {
      if(c.sold || skip.has(i)) return;
      const d = H.cardDef(c); if(!d) return;
      const price = H.price(c);
      if(price > H.gold()) return;
      let sc, needSell = false;
      if(c.kind === 'weapon'){
        const R = H.rating(c.id);
        const lv1 = owned.some(s => s.it.type === c.id && s.it.lv === 1);
        const any = ownTypes.has(c.id);
        const inF = pol.focus && pol.focus.includes(c.id);
        if(pol.focus && !inF && !empty.length) return;
        if(empty.length) sc = (pol.randomWeapons ? H.rng() * 20 : R) + (any ? pol.dupBonus : 0);
        else if(lv1) sc = 30 + R;
        else if(any && pol.sell){ sc = 5 + R; needSell = true; }
        else return;
        if(inF) sc += 25;
      }else{
        if(H.trkCount(d.id) >= (d.cap ?? Infinity)) return;
        if(d.id === 'gold' && P.wave > pol.goldUntil) return;
        if(pol.randomTrinkets) sc = H.rng() < 0.3 ? 5 : -1;
        else if(!Number.isFinite(d.cap)){
          /* Tavansız tılsım (örn. inci): sonsuza kadar alınmasın — sadece kollar dolu VE
             tavanlı diğer tüm tılsımlar zaten tavandaysa (harcanacak başka şey yoksa) düşün. */
          if(empty.length) return;
          const T = H.T();
          const others = Array.isArray(T) ? T : Object.values(T);
          const othersCapped = others.every(o => o.id === d.id || !Number.isFinite(o.cap) || H.trkCount(o.id) >= o.cap);
          if(!othersCapped) return;
          sc = (pol.trk[d.id] || pol.trk._default)(P, empty.length);
        }
        else sc = (pol.trk[d.id] || pol.trk._default)(P, empty.length);
      }
      if(sc > bs){ bs = sc; best = { c, i, needSell }; }
    });
    if(best && bs > 0){
      if(best.needSell){
        const inF = t => pol.focus && pol.focus.includes(t) ? 1 : 0;
        const cand = owned.filter(s => s.it.type !== best.c.id)
          .sort((a,b) => (inF(a.it.type) - inF(b.it.type)) || (a.it.lv - b.it.lv) || (H.rating(a.it.type) - H.rating(b.it.type)));
        if(!cand.length || (cand[0].it.lv >= 2 && !pol.sellLv2) || !H.sell(cand[0].r)){ skip.add(best.i); continue; }
      }
      if(!H.buy(best.i)) skip.add(best.i);
      continue;
    }
    if(rerolls < pol.rerolls && H.gold() >= pol.rerollMin && H.reroll()){ rerolls++; skip.clear(); continue; }
    break;
  }
  H.autoMerge();
  if(pol.arrange) H.arrange();
  if(pol.polish) H.polishAll(pol.polishReserve || 0);
}

/* Mutasyon seçimi (C6). Kural: kötü/zayıf rastgele; diğerleri hasar > saldırı hızı > can. */
const MUT_PRI = { basinc: 3, refleks: 2, ucYurek: 1 };
function mutationScore(def){
  const id = def.id || '', txt = `${def.name||''} ${def.desc||def.txt||''}`.toLowerCase();
  if(MUT_PRI[id] != null) return MUT_PRI[id];
  if(/hasar\s*\+/.test(txt) && !/alınan hasar/.test(txt)) return 3;
  if(/saldırı hızı/.test(txt)) return 2;
  if(/\bcan\b/.test(txt)) return 1;
  return 0.5;
}
function resolveMutation(A, card){
  const T = A.mutationTable();
  const find = id => Array.isArray(T) ? T.find(m => m && m.id === id) : (T && T[id] ? Object.assign({ id }, T[id]) : null);
  if(typeof card === 'string') return find(card) || { id: card };
  if(typeof card === 'number') return (Array.isArray(T) && T[card]) || { id: String(card) };
  if(card && typeof card === 'object'){
    const base = card.id ? find(card.id) : (card.idx != null && Array.isArray(T) ? T[card.idx] : null);
    return Object.assign({}, base || {}, card);
  }
  return { id: '?' };
}
function pickMutationFor(A, H, pol, rec){
  const cards = A.mutationCards() || [];
  const n = cards.length || 3;
  let idx = 0;
  if(pol.randomMutation || !cards.length) idx = Math.floor(H.rng() * n);
  else {
    let bs = -1;
    cards.forEach((c, i) => { const s = mutationScore(resolveMutation(A, c)); if(s > bs){ bs = s; idx = i; } });
  }
  const def = cards.length ? resolveMutation(A, cards[idx]) : { id: '?' };
  A.fn('pickMutation')(idx);
  rec.mutations.push(`${H.wave()}:${def.id}`);
}

/* Bot kaydı: F1 botları + eski botlar tek arayüzde */
function makeBot(name, H, opts){
  if(POL[name]){
    const pol = Object.assign({}, POL[name]);
    pol.focus = focusList(H, pol);
    return { name, pol, shop: () => f1ShopTurn(H, pol), desc: pol.desc };
  }
  if(STRATEGIES[name]){
    const bot = Object.create(STRATEGIES[name]);
    H.bot = bot;
    if(bot.init) bot.init(H, opts);
    return { name, pol: { randomMutation: false }, shop: () => shopLoop(H, bot), desc: bot.desc };
  }
  throw new Error('Bilinmeyen bot: ' + name);
}
const F1_BOTS = ['kotu','zayif','orta','iyi2','mermi','buyuates','yakin','cubuk','uzun','kan','kontrol'];
const REF_BOTS = ['iyi2n','ortan'];
const EXP_BOTS = ['iyi2s','iyi2m'];
const LEGACY_BOTS = Object.keys(STRATEGIES);
const BOT_DESC = Object.fromEntries([...F1_BOTS.map(k => [k, POL[k].desc]), ...REF_BOTS.map(k => [k, POL[k].desc]), ...EXP_BOTS.map(k => [k, POL[k].desc]), ...LEGACY_BOTS.map(k => [k, STRATEGIES[k].desc])]);

/* Tasarımcının statik RATING tablosu (DESIGN.md çalışmasındaki bots.js) — --rating designer ile */
const DESIGNER_RATING = { tabanca:18, midye:19, zipkin:15, taramali:17, pompali:16, vampir:13, levye:20, kurek:17,
  yumruk:19, bumerang:20, asa:19, yildirim:20, zehir:14, buz:9, murekkep:6, alev:18, testere:17, mancinik:18, diken:19 };

module.exports = { makeHelpers, makeBot, makeInputBot, pickMutationFor, focusList, F1_BOTS, REF_BOTS, LEGACY_BOTS, BOT_DESC, POL, ARCHETYPES,
                   STRATEGIES, DESIGNER_RATING, shopLoop };
