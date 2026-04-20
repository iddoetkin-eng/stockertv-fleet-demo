/* ──────────────────────────────────────────────────────────────────────────
   StockerTV Pipeline Template — client loader
   Runs BEFORE pipeline-template.js. Responsibilities:
     1. Parse ?client=X URL parameter (default: "nvidia").
     2. Fetch ./config/{client}.json; on failure, fall back to nvidia.json.
     3. Hydrate DOM placeholders: data-tmpl / data-tmpl-html walk, CSS custom
        properties, hero stats, chart Y-axis, and the dynamic language panel
        (2–5 columns built from a built-in flag SVG library).
     4. Set globals consumed by pipeline-template.js:
          window.PIPELINE_SHOWCASE      (showcase payload)
          window.__STV_THUMBNAIL_BRAND  (Stage 10 brand mark)
          window.__STV_AVATAR_VIDEO_URL (Stage 15 video)
     5. Chain-inject pipeline-template.js so the animation runs.
   ────────────────────────────────────────────────────────────────────────── */
(() => {
  "use strict";

  const DEFAULT_CLIENT = "nvidia";

  // ── Flag SVG library (content only; wrapped into bg/sm variants below) ──
  // Each value is the inner SVG payload rendered inside viewBox="0 0 30 20".
  // v1 countries: US, GB, DE, IT, ES, BR, AE, FR, JP, AU, CA, NL, IL.
  const FLAGS = {
    US:
      '<rect width="30" height="20" fill="#b22234"/>' +
      '<rect y="1.54"  width="30" height="1.54" fill="#fff"/>' +
      '<rect y="4.62"  width="30" height="1.54" fill="#fff"/>' +
      '<rect y="7.69"  width="30" height="1.54" fill="#fff"/>' +
      '<rect y="10.77" width="30" height="1.54" fill="#fff"/>' +
      '<rect y="13.85" width="30" height="1.54" fill="#fff"/>' +
      '<rect y="16.92" width="30" height="1.54" fill="#fff"/>' +
      '<rect width="12" height="10.77" fill="#3c3b6e"/>',
    GB:
      '<rect width="30" height="20" fill="#012169"/>' +
      '<path d="M0,0 L30,20 M30,0 L0,20" stroke="#fff" stroke-width="3"/>' +
      '<path d="M0,0 L30,20 M30,0 L0,20" stroke="#C8102E" stroke-width="1.5"/>' +
      '<path d="M15,0 L15,20 M0,10 L30,10" stroke="#fff" stroke-width="5"/>' +
      '<path d="M15,0 L15,20 M0,10 L30,10" stroke="#C8102E" stroke-width="3"/>',
    DE:
      '<rect width="30" height="6.67" fill="#000"/>' +
      '<rect y="6.67" width="30" height="6.67" fill="#DD0000"/>' +
      '<rect y="13.33" width="30" height="6.67" fill="#FFCE00"/>',
    IT:
      '<rect width="10" height="20" fill="#009246"/>' +
      '<rect x="10" width="10" height="20" fill="#fff"/>' +
      '<rect x="20" width="10" height="20" fill="#CE2B37"/>',
    ES:
      '<rect width="30" height="20" fill="#aa151b"/>' +
      '<rect y="5" width="30" height="10" fill="#f1bf00"/>',
    BR:
      '<rect width="30" height="20" fill="#009c3b"/>' +
      '<polygon points="15,2 28,10 15,18 2,10" fill="#ffdf00"/>' +
      '<circle cx="15" cy="10" r="4" fill="#002776"/>',
    AE:
      '<rect x="7.5" width="22.5" height="6.67" fill="#009e49"/>' +
      '<rect x="7.5" y="6.67" width="22.5" height="6.67" fill="#fff"/>' +
      '<rect x="7.5" y="13.33" width="22.5" height="6.67" fill="#000"/>' +
      '<rect width="7.5" height="20" fill="#ce1126"/>',
    FR:
      '<rect width="10" height="20" fill="#002654"/>' +
      '<rect x="10" width="10" height="20" fill="#fff"/>' +
      '<rect x="20" width="10" height="20" fill="#ED2939"/>',
    JP:
      '<rect width="30" height="20" fill="#fff"/>' +
      '<circle cx="15" cy="10" r="5" fill="#BC002D"/>',
    AU:
      '<rect width="30" height="20" fill="#012169"/>' +
      '<rect width="15" height="10" fill="#012169"/>' +
      '<path d="M0,0 L15,10 M15,0 L0,10" stroke="#fff" stroke-width="1.5"/>' +
      '<path d="M7.5,0 L7.5,10 M0,5 L15,5" stroke="#fff" stroke-width="2"/>' +
      '<path d="M7.5,0 L7.5,10 M0,5 L15,5" stroke="#C8102E" stroke-width="1"/>' +
      '<polygon points="22.5,8 23.2,10 25.4,10 23.6,11.3 24.3,13.4 22.5,12.1 20.7,13.4 21.4,11.3 19.6,10 21.8,10" fill="#fff"/>',
    CA:
      '<rect width="7.5" height="20" fill="#D52B1E"/>' +
      '<rect x="22.5" width="7.5" height="20" fill="#D52B1E"/>' +
      '<rect x="7.5" width="15" height="20" fill="#fff"/>' +
      '<polygon points="15,5 16,8 19,8 16.5,10 17.5,13 15,11 12.5,13 13.5,10 11,8 14,8" fill="#D52B1E"/>',
    NL:
      '<rect width="30" height="6.67" fill="#AE1C28"/>' +
      '<rect y="6.67" width="30" height="6.67" fill="#fff"/>' +
      '<rect y="13.33" width="30" height="6.67" fill="#21468B"/>',
    IL:
      '<rect width="30" height="20" fill="#fff"/>' +
      '<rect y="3" width="30" height="2" fill="#0038B8"/>' +
      '<rect y="15" width="30" height="2" fill="#0038B8"/>' +
      '<polygon points="15,7 16.3,9.2 18.8,9.2 16.8,10.6 17.6,13 15,11.6 12.4,13 13.2,10.6 11.2,9.2 13.7,9.2" fill="none" stroke="#0038B8" stroke-width="0.6"/>',
  };

  const NEUTRAL_FLAG = '<rect width="30" height="20" fill="#555"/>';

  function flagBgSvg(code) {
    const c = FLAGS[code] || NEUTRAL_FLAG;
    return '<svg class="lang-flag-bg" viewBox="0 0 30 20" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' + c + '</svg>';
  }
  function flagSmallSvg(code) {
    const c = FLAGS[code] || NEUTRAL_FLAG;
    return '<svg viewBox="0 0 30 20">' + c + '</svg>';
  }

  // ── Small utilities ─────────────────────────────────────────────────────
  function getByPath(obj, path) {
    if (!obj || !path) return undefined;
    return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  async function loadConfig(name) {
    const safe = String(name).replace(/[^a-z0-9_-]/gi, "");
    if (!safe) throw new Error("empty client name");
    const res = await fetch("./config/" + encodeURIComponent(safe) + ".json", { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }

  // ── Apply-to-DOM helpers ────────────────────────────────────────────────
  function applyBranding(b) {
    if (!b) return;
    const html = document.documentElement;
    // Only override --accent; leave --accent-2 to the stylesheet's lighter variant
    // so the 2-tone accent isn't flattened. Clients that need a custom second
    // tone can add a branding.primaryColor2 field in a future revision.
    if (b.primaryColor) html.style.setProperty("--accent", b.primaryColor);
    if (b.accentColor)  html.style.setProperty("--green",  b.accentColor);
    if (b.pageTitle) document.title = b.pageTitle;
    // clientName / logoUrl reserved for future use.
  }

  function applyDataTmpl(config) {
    document.querySelectorAll("[data-tmpl]").forEach((el) => {
      const v = getByPath(config, el.getAttribute("data-tmpl"));
      if (typeof v === "string") el.textContent = v;
    });
    document.querySelectorAll("[data-tmpl-html]").forEach((el) => {
      const v = getByPath(config, el.getAttribute("data-tmpl-html"));
      if (typeof v === "string") el.innerHTML = v;
    });
  }

  function buildHeroStats(stats) {
    const wrap = document.getElementById("launch-stats");
    if (!wrap || !Array.isArray(stats)) return;
    wrap.innerHTML = "";
    stats.forEach((s, i) => {
      if (i > 0) {
        const dot = document.createElement("span");
        dot.className = "launch-stat-dot";
        dot.textContent = "·";
        wrap.appendChild(dot);
      }
      const stat = document.createElement("span");
      stat.className = "launch-stat";
      const v = document.createElement("span");
      v.className = "launch-stat-v";
      v.textContent = s && s.value != null ? String(s.value) : "";
      stat.appendChild(v);
      stat.appendChild(document.createTextNode(" " + (s && s.label ? s.label : "")));
      wrap.appendChild(stat);
    });
  }

  function buildChartYAxis(labels) {
    const wrap = document.getElementById("chart-yaxis");
    if (!wrap || !Array.isArray(labels)) return;
    wrap.innerHTML = "";
    labels.forEach((l) => {
      const s = document.createElement("span");
      s.textContent = String(l);
      wrap.appendChild(s);
    });
  }

  function buildLangCols(langs) {
    const wrap = document.getElementById("lang-cols");
    if (!wrap || !Array.isArray(langs) || langs.length === 0) return;
    wrap.innerHTML = "";
    wrap.style.setProperty("--lang-cols", langs.length);
    langs.forEach((lang) => {
      const code = lang && lang.countryCode;
      if (!FLAGS[code]) {
        console.warn("[stv-template] unknown countryCode, using neutral flag:", code);
      }
      const id = String((lang && lang.id) || "").replace(/[^a-z0-9_-]/gi, "") || "x";
      const col = document.createElement("div");
      col.className = "lang-col";
      col.setAttribute("data-lang", id);
      col.innerHTML =
        flagBgSvg(code) +
        '<div class="lang-market">' +
          '<span class="lang-flag" aria-hidden="true">' + flagSmallSvg(code) + '</span>' +
          '<span class="lang-market-text">' + escapeHtml(lang.marketCaption) + "</span>" +
        "</div>" +
        '<div class="lang-head">' + escapeHtml(lang.heading) + "</div>" +
        '<div class="lang-body" id="lang-' + id + '"></div>';
      wrap.appendChild(col);
    });
  }

  // ── Main async bootstrap ────────────────────────────────────────────────
  (async () => {
    const params = new URLSearchParams(location.search);
    const requested = (params.get("client") || DEFAULT_CLIENT).trim();

    let config;
    try {
      config = await loadConfig(requested);
    } catch (err) {
      console.error("[stv-template] config load failed, falling back to nvidia:", requested, err);
      if (requested !== DEFAULT_CLIENT) {
        try {
          config = await loadConfig(DEFAULT_CLIENT);
        } catch (err2) {
          console.error("[stv-template] fallback nvidia config ALSO failed — cannot continue:", err2);
          return;
        }
      } else {
        return;
      }
    }

    applyBranding(config.branding);
    applyDataTmpl(config);
    buildHeroStats(config.hero && config.hero.stats);
    buildChartYAxis(config.chart && config.chart.yAxisLabels);
    buildLangCols(config.multilang && config.multilang.languages);

    window.PIPELINE_SHOWCASE     = config.showcase;
    window.__STV_THUMBNAIL_BRAND = config.thumbnail_brand_mark;
    window.__STV_AVATAR_VIDEO_URL = config.avatar_video_url || null;

    const s = document.createElement("script");
    s.src = "./pipeline-template.js";
    document.body.appendChild(s);
  })();
})();
