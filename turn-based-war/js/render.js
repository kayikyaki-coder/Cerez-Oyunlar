// render.js — canvas çizimi, piksel->hex dönüşümü, animasyon döngüsü
// Grafik ajanının art.js'i varsa (drawTile/drawPortrait/drawFx/drawFloatText) onu kullanır;
// yoksa eldeki basit çizimlere zarifçe düşer.

let ctx = null;
let canvasEl = null;
let renderLoopStarted = false;

function initCanvas() {
  canvasEl = document.getElementById("board");
  const dpr = window.devicePixelRatio || 1;
  canvasEl.width = State.width * dpr;
  canvasEl.height = State.height * dpr;
  canvasEl.style.width = State.width + "px";
  canvasEl.style.height = State.height + "px";
  ctx = canvasEl.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
}

// Harita boyutuna ve mevcut ekran alanına göre en büyük hex size'ı hesaplar (min 22, max 40)
// ve State.size/margin/originX/originY/width/height'ı günceller. initCanvas()'tan ÖNCE çağrılır.
function layoutBoard() {
  if (!State.cols || !State.rows) return;
  const panelEl = document.getElementById("panel");
  const panelW = panelEl ? panelEl.offsetWidth : 300;
  const isNarrow = window.innerWidth < 860; // panel altta yığılıyorsa (bkz. CSS media query)
  const availW = Math.max(260, window.innerWidth - (isNarrow ? 40 : panelW + 90));
  const availH = Math.max(260, window.innerHeight - 210);
  const margin = 10;
  const cols = State.cols, rows = State.rows;
  // Genişlik gereksinimi (bkz. engine.js setupBattle notu): margin + size + size*SQRT3*cols + margin.
  const sizeW = (availW - margin * 2) / (1 + SQRT3 * cols);
  const sizeH = (availH - margin * 2) / (1.5 * (rows - 1) + 2);
  let size = Math.floor(Math.min(sizeW, sizeH));
  size = Math.max(22, Math.min(40, size || 24));

  State.size = size;
  State.margin = margin;
  State.originX = margin + size;
  State.originY = margin + size;
  State.width = Math.ceil(State.originX + size * SQRT3 * cols + margin);
  State.height = Math.ceil(State.originY + size * 1.5 * (rows - 1) + size + margin);
}

// Pencere yeniden boyutlanınca tahtayı yeniden hesapla (savaş ekranı açıkken)
let boardResizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(boardResizeTimer);
  boardResizeTimer = setTimeout(() => {
    const appEl = document.getElementById("app");
    if (!appEl || appEl.style.display === "none" || !ctx) return;
    layoutBoard();
    initCanvas();
    draw();
  }, 150);
});

