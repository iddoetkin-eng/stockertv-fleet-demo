/* ──────────────────────────────────────────────────────────────────────────
   StockerTV Fleet View — World Map Live Operations (frontend)

   - Loads the curated fleet showcase (companies, 53 exchanges with lat/lng,
     hand-drawn continent paths, 40 feed entries, 10 newsroom headlines)
   - Renders the world map as inline SVG (equirectangular projection)
   - Places exchange dots at accurate lat/lng positions
   - On simulated script generation: radar-pulse from exchange dot → HTML
     company card lifts off → flies along a quadratic Bezier to the right
     rail feed → docks as a completed feed entry.
   - Reuses window.SoundFX and the single-pipeline drill-down pattern.
   ────────────────────────────────────────────────────────────────────────── */

(() => {
  "use strict";

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const SVGNS = "http://www.w3.org/2000/svg";
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // Easing tokens — kept in sync with CSS --ease-* variables
  const EASE_ENTER = "cubic-bezier(.22,.94,.3,1)";
  const EASE_EXIT  = "cubic-bezier(.4,0,1,1)";
  const EASE_PULSE = "cubic-bezier(.45,0,.55,1)";

  // ── Reduced motion ───────────────────────────────────────────────────
  // Single source of truth for prefers-reduced-motion. All procedural JS
  // animations (Web Animations API, timed loops, confetti) must route
  // through shouldAnimate() — CSS @media (prefers-reduced-motion) handles
  // declarative animations/transitions separately.
  const reducedMotionMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
  function shouldAnimate() { return !reducedMotionMQ.matches; }

  // ── Constants ─────────────────────────────────────────────────────────
  const MAP_VB_W = 360;
  const MAP_VB_H = 180;
  const MAX_IN_FLIGHT  = 6;
  const MIN_CHIME_MS   = 800;
  const FLIGHT_MS      = 2000;
  const SPAWN_MIN_MS   = 900;
  const SPAWN_MAX_MS   = 2400;

  // Fleet's sounds are more frequent than pipeline's — lower master volume
  if (window.SoundFX && window.SoundFX.setMasterVolume) {
    window.SoundFX.setMasterVolume(0.12);
  }

  // ── State ─────────────────────────────────────────────────────────────
  let showcase = null;
  let metrics = null;
  let reporterCounts = {};
  let exchangeIndex = {};   // code → exchange object
  let companyPool = [];     // shuffled company pool
  let inFlight = 0;
  let lastChimeAt = 0;
  let feedEntries = [];     // track docked cards for drill-down

  // ── Boot ──────────────────────────────────────────────────────────────
  async function boot() {
    // Set pre-reveal state synchronously so the first paint never flashes
    // a fully-visible page before the cinematic arrival sequence.
    document.body.classList.add("fleet-loading");

    // Standalone build: showcase data is bundled into showcase.js and
    // attached to window.FLEET_SHOWCASE. No network fetch — works on
    // file:// and GitHub Pages alike.
    showcase = window.FLEET_SHOWCASE;
    if (!showcase) {
      console.error("[fleet] window.FLEET_SHOWCASE missing — check showcase.js loaded before fleet.js");
      $("#health-bar").textContent = "Showcase unavailable — refresh the page.";
      return;
    }

    // Index exchanges by code for quick lookup
    exchangeIndex = {};
    for (const ex of showcase.exchanges) exchangeIndex[ex.code] = ex;

    initMetrics();
    initReporterCounts();
    renderGrid();
    renderContinents();
    renderDots();
    renderLabels();
    renderNewsroomTicker();
    renderReporterPanel();
    updateHealthBar();
    startClock();
    wireEvents();

    // 3.5-second welcome splash (title card) → then the cinematic reveal
    await runSplash();
    await runReveal();

    startSimulation();
    startDayNightRefresh();
    startHeartbeat();
    startRegionalRotation();
    startBellWatch();
    startKioskWatch();
  }

  // ── Projection: lat/lng → map viewBox coordinates ────────────────────
  function latLngToMap(lat, lng) {
    return { x: lng + 180, y: 90 - lat };
  }

  // SVG viewBox coord → CSS pixel coord, relative to map-wrap container
  function mapToScreen(mapX, mapY) {
    const svg = $("#map-svg");
    const pt = svg.createSVGPoint();
    pt.x = mapX; pt.y = mapY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const screen = pt.matrixTransform(ctm);
    const wrap = $("#map-wrap").getBoundingClientRect();
    return { x: screen.x - wrap.left, y: screen.y - wrap.top };
  }

  // ── Grid (lat / lng lines) ────────────────────────────────────────────
  function renderGrid() {
    const g = $("#map-grid");
    g.innerHTML = "";
    // Longitude lines every 30° from -150 to 150
    for (let lng = -150; lng <= 150; lng += 30) {
      const x = lng + 180;
      g.appendChild(svgEl("line", { x1: x, y1: 0, x2: x, y2: MAP_VB_H }));
    }
    // Latitude lines every 30° from -60 to 60
    for (let lat = -60; lat <= 60; lat += 30) {
      const y = 90 - lat;
      g.appendChild(svgEl("line", { x1: 0, y1: y, x2: MAP_VB_W, y2: y }));
    }
    // Equator slightly brighter
    const eq = svgEl("line", { x1: 0, y1: 90, x2: MAP_VB_W, y2: 90 });
    eq.setAttribute("stroke", "rgba(110,110,130,0.18)");
    eq.setAttribute("stroke-dasharray", "1 2");
    g.appendChild(eq);
  }

  // ── Continents (hand-drawn simplified) ────────────────────────────────
  function renderContinents() {
    const g = $("#map-continents");
    g.innerHTML = "";
    for (const d of showcase.continents) {
      g.appendChild(svgEl("path", { d }));
    }
  }

  // ── Exchange dots ─────────────────────────────────────────────────────
  function renderDots() {
    const g = $("#map-dots");
    g.innerHTML = "";
    for (const ex of showcase.exchanges) {
      const { x, y } = latLngToMap(ex.lat, ex.lng);
      const r = ex.tier === 0 ? 1.8 : (ex.tier === 1 ? 1.3 : 0.9);
      const tierClass = ex.tier === 0 ? " ex-dot--major" : (ex.tier === 1 ? " ex-dot--region" : "");

      // Group wraps halo + dot so CSS can target ex-dot-group:hover → ring-expand on halo.
      const group = svgEl("g", { class: "ex-dot-group", "data-code": ex.code });

      // Hover-triggered ring-expansion halo — always rendered, animates on hover.
      const hoverRing = svgEl("circle", {
        cx: x, cy: y, r: r * 3,
        class: "ex-hover-ring",
        "data-code": ex.code,
      });
      group.appendChild(hoverRing);

      // Ambient breathing halo (tier 0/1 only)
      if (ex.tier <= 1) {
        const halo = svgEl("circle", {
          cx: x, cy: y, r: r * 3,
          class: "ex-halo" + (ex.tier === 0 ? " ex-halo--breathing" : ""),
          "data-code": ex.code,
        });
        halo.style.animationDelay = (Math.random() * 2.4) + "s";
        group.appendChild(halo);
      }
      // Dot
      const dot = svgEl("circle", {
        cx: x, cy: y, r,
        class: "ex-dot" + tierClass,
        "data-code": ex.code,
        "data-region": ex.region,
      });
      dot.addEventListener("mouseenter", () => showTooltipForExchange(ex));
      dot.addEventListener("mouseleave", hideTooltip);
      dot.addEventListener("click", (e) => { e.stopPropagation(); openExchangeModal(ex); });
      dot.style.cursor = "pointer";
      group.appendChild(dot);
      g.appendChild(group);
    }
    // Initial day/night state
    refreshDayNight();
  }

  // Score → color class for feed entries (95+ gold, 85-94 green, 75-84 white, else amber)
  function scoreClass(score) {
    const n = Number(score);
    if (n >= 95) return "feed-score--gold";
    if (n >= 85) return "feed-score--green";
    if (n >= 75) return "feed-score--white";
    return "feed-score--amber";
  }

  // Always-visible labels for the 22 named exchanges
  function renderLabels() {
    const g = $("#map-labels");
    g.innerHTML = "";
    for (const ex of showcase.exchanges) {
      if (!ex.named) continue;
      const { x, y } = latLngToMap(ex.lat, ex.lng);
      const t = svgEl("text", { x, y: y + 3.2 }, ex.name || ex.code);
      g.appendChild(t);
    }
  }

  // ── Metrics ───────────────────────────────────────────────────────────
  function initMetrics() {
    metrics = { ...showcase.startingMetrics };
    setMetric("scripts",    metrics.scripts);
    setMetric("facts",      metrics.facts);
    setMetric("rewrites",   metrics.rewrites);
    setMetric("compliance", metrics.compliancePct.toFixed(1) + "%");
    setMetric("quality",    metrics.medianQuality.toFixed(1));
    setMetric("exchanges",  metrics.exchangesOnline);
  }
  function setMetric(k, v) {
    const el = document.querySelector(`.tb-metric[data-metric="${k}"] .tb-v`);
    if (!el) return;
    el.textContent = typeof v === "number" ? v.toLocaleString() : String(v);
  }
  function bumpMetric(k, v) {
    const el = document.querySelector(`.tb-metric[data-metric="${k}"] .tb-v`);
    if (!el) return;
    el.textContent = typeof v === "number" ? v.toLocaleString() : String(v);
    el.classList.remove("tb-v--bump");
    void el.offsetWidth;
    el.classList.add("tb-v--bump");
  }

  // ── Reporters ─────────────────────────────────────────────────────────
  function initReporterCounts() {
    reporterCounts = {};
    for (const r of showcase.reporters) {
      reporterCounts[r.key] = Math.round(metrics.scripts * r.weight);
    }
  }
  function renderReporterPanel() {
    const list = $("#reporters-list");
    if (!list) return;
    const rows = showcase.reporters
      .map((r) => ({ ...r, count: reporterCounts[r.key] || 0 }))
      .sort((a, b) => b.count - a.count);
    const max = Math.max(1, ...rows.map((r) => r.count));
    list.innerHTML = "";
    for (const r of rows) {
      const li = document.createElement("li");
      li.className = "reporter-row";
      li.dataset.k = r.key;
      const pct = Math.round((r.count / max) * 100);
      li.innerHTML = `
        <span class="rname">${escapeHtml(r.key)}</span>
        <span class="rbar"><span class="rbar-fill" style="width:${pct}%"></span></span>
        <span class="rcount">${r.count.toLocaleString()}</span>
      `;
      list.appendChild(li);
    }
  }

  // ── Newsroom ticker ───────────────────────────────────────────────────
  function renderNewsroomTicker() {
    const track = $("#news-ticker-track");
    track.innerHTML = "";
    const items = [...showcase.newsroomTicker, ...showcase.newsroomTicker];
    for (const item of items) {
      const span = document.createElement("span");
      span.className = "news-item";
      span.dataset.ticker = item.ticker;
      span.innerHTML = `
        <span class="news-item-ticker">${escapeHtml(item.ticker)}</span>
        <span class="news-item-text">${escapeHtml(item.headline)}</span>
        <span class="news-item-sep">·</span>
      `;
      track.appendChild(span);
    }
  }
  function glowNewsroomTicker(ticker, on) {
    $$('.news-item[data-ticker="' + ticker + '"]').forEach((el) => {
      el.classList.toggle("news-item--active", !!on);
    });
  }

  // ── Health bar ────────────────────────────────────────────────────────
  function updateHealthBar() {
    const el = $("#health-bar");
    if (!el) return;
    el.innerHTML =
      `<span class="hf-dot">●</span> System healthy · ${inFlight} pipelines in flight · ` +
      `${Math.max(0, Math.round(metrics.scripts / 26))} completed in last minute · ` +
      `exchanges ${metrics.exchangesOnline}/89 online`;
  }

  // ── Simulation: continuously launch scripts ──────────────────────────
  function startSimulation() {
    // Stagger the first few launches
    scheduleNextLaunch(400);
    setInterval(updateHealthBar, 5000);
  }
  function scheduleNextLaunch(delay) {
    const d = (typeof delay === "number")
      ? delay
      : SPAWN_MIN_MS + Math.random() * (SPAWN_MAX_MS - SPAWN_MIN_MS);
    setTimeout(tryLaunch, d);
  }
  function tryLaunch() {
    if (inFlight >= MAX_IN_FLIGHT) {
      scheduleNextLaunch(300); // backoff; try again soon
      return;
    }
    const company = nextCompany();
    const exchange = exchangeIndex[company.exchange];
    if (!exchange) { scheduleNextLaunch(); return; }
    const reporter = pickReporter();
    launchScript(exchange, company, reporter);
    scheduleNextLaunch();
  }
  function nextCompany() {
    if (companyPool.length === 0) companyPool = shuffle([...showcase.companies]);
    return companyPool.pop();
  }
  function pickReporter() {
    const r = Math.random();
    let acc = 0;
    for (const rp of showcase.reporters) {
      acc += rp.weight;
      if (r <= acc) return rp;
    }
    return showcase.reporters[0];
  }

  // ── Launch sequence: radar pulse → card lift → flight arc → dock ────
  async function launchScript(exchange, company, reporter) {
    inFlight++;
    updateHealthBar();
    const origin = latLngToMap(exchange.lat, exchange.lng);
    const destMap = chooseFeedAnchor(); // point on map-wrap where feed "receives"
    const destScreen = { x: destMap.sx, y: destMap.sy };

    // 1) Radar pulse at exchange dot
    radarPulse(origin.x, origin.y);
    // Sync newsroom ticker glow if named
    if (showcase.newsroomTicker.some((n) => n.ticker === company.ticker)) {
      glowNewsroomTicker(company.ticker, true);
      setTimeout(() => glowNewsroomTicker(company.ticker, false), 6000);
    }

    // 2) Card lift — spawn at exchange dot, scale up + fade in
    const originScreen = mapToScreen(origin.x, origin.y);
    const card = createFlightCard(company, reporter);
    card.style.transform = `translate(${originScreen.x}px, ${originScreen.y}px) scale(0.4)`;
    card.style.opacity = "0";
    $("#card-layer").appendChild(card);
    card.addEventListener("click", (e) => {
      e.stopPropagation();
      openDrill(company, reporter);
    });
    await card.animate(
      [
        { transform: `translate(${originScreen.x}px, ${originScreen.y}px) scale(0.4)`, opacity: 0 },
        { transform: `translate(${originScreen.x}px, ${originScreen.y}px) scale(1)`,   opacity: 1 },
      ],
      { duration: 280, fill: "forwards", easing: EASE_ENTER }
    ).finished.catch(() => {});

    // 3) Flight arc — draw SVG dashed path + animate card along bezier
    const destMapPt = { x: destMap.mapX, y: destMap.mapY };
    const arcPath = drawFlightArc(origin, destMapPt, exchange.region);
    await flyCard(card, originScreen, destScreen, origin, destMapPt);

    // 4) Dock — remove card, push entry into feed
    card.remove();
    fadeOutArc(arcPath);
    dockCard(company, reporter);

    inFlight = Math.max(0, inFlight - 1);
    updateHealthBar();
  }

  // Pick a point on the map-wrap right edge that serves as the feed "entry".
  // We return both map coords (for the arc's SVG) and screen coords (for the card).
  function chooseFeedAnchor() {
    const wrap = $("#map-wrap").getBoundingClientRect();
    const svg  = $("#map-svg").getBoundingClientRect();
    // Near the top of the right edge of the map (where feed begins)
    const sx = wrap.width - 20;
    const sy = 80;
    // Convert back to map viewBox coords for the arc path
    const svgPt = $("#map-svg").createSVGPoint();
    svgPt.x = sx + wrap.left;
    svgPt.y = sy + wrap.top;
    const ctm = $("#map-svg").getScreenCTM();
    const inv = ctm ? ctm.inverse() : null;
    const mapPt = inv ? svgPt.matrixTransform(inv) : { x: MAP_VB_W, y: 20 };
    return { sx, sy, mapX: mapPt.x, mapY: mapPt.y };
  }

  // ── Radar pulse — 3 concentric rings fading outward ──────────────────
  function radarPulse(cx, cy) {
    const layer = $("#map-pulses");
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const p = svgEl("circle", { cx, cy, r: 1.2, class: "pulse" });
        layer.appendChild(p);
        p.animate(
          [
            { r: 1.2, opacity: 0.7, strokeWidth: 0.35 },
            { r: 8,   opacity: 0,   strokeWidth: 0.15 },
          ],
          { duration: 900, easing: EASE_ENTER, fill: "forwards" }
        ).onfinish = () => p.remove();
      }, i * 160);
    }
    // Rate-limited tick
    const now = performance.now();
    if (window.SoundFX && (now - lastChimeAt) > 600) {
      window.SoundFX.playTick();
    }
  }

  // ── Flight arc (SVG path + animate card along quadratic Bezier) ──────
  // Cap the number of active trails so the map doesn't accumulate into
  // visual clutter after long viewing sessions.
  const MAX_ACTIVE_TRAILS = 20;
  const activeTrails = [];

  function drawFlightArc(fromMap, toMap, region) {
    const layer = $("#map-arcs");
    const apexX = (fromMap.x + toMap.x) / 2;
    const apexY = Math.min(fromMap.y, toMap.y) - 20; // apex 20 VBU above
    const d = `M ${fromMap.x},${fromMap.y} Q ${apexX},${apexY} ${toMap.x},${toMap.y}`;
    const gradId = (region && ["NA","EU","APAC","LATAM","MEA"].includes(region)) ? `arc-grad-${region}` : "arc-grad-NA";
    const path = svgEl("path", { d, class: "arc", stroke: `url(#${gradId})` });
    layer.appendChild(path);
    const len = path.getTotalLength();
    path.style.strokeDasharray = `${len}`;
    path.style.strokeDashoffset = `${len}`;
    path.classList.add("arc--drawn");
    path.animate(
      [{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
      { duration: FLIGHT_MS, easing: EASE_ENTER, fill: "forwards" }
    );

    // Cap the active trails — evict the oldest when we overflow
    activeTrails.push(path);
    while (activeTrails.length > MAX_ACTIVE_TRAILS) {
      const old = activeTrails.shift();
      try { old.remove(); } catch {}
    }
    return path;
  }
  function fadeOutArc(path) {
    if (!path) return;
    // Arcs linger 15s fading — creates an accumulated "activity heatmap"
    path.classList.add("arc--fading");
    setTimeout(() => {
      const i = activeTrails.indexOf(path);
      if (i >= 0) activeTrails.splice(i, 1);
      try { path.remove(); } catch {}
    }, 15000);
  }

  // Animate the HTML card along a quadratic Bezier in screen-pixel space.
  // The bezier apex mirrors the SVG arc's apex so the trajectories match.
  async function flyCard(card, fromScreen, toScreen, fromMap, toMap) {
    // Compute screen-space apex by converting the midpoint SVG apex back to screen
    const apexMap = { x: (fromMap.x + toMap.x) / 2, y: Math.min(fromMap.y, toMap.y) - 20 };
    const apexScreen = mapToScreen(apexMap.x, apexMap.y);
    const steps = 32;
    const kf = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const omt = 1 - t;
      const x = omt*omt*fromScreen.x + 2*omt*t*apexScreen.x + t*t*toScreen.x;
      const y = omt*omt*fromScreen.y + 2*omt*t*apexScreen.y + t*t*toScreen.y;
      const s = t < 0.1 ? 1.0 : (t > 0.85 ? 0.85 - (t - 0.85) * 2 : 1.0); // slight shrink near end
      kf.push({ transform: `translate(${x}px, ${y}px) scale(${s.toFixed(3)})`, opacity: 1, offset: t });
    }
    const anim = card.animate(kf, { duration: FLIGHT_MS, easing: EASE_ENTER, fill: "forwards" });
    await anim.finished.catch(() => {});
  }

  // ── Flight card (HTML element) ───────────────────────────────────────
  function createFlightCard(company, reporter) {
    const el = document.createElement("div");
    el.className = "flight-card";
    el.innerHTML = `
      <div class="flight-card-head">
        <span class="flight-card-ticker">${escapeHtml(company.ticker)}</span>
        <span class="flight-card-reporter" style="background:${reporter.color}">${escapeHtml(reporter.initials)}</span>
      </div>
      <div class="flight-card-progress">
        ${Array.from({ length: 15 }, () => '<span class="flight-card-progress-seg"></span>').join("")}
      </div>
    `;
    // Simulate progress filling during the flight
    const segs = $$(".flight-card-progress-seg", el);
    let i = 0;
    const fillInt = setInterval(() => {
      if (i < segs.length) { segs[i].classList.add("flight-card-progress-seg--done"); i++; }
      else clearInterval(fillInt);
    }, Math.floor(FLIGHT_MS / 15));
    return el;
  }

  // ── Dock card into feed ──────────────────────────────────────────────
  function dockCard(company, reporter) {
    let tpl = showcase.feed.find((f) => f.ticker === company.ticker);
    if (!tpl) {
      const pool = showcase.feed.filter((f) => f.reporter === reporter.key);
      tpl = pool[Math.floor(Math.random() * pool.length)] || showcase.feed[0];
    }
    const list = $("#feed-list");
    const li = document.createElement("li");
    li.dataset.ticker = company.ticker;
    // ~18% of completions get flagged as "rewritten" — highlights under AUDIT
    const wasRewritten = Math.random() < 0.18;
    if (wasRewritten) li.dataset.rewritten = "true";
    li.classList.add("feed-list-item--fresh");
    setTimeout(() => li.classList.remove("feed-list-item--fresh"), 1200);
    li.innerHTML = `
      <span class="feed-tick">✓</span>
      <span class="feed-reporter-dot" style="background:${reporter.color}">${escapeHtml(reporter.initials)}</span>
      <span class="feed-ticker">${escapeHtml(company.ticker)}</span>
      <span class="feed-exchange">${escapeHtml(company.exchange)}</span>
      <span class="feed-headline">${escapeHtml(tpl.headline)}</span>
      <span class="feed-score ${scoreClass(tpl.score)}">${tpl.score}</span>
    `;
    li.addEventListener("click", () => openDrill(company, reporter, tpl));
    list.insertBefore(li, list.firstChild);
    while (list.children.length > 12) list.removeChild(list.lastChild);

    feedEntries.unshift({ company, reporter, tpl, wasRewritten });
    if (feedEntries.length > 12) feedEntries.pop();

    // Celebration particles at the dock point
    dockSpark(li);

    // Metrics update
    metrics.scripts  += 1;
    metrics.facts    += 7 + Math.floor(Math.random() * 4);
    if (wasRewritten) metrics.rewrites += 1;
    bumpMetric("scripts",  metrics.scripts);
    bumpMetric("facts",    metrics.facts);
    if (wasRewritten) bumpMetric("rewrites", metrics.rewrites);
    reporterCounts[reporter.key] = (reporterCounts[reporter.key] || 0) + 1;
    renderReporterPanel();
    refreshAuditToast();

    // Chime (rate-limited)
    const now = performance.now();
    if (window.SoundFX && (now - lastChimeAt) > MIN_CHIME_MS) {
      window.SoundFX.playCheckmark();
      lastChimeAt = now;
    }
  }

  // Small celebration effect at the dock point (6 particles + green ring)
  function dockSpark(feedEntryEl) {
    if (!feedEntryEl) return;
    const rect = feedEntryEl.getBoundingClientRect();
    const x = rect.left + 16;
    const y = rect.top + rect.height / 2;
    for (let i = 0; i < 6; i++) {
      const p = document.createElement("div");
      p.className = "dock-spark";
      p.style.left = x + "px";
      p.style.top  = y + "px";
      document.body.appendChild(p);
      const angle = (Math.PI * 2) * (i / 6) + (Math.random() * 0.4);
      const dist  = 16 + Math.random() * 14;
      p.animate(
        [
          { transform: "translate(-50%, -50%)", opacity: 1 },
          { transform: `translate(calc(-50% + ${(Math.cos(angle) * dist).toFixed(1)}px), calc(-50% + ${(Math.sin(angle) * dist).toFixed(1)}px))`, opacity: 0 },
        ],
        { duration: 600, easing: EASE_ENTER }
      ).onfinish = () => p.remove();
    }
    const ring = document.createElement("div");
    ring.className = "dock-ring";
    ring.style.left = x + "px";
    ring.style.top  = y + "px";
    document.body.appendChild(ring);
    ring.animate(
      [
        { transform: "translate(-50%, -50%) scale(0.5)", opacity: 0.85 },
        { transform: "translate(-50%, -50%) scale(3)",   opacity: 0 },
      ],
      { duration: 500, easing: EASE_ENTER }
    ).onfinish = () => ring.remove();
  }

  // ── Tooltip on exchange dot ──────────────────────────────────────────
  function showTooltipForExchange(ex) {
    const tt = $("#map-tooltip");
    const { x, y } = latLngToMap(ex.lat, ex.lng);
    const screen = mapToScreen(x, y);
    const open = isExOpen(ex);
    const companyCount = showcase.companies.filter((c) => c.exchange === ex.code).length;
    tt.innerHTML = `
      <div class="tt-title">${escapeHtml(ex.name || ex.code)}</div>
      <div class="tt-sub">${escapeHtml(ex.city || "")}</div>
      <div class="tt-row">${open ? "🟢 Open" : "⚫ After hours"}</div>
      ${companyCount ? `<div class="tt-row">${companyCount} companies tracked</div>` : ""}
    `;
    tt.style.left = (screen.x + 12) + "px";
    tt.style.top  = (screen.y + 12) + "px";
    tt.hidden = false;
  }
  function hideTooltip() {
    const tt = $("#map-tooltip");
    if (tt) tt.hidden = true;
  }

  // ── Exchange info modal (click any dot → opens this) ────────────────
  function openExchangeModal(ex) {
    hideTooltip();
    const modal = $("#exchange-modal");
    const stage = $("#exchange-modal-stage");
    if (!modal || !stage) return;
    const open = isExOpen(ex);
    const companyCount = showcase.companies.filter((c) => c.exchange === ex.code).length;
    const tierLabel = ex.tier === 0
      ? "Major Exchange"
      : ex.tier === 1 ? "Regional Exchange" : "Minor Exchange";
    const locale = (ex.city || "") + (ex.country ? ", " + ex.country : "");
    stage.innerHTML = `
      <div class="em-eyebrow">${escapeHtml(ex.code || "")} · ${open ? "Open" : "After hours"}</div>
      <h2 class="em-title" id="exchange-modal-title">${escapeHtml(ex.name || ex.code || "")}</h2>
      <div class="em-sub">${escapeHtml(locale)}</div>
      <div class="em-meta">
        <div><div class="em-k">Tier</div><div class="em-v">${tierLabel}</div></div>
        <div><div class="em-k">Companies tracked</div><div class="em-v">${companyCount}</div></div>
      </div>
    `;
    modal.hidden = false;
    try { window.SoundFX && window.SoundFX.playClick && window.SoundFX.playClick(); } catch {}
  }
  function closeExchangeModal() {
    const modal = $("#exchange-modal");
    if (modal) modal.hidden = true;
  }

  // ── Drill-down modal (compressed ~25s replay with per-stage content) ─
  const DRILL_TOTAL_MS = 25000;
  let drillController = null;

  // Deterministic number from (ticker + salt) → consistent per-company values
  function seededNum(seed, min, max, decimals = 1) {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    const r = (h % 100000) / 100000;
    return (min + r * (max - min)).toFixed(decimals);
  }

  // Build everything the stage cards need — company meta + plausible numbers
  function getCompanyProfile(company, reporter) {
    const profileBase = showcase.companyProfile[company.ticker] || {};
    const sectorContent = showcase.sectorContent[company.sector] || showcase.sectorContent["Technology"];

    const ceo = profileBase.ceo || "Management undisclosed";
    const marketCap = profileBase.marketCap || ("$" + seededNum(company.ticker + "mc", 10, 250, 0) + "B");
    const descriptor = profileBase.descriptor || `${company.sector} operations`;

    // Pick a sector-fitting headline
    const headlineTpl = sectorContent.headlines[Math.floor(Math.random() * sectorContent.headlines.length)];
    const n1 = seededNum(company.ticker + "n1", 2, 60);
    const n2 = seededNum(company.ticker + "n2", 1, 40);
    const n3 = seededNum(company.ticker + "n3", 8, 95);
    const n4 = seededNum(company.ticker + "n4", 50, 400);
    const fill = (s) => s
      .replace(/\{name\}/g, company.name)
      .replace(/\{ticker\}/g, company.ticker)
      .replace(/\{reporter\}/g, reporter.key)
      .replace(/\{n1\}/g, n1).replace(/\{n2\}/g, n2)
      .replace(/\{n3\}/g, n3).replace(/\{n4\}/g, n4);

    const facts = sectorContent.facts.slice(0, 4).map(fill);
    const related = sectorContent.related.filter((r) => r !== company.name).slice(0, 3);

    // Find an exchange with a city
    const exchange = showcase.exchanges.find((e) => e.code === company.exchange);
    const exchangeCity = exchange ? (exchange.city || exchange.code) : company.exchange;

    // Trivial derived numbers for the other stages
    const wordCount = 580 + Math.floor(Math.random() * 120);
    const factTotal = 8;
    const relatedCount = 4 + Math.floor(Math.random() * 3);
    const scriptWords = 78 + Math.floor(Math.random() * 20);

    return {
      company, reporter, exchangeCity,
      ceo, marketCap, descriptor,
      headline:       fill(headlineTpl),
      novelty:        90 + Math.floor(Math.random() * 10),
      facts,
      factTotal,
      factsVerified: factTotal,
      related,
      relatedCount,
      scriptLine1:    fill(sectorContent.scriptLine1),
      scriptLine2:    fill(sectorContent.scriptLine2),
      scriptWords,
      chartLabel:     sectorContent.chartLabel,
      wordCount,
    };
  }

  // HTML for a single stage card's body, given the profile and stage number
  function stageBodyHtml(n, p) {
    switch (n) {
      case 1: return `
        <div class="ds-row"><span class="ds-k">Reuters</span> <span class="ds-sep">·</span> <span class="ds-v">47 min ago</span></div>
        <div class="ds-headline">${escapeHtml(p.headline)}</div>
        <div class="ds-row"><span class="ds-muted">${p.wordCount} words</span></div>`;
      case 2: return `
        <div class="ds-row"><span class="ds-k">Novelty</span> <span class="ds-v ds-v--accent">${p.novelty}%</span></div>
        <div class="ds-row"><span class="ds-muted">New angle detected</span></div>`;
      case 3: return `
        <div class="ds-row"><span class="ds-k">Sector</span> <span class="ds-v">${escapeHtml(p.company.sector)}</span></div>
        <div class="ds-row"><span class="ds-k">CEO</span> <span class="ds-v">${escapeHtml(p.ceo)}</span></div>
        <div class="ds-row"><span class="ds-k">Mkt Cap</span> <span class="ds-v ds-v--green">${escapeHtml(p.marketCap)}</span></div>`;
      case 4: return `
        <div class="ds-row"><span class="ds-k">${p.factTotal} facts</span> <span class="ds-muted">from ${p.wordCount} words</span></div>
        <ul class="ds-bullets">
          ${p.facts.slice(0, 3).map((f) => `<li>${escapeHtml(f)}</li>`).join("")}
        </ul>`;
      case 5: return `
        <div class="ds-row ds-row--big"><span class="ds-v ds-v--green">${p.factsVerified}/${p.factTotal}</span> <span class="ds-muted">verified</span></div>
        <div class="ds-row"><span class="ds-check">✓</span> <span class="ds-muted">Matches 10-K</span></div>`;
      case 6: return `
        <div class="ds-row"><span class="ds-v ds-v--accent">${p.relatedCount}</span> <span class="ds-muted">related</span></div>
        <div class="ds-row ds-row--wrap">${p.related.map((r) => `<span class="ds-chip">${escapeHtml(r)}</span>`).join(" ")}</div>`;
      case 7: return `
        <div class="ds-row ds-row--big"><span class="ds-reporter-dot" style="background:${p.reporter.color}">${escapeHtml(p.reporter.initials)}</span> <span class="ds-v">${escapeHtml(p.reporter.key)}</span></div>
        <div class="ds-row"><span class="ds-muted">${escapeHtml(p.reporter.specialty)}</span></div>`;
      case 8: return `
        <div class="ds-script">${escapeHtml(p.scriptLine1)}</div>
        <div class="ds-row"><span class="ds-muted">${p.scriptWords} words · Claude Sonnet 4.5</span></div>`;
      case 9: return `
        <div class="ds-row"><span class="ds-v">Bar chart</span></div>
        <div class="ds-row"><span class="ds-muted">${escapeHtml(p.chartLabel)}</span></div>`;
      case 10: return `
        <div class="ds-row"><span class="ds-v">3 options</span></div>
        <div class="ds-row"><span class="ds-check ds-check--accent">★</span> <span class="ds-muted">1 recommended</span></div>`;
      case 11: return `
        <div class="ds-row ds-row--red"><span class="ds-v ds-v--red">3 violations</span></div>
        <div class="ds-row"><span class="ds-arrow">→</span> <span class="ds-v ds-v--green">3 auto-fixed</span></div>`;
      case 12: return `
        <div class="ds-row ds-row--wrap">
          <span class="ds-gate">L1 ✓</span>
          <span class="ds-gate">L2 ✓</span>
          <span class="ds-gate">L3 ✓</span>
        </div>
        <div class="ds-row"><span class="ds-k">Q</span> <span class="ds-v ds-v--green">95</span> <span class="ds-k">C</span> <span class="ds-v ds-v--green">100</span></div>`;
      case 13: return `
        <div class="ds-row ds-row--wrap">
          <span class="ds-gate">EN ✓</span>
          <span class="ds-gate">PT ✓</span>
          <span class="ds-gate">ES ✓</span>
        </div>
        <div class="ds-row"><span class="ds-muted">Drift: 2.1%</span></div>`;
      case 14: return `
        <div class="ds-row"><span class="ds-v">15 steps</span> <span class="ds-muted">· 47s</span></div>
        <div class="ds-row"><span class="ds-check">✓</span> <span class="ds-muted">0 interventions</span></div>`;
      case 15: return `
        <div class="ds-row ds-row--big"><span class="ds-check ds-check--green">✓</span> <span class="ds-v ds-v--green">Approved</span></div>
        <div class="ds-row"><span class="ds-muted">Ready for avatar</span></div>`;
      default: return "";
    }
  }

  function openDrill(company, reporter, tpl) {
    const modal = $("#drill-modal");
    const profile = getCompanyProfile(company, reporter);

    $("[data-slot='ticker']",   modal).textContent = company.ticker;
    $("[data-slot='name']",     modal).textContent = `${company.name} · ${company.exchange}`;
    $("[data-slot='reporter']", modal).textContent = `${reporter.key} · ${reporter.specialty}`;

    const steps = $("#drill-steps");
    steps.innerHTML = "";
    showcase.stages.forEach((s) => {
      const step = document.createElement("div");
      step.className = "drill-step";
      step.dataset.n = String(s.n);
      step.innerHTML = `
        <div class="drill-step-head">
          <span class="drill-step-num">STAGE ${String(s.n).padStart(2, "0")}</span>
          <span class="drill-step-icon">○</span>
        </div>
        <div class="drill-step-name">${escapeHtml(s.full)}</div>
        <div class="drill-step-body">${stageBodyHtml(s.n, profile)}</div>
      `;
      steps.appendChild(step);
    });
    modal.hidden = false;
    if (window.SoundFX) window.SoundFX.playWhoosh();

    const perStage = Math.floor(DRILL_TOTAL_MS / showcase.stages.length);
    const stepEls = $$(".drill-step", steps);
    drillController = { cancelled: false };
    let i = 0;
    function advance() {
      if (drillController.cancelled) return;
      if (i > 0) {
        stepEls[i - 1].classList.remove("drill-step--active");
        stepEls[i - 1].classList.add("drill-step--done");
        $(".drill-step-icon", stepEls[i - 1]).textContent = "✓";
      }
      if (i >= stepEls.length) return;
      stepEls[i].classList.add("drill-step--active");
      if (i > 0 && window.SoundFX) window.SoundFX.playTick();
      i++;
      setTimeout(advance, perStage);
    }
    advance();
  }
  function closeDrill() {
    const modal = $("#drill-modal");
    if (modal.hidden) return;
    modal.hidden = true;
    if (drillController) drillController.cancelled = true;
  }

  // ── Clock (UTC) ──────────────────────────────────────────────────────
  // Also freezes the boot-time timestamp into the splash footnote — it reads
  // "14:32:07 UTC · 17 APR 2026" and anchors the cold open to a real moment.
  function startClock() {
    const clockEl = $("#meta-clock");
    const tick = () => {
      const d = new Date();
      const hh = String(d.getUTCHours()).padStart(2, "0");
      const mm = String(d.getUTCMinutes()).padStart(2, "0");
      const ss = String(d.getUTCSeconds()).padStart(2, "0");
      if (clockEl) clockEl.textContent = `${hh}:${mm}:${ss} UTC`;
    };
    tick();
    setInterval(tick, 1000);

    // One-shot splash timestamp (frozen at boot)
    const splashTs = $("#splash-timestamp");
    if (splashTs) {
      const d = new Date();
      const hh = String(d.getUTCHours()).padStart(2, "0");
      const mm = String(d.getUTCMinutes()).padStart(2, "0");
      const ss = String(d.getUTCSeconds()).padStart(2, "0");
      const dd = String(d.getUTCDate()).padStart(2, "0");
      const mon = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][d.getUTCMonth()];
      const yyyy = d.getUTCFullYear();
      splashTs.textContent = `${hh}:${mm}:${ss} UTC · ${dd} ${mon} ${yyyy}`;
    }
  }

  // ── Event wiring ─────────────────────────────────────────────────────
  function wireEvents() {
    // Drill modal close
    $("#drill-modal-close").addEventListener("click", closeDrill);
    $("#drill-modal").addEventListener("click", (e) => {
      if (!$("#drill-modal-stage").contains(e.target)) closeDrill();
    });

    // Exchange info modal close
    const emClose = $("#exchange-modal-close");
    if (emClose) emClose.addEventListener("click", closeExchangeModal);
    const em = $("#exchange-modal");
    if (em) em.addEventListener("click", (e) => {
      if (!$("#exchange-modal-stage").contains(e.target)) closeExchangeModal();
    });

    // Esc closes whichever modal is open (exchange-modal takes priority)
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!$("#exchange-modal").hidden) { closeExchangeModal(); return; }
      if (!$("#drill-modal").hidden) closeDrill();
    });

    // Sound toggle
    const soundToggle = $("#sound-toggle");
    soundToggle.dataset.state = window.SoundFX && window.SoundFX.isMuted() ? "off" : "on";
    soundToggle.addEventListener("click", () => {
      if (!window.SoundFX) return;
      window.SoundFX.init();
      const now = window.SoundFX.toggleMuted();
      soundToggle.dataset.state = now ? "off" : "on";
      if (!now) window.SoundFX.playClick();
    });

    // Theme toggle — light/dark, persisted to localStorage. Pre-paint script
    // in <head> has already applied the persisted theme; we just wire the
    // click to flip and update meta theme-color.
    const themeBtn = $("#theme-toggle");
    if (themeBtn) {
      const htmlEl = document.documentElement;
      const metaTheme = document.querySelector('meta[name="theme-color"]');
      const syncLabel = () => {
        const t = htmlEl.dataset.theme || "dark";
        themeBtn.setAttribute(
          "aria-label",
          t === "light" ? "Switch to dark mode" : "Switch to light mode"
        );
      };
      syncLabel();
      themeBtn.addEventListener("click", () => {
        const next = (htmlEl.dataset.theme === "light") ? "dark" : "light";
        htmlEl.dataset.theme = next;
        if (metaTheme) metaTheme.setAttribute("content", next === "light" ? "#FAF7F2" : "#0A0B0F");
        try { localStorage.setItem("stv-theme", next); } catch (e) {}
        syncLabel();
      });
    }

    // Audit toggle — dims map/rail/ticker; highlights in-flight cards
    // (red alarm pulse) and feed entries that were flagged as rewritten.
    const auditBtn = $("#audit-toggle");
    auditBtn.addEventListener("click", () => {
      const on = auditBtn.getAttribute("aria-pressed") !== "true";
      setAuditMode(on);
    });
    document.addEventListener("keydown", (e) => {
      if (e.target.closest("input, textarea")) return;
      if (e.key === "a" || e.key === "A") auditBtn.click();
      if (e.key === "b" || e.key === "B") forceBell();
      if (e.key === "?") toggleKbdHelp();
      else if (kbdHelpTimer) dismissKbdHelp(); // any other key dismisses help
    });

    // Reposition tooltip on resize (edge case: tooltip pinned on a dot)
    window.addEventListener("resize", hideTooltip);

    // Tooltip: click outside to dismiss
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".ex-dot")) hideTooltip();
    });

    // Kiosk idle reset — any click or keypress resets the 60s idle timer
    // and cancels any in-flight attract action. Mousemove is deliberately
    // NOT tracked (ambient cursor drift shouldn't count as engagement).
    document.addEventListener("click", noteInteraction);
    document.addEventListener("keydown", noteInteraction);
  }

  // ── Trading hours — derive from lng if no explicit hoursUTC ──────────
  // Approximate: local UTC offset ≈ lng/15, so 9am-5pm local = UTC [9 - offset, 17 - offset].
  function getHoursUTC(ex) {
    if (ex.hoursUTC) return ex.hoursUTC;
    const offset = ex.lng / 15;
    let open  = 9 - offset;
    let close = 17 - offset;
    // Keep hours in [0, 24+open] range — close can wrap past 24, isOpen handles it.
    if (open < 0)  { open += 24; close += 24; }
    return [open, close];
  }
  function isExOpen(ex, now = new Date()) {
    const hrs = getHoursUTC(ex);
    const h = now.getUTCHours() + now.getUTCMinutes() / 60;
    let [open, close] = hrs;
    if (close > 24) return (h >= open) || (h < close - 24);
    if (open  > 24) return (h >= open - 24) && (h < close - 24);
    return h >= open && h < close;
  }

  function refreshDayNight() {
    const now = new Date();
    for (const ex of showcase.exchanges) {
      const dot = document.querySelector(`.ex-dot[data-code="${CSS.escape(ex.code)}"]`);
      if (!dot) continue;
      dot.classList.toggle("ex-dot--closed", !isExOpen(ex, now));
    }
  }
  function startDayNightRefresh() {
    setInterval(refreshDayNight, 60000);
  }

  // ── 60s heartbeat — all dots pulse together + metric batch tick ──────
  let heartbeatTimer = null;
  function startHeartbeat() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    // Ambient, purely decorative motion — skip entirely under reduced motion
    if (!shouldAnimate()) return;
    heartbeatTimer = setInterval(runHeartbeat, 60000);
    setTimeout(runHeartbeat, 18000); // fire once early so viewers see it
  }
  function runHeartbeat() {
    // Emit a synchronized radar pulse at EVERY exchange dot — full-map breath
    for (const ex of showcase.exchanges) {
      const { x, y } = latLngToMap(ex.lat, ex.lng);
      const startR = ex.tier === 0 ? 1.5 : (ex.tier === 1 ? 1.2 : 0.9);
      const endR   = ex.tier === 0 ? 9   : (ex.tier === 1 ? 6.5 : 4);
      const p = svgEl("circle", { cx: x, cy: y, r: startR, class: "pulse pulse--heartbeat" });
      $("#map-pulses").appendChild(p);
      p.animate(
        [{ r: startR, opacity: 0.7, strokeWidth: 0.35 }, { r: endR, opacity: 0, strokeWidth: 0.12 }],
        { duration: 1400, easing: EASE_ENTER }
      ).onfinish = () => p.remove();
    }
    // Batch counter tick
    const dScripts  = 35 + Math.floor(Math.random() * 8);
    const dFacts    = dScripts * (7 + Math.floor(Math.random() * 2));
    const dRewrites = Math.floor(Math.random() * 3);
    metrics.scripts  += dScripts;
    metrics.facts    += dFacts;
    metrics.rewrites += dRewrites;
    bumpMetric("scripts",  metrics.scripts);
    bumpMetric("facts",    metrics.facts);
    if (dRewrites > 0) bumpMetric("rewrites", metrics.rewrites);
    for (const r of showcase.reporters) {
      reporterCounts[r.key] = (reporterCounts[r.key] || 0) + Math.round(dScripts * r.weight);
    }
    renderReporterPanel();
    updateHealthBar();
    if (window.SoundFX) window.SoundFX.playSuccess();
  }

  // ── Regional rotation spotlight — every 30s, 5s glow on a region ────
  const REGIONS = ["NA", "EU", "APAC", "LATAM", "MEA"];
  let regionRotationTimer = null;
  let regionIdx = -1;
  function startRegionalRotation() {
    if (regionRotationTimer) clearInterval(regionRotationTimer);
    regionRotationTimer = setInterval(rotateRegion, 30000);
    setTimeout(rotateRegion, 9000);
  }
  function rotateRegion() {
    // Don't repeat the same region twice in a row
    let next;
    do { next = REGIONS[Math.floor(Math.random() * REGIONS.length)]; }
    while (next === REGIONS[regionIdx] && REGIONS.length > 1);
    regionIdx = REGIONS.indexOf(next);
    const dotsLayer = $("#map-dots");
    // Clear any prior spotlight class
    REGIONS.forEach((r) => dotsLayer.classList.remove(`region-spotlight-${r}`));
    dotsLayer.classList.add(`region-spotlight-${next}`);
    setTimeout(() => dotsLayer.classList.remove(`region-spotlight-${next}`), 5000);
  }

  // ── The Bell — detect UTC trading-hours transitions ──────────────────
  // Monitors named exchanges every minute; when open ↔ close state flips,
  // fires a large radar pulse + 3-note chime at that exchange's dot.
  let bellState = {};
  let bellTimer = null;
  function startBellWatch() {
    // Seed current state (no chime on boot)
    const now = new Date();
    for (const ex of showcase.exchanges) {
      if (!ex.named) continue;
      bellState[ex.code] = isExOpen(ex, now);
    }
    bellTimer = setInterval(checkBell, 60000);
  }
  function checkBell() {
    const now = new Date();
    for (const ex of showcase.exchanges) {
      if (!ex.named) continue;
      const wasOpen = bellState[ex.code];
      const nowOpen = isExOpen(ex, now);
      if (wasOpen !== nowOpen) {
        ringBell(ex, nowOpen ? "opened" : "closed");
        bellState[ex.code] = nowOpen;
      }
    }
  }
  // The bell is the site's single time-aware beat — it fires every time a
  // real UTC trading session flips state. The upgrade turns a 1.4s audio cue
  // into a 2.5s narrative: map dims, Fraunces lockup resolves below topbar,
  // radar triples in reach, chime plays, then the map re-saturates.
  function ringBell(ex, verb) {
    const { x, y } = latLngToMap(ex.lat, ex.lng);
    const mapWrap = $("#map-wrap");
    const lockup = $("#bell-lockup");

    // Dim the map — everything else recedes
    if (mapWrap) mapWrap.classList.add("map-wrap--bell-dim");

    // Editorial lockup — NYSE [italic]opened[/italic] · 13:30 UTC · New York
    if (lockup) {
      const now = new Date();
      const hh = String(now.getUTCHours()).padStart(2, "0");
      const mm = String(now.getUTCMinutes()).padStart(2, "0");
      const city = ex.city || "";
      lockup.innerHTML = `
        <span class="bell-lockup-name">${escapeHtml(ex.name || ex.code)}</span>
        <span class="bell-lockup-verb">${escapeHtml(verb)}</span>
        <span class="bell-lockup-time">${hh}:${mm} UTC${city ? " · " + escapeHtml(city) : ""}</span>
      `;
      lockup.hidden = false;
      // Trigger reflow so the opacity transition fires
      void lockup.offsetWidth;
      lockup.classList.add("bell-lockup--shown");
    }

    // Bigger radar — 3× reach, longer duration, one more pulse in the stack
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        const p = svgEl("circle", { cx: x, cy: y, r: 1.5, class: "pulse pulse--bell" });
        $("#map-pulses").appendChild(p);
        p.animate(
          [{ r: 1.5, opacity: 0.95, strokeWidth: 0.55 }, { r: 54, opacity: 0, strokeWidth: 0.1 }],
          { duration: 2000, easing: EASE_ENTER }
        ).onfinish = () => p.remove();
      }, i * 180);
    }
    if (window.SoundFX) window.SoundFX.playBell();

    // Keep the existing health bar toast as the secondary readout
    const hb = $("#health-bar");
    if (hb) {
      const prev = hb.innerHTML;
      hb.innerHTML = `<span class="hf-dot">●</span> <strong>${escapeHtml(ex.name || ex.code)}</strong> ${verb} · ${escapeHtml(ex.city || "")}`;
      setTimeout(() => { if (hb.innerHTML.includes(ex.code)) hb.innerHTML = prev; }, 6000);
    }

    // Release the dim + dismiss lockup after ~2.5s total
    setTimeout(() => {
      if (mapWrap) mapWrap.classList.remove("map-wrap--bell-dim");
      if (lockup) {
        lockup.classList.remove("bell-lockup--shown");
        setTimeout(() => { lockup.hidden = true; }, 520);
      }
    }, 2500);
  }
  // Force-fire The Bell via B key (updates previous single-radar stub)
  function forceBell() {
    const named = showcase.exchanges.filter((e) => e.named);
    const ex = named[Math.floor(Math.random() * named.length)];
    if (ex) ringBell(ex, "bell test");
  }

  // ── Kiosk / attract mode ─────────────────────────────────────────────
  // After 60s of no click/keypress, start an auto-drill cycle. Every 45s a
  // random recent feed entry auto-opens its drill for 25s + 3s pause, then
  // closes and waits for the next cycle. Any user interaction cancels.
  let kioskTimer = null;
  let kioskState = null;
  let lastInteractionAt = performance.now();
  function startKioskWatch() {
    if (kioskTimer) clearInterval(kioskTimer);
    lastInteractionAt = performance.now();
    // Kiosk auto-drills modals unattended — disable under reduced motion,
    // since unexpected modal pop-ins are a classic accessibility offender.
    if (!shouldAnimate()) return;
    kioskTimer = setInterval(kioskTick, 3000);
  }
  function noteInteraction() {
    lastInteractionAt = performance.now();
    cancelAttract();
  }
  function cancelAttract() {
    if (!kioskState) return;
    if (kioskState.drillTimer)     clearTimeout(kioskState.drillTimer);
    if (kioskState.autoOpened && !$("#drill-modal").hidden) closeDrill();
    kioskState = null;
  }
  function kioskTick() {
    const idle = performance.now() - lastInteractionAt;
    if (idle > 60000 && !kioskState) startAttract();
  }
  function startAttract() {
    kioskState = { drillTimer: null, autoOpened: false };
    scheduleAttractDrill();
  }
  function scheduleAttractDrill() {
    if (!kioskState) return;
    if (feedEntries.length === 0 || !$("#drill-modal").hidden) {
      kioskState.drillTimer = setTimeout(scheduleAttractDrill, 10000);
      return;
    }
    const entry = feedEntries[Math.floor(Math.random() * Math.min(feedEntries.length, 6))];
    if (!entry) return;
    kioskState.autoOpened = true;
    openDrill(entry.company, entry.reporter, entry.tpl);
    setTimeout(() => {
      if (!kioskState) return;
      closeDrill();
      kioskState.autoOpened = false;
      kioskState.drillTimer = setTimeout(scheduleAttractDrill, 45000);
    }, 28000);
  }

  // ── AUDIT mode ────────────────────────────────────────────────────────
  function setAuditMode(on) {
    $("#audit-toggle").setAttribute("aria-pressed", String(!!on));
    document.body.classList.toggle("audit-mode", !!on);
    const toast = $("#audit-toast");
    if (on) {
      refreshAuditToast();
      toast.hidden = false;
    } else {
      toast.hidden = true;
    }
  }
  function refreshAuditToast() {
    const toast = $("#audit-toast");
    if (!toast || toast.hidden) return;
    const count = metrics.rewrites;
    toast.textContent = `● Audit mode · ${count} compliance rewrites today · ${countInFlightCompliance()} in rewrite now`;
  }
  function countInFlightCompliance() {
    // Rough estimate: any in-flight card counts as "in rewrite" briefly when
    // its mini progress bar crosses stages 11–12 (~70–80% of flight time).
    // For the toast we just report current in-flight count as an indicator.
    return inFlight;
  }

  // ── Keyboard help overlay (press ?) ──────────────────────────────────
  let kbdHelpTimer = null;
  function toggleKbdHelp() {
    const el = $("#kbd-help");
    if (!el) return;
    if (!el.hidden) { dismissKbdHelp(); return; }
    el.hidden = false;
    kbdHelpTimer = setTimeout(dismissKbdHelp, 8000);
  }
  function dismissKbdHelp() {
    const el = $("#kbd-help");
    if (!el) return;
    el.hidden = true;
    if (kbdHelpTimer) { clearTimeout(kbdHelpTimer); kbdHelpTimer = null; }
  }

  // ── Welcome splash — cinematic 7-second opening ──────────────────────
  // Timing:
  //   0.0s  black screen, nebula + dot grid visible
  //   1.0s  "WELCOME TO" fades in
  //   1.8s  "StockerTV Demo" letters begin landing (13 letters × 40ms stagger)
  //   2.7s  accent line expands from center
  //   3.0s  horizontal beam sweeps left → right
  //   3.5s  subtitle + pulsing green dot appears
  //   3.5s–6.0s  everything holds — viewer reads
  //   6.0s  map starts ghosting through (splash--reveal-map)
  //   6.5s  splash begins fading out (splash--exit)
  //   7.0s  splash removed, simulation begins
  async function runSplash() {
    const splash = $("#splash");
    if (!splash) return;
    // Under reduced motion, collapse the 7s cold open to a ~900ms fade.
    // All declarative animation/transition inside is already snapped to
    // ~0ms by the CSS media query, so the splash content is visible
    // briefly then exits.
    if (!shouldAnimate()) {
      await wait(600);
      splash.classList.add("splash--exit");
      await wait(300);
      splash.remove();
      return;
    }
    await wait(6000);
    splash.classList.add("splash--reveal-map");
    await wait(500);
    splash.classList.add("splash--exit");
    await wait(500);
    splash.remove();
  }

  // ── Cinematic page-load reveal sequence ──────────────────────────────
  async function runReveal() {
    // body.fleet-loading was set synchronously in boot() before rendering,
    // so nothing flashes visible. Each phase ADDS a class (not replaces),
    // then at the end we remove fleet-loading entirely.
    await wait(250); // small settle so the empty dark map paints first
    document.body.classList.add("fleet-cont-in");
    await wait(800);
    document.body.classList.add("fleet-dots-in");
    await wait(1000); // region stagger covers ~600ms + buffer
    document.body.classList.add("fleet-labels-in");
    await wait(700);
    document.body.classList.add("fleet-rail-in");
    await wait(600);
    // Remove the loading gate — all rules detach and page is fully live
    document.body.classList.remove(
      "fleet-loading", "fleet-cont-in", "fleet-dots-in", "fleet-labels-in", "fleet-rail-in"
    );
  }

  // ── SVG helpers ──────────────────────────────────────────────────────
  function svgEl(tag, attrs = {}, text) {
    const el = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    if (text != null) el.textContent = text;
    return el;
  }
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  boot();
})();
