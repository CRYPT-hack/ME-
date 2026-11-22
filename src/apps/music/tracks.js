// Four original procedural tracks. Each `step()` is called once per 16th
// note with { bar, s (0..15 in the bar), t (audio time), sd (step seconds),
// bd (bar seconds), inst }. Everything is written here; no samples.
import { mf, hash01 } from './engine.js';

/* 1 ─ Night Drive: synthwave in A minor */
const ND_CHORDS = [
  { root: 45, pad: [57, 60, 64, 69] }, // Am
  { root: 41, pad: [57, 60, 65, 69] }, // F
  { root: 48, pad: [55, 60, 64, 67] }, // C
  { root: 43, pad: [55, 59, 62, 67] }, // G
];
const ND_LEAD = [[76, 74], [72, 69], [72, 76], [74, 71]];
const ND_ARP = [0, 1, 2, 3, 2, 1, 2, 3];

const nightDrive = {
  id: 'night-drive',
  title: 'Night Drive',
  artist: 'CRYPT OS synth',
  tag: 'synthwave · 100 bpm',
  bpm: 100, bars: 32, delayBeats: 0.75, delayFeedback: 0.34, reverb: 0.4,
  setup(S) { S.inst.hiss(0.006); },
  step({ bar, s, t, sd, bd, inst }) {
    const c = ND_CHORDS[bar % 4];
    const full = bar >= 4 && bar < 28;
    if (s === 0) inst.pad(t, c.pad.map(mf), bd * 0.96, { cut: bar < 4 ? 700 + bar * 180 : 1500, v: 1 });
    if (bar >= 4 && bar < 30 && s % 2 === 0) {
      const oct = s === 14 || s === 6 ? 12 : 0;
      inst.bass(t, mf(c.root + oct), sd * 1.7, { cut: 260, env: 1000, q: 6 });
    }
    if (bar >= 8 && bar < 31) {
      const n = c.pad[ND_ARP[s % 8]] + 12;
      inst.pluck(t, mf(n), sd * 0.9, { v: bar >= 28 ? 0.6 : 0.85, cut: 1800 + (bar % 8) * 120, delay: 0.32 });
    }
    if (bar >= 16 && bar < 28 && (s === 0 || s === 8)) {
      const note = ND_LEAD[bar % 4][s / 8];
      inst.lead(t, mf(note), sd * 7, { v: 0.9, glideFrom: s === 8 ? mf(ND_LEAD[bar % 4][0]) : 0 });
    }
    if (full) {
      if (s === 0 || s === 8) inst.kick(t, 1);
      if (s === 4 || s === 12) inst.snare(t, 0.9, { verb: 0.45, len: 0.24 });
      if (s % 4 === 2) inst.hat(t, 0.8);
      if (s % 2 === 1) inst.hat(t, 0.25);
      if (bar === 27 && s >= 8) inst.snare(t, 0.25 + (s - 8) * 0.07, { verb: 0.3, len: 0.1 });
    } else if (bar < 4 && s % 4 === 2) {
      inst.hat(t, 0.2 + bar * 0.1);
    }
  },
};

/* 2 ─ Lofi Debug: swung keys, soft drums, vinyl dust */
const LD_CHORDS = [
  { root: 38, keys: [53, 57, 60, 64] }, // Dm9
  { root: 43, keys: [53, 59, 64] },     // G13
  { root: 36, keys: [52, 55, 59, 62] }, // Cmaj9
  { root: 45, keys: [55, 61, 65] },     // A7(b13)
];
const LD_SCALE = [62, 65, 67, 69, 72, 74, 77];

