// Köşe Market — Canvas dükkân sahnesi: önden iç mekân, hava, dekor, müşteriler, Pamuk.
// Mantıksal çözünürlük 960x540; CSS ile ölçeklenir, DPR destekli. Global: Render
(function (global) {
  "use strict";

  const W = 960, H = 540, FLOOR_Y = 420;
  const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';
  const FONT_T = '"Fredoka",ui-rounded,"SF Pro Rounded","Varela Round","Quicksand","Nunito","Trebuchet MS",system-ui,sans-serif';
  const C = {
    red: "#e3502c", red2: "#c63d1d", cream: "#fff4e6", card: "#fffaf2",
    wall: "#fbe6c8", wall2: "#f7dab5", wood: "#9a6438", wood2: "#71472a", wood3: "#b98150", woodL: "#d9a46c",
    ink: "#3a2a1f", green: "#2f9e54", gold: "#f2b134", blue: "#3b8ed0", pink: "#ff9fb2"
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
  function emo(ctx, e, x, y, size, alpha) {
    if (!e) return;
    ctx.save(); if (alpha != null) ctx.globalAlpha *= alpha;
    ctx.font = size + "px " + EMOJI; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(e, x, y); ctx.restore();
  }
  function txt(ctx, s, x, y, size, color, weight, align) {
    ctx.font = (weight || 600) + " " + size + "px " + FONT_T; ctx.fillStyle = color;
    ctx.textAlign = align || "center"; ctx.textBaseline = "middle"; ctx.fillText(s, x, y);
  }
  function ellipse(ctx, x, y, rx, ry, fill) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); }
  function circle(ctx, x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); }
  function shadow(ctx, x, y, rx) { ellipse(ctx, x, y, rx, rx * 0.28, "rgba(90,50,20,.16)"); }
  // mantıksal zamanla deterministik "rastgele"
  function fr(i, k) { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); }

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

  // ---------- durum ----------
  const S = {
    canvas: null, ctx: null, bw: 0, cssW: 0,
    mode: "idle", phase: "morning", time: 0,
    plan: null, state: null,
    weather: { id: "gunes" }, wkind: "sun", event: null, ekind: null,
    slots: [], layoutSig: "", rows: 3,
    customers: [], parts: [], cidMap: {},
    cat: { x: L.catBed.x, y: L.catBed.y, tx: 0, st: "sleep", t: 6, dir: 1, alert: 0, walkT: 0 },
    keeper: { hop: 0, blink: 0, wave: 0 },
    doorOpen: 0, bell: 0,
    upg: {}, badges: [], helper: { x: 300, tx: 300, t: 0 },
    dim: 0,
    view: { x0: 0, x1: W }   // görünen mantıksal x aralığı (dar/dikey ekranda kenarlar kırpılır)
  };

  const zones = {
    shelf: [{ x: 300, y: 150 }], floor: [{ x: 330, y: 470 }, { x: 470, y: 492 }, { x: 600, y: 470 }, { x: 250, y: 500 }],
    register: [{ x: 724, y: 282 }, { x: 790, y: 250 }], door: [{ x: 898, y: 236 }], fridge: [{ x: 628, y: 210 }],
    window: [{ x: 115, y: 186 }], cat: [{ x: L.catBed.x, y: L.catBed.y - 60 }]
  };

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
  function lookOf(look, cid) {
    look = look || {};
    const h = hash((look.face || "") + ":" + cid);
    return {
      color: look.color || BLOB_COLORS[h % BLOB_COLORS.length],
      acc: h % 7, hair: (h >> 3) % 4, size: 25 + ((h >> 6) % 7),
      face: look.face, regular: look.regular || look.regularId || null
    };
  }
  function slotFor(pid) { return S.slots.find(s => s.p.id === pid) || null; }
  function productEmoji(pid) { const p = products().find(x => x.id === pid); return p ? p.emoji : "🛍️"; }

  function addCustomer(cid, look) {
    // ekranda çok kişi birikirse en eskisini at
    if (S.customers.length > 13) { const old = S.customers.shift(); delete S.cidMap[old.cid]; }
    const c = {
      cid, look: lookOf(look, cid), x: L.door.x + 46, y: 470 + ((hash(cid) % 5) * 8), alpha: 0,
      q: [], cur: null, carried: [], amount: 0, happy: null, walkT: 0, dir: -1, idle: 0,
      think: null, sad: 0, hop: 0, gone: false, heart: 0
    };
    c.q.push({ k: "walk", x: 480 + (hash(cid + "b") % 80) - 40 });
    S.customers.push(c); S.cidMap[cid] = c;
    S.doorOpen = 0.7; S.bell = 1;
    return c;
  }
  function custOf(cid, look) { return S.cidMap[cid] || addCustomer(cid, look); }
  function standX(pid) { const s = slotFor(pid); return s ? clamp(s.x, 250, 560) : 330 + Math.random() * 180; }

  function stepCustomer(c, dt) {
    c.walkT += dt; if (c.hop > 0) c.hop = Math.max(0, c.hop - dt * 2.2); if (c.heart > 0) c.heart -= dt;
    if (c.alpha < 1 && !c.leaving) c.alpha = Math.min(1, c.alpha + dt * 3);
    if (!c.cur && c.q.length) { c.cur = c.q.shift(); c.cur.t = 0; }
    const a = c.cur;
    if (!a) { c.idle += dt; if (c.idle > 25) c.q.push({ k: "leave" }); return; }
    c.idle = 0; a.t += dt;
    // kuyrukta çok iş biriktiyse hızlan
    const rush = 1 + Math.min(2, c.q.length * 0.35);
    switch (a.k) {
      case "walk": {
        const sp = 150 * rush, dx = a.x - c.x;
        if (Math.abs(dx) < 3) { c.x = a.x; c.cur = null; break; }
        c.dir = Math.sign(dx); c.x += c.dir * Math.min(Math.abs(dx), sp * dt); c.moving = true; return;
      }
      case "wait": if (a.t >= a.d / rush) c.cur = null; break;
      case "grab": {
        c.think = null;
        const s = slotFor(a.pid);
        if (s) spawnFly(productEmoji(a.pid), s.x, s.y - 16, c.x, c.y - 50);
        c.carried.push(productEmoji(a.pid)); c.amount += a.amount || 0; c.cur = null; break;
      }
      case "sad": c.think = null; c.sad = 1.8; c.happy = false; if (a.t > 0.9) c.cur = null; break;
      case "pay": {
        if (a.t === dt) { /* ilk kare */ }
        if (!a.done && a.t > 0.35) {
          a.done = true;
          if (c.amount > 0) { floaty("+₺" + Math.round(c.amount), c.x, c.y - 90, "#2f9e54"); coins(746, 300); S.keeper.hop = 1; }
          c.carried = []; c.hop = 1; c.heart = 1.2;
        }
        if (a.t > 0.7) c.cur = null; break;
      }
      case "leave": c.leaving = true; c.q.unshift({ k: "exit" }); c.cur = null; if (c.happy !== false) c.hop = 1; break;
      case "exit": {
        const tx = L.door.x + 46, dx = tx - c.x;
        c.dir = 1; c.x += Math.min(Math.abs(dx), 170 * rush * dt); c.moving = true;
        if (Math.abs(dx) < 40) { c.alpha -= dt * 4; if (Math.abs(dx) < 50 && S.doorOpen < 0.3) S.doorOpen = 0.5; }
        if (c.alpha <= 0 || Math.abs(dx) < 2) { c.gone = true; }
        return;
      }
      default: c.cur = null;
    }
    c.moving = false;
  }

  // ---------- parçacıklar ----------
  function floaty(s, x, y, color, size) { S.parts.push({ k: "text", s, x, y, vy: -34, life: 1.4, max: 1.4, color: color || C.green, size: size || 22 }); }
  function coins(x, y) { for (let i = 0; i < 5; i++) S.parts.push({ k: "emo", e: "✨", x: x + (Math.random() - .5) * 30, y, vx: (Math.random() - .5) * 80, vy: -60 - Math.random() * 60, g: 120, life: .8, max: .8, size: 14 }); }
  function hearts(x, y, n) { for (let i = 0; i < (n || 3); i++) S.parts.push({ k: "emo", e: "💗", x: x + (Math.random() - .5) * 24, y, vx: (Math.random() - .5) * 40, vy: -50 - Math.random() * 30, g: 0, life: 1.1, max: 1.1, size: 14 }); }
  function spawnFly(e, x0, y0, x1, y1) { S.parts.push({ k: "fly", e, x0, y0, x1, y1, life: .45, max: .45, size: 22 }); }
  function confetti(n) {
    const cols = ["#ff8fab", "#ffd166", "#8ecae6", "#95d5b2", "#cdb4f6", "#ff9f68"];
    for (let i = 0; i < (n || 70); i++) S.parts.push({ k: "conf", x: Math.random() * W, y: -10 - Math.random() * 80, vx: (Math.random() - .5) * 60, vy: 60 + Math.random() * 90, rot: Math.random() * 6, vr: (Math.random() - .5) * 8, c: cols[i % cols.length], life: 3.2, max: 3.2 });
  }
  function updParts(dt) {
    for (const p of S.parts) {
      p.life -= dt;
      if (p.k === "fly") continue;
      p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt; if (p.g) p.vy += p.g * dt; if (p.vr) p.rot += p.vr * dt;
    }
    S.parts = S.parts.filter(p => p.life > 0);
  }
  function drawParts(ctx) {
    for (const p of S.parts) {
      const a = clamp(p.life / p.max * 1.6, 0, 1);
      if (p.k === "text") {
        ctx.save(); ctx.globalAlpha = a; ctx.lineWidth = 5; ctx.strokeStyle = "#fff";
        ctx.font = "700 " + p.size + "px " + FONT_T; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.strokeText(p.s, p.x, p.y); ctx.fillStyle = p.color; ctx.fillText(p.s, p.x, p.y); ctx.restore();
      } else if (p.k === "emo") { emo(ctx, p.e, p.x, p.y, p.size, a); }
      else if (p.k === "fly") {
        const t = 1 - p.life / p.max, x = lerp(p.x0, p.x1, t), y = lerp(p.y0, p.y1, t) - Math.sin(t * Math.PI) * 40;
        emo(ctx, p.e, x, y, p.size);
      } else if (p.k === "conf") {
        ctx.save(); ctx.globalAlpha = a; ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c; ctx.fillRect(-4, -2.5, 8, 5); ctx.restore();
      }
    }
  }

  // ---------- çizim: dış dünya (pencere / kapı camı) ----------
  function skyColors(kind, p) {
    // p: günün ilerleyişi 0..1 (akşam >1)
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
    return { top, bot, dusk: clamp((p - 0.72) / 0.35, 0, 1) };
  }
  function drawOutside(ctx, x, y, w, h, key) {
    const t = S.time, p = dayProgress(), kind = S.wkind;
    const sc = skyColors(kind, p);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    let g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, sc.top); g.addColorStop(1, sc.bot);
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    if (sc.dusk > 0) {
      g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, "rgba(120,80,170," + (0.55 * sc.dusk) + ")"); g.addColorStop(1, "rgba(255,150,110," + (0.6 * sc.dusk) + ")");
      ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    }
    // güneş
    if (kind === "sun" || kind === "hot" || kind === "wind") {
      const sx = x + w * (key === "door" ? 0.3 : 0.74), sy = y + h * (0.24 + sc.dusk * 0.45), r = kind === "hot" ? 22 : 16;
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(t * 0.3);
      ctx.fillStyle = kind === "hot" ? "rgba(255,200,80,.55)" : "rgba(255,230,120,.6)";
      for (let i = 0; i < 10; i++) { ctx.rotate(Math.PI / 5); ctx.beginPath(); ctx.moveTo(r + 3, -3); ctx.lineTo(r + 12 + Math.sin(t * 3 + i) * 3, 0); ctx.lineTo(r + 3, 3); ctx.fill(); }
      ctx.restore(); circle(ctx, sx, sy, r, kind === "hot" ? "#ff9e3d" : "#ffd84d");
      circle(ctx, sx - r * .3, sy - r * .3, r * .35, "rgba(255,255,255,.35)");
    }
    if (kind === "snow" || kind === "rain" || kind === "cloud" || kind === "fog") { /* güneş yok */ }
    // karşı binalar
    const baseY = y + h * 0.66;
    const houses = ["#f7c6c7", "#c7e3f7", "#fbe3a6", "#cfe8c3", "#e3d0f5"];
    for (let i = 0; i < 4; i++) {
      const hx = x - 10 + i * (w / 3.2), hw = w / 3.6, hh = h * (0.28 + fr(i, key === "door" ? 3 : 1) * 0.16);
      ctx.fillStyle = houses[(i + (key === "door" ? 2 : 0)) % houses.length]; ctx.fillRect(hx, baseY - hh, hw, hh);
      ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.fillRect(hx + hw * .2, baseY - hh * .72, hw * .2, hh * .2); ctx.fillRect(hx + hw * .6, baseY - hh * .72, hw * .2, hh * .2);
      if (sc.dusk > 0.4) { ctx.fillStyle = "rgba(255,220,120," + (sc.dusk * 0.9) + ")"; ctx.fillRect(hx + hw * .2, baseY - hh * .72, hw * .2, hh * .2); }
      ctx.fillStyle = "rgba(0,0,0,.08)"; ctx.fillRect(hx, baseY - hh, hw, 4);
      if (kind === "snow") { ctx.fillStyle = "#fff"; rr(ctx, hx - 2, baseY - hh - 4, hw + 4, 7, 3); ctx.fill(); }
    }
    // ağaç (rüzgârda eğilir)
    const tx = x + w * (key === "door" ? 0.78 : 0.18), bend = kind === "wind" ? Math.sin(t * 2.2) * 6 + 6 : Math.sin(t * .8) * 1.5;
    ctx.fillStyle = "#8a5a36"; ctx.fillRect(tx - 3, baseY - 26, 6, 26);
    circle(ctx, tx + bend, baseY - 34, 15, kind === "snow" ? "#e8f1f4" : "#7cc47a");
    circle(ctx, tx + bend - 9, baseY - 26, 11, kind === "snow" ? "#dfeaee" : "#6bb56a");
    circle(ctx, tx + bend + 9, baseY - 27, 11, kind === "snow" ? "#f4f8fa" : "#8fd08b");
    // kaldırım / yol
    ctx.fillStyle = kind === "snow" ? "#f4f7fb" : (kind === "rain" ? "#9aa3ab" : "#d9d2c5"); ctx.fillRect(x, baseY, w, h - (baseY - y));
    ctx.fillStyle = "rgba(0,0,0,.06)"; for (let i = 0; i < 6; i++) ctx.fillRect(x + i * w / 5 + ((t * 0) % 1), baseY + 8, 2, h);
    // bulutlar
    const nCloud = kind === "sun" ? 2 : kind === "hot" ? 1 : kind === "wind" ? 3 : 4;
    const cSpeed = kind === "wind" ? 38 : 8;
    const cCol = kind === "rain" ? "#7d8b99" : kind === "snow" ? "#e9eef4" : "#ffffff";
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
    // yağış
    if (kind === "rain") {
      ctx.strokeStyle = "rgba(230,240,255,.8)"; ctx.lineWidth = 1.6; ctx.beginPath();
      for (let i = 0; i < 26; i++) {
        const rx = x + (fr(i, 1) * w + t * 30) % w, ry = y + ((fr(i, 2) * h + t * 360) % h);
        ctx.moveTo(rx, ry); ctx.lineTo(rx - 4, ry + 12);
      }
      ctx.stroke();
      for (let i = 0; i < 3; i++) { const ph = (t * .9 + i / 3) % 1; ctx.strokeStyle = "rgba(255,255,255," + (1 - ph) * .7 + ")"; ctx.beginPath(); ctx.ellipse(x + w * (.2 + i * .3), y + h - 10, 4 + ph * 12, 1.5 + ph * 3, 0, 0, Math.PI * 2); ctx.stroke(); }
    } else if (kind === "snow") {
      ctx.fillStyle = "#fff";
      for (let i = 0; i < 26; i++) {
        const sy = y + ((fr(i, 3) * h + t * (22 + fr(i, 4) * 18)) % h), sx = x + ((fr(i, 5) * w + Math.sin(t + i) * 8) % w + w) % w;
        ctx.beginPath(); ctx.arc(sx, sy, 1.5 + fr(i, 6) * 2, 0, Math.PI * 2); ctx.fill();
      }
    } else if (kind === "hot") {
      ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 2;
      for (let j = 0; j < 4; j++) {
        ctx.beginPath(); const yy = baseY - 8 - j * 16;
        for (let xx = 0; xx <= w; xx += 4) { const vy = yy + Math.sin(xx * .12 + t * 5 + j) * 2.5; if (xx === 0) ctx.moveTo(x + xx, vy); else ctx.lineTo(x + xx, vy); }
        ctx.stroke();
      }
    } else if (kind === "wind") {
      for (let i = 0; i < 5; i++) {
        const lx = x + ((fr(i, 8) * w + t * (90 + fr(i, 3) * 60)) % (w + 30)) - 15, ly = y + h * (.2 + fr(i, 4) * .6) + Math.sin(t * 3 + i) * 10;
        ctx.save(); ctx.translate(lx, ly); ctx.rotate(t * 4 + i); ellipse(ctx, 0, 0, 5, 2.6, i % 2 ? "#e39a4c" : "#c9772e"); ctx.restore();
      }
      ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) { const wx = x + ((fr(i, 11) * w + t * 140) % (w + 60)) - 30, wy = y + 20 + i * 30; ctx.beginPath(); ctx.moveTo(wx, wy); ctx.quadraticCurveTo(wx + 14, wy - 6, wx + 28, wy); ctx.stroke(); }
    } else if (kind === "fog") {
      ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(x, y, w, h);
    }
    ctx.restore();
  }

  function dayProgress() {
    if (S.mode === "day") { const g = G(); const r = g && g.run; return r && r.length ? clamp(r.t / r.length, 0, 1) * 0.95 : 0.1; }
    return S.phase === "evening" ? 1.02 : 0.05;
  }

  // ---------- çizim: dükkân ----------
  function drawWall(ctx) {
    ctx.fillStyle = C.wall; ctx.fillRect(0, 0, W, FLOOR_Y);
    // duvar kâğıdı: yumuşak dikey şerit + küçük noktalar
    ctx.fillStyle = C.wall2; for (let x = 0; x < W; x += 48) ctx.fillRect(x, 0, 20, FLOOR_Y);
    ctx.fillStyle = "rgba(227,80,44,.08)";
    for (let y = 80; y < 350; y += 34) for (let x = 34 + ((y / 34) % 2) * 24; x < W; x += 48) { ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fill(); }
    // lambri
    ctx.fillStyle = "#eac89a"; ctx.fillRect(0, 352, W, FLOOR_Y - 352);
    ctx.fillStyle = "#dcb383"; for (let x = 12; x < W; x += 40) ctx.fillRect(x, 358, 2, FLOOR_Y - 364);
    ctx.fillStyle = C.wood3; ctx.fillRect(0, 348, W, 6);
    ctx.fillStyle = C.wood2; ctx.fillRect(0, FLOOR_Y - 6, W, 6);
  }
  function drawFloor(ctx) {
    const rowsH = [24, 28, 32, 36]; let y = FLOOR_Y;
    rowsH.forEach((rh, r) => {
      const tw = 40 + r * 6;
      for (let i = -1, x = -((r % 2) * tw / 2); x < W; x += tw, i++) {
        ctx.fillStyle = (i + r) % 2 ? "#f3dcb8" : "#fbeedb"; ctx.fillRect(x, y, tw, rh);
      }
      y += rh;
    });
    const g = ctx.createLinearGradient(0, FLOOR_Y, 0, H); g.addColorStop(0, "rgba(120,70,30,.14)"); g.addColorStop(.3, "rgba(120,70,30,0)");
    ctx.fillStyle = g; ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);
    if (S.upg.mat) { rr(ctx, L.door.x - 30, 500, 120, 22, 8); ctx.fillStyle = "#d9776a"; ctx.fill(); ctx.fillStyle = "#f3b0a4"; for (let i = 0; i < 5; i++) ctx.fillRect(L.door.x - 22 + i * 22, 504, 10, 14); }
  }
  function drawAwning(ctx) {
    const sw = 40, top = 0, bot = 46;
    for (let x = 0, i = 0; x < W; x += sw, i++) { ctx.fillStyle = i % 2 ? C.cream : C.red; ctx.fillRect(x, top, sw, bot); }
    // hafif gölge ve parlaklık
    const g = ctx.createLinearGradient(0, 0, 0, bot); g.addColorStop(0, "rgba(255,255,255,.18)"); g.addColorStop(1, "rgba(0,0,0,.08)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, bot);
    // tırtıklı kenar
    for (let x = 0, i = 0; x < W; x += sw, i++) {
      ctx.beginPath(); ctx.arc(x + sw / 2, bot - 1, sw / 2, 0, Math.PI); ctx.fillStyle = i % 2 ? C.cream : C.red; ctx.fill();
    }
    ctx.fillStyle = "rgba(90,40,20,.12)";
    for (let x = 0; x < W; x += sw) { ctx.beginPath(); ctx.arc(x + sw / 2, bot + 3, sw / 2, 0.15, Math.PI - 0.15); ctx.lineTo(x + sw / 2, bot + 3); ctx.fill(); }
    ctx.fillStyle = C.red2; ctx.fillRect(0, 0, W, 5);
    if (S.upg.awning) { // yeni tente: altın biye + püsküller
      ctx.fillStyle = C.gold; ctx.fillRect(0, bot - 4, W, 4);
      for (let x = sw / 2; x < W; x += sw) { circle(ctx, x, bot + sw / 2 + 2, 4, C.gold); }
    }
  }
  function drawWindow(ctx) {
    const w = L.win;
    rr(ctx, w.x - 10, w.y - 10, w.w + 20, w.h + 20, 14); ctx.fillStyle = C.wood; ctx.fill();
    rr(ctx, w.x - 4, w.y - 4, w.w + 8, w.h + 8, 10); ctx.fillStyle = "#fff4e0"; ctx.fill();
    drawOutside(ctx, w.x, w.y, w.w, w.h, "win");
    // camda parlama + çerçeve
    ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.beginPath(); ctx.moveTo(w.x + 20, w.y); ctx.lineTo(w.x + 50, w.y); ctx.lineTo(w.x + 10, w.y + w.h); ctx.lineTo(w.x - 20, w.y + w.h); ctx.fill();
    ctx.fillStyle = "#fff4e0"; ctx.fillRect(w.x + w.w / 2 - 3, w.y, 6, w.h); ctx.fillRect(w.x, w.y + w.h / 2 - 3, w.w, 6);
    if (S.wkind === "rain" || S.wkind === "snow") { ctx.fillStyle = "rgba(255,255,255,.12)"; ctx.fillRect(w.x, w.y, w.w, w.h); }
    // perdeler
    ctx.fillStyle = "#ffd0c2";
    ctx.beginPath(); ctx.moveTo(w.x - 6, w.y - 6); ctx.quadraticCurveTo(w.x + 22, w.y + 50, w.x + 4, w.y + 92); ctx.lineTo(w.x - 6, w.y + 92); ctx.fill();
    ctx.beginPath(); ctx.moveTo(w.x + w.w + 6, w.y - 6); ctx.quadraticCurveTo(w.x + w.w - 22, w.y + 50, w.x + w.w - 4, w.y + 92); ctx.lineTo(w.x + w.w + 6, w.y + 92); ctx.fill();
    ctx.fillStyle = C.red; ctx.fillRect(w.x - 14, w.y - 16, w.w + 28, 8);
    // denizlik
    rr(ctx, w.x - 16, w.y + w.h + 8, w.w + 32, 12, 5); ctx.fillStyle = C.wood3; ctx.fill();
    if (S.upg.vitrin) {
      const cols = ["#ffd166", "#ff8fab", "#8ecae6", "#95d5b2"], n = 14;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1), bx = w.x - 12 + t * (w.w + 24), by = w.y - 20 + Math.sin(t * Math.PI) * 10;
        const on = ((S.time * 3 + i) | 0) % 2 === 0;
        circle(ctx, bx, by, 4.5, on ? cols[i % 4] : "rgba(255,255,255,.5)");
        if (on) { ctx.save(); ctx.globalAlpha = .35; circle(ctx, bx, by, 9, cols[i % 4]); ctx.restore(); }
      }
      if (S.slots.length) { emo(ctx, S.slots[S.slots.length - 1].p.emoji, w.x + w.w - 26, w.y + w.h + 2, 20); }
    }
    if (S.upg.plant) { // saksı çiçekleri pervazda
      const pl = ["🌷", "🌼", "🌸"];
      for (let i = 0; i < Math.min(3, 1 + S.upg.plant); i++) {
        const px = w.x + 24 + i * 56; rr(ctx, px - 11, w.y + w.h - 6, 22, 16, 4); ctx.fillStyle = "#e0875a"; ctx.fill();
        emo(ctx, pl[i], px, w.y + w.h - 14 + Math.sin(S.time * 1.5 + i) * 1, 20);
      }
    }
  }
  function drawDoor(ctx) {
    const d = L.door;
    rr(ctx, d.x - 8, d.y - 10, d.w + 16, d.h + 10, 10); ctx.fillStyle = C.wood2; ctx.fill();
    // dışarısı (kapı açılınca görünen)
    drawOutside(ctx, d.x, d.y, d.w, d.h, "door");
    const open = clamp(S.doorOpen, 0, 1), dw = d.w * (1 - open * 0.55);
    rr(ctx, d.x, d.y, dw, d.h, 6); ctx.fillStyle = "#c98b55"; ctx.fill();
    ctx.save(); ctx.beginPath(); rr(ctx, d.x + 10 * (dw / d.w), d.y + 14, dw - 20 * (dw / d.w), 118, 6); ctx.clip();
    drawOutside(ctx, d.x, d.y, d.w, d.h, "door");
    ctx.fillStyle = "rgba(255,255,255,.2)"; ctx.fillRect(d.x, d.y, d.w, 140);
    ctx.restore();
    ctx.fillStyle = "#b37846"; rr(ctx, d.x + 12 * (dw / d.w), d.y + 150, dw - 24 * (dw / d.w), 100, 6); ctx.fill();
    circle(ctx, d.x + dw - 12, d.y + 146, 5, C.gold);
    // AÇIK/KAPALI tabelası
    const open2 = S.mode === "day";
    const sx = d.x + dw / 2, sy = d.y + 60 + Math.sin(S.time * 2) * 1.5;
    ctx.strokeStyle = "#7a5a3a"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(sx - 16, sy - 12); ctx.lineTo(sx, sy - 30); ctx.lineTo(sx + 16, sy - 12); ctx.stroke();
    rr(ctx, sx - 30, sy - 12, 60, 24, 8); ctx.fillStyle = open2 ? C.green : C.red; ctx.fill();
    txt(ctx, open2 ? "AÇIK" : "KAPALI", sx, sy + 1, 12, "#fff", 700);
    // zil
    const sw = Math.sin(S.time * 18) * S.bell * 0.5;
    ctx.save(); ctx.translate(d.x + d.w / 2, d.y - 4); ctx.rotate(sw); emo(ctx, "🔔", 0, 10, 16); ctx.restore();
    if (S.upg.basket) { emo(ctx, "🧺", d.x - 22, 404, 30); }
  }
  function drawShelves(ctx) {
    relayout();
    const s = L.shelf, rows = rowY(S.rows);
    // gövde
    rr(ctx, s.x - 6, s.top - 8, s.x1 - s.x + 12, FLOOR_Y - s.top + 8, 12); ctx.fillStyle = C.wood2; ctx.fill();
    rr(ctx, s.x + 4, s.top + 2, s.x1 - s.x - 8, FLOOR_Y - s.top - 12, 8); ctx.fillStyle = "#c68f5c"; ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,.06)"; for (let x = s.x + 16; x < s.x1 - 8; x += 26) ctx.fillRect(x, s.top + 4, 2, FLOOR_Y - s.top - 16);
    // tepe süsü
    rr(ctx, s.x - 12, s.top - 16, s.x1 - s.x + 24, 14, 6); ctx.fillStyle = C.wood; ctx.fill();
    // raflar
    const cap = shelfCap(), st = curState(), stock = (st && st.stock) || {};
    rows.forEach(y => {
      rr(ctx, s.x - 2, y, s.x1 - s.x + 4, 12, 4); ctx.fillStyle = C.wood; ctx.fill();
      ctx.fillStyle = C.woodL; ctx.fillRect(s.x, y, s.x1 - s.x, 3);
      ctx.fillStyle = "rgba(60,30,10,.18)"; ctx.fillRect(s.x + 4, y + 12, s.x1 - s.x - 8, 4);
    });
    // ürünler
    for (const sl of S.slots) {
      const n = Math.max(0, stock[sl.p.id] || 0);
      const perRow = clamp(Math.floor((sl.w - 14) / 22), 2, 9), maxVis = perRow * 2 - 1;
      const vis = n <= 0 ? 0 : clamp(Math.round(n / Math.max(1, cap) * maxVis), 1, maxVis);
      const step = Math.min(24, (sl.w - 30) / Math.max(1, perRow - 1));
      if (vis === 0) {
        emo(ctx, sl.p.emoji, sl.x, sl.y - 18, 28, 0.2);
        ctx.setLineDash([3, 3]); ctx.strokeStyle = "rgba(227,80,44,.45)"; ctx.lineWidth = 1.5; rr(ctx, sl.x - sl.w / 2 + 6, sl.y - 34, sl.w - 12, 32, 6); ctx.stroke(); ctx.setLineDash([]);
      } else {
        const back = Math.max(0, vis - perRow), front = vis - back;
        for (let i = 0; i < back; i++) emo(ctx, sl.p.emoji, sl.x + (i - (back - 1) / 2) * step, sl.y - 30, 23, 0.85);
        for (let i = 0; i < front; i++) emo(ctx, sl.p.emoji, sl.x + (i - (front - 1) / 2) * step, sl.y - 16, 28);
      }
      // fiyat etiketi
      const pr = sl.p.price != null ? "₺" + sl.p.price : "";
      rr(ctx, sl.x - 15, sl.y + 1, 30, 10, 3); ctx.fillStyle = n > 0 ? "#fffaf2" : "#ffe0d6"; ctx.fill();
      txt(ctx, pr, sl.x, sl.y + 6.5, 9, n > 0 ? C.ink : C.red, 700);
    }
    // ek raf yükseltmesi: yan sepet rafı
    if (S.upg.shelf && S.slots.length) {
      rr(ctx, s.x + 6, 396, 72, 22, 6); ctx.fillStyle = "#e7b36f"; ctx.fill();
      ctx.strokeStyle = "#b9803e"; ctx.lineWidth = 1.5; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(s.x + 12 + i * 12, 398); ctx.lineTo(s.x + 12 + i * 12, 416); ctx.stroke(); }
      emo(ctx, S.slots[0].p.emoji, s.x + 30, 392, 18); emo(ctx, (S.slots[1] || S.slots[0]).p.emoji, s.x + 54, 392, 18);
    }
  }
  function drawFridge(ctx) {
    const f = L.fridge;
    if (!S.upg.fridge) {
      // buzdolabı yokken: takvim
      const cx = f.x + f.w / 2, cy = 196;
      rr(ctx, cx - 30, cy - 34, 60, 70, 8); ctx.fillStyle = "#fffaf2"; ctx.fill();
      ctx.fillStyle = C.red; rr(ctx, cx - 30, cy - 34, 60, 18, 8); ctx.fill(); ctx.fillRect(cx - 30, cy - 24, 60, 8);
      const st = curState(); txt(ctx, "GÜN", cx, cy - 25, 10, "#fff", 700);
      txt(ctx, String((S.plan && S.plan.day) || (st && st.day) || 1), cx, cy + 6, 26, C.ink, 700);
      const wd = S.plan && findBy(DATA("WEEKDAYS"), S.plan.weekday);
      if (wd && wd.name) txt(ctx, wd.name.slice(0, 3).toUpperCase(), cx, cy + 26, 10, "#9a7a5a", 700);
      circle(ctx, cx - 16, cy - 36, 3, C.wood2); circle(ctx, cx + 16, cy - 36, 3, C.wood2);
      // saksı bitki (yer)
      if (S.upg.plant) { rr(ctx, cx - 16, 386, 32, 30, 6); ctx.fillStyle = "#e0875a"; ctx.fill(); emo(ctx, "🪴", cx, 364, 40); }
      return;
    }
    rr(ctx, f.x, f.y, f.w, f.h, 14); ctx.fillStyle = "#e8f4fa"; ctx.fill();
    ctx.strokeStyle = "#b9d6e6"; ctx.lineWidth = 3; ctx.stroke();
    rr(ctx, f.x + 8, f.y + 22, f.w - 16, f.h - 40, 8); ctx.fillStyle = "#cfeaf7"; ctx.fill();
    // soğuk ışık
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
    rr(ctx, f.x + 10, f.y + 5, f.w - 20, 12, 5); ctx.fillStyle = "#7ec4e6"; ctx.fill();
    txt(ctx, "SOĞUK", f.x + f.w / 2, f.y + 11.5, 9, "#fff", 700);
    // kar tanesi parıltısı
    emo(ctx, "❄️", f.x + f.w / 2, f.y + f.h - 12, 11, 0.6 + Math.sin(S.time * 2) * 0.3);
  }
  function drawBoard(ctx) {
    // tezgâh üstü kara tahta: gün + olay
    const b = L.board;
    rr(ctx, b.x - 5, b.y - 5, b.w + 10, b.h + 10, 10); ctx.fillStyle = C.wood; ctx.fill();
    rr(ctx, b.x, b.y, b.w, b.h, 6); ctx.fillStyle = "#3f5a4c"; ctx.fill();
    const st = curState(); const wd = S.plan && findBy(DATA("WEEKDAYS"), S.plan.weekday);
    txt(ctx, (wd && wd.name) || "Bugün", b.x + b.w / 2, b.y + 18, 14, "#fdf6e3", 600);
    ctx.strokeStyle = "rgba(255,255,255,.3)"; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(b.x + 18, b.y + 30); ctx.lineTo(b.x + b.w - 18, b.y + 30); ctx.stroke();
    if (S.event) {
      emo(ctx, S.event.emoji || "🎉", b.x + 22, b.y + 55, 22);
      const nm = String(S.event.name || "");
      ctx.save(); ctx.beginPath(); ctx.rect(b.x + 36, b.y + 32, b.w - 40, 50); ctx.clip();
      wrapText(ctx, nm, b.x + 38, b.y + 49, b.w - 44, 14, 12, "#ffe7a8");
      ctx.restore();
    } else {
      emo(ctx, (S.weather && S.weather.emoji) || "☀️", b.x + 30, b.y + 56, 22);
      txt(ctx, "Gün " + ((S.plan && S.plan.day) || (st && st.day) || 1), b.x + 82, b.y + 56, 15, "#ffe7a8", 600);
    }
    // tebeşir
    ctx.fillStyle = "#fff"; ctx.fillRect(b.x + 12, b.y + b.h - 4, 14, 3);
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
  function drawCounterBack(ctx) {
    // tezgâhtar (tezgâhın arkasında)
    const k = S.keeper, x = 772, hop = Math.sin(clamp(k.hop, 0, 1) * Math.PI) * 10, y = 300 - hop;
    const breath = Math.sin(S.time * 2) * 1.2;
    ellipse(ctx, x, y + 6, 34, 36 + breath, "#ffd9b8");
    // önlük
    ctx.save(); ctx.beginPath(); ctx.ellipse(x, y + 6, 34, 36 + breath, 0, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = C.red; ctx.fillRect(x - 22, y + 14, 44, 40); ctx.fillStyle = "#fff"; ctx.fillRect(x - 22, y + 14, 44, 4);
    ctx.restore();
    if (S.upg.apron) { circle(ctx, x + 12, y + 26, 5.5, C.gold); txt(ctx, "★", x + 12, y + 26.5, 8, "#fff", 700); }
    // şapka
    ctx.fillStyle = C.red; ctx.beginPath(); ctx.ellipse(x, y - 24, 24, 10, 0, Math.PI, 0); ctx.fill();
    rr(ctx, x - 26, y - 26, 52, 7, 3); ctx.fillStyle = C.red2; ctx.fill();
    circle(ctx, x, y - 36, 3.5, "#fff");
    // yüz
    const blink = (S.time % 3.7) < 0.12;
    const idleSleepy = S.mode === "idle" && S.phase === "evening";
    ctx.fillStyle = C.ink;
    if (blink || idleSleepy) { ctx.fillRect(x - 13, y - 5, 8, 2.2); ctx.fillRect(x + 5, y - 5, 8, 2.2); }
    else { circle(ctx, x - 9, y - 5, 3.4, C.ink); circle(ctx, x + 9, y - 5, 3.4, C.ink); circle(ctx, x - 8, y - 6.3, 1.1, "#fff"); circle(ctx, x + 10, y - 6.3, 1.1, "#fff"); }
    // bıyık
    ctx.fillStyle = "#6b4a33"; ctx.beginPath(); ctx.ellipse(x - 6, y + 4, 7, 3, -0.2, 0, Math.PI * 2); ctx.ellipse(x + 6, y + 4, 7, 3, 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y + 7, 5, 0.2, Math.PI - 0.2); ctx.stroke();
    circle(ctx, x - 20, y + 2, 5, "rgba(255,130,130,.4)"); circle(ctx, x + 20, y + 2, 5, "rgba(255,130,130,.4)");
    // el sallama
    if (k.wave > 0) { const a = Math.sin(S.time * 14) * 0.4; ctx.save(); ctx.translate(x + 34, y + 4); ctx.rotate(-0.6 + a); ellipse(ctx, 0, -12, 7, 12, "#ffd9b8"); ctx.restore(); }
    if (idleSleepy) zzz(ctx, x + 26, y - 30, 0.6);
  }
  function drawCounterFront(ctx) {
    const c = L.counter, w = c.x1 - c.x;
    // kasa
    const kx = 716, ky = 304;
    rr(ctx, kx - 26, ky, 52, 34, 6); ctx.fillStyle = S.upg.register ? "#7ec4e6" : "#e9dccb"; ctx.fill();
    rr(ctx, kx - 18, ky - 16, 36, 18, 4); ctx.fillStyle = S.upg.register ? "#355c7d" : "#6f8f7a"; ctx.fill();
    txt(ctx, S.mode === "day" ? "₺" : "--", kx, ky - 7, 11, "#d7ffd9", 700);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { rr(ctx, kx - 18 + i * 13, ky + 6 + j * 11, 10, 8, 2); ctx.fillStyle = "#fff"; ctx.fill(); }
    if (S.upg.register) emo(ctx, "💳", kx + 40, ky + 20, 18);
    // müzik kutusu
    if (S.upg.music) {
      emo(ctx, "📻", 814, 318, 28);
      if (S.mode === "day" || S.phase === "morning") for (let i = 0; i < 2; i++) { const ph = (S.time * .5 + i * .5) % 1; emo(ctx, i ? "🎵" : "🎶", 820 + ph * 20 + i * 8, 300 - ph * 50, 14, 1 - ph); }
    }
    if (S.upg.tea) emo(ctx, "🫖", 690, 320, 24);
    // tezgâh gövdesi
    rr(ctx, c.x - 6, c.top, w + 12, 16, 6); ctx.fillStyle = C.wood; ctx.fill();
    ctx.fillStyle = C.woodL; ctx.fillRect(c.x - 2, c.top + 2, w + 4, 3);
    rr(ctx, c.x, c.top + 14, w, 432 - c.top - 14, 6); ctx.fillStyle = "#fff4e0"; ctx.fill();
    // tente çizgili ön panel
    ctx.save(); rr(ctx, c.x + 10, c.top + 26, w - 20, 60, 6); ctx.clip();
    for (let x = c.x + 10, i = 0; x < c.x1; x += 20, i++) { ctx.fillStyle = i % 2 ? C.cream : "#f27b5a"; ctx.fillRect(x, c.top + 26, 20, 60); }
    ctx.restore();
    ctx.fillStyle = "rgba(0,0,0,.06)"; ctx.fillRect(c.x, 424, w, 8);
  }
  function drawLamps(ctx) {
    const n = S.upg.lamp ? Math.min(3, 1 + S.upg.lamp) : 0;
    const eve = S.mode === "idle" && S.phase === "evening";
    const xs = [396, 520, 300].slice(0, n || (eve ? 0 : 0));
    xs.forEach((x, i) => {
      ctx.strokeStyle = "#6b4a33"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, 44); ctx.lineTo(x, 70); ctx.stroke();
      ctx.fillStyle = i % 2 ? "#f2b134" : "#8ecae6"; ctx.beginPath(); ctx.moveTo(x - 18, 86); ctx.lineTo(x - 8, 68); ctx.lineTo(x + 8, 68); ctx.lineTo(x + 18, 86); ctx.fill();
      circle(ctx, x, 88, 5, "#fff6c8");
      const g = ctx.createRadialGradient(x, 90, 4, x, 110, 120); g.addColorStop(0, "rgba(255,236,160," + (eve ? .45 : .28) + ")"); g.addColorStop(1, "rgba(255,236,160,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 16, 88); ctx.lineTo(x + 16, 88); ctx.lineTo(x + 110, 400); ctx.lineTo(x - 110, 400); ctx.fill();
    });
  }
  function drawSign(ctx) {
    // tabela
    if (S.upg.sign || S.upg.grand) {
      const grand = !!S.upg.grand, x0 = 290, x1 = 502, y = 54;
      rr(ctx, x0, y, x1 - x0, 32, 10); ctx.fillStyle = grand ? C.gold : C.red; ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; rr(ctx, x0 + 4, y + 4, x1 - x0 - 8, 24, 7); ctx.stroke();
      const neon = (S.upg.sign || 0) >= 4 || grand, glow = 0.5 + Math.sin(S.time * 3) * 0.2;
      ctx.save(); ctx.shadowColor = neon ? "rgba(255,120,200," + (glow + .3) + ")" : "rgba(255,240,180," + glow + ")"; ctx.shadowBlur = neon ? 16 : 6;
      txt(ctx, grand ? "⭐ KÖŞE SÜPERMARKET ⭐" : "KÖŞE MARKET", (x0 + x1) / 2, y + 17, grand ? 15 : 17, "#fff", 700); ctx.restore();
    }
  }
  function drawWallDecor(ctx) {
    if ((S.upg.sign || 0) >= 2) { // kapıya balon
      [["#ff8fab", -14], ["#ffd166", 0], ["#8ecae6", 14]].forEach(([cl, dx], i) => {
        const bx = L.door.x - 22 + dx, by = 126 + Math.abs(dx) * .4 + Math.sin(S.time * 1.8 + i) * 3;
        ctx.strokeStyle = "rgba(90,60,40,.5)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bx, by + 16); ctx.lineTo(L.door.x - 22, 196); ctx.stroke();
        ellipse(ctx, bx, by, 11, 14, cl); ellipse(ctx, bx - 4, by - 5, 3, 4, "rgba(255,255,255,.5)");
      });
    }
    if (S.upg.deal) { // toptancı kasası
      rr(ctx, 170, 388, 44, 30, 4); ctx.fillStyle = "#d9a46c"; ctx.fill(); ctx.fillStyle = C.wood; ctx.fillRect(170, 400, 44, 3);
      emo(ctx, "🍏", 182, 386, 14); emo(ctx, "🍊", 200, 384, 14);
    }
    // saat
    const cx = 628, cy = 88;
    circle(ctx, cx, cy, 19, C.wood); circle(ctx, cx, cy, 15, "#fffaf2");
    const p = dayProgress(), hr = 8 + p * 12, ang = (hr / 12) * Math.PI * 2 - Math.PI / 2, mang = (hr % 1) * Math.PI * 2 - Math.PI / 2;
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2.4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ang) * 8, cy + Math.sin(ang) * 8); ctx.stroke();
    ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(mang) * 12, cy + Math.sin(mang) * 12); ctx.stroke();
    circle(ctx, cx, cy, 2, C.red);
    // kamera
    if (S.upg.camera) { emo(ctx, "📹", 930, 70, 20); circle(ctx, 920, 64, 2.5, (S.time % 1.2) < .6 ? "#ff4d4d" : "#7a2a2a"); }
    // vantilatör
    if (S.upg.fan) {
      ctx.save(); ctx.translate(210, 62); ctx.strokeStyle = "#6b4a33"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(0, 0); ctx.stroke();
      ctx.rotate(S.time * (S.mode === "day" ? 9 : 1.5)); for (let i = 0; i < 3; i++) { ctx.rotate(Math.PI * 2 / 3); ellipse(ctx, 16, 0, 16, 4, "#d9a46c"); } circle(ctx, 0, 0, 4, C.wood2); ctx.restore();
    }
    // tanınmayan yükseltmeler: kapı üstündeki rozet rafı
    if (S.badges.length) {
      const y = 132, x0 = L.board.x + 8;
      S.badges.forEach((e, i) => { const bx = x0 + i * 26; if (bx > L.board.x + L.board.w) return; circle(ctx, bx + 8, y + 90, 11, "#fffaf2"); emo(ctx, e, bx + 8, y + 90, 14); });
    }
  }
  function drawEventDecor(ctx, front) {
    const k = S.ekind; if (!k) return;
    if (!front) {
      if (k === "inspect") { rr(ctx, 30, 300, 70, 44, 6); ctx.fillStyle = "#fffaf2"; ctx.fill(); txt(ctx, "DENETİM", 65, 312, 11, C.red, 700); txt(ctx, "✓ ✓ ✓", 65, 330, 11, C.green, 700); }
      if (k === "sale") { ctx.save(); ctx.translate(120, 322); ctx.rotate(-0.08); rr(ctx, -46, -16, 92, 32, 8); ctx.fillStyle = "#ffe066"; ctx.fill(); txt(ctx, "İNDİRİM!", 0, 1, 15, C.red, 700); ctx.restore(); }
      if (k === "tv") { rr(ctx, 44, 296, 80, 50, 6); ctx.fillStyle = "#333"; ctx.fill(); ctx.fillStyle = "hsl(" + ((S.time * 40) % 360) + ",60%,70%)"; ctx.fillRect(50, 302, 68, 38); emo(ctx, "📺", 84, 360, 1); }
      if (k === "boxes") { emo(ctx, "📦", 820, 400, 30); emo(ctx, "📦", 838, 376, 26); }
      if (k === "star") { const a = 0.4 + Math.sin(S.time * 4) * .3; emo(ctx, "✨", 240, 90, 18, a); emo(ctx, "✨", 560, 110, 16, 1 - a); emo(ctx, "📸", 830, 110, 18); }
      return;
    }
    // ön katman: flama / balon
    const flagSets = {
      match: ["#ffd23f", "#1d3557", "#ffd23f", "#e63946"], party: ["#ff8fab", "#ffd166", "#8ecae6", "#95d5b2", "#cdb4f6"],
      school: ["#8ecae6", "#ffd166", "#e63946"], generic: ["#ffb3c1", "#ffe08a", "#a0d8ef", "#b8e0a8", "#cdb4f6"],
      rainbow: ["#ff6b6b", "#ffb347", "#ffe66d", "#7bd389", "#6ec3f4", "#b39ddb"]
    };
    const set = flagSets[k] || flagSets.generic;
    bunting(ctx, 10, 470, 60, 22, set); bunting(ctx, 470, 950, 60, 22, set);
    if (k === "party" || k === "generic" || k === "star") {
      // balonlar
      const bl = [["#ff8fab", 660, 150], ["#8ecae6", 676, 128], ["#ffd166", 690, 156], ["#b8e0a8", 212, 150], ["#cdb4f6", 196, 128]];
      bl.forEach(([cl, bx, by], i) => {
        const yy = by + Math.sin(S.time * 1.6 + i) * 4, anchor = bx < 400 ? [206, 340] : [680, 336];
        ctx.strokeStyle = "rgba(90,60,40,.5)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bx, yy + 20); ctx.quadraticCurveTo(bx + 6, (yy + anchor[1]) / 2, anchor[0], anchor[1]); ctx.stroke();
        ellipse(ctx, bx, yy, 15, 19, cl); ellipse(ctx, bx - 5, yy - 7, 4, 6, "rgba(255,255,255,.5)");
      });
    }
    if (k === "match") {
      // atkı
      ctx.save(); ctx.translate(758, 214); ctx.rotate(-0.04);
      for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? "#1d3557" : "#ffd23f"; ctx.fillRect(-64 + i * 16, 0, 16, 16); }
      rr(ctx, -26, 1, 52, 14, 4); ctx.fillStyle = "#e63946"; ctx.fill();
      txt(ctx, "HAYDİ!", 0, 8.5, 10, "#fff", 700); ctx.restore();
      emo(ctx, "⚽", 860, 120, 22);
    }
    if (k === "kittens") { emo(ctx, "🐱", S.cat.x + 40, S.cat.y - 10, 22); emo(ctx, "🐱", S.cat.x - 38, S.cat.y - 6, 20); }
    if (k === "school") emo(ctx, "🎒", 50, 404, 28);
    if (k !== "match" && k !== "rainbow") {
      // olay madalyonu
      const e = S.event && S.event.emoji; if (e && !S.upg.sign && !S.upg.grand) { circle(ctx, 470, 94, 17, "#fffaf2"); ctx.strokeStyle = C.gold; ctx.lineWidth = 3; ctx.stroke(); emo(ctx, e, 470, 95, 20); }
    }
  }
  function bunting(ctx, x0, x1, y0, sag, cols) {
    ctx.strokeStyle = "#7a5a3a"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2, y0 + sag * 2, x1, y0); ctx.stroke();
    const n = Math.floor((x1 - x0) / 34);
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = lerp(x0, x1, t), y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * (y0 + sag * 2) + t * t * y0;
      const sw = Math.sin(S.time * 2 + i) * 1.5;
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
    const h = S.helper, y = 468, bob = Math.abs(Math.sin(S.time * 7)) * (Math.abs(h.tx - h.x) > 2 ? 3 : 0);
    shadow(ctx, h.x, y + 26, 20);
    ellipse(ctx, h.x, y - bob, 20, 22, "#a0d8ef");
    ctx.save(); ctx.beginPath(); ctx.ellipse(h.x, y - bob, 20, 22, 0, 0, Math.PI * 2); ctx.clip(); ctx.fillStyle = C.red; ctx.fillRect(h.x - 13, y - bob + 4, 26, 22); ctx.restore();
    circle(ctx, h.x - 6, y - bob - 6, 2.6, C.ink); circle(ctx, h.x + 6, y - bob - 6, 2.6, C.ink);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(h.x, y - bob - 1, 4, 0.3, Math.PI - 0.3); ctx.stroke();
    emo(ctx, "📦", h.x + 18, y - bob + 2, 16);
  }

  // ---------- Pamuk ----------
  function updCat(dt) {
    const c = S.cat; c.t -= dt; if (c.alert > 0) c.alert -= dt;
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
    zones.cat[0] = { x: c.x, y: c.y - 78 };
  }
  function zzz(ctx, x, y, s) {
    for (let i = 0; i < 3; i++) {
      const ph = (S.time * 0.6 + i / 3) % 1;
      ctx.save(); ctx.globalAlpha = Math.sin(ph * Math.PI);
      txt(ctx, "z", x + ph * 18 + i * 3, y - ph * 30, (10 + i * 3) * (s || 1) + 4, "#7d8fb3", 700); ctx.restore();
    }
  }
  function drawCatBed(ctx) {
    if (!S.upg.catbed) return;
    const b = L.catBed;
    ellipse(ctx, b.x, b.y + 4, 46, 16, "#c96f6f"); ellipse(ctx, b.x, b.y, 40, 11, "#ffd0da");
    ctx.fillStyle = "#e58f9f"; for (let i = -2; i <= 2; i++) circle(ctx, b.x + i * 14, b.y + 12, 2, "#fff");
  }
  function drawCat(ctx) {
    const c = S.cat, x = c.x, y = c.y, d = c.dir || 1;
    const fur = "#ffffff", line = "#d8cbbd", pink = "#ffb3c1";
    shadow(ctx, x, y + 6, 34);
    ctx.save(); ctx.translate(x, y); ctx.scale(d < 0 ? -1.35 : 1.35, 1.35);
    ctx.lineWidth = 2; ctx.strokeStyle = line;
    if (c.st === "sleep") {
      const br = Math.sin(S.time * 2) * 1.2;
      // kıvrık kuyruk
      ctx.beginPath(); ctx.ellipse(10, -4, 22, 10, 0.1, 0.2, Math.PI * 1.2); ctx.lineWidth = 7; ctx.strokeStyle = line; ctx.stroke(); ctx.lineWidth = 5; ctx.strokeStyle = fur; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, -10, 26, 15 + br, 0, 0, Math.PI * 2); ctx.fillStyle = fur; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = line; ctx.stroke();
      // baş
      ctx.beginPath(); ctx.arc(-18, -14, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      tri(ctx, -28, -22, -25, -34, -18, -25, fur, line); tri(ctx, -16, -26, -10, -35, -7, -22, fur, line);
      ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(-23, -14, 3, 0.2, Math.PI - 0.2); ctx.stroke(); ctx.beginPath(); ctx.arc(-14, -14, 3, 0.2, Math.PI - 0.2); ctx.stroke();
      circle(ctx, -18, -9, 1.8, pink); circle(ctx, -26, -9, 2.6, "rgba(255,160,180,.45)");
      ctx.restore();
      zzz(ctx, x + (d < 0 ? 22 : -40), y - 46, 1.1);
      return;
    }
    const walking = c.st === "walk", step = walking ? Math.sin(c.walkT * 12) : 0;
    const sit = c.st === "sit";
    // kuyruk
    const tw = Math.sin(S.time * 3) * 0.3;
    ctx.beginPath(); ctx.moveTo(22, sit ? -8 : -18); ctx.quadraticCurveTo(38, -30 + tw * 20, 30 + tw * 10, -44); ctx.lineWidth = 7; ctx.strokeStyle = line; ctx.stroke(); ctx.lineWidth = 5; ctx.strokeStyle = fur; ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = line;
    // bacaklar
    if (!sit) {
      [[-12, step], [-4, -step], [10, -step], [18, step]].forEach(([lx, s]) => { rr(ctx, lx - 3.5, -10 + s * 2, 7, 14 - s * 2, 3.5); ctx.fillStyle = fur; ctx.fill(); ctx.stroke(); });
      ctx.beginPath(); ctx.ellipse(3, -18, 24, 13, 0, 0, Math.PI * 2); ctx.fillStyle = fur; ctx.fill(); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.ellipse(4, -16, 17, 18, 0, 0, Math.PI * 2); ctx.fillStyle = fur; ctx.fill(); ctx.stroke();
      rr(ctx, -9, -8, 7, 10, 3.5); ctx.fill(); ctx.stroke(); rr(ctx, 0, -8, 7, 10, 3.5); ctx.fill(); ctx.stroke();
    }
    // baş
    const hx = sit ? -2 : -20, hy = sit ? -40 : -30 - Math.abs(step) * 1.5;
    tri(ctx, hx - 12, hy - 6, hx - 10, hy - 22, hx - 1, hy - 11, fur, line); tri(ctx, hx + 1, hy - 11, hx + 10, hy - 22, hx + 12, hy - 6, fur, line);
    ctx.fillStyle = pink; ctx.beginPath(); ctx.moveTo(hx - 9, hy - 9); ctx.lineTo(hx - 9, hy - 17); ctx.lineTo(hx - 4, hy - 11); ctx.fill();
    ctx.beginPath(); ctx.arc(hx, hy, 14, 0, Math.PI * 2); ctx.fillStyle = fur; ctx.fill(); ctx.stroke();
    const blink = (S.time % 4.3) < 0.14;
    if (blink) { ctx.fillStyle = C.ink; ctx.fillRect(hx - 8, hy - 1, 5, 1.8); ctx.fillRect(hx + 3, hy - 1, 5, 1.8); }
    else { circle(ctx, hx - 5.5, hy - 1, 2.6, C.ink); circle(ctx, hx + 5.5, hy - 1, 2.6, C.ink); circle(ctx, hx - 4.8, hy - 2, .9, "#fff"); circle(ctx, hx + 6.2, hy - 2, .9, "#fff"); }
    circle(ctx, hx, hy + 4, 1.8, pink);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(hx - 2, hy + 6, 2, 0, Math.PI); ctx.arc(hx + 2, hy + 6, 2, 0, Math.PI); ctx.stroke();
    circle(ctx, hx - 9, hy + 4, 2.8, "rgba(255,160,180,.5)"); circle(ctx, hx + 9, hy + 4, 2.8, "rgba(255,160,180,.5)");
    ctx.restore();
    if (c.alert > 0) txt(ctx, "!", x + (d < 0 ? 32 : -32), y - 86 + Math.sin(S.time * 10) * 2, 20, C.red, 700);
  }
  function tri(ctx, x1, y1, x2, y2, x3, y3, fill, stroke) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); } }

  // ---------- müşteri çizimi ----------
  function drawCustomer(ctx, c) {
    const lk = c.look, r = lk.size, walking = c.moving;
    const bob = walking ? Math.abs(Math.sin(c.walkT * 9)) * 4 : Math.sin(S.time * 2 + c.x) * 1;
    const hop = Math.sin(clamp(c.hop, 0, 1) * Math.PI) * 18;
    const x = c.x, base = c.y, y = base - r - 6 - bob - hop;
    ctx.save(); ctx.globalAlpha = clamp(c.alpha, 0, 1);
    shadow(ctx, x, base + 2, r * 0.9);
    // ayaklar
    const st = walking ? Math.sin(c.walkT * 9) * 4 : 0;
    ellipse(ctx, x - 8 + st, base - 3 - hop * 0.5, 7, 5, "#5a4636"); ellipse(ctx, x + 8 - st, base - 3 - hop * 0.5, 7, 5, "#5a4636");
    // gövde
    const sq = 1 + (hop > 0 ? -0.05 : Math.sin(S.time * 3 + c.x) * 0.02);
    ctx.beginPath(); ctx.ellipse(x, y, r * (2 - sq), r * sq * 1.05, 0, 0, Math.PI * 2);
    ctx.fillStyle = lk.color; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "rgba(90,60,40,.18)"; ctx.stroke();
    ellipse(ctx, x - r * .35, y - r * .45, r * .3, r * .18, "rgba(255,255,255,.45)");
    // yüz
    const fx = x + c.dir * -3 * (walking ? 1 : 0), fy = y - 2;
    const sad = c.sad > 0;
    if (lk.regular && lk.face) {
      emo(ctx, lk.face, fx, fy - 2, r * 1.25);
      ctx.save(); ctx.globalAlpha *= .9; emo(ctx, "⭐", x + r * .8, y - r * .9, 12); ctx.restore();
    } else {
    const blink = ((S.time + c.x * .01) % 3.3) < 0.12;
    if (blink) { ctx.fillStyle = C.ink; ctx.fillRect(fx - 9, fy - 2, 6, 2); ctx.fillRect(fx + 3, fy - 2, 6, 2); }
    else { circle(ctx, fx - 6, fy - 2, 3, C.ink); circle(ctx, fx + 6, fy - 2, 3, C.ink); circle(ctx, fx - 5.2, fy - 3.2, 1, "#fff"); circle(ctx, fx + 6.8, fy - 3.2, 1, "#fff"); }
    circle(ctx, fx - 12, fy + 4, 3.6, "rgba(255,120,140,.35)"); circle(ctx, fx + 12, fy + 4, 3.6, "rgba(255,120,140,.35)");
    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.8; ctx.beginPath();
    if (sad) ctx.arc(fx, fy + 9, 4, Math.PI + 0.3, -0.3); else ctx.arc(fx, fy + 3, 4.5, 0.25, Math.PI - 0.25);
    ctx.stroke();
    }
    // aksesuar
    const top = y - r * sq * 1.05;
    if (!lk.regular) switch (lk.acc) {
      case 0: ctx.fillStyle = "#e36a6a"; ctx.beginPath(); ctx.ellipse(x, top + 4, r * .8, 7, 0, Math.PI, 0); ctx.fill(); rr(ctx, x - 2, top + 1, r + 6, 5, 2); ctx.fill(); break; // şapka
      case 1: ctx.fillStyle = "#ff7aa2"; tri(ctx, x + 4, top + 3, x + 16, top - 5, x + 16, top + 9, "#ff7aa2"); tri(ctx, x + 4, top + 3, x - 8, top - 5, x - 8, top + 9, "#ff7aa2"); circle(ctx, x + 4, top + 3, 3, "#ff4f86"); break; // fiyonk
      case 2: ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(fx - 6, fy - 2, 6, 0, Math.PI * 2); ctx.moveTo(fx + 12, fy - 2); ctx.arc(fx + 6, fy - 2, 6, 0, Math.PI * 2); ctx.moveTo(fx, fy - 2); ctx.stroke(); break; // gözlük
      case 3: ctx.fillStyle = "#6d8fd8"; ctx.beginPath(); ctx.arc(x, top + 8, r * .78, Math.PI, 0); ctx.fill(); circle(ctx, x, top - 4, 5, "#fff"); break; // bere
      case 4: ctx.strokeStyle = "rgba(90,60,40,.6)"; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x, top + 1); ctx.quadraticCurveTo(x + 5, top - 10, x + 10, top - 6); ctx.stroke(); break; // perçem
      case 5: ctx.fillStyle = "#8d6e63"; ctx.beginPath(); ctx.ellipse(x, top + 5, r * .9, 8, 0, Math.PI, 0); ctx.fill(); break; // saç
      default: circle(ctx, x + r * .6, top + 6, 5, "#ffe066"); circle(ctx, x + r * .6, top + 6, 2, "#ff9f43"); // çiçek
    }
    // taşınan ürünler
    if (c.carried.length) {
      c.carried.slice(-3).forEach((e, i) => emo(ctx, e, x + c.dir * -1 * (r + 4) + i * 6, y + 6 - i * 4, 16));
    }
    // düşünce balonu
    if (c.think) {
      const bx = x + 16, by = top - 22 + Math.sin(S.time * 3) * 2;
      circle(ctx, x + 6, top - 4, 3, "#fff"); rr(ctx, bx - 16, by - 15, 32, 28, 12); ctx.fillStyle = "#fff"; ctx.fill();
      ctx.strokeStyle = "rgba(90,60,40,.15)"; ctx.lineWidth = 1.5; ctx.stroke(); emo(ctx, c.think, bx, by - 1, 17);
    }
    // üzgün bulut
    if (sad) {
      const cy = top - 26, a = clamp(c.sad, 0, 1);
      ctx.globalAlpha *= a;
      circle(ctx, x - 9, cy, 9, "#9fb0c4"); circle(ctx, x + 3, cy - 5, 11, "#9fb0c4"); circle(ctx, x + 13, cy, 8, "#9fb0c4"); ellipse(ctx, x + 2, cy + 4, 20, 6, "#9fb0c4");
      ctx.strokeStyle = "#6fa8dc"; ctx.lineWidth = 1.6; ctx.beginPath();
      for (let i = 0; i < 4; i++) { const ph = (S.time * 2.2 + i * .27) % 1; const dx = x - 10 + i * 7; ctx.moveTo(dx, cy + 10 + ph * 18); ctx.lineTo(dx - 1, cy + 15 + ph * 18); }
      ctx.stroke();
    }
    if (c.heart > 0) emo(ctx, "💗", x + 18, top - 8 - (1.2 - c.heart) * 20, 14, clamp(c.heart, 0, 1));
    ctx.restore();
  }

  // ---------- ana çizim ----------
  function resize() {
    const cv = S.canvas; if (!cv) return false;
    const cssW = cv.clientWidth; if (!cssW) return false;
    const dpr = Math.min(global.devicePixelRatio || 1, 2.5);
    const v = S.view, vw = v.x1 - v.x0;
    const bw = Math.round(cssW * dpr), bh = Math.round(bw * H / vw);
    if (bw !== S.bw || bh !== S.bh) { cv.width = bw; cv.height = bh; S.bw = bw; S.bh = bh; }
    const k = bw / vw;
    S.ctx.setTransform(k, 0, 0, k, -v.x0 * k, 0);
    return true;
  }

  function draw() {
    if (!S.ctx || !resize()) return;
    const ctx = S.ctx;
    ctx.clearRect(S.view.x0, 0, S.view.x1 - S.view.x0, H);
    drawWall(ctx);
    drawWindow(ctx);
    drawShelves(ctx);
    drawFridge(ctx);
    drawDoor(ctx);
    drawWallDecor(ctx);
    drawBoard(ctx);
    drawEventDecor(ctx, false);
    drawCounterBack(ctx);
    drawCounterFront(ctx);
    drawFloor(ctx);
    drawCatBed(ctx);
    // yerdeki varlıkları y'ye göre sırala
    const ents = S.customers.map(c => ({ y: c.y, f: () => drawCustomer(ctx, c) }));
    ents.push({ y: S.cat.y, f: () => drawCat(ctx) });
    if (S.upg.helper) ents.push({ y: 468 + 26, f: () => drawHelper(ctx) });
    if ((S.upg.mat || 0) >= 2) ents.push({ y: 522, f: () => drawRobot(ctx) });
    if (S.upg.plant) ents.push({ y: 520, f: () => { rr(ctx, 818, 470, 30, 34, 6); ctx.fillStyle = "#e0875a"; ctx.fill(); emo(ctx, "🌿", 833, 452, 38); } });
    ents.sort((a, b) => a.y - b.y).forEach(e => e.f());
    drawLamps(ctx);
    drawEventDecor(ctx, true);
    drawSign(ctx);
    // ışık / akşam tonu
    const p = dayProgress(), dusk = clamp((p - 0.75) / 0.3, 0, 1);
    if (dusk > 0) { ctx.fillStyle = "rgba(255,140,90," + (dusk * 0.10) + ")"; ctx.fillRect(0, 0, W, H); ctx.fillStyle = "rgba(70,40,110," + (dusk * 0.10) + ")"; ctx.fillRect(0, 0, W, H); }
    if (S.ekind === "dark" && S.mode === "day") {
      ctx.fillStyle = "rgba(20,15,40,.38)"; ctx.fillRect(0, 0, W, H);
      [[716, 280], [400, 330]].forEach(([x, y], i) => { const g = ctx.createRadialGradient(x, y, 2, x, y, 110); g.addColorStop(0, "rgba(255,200,100,.35)"); g.addColorStop(1, "rgba(255,200,100,0)"); ctx.fillStyle = g; ctx.fillRect(x - 110, y - 110, 220, 220); emo(ctx, "🕯️", x, y, 20 + Math.sin(S.time * 9 + i)); });
    }
    drawAwning(ctx);
    drawParts(ctx);
  }

  function update(dt) {
    dt = Math.min(dt || 0, 0.25);
    S.time += dt;
    S.doorOpen = Math.max(0, S.doorOpen - dt * 1.2); S.bell = Math.max(0, S.bell - dt * 1.5);
    S.keeper.hop = Math.max(0, S.keeper.hop - dt * 2.5); S.keeper.wave = Math.max(0, S.keeper.wave - dt);
    for (const c of S.customers) stepCustomer(c, dt);
    S.customers = S.customers.filter(c => { if (c.gone) delete S.cidMap[c.cid]; return !c.gone; });
    for (const c of S.customers) if (c.sad > 0 && !(c.cur && c.cur.k === "sad")) c.sad -= dt * 0.6;
    updCat(dt);
    // çırak rafla kasa arasında dolaşır
    const h = S.helper; h.t -= dt;
    if (h.t <= 0) { h.tx = 250 + Math.random() * 300; h.t = 3 + Math.random() * 4; }
    h.x += Math.sign(h.tx - h.x) * Math.min(Math.abs(h.tx - h.x), 60 * dt);
    updParts(dt);
  }

  // ---------- olaylar ----------
  function handle(ev) {
    if (!ev || !ev.type) return;
    switch (ev.type) {
      case "customerEnter": { const c = custOf(ev.cid, ev.look); if (Math.random() < .3) S.keeper.wave = 1; void c; break; }
      case "customerBuy": {
        const c = custOf(ev.cid);
        c.think = c.think || productEmoji(ev.productId);
        c.q.push({ k: "walk", x: standX(ev.productId) }, { k: "wait", d: 0.35 }, { k: "grab", pid: ev.productId, amount: ev.amount || 0 });
        break;
      }
      case "customerMiss": {
        const c = custOf(ev.cid);
        c.think = ev.productId ? productEmoji(ev.productId) : "❓";
        c.q.push({ k: "walk", x: standX(ev.productId) }, { k: "wait", d: 0.3 }, { k: "sad" });
        break;
      }
      case "customerLeave": {
        const c = S.cidMap[ev.cid]; if (!c) break;
        if (ev.happy === false) c.happy = false;
        if (c.carried.length || c.q.some(a => a.k === "grab")) {
          c.q.push({ k: "walk", x: 700 + (hash(c.cid) % 30) }, { k: "pay" });
        }
        c.q.push({ k: "leave" });
        break;
      }
      case "restock": {
        const sl = slotFor(ev.productId);
        if (sl) { spawnFly("📦", L.door.x, 300, sl.x, sl.y - 20); floaty("+" + (ev.qty || 0) + " " + productEmoji(ev.productId), sl.x, sl.y - 50, C.blue, 18); }
        break;
      }
      case "tip": floaty("+₺" + (ev.amount || 0) + " bahşiş 💝", 746, 240, "#e0607e", 18); hearts(760, 270, 3); break;
      case "goalDone": confetti(80); floaty("Hedef tamam! 🎯", W / 2, 200, "#e3502c", 30); break;
      case "bubbleSpawn": if (ev.bubble && ev.bubble.zone === "cat") { S.cat.alert = 2; if (S.cat.st === "sleep") { S.cat.st = "sit"; S.cat.t = 4; } } break;
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

  const Render = {
    zones,
    init(canvasEl) {
      S.canvas = canvasEl; S.ctx = canvasEl.getContext("2d");
      canvasEl.style.width = canvasEl.style.width || "100%";
      if (!canvasEl.style.aspectRatio) canvasEl.style.aspectRatio = W + " / " + H;
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
      S.bw = 0; draw();
    },
    get view() { return { x0: S.view.x0, x1: S.view.x1 }; },
    setDay(plan, state) {
      S.mode = "day"; S.customers = []; S.cidMap = {}; S.parts = [];
      applyPlan(plan, state);
      S.cat.st = "sit"; S.cat.t = 2; S.doorOpen = 1; S.bell = 1;
    },
    idle(state, phase, plan) {
      S.mode = "idle"; S.phase = phase || "morning"; S.state = state || S.state;
      if (plan) S.plan = plan;
      S.customers.forEach(c => { if (!c.leaving) { c.q = [{ k: "leave" }]; c.cur = null; } });
      applyPlan(S.plan, S.state);
    },
    refresh() { readUpgrades(); },       // yükseltme/ürün alınca sahneyi güncelle
    handle, update, draw,
    confetti, floaty,
    _S: S
  };
  global.Render = Render;
})(typeof window !== "undefined" ? window : globalThis);
