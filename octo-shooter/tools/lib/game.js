'use strict';
/* =========================================================================
   lib/game.js — index.html'i node:vm içinde çalıştıran çekirdek
   (sahte DOM/canvas, seed'li Math.random, köprü script'i)
========================================================================= */
const vm = require('vm');
const crypto = require('crypto');
const fs = require('fs');
/* ---------------------------------------------------------------------
   SEED'Lİ RNG (mulberry32) + seed karma
--------------------------------------------------------------------- */
function mulberry32(a){
  a = a >>> 0;
  return function(){
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function mixSeed(...parts){
  const h = crypto.createHash('sha1').update(parts.join('|')).digest();
  return h.readUInt32LE(0);
}

/* ---------------------------------------------------------------------
   index.html → script blokları
--------------------------------------------------------------------- */
function loadGame(file){ return loadGameFromHtml(fs.readFileSync(file, 'utf8')); }
/* HTML metninden: ana iş parçacığı dosyayı BİR kez okur, worker'lara metni geçirir
   (koşu sırasında geliştirici dosyayı kaydederse karışık sürüm koşulmaz) */
function loadGameFromHtml(html){
  const scripts = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while((m = re.exec(html))){
    if(/\bsrc\s*=/.test(m[1])) continue;            // harici script'ler yok sayılır
    if(/type\s*=\s*["']?(?!text\/javascript|module)[^"'\s>]+/i.test(m[1]) && !/javascript/i.test(m[1])) continue;
    scripts.push(m[2]);
  }
  if(!scripts.length) throw new Error('index.html içinde <script> bulunamadı');
  /* HTML'de tanımlı id'ler — oyun olmayan bir id isterse uyarı veririz
     (tarayıcıda null → TypeError olurdu) */
  const ids = new Set();
  const idRe = /\sid\s*=\s*["']([^"']+)["']/g;
  while((m = idRe.exec(html))) ids.add(m[1]);
  const hash = crypto.createHash('sha1').update(html).digest('hex').slice(0, 12);
  return { html, scripts, ids, hash, lines: html.split('\n').length };
}

/* ---------------------------------------------------------------------
   SAHTE DOM / CANVAS
--------------------------------------------------------------------- */
function makeDom(knownIds, warn){
  const els = new Map();
  const gradient = { addColorStop(){}, width: 0 };
  const noop = function(){ return gradient; };
  const ctx2d = new Proxy({}, {
    get(t, p){ return (p in t) ? t[p] : noop; },
    set(t, p, v){ t[p] = v; return true; }
  });
  function classList(){
    const s = new Set();
    return {
      add: (...c) => c.forEach(x => s.add(x)),
      remove: (...c) => c.forEach(x => s.delete(x)),
      toggle(c, f){ const on = f===undefined ? !s.has(c) : !!f; on ? s.add(c) : s.delete(c); return on; },
      contains: c => s.has(c),
      get length(){ return s.size; }
    };
  }
  function makeEl(tag, id){
    const el = {
      tagName: String(tag||'div').toUpperCase(), id: id||'', style: {}, dataset: {},
      classList: classList(), children: [], _l: {},
      textContent: '', innerHTML: '', className: '', title: '', disabled: false,
      width: 300, height: 150,
      addEventListener(t, f){ (el._l[t] = el._l[t] || []).push(f); },
      removeEventListener(t, f){ const a = el._l[t]; if(a){ const i = a.indexOf(f); if(i>=0) a.splice(i,1); } },
      dispatch(t, ev){
        for(const f of (el._l[t]||[]).slice())
          f(Object.assign({type:t, target:el, currentTarget:el, button:0, clientX:0, clientY:0,
                           preventDefault(){}, stopPropagation(){}}, ev||{}));
      },
      click(){ el.dispatch('click'); },
      appendChild(c){ el.children.push(c); return c; },
      removeChild(c){ const i = el.children.indexOf(c); if(i>=0) el.children.splice(i,1); return c; },
      remove(){}, append(){}, prepend(){},
      querySelector(){ return null; }, querySelectorAll(){ return []; }, closest(){ return null; },
      getContext(){ return ctx2d; }, toDataURL(){ return ''; },
      setAttribute(){}, getAttribute(){ return null; }, focus(){}, blur(){},
      getBoundingClientRect(){ return {x:0,y:0,left:0,top:0,right:0,bottom:0,width:0,height:0}; }
    };
    return el;
  }
  const document = {
    getElementById(id){
      if(!els.has(id)){
        if(knownIds && !knownIds.has(id)) warn(`getElementById('${id}') — HTML'de böyle bir id yok (tarayıcıda null döner)`);
        els.set(id, makeEl('div', id));
      }
      return els.get(id);
    },
    createElement(tag){ return makeEl(tag); },
    body: makeEl('body'), documentElement: makeEl('html'), head: makeEl('head'),
    elementFromPoint(){ return null; },
    addEventListener(){}, removeEventListener(){},
    querySelector(){ return null; }, querySelectorAll(){ return []; },
    hidden: false, visibilityState: 'visible'
  };
  return { document, els };
}
function memStorage(){
  const m = new Map();
  return { getItem:k => m.has(k) ? m.get(k) : null, setItem:(k,v) => m.set(k, String(v)),
           removeItem:k => m.delete(k), clear:() => m.clear(), key:i => [...m.keys()][i] ?? null,
           get length(){ return m.size; } };
}

/* ---------------------------------------------------------------------
   KÖPRÜ — oyun bağlamına enjekte edilir. Oyun kodunun top-level let/const
   bağlamlarına (P, state, shopCards, waveDmg…) aynı realm'deki sonraki
   script erişebilir; böylece index.html'e hook eklemeden içini okuruz.
--------------------------------------------------------------------- */
const BRIDGE = `
(function(){
  var __g = function(n){ try { return eval(n); } catch(e){ return undefined; } };
  var __set = function(n, v){ try { globalThis.__tmpv = v; eval(n + ' = globalThis.__tmpv'); return true; } catch(e){ return false; } };
  /* Çizim → no-op (hız). İsim yoksa / const ise sessizce geçilir. */
  ['drawBackground','drawOctopus','drawEntities','drawEnemy','drawStatusDots',
   'drawShopOcto','buildBg','seedBubbles'].forEach(function(n){
    try { if(typeof eval(n) === 'function') eval(n + ' = function(){}'); } catch(e){}
  });
  try { if(typeof iconURL === 'function') iconURL = function(){ return ''; }; } catch(e){}
  /* Hasar sayıları görsel; kapatmak oynanışı değiştirmez */
  __set('dmgNumMode', 2);

  /* Dalga sonu / ölümde hasar anlık görüntüsü (uid → silah türü eşlemesiyle) */
  var snaps = [];
  function snap(kind){
    try {
      var map = {}, refs = allRefs(), ut = __g('uidType');
      if(ut) for(var u in ut) map['u'+u] = ut[u];     // yeni sürüm: satılan/birleşen örnekler de çözülür
      for(var i=0;i<refs.length;i++){ var it = getSlot(refs[i]); if(it && it.uid != null) map['u'+it.uid] = it.type; }
      var wd = __g('waveDmg') || {};
      snaps.push({kind: kind, wave: __g('P').wave, dmg: Object.assign({}, wd), map: map});
    } catch(e){ snaps.push({kind: kind, error: String(e)}); }
  }
  try { var _ew = endWave; endWave = function(){ snap('end'); return _ew.apply(this, arguments); }; } catch(e){}
  try { var _go = gameOver; gameOver = function(){ snap('over'); return _go.apply(this, arguments); }; } catch(e){}

  var fnCache = {};
  globalThis.__OCTO_SIM = {
    g: __g, set: __set, snaps: snaps,
    fn: function(n){ return fnCache[n] || (fnCache[n] = __g(n)); },
    state: function(){ return __g('state'); },
    maxEnemies: 0, maxEnemiesWave: 0,
    /* Dalga içinde en fazla maxSteps adım; durum değişince durur.
       Aynı anda ekrandaki azami düşman sayısı da izlenir (F2 #14). */
    stepWave: function(dt, maxSteps){
      var n = 0, WS = __g('WAVE_STATE'), S = globalThis.__OCTO_SIM;
      while(n < maxSteps && state === WS){
        updateWave(dt); n++;
        if(enemies.length > S.maxEnemies){ S.maxEnemies = enemies.length; S.maxEnemiesWave = P.wave; }
      }
      return n;
    },
    /* ---- C6 Mutasyon ekranı (savunmacı): hook yoksa hepsi null/false döner ----
       Gerçek oyun (index.html) state'i SHOP_STATE'te tutup mutationChoices (dizi/null)
       + isMutationOpen() ile ekranın açık olup olmadığını bildirir; MUTATION_STATE yok. */
    mutationState: function(){ var v = __g('MUTATION_STATE'); return v === undefined ? null : v; },
    mutationCards: function(){
      var names = ['mutCards','mutationCards','mutChoices','mutationChoices','mutOffer','mutOptions','perkCards','perkChoices'];
      for(var i=0;i<names.length;i++){ var v = __g(names[i]); if(Array.isArray(v) && v.length) return v; }
      return null;
    },
    mutationTable: function(){ return __g('MUTATIONS') || __g('PERKS') || null; },
    canPickMutation: function(){ return typeof __g('pickMutation') === 'function'; },
    /* Ekran açık mı? Önce oyunun kendi isMutationOpen()'ı, yoksa MUTATION_STATE, yoksa kart dizisi. */
    isMutationOpen: function(){
      var f = __g('isMutationOpen');
      if(typeof f === 'function') return !!f();
      var MS = this.mutationState();
      if(MS !== null) return state === MS;
      var c = this.mutationCards();
      return !!(c && c.length);
    }
  };
})();
`;

/* ---------------------------------------------------------------------
   OYUN ÖRNEĞİ
--------------------------------------------------------------------- */
function createGame(compiled, gameInfo, opts, seed){
  const warnings = [];
  const warn = m => { if(!warnings.includes(m)) warnings.push(m); };
  const { document, els } = makeDom(gameInfo.ids, warn);
  const [VW, VH] = String(opts.viewport).split('x').map(Number);
  let fakeNow = 0;
  const consoleErrors = [];
  const sandbox = {
    document,
    console: {
      log(){}, info(){}, debug(){},
      warn: (...a) => warn('console.warn: ' + a.join(' ')),
      error: (...a) => consoleErrors.push(a.map(String).join(' '))
    },
    innerWidth: VW, innerHeight: VH, devicePixelRatio: 1,
    requestAnimationFrame: () => 0, cancelAnimationFrame(){},
    setTimeout: () => 0, clearTimeout(){}, setInterval: () => 0, clearInterval(){},
    matchMedia: () => ({ matches: false, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){} }),
    performance: { now: () => fakeNow },
    localStorage: memStorage(), sessionStorage: memStorage(),
    Image: class { constructor(){ this.onload = null; this.src = ''; this.width = 0; this.height = 0; } },
    navigator: { userAgent: 'octo-sim', maxTouchPoints: 0, vibrate(){ return false; } },
    location: { href: 'file:///octo-sim/index.html', search: '', hash: '', reload(){} },
    addEventListener(){}, removeEventListener(){},
    __rng: mulberry32(seed)
  };
  sandbox.window = sandbox; sandbox.self = sandbox;
  vm.createContext(sandbox, { name: 'octo-sim' });
  vm.runInContext('Math.random = __rng;', sandbox);
  for(const s of compiled.scripts) s.runInContext(sandbox);
  compiled.bridge.runInContext(sandbox);
  const A = sandbox.__OCTO_SIM;
  A.el = id => document.getElementById(id);
  A.advanceClock = ms => { fakeNow += ms; };
  return { A, warnings, consoleErrors, sandbox, els };
}

function compile(gameInfo){
  return {
    scripts: gameInfo.scripts.map((s, i) => new vm.Script(s, { filename: `index.html#script${i}` })),
    bridge: new vm.Script(BRIDGE, { filename: 'sim-bridge.js' })
  };
}

module.exports = { mulberry32, mixSeed, loadGame, loadGameFromHtml, makeDom, createGame, compile, BRIDGE };
