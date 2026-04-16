/* ──────────────────────────────────────────────────────────────────────────
   Shared SoundFX — procedurally generated UI sounds via Web Audio API

   Loaded by both /demo/pipeline and /demo/fleet. Exposes `window.SoundFX`.
   Premium-feeling UI tones (Linear/Stripe tier, not arcade). All synthesized
   with ADSR envelopes so there are no clicks/pops. Respects a localStorage
   mute preference and the browser's user-gesture requirement (lazy init).

   Master volume is mutable — pipeline calls setMasterVolume(0.3); fleet
   calls setMasterVolume(0.15) because its sounds are more frequent.
   ────────────────────────────────────────────────────────────────────────── */

(function (global) {
  "use strict";

  const KEY = "stv-sound-muted";
  let ctx = null, master = null, initialized = false;
  let masterVolume = 0.3;
  let muted = (typeof localStorage !== "undefined" && localStorage.getItem(KEY) === "1");

  function init() {
    if (initialized) return;
    try {
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = masterVolume;
      master.connect(ctx.destination);
      initialized = true;
    } catch { /* audio unsupported — silently skip */ }
  }
  function resumeIfNeeded() {
    if (!ctx) return;
    if (ctx.state === "suspended") {
      try { ctx.resume(); } catch {}
    }
  }
  function canPlay() { return initialized && !!ctx && !muted; }

  function setMuted(m) {
    muted = !!m;
    try { localStorage.setItem(KEY, muted ? "1" : "0"); } catch {}
  }
  function toggleMuted() { setMuted(!muted); return muted; }
  function isMuted() { return muted; }

  function setMasterVolume(v) {
    masterVolume = Math.max(0, Math.min(1, Number(v) || 0));
    if (master) master.gain.value = masterVolume;
  }

  function env(gainNode, t, { attack = 0.005, peak = 0.2, hold = 0, decay = 0.06 }) {
    gainNode.gain.setValueAtTime(0, t);
    gainNode.gain.linearRampToValueAtTime(peak, t + attack);
    if (hold > 0) gainNode.gain.setValueAtTime(peak, t + attack + hold);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + decay);
  }

  // ── 1. click — quick 800Hz blip, 50ms ──────────────────────────────────
  function playClick() {
    if (!canPlay()) return;
    resumeIfNeeded();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 800;
    env(g, t, { attack: 0.005, peak: 0.22, decay: 0.05 });
    osc.connect(g).connect(master);
    osc.start(t); osc.stop(t + 0.08);
  }

  // ── 2. tick — subtle 1200Hz, 30ms, very quiet ──────────────────────────
  function playTick() {
    if (!canPlay()) return;
    resumeIfNeeded();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 1200;
    env(g, t, { attack: 0.003, peak: 0.07, decay: 0.03 });
    osc.connect(g).connect(master);
    osc.start(t); osc.stop(t + 0.05);
  }

  // ── 3. checkmark — pleasant rising chirp 600→900Hz, 80ms ───────────────
  function playCheckmark() {
    if (!canPlay()) return;
    resumeIfNeeded();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.08);
    env(g, t, { attack: 0.008, peak: 0.18, decay: 0.08 });
    osc.connect(g).connect(master);
    osc.start(t); osc.stop(t + 0.11);
  }

  // ── 4. error — 180Hz detuned square buzz, 200ms ────────────────────────
  function playError() {
    if (!canPlay()) return;
    resumeIfNeeded();
    const t = ctx.currentTime;
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g = ctx.createGain();
    o1.type = "square"; o2.type = "square";
    o1.frequency.value = 180; o2.frequency.value = 184; // ~4Hz beat
    env(g, t, { attack: 0.01, peak: 0.14, hold: 0.16, decay: 0.04 });
    o1.connect(g); o2.connect(g); g.connect(master);
    o1.start(t); o2.start(t);
    o1.stop(t + 0.22); o2.stop(t + 0.22);
  }

  // ── 5. gateOpen — upward sweep 300→800Hz, 300ms ────────────────────────
  function playGateOpen() {
    if (!canPlay()) return;
    resumeIfNeeded();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.3);
    env(g, t, { attack: 0.02, peak: 0.16, hold: 0.22, decay: 0.06 });
    osc.connect(g).connect(master);
    osc.start(t); osc.stop(t + 0.32);
  }

  // ── 6. success — C-E-G major chord chime, 400ms, bell-like ─────────────
  function playSuccess() {
    if (!canPlay()) return;
    resumeIfNeeded();
    const t = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    const g = ctx.createGain();
    env(g, t, { attack: 0.015, peak: 0.16, hold: 0.22, decay: 0.17 });
    g.connect(master);
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const voice = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      voice.gain.value = 1 / notes.length;
      osc.connect(voice).connect(g);
      osc.start(t + i * 0.025);
      osc.stop(t + 0.44);
    });
  }

  // ── 7. whoosh — filtered noise sweep, 100ms ────────────────────────────
  function playWhoosh() {
    if (!canPlay()) return;
    resumeIfNeeded();
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * 0.12);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 1.4;
    filter.frequency.setValueAtTime(200, t);
    filter.frequency.exponentialRampToValueAtTime(4000, t + 0.1);
    const g = ctx.createGain();
    env(g, t, { attack: 0.015, peak: 0.22, decay: 0.09 });
    src.connect(filter).connect(g).connect(master);
    src.start(t); src.stop(t + 0.13);
  }

  // ── 9. bell — 3-note descending G5→E5→C5 with long decay (~1.4s) ──────
  // For opening/closing bell moments on major exchanges. Gravitas over
  // sharp attack — each note overlaps the next by ~100ms for a chord feel.
  function playBell() {
    if (!canPlay()) return;
    resumeIfNeeded();
    const t = ctx.currentTime;
    const notes = [
      { f: 783.99, off: 0.00 },   // G5
      { f: 659.25, off: 0.18 },   // E5
      { f: 523.25, off: 0.36 },   // C5
    ];
    const g = ctx.createGain();
    env(g, t, { attack: 0.012, peak: 0.24, hold: 0.55, decay: 0.85 });
    g.connect(master);
    notes.forEach((n) => {
      const osc = ctx.createOscillator();
      const voice = ctx.createGain();
      voice.gain.value = 0.45;
      osc.type = "sine";
      osc.frequency.value = n.f;
      osc.connect(voice).connect(g);
      osc.start(t + n.off);
      osc.stop(t + n.off + 1.35);
    });
  }

  // ── 8. stamp — low 120Hz thud with quick decay, 150ms ──────────────────
  function playStamp() {
    if (!canPlay()) return;
    resumeIfNeeded();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.14);
    env(g, t, { attack: 0.003, peak: 0.38, decay: 0.15 });
    osc.connect(g).connect(master);
    osc.start(t); osc.stop(t + 0.17);
  }

  global.SoundFX = {
    init, isMuted, toggleMuted, setMuted, setMasterVolume,
    playClick, playTick, playCheckmark, playError,
    playGateOpen, playSuccess, playWhoosh, playStamp, playBell,
  };
})(window);
