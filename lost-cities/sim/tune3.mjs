/* Güç ölçütü: mevcut ayara karşı kafa kafaya düello (ortalama puan farkı).
   Self-play ortalaması yanıltıcı — el uzunluğunu değiştiren ayarlar puanı şişiriyor. */
import { duel } from './tune.mjs';
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('../lost-cities.html', import.meta.url), 'utf8');
const m = html.match(/\/\* ==== CORE START ==== \*\/([\s\S]*?)\/\* ==== CORE END ==== \*\//);
const { BOT } = new Function(m[1] + 'return {BOT};')();

const alan = process.argv[2], degerler = process.argv.slice(3).map(Number);
const out = [];
for (const v of degerler){
  const cfg = { ...BOT, [alan]: v };
  const d1 = duel(cfg, BOT, 600, 5150);
  const d2 = duel(cfg, BOT, 600, 8842);
  const fark = (d1.fark + d2.fark) / 2;
  const gal = (d1.aw + d2.aw) / (d1.aw + d1.bw + d2.aw + d2.bw);
  out.push({ v, fark, gal });
  console.log(`${alan}=${String(v).padEnd(5)} puan farkı ${fark >= 0 ? '+' : ''}${fark.toFixed(2)}   galibiyet ${(gal*100).toFixed(1)}%`);
}
const b = out.reduce((a, c) => c.fark > a.fark ? c : a);
console.log(`→ en iyi ${alan} = ${b.v}`);
