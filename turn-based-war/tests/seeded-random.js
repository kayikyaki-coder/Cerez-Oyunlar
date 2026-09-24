// seeded-random.js — testler için deterministik RNG (mulberry32).
// Motorun Math.random() kullanan her yerini seed'li hale getirmek için
// sandbox.Math.random'ı bununla değiştiriyoruz (bkz. load-engine.js).
function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Sıradaki N değeri önceden bilinen bir "script" RNG: her çağrıda listeden bir
// sonraki değeri döner (bittiğinde başa sarar). d20/d(n) sonuçlarını doğrudan
// kontrol etmek için (ör. "sıradaki atış kesin 20 olsun").
function scriptedRandom(values) {
  let i = 0;
  return function rng() {
    const v = values[i % values.length];
    i++;
    return v;
  };
}

// d(n) çağrısının belirli bir sonucu vermesi için gereken Math.random() değeri.
// d(n) = 1 + floor(random() * n)  =>  random() sonucu = (n-1)/n verirse (n-1)+1 = n (maks) döner.
function randomFor(result, sides) {
  // 1 + floor(r*sides) = result  =>  r*sides in [result-1, result)  => r = (result-1)/sides (biraz içeriden)
  const lo = (result - 1) / sides;
  const hi = result / sides;
  return Math.min(lo + (hi - lo) * 0.5, 0.999999);
}

module.exports = { mulberry32, scriptedRandom, randomFor };
