/* Arayüzden bağımsız simülasyon.
   lost-cities.html içindeki CORE bloğunu aynen çıkarıp çalıştırır,
   yani oyunun gerçekten sevk edilen kurallarını ve botunu test eder.

   Kullanım:  node sim/lost-cities-sim.mjs [elSayisi] [tohum] */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '..', 'lost-cities.html'), 'utf8');
const m = html.match(/\/\* ==== CORE START ==== \*\/([\s\S]*?)\/\* ==== CORE END ==== \*\//);
if (!m) { console.error('CORE bloğu bulunamadı.'); process.exit(1); }

const core = new Function(m[1] + `
  return { COLORS, NC, mulberry32, makeDeck, newState, canPlay, canTake,
           scoreCol, scoreAll, BOT, playAutoHand };`)();

const { COLORS, NC, mulberry32, scoreCol, scoreAll, BOT, playAutoHand } = core;

const HANDS = Number(process.argv[2] || 400);
const SEED  = Number(process.argv[3] || 20260905);

/* ---- yardımcı istatistikler ---- */
const med = a => { const s = [...a].sort((x, y) => x - y); const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
const f1  = x => (Math.round(x * 10) / 10).toFixed(1);
const pct = (x, n) => (100 * x / n).toFixed(1) + '%';
const pad = (s, n) => String(s).padEnd(n);
const lpd = (s, n) => String(s).padStart(n);

/* ---- 60 kartın hepsi hesapta mı? ---- */
function bütünlükKontrol(s){
  const ids = new Set();
  const ekle = c => { if (ids.has(c.id)) throw new Error('kart iki kez: ' + c.id); ids.add(c.id); };
  s.deck.forEach(ekle);
  s.hands.forEach(h => h.forEach(ekle));
  s.cols.forEach(cs => cs.forEach(col => col.forEach(ekle)));
  s.discards.forEach(p => p.forEach(ekle));
  if (ids.size !== 60) throw new Error('kart sayısı ' + ids.size);
  // sefer sütunları artan mı, yatırımlar başta mı?
  for (const cs of s.cols) for (const col of cs){
    let sayıGördü = false, son = 0;
    for (const c of col){
      if (c.v === 0){ if (sayıGördü) throw new Error('sayıdan sonra yatırım'); }
      else { if (c.v <= son) throw new Error('artan değil'); son = c.v; sayıGördü = true; }
    }
  }
}

/* ---- koşum ---- */
const rnd = mulberry32(SEED);
const puanlar = [];            // her el, her oyuncu için el puanı
const perPlayer = [[], []];
let negatifEl = 0;             // en az bir oyuncunun negatif bittiği el
let negatifOyuncuEl = 0;       // (el x oyuncu) negatif sayısı
const acilan = new Array(NC).fill(0);      // renk başına açılan sefer
const acilanPuan = Array.from({length: NC}, () => []);
let ilkOynayanKazandi = 0, beraberlik = 0;
let toplamTur = 0;
const seferSayisi = [];        // el başına oyuncu başına açılan sefer sayısı
const bonusluSefer = [0];
let bonus = 0, yatirimliSefer = 0, yatirimliNegatif = 0;

for (let h = 0; h < HANDS; h++){
  const first = h % 2;                       // ilk oynayan sırayla değişsin
  const r = playAutoHand(rnd, first, BOT, BOT);
  bütünlükKontrol(r.state);
  toplamTur += r.turns;

  const sc = [r.scores[0].total, r.scores[1].total];
  for (let p = 0; p < 2; p++){
    puanlar.push(sc[p]);
    perPlayer[p].push(sc[p]);
    if (sc[p] < 0) negatifOyuncuEl++;
    let n = 0;
    for (let ci = 0; ci < NC; ci++){
      const col = r.state.cols[p][ci];
      if (!col.length) continue;
      n++;
      acilan[ci]++;
      acilanPuan[ci].push(scoreCol(col));
      if (col.length >= 8) bonus++;
      const inv = col.filter(c => c.v === 0).length;
      if (inv > 0){ yatirimliSefer++; if (scoreCol(col) < 0) yatirimliNegatif++; }
    }
    seferSayisi.push(n);
  }
  if (sc[0] < 0 || sc[1] < 0) negatifEl++;
  if (sc[first] > sc[1 - first]) ilkOynayanKazandi++;
  else if (sc[first] === sc[1 - first]) beraberlik++;
}

const n = puanlar.length;
console.log('');
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  KAYIP ŞEHİRLER — BOT vs BOT SİMÜLASYONU                     ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log(`El sayısı: ${HANDS}   (${n} oyuncu-el)   tohum: ${SEED}`);
console.log(`Ortalama tur/el: ${f1(toplamTur / HANDS)}   ·  60 kart bütünlüğü ve sefer sırası: TAMAM`);
console.log('');

console.log('── EL PUANLARI ────────────────────────────────────────────────');
console.log(`  Ortalama      : ${f1(avg(puanlar))}`);
console.log(`  Medyan        : ${f1(med(puanlar))}`);
console.log(`  En düşük      : ${Math.min(...puanlar)}`);
console.log(`  En yüksek     : ${Math.max(...puanlar)}`);
const q = p => { const s = [...puanlar].sort((a, b) => a - b); return s[Math.floor(p * (s.length - 1))]; };
console.log(`  %10 / %90     : ${q(0.10)} / ${q(0.90)}`);
console.log(`  El başına açılan sefer (ort.): ${f1(avg(seferSayisi))}`);
console.log('');

console.log('── NEGATİF BİTİŞLER ───────────────────────────────────────────');
console.log(`  Negatif biten oyuncu-el : ${negatifOyuncuEl}/${n}  (${pct(negatifOyuncuEl, n)})`);
console.log(`  En az bir oyuncunun negatif bittiği el : ${negatifEl}/${HANDS}  (${pct(negatifEl, HANDS)})`);
console.log('');

console.log('── RENK BAŞINA AÇILAN SEFERLER ────────────────────────────────');
console.log(`  ${pad('Renk', 10)}${lpd('Sefer', 7)}${lpd('Oyuncu-el başına', 19)}${lpd('Ort. puan', 11)}${lpd('Negatif', 9)}`);
for (let ci = 0; ci < NC; ci++){
  const neg = acilanPuan[ci].filter(x => x < 0).length;
  console.log(`  ${pad(COLORS[ci].ad, 10)}${lpd(acilan[ci], 7)}${lpd(f1(acilan[ci] / n), 19)}` +
              `${lpd(f1(avg(acilanPuan[ci])), 11)}${lpd(pct(neg, acilanPuan[ci].length), 9)}`);
}
const tümSefer = acilan.reduce((a, b) => a + b, 0);
console.log(`  ${pad('TOPLAM', 10)}${lpd(tümSefer, 7)}`);
console.log(`  8+ kart bonusu alan sefer: ${bonus} (${pct(bonus, tümSefer)})`);
console.log(`  Yatırım kartı içeren sefer: ${yatirimliSefer} — bunların ${pct(yatirimliNegatif, yatirimliSefer)} kadarı negatif`);
console.log('');

console.log('── SIRA AVANTAJI ──────────────────────────────────────────────');
console.log(`  İlk oynayan kazandı : ${ilkOynayanKazandi}/${HANDS}  (${pct(ilkOynayanKazandi, HANDS)})`);
console.log(`  Berabere            : ${beraberlik}  (${pct(beraberlik, HANDS)})`);
const ilkOran = ilkOynayanKazandi / (HANDS - beraberlik);
console.log(`  Beraberlikler hariç : ${(100 * ilkOran).toFixed(1)}%`);
console.log(`  Değerlendirme       : ${Math.abs(ilkOran - 0.5) < 0.05 ? 'dengeli (±5 puan içinde)' : 'DİKKAT: sıra avantajı belirgin'}`);
console.log('');
