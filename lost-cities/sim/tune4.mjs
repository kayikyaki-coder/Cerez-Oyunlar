import { duel } from './tune.mjs';
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('../lost-cities.html', import.meta.url), 'utf8');
const m = html.match(/\/\* ==== CORE START ==== \*\/([\s\S]*?)\/\* ==== CORE END ==== \*\//);
const { BOT } = new Function(m[1] + 'return {BOT};')();
const adaylar = JSON.parse(process.argv[2]);
for (const a of adaylar){
  const cfg = { ...BOT, ...a };
  let f = 0, w = 0, t = 0;
  for (const seed of [5150, 8842, 1207]){
    const d = duel(cfg, BOT, 600, seed);
    f += d.fark / 3; w += d.aw; t += d.aw + d.bw;
  }
  console.log(`${JSON.stringify(a).padEnd(46)} fark ${f >= 0 ? '+' : ''}${f.toFixed(2)}  galibiyet ${(100*w/t).toFixed(1)}%`);
}
