/* ──────────────────────────────────────────────────────────────────────────
   StockerTV Pipeline Visualizer — frontend (TEMPLATE variant)
   - Copy of pipeline.js with three surgical edits for the configurable demo:
       (1) Thumbnail brand mark reads window.__STV_THUMBNAIL_BRAND
       (2) AVATAR_VIDEO_URL reads window.__STV_AVATAR_VIDEO_URL
       (3) renderMultiLanguage iterates data.languages[] instead of fixed en/pt/es
   - All globals are set by js/client-loader.js before this script is injected.
   - Drives the 15-stage timeline as events arrive (curated replay or live SSE)
   - Each stage's render function returns a Promise that resolves when its
     animation completes; the runner awaits each before activating the next.
   ────────────────────────────────────────────────────────────────────────── */

(() => {
  "use strict";

  // ── DOM helpers ─────────────────────────────────────────────────────────
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // Easing tokens — kept in sync with CSS --ease-* variables
  const EASE_ENTER = "cubic-bezier(.22,.94,.3,1)";
  const EASE_EXIT  = "cubic-bezier(.4,0,1,1)";
  const EASE_PULSE = "cubic-bezier(.45,0,.55,1)";

  // ── Reduced motion — matches the CSS media query ────────────────────
  // Used to gate confetti, spring overshoot, and the internal wait() so the
  // demo still runs end-to-end under reduced motion but with snapped pacing.
  const reducedMotionMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
  function shouldAnimate() { return !reducedMotionMQ.matches; }

  // ── SoundFX — shared module, loaded via ./soundfx.js ───────────────────
  // Exposes window.SoundFX. Shared with the Fleet View. We explicitly set
  // the master volume here in case another page has changed it previously.
  const SoundFX = window.SoundFX;
  if (SoundFX && SoundFX.setMasterVolume) SoundFX.setMasterVolume(0.3);

  function stageEl(stageNum) {
    return $(`.stage[data-stage="${stageNum}"]`);
  }
  function setSlot(root, name, value) {
    $$(`[data-slot="${name}"]`, root).forEach((el) => { el.textContent = value; });
  }
  function setStatus(stage, label) {
    const el = $(".stage-status", stage);
    if (el) el.textContent = label;
  }

  function activateStage(stage) {
    stage.classList.remove("stage--complete");
    stage.classList.add("stage--active");
    setStatus(stage, "running");
    const num   = parseInt(stage.dataset.stage, 10);
    const name  = stage.querySelector(".stage-title")?.textContent || "";
    updateStageTracker({ state: "running", num, name });
    // Screen-reader announcement — the only way a non-sighted reviewer
    // experiences stage progression. Polite + atomic so the whole phrase
    // reads as one announcement.
    const announcer = $("#stage-announcer");
    if (announcer) announcer.textContent = `Stage ${num} of 15: ${name}`;
    SoundFX.playTick();
    stage.scrollIntoView({
      behavior: shouldAnimate() ? "smooth" : "auto",
      block: "start"
    });
  }
  function completeStage(stage) {
    stage.classList.remove("stage--active");
    stage.classList.add("stage--complete");
    setStatus(stage, "done");
  }

  // ── Animation primitives ────────────────────────────────────────────────
  async function typeText(el, text, perCharMs = 4) {
    el.textContent = "";
    for (let i = 0; i < text.length; i++) {
      el.textContent += text[i];
      if (i % 4 === 0) await wait(perCharMs * 4);
    }
  }

  async function streamWords(el, text, perWordMs = 60) {
    el.innerHTML = "";
    const cursor = document.createElement("span");
    cursor.className = "typing-cursor";
    el.appendChild(cursor);
    const words = String(text).split(/(\s+)/);
    let i = 0;
    for (const w of words) {
      const node = document.createTextNode(w);
      el.insertBefore(node, cursor);
      i++;
      if (/\S/.test(w)) await wait(perWordMs);
    }
    cursor.remove();
  }

  async function countUp(el, target, durationMs = 800) {
    const start = performance.now();
    const from = 0;
    return new Promise((resolve) => {
      function step(t) {
        const p = Math.min(1, (t - start) / durationMs);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = String(Math.round(from + (target - from) * eased));
        if (p < 1) requestAnimationFrame(step);
        else resolve();
      }
      requestAnimationFrame(step);
    });
  }

  // Spring-physics count-up for the stage-12 hero reveal. Cubic ease-out for
  // the main reach plus a small sinusoidal overshoot in the final 18%, giving
  // the numerals a "land-settle" feel rather than a flat asymptote. Under
  // reduced motion, snap directly to the target value.
  async function countUpSpring(el, target, durationMs = 1200) {
    if (!shouldAnimate()) {
      el.textContent = String(Math.round(target));
      return;
    }
    const start = performance.now();
    const from = 0;
    return new Promise((resolve) => {
      function step(t) {
        const p = Math.min(1, (t - start) / durationMs);
        const base = 1 - Math.pow(1 - p, 3);
        const overshoot = p > 0.82 ? Math.sin((p - 0.82) * Math.PI / 0.18) * 0.018 : 0;
        const eased = Math.min(1, base + overshoot);
        el.textContent = String(Math.round(from + (target - from) * eased));
        if (p < 1) requestAnimationFrame(step);
        else { el.textContent = String(Math.round(target)); resolve(); }
      }
      requestAnimationFrame(step);
    });
  }

  async function flashPopulate(el) {
    el.classList.remove("populate-pop");
    void el.offsetWidth;
    el.classList.add("populate-pop");
  }

  // ── Reporter avatars ────────────────────────────────────────────────────
  const REPORTERS = [
    { key: "Gerardo", spec: "Financial",  initials: "G" },
    { key: "Liam",    spec: "Operations", initials: "L" },
    { key: "Annie",   spec: "Products",   initials: "A" },
    { key: "Sophia",  spec: "Legal",      initials: "S" },
    { key: "Maya",    spec: "Press",      initials: "M" },
  ];

  // ── Stage 1: ARTICLE INPUT ──────────────────────────────────────────────
  async function renderArticleInput(stage, data) {
    setSlot(stage, "source",      data.source || "—");
    setSlot(stage, "publishedAt", data.publishedAt || "—");
    setSlot(stage, "wordCount",   String(data.wordCount || 0));
    const titleEl = $("[data-slot='title']", stage);
    const bodyEl  = $("[data-slot='fullText']", stage);

    titleEl.textContent = data.title || "";
    // Render body as paragraphs split on blank lines
    bodyEl.innerHTML = "";
    const paras = String(data.fullText || "").split(/\n\n+/);
    for (const p of paras) {
      const pEl = document.createElement("p");
      pEl.textContent = p.trim();
      bodyEl.appendChild(pEl);
    }
    // Quick "type-in" reveal: fade the text in by progressively setting opacity
    bodyEl.style.opacity = "0";
    requestAnimationFrame(() => {
      bodyEl.style.transition = `opacity 700ms ${EASE_ENTER}`;
      bodyEl.style.opacity = "1";
    });
    await wait(900);
  }

  // ── Stage 2: WATCHER DETECTION ──────────────────────────────────────────
  async function renderWatcherDetection(stage, data) {
    setSlot(stage, "source",      data.source || "—");
    setSlot(stage, "publishedAt", data.publishedAt || "—");
    setSlot(stage, "ticker",      data.ticker || "—");
    setSlot(stage, "exchange",    data.exchange || "—");
    setSlot(stage, "noveltyReason", data.noveltyReason || "");

    await wait(900); // let the radar sweep play
    const score = Number(data.noveltyScore) || 0;
    $("[data-slot='noveltyBar']", stage).style.width = score + "%";
    await countUp($("[data-slot='noveltyScore']", stage), score, 800);
    await wait(300);
  }

  // ── Stage 3: COMPANY ENRICHMENT ─────────────────────────────────────────
  async function renderCompanyEnrichment(stage, data) {
    const fields = [
      "name", "ticker", "sector", "industry", "ceo", "headquarters",
      "foundedYear", "marketCap", "lastPrice", "week52High", "week52Low",
      "keyProducts", "competitors", "description"
    ];
    for (const f of fields) {
      const els = $$(`[data-slot="${f}"]`, stage);
      const v = data[f] != null ? String(data[f]) : "—";
      for (const el of els) {
        el.textContent = v;
        const cellRoot = el.closest(".company-cell, .company-block, .company-head");
        if (cellRoot) flashPopulate(cellRoot);
      }
      await wait(180);
    }
    if (data.dbSize)      setSlot(stage, "dbSize",      data.dbSize);
    if (data.dbExchanges) setSlot(stage, "dbExchanges", data.dbExchanges);
    await wait(400);
  }

  // ── Stage 4: FACT EXTRACTION ────────────────────────────────────────────
  async function renderFactExtraction(stage, data) {
    const facts  = Array.isArray(data.facts) ? data.facts : [];
    const source = data.fullText || $("[data-slot='fullText']", stageEl(1))?.textContent || "";
    const bodyEl = $("#fact-source-body");

    // Build the article body with fact spans highlighted
    const spans = facts
      .map((f) => f.sourceSpan)
      .filter((s) => Array.isArray(s) && s.length === 2)
      .sort((a, b) => a[0] - b[0]);

    bodyEl.innerHTML = "";
    let cursor = 0;
    spans.forEach(([start, end], idx) => {
      if (start > cursor) {
        const before = document.createElement("span");
        before.className = "fact-fade";
        before.textContent = source.slice(cursor, start);
        bodyEl.appendChild(before);
      }
      const hl = document.createElement("span");
      hl.className = "fact-highlight";
      hl.textContent = source.slice(start, end);
      hl.dataset.factIdx = String(idx);
      bodyEl.appendChild(hl);
      cursor = end;
    });
    if (cursor < source.length) {
      const tail = document.createElement("span");
      tail.className = "fact-fade";
      tail.textContent = source.slice(cursor);
      bodyEl.appendChild(tail);
    }

    $("#fact-total").textContent = String(facts.length);
    $("#fact-count").textContent = "0";
    const list = $("#fact-list");
    list.innerHTML = "";

    for (let i = 0; i < facts.length; i++) {
      const li = document.createElement("li");
      li.style.animationDelay = "0ms";
      li.textContent = facts[i].text;
      list.appendChild(li);
      $("#fact-count").textContent = String(i + 1);
      await wait(280);
    }
    await wait(400);
  }

  // ── Stage 5: SEC EDGAR VALIDATION ───────────────────────────────────────
  async function renderSecValidation(stage, data) {
    const list = $("#validation-list");
    list.innerHTML = "";
    const v = Array.isArray(data.validations) ? data.validations : [];
    let okCount = 0;
    for (const item of v) {
      const li = document.createElement("li");
      const ok = item.status === "verified";
      if (ok) okCount++;
      li.innerHTML = `
        <div class="validation-icon ${ok ? "ok" : "fail"}">${ok ? "✓" : "✕"}</div>
        <div class="validation-fact">${escapeHtml(item.fact)}</div>
        <div class="validation-source">${escapeHtml(item.source || "")}</div>
      `;
      list.appendChild(li);
      // Scroll-follow: keep the latest checkmark in view as items append
      li.scrollIntoView({ behavior: "smooth", block: "nearest" });
      if (ok) SoundFX.playCheckmark(); else SoundFX.playError();
      await wait(600);
    }
    $("#validation-summary-text").textContent = `${okCount}/${v.length} facts verified against SEC filings`;
    $("#validation-summary-text").scrollIntoView({ behavior: "smooth", block: "nearest" });
    await wait(500);
  }

  // ── Stage 6: CROSS-REFERENCE (SVG knowledge graph) ──────────────────────
  const EDGE_REL_CLASS = {
    supplier:   "edge--supplier",
    competitor: "edge--competitor",
    customer:   "edge--partner",
    partner:    "edge--partner",
  };

  async function renderCrossReference(stage, data) {
    const svg = $("#xref-graph");
    svg.innerHTML = "";
    const nodes = Array.isArray(data.nodes) ? data.nodes : [];
    const cx = 360, cy = 180, radius = 130;

    // Halo ring (renders first so it's behind the center node)
    svg.appendChild(svgEl("circle", { cx, cy, r: 38, class: "graph-halo" }));

    // Center node
    const centerG = svgEl("g");
    centerG.appendChild(svgEl("circle", { cx, cy, r: 38, class: "node-circle node-circle--center" }));
    centerG.appendChild(svgEl("text", { x: cx, y: cy + 4, class: "node-label" }, data.center || "—"));
    svg.appendChild(centerG);

    // Layout outer nodes around a circle
    const positions = nodes.map((_, i) => {
      const angle = (-Math.PI / 2) + (i * 2 * Math.PI) / nodes.length;
      return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle), angle };
    });

    // Draw edges first (so they render under nodes). Each edge gets a
    // relation-based color class.
    nodes.forEach((n, i) => {
      const p = positions[i];
      const rel = String(n.relation || "").toLowerCase();
      const relClass = EDGE_REL_CLASS[rel] || "edge--supplier";
      const edge = svgEl("line", {
        x1: cx, y1: cy, x2: p.x, y2: p.y,
        class: `edge ${relClass}`,
        "data-edge-i": i,
      });
      svg.appendChild(edge);
      const mx = (cx + p.x) / 2, my = (cy + p.y) / 2;
      const lbl = svgEl("text", { x: mx, y: my - 4, class: "edge-label", "data-edge-lbl-i": i }, n.relation || "");
      lbl.style.opacity = "0";
      svg.appendChild(lbl);
    });

    // Draw outer node circles
    nodes.forEach((n, i) => {
      const p = positions[i];
      const g = svgEl("g", { "data-node-i": i });
      g.style.opacity = "0";
      g.appendChild(svgEl("circle", { cx: p.x, cy: p.y, r: 30, class: "node-circle" }));
      g.appendChild(svgEl("text", { x: p.x, y: p.y - 2, class: "node-label" }, n.name || ""));
      if (n.ticker) g.appendChild(svgEl("text", { x: p.x, y: p.y + 12, class: "node-ticker" }, n.ticker));
      svg.appendChild(g);
    });

    // Animate: fade in nodes, draw edges from center → outward,
    // then switch each drawn edge to a flowing dash pattern.
    for (let i = 0; i < nodes.length; i++) {
      const g = svg.querySelector(`g[data-node-i="${i}"]`);
      g.style.transition = `opacity 360ms ${EASE_ENTER}`;
      g.style.opacity = "1";
      g.querySelector("circle").classList.add("node-circle--lit");
      const edge = svg.querySelector(`line[data-edge-i="${i}"]`);
      edge.classList.add("edge--lit");
      setTimeout(() => edge.classList.add("edge--flowing"), 650);
      const lbl = svg.querySelector(`text[data-edge-lbl-i="${i}"]`);
      lbl.style.transition = `opacity 400ms ${EASE_ENTER}`;
      lbl.style.opacity = "1";
      await wait(260);
    }
    $("#xref-note").textContent = data.note || `${nodes.length} related companies identified.`;
    await wait(400);
  }

  function svgEl(tag, attrs = {}, text) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    if (text != null) el.textContent = text;
    return el;
  }

  // ── Stage 7: REPORTER SELECTION ─────────────────────────────────────────
  async function renderReporterSelection(stage, data) {
    const row = $("#reporter-row");
    row.innerHTML = "";
    REPORTERS.forEach((r) => {
      const card = document.createElement("div");
      card.className = "reporter";
      card.dataset.key = r.key;
      card.innerHTML = `
        <div class="reporter-avatar">${r.initials}</div>
        <div class="reporter-name">${r.key}</div>
        <div class="reporter-spec">${r.spec}</div>
      `;
      row.appendChild(card);
    });
    await wait(400);
    const sel = data.selected;
    const reasonEl = $("#reporter-reason");
    reasonEl.textContent = "";

    // Scanning pass — cycle a highlight ring through all 5 cards twice
    const cards = $$(".reporter", row);
    for (let pass = 0; pass < 2; pass++) {
      for (const c of cards) {
        c.classList.add("reporter--scanning");
        await wait(200);
        c.classList.remove("reporter--scanning");
      }
    }

    // Settle on the selected reporter; dim the rest.
    cards.forEach((c) => {
      if (c.dataset.key === sel) c.classList.add("reporter--selected");
      else c.classList.add("reporter--dim");
    });
    await wait(400);
    reasonEl.textContent = data.reasoning || `${sel} selected.`;
    await wait(400);
  }

  // ── Stage 8: SCRIPT GENERATION (streaming) ──────────────────────────────
  async function renderScriptGeneration(stage, data) {
    setSlot(stage, "model", data.model || "Claude Sonnet 4.5");
    const lines = Array.isArray(data.script) ? data.script : [String(data.script || "")];
    const wholeText = lines.join(" ");
    const target = data.wordCount || wholeText.split(/\s+/).filter(Boolean).length;
    $("#script-target").textContent = String(target);
    const box = $("#script-box");

    box.innerHTML = "";
    const cursor = document.createElement("span");
    cursor.className = "typing-cursor";
    box.appendChild(cursor);

    const words = wholeText.split(/(\s+)/);
    let n = 0;
    let sinceBurst  = 0;
    let nextBurstAt = 8 + Math.floor(Math.random() * 3); // every 8–10 words
    let burstLeft   = 0;
    for (const w of words) {
      const node = document.createTextNode(w);
      box.insertBefore(node, cursor);
      if (/\S/.test(w)) {
        n++;
        $("#script-words").textContent = String(n);
        const isBurst = burstLeft > 0;
        await wait(isBurst ? 15 : 40);
        if (isBurst) {
          burstLeft--;
        } else {
          sinceBurst++;
          if (sinceBurst >= nextBurstAt) {
            burstLeft   = 3;
            sinceBurst  = 0;
            nextBurstAt = 8 + Math.floor(Math.random() * 3);
          }
        }
      }
    }
    cursor.remove();
    await wait(300);
  }

  // ── Stage 9: CHART SUGGESTION ───────────────────────────────────────────
  async function renderChartSuggestion(stage, data) {
    setSlot(stage, "type", data.type || "—");
    const series = Array.isArray(data.series) ? data.series : [];
    const chart = $("#chart");
    chart.innerHTML = "";
    const max = Math.max(...series.map((s) => Number(s.v) || 0), 1);

    series.forEach((s, i) => {
      const bar = document.createElement("div");
      bar.className = "chart-bar";
      const val = document.createElement("div");
      val.className = "chart-bar-value";
      val.textContent = `$${s.v}B`;
      const lbl = document.createElement("div");
      lbl.className = "chart-bar-label";
      lbl.textContent = s.q;
      bar.appendChild(val);
      bar.appendChild(lbl);
      // QoQ delta badge on the final bar
      if (i === series.length - 1 && i > 0) {
        const prev = Number(series[i - 1].v) || 0;
        if (prev > 0) {
          const pct = Math.round(((Number(s.v) - prev) / prev) * 100);
          const delta = document.createElement("div");
          delta.className = "chart-bar-delta";
          delta.textContent = (pct >= 0 ? `+${pct}%` : `${pct}%`) + " QoQ";
          bar.appendChild(delta);
        }
      }
      chart.appendChild(bar);
    });
    await wait(120);
    $$(".chart-bar", chart).forEach((bar, i) => {
      const v = Number(series[i].v) || 0;
      const h = Math.round((v / max) * 160);
      setTimeout(() => { bar.style.height = h + "px"; }, i * 100);
    });
    $("#chart-data").textContent = series.map((s) => `${s.q}: $${s.v}B`).join(" → ");
    await wait(1100);
  }

  // ── Stage 10: THUMBNAIL GENERATION ──────────────────────────────────────
  const PLAY_SVG =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<polygon points="7,5 19,12 7,19" fill="#111"/>' +
    '</svg>';

  async function renderThumbnailGeneration(stage, data) {
    const wrap = $("#thumbs");
    wrap.innerHTML = "";
    const opts = Array.isArray(data.options) ? data.options : [];
    opts.forEach((opt, i) => {
      const variant = `thumb--variant-${(i % 3) + 1}`;
      const t = document.createElement("div");
      t.className = `thumb ${variant}` + (opt.recommended ? " thumb--rec" : "");
      t.innerHTML = `
        <div class="thumb-mark"><span class="thumb-mark-dot"></span>${escapeHtml(window.__STV_THUMBNAIL_BRAND || "NVIDIA")}</div>
        ${opt.recommended ? '<div class="thumb-rec-badge">Recommended</div>' : ""}
        <div class="thumb-play">${PLAY_SVG}</div>
        <div class="thumb-caption">
          <div class="thumb-title">${escapeHtml(opt.headline || "")}</div>
          <div class="thumb-meta">
            ${opt.number ? `<span class="thumb-meta-pill">${escapeHtml(opt.number)}</span>` : ""}
            <span>${escapeHtml(opt.foot || "")}</span>
          </div>
        </div>
        <div class="thumb-duration">0:47</div>
      `;
      wrap.appendChild(t);
    });
    await wait(900);
  }

  // ── Stage 11: COMPLIANCE RED PASS (the dramatic moment) ─────────────────
  async function renderComplianceRedPass(stage, data) {
    const draftScript    = data.draftScript || "";
    const violations     = Array.isArray(data.violations) ? data.violations : [];
    const rewrites       = Array.isArray(data.rewrites)   ? data.rewrites   : [];
    const rewrittenScript = data.rewrittenScript || draftScript;

    const scriptBox = $("#redpass-script");
    scriptBox.innerHTML = "";

    // Build the draft with <span class="violation"> wrappers for each violation phrase.
    // We assume violation spans are non-overlapping and given in text order.
    const sortedV = [...violations]
      .map((v, i) => ({ ...v, i }))
      .sort((a, b) => (a.spanStart || 0) - (b.spanStart || 0));

    let cursor = 0;
    for (const v of sortedV) {
      const start = v.spanStart, end = v.spanEnd;
      if (start == null || end == null) continue;
      if (start > cursor) {
        scriptBox.appendChild(document.createTextNode(draftScript.slice(cursor, start)));
      }
      const span = document.createElement("span");
      span.className = "violation";
      span.dataset.idx = String(v.i);
      span.textContent = draftScript.slice(start, end);
      scriptBox.appendChild(span);
      cursor = end;
    }
    if (cursor < draftScript.length) {
      scriptBox.appendChild(document.createTextNode(draftScript.slice(cursor)));
    }

    // Show violation list
    const list = $("#violations");
    list.innerHTML = "";
    $("#violation-count").textContent = String(violations.length);

    // Dim the rest of the script — only the red phrases should glow.
    scriptBox.classList.add("redpass-script--dimmed");

    // Light up violations one at a time
    await wait(700);
    const litSpans = [];
    for (const v of sortedV) {
      const span = scriptBox.querySelector(`.violation[data-idx="${v.i}"]`);
      if (span) {
        span.classList.add("violation--lit");
        litSpans.push(span);
      }
      const li = document.createElement("li");
      li.innerHTML = `
        <span class="violation-rule">${escapeHtml(v.ruleId || "")}</span>
        <span class="violation-name">${escapeHtml(v.ruleName || "")}</span>
        <span class="violation-phrase">"${escapeHtml(v.phrase || "")}"</span>
      `;
      list.appendChild(li);
      SoundFX.playError();
      await wait(1000);
    }

    // Dramatic pause — let the audience absorb the red glow.
    // An extra second with all violations lit and the rest dimmed.
    await wait(1500 + 1000);

    // Restore the rest of the script gradually before rewriting.
    scriptBox.classList.remove("redpass-script--dimmed");
    await wait(300);

    // Now the rewrite: dissolve violations and morph into the rewritten script
    litSpans.forEach((s) => s.classList.add("violation--dissolving"));
    await wait(450);

    // Replace the entire script content with the rewritten version, with the
    // changed phrases highlighted as ".replacement" so they fade in green.
    scriptBox.innerHTML = "";
    let txt = rewrittenScript;
    // Build a regex that matches any of the replacement targets, in order of
    // longest-first so that overlapping shorter strings don't break matching.
    const targets = rewrites
      .map((r) => r.to)
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);
    if (targets.length === 0) {
      scriptBox.textContent = txt;
    } else {
      const escaped = targets.map(escapeRegex);
      const re = new RegExp(`(${escaped.join("|")})`, "g");
      const parts = txt.split(re);
      for (const part of parts) {
        if (targets.includes(part)) {
          const span = document.createElement("span");
          span.className = "replacement";
          span.textContent = part;
          scriptBox.appendChild(span);
        } else {
          scriptBox.appendChild(document.createTextNode(part));
        }
      }
    }
    SoundFX.playSuccess();
    await wait(900);
    // Settle the green highlights to neutral
    $$(".replacement", scriptBox).forEach((s) => s.classList.add("replacement--settled"));
    await wait(400);
  }

  // ── Stage 12: COMPLIANCE GATES ──────────────────────────────────────────
  async function renderComplianceGates(stage, data) {
    const gateOrder = ["l1", "l2", "l3"];
    for (const key of gateOrder) {
      const g = $(`.gate[data-gate="${key}"]`, stage);
      const info = data[key] || {};
      $("[data-slot='ms']", g).textContent = (info.ms != null) ? `${info.ms} ms` : "";
      $("[data-slot='msg']", g).textContent = info.msg || "";
      // Brief "processing" pause proportional to actual ms (capped for UX)
      const processingMs = Math.min(Math.max(Number(info.ms) || 200, 300), 1400);
      await wait(processingMs);
      g.classList.add("gate--open");
      SoundFX.playGateOpen();
      // Hold each opened gate ~0.6s before opening the next one
      await wait(600);
    }

    // Dual gate → hero reveal. The plan's single largest lift: the
    // compliance verdict reads as Fraunces numerals between hairline rules,
    // not a filling bar. Peripheral UI dims so the numbers land.
    await wait(200);
    const q = Number(data.qualityScore) || 0;
    const c = Number(data.complianceScore) || 0;
    const qBar = $("[data-slot='qualityBar']", stage);
    const cBar = $("[data-slot='complianceBar']", stage);
    qBar.style.width = Math.min(100, (q / 110) * 100) + "%";
    cBar.style.width = Math.min(100, c) + "%";

    stage.classList.add("stage--reveal-peripheral-dim");
    await wait(280);
    stage.classList.add("stage--reveal-fire");

    const qRevealEl = $("[data-slot='qualityReveal']", stage);
    const cRevealEl = $("[data-slot='complianceReveal']", stage);
    await Promise.all([
      countUpSpring(qRevealEl, q, 1200),
      countUpSpring(cRevealEl, c, 1200),
      countUp($("[data-slot='qualityScore']", stage), q, 1200),
      countUp($("[data-slot='complianceScore']", stage), c, 1200),
    ]);
    qRevealEl.classList.add("dual-reveal-number--settle");
    cRevealEl.classList.add("dual-reveal-number--settle");

    await wait(220);
    const verdict = $("#dual-verdict");
    verdict.textContent = "Passed";
    verdict.classList.add("dual-verdict--passed");
    await wait(260);
    const exceeds = $("#dual-exceeds");
    if (exceeds) exceeds.classList.add("dual-exceeds--shown");
    SoundFX.playSuccess();
    await wait(460);
    stage.classList.remove("stage--reveal-peripheral-dim");
    await wait(200);
  }

  // ── Stage 13: MULTI-LANGUAGE ────────────────────────────────────────────
  async function renderMultiLanguage(stage, data) {
    const langs = Array.isArray(data.languages) ? data.languages : [];
    const drift = data.driftPct;

    // Stream every configured language in parallel for the dramatic effect.
    await Promise.all(langs.map((lang) => {
      const box = $(`#lang-${lang.id}`);
      if (!box) return Promise.resolve();
      const text = Array.isArray(lang.script) ? lang.script.join(" ") : (lang.script || "");
      return streamWords(box, text, 25);
    }));

    const qa = $("#lang-qa");
    qa.textContent = drift != null
      ? `Translation QA — Semantic drift: ${drift}% (threshold: 5%) — ✓ All languages aligned`
      : "Translation QA — ✓ All languages aligned";
    qa.classList.add("lang-qa--shown");
    SoundFX.playStamp();
    await wait(500);
  }

  // ── Stage 14: AUDIT TRAIL (structured PDF document) ─────────────────────
  // Inline SVG icons — single-stroke, mono, scales with currentColor
  const AUDIT_ICONS = {
    sources:    '<svg viewBox="0 0 24 24"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M9 13h8M9 17h6"/></svg>',
    facts:      '<svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>',
    compliance: '<svg viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
    timeline:   '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
  };

  async function renderAuditTrail(stage, data) {
    const body = $("#audit-doc-body");
    body.innerHTML = "";

    const sections = [
      {
        key: "sources",
        title: "Sources",
        lines: [
          ['<span class="k">Article:</span> <span class="v">Reuters</span> · 47 min ago'],
          ['<span class="k">Filing:</span> <span class="v">10-K, FY2025</span> (filed 2025-02-26)'],
        ],
      },
      {
        key: "facts",
        title: "Fact Validation",
        lines: [
          ['<span class="v">8 / 8</span> facts verified against SEC EDGAR'],
          ['<span class="k">0</span> blocked · <span class="k">0</span> ambiguous'],
        ],
      },
      {
        key: "compliance",
        title: "Integrity Gates",
        lines: [
          ['<span class="v">3 violations</span> caught &amp; rewritten before release'],
          ['L1 + L2 + L3 passed · Quality <span class="v">95</span> · Integrity <span class="v">100</span>'],
        ],
      },
      {
        key: "timeline",
        title: "Timeline",
        lines: [
          [`<span class="v">${data.steps ?? 15} steps</span> traced · <span class="v">${data.humanInterventions ?? 0}</span> human interventions`],
          [`<span class="k">Total:</span> <span class="v">${data.durationSec ?? 47} seconds</span> (article → final script)`],
        ],
      },
    ];

    for (let i = 0; i < sections.length; i++) {
      const s = sections[i];
      const el = document.createElement("div");
      el.className = "audit-section";
      el.dataset.section = s.key;
      el.style.animationDelay = (i * 80) + "ms";
      el.innerHTML = `
        <div class="audit-section-icon">${AUDIT_ICONS[s.key]}</div>
        <div>
          <div class="audit-section-title">${escapeHtml(s.title)}</div>
          ${s.lines.map((html) => `<div class="audit-section-line">${html}</div>`).join("")}
        </div>
      `;
      body.appendChild(el);
      await wait(280);
    }
    await wait(400);
  }

  // ── Stage 15: FINAL OUTPUT ──────────────────────────────────────────────
  async function renderFinalOutput(stage, data) {
    const reporter = data.reporter || "—";
    setSlot(stage, "reporter", reporter);
    setSlot(stage, "reporterRole", data.reporterRole || "");
    $("[data-slot='reporterAvatar']", stage).textContent = reporter ? reporter[0] : "—";
    setSlot(stage, "qualityScore",    data.qualityScore ?? "—");
    setSlot(stage, "complianceScore", data.complianceScore ?? "—");
    setSlot(stage, "ticker",   data.ticker || "");
    setSlot(stage, "exchange", data.exchange || "");
    setSlot(stage, "source",   data.source || "");

    const scriptEl = $("[data-slot='finalScript']", stage);
    const finalText = Array.isArray(data.finalScript) ? data.finalScript.join(" ") : (data.finalScript || "");
    scriptEl.textContent = finalText;

    // Big number count-up
    const totalEl = $("[data-slot='totalSeconds']", stage);
    await countUp(totalEl, Number(data.totalSeconds) || 0, 1200);

    // Subtle confetti — runs ~5s, covering the full pre-autoplay pause so the
    // celebration is visible the whole time the audience is reading the card.
    SoundFX.playWhoosh();
    confettiBurst();
    await wait(5000);

    // Auto-trigger the avatar video as if a meeting host clicked the CTA.
    // We don't await the modal flow; the click handler takes over from here.
    const cta = document.getElementById("final-cta");
    if (cta && !cta.disabled) cta.click();
  }

  // ── Confetti (lightweight, no library) ──────────────────────────────────
  function confettiBurst() {
    // Celebratory only; skip entirely under reduced motion
    if (!shouldAnimate()) return;
    const canvas = $("#confetti");
    const ctx = canvas.getContext("2d");
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors = ["#22c55e", "#FF7A59", "#D4A574", "#e6e6ee"];
    const N = 120;
    const parts = Array.from({ length: N }, () => ({
      x: window.innerWidth / 2 + (Math.random() - 0.5) * 200,
      y: window.innerHeight - 100,
      vx: (Math.random() - 0.5) * 8,
      vy: -Math.random() * 14 - 6,
      g: 0.32,
      size: 4 + Math.random() * 4,
      color: colors[(Math.random() * colors.length) | 0],
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.3,
    }));
    let frames = 0;
    function tick() {
      frames++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of parts) {
        p.vy += p.g;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
      // ~5s at 60fps to cover the Stage 15 pre-autoplay pause
      if (frames < 300) requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    requestAnimationFrame(tick);
  }

  // ── Renderer dispatch table ─────────────────────────────────────────────
  const RENDERERS = {
    article_input:        renderArticleInput,
    watcher_detection:    renderWatcherDetection,
    company_enrichment:   renderCompanyEnrichment,
    fact_extraction:      renderFactExtraction,
    sec_validation:       renderSecValidation,
    cross_reference:      renderCrossReference,
    reporter_selection:   renderReporterSelection,
    script_generation:    renderScriptGeneration,
    chart_suggestion:     renderChartSuggestion,
    thumbnail_generation: renderThumbnailGeneration,
    compliance_red_pass:  renderComplianceRedPass,
    compliance_gates:     renderComplianceGates,
    multilanguage:        renderMultiLanguage,
    audit_trail:          renderAuditTrail,
    final_output:         renderFinalOutput,
  };

  // ── Rail data-packet (flows from completed stage → next activating) ────
  function sendDataPacket(fromStage, toStage) {
    if (!fromStage || !toStage || fromStage === toStage) return;
    const fromDot = fromStage.querySelector(".stage-dot");
    const toDot   = toStage.querySelector(".stage-dot");
    if (!fromDot || !toDot) return;

    const fromRect = fromDot.getBoundingClientRect();
    const toRect   = toDot.getBoundingClientRect();
    const sX = window.scrollX || window.pageXOffset || 0;
    const sY = window.scrollY || window.pageYOffset || 0;

    const startX = fromRect.left + fromRect.width  / 2 + sX;
    const startY = fromRect.top  + fromRect.height / 2 + sY;
    const endX   = toRect.left   + toRect.width  / 2 + sX;
    const endY   = toRect.top    + toRect.height / 2 + sY;

    const packet = document.createElement("div");
    packet.className = "rail-packet";
    packet.style.left = startX + "px";
    packet.style.top  = startY + "px";
    document.body.appendChild(packet);

    // Next frame: set transition + end position so the move animates
    requestAnimationFrame(() => {
      packet.style.transition = `top 400ms ${EASE_ENTER}, left 400ms ${EASE_ENTER}`;
      packet.style.left = endX + "px";
      packet.style.top  = endY + "px";
    });

    setTimeout(() => {
      packet.remove();
      toDot.classList.add("stage-dot--received");
      setTimeout(() => toDot.classList.remove("stage-dot--received"), 500);
    }, 440);
  }

  // ── Pipeline runner ─────────────────────────────────────────────────────
  async function runPipeline(events) {
    setMode("RUNNING");
    const startedAt = performance.now();
    const clockTimer = setInterval(() => {
      const sec = (performance.now() - startedAt) / 1000;
      $("#meta-clock").textContent = sec.toFixed(1).padStart(4, "0") + "s";
    }, 100);

    try {
      let prevStage = null;
      for await (const ev of events) {
        const stage = stageEl(ev.stage);
        if (!stage) continue;
        // Honour per-stage delay (curated mode pacing)
        if (typeof ev.delayMs === "number") {
          const elapsed = performance.now() - startedAt;
          const wait_ = Math.max(0, ev.delayMs - elapsed);
          if (wait_ > 0) await wait(wait_);
        }
        // Visual flourish: send a data packet from the prior stage's rail
        // dot to this stage's rail dot (fire-and-forget, runs in parallel).
        if (prevStage) sendDataPacket(prevStage, stage);
        activateStage(stage);
        const renderer = RENDERERS[ev.name];
        if (renderer) {
          try { await renderer(stage, ev.data || {}); }
          catch (err) {
            console.error("renderer error", ev.name, err);
          }
        }
        completeStage(stage);
        prevStage = stage;
      }
      setMode("COMPLETE");
      const fab = $("#replay-fab");
      if (fab) fab.hidden = false;
      // R7 Fix 2 — auto-play eToro broadcast modal 2s after Stage 15 completes
      maybeAutoPlayBroadcast();
      // R11.4 Fix 3 — auto-play Citi avatar modal 1s after Stage 15 completes
      maybeAutoPlayAvatar();
    } finally {
      clearInterval(clockTimer);
    }
  }

  // ── R7 Fix 2 — eToro broadcast modal (auto-fires after Stage 15) ────────
  // Single-fire per page load. Brand-conditional: only when ?client=etoro.
  // 2-second delay after pipeline completes so the user perceives Stage 15
  // landing first, then the modal taking over.
  let broadcastModalFired = false;
  function maybeAutoPlayBroadcast() {
    if (broadcastModalFired) return;
    let clientSlug = '';
    try {
      clientSlug = (new URLSearchParams(location.search).get('client') || '').toLowerCase();
    } catch (e) {}
    // Default brand when no client param = nvidia per client-loader. Only fire for explicit etoro.
    if (clientSlug !== 'etoro') return;
    broadcastModalFired = true;
    setTimeout(openBroadcastModal, 2000);
  }

  // ── R11.4 Fix 3 — Citi avatar modal (auto-fires after Stage 15) ─────────
  // Mirrors the broadcast pattern but uses the config-driven AVATAR_VIDEO_URL
  // and the existing #avatar-modal infrastructure. Single-fire per page load.
  // Brand-conditional: only when ?client=citi AND avatar_video_url is set.
  // 1-second delay (vs eToro's 2s for the hardcoded broadcast modal).
  let avatarModalFired = false;
  function maybeAutoPlayAvatar() {
    if (avatarModalFired) return;
    let clientSlug = '';
    try {
      clientSlug = (new URLSearchParams(location.search).get('client') || '').toLowerCase();
    } catch (e) {}
    if (clientSlug !== 'citi') return;
    if (!AVATAR_VIDEO_URL) return; // safety: no URL configured → no auto-open
    avatarModalFired = true;
    setTimeout(openAvatarModal, 1000);
  }
  const broadcastModal      = $("#broadcast-modal");
  const broadcastModalClose = $("#broadcast-modal-close");
  const broadcastModalStage = $("#broadcast-modal-stage");
  const broadcastModalVideo = $("#broadcast-modal-video");
  const broadcastModalUnmute = $("#broadcast-modal-unmute");
  function openBroadcastModal() {
    if (!broadcastModal || !broadcastModalVideo) return;
    broadcastModal.hidden = false;
    document.body.style.overflow = "hidden";
    if (broadcastModalUnmute) broadcastModalUnmute.hidden = true;
    // Try autoplay-with-audio first; on rejection, fall back to muted + show unmute button.
    broadcastModalVideo.muted = false;
    const p = broadcastModalVideo.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        // Autoplay-with-audio blocked by browser policy. Try muted autoplay.
        broadcastModalVideo.muted = true;
        if (broadcastModalUnmute) broadcastModalUnmute.hidden = false;
        const p2 = broadcastModalVideo.play();
        if (p2 && typeof p2.catch === "function") p2.catch(() => {});
      });
    }
  }
  function closeBroadcastModal() {
    if (!broadcastModal || broadcastModal.hidden) return;
    broadcastModal.hidden = true;
    document.body.style.overflow = "";
    try { broadcastModalVideo.pause(); } catch (e) {}
    if (broadcastModalUnmute) broadcastModalUnmute.hidden = true;
  }
  if (broadcastModalClose) broadcastModalClose.addEventListener("click", closeBroadcastModal);
  if (broadcastModal) {
    broadcastModal.addEventListener("click", (e) => {
      // Click outside the video stage closes the modal; clicks on the stage
      // (or the video / its native controls) do not.
      if (broadcastModalStage && !broadcastModalStage.contains(e.target)) closeBroadcastModal();
    });
  }
  if (broadcastModalUnmute) {
    broadcastModalUnmute.addEventListener("click", () => {
      try {
        broadcastModalVideo.muted = false;
        const p = broadcastModalVideo.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
      } catch (e) {}
      broadcastModalUnmute.hidden = true;
    });
  }

  const TOTAL_STAGES = $$(".stage").length || 15;

  function updateStageTracker({ state, num, name }) {
    const el  = $("#stage-tracker");
    const lbl = $("#stage-tracker-label");
    if (!el || !lbl) return;
    el.dataset.state = state;
    if (state === "ready") {
      lbl.textContent = "READY";
    } else if (state === "running") {
      const n = String(num).padStart(2, "0");
      const t = String(TOTAL_STAGES).padStart(2, "0");
      lbl.innerHTML =
        `<span class="stage-tracker-num">STAGE ${escapeHtml(n)}</span>` +
        `<span class="stage-tracker-total"> / ${escapeHtml(t)}</span>` +
        `<span class="stage-tracker-sep">—</span>` +
        `<span class="stage-tracker-name">${escapeHtml(name || "")}</span>`;
    } else if (state === "complete") {
      const t = String(TOTAL_STAGES).padStart(2, "0");
      lbl.textContent = `COMPLETE — ${t}/${t}`;
    } else if (state === "error") {
      lbl.textContent = "ERROR";
    }
  }

  function setMode(label) {
    if (label === "READY")    updateStageTracker({ state: "ready" });
    if (label === "COMPLETE") updateStageTracker({ state: "complete" });
    if (label === "ERROR")    updateStageTracker({ state: "error" });
  }

  // ── Curated mode: yield stages from the bundled showcase in order ──────
  // Standalone build: showcase is bundled into pipeline-showcase.js and
  // attached to window.PIPELINE_SHOWCASE. No network fetch.
  async function* curatedEvents() {
    const showcase = window.PIPELINE_SHOWCASE;
    if (!showcase) throw new Error("window.PIPELINE_SHOWCASE missing — ensure pipeline-showcase.js loaded before pipeline.js");
    const stages = Array.isArray(showcase.stages) ? showcase.stages : [];
    for (const s of stages) {
      yield s;
    }
  }

  // ── Reset all stages to inactive ────────────────────────────────────────
  function resetTimeline() {
    $$(".stage").forEach((s) => {
      s.classList.remove("stage--active", "stage--complete");
      setStatus(s, "awaiting");
    });
    setMode("READY");
    $("#meta-clock").textContent = "00:00.0";
    // R7 Fix 2 — re-arm the broadcast modal so a Replay can fire it again.
    broadcastModalFired = false;

    // Clear key dynamic regions
    $("#fact-list").innerHTML = "";
    $("#fact-source-body").innerHTML = "";
    $("#validation-list").innerHTML = "";
    $("#xref-graph").innerHTML = "";
    $("#reporter-row").innerHTML = "";
    $("#script-box").innerHTML = "";
    $("#chart").innerHTML = "";
    $("#thumbs").innerHTML = "";
    $("#redpass-script").innerHTML = "";
    $("#violations").innerHTML = "";
    const redpass = $("#redpass-script");
    if (redpass) redpass.classList.remove("redpass-script--dimmed");

    // Stage 2 — novelty bar + score
    const novBar = document.querySelector('[data-slot="noveltyBar"]');
    if (novBar) novBar.style.width = "0%";
    const novVal = document.querySelector('[data-slot="noveltyScore"]');
    if (novVal) novVal.textContent = "0";

    // Stage 3 — strip populate-pop flashes from company cells
    $$(".company-cell, .company-block, .company-head").forEach((el) => {
      el.classList.remove("populate-pop");
    });

    // Stage 8 — word counters
    const sw = $("#script-words"); if (sw) sw.textContent = "0";
    const st = $("#script-target"); if (st) st.textContent = "0";

    // Stage 11 — violation counter
    const vc = $("#violation-count"); if (vc) vc.textContent = "0";

    // Stage 12 — gates + dual bars + verdict + exceeds banner
    $$(".gate").forEach((g) => g.classList.remove("gate--open"));
    const qBar = document.querySelector('[data-slot="qualityBar"]');
    const cBar = document.querySelector('[data-slot="complianceBar"]');
    if (qBar) qBar.style.width = "0%";
    if (cBar) cBar.style.width = "0%";
    const qVal = document.querySelector('[data-slot="qualityScore"]');
    const cVal = document.querySelector('[data-slot="complianceScore"]');
    if (qVal) qVal.textContent = "0";
    if (cVal) cVal.textContent = "0";
    // Stage 12 hero reveal — reset numerals + dim classes for replay
    const qReveal = document.querySelector('[data-slot="qualityReveal"]');
    const cReveal = document.querySelector('[data-slot="complianceReveal"]');
    if (qReveal) { qReveal.textContent = "0"; qReveal.classList.remove("dual-reveal-number--settle"); }
    if (cReveal) { cReveal.textContent = "0"; cReveal.classList.remove("dual-reveal-number--settle"); }
    const stage12 = document.querySelector('.stage[data-stage="12"]');
    if (stage12) stage12.classList.remove("stage--reveal-fire", "stage--reveal-peripheral-dim");
    const verdict = $("#dual-verdict");
    verdict.classList.remove("dual-verdict--passed");
    verdict.textContent = "Awaiting verdict";
    const exceeds = $("#dual-exceeds");
    if (exceeds) exceeds.classList.remove("dual-exceeds--shown");

    // Stage 13 — languages + QA pill (iterate all configured columns)
    $$(".lang-body").forEach((box) => { box.innerHTML = ""; });
    $("#lang-qa").classList.remove("lang-qa--shown");

    // Stage 14 — audit body
    const auditBody = $("#audit-doc-body");
    if (auditBody) auditBody.innerHTML = "";

    // Stage 15 — big number, CTA loading state
    const total = document.querySelector('[data-slot="totalSeconds"]');
    if (total) total.textContent = "—";
    setCtaLoading(false);

    // Avatar modal — close if open
    if (modal && !modal.hidden) {
      modal.hidden = true;
      document.body.style.overflow = "";
      try { modalVideo.pause(); } catch {}
    }

    // Replay FAB — hide on reset
    const fab = $("#replay-fab");
    if (fab) fab.hidden = true;

    // Rail packets — remove any in-flight packets and received-pulse flashes
    $$(".rail-packet").forEach((p) => p.remove());
    $$(".stage-dot--received").forEach((d) => d.classList.remove("stage-dot--received"));

    // Confetti canvas — clear any lingering frame
    const cv = $("#confetti");
    if (cv) {
      const ctx = cv.getContext("2d");
      ctx && ctx.clearRect(0, 0, cv.width, cv.height);
    }
  }

  // ── Utility ─────────────────────────────────────────────────────────────
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function escapeRegex(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  // ── Wire up CTAs ────────────────────────────────────────────────────────
  let running = false;
  $("#btn-watch-demo").addEventListener("click", async () => {
    if (running) return;
    // Initialise audio on first user gesture (browser requirement).
    SoundFX.init();
    SoundFX.playClick();
    running = true;
    resetTimeline();
    try {
      await runPipeline(curatedEvents());
    } catch (err) {
      console.error(err);
      alert("Failed to run demo: " + err.message);
      setMode("ERROR");
    } finally {
      running = false;
    }
  });

  // ── Avatar video modal ──────────────────────────────────────────────────
  // Per Q4 lock + B.4.E avatar-CTA spec: hide CTA when avatar_video_url is
  // null/empty/FILL_ME-prefixed. Iddo produces one branded 47-sec video per
  // client; until that lands in Supabase Storage and the URL is pasted into
  // the client config, Stage 15 closes on the Audit Trail card with no broken
  // CTA, no "coming soon" placeholder.
  const RAW_AVATAR_URL = window.__STV_AVATAR_VIDEO_URL;
  const AVATAR_VIDEO_URL = (
    typeof RAW_AVATAR_URL === 'string' &&
    RAW_AVATAR_URL.length > 0 &&
    !RAW_AVATAR_URL.startsWith('FILL_ME')
  ) ? RAW_AVATAR_URL : null;

  const finalCta      = $("#final-cta");
  const finalCtaLabel = finalCta ? finalCta.textContent : "";
  const modal         = $("#avatar-modal");
  const modalClose    = $("#avatar-modal-close");
  const modalStage    = $("#avatar-modal-stage");
  const modalVideo    = $("#avatar-modal-video");

  // Hide the CTA entirely when no video URL is configured. Stage 15 still
  // renders the final-output script card and the audit pill — this only
  // removes the broken-click affordance.
  if (!AVATAR_VIDEO_URL && finalCta) {
    finalCta.style.display = "none";
  }

  function setCtaLoading(loading) {
    if (loading) {
      finalCta.classList.add("final-cta--loading");
      finalCta.innerHTML = '<span class="cta-spinner"></span><span>Rendering avatar…</span>';
      finalCta.disabled = true;
    } else {
      finalCta.classList.remove("final-cta--loading");
      finalCta.textContent = finalCtaLabel;
      finalCta.disabled = false;
    }
  }

  function openAvatarModal() {
    // Lazy-set src so the file isn't fetched until the user actually opens
    // the modal (preload="none" alone doesn't prevent some browsers from
    // pre-resolving the URL).
    if (modalVideo.getAttribute("src") !== AVATAR_VIDEO_URL) {
      modalVideo.setAttribute("src", AVATAR_VIDEO_URL);
    }
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    SoundFX.playWhoosh();
    // Defer play() to next frame so the fade-in animation can start cleanly
    requestAnimationFrame(() => {
      const p = modalVideo.play();
      if (p && typeof p.catch === "function") p.catch(() => { /* user gesture lost — controls remain */ });
    });
  }

  function closeAvatarModal() {
    if (modal.hidden) return;
    modal.hidden = true;
    document.body.style.overflow = "";
    try { modalVideo.pause(); } catch {}
    setCtaLoading(false);
  }

  finalCta.addEventListener("click", () => {
    if (finalCta.disabled) return;
    SoundFX.playClick();
    setCtaLoading(true);
    setTimeout(openAvatarModal, 1500);
  });

  modalClose.addEventListener("click", closeAvatarModal);

  // Click outside the video stage closes the modal; clicks on the stage
  // itself (or the video / its native controls) do not.
  modal.addEventListener("click", (e) => {
    if (!modalStage.contains(e.target)) closeAvatarModal();
  });

  // ── Keyboard shortcuts ──────────────────────────────────────────────
  // Esc: close avatar modal if open
  // W:   start the demo (same as Watch Demo button)
  // R:   replay when demo has completed
  // M:   toggle sound
  // ?:   show help toast (bottom-right, auto-dismiss)
  document.addEventListener("keydown", (e) => {
    // Don't swallow keys when typing into form fields
    const tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable) return;

    if (e.key === "Escape") {
      // R7 Fix 2 — broadcast modal closes first if open (it sits above avatar)
      if (broadcastModal && !broadcastModal.hidden) { closeBroadcastModal(); return; }
      if (!modal.hidden) closeAvatarModal();
      return;
    }
    if (e.key === "w" || e.key === "W") {
      const cta = $("#btn-watch-demo");
      if (cta && !cta.disabled) cta.click();
      return;
    }
    if (e.key === "r" || e.key === "R") {
      const replay = $("#replay-btn");
      const fab = $("#replay-fab");
      if (replay && fab && !fab.hidden) replay.click();
      return;
    }
    if (e.key === "m" || e.key === "M") {
      const st = $("#sound-toggle");
      if (st) st.click();
      return;
    }
    if (e.key === "?") {
      showKbdHelp();
      return;
    }
  });

  // ── Keyboard help toast — minimal, auto-dismiss ─────────────────────
  let kbdHelpTimer = null;
  function showKbdHelp() {
    let toast = $("#kbd-help-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "kbd-help-toast";
      toast.className = "kbd-help-toast";
      toast.setAttribute("role", "dialog");
      toast.setAttribute("aria-label", "Keyboard shortcuts");
      toast.innerHTML = `
        <div class="kbd-help-title">Keyboard shortcuts</div>
        <dl class="kbd-help-list">
          <dt>W</dt><dd>Watch demo</dd>
          <dt>R</dt><dd>Replay</dd>
          <dt>M</dt><dd>Toggle sound</dd>
          <dt>?</dt><dd>Show this help</dd>
          <dt>Esc</dt><dd>Close video</dd>
        </dl>
      `;
      document.body.appendChild(toast);
    }
    toast.classList.add("kbd-help-toast--shown");
    if (kbdHelpTimer) clearTimeout(kbdHelpTimer);
    kbdHelpTimer = setTimeout(() => toast.classList.remove("kbd-help-toast--shown"), 4000);
  }

  // ── Theme toggle — light/dark, localStorage-persisted ──────────────────
  // Pre-paint script in <head> has already applied the persisted theme.
  (function wireThemeToggle() {
    const btn = $("#theme-toggle");
    if (!btn) return;
    const htmlEl = document.documentElement;
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    const syncLabel = () => {
      const t = htmlEl.dataset.theme || "dark";
      btn.setAttribute(
        "aria-label",
        t === "light" ? "Switch to dark mode" : "Switch to light mode"
      );
    };
    syncLabel();
    btn.addEventListener("click", () => {
      const next = (htmlEl.dataset.theme === "light") ? "dark" : "light";
      htmlEl.dataset.theme = next;
      if (metaTheme) metaTheme.setAttribute("content", next === "light" ? "#FAF7F2" : "#0A0B0F");
      try { localStorage.setItem("stv-theme", next); } catch (e) {}
      syncLabel();
    });
  })();

  // ── Sound toggle (topbar) ───────────────────────────────────────────────
  const soundToggle = $("#sound-toggle");
  if (soundToggle) {
    // Sync initial button state with persisted mute preference
    soundToggle.dataset.state = SoundFX.isMuted() ? "off" : "on";
    soundToggle.setAttribute(
      "aria-label",
      SoundFX.isMuted() ? "Unmute sound" : "Mute sound"
    );
    soundToggle.addEventListener("click", () => {
      // First click also doubles as the user-gesture that boots AudioContext
      SoundFX.init();
      const nowMuted = SoundFX.toggleMuted();
      soundToggle.dataset.state = nowMuted ? "off" : "on";
      soundToggle.setAttribute(
        "aria-label",
        nowMuted ? "Unmute sound" : "Mute sound"
      );
      // Confirmation blip when turning ON
      if (!nowMuted) SoundFX.playClick();
    });
  }

  // ── Replay FAB ──────────────────────────────────────────────────────────
  const replayBtn = $("#replay-btn");
  if (replayBtn) {
    replayBtn.addEventListener("click", () => {
      if (running) return;
      const fab = $("#replay-fab");
      if (fab) fab.hidden = true;
      resetTimeline();
      window.scrollTo({ top: 0, behavior: "smooth" });
      // Small delay so the scroll-to-top animation starts cleanly
      setTimeout(() => { $("#btn-watch-demo").click(); }, 450);
    });
  }

  setMode("READY");
})();
