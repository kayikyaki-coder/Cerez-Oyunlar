'use strict';
/* =========================================================================
   lib/pool.js — worker_threads havuzu (iş çekme modeli; yük dengeli).
   HTML metni ana iş parçacığında bir kez okunur ve worker'lara geçirilir.
========================================================================= */
const path = require('path');
const { Worker } = require('worker_threads');
const { loadGameFromHtml, compile } = require('./game');
const { execJob } = require('./run');

function makeEnv(html, opts, ratings){
  const gameInfo = loadGameFromHtml(html);
  return { gameInfo, compiled: compile(gameInfo), opts, ratings: ratings || {} };
}

/* jobs: [{type:'run'|'wtest', ...}] → sonuçlar (iş sırasıyla) */
async function runPool(jobs, { html, opts, ratings, workers, onProgress }){
  const results = new Array(jobs.length);
  let done = 0;
  const tick = () => { done++; if(onProgress) onProgress(done, jobs.length); };
  const nW = Math.max(1, Math.min(workers || 1, jobs.length));
  if(nW === 1){
    const env = makeEnv(html, opts, ratings);
    jobs.forEach((j, k) => { results[k] = execJob(env, j); tick(); });
    return results;
  }
  let next = 0;
  await Promise.all(Array.from({ length: nW }, () => new Promise((res, rej) => {
    const wk = new Worker(path.join(__dirname, 'worker.js'), { workerData: { html, opts, ratings } });
    const feed = () => {
      if(next < jobs.length){ const k = next++; wk.postMessage({ k, job: jobs[k] }); }
      else wk.postMessage(null);
    };
    wk.on('message', m => {
      if(m && m.type === 'result'){ results[m.k] = m.rec; tick(); }
      feed();
    });
    wk.on('error', rej);
    wk.on('exit', c => c ? rej(new Error('worker çıkış kodu ' + c)) : res());
  })));
  return results;
}

module.exports = { runPool, makeEnv };
