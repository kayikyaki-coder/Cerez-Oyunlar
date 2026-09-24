'use strict';
/* =========================================================================
   lib/run.js — tek koşu (bot oyunu / hileli bot) ve tek silah kalabalık testi
   Her iş saf fonksiyondur: (env, job) → kayıt. env = {compiled, gameInfo, opts, ratings}
========================================================================= */
const { createGame, mixSeed, mulberry32 } = require('./game');
const { makeHelpers, makeBot, pickMutationFor } = require('./bots');

const errLine = e => e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : String(e);
function shopSeconds(wave, opts){ return wave <= opts.shopEarlyUntil ? opts.shopEarly : opts.shopLate; }

/* Hileli bot kurulumu (F2 #7): dalga N'de tüm tılsımlar tavanda, tüm kollar LvX,
   en yüksek puanlı farklı türlerle dolu. Sonra "orta" politikasıyla oynar. */
function applyCheat(A, H, opts){
  const P = A.g('P'), T = A.g('TRINKETS') || [];
  const apply = A.fn('applyTrinket');
  for(const t of T){
    const cap = Number.isFinite(t.cap) ? t.cap : 10;
    while(H.trkCount(t.id) < cap){
      if(typeof apply === 'function') apply(t);
      else { P.trkCount[t.id] = (P.trkCount[t.id] || 0) + 1; }
    }
  }
  const W = A.g('WEAPONS');
  const ids = Object.keys(W).sort((a, b) => H.rating(b) - H.rating(a));
  let uid = 90000;
  for(let i = 0; i < P.arms.length; i++)
    P.arms[i] = { type: ids[i % ids.length], lv: opts.cheatLv, cdT: 0, aim: 0, uid: uid++ };
  P.wave = opts.cheatWave;
  P.hp = P.maxHp;
  try { A.fn('rollShop')(false); } catch(e){}
}

