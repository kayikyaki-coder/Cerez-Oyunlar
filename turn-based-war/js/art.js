// art.js — arazi karoları (hex), diyalog portreleri, savaş efektleri, yüzen yazılar
// Tamamı prosedürel pixel-art; dosya/harici kaynak yok. hex.js'teki hexCorners kullanılır.

// ---------------------------------------------------------------------------
// BİYOM PALETİ
// bg: arena arka planı, ground: zemin tonları (3), road, rough, water, wall, canopy, trunk, edge (hex çizgisi)
// hazard: "fire" | "poison"   glow: vurgu rengi (UI vb. için)
// ---------------------------------------------------------------------------
const BIOME_PALETTE = {
  forest:  { bg: "#0d160f", ground: ["#2f5a2a", "#3a6a32", "#27502a"], dot: "#4e8a3c", road: ["#7a6a4a", "#8a7a56", "#6a5a3e"],
             rough: ["#40532c", "#4d6234"], roughDot: "#6f8a45", water: ["#254d78", "#2f5f8f"], wave: "#6aa8d8",
             wall: ["#5c6068", "#767b84", "#44484f"], canopy: ["#1f6b2a", "#2f8a3a", "#4aa84a"], trunk: "#5a3d22",
             edge: "#0f1f12", hazard: "fire", glow: "#8ee06a" },
  road:    { bg: "#14120e", ground: ["#5e6a3a", "#6a7842", "#556232"], dot: "#8a9a52", road: ["#8c7d5c", "#9c8d68", "#7a6d50"],
             rough: ["#6a6248", "#7a7254"], roughDot: "#9c9070", water: ["#2b5580", "#356697"], wave: "#78b2dc",
             wall: ["#6c6a64", "#868480", "#4e4c48"], canopy: ["#3d7a32", "#4d9a3e", "#68b854"], trunk: "#5a3d22",
             edge: "#1a1a12", hazard: "fire", glow: "#e0c070" },
  swamp:   { bg: "#0b120e", ground: ["#3a4a2a", "#44562f", "#2f3e24"], dot: "#5c7a3a", road: ["#5a5a44", "#6a6a50", "#4a4a38"],
             rough: ["#2d4a3a", "#356a48"], roughDot: "#4a9a5a", water: ["#2a4a3a", "#345c44"], wave: "#5aa070",
             wall: ["#4e5a50", "#66746a", "#3a4640"], canopy: ["#3a5e2a", "#4a7a34", "#5c9a3c"], trunk: "#3e3220",
             edge: "#0a1610", hazard: "poison", glow: "#7fe08a" },
  cave:    { bg: "#0a0a10", ground: ["#3a3742", "#44414d", "#312e39"], dot: "#5a5766", road: ["#5a5468", "#6a6478", "#4a4458"],
             rough: ["#2c2a34", "#38363f"], roughDot: "#6a6878", water: ["#1e2c4a", "#26385e"], wave: "#5a80c0",
             wall: ["#4a4756", "#66627a", "#33303e"], canopy: ["#5a3e8a", "#7a52b0", "#a070d8"], trunk: "#8a8aa0",
             edge: "#08080e", hazard: "fire", glow: "#a988e8" },
  ruins:   { bg: "#111014", ground: ["#4e5a3c", "#5a6846", "#445034"], dot: "#748a54", road: ["#7a7a72", "#8c8c84", "#66665e"],
             rough: ["#5c5a52", "#6c6a60"], roughDot: "#8c8a80", water: ["#2a4a66", "#345a7a"], wave: "#6aa0c8",
             wall: ["#7a7568", "#9a9486", "#585448"], canopy: ["#3e7030", "#4e8a3c", "#6aa84e"], trunk: "#5a3d22",
             edge: "#141418", hazard: "fire", glow: "#d0c8a0" },
  crypt:   { bg: "#0a080e", ground: ["#2e2a38", "#383244", "#26222f"], dot: "#4a4460", road: ["#524c62", "#605a72", "#443e54"],
             rough: ["#2a2634", "#34303f"], roughDot: "#5a5470", water: ["#1a2a3a", "#223648"], wave: "#4a7a90",
             wall: ["#4a4458", "#645c74", "#332e40"], canopy: ["#3c3050", "#4e3f68", "#665484"], trunk: "#2a2430",
             edge: "#08060c", hazard: "poison", glow: "#b08aff" },
  snow:    { bg: "#0f1420", ground: ["#c8d4e0", "#d8e2ec", "#b8c6d4"], dot: "#eef4f8", road: ["#8a8e96", "#9a9ea6", "#7a7e86"],
             rough: ["#a8b8c8", "#b8c8d8"], roughDot: "#e8f0f8", water: ["#2a4a72", "#34588a"], wave: "#a0d0f0",
             wall: ["#6c7480", "#8a929e", "#4e565f"], canopy: ["#1e5030", "#2c6a40", "#e8f0f8"], trunk: "#4a3020",
             edge: "#7c8a9a", hazard: "fire", glow: "#a0e0ff" },
  castle:  { bg: "#0e0e14", ground: ["#5c5c66", "#686874", "#50505a"], dot: "#7c7c88", road: ["#8a7a5a", "#9a8a66", "#7a6a4e"],
             rough: ["#4a4a54", "#56565f"], roughDot: "#6c6c78", water: ["#22405e", "#2a4e72"], wave: "#6a9ac8",
             wall: ["#6e6c78", "#8c8a98", "#4c4a56"], canopy: ["#3a6e32", "#4a883c", "#62a850"], trunk: "#5a3d22",
             edge: "#0c0c14", hazard: "fire", glow: "#e0b050" },
  village: { bg: "#12120e", ground: ["#5e7a3a", "#6c8a44", "#527034"], dot: "#8aa856", road: ["#a08a60", "#b09a6c", "#8c7852"],
             rough: ["#7a6a48", "#8a7a56"], roughDot: "#a89870", water: ["#2e5a86", "#3a6c9e"], wave: "#88c0e8",
             wall: ["#8a7660", "#a8927a", "#66584a"], canopy: ["#3e8a34", "#52a842", "#74c85a"], trunk: "#5a3d22",
             edge: "#181810", hazard: "fire", glow: "#f0d080" }
};

// deterministik hash (q, r, tuz) → 0..1
function tileHash(q, r, salt) {
  let h = (q * 374761393 + r * 668265263 + (salt || 0) * 982451653) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return ((h >>> 0) % 10007) / 10007;
}

function hexPathOn(ctx, cx, cy, size) {
  const p = hexCorners(cx, cy, size);
  ctx.beginPath();
  ctx.moveTo(p[0][0], p[0][1]);
  for (let i = 1; i < 6; i++) ctx.lineTo(p[i][0], p[i][1]);
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// drawTile — bir hex karo. size = hex yarıçapı. Kendi hex yolunu çizer ve kırpar.
// ---------------------------------------------------------------------------
function drawTile(ctx, terrainId, biome, cx, cy, size, q, r) {
  const P = BIOME_PALETTE[biome] || BIOME_PALETTE.forest;
  q = q | 0; r = r | 0;
  const u = Math.max(2, Math.floor(size / 8)); // piksel birimi
  const h1 = tileHash(q, r, 1), h2 = tileHash(q, r, 2), h3 = tileHash(q, r, 3);
  const X = Math.round(cx), Y = Math.round(cy);
  const px = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(X + x * u), Math.round(Y + y * u), Math.ceil(w * u), Math.ceil(h * u)); };
  const W = Math.floor(size * 0.85 / u), H = Math.floor(size * 0.95 / u); // yarım genişlik/yükseklik (birim)

  ctx.save();
  hexPathOn(ctx, cx, cy, size - 0.5);
  ctx.clip();

  // --- taban ---
  const isWater = terrainId === "water" || terrainId === "bridge";
  const base = isWater ? P.water : (terrainId === "road" ? P.road : (terrainId === "rough" ? P.rough : P.ground));
  ctx.fillStyle = base[Math.floor(h1 * base.length) % base.length];
  ctx.fillRect(X - size, Y - size, size * 2, size * 2);

  // --- dokular ---
  if (terrainId === "ground") {
    // 3-5 rastgele doku pikseli (çim/taş)
    const n = 3 + Math.floor(h2 * 3);
    for (let i = 0; i < n; i++) {
      const hx = tileHash(q, r, 10 + i), hy = tileHash(q, r, 20 + i);
      const sx = Math.floor((hx * 2 - 1) * W), sy = Math.floor((hy * 2 - 1) * (H - 1));
      px(sx, sy, 1, 1, (i % 2) ? P.dot : base[(Math.floor(h1 * 3) + 1) % 3]);
      if (i === 0) px(sx + 1, sy, 1, 1, base[(Math.floor(h1 * 3) + 2) % 3]);
    }
    // geniş, düşük kontrastlı leke (tekdüzeliği kırar)
    if (h3 > 0.62) { const bx = Math.floor((tileHash(q, r, 71) * 2 - 1) * (W - 3)), by = Math.floor((tileHash(q, r, 72) * 2 - 1) * (H - 3));
      px(bx - 2, by - 1, 5, 3, base[(Math.floor(h1 * 3) + 2) % 3]); px(bx - 1, by - 2, 3, 1, base[(Math.floor(h1 * 3) + 2) % 3]); px(bx - 1, by + 2, 3, 1, base[(Math.floor(h1 * 3) + 2) % 3]); }
    drawGroundDecor(px, P, biome, q, r, W, H, u, X, Y, ctx);
  } else if (terrainId === "road") {
    // patika: yatay hafif bant + taşlar
    px(-W, -1, W * 2, 1, P.road[1]);
    for (let i = 0; i < 3; i++) {
      const hx = tileHash(q, r, 30 + i), hy = tileHash(q, r, 40 + i);
      px(Math.floor((hx * 2 - 1) * (W - 1)), Math.floor((hy * 2 - 1) * (H - 2)), 2, 1, P.road[2]);
    }
    px(Math.floor((h3 * 2 - 1) * (W - 2)), 1, 1, 1, P.road[1]);
  } else if (terrainId === "rough") {
    // moloz / bataklık otu / kar yığını
    for (let i = 0; i < 5; i++) {
      const hx = tileHash(q, r, 50 + i), hy = tileHash(q, r, 60 + i);
      const sx = Math.floor((hx * 2 - 1) * (W - 1)), sy = Math.floor((hy * 2 - 1) * (H - 1));
      if (biome === "swamp" || biome === "forest" || biome === "village") {
        px(sx, sy, 1, 2, P.roughDot); px(sx + 1, sy + 1, 1, 1, P.roughDot); // ot püskülü
      } else {
        px(sx, sy, 2, 1, P.roughDot); px(sx, sy + 1, 1, 1, P.rough[0]); // taş
      }
    }
    if (biome === "swamp") { px(-2, 2, 4, 1, P.water[1]); px(-1, 3, 2, 1, P.water[0]); }
    if (biome === "cave" || biome === "crypt" || biome === "ruins" || biome === "castle") { px(-W, -H, W * 2, H * 2, "rgba(0,0,0,0.12)"); for (let i = 0; i < 3; i++) { const hx = tileHash(q, r, 80 + i), hy = tileHash(q, r, 90 + i); px(Math.floor((hx * 2 - 1) * (W - 2)), Math.floor((hy * 2 - 1) * (H - 2)), 3, 2, P.wall[2]); px(Math.floor((hx * 2 - 1) * (W - 2)), Math.floor((hy * 2 - 1) * (H - 2)) - 1, 2, 1, P.wall[1]); } }
  } else if (terrainId === "water") {
    // dalga çizgileri
    const off = Math.floor(h1 * 3) - 1;
    px(-3 + off, -2, 3, 1, P.wave); px(1 + off, -2, 1, 1, P.wave);
    px(-1 - off, 1, 3, 1, P.wave); px(3 - off, 1, 1, 1, P.wave);
    px(-4 + off, 3, 2, 1, P.water[1] === P.water[0] ? P.wave : P.water[1]);
    if (biome === "swamp") { px(2, -1, 1, 1, "#7fe08a"); px(-3, 2, 1, 1, "#5fb070"); }
    // kıyı köpüğü: hex kenarı boyunca açık halka + koyu derinlik ortası
    ctx.save(); hexPathOn(ctx, cx, cy, size - 0.5); ctx.lineWidth = Math.max(2, u); ctx.strokeStyle = P.wave; ctx.globalAlpha = 0.28; ctx.stroke(); ctx.restore();
    ctx.save(); ctx.globalAlpha = 0.18; ctx.fillStyle = "#000000"; ctx.beginPath(); ctx.arc(X, Y, size * 0.45, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  } else if (terrainId === "forest") {
    drawTree(px, P, biome, h1, h2, W, H);
  } else if (terrainId === "wall") {
    drawWall(px, P, biome, h1, h2, u, size, X, Y, ctx);
  } else if (terrainId === "bridge") {
    // su üstünde kalaslar
    px(-W, -2, W * 2, 1, P.wave);
    const wood = ["#8a6a40", "#a07c4a", "#6e5230"];
    for (let y = -H + 1; y < H; y += 2) {
      px(-W, y, W * 2, 2, wood[(y + H) % 2]);
      px(-W, y + 1, W * 2, 1, wood[2]);
    }
    px(-W, -H + 1, 1, H * 2, wood[2]); px(W - 1, -H + 1, 1, H * 2, wood[2]);
    px(-2, -1, 1, 1, wood[1]); px(2, 2, 1, 1, wood[1]);
  } else if (terrainId === "hazard") {
    drawHazard(px, P, h1, h2, W, H);
  } else if (terrainId === "shrine") {
    drawShrine(px, P, biome, u, size, X, Y, ctx);
  }

  ctx.restore();

  // --- hex kenarı ---
  hexPathOn(ctx, cx, cy, size - 0.5);
  ctx.lineWidth = 1;
  ctx.strokeStyle = P.edge;
  ctx.stroke();
}

