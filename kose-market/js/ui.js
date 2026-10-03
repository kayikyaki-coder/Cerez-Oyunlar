// Köşe Market — ekran/panel çizimi: başlık, zorluk seçimi, sabah (gün kartı, finans, ekipman, stok+fiyat, yükseltmeler),
// gün HUD'u + kriz kartı, akşam raporu, iflas, final, overlay'ler. Oyun mantığı Game'de; DOM'u sadece burası (ve bubbles.js) yazar. Global: UI
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
    get BUBBLE_TYPES() { return typeof BUBBLE_TYPES !== "undefined" ? BUBBLE_TYPES : {}; },
    get HINTS() { return typeof HINTS !== "undefined" ? HINTS : []; },
    get RIVAL() { return typeof RIVAL !== "undefined" ? RIVAL : null; }
  };
  const S = () => Game.state;
  const fmt = (n) => (n < 0 ? "−₺" : "₺") + Math.abs(Math.round(n || 0)).toLocaleString("tr-TR");
  // Ondalıklı fiyat: 2,76 → ₺2,8 · 5 → ₺5
  const fmtD = (n) => { const r = Math.round((n || 0) * 10) / 10; return "₺" + (Number.isInteger(r) ? r : r.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })); };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const sfx = (name, a) => { try { if (typeof Sfx !== "undefined" && Sfx[name]) Sfx[name](a); } catch (e) { /* ses yoksa sorun değil */ } };
  const pick = (arr, seed) => (arr && arr.length ? arr[Math.abs(seed | 0) % arr.length] : "");
  const levelInfo = () => (Game.levelInfo ? Game.levelInfo() : { level: S().level, title: "", progress: 0 });
  const regById = (id) => D.REGULARS.find((r) => r.id === id);
  const prodById = (id) => D.PRODUCTS.find((p) => p.id === id);
  const obj = (x, list) => (x && typeof x === "object" ? x : (list || []).find((o) => o.id === x) || (x ? { id: x, name: x } : null));
  const call = (name, ...a) => (typeof Game[name] === "function" ? Game[name](...a) : undefined);

  // Türkçe bulunma eki: Sv. 2'de, 3'te, 6'da, 10'da…
  function locSuffix(n) {
    n = Math.abs(n | 0);
    const last = n % 10, tens = Math.floor(n / 10) % 10;
    if (last === 0) return n === 0 ? "da" : ["", "da", "de", "da", "de", "de", "da", "de", "de", "da"][tens] || "de";
    return ["", "de", "de", "te", "te", "te", "da", "de", "de", "da"][last];
  }
  const WD_SHORT = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
  function inDays(n) { return n <= 0 ? "bugün" : n === 1 ? "yarın" : n + " gün sonra"; }

  let handlers = {};
  let plan = null;
  let hudCache = {};
  let crisisKey = "";

  // ---------- genel ----------
  function show(name) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === "screen-" + name));
    $("app").dataset.screen = name;
    $("app").dataset.phase = name === "day" ? "day" : name === "evening" ? "evening" : name;
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }
  // Atmosfer kancaları: görsel katman (CSS/render) hava, olay ve günün saatine göre ton verebilsin
  function setAtmos(p) {
    const a = $("app");
    a.dataset.weather = (p && p.weather && (p.weather.id || p.weather)) || "";
    a.dataset.event = (p && p.event && (p.event.id || p.event)) || "";
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
    $("top-money").parentElement.classList.toggle("debt", (s.debt || 0) > 0);
    $("top-money").parentElement.title = (s.debt || 0) > 0 ? "Kasa · borcun " + fmt(s.debt) : "Kasa";
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
      $("btn-confirm-no").classList.toggle("hidden", noLabel === null);
      $("btn-confirm-yes").classList.toggle("danger", !yesLabel);
      $("btn-confirm-yes").classList.toggle("red", !!yesLabel);
      const done = (v) => { closeOv("ov-confirm"); $("btn-confirm-yes").onclick = $("btn-confirm-no").onclick = null; $("btn-confirm-no").classList.remove("hidden"); res(v); };
      $("btn-confirm-yes").onclick = () => done(true);
      $("btn-confirm-no").onclick = () => done(false);
    });
  }
  // Tek düğmeli bilgilendirme
  const notice = (text, label) => confirmBox(text, label || "Tamam", null);

  // ---------- başlık ----------
  let titleTimer = 0, titleIdx = 0;
  function diffOf(id) { return (typeof DIFFICULTIES !== "undefined" && DIFFICULTIES[id]) || null; }
  function renderTitle(hasSave) {
    const s = S();
    const cont = $("btn-continue");
    cont.classList.toggle("hidden", !hasSave);
    if (hasSave) {
      const df = diffOf(s.diff);
      cont.innerHTML = "▶ Devam Et <small>Gün " + s.day + " · " + fmt(s.money) + (df ? " · " + df.emoji + " " + esc(df.name) : "") + (s.bankrupt ? " · 🔒 iflas" : "") + "</small>";
    }
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

  // Zorluk seçimi: kartlar; her kartta anahtar çarpanlar (sadece gelir değil, mekaniklerin yoğunluğu)
  function diffBullets(d) {
    const x = (v) => "×" + (+v).toFixed(2).replace(/\.?0+$/, "");
    return [
      "Başlangıç ₺" + d.startMoney, "Kira " + x(d.rent), "Rakip " + x(d.rivalAggro) + " (gün " + (Math.max(2, (D.RIVAL ? D.RIVAL.openDay : 12) + (d.rivalOpen || 0))) + "'de açılır)",
      "Hırsız " + x(d.theft), "Arıza " + x(d.breakdown), "Kriz " + x(d.crisis), "Baloncuk süresi " + x(d.bubbleLife), "Kaçırma cezası " + x(d.penalty),
      "Raf ömrü " + x(d.life), "Borç limiti " + x(d.debtLimit), d.piggy ? "Kumbara " + d.piggy + " hak" : "Kumbara yok", d.checkpoint ? "İflasta son kayıt var" : "İflasta son kayıt YOK"
    ];
  }
  function pickDifficulty() {
    return new Promise((res) => {
      const list = (Game.difficulties ? Game.difficulties() : []);
      $("diff-list").innerHTML = list.map((d) =>
        '<button class="diff-card' + (d.id === "normal" ? " rec" : "") + '" data-diff="' + d.id + '"><span class="dc-em">' + d.emoji + '</span><span class="dc-body"><b>' +
        esc(d.name) + (d.id === "normal" ? ' <i class="rec-tag">önerilen</i>' : "") + "</b><em>" + esc(d.tag || "") + "</em><span class=\"dc-desc\">" + esc(d.desc || "") +
        '</span><span class="dc-chips">' + diffBullets(d).map((b) => "<i>" + esc(b) + "</i>").join("") + "</span></span></button>").join("");
      const done = (v) => { closeOv("ov-diff"); $("diff-list").onclick = null; $("btn-diff-cancel").onclick = null; res(v); };
      $("diff-list").onclick = (e) => { const b = e.target.closest("[data-diff]"); if (b) { sfx("click"); done(b.dataset.diff); } };
      $("btn-diff-cancel").onclick = () => done(null);
      openOv("ov-diff");
    });
  }

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
    // rakip
    const R = D.RIVAL;
    if (R && p.rival) {
      if (p.rival.active) {
        const c = p.rival.campaign, lost = Math.max(0, p.rival.lost || 0);
        html += '<div class="dc-row rival' + (c ? " camp" : "") + '"><span class="ic">' + (R.emoji || "🏬") + '</span><div><div class="t">' + esc(R.name) + (c ? " · KAMPANYA" : "") +
          '</div><div class="d">' + (c ? esc(c.text) + " " : "") + "Müşterinin ~%" + Math.round((p.rival.share || 0) * 100) + "'ini çekiyor" + (lost ? " (bugün ~" + lost + " müşteri)" : "") +
          ". Kartlarda rakibin fiyatını gör; pahalı kalırsan müşteri onlara gider.</div></div></div>";
      } else if (p.rival.open && p.rival.open - s.day <= 6 && p.rival.open > s.day) {
        html += '<div class="dc-row rival soon"><span class="ic">' + (R.emoji || "🏬") + '</span><div><div class="t">' + esc(R.name) + " " + inDays(p.rival.open - s.day) +
          ' açılıyor</div><div class="d">Köşeye yeni bir market geliyor: fiyatları senden ucuz olacak. Memnuniyet ve Sadakat Kartı seni korur.</div></div></div>';
      }
    }
    if (g) html += '<div class="dc-row goal"><span class="ic">🎯</span><div><div class="t">Günün hedefi</div><div class="d">' + esc(g.text || "") +
      '</div><span class="dc-reward">' + goalRewardText(g) + "</span></div></div>";
    const regs = (p.regulars || []).map(regById).filter(Boolean);
    if (regs.length) {
      html += '<div class="dc-row"><span class="ic">🏘️</span><div><div class="t">Bugün uğrayacaklar</div><div class="dc-regs">' +
        regs.map((r) => { const lp = prodById(r.likes); return '<span class="dc-reg" title="' + esc(r.line || "") + '"><span class="e">' + r.emoji + "</span>" + esc(r.name) + (lp ? " · " + lp.emoji : "") + "</span>"; }).join("") +
        "</div></div></div>";
    }
    // çok aranacaklar
    const hot = D.PRODUCTS.filter((pr) => s.unlocked[pr.id]).map((pr) => ({ pr, r: (p.heat && p.heat[pr.id]) || (p.demand[pr.id] || 0) / (pr.demand || 1) }))
      .filter((x) => x.r >= 1.25).sort((a, b) => b.r - a.r).slice(0, 4);
    if (hot.length) html += '<div class="dc-hot">🔥 Çok aranacak: ' + hot.map((x) => '<span class="hp">' + x.pr.emoji + " " + esc(x.pr.name) + "</span>").join("") + "</div>";
    $("daycard").innerHTML = html;
  }

  // ---- finans şeridi (kira, giderler, borç, kumbara, sezon) ----
  function renderFin() {
    const el = $("fin-strip"); if (!el) return;
    const s = S(), f = Game.finance ? Game.finance() : null;
    if (!f) { el.innerHTML = ""; return; }
    const chips = [];
    const rentWd = WD_SHORT[(f.rentDay - 1) % 7];
    const rentTight = s.money < f.rentAmount * (f.rentIn <= 1 ? 0.7 : 0.35);
    if (f.grace > 0) chips.push('<span class="fchip good" title="Eski kaydın yeni sürüme taşındı: giderler yumuşak">🛟 Gider muafiyeti: ' + f.grace + " gün</span>");
    else chips.push('<span class="fchip rent' + (f.rentToday ? " due" : "") + (rentTight && f.rentIn <= 3 ? " warn" : "") + '" title="Her Pazar akşamı haftalık kira düşer; seviyen yükseldikçe artar">🧾 Kira: ' + rentWd + " akşamı · " + inDays(f.rentIn) + " · <b>" + fmt(f.rentAmount) +
      "</b>" + (rentTight && f.rentIn <= 3 ? " — kasan yetmeyebilir!" : "") + "</span>");
    chips.push('<span class="fchip" title="Elektrik, maaş ve aidatlar: her akşam düşer">🔌 Günlük gider: <b>' + fmt(f.utility) + "</b></span>");
    if (f.debt > 0) chips.push('<span class="fchip debt' + (f.debt > f.debtLimit * 0.7 ? " warn" : "") + '" title="Her gün faiz işler; kârının %40\'ı otomatik borca gider. Limiti aşarsan iflas!">⚠️ Borç: <b>' + fmt(f.debt) + "</b> / limit " + fmt(f.debtLimit) + " · " + f.debtDays + "/" + f.debtMaxDays +
      ' gün<button class="mini-btn" data-act="repay"' + (s.money <= 0 ? " disabled" : "") + ">Öde</button></span>");
    if (f.piggyLeft > 0) chips.push('<span class="fchip" title="Paran bitip rafın boşalırsa Pamuk kumbarasını devirir">🐷 Kumbara: ' + f.piggyLeft + " hak</span>");
    const se = Game.seasonInfo ? Game.seasonInfo() : null;
    if (se) chips.push('<span class="fchip season" title="Sonsuz mod: her sezonda hedef kârı tutturursan ödül kazanırsın; rakip ve kira her sezon büyür">🏆 Sezon ' + se.n + ": " + fmt(se.profit) + " / " + fmt(se.goal) + " kâr · " + inDays(se.daysLeft).replace("bugün", "son gün") + "</span>");
    el.innerHTML = chips.join("");
  }

  // ---- ekipman ----
  function renderEquip() {
    const el = $("equip-panel"); if (!el) return;
    const s = S(), list = Game.equipInfo ? Game.equipInfo() : [];
    const show = list.length && (s.day >= 5 || list.some((e) => e.cond < 100 || e.broken));
    el.classList.toggle("hidden", !show);
    if (!show) { el.innerHTML = ""; return; }
    el.innerHTML = '<div class="eq-title">🔧 Ekipman <small>durum düştükçe arıza riski artar</small></div><div class="eq-list">' + list.map((e) => {
      const cls = e.broken ? "broken" : e.cond >= 70 ? "ok" : e.cond >= 40 ? "warn" : "bad";
      const label = e.broken ? "💥 BOZUK: " + (e.id === "register" ? "kuyruk uzar, müşteri kaçar" : "soğuk ürün satışı düşer, taze ürün çabuk bozulur")
        : "Durum %" + e.cond + " · arıza riski ~%" + Math.round(e.risk * 100) + "/gün";
      const btn = e.broken ? '<button class="btn red" data-act="service" data-eq="' + e.id + '"' + (s.money < e.cost ? " disabled" : "") + ">🔧 Tamir et " + fmt(e.cost) + "</button>"
        : e.needed ? '<button class="btn teal" data-act="service" data-eq="' + e.id + '"' + (s.money < e.cost ? " disabled" : "") + ">🛠️ Bakım " + fmt(e.cost) + "</button>"
          : '<button class="btn" disabled>Sağlam ✓</button>';
      return '<div class="eq ' + cls + '"><span class="eq-ic">' + e.emoji + '</span><div class="eq-body"><b>' + esc(e.name) + '</b><div class="bar"><i style="width:' + (e.broken ? 4 : e.cond) + '%"></i></div><small>' + esc(label) + "</small></div>" + btn + "</div>";
    }).join("") + "</div>";
  }

  // ---- öğretici ipucu ----
  function renderHint() {
    const el = $("hint-box"); if (!el) return;
    const h = Game.pendingHint ? Game.pendingHint() : null;
    el.classList.toggle("hidden", !h);
    if (!h) { el.innerHTML = ""; return; }
    el.innerHTML = '<span class="mh-ic">' + (h.emoji || "💡") + '</span><div class="mh-body"><b>' + esc(h.title) + "</b><p>" + esc(h.text) + '</p></div><button class="btn cream" data-act="hint" data-id="' + esc(h.id) + '">Anladım</button>';
  }

  // ---- raf yuvası çubuğu ----
  function renderSlots() {
    const el = $("slot-bar"); if (!el) return;
    const used = Game.slotsUsed(), tot = Game.totalSlots(), pctU = Math.min(100, (used / Math.max(1, tot)) * 100);
    const full = used >= tot - 1, cls = full ? "full" : pctU > 85 ? "tight" : "";
    el.className = "slot-bar " + cls;
    el.innerHTML = '<span class="sb-l">🧺 Raf yuvası</span><div class="bar"><i style="width:' + pctU + '%"></i></div><b>' + used + " / " + tot + "</b>" +
      (full ? '<em>Raf doldu! Ek Raf al ya da az satanı bitir.</em>' : pctU > 85 ? "<em>Raf dolmak üzere</em>" : "");
  }

  function productNeed(p) { return p.el <= 1.3 ? { k: "need", t: "🧱 ihtiyaç", d: "Zorunlu ürün: müşteri zamma dayanır, zam çoğu zaman kazandırır" } : p.el >= 2 ? { k: "impulse", t: "🍬 dürtü", d: "Dürtü ürünü: indirimde çok artar, zamda hızla kaçar" } : { k: "std", t: "", d: "" }; }

  function renderStock() {
    const s = S(), eff = Game.effects();
    const grid = $("stock-grid");
    const exp = plan ? Game.expectedSales(plan) : {}, tgt = plan ? Game.stockTargets(plan) : {};
    const free = Game.slotsFree();
    let html = "", hidden = 0, hiddenMin = 99;
    for (const p of D.PRODUCTS) {
      const unlocked = !!s.unlocked[p.id];
      if (!unlocked && (p.unlockLevel || 1) > s.level + 1) { hidden++; hiddenMin = Math.min(hiddenMin, p.unlockLevel || 1); continue; }
      if (!unlocked) {
        const lvlOk = s.level >= (p.unlockLevel || 1);
        const needFridge = p.cold && !eff.fridge;
        html += '<div class="pcard locked" data-pid="' + p.id + '"><div class="emoji">' + p.emoji + '</div><div class="name">' + esc(p.name) + "</div>" +
          '<div class="desc">' + esc(p.desc || "") + "</div>" +
          '<div class="price">Al ' + fmtD(Game.unitCost(p.id)) + " · Sat <b>" + fmt(p.price) + "</b></div>" +
          (needFridge ? '<div class="pinfo"><span class="pi cold" title="Dolap yoksa bu ürüne talep %30 düşer">🧊 buzdolabı gerekir</span></div>' : "") +
          (lvlOk ? '<button class="btn gold" data-unlock="' + p.id + '"' + (s.money < (p.unlockCost || 0) ? " disabled" : "") + ">🔓 Kilidi Aç (" + fmt(p.unlockCost || 0) + ")</button>"
            : '<div class="lockline">🔒 Sv. ' + (p.unlockLevel || 1) + "'" + locSuffix(p.unlockLevel || 1) + " açılır</div>") + "</div>";
        continue;
      }
      const have = s.stock[p.id] || 0, c = Game.unitCost(p.id), sl = p.slots || 1;
      const need = exp[p.id] || 0, t = tgt[p.id] || 0;
      const poor = s.money < c, noRoom = free < sl;
      const fillN = Math.max(0, Math.min(t - have, Math.floor(free / sl)));
      let affordN = fillN; while (affordN > 0 && Game.lineCost(p.id, affordN) > s.money) affordN--;
      const pct = Math.min(100, (have / Math.max(1, t * 1.15)) * 100);
      const barCls = have >= t ? "full" : have < Math.max(1, need * 0.6) ? "low" : "";
      const heat = (plan && plan.heat && plan.heat[p.id]) || 1;
      const pi = Game.priceInfo(p.id, plan);
      const age = Game.stockAging(p.id), nd = productNeed(p);
      let tagL = "", tagR = "";
      if (heat >= 1.3) tagL = '<span class="tag hot">🔥 aranıyor</span>'; else if (heat <= 0.6) tagL = '<span class="tag cold">💤 az</span>';
      if (p.cold && !eff.fridge) tagR = '<span class="tag fresh" title="Dolap yoksa bu ürüne talep %30 düşer">🧊 dolap şart</span>';
      else if (age.fresh) tagR = '<span class="tag fresh" title="Raf ömrü: ' + age.life + ' gece">⏳ ' + age.life + " gece</span>";
      // fiyat kademeleri
      const tierBtns = pi.options.map((o) => '<button class="tier t' + o.tier + (o.tier === pi.tier ? " on" : "") + '" data-tier="' + o.tier + '" data-pid="' + p.id + '" title="' +
        esc(pi.names[o.tier]) + " " + fmt(o.price) + ": talep ×" + o.factor.toFixed(2).replace(".", ",") + ", adet kârı " + fmt(o.price - Game.unitCost(p.id)) + '"><i>' + esc(pi.names[o.tier]) + "</i>" + fmt(o.price) + "</button>").join("");
      const infos = [];
      if (pi.rival != null) infos.push('<span class="pi rival' + (pi.campaign ? " camp" : "") + (pi.price > pi.rival * 1.04 ? " over" : "") + '" title="Zincir Market fiyatı' + (pi.campaign ? " (kampanya)" : "") + '">🏬 ' + fmtD(pi.rival) + (pi.campaign ? " %" : "") + "</span>");
      if (nd.t) infos.push('<span class="pi ' + nd.k + '" title="' + esc(nd.d) + '">' + nd.t + "</span>");
      if (age.fresh && age.tonight > 0) infos.push('<span class="pi warn" title="Bu geceyi çıkaramayacak, çöpe gider">⚠️ ' + age.tonight + " adet yarın bozulur</span>");
      html += '<div class="pcard" data-pid="' + p.id + '"><div class="tags">' + (tagL || "<span></span>") + tagR + "</div>" +
        '<div class="emoji">' + p.emoji + '</div><div class="name">' + esc(p.name) + (sl > 1 ? ' <small class="sl">' + sl + " yuva</small>" : "") + "</div>" +
        '<div class="price">Al ' + fmtD(c) + " · Sat <b>" + fmt(pi.price) + "</b></div>" +
        '<div class="tiers" role="group" aria-label="Satış fiyatı">' + tierBtns + "</div>" +
        '<div class="pinfo">' + (infos.join("") || "<span></span>") + "</div>" +
        '<div class="bar ' + barCls + '"><i style="width:' + pct + '%"></i></div><div class="stk">' + have + " adet · bugün ~" + Math.round(need) + " satılır</div>" +
        '<div class="pbtns"><button class="btn" data-buy="' + p.id + '" data-n="1"' + (noRoom || poor ? " disabled" : "") + ">+1</button>" +
        '<button class="btn blue" data-buy="' + p.id + '" data-n="5"' + (noRoom || poor ? " disabled" : "") + ">+5</button>" +
        '<button class="btn wood fill" data-buy="' + p.id + '" data-n="fill"' + (affordN <= 0 ? " disabled" : "") + ">" +
        (have >= t ? "Yeterli ✓" : noRoom ? "Raf dolu" : "Hedefe" + (affordN > 0 ? " (+" + affordN + " · " + fmt(Game.lineCost(p.id, affordN)) + ")" : "")) + "</button></div></div>";
    }
    if (hidden) html += '<div class="pcard locked more"><div class="emoji">🎁</div><div class="name">+' + hidden + ' sürpriz ürün</div><div class="desc">İtibarın arttıkça raflara yenileri gelecek</div><div class="lockline">🔒 Sv. ' + hiddenMin + "+</div></div>";
    grid.innerHTML = html;
    // özet
    const total = D.PRODUCTS.reduce((a, p) => a + (s.unlocked[p.id] ? s.stock[p.id] || 0 : 0), 0);
    const expC = plan ? plan.customers : 0;
    const sumTarget = Object.values(exp).reduce((a, b) => a + b, 0);
    const warn = total === 0 ? '<span class="warn">Raflar bomboş! Müşteriler eli boş döner 😿</span>'
      : total < sumTarget * 0.8 ? '<span class="warn">Raflar biraz az gibi…</span>' : "<span>Raflar hazır görünüyor 👍</span>";
    $("stock-summary").innerHTML = "🧺 Rafta <b>" + total + "</b> ürün · 🚶 ~" + expC + " müşteri · beklenen satış ~" + Math.round(sumTarget) + " ürün · " + warn;
    $("cap-note").textContent = "Toplam raf yuvası: " + Game.totalSlots();
    $("btn-fill").disabled = !D.PRODUCTS.some((p) => s.unlocked[p.id] && (s.stock[p.id] || 0) < (tgt[p.id] || 0) && Game.slotsFree() >= (p.slots || 1) && s.money >= Game.unitCost(p.id));
    renderSlots();
  }

  function upkeepOf(l) { return (l && l.effect && l.effect.upkeep) || 0; }
  function renderUpgrades() {
    const s = S();
    let html = "";
    for (const u of D.UPGRADES) {
      const lvl = Game.upgradeLevel(u.id), levels = u.levels || [], max = levels.length;
      const maxed = lvl >= max;
      const next = maxed ? null : levels[lvl];
      const reqOk = !u.req || Game.upgradeLevel(u.req) > 0;
      const avail = !maxed && Game.upgradeAvailable(u.id);
      const req = next ? Math.max(u.unlockLevel || 1, next.minLevel || 1, next.unlockLevel || 1) : 0;
      const cost = next ? next.cost : 0;
      const cls = "ucard" + (maxed ? " maxed" : !avail ? " locked" : "") + (u.cat === "final" ? " final" : "");
      const pips = max > 1 ? '<div class="lv">' + levels.map((_, i) => "<i" + (i < lvl ? ' class="on"' : "") + "></i>").join("") + "</div>" : "";
      const nextTxt = next && next.desc ? '<div class="next">' + (lvl > 0 ? "Sonraki: " : "") + esc(next.desc) + "</div>" : "";
      const upk = levels.slice(0, lvl).reduce((a, l) => a + upkeepOf(l), 0);
      const upkTxt = upk > 0 ? '<div class="upk" title="Her akşam giderine eklenir">Şu an günlük gider: −' + fmt(upk) + "</div>" : "";
      let btn;
      if (maxed) btn = '<button class="btn" disabled>' + (max > 1 ? "Tamamlandı ✓" : "Alındı ✓") + "</button>";
      else if (!reqOk) { const r = Game.upgradeLevel && D.UPGRADES.find((x) => x.id === u.req); btn = '<button class="btn cream" disabled>🔒 Önce ' + esc(r ? r.name : u.req) + "</button>"; }
      else if (!avail) btn = '<button class="btn cream" disabled>🔒 Sv. ' + req + "'" + locSuffix(req) + " açılır</button>";
      else btn = '<button class="btn ' + (u.cat === "final" ? "red" : "gold") + '" data-upg="' + u.id + '"' + (s.money < cost ? " disabled" : "") + ">" +
        (lvl > 0 ? "Yükselt" : "Al") + " (" + fmt(cost) + ")</button>";
      html += '<div class="' + cls + '"><div class="row"><div class="ic">' + (u.emoji || "⭐") + '</div><div><div class="t">' + esc(u.name) +
        (max > 1 ? ' <small style="opacity:.6;white-space:nowrap">Sv. ' + lvl + "/" + max + "</small>" : "") + "</div>" + pips + "</div></div>" +
        '<div class="d">' + esc(u.desc || "") + "</div>" + nextTxt + upkTxt + btn + "</div>";
    }
    $("upg-grid").innerHTML = html;
  }

  function renderMorning(p, anim) {
    plan = p;
    setAtmos(p); $("app").dataset.phase = "morning";
    const s = S(), tips = D.STORY.tips || [], early = D.STORY.earlyTips || [];
    renderHint();
    renderDayCard(p);
    const tip = s.day <= early.length ? early[s.day - 1] : pick(tips, s.day * 7 + 3);
    $("morning-tip").innerHTML = "<span><b>Pamuk'un ipucu:</b> " + esc(tip) + "</span>";
    renderFin(); renderEquip(); renderStock(); renderUpgrades(); updateTop(); renderForecast();
    if (anim) {
      $("stock-grid").classList.add("stagger"); $("upg-grid").classList.add("stagger"); $("daycard").classList.add("stagger");
      setTimeout(() => ["stock-grid", "upg-grid", "daycard"].forEach((id) => $(id).classList.remove("stagger")), 900);
    }
  }
  // Her satın almadan sonra: günün planı (müşteri sayısı, talep, kart) yeniden hesaplanır
  function refreshMorning() {
    plan = Game.planDay();
    renderDayCard(plan); renderFin(); renderEquip(); renderStock(); renderUpgrades(); updateTop(); renderForecast();
  }
  // Oyna / hızlı geç tahmini: kesin sonuç DEĞİL — benzer iki-üç günün (farklı müşteri/baloncuk tohumu) aralığı gösterilir
  function renderForecast() {
    const ep = $("est-play"), es = $("est-skip"), tr = $("tradeoff");
    let play = null, skip = null;
    try {
      if (Game.simulateClone) {
        const profits = (mode, pol) => [1, 2, 3].map((k) => { const r = Game.simulateClone(mode, pol, k); return r ? Math.round(r.profit != null ? r.profit : r.net) : 0; });
        play = profits("play", { hitRate: 0.7, reactSec: 1.3 });
        skip = profits("skip");
      }
    } catch (e) { play = skip = null; }
    const rnd = (x) => Math.round(x / 10) * 10;
    const mid = (a) => a.slice().sort((x, y) => x - y)[1];
    if (!play || !skip) {
      UI.forecast = null;
      ep.textContent = "baloncuklara dokun, kombo yap"; es.textContent = "baloncuklar çözülmez";
      tr.innerHTML = "🐈 Oynamak daha kârlı; hızlı geçersen dükkân başıboş kalır.";
      return;
    }
    const pv = mid(play), sv = mid(skip);
    UI.forecast = { day: S().day, play: pv, skip: sv };
    const rg = (a) => fmt(rnd(Math.min(...a))) + "–" + fmt(rnd(Math.max(...a)));
    ep.textContent = "tahmini kâr ~" + rg(play);
    es.textContent = "~" + rg(skip) + " · başıboş";
    const diff = pv - sv;
    tr.innerHTML = "🐈 Tahmin kesin değil. Hızlı geçersen baloncuklar çözülmez, <b>hırsız ×2</b> gelir, kriz kartları 'görmezden gel' olur" +
      (diff > 0 ? "; oynamak ortalama <b>+" + fmt(rnd(diff)) + "</b> kazandırır." : ".");
  }
  function flashCard(pid) {
    const c = document.querySelector('.pcard[data-pid="' + pid + '"]'); if (c) { c.classList.remove("flash"); void c.offsetWidth; c.classList.add("flash"); }
  }

  // ---------- gün HUD ----------
  function renderDayStart(p) {
    plan = p; hudCache = {}; crisisKey = "";
    setAtmos(p); $("app").dataset.phase = "day";
    const s = S();
    $("chips").innerHTML = D.PRODUCTS.filter((pr) => s.unlocked[pr.id]).map((pr) =>
      '<span class="chip" data-chip="' + pr.id + '" title="' + esc(pr.name) + '"><span class="e">' + pr.emoji + '</span><span class="n">0</span></span>').join("");
    renderDayInfo(p);
    const g = p.goal;
    $("hud-goal-cell").classList.toggle("hidden", !g);
    $("hud-goal-cell").classList.remove("done", "failed");
    if (g) { $("hud-goal-txt").textContent = "🎯 " + (g.text || "Hedef"); $("hud-goal-txt").title = g.text || ""; }
    hideCrisis();
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
      (ev ? '<span class="di-pill ev">' + (ev.emoji || "🎉") + " " + esc(ev.name) + "</span>" : "") +
      (p.rival && p.rival.campaign ? '<span class="di-pill ev">🏬 ' + esc(p.rival.campaign.text) + "</span>" : "") + "</div>";
    const regs = (p.regulars || []).map(regById).filter(Boolean);
    if (regs.length) html += '<div class="di-regs">🏘️ Bugün uğrayacak: ' + regs.map((r) => { const lp = prodById(r.likes); return "<b>" + r.emoji + " " + esc(r.name) + "</b>" + (lp ? " " + lp.emoji : ""); }).join(" · ") + "</div>";
    const tips = D.STORY.tips || [];
    const tip = pick(tips, s.day * 5 + 1);
    if (tip) html += '<div class="di-tip">🐈 ' + esc(tip) + "</div>";
    el.innerHTML = html;
  }
  function setIf(key, val, fn) { if (hudCache[key] !== val) { hudCache[key] = val; fn(val); } }
  // Memnuniyet kalpleri: boş/yarım/dolu <i class="hp"> (CSS çizer; CSS yoksa mech.css'teki yedek ♥ görünür)
  function hearts(sat) {
    const v = Math.max(0, Math.min(100, sat)) / 20; let h = "";
    for (let i = 0; i < 5; i++) h += '<i class="hp ' + (v >= i + 0.75 ? "full" : v >= i + 0.3 ? "half" : "empty") + '" aria-hidden="true"></i>';
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
    setIf("phase", p < 0.72 ? "day" : "dusk", (v) => { $("app").dataset.phase = v; });
    setIf("sat", Math.round(s.sat), (v) => {
      const el = $("hud-hearts"); const prev = +el.dataset.v || v; el.innerHTML = hearts(v); el.dataset.v = v; el.parentElement.title = "Memnuniyet " + v + "/100";
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
    // stok çipleri (kıtlık: toplam yuvaya göre değil, o ürünün günlük payına göre)
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
    renderMechBar(run);
    renderCrisis();
  }
  // Gün içi mekanik çubuğu: rakip, ekipman durumu, kira, borç
  function renderMechBar(run) {
    const el = $("mech-bar"); if (!el) return;
    const s = S(), f = Game.finance ? Game.finance() : null, pl = run.plan || plan || {};
    const items = [];
    if (pl.rival && pl.rival.active) items.push({ k: "rival" + (pl.rival.campaign ? "C" : ""), h: '<span class="mb rival' + (pl.rival.campaign ? " camp" : "") + '" title="' + esc(pl.rival.campaign ? pl.rival.campaign.text : "Zincir Market müşteri çekiyor") + '">🏬 ' + (pl.rival.campaign ? "kampanya" : "rakip ~%" + Math.round(pl.rival.share * 100)) + "</span>" });
    for (const e of (Game.equipInfo ? Game.equipInfo() : []))
      items.push({ k: e.id + e.cond + e.broken, h: '<span class="mb eq ' + (e.broken ? "broken" : e.cond < 40 ? "bad" : e.cond < 70 ? "warn" : "ok") + '" title="' + esc(e.name) + " durumu %" + e.cond + '">' + e.emoji + (e.broken ? " 💥 bozuk" : " %" + e.cond) + "</span>" });
    if (f) {
      if (f.rentToday) items.push({ k: "rentToday", h: '<span class="mb rent due" title="Bugün akşam kira düşer">🧾 bugün kira ' + fmt(f.rentAmount) + "</span>" });
      else if (f.rentIn <= 2 && !f.grace) items.push({ k: "rent" + f.rentIn, h: '<span class="mb rent" title="Kira Pazar akşamı">🧾 kira ' + inDays(f.rentIn) + " " + fmt(f.rentAmount) + "</span>" });
      if (f.debt > 0) items.push({ k: "debt" + f.debt, h: '<span class="mb debt" title="Borç faiz işler">⚠️ borç ' + fmt(f.debt) + "</span>" });
    }
    const key = items.map((x) => x.k).join("|");
    setIf("mechbar", key, () => { el.innerHTML = items.map((x) => x.h).join(""); el.classList.toggle("empty", !items.length); });
  }

  // ---- kriz kartı (sabit alt kart; sahneyi örtmez) ----
  function hideCrisis() { const el = $("crisis-card"); if (el) { el.classList.add("hidden"); el.innerHTML = ""; } crisisKey = ""; }
  function renderCrisis() {
    const el = $("crisis-card"); if (!el) return;
    const v = Game.crisisView ? Game.crisisView() : null;
    if (!v) { if (crisisKey) hideCrisis(); return; }
    const key = v.id + "|" + (Game.run ? Game.run.crisisSeq : 0);
    if (key !== crisisKey) {
      crisisKey = key;
      el.innerHTML = '<div class="cc-head"><span class="cc-ic">' + esc(v.emoji) + '</span><div><b>' + esc(v.title) + "</b><p>" + esc(v.text) + '</p></div></div><div class="cc-time"><i></i></div><div class="cc-opts">' +
        v.options.map((o, i) => '<button class="btn gold cc-opt" data-crisis="' + esc(o.id) + '"' + (o.affordable ? "" : " disabled") + "><span class=\"k\">" + (i + 1) + "</span><span class=\"t\"><b>" + esc(o.label) +
          (o.cost ? " · " + fmt(o.cost) : "") + "</b><small>" + esc(o.hint) + "</small></span></button>").join("") +
        '<button class="btn cream cc-opt ig" data-crisis="ignore"><span class="k">0</span><span class="t"><b>Görmezden gel</b><small>' + esc(v.ignore.hint) + "</small></span></button></div>";
      el.classList.remove("hidden"); sfx("tap");
    }
    const bar = el.querySelector(".cc-time i"); if (bar) bar.style.width = (100 * v.timeLeft / v.total).toFixed(1) + "%";
    el.classList.toggle("urgent", v.timeLeft < 3);
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
    if (s.bankrupt) return "Hasan Abi kepenkleri indirdi… Ama biz yine yeniden başlarız 🐾";
    if (s.levelUp) return "Seviye atladık! Kuyruğum gururdan dimdik 🐈✨";
    if (s.forfeit) return "Kapıyı açık bırakıp çıktık… Hırsızlar bayram etti 🙀";
    if (s.mode === "skip") return "Hızlı geçtik… dükkân başıboştu, ben de uyudum zaten 😴 Yarın beraber oynayalım mı?";
    if ((s.theftLoss || 0) > 0) return "Biri raftan mal götürdü! Bir dahakine Kamera & Alarm alalım mı? 🕵️";
    if (s.debt > 0) return "Borcumuz var… Faiz her gün işliyor, biraz sıkılaşalım 🐷";
    if (s.maxCombo >= 1.8) return "O kombo neydi öyle! Patilerim titredi 🐾🔥";
    if (lost > Math.max(3, (s.served || 0) * 0.3)) return "Raflar erken boşaldı gibi… Yarın biraz daha stok alalım mı? 🧺";
    if (s.spoiled > 0) return "Birkaç ürün bozuldu, mis gibi kokmuyor 🙀 Az al ya da buzdolabı tut.";
    if (s.satEnd >= 85) return "Mahalle bayıldı sana, herkes gülümsüyordu 💗";
    if (s.goalDone) return "Hedefi de tutturduk! Bir mama da bana? 🐟";
    return "Ne güzel bir gündü. Ben biraz kestireyim… 😴";
  }
  function sparkline() {
    const h = (S().history || []).slice(-7);
    if (h.length < 2) return "";
    const mx = Math.max(1, ...h.map((x) => Math.max(0, x.profit))), rentMax = Math.max(0, ...h.map((x) => x.rent || 0));
    return '<div class="weekly"><div class="wk-title">Son günler: kâr' + (rentMax ? " · 🧾 kira günü" : "") + '</div><div class="wk-bars">' + h.map((x) =>
      '<div class="wk-col' + (x.profit < 0 ? " neg" : "") + (x.rent ? " rent" : "") + '" title="Gün ' + x.day + ": kâr " + fmt(x.profit) + (x.rent ? ", kira " + fmt(x.rent) : "") + '"><i style="height:' + Math.max(6, Math.round(Math.abs(x.profit) / mx * 100)) + '%"></i><span>' + x.day + "</span></div>").join("") + "</div></div>";
  }
  function renderEvening(s, restored) {
    const st = S();
    const profit = s.profit != null ? s.profit : s.net;
    const est = s.estSkipProfit != null ? s.estSkipProfit : s.estSkipNet;
    const w = obj(s.weather, typeof WEATHERS !== "undefined" ? WEATHERS : []);
    const ev = obj(s.event, typeof DAY_EVENTS !== "undefined" ? DAY_EVENTS : []);
    const sub = [w ? (w.emoji || "") + " " + w.name : "", ev ? (ev.emoji || "") + " " + ev.name : ""].filter(Boolean).join(" · ");
    const cell = (l, v, extra, cls) => '<div class="rcell ' + (cls || "") + '"><div class="l">' + l + '</div><div class="v">' + v + "</div>" + (extra ? '<div class="s">' + extra + "</div>" : "") + "</div>";
    const fx = s.fixed || { utility: 0, rent: 0, interest: 0, repaid: 0, shortfall: 0 };
    const fixedTotal = fx.utility + fx.rent + fx.interest;
    setAtmos(null); $("app").dataset.phase = "evening";
    let html = "<h2>" + (s.bankrupt ? "Gün " + s.day + " — iflas 🔒" : s.mode === "skip" ? "Gün " + s.day + " " + (s.forfeit ? "başıboş geçti" : "hızlıca bitti") + " ⏩" : "Gün " + s.day + " bitti! 🌙") + "</h2>" +
      '<div class="sub">' + esc(sub || "Kepenkler indi, sokak lambaları yandı.") + "</div>";
    html += '<div class="rgrid stagger">';
    html += cell("Net kâr (giderlerden önce)", fmt(profit), s.net != null && s.net !== profit ? "kasa farkı " + fmt(s.net) + " · raf değeri dahil" : "", "net" + (profit < 0 ? " neg bad" : " good"));
    const custSub = [s.missed ? s.missed + " eli boş döndü" : "", s.lostCustomers ? s.lostCustomers + " gelmekten vazgeçti" : ""].filter(Boolean).join(" · ");
    html += cell("😊 Müşteri", (s.served || 0) + " / " + (s.customers || 0), custSub || "herkes mutlu");
    html += cell("💵 Ciro", fmt(s.revenue), (s.itemsSold || 0) + " ürün satıldı", "good");
    html += cell("🫧 Baloncuk", fmt(s.bubbleIncome), (s.popped || 0) + " patladı · " + (s.missedBubbles || 0) + " kaçtı", s.bubbleIncome > 0 ? "good" : "");
    if (s.tips) html += cell("💝 Bahşiş", fmt(s.tips), s.regularsServed ? s.regularsServed + " komşu memnun" : "", "good");
    html += cell("📦 Stok gideri", fmt(s.stockCost), s.emergencyCost ? "acil: " + fmt(s.emergencyCost) : "", "bad");
    html += cell("❤️ Memnuniyet", (s.satStart != null ? s.satStart + " → " : "") + s.satEnd, "");
    html += cell("🔥 En iyi kombo", "x" + (+s.maxCombo || 1).toFixed(1), "");
    html += cell("⭐ İtibar", "+" + (s.repGained || 0), "XP");
    if (s.spoiled) html += cell("🥀 Bozulan", s.spoiled, "ürün · " + fmt(s.spoiledValue || 0), "bad");
    if (s.moneyPenalty) html += cell("💸 Ceza", fmt(s.moneyPenalty), "kaçan baloncuklar", "bad");
    html += "</div>";

    // giderler ve kasa
    const rows = [];
    rows.push(["🔌 Elektrik / maaş / aidat", fx.utility]);
    if (fx.rent) rows.push(["🧾 Haftalık kira", fx.rent]);
    if (fx.interest) rows.push(["📉 Borç faizi", fx.interest]);
    html += '<div class="costs"><div class="costs-t">Akşam hesabı</div>' + rows.filter((r) => r[1] > 0 || r[0].indexOf("elektrik") > -1).map((r) => '<div class="crow"><span>' + r[0] + "</span><b>−" + fmt(r[1]).replace("₺", "₺") + "</b></div>").join("") +
      (fx.shortfall ? '<div class="crow bad"><span>⚠️ Ödenemeyen kısım borca yazıldı</span><b>' + fmt(fx.shortfall) + "</b></div>" : "") +
      (fx.repaid ? '<div class="crow good"><span>💳 Kârından borca giden</span><b>−' + fmt(fx.repaid) + "</b></div>" : "") +
      '<div class="crow total"><span>💰 Kasa şimdi</span><b>' + fmt(st.money) + "</b></div>" +
      (s.debt > 0 ? '<div class="crow debt"><span>Borç: ' + fmt(s.debt) + " / limit " + fmt(s.debtLimit) + " · " + (s.debtDays || 0) + "/" + (D.BALANCE.debtMaxDays || 14) + ' gün</span><div class="bar low"><i style="width:' + Math.min(100, (s.debt / Math.max(1, s.debtLimit)) * 100) + '%"></i></div></div>' : "") +
      (fixedTotal > 0 && profit > 0 ? '<div class="crow note"><span>Giderler kârının %' + Math.round(fixedTotal / Math.max(1, profit) * 100) + "'i</span></div>" : "") + "</div>";

    // günün olayları: hırsız, kriz, arıza, rakip
    const evl = [];
    if (s.thefts || s.caught) evl.push((s.caught ? "🕵️ " + s.caught + " hırsız yakalandı. " : "") + (s.thefts ? "🥷 " + s.thefts + " hırsız malı götürdü: " + (s.theftUnits || 0) + " ürün (~" + fmt(s.theftLoss || 0) + ")." : ""));
    for (const c of (s.crises || [])) evl.push("❓ " + c.text + (c.auto ? " (görmezden gelindi)" : ""));
    if (s.breakdowns && s.breakdowns.length) evl.push("💥 Arıza: " + s.breakdowns.map((b) => (b === "fridge" ? "buzdolabı" : "yazar kasa")).join(", ") + (s.brokenNow ? " — sabah tamir gerekir" : ""));
    if (s.regLost) evl.push("🧾 Kasa bozuk olduğu için " + s.regLost + " müşteri kaçtı.");
    if (s.rivalActive && s.rivalLost > 0) evl.push("🏬 Zincir Market bugün ~" + s.rivalLost + " müşteri çekti" + (s.rivalCampaign ? " (kampanya!)" : "") + ".");
    if (s.salvos) evl.push("⚡ " + s.salvos + " yoğun saat yaşandı.");
    if (s.forfeit) evl.push("🚪 Dükkânı açık bırakıp çıkmıştın: gün Hızlı Geç gibi, başıboş geçti.");
    if (evl.length) html += '<div class="evlines">' + evl.map((x) => "<div>" + esc(x) + "</div>").join("") + "</div>";
    html += sparkline();

    if (s.mode === "play" && est != null) {
      const diff = Math.round(profit - est);
      html += diff > 0 ? '<div class="highlight">Oynayarak +' + fmt(diff) + ' fazla kazandın 🎉<span class="sm">(atlasaydın ~' + fmt(est) + ")</span></div>"
        : '<div class="highlight">Bugün baloncuklar sakindi 🙂<span class="sm">(atlasaydın da ~' + fmt(est) + " kazanırdın)</span></div>";
    } else if (s.mode === "skip" && !s.forfeit) {
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
    if (s.season) html += s.season.ok ? '<div class="goalres ok"><span class="ic">🏆</span><div>Sezon ' + s.season.n + " hedefi tuttu! Kâr " + fmt(s.season.profit) + " / " + fmt(s.season.goal) + " <b style=\"color:var(--green)\">+" + fmt(s.season.reward) + "</b></div></div>"
      : '<div class="goalres no"><span class="ic">🏆</span><div>Sezon ' + s.season.n + " hedefi kaçtı: " + fmt(s.season.profit) + " / " + fmt(s.season.goal) + ". Yeni sezonda rakip ve kira biraz daha büyük.</div></div>";
    const li = levelInfo();
    html += '<div class="lvbox"><div class="top"><span>⭐ Sv. ' + li.level + " · " + esc(li.title) + "</span><span>" +
      (li.next != null ? li.rep + " / " + li.next + " XP" : "Zirvedesin! 👑") + '</span></div><div class="lvbar"><i id="lvfill" style="width:0%"></i></div>' +
      (li.nextTitle ? '<div class="s" style="font-size:11.5px;font-weight:800;opacity:.6;margin-top:3px">Sıradaki: ' + esc(li.nextTitle) + "</div>" : "") + "</div>";
    if (s.piggy) html += '<div class="pamuk-note">' + esc((D.STORY.piggyBank || "🐷 Pamuk kumbarasını devirdi!").replace("{n}", s.piggy).replace("{left}", st.piggyLeft)) + "</div>";
    html += '<div class="pamuk-note">🐈 ' + esc(pamukComment(s)) + "</div>";
    $("report").innerHTML = html;
    requestAnimationFrame(() => requestAnimationFrame(() => { const f = $("lvfill"); if (f) f.style.width = (li.progress * 100).toFixed(1) + "%"; }));
    $("btn-next").textContent = st.bankrupt ? "İflas Ekranı 🔒" : st.won && !st.uiFinaleSeen ? "Büyük Final 🎉" : "Yeni Güne Geç 🌅";
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

  // ---------- iflas ----------
  function showBankrupt() {
    return new Promise((res) => {
      const s = S(), b = s.bankrupt || {}, df = diffOf(s.diff), st = s.stats || {};
      const lines = D.STORY.bankrupt || ["Hasan Abi kepenkleri kapattı."];
      const reason = b.reason === "days" ? "Kesintisiz " + (D.BALANCE.debtMaxDays || 14) + " gün borçlu kaldın; Hasan Abi sabrını taşırdı." : "Borcun " + fmt(b.debt || s.debt) + " oldu ve limiti (" + fmt(Game.debtLimit()) + ") aştı.";
      $("bankrupt-text").innerHTML = esc(lines[0]) + "<br><b>" + esc(reason) + "</b><br>" + esc(lines[1] || "");
      const cell = (l, v) => '<div class="rcell"><div class="l">' + l + '</div><div class="v">' + v + "</div></div>";
      $("bankrupt-stats").innerHTML = cell("📅 Gün", b.day || s.day) + cell("⭐ Seviye", s.level) + cell("💰 Toplam kazanç", fmt(st.totalEarned || 0)) +
        cell("🧾 Ödenen kira", fmt(st.rentPaid || 0)) + cell("📉 Ödenen faiz", fmt(st.interestPaid || 0)) + cell("🕵️ Yakalanan hırsız", st.thievesCaught || 0);
      const canCheck = Game.hasCheckpoint && Game.hasCheckpoint();
      $("btn-bk-check").classList.toggle("hidden", !canCheck);
      $("btn-bk-new").textContent = "✨ Yeniden Başla" + (df ? " (" + df.name + ")" : "");
      const done = (v) => { closeOv("ov-bankrupt"); $("btn-bk-new").onclick = $("btn-bk-check").onclick = $("btn-bk-home").onclick = null; res(v); };
      $("btn-bk-new").onclick = () => done("new");
      $("btn-bk-check").onclick = () => done("check");
      $("btn-bk-home").onclick = () => done("home");
      openOv("ov-bankrupt");
    });
  }

  // ---------- final ----------
  function renderFinale() {
    const s = S(), st = s.stats || {};
    const lines = (D.STORY.finale || []).map((l, i) => '<p style="animation-delay:' + (0.3 + i * 0.35) + 's">' + esc(l) + "</p>").join("");
    const cell = (l, v) => '<div class="rcell"><div class="l">' + l + '</div><div class="v">' + v + "</div></div>";
    const df = diffOf(s.diff);
    $("finale").innerHTML = '<div class="finale-star">⭐</div><h1>Mahallenin Yıldızı!</h1>' + (df ? '<div class="fin-diff">' + df.emoji + " " + esc(df.name) + " zorlukta</div>" : "") +
      '<div class="finale-lines">' + lines + "</div>" +
      '<div class="rgrid">' + cell("📅 Gün", s.wonDay || s.day) + cell("💰 Toplam kazanç", fmt(st.totalEarned)) + cell("😊 Mutlu müşteri", st.customersServed || 0) +
      cell("😿 Eli boş dönen", st.customersMissed || 0) + cell("🛒 Satılan ürün", st.itemsSold || 0) + cell("🫧 Patlatılan baloncuk", st.bubblesPopped || 0) + cell("💨 Kaçan baloncuk", st.bubblesMissed || 0) +
      cell("🔥 En iyi kombo", "x" + (+st.bestCombo || 1).toFixed(1)) + cell("🎯 Tutan hedef", st.goalsDone || 0) + cell("🏘️ Mutlu komşu", st.regularsServed || 0) +
      cell("💝 Bahşiş", fmt(st.tips || 0)) + cell("📦 Stoğa harcanan", fmt(st.stockSpent || 0)) + cell("🥀 Bozulan ürün", st.spoiled || 0) +
      cell("🕵️ Yakalanan hırsız", st.thievesCaught || 0) + cell("🧾 Ödenen kira", fmt(st.rentPaid || 0)) + cell("📉 Faiz", fmt(st.interestPaid || 0)) + cell("⚠️ En yüksek borç", fmt(st.debtPeak || 0)) +
      cell("❓ Karar kartı", st.crisesResolved || 0) + cell("🔧 Bakım/tamir", fmt(st.repairSpent || 0)) + cell("🐷 Kumbara", st.piggyUsed || 0) + cell("📈 Alınan yükseltme", st.upgradesBought || 0) +
      cell("💪 Oynayarak ek kazanç", fmt(st.playBonus || 0)) + cell("🏅 En iyi gün", fmt(st.bestDayNet || 0)) + cell("▶ Oynanan / ⏩ geçilen", (st.daysPlayed || 0) + " / " + (st.daysSkipped || 0)) + "</div>" +
      '<p class="fine endless-note">Dükkân açık kalıyor ama büyük dükkânın kirası da büyük! Sonsuz modda 10 günlük <b>sezon hedefleri</b> var: tutturursan ödül, kaçırırsan rakip ve kira biraz daha büyür.</p>' +
      '<button class="btn big red" id="btn-endless">Dükkân açık kalsın ☀️</button>';
    $("btn-endless").onclick = () => handlers.endless && handlers.endless();
  }

  // ---------- init ----------
  function init(h) {
    handlers = h || {};
    $("stock-grid").addEventListener("click", (e) => {
      const t = e.target.closest("button"); if (!t || t.disabled) return;
      if (t.dataset.tier !== undefined) handlers.setPrice(t.dataset.pid, +t.dataset.tier);
      else if (t.dataset.buy) handlers.buy(t.dataset.buy, t.dataset.n);
      else if (t.dataset.unlock) handlers.unlock(t.dataset.unlock);
    });
    $("upg-grid").addEventListener("click", (e) => { const b = e.target.closest("button[data-upg]"); if (b && !b.disabled) handlers.upgrade(b.dataset.upg); });
    $("fin-strip").addEventListener("click", (e) => { const b = e.target.closest("[data-act]"); if (b && !b.disabled && b.dataset.act === "repay") handlers.repay(); });
    $("equip-panel").addEventListener("click", (e) => { const b = e.target.closest("[data-act]"); if (b && !b.disabled && b.dataset.act === "service") handlers.service(b.dataset.eq); });
    $("hint-box").addEventListener("click", (e) => { const b = e.target.closest("[data-act]"); if (b && b.dataset.act === "hint") handlers.hint(b.dataset.id); });
    $("crisis-card").addEventListener("click", (e) => { const b = e.target.closest("[data-crisis]"); if (b && !b.disabled) handlers.crisis(b.dataset.crisis); });
    $("btn-fill").onclick = () => handlers.fillAll();
    $("btn-open").onclick = () => handlers.open();
    $("btn-skip").onclick = () => handlers.skip();
    $("btn-next").onclick = () => handlers.next();
    $("btn-continue").onclick = () => handlers.cont();
    $("btn-new").onclick = () => handlers.newGame();
    $("btn-pause").onclick = () => handlers.pause();
    $("btn-resume").onclick = () => handlers.pause(false);
    document.querySelectorAll("[data-speed]").forEach((b) => (b.onclick = () => handlers.speed(+b.dataset.speed)));
    $("btn-settings").onclick = () => { sfx("click"); syncMute(); syncSettings(); openOv("ov-settings"); handlers.settingsOpen && handlers.settingsOpen(true); };
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
  // Ayarlar: zorluk bilgisi; gün içindeyse "Ana Menü" yerine "Günü bırak"
  function syncSettings() {
    const s = S(), df = diffOf(s.diff), inDay = $("app").dataset.screen === "day";
    $("settings-diff").textContent = (df ? "Zorluk: " + df.emoji + " " + df.name + " · " : "") + "Gün " + s.day;
    $("btn-home").textContent = inDay ? "🚪 Günü bırak (kalan süre başıboş geçer)" : "🏠 Ana Menü";
  }

  window.UI = {
    init, show, mountStage, updateTop, toast, confirm: confirmBox, notice, anyOverlay, closeOv, openOv,
    renderTitle, stopTitle, intro, pickDifficulty, showBankrupt,
    renderMorning, refreshMorning, flashCard,
    renderDayStart, updateHud, setSpeedButtons, setPaused, renderCrisis, hideCrisis, setAtmos,
    renderEvening, showLevelUp, renderFinale, fmt, renderForecast, forecast: null,
    _introNext: null, _lvClose: null
  };
})();
