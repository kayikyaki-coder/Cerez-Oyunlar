// render.js — canvas çizimi ve piksel->hex dönüşümü

let ctx = null;
let canvasEl = null;

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

// fare konumundan hex bul (en yakın merkez)
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

function draw() {
  if (!ctx) return;
  ctx.clearRect(0, 0, State.width, State.height);

  const u = cur();

  // 1) zemin hexleri
  for (let r = 0; r < State.rows; r++) {
    for (let q = 0; q < State.cols; q++) {
      const c = hexCenter(q, r);
      const blocked = State.blocked.has(key(q, r));
      fillHexPath(c.x, c.y, State.size - 1);
      if (blocked) {
        ctx.fillStyle = "#2b2f36";
      } else {
        ctx.fillStyle = ((q + r) % 2 === 0) ? "#1a2a1c" : "#173018";
      }
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#0c140d";
      ctx.stroke();

      if (blocked) drawRock(c.x, c.y);
    }
  }

  // 2) hareket menzili (yeşil)
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
  }

  // 3) hedefler (kırmızı=düşman, mavi=dost)
  if (State.mode === "attack" || State.mode === "heal" || State.mode === "spell") {
    let col = "#d9534f";
    if (State.mode === "heal") col = "#5aa9e6";
    if (State.mode === "spell" && State.pendingSpell) col = (State.pendingSpell.target === "enemy") ? "#d9534f" : "#5aa9e6";
    for (const t of State.targets) {
      const c = hexCenter(t.q, t.r);
      fillHexPath(c.x, c.y, State.size - 2);
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }

  // 4) aktif birim halkası (sarı)
  if (u && !u.dead && State.phase !== "over") {
    const c = hexCenter(u.q, u.r);
    fillHexPath(c.x, c.y, State.size - 2);
    ctx.strokeStyle = "#f5d23e";
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  // 5) birimler
  for (const unit of State.units) {
    if (unit.dead) continue;
    drawUnit(unit);
  }
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

  // gölge
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(c.x, c.y + 12, 13, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // sprite
  drawSpriteGrid(ctx, Sprites[unit.sprite], c.x, c.y, 2);

  // HP barı
  const w = 26, h = 4;
  const bx = c.x - w / 2, by = c.y - 26;
  ctx.fillStyle = "#0c0c12";
  ctx.fillRect(bx - 1, by - 1, w + 2, h + 2);
  ctx.fillStyle = "#3a1414";
  ctx.fillRect(bx, by, w, h);
  const frac = Math.max(0, unit.hp / unit.hpMax);
  ctx.fillStyle = unit.side === "party" ? "#57c96a" : "#d9534f";
  ctx.fillRect(bx, by, Math.round(w * frac), h);

  // yan işareti (mavi=ekip / kırmızı=kurt)
  ctx.fillStyle = unit.side === "party" ? "#5aa9e6" : "#d9534f";
  ctx.fillRect(c.x - 2, by - 5, 4, 3);
}
