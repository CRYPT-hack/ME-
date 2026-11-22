// Tape Deck audio engine: a small WebAudio synth with a lookahead clock.
//
//   session bus ─┬────────────────────────────┐
//                ├─ delay send → delay ⟲ ──────┤
//                └─ reverb send → convolver ───┴→ compressor → volume → analyser → destination
//
// Every scheduled source is tracked so stop()/destroy() can silence it at once.

export const mf = (m) => 440 * Math.pow(2, (m - 69) / 12);

/** Cheap deterministic 0..1 hash, so "random" melodies repeat on every loop. */
export function hash01(n) {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

export function createEngine(ac, { volume = 0.7 } = {}) {
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 14;
  comp.ratio.value = 4;
  comp.attack.value = 0.006;
  comp.release.value = 0.22;
  const vol = ac.createGain();
  vol.gain.value = curve(volume);
  const analyser = ac.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.72;
  comp.connect(vol);
  vol.connect(analyser);
  analyser.connect(ac.destination);

  const noise = makeNoise(ac, 2);
  const impulse = makeImpulse(ac, 2.2, 3.2);

  let session = null;
  let track = null;
  let timer = null;
  let step = 0;
  let nextTime = 0;
  let onTrackEnd = null;
  const pending = new Set(); // sessions fading out

  function curve(v) { return Math.pow(Math.max(0, Math.min(1, v)), 1.6) * 0.95; }

  function newSession(tr) {
    const bus = ac.createGain();
    bus.gain.value = tr.gain ?? 0.8;
    bus.connect(comp);
    const delay = ac.createDelay(2);
    delay.delayTime.value = Math.min(1.9, (60 / tr.bpm) * (tr.delayBeats ?? 0.75));
    const fb = ac.createGain();
    fb.gain.value = tr.delayFeedback ?? 0.32;
    const dlp = ac.createBiquadFilter();
    dlp.type = 'lowpass';
    dlp.frequency.value = 2600;
    const delaySend = ac.createGain();
    delaySend.gain.value = 1;
    delaySend.connect(delay);
    delay.connect(dlp);
    dlp.connect(fb);
    fb.connect(delay);
    dlp.connect(bus);
    const verb = ac.createConvolver();
    verb.buffer = impulse;
    const verbOut = ac.createGain();
    verbOut.gain.value = tr.reverb ?? 0.35;
    const verbSend = ac.createGain();
    verbSend.connect(verb);
    verb.connect(verbOut);
    verbOut.connect(bus);
    const S = {
      ac, bus, delaySend, verbSend, noise,
      sources: new Set(),
      nodes: [bus, delay, fb, dlp, delaySend, verb, verbOut, verbSend],
    };
    S.inst = instruments(S);
    return S;
  }

  /** Fade a session out starting at `from` (default now), then free it. */
  function killSession(S, fade = 0.04, from = 0) {
    if (!S) return;
    const now = ac.currentTime;
    const t0 = Math.max(now, from || now);
    const end = () => {
      for (const src of S.sources) { try { src.stop(); } catch { /* already stopped */ } try { src.disconnect(); } catch { /* */ } }
      S.sources.clear();
      pending.delete(S);
      for (const n of S.nodes) { try { n.disconnect(); } catch { /* */ } }
    };
    if (fade <= 0 && t0 <= now) { end(); return; }
    try {
      S.bus.gain.cancelScheduledValues(t0);
      S.bus.gain.setValueAtTime(S.bus.gain.value, t0);
      S.bus.gain.linearRampToValueAtTime(0, t0 + fade);
    } catch { /* closed context */ }
    S.timer = setTimeout(end, (t0 - now + fade) * 1000 + 60);
    pending.add(S);
  }

  function stepDur() { return 60 / track.bpm / 4; }

  function tick() {
    if (!track || !session) return;
    const ahead = document.hidden ? 1.5 : 0.2;
    while (nextTime < ac.currentTime + ahead) {
      const total = track.bars * 16;
      if (step >= total) {
        // track finished: hand over at this exact time so there is no gap
        const at = nextTime;
        const cb = onTrackEnd;
        if (cb) { cb(at); return; }
        step = 0;
      }
      const sd = stepDur();
      const s = step % 16;
      const swing = track.swing && s % 2 === 1 ? track.swing * sd : 0;
      try {
        track.step({ i: step, bar: Math.floor(step / 16), s, t: nextTime + swing, sd, bd: sd * 16, inst: session.inst, S: session });
      } catch (err) { console.error(err); }
      step++;
      nextTime += sd;
    }
  }

  return {
    analyser,
    get playing() { return !!timer; },
    get step() { return step; },
    /** Seconds from the track start to `step` (ignores swing). */
    elapsed() {
      if (!track) return 0;
      const sd = stepDur();
      if (!timer) return step * sd;
      // the scheduler runs ahead of the clock: subtract what is still queued
      return Math.max(0, step * sd - (nextTime - ac.currentTime));
    },
    duration: (tr) => (tr.bars * 16 * 60) / tr.bpm / 4,
    setVolume(v) {
      vol.gain.setTargetAtTime(curve(v), ac.currentTime, 0.03);
    },
    /** Start `tr` at `fromStep` (resume) at time `at` (defaults to now). */
    start(tr, fromStep = 0, at = 0, endCb = null) {
      if (session) killSession(session, 0.03, at);
      track = tr;
      session = newSession(tr);
      tr.setup?.(session);
      step = fromStep;
      onTrackEnd = endCb;
      nextTime = Math.max(at || 0, ac.currentTime + 0.05);
      if (!timer) timer = setInterval(tick, 25);
      tick();
    },
    /** Silence and stop scheduling; keeps the step so play() resumes. */
    halt(fade = 0.05) {
      if (timer) { clearInterval(timer); timer = null; }
      if (session) {
        // rewind to the first step the listener has not heard yet
        const sd = track ? stepDur() : 0;
        if (sd) step = Math.max(0, step - Math.ceil(Math.max(0, nextTime - ac.currentTime) / sd));
        killSession(session, fade);
        session = null;
      }
    },
    reset() { step = 0; },
    destroy() {
      if (timer) { clearInterval(timer); timer = null; }
      killSession(session, 0);
      session = null;
      for (const S of pending) { clearTimeout(S.timer); killSession(S, 0); }
      pending.clear();
      for (const n of [comp, vol, analyser]) { try { n.disconnect(); } catch { /* */ } }
    },
  };
}

function makeNoise(ac, seconds) {
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * seconds), ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function makeImpulse(ac, seconds, decay) {
  const len = Math.floor(ac.sampleRate * seconds);
  const buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

/* ------------------------------------------------------------ instruments */

function instruments(S) {
  const { ac } = S;

  function track(src, stopAt) {
    S.sources.add(src);
    src.onended = () => { S.sources.delete(src); try { src.disconnect(); } catch { /* */ } };
    src.stop(stopAt);
    return src;
  }
  function osc(type, freq, t) {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.start(t);
    return o;
  }
  function gain(v = 0) { const g = ac.createGain(); g.gain.value = v; return g; }
  function filter(type, freq, q = 0.7) {
    const f = ac.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    return f;
  }
  function noiseSrc(t, dur) {
    const n = ac.createBufferSource();
    n.buffer = S.noise;
    n.start(t, Math.random() * 1.5);
    return track(n, t + dur + 0.05);
  }
  /** Route a voice's output to the dry bus plus optional sends. */
  function out(node, { delay = 0, verb = 0 } = {}) {
    node.connect(S.bus);
    if (delay) { const g = gain(delay); node.connect(g); g.connect(S.delaySend); }
    if (verb) { const g = gain(verb); node.connect(g); g.connect(S.verbSend); }
  }
  function env(g, t, peak, a, d, sustain = 0.0001, hold = 0) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    if (hold) g.gain.setValueAtTime(peak, t + a + hold);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain), t + a + hold + d);
  }

  return {
    kick(t, v = 1, { from = 150, to = 42, len = 0.38 } = {}) {
      const o = osc('sine', from, t);
      o.frequency.exponentialRampToValueAtTime(to, t + 0.11);
      const g = gain();
      env(g, t, 0.9 * v, 0.004, len);
      o.connect(g); out(g);
      track(o, t + len + 0.05);
    },
    snare(t, v = 1, { verb = 0.22, tone = 190, cut = 9000, len = 0.18 } = {}) {
      const n = noiseSrc(t, len);
      const hp = filter('highpass', 1100);
      const lp = filter('lowpass', cut);
      const g = gain();
      env(g, t, 0.34 * v, 0.002, len);
      n.connect(hp); hp.connect(lp); lp.connect(g); out(g, { verb });
      const o = osc('triangle', tone, t);
      o.frequency.exponentialRampToValueAtTime(tone * 0.75, t + 0.08);
      const g2 = gain();
      env(g2, t, 0.26 * v, 0.002, 0.09);
      o.connect(g2); out(g2);
      track(o, t + 0.14);
    },
    hat(t, v = 1, open = false) {
      const len = open ? 0.24 : 0.045;
      const n = noiseSrc(t, len);
      const hp = filter('highpass', 7600);
      const g = gain();
      env(g, t, 0.11 * v, 0.001, len);
      n.connect(hp); hp.connect(g); out(g, { verb: 0.05 });
    },
    crackle(t, v = 1) {
      const n = noiseSrc(t, 0.006);
      const hp = filter('highpass', 2500);
      const g = gain();
      env(g, t, (0.02 + Math.random() * 0.05) * v, 0.0005, 0.005);
      n.connect(hp); hp.connect(g); out(g);
    },
    /** Constant tape hiss for the whole session (tracked like any source). */
    hiss(level = 0.012) {
      const n = ac.createBufferSource();
      n.buffer = S.noise;
      n.loop = true;
      const bp = filter('bandpass', 3800, 0.6);
      const g = gain(level);
      n.connect(bp); bp.connect(g); out(g);
      n.start(ac.currentTime + 0.02);
      S.sources.add(n);
      n.onended = () => { S.sources.delete(n); };
    },
    bass(t, freq, dur, { type = 'sawtooth', cut = 320, env: fenv = 900, q = 5, v = 1 } = {}) {
      const o = osc(type, freq, t);
      const f = filter('lowpass', cut + fenv, q);
      f.frequency.setValueAtTime(cut + fenv, t);
      f.frequency.exponentialRampToValueAtTime(Math.max(40, cut), t + Math.max(0.05, dur * 0.7));
      const g = gain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.24 * v, t + 0.006);
      g.gain.setTargetAtTime(0.16 * v, t + 0.02, 0.08);
      g.gain.setValueAtTime(0.16 * v, t + dur);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.06);
      o.connect(f); f.connect(g); out(g);
      track(o, t + dur + 0.1);
    },
    reese(t, freq, dur, { v = 1 } = {}) {
      const f = filter('lowpass', 260, 3.5);
      f.frequency.setValueAtTime(260, t);
      f.frequency.linearRampToValueAtTime(820, t + dur * 0.45);
      f.frequency.linearRampToValueAtTime(380, t + dur);
      const g = gain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.13 * v, t + 0.015);
      g.gain.setValueAtTime(0.13 * v, t + dur - 0.03);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      for (const det of [-16, 16]) {
        const o = osc('sawtooth', freq, t);
        o.detune.value = det;
        o.connect(f);
        track(o, t + dur + 0.05);
      }
      const sub = osc('sine', freq / 2, t);
      const sg = gain(0.9);
      sub.connect(sg); sg.connect(g);
      track(sub, t + dur + 0.05);
      f.connect(g); out(g);
    },
    pad(t, freqs, dur, { v = 1, cut = 1300, attack = 0.5, release = 0.7, verb = 0.5, type = 'sawtooth' } = {}) {
      const f = filter('lowpass', cut, 0.8);
      const g = gain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.034 * v, t + attack);
      g.gain.setValueAtTime(0.034 * v, t + Math.max(attack, dur - 0.02));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + release);
      for (const fr of freqs) {
        for (const det of [-8, 7]) {
          const o = osc(type, fr, t);
          o.detune.value = det;
          o.connect(f);
          track(o, t + dur + release + 0.05);
        }
      }
      f.connect(g); out(g, { verb });
    },
    pluck(t, freq, dur, { type = 'square', v = 1, cut = 2200, delay = 0.3, verb = 0.1 } = {}) {
      const o = osc(type, freq, t);
      const f = filter('lowpass', cut, 2);
      f.frequency.setValueAtTime(cut * 1.6, t);
      f.frequency.exponentialRampToValueAtTime(cut * 0.5, t + dur);
      const g = gain();
      env(g, t, 0.07 * v, 0.003, dur);
      o.connect(f); f.connect(g); out(g, { delay, verb });
      track(o, t + dur + 0.05);
    },
    lead(t, freq, dur, { v = 1, cut = 1800, delay = 0.35, verb = 0.25, glideFrom = 0 } = {}) {
      const f = filter('lowpass', cut, 1.5);
      const g = gain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.06 * v, t + 0.03);
      g.gain.setValueAtTime(0.06 * v, t + dur);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.25);
      const lfo = osc('sine', 5.2, t);
      const lg = gain(0);
      lg.gain.setValueAtTime(0, t);
      lg.gain.linearRampToValueAtTime(9, t + 0.35);
      lfo.connect(lg);
      for (const [type, det] of [['sawtooth', -6], ['square', 6]]) {
        const o = osc(type, glideFrom || freq, t);
        if (glideFrom) o.frequency.exponentialRampToValueAtTime(freq, t + 0.06);
        o.detune.value = det;
        lg.connect(o.detune);
        o.connect(f);
        track(o, t + dur + 0.3);
      }
      track(lfo, t + dur + 0.3);
      f.connect(g); out(g, { delay, verb });
    },
    /** Two-operator FM electric piano. */
    keys(t, freq, dur, { v = 1, verb = 0.35, delay = 0 } = {}) {
      const car = osc('sine', freq, t);
      const mod = osc('sine', freq, t);
      const mg = gain();
      mg.gain.setValueAtTime(freq * 1.4, t);
      mg.gain.exponentialRampToValueAtTime(Math.max(1, freq * 0.08), t + 0.6);
      mod.connect(mg); mg.connect(car.frequency);
      const f = filter('lowpass', 2600);
      const g = gain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.085 * v, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.03 * v, t + 0.35);
      g.gain.setValueAtTime(0.03 * v, t + dur);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.5);
      car.connect(f); f.connect(g); out(g, { verb, delay });
      track(car, t + dur + 0.55);
      track(mod, t + dur + 0.55);
    },
    flute(t, freq, dur, { v = 1 } = {}) {
      const o = osc('triangle', freq, t);
      const o2 = osc('sine', freq * 2, t);
      const lfo = osc('sine', 4.6, t);
      const lg = gain(7);
      lfo.connect(lg); lg.connect(o.detune); lg.connect(o2.detune);
      const g = gain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.06 * v, t + 0.08);
      g.gain.setValueAtTime(0.05 * v, t + dur);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.3);
      const g2 = gain(0.18);
      o.connect(g); o2.connect(g2); g2.connect(g);
      out(g, { verb: 0.45, delay: 0.2 });
      for (const n of [o, o2, lfo]) track(n, t + dur + 0.35);
    },
    chip(t, freq, dur, { v = 1, type = 'square', delay = 0.15 } = {}) {
      const o = osc(type, freq, t);
      const g = gain();
      g.gain.setValueAtTime(0.055 * v, t);
      g.gain.setValueAtTime(0.04 * v, t + 0.025);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      const f = filter('lowpass', 5200);
      o.connect(f); f.connect(g); out(g, { delay });
      track(o, t + dur + 0.02);
    },
    chipKick(t, v = 1) {
      const o = osc('square', 180, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.07);
      const f = filter('lowpass', 900);
      const g = gain();
      env(g, t, 0.16 * v, 0.002, 0.11);
      o.connect(f); f.connect(g); out(g);
      track(o, t + 0.14);
    },
    chipNoise(t, v = 1, len = 0.09, freq = 3000) {
      const n = noiseSrc(t, len);
      const bp = filter('bandpass', freq, 0.9);
      const g = gain();
      g.gain.setValueAtTime(0.2 * v, t);
      g.gain.linearRampToValueAtTime(0.0001, t + len);
      n.connect(bp); bp.connect(g); out(g);
    },
  };
}
