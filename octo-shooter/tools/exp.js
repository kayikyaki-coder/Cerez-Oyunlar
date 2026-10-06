#!/usr/bin/env node
'use strict';
/* =========================================================================
   exp.js — sabit-yapı deneyleri (bot yok): sinerji aç/kapa, Komşu Bağı, tılsım etkisi
   Her deney: aynı yapı, ölümsüz ahtapot (hp 1e9), dalga N; ölçüm = dalgayı bitirme süresi
   (oyun-sn, düşük = iyi) ve alınan toplam hasar (P.taken). Seed'ler eşleşik (A/B aynı tohum).
   Kullanım:
     node exp.js syn   [--wave 20] [--reps 12] [--file ../index.html]   her sınıf için sinerji açık/kapalı
     node exp.js bond  [--wave 20] [--reps 12]                           Komşu Bağı: en iyi vs en kötü yerleşim
     node exp.js trk   [--wave 22] [--reps 12]                           her tılsım +5 (ya da tavan) vs baz
========================================================================= */
const fs = require('fs');
const path = require('path');
const { loadGameFromHtml, createGame, compile, mixSeed } = require('./lib/game');

const argv = process.argv.slice(2);
const mode = argv[0] || 'syn';
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const FILE = path.resolve(arg('--file', path.join(__dirname, '..', 'index.html')));
const WAVE = Number(arg('--wave', 20)), REPS = Number(arg('--reps', 12));
const html = fs.readFileSync(FILE, 'utf8');
const info = loadGameFromHtml(html);
const compiled = compile(info);
const opts = { viewport: '390x844' };
const mean = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };
const f1 = x => (Math.round(x * 10) / 10).toString();

/* build: arms = ['tabanca:3', ...], pre(A, P): ek ayar (tılsım, sinerji kapatma) */
function runBuild(build, rep, pre){
  const { A } = createGame(compiled, info, opts, mixSeed('exp', mode, WAVE, rep));
  const P = A.g('P'), W = A.g('WEAPONS');
  while(P.arms.length < build.length) P.arms.push(null);
  P.arms = P.arms.map((_, i) => null);
  build.forEach((s, i) => { if(!s) return; const [t, lv] = s.split(':'); P.arms[i] = { type: t, lv: +lv, cdT: 0, aim: 0, uid: 100 + i }; });
  if(pre) pre(A, P);
  P.wave = WAVE; P.maxHp = P.hp = 1e9;
  A.fn('startWave')();
  let n = 0;
  const WS = A.g('WAVE_STATE');
  while(A.state() === WS && n < 60 * 240){ n += A.stepWave(1 / 60, 60); }
  const tk = A.g('P').taken || {};
  let taken = 0; for(const k in tk) taken += tk[k];
  return { t: n / 60, taken };
}
function ab(name, buildA, preA, buildB, preB){
  const ta = [], tb = [], da = [], db = [];
  for(let r = 0; r < REPS; r++){
    const a = runBuild(buildA, r, preA), b = runBuild(buildB, r, preB);
    ta.push(a.t); tb.push(b.t); da.push(a.taken); db.push(b.taken);
  }
  const dt = mean(tb) - mean(ta), se = Math.sqrt((sd(ta) ** 2 + sd(tb) ** 2) / REPS);
  console.log(`${name.padEnd(22)} süre açık ${f1(mean(ta))} kapalı ${f1(mean(tb))} → Δ ${f1(dt)} (±${f1(se)}) | alınan hasar açık ${Math.round(mean(da))} kapalı ${Math.round(mean(db))}` +
              (mean(db) > 0 ? ` (oran ${(mean(da) / mean(db)).toFixed(2)}×)` : ''));
  return { name, dt, se, dmgA: mean(da), dmgB: mean(db) };
}

const W = (() => { const { A } = createGame(compiled, info, opts, 1); return A.g('WEAPONS'); })();
const ids = Object.keys(W);
const CLASSES = (() => { const { A } = createGame(compiled, info, opts, 1); return Object.keys(A.g('CLASSES')); })();

if(mode === 'syn'){
  console.log(`Sinerji aç/kapa — dalga ${WAVE}, ${REPS} tekrar, 8 kol Lv3 (4 sınıf silahı + 4 dolgu), ölümsüz`);
  const out = [];
  for(const c of CLASSES){
    const has = ids.filter(id => W[id].cls.includes(c));
    const not = ids.filter(id => !W[id].cls.includes(c));
    const core = has.slice(0, 4);
    /* dolgu: bu sınıfa dahil olmayan, diğer sınıf sinerjilerini mümkün olduğunca tetiklemeyecek farklı sınıflı 4 silah */
    const fill = [];
    for(const id of not){ if(fill.length >= 4) break; fill.push(id); }
    const build = core.concat(fill).map(id => id + ':3');
    out.push(ab(c, build, null, build, (A) => { A.g('CLASSES')[c].thr = [99, 99, 99]; }));
  }
} else if(mode === 'bond'){
  console.log(`Komşu Bağı: en iyi vs en kötü yerleşim — dalga ${WAVE}, ${REPS} tekrar`);
  for(const cls of ['Yakin', 'Mermi', 'Buyu']){
    const pool = ids.filter(id => W[id].cls.includes(cls)).slice(0, 6).concat(ids.filter(id => !W[id].cls.includes(cls)).slice(0, 2));
    const arrangeBest = (A, P) => {
      const sc = A.fn('bondScore'); let best = sc(P.arms), imp = true, g = 0;
      while(imp && g++ < 40){ imp = false; for(let i = 0; i < P.arms.length; i++) for(let j = i + 1; j < P.arms.length; j++){
        const t = P.arms[i]; P.arms[i] = P.arms[j]; P.arms[j] = t; const s = sc(P.arms);
        if(s > best){ best = s; imp = true; } else { const u = P.arms[i]; P.arms[i] = P.arms[j]; P.arms[j] = u; } } }
    };
    const arrangeWorst = (A, P) => {
      const sc = A.fn('bondScore'); let best = sc(P.arms), imp = true, g = 0;
      while(imp && g++ < 40){ imp = false; for(let i = 0; i < P.arms.length; i++) for(let j = i + 1; j < P.arms.length; j++){
        const t = P.arms[i]; P.arms[i] = P.arms[j]; P.arms[j] = t; const s = sc(P.arms);
        if(s < best){ best = s; imp = true; } else { const u = P.arms[i]; P.arms[i] = P.arms[j]; P.arms[j] = u; } } }
    };
    const build = pool.map(id => id + ':3');
    ab(`bağ (${cls}+2 dolgu)`, build, arrangeBest, build, arrangeWorst);
  }
} else if(mode === 'trk'){
  console.log(`Tılsım etkisi (+5 ya da tavan, hangisi küçükse) — dalga ${WAVE}, ${REPS} tekrar, iyi2 benzeri 8 silah`);
  const base = ['kurek', 'levye', 'asa', 'kiskac', 'alev', 'pompali', 'buz', 'murekkep'].map(id => id + ':3');
  const tl = (() => { const { A } = createGame(compiled, info, opts, 1); return A.g('TRINKETS'); })();
  for(const t of tl){
    const n = Math.min(5, Number.isFinite(t.cap) ? t.cap : 5);
    ab(`${t.id} ×${n}`, base, (A, P) => { const ap = A.fn('applyTrinket'); const T = A.g('TRINKETS').find(x => x.id === t.id); for(let k = 0; k < n; k++) ap(T); },
       base, null);
  }
} else {
  console.log('mod: syn | bond | trk');
}
