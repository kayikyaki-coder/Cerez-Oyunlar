// Köşe Market — Canvas dükkân sahnesi: önden iç mekân, hava, dekor, müşteriler, Pamuk.
// Mantıksal çözünürlük 960x540; CSS ile ölçeklenir, DPR destekli (en çok 2). Global: Render
// Katmanlı çizim: duvar/zemin/mobilya/raf ürünleri ofscreen tuvallerde önbelleklenir (stok, yükseltme, görünüm değişince
// yenilenir); dışarısı (gökyüzü) düşük hızda tazelenir; müşteriler, Pamuk, ışık ve parçacıklar her karede çizilir.
(function (global) {
  "use strict";

  const W = 960, H = 540, FLOOR_Y = 420;
  const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';
  const FONT_T = '"Fredoka",ui-rounded,"SF Pro Rounded","Varela Round","Quicksand","Nunito","Trebuchet MS",system-ui,sans-serif';
  // Palet: style.css :root token'larıyla birebir (canvas CSS değişkeni okuyamaz)
  const C = {
    red: "#e3502c", red2: "#c63d1d", cream: "#fff3e0", cream2: "#fff8ec", card: "#fffaf2", edge: "#ffe4c0",
    wall: "#fde9cf", wall2: "#f7dcbb", wood: "#9a6438", wood2: "#71472a", wood3: "#b98150", woodL: "#d9a46c",
    ink: "#3a2a1f", ink2: "#6b5443", green: "#2f9e54", green2: "#247c41", gold: "#f2b134", gold2: "#c98a16",
    blue: "#3b8ed0", pink: "#ff8fab", pinkSoft: "#ffe6ee"
  };
  const BLOB_COLORS = ["#ffb3c1", "#a0d8ef", "#b8e0a8", "#ffd59e", "#cdb4f6", "#ffc8a2", "#9ee6cf", "#f7a8d8", "#b5c7ff", "#ffe08a"];

  // Sabit yerleşim (çizim ve bölgeler aynı sayıları kullanır)
  const L = {
    win: { x: 34, y: 108, w: 162, h: 160 },
    shelf: { x: 222, x1: 570, top: 104 },
    fridge: { x: 586, y: 124, w: 86, h: 296 },
    counter: { x: 676, x1: 836, top: 336 },
    door: { x: 852, y: 150, w: 92, h: 270 },
    catBed: { x: 112, y: 494 },
    board: { x: 694, y: 110, w: 128, h: 92 }
  };
  const REG = { x: 716, y: 304 };       // kasa
  const PAY_N = 5;                       // ödeme kuyruğu yuvası

  // ---------- yardımcılar ----------
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  function norm(s) {
    return String(s || "").toLowerCase()
      .replace(/ı/g, "i").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ü/g, "u")
      .replace(/ö/g, "o").replace(/ç/g, "c").replace(/â/g, "a").replace(/î/g, "i");
  }
  function hash(s) { s = String(s); let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function has(txt, keys) { return keys.some(k => txt.includes(k)); }
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function txt(ctx, s, x, y, size, color, weight, align) {
    ctx.font = (weight || 600) + " " + size + "px " + FONT_T; ctx.fillStyle = color;
    ctx.textAlign = align || "center"; ctx.textBaseline = "middle"; ctx.fillText(s, x, y);
  }
  function ellipse(ctx, x, y, rx, ry, fill) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); }
  function circle(ctx, x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); }
  function shadow(ctx, x, y, rx) { ellipse(ctx, x, y, rx, rx * 0.28, "rgba(90,50,20,.16)"); }
  // mobilya altı temas gölgesi (AO)
  function contactShadow(ctx, x, y, w) {
    ellipse(ctx, x, y, w / 2, 7, "rgba(90,50,20,.10)");
    ellipse(ctx, x, y - 1, w / 2 - 10, 4.5, "rgba(90,50,20,.14)");
  }
  // mantıksal zamanla deterministik "rastgele"
  function fr(i, k) { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); }
  function hex2rgb(h) { h = h.replace("#", ""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function mixHex(a, b, t) {
    const A = hex2rgb(a), B = hex2rgb(b); t = clamp(t, 0, 1);
    const h2 = (v) => ("0" + Math.round(v).toString(16)).slice(-2);
    return "#" + h2(lerp(A[0], B[0], t)) + h2(lerp(A[1], B[1], t)) + h2(lerp(A[2], B[2], t));
  }
  function heartPath(ctx, x, y, s) {
    ctx.beginPath(); ctx.moveTo(x, y + s * 0.9);
    ctx.bezierCurveTo(x - s * 1.3, y - s * 0.1, x - s * 0.6, y - s * 1.0, x, y - s * 0.35);
    ctx.bezierCurveTo(x + s * 0.6, y - s * 1.0, x + s * 1.3, y - s * 0.1, x, y + s * 0.9); ctx.closePath();
  }
  function heart(ctx, x, y, s, fill) { heartPath(ctx, x, y, s); ctx.fillStyle = fill; ctx.fill(); }
  function star4(ctx, x, y, r, fill) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 - Math.PI / 2, rad = i % 2 ? r * 0.32 : r; ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); }
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  }
  function tri(ctx, x1, y1, x2, y2, x3, y3, fill, stroke, lw) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.lineJoin = "round"; ctx.stroke(); } }

  // data.js/engine.js üst düzey const'ları window'da değil → typeof ile eriş
  function G() { return typeof Game !== "undefined" ? Game : (global.Game || null); }
  function products() { return typeof PRODUCTS !== "undefined" ? PRODUCTS : []; }
  function DATA(name) {
    switch (name) {
      case "UPGRADES": return typeof UPGRADES !== "undefined" ? UPGRADES : [];
      case "WEEKDAYS": return typeof WEEKDAYS !== "undefined" ? WEEKDAYS : [];
      case "WEATHERS": return typeof WEATHERS !== "undefined" ? WEATHERS : [];
      case "DAY_EVENTS": return typeof DAY_EVENTS !== "undefined" ? DAY_EVENTS : [];
      case "REGULARS": return typeof REGULARS !== "undefined" ? REGULARS : [];
    }
    return [];
  }
  function findBy(list, idOrObj) {
    if (!idOrObj) return null;
    if (typeof idOrObj === "object") return idOrObj;
    return (list || []).find(x => x.id === idOrObj) || { id: idOrObj, name: idOrObj };
  }
  // Ses: Sfx yoksa ya da hata verirse sessizce geç
  function sfx(name, a) { try { const s = global.Sfx; if (s && s[name]) s[name](a); } catch (e) { /* sessiz */ } }

  // ---------- durum ----------
  const S = {
    canvas: null, ctx: null, bw: 0, bh: 0, k: 1, cssW: 0,
    mode: "idle", phase: "morning", time: 0,
    plan: null, state: null,
    weather: { id: "gunes" }, wkind: "sun", event: null, ekind: null,
    slots: [], layoutSig: "", rows: 3,
    customers: [], parts: [], cidMap: {},
    cat: { x: L.catBed.x, y: L.catBed.y, tx: 0, st: "sleep", t: 6, dir: 1, alert: 0, walkT: 0, stretch: 0, prev: "sleep" },
    keeper: { hop: 0, blink: 0, wave: 0, pay: 0, wink: 0 },
    doorOpen: 0, bell: 0,
    upg: {}, badges: [], helper: { x: 300, tx: 300, t: 0 },
    view: { x0: 0, x1: W },   // görünen mantıksal x aralığı (dar/dikey ekranda kenarlar kırpılır)
    // görsel kalite / erişilebilirlik
    reduce: false, lowPower: false, forcedLow: null,
    // önbellek
    layerSig: null, prodSig: null, L: {}, skyT: -9,
    payQ: [], prints: [], banner: null, windT: 0,
    lastDraw: 0, frameEma: 16, slowFrames: 0
  };

  const zones = {
    shelf: [{ x: 300, y: 150 }], floor: [{ x: 330, y: 470 }, { x: 470, y: 492 }, { x: 600, y: 470 }, { x: 250, y: 500 }],
    register: [{ x: 724, y: 282 }, { x: 790, y: 250 }], door: [{ x: 898, y: 236 }], fridge: [{ x: 628, y: 210 }],
    window: [{ x: 115, y: 186 }], cat: [{ x: L.catBed.x, y: L.catBed.y - 60 }]
  };

  // ---------- emoji ve küçük sprite önbelleği ----------
  const glyphs = new Map(); const sprites = new Map(); let cacheK = 0;
  function checkCacheK() { if (S.k !== cacheK) { glyphs.clear(); sprites.clear(); cacheK = S.k; } }
  function glyph(e, size) {
    checkCacheK();
    const k = S.k || 1, key = e + "|" + Math.round(size * k);
    let g = glyphs.get(key);
    if (!g) {
      const px = Math.round(size * k * 1.4) + 6;           // emoji glifi font kutusundan biraz taşar
      const cv = document.createElement("canvas"); cv.width = cv.height = px;
      const c = cv.getContext("2d");
      c.font = (size * k) + "px " + EMOJI; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(e, px / 2, px / 2);
      g = { cv, sw: px / k };
      if (glyphs.size > 260) glyphs.clear();
      glyphs.set(key, g);
    }
    return g;
  }
  function emo(ctx, e, x, y, size, alpha) {
    if (!e) return;
    const g = glyph(e, size);
    if (alpha != null && alpha !== 1) { const pa = ctx.globalAlpha; ctx.globalAlpha = pa * alpha; ctx.drawImage(g.cv, x - g.sw / 2, y - g.sw / 2, g.sw, g.sw); ctx.globalAlpha = pa; }
    else ctx.drawImage(g.cv, x - g.sw / 2, y - g.sw / 2, g.sw, g.sw);
  }
  // fn(ctx) (0,0)-(lw,lh) kutusuna çizer; k ölçeğinde bir kez rasterlenir
  function sprite(key, lw, lh, fn) {
    checkCacheK();
    const k = S.k || 1; let s = sprites.get(key);
    if (!s) {
      const cv = document.createElement("canvas"); cv.width = Math.ceil(lw * k); cv.height = Math.ceil(lh * k);
      const c = cv.getContext("2d"); c.scale(k, k); fn(c);
      s = { cv, lw: cv.width / k, lh: cv.height / k }; sprites.set(key, s);
    }
    return s;
  }
  function drawSprite(ctx, s, cx, cy, sc) {
    sc = sc || 1; ctx.drawImage(s.cv, cx - s.lw * sc / 2, cy - s.lh * sc / 2, s.lw * sc, s.lh * sc);
  }
  function coinSprite() {
    return sprite("coin", 14, 14, c => {
      circle(c, 7, 7, 6.6, C.gold2); circle(c, 7, 6.6, 5.7, C.gold); circle(c, 7, 6.2, 3.9, "#ffd980");
      c.font = "700 7.5px " + FONT_T; c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = "#7a4e00"; c.fillText("₺", 7, 7);
    });
  }
  function coneSprite() {
    return sprite("cone", 240, 330, c => {
      const g = c.createLinearGradient(0, 0, 0, 330); g.addColorStop(0, "rgba(255,226,150,1)"); g.addColorStop(.35, "rgba(255,226,150,.45)"); g.addColorStop(1, "rgba(255,226,150,0)");
      c.fillStyle = g; c.beginPath(); c.moveTo(104, 0); c.lineTo(136, 0); c.lineTo(236, 330); c.lineTo(4, 330); c.closePath(); c.fill();
      const r = c.createRadialGradient(120, 8, 2, 120, 8, 54); r.addColorStop(0, "rgba(255,240,190,.9)"); r.addColorStop(1, "rgba(255,240,190,0)");
      c.fillStyle = r; c.fillRect(60, 0, 120, 70);
    });
  }

  // ---------- ofscreen katmanlar ----------
  // Katman cihaz pikseline hizalı: ana tuvalle aynı dönüşüm (k, -x0*k) + (-ox,-oy) ofseti → kimlik dönüşümüyle birebir blit.
  function mkLayer(lx, ly, lw, lh) {
    const k = S.k, v = S.view;
    const ox = Math.floor((lx - v.x0) * k), oy = Math.floor(ly * k);
    const cw = Math.max(1, Math.ceil((lx + lw - v.x0) * k) - ox), ch = Math.max(1, Math.ceil((ly + lh) * k) - oy);
    const cv = document.createElement("canvas"); cv.width = cw; cv.height = ch;
    const c = cv.getContext("2d"); c.setTransform(k, 0, 0, k, -v.x0 * k - ox, -oy);
    return { cv, ctx: c, ox, oy };
  }
  function blit(ctx, l) {
    if (!l) return;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(l.cv, l.ox, l.oy); ctx.restore();
  }

  // ---------- yerleşim ----------
  function unlockedProducts() {
    const st = curState(); const un = (st && st.unlocked) || {};
    const list = products().filter(p => un[p.id]);
    return list.length ? list : products().slice(0, 3);
  }
  function curState() { const g = G(); return (g && g.state) || S.state; }
  function shelfCap() { const g = G(); try { return (g && g.shelfCap && g.shelfCap()) || 8; } catch (e) { return 8; } }
  function effects() { const g = G(); try { return (g && g.effects && g.effects()) || {}; } catch (e) { return {}; } }

  function relayout() {
    const list = unlockedProducts();
    const extra = S.upg.shelf ? 1 : 0;
    const sig = list.map(p => p.id).join(",") + "|" + extra;
    if (sig === S.layoutSig) return;
    S.layoutSig = sig;
    const n = list.length;
    // az ürün varken her rafa bir ürün, geniş yuvalar; çoğaldıkça ızgara
    let rows = n > 15 || extra ? 4 : 3;
    rows = Math.min(rows, Math.max(1, n));
    const cols = n <= 3 ? 1 : n <= 6 ? 2 : Math.max(3, Math.ceil(n / rows));
    S.rows = Math.max(3, rows);
    const inner = (L.shelf.x1 - L.shelf.x) - 20;
    const slotW = inner / cols;
    const rowYs = rowY(S.rows);
    S.slots = list.map((p, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      return { p, x: L.shelf.x + 10 + slotW * (c + 0.5), y: rowYs[r], w: slotW };
    });
    zones.shelf.length = 0;
    S.slots.forEach(s => zones.shelf.push({ x: s.x, y: s.y - 44, productId: s.p.id }));
  }
  function rowY(rows) {
    // rafın üst yüzeyi (ürünlerin oturduğu çizgi)
    const top = L.shelf.top + 62, bot = 392;
    const out = []; for (let i = 0; i < rows; i++) out.push(rows === 1 ? top : top + (bot - top) * i / (rows - 1));
    return out;
  }

  function readUpgrades() {
    const st = curState(); const ups = (st && st.upgrades) || {};
    const defs = DATA("UPGRADES");
    const u = {}; const badges = [];
    Object.keys(ups).forEach(id => {
      const lv = ups[id]; if (!lv) return;
      const def = defs.find(d => d.id === id) || { id, name: id, emoji: "⭐" };
      const k = norm(id + " " + (def.name || ""));
      let hit = SCENE_MAP[def.scene] || SCENE_MAP[id] || null;
      if (hit) { /* scene anahtarı */ }
      else if (has(k, ["buz", "fridge", "sogut", "dolap"])) hit = "fridge";
      else if (has(k, ["kedi", "cat", "yatak", "minder", "pamuk"])) hit = "catbed";
      else if (has(k, ["bitki", "cicek", "plant", "saksi", "yesil"])) hit = "plant";
      else if (has(k, ["lamba", "isik", "lamp", "avize", "aydinlat"])) hit = "lamp";
      else if (has(k, ["tabela", "sign", "afis", "neon", "reklam", "vitrin"])) hit = "sign";
      else if (has(k, ["muzik", "radyo", "music", "pikap", "gramofon", "plak"])) hit = "music";
      else if (has(k, ["raf", "shelf", "reyon"])) hit = "shelf";
      else if (has(k, ["kasa", "register", "pos", "terazi"])) hit = "register";
      else if (has(k, ["cirak", "apprentice", "yardimci", "eleman", "personel", "kalfa"])) hit = "helper";
      else if (has(k, ["kamera", "guvenlik", "camera"])) hit = "camera";
      else if (has(k, ["vantilator", "klima", "fan"])) hit = "fan";
      else if (has(k, ["semaver", "cay", "kahve makine", "espresso"])) hit = "tea";
      else if (has(k, ["sepet", "basket", "araba"])) hit = "basket";
      else if (has(k, ["paspas", "hali", "kilim"])) hit = "mat";
      else if (has(k, ["genislet", "final", "acilis", "super"])) hit = "grand";
      if (hit && !u[hit]) u[hit] = lv; else if (hit) u[hit] += lv;
      else badges.push(def.emoji || "⭐");
      if (hit) u[hit + "_emoji"] = def.emoji;
    });
    if (effects().fridge) u.fridge = u.fridge || 1;
    S.upg = u; S.badges = badges.slice(0, 6);
    S.layoutSig = ""; relayout();
    zones.fridge[0] = u.fridge ? { x: L.fridge.x + L.fridge.w / 2, y: 220 } : { x: 628, y: 200 };
  }

  // data.js UPGRADES[].scene → sahne öğesi
  const SCENE_MAP = { raf: "shelf", tabela: "sign", yazarkasa: "register", paspas: "mat", buzdolabi: "fridge", vitrin: "vitrin",
    cirak: "helper", onluk: "apron", kediyatagi: "catbed", bitkiler: "plant", lamba: "lamp", muzik: "music", tente: "awning",
    buyukacilis: "grand", toptanci: "deal" };

  function weatherKind(w) {
    const k = norm((w && (w.id + " " + (w.name || ""))) || "");
    const toks = k.split(/[^a-z]+/);
    const starts = (p) => toks.some(t => t.startsWith(p));
    if (starts("yagmur") || starts("rain") || starts("saganak")) return "rain";
    if (starts("kar") || starts("snow")) return "snow";
    if (starts("sicak") || starts("hot") || starts("kavur") || starts("heat")) return "hot";
    if (starts("ruzgar") || starts("wind") || starts("firtina") || starts("lodos")) return "wind";
    if (starts("sis") || starts("fog") || starts("pus")) return "fog";
    if (starts("bulut") || starts("cloud") || starts("kapali")) return "cloud";
    return "sun";
  }
  function eventKind(e) {
    if (!e) return null;
    const k = norm(e.id + " " + (e.name || ""));
    if (has(k, ["mac", "futbol", "derbi"])) return "match";
    if (has(k, ["elektrik", "kesinti"])) return "dark";
    if (has(k, ["gokkusag", "rainbow"])) return "rainbow";
    if (has(k, ["dogum", "parti", "festival", "bayram", "piknik", "kutlama", "senlik", "dugun", "acilis", "sevgili"])) return "party";
    if (has(k, ["denetim", "saglik", "mufetti"])) return "inspect";
    if (has(k, ["kedi", "yavru"])) return "kittens";
    if (has(k, ["influencer", "unlu", "yildiz", "kamera", "youtuber", "gazete"])) return "star";
    if (has(k, ["toptan", "indirim", "kampanya"])) return "sale";
    if (has(k, ["okul"])) return "school";
    if (has(k, ["kurye", "grev", "komsu", "tasin"])) return "boxes";
    if (has(k, ["dizi", "final gece"])) return "tv";
    return "generic";
  }

  // ---------- müşteriler ----------
  // Gövde tipi: yuvarlak / uzun / çocuk; aksesuar 0-7 + hava aksesuarı (atkı, güneş gözlüğü); şemsiye, ter, nefes buharı
  function lookOf(look, cid) {
    look = look || {};
    const h = hash((look.face || "") + ":" + cid);
    const reg = look.regular || look.regularId || null;
    return {
      color: look.color || BLOB_COLORS[h % BLOB_COLORS.length],
      acc: h % 8, hair: (h >> 3) % 4, size: 25 + ((h >> 6) % 7),
      body: reg ? "round" : ["round", "round", "tall", "kid"][(h >> 9) % 4],
      umb: (h >> 12) % 100 < 62, shade: (h >> 15) % 100 < 50, sweat: (h >> 19) % 100 < 60, tone: (h >> 22) % 3,
      face: look.face, regular: reg
    };
  }
  function bodyDims(lk) {
    const r = lk.size;
    if (lk.body === "tall") return { rx: r * 0.84, ry: r * 1.28, fs: 1 };
    if (lk.body === "kid") return { rx: r * 0.76, ry: r * 0.82, fs: 0.82 };
    return { rx: r, ry: r * 1.05, fs: 1 };
  }
  function slotFor(pid) { return S.slots.find(s => s.p.id === pid) || null; }
  function productEmoji(pid) { const p = products().find(x => x.id === pid); return p ? p.emoji : "🛍️"; }
  function regName(id) {
    if (!id) return "";
    if (typeof id === "object") return id.name || "";
    const r = DATA("REGULARS").find(x => x.id === id); return r ? r.name : "";
  }

  function addCustomer(cid, look) {
    // ekranda çok kişi birikirse en eskisini at
    if (S.customers.length > 13) { const old = S.customers.shift(); delete S.cidMap[old.cid]; freePay(old); }
    const hy = 470 + ((hash(cid) % 5) * 8);
    const c = {
      cid, look: lookOf(look, cid), x: L.door.x + 46, y: hy, homeY: hy, alpha: 0,
      q: [], cur: null, carried: [], amount: 0, happy: null, walkT: 0, dir: -1, idle: 0,
      think: null, sad: 0, hop: 0, gone: false, heart: 0, moving: false, wet: S.wkind === "rain" ? 8 : 0, stepD: 0, paySlot: -1, spot: null
    };
    const sp = pickSpot(c, 480 + (hash(cid + "b") % 80) - 40);
    c.q.push({ k: "walk", x: sp.x, y: sp.y });
    S.customers.push(c); S.cidMap[cid] = c;
    S.doorOpen = 0.7; S.bell = 1;
    return c;
  }
  function custOf(cid, look) { return S.cidMap[cid] || addCustomer(cid, look); }
  function standX(pid) { const s = slotFor(pid); return s ? clamp(s.x, 250, 560) : 330 + Math.random() * 180; }
  // Aynı (x±22, y±8) hücresinde iki müşteri durmasın: raf önünde 3-7 yuvadan birini seç
  function pickSpot(c, x0) {
    const offs = [0, -26, 26, -52, 52, -78, 78];
    for (let dy = 0; dy <= 24; dy += 8) {
      for (const o of offs) {
        const x = clamp(x0 + o, 250, 570), y = Math.min(c.homeY + dy, 508);
        let free = true;
        for (const q of S.customers) { if (q !== c && !q.gone && q.spot && Math.abs(q.spot.x - x) < 22 && Math.abs(q.spot.y - y) < 8) { free = false; break; } }
        if (free) { c.spot = { x, y }; return c.spot; }
      }
    }
    c.spot = { x: clamp(x0, 250, 570), y: c.homeY }; return c.spot;
  }
  // Ödeme kuyruğu: x 700 / 672 / 644…, y +6 basamak
  function claimPay(c) {
    if (c.paySlot >= 0) return c.paySlot;
    let i = 0;
    for (; i < PAY_N; i++) { const id = S.payQ[i]; if (id == null || !S.cidMap[id]) break; }
    i = Math.min(i, PAY_N - 1);
    S.payQ[i] = c.cid; c.paySlot = i; return i;
  }
  function freePay(c) { if (c && c.paySlot >= 0 && S.payQ[c.paySlot] === c.cid) S.payQ[c.paySlot] = null; if (c) c.paySlot = -1; }

  function addPrint(x, y, dir) {
    if (S.prints.length > 26) S.prints.shift();
    S.prints.push({ x, y, dir, t: 0, flip: S.prints.length % 2 });
  }

  function stepCustomer(c, dt) {
    c.walkT += dt; if (c.hop > 0) c.hop = Math.max(0, c.hop - dt * 2.2); if (c.heart > 0) c.heart -= dt;
    if (c.wet > 0) c.wet -= dt;
    c.moving = false;
    if (c.alpha < 1 && !c.leaving) c.alpha = Math.min(1, c.alpha + dt * 3);
    if (!c.cur && c.q.length) { c.cur = c.q.shift(); c.cur.t = 0; }
    const a = c.cur;
    if (!a) { c.idle += dt; if (c.idle > 25) c.q.push({ k: "leave" }); return; }
    c.idle = 0; a.t += dt;
    // kuyrukta çok iş biriktiyse hızlan
    const rush = 1 + Math.min(2, c.q.length * 0.35);
    switch (a.k) {
      case "walk": {
        const sp = 150 * rush, dx = a.x - c.x, dy = a.y != null ? a.y - c.y : 0, dist = Math.hypot(dx, dy);
        if (dist < 3) { c.x = a.x; if (a.y != null) c.y = a.y; c.cur = null; break; }
        const step = Math.min(dist, sp * dt);
        c.x += dx / dist * step; c.y += dy / dist * step;
        if (Math.abs(dx) > 2) c.dir = Math.sign(dx);
        c.moving = true;
        if (c.wet > 0 && S.wkind === "rain" && c.x < L.door.x - 4) { c.stepD += step; if (c.stepD > 26) { c.stepD = 0; addPrint(c.x, c.y + 2, c.dir); } }
        return;
      }
      case "wait": if (a.t >= a.d / rush) c.cur = null; break;
      case "grab": {
        c.think = null;
        const s = slotFor(a.pid);
        if (s) spawnFly(productEmoji(a.pid), s.x, s.y - 16, c.x, c.y - 50);
        c.carried.push(productEmoji(a.pid)); c.amount += a.amount || 0; c.cur = null; sfx("shelf"); break;
      }
      case "sad": c.think = null; c.sad = 1.2; c.happy = false; if (a.t > 0.9) c.cur = null; break;
      case "pay": {
        if (!a.done && a.t > 0.35) {
          a.done = true;
          if (c.amount > 0) { payCoins(); S.keeper.hop = 1; S.keeper.pay = 1; if (c.happy !== false) S.keeper.wink = 0.5; sfx("register"); }
          c.carried = []; c.hop = 1; c.heart = 1.2;
        }
        if (a.t > 0.7) { c.cur = null; freePay(c); } break;
      }
      case "leave": c.leaving = true; freePay(c); c.q.unshift({ k: "exit" }); c.cur = null; if (c.happy !== false) c.hop = 1; break;
      case "exit": {
        const tx = L.door.x + 46, dx = tx - c.x;
        c.dir = 1; c.x += Math.min(Math.abs(dx), 170 * rush * dt); c.moving = true;
        if (Math.abs(dx) < 40) { c.alpha -= dt * 4; if (Math.abs(dx) < 50 && S.doorOpen < 0.3) S.doorOpen = 0.5; }
        if (c.alpha <= 0 || Math.abs(dx) < 2) { c.gone = true; freePay(c); }
        return;
      }
      default: c.cur = null;
    }
  }

  // ---------- parçacıklar ----------
  function pushPart(p) {
    const cap = S.lowPower ? 60 : 120;
    if (S.parts.length >= cap) S.parts.shift();
    S.parts.push(p);
  }
  function floaty(s, x, y, color, size) { pushPart({ k: "text", s, x, y, vy: -34, life: 1.4, max: 1.4, color: color || C.green, size: size || 22 }); }
  // ödemede kasadan 3 bozuk para fırlar (yazı HUD'a bırakılır)
  function payCoins() {
    const n = S.reduce ? 1 : 3;
    for (let i = 0; i < n; i++) pushPart({ k: "coin", x: REG.x + 12 + (Math.random() - .5) * 14, y: REG.y - 12, vx: (Math.random() - .5) * 70 + 10, vy: -170 - Math.random() * 60, g: S.reduce ? 0 : 520, rot: Math.random() * 6, life: .85, max: .85 });
  }
  // baloncuktan HUD yönüne (sahnenin sol üstü) uçan bozuk paralar
  function coinFly(x, y, n) {
    const tx = S.view.x0 + 36, ty = 20;
    for (let i = 0; i < (S.reduce ? 1 : n || 3); i++) pushPart({ k: "cfly", x0: x + (Math.random() - .5) * 14, y0: y - 6, x1: tx, y1: ty, bend: (Math.random() - .5) * 120, d: i * 0.07, life: .62 + i * .07, max: .62 + i * .07 });
  }
  function hearts(x, y, n) {
    for (let i = 0; i < (S.reduce ? 1 : n || 3); i++) pushPart({ k: "heart", x: x + (Math.random() - .5) * 24, y, vx: (Math.random() - .5) * 40, vy: S.reduce ? 0 : -50 - Math.random() * 30, g: 0, life: 1.1, max: 1.1, s: 3.2 + Math.random() * 1.6, ph: Math.random() * 6 });
  }
  function sparkles(x, y, n) {
    for (let i = 0; i < n; i++) pushPart({ k: "spark", x: x + (Math.random() - .5) * 30, y: y + (Math.random() - .5) * 24, vx: 0, vy: -14, life: .8, max: .8, r: 4 + Math.random() * 3 });
  }
  function spawnFly(e, x0, y0, x1, y1) { pushPart({ k: "fly", e, x0, y0, x1, y1, life: .45, max: .45, size: 22 }); }
  function confetti(n) {
    if (S.reduce) return;
    const cols = ["#ff9db6", "#ffd57e", "#9dcfe8", "#a4d9ba", "#d3bff6", "#ffab7e"];
    n = S.lowPower ? Math.min(n || 70, 36) : (n || 70);
    for (let i = 0; i < n; i++) pushPart({ k: "conf", x: S.view.x0 + Math.random() * (S.view.x1 - S.view.x0), y: -10 - Math.random() * 80, vx: (Math.random() - .5) * 60, vy: 60 + Math.random() * 90, rot: Math.random() * 6, vr: (Math.random() - .5) * 8, c: cols[i % cols.length], dot: i % 3 === 0, life: 3.2, max: 3.2 });
  }
  function updParts(dt) {
    for (const p of S.parts) {
      p.life -= dt;
      if (p.k === "fly" || p.k === "cfly") continue;
      p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt; if (p.g) p.vy += p.g * dt; if (p.vr) p.rot += p.vr * dt;
    }
    S.parts = S.parts.filter(p => p.life > 0);
    for (const q of S.prints) q.t += dt;
    S.prints = S.prints.filter(q => q.t < 20);
    if (S.banner) { S.banner.t += dt; if (S.banner.t > S.banner.max) S.banner = null; }
  }
  const PART_FONTS = {};
  function partFont(size) { return PART_FONTS[size] || (PART_FONTS[size] = "700 " + size + "px " + FONT_T); }
  function drawParts(ctx) {
    let curFont = "";
    for (const p of S.parts) {
      const a = clamp(p.life / p.max * 1.6, 0, 1);
      switch (p.k) {
        case "text": {
          ctx.save(); ctx.globalAlpha = a; ctx.lineWidth = 4; ctx.strokeStyle = "#fff"; ctx.lineJoin = "round";
          const f = partFont(p.size); if (f !== curFont) { ctx.font = f; curFont = f; }
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.strokeText(p.s, p.x, p.y); ctx.fillStyle = p.color; ctx.fillText(p.s, p.x, p.y); ctx.restore(); curFont = ""; break;
        }
        case "coin": { const sx = Math.abs(Math.cos(p.rot + p.life * 14)); ctx.save(); ctx.globalAlpha = a; ctx.translate(p.x, p.y); ctx.scale(Math.max(.25, sx), 1); drawSprite(ctx, coinSprite(), 0, 0, 1); ctx.restore(); break; }
        case "cfly": {
          const t = clamp((p.max - p.life - p.d) / (p.max - p.d), 0, 1); if (p.max - p.life < p.d) break;
          const e = t * t * (3 - 2 * t), x = lerp(p.x0, p.x1, e) + Math.sin(t * Math.PI) * p.bend, y = lerp(p.y0, p.y1, e) - Math.sin(t * Math.PI) * 40;
          ctx.save(); ctx.globalAlpha = t > .85 ? (1 - t) / .15 : 1; drawSprite(ctx, coinSprite(), x, y, 1 - t * .35); ctx.restore(); break;
        }
        case "heart": heartPath(ctx, p.x + Math.sin(S.time * 4 + p.ph) * 3, p.y, p.s); ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = "#ff7a9c"; ctx.fill(); ctx.restore(); break;
        case "spark": ctx.save(); ctx.globalAlpha = a; star4(ctx, p.x, p.y, p.r * (0.6 + 0.4 * a), "#ffe27a"); ctx.restore(); break;
        case "emo": emo(ctx, p.e, p.x, p.y, p.size, a); break;
        case "fly": {
          const t = 1 - p.life / p.max, x = lerp(p.x0, p.x1, t), y = lerp(p.y0, p.y1, t) - Math.sin(t * Math.PI) * 40;
          emo(ctx, p.e, x, y, p.size); break;
        }
        case "conf":
          ctx.save(); ctx.globalAlpha = a; ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c;
          if (p.dot) { ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill(); } else ctx.fillRect(-4, -2.5, 8, 5);
          ctx.restore(); break;
      }
    }
  }
  // "Hedef tamam!" kurdelesi: yukarıdan kayar, 2,4 sn kalır
  function drawBanner(ctx) {
    const b = S.banner; if (!b) return;
    const t = b.t, inT = clamp(t / 0.35, 0, 1), outT = clamp((b.max - t) / 0.4, 0, 1);
    const e = 1 - Math.pow(1 - inT, 3), cx = (S.view.x0 + S.view.x1) / 2, y = lerp(60, 112, e);
    ctx.save(); ctx.globalAlpha = outT;
    const w = 230, h = 34;
    // kuyruklar
    ctx.fillStyle = C.red2;
    [[-1, cx - w / 2], [1, cx + w / 2]].forEach(([s, ex]) => { ctx.beginPath(); ctx.moveTo(ex, y - h / 2 + 8); ctx.lineTo(ex + s * 34, y - h / 2 + 8); ctx.lineTo(ex + s * 22, y + 8); ctx.lineTo(ex + s * 34, y + h / 2 + 8); ctx.lineTo(ex, y + h / 2 + 8); ctx.closePath(); ctx.fill(); });
    rr(ctx, cx - w / 2, y - h / 2, w, h, 8); ctx.fillStyle = C.red; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = "#fff"; ctx.stroke();
    star4(ctx, cx - w / 2 + 20, y, 8, C.gold); star4(ctx, cx + w / 2 - 20, y, 8, C.gold);
    txt(ctx, b.text, cx, y + 1, 19, "#fff", 700);
    ctx.restore();
  }

  // ---------- dış dünya (pencere / kapı camı) ----------
  function dayProgress() {
    if (S.mode === "day") { const g = G(); const r = g && g.run; return r && r.length ? clamp(r.t / r.length, 0, 1) * 0.95 : 0.1; }
    return S.phase === "evening" ? 1.02 : 0.05;
  }
  function isNight() { return S.mode !== "day" && S.phase === "evening"; }
  function skyColors(kind) {
    let top, bot;
    switch (kind) {
      case "rain": top = "#8fa3b8"; bot = "#c3cfdb"; break;
      case "snow": top = "#b9c9dc"; bot = "#eaf0f7"; break;
      case "hot": top = "#ffb56b"; bot = "#ffe7a8"; break;
      case "cloud": top = "#a9c1d6"; bot = "#dde8f0"; break;
      case "fog": top = "#cfd6dc"; bot = "#eef1f3"; break;
      case "wind": top = "#8fcbe8"; bot = "#d4eef8"; break;
      default: top = "#7fc8f0"; bot = "#d6f0ff";
    }
    return { top, bot };
  }
  function drawOutside(ctx, x, y, w, h, key) {
    const t = S.time, p = dayProgress(), kind = S.wkind, R = S.reduce;
    const dusk = clamp((p - 0.72) / 0.28, 0, 1), night = isNight() ? 1 : 0;
    const sc = skyColors(kind);
    let top = sc.top, bot = sc.bot;
    if (dusk > 0) { top = mixHex(top, "#8a63b5", dusk * 0.7); bot = mixHex(bot, "#ff9a6e", dusk * 0.8); }
    if (night > 0) { top = mixHex(top, "#25285a", 0.95); bot = mixHex(bot, "#54447f", 0.9); }
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, top); g.addColorStop(1, bot);
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    const clearSky = kind === "sun" || kind === "hot" || kind === "wind";
    // yıldızlar + ay (akşam), güneş (gündüz)
    if (night > 0) {
      const sn = clearSky ? 1 : 0.35;
      for (let i = 0; i < 16; i++) { const a = (0.35 + 0.65 * Math.abs(Math.sin(t * 1.3 + i * 2.1))) * sn; ctx.fillStyle = "rgba(255,248,214," + a.toFixed(2) + ")"; ctx.fillRect(x + fr(i, 21) * w, y + fr(i, 22) * h * 0.5, 1.8, 1.8); }
      const mx = x + w * (key === "door" ? 0.34 : 0.74), my = y + h * 0.2;
      circle(ctx, mx, my, 13, "#fff6d6"); circle(ctx, mx + 6, my - 3, 11.5, top);
    } else if (clearSky) {
      const sx = x + w * (key === "door" ? 0.3 : 0.74), sy = y + h * (0.24 + dusk * 0.45), r = kind === "hot" ? 22 : 16;
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(R ? 0 : t * 0.3);
      ctx.fillStyle = kind === "hot" ? "rgba(255,200,80,.55)" : "rgba(255,230,120,.6)";
      for (let i = 0; i < 10; i++) { ctx.rotate(Math.PI / 5); ctx.beginPath(); ctx.moveTo(r + 3, -3); ctx.lineTo(r + 12 + (R ? 0 : Math.sin(t * 3 + i) * 3), 0); ctx.lineTo(r + 3, 3); ctx.fill(); }
      ctx.restore(); circle(ctx, sx, sy, r, kind === "hot" ? "#ff9e3d" : dusk > 0.4 ? "#ff9a4d" : "#ffd84d");
      circle(ctx, sx - r * .3, sy - r * .3, r * .35, "rgba(255,255,255,.35)");
    }
    // karşı binalar
    const baseY = y + h * 0.66;
    const houses = ["#f7c6c7", "#c7e3f7", "#fbe3a6", "#cfe8c3", "#e3d0f5"];
    const lit = Math.max(dusk > 0.4 ? dusk : 0, night);
    for (let i = 0; i < 4; i++) {
      const hx = x - 10 + i * (w / 3.2), hw = w / 3.6, hh = h * (0.28 + fr(i, key === "door" ? 3 : 1) * 0.16);
      ctx.fillStyle = houses[(i + (key === "door" ? 2 : 0)) % houses.length]; ctx.fillRect(hx, baseY - hh, hw, hh);
      ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.fillRect(hx + hw * .2, baseY - hh * .72, hw * .2, hh * .2); ctx.fillRect(hx + hw * .6, baseY - hh * .72, hw * .2, hh * .2);
      if (lit > 0) { ctx.fillStyle = "rgba(255,220,120," + (lit * 0.95).toFixed(2) + ")"; ctx.fillRect(hx + hw * .2, baseY - hh * .72, hw * .2, hh * .2); if (i % 2 === 0) ctx.fillRect(hx + hw * .6, baseY - hh * .72, hw * .2, hh * .2); }
      ctx.fillStyle = "rgba(0,0,0,.08)"; ctx.fillRect(hx, baseY - hh, hw, 4);
      if (kind === "snow") { ctx.fillStyle = "#fff"; rr(ctx, hx - 2, baseY - hh - 4, hw + 4, 7, 3); ctx.fill(); }
    }
    // ağaç (rüzgârda eğilir)
    const tx = x + w * (key === "door" ? 0.78 : 0.18), bend = kind === "wind" && !R ? Math.sin(t * 2.2) * 6 + 6 : (R ? 0 : Math.sin(t * .8) * 1.5);
    ctx.fillStyle = "#8a5a36"; ctx.fillRect(tx - 3, baseY - 26, 6, 26);
    circle(ctx, tx + bend, baseY - 34, 15, kind === "snow" ? "#e8f1f4" : "#7cc47a");
    circle(ctx, tx + bend - 9, baseY - 26, 11, kind === "snow" ? "#dfeaee" : "#6bb56a");
    circle(ctx, tx + bend + 9, baseY - 27, 11, kind === "snow" ? "#f4f8fa" : "#8fd08b");
    // kaldırım / yol
    ctx.fillStyle = kind === "snow" ? "#f4f7fb" : (kind === "rain" ? "#9aa3ab" : "#d9d2c5"); ctx.fillRect(x, baseY, w, h - (baseY - y));
    ctx.fillStyle = "rgba(0,0,0,.06)"; for (let i = 0; i < 6; i++) ctx.fillRect(x + i * w / 5, baseY + 8, 2, h);
    // gece/akşam alacası: bina + zemin üstüne lacivert örtü
    if (night > 0 || dusk > 0) { ctx.fillStyle = "rgba(34,30,90," + (night ? 0.38 : dusk * 0.14).toFixed(2) + ")"; ctx.fillRect(x, baseY - h * 0.5, w, h * 0.5 + (h - (baseY - y))); }
    // bulutlar
    const nCloud = kind === "sun" ? 2 : kind === "hot" ? 1 : kind === "wind" ? 3 : 4;
    const cSpeed = (kind === "wind" ? 38 : 8) * (R ? 0.25 : 1);
    const cCol = kind === "rain" ? "#7d8b99" : kind === "snow" ? "#e9eef4" : night ? "#8d86b8" : "#ffffff";
    for (let i = 0; i < nCloud; i++) {
      const cx = x + ((fr(i, 7) * (w + 80) + t * cSpeed * (0.6 + fr(i, 2) * .6)) % (w + 80)) - 40;
      const cy = y + 14 + fr(i, 9) * h * 0.3;
      ctx.globalAlpha = kind === "fog" ? .6 : .92;
      circle(ctx, cx, cy, 11, cCol); circle(ctx, cx + 12, cy - 5, 13, cCol); circle(ctx, cx + 25, cy, 10, cCol); ellipse(ctx, cx + 12, cy + 4, 22, 7, cCol);
      ctx.globalAlpha = 1;
    }
    if (S.ekind === "rainbow") {
      ctx.save(); ctx.globalAlpha = .55; ctx.lineWidth = 5;
      ["#ff6b6b", "#ffb347", "#ffe66d", "#7bd389", "#6ec3f4", "#b39ddb"].forEach((cc, i) => { ctx.strokeStyle = cc; ctx.beginPath(); ctx.arc(x + w * .5, baseY + 6, w * .44 - i * 5, Math.PI, 0); ctx.stroke(); });
      ctx.restore();
    }
    // yağış / kar / ısı / rüzgâr
    if (kind === "rain") {
      ctx.strokeStyle = "rgba(230,240,255,.8)"; ctx.lineWidth = 1.6; ctx.beginPath();
      const n = S.lowPower ? 18 : 26;
      for (let i = 0; i < n; i++) {
        const rx = x + (fr(i, 1) * w + t * 30) % w, ry = y + ((fr(i, 2) * h + t * 360) % h);
        ctx.moveTo(rx, ry); ctx.lineTo(rx - 4, ry + 12);
      }
      ctx.stroke();
      for (let i = 0; i < 3; i++) { const ph = (t * .9 + i / 3) % 1; ctx.strokeStyle = "rgba(255,255,255," + ((1 - ph) * .7).toFixed(2) + ")"; ctx.beginPath(); ctx.ellipse(x + w * (.2 + i * .3), y + h - 10, 4 + ph * 12, 1.5 + ph * 3, 0, 0, Math.PI * 2); ctx.stroke(); }
    } else if (kind === "snow") {
      ctx.fillStyle = "#fff";
      const n = S.lowPower ? 18 : 26;
      for (let i = 0; i < n; i++) {
        const sy = y + ((fr(i, 3) * h + t * (22 + fr(i, 4) * 18)) % h), sx = x + ((fr(i, 5) * w + Math.sin(t + i) * 8) % w + w) % w;
        ctx.beginPath(); ctx.arc(sx, sy, 1.5 + fr(i, 6) * 2, 0, Math.PI * 2); ctx.fill();
      }
    } else if (kind === "hot") {
      if (!S.lowPower) {
        ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 2;
        for (let j = 0; j < 4; j++) {
          ctx.beginPath(); const yy = baseY - 8 - j * 16;
          for (let xx = 0; xx <= w; xx += 4) { const vy = yy + Math.sin(xx * .12 + t * 5 + j) * 2.5; if (xx === 0) ctx.moveTo(x + xx, vy); else ctx.lineTo(x + xx, vy); }
          ctx.stroke();
        }
      }
    } else if (kind === "wind") {
      for (let i = 0; i < 5; i++) {
        const lx = x + ((fr(i, 8) * w + t * (90 + fr(i, 3) * 60)) % (w + 30)) - 15, ly = y + h * (.2 + fr(i, 4) * .6) + Math.sin(t * 3 + i) * 10;
        ctx.save(); ctx.translate(lx, ly); ctx.rotate(t * 4 + i); ellipse(ctx, 0, 0, 5, 2.6, i % 2 ? "#e39a4c" : "#c9772e"); ctx.restore();
      }
      ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) { const wx = x + ((fr(i, 11) * w + t * 140) % (w + 60)) - 30, wy = y + 20 + i * 30; ctx.beginPath(); ctx.moveTo(wx, wy); ctx.quadraticCurveTo(wx + 14, wy - 6, wx + 28, wy); ctx.stroke(); }
    } else if (kind === "fog") {
      ctx.fillStyle = "rgba(255,255,255,.4)"; ctx.fillRect(x, y, w, h);
    }
    ctx.restore();
  }

  // ---------- statik sahne (önbelleğe boyanır) ----------
  function paintWall(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, FLOOR_Y); g.addColorStop(0, C.wall); g.addColorStop(1, C.wall2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, FLOOR_Y);
    // çok seyrek nokta deseni
    ctx.fillStyle = "rgba(227,80,44,.06)";
    for (let y = 84; y < 340; y += 34) for (let x = 34 + ((y / 34) % 2) * 24; x < W; x += 48) { ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill(); }
    // lambri: panel + üst çıta + süpürgelik
    ctx.fillStyle = "#ebcb9f"; ctx.fillRect(0, 352, W, FLOOR_Y - 352);
    for (let x = 10; x < W; x += 96) {
      rr(ctx, x, 364, 80, 42, 6); ctx.fillStyle = "#f1d5ab"; ctx.fill();
      ctx.strokeStyle = "rgba(113,71,42,.22)"; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(x + 6, 366, 68, 1.5);
    }
    ctx.fillStyle = C.wood3; ctx.fillRect(0, 346, W, 7);
    ctx.fillStyle = C.woodL; ctx.fillRect(0, 346, W, 2);
    ctx.fillStyle = "rgba(60,30,10,.12)"; ctx.fillRect(0, 353, W, 4);
    ctx.fillStyle = C.wood2; ctx.fillRect(0, FLOOR_Y - 8, W, 8);
    ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.fillRect(0, FLOOR_Y - 8, W, 1.5);
    // tente altı yumuşak gölge
    const sg = ctx.createLinearGradient(0, 44, 0, 84); sg.addColorStop(0, "rgba(90,40,20,.20)"); sg.addColorStop(1, "rgba(90,40,20,0)");
    ctx.fillStyle = sg; ctx.fillRect(0, 44, W, 40);
  }
  // Perspektifli iki tonlu karo zemin: 3 sıra (satırlar öne doğru büyür), her satırda aynı karo sayısı
  function paintFloor(ctx) {
    const rows = [FLOOR_Y, 452, 490, H], nCol = 16, cx = W / 2, bw = 86, topK = 0.78, depth = H - FLOOR_Y;
    const kAt = (y) => lerp(topK, 1, (y - FLOOR_Y) / depth);
    const xAt = (i, y) => cx + (i - nCol / 2) * bw * kAt(y);
    for (let r = 0; r < 3; r++) {
      const y0 = rows[r], y1 = rows[r + 1];
      for (let i = 0; i < nCol; i++) {
        ctx.beginPath(); ctx.moveTo(xAt(i, y0), y0); ctx.lineTo(xAt(i + 1, y0), y0); ctx.lineTo(xAt(i + 1, y1), y1); ctx.lineTo(xAt(i, y1), y1); ctx.closePath();
        ctx.fillStyle = (i + r) % 2 ? "#efd6b4" : "#f6e4c8"; ctx.fill();
      }
      // derz: üst kenar açık, alt kenar koyu
      ctx.fillStyle = "rgba(255,255,255,.28)"; ctx.fillRect(0, y0, W, 1.4);
      ctx.fillStyle = "rgba(120,70,30,.10)"; ctx.fillRect(0, y1 - 1.2, W, 1.2);
    }
    ctx.strokeStyle = "rgba(120,70,30,.07)"; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 0; i <= nCol; i++) { ctx.moveTo(xAt(i, FLOOR_Y), FLOOR_Y); ctx.lineTo(xAt(i, H), H); }
    ctx.stroke();
    // duvar dibinde koyu geçiş
    const g = ctx.createLinearGradient(0, FLOOR_Y, 0, H); g.addColorStop(0, "rgba(120,70,30,.20)"); g.addColorStop(.28, "rgba(120,70,30,0)");
    ctx.fillStyle = g; ctx.fillRect(0, FLOOR_Y, W, depth);
    if (S.upg.mat) {
      rr(ctx, L.door.x - 30, 498, 120, 24, 8); ctx.fillStyle = "#d9776a"; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#b95a4e"; ctx.stroke();
      ctx.fillStyle = "#f3b0a4"; for (let i = 0; i < 5; i++) ctx.fillRect(L.door.x - 22 + i * 22, 503, 10, 14);
    }
  }
  function paintShadows(ctx) {
    const s = L.shelf, f = L.fridge, c = L.counter;
    contactShadow(ctx, (s.x + s.x1) / 2, FLOOR_Y + 6, s.x1 - s.x + 44);
    contactShadow(ctx, (c.x + c.x1) / 2, FLOOR_Y + 8, c.x1 - c.x + 34);
    if (S.upg.fridge) contactShadow(ctx, f.x + f.w / 2, FLOOR_Y + 6, f.w + 24);
    contactShadow(ctx, L.door.x + L.door.w / 2, FLOOR_Y + 5, L.door.w + 30);
  }
  function paintWindowFrame(ctx) {
    const w = L.win;
    rr(ctx, w.x - 8, w.y - 4, w.w + 20, w.h + 24, 16); ctx.fillStyle = "rgba(90,50,20,.10)"; ctx.fill();
    rr(ctx, w.x - 10, w.y - 10, w.w + 20, w.h + 20, 14); ctx.fillStyle = C.wood; ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.24)"; ctx.lineWidth = 2; rr(ctx, w.x - 9, w.y - 9, w.w + 18, w.h + 18, 13); ctx.stroke();
    rr(ctx, w.x - 4, w.y - 4, w.w + 8, w.h + 8, 10); ctx.fillStyle = "#fff4e0"; ctx.fill();
    ctx.clearRect(w.x, w.y, w.w, w.h);           // cam: gökyüzü altta ayrı katmanda
    let g = ctx.createLinearGradient(0, w.y, 0, w.y + 24); g.addColorStop(0, "rgba(60,30,10,.18)"); g.addColorStop(1, "rgba(60,30,10,0)");
    ctx.fillStyle = g; ctx.fillRect(w.x, w.y, w.w, 24);
    // camda parlama + çıtalar
    ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.beginPath(); ctx.moveTo(w.x + 20, w.y); ctx.lineTo(w.x + 50, w.y); ctx.lineTo(w.x + 10, w.y + w.h); ctx.lineTo(w.x - 20, w.y + w.h); ctx.fill();
    ctx.fillStyle = "#fff4e0"; ctx.fillRect(w.x + w.w / 2 - 3, w.y, 6, w.h); ctx.fillRect(w.x, w.y + w.h / 2 - 3, w.w, 6);
    ctx.fillStyle = "rgba(113,71,42,.14)"; ctx.fillRect(w.x + w.w / 2 + 3, w.y, 2, w.h); ctx.fillRect(w.x, w.y + w.h / 2 + 3, w.w, 2);
    if (S.wkind === "rain" || S.wkind === "snow") { ctx.fillStyle = "rgba(255,255,255,.10)"; ctx.fillRect(w.x, w.y, w.w, w.h); }
    if (S.wkind === "snow") { // cam köşelerinde buz
      [[w.x, w.y, 1, 1], [w.x + w.w, w.y, -1, 1], [w.x, w.y + w.h, 1, -1], [w.x + w.w, w.y + w.h, -1, -1]].forEach(([cx, cy, sx, sy]) => {
        const gg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 34); gg.addColorStop(0, "rgba(255,255,255,.62)"); gg.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = gg; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + sx * 40, cy); ctx.lineTo(cx, cy + sy * 40); ctx.closePath(); ctx.fill();
      });
    }
    ctx.fillStyle = C.red; ctx.fillRect(w.x - 14, w.y - 16, w.w + 28, 8);          // korniş
    ctx.fillStyle = "rgba(255,255,255,.28)"; ctx.fillRect(w.x - 14, w.y - 16, w.w + 28, 2);
    // denizlik
    rr(ctx, w.x - 16, w.y + w.h + 8, w.w + 32, 12, 5); ctx.fillStyle = C.wood3; ctx.fill();
    ctx.fillStyle = C.woodL; ctx.fillRect(w.x - 12, w.y + w.h + 8, w.w + 24, 2.5);
    if (S.wkind === "snow") { rr(ctx, w.x - 12, w.y + w.h + 2, w.w + 24, 9, 4); ctx.fillStyle = "#fff"; ctx.fill(); circle(ctx, w.x + 30, w.y + w.h + 3, 6, "#fff"); circle(ctx, w.x + w.w - 40, w.y + w.h + 3, 7, "#fff"); }
    if (S.upg.vitrin && S.slots.length) emo(ctx, S.slots[S.slots.length - 1].p.emoji, w.x + w.w - 26, w.y + w.h + 2, 20);
    if (S.upg.plant) { // saksı çiçekleri pervazda
      const pl = ["🌷", "🌼", "🌸"];
      for (let i = 0; i < Math.min(3, 1 + S.upg.plant); i++) {
        const px = w.x + 24 + i * 56; rr(ctx, px - 11, w.y + w.h - 6, 22, 16, 4); ctx.fillStyle = "#e0875a"; ctx.fill();
        emo(ctx, pl[i], px, w.y + w.h - 14, 20);
      }
    }
  }
  function paintShelf(ctx) {
    relayout();
    const s = L.shelf, rows = rowY(S.rows);
    // gövde
    rr(ctx, s.x - 6, s.top - 8, s.x1 - s.x + 12, FLOOR_Y - s.top + 8, 12); ctx.fillStyle = C.wood2; ctx.fill();
    rr(ctx, s.x + 4, s.top + 2, s.x1 - s.x - 8, FLOOR_Y - s.top - 12, 8); ctx.fillStyle = "#c68f5c"; ctx.fill();
    // arka panel: yatay tahta çizgileri (derinlik)
    ctx.fillStyle = "rgba(80,40,15,.16)"; for (let y = s.top + 28; y < FLOOR_Y - 14; y += 28) ctx.fillRect(s.x + 4, y, s.x1 - s.x - 8, 3);
    ctx.fillStyle = "rgba(255,255,255,.10)"; for (let y = s.top + 31; y < FLOOR_Y - 14; y += 28) ctx.fillRect(s.x + 4, y, s.x1 - s.x - 8, 1.5);
    const sh = ctx.createLinearGradient(s.x + 4, 0, s.x + 34, 0); sh.addColorStop(0, "rgba(60,30,10,.22)"); sh.addColorStop(1, "rgba(60,30,10,0)");
    ctx.fillStyle = sh; ctx.fillRect(s.x + 4, s.top + 2, 30, FLOOR_Y - s.top - 12);   // iç yan gölge
    // tepe süsü
    rr(ctx, s.x - 12, s.top - 16, s.x1 - s.x + 24, 14, 6); ctx.fillStyle = C.wood; ctx.fill();
    ctx.fillStyle = C.woodL; ctx.fillRect(s.x - 8, s.top - 16, s.x1 - s.x + 16, 2.5);
    // raflar: alt gölge 8 px
    rows.forEach(y => {
      const g = ctx.createLinearGradient(0, y + 12, 0, y + 22); g.addColorStop(0, "rgba(60,30,10,.24)"); g.addColorStop(1, "rgba(60,30,10,0)");
      ctx.fillStyle = g; ctx.fillRect(s.x + 4, y + 12, s.x1 - s.x - 8, 10);
      rr(ctx, s.x - 2, y, s.x1 - s.x + 4, 12, 4); ctx.fillStyle = C.wood; ctx.fill();
      ctx.fillStyle = C.woodL; ctx.fillRect(s.x, y, s.x1 - s.x, 3);
    });
  }
  // raf ürünleri + fiyat etiketleri (stok değişince yenilenir)
  function paintProducts(ctx) {
    const s = L.shelf, cap = shelfCap(), st = curState(), stock = (st && st.stock) || {};
    for (const sl of S.slots) {
      const n = Math.max(0, stock[sl.p.id] || 0);
      const perRow = clamp(Math.floor((sl.w - 14) / 22), 2, 9), maxVis = perRow * 2 - 1;
      const vis = n <= 0 ? 0 : clamp(Math.round(n / Math.max(1, cap) * maxVis), 1, maxVis);
      const step = Math.min(24, (sl.w - 30) / Math.max(1, perRow - 1));
      const low = n > 0 && n / Math.max(1, cap) < 0.2;
      if (vis === 0) {
        emo(ctx, sl.p.emoji, sl.x, sl.y - 18, 28, 0.22);
        ctx.setLineDash([3, 3]); ctx.strokeStyle = "rgba(198,61,29,.55)"; ctx.lineWidth = 1.5; rr(ctx, sl.x - sl.w / 2 + 6, sl.y - 34, sl.w - 12, 32, 6); ctx.stroke(); ctx.setLineDash([]);
      } else {
        const back = Math.max(0, vis - perRow), front = vis - back;
        for (let i = 0; i < back; i++) { const px = sl.x + (i - (back - 1) / 2) * step; ellipse(ctx, px, sl.y - 8, 9, 2.4, "rgba(60,30,10,.12)"); emo(ctx, sl.p.emoji, px, sl.y - 30, 23, 0.88); }
        for (let i = 0; i < front; i++) { const px = sl.x + (i - (front - 1) / 2) * step; ellipse(ctx, px, sl.y - 1, 11, 3, "rgba(60,30,10,.16)"); emo(ctx, sl.p.emoji, px, sl.y - 16, 28); }
      }
      // fiyat etiketi: rafa klipsli küçük kart
      const pr = sl.p.price != null ? "₺" + sl.p.price : "";
      ctx.fillStyle = "#9a9a9a"; ctx.fillRect(sl.x - 12, sl.y + 0.5, 2, 3); ctx.fillRect(sl.x + 10, sl.y + 0.5, 2, 3);
      rr(ctx, sl.x - 17, sl.y + 2, 34, 14, 4);
      ctx.fillStyle = n <= 0 ? "#ffd9cf" : low ? "#fff1cf" : "#fffaf2"; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = n <= 0 ? "rgba(198,61,29,.5)" : low ? "rgba(201,138,22,.7)" : "rgba(113,71,42,.25)"; ctx.stroke();
      txt(ctx, pr, sl.x, sl.y + 9.4, 11, n > 0 ? C.ink : C.red2, 700);
    }
    // ek raf yükseltmesi: yan sepet rafı
    if (S.upg.shelf && S.slots.length) {
      rr(ctx, s.x + 6, 396, 72, 22, 6); ctx.fillStyle = "#e7b36f"; ctx.fill();
      ctx.strokeStyle = "#b9803e"; ctx.lineWidth = 1.5; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(s.x + 12 + i * 12, 398); ctx.lineTo(s.x + 12 + i * 12, 416); ctx.stroke(); }
      emo(ctx, S.slots[0].p.emoji, s.x + 30, 392, 18); emo(ctx, (S.slots[1] || S.slots[0]).p.emoji, s.x + 54, 392, 18);
    }
  }
  function paintFridge(ctx) {
    const f = L.fridge;
    if (!S.upg.fridge) {
      // buzdolabı yokken: duvara asılı Pamuk portresi (takvim kaldırıldı; gün bilgisi tahtada)
      const cx = f.x + f.w / 2, cy = 200;
      rr(ctx, cx - 32, cy - 40, 64, 80, 8); ctx.fillStyle = C.wood; ctx.fill();
      rr(ctx, cx - 27, cy - 35, 54, 70, 5); ctx.fillStyle = "#fff6e8"; ctx.fill();
      ctx.fillStyle = "rgba(60,30,10,.10)"; ctx.fillRect(cx - 27, cy - 35, 54, 6);
      // minik Pamuk silueti
      ellipse(ctx, cx, cy + 12, 17, 13, "#fffdf8"); circle(ctx, cx, cy - 6, 14, "#fffdf8");
      tri(ctx, cx - 13, cy - 13, cx - 10, cy - 28, cx - 2, cy - 17, "#fffdf8"); tri(ctx, cx + 2, cy - 17, cx + 10, cy - 28, cx + 13, cy - 13, "#fffdf8");
      ctx.strokeStyle = "#c9a98f"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy - 6, 14, 0, Math.PI * 2); ctx.stroke();
      circle(ctx, cx - 5, cy - 6, 2.2, C.ink); circle(ctx, cx + 5, cy - 6, 2.2, C.ink); circle(ctx, cx, cy - 1.5, 1.6, "#ffb3c1");
      heart(ctx, cx + 20, cy + 26, 4, "#ff7a9c");
      circle(ctx, cx, cy - 44, 3, C.wood2);
      if (S.upg.plant) { rr(ctx, cx - 16, 386, 32, 30, 6); ctx.fillStyle = "#e0875a"; ctx.fill(); emo(ctx, "🪴", cx, 364, 40); }
      return;
    }
    rr(ctx, f.x, f.y, f.w, f.h, 14); ctx.fillStyle = "#e8f4fa"; ctx.fill();
    ctx.strokeStyle = "#b9d6e6"; ctx.lineWidth = 3; ctx.stroke();
    rr(ctx, f.x + 8, f.y + 22, f.w - 16, f.h - 40, 8); ctx.fillStyle = "#cfeaf7"; ctx.fill();
    const g = ctx.createLinearGradient(0, f.y + 22, 0, f.y + f.h - 18); g.addColorStop(0, "rgba(255,255,255,.55)"); g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g; ctx.fillRect(f.x + 8, f.y + 22, f.w - 16, 60);
    const drinks = products().filter(p => p.fresh || p.cat === "icecek").map(p => p.emoji);
    const list = drinks.length ? drinks : ["🥛", "🧃", "🧀"];
    for (let r = 0; r < 4; r++) {
      const yy = f.y + 64 + r * 58;
      ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.fillRect(f.x + 10, yy + 12, f.w - 20, 3);
      for (let i = 0; i < 3; i++) emo(ctx, list[(r * 3 + i) % list.length], f.x + 24 + i * 19, yy, 18);
    }
    rr(ctx, f.x + f.w - 16, f.y + 110, 6, 50, 3); ctx.fillStyle = "#9fc3d6"; ctx.fill();
    rr(ctx, f.x + 10, f.y + 5, f.w - 20, 12, 5); ctx.fillStyle = "#3b8ed0"; ctx.fill();
    txt(ctx, "SOĞUK", f.x + f.w / 2, f.y + 11.5, 9.5, "#fff", 700);
    emo(ctx, "❄️", f.x + f.w / 2, f.y + f.h - 12, 11, 0.75);
  }
  function paintDoorFrame(ctx) {
    const d = L.door;
    rr(ctx, d.x - 8, d.y - 10, d.w + 16, d.h + 10, 10); ctx.fillStyle = C.wood2; ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.16)"; ctx.lineWidth = 2; rr(ctx, d.x - 7, d.y - 9, d.w + 14, d.h + 8, 9); ctx.stroke();
    ctx.clearRect(d.x, d.y, d.w, d.h);           // açıklık: dışarısı altta
    if (S.wkind === "snow") { rr(ctx, d.x - 10, FLOOR_Y - 6, d.w + 20, 10, 5); ctx.fillStyle = "#fff"; ctx.fill(); }
    if (S.upg.basket) emo(ctx, "🧺", d.x - 22, 404, 30);
  }
  function paintBoard(ctx) {
    // kara tahta: haftanın günü + olay (olayın tek anlatıldığı yer) ve altında GÜN rozeti
    const b = L.board, st = curState();
    rr(ctx, b.x - 5, b.y - 5, b.w + 10, b.h + 10, 10); ctx.fillStyle = C.wood; ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.2)"; ctx.fillRect(b.x, b.y - 5, b.w, 2);
    rr(ctx, b.x, b.y, b.w, b.h, 6); ctx.fillStyle = "#3f5a4c"; ctx.fill();
    const wd = S.plan && findBy(DATA("WEEKDAYS"), S.plan.weekday);
    txt(ctx, (wd && wd.name) || "Bugün", b.x + b.w / 2, b.y + 18, 14, "#fdf6e3", 600);
    ctx.strokeStyle = "rgba(255,255,255,.3)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(b.x + 18, b.y + 30); ctx.lineTo(b.x + b.w - 18, b.y + 30); ctx.stroke();
    if (S.event) {
      emo(ctx, S.event.emoji || "🎉", b.x + 22, b.y + 55, 22);
      ctx.save(); ctx.beginPath(); ctx.rect(b.x + 36, b.y + 32, b.w - 40, 50); ctx.clip();
      wrapText(ctx, String(S.event.name || ""), b.x + 38, b.y + 49, b.w - 44, 14, 12, "#ffe7a8");
      ctx.restore();
    } else {
      emo(ctx, (S.weather && S.weather.emoji) || "☀️", b.x + 30, b.y + 56, 22);
      txt(ctx, "Sakin gün", b.x + 82, b.y + 56, 14, "#ffe7a8", 600);
    }
    ctx.fillStyle = "#fff"; ctx.fillRect(b.x + 12, b.y + b.h - 4, 14, 3);
    // GÜN rozeti
    const day = (S.plan && S.plan.day) || (st && st.day) || 1;
    rr(ctx, b.x + b.w / 2 - 34, b.y + b.h + 10, 68, 22, 11); ctx.fillStyle = C.red2; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#fff"; ctx.stroke();
    txt(ctx, "GÜN " + day, b.x + b.w / 2, b.y + b.h + 21.5, 13, "#fff", 700);
    // tanınmayan yükseltme rozetleri: rozetin altında ikon şeridi
    if (S.badges.length) {
      const n = S.badges.length, x0 = b.x + b.w / 2 - (n - 1) * 8.5, y = b.y + b.h + 48;
      S.badges.forEach((e, i) => { circle(ctx, x0 + i * 17, y, 8.5, "#fffaf2"); emo(ctx, e, x0 + i * 17, y + .5, 11); });
    }
  }
  function wrapText(ctx, s, x, y, maxW, lh, size, color) {
    ctx.font = "600 " + size + "px " + FONT_T; ctx.fillStyle = color; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    const words = s.split(" "); let line = "", yy = y, lines = 0;
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, yy); line = w; yy += lh; lines++; if (lines >= 2) return; }
      else line = test;
    }
    ctx.fillText(line, x, yy);
  }
  function paintClock(ctx) {
    const cx = 628, cy = 88;
    circle(ctx, cx, cy, 19, C.wood); circle(ctx, cx, cy, 15, "#fffaf2");
    ctx.fillStyle = C.ink; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; circle(ctx, cx + Math.cos(a) * 12, cy + Math.sin(a) * 12, i % 3 === 0 ? 1.4 : 0.8, C.ink); }
  }
  function paintLampsStatic(ctx) {
    lampXs().forEach((x, i) => {
      ctx.strokeStyle = "#6b4a33"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, 44); ctx.lineTo(x, 90); ctx.stroke();
      ctx.fillStyle = i % 2 ? "#f2b134" : "#8ecae6"; ctx.beginPath(); ctx.moveTo(x - 20, 112); ctx.lineTo(x - 9, 90); ctx.lineTo(x + 9, 90); ctx.lineTo(x + 20, 112); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(90,60,40,.35)"; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,.32)"; ctx.beginPath(); ctx.moveTo(x - 14, 108); ctx.lineTo(x - 7, 93); ctx.lineTo(x - 3, 93); ctx.lineTo(x - 9, 108); ctx.fill();
      circle(ctx, x, 113, 5, "#fff0b8");
    });
  }
  function lampXs() {
    // varsayılan: tek sarkıt lamba; yükseltmeyle 2-3 (tabela varsa üçüncüsü yok, çarpışmasın)
    const n = clamp(1 + (S.upg.lamp || 0), 1, 3);
    const xs = [546, 246, 396].slice(0, n);
    return (S.upg.sign || S.upg.grand) ? xs.filter(x => x !== 396) : xs;
  }
  function paintMisc(ctx) {
    if (S.upg.deal) { // toptancı kasası
      rr(ctx, 170, 388, 44, 30, 4); ctx.fillStyle = "#d9a46c"; ctx.fill(); ctx.fillStyle = C.wood; ctx.fillRect(170, 400, 44, 3);
      emo(ctx, "🍏", 182, 386, 14); emo(ctx, "🍊", 200, 384, 14);
    }
    if (S.upg.camera) emo(ctx, "📹", 930, 70, 20);
    // Pamuk'un yatağı
    if (S.upg.catbed) {
      const b = L.catBed;
      contactShadow(ctx, b.x, b.y + 8, 104);
      ellipse(ctx, b.x, b.y + 5, 47, 17, "#c9788a"); ellipse(ctx, b.x, b.y + 3, 45, 15, "#e8a0ae");
      ellipse(ctx, b.x, b.y, 38, 10.5, "#ffd9e1"); ellipse(ctx, b.x - 6, b.y - 1.5, 24, 5.5, "rgba(255,255,255,.55)");
      ctx.fillStyle = "#fff"; for (let i = -2; i <= 2; i++) circle(ctx, b.x + i * 14, b.y + 13, 2, "#fff");
      if (isNight()) { // akşam: yatağın yanında mama kabı
        const bx = b.x + 70, by = b.y + 10;
        contactShadow(ctx, bx, by + 6, 40); ellipse(ctx, bx, by + 2, 19, 7, "#7ec4e6"); ellipse(ctx, bx, by - 1, 15, 5, "#cfeaf7");
        for (let i = 0; i < 6; i++) circle(ctx, bx - 8 + i * 3.4, by - 2 + (i % 2), 1.8, "#c98a50");
      }
    }
  }
  function paintEventStatic(ctx) {
    const k = S.ekind; if (!k) return;
    if (k === "inspect") { rr(ctx, 30, 300, 70, 44, 6); ctx.fillStyle = "#fffaf2"; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = C.edge; ctx.stroke(); txt(ctx, "DENETİM", 65, 313, 11, C.red2, 700); txt(ctx, "✓ ✓ ✓", 65, 331, 11, C.green2, 700); }
    if (k === "sale") { ctx.save(); ctx.translate(120, 322); ctx.rotate(-0.08); rr(ctx, -46, -16, 92, 32, 8); ctx.fillStyle = "#ffe066"; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = C.red; ctx.stroke(); txt(ctx, "İNDİRİM!", 0, 1, 15, C.red2, 700); ctx.restore(); }
    if (k === "boxes") { emo(ctx, "📦", 820, 400, 30); emo(ctx, "📦", 838, 376, 26); }
    if (k === "school") emo(ctx, "🎒", 50, 404, 28);
    if (k === "tv") { rr(ctx, 44, 296, 80, 50, 6); ctx.fillStyle = "#333"; ctx.fill(); }
  }
  function paintSignPlate(ctx) {
    if (!(S.upg.sign || S.upg.grand)) return;
    const grand = !!S.upg.grand, x0 = 290, x1 = 502, y = 54;
    rr(ctx, x0, y, x1 - x0, 32, 10); ctx.fillStyle = grand ? C.gold : C.red; ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; rr(ctx, x0 + 4, y + 4, x1 - x0 - 8, 24, 7); ctx.stroke();
  }
  function paintVignette(ctx) {
    const v = S.view, vw = v.x1 - v.x0;
    const g = ctx.createRadialGradient(v.x0 + vw / 2, H * 0.52, vw * 0.34, v.x0 + vw / 2, H * 0.52, vw * 0.78);
    g.addColorStop(0, "rgba(120,70,30,0)"); g.addColorStop(1, "rgba(120,70,30,.12)");
    ctx.fillStyle = g; ctx.fillRect(v.x0, 0, vw, H);
  }
  function paintNoise(ctx) {
    if (S.lowPower) return;
    if (!S.noise) {
      const cv = document.createElement("canvas"); cv.width = cv.height = 64;
      const c = cv.getContext("2d"), id = c.createImageData(64, 64);
      for (let i = 0; i < 64 * 64; i++) { const v = fr(i, 5) > 0.5 ? 255 : 70; id.data[i * 4] = v; id.data[i * 4 + 1] = v - 10; id.data[i * 4 + 2] = v - 30; id.data[i * 4 + 3] = Math.round(fr(i, 8) * 255); }
      c.putImageData(id, 0, 0); S.noise = cv;
    }
    const pat = ctx.createPattern(S.noise, "repeat"), v = S.view;
    ctx.save(); ctx.globalAlpha = 0.04; ctx.fillStyle = pat; ctx.fillRect(v.x0, 0, v.x1 - v.x0, H); ctx.restore();
  }
  function paintBack(ctx) {
    const v = S.view;
    ctx.clearRect(v.x0, 0, v.x1 - v.x0, H);
    paintWall(ctx); paintFloor(ctx); paintShadows(ctx);
    paintWindowFrame(ctx); paintShelf(ctx); paintFridge(ctx); paintDoorFrame(ctx);
    paintClock(ctx); paintLampsStatic(ctx); paintMisc(ctx); paintBoard(ctx); paintEventStatic(ctx); paintSignPlate(ctx);
    paintVignette(ctx); paintNoise(ctx);
  }
  function paintFront(ctx) { // tezgâh (tezgâhtarın önünde)
    const c = L.counter, w = c.x1 - c.x;
    // kasa
    const kx = REG.x, ky = REG.y;
    contactShadow(ctx, kx, ky + 36, 60);
    rr(ctx, kx - 26, ky, 52, 34, 6); ctx.fillStyle = S.upg.register ? "#7ec4e6" : "#e9dccb"; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "rgba(90,60,40,.25)"; ctx.stroke();
    rr(ctx, kx - 18, ky - 16, 36, 18, 4); ctx.fillStyle = S.upg.register ? "#355c7d" : "#5f7f6b"; ctx.fill();
    txt(ctx, S.mode === "day" ? "₺" : "--", kx, ky - 7, 11, "#d7ffd9", 700);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { rr(ctx, kx - 18 + i * 13, ky + 6 + j * 11, 10, 8, 2); ctx.fillStyle = "#fff"; ctx.fill(); }
    if (S.upg.register) emo(ctx, "💳", kx + 40, ky + 20, 18);
    if (S.upg.music) emo(ctx, "📻", 814, 318, 28);
    if (S.upg.tea) emo(ctx, "🫖", 690, 320, 24);
    // tezgâh gövdesi
    rr(ctx, c.x - 6, c.top, w + 12, 16, 6); ctx.fillStyle = C.wood; ctx.fill();
    ctx.fillStyle = C.woodL; ctx.fillRect(c.x - 2, c.top + 2, w + 4, 3);
    rr(ctx, c.x, c.top + 14, w, 428 - c.top - 14, 6); ctx.fillStyle = "#fff4e0"; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = "rgba(113,71,42,.25)"; ctx.stroke();
    // tente çizgili ön panel
    ctx.save(); rr(ctx, c.x + 10, c.top + 26, w - 20, 60, 6); ctx.clip();
    for (let x = c.x + 10, i = 0; x < c.x1; x += 20, i++) { ctx.fillStyle = i % 2 ? C.cream2 : "#f27b5a"; ctx.fillRect(x, c.top + 26, 20, 60); }
    ctx.restore();
    ctx.fillStyle = "rgba(60,30,10,.16)"; ctx.fillRect(c.x + 2, 416, w - 4, 10);       // tekmelik
  }
  function paintTop(ctx) { // tente (en üstte)
    const sw = 40, top = 0, bot = 46;
    for (let x = 0, i = 0; x < W; x += sw, i++) { ctx.fillStyle = i % 2 ? C.cream2 : C.red; ctx.fillRect(x, top, sw, bot); }
    const g = ctx.createLinearGradient(0, 0, 0, bot); g.addColorStop(0, "rgba(255,255,255,.18)"); g.addColorStop(1, "rgba(0,0,0,.08)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, bot);
    ctx.fillStyle = "rgba(90,40,20,.12)";
    for (let x = 0; x < W; x += sw) { ctx.beginPath(); ctx.arc(x + sw / 2, bot + 3, sw / 2, 0.15, Math.PI - 0.15); ctx.lineTo(x + sw / 2, bot + 3); ctx.fill(); }
    for (let x = 0, i = 0; x < W; x += sw, i++) { ctx.beginPath(); ctx.arc(x + sw / 2, bot - 1, sw / 2, 0, Math.PI); ctx.fillStyle = i % 2 ? C.cream2 : C.red; ctx.fill(); }
    ctx.fillStyle = C.red2; ctx.fillRect(0, 0, W, 5);
    if (S.upg.awning) { // yeni tente: altın biye + püsküller
      ctx.fillStyle = C.gold; ctx.fillRect(0, bot - 4, W, 4);
      for (let x = sw / 2; x < W; x += sw) circle(ctx, x, bot + sw / 2 + 2, 4, C.gold);
    }
  }

  // ---------- dinamik öğeler (her karede) ----------
  function swayAmp(base) { return S.reduce ? 0 : (S.wkind === "wind" ? base * 2.6 : base); }
  function drawDoorLeaf(ctx) {
    const d = L.door, R = S.reduce;
    const open = clamp(S.doorOpen, 0, 1), dw = d.w * (1 - open * 0.55), k = dw / d.w;
    rr(ctx, d.x, d.y, dw, d.h, 6); ctx.fillStyle = "#c98b55"; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "rgba(113,71,42,.35)"; ctx.stroke();
    // cam bölme: aynı gökyüzü katmanı
    ctx.save(); rr(ctx, d.x + 10 * k, d.y + 14, dw - 20 * k, 118, 6); ctx.clip();
    blit(ctx, S.L.skyD);
    ctx.fillStyle = "rgba(255,255,255,.2)"; ctx.fillRect(d.x, d.y, d.w, 140);
    ctx.restore();
    ctx.strokeStyle = "rgba(113,71,42,.4)"; ctx.lineWidth = 3; rr(ctx, d.x + 10 * k, d.y + 14, dw - 20 * k, 118, 6); ctx.stroke();
    ctx.fillStyle = "#b37846"; rr(ctx, d.x + 12 * k, d.y + 150, dw - 24 * k, 100, 6); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.18)"; ctx.lineWidth = 1.5; rr(ctx, d.x + 12 * k, d.y + 150, dw - 24 * k, 100, 6); ctx.stroke();
    circle(ctx, d.x + dw - 12, d.y + 146, 5, C.gold);
    if (S.ekind === "boxes" && /grev/.test(norm(S.event && S.event.name))) { // kurye grevi notu
      ctx.save(); ctx.translate(d.x + dw / 2, d.y + 196); ctx.rotate(-0.07); rr(ctx, -30, -20, 60, 40, 3); ctx.fillStyle = "#fffaf2"; ctx.fill();
      txt(ctx, "KURYE", 0, -8, 11, C.red2, 700); txt(ctx, "ÇALIŞMIYOR", 0, 7, 8.5, C.ink, 700); ctx.restore();
    }
    // AÇIK/KAPALI tabelası
    const isOpen = S.mode === "day";
    const sx = d.x + dw / 2, sy = d.y + 60 + (R ? 0 : Math.sin(S.time * 2) * 1.5);
    ctx.strokeStyle = "#7a5a3a"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(sx - 16, sy - 12); ctx.lineTo(sx, sy - 30); ctx.lineTo(sx + 16, sy - 12); ctx.stroke();
    rr(ctx, sx - 30, sy - 12, 60, 24, 8); ctx.fillStyle = isOpen ? C.green2 : C.red2; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#fff"; ctx.stroke();
    txt(ctx, isOpen ? "AÇIK" : "KAPALI", sx, sy + 1, 12, "#fff", 700);
    // zil
    const wind = S.wkind === "wind" && !R;
    const sw = R ? 0 : (wind ? Math.sin(S.time * 9) * 0.3 : 0) + Math.sin(S.time * 18) * S.bell * 0.5;
    ctx.save(); ctx.translate(d.x + d.w / 2, d.y - 4); ctx.rotate(sw); emo(ctx, "🔔", 0, 10, 16); ctx.restore();
    // kapı açıkken içeri vuran yağmur / kar
    if (open > 0.15 && (S.wkind === "rain" || S.wkind === "snow") && !S.lowPower) {
      ctx.save(); ctx.globalAlpha = clamp(open * 1.4, 0, 1);
      if (S.wkind === "rain") { ctx.strokeStyle = "rgba(200,220,245,.75)"; ctx.lineWidth = 1.5; ctx.beginPath(); for (let i = 0; i < 5; i++) { const rx = d.x - 14 + ((i * 17 + S.time * 60) % 60), ry = 300 + ((i * 53 + S.time * 300) % 110); ctx.moveTo(rx, ry); ctx.lineTo(rx - 3, ry + 11); } ctx.stroke(); }
      else { ctx.fillStyle = "#fff"; for (let i = 0; i < 6; i++) { circle(ctx, d.x - 12 + ((i * 13 + S.time * 20) % 60), 300 + ((i * 41 + S.time * 40) % 120), 1.8, "#fff"); } }
      ctx.restore();
    }
  }
  function drawWindowDyn(ctx) {
    const w = L.win, t = S.time, R = S.reduce;
    // perdeler (rüzgârda 3 px salınır)
    const sw = R ? 0 : (S.wkind === "wind" ? Math.sin(t * 2.4) * 3 : Math.sin(t * 0.8) * 0.6);
    ctx.fillStyle = "#ffd0c2";
    ctx.beginPath(); ctx.moveTo(w.x - 6, w.y - 6); ctx.quadraticCurveTo(w.x + 22 + sw, w.y + 50, w.x + 4 + sw * 1.4, w.y + 92); ctx.lineTo(w.x - 6, w.y + 92); ctx.fill();
    ctx.beginPath(); ctx.moveTo(w.x + w.w + 6, w.y - 6); ctx.quadraticCurveTo(w.x + w.w - 22 - sw, w.y + 50, w.x + w.w - 4 - sw * 1.4, w.y + 92); ctx.lineTo(w.x + w.w + 6, w.y + 92); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.28)"; ctx.fillRect(w.x - 6, w.y - 4, 6, 90);
    // cam damlaları (yağmur)
    if (S.wkind === "rain") {
      const n = S.lowPower ? 4 : 7;
      for (let i = 0; i < n; i++) {
        const ph = ((t * 0.33 + fr(i, 31)) % 1), dx = w.x + 12 + fr(i, 32) * (w.w - 24), dy = w.y + 10 + ph * (w.h - 14);
        ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.beginPath(); ctx.ellipse(dx, dy, 1.6, 2.4 + ph * 2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.22)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(dx, dy - 10 * ph); ctx.lineTo(dx, dy); ctx.stroke();
      }
      ctx.fillStyle = "rgba(255,255,255,.5)"; for (let i = 0; i < 3; i++) circle(ctx, w.x + 30 + i * 52, w.y + w.h + 6 + ((t * 0.8 + i * .4) % 1) * 3, 1.5, "rgba(255,255,255,.7)");
    }
    if (S.wkind === "fog") { ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.fillRect(w.x, w.y, w.w, w.h); }
    // vitrin ışık dizisi
    if (S.upg.vitrin) {
      const cols = ["#ffd166", "#ff8fab", "#8ecae6", "#95d5b2"], n = 14;
      for (let i = 0; i < n; i++) {
        const q = i / (n - 1), bx = w.x - 12 + q * (w.w + 24), by = w.y - 20 + Math.sin(q * Math.PI) * 10;
        const on = R ? i % 2 === 0 : ((t * 3 + i) | 0) % 2 === 0;
        circle(ctx, bx, by, 4.5, on ? cols[i % 4] : "rgba(255,255,255,.5)");
        if (on) { ctx.save(); ctx.globalAlpha = .35; circle(ctx, bx, by, 9, cols[i % 4]); ctx.restore(); }
      }
    }
  }
  function drawWallDyn(ctx) {
    const t = S.time, R = S.reduce;
    if ((S.upg.sign || 0) >= 2) { // kapıya balon
      [["#ff9db6", -14], ["#ffd57e", 0], ["#9dcfe8", 14]].forEach(([cl, dx], i) => {
        const bx = L.door.x - 22 + dx, by = 126 + Math.abs(dx) * .4 + (R ? 0 : Math.sin(t * 1.8 + i) * 3);
        ctx.strokeStyle = "rgba(90,60,40,.5)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bx, by + 16); ctx.lineTo(L.door.x - 22, 196); ctx.stroke();
        ellipse(ctx, bx, by, 11, 14, cl); ellipse(ctx, bx - 4, by - 5, 3, 4, "rgba(255,255,255,.5)");
      });
    }
    // saat ibreleri
    const cx = 628, cy = 88, p = dayProgress(), hr = 8 + p * 12, ang = (hr / 12) * Math.PI * 2 - Math.PI / 2, mang = (hr % 1) * Math.PI * 2 - Math.PI / 2;
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2.4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ang) * 8, cy + Math.sin(ang) * 8); ctx.stroke();
    ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(mang) * 12, cy + Math.sin(mang) * 12); ctx.stroke();
    circle(ctx, cx, cy, 2, C.red); ctx.lineCap = "butt";
    if (S.upg.camera) circle(ctx, 920, 64, 2.5, (t % 1.2) < .6 ? "#ff4d4d" : "#7a2a2a");
    // vantilatör (sıcakta hızlı)
    if (S.upg.fan) {
      const spd = R ? 0.6 : (S.mode === "day" ? (S.wkind === "hot" ? 14 : 9) : 1.5);
      ctx.save(); ctx.translate(210, 62); ctx.strokeStyle = "#6b4a33"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(0, 0); ctx.stroke();
      ctx.rotate(t * spd); for (let i = 0; i < 3; i++) { ctx.rotate(Math.PI * 2 / 3); ellipse(ctx, 16, 0, 16, 4, "#d9a46c"); } circle(ctx, 0, 0, 4, C.wood2); ctx.restore();
    }
    if (S.upg.music && (S.mode === "day" || S.phase === "morning") && !R) for (let i = 0; i < 2; i++) { const ph = (t * .5 + i * .5) % 1; emo(ctx, i ? "🎵" : "🎶", 820 + ph * 20 + i * 8, 300 - ph * 50, 14, 1 - ph); }
    // yatak ışıltısı
    if (S.upg.catbed) { const b = L.catBed, a = R ? .8 : .45 + Math.sin(t * 2.6) * .45; ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); star4(ctx, b.x + 32, b.y - 12, 5, "#fff"); ctx.restore(); }
  }
  function drawEventBackDyn(ctx) {
    const k = S.ekind, t = S.time; if (!k) return;
    if (k === "tv") { ctx.fillStyle = "hsl(" + ((t * 40) % 360) + ",55%,72%)"; ctx.fillRect(50, 302, 68, 38); }
    if (k === "star") {
      const a = S.reduce ? .7 : 0.45 + Math.sin(t * 4) * .45;
      ctx.save(); ctx.globalAlpha = clamp(a, 0, 1); star4(ctx, 240, 90, 9, "#ffe27a"); ctx.restore();
      ctx.save(); ctx.globalAlpha = clamp(1 - a, 0, 1); star4(ctx, 560, 110, 8, "#ffb3d0"); ctx.restore();
      ctx.save(); ctx.globalAlpha = clamp(a * .8 + .1, 0, 1); star4(ctx, 676, 96, 6, "#fff"); ctx.restore();
      emo(ctx, "📸", 830, 110, 18);
    }
  }
  function drawEventDecor(ctx) { // ön katman: flama / balon
    const k = S.ekind; if (!k) return;
    const flagSets = {
      match: ["#ffd23f", "#1d3557", "#ffd23f", "#e63946"], party: ["#ff9db6", "#ffd57e", "#9dcfe8", "#a4d9ba", "#d3bff6"],
      school: ["#9dcfe8", "#ffd57e", "#e85a65"], generic: ["#ffbfca", "#ffe496", "#acd9ee", "#c0e3b3", "#d3bff6"],
      rainbow: ["#ff7b7b", "#ffbb5c", "#ffe87f", "#8bd89a", "#7fcaf5", "#bca9dd"]
    };
    const set = flagSets[k] || flagSets.generic;
    bunting(ctx, 10, 470, 60, 22, set); bunting(ctx, 470, 950, 60, 22, set);
    if (k === "party" || k === "generic" || k === "star") { // balonlar
      const bl = [["#ff9db6", 660, 150], ["#9dcfe8", 676, 128], ["#ffd57e", 690, 156], ["#a4d9ba", 212, 150], ["#d3bff6", 196, 128]];
      bl.forEach(([cl, bx, by], i) => {
        const yy = by + (S.reduce ? 0 : Math.sin(S.time * 1.6 + i) * 4), anchor = bx < 400 ? [206, 340] : [680, 336];
        ctx.strokeStyle = "rgba(90,60,40,.5)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bx, yy + 20); ctx.quadraticCurveTo(bx + 6, (yy + anchor[1]) / 2, anchor[0], anchor[1]); ctx.stroke();
        ellipse(ctx, bx, yy, 15, 19, cl); ellipse(ctx, bx - 5, yy - 7, 4, 6, "rgba(255,255,255,.5)");
      });
    }
    if (k === "match") { // atkı
      ctx.save(); ctx.translate(758, 214); ctx.rotate(-0.04);
      for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? "#1d3557" : "#ffd23f"; ctx.fillRect(-64 + i * 16, 0, 16, 16); }
      rr(ctx, -26, 1, 52, 14, 4); ctx.fillStyle = "#e63946"; ctx.fill();
      txt(ctx, "HAYDİ!", 0, 8.5, 10, "#fff", 700); ctx.restore();
      emo(ctx, "⚽", 860, 120, 22);
    }
    if (k === "kittens") { emo(ctx, "🐱", S.cat.x + 40, S.cat.y - 10, 22); emo(ctx, "🐱", S.cat.x - 38, S.cat.y - 6, 20); }
  }
  function bunting(ctx, x0, x1, y0, sag, cols) {
    ctx.strokeStyle = "#7a5a3a"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2, y0 + sag * 2, x1, y0); ctx.stroke();
    const n = Math.floor((x1 - x0) / 34), amp = swayAmp(1.5);
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = lerp(x0, x1, t), y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * (y0 + sag * 2) + t * t * y0;
      const sw = Math.sin(S.time * (S.wkind === "wind" ? 4 : 2) + i) * amp;
      ctx.fillStyle = cols[i % cols.length]; ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.lineTo(x + 10, y); ctx.lineTo(x + sw, y + 20); ctx.fill();
    }
  }
  function drawRobot(ctx) {
    const t = S.time * 0.35, x = 300 + Math.sin(t) * 220, y = 522 + Math.sin(t * 2.3) * 6;
    ellipse(ctx, x, y + 4, 22, 6, "rgba(90,50,20,.15)"); ellipse(ctx, x, y, 20, 9, "#7a8fa6"); ellipse(ctx, x, y - 3, 17, 7, "#b8c7d9");
    circle(ctx, x + 6 * Math.sign(Math.cos(t)), y - 4, 2.2, (S.time % 1) < .5 ? "#6fe38f" : "#2f9e54");
  }
  function drawHelper(ctx) {
    if (!S.upg.helper) return;
    const h = S.helper, y = 468, bob = S.reduce ? 0 : Math.abs(Math.sin(S.time * 7)) * (Math.abs(h.tx - h.x) > 2 ? 3 : 0);
    shadow(ctx, h.x, y + 26, 20);
    ellipse(ctx, h.x, y - bob, 20, 22, "#a0d8ef");
    ctx.save(); ctx.beginPath(); ctx.ellipse(h.x, y - bob, 20, 22, 0, 0, Math.PI * 2); ctx.clip(); ctx.fillStyle = C.red; ctx.fillRect(h.x - 13, y - bob + 4, 26, 22); ctx.restore();
    // şapka
    ctx.fillStyle = C.red; ctx.beginPath(); ctx.ellipse(h.x, y - bob - 17, 15, 8, 0, Math.PI, 0); ctx.fill(); rr(ctx, h.x - 17, y - bob - 18, 34, 5, 2); ctx.fillStyle = C.red2; ctx.fill();
    circle(ctx, h.x - 6, y - bob - 6, 2.6, C.ink); circle(ctx, h.x + 6, y - bob - 6, 2.6, C.ink);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(h.x, y - bob - 1, 4, 0.3, Math.PI - 0.3); ctx.stroke();
    emo(ctx, "📦", h.x + 18, y - bob + 2, 16);
    // isim etiketi
    rr(ctx, h.x - 12, y - bob + 8, 24, 11, 5); ctx.fillStyle = "#fffaf2"; ctx.fill(); txt(ctx, "Ali", h.x, y - bob + 14, 8.5, C.ink, 700);
  }
  function drawInspector(ctx) {
    const x = 806, y = 498, bob = S.reduce ? 0 : Math.sin(S.time * 2) * 1;
    shadow(ctx, x, y + 6, 20);
    ellipse(ctx, x, y - 22 + bob, 17, 24, "#f3f6fa"); ctx.strokeStyle = "rgba(90,60,40,.3)"; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = "#cfd8e3"; ctx.fillRect(x - 1, y - 32 + bob, 2, 26);
    circle(ctx, x - 6, y - 36 + bob, 2.3, C.ink); circle(ctx, x + 6, y - 36 + bob, 2.3, C.ink);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y - 31 + bob, 3.5, 0.3, Math.PI - 0.3); ctx.stroke();
    ctx.fillStyle = "#6d8fd8"; ctx.beginPath(); ctx.ellipse(x, y - 44 + bob, 14, 7, 0, Math.PI, 0); ctx.fill();
    rr(ctx, x + 12, y - 28 + bob, 15, 20, 2); ctx.fillStyle = "#fffaf2"; ctx.fill(); ctx.strokeStyle = C.wood2; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = C.green2; ctx.fillRect(x + 15, y - 24 + bob, 7, 1.6); ctx.fillRect(x + 15, y - 19 + bob, 9, 1.6);
  }

  // ---------- tezgâhtar ----------
  function drawCounterBack(ctx) {
    const k = S.keeper, x = 772, hop = S.reduce ? 0 : Math.sin(clamp(k.hop, 0, 1) * Math.PI) * 10, y = 300 - hop;
    const breath = S.reduce ? 0 : Math.sin(S.time * 2) * 1.2;
    ellipse(ctx, x, y + 6, 34, 36 + breath, "#ffd9b8");
    ctx.save(); ctx.beginPath(); ctx.ellipse(x, y + 6, 34, 36 + breath, 0, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = (S.upg.apron || 0) >= 2 ? "#3b8ed0" : C.red; ctx.fillRect(x - 22, y + 14, 44, 40); ctx.fillStyle = "#fff"; ctx.fillRect(x - 22, y + 14, 44, 4);
    ctx.restore();
    ctx.strokeStyle = "rgba(90,60,40,.28)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y + 6, 34, 36 + breath, 0, 0, Math.PI * 2); ctx.stroke();
    if (S.upg.apron) { circle(ctx, x + 12, y + 26, 5.5, C.gold); txt(ctx, "★", x + 12, y + 26.5, 8, "#fff", 700); }
    ctx.fillStyle = C.red; ctx.beginPath(); ctx.ellipse(x, y - 24, 24, 10, 0, Math.PI, 0); ctx.fill();
    rr(ctx, x - 26, y - 26, 52, 7, 3); ctx.fillStyle = C.red2; ctx.fill();
    circle(ctx, x, y - 36, 3.5, "#fff");
    const blink = (S.time % 3.7) < 0.12, idleSleepy = S.mode === "idle" && S.phase === "evening";
    ctx.fillStyle = C.ink;
    if (blink || idleSleepy) { ctx.fillRect(x - 13, y - 5, 8, 2.2); ctx.fillRect(x + 5, y - 5, 8, 2.2); }
    else {
      circle(ctx, x - 9, y - 5, 3.4, C.ink); circle(ctx, x - 8, y - 6.3, 1.1, "#fff");
      if (k.wink > 0) { ctx.fillRect(x + 5, y - 5, 8, 2.2); } else { circle(ctx, x + 9, y - 5, 3.4, C.ink); circle(ctx, x + 10, y - 6.3, 1.1, "#fff"); }
    }
    ctx.fillStyle = "#6b4a33"; ctx.beginPath(); ctx.ellipse(x - 6, y + 4, 7, 3, -0.2, 0, Math.PI * 2); ctx.ellipse(x + 6, y + 4, 7, 3, 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y + 7, 5, 0.2, Math.PI - 0.2); ctx.stroke();
    circle(ctx, x - 20, y + 2, 5, "rgba(255,130,130,.4)"); circle(ctx, x + 20, y + 2, 5, "rgba(255,130,130,.4)");
    if (k.wave > 0) { const a = Math.sin(S.time * 14) * 0.4; ctx.save(); ctx.translate(x + 34, y + 4); ctx.rotate(-0.6 + (S.reduce ? 0 : a)); ellipse(ctx, 0, -12, 7, 12, "#ffd9b8"); ctx.restore(); }
    if (idleSleepy) zzz(ctx, x + 26, y - 30, 0.6);
  }
  // tezgâh üstünde iki el; ödeme anında sağ el kasaya iner
  function drawKeeperHands(ctx) {
    const k = S.keeper, x = 772, dip = Math.sin(clamp(k.pay, 0, 1) * Math.PI);
    const lx = x - 26, ly = 338, rx = x + 26 - dip * 46, ry = 338 - dip * 8;
    ellipse(ctx, lx, ly, 9, 6, "#ffd9b8"); ellipse(ctx, rx, ry, 9, 6, "#ffd9b8");
    ctx.strokeStyle = "rgba(90,60,40,.25)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(lx, ly, 9, 6, 0, 0, Math.PI * 2); ctx.ellipse(rx, ry, 9, 6, 0, 0, Math.PI * 2); ctx.stroke();
  }
  function zzz(ctx, x, y, s) {
    for (let i = 0; i < 3; i++) {
      const ph = (S.time * 0.6 + i / 3) % 1;
      ctx.save(); ctx.globalAlpha = Math.sin(ph * Math.PI);
      txt(ctx, "z", x + ph * 18 + i * 3, y - ph * 30, (10 + i * 3) * (s || 1) + 4, "#6d7fa3", 700); ctx.restore();
    }
  }

  // ---------- Pamuk ----------
  function updCat(dt) {
    const c = S.cat; c.t -= dt; if (c.alert > 0) c.alert -= dt; if (c.stretch > 0) c.stretch -= dt;
    const home = S.upg.catbed ? { x: L.catBed.x, y: L.catBed.y } : { x: Math.max(150, S.view.x0 + 60), y: 496 };
    if (S.mode !== "day") {
      // sabah/akşam: yuvasına dön ve uyu
      if (Math.abs(c.x - home.x) > 3) { c.st = "walk"; c.dir = Math.sign(home.x - c.x); c.x += c.dir * Math.min(Math.abs(home.x - c.x), 60 * dt); c.walkT += dt; }
      else { c.x = home.x; c.st = "sleep"; }
      c.y = home.y;
    } else {
      if (c.st === "walk") {
        const dx = c.tx - c.x; c.dir = Math.sign(dx) || c.dir; c.x += c.dir * Math.min(Math.abs(dx), 55 * dt); c.walkT += dt;
        if (Math.abs(dx) < 2) { c.st = Math.random() < .5 ? "sit" : "sleep"; c.t = 3 + Math.random() * 6; }
      } else if (c.t <= 0) {
        const r = Math.random();
        if (r < 0.55) { c.st = "walk"; c.tx = Math.random() < .7 ? Math.max(60, S.view.x0 + 55) + Math.random() * 190 : 590 + Math.random() * 60; }
        else if (r < 0.8) { c.st = "sit"; c.t = 3 + Math.random() * 4; }
        else { c.st = "sleep"; c.t = 5 + Math.random() * 6; }
      }
      c.y = home.y;
    }
    if (c.prev === "sleep" && c.st !== "sleep" && !S.reduce) c.stretch = 0.5;   // uyanırken gerinme
    c.prev = c.st;
    zones.cat[0] = { x: c.x, y: c.y - 78 };
  }
  function drawCat(ctx) {
    const c = S.cat, x = c.x, y = c.y, d = c.dir || 1;
    const fur = "#fffdf8", line = "#c9a98f", pink = "#ffb3c1", R = S.reduce;
    shadow(ctx, x, y + 6, 34);
    ctx.save(); ctx.translate(x, y); ctx.scale(d < 0 ? -1.4 : 1.4, 1.4);
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    const lw = c.st === "sleep" ? 2 : 2.2;
    if (c.st === "sleep") {
      const br = R ? 0 : Math.sin(S.time * 2) * 1.2;
      // kıvrık kuyruk
      ctx.beginPath(); ctx.ellipse(10, -4, 22, 10, 0.1, 0.2, Math.PI * 1.2); ctx.lineWidth = 7.5; ctx.strokeStyle = line; ctx.stroke(); ctx.lineWidth = 4.5; ctx.strokeStyle = fur; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, -10, 26, 15 + br, 0, 0, Math.PI * 2); ctx.fillStyle = fur; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = line; ctx.stroke();
      ctx.beginPath(); ctx.arc(-18, -14, 13, 0, Math.PI * 2); ctx.fillStyle = fur; ctx.fill(); ctx.stroke();
      tri(ctx, -28, -22, -25, -35, -18, -25, fur, line, lw); tri(ctx, -16, -26, -10, -36, -7, -22, fur, line, lw);
      tri(ctx, -26, -24, -25, -31, -21, -26, pink); tri(ctx, -14, -27, -10, -32, -9, -24, pink);
      ctx.strokeStyle = C.ink; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.arc(-23, -14, 3, 0.2, Math.PI - 0.2); ctx.stroke(); ctx.beginPath(); ctx.arc(-14, -14, 3, 0.2, Math.PI - 0.2); ctx.stroke();
      circle(ctx, -18.5, -9, 1.8, pink); circle(ctx, -27, -9, 2.8, "rgba(255,150,175,.55)"); circle(ctx, -10, -9, 2.8, "rgba(255,150,175,.55)");
      ctx.restore();
      zzz(ctx, x + (d < 0 ? 22 : -40), y - 46, 1.1);
      return;
    }
    const walking = c.st === "walk", step = walking ? Math.sin(c.walkT * 12) : 0, sit = c.st === "sit";
    const st = c.stretch > 0 ? Math.sin(clamp(c.stretch / 0.5, 0, 1) * Math.PI) : 0;     // 0..1
    if (st > 0) ctx.scale(1 + st * 0.14, 1 - st * 0.1);
    // kuyruk (gerinirken dik)
    const tw = R ? 0 : Math.sin(S.time * 3) * 0.3;
    ctx.beginPath(); ctx.moveTo(22, sit ? -8 : -18); ctx.quadraticCurveTo(38 - st * 14, -30 + tw * 20 - st * 12, 30 + tw * 10 - st * 14, -44 - st * 10);
    ctx.lineWidth = 7.5; ctx.strokeStyle = line; ctx.stroke(); ctx.lineWidth = 4.5; ctx.strokeStyle = fur; ctx.stroke();
    ctx.lineWidth = lw; ctx.strokeStyle = line;
    if (!sit) {
      [[-12, step], [-4, -step], [10, -step], [18, step]].forEach(([lx, s]) => { rr(ctx, lx - 3.5, -10 + s * 2, 7, 14 - s * 2, 3.5); ctx.fillStyle = fur; ctx.fill(); ctx.stroke(); });
      ctx.beginPath(); ctx.ellipse(3, -18, 24, 13, 0, 0, Math.PI * 2); ctx.fillStyle = fur; ctx.fill(); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.ellipse(4, -16, 17, 18, 0, 0, Math.PI * 2); ctx.fillStyle = fur; ctx.fill(); ctx.stroke();
      rr(ctx, -9, -8, 7, 10, 3.5); ctx.fill(); ctx.stroke(); rr(ctx, 0, -8, 7, 10, 3.5); ctx.fill(); ctx.stroke();
    }
    // baş (yürürken hafif aşağı-yukarı)
    const hx = sit ? -2 : -20, hy = sit ? -40 : -30 - (R ? 0 : Math.abs(step) * 2);
    const twitch = !R && (S.time % 6) < 0.22 ? -1.6 : 0;
    tri(ctx, hx - 12, hy - 6, hx - 10 + twitch, hy - 22 + twitch, hx - 1, hy - 11, fur, line, lw); tri(ctx, hx + 1, hy - 11, hx + 10, hy - 22, hx + 12, hy - 6, fur, line, lw);
    tri(ctx, hx - 10, hy - 9, hx - 9 + twitch, hy - 18 + twitch, hx - 4, hy - 11, pink); tri(ctx, hx + 3, hy - 11, hx + 9, hy - 18, hx + 10, hy - 9, pink);
    ctx.beginPath(); ctx.arc(hx, hy, 14, 0, Math.PI * 2); ctx.fillStyle = fur; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = line; ctx.stroke();
    const blink = (S.time % 4.3) < 0.14;
    if (blink || st > 0.5) { ctx.fillStyle = C.ink; ctx.fillRect(hx - 8, hy - 1, 5.5, 2); ctx.fillRect(hx + 2.5, hy - 1, 5.5, 2); }
    else { circle(ctx, hx - 5.5, hy - 1, 3, C.ink); circle(ctx, hx + 5.5, hy - 1, 3, C.ink); circle(ctx, hx - 4.6, hy - 2.1, 1.1, "#fff"); circle(ctx, hx + 6.4, hy - 2.1, 1.1, "#fff"); }
    circle(ctx, hx, hy + 4, 1.9, pink);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.3; ctx.beginPath();
    if (st > 0.5) ctx.arc(hx, hy + 8, 2.6, 0, Math.PI * 2); else { ctx.arc(hx - 2, hy + 6, 2, 0, Math.PI); ctx.arc(hx + 2, hy + 6, 2, 0, Math.PI); }
    ctx.stroke();
    circle(ctx, hx - 9.5, hy + 4, 3, "rgba(255,150,175,.55)"); circle(ctx, hx + 9.5, hy + 4, 3, "rgba(255,150,175,.55)");
    ctx.restore();
    if (c.alert > 0) {
      // kutuyu devirdi: yanında devrilmiş koli
      ctx.save(); ctx.translate(x + (d < 0 ? -64 : 64), y - 6); ctx.rotate(d < 0 ? -1.2 : 1.2);
      rr(ctx, -15, -11, 30, 22, 3); ctx.fillStyle = "#d9a46c"; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#a9733f"; ctx.stroke();
      ctx.fillStyle = "#c58f55"; ctx.fillRect(-15, -2, 30, 4); ctx.restore();
      txt(ctx, "!", x + (d < 0 ? 34 : -34), y - 86 + (R ? 0 : Math.sin(S.time * 10) * 2), 20, C.red2, 700);
    }
  }

  // ---------- müşteri çizimi ----------
  function drawCustomer(ctx, c) {
    const lk = c.look, d = bodyDims(lk), walking = c.moving, R = S.reduce, t = S.time;
    const ph = c.walkT * 9;
    const bob = R ? 0 : (walking ? Math.abs(Math.sin(ph)) * 4 : Math.sin(t * 2 + c.x) * 1);
    const hop = R ? 0 : Math.sin(clamp(c.hop, 0, 1) * Math.PI) * 18;
    const x = c.x, base = c.y, y = base - d.ry - 6 - bob - hop;
    ctx.save(); ctx.globalAlpha = clamp(c.alpha, 0, 1);
    shadow(ctx, x, base + 2, d.rx * 0.9);
    if (walking && !R) { ctx.translate(x, base); ctx.rotate(c.dir * 0.06); ctx.translate(-x, -base); }   // yürürken hafif ileri eğilme
    // ayaklar
    const st = walking && !R ? Math.sin(ph) * 4 : 0, fo = 8 * d.fs;
    ellipse(ctx, x - fo + st, base - 3 - hop * 0.5, 7 * d.fs, 5, "#5a4636"); ellipse(ctx, x + fo - st, base - 3 - hop * 0.5, 7 * d.fs, 5, "#5a4636");
    // gövde (yürürken squash)
    const sq = hop > 0 ? 0.95 : (R ? 1 : 1 + Math.sin(t * 3 + c.x) * 0.02 + (walking ? Math.sin(ph * 2) * 0.03 : 0));
    const rx = d.rx * (2 - sq), ry = d.ry * sq;
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = lk.color; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "rgba(90,60,40,.28)"; ctx.stroke();
    ellipse(ctx, x - rx * .35, y - ry * .45, rx * .3, ry * .16, "rgba(255,255,255,.45)");
    // yüz
    const fx = x + (walking ? c.dir * 3 : 0), fy = y - 2 - (lk.body === "tall" ? ry * 0.12 : 0), fs = d.fs;
    const sad = c.sad > 0, eyeX = 6 * fs;
    if (lk.regular && lk.face) {
      circle(ctx, fx, fy, rx * 0.66, "rgba(255,248,236,.92)");
      emo(ctx, lk.face, fx, fy, rx * 1.05);
    } else {
      const blink = ((t + c.x * .01) % 3.3) < 0.12;
      if (blink) { ctx.fillStyle = C.ink; ctx.fillRect(fx - eyeX - 3, fy - 2, 6, 2); ctx.fillRect(fx + eyeX - 3, fy - 2, 6, 2); }
      else {
        circle(ctx, fx - eyeX, fy - 2, 3 * fs + .3, C.ink); circle(ctx, fx + eyeX, fy - 2, 3 * fs + .3, C.ink);
        circle(ctx, fx - eyeX + .8, fy - 3.2, 1, "#fff"); circle(ctx, fx + eyeX + .8, fy - 3.2, 1, "#fff");
        if (S.ekind === "dark" && S.mode === "day") { circle(ctx, fx - eyeX + 1.6, fy - 1, 1, "rgba(255,255,255,.9)"); circle(ctx, fx + eyeX + 1.6, fy - 1, 1, "rgba(255,255,255,.9)"); }
      }
      circle(ctx, fx - 12 * fs, fy + 4, 3.6 * fs + .4, "rgba(255,120,140,.35)"); circle(ctx, fx + 12 * fs, fy + 4, 3.6 * fs + .4, "rgba(255,120,140,.35)");
      ctx.strokeStyle = C.ink; ctx.lineWidth = 1.8; ctx.beginPath();
      if (sad) ctx.arc(fx, fy + 9, 4, Math.PI + 0.3, -0.3); else ctx.arc(fx, fy + 3, 4.5 * fs, 0.25, Math.PI - 0.25);
      ctx.stroke();
      if (S.wkind === "hot" && lk.shade && S.mode === "day") { // güneş gözlüğü
        ctx.fillStyle = "#2d2a3a"; ctx.beginPath(); ctx.ellipse(fx - eyeX, fy - 2, 6.4 * fs, 4.4, 0, 0, Math.PI * 2); ctx.ellipse(fx + eyeX, fy - 2, 6.4 * fs, 4.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#2d2a3a"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(fx - eyeX + 5, fy - 2); ctx.lineTo(fx + eyeX - 5, fy - 2); ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.fillRect(fx - eyeX - 3, fy - 4.5, 3, 1.4); ctx.fillRect(fx + eyeX - 3, fy - 4.5, 3, 1.4);
      }
    }
    // aksesuar
    const top = y - ry;
    if (!lk.regular) switch (lk.acc) {
      case 0: ctx.fillStyle = "#e36a6a"; ctx.beginPath(); ctx.ellipse(x, top + 4, rx * .8, 7, 0, Math.PI, 0); ctx.fill(); rr(ctx, x - 2, top + 1, rx + 6, 5, 2); ctx.fill(); break; // şapka
      case 1: tri(ctx, x + 4, top + 3, x + 16, top - 5, x + 16, top + 9, "#ff7aa2"); tri(ctx, x + 4, top + 3, x - 8, top - 5, x - 8, top + 9, "#ff7aa2"); circle(ctx, x + 4, top + 3, 3, "#ff4f86"); break; // fiyonk
      case 2: ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(fx - eyeX, fy - 2, 6 * fs, 0, Math.PI * 2); ctx.moveTo(fx + eyeX + 6 * fs, fy - 2); ctx.arc(fx + eyeX, fy - 2, 6 * fs, 0, Math.PI * 2); ctx.moveTo(fx - eyeX + 6 * fs, fy - 2); ctx.lineTo(fx + eyeX - 6 * fs, fy - 2); ctx.stroke(); break; // gözlük
      case 3: ctx.fillStyle = "#6d8fd8"; ctx.beginPath(); ctx.arc(x, top + 8, rx * .78, Math.PI, 0); ctx.fill(); circle(ctx, x, top - 4, 5, "#fff"); break; // bere
      case 4: ctx.strokeStyle = "rgba(90,60,40,.6)"; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x, top + 1); ctx.quadraticCurveTo(x + 5, top - 10, x + 10, top - 6); ctx.stroke(); break; // perçem
      case 5: ctx.fillStyle = "#8d6e63"; ctx.beginPath(); ctx.ellipse(x, top + 5, rx * .9, 8, 0, Math.PI, 0); ctx.fill(); break; // saç
      case 6: circle(ctx, x + rx * .6, top + 6, 5, "#ffe066"); circle(ctx, x + rx * .6, top + 6, 2, "#ff9f43"); break; // çiçek
      default: // kulaklık
        ctx.strokeStyle = "#4d4a63"; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y, rx * 1.02, ry * 1.02, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
        circle(ctx, x - rx * 1.0, y - 3, 5, "#6d6a8a"); circle(ctx, x + rx * 1.0, y - 3, 5, "#6d6a8a");
    }
    if (S.wkind === "snow" && !lk.regular) { // atkı + bere
      if (lk.tone === 0 && lk.acc !== 3) { ctx.fillStyle = "#c63d1d"; ctx.beginPath(); ctx.arc(x, top + 8, rx * .76, Math.PI, 0); ctx.fill(); circle(ctx, x, top - 3, 4.5, "#fff"); }
      ctx.strokeStyle = lk.tone === 1 ? "#3b8ed0" : "#e3502c"; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.beginPath(); ctx.ellipse(x, y + ry * .55, rx * .7, 4, 0, 0.1, Math.PI - 0.1); ctx.stroke();
      rr(ctx, x + rx * .35, y + ry * .55, 7, 14, 3); ctx.fillStyle = lk.tone === 1 ? "#3b8ed0" : "#e3502c"; ctx.fill(); ctx.lineCap = "butt";
      if (!R && (t + c.x * .013) % 2.8 < 0.6) { const pp = ((t + c.x * .013) % 2.8) / 0.6; ctx.save(); ctx.globalAlpha = (1 - pp) * .8; circle(ctx, fx + c.dir * -6 + 8 + pp * 6, fy + 10 - pp * 4, 2.6 + pp * 2, "#fff"); circle(ctx, fx + 14 + pp * 9, fy + 6 - pp * 6, 2 + pp * 2, "#fff"); ctx.restore(); }
    }
    if (S.wkind === "hot" && lk.sweat && !R) { const sp = ((t + c.x * .02) % 2.2) / 2.2; ctx.save(); ctx.globalAlpha = 1 - sp * .7; ctx.fillStyle = "#8fd0f5"; const sx = x + rx * .72, sy = y - ry * .45 + sp * 12; ctx.beginPath(); ctx.moveTo(sx, sy - 5); ctx.quadraticCurveTo(sx + 4, sy + 1, sx, sy + 3.5); ctx.quadraticCurveTo(sx - 4, sy + 1, sx, sy - 5); ctx.fill(); ctx.restore(); }
    // taşınan ürünler
    if (c.carried.length) c.carried.slice(-3).forEach((e, i) => emo(ctx, e, x + c.dir * -1 * (rx + 4) + i * 6, y + 6 - i * 4, 16));
    // çocuk: lolipop
    if (lk.body === "kid" && !lk.regular) { const lx = x + (c.dir >= 0 ? -1 : 1) * (rx + 7); ctx.strokeStyle = "#f3e6d3"; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(lx, y + 14); ctx.lineTo(lx, y - 4); ctx.stroke(); circle(ctx, lx, y - 9, 6, "#ff7aa2"); circle(ctx, lx, y - 9, 3.4, "#ffd1de"); circle(ctx, lx, y - 9, 1.4, "#ff7aa2"); }
    // şemsiye: kapı çevresinde açık, içeride kapalı
    if (S.wkind === "rain" && lk.umb && !lk.regular) {
      const out = c.x > 786 || (c.leaving && c.x > 760);
      const uc = ["#e3502c", "#3b8ed0", "#f2b134", "#7d5fb0"][lk.tone % 4 + (lk.size % 2 ? 0 : 0)];
      if (out) {
        const ux = x, uy = top - 12;
        ctx.strokeStyle = "#5a4636"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ux, uy); ctx.lineTo(ux, y - ry * .2); ctx.stroke();
        ctx.fillStyle = uc; ctx.beginPath(); ctx.ellipse(ux, uy, 32, 20, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.4)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(ux, uy - 20); ctx.lineTo(ux, uy); ctx.moveTo(ux - 16, uy - 17); ctx.lineTo(ux - 4, uy); ctx.moveTo(ux + 16, uy - 17); ctx.lineTo(ux + 4, uy); ctx.stroke();
      } else {
        const sx = x + (c.dir >= 0 ? 1 : -1) * (rx + 5); ctx.strokeStyle = uc; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(sx - 3, y - 4); ctx.lineTo(sx + 3, y + 22); ctx.stroke();
        ctx.strokeStyle = "#5a4636"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx + 3, y + 22); ctx.lineTo(sx + 4, y + 26); ctx.stroke(); ctx.lineCap = "butt";
      }
    }
    // düşünce balonu
    if (c.think) {
      const bx = x + 16, by = top - 22 + (R ? 0 : Math.sin(t * 3) * 2);
      circle(ctx, x + 6, top - 4, 3, "#fff"); rr(ctx, bx - 16, by - 15, 32, 28, 12); ctx.fillStyle = "#fff"; ctx.fill();
      ctx.strokeStyle = "rgba(90,60,40,.18)"; ctx.lineWidth = 1.5; ctx.stroke(); emo(ctx, c.think, bx, by - 1, 17);
    }
    // üzgün bulut
    if (sad) {
      const cy = top - 26, a = clamp(c.sad, 0, 1);
      ctx.globalAlpha *= a;
      circle(ctx, x - 9, cy, 9, "#9fb0c4"); circle(ctx, x + 3, cy - 5, 11, "#9fb0c4"); circle(ctx, x + 13, cy, 8, "#9fb0c4"); ellipse(ctx, x + 2, cy + 4, 20, 6, "#9fb0c4");
      ctx.strokeStyle = "#6fa8dc"; ctx.lineWidth = 1.6; ctx.beginPath();
      for (let i = 0; i < 4; i++) { const p2 = (t * 2.2 + i * .27) % 1; const dx = x - 10 + i * 7; ctx.moveTo(dx, cy + 10 + p2 * 18); ctx.lineTo(dx - 1, cy + 15 + p2 * 18); }
      ctx.stroke();
    }
    if (c.heart > 0) { ctx.save(); ctx.globalAlpha *= clamp(c.heart, 0, 1); heart(ctx, x + 18, top - 8 - (1.2 - c.heart) * 20, 4.2, "#ff7a9c"); ctx.restore(); }
    ctx.restore();
    // mahalleli isim etiketi (ayakların altında)
    if (lk.regular && c.alpha > 0.4) {
      const nm = c.nameTxt != null ? c.nameTxt : (c.nameTxt = regName(lk.regular));
      if (nm) {
        ctx.save(); ctx.globalAlpha = clamp(c.alpha, 0, 1); ctx.font = "700 11px " + FONT_T;
        const tw = c.nameW || (c.nameW = ctx.measureText(nm).width + 12);
        rr(ctx, x - tw / 2, base + 8, tw, 15, 7.5); ctx.fillStyle = "rgba(255,250,242,.96)"; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = C.edge; ctx.stroke();
        txt(ctx, nm, x, base + 15.8, 11, C.ink, 700); ctx.restore();
      }
    }
  }

  // ---------- gün ışığı ----------
  // Anahtarlar: [p, çarpım rengi, çarpım alfa, ekran rengi, ekran alfa, lamba]
  const LSTOPS = [
    [0.00, [255, 233, 210], 0.10, [138, 95, 176], 0.00, 0.00],
    [0.35, [255, 244, 230], 0.00, [138, 95, 176], 0.00, 0.00],
    [0.60, [255, 214, 170], 0.10, [138, 95, 176], 0.03, 0.10],
    [0.72, [255, 176, 116], 0.22, [138, 95, 176], 0.10, 0.40],
    [1.00, [197, 143, 184], 0.28, [138, 95, 176], 0.12, 1.00],
    [1.20, [232, 184, 154], 0.26, [138, 95, 176], 0.00, 1.00]
  ];
  function lightP() { return isNight() ? 1.2 : dayProgress(); }
  function lightAt(p) {
    let a = LSTOPS[0], b = LSTOPS[LSTOPS.length - 1];
    for (let i = 0; i < LSTOPS.length - 1; i++) if (p >= LSTOPS[i][0] && p <= LSTOPS[i + 1][0]) { a = LSTOPS[i]; b = LSTOPS[i + 1]; break; }
    const t = b[0] === a[0] ? 0 : clamp((p - a[0]) / (b[0] - a[0]), 0, 1);
    const m = [0, 1, 2].map(i => Math.round(lerp(a[1][i], b[1][i], t))), s = [0, 1, 2].map(i => Math.round(lerp(a[3][i], b[3][i], t)));
    return { m, ma: lerp(a[2], b[2], t), s, sa: lerp(a[4], b[4], t), lamp: lerp(a[5], b[5], t) };
  }
  const rgba = (c, a) => "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a.toFixed(3) + ")";
  const CANDLES = [[700, 335], [820, 335], [115, 268]];
  function drawLight(ctx) {
    const v = S.view, vw = v.x1 - v.x0, dark = S.ekind === "dark" && S.mode === "day";
    const Lt = lightAt(lightP());
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    if (dark) { ctx.fillStyle = "rgba(42,34,80,.55)"; ctx.fillRect(v.x0, 0, vw, H); }
    else if (Lt.ma > 0.004) { ctx.fillStyle = rgba(Lt.m, Lt.ma); ctx.fillRect(v.x0, 0, vw, H); }
    // hava tonu (iç mekâna sızar)
    const wk = S.wkind;
    if (!dark) {
      let wt = null;
      if (wk === "rain") wt = ["rgba(170,186,208,.13)"]; else if (wk === "cloud") wt = ["rgba(200,212,226,.08)"]; else if (wk === "snow") wt = ["rgba(222,234,250,.07)"]; else if (wk === "hot") wt = ["rgba(255,240,176,.09)"];
      if (wt) { ctx.fillStyle = wt[0]; ctx.fillRect(v.x0, 0, vw, H); }
    }
    ctx.globalCompositeOperation = "screen";
    if (!dark && Lt.sa > 0.004) { ctx.fillStyle = rgba(Lt.s, Lt.sa); ctx.fillRect(v.x0, 0, vw, H); }
    if (wk === "fog") { ctx.fillStyle = "rgba(255,255,255,.06)"; ctx.fillRect(v.x0, 0, vw, H); }
    if (dark) CANDLES.forEach(([x, y], i) => { const fl = S.reduce ? 1 : 0.88 + Math.sin(S.time * 9 + i * 2) * 0.12; const g = ctx.createRadialGradient(x, y - 16, 2, x, y - 16, 150); g.addColorStop(0, "rgba(255,200,110," + (0.8 * fl).toFixed(2) + ")"); g.addColorStop(1, "rgba(255,207,122,0)"); ctx.fillStyle = g; ctx.fillRect(x - 150, y - 166, 300, 300); });
    // gökkuşağı: zemine iki renkli hafif ışık bandı
    if (S.ekind === "rainbow" && S.mode === "day") { ctx.fillStyle = "rgba(255,150,170,.06)"; ctx.beginPath(); ctx.moveTo(30, FLOOR_Y + 10); ctx.lineTo(210, FLOOR_Y + 10); ctx.lineTo(340, H); ctx.lineTo(150, H); ctx.fill(); ctx.fillStyle = "rgba(140,200,255,.06)"; ctx.beginPath(); ctx.moveTo(210, FLOOR_Y + 10); ctx.lineTo(260, FLOOR_Y + 10); ctx.lineTo(400, H); ctx.lineTo(340, H); ctx.fill(); }
    ctx.globalCompositeOperation = "lighter";
    // lambalar: gündüz kapalı, akşama doğru koniler açılır
    const on = dark ? 0 : Lt.lamp;
    if (on > 0.02) {
      const cone = coneSprite(), pulse = S.reduce ? 1 : 0.96 + Math.sin(S.time * 2.1) * 0.04;
      ctx.globalAlpha = clamp(on * 0.34 * pulse, 0, 1);
      lampXs().forEach(x => ctx.drawImage(cone.cv, x - cone.lw / 2, 112, cone.lw, cone.lh));
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    // mumlar (karanlıkta parlak)
    if (dark) CANDLES.forEach(([x, y], i) => {
      rr(ctx, x - 4, y - 14, 8, 14, 2); ctx.fillStyle = "#fff6e0"; ctx.fill();
      const fl = S.reduce ? 0 : Math.sin(S.time * 9 + i) * 1.4;
      ctx.beginPath(); ctx.ellipse(x + fl * .3, y - 20, 3.2, 6.5 + fl * .4, 0, 0, Math.PI * 2); ctx.fillStyle = "#ffb43a"; ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + fl * .3, y - 19, 1.6, 3.6, 0, 0, Math.PI * 2); ctx.fillStyle = "#fff3b0"; ctx.fill();
    });
    // lamba ampulleri akşam parlar
    if (on > 0.3) { ctx.save(); ctx.globalAlpha = clamp(on, 0, 1); lampXs().forEach(x => circle(ctx, x, 113, 5.5, "#fffbe0")); ctx.restore(); }
  }
  function drawSignText(ctx) {
    if (!(S.upg.sign || S.upg.grand)) return;
    const grand = !!S.upg.grand, x0 = 290, x1 = 502, y = 54, cx = (x0 + x1) / 2;
    const neon = (S.upg.sign || 0) >= 4 || grand, glow = S.reduce ? 0.6 : 0.5 + Math.sin(S.time * 3) * 0.2;
    const label = grand ? "⭐ KÖŞE SÜPERMARKET ⭐" : "KÖŞE MARKET", size = grand ? 15 : 17;
    ctx.save();
    if (neon && !S.lowPower) { ctx.shadowColor = "rgba(255,120,200," + (glow + .3).toFixed(2) + ")"; ctx.shadowBlur = 14; }
    else { // gölge yerine ucuz hare
      ctx.font = "700 " + size + "px " + FONT_T; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round"; ctx.lineWidth = 6;
      ctx.strokeStyle = neon ? "rgba(255,120,200," + (glow * .5).toFixed(2) + ")" : "rgba(255,240,180," + (glow * .45).toFixed(2) + ")"; ctx.strokeText(label, cx, y + 17);
    }
    txt(ctx, label, cx, y + 17, size, "#fff", 700);
    ctx.restore();
  }
  function drawPrints(ctx) {
    if (S.wkind !== "rain" || !S.prints.length) return;
    for (const q of S.prints) {
      const a = 0.14 * clamp(1 - q.t / 20, 0, 1); ctx.fillStyle = "rgba(60,90,130," + a.toFixed(3) + ")";
      const ox = q.flip ? 4 : -4; ctx.beginPath(); ctx.ellipse(q.x + ox, q.y, 5.5, 2.6, q.dir > 0 ? .1 : -.1, 0, Math.PI * 2); ctx.fill();
    }
    // kapı önünde su birikintisi
    const px = L.door.x + 36; ctx.fillStyle = "rgba(150,190,230,.22)"; ctx.beginPath(); ctx.ellipse(px, 466, 42, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(px - 6, 464, 20, 3, 0, Math.PI * 1.1, Math.PI * 1.8); ctx.stroke();
  }
  // gündüz pencereden zemine düşen güneş ışığı
  function drawSunPatch(ctx) {
    if (S.mode === "idle" && S.phase === "evening") return;
    const k = S.wkind, p = dayProgress(); if (p > 0.7 || (k !== "sun" && k !== "hot" && k !== "wind" && k !== "cloud")) return;
    const a = (k === "cloud" ? 0.05 : 0.11) * clamp(1 - p / 0.75, 0, 1) * clamp(p * 6 + 0.4, 0, 1), sh = lerp(30, 150, p / 0.7);
    ctx.fillStyle = "rgba(255,244,200," + a.toFixed(3) + ")";
    ctx.beginPath(); ctx.moveTo(40 + sh, FLOOR_Y + 6); ctx.lineTo(200 + sh, FLOOR_Y + 6); ctx.lineTo(270 + sh * 1.4, H); ctx.lineTo(70 + sh * 1.4, H); ctx.closePath(); ctx.fill();
  }

  // ---------- ana çizim ----------
  function updateLowPower() {
    const lp = S.forcedLow != null ? !!S.forcedLow : ((global.devicePixelRatio || 1) >= 2 && (global.innerWidth || 1000) < 700) || S.autoLow;
    if (lp !== S.lowPower) { S.lowPower = lp; S.layerSig = null; }
  }
  function resize() {
    const cv = S.canvas; if (!cv) return false;
    const cssW = cv.clientWidth; if (!cssW) return false;
    const dpr = Math.min(global.devicePixelRatio || 1, 2);
    const v = S.view, vw = v.x1 - v.x0;
    const bw = Math.round(cssW * dpr), bh = Math.round(bw * H / vw);
    if (bw !== S.bw || bh !== S.bh) { cv.width = bw; cv.height = bh; S.bw = bw; S.bh = bh; }
    const k = bw / vw; S.k = k;
    S.ctx.setTransform(k, 0, 0, k, -v.x0 * k, 0);
    return true;
  }
  function prodSignature() {
    const st = curState(), stock = (st && st.stock) || {};
    return S.layoutSig + "|" + shelfCap() + "|" + S.slots.map(sl => Math.max(0, stock[sl.p.id] || 0)).join(",");
  }
  function statSignature() {
    const st = curState(), p = S.plan || {};
    return JSON.stringify([S.upg, S.badges, p.day, p.weekday && (p.weekday.id || p.weekday), S.event && S.event.id, S.ekind, S.weather && S.weather.id, S.wkind, S.mode === "day", S.mode === "idle" && S.phase === "evening", st && st.day, S.layoutSig, S.rows]);
  }
  function ensureLayers() {
    const v = S.view;
    const sig = [S.bw, S.bh, v.x0, v.x1, S.lowPower ? 1 : 0, statSignature()].join("|");
    if (sig !== S.layerSig) {
      S.layerSig = sig; relayout();
      const lay = S.L;
      lay.back = mkLayer(v.x0, 0, v.x1 - v.x0, H); paintBack(lay.back.ctx);
      lay.front = mkLayer(656, 262, 200, 180); paintFront(lay.front.ctx);
      lay.top = mkLayer(v.x0, 0, v.x1 - v.x0, 82); paintTop(lay.top.ctx);
      const w = L.win, d = L.door;
      lay.skyW = mkLayer(w.x - 3, w.y - 3, w.w + 6, w.h + 6); lay.skyD = mkLayer(d.x - 3, d.y - 3, d.w + 6, d.h + 6);
      S.skyT = -9; S.prodSig = null;
    }
    const ps = prodSignature();
    if (ps !== S.prodSig) {
      S.prodSig = ps;
      S.L.prod = mkLayer(204, 96, 380, 328); paintProducts(S.L.prod.ctx);
    }
    // gökyüzü ~30 fps (düşük güçte 15, hareket azaltmada 8 fps) tazelenir; pencere ve kapı aynı kaynak
    const iv = S.reduce ? 0.125 : S.lowPower ? 1 / 15 : 1 / 30;
    if (S.time - S.skyT >= iv || S.time < S.skyT) {
      S.skyT = S.time;
      const w = L.win, d = L.door, a = S.L.skyW, b = S.L.skyD;
      a.ctx.clearRect(w.x - 3, w.y - 3, w.w + 6, w.h + 6); drawOutside(a.ctx, w.x - 1, w.y - 1, w.w + 2, w.h + 2, "win");
      b.ctx.clearRect(d.x - 3, d.y - 3, d.w + 6, d.h + 6); drawOutside(b.ctx, d.x - 1, d.y - 1, d.w + 2, d.h + 2, "door");
    }
  }

  function draw() {
    if (!S.ctx || !resize()) return;
    const now = global.performance ? performance.now() : Date.now();
    if (S.lastDraw) { const dtm = now - S.lastDraw; if (dtm < 150) { S.frameEma = S.frameEma * 0.98 + dtm * 0.02; if (S.frameEma > 30 && !S.autoLow && S.mode === "day") { if (++S.slowFrames > 240) { S.autoLow = true; } } else if (S.slowFrames > 0) S.slowFrames--; } }
    S.lastDraw = now;
    updateLowPower();
    ensureLayers();
    const ctx = S.ctx, lay = S.L, ents = [];
    // gökyüzü (cam açıklıklarının altında), sonra statik sahne
    blit(ctx, lay.skyW); blit(ctx, lay.skyD);
    blit(ctx, lay.back); blit(ctx, lay.prod);
    drawSunPatch(ctx);
    drawDoorLeaf(ctx);
    drawWindowDyn(ctx);
    drawWallDyn(ctx);
    drawEventBackDyn(ctx);
    drawPrints(ctx);
    drawCounterBack(ctx);
    blit(ctx, lay.front);
    drawKeeperHands(ctx);
    // yerdeki varlıkları y'ye göre sırala
    for (const c of S.customers) ents.push({ y: c.y, c, f: 0 });
    ents.push({ y: S.cat.y, f: 1 });
    if (S.upg.helper) ents.push({ y: 468 + 26, f: 2 });
    if ((S.upg.mat || 0) >= 2) ents.push({ y: 522, f: 3 });
    if (S.upg.plant) ents.push({ y: 520, f: 4 });
    if (S.ekind === "inspect") ents.push({ y: 498, f: 5 });
    ents.sort((a, b) => a.y - b.y);
    for (const e of ents) {
      switch (e.f) {
        case 0: drawCustomer(ctx, e.c); break;
        case 1: drawCat(ctx); break;
        case 2: drawHelper(ctx); break;
        case 3: drawRobot(ctx); break;
        case 4: contactShadow(ctx, 833, 508, 44); rr(ctx, 818, 470, 30, 34, 6); ctx.fillStyle = "#e0875a"; ctx.fill(); emo(ctx, "🌿", 833, 452, 38); break;
        case 5: drawInspector(ctx); break;
      }
    }
    drawEventDecor(ctx);
    drawLight(ctx);
    drawSignText(ctx);
    blit(ctx, lay.top);
    drawParts(ctx);
    drawBanner(ctx);
  }

  function update(dt) {
    dt = Math.min(dt || 0, 0.25);
    S.time += dt;
    S.doorOpen = Math.max(0, S.doorOpen - dt * 1.2); S.bell = Math.max(0, S.bell - dt * 1.5);
    const k = S.keeper;
    k.hop = Math.max(0, k.hop - dt * 2.5); k.wave = Math.max(0, k.wave - dt); k.pay = Math.max(0, k.pay - dt * 3.2); k.wink = Math.max(0, k.wink - dt);
    for (const c of S.customers) stepCustomer(c, dt);
    S.customers = S.customers.filter(c => { if (c.gone) { delete S.cidMap[c.cid]; freePay(c); } return !c.gone; });
    for (const c of S.customers) if (c.sad > 0 && !(c.cur && c.cur.k === "sad")) c.sad -= dt * 0.6;
    updCat(dt);
    // çırak rafla kasa arasında dolaşır
    const h = S.helper; h.t -= dt;
    if (h.t <= 0) { h.tx = 250 + Math.random() * 300; h.t = 3 + Math.random() * 4; }
    h.x += Math.sign(h.tx - h.x) * Math.min(Math.abs(h.tx - h.x), 60 * dt);
    updParts(dt);
    // rüzgârda kapı zili ara sıra yumuşakça çalar
    if (S.mode === "day" && S.wkind === "wind" && !S.reduce) { S.windT -= dt; if (S.windT <= 0) { S.windT = 7 + Math.random() * 5; S.bell = Math.max(S.bell, 0.6); sfx("bellSoft"); } }
  }

  // ---------- olaylar ----------
  function handle(ev) {
    if (!ev || !ev.type) return;
    switch (ev.type) {
      case "customerEnter": { const c = custOf(ev.cid, ev.look); if (Math.random() < .3) S.keeper.wave = 1; sfx("bell"); void c; break; }
      case "customerBuy": {
        const c = custOf(ev.cid);
        c.think = c.think || productEmoji(ev.productId);
        const sp = pickSpot(c, standX(ev.productId));
        c.q.push({ k: "walk", x: sp.x, y: sp.y }, { k: "wait", d: 0.35 }, { k: "grab", pid: ev.productId, amount: ev.amount || 0 });
        break;
      }
      case "customerMiss": {
        const c = custOf(ev.cid);
        c.think = ev.productId ? productEmoji(ev.productId) : "❓";
        const sp = pickSpot(c, standX(ev.productId));
        c.q.push({ k: "walk", x: sp.x, y: sp.y }, { k: "wait", d: 0.3 }, { k: "sad" });
        break;
      }
      case "customerLeave": {
        const c = S.cidMap[ev.cid]; if (!c) break;
        if (ev.happy === false) c.happy = false;
        if (c.carried.length || c.q.some(a => a.k === "grab")) {
          const i = claimPay(c);
          c.spot = { x: 706 - 36 * i, y: 476 + 7 * i };
          c.q.push({ k: "walk", x: c.spot.x, y: c.spot.y }, { k: "pay" });
        }
        c.q.push({ k: "leave" });
        break;
      }
      case "restock": {
        const sl = slotFor(ev.productId);
        if (sl) { spawnFly("📦", L.door.x, 300, sl.x, sl.y - 20); floaty("+" + (ev.qty || 0) + " " + productEmoji(ev.productId), sl.x, sl.y - 50, C.blue, 18); }
        break;
      }
      case "tip": floaty("+₺" + (ev.amount || 0) + " bahşiş", 746, 240, "#c0476a", 18); hearts(760, 270, 3); break;
      case "goalDone": confetti(80); S.banner = { text: "Hedef tamam!", t: 0, max: 2.4 }; break;
      case "bubbleSpawn": if (ev.bubble && ev.bubble.zone === "cat") { S.cat.alert = 2; if (S.cat.st === "sleep") { S.cat.st = "sit"; S.cat.t = 4; } } break;
      // Mekanik ajanın bubblePop kancası (yoksa hiç gelmez, sahne eskisi gibi çalışır)
      case "bubblePop": {
        if (typeof ev.x === "number" && typeof ev.y === "number") {
          coinFly(ev.x, ev.y, ev.golden ? 5 : 3);
          if (ev.golden) sparkles(ev.x, ev.y, 5);
          const tt = norm(String(ev.zone || "") + " " + String(ev.bubbleType || ev.btype || ""));
          if (/\bcat\b|pet|pamuk|kedi/.test(tt)) { hearts(ev.x, ev.y - 10, 5); sfx("purr"); }
        }
        break;
      }
      case "levelUp": confetti(60); break;
      case "dayEnd": S.customers.forEach(c => { if (!c.leaving) { c.q = [{ k: "leave" }]; c.cur = null; } }); break;
      default: break;
    }
  }

  // ---------- genel API ----------
  function applyPlan(plan, state) {
    S.plan = plan || S.plan; S.state = state || S.state;
    const p = S.plan || {};
    S.weather = findBy(DATA("WEATHERS"), p.weather) || { id: "gunes" };
    S.wkind = weatherKind(S.weather);
    S.event = findBy(DATA("DAY_EVENTS"), p.event);
    S.ekind = eventKind(S.event);
    readUpgrades();
  }
  function watchMotion() {
    try {
      const mq = global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)"); if (!mq) return;
      S.reduce = !!mq.matches;
      const f = (e) => { S.reduce = !!e.matches; S.layerSig = null; };
      if (mq.addEventListener) mq.addEventListener("change", f); else if (mq.addListener) mq.addListener(f);
    } catch (e) { /* yok say */ }
  }

  const Render = {
    zones,
    init(canvasEl) {
      S.canvas = canvasEl; S.ctx = canvasEl.getContext("2d");
      canvasEl.style.width = canvasEl.style.width || "100%";
      if (!canvasEl.style.aspectRatio) canvasEl.style.aspectRatio = W + " / " + H;
      watchMotion();
      // Web fontu geç gelirse statik katmandaki yazılar yeniden boyansın
      try { if (global.document && document.fonts && document.fonts.addEventListener) document.fonts.addEventListener("loadingdone", () => { S.layerSig = null; sprites.clear(); }); } catch (e) { /* yok say */ }
      relayout();
    },
    get width() { return W; }, get height() { return H; },
    zonePos(zone, index, productId) {
      let list = zones[zone];
      if (zone === "shelf" && productId) { const z = zones.shelf.find(s => s.productId === productId); if (z) list = [z]; }
      if (zone === "shelf" && !zones.shelf.length) relayout();
      if (!list || !list.length) list = zones.floor;
      const z = list[Math.abs(index | 0) % list.length];
      const j = zone === "cat" ? 6 : 18;
      return { x: clamp(z.x + (Math.random() - .5) * j * 2, S.view.x0 + 48, S.view.x1 - 48), y: clamp(z.y + (Math.random() - .5) * j, 70, H - 40) };
    },
    // Görünen mantıksal x aralığı: dikey telefonda sahne kenarlardan hafifçe kırpılıp büyütülür
    setView(x0, x1) {
      x0 = clamp(Math.round(x0 || 0), 0, W / 2); x1 = clamp(Math.round(x1 || W), W / 2, W);
      if (S.view.x0 === x0 && S.view.x1 === x1) return;
      S.view = { x0, x1 };
      L.catBed.x = Math.max(112, x0 + 52);
      if (S.canvas) S.canvas.style.aspectRatio = (x1 - x0) + " / " + H;
      S.bw = 0; S.layerSig = null; draw();
    },
    get view() { return { x0: S.view.x0, x1: S.view.x1 }; },
    setDay(plan, state) {
      S.mode = "day"; S.customers = []; S.cidMap = {}; S.parts = []; S.payQ = []; S.prints = []; S.banner = null;
      applyPlan(plan, state);
      S.cat.st = "sit"; S.cat.t = 2; S.doorOpen = 1; S.bell = 1; S.windT = 4;
      sfx("ambient", S.wkind);
    },
    idle(state, phase, plan) {
      S.mode = "idle"; S.phase = phase || "morning"; S.state = state || S.state;
      if (plan) S.plan = plan;
      S.customers.forEach(c => { if (!c.leaving) { c.q = [{ k: "leave" }]; c.cur = null; } });
      applyPlan(S.plan, S.state);
      sfx("stopAmbient");
    },
    refresh() { readUpgrades(); },       // yükseltme/ürün alınca sahneyi güncelle
    handle, update, draw,
    confetti, floaty,
    // kalite bayrakları (test / ayar için)
    setLowPower(b) { S.forcedLow = b == null ? null : !!b; S.layerSig = null; },
    get lowPower() { return S.lowPower; },
    get reduceMotion() { return S.reduce; },
    _S: S
  };
  global.Render = Render;
})(typeof window !== "undefined" ? window : globalThis);
