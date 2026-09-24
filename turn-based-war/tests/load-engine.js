// load-engine.js — hex.js / sprites.js / data.js / engine.js dosyalarını node `vm` içinde,
// tarayıcısız (DOM stub'larıyla) yükleyip saf motor mantığını test etmeye yarar.
//
// Kullanım:
//   const { ctx, reload } = require("./load-engine");
//   ctx.setupBattle(); ctx.hexDist(...); vb.
//
// Not: Motor değişebilir (kampanya dönüşümü). Bu loader dosya varlığını kontrol eder;
// bir dosya/fonksiyon yoksa testler onu 'skip' eder (bkz. engine.test.js).

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const JS_DIR = path.join(__dirname, "..", "js");

// Sözleşmedeki script sırası (mevcut olanlar yüklenir, olmayanlar atlanır)
const SCRIPT_ORDER = [
  "hex.js", "sprites.js", "art.js", "audio.js",
  "data.js",
  "content/enemies.js", "content/items.js", "content/progression.js", "content/campaign.js",
  "engine.js", "ai.js", "render.js", "save.js", "creation.js", "campaign-flow.js", "main.js"
];

function existingScripts() {
  return SCRIPT_ORDER.filter(f => fs.existsSync(path.join(JS_DIR, f)));
}

// Basit DOM/Canvas/Audio stub'ları — main.js/render.js gibi dosyalar da hata vermeden
// yüklenebilsin diye (window.addEventListener("DOMContentLoaded", ...) no-op).
function makeSandbox() {
  const listeners = {};
  const fakeEl = () => ({
    style: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, removeEventListener() {}, appendChild() {}, textContent: "", innerHTML: "",
    dataset: {}, children: [], childNodes: [],
    querySelectorAll() { return []; }, querySelector() { return null; },
    setAttribute() {}, getAttribute() { return null; }, remove() {}, focus() {}, click() {},
    getContext() {
      return {
        clearRect() {}, fillRect() {}, strokeRect() {}, beginPath() {}, moveTo() {}, lineTo() {},
        closePath() {}, fill() {}, stroke() {}, ellipse() {}, setTransform() {}, save() {}, restore() {},
        drawImage() {}, measureText() { return { width: 0 }; }, fillText() {}, arc() {}, translate() {}, scale() {}, rotate() {}
      };
    },
    getBoundingClientRect() { return { left: 0, top: 0, width: 0, height: 0 }; }
  });
  const document = {
    getElementById() { return fakeEl(); },
    createElement() { return fakeEl(); },
    querySelectorAll() { return []; },
    querySelector() { return null; },
    addEventListener(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); },
    removeEventListener() {},
    body: fakeEl()
  };
  const sandbox = {
    console,
    document,
    window: {},
    devicePixelRatio: 1,
    localStorage: (() => {
      const store = {};
      return {
        getItem: k => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: k => { delete store[k]; }
      };
    })(),
    // setTimeout kontrol edilebilir olsun diye override edilebilir (testler kendi versiyonunu verebilir)
    setTimeout: (fn, ms) => { sandbox.__timers.push({ fn, ms }); return sandbox.__timers.length; },
    clearTimeout() {},
    // Object.create(Math): gerçek Math'i BOZMADAN sandbox.Math.random'ı testlerde
    // seed'li bir RNG ile değiştirebilelim diye (bkz. tests/seeded-random.js)
    Math: Object.assign(Object.create(Math), { random: Math.random }),
    Set,
    Map,
    Object,
    Array,
    JSON,
    Audio: undefined,
    performance: { now: () => Date.now() },
    // requestAnimationFrame/cancelAnimationFrame: render.js (startRenderLoop, sürekli çizim
    // döngüsü) ve campaign-flow.js (showResultScreen'in xp-bar dolma animasyonu) bunları
    // koşulsuz çağırıyor; tarayıcı dışında (node vm) tanımsızlar, ReferenceError'a yol açardı.
    // Callback'i GERÇEKTEN çalıştırmıyoruz (no-op) — çalıştırsaydık, startRenderLoop'un kendi
    // içinde requestAnimationFrame(loop)'u tekrar çağırması senkron sonsuz özyinelemeye
    // (stack overflow) yol açardı; testler zaten görsel animasyon sonucuna bakmıyor.
    requestAnimationFrame() { return 0; },
    cancelAnimationFrame() {},
    __timers: []
  };
  sandbox.window.addEventListener = document.addEventListener;
  sandbox.window.requestAnimationFrame = sandbox.requestAnimationFrame;
  sandbox.window.cancelAnimationFrame = sandbox.cancelAnimationFrame;
  sandbox.window.innerWidth = 1280;
  sandbox.window.innerHeight = 800;
  sandbox.globalThis = sandbox;
  return sandbox;
}

