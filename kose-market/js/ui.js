// Köşe Market — ekran/panel çizimi: başlık, sabah (gün kartı, stok, yükseltmeler), gün HUD'u, akşam raporu, final, overlay'ler.
// DOM'u sadece burası (ve bubbles.js) yazar; oyun mantığı Game'de. Global: UI
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  // data.js üst düzey const'ları window'da değil → typeof ile güvenli erişim
  const D = {
    get BALANCE() { return typeof BALANCE !== "undefined" ? BALANCE : {}; },
    get PRODUCTS() { return typeof PRODUCTS !== "undefined" ? PRODUCTS : []; },
    get UPGRADES() { return typeof UPGRADES !== "undefined" ? UPGRADES : []; },
    get REGULARS() { return typeof REGULARS !== "undefined" ? REGULARS : []; },
    get LEVELS() { return typeof LEVELS !== "undefined" ? LEVELS : []; },
    get STORY() { return typeof STORY !== "undefined" ? STORY : {}; },
    get BUBBLE_TYPES() { return typeof BUBBLE_TYPES !== "undefined" ? BUBBLE_TYPES : {}; }
  };
  const S = () => Game.state;
  const fmt = (n) => (n < 0 ? "−₺" : "₺") + Math.abs(Math.round(n || 0)).toLocaleString("tr-TR");
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const sfx = (name, a) => { try { if (typeof Sfx !== "undefined" && Sfx[name]) Sfx[name](a); } catch (e) { /* ses yoksa sorun değil */ } };
  const pick = (arr, seed) => (arr && arr.length ? arr[Math.abs(seed | 0) % arr.length] : "");
  const levelInfo = () => (Game.levelInfo ? Game.levelInfo() : { level: S().level, title: "", progress: 0 });
  const unitCost = (id) => (Game.unitCost ? Game.unitCost(id) : ((Game.product && Game.product(id)) || {}).cost || 1);
  const regById = (id) => D.REGULARS.find((r) => r.id === id);
  const prodById = (id) => D.PRODUCTS.find((p) => p.id === id);
  const obj = (x, list) => (x && typeof x === "object" ? x : (list || []).find((o) => o.id === x) || (x ? { id: x, name: x } : null));

  // Türkçe bulunma eki: Sv. 2'de, 3'te, 6'da, 10'da…
  function locSuffix(n) {
    n = Math.abs(n | 0);
    const last = n % 10, tens = Math.floor(n / 10) % 10;
    if (last === 0) return n === 0 ? "da" : ["", "da", "de", "da", "de", "de", "da", "de", "de", "da"][tens] || "de";
    return ["", "de", "de", "te", "te", "te", "da", "de", "de", "da"][last];
  }
  let handlers = {};
  let plan = null;
  let hudCache = {};

  // ---------- genel ----------
  function show(name) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === "screen-" + name));
    $("app").dataset.screen = name;
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }
  function mountStage(slotName) {
    const slot = document.querySelector('.stage-slot[data-slot="' + slotName + '"]');
    const st = $("stage");
    if (slot && st.parentElement !== slot) slot.appendChild(st);
  }
  function updateTop() {
    const s = S(); if (!s) return;
    const m = $("top-money"), txt = fmt(s.money);
    if (m.textContent !== txt) { m.textContent = txt; bump(m.parentElement); }
    $("top-day").textContent = "Gün " + s.day;
    const li = levelInfo();
    $("top-level").textContent = "Sv. " + li.level;
    $("top-level").parentElement.title = li.title || "İtibar seviyesi";
    $("brand-name").textContent = s.won ? "KÖŞE SÜPERMARKET" : "KÖŞE MARKET";
  }
  function bump(el) { if (!el) return; el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
  function toast(text, kind) {
    const t = document.createElement("div");
    t.className = "toast " + (kind || ""); t.textContent = text;
    $("toasts").appendChild(t);
    setTimeout(() => t.remove(), 2700);
    while ($("toasts").children.length > 3) $("toasts").firstChild.remove();
  }
  function openOv(id) { $(id).classList.remove("hidden"); }
  function closeOv(id) { $(id).classList.add("hidden"); }
  function anyOverlay() { return !!document.querySelector(".overlay:not(.hidden)"); }

  function confirmBox(text, yesLabel, noLabel) {
    return new Promise((res) => {
      $("confirm-text").textContent = text; openOv("ov-confirm");
      $("btn-confirm-yes").textContent = yesLabel || "Evet";
      $("btn-confirm-no").textContent = noLabel || "Vazgeç";
      $("btn-confirm-yes").classList.toggle("danger", !yesLabel);
      $("btn-confirm-yes").classList.toggle("red", !!yesLabel);
      const done = (v) => { closeOv("ov-confirm"); $("btn-confirm-yes").onclick = $("btn-confirm-no").onclick = null; res(v); };
      $("btn-confirm-yes").onclick = () => done(true);
      $("btn-confirm-no").onclick = () => done(false);
    });
  }

  // ---------- başlık ----------
  let titleTimer = 0, titleIdx = 0;
  function renderTitle(hasSave) {
    const s = S();
    const cont = $("btn-continue");
    cont.classList.toggle("hidden", !hasSave);
    if (hasSave) cont.innerHTML = "▶ Devam Et <small>Gün " + s.day + " · " + fmt(s.money) + "</small>";
    $("btn-new").innerHTML = hasSave ? "✨ Yeni Oyun" : "✨ Yeni Oyun <small>Pamuk seni bekliyor</small>";
    const lines = D.STORY.intro || ["Miyav! Ben Pamuk."];
    const greet = hasSave ? ["Tekrar hoş geldin! Raflar seni özledi 🐾", "Miyav! Dükkânın anahtarı hâlâ sende.", "Bugün kaç baloncuk patlatacağız? 🫧"] : lines;
    titleIdx = 0; setTitleLine(greet[0]);
    clearInterval(titleTimer);
    titleTimer = setInterval(() => { titleIdx = (titleIdx + 1) % greet.length; setTitleLine(greet[titleIdx]); }, 4200);
  }
  function setTitleLine(s) {
    const p = $("title-line"); const n = p.cloneNode(false); n.textContent = s.replace(/^🐈\s*/, ""); p.replaceWith(n);
  }
  function stopTitle() { clearInterval(titleTimer); }

  function intro() {
    return new Promise((res) => {
      const lines = (D.STORY.intro || []).slice();
      if (!lines.length) return res();
      let i = 0;
      const dots = $("intro-dots"); dots.innerHTML = lines.map(() => "<i></i>").join("");
      const draw = () => {
        const l = $("intro-line"); l.textContent = lines[i].replace(/^🐈\s*/, "");
        l.style.animation = "none"; void l.offsetWidth; l.style.animation = "popIn .35s both";
        [...dots.children].forEach((d, k) => d.classList.toggle("on", k === i));
        $("btn-intro-next").textContent = i === lines.length - 1 ? "Hadi başlayalım! 🎀" : "Devam ›";
      };
      const end = () => { closeOv("ov-intro"); $("btn-intro-next").onclick = $("btn-intro-skip").onclick = null; UI._introNext = null; res(); };
      const next = () => { sfx("click"); if (i >= lines.length - 1) end(); else { i++; draw(); } };
      $("btn-intro-next").onclick = next;
      $("btn-intro-skip").onclick = end;
      UI._introNext = next;
      draw(); openOv("ov-intro");
    });
  }

  // ---------- sabah ----------
  function weatherClass(w) {
    const id = (w && w.id) || "";
    return { yagmur: "w-rain", kar: "w-snow", gunes: "w-sun", sicak: "w-hot" }[id] || "";
  }
  function goalRewardText(g) {
    if (!g || !g.reward) return "";
    const bits = []; if (g.reward.money) bits.push("+" + fmt(g.reward.money)); if (g.reward.rep) bits.push("+" + g.reward.rep + " itibar");
    return bits.join(" · ");
  }
  function renderDayCard(p) {
    const s = S();
    const wd = obj(p.weekday, typeof WEEKDAYS !== "undefined" ? WEEKDAYS : []) || { name: "" };
    const w = obj(p.weather, typeof WEATHERS !== "undefined" ? WEATHERS : []) || { name: "Açık", emoji: "🌤️" };
    const ev = obj(p.event, typeof DAY_EVENTS !== "undefined" ? DAY_EVENTS : []);
    const g = p.goal;
    let html = '<div class="dc-head"><span class="dc-day">Gün ' + s.day + '</span><span class="dc-wd">' + esc(wd.name) + "</span></div>";
    if (wd.flavor) html += '<div class="dc-flavor">' + esc(wd.flavor) + "</div>";
    html += '<div class="dc-row weather ' + weatherClass(w) + '"><span class="ic">' + (w.emoji || "🌤️") + '</span><div><div class="t">' + esc(w.name) +
      " · ~" + (p.customers || "?") + ' müşteri</div><div class="d">' + esc(w.banner || "Güzel bir gün.") + "</div></div></div>";
    if (ev) html += '<div class="dc-row event"><span class="ic">' + (ev.emoji || "🎉") + '</span><div><div class="t">' + esc(ev.name) +
      '</div><div class="d">' + esc(ev.desc || "") + "</div></div></div>";
    else html += '<div class="dc-row"><span class="ic">🍃</span><div><div class="t">Olaysız bir gün</div><div class="d">' +
      esc(pick(D.STORY.quietDay, s.day) || "Sakin bir gün.") + "</div></div></div>";
    if (g) html += '<div class="dc-row goal"><span class="ic">🎯</span><div><div class="t">Günün hedefi</div><div class="d">' + esc(g.text || "") +
      '</div><span class="dc-reward">' + goalRewardText(g) + "</span></div></div>";
    const regs = (p.regulars || []).map(regById).filter(Boolean);
    if (regs.length) {
      html += '<div class="dc-row"><span class="ic">🏘️</span><div><div class="t">Bugün uğrayacaklar</div><div class="dc-regs">' +
        regs.map((r) => { const lp = prodById(r.likes); return '<span class="dc-reg" title="' + esc(r.line || "") + '"><span class="e">' + r.emoji + "</span>" + esc(r.name) + (lp ? " · " + lp.emoji : "") + "</span>"; }).join("") +
        "</div></div></div>";
    }
    // çok aranacaklar
    const hot = D.PRODUCTS.filter((pr) => s.unlocked[pr.id]).map((pr) => ({ pr, r: (p.demand[pr.id] || 0) / (pr.demand || 1) }))
      .filter((x) => x.r >= 1.25).sort((a, b) => b.r - a.r).slice(0, 4);
    if (hot.length) html += '<div class="dc-hot">🔥 Çok aranacak: ' + hot.map((x) => '<span class="hp">' + x.pr.emoji + " " + esc(x.pr.name) + "</span>").join("") + "</div>";
    $("daycard").innerHTML = html;
  }

  function renderStock() {
    const s = S(), cap = Game.shelfCap(), eff = Game.effects();
    const grid = $("stock-grid");
    const prevScroll = null; void prevScroll;
    let html = "", hidden = 0, hiddenMin = 99;
    for (const p of D.PRODUCTS) {
      const unlocked = !!s.unlocked[p.id];
      if (!unlocked && (p.unlockLevel || 1) > s.level + 1) { hidden++; hiddenMin = Math.min(hiddenMin, p.unlockLevel || 1); continue; }
      if (!unlocked) {
        const lvlOk = s.level >= (p.unlockLevel || 1);
        html += '<div class="pcard locked" data-pid="' + p.id + '"><div class="emoji">' + p.emoji + '</div><div class="name">' + esc(p.name) + "</div>" +
          '<div class="desc">' + esc(p.desc || "") + "</div>" +
          '<div class="price">Al ' + fmt(p.cost) + " · Sat <b>" + fmt(p.price) + "</b></div>" +
          (lvlOk ? '<button class="btn gold" data-unlock="' + p.id + '"' + (s.money < (p.unlockCost || 0) ? " disabled" : "") + ">🔓 Kilidi Aç (" + fmt(p.unlockCost || 0) + ")</button>"
            : '<div class="lockline">🔒 Sv. ' + (p.unlockLevel || 1) + "'" + locSuffix(p.unlockLevel || 1) + " açılır</div>") + "</div>";
        continue;
      }
      const have = s.stock[p.id] || 0, c = unitCost(p.id), full = have >= cap, poor = s.money < c;
      const r = plan ? (plan.demand[p.id] || 0) / (p.demand || 1) : 1;
      const fillN = Math.max(0, Math.min(cap - have, Math.floor(s.money / c)));
      const pct = Math.min(100, (have / cap) * 100);
      const barCls = full ? "full" : have <= Math.ceil(cap * 0.25) ? "low" : "";
      let tagL = "", tagR = "";
      if (r >= 1.3) tagL = '<span class="tag hot">🔥 aranıyor</span>'; else if (r <= 0.5) tagL = '<span class="tag cold">💤 az</span>';
      if (p.fresh && !eff.fridge) tagR = '<span class="tag fresh" title="Buzdolabı yoksa gece yarısı bozulur">🥶 taze</span>';
      html += '<div class="pcard" data-pid="' + p.id + '"><div class="tags">' + (tagL || "<span></span>") + tagR + "</div>" +
        '<div class="emoji">' + p.emoji + '</div><div class="name">' + esc(p.name) + "</div>" +
        '<div class="price">Al ' + (c < p.cost ? "<s>" + fmt(p.cost) + "</s> " : "") + fmt(c) + " · Sat <b>" + fmt(p.price) + "</b></div>" +
        '<div class="bar ' + barCls + '"><i style="width:' + pct + '%"></i></div><div class="stk">' + have + " / " + cap + "</div>" +
        '<div class="pbtns"><button class="btn" data-buy="' + p.id + '" data-n="1"' + (full || poor ? " disabled" : "") + ">+1</button>" +
        '<button class="btn blue" data-buy="' + p.id + '" data-n="5"' + (full || poor ? " disabled" : "") + ">+5</button>" +
        '<button class="btn wood fill" data-buy="' + p.id + '" data-n="999"' + (fillN <= 0 ? " disabled" : "") + ">" +
        (full ? "Raf dolu ✓" : "Doldur" + (fillN > 0 ? " (+" + fillN + " · " + fmt(fillN * c) + ")" : "")) + "</button></div></div>";
    }
    if (hidden) html += '<div class="pcard locked more"><div class="emoji">🎁</div><div class="name">+' + hidden + ' sürpriz ürün</div><div class="desc">İtibarın arttıkça raflara yenileri gelecek</div><div class="lockline">🔒 Sv. ' + hiddenMin + "+</div></div>";
    grid.innerHTML = html;
    // özet
    const total = D.PRODUCTS.reduce((a, p) => a + (s.unlocked[p.id] ? s.stock[p.id] || 0 : 0), 0);
    const exp = plan ? plan.customers : 0;
    const warn = total === 0 ? '<span class="warn">Raflar bomboş! Müşteriler eli boş döner 😿</span>'
      : total < exp * 0.8 ? '<span class="warn">Raflar biraz az gibi…</span>' : "<span>Raflar hazır görünüyor 👍</span>";
    $("stock-summary").innerHTML = "🧺 Rafta <b>" + total + "</b> ürün · 🚶 ~" + exp + " müşteri · " + warn;
    $("cap-note").textContent = "Ürün başı kapasite: " + cap;
    const canFill = D.PRODUCTS.some((p) => s.unlocked[p.id] && (s.stock[p.id] || 0) < cap && s.money >= unitCost(p.id));
    $("btn-fill").disabled = !canFill;
  }

  function renderUpgrades() {
    const s = S();
    let html = "";
    for (const u of D.UPGRADES) {
      const lvl = Game.upgradeLevel(u.id), levels = u.levels || [], max = levels.length;
      const maxed = lvl >= max;
      const next = maxed ? null : levels[lvl];
      const avail = !maxed && Game.upgradeAvailable(u.id);
      const req = next ? Math.max(u.unlockLevel || 1, next.minLevel || 1, next.unlockLevel || 1) : 0;
      const cost = next ? next.cost : 0;
      const cls = "ucard" + (maxed ? " maxed" : !avail ? " locked" : "") + (u.cat === "final" ? " final" : "");
      const pips = max > 1 ? '<div class="lv">' + levels.map((_, i) => "<i" + (i < lvl ? ' class="on"' : "") + "></i>").join("") + "</div>" : "";
      const nextTxt = next && next.desc ? '<div class="next">' + (lvl > 0 ? "Sonraki: " : "") + esc(next.desc) + "</div>" : "";
      let btn;
      if (maxed) btn = '<button class="btn" disabled>' + (max > 1 ? "Tamamlandı ✓" : "Alındı ✓") + "</button>";
      else if (!avail) btn = '<button class="btn cream" disabled>🔒 Sv. ' + req + "'" + locSuffix(req) + " açılır</button>";
      else btn = '<button class="btn ' + (u.cat === "final" ? "red" : "gold") + '" data-upg="' + u.id + '"' + (s.money < cost ? " disabled" : "") + ">" +
        (lvl > 0 ? "Yükselt" : "Al") + " (" + fmt(cost) + ")</button>";
      html += '<div class="' + cls + '"><div class="row"><div class="ic">' + (u.emoji || "⭐") + '</div><div><div class="t">' + esc(u.name) +
        (max > 1 ? ' <small style="opacity:.6;white-space:nowrap">Sv. ' + lvl + "/" + max + "</small>" : "") + "</div>" + pips + "</div></div>" +
        '<div class="d">' + esc(u.desc || "") + "</div>" + nextTxt + btn + "</div>";
    }
    $("upg-grid").innerHTML = html;
  }

  function renderMorning(p, anim) {
    plan = p;
    renderDayCard(p);
    const s = S(), tips = D.STORY.tips || [];
    const tip = s.day <= 8 && tips.length > 15 ? pick([0, 15, 1, 9, 5, 6, 7, 8].map((i) => tips[i]), s.day - 1) : pick(tips, s.day * 7 + 3);
    $("morning-tip").innerHTML = "<span><b>Pamuk'un ipucu:</b> " + esc(tip) + "</span>";
    renderStock(); renderUpgrades(); updateTop(); renderForecast();
    if (anim) {
      $("stock-grid").classList.add("stagger"); $("upg-grid").classList.add("stagger"); $("daycard").classList.add("stagger");
      setTimeout(() => ["stock-grid", "upg-grid", "daycard"].forEach((id) => $(id).classList.remove("stagger")), 900);
    }
  }
  function refreshMorning() { renderStock(); renderUpgrades(); updateTop(); renderForecast(); }
  // Oyna / hızlı geç tahmini: bugünün aynısını iki kez headless koşturur (gerçek durum değişmez)
  function renderForecast() {
    const ep = $("est-play"), es = $("est-skip"), tr = $("tradeoff");
    let play = null, skip = null;
    try {
      if (Game.simulateClone) {
        play = Game.simulateClone("play", { hitRate: 0.7, reactSec: 1.3 });
        skip = Game.simulateClone("skip");
      }
    } catch (e) { play = skip = null; }
    const pv = play ? Math.round(play.profit != null ? play.profit : play.net) : null;
    const sv = skip ? Math.round(skip.profit != null ? skip.profit : skip.net) : null;
    UI.forecast = pv == null ? null : { day: S().day, play: pv, skip: sv };
    if (pv == null || sv == null) {
      ep.textContent = "baloncuklara dokun, kombo yap"; es.textContent = "baloncuklar çözülmez";
      tr.innerHTML = "🐈 Oynamak daha kârlı; acelen varsa hızlı geç, dükkân yine açılır.";
      return;
    }
    ep.textContent = "tahmini kâr ~" + fmt(pv);
    es.textContent = "~" + fmt(sv) + " · baloncuk yok";
    const diff = pv - sv;
    tr.innerHTML = diff > 0
      ? "🐈 Baloncuklara dokunursan ~<b>+" + fmt(diff) + "</b> fazla kazanırsın. Acelen varsa hızlı geç; dükkân yine açılır ama sorunlar çözülmez."
      : "🐈 Bugün sakin görünüyor; hızlı geçsen de olur. Oynarsan kombo ve itibar gelir 🐾";
  }
  function flashCard(pid) {
    const c = document.querySelector('.pcard[data-pid="' + pid + '"]'); if (c) { c.classList.remove("flash"); void c.offsetWidth; c.classList.add("flash"); }
  }

  // ---------- gün HUD ----------
  function renderDayStart(p) {
    plan = p; hudCache = {};
    const s = S();
    $("chips").innerHTML = D.PRODUCTS.filter((pr) => s.unlocked[pr.id]).map((pr) =>
      '<span class="chip" data-chip="' + pr.id + '" title="' + esc(pr.name) + '"><span class="e">' + pr.emoji + '</span><span class="n">0</span></span>').join("");
    renderDayInfo(p);
    const g = p.goal;
    $("hud-goal-cell").classList.toggle("hidden", !g);
    $("hud-goal-cell").classList.remove("done", "failed");
    if (g) { $("hud-goal-txt").textContent = "🎯 " + (g.text || "Hedef"); $("hud-goal-txt").title = g.text || ""; }
    updateHud(true);
  }
  // Dikey telefonda sahnenin altındaki "bugün" kartı: hava, olay, uğrayacak komşular, Pamuk'un ipucu
  function renderDayInfo(p) {
    const el = $("day-info"); if (!el) return;
    const s = S();
    const wd = obj(p.weekday, typeof WEEKDAYS !== "undefined" ? WEEKDAYS : []) || { name: "" };
    const w = obj(p.weather, typeof WEATHERS !== "undefined" ? WEATHERS : []) || { name: "Açık", emoji: "🌤️" };
    const ev = obj(p.event, typeof DAY_EVENTS !== "undefined" ? DAY_EVENTS : []);
    let html = '<div class="di-head"><span class="di-pill">' + (w.emoji || "🌤️") + " " + esc(w.name) + '</span><span class="di-pill">📅 ' + esc(wd.name) + "</span>" +
      (ev ? '<span class="di-pill ev">' + (ev.emoji || "🎉") + " " + esc(ev.name) + "</span>" : "") + "</div>";
    const regs = (p.regulars || []).map(regById).filter(Boolean);
    if (regs.length) html += '<div class="di-regs">🏘️ Bugün uğrayacak: ' + regs.map((r) => { const lp = prodById(r.likes); return "<b>" + r.emoji + " " + esc(r.name) + "</b>" + (lp ? " " + lp.emoji : ""); }).join(" · ") + "</div>";
    const tips = D.STORY.tips || [];
    const tip = s.day <= 8 && tips.length > 15 ? pick([5, 6, 0, 7, 15, 1, 9, 8].map((i) => tips[i]), s.day - 1) : pick(tips, s.day * 5 + 1);
    if (tip) html += '<div class="di-tip">🐈 ' + esc(tip) + "</div>";
    el.innerHTML = html;
  }
  function setIf(key, val, fn) { if (hudCache[key] !== val) { hudCache[key] = val; fn(val); } }
  function hearts(sat) {
    const v = Math.max(0, Math.min(100, sat)) / 20; let h = "";
    for (let i = 0; i < 5; i++) h += v >= i + 0.75 ? "❤️" : v >= i + 0.3 ? "🩷" : "🤍";
    return h;
  }
  function updateHud(force) {
    const s = S(), run = Game.run; if (!s) return;
    if (force) hudCache = {};
    setIf("money", Math.round(s.money), (v) => { const el = $("hud-money"); el.textContent = fmt(v); el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); });
    updateTop();
    if (!run) return;
    const p = Math.min(1, run.t / (run.length || 60));
    setIf("clock", Math.floor(p * 200), () => {
      $("hud-clock-fill").style.width = p * 100 + "%";
      const sun = $("hud-clock-sun"); sun.style.left = p * 100 + "%"; sun.textContent = p < 0.72 ? "☀️" : p < 0.95 ? "🌇" : "🌙";
      const mins = Math.floor(8 * 60 + p * 12 * 60);
      $("hud-clock-txt").textContent = String(Math.floor(mins / 60)).padStart(2, "0") + ":" + String(Math.floor(mins / 10) * 10 % 60).padStart(2, "0") +
        (p > 0.9 ? " · kapanıyor" : "");
    });
    setIf("sat", Math.round(s.sat), (v) => {
      const el = $("hud-hearts"); const prev = +el.dataset.v || v; el.textContent = hearts(v); el.dataset.v = v; el.parentElement.title = "Memnuniyet " + v + "/100";
      if (v < prev - 1) { el.parentElement.classList.remove("down"); void el.offsetWidth; el.parentElement.classList.add("down"); }
    });
    const cmax = D.BALANCE.comboMax || 2, combo = run.combo || 1;
    setIf("combo", combo.toFixed(1), () => {
      $("hud-combo-fill").style.width = ((combo - 1) / (cmax - 1)) * 100 + "%";
      $("hud-combo-txt").textContent = "x" + combo.toFixed(1) + (combo >= cmax - 0.001 ? " 🔥" : "");
      $("hud-combo-fill").parentElement.parentElement.classList.toggle("hot", combo > 1.001);
    });
    const g = run.goal || (plan && plan.goal);
    if (g) {
      let val = run.goalProgress || 0, tgt = g.target || 1, txt, frac;
      if (g.type === "noMiss") { txt = run.goalFailed ? "Kaçtı ✗" : run.goalDone ? "Temiz ✓" : "Temiz ✓ şimdilik"; frac = run.goalFailed ? 0 : run.goalDone ? 1 : p; }
      else if (g.type === "combo") { val = run.maxCombo || 1; txt = "x" + val.toFixed(1) + " / x" + (+tgt).toFixed(1); frac = (val - 1) / Math.max(0.01, tgt - 1); }
      else if (g.type === "earn") { txt = fmt(val) + " / " + fmt(tgt); frac = val / tgt; }
      else { txt = val + " / " + tgt; frac = val / tgt; }
      if (run.goalDone) txt = "Tamam! ✓";
      setIf("goal", txt + "|" + (run.goalFailed ? 1 : 0), () => {
        $("hud-goal-num").textContent = txt;
        $("hud-goal-fill").style.width = Math.max(0, Math.min(1, frac)) * 100 + "%";
        $("hud-goal-cell").classList.toggle("done", !!run.goalDone);
        $("hud-goal-cell").classList.toggle("failed", !!run.goalFailed);
      });
    }
    // stok çipleri
    const cap = Game.shelfCap();
    document.querySelectorAll("#chips .chip").forEach((ch) => {
      const id = ch.dataset.chip, n = s.stock[id] || 0, paused = run.paused && run.paused[id] > run.t;
      const key = n + "|" + paused;
      if (ch.dataset.k === key) return;
      const was = ch.dataset.k; ch.dataset.k = key;
      ch.querySelector(".n").textContent = paused ? n + "⏸" : n;
      ch.classList.toggle("empty", n <= 0); ch.classList.toggle("low", n > 0 && n <= Math.max(1, Math.floor(cap * 0.2)));
      ch.classList.toggle("paused", !!paused);
      if (was) { ch.classList.remove("tick"); void ch.offsetWidth; ch.classList.add("tick"); }
    });
  }
  function setSpeedButtons(sp) { document.querySelectorAll("[data-speed]").forEach((b) => b.classList.toggle("on", +b.dataset.speed === sp)); }
  function setPaused(p) {
    $("stage-pause").classList.toggle("show", p);
    $("btn-pause").textContent = p ? "▶️" : "⏸️";
    $("btn-pause").classList.toggle("on", p);
  }

  // ---------- akşam ----------
  function pamukComment(s) {
    const lost = (s.missed || 0) + (s.lostCustomers || 0);
    if (s.levelUp) return "Seviye atladık! Kuyruğum gururdan dimdik 🐈✨";
    if (s.mode === "skip") return "Hızlı geçtik… ben de uyudum zaten 😴 Yarın beraber oynayalım mı?";
    if (s.maxCombo >= 1.8) return "O kombo neydi öyle! Patilerim titredi 🐾🔥";
    if (lost > Math.max(3, (s.served || 0) * 0.3)) return "Raflar erken boşaldı gibi… Yarın biraz daha stok alalım mı? 🧺";
    if (s.spoiled > 0) return "Birkaç taze ürün bozuldu, mis gibi kokmuyor 🙀 Buzdolabı fena olmazdı.";
    if (s.satEnd >= 85) return "Mahalle bayıldı sana, herkes gülümsüyordu 💗";
    if (s.goalDone) return "Hedefi de tutturduk! Bir mama da bana? 🐟";
    return "Ne güzel bir gündü. Ben biraz kestireyim… 😴";
  }
  function renderEvening(s) {
    const st = S();
    const profit = s.profit != null ? s.profit : s.net;
    const est = s.estSkipProfit != null ? s.estSkipProfit : s.estSkipNet;
    const w = obj(s.weather, typeof WEATHERS !== "undefined" ? WEATHERS : []);
    const ev = obj(s.event, typeof DAY_EVENTS !== "undefined" ? DAY_EVENTS : []);
    const sub = [w ? (w.emoji || "") + " " + w.name : "", ev ? (ev.emoji || "") + " " + ev.name : ""].filter(Boolean).join(" · ");
    const cell = (l, v, extra, cls) => '<div class="rcell ' + (cls || "") + '"><div class="l">' + l + '</div><div class="v">' + v + "</div>" + (extra ? '<div class="s">' + extra + "</div>" : "") + "</div>";
    let html = "<h2>" + (s.mode === "skip" ? "Gün " + s.day + " hızlıca bitti ⏩" : "Gün " + s.day + " bitti! 🌙") + "</h2>" +
      '<div class="sub">' + esc(sub || "Kepenkler indi, sokak lambaları yandı.") + "</div>";
    html += '<div class="rgrid stagger">';
    html += cell("Net kâr", fmt(profit), s.net != null && s.net !== profit ? "kasa farkı " + fmt(s.net) + " · raf değeri dahil" : "", "net" + (profit < 0 ? " neg bad" : " good"));
    const custSub = [s.missed ? s.missed + " eli boş döndü" : "", s.lostCustomers ? s.lostCustomers + " gelmekten vazgeçti" : ""].filter(Boolean).join(" · ");
    html += cell("😊 Müşteri", (s.served || 0) + " / " + (s.customers || 0), custSub || "herkes mutlu");
    html += cell("💵 Ciro", fmt(s.revenue), (s.itemsSold || 0) + " ürün satıldı", "good");
    html += cell("🫧 Baloncuk", fmt(s.bubbleIncome), (s.popped || 0) + " patladı · " + (s.missedBubbles || 0) + " kaçtı", s.bubbleIncome > 0 ? "good" : "");
    if (s.tips) html += cell("💝 Bahşiş", fmt(s.tips), s.regularsServed ? s.regularsServed + " komşu memnun" : "", "good");
    html += cell("📦 Stok gideri", fmt(s.stockCost), s.emergencyCost ? "acil: " + fmt(s.emergencyCost) : "", "bad");
    html += cell("❤️ Memnuniyet", (s.satStart != null ? s.satStart + " → " : "") + s.satEnd, "");
    html += cell("🔥 En iyi kombo", "x" + (+s.maxCombo || 1).toFixed(1), "");
    html += cell("⭐ İtibar", "+" + (s.repGained || 0), "XP");
    if (s.spoiled) html += cell("🥀 Bozulan", s.spoiled, "taze ürün", "bad");
    if (s.moneyPenalty) html += cell("💸 Ceza", fmt(s.moneyPenalty), "kaçan baloncuklar", "bad");
    html += "</div>";
    if (s.mode === "play" && est != null) {
      const diff = Math.round(profit - est);
      html += diff > 0 ? '<div class="highlight">Oynayarak +' + fmt(diff) + ' fazla kazandın 🎉<span class="sm">(atlasaydın ~' + fmt(est) + ")</span></div>"
        : '<div class="highlight">Bugün baloncuklar sakindi 🙂<span class="sm">(atlasaydın da ~' + fmt(est) + " kazanırdın)</span></div>";
    } else if (s.mode === "skip") {
      const fc = UI.forecast && UI.forecast.day === s.day ? UI.forecast : null;
      const more = fc ? Math.round(fc.play - profit) : 0;
      html += '<div class="highlight skip">⏩ Günü hızlı geçtin.<span class="sm">' +
        (more > 0 ? "Oynasaydın tahminen ~" + fmt(fc.play) + " kazanırdın (+" + fmt(more) + "), üstüne kombo ve itibar da gelirdi 🫧"
          : "Oynasaydın baloncuklardan ekstra ₺, kombo ve itibar gelirdi 🫧") + "</span></div>";
    }
    if (s.goal) {
      const gr = s.goalReward;
      html += s.goalDone ? '<div class="goalres ok"><span class="ic">🎯</span><div>Hedef tamam: ' + esc(s.goal) + (gr ? ' <b style="color:var(--green)">+' + fmt(gr.money) + (gr.rep ? " · +" + gr.rep + " XP" : "") + "</b>" : "") + "</div></div>"
        : '<div class="goalres no"><span class="ic">🎯</span><div>Hedef kaçtı: ' + esc(s.goal) + ' <span style="opacity:.6">— yarın yeni şans!</span></div></div>';
    }
    const li = levelInfo();
    html += '<div class="lvbox"><div class="top"><span>⭐ Sv. ' + li.level + " · " + esc(li.title) + "</span><span>" +
      (li.next != null ? li.rep + " / " + li.next + " XP" : "Zirvedesin! 👑") + '</span></div><div class="lvbar"><i id="lvfill" style="width:0%"></i></div>' +
      (li.nextTitle ? '<div class="s" style="font-size:11.5px;font-weight:800;opacity:.6;margin-top:3px">Sıradaki: ' + esc(li.nextTitle) + "</div>" : "") + "</div>";
    if (s.piggy) html += '<div class="pamuk-note">' + esc(D.STORY.piggyBank || "🐷 Pamuk kumbarasını devirdi!") + "</div>";
    html += '<div class="pamuk-note">🐈 ' + esc(pamukComment(s)) + "</div>";
    $("report").innerHTML = html;
    requestAnimationFrame(() => requestAnimationFrame(() => { const f = $("lvfill"); if (f) f.style.width = (li.progress * 100).toFixed(1) + "%"; }));
    $("btn-next").textContent = st.won && !st.uiFinaleSeen ? "Büyük Final 🎉" : "Yeni Güne Geç 🌅";
    updateTop();
  }

  function showLevelUp(lu) {
    return new Promise((res) => {
      $("lv-badge").textContent = lu.level;
      $("lv-title").textContent = "“" + (lu.title || "") + "”";
      $("lv-story").textContent = (D.STORY.levelUp && D.STORY.levelUp[lu.level]) || "Mahalle seni daha çok seviyor!";
      $("lv-unlock").textContent = lu.unlockText ? "🔓 " + lu.unlockText : "";
      $("lv-unlock").classList.toggle("hidden", !lu.unlockText);
      openOv("ov-levelup"); sfx("levelUp");
      const done = () => { closeOv("ov-levelup"); $("btn-lv-ok").onclick = null; UI._lvClose = null; res(); };
      $("btn-lv-ok").onclick = done; UI._lvClose = done;
    });
  }

  // ---------- final ----------
  function renderFinale() {
    const s = S(), st = s.stats || {};
    const lines = (D.STORY.finale || []).map((l, i) => '<p style="animation-delay:' + (0.3 + i * 0.35) + 's">' + esc(l) + "</p>").join("");
    const cell = (l, v) => '<div class="rcell"><div class="l">' + l + '</div><div class="v">' + v + "</div></div>";
    $("finale").innerHTML = '<div class="finale-star">⭐</div><h1>Mahallenin Yıldızı!</h1>' +
      '<div class="finale-lines">' + lines + "</div>" +
      '<div class="rgrid">' + cell("📅 Gün", s.wonDay || s.day) + cell("💰 Toplam kazanç", fmt(st.totalEarned)) + cell("😊 Mutlu müşteri", st.customersServed || 0) +
      cell("🛒 Satılan ürün", st.itemsSold || 0) + cell("🫧 Patlatılan baloncuk", st.bubblesPopped || 0) + cell("🔥 En iyi kombo", "x" + (+st.bestCombo || 1).toFixed(1)) +
      cell("🎯 Tutan hedef", st.goalsDone || 0) + cell("🏘️ Mutlu komşu", st.regularsServed || 0) + cell("▶ Oynanan / ⏩ geçilen", (st.daysPlayed || 0) + " / " + (st.daysSkipped || 0)) + "</div>" +
      '<button class="btn big red" id="btn-endless">Dükkân açık kalsın ☀️</button>';
    $("btn-endless").onclick = () => handlers.endless && handlers.endless();
  }

  // ---------- init ----------
  function init(h) {
    handlers = h || {};
    $("stock-grid").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b || b.disabled) return;
      if (b.dataset.buy) handlers.buy(b.dataset.buy, +b.dataset.n);
      else if (b.dataset.unlock) handlers.unlock(b.dataset.unlock);
    });
    $("upg-grid").addEventListener("click", (e) => { const b = e.target.closest("button[data-upg]"); if (b && !b.disabled) handlers.upgrade(b.dataset.upg); });
    $("btn-fill").onclick = () => handlers.fillAll();
    $("btn-open").onclick = () => handlers.open();
    $("btn-skip").onclick = () => handlers.skip();
    $("btn-next").onclick = () => handlers.next();
    $("btn-continue").onclick = () => handlers.cont();
    $("btn-new").onclick = () => handlers.newGame();
    $("btn-pause").onclick = () => handlers.pause();
    $("btn-resume").onclick = () => handlers.pause(false);
    document.querySelectorAll("[data-speed]").forEach((b) => (b.onclick = () => handlers.speed(+b.dataset.speed)));
    $("btn-settings").onclick = () => { sfx("click"); syncMute(); openOv("ov-settings"); handlers.settingsOpen && handlers.settingsOpen(true); };
    $("btn-settings-close").onclick = () => { closeOv("ov-settings"); handlers.settingsOpen && handlers.settingsOpen(false); };
    $("btn-mute").onclick = () => { if (typeof Sfx !== "undefined") { if (Sfx.toggle) Sfx.toggle(); else Sfx.setMuted(!Sfx.muted); } syncMute(); sfx("click"); };
    $("btn-home").onclick = () => { closeOv("ov-settings"); handlers.home && handlers.home(); };
    $("btn-reset").onclick = async () => {
      closeOv("ov-settings");
      if (await confirmBox("Bütün ilerleme silinsin mi? Pamuk çok üzülür… 😿")) handlers.reset();
      else handlers.settingsOpen && handlers.settingsOpen(false);
    };
    document.querySelectorAll(".overlay").forEach((ov) => ov.addEventListener("click", (e) => {
      if (e.target === ov && ov.id === "ov-settings") { closeOv("ov-settings"); handlers.settingsOpen && handlers.settingsOpen(false); }
    }));
  }
  function syncMute() {
    const m = typeof Sfx !== "undefined" && Sfx.muted;
    $("btn-mute").textContent = m ? "🔇 Ses: Kapalı" : "🔊 Ses: Açık";
  }

  window.UI = {
    init, show, mountStage, updateTop, toast, confirm: confirmBox, anyOverlay, closeOv, openOv,
    renderTitle, stopTitle, intro,
    renderMorning, refreshMorning, flashCard,
    renderDayStart, updateHud, setSpeedButtons, setPaused,
    renderEvening, showLevelUp, renderFinale, fmt, renderForecast, forecast: null,
    _introNext: null, _lvClose: null
  };
})();
