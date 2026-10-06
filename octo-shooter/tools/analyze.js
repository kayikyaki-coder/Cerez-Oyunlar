#!/usr/bin/env node
'use strict';
/* =========================================================================
   analyze.js — sim.js --json çıktısını özetler (önce/sonra karşılaştırması için)
   Kullanım: node analyze.js out.json [diger.json]
   Çıktı: bot başına medyan ölüm dalgası, sıfır-hasar dalga payı (w6–20), hasar kaynağı dağılımı,
          boss karşılaşma kaydı, silah seçilme (son kadroda) ve hasar payı, tılsım alım ortalaması.
   İki dosya verilirse silah/tılsım tablosu yan yana (önce | sonra) yazılır.
========================================================================= */
const fs = require('fs');
function q(a, p){ const s = a.filter(Number.isFinite).sort((x, y) => x - y); if(!s.length) return NaN;
  const pos = (s.length - 1) * p, lo = Math.floor(pos), hi = Math.ceil(pos); return s[lo] + (s[hi] - s[lo]) * (pos - lo); }
const f1 = x => Number.isFinite(x) ? (Math.round(x * 10) / 10).toString() : '-';
const pct = x => Number.isFinite(x) ? (x * 100).toFixed(1) + '%' : '-';
const pad = (s, n) => { s = String(s); return s.length >= n ? s : s + ' '.repeat(n - s.length); };
const lpad = (s, n) => { s = String(s); return s.length >= n ? s : ' '.repeat(n - s.length) + s; };

function load(file){
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  const runs = (j.runs || []).filter(r => !r.cheat);
  return { j, runs };
}
function dw(r, cap){ return r.reachedCap ? cap + 1 : (r.deathWave ?? NaN); }

function perBot(runs, cap){
  const by = {};
  for(const r of runs) (by[r.bot] = by[r.bot] || []).push(r);
  const out = {};
  for(const b in by){
    const rs = by[b], w = rs.map(r => dw(r, cap));
    let z = 0, t = 0, big = 0;
    for(const r of rs) (r.waves || []).forEach((_, j) => {
      const wv = r.startWave + j;
      if(wv < 6 || wv > 20 || r.deathWave === wv || !r.waveTaken) return;
      t++; if(r.waveTaken[j] <= 0.001 && !(r.waveBlocked && r.waveBlocked[j] > 0)) z++;
    });
    out[b] = { n: rs.length, med: q(w, .5), p10: q(w, .1), p90: q(w, .9), min: Math.min(...w), max: Math.max(...w),
               zero: t ? z / t : NaN, parries: rs.reduce((a, r) => a + (r.parries || 0), 0) / rs.length };
  }
  return out;
}
function takenDist(runs){
  const s = {}; let tot = 0;
  for(const r of runs) for(const k in (r.taken || {})){ s[k] = (s[k] || 0) + r.taken[k]; tot += r.taken[k]; }
  return Object.entries(s).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v / Math.max(1, tot)]);
}
function bossStats(runs){
  const by = {};
  for(const r of runs) for(const b of (r.bossLog || [])){
    const k = `${b.type}@w${b.wave}`; const o = by[k] = by[k] || { n: 0, reach: 0, dealt: 0, life: [], alive: 0 };
    o.n++; if(b.reach) o.reach++; o.dealt += b.dealt; o.life.push(b.life); if(b.alive) o.alive++;
  }
  return by;
}
function weaponTable(runs){
  const pick = {}, share = {}; let n = 0;
  for(const r of runs){
    n++;
    const seen = new Set((r.finalBuild.arms || []).filter(Boolean).map(x => x.split(':')[0]));
    for(const id of seen) pick[id] = (pick[id] || 0) + 1;
    for(const k in r.dmgShare) share[k] = (share[k] || 0) + r.dmgShare[k];
  }
  const out = {};
  for(const id of new Set([...Object.keys(pick), ...Object.keys(share)])) out[id] = { pick: (pick[id] || 0) / n, share: (share[id] || 0) / n };
  return out;
}
function trinketTable(runs){
  const s = {}; let n = 0;
  for(const r of runs){ n++; for(const k in r.bought) if(k.startsWith('trk:')) s[k.slice(4)] = (s[k.slice(4)] || 0) + r.bought[k]; }
  const o = {}; for(const k in s) o[k] = s[k] / n; return o;
}