function drawTree(px, P, biome, h1, h2, W, H) {
  const C = P.canopy;
  const x = Math.floor((h1 * 2 - 1) * 1.2), y = 0;
  const shadow = "rgba(0,0,0,0.28)";
  if (biome === "cave") {
    // büyük mantar kümesi
    px(x - 4, y + 3, 9, 1, shadow);
    px(x - 1, y, 2, 4, P.trunk); px(x + 3, y + 1, 1, 3, P.trunk); px(x - 4, y + 2, 1, 2, P.trunk);
    px(x - 4, y - 3, 8, 3, C[1]); px(x - 3, y - 4, 6, 1, C[1]); px(x - 2, y - 5, 4, 1, C[2]); px(x - 4, y - 1, 8, 1, C[0]);
    px(x + 2, y - 1, 4, 2, C[1]); px(x + 3, y - 2, 2, 1, C[2]); px(x - 5, y, 3, 2, C[1]); px(x - 5, y - 1, 2, 1, C[2]);
    px(x - 2, y - 3, 1, 1, "#e8d8ff"); px(x + 1, y - 4, 1, 1, "#e8d8ff"); px(x - 1, y - 2, 1, 1, "#e8d8ff"); px(x + 4, y - 1, 1, 1, "#e8d8ff");
    return;
  }
  if (biome === "crypt" || (biome === "ruins" && h2 > 0.6)) {
    // büyük ölü ağaç
    const b = P.trunk === "#2a2430" ? "#4a4058" : "#5a4a36";
    px(x - 3, y + 4, 7, 1, shadow);
    px(x - 1, y - 2, 2, 7, b); px(x, y - 6, 1, 4, b);
    px(x - 4, y - 3, 3, 1, b); px(x - 5, y - 4, 1, 1, b); px(x - 3, y - 5, 1, 2, b);
    px(x + 1, y - 4, 3, 1, b); px(x + 4, y - 5, 1, 1, b); px(x + 3, y - 6, 1, 1, b); px(x + 2, y - 2, 2, 1, b);
    px(x - 2, y - 7, 1, 1, b); px(x + 1, y - 7, 1, 1, b); px(x, y - 8, 1, 2, b);
    if (biome === "crypt") { px(x + 2, y - 3, 1, 1, "#40e0a0"); }
    return;
  }
  if (biome === "snow") {
    // büyük karlı çam
    px(x - 3, y + 4, 7, 1, shadow);
    px(x, y + 2, 1, 3, P.trunk);
    px(x - 4, y + 1, 9, 1, C[0]); px(x - 5, y + 1, 1, 1, C[2]); px(x + 4, y + 1, 1, 1, C[2]);
    px(x - 3, y - 1, 7, 2, C[1]); px(x - 3, y - 1, 2, 1, C[2]); px(x + 2, y - 1, 2, 1, C[2]);
    px(x - 2, y - 3, 5, 2, C[1]); px(x - 2, y - 3, 1, 1, C[2]); px(x + 1, y - 3, 2, 1, C[2]);
    px(x - 1, y - 5, 3, 2, C[1]); px(x - 1, y - 5, 3, 1, C[2]); px(x, y - 6, 1, 1, C[2]);
    return;
  }
  // büyük yaprak ağaç (+ yanında küçük ikinci ağaç)
  px(x - 4, y + 4, 9, 1, shadow);
  px(x - 1, y + 1, 2, 4, P.trunk); px(x - 1, y + 1, 1, 4, shade(P.trunk, 18));
  px(x - 4, y - 2, 9, 3, C[0]);
  px(x - 3, y - 4, 7, 2, C[1]); px(x - 3, y, 7, 1, C[1]);
  px(x - 2, y - 5, 5, 1, C[1]); px(x - 1, y - 6, 3, 1, C[1]);
  px(x - 2, y - 4, 2, 1, C[2]); px(x, y - 5, 1, 1, C[2]); px(x + 1, y - 3, 1, 1, C[2]); px(x - 3, y - 2, 1, 1, C[2]);
  px(x - 4, y + 1, 9, 1, shade(C[0], -18));
  if (h2 > 0.5) { px(x + 4, y + 3, 1, 2, P.trunk); px(x + 3, y + 1, 3, 2, C[0]); px(x + 3, y, 3, 1, C[1]); px(x + 4, y - 1, 1, 1, C[2]); }
  else { px(x - 6, y + 3, 1, 2, P.trunk); px(x - 7, y + 1, 3, 2, C[0]); px(x - 7, y, 3, 1, C[1]); px(x - 6, y - 1, 1, 1, C[2]); }
}

function drawWall(px, P, biome, h1, h2, u, size, X, Y, ctx) {
  const Wc = P.wall;
  const w = Math.floor(size * 0.8 / u), h = Math.floor(size * 0.85 / u);
  const brick = (biome === "castle" || biome === "crypt" || biome === "ruins");
  if (brick) {
    // yükseltilmiş taş blok: üst yüz açık, ön yüz tuğlalı, alt gölge
    const top = -h, mid = -Math.floor(h * 0.35);
    px(-w, mid, w * 2, h - mid, Wc[2]);                       // ön yüz zemini
    px(-w, top, w * 2, mid - top, Wc[1]);                      // üst yüz
    px(-w + 1, top + 1, w * 2 - 2, 1, "rgba(255,255,255,0.18)");
    px(-w, mid, w * 2, 1, "rgba(0,0,0,0.35)");                 // üst/ön ayrımı
    for (let y = mid + 1; y < h - 1; y += 2) {
      const off = ((y - mid) / 2) % 2 ? 1 : 0;
      for (let x = -w + off; x < w; x += 3) px(x, y, 2, 1, Wc[0]);
      px(-w + off + (Math.floor(h1 * 3) % 3) * 3 + 1, y, 1, 1, Wc[1]);
    }
    px(-w, h - 1, w * 2, 1, "rgba(0,0,0,0.5)");                // alt gölge
    px(-w, top, 1, h - top, "rgba(255,255,255,0.10)"); px(w - 1, top, 1, h - top, "rgba(0,0,0,0.3)");
    if (biome === "ruins") { px(w - 4, top, 4, 3, P.ground[0]); px(-w, top, 2, 2, P.ground[1]); px(-w + 3, h - 3, 2, 2, P.ground[1]); px(2, mid - 1, 2, 1, "#5a8a3a"); }
    if (biome === "crypt") { const c = tileHash(q0(h1), 0, 3); if (c > 0.5) { px(1, top + 1, 1, 1, "#40e0a0"); } }
    if (biome === "castle" && h2 > 0.7) { px(-1, top - 3, 1, 3, "#5a3d22"); px(0, top - 4, 1, 1, "#ffb020"); px(-1, top - 4, 1, 1, "#ffe070"); px(-1, top - 3, 2, 1, "#e85a1a"); }
    return;
  }
  // kaya kümesi (orman/yol/mağara/bataklık/kar/köy)
  const dx = Math.floor((h1 * 2 - 1) * 1.2);
  px(dx - 4, 2, 9, 1, "rgba(0,0,0,0.45)");
  px(dx - 4, -1, 9, 4, Wc[0]);
  px(dx - 3, -3, 6, 3, Wc[0]);
  px(dx - 2, -4, 3, 1, Wc[1]);
  px(dx - 3, -3, 3, 2, Wc[1]);
  px(dx + 2, -2, 2, 1, Wc[1]);
  px(dx - 4, 2, 9, 1, Wc[2]);
  px(dx + 3, 0, 2, 3, Wc[2]);
  px(dx - 1, 0, 1, 2, Wc[2]);
  if (biome === "snow") { px(dx - 3, -4, 5, 1, "#eef4f8"); px(dx - 4, -1, 2, 1, "#eef4f8"); }
  if (biome === "swamp" || biome === "forest") { px(dx - 4, 0, 2, 1, "#4a8a3a"); px(dx + 2, -3, 1, 1, "#4a8a3a"); }
  if (biome === "cave") { px(dx - 1, -2, 1, 1, "#8a78b8"); px(dx + 4, -5, 1, 2, "#a988e8"); px(dx + 5, -4, 1, 1, "#c8b0ff"); }
}
function q0(v) { return Math.floor(v * 1000); }