const lofiDebug = {
  id: 'lofi-debug',
  title: 'Lofi Debug',
  artist: 'CRYPT OS keys',
  tag: 'lo-fi · 76 bpm',
  bpm: 76, bars: 24, swing: 0.22, delayBeats: 0.5, delayFeedback: 0.28, reverb: 0.45,
  gain: 0.9,
  setup(S) { S.inst.hiss(0.014); },
  step({ bar, s, t, sd, bd, inst }) {
    const c = LD_CHORDS[bar % 4];
    if (s === 0) c.keys.forEach((n, i) => inst.keys(t + i * 0.014, mf(n), bd * 0.42, { v: 0.85 }));
    if (s === 7 && bar % 2 === 1) c.keys.forEach((n, i) => inst.keys(t + i * 0.01, mf(n), sd * 2, { v: 0.5 }));
    if (s === 10 && bar % 4 === 3) c.keys.slice(-2).forEach((n) => inst.keys(t, mf(n + 12), sd * 2, { v: 0.35, delay: 0.3 }));
    if (bar >= 2) {
      if (s === 0) inst.bass(t, mf(c.root), sd * 6, { type: 'triangle', cut: 500, env: 300, q: 1, v: 1.2 });
      if (s === 10) inst.bass(t, mf(c.root + 7), sd * 4, { type: 'triangle', cut: 500, env: 300, q: 1, v: 1 });
    }
    if (bar >= 4 && bar < 22) {
      if (s === 0 || s === 10 || (s === 3 && bar % 2 === 0)) inst.kick(t, 0.75, { from: 120, to: 45, len: 0.3 });
      if (s === 4 || s === 12) inst.snare(t, 0.6, { cut: 3200, verb: 0.3, tone: 170, len: 0.16 });
      if (s % 2 === 0) inst.hat(t, s % 4 === 0 ? 0.45 : 0.3);
      else if (hash01(bar * 16 + s) > 0.7) inst.hat(t, 0.15);
    }
    if (bar >= 8 && bar < 20 && [0, 3, 6, 8, 11, 14].includes(s)) {
      const r = hash01(bar * 131 + s * 7);
      if (r > 0.5) {
        const note = LD_SCALE[Math.floor(hash01(bar * 17 + s) * LD_SCALE.length)];
        inst.flute(t, mf(note), sd * (2 + Math.floor(r * 3)), { v: 0.8 });
      }
    }
    if (Math.random() < 0.28) inst.crackle(t + Math.random() * sd, 1);
  },
};

/* 3 ─ 8-bit Commit: chiptune in C major */
const CH_MELODY = [
  [76, 0, 79, 0, 84, 0, 83, 0, 79, 0, 76, 0, 79, 0, 0, 0],
  [74, 0, 79, 0, 83, 0, 81, 0, 79, 0, 74, 0, 71, 0, 0, 0],
  [72, 0, 76, 0, 81, 0, 79, 0, 76, 0, 72, 0, 76, 0, 79, 0],
  [77, 0, 76, 0, 74, 0, 72, 0, 74, 0, 0, 76, 0, 74, 72, 0],
];
const CH_B = [
  [84, 0, 0, 83, 0, 0, 79, 0, 76, 0, 0, 79, 0, 0, 0, 0],
  [83, 0, 0, 81, 0, 0, 79, 0, 74, 0, 0, 79, 0, 0, 0, 0],
  [81, 0, 0, 79, 0, 0, 76, 0, 72, 0, 0, 76, 0, 0, 0, 0],
  [77, 0, 79, 0, 81, 0, 83, 0, 84, 0, 0, 0, 86, 0, 0, 0],
];
const CH_CHORDS = [[60, 64, 67], [59, 62, 67], [57, 60, 64], [57, 60, 65]];
const CH_ROOTS = [36, 43, 45, 41];