function runOne(env, job){
  const { compiled, gameInfo, opts, ratings } = env;
  const botName = job.bot, runIdx = job.i;
  const seed = mixSeed(opts.seed, job.cheat ? 'cheat' : '', botName, runIdx);
  const rec = {
    strategy: job.cheat ? 'hileli' : botName, bot: botName, run: runIdx, seed, cheat: !!job.cheat,
    startWave: 1, deathWave: null, reachedCap: false,
    waves: [], inGameSec: 0, shopSec: 0, estRealSec: 0,
    totalGold: 0, kills: 0, spent: 0, rerolls: 0, sold: 0, merges: 0,
    bought: {}, dmgByType: {}, dmgShare: {}, synergies: {}, finalBuild: null,
    goldAfterShop: {}, mutations: [], lastWaveTopShare: null, lastWaveTopKey: null,
    bossAliveAtDeath: false, maxEnemies: 0, maxEnemiesWave: 0,
    errors: [], anomalies: [], warnings: []
  };
  let game;
  try { game = createGame(compiled, gameInfo, opts, seed); }
  catch(e){ rec.errors.push('init: ' + errLine(e)); return rec; }
  const { A } = game;
  const H = makeHelpers(A, mulberry32(seed ^ 0x9E3779B9), rec, ratings);
  let bot;
  try { bot = makeBot(botName, H, opts); }
  catch(e){ rec.errors.push('bot: ' + errLine(e)); return rec; }
  if(job.cheat){
    try { applyCheat(A, H, opts); } catch(e){ rec.errors.push('cheat: ' + errLine(e)); return rec; }
  }
  rec.startWave = A.g('P').wave;

  const WAVE_STATE = A.g('WAVE_STATE'), SHOP_STATE = A.g('SHOP_STATE'), GAMEOVER_STATE = A.g('GAMEOVER_STATE');
  const dt = 1 / opts.fps;
  const CHUNK = Math.round(opts.fps * 5);        // 5 oyun-saniyesinde bir NaN kontrolü

  outer:
  while(true){
    const w = A.g('P').wave;
    if(w > opts.maxWave){ rec.reachedCap = true; break; }
    rec.shopSec += shopSeconds(w, opts);
    try { bot.shop(); }
    catch(e){ rec.errors.push(`shop(w${w}): ${errLine(e)}`); }
    rec.goldAfterShop[w] = A.g('P').gold;
    try { A.fn('startWave')(); }
    catch(e){ rec.errors.push(`startWave(w${w}): ${errLine(e)}`); break; }
    let t = 0;
    while(true){
      let n;
      try { n = A.stepWave(dt, CHUNK); }
      catch(e){ rec.errors.push(`updateWave(w${w}, t=${t.toFixed(2)}): ${errLine(e)}`); break outer; }
      t += n * dt;
      A.advanceClock(n * dt * 1000);
      const st = A.state();
      const Pn = A.g('P'), en = A.g('enemies') || [];
      if(!Number.isFinite(Pn.hp) || !Number.isFinite(Pn.gold) ||
         en.some(e => !Number.isFinite(e.hp) || !Number.isFinite(e.x) || !Number.isFinite(e.y))){
        rec.anomalies.push(`NaN/Infinity (w${w}, t=${t.toFixed(1)}): hp=${Pn.hp} gold=${Pn.gold} ` +
                           `enemyNaN=${en.filter(e => !Number.isFinite(e.hp) || !Number.isFinite(e.x)).length}`);
        break outer;
      }
      if(st !== WAVE_STATE){
        if(st === GAMEOVER_STATE){
          const ET = A.g('ENEMY_TYPES') || {};
          rec.bossAliveAtDeath = en.some(e => e.type === 'boss' || (ET[e.type] && ET[e.type].boss) || e.isBoss);
        }
        break;
      }
      if(t > opts.stallSec){
        rec.anomalies.push(`Takılma: dalga ${w} ${opts.stallSec} oyun-sn'de bitmedi (düşman=${en.length}, ` +
                           `hp=${Math.round(Pn.hp)}, spawnIdx=${A.g('spawnIdx')}/${(A.g('spawnQueue')||[]).length})`);
        break outer;
      }
    }
    rec.waves.push(+t.toFixed(3));
    rec.inGameSec += t;
    let st = A.state();
    if(st === GAMEOVER_STATE){ rec.deathWave = w; break; }
    /* C6 mutasyon ekranı: gerçek oyun state'i SHOP_STATE'te tutup mutationChoices/isMutationOpen()
       ile ekranın açık olduğunu bildirir (MUTATION_STATE yok) — bkz. A.isMutationOpen(). */
    for(let k = 0; k < 5 && A.isMutationOpen(); k++){
      if(!A.canPickMutation()){
        rec.anomalies.push(`Dalga ${w} sonrası mutasyon ekranı açık ama pickMutation hook'u yok`);
        break outer;
      }
      try { pickMutationFor(A, H, bot.pol, rec); }
      catch(e){ rec.errors.push(`pickMutation(w${w}): ${errLine(e)}`); break outer; }
    }
    st = A.state();
    if(A.isMutationOpen()){ rec.anomalies.push(`Dalga ${w} sonrası mutasyon ekranı kapanmadı`); break; }
    if(st !== SHOP_STATE){ rec.anomalies.push(`Dalga ${w} sonrası market açılmadı: state=${st}`); break; }
    if(A.g('P').wave !== w + 1) rec.anomalies.push(`Dalga sayacı ${w} → ${A.g('P').wave}`);
  }

  /* --- kayıt topla --- */
  const P = A.g('P');
  rec.totalGold = P.totalGold;
  rec.kills = P.kills;
  rec.maxEnemies = A.maxEnemies; rec.maxEnemiesWave = A.maxEnemiesWave;
  rec.estRealSec = rec.inGameSec / (opts.playSpeed || 1) + rec.shopSec;
  for(const s of A.snaps){
    if(s.error){ rec.errors.push('snap: ' + s.error); continue; }
    for(const k in s.dmg){
      const type = s.map[k] || (k[0] === 'u' ? '?(satılmış/eşlenemedi)' : k);
      rec.dmgByType[type] = (rec.dmgByType[type] || 0) + s.dmg[k];
    }
  }
  /* F2 #9: SON dalgada tek silah ÖRNEĞİNİN (uid) hasar payı */
  const last = A.snaps.filter(s => !s.error).pop();
  if(last){
    const ent = Object.entries(last.dmg), tot = ent.reduce((a, [, v]) => a + v, 0);
    if(tot > 0){
      const [k, v] = ent.sort((a, b) => b[1] - a[1])[0];
      rec.lastWaveTopShare = +(v / tot).toFixed(4);
      rec.lastWaveTopKey = (last.map[k] || k) + (last.map[k] ? '#' + k : '');
    }
  }
  const tot = Object.values(rec.dmgByType).reduce((a, b) => a + b, 0);
  for(const k in rec.dmgByType){
    rec.dmgByType[k] = Math.round(rec.dmgByType[k]);
    rec.dmgShare[k] = tot > 0 ? +(rec.dmgByType[k] / tot).toFixed(4) : 0;
  }
  try {
    A.set('SY', A.fn('computeSynergy')());
    const C = A.g('CLASSES'), tier = A.fn('tier');
    for(const c in C){ const t = tier(c); if(t > 0) rec.synergies[c] = t; }
  } catch(e){ rec.errors.push('synergy: ' + e); }
  rec.finalBuild = {
    arms: P.arms.map(a => a ? `${a.type}:${a.lv}` : null),
    bench: (P.bench || []).map(a => a ? `${a.type}:${a.lv}` : null),
    trinkets: Object.assign({}, P.trkCount),
    gold: P.gold, maxHp: P.maxHp
  };
  rec.inGameSec = +rec.inGameSec.toFixed(2);
  rec.estRealSec = +rec.estRealSec.toFixed(1);
  rec.warnings = game.warnings.concat(game.consoleErrors.map(e => 'console.error: ' + e));
  return rec;
}

