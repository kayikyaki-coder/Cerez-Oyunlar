// sprites.js — 16x16 pixel-art sprite'lar ve çizim yardımcısı
// '.' = saydam. Her harf bir renge eşlenir (palette).

const Sprites = {
  fighter: {
    pal: { ".": null, "o": "#141018", "a": "#aab4c2", "A": "#5c6672", "s": "#eab58c", "r": "#cf3b3b", "m": "#e8eef5" },
    grid: [
      ".......rr.......",
      "......orro......",
      ".....oaaao......",
      "....oaAAaao.....",
      "....oassaAo.....",
      "....oassaAo.....",
      "....ooaaaoo.....",
      "...oaAaaAAao....",
      "..moaAaaAAaom...",
      "..moaAaaAAaom...",
      "...oAaaaaAAo....",
      "...oAao.oAAo....",
      "...oAo...oAo....",
      "...oo.....oo....",
      "................",
      "................"
    ]
  },
  wizard: {
    pal: { ".": null, "o": "#141018", "h": "#4e3488", "p": "#7a54c0", "P": "#4e3488", "y": "#f5d23e", "s": "#eab58c", "w": "#e9e9f2" },
    grid: [
      ".......y........",
      ".......h........",
      "......oho.......",
      ".....ohho.......",
      "....ohhho.......",
      "...ohhhho.......",
      "..ohhhhho.......",
      "...ossso........",
      "...oswso........",
      "..oppppo........",
      "..opPppo........",
      ".oppppppo.......",
      ".opPppPpo.......",
      ".opppppppo......",
      "..oo..ooo.......",
      "................"
    ]
  },
  cleric: {
    pal: { ".": null, "o": "#141018", "b": "#3f78c8", "B": "#2b5490", "s": "#eab58c", "w": "#f2f2f8", "g": "#dfe6ef" },
    grid: [
      "................",
      ".....oooo.......",
      "....obbbbo......",
      "...obBssBbo.....",
      "...obsssbo......",
      "...obsssbo......",
      "..obbbbbbo......",
      "..obbwbbo.......",
      ".obbwwwbbo......",
      ".obbwbbbbo......",
      ".obbbbbbbo......",
      ".obBbbbBbo......",
      ".obbbbbbbo......",
      "..obbbbbbo......",
      "..oo...ooo......",
      "................"
    ]
  },
  wolf: {
    pal: { ".": null, "o": "#141018", "f": "#8f949c", "F": "#5f636b", "e": "#ffd23f", "n": "#20242b", "t": "#eef2f6" },
    grid: [
      "................",
      "................",
      ".oo.........oo..",
      ".ffo.......off..",
      ".fffoooooooofffo",
      "offeffffffffFffo",
      "ofnffffffffFFffo",
      "otfffffffffFFffo",
      "offffffffffFFffo",
      ".offo.fff.offo..",
      "..oo..fff..oo...",
      "......ooo.......",
      "................",
      "................",
      "................",
      "................"
    ]
  }
};

// sprite'ı hex merkezine çiz (px = piksel büyüklüğü)
function drawSpriteGrid(ctx, spr, cx, cy, px) {
  const grid = spr.grid, pal = spr.pal;
  const n = 16;
  const ox = Math.round(cx - n * px / 2);
  const oy = Math.round(cy - n * px / 2 - px * 2); // biraz yukarı kaldır
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y];
    for (let x = 0; x < row.length; x++) {
      const col = pal[row[x]];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(ox + x * px, oy + y * px, px, px);
    }
  }
}
