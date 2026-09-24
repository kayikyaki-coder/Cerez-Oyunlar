// tiny-test.js — bağımlılıksız mini test çatısı (describe/test/skip/assert)
const results = { pass: 0, fail: 0, skip: 0 };
const failures = [];
let currentSuite = "";

function describe(name, fn) {
  const prev = currentSuite;
  currentSuite = prev ? prev + " > " + name : name;
  fn();
  currentSuite = prev;
}

function test(name, fn) {
  const full = currentSuite ? currentSuite + " :: " + name : name;
  try {
    fn();
    results.pass++;
    console.log("  \x1b[32m✓\x1b[0m " + full);
  } catch (e) {
    results.fail++;
    failures.push({ name: full, error: e });
    console.log("  \x1b[31m✗\x1b[0m " + full);
    console.log("      " + (e && e.message ? e.message : e));
  }
}

function skip(name, reason) {
  const full = currentSuite ? currentSuite + " :: " + name : name;
  results.skip++;
  console.log("  \x1b[33m○ skip\x1b[0m " + full + (reason ? " (" + reason + ")" : ""));
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error((msg ? msg + " — " : "") + "beklenen " + JSON.stringify(b) + " ama " + JSON.stringify(a) + " geldi");
}
function assertTrue(v, msg) {
  if (!v) throw new Error((msg ? msg + " — " : "") + "true bekleniyordu, " + JSON.stringify(v) + " geldi");
}
function assertClose(a, b, tol, msg) {
  tol = tol == null ? 0.001 : tol;
  if (Math.abs(a - b) > tol) throw new Error((msg ? msg + " — " : "") + "beklenen ~" + b + " ama " + a + " geldi");
}
function assertInRange(v, lo, hi, msg) {
  if (v < lo || v > hi) throw new Error((msg ? msg + " — " : "") + v + " [" + lo + "," + hi + "] aralığında değil");
}

function summary() {
  console.log("\n" + "-".repeat(50));
  console.log("Toplam: " + (results.pass + results.fail + results.skip) +
    "  |  \x1b[32mgeçti: " + results.pass + "\x1b[0m" +
    "  |  \x1b[31mbaşarısız: " + results.fail + "\x1b[0m" +
    "  |  \x1b[33matlandı: " + results.skip + "\x1b[0m");
  if (results.fail > 0) {
    console.log("\nBaşarısız testler:");
    for (const f of failures) console.log("  - " + f.name);
  }
  return results.fail === 0;
}

module.exports = { describe, test, skip, assertEqual, assertTrue, assertClose, assertInRange, summary, results };