/* Tek silah kalabalık testi (DESIGN wtest.js ile aynı yöntem): tek kol, ölümsüz
   ahtapot, dalga N kalabalığı, T oyun-saniyesi; sonuç = verilen hasar / süre.
   Dalga erken biterse endWave anlık görüntüsü de sayılır. */
function crowdTest(env, job){
  const { compiled, gameInfo, opts } = env;
  const seed = mixSeed(opts.seed, 'wtest', job.id, job.lv, job.rep);
  const out = { type: 'wtest', id: job.id, lv: job.lv, rep: job.rep, dps: 0, t: 0, error: null };
  try {
    const { A } = createGame(compiled, gameInfo, opts, seed);
    const P = A.g('P');
    P.arms = new Array(8).fill(null);
    P.bench = [];
    P.arms[0] = { type: job.id, lv: job.lv, cdT: 0, aim: 0, uid: 999 };
    P.wave = opts.wtestWave;
    P.maxHp = P.hp = 1e12;
    A.fn('startWave')();
    const dt = 1 / opts.fps;
    const n = A.stepWave(dt, Math.round(opts.wtestSec * opts.fps));
    const t = n * dt;
    let dealt = 0;
    for(const s of A.snaps) for(const k in (s.dmg || {})) dealt += s.dmg[k];
    const wd = A.g('waveDmg') || {};
    if(A.state() === A.g('WAVE_STATE')) for(const k in wd) dealt += wd[k];
    out.t = t; out.dps = t > 0 ? dealt / t : 0;
  } catch(e){ out.error = errLine(e); }
  return out;
}

/* Aynı anda düşman zirvesi (F2 #14): verilen build + ölümsüz ahtapot, dalga N,
   dalga bitene ya da T sn dolana kadar; enemies.length maksimumu */
function peakTest(env, job){
  const { compiled, gameInfo, opts } = env;
  const out = { type: 'peak', wave: job.wave, maxEnemies: 0, t: 0, error: null };
  try {
    const { A } = createGame(compiled, gameInfo, opts, mixSeed(opts.seed, 'peak', job.wave, job.rep || 0));
    const P = A.g('P'), T = A.g('TRINKETS') || [], W = A.g('WEAPONS');
    const apply = A.fn('applyTrinket');
    for(const t of T){ const n = Math.min((job.build.trinkets || {})[t.id] || 0, t.cap ?? 99);
      for(let k = (P.trkCount[t.id] || 0); k < n; k++) apply(t); }
    const arms = job.build.arms || [];
    while(P.arms.length < arms.length) P.arms.push(null);
    arms.forEach((a, i) => { if(!a) return; const [type, lv] = a.split(':'); if(W[type]) P.arms[i] = { type, lv: +lv, cdT: 0, aim: 0, uid: 70000 + i }; });
    P.wave = job.wave; P.maxHp = P.hp = 1e15;
    A.fn('startWave')();
    const n = A.stepWave(1 / opts.fps, Math.round((job.sec || 90) * opts.fps));
    out.t = n / opts.fps; out.maxEnemies = A.maxEnemies;
  } catch(e){ out.error = errLine(e); }
  return out;
}

function execJob(env, job){
  if(job.type === 'wtest') return crowdTest(env, job);
  if(job.type === 'peak') return peakTest(env, job);
  return runOne(env, job);
}

module.exports = { runOne, crowdTest, peakTest, execJob, shopSeconds };