// Zemin dekoru: biyoma göre deterministik küçük nesneler (~%14 karo)
function drawGroundDecor(px, P, biome, q, r, W, H, u, X, Y, ctx) {
  const d = tileHash(q, r, 5);
  if (d < 0.86) return;
  const k = Math.floor(tileHash(q, r, 6) * 4);
  const ox = Math.floor((tileHash(q, r, 7) * 2 - 1) * (W - 4)), oy = Math.floor((tileHash(q, r, 8) * 2 - 1) * (H - 4));
  const O = "#15111a";
  const stone = () => { px(ox - 1, oy, 3, 2, P.wall[0]); px(ox - 1, oy, 2, 1, P.wall[1]); px(ox - 1, oy + 2, 3, 1, "rgba(0,0,0,0.35)"); };
  const bones = () => { px(ox - 2, oy, 5, 1, "#e0d8c0"); px(ox - 2, oy - 1, 1, 1, "#e0d8c0"); px(ox + 2, oy + 1, 1, 1, "#e0d8c0"); px(ox + 1, oy - 2, 2, 2, "#e8e0d0"); px(ox + 1, oy - 1, 1, 1, O); };
  const skull = () => { px(ox - 1, oy - 2, 3, 3, "#e8e0d0"); px(ox - 1, oy - 1, 1, 1, O); px(ox + 1, oy - 1, 1, 1, O); px(ox - 1, oy + 1, 3, 1, "#c8c0a8"); };
  const flowers = (c) => { px(ox, oy, 1, 1, c); px(ox + 2, oy - 1, 1, 1, c); px(ox - 2, oy + 1, 1, 1, c); px(ox, oy + 1, 1, 1, P.trunk === "#5a3d22" ? "#3a7a2a" : P.dot); };
  const stump = () => { px(ox - 1, oy - 1, 3, 3, "#5a3d22"); px(ox - 1, oy - 1, 3, 1, "#8a6a40"); px(ox, oy - 1, 1, 1, "#a07c4a"); };
  const mushroom = (c) => { px(ox, oy, 1, 2, "#d8d0c0"); px(ox - 1, oy - 1, 3, 1, c); px(ox, oy - 2, 1, 1, c); px(ox + 2, oy + 1, 1, 1, "#d8d0c0"); px(ox + 2, oy, 1, 1, c); };
  const crystal = () => { px(ox, oy - 3, 1, 4, "#a988e8"); px(ox - 1, oy - 1, 1, 2, "#7a52b0"); px(ox + 1, oy - 2, 1, 3, "#7a52b0"); px(ox, oy - 3, 1, 1, "#e8d8ff"); ctx.save(); ctx.globalAlpha = 0.15; ctx.fillStyle = "#a988e8"; ctx.beginPath(); ctx.arc(X + ox * u, Y + (oy - 1) * u, u * 3, 0, Math.PI * 2); ctx.fill(); ctx.restore(); };
  const candle = () => { px(ox, oy - 1, 1, 2, "#e8e0d0"); px(ox, oy - 2, 1, 1, "#ffb020"); px(ox, oy - 3, 1, 1, "#ffe070"); ctx.save(); ctx.globalAlpha = 0.18; ctx.fillStyle = "#ffb020"; ctx.beginPath(); ctx.arc(X + ox * u, Y + (oy - 2) * u, u * 3, 0, Math.PI * 2); ctx.fill(); ctx.restore(); };
  const puddle = () => { px(ox - 2, oy, 5, 2, P.water[1]); px(ox - 1, oy - 1, 3, 1, P.water[1]); px(ox - 1, oy, 2, 1, P.wave); };
  const reeds = () => { px(ox - 2, oy - 2, 1, 4, "#6a8a3a"); px(ox, oy - 3, 1, 5, "#6a8a3a"); px(ox + 2, oy - 1, 1, 3, "#6a8a3a"); px(ox, oy - 3, 1, 1, "#8a5a2b"); };
  const crack = () => { px(ox - 2, oy, 2, 1, "rgba(0,0,0,0.35)"); px(ox, oy - 1, 1, 1, "rgba(0,0,0,0.35)"); px(ox + 1, oy - 2, 2, 1, "rgba(0,0,0,0.35)"); px(ox, oy + 1, 1, 1, "rgba(0,0,0,0.35)"); };
  const hay = () => { px(ox - 2, oy - 1, 5, 3, "#c8a850"); px(ox - 1, oy - 2, 3, 1, "#c8a850"); px(ox - 1, oy - 1, 1, 1, "#e0c060"); px(ox + 1, oy, 1, 1, "#a08030"); };
  const post = () => { px(ox, oy - 3, 1, 5, "#6a4a2a"); px(ox - 2, oy - 2, 5, 1, "#8a6a40"); px(ox - 2, oy, 5, 1, "#8a6a40"); };
  const deadgrass = () => { px(ox - 1, oy, 1, 2, "#a89870"); px(ox + 1, oy - 1, 1, 3, "#a89870"); px(ox, oy - 1, 1, 1, "#c8b890"); };
  const banner = () => { px(ox, oy - 4, 1, 6, "#5a3d22"); px(ox + 1, oy - 4, 3, 3, "#8e2424"); px(ox + 1, oy - 1, 2, 1, "#8e2424"); px(ox + 2, oy - 3, 1, 1, "#f0c040"); };
  const sets = {
    forest: [stone, () => flowers("#e8e070"), stump, () => mushroom("#c84a3a")],
    road: [stone, () => flowers("#e8e070"), deadgrass, stump],
    swamp: [reeds, puddle, bones, () => mushroom("#7fb84a")],
    cave: [crystal, stone, bones, () => mushroom("#a070d8")],
    ruins: [stone, crack, bones, deadgrass],
    crypt: [bones, skull, candle, crack],
    snow: [stone, deadgrass, () => { px(ox - 1, oy, 3, 1, "#f4f8ff"); px(ox, oy - 1, 1, 1, "#f4f8ff"); }, stump],
    castle: [crack, stone, banner, () => flowers("#c8c8d8")],
    village: [hay, post, () => flowers("#f0a0c0"), stone]
  };
  const list = sets[biome] || sets.forest;
  list[k % list.length]();
}

function drawHazard(px, P, h1, h2, W, H) {
  if (P.hazard === "poison") {
    // zehir gölü
    px(-W, -H, W * 2, H * 2, "#2a4a2a");
    px(-4, -2, 8, 5, "#3f8a3a"); px(-3, -3, 5, 1, "#3f8a3a"); px(-5, 0, 1, 2, "#3f8a3a");
    px(-2, -1, 3, 2, "#6fd05a");
    px(Math.floor(h1 * 5) - 3, Math.floor(h2 * 3) - 1, 1, 1, "#c8ff90");
    px(2, 1, 1, 1, "#c8ff90"); px(-4, 2, 1, 1, "#9fe070");
    return;
  }
  // ateş
  px(-W, -H, W * 2, H * 2, "#3a1a0e");
  px(-4, 1, 9, 3, "#8a2a10");
  const f = Math.floor(h1 * 3);
  px(-3, -1, 7, 2, "#e85a1a");
  px(-2 + f, -3, 3, 2, "#e85a1a"); px(-1 + f, -4, 1, 1, "#e85a1a");
  px(-1, 0, 3, 2, "#ffb020"); px(0 + f, -2, 1, 2, "#ffb020");
  px(0, 1, 1, 1, "#fff0a0"); px(1 + f, -1, 1, 1, "#ffe070");
  px(3 - f, -2, 1, 1, "#e85a1a"); px(-4 + f, -1, 1, 1, "#e85a1a");
}

