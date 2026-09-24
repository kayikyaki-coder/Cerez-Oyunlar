'use strict';
/* lib/report.js — normal (kabul dışı) simülasyon özeti */
/* ---------------------------------------------------------------------
   İSTATİSTİK + RAPOR
--------------------------------------------------------------------- */
function quantile(sorted, q){
  if(!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
const fmt = (x, d=1) => Number.isFinite(x) ? x.toFixed(d) : '-';
function pad(s, n){ s = String(s); return s.length >= n ? s : s + ' '.repeat(n - s.length); }
function lpad(s, n){ s = String(s); return s.length >= n ? s : ' '.repeat(n - s.length) + s; }

function summarize(runs, opts, gameInfo, WMAP){
  const byS = {};
  for(const r of runs) (byS[r.strategy] = byS[r.strategy] || []).push(r);
  const weaponIds = Object.keys(WMAP);
  const out = { strategies: {}, weaponsNeverBought: [], weaponAvgShare: {}, anomalies: 0, errors: 0 };
  for(const s in byS){
    const rs = byS[s];
    const dw = rs.map(r => r.reachedCap ? opts.maxWave + 1 : (r.deathWave ?? NaN)).filter(Number.isFinite).sort((a,b) => a-b);
    const mins = rs.map(r => r.estRealSec / 60).sort((a,b) => a-b);
    const ig = rs.map(r => r.inGameSec / 60).sort((a,b) => a-b);
    const hist = {};
    for(const r of rs){ const k = r.reachedCap ? `>${opts.maxWave}` : (r.deathWave ?? 'hata'); hist[k] = (hist[k] || 0) + 1; }
    const share = {};
    for(const r of rs) for(const k in r.dmgShare) share[k] = (share[k] || 0) + r.dmgShare[k];
    for(const k in share) share[k] = share[k] / rs.length;
    const bought = {};
    for(const r of rs) for(const k in r.bought) bought[k] = (bought[k] || 0) + r.bought[k];
    const syn = {};
    for(const r of rs) for(const c in r.synergies) syn[c] = (syn[c] || 0) + 1;
    const waveLens = rs.flatMap(r => r.waves);
    out.strategies[s] = {
      runs: rs.length,
      deathWave: { p10: quantile(dw, .1), median: quantile(dw, .5), p90: quantile(dw, .9), mean: dw.reduce((a,b)=>a+b,0)/dw.length },
      estMinutes: { p10: quantile(mins, .1), median: quantile(mins, .5), p90: quantile(mins, .9) },
      inGameMinutesMedian: quantile(ig, .5),
      avgWaveSec: waveLens.reduce((a,b)=>a+b,0) / Math.max(1, waveLens.length),
      maxWaveSec: Math.max(0, ...waveLens),
      reachedCap: rs.filter(r => r.reachedCap).length,
      avgTotalGold: rs.reduce((a,r) => a + r.totalGold, 0) / rs.length,
      histogram: hist,
      dmgShare: Object.fromEntries(Object.entries(share).sort((a,b) => b[1]-a[1])),
      bought,
      neverBought: weaponIds.filter(id => !bought[id]),
      synergyRate: Object.fromEntries(Object.entries(syn).map(([k,v]) => [k, v / rs.length])),
      errors: rs.reduce((a,r) => a + r.errors.length, 0),
      anomalies: rs.reduce((a,r) => a + r.anomalies.length, 0)
    };
    out.errors += out.strategies[s].errors;
    out.anomalies += out.strategies[s].anomalies;
  }
  const allBought = {};
  const allShare = {};
  for(const r of runs){
    for(const k in r.bought) allBought[k] = (allBought[k] || 0) + r.bought[k];
    for(const k in r.dmgShare) allShare[k] = (allShare[k] || 0) + r.dmgShare[k];
  }
  for(const k in allShare) allShare[k] /= runs.length;
  out.weaponAvgShare = Object.fromEntries(Object.entries(allShare).sort((a,b) => b[1]-a[1]));
  out.weaponsNeverBought = weaponIds.filter(id => !allBought[id]);
  out.weaponsBoughtButLowShare = weaponIds.filter(id => allBought[id] && (allShare[id] || 0) < 0.01);
  out.boughtTotals = allBought;
  return out;
}

function printSummary(sum, runs, opts, gameInfo, elapsedMs, WMAP){
  const W = WMAP;
  const nm = id => W[id] ? `${W[id].name} (${id})` : id;
  const L = [];
  L.push('');
  L.push(`=== Octo-Shooter denge simülasyonu — index.html ${gameInfo.hash} (${gameInfo.lines} satır) ===`);
  L.push(`koşu/strateji=${opts.runs} seed=${opts.seed} puan=${opts.rating} maxWave=${opts.maxWave} dt=1/${opts.fps} viewport=${opts.viewport} ` +
         `market=${opts.shopEarly}sn(≤${opts.shopEarlyUntil})/${opts.shopLate}sn hız=${opts.playSpeed}x  süre=${(elapsedMs/1000).toFixed(1)}sn`);
  L.push('');
  L.push(pad('strateji', 9) + lpad('ölüm dalgası p10/med/p90', 26) + lpad('tahmini dk p10/med/p90', 26) +
         lpad('oyun-içi dk', 12) + lpad('ort.dalga sn', 13) + lpad('ort.altın', 10) + lpad('cap', 5) + lpad('hata', 6));
  for(const s in sum.strategies){
    const x = sum.strategies[s];
    L.push(pad(s, 9) +
      lpad(`${fmt(x.deathWave.p10,0)} / ${fmt(x.deathWave.median,1)} / ${fmt(x.deathWave.p90,0)}`, 26) +
      lpad(`${fmt(x.estMinutes.p10)} / ${fmt(x.estMinutes.median)} / ${fmt(x.estMinutes.p90)}`, 26) +
      lpad(fmt(x.inGameMinutesMedian), 12) + lpad(fmt(x.avgWaveSec), 13) +
      lpad(Math.round(x.avgTotalGold), 10) + lpad(x.reachedCap, 5) + lpad(x.errors + x.anomalies, 6));
  }
  L.push('');
  L.push('--- Ölüm dalgası histogramı (strateji başına) ---');
  const keys = new Set();
  for(const s in sum.strategies) for(const k in sum.strategies[s].histogram) keys.add(k);
  const sortedKeys = [...keys].sort((a,b) => (parseFloat(String(a).replace('>','')) || 999) - (parseFloat(String(b).replace('>','')) || 999));
  for(const s in sum.strategies){
    const h = sum.strategies[s].histogram, n = sum.strategies[s].runs;
    L.push(`  [${s}]`);
    for(const k of sortedKeys){
      if(!h[k]) continue;
      L.push(`   dalga ${lpad(k, 4)} │${'█'.repeat(Math.max(1, Math.round(h[k] / n * 50)))} ${h[k]}`);
    }
  }
  L.push('');
  L.push('--- En çok hasar veren silahlar (koşu başına ortalama pay, tüm dalgalar) ---');
  const strat = Object.keys(sum.strategies);
  L.push(pad('silah', 30) + strat.map(s => lpad(s, 9)).join('') + lpad('genel', 9) + lpad('alım', 7));
  for(const [id, sh] of Object.entries(sum.weaponAvgShare).slice(0, 25)){
    L.push(pad(nm(id), 30) + strat.map(s => lpad(((sum.strategies[s].dmgShare[id] || 0) * 100).toFixed(1) + '%', 9)).join('') +
           lpad((sh * 100).toFixed(1) + '%', 9) + lpad(sum.boughtTotals[id] || 0, 7));
  }
  L.push('');
  L.push('--- Hiç alınmayan silahlar ---');
  L.push('  genel: ' + (sum.weaponsNeverBought.map(nm).join(', ') || '(yok)'));
  for(const s in sum.strategies)
    L.push(`  ${pad(s, 8)}: ` + (sum.strategies[s].neverBought.map(id => id).join(', ') || '(yok)'));
  L.push('  alınıp da ort. payı <%1 olanlar: ' + (sum.weaponsBoughtButLowShare.map(nm).join(', ') || '(yok)'));
  L.push('');
  L.push('--- Koşu sonu aktif sinerji oranı ---');
  for(const s in sum.strategies){
    const r = sum.strategies[s].synergyRate;
    L.push(`  ${pad(s, 8)}: ` + Object.entries(r).sort((a,b) => b[1]-a[1]).map(([k,v]) => `${k} %${Math.round(v*100)}`).join(', '));
  }
  const errs = runs.flatMap(r => r.errors.map(e => `[${r.strategy}#${r.run}] ${e}`));
  const anos = runs.flatMap(r => r.anomalies.map(e => `[${r.strategy}#${r.run}] ${e}`));
  const warns = new Map();
  for(const r of runs) for(const w of r.warnings) warns.set(w, (warns.get(w) || 0) + 1);
  L.push('');
  L.push(`--- Hatalar: ${errs.length}, anomaliler (NaN/takılma): ${anos.length}, uyarılar: ${warns.size} ---`);
  for(const e of errs.slice(0, 8)) L.push('  ERR ' + e);
  for(const e of anos.slice(0, 8)) L.push('  ANO ' + e);
  for(const [w, n] of [...warns].slice(0, 8)) L.push(`  WARN (${n} koşu) ${w}`);
  console.log(L.join('\n'));
}


module.exports = { summarize, printSummary, quantile };
