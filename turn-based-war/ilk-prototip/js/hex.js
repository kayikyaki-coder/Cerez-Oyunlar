// hex.js — hex ızgara matematiği (pointy-top, odd-r offset)
// Bu dosya saf matematik içerir; State'e render.js/engine.js runtime'da erişir.

const SQRT3 = Math.sqrt(3);

function key(q, r) { return q + "," + r; }

// odd-r offset komşuları (çift/tek satır farklı)
function neighbors(q, r) {
  const even = (r % 2 === 0);
  const dirs = even
    ? [[+1, 0], [-1, 0], [0, -1], [-1, -1], [0, +1], [-1, +1]]
    : [[+1, 0], [-1, 0], [+1, -1], [0, -1], [+1, +1], [0, +1]];
  const out = [];
  for (const [dq, dr] of dirs) out.push([q + dq, r + dr]);
  return out;
}

// offset -> cube (mesafe hesabı için)
function toCube(q, r) {
  const x = q - ((r - (r & 1)) / 2);
  const z = r;
  const y = -x - z;
  return { x, y, z };
}

// iki hex arası mesafe
function hexDist(a, b) {
  const A = toCube(a.q, a.r), B = toCube(b.q, b.r);
  return (Math.abs(A.x - B.x) + Math.abs(A.y - B.y) + Math.abs(A.z - B.z)) / 2;
}

// hex merkezinin piksel konumu
function hexCenter(q, r) {
  const x = State.originX + State.size * SQRT3 * (q + 0.5 * (r & 1));
  const y = State.originY + State.size * 1.5 * r;
  return { x, y };
}

// hex köşeleri (pointy-top)
function hexCorners(cx, cy, size) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const ang = Math.PI / 180 * (60 * i - 90);
    pts.push([cx + size * Math.cos(ang), cy + size * Math.sin(ang)]);
  }
  return pts;
}