const eightBit = {
  id: '8-bit-commit',
  title: '8-bit Commit',
  artist: 'CRYPT OS chip',
  tag: 'chiptune · 148 bpm',
  bpm: 148, bars: 32, delayBeats: 0.75, delayFeedback: 0.22, reverb: 0.15,
  gain: 0.85,
  step({ bar, s, t, sd, inst }) {
    const k = bar % 4;
    const chord = CH_CHORDS[k];
    inst.chip(t, mf(chord[s % 3] + (s % 6 >= 3 ? 12 : 0) - 12 + 12), sd * 0.7, { v: 0.38, type: 'square', delay: 0 });
    if (s % 2 === 0) inst.chip(t, mf(CH_ROOTS[k] + (s % 4 === 2 ? 12 : 0)), sd * 1.6, { v: 2.4, type: 'triangle', delay: 0 });
    if (bar >= 4 && bar < 31) {
      const mel = bar >= 16 && bar < 24 ? CH_B : CH_MELODY;
      const n = mel[k][s];
      if (n) {
        let len = 1;
        while (s + len < 16 && !mel[k][s + len]) len++;
        inst.chip(t, mf(n), sd * Math.min(len, 3) * 0.92, { v: 1, type: 'square', delay: bar >= 16 && bar < 24 ? 0.35 : 0.12 });
      }
    }
    if (bar >= 4) {
      if (s === 0 || s === 8 || (s === 10 && k === 3)) inst.chipKick(t, 1);
      if (s === 4 || s === 12) inst.chipNoise(t, 0.9, 0.1, 2600);
      if (s % 2 === 1) inst.chipNoise(t, 0.35, 0.025, 9000);
      if (bar % 8 === 7 && s >= 12) inst.chipNoise(t, 0.6, 0.06, 2000 + s * 200);
    }
  },
};

/* 4 ─ Pit Lane: liquid drum & bass in E minor */
const PL_ROOTS = [40, 36, 43, 38];
const PL_CHORDS = [[64, 67, 71], [64, 67, 72], [62, 67, 71], [62, 66, 69]];
const PL_HAT = [0.5, 0.18, 0.34, 0.18];

const pitLane = {
  id: 'pit-lane',
  title: 'Pit Lane',
  artist: 'CRYPT OS breaks',
  tag: 'drum & bass · 172 bpm',
  bpm: 172, bars: 48, delayBeats: 0.75, delayFeedback: 0.36, reverb: 0.4,
  gain: 0.78,
  step({ bar, s, t, sd, bd, inst }) {
    const k = bar % 4;
    const root = PL_ROOTS[k];
    const intro = bar < 8;
    const outro = bar >= 44;
    if (s === 0 && bar % 2 === 0) {
      inst.pad(t, PL_CHORDS[k].map(mf), bd * 1.9, { cut: intro ? 600 + bar * 140 : 1700, attack: 0.6, v: 0.9, verb: 0.6 });
    }
    if (bar >= 4 && !outro) {
      if (s === 0) inst.reese(t, mf(root), sd * 10, { v: intro ? 0.7 : 1 });
      if (s === 10) inst.reese(t, mf(root + (bar % 2 ? 3 : -2)), sd * 6, { v: intro ? 0.7 : 1 });
    }
    if (!intro && !outro) {
      if (s === 0 || s === 10) inst.kick(t, 1, { from: 170, to: 48, len: 0.3 });
      if (s === 4 || s === 12) inst.snare(t, 1, { verb: 0.3, tone: 210, len: 0.17 });
      if (s === 7 || s === 15) inst.snare(t, 0.22, { verb: 0.1, tone: 210, len: 0.08 });
      inst.hat(t, PL_HAT[s % 4], s === 14 && bar % 4 === 3);
      if ((bar === 23 || bar === 39) && s >= 8) inst.snare(t, 0.3 + (s - 8) * 0.08, { verb: 0.2, len: 0.08 });
      if (bar >= 16 && s === 6 && bar % 2 === 1) {
        PL_CHORDS[k].forEach((n) => inst.pluck(t, mf(n + 12), sd * 1.5, { type: 'sawtooth', v: 0.55, cut: 2400, delay: 0.45, verb: 0.2 }));
      }
    } else if (s % 2 === 0) {
      inst.hat(t, intro ? 0.12 + bar * 0.03 : 0.2);
    }
  },
};

export const tracks = [nightDrive, lofiDebug, eightBit, pitLane];
