// Köşe Market — sfx.js
// WebAudio osilatörleriyle minik, yumuşak sesler (dosya yok). AudioContext ilk kullanıcı etkileşiminde açılır.
(function () {
  "use strict";
  const MUTE_KEY = "koseMarket.muted";
  const MASTER_VOL = 0.22;

  let ctx = null, master = null, failed = false;

  function readMuted() {
    try { return localStorage.getItem(MUTE_KEY) === "1"; } catch (e) { return false; }
  }

  // Bağlamı tembel oluştur; ses yoksa sessizce vazgeç
  function ensure() {
    if (failed) return null;
    if (!ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) { failed = true; return null; }
        ctx = new AC();
        // Yumuşatma: hafif alçak geçiren filtre + master kazanç
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass"; lp.frequency.value = 5200; lp.Q.value = 0.3;
        master = ctx.createGain();
        master.gain.value = MASTER_VOL;
        master.connect(lp); lp.connect(ctx.destination);
      } catch (e) { failed = true; ctx = null; return null; }
    }
    if (ctx.state === "suspended") { try { ctx.resume(); } catch (e) {} }
    return ctx;
  }

  // İlk dokunuş/tuşta bağlamı aç (tarayıcı otomatik çalma kuralı)
  function unlock() {
    ensure();
    window.removeEventListener("pointerdown", unlock, true);
    window.removeEventListener("keydown", unlock, true);
  }
  if (typeof window !== "undefined") {
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
  }

  // Tek nota: osilatör + zarf. opts: {type, freq, to, dur, vol, attack, delay, glide}
  function tone(o) {
    const c = ensure();
    if (!c || Sfx.muted) return;
    try {
      const t0 = c.currentTime + (o.delay || 0);
      const dur = o.dur || 0.15;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = o.type || "sine";
      osc.frequency.setValueAtTime(o.freq, t0);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + (o.glide || dur * 0.6));
      const vol = o.vol == null ? 0.5 : o.vol;
      const att = o.attack || 0.006;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + att);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g); g.connect(master);
      osc.start(t0); osc.stop(t0 + dur + 0.05);
    } catch (e) { /* sessizce yut */ }
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const Sfx = {
    muted: readMuted(),

    setMuted(b) {
      Sfx.muted = !!b;
      try { localStorage.setItem(MUTE_KEY, Sfx.muted ? "1" : "0"); } catch (e) {}
      if (master && ctx) { try { master.gain.setTargetAtTime(Sfx.muted ? 0 : MASTER_VOL, ctx.currentTime, 0.02); } catch (e) {} }
    },
    toggle() { Sfx.setMuted(!Sfx.muted); return Sfx.muted; },

    // Baloncuk "blup" — kombo arttıkça perde yükselir (x1.0 → x2.0 ≈ +bir oktav)
    pop(combo) {
      const k = 1 + (clamp(combo || 1, 1, 2.5) - 1) * 0.9;
      const f = 330 * k;
      tone({ type: "sine", freq: f, to: f * 2.1, glide: 0.07, dur: 0.14, vol: 0.55 });
      tone({ type: "triangle", freq: f * 2, to: f * 3, glide: 0.05, dur: 0.08, vol: 0.12, delay: 0.01 });
    },
    // Çok dokunuşlu baloncuğa ara basış — daha kısık, alçak "pıt"
    tap() {
      tone({ type: "sine", freq: 260, to: 420, glide: 0.05, dur: 0.09, vol: 0.35 });
    },
    // Para şıngırtısı — iki parlak nota
    coin() {
      tone({ type: "triangle", freq: 1318, dur: 0.09, vol: 0.18, delay: 0.03 });
      tone({ type: "triangle", freq: 1760, dur: 0.22, vol: 0.16, delay: 0.1 });
    },
    // Kaçırma — yumuşak, aşağı süzülen "üüh"
    miss() {
      tone({ type: "sine", freq: 330, to: 196, glide: 0.28, dur: 0.32, vol: 0.32, attack: 0.02 });
      tone({ type: "triangle", freq: 247, to: 147, glide: 0.3, dur: 0.3, vol: 0.06, attack: 0.02 });
    },
    // Seviye atlama — küçük arpej
    levelUp() {
      [523, 659, 784, 1047, 1319].forEach((f, i) =>
        tone({ type: "triangle", freq: f, dur: i === 4 ? 0.5 : 0.18, vol: 0.28, delay: i * 0.085 }));
      tone({ type: "sine", freq: 2093, dur: 0.6, vol: 0.06, delay: 0.42 });
    },
    // Dükkân kapısı zili: ding-ding (çan: temel + inharmonik kısmi)
    dayStart() {
      const bell = (f, d) => {
        tone({ type: "sine", freq: f, dur: 1.1, vol: 0.32, delay: d, attack: 0.004 });
        tone({ type: "sine", freq: f * 2.76, dur: 0.45, vol: 0.07, delay: d, attack: 0.004 });
        tone({ type: "sine", freq: f * 5.4, dur: 0.18, vol: 0.03, delay: d, attack: 0.002 });
      };
      bell(1319, 0); bell(1047, 0.22);
    },
    // Gün bitti — yavaş, inen üç nota
    dayEnd() {
      [784, 659, 523].forEach((f, i) =>
        tone({ type: "sine", freq: f, dur: i === 2 ? 0.8 : 0.35, vol: 0.28, delay: i * 0.18, attack: 0.02 }));
      tone({ type: "triangle", freq: 262, dur: 0.9, vol: 0.08, delay: 0.36, attack: 0.03 });
    },
    // Arayüz tıkı
    click() {
      tone({ type: "sine", freq: 880, to: 1200, glide: 0.02, dur: 0.05, vol: 0.2 });
    },
  };

  window.Sfx = Sfx;
})();