function drawShrine(px, P, biome, u, size, X, Y, ctx) {
  // taş kaide + parlayan rün
  const stone = ["#8a8fa0", "#b0b4c4", "#5c6070"];
  px(-4, 2, 9, 2, stone[2]);
  px(-3, 1, 7, 1, stone[0]);
  px(-2, -3, 5, 4, stone[0]);
  px(-2, -4, 5, 1, stone[1]);
  px(-2, -3, 1, 4, stone[1]);
  px(2, -3, 1, 4, stone[2]);
  // rün (ışıklı)
  const g = "#ffe27a", g2 = "#fff7c8";
  px(0, -3, 1, 3, g); px(-1, -2, 3, 1, g); px(0, -3, 1, 1, g2);
  // ışıma
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#ffe27a";
  ctx.beginPath(); ctx.arc(X, Y - u, size * 0.7, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  px(-4, -1, 1, 1, "#ffe27a"); px(4, -2, 1, 1, "#ffe27a"); px(3, 0, 1, 1, "#fff7c8");
}

// ---------------------------------------------------------------------------
// PORTRELER — 32×32 prosedürel büst. drawPortrait(ctx, id, x, y, size)
// ---------------------------------------------------------------------------
const PORTRAIT_DEFS = {
  narrator: { bg: ["#1a1626", "#2a2340"], skin: "#0e0a18", hair: "hood", hairCol: "#2c2540", hairCol2: "#1a1528", eyes: "#ffd23f", glow: true, cloth: "#241e36", cloth2: "#171226", shadow: true },
  fighter:  { bg: ["#2a1e1e", "#3a2828"], skin: "#f0b98c", hair: "helm", hairCol: "#b8c2d0", hairCol2: "#6b7583", eyes: "#3a2418", cloth: "#8a94a4", cloth2: "#5c6672", armor: true, plume: "#d43a3a", openHelm: true },
  // Boss büstleri (diyalog için)
  boss_wolf:   { bg: ["#1a1418", "#2a2028"], skin: "#4a4450", beast: "wolf", eyes: "#ff4a3a", cloth: "#3a3540", cloth2: "#25222b", furLight: "#8d8798", glow: true },
  boss_troll:  { bg: ["#14201a", "#1e2e24"], skin: "#6e8a3e", hair: "moss", hairCol: "#9fbf4a", hairCol2: "#4b6128", eyes: "#ffe75a", cloth: "#4e3a22", cloth2: "#2f2414", tusks: "#f4f0e0", wrinkles: true, brow: true },
  boss_knight: { bg: ["#16121e", "#221c2c"], skin: "#15111a", hair: "helm", hairCol: "#3a3546", hairCol2: "#242030", eyes: "#c05aff", glow: true, cloth: "#3a3546", cloth2: "#242030", armor: true, plume: "#8e2a2a", cape: "#5a1818" },
  boss_lich:   { bg: ["#0e1a14", "#142820"], skin: "#e8e0d0", hair: "crown", hairCol: "#f0c040", hairCol2: "#a67c1e", eyes: "#66ffb0", glow: true, cloth: "#2d1f4e", cloth2: "#1a1130", skull: true },
  cleric:   { bg: ["#1c2436", "#26324a"], skin: "#f0b98c", hair: "coif", hairCol: "#4a86d6", hairCol2: "#2f5b9c", eyes: "#3a2418", cloth: "#4a86d6", cloth2: "#2f5b9c", symbol: "#f4f4fa" },
  wizard:   { bg: ["#221a36", "#2e2450"], skin: "#f0b98c", hair: "wizhat", hairCol: "#5a3aa0", hairCol2: "#3b2470", eyes: "#3a2418", cloth: "#7f5bd0", cloth2: "#5a3aa0", beard: "#ece9f5", beardLong: true },
  villager: { bg: ["#2a2a1a", "#3a3a24"], skin: "#e9b587", hair: "bandana", hairCol: "#a04a3a", hairCol2: "#5a3418", eyes: "#3a2418", cloth: "#8a7a56", cloth2: "#5a4a34" },
  elder:    { bg: ["#262018", "#362e22"], skin: "#e5b590", hair: "bald", hairCol: "#d8d0c0", hairCol2: "#b0a898", eyes: "#3a2418", cloth: "#6a5a44", cloth2: "#4a3e30", beard: "#d8d0c0", beardLong: true, wrinkles: true },
  bandit:   { bg: ["#241c14", "#342a1e"], skin: "#d9a878", hair: "hood", hairCol: "#5c4a34", hairCol2: "#3e3222", eyes: "#3a2418", cloth: "#8a6a48", cloth2: "#5a4630", mask: "#4d8a4a", scar: true },
  witch:    { bg: ["#1a2418", "#243020"], skin: "#c8c8a8", hair: "witchhat", hairCol: "#1a1a22", hairCol2: "#2a2a34", eyes: "#7fe08a", glow: true, cloth: "#2c3a2a", cloth2: "#1a261a", longHair: "#3a2a44" },
  knight:   { bg: ["#1e1e26", "#2a2a36"], skin: "#f0b98c", hair: "helm", hairCol: "#9aa2b0", hairCol2: "#5c6472", eyes: "#3a2418", cloth: "#9aa2b0", cloth2: "#5c6472", armor: true, plume: "#4a86d6" },
  lich:     { bg: ["#0e1a14", "#142820"], skin: "#e8e0d0", hair: "crown", hairCol: "#f0c040", hairCol2: "#a67c1e", eyes: "#66ffb0", glow: true, cloth: "#2d1f4e", cloth2: "#1a1130", skull: true },
  merchant: { bg: ["#2a2214", "#3a2e1c"], skin: "#d9a878", hair: "turban", hairCol: "#c43a3a", hairCol2: "#7d2222", eyes: "#3a2418", cloth: "#a07c2a", cloth2: "#6a501a", mustache: "#3a2418", jewel: "#66e0ff" },
  child:    { bg: ["#22262e", "#2e3440"], skin: "#f5c8a0", hair: "short", hairCol: "#c88a3a", hairCol2: "#8a5a22", eyes: "#3a2418", cloth: "#6a8ab0", cloth2: "#4a6a90", small: true },
  guard:    { bg: ["#1c2020", "#28302e"], skin: "#e9b587", hair: "kettle", hairCol: "#7c8490", hairCol2: "#4e565f", eyes: "#3a2418", cloth: "#6a5a3a", cloth2: "#4a3e28", armor: true, mustache: "#5a3418" },
  priest:   { bg: ["#262420", "#36342c"], skin: "#e5b590", hair: "cowl", hairCol: "#f4f4fa", hairCol2: "#c9d3e0", eyes: "#3a2418", cloth: "#f4f4fa", cloth2: "#c9d3e0", symbol: "#e5b640" },
  unknown:  { bg: ["#141418", "#1e1e26"], skin: "#2a2a34", hair: "short", hairCol: "#2a2a34", hairCol2: "#2a2a34", eyes: "#2a2a34", cloth: "#2a2a34", cloth2: "#22222a", silhouette: true }
};

function drawPortrait(ctx, id, x, y, size) {
  const d = PORTRAIT_DEFS[id] || PORTRAIT_DEFS.unknown;
  const N = 32;
  const g = [];
  for (let i = 0; i < N; i++) g.push(new Array(N).fill(null));
  const R = (x0, y0, w, h, c) => { for (let yy = y0; yy < y0 + h; yy++) for (let xx = x0; xx < x0 + w; xx++) if (xx >= 0 && yy >= 0 && xx < N && yy < N) g[yy][xx] = c; };
  const O = "#15111a";

  // arka plan (köşegen doku)
  for (let yy = 0; yy < N; yy++) for (let xx = 0; xx < N; xx++) g[yy][xx] = ((xx + yy) % 6 === 0) ? d.bg[1] : d.bg[0];
  // vinyet
  R(0, 0, N, 1, "#0c0a12"); R(0, 0, 1, N, "#0c0a12"); R(N - 1, 0, 1, N, "#0c0a12"); R(0, N - 1, N, 1, "#0c0a12");

  const sm = d.small ? 2 : 0;         // çocuk: baş daha aşağı ve küçük
  const hy = 6 + sm;                  // baş üst
  const hx = 10, hw = 12, hh = 13 - sm;
  const skin = d.skin;

  // omuzlar / giysi
  R(4, 23, 24, 9, d.cloth); R(4, 23, 24, 1, O); R(4, 23, 1, 9, O); R(27, 23, 1, 9, O);
  R(6, 26, 4, 6, d.cloth2); R(22, 26, 4, 6, d.cloth2);
  if (d.cape) { R(4, 23, 4, 9, d.cape); R(24, 23, 4, 9, d.cape); }
  if (d.armor) { R(5, 24, 8, 3, d.cloth2); R(19, 24, 8, 3, d.cloth2); R(6, 25, 2, 1, "#e8eef5"); R(24, 25, 2, 1, "#e8eef5"); R(13, 24, 6, 8, d.cloth2); }
  if (d.symbol) { R(15, 26, 2, 5, d.symbol); R(14, 27, 4, 1, d.symbol); }
  // boyun
  R(13, 20 + sm, 6, 4, skin); R(12, 20 + sm, 1, 3, O); R(19, 20 + sm, 1, 3, O);
  // baş
  R(hx, hy, hw, hh, skin);
  R(hx, hy, 1, hh, O); R(hx + hw - 1, hy, 1, hh, O); R(hx, hy, hw, 1, O); R(hx, hy + hh - 1, hw, 1, O);
  R(hx, hy, 1, 1, d.bg[0]); R(hx + hw - 1, hy, 1, 1, d.bg[0]); R(hx, hy + hh - 1, 1, 1, d.bg[0]); R(hx + hw - 1, hy + hh - 1, 1, 1, d.bg[0]);
  R(hx + 1, hy + 1, 1, 1, O); R(hx + hw - 2, hy + 1, 1, 1, O); R(hx + 1, hy + hh - 2, 1, 1, O); R(hx + hw - 2, hy + hh - 2, 1, 1, O);
  // çene gölgesi
  R(hx + 2, hy + hh - 2, hw - 4, 1, shade(skin, -18));
  // gözler
  const ey = hy + 6 - (d.small ? 1 : 0);
  if (d.beast === "wolf") {
    // kurt başı: kulaklar, burun, dişler
    R(hx - 1, hy - 4, 3, 5, skin); R(hx + hw - 2, hy - 4, 3, 5, skin); R(hx, hy - 3, 1, 3, "#d88a9a"); R(hx + hw - 1, hy - 3, 1, 3, "#d88a9a");
    R(hx - 2, hy - 5, 1, 6, O); R(hx + hw + 1, hy - 5, 1, 6, O); R(hx - 1, hy - 5, 3, 1, O); R(hx + hw - 2, hy - 5, 3, 1, O);
    R(hx + 1, hy + 1, hw - 2, 4, d.furLight); // alın açık tüy
    R(hx + 2, ey, 3, 2, d.eyes); R(hx + 7, ey, 3, 2, d.eyes); R(hx + 3, ey, 1, 1, "#ffffff"); R(hx + 8, ey, 1, 1, "#ffffff");
    R(hx + 1, ey - 1, 4, 1, O); R(hx + 7, ey - 1, 4, 1, O); // çatık kaş
    R(hx + 3, ey + 3, 6, 5, shade(skin, 12)); R(hx + 3, ey + 3, 6, 1, shade(skin, -10)); // burun köprüsü
    R(hx + 4, ey + 3, 4, 2, O); // burun
    R(hx + 2, ey + 8, 8, 1, O); R(hx + 3, ey + 9, 1, 2, "#f2f4f6"); R(hx + 8, ey + 9, 1, 2, "#f2f4f6"); R(hx + 5, ey + 9, 2, 1, "#8e2424"); // dişler
    R(hx + 8, ey - 3, 1, 5, "#c93a4a"); // yara
  } else if (d.skull) {
    R(hx + 2, ey - 1, 3, 3, O); R(hx + 7, ey - 1, 3, 3, O);
    R(hx + 3, ey, 1, 1, d.eyes); R(hx + 8, ey, 1, 1, d.eyes);
    R(hx + 5, ey + 2, 2, 2, shade(skin, -30)); // burun deliği
    R(hx + 2, ey + 5, 8, 1, O); for (let i = 0; i < 4; i++) R(hx + 2 + i * 2, ey + 4, 1, 1, O);
  } else if (d.silhouette) {
    // hiç yüz yok
  } else {
    R(hx + 2, ey, 3, 2, "#ffffff"); R(hx + 7, ey, 3, 2, "#ffffff");
    R(hx + 3, ey, 1, 2, d.eyes); R(hx + 8, ey, 1, 2, d.eyes);
    if (d.glow) { R(hx + 2, ey, 3, 2, d.eyes); R(hx + 7, ey, 3, 2, d.eyes); R(hx + 3, ey, 1, 1, "#ffffff"); R(hx + 8, ey, 1, 1, "#ffffff"); }
    R(hx + 2, ey - 1, 3, 1, shade(skin, -25)); R(hx + 7, ey - 1, 3, 1, shade(skin, -25)); // kaş
    R(hx + 5, ey + 2, 1, 2, shade(skin, -20)); // burun
    R(hx + 4, ey + 5, 4, 1, shade(skin, -35)); // ağız
    if (d.wrinkles) { R(hx + 2, ey + 3, 2, 1, shade(skin, -20)); R(hx + 8, ey + 3, 2, 1, shade(skin, -20)); }
    if (d.scar) { R(hx + 8, ey - 2, 1, 6, "#b05a5a"); }
    if (d.tusks) { R(hx + 2, ey + 5, 8, 2, shade(skin, -35)); R(hx + 2, ey + 4, 1, 3, d.tusks); R(hx + 9, ey + 4, 1, 3, d.tusks); }
    if (d.brow) { R(hx + 1, ey - 2, hw - 2, 2, shade(skin, -25)); }
    if (d.mustache) { R(hx + 3, ey + 4, 6, 1, d.mustache); R(hx + 2, ey + 5, 2, 1, d.mustache); R(hx + 8, ey + 5, 2, 1, d.mustache); }
  }
  if (d.mask) { R(hx + 1, ey + 3, hw - 2, 4, d.mask); R(hx + 1, ey + 3, hw - 2, 1, shade(d.mask, -30)); }
  if (d.beard) {
    R(hx + 2, ey + 6, hw - 4, 2, d.beard); R(hx + 3, ey + 8, hw - 6, 2, d.beard);
    if (d.beardLong) { R(hx + 4, ey + 10, hw - 8, 5, d.beard); R(hx + 5, ey + 15, hw - 10, 2, d.beard); }
    R(hx + 4, ey + 5, 4, 1, shade(d.beard, -40));
  }
  if (d.longHair) { R(hx - 2, hy + 4, 3, 16, d.longHair); R(hx + hw - 1, hy + 4, 3, 16, d.longHair); }

  // saç / şapka
  const hc = d.hairCol, hc2 = d.hairCol2;
  switch (d.hair) {
    case "short":
      R(hx + 1, hy - 1, hw - 2, 3, hc); R(hx, hy, 1, 4, hc); R(hx + hw - 1, hy, 1, 4, hc);
      R(hx + 2, hy - 2, hw - 5, 1, hc); R(hx + 1, hy - 1, 3, 1, shade(hc, 25)); R(hx, hy - 1, hw, 1, O === hc ? hc : hc2);
      R(hx + 1, hy - 2, hw - 2, 1, O); break;
    case "bald":
      R(hx + 1, hy + 2, 1, 4, hc); R(hx + hw - 2, hy + 2, 1, 4, hc); R(hx + 3, hy + 1, 3, 1, shade(skin, 25)); break;
    case "hood":
      R(hx - 3, hy - 3, hw + 6, 5, hc); R(hx - 3, hy - 3, 2, 22, hc); R(hx + hw + 1, hy - 3, 2, 22, hc);
      R(hx - 2, hy + 2, 2, 12, hc2); R(hx + hw, hy + 2, 2, 12, hc2);
      R(hx + 1, hy + 1, hw - 2, 2, hc2);
      R(hx - 4, hy - 4, hw + 8, 1, O); R(hx - 4, hy - 4, 1, 24, O); R(hx + hw + 3, hy - 4, 1, 24, O);
      if (d.shadow) { R(hx + 1, hy + 1, hw - 2, 5, "#0e0a18"); R(hx + 2, ey, 3, 2, d.eyes); R(hx + 7, ey, 3, 2, d.eyes); }
      break;
    case "coif": // rahibe/rahip başlığı
      R(hx - 1, hy - 2, hw + 2, 4, hc); R(hx - 2, hy - 1, 2, 18, hc); R(hx + hw, hy - 1, 2, 18, hc);
      R(hx, hy + 1, hw, 1, hc2); R(hx - 2, hy - 3, hw + 4, 1, O); R(hx - 3, hy - 2, 1, 20, O); R(hx + hw + 2, hy - 2, 1, 20, O); break;
    case "cowl":
      R(hx - 2, hy - 2, hw + 4, 4, hc); R(hx - 3, hy - 1, 2, 20, hc); R(hx + hw + 1, hy - 1, 2, 20, hc);
      R(hx - 1, hy + 1, hw + 2, 1, hc2); R(hx - 3, hy - 3, hw + 6, 1, O); R(hx - 4, hy - 2, 1, 22, O); R(hx + hw + 3, hy - 2, 1, 22, O); break;
    case "wizhat":
      R(hx - 4, hy, hw + 8, 2, hc); R(hx - 5, hy - 1, hw + 10, 1, O); R(hx - 4, hy + 2, hw + 8, 1, O);
      R(hx + 1, hy - 4, hw - 2, 4, hc); R(hx + 3, hy - 8, hw - 6, 4, hc); R(hx + 5, hy - 6, 3, 1, hc2);
      R(hx + 2, hy - 2, 1, 2, shade(hc, 25)); R(hx + hw - 2, hy - 1, 1, 1, hc2);
      R(hx + 4, hy - 9, 2, 1, "#f5d23e"); R(hx + 0, hy - 5, 1, 1, O); R(hx + hw - 1, hy - 5, 1, 1, O); break;
    case "witchhat":
      R(hx - 5, hy, hw + 10, 2, hc); R(hx - 6, hy - 1, hw + 12, 1, O); R(hx - 5, hy + 2, hw + 10, 1, O);
      R(hx + 1, hy - 4, hw - 2, 4, hc); R(hx + 2, hy - 7, hw - 6, 3, hc); R(hx + 5, hy - 9, 3, 2, hc); R(hx + 7, hy - 10, 2, 1, hc);
      R(hx + 1, hy - 1, hw - 2, 1, "#7d2222"); R(hx + 3, hy - 4, 1, 3, hc2); break;
    case "helm":
      R(hx - 1, hy - 3, hw + 2, 6, hc); R(hx - 2, hy - 2, 1, 12, hc); R(hx + hw + 1, hy - 2, 1, 12, hc);
      R(hx - 1, hy + 3, 2, 8, hc2); R(hx + hw - 1, hy + 3, 2, 8, hc2);
      if (!d.openHelm) R(hx + 5, hy + 3, 2, 8, hc2); // burunluk
      R(hx, hy - 2, hw, 1, shade(hc, 30)); R(hx - 2, hy - 4, hw + 4, 1, O); R(hx - 3, hy - 3, 1, 14, O); R(hx + hw + 2, hy - 3, 1, 14, O);
      if (d.plume) { R(hx + 4, hy - 8, 4, 4, d.plume); R(hx + 5, hy - 9, 3, 1, d.plume); R(hx + 3, hy - 7, 1, 2, d.plume); }
      break;
    case "moss":
      R(hx, hy - 2, hw, 3, hc); R(hx - 1, hy - 1, 1, 3, hc); R(hx + hw, hy - 1, 1, 3, hc); R(hx + 2, hy - 3, 2, 1, hc); R(hx + 7, hy - 3, 3, 1, hc);
      R(hx + 1, hy + 1, 2, 1, hc2); R(hx + 6, hy + 1, 3, 1, hc2); R(hx + hw - 3, hy - 3, 1, 1, hc); R(hx, hy - 3, hw, 1, O === hc ? hc : hc2); break;
    case "kettle": // bekçi: geniş kenarlı miğfer
      R(hx, hy - 3, hw, 4, hc); R(hx - 3, hy, hw + 6, 2, hc); R(hx - 4, hy - 1, hw + 8, 1, O); R(hx - 3, hy + 2, hw + 6, 1, O);
      R(hx + 1, hy - 4, hw - 2, 1, O); R(hx + 2, hy - 2, 3, 1, shade(hc, 30)); R(hx + 5, hy + 2, 2, 6, hc2); break;
    case "crown":
      R(hx + 1, hy - 3, hw - 2, 3, hc); R(hx + 1, hy - 5, 2, 2, hc); R(hx + 5, hy - 6, 2, 3, hc); R(hx + hw - 3, hy - 5, 2, 2, hc);
      R(hx + 2, hy - 2, hw - 4, 1, hc2); R(hx + 5, hy - 2, 2, 1, "#d43a3a"); R(hx, hy - 4, 1, 4, O); R(hx + hw - 1, hy - 4, 1, 4, O); break;
    case "turban":
      R(hx - 1, hy - 3, hw + 2, 5, hc); R(hx - 2, hy - 1, 1, 5, hc); R(hx + hw + 1, hy - 1, 1, 5, hc);
      R(hx + 1, hy - 4, hw - 2, 1, hc); R(hx + 2, hy - 2, 3, 1, shade(hc, 30)); R(hx + 1, hy, hw - 2, 1, hc2);
      R(hx + hw - 3, hy - 1, 2, 2, d.jewel || "#66e0ff"); R(hx - 2, hy - 4, hw + 4, 1, O); break;
    case "bandana":
      R(hx, hy - 1, hw, 3, hc); R(hx + hw - 1, hy + 1, 3, 2, hc); R(hx + hw + 1, hy + 3, 2, 2, hc);
      R(hx + 1, hy + 2, hw - 2, 1, shade(hc, -30)); R(hx, hy + 2, hw, 5, null); R(hx, hy + 2, hw, 5, skin);
      R(hx + 2, hy + 2, 1, 3, hc2); R(hx + hw - 3, hy + 2, 1, 3, hc2); R(hx + 1, hy - 2, hw - 2, 1, O);
      // gözler bandananın altında yeniden
      R(hx + 2, ey, 3, 2, "#ffffff"); R(hx + 7, ey, 3, 2, "#ffffff"); R(hx + 3, ey, 1, 2, d.eyes); R(hx + 8, ey, 1, 2, d.eyes);
      R(hx + 2, ey - 1, 3, 1, shade(skin, -25)); R(hx + 7, ey - 1, 3, 1, shade(skin, -25)); R(hx + 5, ey + 2, 1, 2, shade(skin, -20)); R(hx + 4, ey + 5, 4, 1, shade(skin, -35));
      R(hx, hy + 2, 1, 5, O); R(hx + hw - 1, hy + 2, 1, 5, O); break;
  }
  if (d.silhouette) { // tam gölge: her şeyi tek tona indir
    for (let yy = 0; yy < N; yy++) for (let xx = 0; xx < N; xx++) {
      const c = g[yy][xx];
      if (c && c !== d.bg[0] && c !== d.bg[1] && c !== "#0c0a12") g[yy][xx] = (c === O) ? "#0e0e14" : "#2a2a34";
    }
    R(hx + 2, ey, 3, 2, "#4a4a5a"); R(hx + 7, ey, 3, 2, "#4a4a5a");
  }

  // render
  const s = size / N;
  const X = Math.round(x), Y = Math.round(y);
  for (let yy = 0; yy < N; yy++) for (let xx = 0; xx < N; xx++) {
    const c = g[yy][xx]; if (!c) continue;
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(X + xx * s), Math.round(Y + yy * s), Math.ceil(s), Math.ceil(s));
  }
}

