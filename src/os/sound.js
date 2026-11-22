// Generated UI sounds (WebAudio, no files). Muted until the first user
// gesture; the tray speaker toggles it and the choice is remembered.
const KEY = 'cryptos.sound';

export function createSound() {
  let ctx = null;
  let master = null;
  let enabled = read();
  const listeners = new Set();
  /** Set once the context has run (after a user gesture), so it may be resumed later. */
  let unlocked = false;
  /** An app took the context for its own audio: never suspend it behind its back. */
  let shared = false;
  let idleTimer = 0;
  let noise = null;
  const IDLE_MS = 4000; // longer than the longest recipe (startup, ~2.2 s)

  function read() {
    try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
  }
  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.18;
    master.connect(ctx.destination);
    ctx.addEventListener?.('statechange', () => { if (ctx.state === 'running') unlocked = true; });
    if (ctx.state === 'running') unlocked = true;
    return ctx;
  }

  /** Suspend the context after a quiet spell so the audio thread can sleep. */
  function idleSoon(ms = IDLE_MS) {
    clearTimeout(idleTimer);
    if (shared || !ctx) return;
    idleTimer = setTimeout(() => {
      if (!shared && ctx.state === 'running') Promise.resolve(ctx.suspend()).catch(() => {});
    }, ms);
  }

  /** 0.9 s of decaying white noise, made once and reused by every whoosh. */
  function noiseBuffer(len) {
    if (noise) return noise;
    noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * len), ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    return noise;
  }

  function tone(freq, start, dur, { type = 'sine', gain = 1, slide = 0 } = {}) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, start + dur);
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(gain, start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(master);
    o.start(start);
    o.stop(start + dur + 0.02);
  }

  const RECIPES = {
    startup(t) {
      // a warm rising chord: four voices that bloom in
      [[311.1, 0], [415.3, 0.12], [466.2, 0.24], [622.3, 0.38], [830.6, 0.55]].forEach(([f, d], i) =>
        tone(f, t + d, 2.2 - d, { type: i % 2 ? 'triangle' : 'sine', gain: 0.55 }));
    },
    shutdown(t) {
      [[622.3, 0], [466.2, 0.18], [311.1, 0.36], [233.1, 0.54]].forEach(([f, d]) => tone(f, t + d, 1.2, { type: 'triangle', gain: 0.5 }));
    },
    open(t) { tone(660, t, 0.09, { type: 'triangle', gain: 0.35, slide: 1.5 }); },
    close(t) { tone(520, t, 0.08, { type: 'triangle', gain: 0.3, slide: 0.6 }); },
    click(t) { tone(1800, t, 0.025, { type: 'square', gain: 0.08 }); },
    notify(t) { tone(880, t, 0.16, { gain: 0.4 }); tone(1320, t + 0.11, 0.25, { gain: 0.35 }); },
    error(t) { tone(220, t, 0.28, { type: 'square', gain: 0.25 }); tone(196, t + 0.05, 0.28, { type: 'square', gain: 0.2 }); },
    whoosh(t) {
      // filtered noise sweep for the file bombardment
      const len = 0.9;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(len);
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.Q.value = 0.8;
      f.frequency.setValueAtTime(300, t);
      f.frequency.exponentialRampToValueAtTime(4000, t + len);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.9, t + 0.25);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      src.connect(f).connect(g).connect(master);
      src.start(t);
    },
    tick(t) { tone(2400 + Math.random() * 1200, t, 0.018, { type: 'square', gain: 0.05 }); },
  };

  return {
    /** Play a named UI sound if sound is on and audio is unlocked. */
    play(name) {
      if (!enabled || !RECIPES[name]) return;
      if (!ensure()) return;
      if (ctx.state !== 'running') {
        // idle-suspended after an earlier gesture: wake it; never before one
        if (!unlocked || ctx.state === 'closed') return;
        Promise.resolve(ctx.resume()).catch(() => {});
      }
      RECIPES[name](ctx.currentTime + 0.01);
      idleSoon();
    },
    /** Call from a user gesture to allow audio. */
    unlock() {
      if (!ensure()) return;
      if (ctx.state === 'suspended') Promise.resolve(ctx.resume()).then(() => { unlocked = true; idleSoon(); }, () => {});
      else idleSoon();
    },
    get enabled() { return enabled; },
    set enabled(v) {
      enabled = !!v;
      try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch { /* private mode */ }
      if (!enabled) idleSoon(0);
      listeners.forEach((fn) => fn(enabled));
    },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    /** Shared AudioContext for apps (music) so there is only one. */
    context() { shared = true; clearTimeout(idleTimer); return ensure(); },
    output() { shared = true; clearTimeout(idleTimer); ensure(); return master; },
  };
}
