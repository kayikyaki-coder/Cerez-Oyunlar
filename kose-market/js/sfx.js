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

  // ---------- gürültü (ambiyans, süpürme sesleri) ----------
  let noiseBuffer = null;
  function noiseBuf(c) {
    if (noiseBuffer) return noiseBuffer;
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    noiseBuffer = buf; return buf;
  }
  // Filtreli gürültü süpürmesi: from→to Hz (bandpass), dur sn
  function sweep(o) {
    const c = ensure();
    if (!c || Sfx.muted) return;
    try {
      const t0 = c.currentTime + (o.delay || 0), dur = o.dur || 0.3;
      const src = c.createBufferSource(); src.buffer = noiseBuf(c);
      const f = c.createBiquadFilter(); f.type = o.type || "bandpass"; f.Q.value = o.q || 0.8;
      f.frequency.setValueAtTime(o.from, t0); f.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(o.vol || 0.2, t0 + (o.attack || 0.03)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f); f.connect(g); g.connect(master);
      src.start(t0, Math.random()); src.stop(t0 + dur + 0.05);
    } catch (e) { /* sessizce yut */ }
  }

  // Ortam sesi: hava durumuna göre tek döngü; sessize alınınca ya da sekme gizlenince durur
  let amb = null, ambKind = null;
  function stopAmbNodes() {
    if (!amb) return;
    const a = amb; amb = null;
    try {
      if (a.timer) clearInterval(a.timer);
      if (a.gain && ctx) { a.gain.gain.cancelScheduledValues(ctx.currentTime); a.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15); }
      setTimeout(() => { try { a.nodes.forEach(n => { if (n.stop) n.stop(); n.disconnect(); }); if (a.gain) a.gain.disconnect(); } catch (e) {} }, 700);
    } catch (e) { /* yut */ }
  }
  function startAmb(kind) {
    stopAmbNodes();
    if (Sfx.muted) return;
    const c = ensure(); if (!c) return;
    try {
      const nodes = []; let timer = 0;
      const out = c.createGain(); out.gain.setValueAtTime(0.0001, c.currentTime); out.connect(master);
      const noise = (freq, vol, type) => {
        const src = c.createBufferSource(); src.buffer = noiseBuf(c); src.loop = true;
        const f = c.createBiquadFilter(); f.type = type || "lowpass"; f.frequency.value = freq;
        src.connect(f); f.connect(out); src.start(); nodes.push(src, f);
        out.gain.setTargetAtTime(vol, c.currentTime, 0.6);
        return f;
      };
      if (kind === "rain") noise(900, 0.05);
      else if (kind === "snow") noise(380, 0.018);
      else if (kind === "wind") {
        noise(400, 0.05);
        const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.22; lg.gain.value = 0.03; lfo.connect(lg); lg.connect(out.gain); lfo.start(); nodes.push(lfo, lg);
      } else if (kind === "hot") {
        out.gain.setTargetAtTime(1, c.currentTime, 0.2);
        timer = setInterval(() => { if (Sfx.muted) return; const f = 3900 + Math.random() * 300; [0, 0.07, 0.14].forEach(d => tone({ type: "sine", freq: f, dur: 0.035, vol: 0.025, delay: d, attack: 0.002 })); }, 1200);
      } else { out.disconnect(); return; }
      amb = { kind, nodes, gain: out, timer };
    } catch (e) { amb = null; }
  }
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (!ctx) return;
      try { if (document.hidden) ctx.suspend(); else if (ctx.state === "suspended") ctx.resume(); } catch (e) {}
    });
  }

  const Sfx = {
    muted: readMuted(),

    setMuted(b) {
      Sfx.muted = !!b;
      try { localStorage.setItem(MUTE_KEY, Sfx.muted ? "1" : "0"); } catch (e) {}
      if (master && ctx) { try { master.gain.setTargetAtTime(Sfx.muted ? 0 : MASTER_VOL, ctx.currentTime, 0.02); } catch (e) {} }
      if (Sfx.muted) stopAmbNodes(); else if (ambKind && !amb) startAmb(ambKind);
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
      Sfx.whoosh();                       // perde açılır
      bell(1319, 0.12); bell(1047, 0.34);
    },
    // Gün bitti — yavaş, inen üç nota; 1 sn sonra kepenk "şrrk"
    dayEnd() {
      [784, 659, 523].forEach((f, i) =>
        tone({ type: "sine", freq: f, dur: i === 2 ? 0.8 : 0.35, vol: 0.28, delay: i * 0.18, attack: 0.02 }));
      tone({ type: "triangle", freq: 262, dur: 0.9, vol: 0.08, delay: 0.36, attack: 0.03 });
      Sfx.shutter(1.0);
      Sfx.stopAmbient();
    },
    // Arayüz tıkı
    click() {
      tone({ type: "sine", freq: 880, to: 1200, glide: 0.02, dur: 0.05, vol: 0.2 });
    },

    // ---- Sahne sesleri (render.js olaylarından çağrılır; hepsi sessiz-güvenli) ----
    // Müşteri girişinde kısa kapı zili: ~1 kHz, 0,25 sn
    bell() {
      tone({ type: "sine", freq: 1046, dur: 0.25, vol: 0.18, attack: 0.004 });
      tone({ type: "sine", freq: 1046 * 2.76, dur: 0.1, vol: 0.035, attack: 0.003 });
    },
    // Rüzgârda sallanan zil: daha yumuşak
    bellSoft() {
      tone({ type: "sine", freq: 1175, dur: 0.3, vol: 0.07, attack: 0.01 });
      tone({ type: "sine", freq: 1568, dur: 0.22, vol: 0.04, attack: 0.01, delay: 0.05 });
    },
    // Raftan ürün alınca küçük "tık"
    shelf() {
      tone({ type: "triangle", freq: 220, to: 150, glide: 0.04, dur: 0.05, vol: 0.2, attack: 0.002 });
    },
    // Kasa "çın-çın" (coin'in kısası)
    register() {
      tone({ type: "triangle", freq: 1568, dur: 0.06, vol: 0.15, attack: 0.002 });
      tone({ type: "triangle", freq: 2093, dur: 0.16, vol: 0.13, delay: 0.06, attack: 0.002 });
    },
    // Pamuk mırıltısı: 60 Hz sine + tremolo, 0,4 sn
    purr() {
      const c = ensure();
      if (!c || Sfx.muted) return;
      try {
        const t0 = c.currentTime, dur = 0.5;
        const osc = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
        osc.type = "sine"; osc.frequency.value = 62; lfo.frequency.value = 24; lg.gain.value = 0.22;
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.32, t0 + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        lfo.connect(lg); lg.connect(g.gain); osc.connect(g); g.connect(master);
        osc.start(t0); lfo.start(t0); osc.stop(t0 + dur + 0.05); lfo.stop(t0 + dur + 0.05);
        // alçak frekans küçük hoparlörde duyulmaz: bir oktav üstte yumuşak eşlik
        tone({ type: "sine", freq: 124, dur: dur * 0.9, vol: 0.12, attack: 0.08 });
      } catch (e) { /* yut */ }
    },
    // Gün başı perde "vuu"
    whoosh(delay) {
      sweep({ from: 300, to: 1800, dur: 0.35, vol: 0.12, delay: delay || 0, attack: 0.12 });
    },
    // Kepenk inerken "şrrk": aşağı süpüren gürültü
    shutter(delay) {
      sweep({ from: 2600, to: 380, dur: 0.55, vol: 0.12, delay: delay || 0, q: 1.1 });
    },
    // Hava ortamı: "rain" | "snow" | "wind" | "hot"; diğerleri sessiz
    ambient(kind) {
      ambKind = kind || null;
      if (!ambKind || ambKind === "sun" || ambKind === "cloud" || ambKind === "fog") { stopAmbNodes(); return; }
      startAmb(ambKind);
    },
    stopAmbient() { ambKind = null; stopAmbNodes(); },
  };

  window.Sfx = Sfx;
})();