// renk açma/koyulaştırma (#rrggbb, delta -255..255)
function shade(hex, delta) {
  if (!hex || hex[0] !== "#" || hex.length < 7) return hex;
  const n = parseInt(hex.slice(1, 7), 16);
  const cl = v => Math.max(0, Math.min(255, v));
  const r = cl((n >> 16) + delta), g = cl(((n >> 8) & 255) + delta), b = cl((n & 255) + delta);
  return "#" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
}

// ---------------------------------------------------------------------------
// EFEKTLER — drawFx(ctx, fx, t)  fx: {type, from:{x,y}, to:{x,y}, color}, t: 0..1
// ---------------------------------------------------------------------------
function fxRand(seed) { const x = Math.sin(seed * 12.9898) * 43758.5453; return x - Math.floor(x); }

function drawFx(ctx, fx, t) {
  if (!fx) return;
  t = Math.max(0, Math.min(1, t));
  const from = fx.from || fx.to || { x: 0, y: 0 }, to = fx.to || from;
  const col = fx.color || "#ffffff";
  ctx.save();
  ctx.lineCap = "square";
  switch (fx.type) {
    case "slash": {
      // hedef üstünde köşegen kesik (3 paralel çizgi), t ile uzar ve solar
      const cx = to.x, cy = to.y - 6;
      const len = 26, prog = Math.min(1, t * 2.2), fade = t < 0.5 ? 1 : (1 - (t - 0.5) * 2);
      ctx.globalAlpha = fade;
      for (let i = -1; i <= 1; i++) {
        ctx.strokeStyle = i === 0 ? "#ffffff" : col;
        ctx.lineWidth = i === 0 ? 3 : 2;
        ctx.beginPath();
        ctx.moveTo(cx - len / 2 + i * 4, cy - len / 2 + i * 3);
        ctx.lineTo(cx - len / 2 + i * 4 + len * prog, cy - len / 2 + i * 3 + len * prog);
        ctx.stroke();
      }
      // kıvılcım
      if (t > 0.3) for (let i = 0; i < 4; i++) {
        const a = i * 1.57 + 0.6, d = 8 + (t - 0.3) * 24;
        ctx.fillStyle = i % 2 ? col : "#ffffff";
        ctx.fillRect(Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d), 2, 2);
      }
      break;
    }
    case "arrow": {
      const p = Math.min(1, t * 1.25);
      const x = from.x + (to.x - from.x) * p, y = from.y - 8 + (to.y - from.y) * p - Math.sin(p * Math.PI) * 18;
      const ang = Math.atan2(to.y - from.y - Math.cos(p * Math.PI) * 36, to.x - from.x);
      ctx.translate(x, y); ctx.rotate(ang);
      ctx.strokeStyle = "#8b5a2b"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(4, 0); ctx.stroke();
      ctx.fillStyle = "#d8dce0"; ctx.fillRect(4, -2, 5, 4);
      ctx.fillStyle = "#e0dcd0"; ctx.fillRect(-11, -3, 3, 2); ctx.fillRect(-11, 1, 3, 2);
      if (t > 0.8) { ctx.globalAlpha = (1 - t) * 5; ctx.fillStyle = "#ffffff"; ctx.fillRect(6, -4, 3, 8); }
      break;
    }
    case "bolt": {
      // zikzak yıldırım from→to, sonra hedefte parlama
      const seg = 6, prog = Math.min(1, t * 1.6);
      ctx.globalAlpha = t < 0.6 ? 1 : (1 - t) * 2.5;
      ctx.strokeStyle = col; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(from.x, from.y - 8);
      for (let i = 1; i <= seg; i++) {
        const k = (i / seg) * prog;
        const nx = from.x + (to.x - from.x) * k, ny = from.y - 8 + (to.y - from.y) * k;
        const j = (fxRand(i * 7 + 1) - 0.5) * 16 * (i < seg ? 1 : 0);
        ctx.lineTo(nx + j * (Math.abs(to.y - from.y) > Math.abs(to.x - from.x) ? 1 : 0.4), ny + j * 0.7);
      }
      ctx.stroke();
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1; ctx.stroke();
      if (prog >= 1) {
        const rr = 6 + (t - 0.6) * 30;
        ctx.strokeStyle = col; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(to.x, to.y - 6, Math.max(1, rr), 0, Math.PI * 2); ctx.stroke();
      }
      break;
    }
    case "heal": {
      // yükselen artı işaretleri + yeşil halka
      const cx = to.x, cy = to.y;
      ctx.globalAlpha = 1 - t * 0.8;
      ctx.strokeStyle = col === "#ffffff" ? "#57c96a" : col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(cx, cy + 10, 14 + t * 10, 5 + t * 3, 0, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 5; i++) {
        const ox = (fxRand(i + 3) - 0.5) * 30, rise = t * (30 + fxRand(i + 9) * 20) + fxRand(i) * 10;
        const px = Math.round(cx + ox), py = Math.round(cy + 6 - rise);
        ctx.fillStyle = i % 2 ? "#ffffff" : (col === "#ffffff" ? "#8ef0a0" : col);
        ctx.fillRect(px - 1, py - 3, 2, 6); ctx.fillRect(px - 3, py - 1, 6, 2);
      }
      break;
    }
    case "explosion": {
      const cx = to.x, cy = to.y - 4;
      const R = 8 + t * 34;
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = col === "#ffffff" ? "#ff8a2a" : col;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffe070";
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.55, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(cx, cy, Math.max(0, R * 0.25 - t * 6), 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1 - t * t;
      for (let i = 0; i < 10; i++) {
        const a = i * 0.628 + fxRand(i) * 0.5, d = R * (0.8 + fxRand(i + 20) * 0.6);
        ctx.fillStyle = i % 3 === 0 ? "#ffe070" : (col === "#ffffff" ? "#ff5a2a" : col);
        ctx.fillRect(Math.round(cx + Math.cos(a) * d) - 2, Math.round(cy + Math.sin(a) * d) - 2, 4, 4);
      }
      break;
    }
    case "magic":
    default: {
      // dönerek ilerleyen parçacık kuyruğu, varışta yıldız
      const p = Math.min(1, t * 1.3);
      for (let i = 0; i < 7; i++) {
        const k = Math.max(0, p - i * 0.06);
        const x = from.x + (to.x - from.x) * k, y = from.y - 8 + (to.y - from.y) * k;
        const ang = k * 14 + i, rad = 6 + i;
        ctx.globalAlpha = 1 - i / 8;
        ctx.fillStyle = i % 2 ? "#ffffff" : col;
        const sz = 4 - Math.floor(i / 3);
        ctx.fillRect(Math.round(x + Math.cos(ang) * rad) - sz / 2, Math.round(y + Math.sin(ang) * rad * 0.5) - sz / 2, sz, sz);
      }
      if (p >= 1) {
        ctx.globalAlpha = (1 - t) * 3.3;
        ctx.strokeStyle = col; ctx.lineWidth = 2;
        const s = 6 + (t - 0.77) * 60, cx = to.x, cy = to.y - 6;
        ctx.beginPath();
        ctx.moveTo(cx - s, cy); ctx.lineTo(cx + s, cy); ctx.moveTo(cx, cy - s); ctx.lineTo(cx, cy + s);
        ctx.moveTo(cx - s * 0.6, cy - s * 0.6); ctx.lineTo(cx + s * 0.6, cy + s * 0.6);
        ctx.moveTo(cx + s * 0.6, cy - s * 0.6); ctx.lineTo(cx - s * 0.6, cy + s * 0.6);
        ctx.stroke();
      }
      break;
    }
  }
  ctx.restore();
}

