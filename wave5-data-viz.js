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

  function boot() {
    armCrosshair();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