const files = process.argv.slice(2);
if(!files.length){ console.log('kullanım: node analyze.js out.json [diger.json]'); process.exit(1); }
const D = files.map(load);
D.forEach((d, i) => {
  const cap = (d.j.meta && d.j.meta.opts && d.j.meta.opts.maxWave) || 45;
  console.log(`\n=== ${files[i]} (${d.runs.length} koşu) ===`);
  const pb = perBot(d.runs, cap);
  console.log(pad('bot', 10) + lpad('n', 4) + lpad('p10/med/p90', 14) + lpad('min–maks', 10) + lpad('tehditsiz w6–20', 19) + lpad('savuş/koşu', 12));
  for(const b in pb){ const x = pb[b];
    console.log(pad(b, 10) + lpad(x.n, 4) + lpad(`${f1(x.p10)}/${f1(x.med)}/${f1(x.p90)}`, 14) + lpad(`${x.min}–${x.max}`, 10) + lpad(pct(x.zero), 19) + lpad(f1(x.parries), 12)); }
  const td = takenDist(d.runs);
  if(td.length) console.log('alınan hasar kaynakları: ' + td.slice(0, 8).map(([k, v]) => `${k} ${pct(v)}`).join(', ') + `  | ilk3 ${pct(td.slice(0, 3).reduce((a, [, v]) => a + v, 0))}`);
  const bs = bossStats(d.runs);
  const keys = Object.keys(bs).sort((a, b) => Number(a.split('@w')[1]) - Number(b.split('@w')[1]));
  if(keys.length){
    console.log('boss kaydı (tür@dalga: n, ulaşma, ort. verdiği hasar, ort. ömür sn):');
    for(const k of keys){ const o = bs[k]; console.log(`  ${pad(k, 16)} n=${o.n} ulaşma ${pct(o.reach / o.n)} hasar ${Math.round(o.dealt / o.n)} ömür ${f1(o.life.reduce((a, v) => a + v, 0) / o.n)} (canlıyken ölüm ${o.alive})`); }
  }
});
/* silah/tılsım tablosu: tüm F1 botları birlikte; iki dosya varsa yan yana */
const W = D.map(d => weaponTable(d.runs.filter(r => !/n$/.test(r.bot) || r.bot === 'kan')));
const ids = [...new Set(W.flatMap(w => Object.keys(w)))].filter(k => !k.startsWith('_') && !k.startsWith('?')).sort((a, b) => (W[W.length - 1][b]?.share || 0) - (W[W.length - 1][a]?.share || 0));
console.log('\nSilah: son kadroda bulunma % | koşu başına hasar payı % ' + (D.length > 1 ? '(önce → sonra)' : ''));
for(const id of ids){
  console.log(pad(id, 11) + W.map(w => `${lpad(((w[id]?.pick || 0) * 100).toFixed(0), 4)}% | ${lpad(((w[id]?.share || 0) * 100).toFixed(1), 5)}%`).join('   →   '));
}
const T = D.map(d => trinketTable(d.runs.filter(r => !/n$/.test(r.bot) || r.bot === 'kan')));
const tids = [...new Set(T.flatMap(t => Object.keys(t)))].sort();
console.log('\nTılsım: koşu başına ortalama alım ' + (D.length > 1 ? '(önce → sonra)' : ''));
for(const id of tids) console.log(pad(id, 8) + T.map(t => lpad((t[id] || 0).toFixed(1), 6)).join('   →   '));