// Yüzen hasar/iyileşme yazısı. t: 0..1 (yukarı süzülür, sonda solar)
function drawFloatText(ctx, text, x, y, color, t) {
  t = Math.max(0, Math.min(1, t));
  const rise = 28 * (1 - Math.pow(1 - t, 2));
  const scale = t < 0.15 ? 1 + (0.15 - t) * 3 : 1;
  ctx.save();
  ctx.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1;
  ctx.translate(Math.round(x), Math.round(y - 22 - rise));
  ctx.scale(scale, scale);
  ctx.font = "bold 15px Consolas, 'Courier New', monospace";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.lineWidth = 4; ctx.lineJoin = "round";
  ctx.strokeStyle = "#0c0a12";
  ctx.strokeText(String(text), 0, 0);
  ctx.fillStyle = color || "#ffffff";
  ctx.fillText(String(text), 0, 0);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// SAHNELER — başlık, bölüm afişi, kamp, son. Hepsi düşük çözünürlüklü (1/3) offscreen
// tamponda çizilip pixel-art olarak büyütülür. Statik katman önbelleklenir; her karede
// yalnızca hareketli öğeler (sis, alevler, kuzgun, ışık) çizilir.
// ---------------------------------------------------------------------------
const SCENE_SCALE = 3;
const SceneCache = {};

function sceneBuffers(name, w, h) {
  const lw = Math.max(8, Math.ceil(w / SCENE_SCALE)), lh = Math.max(8, Math.ceil(h / SCENE_SCALE));
  const keyS = name + ":" + lw + "x" + lh;
  let c = SceneCache[keyS];
  if (!c) {
    const mk = () => { const cv = document.createElement("canvas"); cv.width = lw; cv.height = lh; return cv; };
    c = SceneCache[keyS] = { lw, lh, stat: mk(), dyn: mk(), ready: false };
    c.sctx = c.stat.getContext("2d"); c.dctx = c.dyn.getContext("2d");
  }
  return c;
}
function sceneBlit(ctx, c, w, h) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(c.dyn, 0, 0, c.lw, c.lh, 0, 0, w, h);
  ctx.restore();
}
// düşük çözünürlük yardımcıları
function R_(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); }
function skyGradient(c, lw, lh, stops) {
  const g = c.createLinearGradient(0, 0, 0, lh);
  stops.forEach(([p, col]) => g.addColorStop(p, col));
  c.fillStyle = g; c.fillRect(0, 0, lw, lh);
  // dithering bantları (pixel hissi)
  for (let y = 0; y < lh; y += 2) if (fxRand(y * 3.1) > 0.7) R_(c, 0, y, lw, 1, "rgba(0,0,0,0.06)");
}
function stars(c, lw, lh, n, seed) {
  for (let i = 0; i < n; i++) {
    const x = fxRand(seed + i * 1.7) * lw, y = fxRand(seed + i * 2.3) * lh * 0.6;
    R_(c, x, y, 1, 1, fxRand(seed + i) > 0.8 ? "#ffffff" : "#9aa8c8");
  }
}
function pineTree(c, x, base, h, col, col2) {
  R_(c, x, base - h * 0.15, 1, h * 0.15, col2 || col);
  for (let i = 0; i < 3; i++) {
    const w = 2 + i * 2, y = base - h + i * (h * 0.28);
    for (let k = 0; k <= w; k++) R_(c, x - k, y + k * (h * 0.28 / w), 2 * k + 1, 1, col);
  }
}
function roundTree(c, x, base, h, col, col2) {
  R_(c, x, base - h * 0.4, 1, h * 0.4, col2 || col);
  R_(c, x - h * 0.3, base - h * 0.8, h * 0.6 + 1, h * 0.45, col);
  R_(c, x - h * 0.2, base - h, h * 0.4 + 1, h * 0.3, col);
}
function mountains(c, lw, base, amp, col, seed, step) {
  step = step || 3;
  let y = base - amp * 0.5;
  for (let x = 0; x < lw; x += step) {
    y += (fxRand(seed + x) - 0.5) * amp * 0.5;
    y = Math.max(base - amp, Math.min(base - 2, y));
    R_(c, x, y, step, base - y, col);
  }
}
function castleSilhouette(c, x, base, s, col, col2) {
  // s = ölçek (1 → ~40px geniş). Ana beden + 3 kule + mazgal
  const W = 40 * s, H = 22 * s;
  R_(c, x, base - H, W, H, col);
  const towers = [[0, 34], [W * 0.42, 40], [W - 8 * s, 34]];
  towers.forEach(([tx, th]) => {
    R_(c, x + tx, base - th * s, 8 * s, th * s, col);
    for (let k = 0; k < 4; k++) R_(c, x + tx + k * 2 * s, base - th * s - 2 * s, s, 2 * s, col);
    R_(c, x + tx + 3 * s, base - th * s + 5 * s, 2 * s, 3 * s, col2 || "#f0c040"); // pencere
  });
  for (let k = 0; k < W / (2 * s); k += 2) R_(c, x + k * 2 * s, base - H - 2 * s, s, 2 * s, col);
  R_(c, x + W * 0.5 - 3 * s, base - 7 * s, 6 * s, 7 * s, "#08060c"); // kapı
  // bayraklar
  R_(c, x + W * 0.42 + 4 * s, base - 40 * s - 6 * s, s, 6 * s, col);
  R_(c, x + W * 0.42 + 5 * s, base - 46 * s, 4 * s, 2 * s, "#8e2424");
}
function fogBand(c, lw, y, h, t, speed, alpha, col) {
  c.save(); c.globalAlpha = alpha; c.fillStyle = col || "#b8c4d8";
  for (let i = 0; i < 6; i++) {
    const w = lw * 0.35, x = ((i * lw * 0.3 + t * speed) % (lw + w)) - w;
    c.fillRect(Math.round(x), Math.round(y + Math.sin(t * 0.5 + i) * 2), Math.round(w), h);
    c.fillRect(Math.round(x + w * 0.2), Math.round(y - 2 + Math.sin(t * 0.5 + i) * 2), Math.round(w * 0.5), 2);
  }
  c.restore();
}
function flame(c, x, base, size, t, seed) {
  // size: alev yüksekliği (lowres px)
  const f = (k) => 0.5 + 0.5 * Math.sin(t * (7 + k) + seed + k * 2);
  const h = size * (0.8 + 0.3 * f(0));
  R_(c, x - size * 0.35, base - h * 0.55, size * 0.7, h * 0.55, "#e85a1a");
  R_(c, x - size * 0.2, base - h * 0.85, size * 0.4 + (f(1) > 0.5 ? 1 : 0), h * 0.35, "#e85a1a");
  R_(c, x - size * 0.15 + (f(2) > 0.5 ? 1 : -1) * 0.5, base - h, size * 0.2, h * 0.2, "#e85a1a");
  R_(c, x - size * 0.2, base - h * 0.45, size * 0.4, h * 0.45, "#ffb020");
  R_(c, x - size * 0.1, base - h * 0.6, size * 0.2, h * 0.2, "#ffb020");
  R_(c, x - size * 0.1, base - h * 0.3, size * 0.2, h * 0.3, "#fff0a0");
}
function glow(c, x, y, r, col, alpha) {
  c.save(); c.globalAlpha = alpha;
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, col); g.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
  c.restore();
}
function raven(c, x, y, t, i) {
  const flap = Math.sin(t * 6 + i) > 0 ? 1 : 0;
  R_(c, x, y, 1, 1, "#0a0810"); R_(c, x - 2, y - flap, 2, 1, "#0a0810"); R_(c, x + 1, y - flap, 2, 1, "#0a0810");
}

