/* ==========================================================================
   Wave 5 — Typography module (C1, C3, C5)
   Handles DOM-level insertions for editorial type moments. Pure CSS drives
   C2 (compliance hero upscale), C4 (ticker watermark), C7 (fact pull-out
   class toggle). C6 (specimen) is its own page.
   ========================================================================== */
(function(){
  'use strict';

  const reducedMotionMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  const shouldAnimate = () => !reducedMotionMQ.matches;

  // ── C1 · Pull-quotes between stages 5/6 and 10/11 ─────────────────────
  // Scroll-triggered 800ms crossfade. Two quotes total (trimmed from 3 in
  // conflict resolution). Only injected on pages that have .stage elements.
  const PULLQUOTES = [
    {
      afterStage: 5,
      text: 'Every story passes through the eye of the needle.',
      attribution: 'Editorial note · Stage 06 / Cross-reference'
    },
    {
      afterStage: 10,
      text: 'No story leaves the newsroom unchecked. Twice.',
      attribution: 'Editorial note · Stage 11 / Compliance red pass'
    }
  ];

  function injectPullQuotes() {
    PULLQUOTES.forEach((q) => {
      const stageEl = document.querySelector(`.stage[data-stage="${q.afterStage}"]`);
      if (!stageEl || stageEl.nextElementSibling?.classList.contains('w5-pullquote')) return;
      const section = document.createElement('section');
      section.className = 'w5-pullquote';
      section.setAttribute('aria-hidden', 'true');
      section.innerHTML =
        '<blockquote class="w5-pullquote-body">'
        + '<span class="w5-pullquote-mark" aria-hidden="true">&ldquo;</span>'
        + '<span class="w5-pullquote-text">' + q.text + '</span>'
        + '<span class="w5-pullquote-attribution">' + q.attribution + '</span>'
        + '</blockquote>';
      stageEl.parentNode.insertBefore(section, stageEl.nextSibling);
    });

    // Scroll-reveal via IntersectionObserver
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('.w5-pullquote').forEach(el => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.35 });
    document.querySelectorAll('.w5-pullquote').forEach(el => io.observe(el));
  }

  // ── C5 · Issue/stage mastheads on every pipeline stage ────────────────
  // Inserts a three-line lockup below the stage-header:
  //   ISSUE №xxxx · VOL II            (Fraunces italic, 11pt)
  //   STAGE 04 / FACT EXTRACTION      (Inter caps, 13pt)
  //   2026-04-18 · 14:22:07 UTC       (JetBrains Mono, 10pt)
  function issueNumber(date) {
    // Day-of-year based issue number for deterministic daily numbering
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = (date - start) + ((start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000);
    const oneDay = 1000 * 60 * 60 * 24;
    const doy = Math.floor(diff / oneDay);
    return String(doy).padStart(4, '0');
  }

  function formatUTC(date) {
    const pad = (n) => String(n).padStart(2, '0');
    const d = `${date.getUTCFullYear()}-${pad(date.getUTCMonth()+1)}-${pad(date.getUTCDate())}`;
    const t = `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
    return `${d} · ${t} UTC`;
  }

  function injectStageMastheads() {
    const stages = document.querySelectorAll('.stage[data-stage]');
    if (!stages.length) return;
    const now = new Date();
    const issue = issueNumber(now);
    const timestampStr = formatUTC(now);
    stages.forEach((sec) => {
      const num = sec.getAttribute('data-stage');
      const name = (sec.querySelector('.stage-title')?.textContent || '').trim().toUpperCase();
      const header = sec.querySelector('.stage-header');
      if (!header || header.nextElementSibling?.classList.contains('w5-stage-masthead')) return;
      const m = document.createElement('div');
      m.className = 'w5-stage-masthead';
      m.setAttribute('aria-hidden', 'true');
      m.innerHTML =
          '<span class="w5-sm-issue">Issue №' + issue + ' · Vol II</span>'
        + '<span class="w5-sm-rule" aria-hidden="true"></span>'
        + '<span class="w5-sm-stage">Stage ' + String(num).padStart(2, '0') + ' / ' + name + '</span>'
        + '<span class="w5-sm-rule" aria-hidden="true"></span>'
        + '<span class="w5-sm-time">' + timestampStr + '</span>';
      header.parentNode.insertBefore(m, header.nextSibling);
    });
  }

  // ── C3 · Drop-cap in drill modal ──────────────────────────────────────
  // Observes the drill modal for its "hidden" attribute. When it opens,
  // injects a drop-cap into the first paragraph of the drill-modal-stage
  // subject text. Idempotent per open.
  function hookDrillModalDropcap() {
    const modal = document.getElementById('drill-modal');
    if (!modal) return;
    const applyDropcap = () => {
      const stageBox = document.getElementById('drill-modal-stage');
      if (!stageBox) return;
      // Find the first text-bearing element likely to carry an article lead
      const candidates = stageBox.querySelectorAll('p, .drill-lead, [data-slot="lead"]');
      candidates.forEach((el) => {
        if (el.classList.contains('w5-has-dropcap')) return;
        const text = (el.textContent || '').trim();
        if (text.length < 40) return;
        const first = text.charAt(0);
        const rest = text.slice(1);
        el.classList.add('w5-has-dropcap');
        el.innerHTML = '<span class="w5-dropcap" aria-hidden="true">' + first + '</span>' + rest;
      });
    };
    const mo = new MutationObserver(() => {
      if (!modal.hidden) {
        // Small defer so drill-modal-stage has rendered its subject content
        setTimeout(applyDropcap, 40);
      }
    });
    mo.observe(modal, { attributes: true, attributeFilter: ['hidden'] });
  }

  // ── C2 · Compliance hero upscale — wires into stage 12 run ────────────
  // Adds .w5-hero-mode to stage 12 when its dual-reveal becomes visible, so
  // CSS can scale the compliance number to ~240pt for 2.2s before returning.
  function hookComplianceHero() {
    const stage12 = document.querySelector('.stage[data-stage="12"]');
    if (!stage12) return;
    const dual = stage12.querySelector('#dual-reveal, .dual-reveal');
    if (!dual) return;
    if (!shouldAnimate()) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && !stage12.classList.contains('w5-hero-mode')) {
          // Trigger after the normal count-up has landed (~3.6s into stage)
          setTimeout(() => {
            stage12.classList.add('w5-hero-mode');
            setTimeout(() => stage12.classList.remove('w5-hero-mode'), 2200);
          }, 3600);
          io.disconnect();
        }
      });
    }, { threshold: 0.4 });
    io.observe(dual);
  }

  function boot() {
    injectPullQuotes();
    injectStageMastheads();
    hookDrillModalDropcap();
    hookComplianceHero();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.W5_TYPOGRAPHY = { issueNumber, formatUTC };
})();
