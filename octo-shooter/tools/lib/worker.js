'use strict';
/* Worker: env'i bir kez kurar, ana iş parçacığından iş çeker */
const { parentPort, workerData } = require('worker_threads');
const { makeEnv } = require('./pool');
const { execJob } = require('./run');
const env = makeEnv(workerData.html, workerData.opts, workerData.ratings);
parentPort.on('message', m => {
  if(m === null){ process.exit(0); }
  parentPort.postMessage({ type: 'result', k: m.k, rec: execJob(env, m.job) });
});
parentPort.postMessage({ type: 'ready' });