// sürekli redraw döngüsü — birim idle animasyonu + fx/floattext zamanlaması için
// Sekme gizliyken (document.hidden) rAF zincirini TAMAMEN durdurur (CPU/pil tasarrufu, madde 2);
// sekme tekrar görünür olunca otomatik devam eder. Tüm sürekli rAF döngüleri bunu kullanır.
function pausableRAF(fn) {
  function tick() {
    if (document.hidden) {
      const resume = () => { if (!document.hidden) { document.removeEventListener("visibilitychange", resume); requestAnimationFrame(tick); } };
      document.addEventListener("visibilitychange", resume);
      return;
    }
    fn();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function startRenderLoop() {
  if (renderLoopStarted) return;
  renderLoopStarted = true;
  pausableRAF(() => {
    // Ağır işi (pruneFx/draw) yalnızca savaş ekranı gerçekten aktifken yap — ekran değişince
    // rAF zinciri kendisi durmaz (sürekli açık kalır) ama burada hiçbir iş yapmadan döner.
    if (ctx && document.getElementById("app") && document.getElementById("app").style.display !== "none") {
      pruneFx();
      draw();
    }
  });
}
function pruneFx() {
  const now = performance.now();
  if (State.fx && State.fx.length) State.fx = State.fx.filter(f => now - f.start < f.dur);
  if (State.floatTexts && State.floatTexts.length) State.floatTexts = State.floatTexts.filter(f => now - f.start < f.dur);
}

function pixelToHex(px, py) {
  let best = null, bd = 1e9;
  for (let r = 0; r < State.rows; r++) {
    for (let q = 0; q < State.cols; q++) {
      const c = hexCenter(q, r);
      const dx = px - c.x, dy = py - c.y;
      const dd = dx * dx + dy * dy;
      if (dd < bd) { bd = dd; best = { q, r }; }
    }
  }
  if (best && bd <= (State.size * 0.98) * (State.size * 0.98)) return best;
  return null;
}

function fillHexPath(cx, cy, size) {
  const p = hexCorners(cx, cy, size);
  ctx.beginPath();
  ctx.moveTo(p[0][0], p[0][1]);
  for (let i = 1; i < 6; i++) ctx.lineTo(p[i][0], p[i][1]);
  ctx.closePath();
}

const TERRAIN_FALLBACK_COLOR = {
  ground: null, road: "#3a3226", forest: "#123a17", rough: "#3a3220",
  water: "#173a52", wall: "#2b2f36", bridge: "#4a3b26", hazard: "#4a1616", shrine: "#3a3a12"
};

function draw() {
  if (!ctx) return;
  ctx.clearRect(0, 0, State.width, State.height);

  // Kritik isabette hafif ekran sarsıntısı (State.shakeUntil engine.js'te ayarlanır)
  const shaking = State.shakeUntil && performance.now() < State.shakeUntil;
  ctx.save();
  if (shaking) {
    const mag = 2.5;
    ctx.translate((Math.random() * 2 - 1) * mag, (Math.random() * 2 - 1) * mag);
  }

  const u = cur();
  const hasArt = (typeof drawTile === "function");

  // 1) zemin hexleri
  for (let r = 0; r < State.rows; r++) {
    for (let q = 0; q < State.cols; q++) {
      const c = hexCenter(q, r);
      const tId = (State.terrain && State.terrain.size) ? terrainIdAt(q, r) : (State.blocked.has(key(q, r)) ? "wall" : "ground");
      if (hasArt) {
        try { drawTile(ctx, tId, State.biome || "forest", c.x, c.y, State.size, q, r); continue; } catch (e) { /* düş */ }
      }
      fillHexPath(c.x, c.y, State.size - 1);
      const fb = TERRAIN_FALLBACK_COLOR[tId];
      ctx.fillStyle = fb || (((q + r) % 2 === 0) ? "#1a2a1c" : "#173018");
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#0c140d";
      ctx.stroke();
      if (tId === "wall") drawRock(c.x, c.y);
    }
  }

  // 2) hareket menzili (yeşil) + hover'daki hex'e noktalı yol + AP/maliyet etiketi
  if (State.mode === "move") {
    for (const [k] of State.reachable) {
      const parts = k.split(",");
      const c = hexCenter(parseInt(parts[0], 10), parseInt(parts[1], 10));
      fillHexPath(c.x, c.y, State.size - 2);
      ctx.fillStyle = "rgba(87,201,106,0.28)";
      ctx.fill();
      ctx.strokeStyle = "rgba(87,201,106,0.7)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    if (u && State.hoverHex) {
      const hk = key(State.hoverHex.q, State.hoverHex.r);
      if (State.reachable.has(hk)) {
        const from = hexCenter(u.q, u.r), to = hexCenter(State.hoverHex.q, State.hoverHex.r);
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = "rgba(255,255,255,0.75)";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
        ctx.restore();
        const cost = State.reachable.get(hk);
        const allow = moveAllowance(u);
        ctx.fillStyle = "#0c0c12"; ctx.fillRect(to.x - 20, to.y - 8, 40, 14);
        ctx.fillStyle = "#f5d23e"; ctx.font = "bold 10px sans-serif"; ctx.textAlign = "center";
        ctx.fillText("1 AP · " + cost + "/" + allow, to.x, to.y + 3);
      }
    }
  }

  // 3) hedefler (kırmızı=düşman menzilde, gri=düşman menzil dışı, mavi=dost)
  if (State.mode === "attack" || State.mode === "heal" || State.mode === "spell" || State.mode === "item" || State.mode === "ability") {
    let col = "#d9534f";
    if (State.mode === "heal") col = "#5aa9e6";
    if (State.mode === "spell" && State.pendingSpell) col = (State.pendingSpell.target === "enemy") ? "#d9534f" : "#5aa9e6";
    if (State.mode === "attack" && u) {
      for (const t of State.units) {
        if (t.dead || t.side === u.side) continue;
        if (State.targets.indexOf(t) >= 0) continue; // aşağıda kırmızı çizilecek
        const c = hexCenter(t.q, t.r);
        fillHexPath(c.x, c.y, State.size - 2);
        ctx.strokeStyle = "rgba(154,161,173,0.55)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    for (const t of State.targets) {
      const c = hexCenter(t.q, t.r);
      fillHexPath(c.x, c.y, State.size - 2);
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }

  // 4) hover vurgusu
  if (State.hoverHex) {
    const c = hexCenter(State.hoverHex.q, State.hoverHex.r);
    fillHexPath(c.x, c.y, State.size - 3);
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // 5) aktif birim halkası (sarı)
  if (u && !u.dead && State.phase !== "over") {
    const c = hexCenter(u.q, u.r);
    fillHexPath(c.x, c.y, State.size - 2);
    ctx.strokeStyle = "#f5d23e";
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  // 6) birimler
  for (const unit of State.units) {
    if (unit.dead) continue;
    drawUnit(unit);
  }

  // 7) fx (saldırı/büyü efektleri)
  if (State.fx && State.fx.length) {
    const now = performance.now();
    for (const fx of State.fx) {
      const t = Math.min(1, (now - fx.start) / fx.dur);
      const from = fx.from && fx.from.q != null ? hexCenter(fx.from.q, fx.from.r) : (fx.from && fx.from.x != null ? hexCenter(fx.from.x, fx.from.y) : null);
      const to = fx.to && fx.to.q != null ? hexCenter(fx.to.q, fx.to.r) : (fx.to && fx.to.x != null ? hexCenter(fx.to.x, fx.to.y) : null);
      if (typeof drawFx === "function") {
        try { drawFx(ctx, Object.assign({}, fx, { from: from || fx.from, to: to || fx.to }), t); continue; } catch (e) { /* düş */ }
      }
      drawFxFallback(fx, from, to, t);
    }
  }

  // 8) yüzen metinler
  if (State.floatTexts && State.floatTexts.length) {
    const now = performance.now();
    for (const ft of State.floatTexts) {
      const t = Math.min(1, (now - ft.start) / ft.dur);
      const c = hexCenter(ft.x, ft.y);
      if (typeof drawFloatText === "function") {
        try { drawFloatText(ctx, ft.text, c.x, c.y, ft.color, t); continue; } catch (e) { /* düş */ }
      }
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = ft.color || "#fff";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(ft.text, c.x, c.y - 30 - t * 20);
      ctx.globalAlpha = 1;
    }
  }

  ctx.restore(); // sarsıntı translate'ini kapat
}

function drawFxFallback(fx, from, to, t) {
  if (!from && !to) return;
  ctx.save();
  ctx.globalAlpha = 1 - t * 0.6;
  ctx.strokeStyle = fx.color || "#f5d23e";
  ctx.lineWidth = 3;
  if (from && to) {
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(from.x + (to.x - from.x) * Math.min(1, t * 2), from.y + (to.y - from.y) * Math.min(1, t * 2)); ctx.stroke();
  } else if (to) {
    ctx.beginPath(); ctx.arc(to.x, to.y, 14 * t, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

// drawUnitGlow (art.js) yoksa düşen basit gölge elipsi
function drawShadowFallback(c) {
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(c.x, c.y + 12, 13, 5, 0, 0, Math.PI * 2);
  ctx.fill();
}
function drawRock(cx, cy) {
  ctx.fillStyle = "#4a4f57";
  ctx.fillRect(cx - 9, cy - 3, 18, 10);
  ctx.fillRect(cx - 6, cy - 9, 12, 8);
  ctx.fillStyle = "#5c626b";
  ctx.fillRect(cx - 4, cy - 8, 5, 5);
  ctx.fillStyle = "#33373d";
  ctx.fillRect(cx - 9, cy + 5, 18, 2);
}

function drawUnit(unit) {
  const c = hexCenter(unit.q, unit.r);
  const isBoss = unit.ai === "boss" || unit.boss === true;

  if (typeof drawUnitGlow === "function") {
    try { drawUnitGlow(ctx, c.x, c.y, State.size, unit.side); }
    catch (e) { drawShadowFallback(c); }
  } else {
    drawShadowFallback(c);
  }

  const spr = (typeof Sprites !== "undefined") ? (Sprites[unit.sprite] || Sprites.wolf || Sprites.fighter) : null;
  const flip = unit.side !== "party"; // düşmanlar sola baksın (drawSpriteFrame/Tint kendi flip parametresiyle çevirir)
  let px = State.size >= 40 ? 4 : (State.size >= 28 ? 3 : 2);
  if (isBoss) px += 1; // boss'lar bir ölçek büyük çizilir
  const now = performance.now();
  let frame = idleFrameIndex();
  if (unit._atkAnimUntil && now < unit._atkAnimUntil) frame = "attack";
  const hurting = unit._hurtAnimUntil && now < unit._hurtAnimUntil;
  if (spr) {
    try {
      if (hurting && typeof drawSpriteTint === "function") {
        drawSpriteTint(ctx, spr, c.x, c.y, px, frame, flip, "#ffffff", 0.55);
      } else if (typeof drawSpriteFrame === "function") {
        drawSpriteFrame(ctx, spr, c.x, c.y, px, frame, flip);
      } else if (typeof drawSpriteGrid === "function") {
        drawSpriteGrid(ctx, spr, c.x, c.y, px, flip);
      }
    } catch (e) {
      if (typeof drawSpriteGrid === "function") drawSpriteGrid(ctx, spr, c.x, c.y, px, flip);
    }
  } else {
    ctx.fillStyle = unit.side === "party" ? "#5aa9e6" : "#d9534f";
    ctx.fillRect(c.x - 10, c.y - 14, 20, 24);
  }

  if (unit.dead) return;

  const w = (isBoss ? 20 : 13) * px, h = Math.max(3, Math.round(px * 1.3));
  const bx = c.x - w / 2, by = c.y - 13 * px;
  ctx.fillStyle = "#0c0c12";
  ctx.fillRect(bx - 1, by - 1, w + 2, h + 2);
  ctx.fillStyle = "#3a1414";
  ctx.fillRect(bx, by, w, h);
  const frac = Math.max(0, unit.hp / unit.hpMax);
  ctx.fillStyle = unit.side === "party" ? "#57c96a" : "#d9534f";
  ctx.fillRect(bx, by, Math.round(w * frac), h);
  if (isBoss) {
    ctx.fillStyle = "#f5d23e";
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(unit.name, c.x, by - 4);
  }

  // yan işareti (mavi=ekip / kırmızı=düşman) — px ile orantılı
  const mw = Math.max(3, Math.round(px * 1.3)), mh = Math.max(2, Math.round(px * 1));
  ctx.fillStyle = unit.side === "party" ? "#5aa9e6" : "#d9534f";
  ctx.fillRect(c.x - mw / 2, by - mh - 2, mw, mh);
}

// idle animasyon karesi (yaklaşık 2 FPS'te değişir)
function idleFrameIndex() {
  return Math.floor(performance.now() / 500) % 2;
}

// ---------- TAM EKRAN SAHNE CANVAS'LARI (başlık / kamp / son) + BÖLÜM AFİŞİ ----------
// Grafiğin art.js'i drawTitleScene/drawCampScene/drawEndingScene/drawChapterBanner sağlarsa kullanılır;
// yoksa canvas'lar boş kalır (arka plan CSS'ten gelir) — hiçbir zaman hata fırlatmaz.
let sceneStartTs = null;
const SCENE_FULLBG = [
  { screenId: "screen-title", canvasId: "titleCanvas", fn: "drawTitleScene" },
  { screenId: "screen-camp", canvasId: "campCanvas", fn: "drawCampScene" },
  { screenId: "screen-ending", canvasId: "endingCanvas", fn: "drawEndingScene" }
];
function resizeChapterBanner() {
  const el = document.getElementById("chapterBannerCanvas");
  if (!el) return;
  const box = el.parentElement;
  const w = box ? box.clientWidth : 600, h = box ? box.clientHeight : 170;
  if (w > 0 && h > 0) { el.width = w; el.height = h; }
}
// Ekran değişince (özellikle kampanya haritası) çağrılır — gizliyken clientWidth 0 kalır.
function resizeSceneCanvases() {
  for (const s of SCENE_FULLBG) {
    const el = document.getElementById(s.canvasId);
    if (!el) continue;
    el.width = window.innerWidth; el.height = window.innerHeight;
  }
  const storyEl = document.getElementById("storyCanvas");
  if (storyEl) { storyEl.width = window.innerWidth; storyEl.height = window.innerHeight; }
  resizeChapterBanner();
}
function initSceneCanvases() {
  sceneStartTs = performance.now();
  const fullBg = SCENE_FULLBG;
  resizeSceneCanvases();
  window.addEventListener("resize", resizeSceneCanvases);

  function frame() {
    const activeEl = document.querySelector(".screen.active");
    const t = (performance.now() - sceneStartTs) / 1000;
    if (activeEl) {
      const spec = fullBg.find(s => s.screenId === activeEl.id);
      if (spec && typeof window[spec.fn] === "function") {
        const el = document.getElementById(spec.canvasId);
        if (el) { try { window[spec.fn](el.getContext("2d"), el.width, el.height, t); } catch (e) { /* düş */ } }
      }
      if (activeEl.id === "screen-map" && typeof drawChapterBanner === "function") {
        const el = document.getElementById("chapterBannerCanvas");
        if (el && el.width > 0) {
          try {
            const chIdx = (typeof GameState !== "undefined" && GameState) ? GameState.chapterIndex : 0;
            drawChapterBanner(el.getContext("2d"), el.width, el.height, chIdx, t);
          } catch (e) { /* düş */ }
        }
      }
      // Hikâye/diyalog ekranı: kampanya girişinde başlık sahnesi, diğer diyaloglarda bölüm afişi.
      if (activeEl.id === "screen-story") {
        const el = document.getElementById("storyCanvas");
        if (el) {
          const isIntro = (typeof dialogState !== "undefined" && dialogState && dialogState.scene === "intro");
          try {
            if (isIntro && typeof drawTitleScene === "function") drawTitleScene(el.getContext("2d"), el.width, el.height, t);
            else if (typeof drawChapterBanner === "function") {
              const chIdx = (typeof GameState !== "undefined" && GameState) ? GameState.chapterIndex : 0;
              drawChapterBanner(el.getContext("2d"), el.width, el.height, chIdx, t);
            }
          } catch (e) { /* düş */ }
        }
      }
    }
  }
  pausableRAF(frame);
}
