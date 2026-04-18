/* ==========================================================================
   Wave 5 — Iconography library (A1, A2, A3, A4)
   All glyphs are stroke-based inline SVG using currentColor so they inherit
   their color from the parent text context (theme-aware automatically).
   Injected into DOM by fleet.js + pipeline.js on boot.
   ========================================================================== */
(function(){
  'use strict';

  const SVG_OPEN  = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  const SVG_CLOSE = '</svg>';

  // ── A1: 15 pipeline stage glyphs ───────────────────────────────────────
  // Monochrome editorial marks. Each communicates the stage concept with as
  // few strokes as possible. 1.25pt strokes, rounded caps. Fraunces-flavored
  // terminals where the geometry permits (tiny flares on stroke ends).

  const STAGE_GLYPHS = {
    // 01 · Article Input — document with corner fold + text rules
    1: SVG_OPEN
      + '<path d="M6 3h9l4 4v14H6z"/>'
      + '<path d="M15 3v4h4"/>'
      + '<line x1="9" y1="12" x2="16" y2="12"/>'
      + '<line x1="9" y1="15" x2="14" y2="15"/>'
      + '<line x1="9" y1="18" x2="13" y2="18"/>'
      + SVG_CLOSE,

    // 02 · Story Detection — radar sweep, concentric arcs
    2: SVG_OPEN
      + '<circle cx="12" cy="12" r="8.5"/>'
      + '<path d="M12 12 L18 8"/>'
      + '<path d="M12 12 m-5 0 a5 5 0 0 1 10 0" opacity="0.55"/>'
      + '<circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/>'
      + SVG_CLOSE,

    // 03 · Company Enrichment — layered tower / market hierarchy
    3: SVG_OPEN
      + '<rect x="4"  y="14" width="4.5" height="6"/>'
      + '<rect x="9.75" y="10" width="4.5" height="10"/>'
      + '<rect x="15.5" y="6" width="4.5" height="14"/>'
      + '<line x1="3" y1="20.5" x2="21" y2="20.5"/>'
      + SVG_CLOSE,

    // 04 · Fact Extraction — bracketed span with extracted dot
    4: SVG_OPEN
      + '<path d="M7 6 L4 6 L4 18 L7 18"/>'
      + '<path d="M17 6 L20 6 L20 18 L17 18"/>'
      + '<line x1="8.5" y1="12" x2="15.5" y2="12"/>'
      + '<circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>'
      + SVG_CLOSE,

    // 05 · SEC EDGAR Validation — shield with check
    5: SVG_OPEN
      + '<path d="M12 3 L20 6 V12.5 C20 17 16.2 19.7 12 21 C7.8 19.7 4 17 4 12.5 V6 Z"/>'
      + '<path d="M8.5 12.5 L11 15 L16 10"/>'
      + SVG_CLOSE,

    // 06 · Cross-Reference — interlocking links
    6: SVG_OPEN
      + '<path d="M9 8 a4 4 0 1 0 0 8 h2"/>'
      + '<path d="M15 16 a4 4 0 1 0 0 -8 h-2"/>'
      + '<line x1="9" y1="12" x2="15" y2="12"/>'
      + SVG_CLOSE,

    // 07 · Reporter Selection — microphone with signal
    7: SVG_OPEN
      + '<rect x="9.5" y="3.5" width="5" height="10" rx="2.5"/>'
      + '<path d="M6 12 a6 6 0 0 0 12 0"/>'
      + '<line x1="12" y1="18" x2="12" y2="21"/>'
      + '<line x1="9" y1="21" x2="15" y2="21"/>'
      + SVG_CLOSE,

    // 08 · Script Generation — flowing prose lines
    8: SVG_OPEN
      + '<path d="M4 7 C 8 5, 12 9, 16 7 S 20 5, 20 7"/>'
      + '<path d="M4 12 C 8 10, 12 14, 16 12 S 20 10, 20 12"/>'
      + '<path d="M4 17 C 8 15, 12 19, 16 17 S 20 15, 20 17"/>'
      + SVG_CLOSE,

    // 09 · Chart Suggestion — three bars, ascending
    9: SVG_OPEN
      + '<line x1="3" y1="20" x2="21" y2="20"/>'
      + '<rect x="5"    y="14" width="4" height="6"/>'
      + '<rect x="10"   y="10" width="4" height="10"/>'
      + '<rect x="15"   y="5"  width="4" height="15"/>'
      + SVG_CLOSE,

    // 10 · Thumbnail Generation — frame with play triangle
    10: SVG_OPEN
      + '<rect x="3" y="5" width="18" height="14" rx="1.5"/>'
      + '<path d="M10 9 L16 12 L10 15 Z" fill="currentColor" stroke="none"/>'
      + SVG_CLOSE,

    // 11 · Compliance Red Pass — exclamation inside marker diamond
    11: SVG_OPEN
      + '<path d="M12 3 L21 12 L12 21 L3 12 Z"/>'
      + '<line x1="12" y1="8"  x2="12" y2="13.2"/>'
      + '<circle cx="12" cy="16" r="1" fill="currentColor" stroke="none"/>'
      + SVG_CLOSE,

    // 12 · Compliance Gates — three horizontal gate-lines with check
    12: SVG_OPEN
      + '<path d="M4 7 L20 7"/>'
      + '<path d="M4 12 L20 12"/>'
      + '<path d="M4 17 L20 17"/>'
      + '<path d="M7.5 12 L10.5 15 L16.5 9" stroke-width="1.5"/>'
      + SVG_CLOSE,

    // 13 · Multi-Language — globe with meridians
    13: SVG_OPEN
      + '<circle cx="12" cy="12" r="8.5"/>'
      + '<ellipse cx="12" cy="12" rx="4" ry="8.5"/>'
      + '<line x1="3.5" y1="12" x2="20.5" y2="12"/>'
      + SVG_CLOSE,

    // 14 · Audit Trail — notary stamp with radiating strokes
    14: SVG_OPEN
      + '<circle cx="12" cy="11" r="5"/>'
      + '<path d="M9.5 11 L11.2 12.7 L14.5 9.5"/>'
      + '<line x1="12" y1="19" x2="12" y2="21"/>'
      + '<line x1="7" y1="20" x2="17" y2="20"/>'
      + SVG_CLOSE,

    // 15 · Final Output — editorial star / seal
    15: SVG_OPEN
      + '<circle cx="12" cy="12" r="8.5"/>'
      + '<path d="M12 7.5 L13.4 10.8 L17 11.1 L14.2 13.5 L15.1 17 L12 15.1 L8.9 17 L9.8 13.5 L7 11.1 L10.6 10.8 Z"/>'
      + SVG_CLOSE
  };

  // ── A3: Five reporter monograms, one per reporter, each with a framing
  // device. Used in drill modal byline, feed items, stage 7 reporter pick.
  // Fill uses the reporter's token color; framing uses currentColor for
  // theme awareness.

  const REPORTER_MARKS = {
    gerardo: // oval frame
      '<svg class="w5-reporter-mark" viewBox="0 0 36 28" width="36" height="28" aria-hidden="true">'
      + '<ellipse cx="18" cy="14" rx="15" ry="11.5" fill="none" stroke="currentColor" stroke-width="0.75" opacity="0.55"/>'
      + '<text x="18" y="19" text-anchor="middle" font-family="Fraunces, serif" font-weight="500" font-size="15" font-style="italic" fill="var(--reporter-gerardo)" font-variation-settings="\'opsz\' 24">G</text>'
      + '</svg>',
    liam: // diamond frame
      '<svg class="w5-reporter-mark" viewBox="0 0 36 28" width="36" height="28" aria-hidden="true">'
      + '<path d="M18 2 L34 14 L18 26 L2 14 Z" fill="none" stroke="currentColor" stroke-width="0.75" opacity="0.55"/>'
      + '<text x="18" y="19" text-anchor="middle" font-family="Fraunces, serif" font-weight="500" font-size="15" font-style="italic" fill="var(--reporter-liam)" font-variation-settings="\'opsz\' 24">L</text>'
      + '</svg>',
    annie: // lozenge / elongated oval frame
      '<svg class="w5-reporter-mark" viewBox="0 0 36 28" width="36" height="28" aria-hidden="true">'
      + '<rect x="3" y="6" width="30" height="16" rx="8" fill="none" stroke="currentColor" stroke-width="0.75" opacity="0.55"/>'
      + '<text x="18" y="19" text-anchor="middle" font-family="Fraunces, serif" font-weight="500" font-size="15" font-style="italic" fill="var(--reporter-annie)" font-variation-settings="\'opsz\' 24">A</text>'
      + '</svg>',
    sophia: // hexagon frame
      '<svg class="w5-reporter-mark" viewBox="0 0 36 28" width="36" height="28" aria-hidden="true">'
      + '<path d="M10 3 H26 L33 14 L26 25 H10 L3 14 Z" fill="none" stroke="currentColor" stroke-width="0.75" opacity="0.55"/>'
      + '<text x="18" y="19" text-anchor="middle" font-family="Fraunces, serif" font-weight="500" font-size="15" font-style="italic" fill="var(--reporter-sophia)" font-variation-settings="\'opsz\' 24">S</text>'
      + '</svg>',
    maya: // circle frame
      '<svg class="w5-reporter-mark" viewBox="0 0 36 28" width="36" height="28" aria-hidden="true">'
      + '<circle cx="18" cy="14" r="12" fill="none" stroke="currentColor" stroke-width="0.75" opacity="0.55"/>'
      + '<text x="18" y="19" text-anchor="middle" font-family="Fraunces, serif" font-weight="500" font-size="15" font-style="italic" fill="var(--reporter-maya)" font-variation-settings="\'opsz\' 24">M</text>'
      + '</svg>'
  };

  // ── A4: Regional dingbats — tiny Fraunces italic glyphs placed at each
  // continental arc's apex on the world map. 5 characters sit in the regional
  // color at low opacity. Consumed by fleet.js map-render code.
  const REGIONAL_DINGBATS = {
    NA:    { glyph: '§',  color: '#4a9eff' },
    EU:    { glyph: '¶',  color: '#22c55e' },
    APAC:  { glyph: '※',  color: '#f59e0b' },
    LATAM: { glyph: '⁂',  color: '#ec4899' },
    MEA:   { glyph: '◆',  color: '#a855f7' }
  };

  // Public API
  window.W5_GLYPHS = {
    stage:   STAGE_GLYPHS,
    reporter: REPORTER_MARKS,
    region:   REGIONAL_DINGBATS
  };

  // Auto-inject stage glyphs into pipeline.html's stage headers on DOM ready.
  // Fleet page doesn't have .stage elements, so this is a no-op there.
  function injectStageGlyphs() {
    const stages = document.querySelectorAll('.stage[data-stage]');
    stages.forEach((sec) => {
      const num = parseInt(sec.getAttribute('data-stage'), 10);
      const glyph = STAGE_GLYPHS[num];
      if (!glyph) return;
      const header = sec.querySelector('.stage-header');
      if (!header || header.querySelector('.w5-stage-glyph')) return;
      const title = header.querySelector('.stage-title');
      if (!title) return;
      const span = document.createElement('span');
      span.className = 'w5-stage-glyph';
      span.setAttribute('aria-hidden', 'true');
      span.innerHTML = glyph;
      header.insertBefore(span, title);
    });
  }

  // On DOM ready, inject stage glyphs.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectStageGlyphs);
  } else {
    injectStageGlyphs();
  }

  window.W5_GLYPHS.injectStageGlyphs = injectStageGlyphs;
})();
