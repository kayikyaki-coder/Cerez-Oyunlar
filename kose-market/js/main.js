// Köşe Market — ana akış ve döngü: ekran geçişleri, Game.tick → Render/Bubbles yönlendirme, kısayollar, otomatik kayıt.
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const sfx = (name, a) => { try { if (typeof Sfx !== "undefined" && Sfx[name]) Sfx[name](a); } catch (e) { /* sessiz */ } };
  const SPEED_KEY = "koseMarket.speed";

  let phase = "title";        // title | morning | day | evening | finale
  let speed = 1, paused = false, settingsOpen = false;
  let endTimer = -1;          // dayEnd sonrası müşteriler çıkarken kısa bekleme (sn)
  let hasSave = false;
  let last = 0;

  try { speed = +localStorage.getItem(SPEED_KEY) === 2 ? 2 : 1; } catch (e) { /* yok say */ }

  // ---------- ekranlar ----------
  function goTitle() {
    phase = "title"; setPaused(false);
    UI.mountStage("title");
    Render.idle(Game.state, "morning", Game.planDay());
    UI.renderTitle(hasSave);
    UI.show("title");
  }
  function goMorning(anim) {
    phase = "morning"; UI.stopTitle();
    const plan = Game.planDay();
    UI.mountStage("morning");
    Render.idle(Game.state, "morning", plan);
    UI.renderMorning(plan, anim !== false);
    UI.show("morning");
  }
  // Raflar çok boşsa ve para yetiyorsa önce sor: "Dengeli doldurayım mı?" (yanlışlıkla boş rafla gün geçmesin)
  let asking = false;
  async function stockCheck(verb) {
    const s = Game.state, plan = Game.planDay();
    const total = Object.keys(s.stock).reduce((a, id) => a + (s.unlocked[id] ? s.stock[id] || 0 : 0), 0);
    const canFill = Object.keys(s.unlocked).some((id) => s.unlocked[id] && (s.stock[id] || 0) < Game.shelfCap() && s.money >= Game.unitCost(id));
    if (total >= plan.customers * 0.5 || !canFill) return true;
    asking = true;
    const yes = await UI.confirm("Raflar çok boş 🧺 Müşteriler eli boş dönebilir. " + verb + " önce Dengeli Doldur yapalım mı?", "🧮 Doldur ve devam", "Böyle kalsın");
    asking = false;
    if (yes) { const n = Game.fillAll(); if (n > 0) { sfx("coin"); try { Game.save(); } catch (e) { /* yok say */ } UI.toast("Raflar dengelendi: +" + n + " ürün 🧺", "good"); } }
    return true;
  }
  async function openShop() {
    if (phase !== "morning" || asking) return;
    await stockCheck("Dükkânı açmadan");
    if (phase !== "morning") return;
    const s = Game.state, any = Object.keys(s.stock).some((id) => s.unlocked[id] && s.stock[id] > 0);
    if (!any) UI.toast("Raflar boş ama olsun, baloncuklardan da kazanırsın 🫧", "bad");
    Game.startDay({ mode: "play" });
    const plan = Game.run.plan;
    Bubbles.clear(); Bubbles.setPaused(false);
    UI.mountStage("day");
    Render.setDay(plan, Game.state);
    UI.renderDayStart(plan);
    UI.setSpeedButtons(speed);
    phase = "day"; paused = false; endTimer = -1; setPaused(false);
    UI.show("day");
    sfx("dayStart");
  }
  async function skipDay() {
    if (phase !== "morning" || asking) return;
    sfx("click");
    await stockCheck("Hızlı geçmeden");
    if (phase !== "morning") return;
    try { UI.renderForecast(); } catch (e) { /* tahmin opsiyonel */ }
    const summary = Game.skipDay();
    goEvening(summary);
  }
  function finishPlayDay() {
    const summary = Game.endDay();
    Bubbles.clear();
    goEvening(summary);
  }
  function goEvening(summary) {
    phase = "evening"; setPaused(false);
    try { Game.save(); } catch (e) { /* motor zaten kaydediyor */ }
    hasSave = true;
    UI.mountStage("evening");
    Render.idle(Game.state, "evening");
    UI.renderEvening(summary || Game.state.lastSummary || {});
    UI.show("evening");
    sfx("dayEnd");
    if (summary && summary.levelUp) {
      setTimeout(() => { Render.confetti && Render.confetti(90); UI.showLevelUp(summary.levelUp).then(() => UI.renderEvening(summary)); }, 650);
    }
  }
  function nextDay() {
    if (phase !== "evening") return;
    sfx("click");
    const s = Game.state;
    if (s.won && !s.uiFinaleSeen) return goFinale();
    goMorning();
  }
  function goFinale() {
    phase = "finale";
    UI.mountStage("finale");
    Render.idle(Game.state, "evening");
    Render.refresh && Render.refresh();
    UI.renderFinale(); UI.show("finale");
    Render.confetti && Render.confetti(120);
    sfx("levelUp");
  }

  // ---------- sabah işlemleri ----------
  function afterPurchase(msg, kind) {
    try { Game.save(); } catch (e) { /* yok say */ }
    Render.refresh && Render.refresh();
    UI.refreshMorning();
    if (msg) UI.toast(msg, kind);
  }
  const handlers = {
    buy(id, n) {
      const got = Game.buyStock(id, n);
      if (got > 0) { sfx("coin"); UI.flashCard(id); afterPurchase(); }
      else { sfx("miss"); UI.toast("Olmadı: raf dolu ya da para yetmiyor 🙀", "bad"); }
    },
    unlock(id) {
      if (Game.unlockProduct(id)) {
        const p = Game.product ? Game.product(id) : null;
        sfx("levelUp"); afterPurchase((p ? p.emoji + " " + p.name : "Yeni ürün") + " rafa geldi! Hadi doldur 🧺", "good");
      }
    },
    upgrade(id) {
      if (!Game.buyUpgrade(id)) { sfx("miss"); return; }
      const u = (typeof UPGRADES !== "undefined" ? UPGRADES : []).find((x) => x.id === id) || {};
      sfx("levelUp");
      const winning = Game.state.won && !Game.state.uiFinaleSeen;
      afterPurchase(winning ? null : (u.emoji || "⭐") + " " + (u.name || "Yükseltme") + " alındı! Pamuk onayladı 🐾", "good");
      if (Game.state.won && !Game.state.uiFinaleSeen) setTimeout(goFinale, 500);
    },
    fillAll() {
      const n = Game.fillAll();
      if (n > 0) { sfx("coin"); afterPurchase("Raflar dengelendi: +" + n + " ürün 🧺", "good"); }
      else UI.toast("Doldurulacak yer ya da para kalmadı 🐾");
    },
    open: openShop,
    skip: skipDay,
    next: nextDay,
    cont() { sfx("click"); if (Game.state.won && !Game.state.uiFinaleSeen) return goFinale(); goMorning(); },
    async newGame() {
      sfx("click");
      if (hasSave && !(await UI.confirm("Yeni oyun başlasın mı? Eski dükkânın kaydı silinir."))) return;
      if (Game.clearSave) Game.clearSave();
      Game.newGame(); Game.save(); hasSave = true;
      UI.stopTitle();
      await UI.intro();
      goMorning();
    },
    pause(v) { if (phase !== "day") return; setPaused(v === undefined ? !paused : !!v); sfx("click"); },
    speed(v) {
      speed = v === 2 ? 2 : 1; UI.setSpeedButtons(speed); sfx("click");
      try { localStorage.setItem(SPEED_KEY, String(speed)); } catch (e) { /* yok say */ }
    },
    settingsOpen(open) { settingsOpen = open; if (phase === "day" && open) setPaused(true); },
    home() {
      if (phase === "day") { // yarım gün: güvenli şekilde bitir
        UI.toast("Gün kapatıldı, rapor hazırlanıyor…");
        finishPlayDay(); return;
      }
      goTitle();
    },
    reset() {
      if (Game.clearSave) Game.clearSave();
      Game.newGame(); hasSave = false; Bubbles.clear();
      goTitle();
    },
    endless() {
      Game.state.uiFinaleSeen = true;   // UI bayrağı (kayda girer)
      try { Game.save(); } catch (e) { /* yok say */ }
      goMorning();
    }
  };

  function setPaused(p) {
    paused = !!p;
    Bubbles.setPaused(paused && phase === "day");
    UI.setPaused(paused && phase === "day");
  }

  // ---------- olay yönlendirme ----------
  function route(ev) {
    switch (ev.type) {
      case "bubbleSpawn": {
        const b = ev.bubble;
        const pos = Render.zonePos(b.zone, b.zoneIndex || 0, b.productId);
        Bubbles.spawn(b, pos);
        break;
      }
      case "bubbleExpire":
        Bubbles.expire(ev.bubbleId, ev.autoSolved);
        break;
      case "goalDone": {
        const r = ev.reward || {};
        UI.toast("🎯 Hedef tamam! +" + UI.fmt(r.money || 0) + (r.rep ? " · +" + r.rep + " XP" : ""), "good");
        sfx("levelUp");
        break;
      }
      case "goalProgress":
        if (ev.failed) UI.toast("Hedef kaçtı… olsun, keyfimiz yerinde 🐾", "bad");
        break;
      case "restock":
        break;
      case "dayEnd":
        endTimer = 1.6;
        break;
    }
    Render.handle(ev);
  }

  Bubbles.onTap = (id) => {
    if (phase !== "day" || paused) return;
    const r = Game.tapBubble(id);
    if (!r) return;
    Bubbles.feedback(id, r);   // pop/coin sesleri ve kombo flaşı bubbles.js'de
    UI.updateHud();
  };

  // ---------- döngü ----------
  function frame(ts) {
    const dt = Math.min(0.1, Math.max(0, (ts - (last || ts)) / 1000));
    last = ts;
    if (phase === "day") {
      if (!paused) {
        const gdt = dt * speed;
        const evs = Game.tick(gdt) || [];
        for (const ev of evs) route(ev);
        Render.update(gdt);
        Bubbles.update(gdt);
        UI.updateHud();
        if (endTimer >= 0) { endTimer -= dt; if (endTimer < 0) finishPlayDay(); }
      }
    } else {
      Render.update(dt);
    }
    Render.draw();
    requestAnimationFrame(frame);
  }

  // ---------- klavye ----------
  document.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    const k = e.key;
    if (k === " " || k === "Spacebar" || k === "Enter") {
      const tag = (e.target && e.target.tagName) || "";
      if (k === "Enter" && tag === "BUTTON") return;   // odaklı buton kendi işini yapsın
      if (!$("ov-levelup").classList.contains("hidden")) { e.preventDefault(); UI._lvClose && UI._lvClose(); return; }
      if (!$("ov-intro").classList.contains("hidden")) { e.preventDefault(); UI._introNext && UI._introNext(); return; }
      if (UI.anyOverlay()) return;
      if (k !== " " && k !== "Spacebar") return;
      e.preventDefault();
      if (phase === "title") (hasSave ? handlers.cont : handlers.newGame)();
      else if (phase === "morning") openShop();
      else if (phase === "evening") nextDay();
      else if (phase === "day") handlers.pause();
      else if (phase === "finale") handlers.endless();
    } else if ((k === "p" || k === "P" || k === "Escape") && phase === "day" && !UI.anyOverlay()) {
      handlers.pause();
    } else if (k === "Escape" && !$("ov-settings").classList.contains("hidden")) {
      UI.closeOv("ov-settings"); handlers.settingsOpen(false);
    }
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden && phase === "day") setPaused(true); });

  // ---------- sahne görünümü ----------
  // Dikey telefonda sahnenin kenarlarını hafifçe kırp → dükkân, müşteriler ve baloncuklar daha büyük görünsün
  function applyView() {
    const w = window.innerWidth, h = window.innerHeight;
    const portrait = w <= 600 && h >= w * 1.25;
    const v = portrait ? [56, 936] : [0, 960];
    if (Render.setView) Render.setView(v[0], v[1]);
    if (Bubbles.setView) Bubbles.setView(v[0], v[1]);
  }

  // ---------- başlat ----------
  function boot() {
    Render.init($("scene"));
    Bubbles.init($("bubble-layer"));
    applyView();
    window.addEventListener("resize", applyView);
    UI.init(handlers);
    hasSave = !!Game.load();
    UI.setSpeedButtons(speed);
    goTitle();
    requestAnimationFrame(frame);
    // Fontlar gelince sahne metinleri doğru fontla çizilsin
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => Render.draw());
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  // Test/hata ayıklama için
  window.KM = { get phase() { return phase; }, handlers, openShop, skipDay, nextDay, goMorning, get speed() { return speed; } };
})();
