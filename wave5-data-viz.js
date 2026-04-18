/* ==========================================================================
   Wave 5 — Data visualization hooks (D3 crosshair, D6 sparklines)
   D1 Nightingale rose lives in today.html. D2 telemetry rail, D4 reporter
   polylines, D5 compliance heat-grid are scaffolded via CSS but require
   deeper edits to pipeline.js / fleet.js map layer — deferred.
   ========================================================================== */
(function(){
  'use strict';

  const reducedMotionMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  const shouldAnimate = () => !reducedMotionMQ.matches;

  // ── D3 · Shift-hold Bloomberg crosshair ────────────────────────────────
  // Only arms on the fleet page (where #map-svg exists). Crosshair rules
  // extend to viewport edges; readouts show LAT, LNG, UTC, NEAREST exchange.
  function armCrosshair() {
    const mapSvg = document.getElementById('map-svg');
    if (!mapSvg) return;

    let shiftDown = false;
    let armed = false;

    const overlay = document.createElement('div');
    overlay.className = 'w5-crosshair';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML =
        '<div class="w5-ch-line w5-ch-line--h"></div>'
      + '<div class="w5-ch-line w5-ch-line--v"></div>'
      + '<div class="w5-ch-readout w5-ch-readout--lat">LAT —</div>'
      + '<div class="w5-ch-readout w5-ch-readout--lng">LNG —</div>'
      + '<div class="w5-ch-readout w5-ch-readout--utc">UTC —</div>'
      + '<div class="w5-ch-readout w5-ch-readout--near">NEAREST —</div>';
    document.body.appendChild(overlay);

    const lineH = overlay.querySelector('.w5-ch-line--h');
    const lineV = overlay.querySelector('.w5-ch-line--v');
    const rLat  = overlay.querySelector('.w5-ch-readout--lat');
    const rLng  = overlay.querySelector('.w5-ch-readout--lng');
    const rUtc  = overlay.querySelector('.w5-ch-readout--utc');
    const rNear = overlay.querySelector('.w5-ch-readout--near');

    // Project viewport cursor → equirectangular LAT/LNG using the map SVG's
    // live bounding rect. Map SVG has viewBox 0 0 360 180, x=lng+180, y=90-lat.
    function computeLatLng(x, y) {
      const r = mapSvg.getBoundingClientRect();
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) return null;
      const u = (x - r.left) / r.width;
      const v = (y - r.top)  / r.height;
      const lng = u * 360 - 180;
      const lat = 90 - v * 180;
      return { lat, lng };
    }

    function nearestExchange(lat, lng) {
      const sc = window.FLEET_SHOWCASE;
      if (!sc || !sc.exchanges) return null;
      let best = null, bestD = Infinity;
      for (const ex of sc.exchanges) {
        if (typeof ex.lat !== 'number' || typeof ex.lng !== 'number') continue;
        const dLat = ex.lat - lat;
        const dLng = ex.lng - lng;
        const d = dLat * dLat + dLng * dLng;
        if (d < bestD) { bestD = d; best = ex; }
      }
      return best ? { code: best.code || best.name || '', distance: Math.sqrt(bestD) } : null;
    }

    function utcLabel() {
      const d = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      return `UTC ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
    }

    function update(x, y) {
      if (!armed) return;
      lineH.style.top  = y + 'px';
      lineV.style.left = x + 'px';
      rLat.style.top  = (y - 22) + 'px';
      rLng.style.left = (x + 12) + 'px';
      const ll = computeLatLng(x, y);
      if (ll) {
        rLat.textContent = `LAT ${ll.lat.toFixed(2)}°${ll.lat >= 0 ? 'N' : 'S'}`;
        rLng.textContent = `LNG ${Math.abs(ll.lng).toFixed(2)}°${ll.lng >= 0 ? 'E' : 'W'}`;
        rUtc.textContent = utcLabel();
        const near = nearestExchange(ll.lat, ll.lng);
        rNear.textContent = near ? `NEAREST ${near.code}` : 'NEAREST —';
      }
    }

    let lastX = 0, lastY = 0;
    document.addEventListener('mousemove', (e) => {
      lastX = e.clientX; lastY = e.clientY;
      if (armed) update(lastX, lastY);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Shift' && !shiftDown) {
        shiftDown = true;
        armed = true;
        overlay.classList.add('is-armed');
        update(lastX, lastY);
      }
    });
    document.addEventListener('keyup', (e) => {
      if (e.key === 'Shift') {
        shiftDown = false;
        armed = false;
        overlay.classList.remove('is-armed');
      }
    });
    // Release on blur — prevents stuck crosshair if tab-switched while held
    window.addEventListener('blur', () => {
      shiftDown = false;
      armed = false;
      overlay.classList.remove('is-armed');
    });
  }

  // ── D6 · Topbar sparklines replacing raw counters ──────────────────────
  // Prepends a micro 48x14 SVG sparkline to each .tb-metric using a
  // deterministic 12-point curve derived from the metric's current value.
  // Re-renders on data change via MutationObserver on the [data-slot] span.
  function makeSparkline(key, currentStr) {
    // Deterministic seed per metric key + value → 12 points
    let seed = 0;
    const src = key + '::' + currentStr;
    for (let i = 0; i < src.length; i++) seed = (seed * 31 + src.charCodeAt(i)) >>> 0;
    function rnd() {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return (seed & 0xffff) / 0xffff;
    }
    const pts = [];
    let v = 0.4 + rnd() * 0.2;
    for (let i = 0; i < 12; i++) {
      v += (rnd() - 0.5) * 0.22;
      v = Math.max(0.08, Math.min(0.92, v));
      pts.push(v);
    }
    // Last point anchors near the "current" reading (visual continuity)
    const parsed = parseFloat((currentStr || '0').replace(/[^\d.-]/g, ''));
    if (!isNaN(parsed) && parsed > 0) pts[11] = 0.78;
    const w = 48, h = 14;
    const poly = pts.map((p, i) => {
      const x = (i / 11) * (w - 2) + 1;
      const y = h - p * (h - 2) - 1;
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    return ''
      + '<svg class="w5-sparkline" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" aria-hidden="true">'
      + '<polyline fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" points="' + poly + '"/>'
      + '</svg>';
  }

  function hydrateSparklines() {
    const metrics = document.querySelectorAll('.tb-metric');
    metrics.forEach((m) => {
      if (m.querySelector('.w5-sparkline-wrap')) return;
      const key = m.getAttribute('data-metric') || '';
      const slot = m.querySelector('[data-slot]');
      const value = slot ? slot.textContent : '';
      const wrap = document.createElement('span');
      wrap.className = 'w5-sparkline-wrap';
      wrap.innerHTML = makeSparkline(key, value);
      // Insert before the label (tb-k) so layout is: [spark] [k] [v]
      m.insertBefore(wrap, m.firstChild);
      if (slot) {
        const mo = new MutationObserver(() => {
          wrap.innerHTML = makeSparkline(key, slot.textContent || '');
        });
        mo.observe(slot, { childList: true, characterData: true, subtree: true });
      }
    });
  }

  function boot() {
    armCrosshair();
    hydrateSparklines();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
