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

  /* ──────────────────────────────────────────────────────────────────────
     Wave 5 · Batch 7 — Sound design additions
     E1 ident, E2 exchange bells, E3 room tone, E4 rustle, E5 stereo whoosh,
     E6 gallery bell. Built on the existing ctx/master/env primitives.
     ────────────────────────────────────────────────────────────────────── */

  // E1 · Three-note StockerTV ident — A3, E4, A4 ascending. Triangle wave
  // for warmth. Plays once per splash. Total ~380ms.
  function playIdent() {
    if (!canPlay()) return;
    resumeIfNeeded();
    const t = ctx.currentTime;
    const notes = [
      { f: 220.00, off: 0.00 }, // A3
      { f: 329.63, off: 0.12 }, // E4
      { f: 440.00, off: 0.24 }  // A4
    ];
    const bus = ctx.createGain();
    env(bus, t, { attack: 0.02, peak: 0.22, hold: 0.28, decay: 0.55 });
    bus.connect(master);
    notes.forEach((n, i) => {
      const osc = ctx.createOscillator();
      const voice = ctx.createGain();
      osc.type = i === 2 ? "triangle" : "sine";
      osc.frequency.value = n.f;
      voice.gain.value = 0.55 - i * 0.08;
      osc.connect(voice).connect(bus);
      osc.start(t + n.off);
      osc.stop(t + n.off + 0.9);
    });
  }

  // E2 · Exchange-specific bell timbres. Router → private voicings.
  function playBrassBell() {
    if (!canPlay()) return;
    resumeIfNeeded();
    const t = ctx.currentTime;
    const bus = ctx.createGain();
    env(bus, t, { attack: 0.008, peak: 0.26, hold: 0.3, decay: 1.1 });
    bus.connect(master);
    [1, 2, 3, 5].forEach((mult, i) => {
      const o = ctx.createOscillator();
      const vg = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 523.25 * mult;
      vg.gain.value = 0.45 / (i + 1);
      o.connect(vg).connect(bus);
      o.start(t); o.stop(t + 1.5);
    });
  }
  function playBigBenBell() {
    if (!canPlay()) return;
    resumeIfNeeded();
    const t = ctx.currentTime;
    const bus = ctx.createGain();
    env(bus, t, { attack: 0.012, peak: 0.28, hold: 0.6, decay: 1.3 });
    bus.connect(master);
    // Two-note Westminster-ish motif: G#4 → E4
    [{f:415.3, off:0.0},{f:329.63, off:0.5}].forEach((n)=>{
      const o = ctx.createOscillator(); const vg = ctx.createGain();
      o.type="sine"; o.frequency.value = n.f; vg.gain.value = 0.55;
      o.connect(vg).connect(bus);
      o.start(t + n.off); o.stop(t + n.off + 1.6);
    });
  }
  function playGongBell() {
    if (!canPlay()) return;
    resumeIfNeeded();
    const t = ctx.currentTime;
    const carrier = ctx.createOscillator();
    const modulator = ctx.createOscillator();
    const modGain = ctx.createGain();
    const voice = ctx.createGain();
    carrier.type = "sine"; modulator.type = "sine";
    carrier.frequency.value = 98; // G2 fundamental
    modulator.frequency.value = 98 * 1.414; // inharmonic ratio
    modGain.gain.value = 240; // deviation
    env(voice, t, { attack: 0.003, peak: 0.32, hold: 0.15, decay: 1.6 });
    modulator.connect(modGain).connect(carrier.frequency);
    carrier.connect(voice).connect(master);
    modulator.start(t); carrier.start(t);
    modulator.stop(t + 2); carrier.stop(t + 2);
  }
  function playCathedralBell() {
    if (!canPlay()) return;
    resumeIfNeeded();
    const t = ctx.currentTime;
    const bus = ctx.createGain();
    env(bus, t, { attack: 0.04, peak: 0.24, hold: 0.4, decay: 1.5 });
    bus.connect(master);
    // Fundamental + 5th + octave
    [{f:174.61, g:0.55},{f:261.63, g:0.32},{f:349.23, g:0.22}].forEach((n)=>{
      const o=ctx.createOscillator(); const vg=ctx.createGain();
      o.type="sine"; o.frequency.value=n.f; vg.gain.value=n.g;
      o.connect(vg).connect(bus);
      o.start(t); o.stop(t + 1.9);
    });
  }
  function playBellVoice(voice) {
    switch (voice) {
      case "brass":     return playBrassBell();
      case "bigben":    return playBigBenBell();
      case "gong":      return playGongBell();
      case "cathedral": return playCathedralBell();
      default:          return playBell();
    }
  }

  // E3 · Room tone — opt-in ambient. Pink-ish noise through a low-pass.
  let roomNode = null, roomGain = null;
  const ROOM_KEY = "stv-room-tone";
  function startRoomTone() {
    if (!canPlay() || roomNode) return;
    resumeIfNeeded();
    const sampleRate = ctx.sampleRate;
    const len = sampleRate * 2; // 2s loop
    const buf = ctx.createBuffer(1, len, sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0; // simple pink-noise filter
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99 * b0 + 0.0555 * white;
      b1 = 0.96 * b1 + 0.2965 * white;
      b2 = 0.57 * b2 + 1.0406 * white;
      d[i] = (b0 + b1 + b2 + white * 0.1842) * 0.11;
    }
    roomNode = ctx.createBufferSource();
    roomNode.buffer = buf; roomNode.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 240; lp.Q.value = 0.6;
    roomGain = ctx.createGain();
    roomGain.gain.value = 0;
    roomGain.gain.linearRampToValueAtTime(0.03, ctx.currentTime + 0.8);
    roomNode.connect(lp).connect(roomGain).connect(master);
    roomNode.start();
    try { localStorage.setItem(ROOM_KEY, "1"); } catch {}
  }
  function stopRoomTone() {
    if (!roomNode || !roomGain) return;
    const now = ctx.currentTime;
    roomGain.gain.cancelScheduledValues(now);
    roomGain.gain.setValueAtTime(roomGain.gain.value, now);
    roomGain.gain.linearRampToValueAtTime(0, now + 0.5);
    const n = roomNode, g = roomGain;
    setTimeout(() => { try { n.stop(); n.disconnect(); g.disconnect(); } catch {} }, 520);
    roomNode = null; roomGain = null;
    try { localStorage.setItem(ROOM_KEY, "0"); } catch {}
  }
  function toggleRoomTone() {
    if (roomNode) { stopRoomTone(); return false; }
    startRoomTone(); return true;
  }
  function isRoomToneOn() { return !!roomNode; }

  // E4 · Paper rustle — 80ms whitenoise through high-pass. For Fraunces reveals.
  function playRustle() {
    if (!canPlay()) return;
    resumeIfNeeded();
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * 0.1);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.value = 3200; hp.Q.value = 0.7;
    const g = ctx.createGain();
    env(g, t, { attack: 0.005, peak: 0.08, decay: 0.065 });
    src.connect(hp).connect(g).connect(master);
    src.start(t); src.stop(t + 0.1);
  }

  // E5 · Stereo-panned whoosh. pan ∈ [-1, 1]. Falls back to mono if panner unavailable.
  function playStereoWhoosh(pan) {
    if (!canPlay()) return;
    resumeIfNeeded();
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * 0.13);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass"; filter.Q.value = 1.4;
    filter.frequency.setValueAtTime(200, t);
    filter.frequency.exponentialRampToValueAtTime(4000, t + 0.1);
    const g = ctx.createGain();
    env(g, t, { attack: 0.015, peak: 0.2, decay: 0.09 });
    let chain = src.connect(filter).connect(g);
    if (typeof ctx.createStereoPanner === "function") {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan || 0));
      chain.connect(panner).connect(master);
    } else {
      chain.connect(master);
    }
    src.start(t); src.stop(t + 0.14);
  }

  // E6 · Gallery bell — single damped bronze strike with 800ms decay. FM synthesis
  // where modulator is inharmonic (ratio 2.76) for metallic spectrum. For stage 12.
  function playGalleryBell() {
    if (!canPlay()) return;
    resumeIfNeeded();
    const t = ctx.currentTime;
    const carrier = ctx.createOscillator();
    const modulator = ctx.createOscillator();
    const modGain = ctx.createGain();
    const voice = ctx.createGain();
    carrier.type = "sine";
    modulator.type = "sine";
    carrier.frequency.value = 440;
    modulator.frequency.value = 440 * 2.76;
    modGain.gain.value = 520;
    voice.gain.setValueAtTime(0, t);
    voice.gain.linearRampToValueAtTime(0.28, t + 0.01);
    voice.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    modulator.connect(modGain).connect(carrier.frequency);
    carrier.connect(voice).connect(master);
    modulator.start(t); carrier.start(t);
    modulator.stop(t + 1.1); carrier.stop(t + 1.1);
  }

  // Restore room-tone state on init (after user gesture — need canPlay()).
  function maybeRestoreRoomTone() {
    try {
      if (localStorage.getItem(ROOM_KEY) === "1") startRoomTone();
    } catch {}
  }

  global.SoundFX = {
    init, isMuted, toggleMuted, setMuted, setMasterVolume,
    playClick, playTick, playCheckmark, playError,
    playGateOpen, playSuccess, playWhoosh, playStamp, playBell,
    // Wave 5 additions
    playIdent, playBellVoice,
    playBrassBell, playBigBenBell, playGongBell, playCathedralBell,
    startRoomTone, stopRoomTone, toggleRoomTone, isRoomToneOn,
    playRustle, playStereoWhoosh, playGalleryBell,
    maybeRestoreRoomTone,
  };
})(window);
