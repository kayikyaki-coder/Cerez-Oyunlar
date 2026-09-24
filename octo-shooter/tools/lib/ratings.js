'use strict';
/* =========================================================================
   lib/ratings.js — botların silah puanı (tasarımcının statik RATING tablosunun
   dinamik karşılığı). Puan = √(tahmini tek hedef DPS × ölçülen kalabalık DPS),
   medyan 18'e ölçekli. Kalabalık DPS oyunun kendisinde ölçülür (crowdTest), yani
   yeni silah eklenince / sayılar değişince puanlar kendiliğinden güncellenir.
   Sonuç .cache/ altında index.html hash'iyle önbelleğe alınır.
========================================================================= */
const fs = require('fs');
const path = require('path');
const { createGame, mulberry32 } = require('./game');
const { makeHelpers, DESIGNER_RATING } = require('./bots');
const { runPool, makeEnv } = require('./pool');

const median = a => { const s = [...a].sort((x, y) => x - y); const n = s.length; return n ? (n % 2 ? s[(n-1)/2] : (s[n/2-1] + s[n/2]) / 2) : NaN; };

function probe(html, opts){
  const env = makeEnv(html, opts, {});
  const { A } = createGame(env.compiled, env.gameInfo, opts, 1);
  const rec = { errors: [], bought: {} };
  const H = makeHelpers(A, mulberry32(1), rec, {});
  const W = A.g('WEAPONS') || {};
  const est = {};
  for(const id in W) est[id] = H.estDps(W[id], 1);
  return { ids: Object.keys(W), est, W, hash: env.gameInfo.hash };
}

/* Kalabalık testini çalıştır: levels × reps × silah */
async function crowdTable(html, opts, levels, reps, workers, onProgress){
  const pr = probe(html, opts);
  const jobs = [];
  for(const id of pr.ids) for(const lv of levels) for(let r = 0; r < reps; r++) jobs.push({ type: 'wtest', id, lv, rep: r });
  const res = await runPool(jobs, { html, opts, workers, onProgress });
  const tab = {}, errors = [];
  for(const r of res){
    if(r.error) errors.push(`${r.id} Lv${r.lv}: ${r.error}`);
    ((tab[r.id] = tab[r.id] || {})[r.lv] = tab[r.id][r.lv] || []).push(r.dps);
  }
  const mean = {};
  for(const id in tab){ mean[id] = {}; for(const lv in tab[id]) mean[id][lv] = tab[id][lv].reduce((a, b) => a + b, 0) / tab[id][lv].length; }
  return { probe: pr, mean, errors };
}

function ratingsFrom(pr, crowdLv1, mode){
  const raw = {};
  for(const id of pr.ids){
    const e = Math.max(0.1, pr.est[id]), c = crowdLv1 && crowdLv1[id] != null ? Math.max(0.1, crowdLv1[id]) : e;
    raw[id] = Math.sqrt(e * c);
  }
  /* Karekök sıkıştırma: tasarımcının tablosundaki yayılıma (≈6–20) yakın tutar,
     tek bir aykırı ölçüm botları tek silaha kilitlemesin */
  const m = median(Object.values(raw));
  const out = {};
  for(const id in raw) out[id] = +(18 * Math.sqrt(raw[id] / m)).toFixed(2);
  out.__estScale = 18 / median(Object.values(pr.est));
  if(mode === 'designer') for(const id in DESIGNER_RATING) if(out[id] != null) out[id] = DESIGNER_RATING[id];
  return out;
}

async function getRatings(html, opts, workers, log){
  const pr = probe(html, opts);
  const key = `${pr.hash}-${opts.viewport}-${opts.fps}-${opts.wtestWave}-${opts.wtestSec}-${opts.seed}`;
  const dir = path.join(__dirname, '..', '.cache');
  const file = path.join(dir, `ratings-${key}.json`);
  let crowd = null;
  try { crowd = JSON.parse(fs.readFileSync(file, 'utf8')); } catch(e){}
  if(!crowd){
    if(log) log('Silah puanları ölçülüyor (tek silah kalabalık testi, Lv1)...');
    const t = await crowdTable(html, opts, [1], 2, workers);
    crowd = {}; for(const id in t.mean) crowd[id] = t.mean[id][1];
    try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(crowd)); } catch(e){}
  }
  return ratingsFrom(pr, crowd, opts.rating);
}

module.exports = { getRatings, crowdTable, ratingsFrom, probe, median };
