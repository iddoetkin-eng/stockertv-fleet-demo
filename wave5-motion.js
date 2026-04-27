/* ==========================================================================
   Wave 5 — Motion module (B1 curator, B2 magnetic dots, B6 elastic, B7 shimmer)
   All motion routes through shouldAnimate() → honors prefers-reduced-motion.
   ========================================================================== */
(function(){
  'use strict';

  const reducedMotionMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  const shouldAnimate = () => !reducedMotionMQ.matches;

  // ── B1 · Curator idle mode ─────────────────────────────────────────────
  // After 45s of no mouse/kb activity, fade in a Fraunces pull-quote overlay
  // and slowly orbit the map. Disarms within 200ms on any activity.
  const CURATOR_QUOTES = [
    { text: "Every story passes through the eye of the needle.",    attr: "Editorial note" },
    { text: "The market is always news. We are always listening.",  attr: "Editorial note" },
    { text: "Broadcast is the last mile. Accuracy is the first.",   attr: "Editorial note" },
    { text: "53 exchanges. One newsroom. No approximation.",        attr: "Editorial note" },
    { text: "Integrity is not a gate. It is a craft.",              attr: "Editorial note" }
  ];

  function armCurator() {
    // Only arm on fleet page where map exists
    const map = document.getElementById('map-svg');
    if (!map) return;

    const overlay = document.createElement('div');
    overlay.className = 'w5-curator';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = '<div class="w5-curator-quote"><span class="w5-curator-mark">&ldquo;</span><span class="w5-curator-text">—</span><span class="w5-curator-attr">—</span></div>';
    document.body.appendChild(overlay);
    const textEl = overlay.querySelector('.w5-curator-text');
    const attrEl = overlay.querySelector('.w5-curator-attr');

    let idleTimer = null;
    let armed = false;
    let quoteIdx = 0;
    let rotateTimer = null;

    function rotateQuote() {
      const q = CURATOR_QUOTES[quoteIdx % CURATOR_QUOTES.length];
      textEl.textContent = q.text;
      attrEl.textContent = q.attr;
      quoteIdx++;
    }

    function enter() {
      if (armed || !shouldAnimate()) return;
      armed = true;
      rotateQuote();
      overlay.classList.add('is-active');
      document.documentElement.classList.add('w5-curator-active');
      rotateTimer = setInterval(() => {
        overlay.classList.remove('is-active');
        setTimeout(() => { rotateQuote(); overlay.classList.add('is-active'); }, 600);
      }, 9000);
    }

    function exit() {
      if (!armed) return;
      armed = false;
      overlay.classList.remove('is-active');
      document.documentElement.classList.remove('w5-curator-active');
      if (rotateTimer) { clearInterval(rotateTimer); rotateTimer = null; }
    }

    function resetIdle() {
      if (idleTimer) clearTimeout(idleTimer);
      exit();
      idleTimer = setTimeout(enter, 45000);
    }

    ['mousemove','keydown','click','scroll','touchstart'].forEach((ev) => {
      document.addEventListener(ev, resetIdle, { passive: true });
    });
    resetIdle();
  }

  // ── B6 · Elastic modal close ───────────────────────────────────────────
  // Applied to .drill-modal and any .stage-modal — adds .w5-elastic-close
  // class on close, letting CSS drive the overshoot.
  function armElasticClose() {
    const modals = document.querySelectorAll('.drill-modal, .stage-modal, .avatar-modal');
    modals.forEach((m) => {
      const mo = new MutationObserver((mutations) => {
        for (const rec of mutations) {
          if (rec.attributeName === 'hidden') {
            if (m.hasAttribute('hidden')) {
              m.classList.remove('w5-elastic-opening');
              m.classList.add('w5-elastic-closing');
              setTimeout(() => m.classList.remove('w5-elastic-closing'), 280);
            } else {
              m.classList.add('w5-elastic-opening');
            }
          }
        }
      });
      mo.observe(m, { attributes: true, attributeFilter: ['hidden'] });
    });
  }

  // ── B7 · Metric shimmer on update ──────────────────────────────────────
  // When a [data-slot] inside .tb-metric changes, apply .w5-shimmer for 140ms.
  function armMetricShimmer() {
    const slots = document.querySelectorAll('.tb-metric [data-slot]');
    slots.forEach((slot) => {
      let last = slot.textContent;
      const mo = new MutationObserver(() => {
        const next = slot.textContent;
        if (next !== last && shouldAnimate()) {
          slot.classList.add('w5-shimmer');
          setTimeout(() => slot.classList.remove('w5-shimmer'), 140);
          last = next;
        }
      });
      mo.observe(slot, { childList: true, characterData: true, subtree: true });
    });
  }

  function boot() {
    armCurator();
    armElasticClose();
    armMetricShimmer();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
