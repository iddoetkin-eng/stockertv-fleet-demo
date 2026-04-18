/* ==========================================================================
   Wave 5 — Wow moments (F1 Market Open Ceremony, F1b minor bell flash,
   F3 letter-flight cold open).
   ========================================================================== */
(function(){
  'use strict';

  const reducedMotionMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  const shouldAnimate = () => !reducedMotionMQ.matches;

  // ── F1 · Market Open Ceremony ──────────────────────────────────────────
  // Polls every 2s while on the fleet page. If ExchangeSchedule.recentTransition
  // reports any major-exchange open event in the last 2s, fires the full
  // ceremony. If a close event or minor-exchange event, fires F1b quick flash.
  const MAJOR_EXCHANGES = ['NYSE', 'NASDAQ', 'LSE', 'HKEX', 'TSE'];

  function makeOverlay() {
    const el = document.createElement('div');
    el.className = 'w5-ceremony';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML =
        '<div class="w5-ceremony-scrim"></div>'
      + '<div class="w5-ceremony-content">'
      +   '<div class="w5-ceremony-eyebrow"></div>'
      +   '<div class="w5-ceremony-masthead"></div>'
      +   '<div class="w5-ceremony-sub"></div>'
      + '</div>';
    document.body.appendChild(el);
    return {
      root:  el,
      eye:   el.querySelector('.w5-ceremony-eyebrow'),
      mast:  el.querySelector('.w5-ceremony-masthead'),
      sub:   el.querySelector('.w5-ceremony-sub')
    };
  }

  function makeFlash() {
    const el = document.createElement('div');
    el.className = 'w5-bell-flash';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<span class="w5-bell-flash-label"></span>';
    document.body.appendChild(el);
    return { root: el, label: el.querySelector('.w5-bell-flash-label') };
  }

  function typeText(el, text, speed) {
    speed = speed || 32;
    return new Promise((resolve) => {
      el.textContent = '';
      let i = 0;
      const tick = () => {
        if (i < text.length) { el.textContent = text.slice(0, ++i); setTimeout(tick, speed); }
        else resolve();
      };
      tick();
    });
  }

  async function playCeremony(ev, overlay) {
    if (!overlay || !shouldAnimate()) {
      // Reduced motion: collapse to 900ms simple fade
      const o = overlay || makeOverlay();
      o.root.classList.add('is-reduced');
      o.eye.textContent  = ev.type === 'open' ? 'MARKET OPEN' : 'MARKET CLOSE';
      o.mast.textContent = ev.code + ' · ' + ev.city;
      o.sub.textContent  = window.ExchangeSchedule?.ceremonyTimeLabel(ev.code) || '';
      o.root.classList.add('is-active');
      await new Promise(r => setTimeout(r, 900));
      o.root.classList.remove('is-active', 'is-reduced');
      return;
    }
    overlay.root.classList.add('is-active');
    const timeLabel = window.ExchangeSchedule?.ceremonyTimeLabel(ev.code) || '';
    const eyebrowText = (ev.type === 'open' ? 'OPENING' : 'CLOSING') + ' · ' + timeLabel + ' · ' + ev.code;
    overlay.eye.textContent = eyebrowText;
    overlay.sub.textContent = ev.type === 'open'
      ? 'All systems synchronized with local trading hours.'
      : 'Session concluded. Settlements posting.';
    // Ring the exchange-specific bell
    try { window.SoundFX?.playBellVoice?.(ev.bellVoice); } catch {}
    await typeText(overlay.mast, ev.city, 78);
    // Hold masthead for 1.4s
    await new Promise(r => setTimeout(r, 1400));
    overlay.root.classList.remove('is-active');
    // Clear after exit transition
    setTimeout(() => { overlay.mast.textContent = ''; }, 600);
  }

  async function playMinorFlash(ev, flash) {
    if (!flash || !shouldAnimate()) return;
    flash.label.textContent = (ev.type === 'open' ? 'OPEN · ' : 'CLOSE · ') + ev.code;
    flash.root.classList.add('is-active');
    try { window.SoundFX?.playTick?.(); } catch {}
    setTimeout(() => flash.root.classList.remove('is-active'), 700);
  }

  function armCeremonyWatcher() {
    if (!window.ExchangeSchedule) return;
    const overlay = makeOverlay();
    const flash   = makeFlash();

    const codes = window.ExchangeSchedule.listCodes ? window.ExchangeSchedule.listCodes() : MAJOR_EXCHANGES;
    const pollMs = 2000;
    setInterval(() => {
      for (const code of codes) {
        const ev = window.ExchangeSchedule.recentTransition(code, new Date(), pollMs);
        if (!ev) continue;
        if (MAJOR_EXCHANGES.includes(code)) {
          playCeremony(ev, overlay);
        } else {
          playMinorFlash(ev, flash);
        }
        break; // one ceremony per poll
      }
    }, pollMs);
  }

  // Expose a manual trigger so sales demos can force-fire the ceremony.
  // Usage: SoundFX.init(); Wave5.triggerCeremony('NYSE', 'open');
  window.Wave5 = window.Wave5 || {};
  window.Wave5.triggerCeremony = function(code, type) {
    if (!window.ExchangeSchedule) return;
    const info = window.ExchangeSchedule.info(code);
    if (!info) return;
    const ev = { type: type || 'open', code, name: info.name, city: info.city, bellVoice: info.bellVoice, at: new Date() };
    if (MAJOR_EXCHANGES.includes(code)) playCeremony(ev, makeOverlay());
    else playMinorFlash(ev, makeFlash());
  };

  // ── F3 · Letter-flight cold open ────────────────────────────────────────
  // Splits the splash headline's accent line ("becomes broadcast.") into
  // individual letters and animates each one in from a random viewport
  // origin mapped to a real exchange lat/lng, landing with Fraunces
  // variable-font opsz 9→144 + wght 400→700 interpolation as it arrives.
  function armLetterFlightColdOpen() {
    if (!shouldAnimate()) return;
    const splash = document.getElementById('splash');
    if (!splash) return;
    const accentLine = splash.querySelector('.splash-headline-line--accent');
    if (!accentLine || accentLine.dataset.w5Letterflight === '1') return;
    accentLine.dataset.w5Letterflight = '1';

    // Preserve the existing <em> wrapping the accent word; we split each text
    // node into per-character spans but keep DOM nesting.
    const walk = (node) => {
      if (node.nodeType === 3) {
        // text node
        const txt = node.textContent;
        const frag = document.createDocumentFragment();
        for (let i = 0; i < txt.length; i++) {
          const ch = txt[i];
          if (ch === ' ') {
            frag.appendChild(document.createTextNode(' '));
            continue;
          }
          const span = document.createElement('span');
          span.className = 'w5-lf-letter';
          span.textContent = ch;
          frag.appendChild(span);
        }
        node.parentNode.replaceChild(frag, node);
      } else if (node.nodeType === 1) {
        Array.from(node.childNodes).forEach(walk);
      }
    };
    walk(accentLine);

    // Viewport-anchored exchange origin offsets — each letter picks one
    const ORIGINS = [
      { x: '12vw',  y: '8vh'  }, // Tokyo (top-left)
      { x: '88vw',  y: '14vh' }, // New York (top-right)
      { x: '8vw',   y: '82vh' }, // São Paulo (bottom-left)
      { x: '92vw',  y: '78vh' }, // Frankfurt (bottom-right)
      { x: '45vw',  y: '4vh'  }, // London (top-center)
      { x: '96vw',  y: '52vh' }, // Hong Kong (mid-right)
      { x: '4vw',   y: '48vh' }  // Johannesburg (mid-left)
    ];

    const letters = accentLine.querySelectorAll('.w5-lf-letter');
    letters.forEach((el, i) => {
      const origin = ORIGINS[(i * 7 + 3) % ORIGINS.length];
      el.style.setProperty('--w5-lf-from-x', origin.x);
      el.style.setProperty('--w5-lf-from-y', origin.y);
      el.style.setProperty('--w5-lf-delay', (900 + i * 55) + 'ms');
      el.classList.add('w5-lf-flying');
      // Trigger rustle on first letter landing for tactile feel
      if (i === 0) {
        setTimeout(() => { try { window.SoundFX?.playRustle?.(); } catch {} }, 1000);
      }
    });
  }

  function boot() {
    armCeremonyWatcher();
    armLetterFlightColdOpen();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
