// Köşe Market — bubbles.js
// Dükkân sahnesinin üstündeki problem baloncuğu katmanı: çizim, dokunma, geri bildirim efektleri, kombo.
(function () {
  "use strict";

  const W = 960, H = 540;          // mantıksal sahne
  const MIN_DIST = 64;             // baloncuklar arası en az mesafe (mantıksal px)
  const BOUNDS = { x0: 48, x1: W - 48, y0: 56, y1: H - 64 };
  let minDist = MIN_DIST;          // ekran ölçeğine göre güncellenir (küçük ekranda baloncuklar sahneye göre iridir)
  const view = { x0: 0, x1: W };   // görünen mantıksal x aralığı (Render.setView ile aynı tutulur)

  // Bölgeye göre pastel renkler [açık, koyu]
  const ZONE_COLORS = {
    shelf: ["#ffe3d1", "#ffb999"],
    floor: ["#dcf7e6", "#98dfb4"],
    register: ["#fff4c4", "#ffd66b"],
    door: ["#ece3ff", "#bea9f5"],
    fridge: ["#ddf2ff", "#94cef5"],
    window: ["#e2f5f7", "#a6dbe5"],
    cat: ["#ffe5ef", "#ffaecb"],
  };
  const DEFAULT_COLORS = ["#ffeedd", "#ffc79a"];
  const CONFETTI = ["#ff8fa3", "#ffc94d", "#7fd6a4", "#8ec5ff", "#c7a6ff", "#ffb07a"];

  let layer = null;
  let paused = false;
  const live = new Map();   // id -> { el, b, x, y, age, life, taps, tapsLeft, dying }
  let comboEl = null, comboTimer = 0, lastComboAt = 0, lastComboVal = 0;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pctX = (x) => ((x - view.x0) / (view.x1 - view.x0) * 100) + "%";
  const pctY = (y) => (y / H * 100) + "%";
  const sfx = (name, arg) => {
    if (!Bubbles.sound || typeof Sfx === "undefined" || !Sfx[name]) return;
    try { Sfx[name](arg); } catch (e) {}
  };

  function el(tag, cls, parent, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }

  // Animasyon bitince sil (duraklatılmışsa animasyon da bekler)
  function removeAfterAnim(node, fallbackMs) {
    let done = false;
    const kill = () => { if (!done) { done = true; node.remove(); } };
    node.addEventListener("animationend", (e) => { if (e.target === node) kill(); });
    if (fallbackMs) setTimeout(() => { if (!paused) kill(); else removeAfterAnim(node, fallbackMs); }, fallbackMs);
  }

  function restartAnim(node, cls) {
    node.classList.remove(cls);
    void node.offsetWidth; // reflow → animasyonu baştan başlat
    node.classList.add(cls);
  }

  function isGolden(b) {
    if (b.golden) return true;
    const t = String(b.type || "").toLowerCase();
    return t.includes("gold") || t.includes("altin") || t.includes("altın") || b.emoji === "⭐" || b.emoji === "🌟";
  }

  function typeDef(b) {
    return (typeof BUBBLE_TYPES !== "undefined" && BUBBLE_TYPES && BUBBLE_TYPES[b.type]) || null;
  }

  // Çakışmayı önle: yakın baloncuk varsa sarmal şekilde en yakın boş noktaya kaydır
  function freeSpot(x, y) {
    const ok = (px, py) => {
      for (const o of live.values()) {
        if (o.dying) continue;
        if (Math.hypot(o.x - px, o.y - py) < minDist) return false;
      }
      return true;
    };
    const cx = (v) => clamp(v, BOUNDS.x0, BOUNDS.x1), cy = (v) => clamp(v, BOUNDS.y0, BOUNDS.y1);
    x = cx(x); y = cy(y);
    if (ok(x, y)) return { x, y };
    const start = Math.random() * Math.PI * 2;
    for (let r = 24; r <= 260; r += 16) {
      for (let i = 0; i < 12; i++) {
        const a = start + i * (Math.PI / 6);
        const px = cx(x + Math.cos(a) * r), py = cy(y + Math.sin(a) * r * 0.8);
        if (ok(px, py)) return { x: px, y: py };
      }
    }
    return { x, y }; // yer yoksa olduğu yerde kalsın
  }

  // Katmana göre ölçek (dar ekranda baloncuklar küçülür ama 56px dokunma alanı korunur)
  function applyScale() {
    if (!layer) return;
    const w = layer.clientWidth || W, k = w / (view.x1 - view.x0), s = clamp(k, 0.72, 1.35);
    layer.style.setProperty("--km-s", s.toFixed(3));
    // baloncuk çapı + küçük boşluk, mantıksal px cinsinden
    minDist = Math.max(MIN_DIST, (64 * s + 12) / Math.max(0.1, k));
    // üst: halka + nokta rozeti, alt: etiket hapı sahneden taşmasın (sahne overflow: hidden)
    BOUNDS.y0 = Math.max(56, (32 * s + 16) / Math.max(0.1, k));
    // yan: etiket hapının yarısı (~65px) sahne dışına taşmasın
    const mx = Math.max(48, 66 / Math.max(0.1, k));
    BOUNDS.x0 = view.x0 + mx; BOUNDS.x1 = view.x1 - mx;
    BOUNDS.y1 = H - Math.max(64, (32 * s + 34) / Math.max(0.1, k));
  }

  function buildDots(o) {
    const d = o.dotsEl;
    if (!d) return;
    d.textContent = "";
    for (let i = 0; i < o.taps; i++) el("i", i < o.tapsLeft ? "on" : "", d);
  }

  function floatText(x, y, text, cls, tag) {
    const f = el("div", "km-ftxt " + (cls || ""), layer);
    f.style.left = pctX(x); f.style.top = pctY(y);
    el("span", "km-ftxt-main", f, text);
    if (tag) el("span", "km-ftxt-tag", f, tag);
    removeAfterAnim(f, 2000);
    return f;
  }

  function burst(x, y, golden) {
    const box = el("div", "km-burst", layer);
    box.style.left = pctX(x); box.style.top = pctY(y);
    el("i", "km-shock" + (golden ? " gold" : ""), box);
    const n = golden ? 16 : 11;
    for (let i = 0; i < n; i++) {
      const p = el("i", "km-bit", box);
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const r = 42 + Math.random() * 40;
      p.style.setProperty("--dx", (Math.cos(a) * r).toFixed(1) + "px");
      p.style.setProperty("--dy", (Math.sin(a) * r - 10).toFixed(1) + "px");
      const s = 7 + Math.random() * 7;
      p.style.width = p.style.height = s.toFixed(1) + "px";
      p.style.background = golden && i % 2 ? "#ffd34d" : CONFETTI[(Math.random() * CONFETTI.length) | 0];
      if (i % 4 === 0) p.style.borderRadius = "3px";
      p.style.animationDelay = (Math.random() * 0.05).toFixed(3) + "s";
    }
    removeAfterAnim(box, 1500);
    setTimeout(() => { if (box.isConnected && !paused) box.remove(); }, 1600);
  }

  // Ceza metni: BUBBLE_TYPES[type].penalty'den türet
  function penaltyText(b) {
    const def = typeDef(b);
    const p = (def && def.penalty) || b.penalty || null;
    if (!p || !Object.keys(p).length) return null;
    if (p.lostCustomers) return "müşteri kaçtı";
    if (p.money) return "−₺" + Math.abs(p.money);
    if (p.sat) return "memnuniyet ↓";
    if (p.lostSalesSec) return "satış durdu";
    return "kaçırdın";
  }

  function kill(id) {
    const o = live.get(id);
    if (!o) return null;
    live.delete(id);
    o.dying = true;
    o.el.classList.add("km-dying");
    return o;
  }

  const Bubbles = {
    onTap: null,        // (bubbleId) => {}  — main.js bağlar
    sound: true,        // feedback/expire sırasında Sfx çalsın mı
    autoCombo: true,    // pop sonucunda combo>1 ise comboFlash'ı kendisi çağırsın mı

    init(layerEl) {
      layer = layerEl;
      layer.classList.add("km-layer");
      if (typeof ResizeObserver !== "undefined") new ResizeObserver(applyScale).observe(layer);
      else window.addEventListener("resize", applyScale);
      applyScale();
      // Katmanda sağ tık/uzun basma menüsünü engelle
      layer.addEventListener("contextmenu", (e) => { if (e.target !== layer) e.preventDefault(); });
    },

    // pos: mantıksal {x,y}. Döndürür: gerçekte kullanılan konum
    spawn(b, pos) {
      if (!layer || !b) return null;
      if (live.has(b.id)) return live.get(b.id);
      pos = pos || { x: W / 2, y: H / 2 };
      const { x, y } = freeSpot(pos.x, pos.y);
      const golden = isGolden(b);
      const cols = golden ? ["#fff6c7", "#ffc93c"] : (ZONE_COLORS[b.zone] || DEFAULT_COLORS);

      const root = el("div", "km-bub" + (golden ? " km-gold" : "") + (b.regularId ? " km-regular" : ""), layer);
      root.style.left = pctX(x); root.style.top = pctY(y);
      root.style.setProperty("--c1", cols[0]); root.style.setProperty("--c2", cols[1]);
      root.style.setProperty("--bob-d", (-Math.random() * 2.4).toFixed(2) + "s");
      root.dataset.id = b.id;
      root.setAttribute("role", "button");
      root.setAttribute("aria-label", b.label || "sorun");

      const flo = el("div", "km-float", root);
      const shake = el("div", "km-shake", flo);
      const body = el("div", "km-body km-in", shake);
      const ring = el("div", "km-ring", body);
      const core = el("div", "km-core", body);
      el("span", "km-emoji", core, b.emoji || "❗");
      let dotsEl = null;
      const taps = Math.max(1, b.taps || 1);
      if (taps > 1) dotsEl = el("div", "km-dots", body);
      if (golden) {
        const sp = el("div", "km-sparks", body);
        for (let i = 0; i < 4; i++) el("i", "", sp, "✦");
      }
      if (b.label) el("div", "km-label", flo, b.label);

      const o = {
        id: b.id, el: root, body, ring, dotsEl, b, x, y, golden,
        age: b.age || 0, life: b.life || 5, taps, tapsLeft: b.tapsLeft != null ? b.tapsLeft : taps, dying: false,
      };
      live.set(b.id, o);
      buildDots(o);
      Bubbles._paint(o);

      root.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (paused || o.dying) return;
        restartAnim(o.body, "km-press");
        if (typeof Bubbles.onTap === "function") Bubbles.onTap(b.id);
      });
      body.addEventListener("animationend", (e) => {
        if (e.target === body && e.animationName === "km-pop-in") body.classList.remove("km-in");
      });
      return o;
    },

    // Ömür halkası + aciliyet
    _paint(o) {
      const frac = clamp(1 - o.age / o.life, 0, 1);
      const col = o.golden ? "#f5a800" : frac > 0.5 ? "#54c386" : frac > 0.25 ? "#f2b134" : "#ef6b5b";
      o.ring.style.setProperty("--p", frac.toFixed(4));
      o.ring.style.setProperty("--rc", col);
      const urgent = (o.life - o.age) <= 1 && frac > 0;
      if (urgent !== o.urgent) { o.urgent = urgent; o.el.classList.toggle("km-urgent", urgent); }
    },

    update(dt) {
      if (paused || !layer) return;
      const run = (typeof Game !== "undefined" && Game && Game.run && Game.run.bubbles) || null;
      for (const o of live.values()) {
        const src = run && run[o.id];
        if (src && typeof src.age === "number") {
          o.age = src.age; if (src.life) o.life = src.life;
        } else {
          o.age += dt || 0;
        }
        this._paint(o);
      }
    },

    feedback(id, result) {
      if (!result) return;
      const o = live.get(id);
      if (!o) return;
      if (result.popped) {
        kill(id);
        burst(o.x, o.y, o.golden);
        const combo = result.combo || 1;
        const tag = combo > 1.001 ? "x" + combo.toFixed(1) : null;
        floatText(o.x, o.y - 30, "+₺" + (result.reward || 0), o.golden ? "gold" : "", tag);
        restartAnim(o.el, "km-popped");
        removeAfterAnim(o.el, 600);
        sfx("pop", combo);
        if (result.reward) setTimeout(() => sfx("coin"), 60);
        if (this.autoCombo && combo > 1.001) this.comboFlash(combo);
      } else {
        o.tapsLeft = result.tapsLeft != null ? result.tapsLeft : Math.max(0, o.tapsLeft - 1);
        buildDots(o);
        restartAnim(o.body, "km-squish");
        const dot = o.dotsEl && o.dotsEl.children[o.tapsLeft];
        if (dot) restartAnim(dot, "km-dot-pop");
        sfx("tap");
      }
    },

    expire(id, autoSolved) {
      const o = kill(id);
      if (!o) return;
      if (autoSolved) {
        restartAnim(o.el, "km-solved");
        floatText(o.x, o.y - 26, "🧑‍🍳 halletti", "helper");
      } else {
        const txt = penaltyText(o.b);
        restartAnim(o.el, txt ? "km-deflate" : "km-fade");
        if (txt) { floatText(o.x, o.y - 26, txt[0] === "−" ? txt : "− " + txt, "bad"); sfx("miss"); }
      }
      removeAfterAnim(o.el, 1200);
    },

    comboFlash(combo) {
      if (!layer || !combo) return;
      const now = performance.now();
      if (Math.abs(combo - lastComboVal) < 0.001 && now - lastComboAt < 200) return; // çift çağrıyı yut
      lastComboAt = now; lastComboVal = combo;
      if (!comboEl || !comboEl.isConnected) {
        comboEl = el("div", "km-combo", layer);
        el("span", "km-combo-txt", comboEl);
      }
      const t = clamp((combo - 1) / 1, 0, 1);      // 0 → x1.0, 1 → x2.0
      comboEl.style.setProperty("--h", (48 - t * 48).toFixed(0));  // sarı → turuncu → pembe-kırmızı
      comboEl.style.setProperty("--k", (1 + t * 0.35).toFixed(3));
      comboEl.classList.toggle("km-max", combo >= 1.999);
      comboEl.firstChild.textContent = (combo >= 1.999 ? "🔥 " : "") + "Kombo x" + combo.toFixed(1) + "!";
      restartAnim(comboEl, "km-show");
      clearTimeout(comboTimer);
      comboTimer = setTimeout(function hide() {
        if (paused) { comboTimer = setTimeout(hide, 300); return; }
        comboEl && comboEl.classList.remove("km-show");
      }, 1100);
    },

    clear() {
      live.clear();
      if (!layer) return;
      layer.querySelectorAll(".km-bub, .km-ftxt, .km-burst").forEach((n) => n.remove());
      if (comboEl) comboEl.classList.remove("km-show");
    },

    // Görünen mantıksal x aralığı (Render.setView ile birlikte çağrılır)
    setView(x0, x1) {
      view.x0 = x0; view.x1 = x1;
      applyScale();   // BOUNDS'u da günceller
      for (const o of live.values()) {
        o.x = clamp(o.x, BOUNDS.x0, BOUNDS.x1);
        o.el.style.left = pctX(o.x);
      }
    },

    setPaused(b) {
      paused = !!b;
      if (layer) layer.classList.toggle("km-paused", paused);
    },

    get paused() { return paused; },
    count() { return live.size; },
    has(id) { return live.has(id); },
  };

  window.Bubbles = Bubbles;
})();