// ---- Başlık ekranı: Gölge Kalesi, ay, sis, meşale, kuzgun ----
function drawTitleScene(ctx, w, h, t) {
  const c = sceneBuffers("title", w, h), lw = c.lw, lh = c.lh, s = c.sctx, d = c.dctx;
  if (!c.ready) {
    skyGradient(s, lw, lh, [[0, "#0a0814"], [0.5, "#1a1430"], [0.85, "#2a1e3e"], [1, "#0e0a16"]]);
    stars(s, lw, lh, Math.floor(lw * 0.5), 7);
    // ay
    const mx = lw * 0.72, my = lh * 0.22, mr = Math.max(6, lh * 0.08);
    glow(s, mx, my, mr * 3.2, "#c8b8ff", 0.25);
    s.fillStyle = "#e8e2d0"; s.beginPath(); s.arc(mx, my, mr, 0, Math.PI * 2); s.fill();
    s.fillStyle = "#c8c0a8"; s.beginPath(); s.arc(mx - mr * 0.3, my + mr * 0.2, mr * 0.28, 0, Math.PI * 2); s.fill();
    s.beginPath(); s.arc(mx + mr * 0.35, my - mr * 0.3, mr * 0.18, 0, Math.PI * 2); s.fill();
    // uzak dağlar ve kale tepesi
    mountains(s, lw, lh * 0.66, lh * 0.2, "#1c1830", 11, 3);
    mountains(s, lw, lh * 0.72, lh * 0.16, "#151228", 23, 2);
    const hillTop = lh * 0.62;
    s.fillStyle = "#0f0c1c"; s.beginPath(); s.moveTo(lw * 0.2, lh); s.quadraticCurveTo(lw * 0.5, hillTop - lh * 0.12, lw * 0.85, lh); s.fill();
    const cs = Math.max(0.6, lh / 120);
    castleSilhouette(s, lw * 0.5 - 20 * cs, hillTop + lh * 0.02, cs, "#0a0812", "#3a2a10");
    // ön plan orman
    for (let x = -4; x < lw + 6; x += 5 + Math.floor(fxRand(x) * 4)) {
      const th = lh * (0.14 + fxRand(x * 2) * 0.12);
      pineTree(s, x, lh * 0.98 + fxRand(x * 3) * 4, th, "#07060c");
    }
    R_(s, 0, lh - 2, lw, 2, "#050408");
    c.ready = true;
  }
  d.clearRect(0, 0, lw, lh);
  d.drawImage(c.stat, 0, 0);
  // sis
  fogBand(d, lw, lh * 0.70, 4, t, 4, 0.10, "#8a80c0");
  fogBand(d, lw, lh * 0.80, 5, t + 30, 2.5, 0.14, "#8a80c0");
  // meşaleler (kale kapısının iki yanı)
  const cs = Math.max(0.6, lh / 120), gx = lw * 0.5, gy = lh * 0.64;
  [gx - 5 * cs, gx + 5 * cs].forEach((x, i) => {
    const fl = 0.7 + 0.3 * Math.sin(t * 9 + i * 2) * Math.sin(t * 3.3 + i);
    glow(d, x, gy - 2, 8 * cs, "#ff9a30", 0.25 * fl);
    R_(d, x - 0.5, gy - 3, 1, 1, "#ffe070"); R_(d, x - 1, gy - 2, 2, 1, "#ff8a2a");
  });
  // pencere ışıkları titreşimi
  d.save(); d.globalAlpha = 0.5 + 0.3 * Math.sin(t * 2.1); d.fillStyle = "#ffd050";
  d.fillRect(Math.round(gx - 20 * cs + 3 * cs), Math.round(gy - 29 * cs), Math.max(1, 2 * cs), Math.max(1, 3 * cs));
  d.restore();
  // kuzgunlar
  for (let i = 0; i < 4; i++) {
    const x = ((t * (6 + i * 2) + i * lw * 0.27) % (lw + 20)) - 10;
    const y = lh * (0.18 + i * 0.07) + Math.sin(t * 1.3 + i) * 3;
    raven(d, x, y, t, i);
  }
  sceneBlit(ctx, c, w, h);
}

// ---- Bölüm afişi: 0 orman, 1 bataklık/mağara, 2 kripta, 3 kale ----
function drawChapterBanner(ctx, w, h, chapterIndex, t) {
  const idx = Math.max(0, Math.min(3, chapterIndex | 0));
  const c = sceneBuffers("chapter" + idx, w, h), lw = c.lw, lh = c.lh, s = c.sctx, d = c.dctx;
  if (!c.ready) {
    if (idx === 0) {
      skyGradient(s, lw, lh, [[0, "#1c3450"], [0.6, "#4a7a9a"], [1, "#8ab0a0"]]);
      glow(s, lw * 0.8, lh * 0.25, lh * 0.3, "#fff0b0", 0.5);
      s.fillStyle = "#fff4c0"; s.beginPath(); s.arc(lw * 0.8, lh * 0.25, lh * 0.07, 0, Math.PI * 2); s.fill();
      mountains(s, lw, lh * 0.62, lh * 0.25, "#2e5a5a", 31, 3);
      mountains(s, lw, lh * 0.75, lh * 0.18, "#2a6a3a", 41, 2);
      R_(s, 0, lh * 0.75, lw, lh * 0.25, "#1f5a2a");
      for (let x = -3; x < lw + 6; x += 4 + Math.floor(fxRand(x + 5) * 5)) {
        const th = lh * (0.25 + fxRand(x * 2) * 0.2); const base = lh * (0.8 + fxRand(x * 7) * 0.22);
        if (fxRand(x * 9) > 0.5) pineTree(s, x, base, th, "#143a1c", "#3a2a14"); else roundTree(s, x, base, th, "#1a4a22", "#3a2a14");
      }
      R_(s, 0, lh - 2, lw, 2, "#0f2a14");
    } else if (idx === 1) {
      skyGradient(s, lw, lh, [[0, "#141a18"], [0.7, "#2a3a2c"], [1, "#1a2418"]]);
      mountains(s, lw, lh * 0.6, lh * 0.3, "#1a2420", 51, 4);
      R_(s, 0, lh * 0.7, lw, lh * 0.3, "#1e2e22");
      // su
      R_(s, 0, lh * 0.82, lw, lh * 0.18, "#1c3028");
      for (let i = 0; i < lw / 6; i++) R_(s, fxRand(i * 3) * lw, lh * (0.84 + fxRand(i * 5) * 0.14), 3 + fxRand(i) * 4, 1, "#2e4a3a");
      // ölü ağaçlar
      for (let x = 4; x < lw; x += 10 + Math.floor(fxRand(x) * 14)) {
        const th = lh * (0.3 + fxRand(x * 2) * 0.3), base = lh * 0.82;
        R_(s, x, base - th, 2, th, "#0e1410");
        R_(s, x - 4, base - th * 0.8, 4, 1, "#0e1410"); R_(s, x + 2, base - th * 0.65, 5, 1, "#0e1410");
        R_(s, x - 6, base - th * 0.9, 2, 1, "#0e1410"); R_(s, x + 6, base - th * 0.75, 2, 1, "#0e1410");
      }
      // mağara ağzı sağda
      s.fillStyle = "#0a0c0e"; s.beginPath(); s.ellipse(lw * 0.85, lh * 0.82, lw * 0.12, lh * 0.3, 0, Math.PI, 0); s.fill();
      R_(s, 0, lh - 2, lw, 2, "#0c1410");
    } else if (idx === 2) {
      skyGradient(s, lw, lh, [[0, "#0a0614"], [0.6, "#241638"], [1, "#12081c"]]);
      stars(s, lw, lh, Math.floor(lw * 0.3), 77);
      glow(s, lw * 0.3, lh * 0.22, lh * 0.25, "#b090ff", 0.2);
      s.fillStyle = "#d8d0e8"; s.beginPath(); s.arc(lw * 0.3, lh * 0.22, lh * 0.06, 0, Math.PI * 2); s.fill();
      R_(s, 0, lh * 0.72, lw, lh * 0.28, "#1a1226");
      // demir parmaklık ve mezar taşları
      for (let x = 0; x < lw; x += 4) R_(s, x, lh * 0.55, 1, lh * 0.17, "#0c0814");
      R_(s, 0, lh * 0.56, lw, 1, "#0c0814"); R_(s, 0, lh * 0.64, lw, 1, "#0c0814");
      for (let i = 0; i < lw / 9; i++) {
        const x = 3 + i * 9 + fxRand(i * 3) * 4, hh = 6 + fxRand(i) * 6, y = lh * (0.76 + fxRand(i * 7) * 0.16);
        R_(s, x, y - hh, 4, hh, i % 3 ? "#3a3050" : "#4a4060"); R_(s, x + 1, y - hh - 1, 2, 1, "#3a3050");
        if (i % 4 === 0) { R_(s, x + 1, y - hh - 3, 2, 4, "#4a4060"); R_(s, x, y - hh - 2, 4, 1, "#4a4060"); }
      }
      // mozole
      R_(s, lw * 0.62, lh * 0.42, lw * 0.2, lh * 0.32, "#221a34"); R_(s, lw * 0.6, lh * 0.4, lw * 0.24, 2, "#2e2444");
      R_(s, lw * 0.7, lh * 0.55, lw * 0.05, lh * 0.19, "#08060c");
      R_(s, 0, lh - 2, lw, 2, "#0c0814");
    } else {
      skyGradient(s, lw, lh, [[0, "#1a0810"], [0.5, "#4a1420"], [0.85, "#7a2a1c"], [1, "#2a0c10"]]);
      mountains(s, lw, lh * 0.7, lh * 0.25, "#2a0e16", 91, 3);
      R_(s, 0, lh * 0.78, lw, lh * 0.22, "#160810");
      const cs = Math.max(0.8, lh / 70);
      castleSilhouette(s, lw * 0.5 - 20 * cs, lh * 0.8, cs, "#0a0608", "#ff6030");
      // kale duvarı ön plan
      for (let x = 0; x < lw; x += 6) R_(s, x, lh * 0.9, 4, 3, "#120810");
      R_(s, 0, lh * 0.93, lw, lh * 0.07, "#0e0608");
      R_(s, 0, lh - 2, lw, 2, "#080406");
    }
    c.ready = true;
  }
  d.clearRect(0, 0, lw, lh);
  d.drawImage(c.stat, 0, 0);
  if (idx === 0) {
    // kuşlar + hafif ışık
    for (let i = 0; i < 3; i++) { const x = ((t * (5 + i * 3) + i * lw * 0.3) % (lw + 10)) - 5; raven(d, x, lh * (0.15 + i * 0.08), t, i); }
    fogBand(d, lw, lh * 0.72, 3, t, 1.5, 0.08, "#ffffff");
  } else if (idx === 1) {
    fogBand(d, lw, lh * 0.74, 5, t, 3, 0.16, "#7fa08a");
    fogBand(d, lw, lh * 0.84, 4, t + 40, 2, 0.12, "#7fa08a");
    for (let i = 0; i < 8; i++) { // ateşböceği / bataklık ışığı
      const x = lw * fxRand(i * 3.7) + Math.sin(t * 0.8 + i) * 4, y = lh * (0.5 + fxRand(i * 5.1) * 0.35) + Math.cos(t * 1.1 + i) * 3;
      const a = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i * 1.7));
      glow(d, x, y, 3, "#a0ff90", a * 0.5); d.save(); d.globalAlpha = a; R_(d, x, y, 1, 1, "#d0ffb0"); d.restore();
    }
    glow(d, lw * 0.85, lh * 0.78, lw * 0.1, "#3a2a60", 0.3 + 0.1 * Math.sin(t));
  } else if (idx === 2) {
    fogBand(d, lw, lh * 0.7, 4, t, 2, 0.12, "#9080c0");
    for (let i = 0; i < 5; i++) { // hayalet ışıkları
      const x = lw * (0.1 + fxRand(i * 2.1) * 0.8) + Math.sin(t * 0.6 + i * 2) * 6, y = lh * (0.6 + fxRand(i * 4.3) * 0.2) + Math.sin(t * 1.4 + i) * 3;
      const a = 0.5 + 0.5 * Math.sin(t * 1.5 + i * 2.2);
      glow(d, x, y, 5, "#80e0ff", a * 0.6); R_(d, x, y, 1, 1, "#e0ffff");
    }
    d.save(); d.globalAlpha = 0.5 + 0.4 * Math.sin(t * 3); R_(d, lw * 0.7, lh * 0.55, lw * 0.05, lh * 0.19, "#40e0a0"); d.restore();
  } else {
    // şimşek (ara sıra) + pencere kızıllığı + kül
    const cs = Math.max(0.8, lh / 70), gx = lw * 0.5;
    const ph = (t % 6);
    if (ph > 5.6 && ph < 5.75) { d.save(); d.globalAlpha = 0.35 + 0.5 * Math.sin((ph - 5.6) * 21); d.fillStyle = "#ffe8ff"; d.fillRect(0, 0, lw, lh * 0.78); d.restore(); }
    glow(d, gx, lh * 0.5, lw * 0.2, "#ff4020", 0.12 + 0.05 * Math.sin(t * 2));
    for (let i = 0; i < 12; i++) {
      const y = lh - ((t * (6 + i) + i * 37) % lh), x = lw * fxRand(i * 9.1) + Math.sin(t + i) * 3;
      R_(d, x, y, 1, 1, i % 3 ? "#ff8a40" : "#ffd080");
    }
    [gx - 20 * cs + 3 * cs, gx + 20 * cs - 5 * cs].forEach((x, i) => { d.save(); d.globalAlpha = 0.6 + 0.4 * Math.sin(t * 4 + i); R_(d, x, lh * 0.8 - 29 * cs, 2 * cs, 3 * cs, "#ff7040"); d.restore(); });
  }
  sceneBlit(ctx, c, w, h);
}

