// audio.js — WebAudio ile tamamen sentezlenmiş ses efektleri ve müzik (ses dosyası yok)
// Audio.play(name), Audio.music(track), Audio.setMuted(bool), Audio.muted
// Hiçbir durumda hata fırlatmaz; AudioContext yoksa sessizce çalışmaz.

const Audio = (function () {
  let ctx = null, master = null, sfxGain = null, musicGain = null;
  let muted = false, ok = true, gestured = false;
  let pendingTrack = null, currentTrack = "none";
  let seqTimer = null, seqNext = 0, seqStep = 0;

  // ses seviyeleri (0..1); localStorage'da saklanır
  let sfxVol = 0.75, musicVol = 0.5;
  const SFX_MAX = 0.6, MUSIC_MAX = 0.32;
  try {
    muted = localStorage.getItem("tbw_muted") === "1";
    const a = parseFloat(localStorage.getItem("tbw_sfx")), b = parseFloat(localStorage.getItem("tbw_music"));
    if (!isNaN(a)) sfxVol = Math.max(0, Math.min(1, a));
    if (!isNaN(b)) musicVol = Math.max(0, Math.min(1, b));
  } catch (e) { /* yok say */ }

  function ensure() {
    try {
      if (!ok) return null;
      if (!ctx && !gestured) return null; // kullanıcı etkileşimi olmadan bağlam açma (autoplay uyarısı)
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) { ok = false; return null; }
        ctx = new AC();
        master = ctx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(ctx.destination);
        sfxGain = ctx.createGain(); sfxGain.gain.value = sfxVol * SFX_MAX; sfxGain.connect(master);
        musicGain = ctx.createGain(); musicGain.gain.value = musicVol * MUSIC_MAX; musicGain.connect(master);
      }
      if (ctx.state === "suspended") { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); }
      return ctx;
    } catch (e) { ok = false; return null; }
  }

  // ilk kullanıcı etkileşiminde bağlamı başlat / devam ettir
  function onFirstInteraction() {
    gestured = true;
    const c = ensure();
    if (c && pendingTrack) { const t = pendingTrack; pendingTrack = null; music(t); }
  }
  try {
    ["pointerdown", "keydown", "touchstart"].forEach(ev =>
      window.addEventListener(ev, onFirstInteraction, { passive: true }));
  } catch (e) { /* yok say */ }

  // ---------- temel sentez yardımcıları ----------
  function tone(opt) {
    // opt: {f, f2, t0, dur, type, vol, attack, decay, dest}
    try {
      const c = ensure(); if (!c) return;
      const o = c.createOscillator(), g = c.createGain();
      const t0 = opt.t0 != null ? opt.t0 : c.currentTime;
      const dur = opt.dur || 0.1, vol = opt.vol != null ? opt.vol : 0.3;
      o.type = opt.type || "square";
      o.frequency.setValueAtTime(opt.f, t0);
      if (opt.f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, opt.f2), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + (opt.attack || 0.005));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(opt.dest || sfxGain);
      o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) { /* yok say */ }
  }
  let noiseBuf = null;
  function noise(opt) {
    // opt: {t0, dur, vol, hp, lp, lp2}
    try {
      const c = ensure(); if (!c) return;
      if (!noiseBuf) {
        noiseBuf = c.createBuffer(1, c.sampleRate * 1, c.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const s = c.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const g = c.createGain();
      const t0 = opt.t0 != null ? opt.t0 : c.currentTime, dur = opt.dur || 0.1, vol = opt.vol != null ? opt.vol : 0.3;
      let node = s;
      if (opt.lp) { const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.setValueAtTime(opt.lp, t0); if (opt.lp2) f.frequency.exponentialRampToValueAtTime(opt.lp2, t0 + dur); node.connect(f); node = f; }
      if (opt.hp) { const f = c.createBiquadFilter(); f.type = "highpass"; f.frequency.value = opt.hp; node.connect(f); node = f; }
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + (opt.attack || 0.005));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      node.connect(g); g.connect(sfxGain);
      s.start(t0); s.stop(t0 + dur + 0.02);
    } catch (e) { /* yok say */ }
  }
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  function now() { const c = ensure(); return c ? c.currentTime : 0; }

  // ---------- ses efektleri ----------
  const SFX = {
    click() { tone({ f: 900, f2: 700, dur: 0.05, type: "square", vol: 0.12 }); },
    move() {
      const t = now();
      noise({ t0: t, dur: 0.07, vol: 0.18, lp: 900, lp2: 300 });
      noise({ t0: t + 0.11, dur: 0.07, vol: 0.14, lp: 700, lp2: 250 });
    },
    hit() {
      const t = now();
      noise({ t0: t, dur: 0.12, vol: 0.35, lp: 2400, lp2: 200 });
      tone({ f: 160, f2: 50, t0: t, dur: 0.16, type: "triangle", vol: 0.35 });
    },
    miss() {
      const t = now();
      noise({ t0: t, dur: 0.22, vol: 0.16, hp: 600, lp: 5000, lp2: 900, attack: 0.05 });
      tone({ f: 520, f2: 260, t0: t + 0.02, dur: 0.18, type: "sine", vol: 0.08 });
    },
    crit() {
      const t = now();
      noise({ t0: t, dur: 0.16, vol: 0.4, lp: 3200, lp2: 200 });
      tone({ f: 140, f2: 40, t0: t, dur: 0.22, type: "sawtooth", vol: 0.3 });
      tone({ f: 1400, f2: 2200, t0: t + 0.03, dur: 0.12, type: "square", vol: 0.12 });
      tone({ f: 2100, f2: 3000, t0: t + 0.1, dur: 0.16, type: "square", vol: 0.08 });
    },
    heal() {
      const t = now();
      [72, 76, 79, 84].forEach((n, i) => tone({ f: midi(n), t0: t + i * 0.07, dur: 0.22, type: "sine", vol: 0.16, attack: 0.02 }));
    },
    spell() {
      const t = now();
      tone({ f: 220, f2: 1400, t0: t, dur: 0.3, type: "sawtooth", vol: 0.1, attack: 0.05 });
      tone({ f: 330, f2: 2100, t0: t + 0.05, dur: 0.3, type: "square", vol: 0.06, attack: 0.05 });
      noise({ t0: t + 0.15, dur: 0.25, vol: 0.1, hp: 2500, lp: 8000, lp2: 3000 });
    },
    death() {
      const t = now();
      tone({ f: 300, f2: 40, t0: t, dur: 0.5, type: "sawtooth", vol: 0.2 });
      noise({ t0: t, dur: 0.4, vol: 0.2, lp: 1200, lp2: 100 });
    },
    victory() {
      const t = now();
      [[67, 0], [72, 0.12], [76, 0.24], [79, 0.36], [84, 0.55]].forEach(([n, d], i) =>
        tone({ f: midi(n), t0: t + d, dur: i === 4 ? 0.7 : 0.16, type: "square", vol: 0.14, attack: 0.01 }));
      [[60, 0.55], [64, 0.55], [67, 0.55]].forEach(([n, d]) => tone({ f: midi(n), t0: t + d, dur: 0.7, type: "triangle", vol: 0.12 }));
    },
    defeat() {
      const t = now();
      [[64, 0], [63, 0.3], [62, 0.6], [57, 0.9]].forEach(([n, d], i) =>
        tone({ f: midi(n), t0: t + d, dur: i === 3 ? 1.1 : 0.34, type: "triangle", vol: 0.16, attack: 0.03 }));
      tone({ f: midi(45), t0: t + 0.9, dur: 1.2, type: "sawtooth", vol: 0.08, attack: 0.1 });
    },
    levelup() {
      const t = now();
      [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => tone({ f: midi(n), t0: t + i * 0.06, dur: 0.14, type: "square", vol: 0.1 }));
      [72, 76, 79, 84].forEach(n => tone({ f: midi(n), t0: t + 0.45, dur: 0.8, type: "triangle", vol: 0.1, attack: 0.02 }));
    },
    coin() {
      const t = now();
      tone({ f: midi(88), t0: t, dur: 0.08, type: "square", vol: 0.1 });
      tone({ f: midi(93), t0: t + 0.07, dur: 0.25, type: "square", vol: 0.1 });
    },
    turn() {
      const t = now();
      tone({ f: midi(72), t0: t, dur: 0.08, type: "triangle", vol: 0.12 });
      tone({ f: midi(79), t0: t + 0.08, dur: 0.14, type: "triangle", vol: 0.12 });
    }
  };

  function play(name) {
    try {
      if (muted) return;
      const c = ensure(); if (!c || c.state !== "running") return;
      const fn = SFX[name]; if (fn) fn();
    } catch (e) { /* yok say */ }
  }

  // ---------- müzik (adım sıralayıcı) ----------
  // Her parça: bpm, step = 1/8 nota; bass/arp/lead dizileri MIDI notaları (null = sus).
  // battle/boss: 2 bölümlü (A+B), 64 adım; title/camp 32; ending 64.
  const N = null;
  const TRACKS = {
    title: {
      bpm: 96, bassType: "triangle", arpType: "square", bassVol: 0.5, arpVol: 0.22, leadVol: 0.25, leadType: "triangle",
      bass: [38, N, N, N, 38, N, 45, N, 41, N, N, N, 41, N, 43, N,
             36, N, N, N, 36, N, 43, N, 41, N, N, N, 43, N, 45, N],
      arp:  [62, 65, 69, 65, 62, 65, 69, 72, 65, 69, 72, 69, 65, 69, 72, 76,
             60, 64, 67, 64, 60, 64, 67, 72, 65, 69, 72, 69, 67, 71, 74, 71],
      lead: [N, N, N, N, 74, N, 72, N, 69, N, N, N, N, N, N, N,
             N, N, 72, N, 74, N, 76, N, 72, N, N, N, N, N, N, N]
    },
    battle: {
      bpm: 138, bassType: "sawtooth", arpType: "square", bassVol: 0.42, arpVol: 0.18, leadVol: 0.2, leadType: "square", drums: true,
      bass: [40, 40, N, 40, 40, N, 43, N, 38, 38, N, 38, 38, N, 41, N,
             40, 40, N, 40, 40, N, 47, N, 46, 46, N, 46, 45, N, 43, N,
             // B bölümü: bir tam ton yukarı, daha gergin
             43, 43, N, 43, 43, N, 46, N, 41, 41, N, 41, 41, N, 45, N,
             43, 43, N, 43, 43, N, 50, N, 48, N, 47, N, 46, N, 45, 44],
      arp:  [64, 67, 71, 67, 64, 67, 71, 74, 62, 65, 69, 65, 62, 65, 69, 74,
             64, 67, 71, 67, 64, 67, 71, 76, 70, 74, 77, 74, 69, 72, 76, 72,
             67, 70, 74, 70, 67, 70, 74, 79, 65, 68, 72, 68, 65, 68, 72, 77,
             67, 70, 74, 70, 67, 70, 74, 79, 72, 75, 79, 75, 70, 74, 77, 74],
      lead: [76, N, N, 74, N, 71, N, N, 74, N, N, 72, N, 69, N, N,
             76, N, 79, N, 76, N, 74, N, 77, N, 76, N, 74, N, 71, N,
             79, N, N, 77, N, 74, N, N, 77, N, N, 75, N, 72, N, N,
             79, N, 82, N, 79, N, 77, N, 80, N, 79, N, 77, N, 75, 74]
    },
    boss: {
      bpm: 150, bassType: "sawtooth", arpType: "sawtooth", bassVol: 0.45, arpVol: 0.14, leadVol: 0.22, leadType: "square", drums: true,
      bass: [36, 36, 36, N, 36, 36, 42, N, 36, 36, 36, N, 35, N, 34, N,
             36, 36, 36, N, 36, 36, 43, N, 41, 41, N, 41, 40, N, 39, N,
             // B: yarım tonlu "düşüş", kromatik inen bas
             39, 39, 39, N, 39, 39, 45, N, 38, 38, 38, N, 37, N, 36, N,
             34, 34, N, 34, 35, 35, N, 35, 36, 36, N, 36, 42, N, 41, 40],
      arp:  [60, 63, 66, 63, 60, 63, 66, 72, 60, 63, 66, 63, 59, 62, 65, 62,
             60, 63, 67, 63, 60, 63, 67, 72, 65, 68, 72, 68, 64, 67, 70, 67,
             63, 66, 69, 66, 63, 66, 69, 75, 62, 65, 68, 65, 61, 64, 67, 64,
             58, 61, 64, 61, 59, 62, 65, 62, 60, 63, 66, 63, 66, 69, 72, 69],
      lead: [N, N, 72, N, 75, N, 72, N, 78, N, N, 77, N, 75, N, 72,
             N, N, 72, N, 75, N, 79, N, 77, N, 75, N, 72, N, 70, N,
             N, N, 75, N, 78, N, 75, N, 81, N, N, 80, N, 78, N, 75,
             N, 74, N, 73, N, 72, N, 71, 72, N, N, N, 78, N, 77, 76]
    },
    camp: {
      bpm: 76, bassType: "sine", arpType: "triangle", bassVol: 0.55, arpVol: 0.2, leadVol: 0.18, leadType: "sine",
      bass: [43, N, N, N, N, N, 50, N, 40, N, N, N, N, N, 47, N,
             45, N, N, N, N, N, 52, N, 38, N, N, N, 43, N, N, N],
      arp:  [67, 71, 74, 78, 74, 71, 67, 71, 64, 67, 71, 74, 71, 67, 64, 67,
             69, 72, 76, 79, 76, 72, 69, 72, 62, 66, 69, 74, 69, 66, 62, 66],
      lead: [N, N, N, N, 79, N, 78, N, N, N, N, N, 76, N, N, N,
             N, N, N, N, 81, N, 79, N, N, N, 78, N, 76, N, N, N]
    },
    ending: {
      bpm: 88, bassType: "triangle", arpType: "triangle", bassVol: 0.5, arpVol: 0.2, leadVol: 0.26, leadType: "square",
      bass: [41, N, N, N, 48, N, N, N, 36, N, N, N, 43, N, N, N,
             38, N, N, N, 45, N, N, N, 43, N, N, N, 43, N, 45, N,
             41, N, N, N, 48, N, N, N, 36, N, N, N, 43, N, N, N,
             38, N, N, N, 45, N, N, N, 41, N, N, N, 41, N, N, N],
      arp:  [65, 69, 72, 77, 72, 69, 65, 69, 60, 64, 67, 72, 67, 64, 60, 64,
             62, 65, 69, 74, 69, 65, 62, 65, 67, 71, 74, 79, 74, 71, 67, 71,
             65, 69, 72, 77, 72, 69, 65, 69, 60, 64, 67, 72, 67, 64, 60, 64,
             62, 65, 69, 74, 69, 65, 62, 65, 65, 69, 72, 77, 81, 77, 72, 69],
      lead: [77, N, N, N, 79, N, 81, N, 79, N, N, N, 76, N, N, N,
             74, N, N, N, 77, N, 76, N, 74, N, N, N, N, N, N, N,
             77, N, N, N, 79, N, 81, N, 84, N, N, N, 81, N, N, N,
             79, N, N, N, 77, N, 76, N, 77, N, N, N, N, N, N, N]
    }
  };

  function scheduleStep(tr, step, t) {
    const n = tr.bass.length, i = step % n;
    const stepDur = 60 / tr.bpm / 2;
    const b = tr.bass[i];
    if (b != null) tone({ f: midi(b), t0: t, dur: stepDur * 0.9, type: tr.bassType, vol: tr.bassVol, attack: 0.01, dest: musicGain });
    const a = tr.arp[i];
    if (a != null) tone({ f: midi(a), t0: t, dur: stepDur * 0.6, type: tr.arpType, vol: tr.arpVol, attack: 0.005, dest: musicGain });
    const l = tr.lead && tr.lead[i];
    if (l != null) tone({ f: midi(l), t0: t, dur: stepDur * 1.6, type: tr.leadType, vol: tr.leadVol, attack: 0.02, dest: musicGain });
    if (tr.drums) {
      try {
        const c = ctx;
        if (i % 4 === 0) { // kick
          const o = c.createOscillator(), g = c.createGain();
          o.type = "sine"; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
          g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
          o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + 0.16);
        }
        if (i % 8 === 4) { // snare (gürültü) — sfx yerine müzik kanalına
          const s = c.createBufferSource(); s.buffer = noiseBuf || (noise({ dur: 0.001, vol: 0.0001 }), noiseBuf);
          if (s.buffer) {
            const g = c.createGain(), f = c.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 1800;
            g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
            s.connect(f); f.connect(g); g.connect(musicGain); s.start(t); s.stop(t + 0.12);
          }
        }
      } catch (e) { /* yok say */ }
    }
  }

  function stopSeq() {
    if (seqTimer) { clearInterval(seqTimer); seqTimer = null; }
  }

  function music(track) {
    try {
      track = track || "none";
      if (track === "none") { stopSeq(); currentTrack = "none"; pendingTrack = null; return; }
      if (!TRACKS[track]) { stopSeq(); currentTrack = "none"; return; }
      const c = ensure();
      if (!c || c.state !== "running") { pendingTrack = track; currentTrack = track; stopSeq(); return; }
      if (currentTrack === track && seqTimer) return;
      stopSeq();
      currentTrack = track;
      const tr = TRACKS[track];
      const stepDur = 60 / tr.bpm / 2;
      seqStep = 0; seqNext = c.currentTime + 0.05;
      seqTimer = setInterval(() => {
        try {
          if (muted) { seqNext = Math.max(seqNext, c.currentTime + 0.05); return; }
          while (seqNext < c.currentTime + 0.25) {
            scheduleStep(tr, seqStep, seqNext);
            seqNext += stepDur; seqStep++;
          }
        } catch (e) { stopSeq(); }
      }, 60);
    } catch (e) { /* yok say */ }
  }

  function setMuted(v) {
    muted = !!v;
    try { localStorage.setItem("tbw_muted", muted ? "1" : "0"); } catch (e) { /* yok say */ }
    try { if (master) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.02); } catch (e) { /* yok say */ }
  }

  function setSfxVolume(v) {
    sfxVol = Math.max(0, Math.min(1, +v || 0));
    try { localStorage.setItem("tbw_sfx", String(sfxVol)); } catch (e) { /* yok say */ }
    try { if (sfxGain) sfxGain.gain.setTargetAtTime(sfxVol * SFX_MAX, ctx.currentTime, 0.02); } catch (e) { /* yok say */ }
  }
  function setMusicVolume(v) {
    musicVol = Math.max(0, Math.min(1, +v || 0));
    try { localStorage.setItem("tbw_music", String(musicVol)); } catch (e) { /* yok say */ }
    try { if (musicGain) musicGain.gain.setTargetAtTime(musicVol * MUSIC_MAX, ctx.currentTime, 0.02); } catch (e) { /* yok say */ }
  }
  function setVolume(v) { setSfxVolume(v); setMusicVolume(v); }

  const api = { play, music, setMuted, setVolume, setSfxVolume, setMusicVolume, ensure,
    get track() { return currentTrack; }, get sfxVolume() { return sfxVol; }, get musicVolume() { return musicVol; } };
  Object.defineProperty(api, "muted", { get: () => muted, set: v => setMuted(v), enumerable: true });
  return api;
})();
