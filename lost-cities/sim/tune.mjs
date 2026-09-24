/* Ayar araçları.
   DİKKAT: run() (kendine karşı ortalama el puanı) güç ölçütü DEĞİLDİR —
   ıskartadan alma eşiğini düşüren ayarlar deste tükenmesini geciktirip
   elleri uzatır ve iki tarafın da puanını şişirir. Botun gerçek gücü
   duel() ile, yani kafa kafaya puan farkıyla ölçülür. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '..', 'lost-cities.html'), 'utf8');
const m = html.match(/\/\* ==== CORE START ==== \*\/([\s\S]*?)\/\* ==== CORE END ==== \*\//);
const core = new Function(m[1] + 'return {mulberry32,BOT,playAutoHand,scoreCol,NC};')();
const { mulberry32, BOT, playAutoHand, NC } = core;

export function run(cfg, hands = 300, seed = 777){
  const rnd = mulberry32(seed);
  const sc = [], sefer = [];
  let neg = 0;
  for (let h = 0; h < hands; h++){
    const r = playAutoHand(rnd, h % 2, cfg, cfg);
    for (let p = 0; p < 2; p++){
      sc.push(r.scores[p].total);
      if (r.scores[p].total < 0) neg++;
      sefer.push(r.state.cols[p].filter(c => c.length).length);
    }
  }
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  return { ort: avg(sc), neg: neg / sc.length, sefer: avg(sefer) };
}
export function duel(a, b, hands = 400, seed = 999){
  const rnd = mulberry32(seed);
  let aw = 0, bw = 0, da = 0;
  for (let h = 0; h < hands; h++){
    const first = h % 2;
    const cfgs = first === 0 ? [a, b] : [b, a];
    const r = playAutoHand(rnd, first, cfgs[0], cfgs[1]);
    const sa = r.scores[first === 0 ? 0 : 1].total, sb = r.scores[first === 0 ? 1 : 0].total;
    da += sa - sb;
    if (sa > sb) aw++; else if (sb > sa) bw++;
  }
  return { aw, bw, fark: da / hands };
}

if (process.argv[1].endsWith('tune.mjs')){
  const grid = {
    gelecek: [0.85, 0.65, 0.5, 0.4, 0.3],
    bolusme: [2.2, 2.8, 3.4],
    acNum:   [6, 10, 14, 18],
    acInv:   [10, 14, 20]
  };
  let best = null;
  const rows = [];
  for (const g of grid.gelecek) for (const b of grid.bolusme)
  for (const an of grid.acNum) for (const ai of grid.acInv){
    const cfg = { ...BOT, gelecek: g, bolusme: b, acNum: an, acInv: ai };
    const r = run(cfg, 200);
    rows.push({ cfg, ...r });
    if (!best || r.ort > best.ort) best = { cfg, ...r };
  }
  rows.sort((x, y) => y.ort - x.ort);
  console.log('en iyi 12 (200 el, ort. el puanı):');
  for (const r of rows.slice(0, 12))
    console.log(`  ort=${r.ort.toFixed(1)} neg=${(r.neg*100).toFixed(0)}% sefer=${r.sefer.toFixed(2)}` +
      `  | gelecek=${r.cfg.gelecek} bolusme=${r.cfg.bolusme} acNum=${r.cfg.acNum} acInv=${r.cfg.acInv}`);
}