// ---- Kamp: gece, ateş, çadır ----
function drawCampScene(ctx, w, h, t) {
  const c = sceneBuffers("camp", w, h), lw = c.lw, lh = c.lh, s = c.sctx, d = c.dctx;
  const fx = lw * 0.5, fy = lh * 0.86;
  if (!c.ready) {
    skyGradient(s, lw, lh, [[0, "#06060e"], [0.6, "#101426"], [1, "#0c1418"]]);
    stars(s, lw, lh, Math.floor(lw * 0.5), 99);
    R_(s, 0, lh * 0.7, lw, lh * 0.3, "#1a2a1c");
    mountains(s, lw, lh * 0.7, lh * 0.15, "#0e1a14", 61, 3);
    for (let x = -3; x < lw + 6; x += 5 + Math.floor(fxRand(x + 1) * 5)) {
      if (Math.abs(x - fx) < lw * 0.18) continue;
      pineTree(s, x, lh * (0.78 + fxRand(x * 3) * 0.2), lh * (0.25 + fxRand(x * 2) * 0.25), "#0a1410", "#1a1410");
    }
    // çadır
    const tx = lw * 0.28, ty = lh * 0.9, tw = lw * 0.14, th = lh * 0.22;
    s.fillStyle = "#5a4a34"; s.beginPath(); s.moveTo(tx - tw, ty); s.lineTo(tx, ty - th); s.lineTo(tx + tw, ty); s.fill();
    s.fillStyle = "#3a2e20"; s.beginPath(); s.moveTo(tx - tw * 0.35, ty); s.lineTo(tx, ty - th * 0.55); s.lineTo(tx + tw * 0.35, ty); s.fill();
    // kütükler + taş halkası
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; R_(s, fx + Math.cos(a) * 7, fy + Math.sin(a) * 3, 2, 2, "#5a5a66"); }
    R_(s, fx - 5, fy - 1, 10, 2, "#4a3420"); R_(s, fx - 3, fy - 3, 6, 2, "#5a3e24");
    R_(s, fx + 12, fy - 2, 9, 3, "#3e2c1a"); R_(s, fx - 21, fy - 1, 9, 3, "#3e2c1a"); // oturma kütükleri
    R_(s, 0, lh - 2, lw, 2, "#0a1410");
    c.ready = true;
  }
  d.clearRect(0, 0, lw, lh);
  d.drawImage(c.stat, 0, 0);
  const fl = 0.8 + 0.2 * Math.sin(t * 8) * Math.sin(t * 2.7);
  glow(d, fx, fy - 4, lw * 0.22, "#ff9a30", 0.28 * fl);
  glow(d, fx, fy - 4, lw * 0.08, "#ffd070", 0.35 * fl);
  flame(d, fx, fy - 3, Math.max(8, lh * 0.16), t, 1);
  // kıvılcımlar
  for (let i = 0; i < 7; i++) {
    const life = ((t * 0.9 + i * 0.37) % 1);
    const x = fx + Math.sin(t * 2 + i * 3) * 3 * life + (fxRand(i) - 0.5) * 6, y = fy - 6 - life * lh * 0.3;
    d.save(); d.globalAlpha = 1 - life; R_(d, x, y, 1, 1, i % 2 ? "#ffd080" : "#ff8a40"); d.restore();
  }
  // duman
  d.save(); d.globalAlpha = 0.12;
  for (let i = 0; i < 4; i++) { const life = ((t * 0.25 + i * 0.25) % 1); const x = fx + Math.sin(t * 0.7 + i) * 4 * life, y = fy - lh * 0.2 - life * lh * 0.35; R_(d, x - 2 - life * 3, y, 4 + life * 6, 2, "#c0c8d0"); }
  d.restore();
  fogBand(d, lw, lh * 0.74, 3, t, 1.2, 0.06, "#a0b0c0");
  sceneBlit(ctx, c, w, h);
}

// ---- Son: gün doğumu, zafer ----
function drawEndingScene(ctx, w, h, t) {
  const c = sceneBuffers("ending", w, h), lw = c.lw, lh = c.lh, s = c.sctx, d = c.dctx;
  if (!c.ready) {
    skyGradient(s, lw, lh, [[0, "#2a2a60"], [0.45, "#c05a4a"], [0.7, "#f0a050"], [0.8, "#ffd890"], [1, "#6a5a40"]]);
    mountains(s, lw, lh * 0.7, lh * 0.22, "#5a3a58", 121, 3);
    mountains(s, lw, lh * 0.78, lh * 0.15, "#3e2c48", 131, 2);
    R_(s, 0, lh * 0.8, lw, lh * 0.2, "#3a5a30");
    // kale harabesi tepede, bayrak
    const cs = Math.max(0.5, lh / 160);
    castleSilhouette(s, lw * 0.68, lh * 0.8, cs, "#2a2034", "#ffd070");
    for (let x = -3; x < lw * 0.55; x += 5 + Math.floor(fxRand(x + 2) * 5)) roundTree(s, x, lh * (0.86 + fxRand(x * 3) * 0.14), lh * (0.14 + fxRand(x * 2) * 0.1), "#2a4a24", "#3a2a14");
    R_(s, 0, lh - 2, lw, 2, "#243a1c");
    c.ready = true;
  }
  d.clearRect(0, 0, lw, lh);
  // güneş: t ile yükselir (ilk 8 sn), sonra hafif salınım
  const rise = Math.min(1, t / 8);
  const sx = lw * 0.32, sy = lh * 0.72 - rise * lh * 0.32, sr = Math.max(6, lh * 0.09);
  d.drawImage(c.stat, 0, 0);
  d.save(); d.globalCompositeOperation = "destination-over"; d.restore();
  // ışınlar (döner)
  d.save(); d.globalAlpha = 0.16 + 0.04 * Math.sin(t);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2 + t * 0.1;
    d.strokeStyle = "#fff0b0"; d.lineWidth = 2 + (i % 2);
    d.beginPath(); d.moveTo(sx, sy); d.lineTo(sx + Math.cos(a) * lw, sy + Math.sin(a) * lw); d.stroke();
  }
  d.restore();
  glow(d, sx, sy, sr * 4, "#ffe0a0", 0.5);
  d.fillStyle = "#fff6d0"; d.beginPath(); d.arc(sx, sy, sr, 0, Math.PI * 2); d.fill();
  // dağlar güneşin önünde kalsın: statik katmanın dağ+zemin bölümünü yeniden bindir
  d.drawImage(c.stat, 0, Math.round(lh * 0.5), lw, Math.ceil(lh * 0.5), 0, Math.round(lh * 0.5), lw, Math.ceil(lh * 0.5));
  // kuşlar
  for (let i = 0; i < 6; i++) { const x = ((t * (7 + i * 2) + i * lw * 0.17) % (lw + 20)) - 10; raven(d, x, lh * (0.2 + (i % 3) * 0.08) + Math.sin(t * 1.5 + i) * 2, t, i); }
  // bayrak dalgası
  const cs = Math.max(0.5, lh / 160), bx = lw * 0.68 + 40 * cs * 0.42 + 5 * cs, by = lh * 0.8 - 46 * cs;
  for (let k = 0; k < 5; k++) R_(d, bx + k, by + Math.sin(t * 6 + k) * 0.8, 1, 2 * cs, "#f0c040");
  sceneBlit(ctx, c, w, h);
}

// Birim altına yumuşak ışık halkası (koyu biyomlarda ayrışma). side: "party" | diğer (düşman)
function drawUnitGlow(ctx, cx, cy, size, side) {
  const col = side === "party" ? "90,169,230" : "217,83,79";
  const r = size * 0.78;
  ctx.save();
  const g = ctx.createRadialGradient(cx, cy + 2, r * 0.2, cx, cy + 2, r);
  g.addColorStop(0, "rgba(" + col + ",0.30)");
  g.addColorStop(0.7, "rgba(" + col + ",0.10)");
  g.addColorStop(1, "rgba(" + col + ",0)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(cx, cy + 2, r, r * 0.72, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(" + col + ",0.35)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(cx, cy + 6, size * 0.55, size * 0.26, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}