// Bütün mevcut script dosyalarını sırayla aynı context'e yükler.
// Her dosya için başarı/başarısızlık bilgisini döner (bazıları DOM'a bağımlı olabilir).
// ÖNEMLİ: node vm'de üst düzey `const`/`let` bildirimleri (State, SPELLBOOK, CONFIG, ...)
// context NESNESİNİN kendi property'si OLMAZ (sadece o context'in lexical global scope'una
// bağlanır). Yani `context.State` dışarıdan undefined döner, ama context İÇİNDE (başka bir
// vm.runInContext çağrısıyla) `State` adı hâlâ erişilebilir. Bu yüzden yükleme bittikten sonra
// dosyalardaki top-level const/let isimlerini regex ile toplayıp `globalThis.<isim> = <isim>`
// şeklinde context'e "export" ediyoruz ki testler context.State, context.SPELLBOOK vb. ile
// dışarıdan okuyup yazabilsin.
const TOPLEVEL_DECL_RE = /^(?:const|let)\s+([A-Za-z_$][\w$]*)/gm;

function collectTopLevelNames(code) {
  const names = new Set();
  let m;
  TOPLEVEL_DECL_RE.lastIndex = 0;
  while ((m = TOPLEVEL_DECL_RE.exec(code))) names.add(m[1]);
  return names;
}

function loadEngine(opts) {
  opts = opts || {};
  const sandbox = makeSandbox();
  const context = vm.createContext(sandbox);
  const loaded = [];
  const failed = [];
  const allNames = new Set();
  for (const rel of existingScripts()) {
    const file = path.join(JS_DIR, rel);
    const code = fs.readFileSync(file, "utf8");
    try {
      vm.runInContext(code, context, { filename: file });
      loaded.push(rel);
      for (const n of collectTopLevelNames(code)) allNames.add(n);
    } catch (e) {
      failed.push({ file: rel, error: e.stack || e.message });
      if (opts.strict) throw e;
    }
  }
  // const/let isimlerini context nesnesine (globalThis) yansıt
  if (allNames.size) {
    const exportScript = Array.from(allNames)
      .map(n => `try { globalThis[${JSON.stringify(n)}] = ${n}; } catch(e) {}`)
      .join("\n");
    try { vm.runInContext(exportScript, context); } catch (e) { /* yok say */ }
  }
  return { sandbox, context, loaded, failed, topLevelNames: allNames };
}

// ÖNEMLİ (2. tur, campaign-sim.js için): `let`-ile bildirilmiş, sonradan TAMAMEN YENİDEN ATANAN
// top-level değişkenler (ör. campaign-flow.js'teki `let GameState = null; ... GameState = X;`)
// export-kopyalama numarasıyla YANLIŞ çalışır — kopya alma anındaki (ör. `null`) değeri donar,
// çünkü kopya sadece o anki DEĞERİ alır, canlı bir alias değildir (State gibi `const` + yerinde
// mutasyon edilen nesnelerde bu sorun yoktur, referans hep aynı kalır). setGlobal/getGlobal, o
// contex'in lexical global scope'unda gerçek bir atama/okuma yaparak bu sınırlamayı aşar.
function setGlobal(context, name, value) {
  const prev = context.__inject;
  context.__inject = value;
  // Hem lexical `let` bağlamasını (motorun kendi fonksiyonlarının çıplak `name` ile gördüğü)
  // HEM DE context nesnesinin kendi property'sini (bizim Node tarafından `context.name` ile
  // okuduğumuz) AYNI nesneye işaret edecek şekilde ayarlıyoruz — ikisi farklı depolardır.
  vm.runInContext(name + " = globalThis.__inject; globalThis." + name + " = globalThis.__inject;", context);
  context.__inject = prev;
}
function getGlobal(context, name) {
  try { return vm.runInContext(name, context); } catch (e) { return undefined; }
}

module.exports = { loadEngine, existingScripts, JS_DIR, setGlobal, getGlobal };
