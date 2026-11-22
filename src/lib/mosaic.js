// Pixel-mosaic portrait renderer.
//
// Samples an image into a grid of square tiles, turns each into one of a few
// grey levels (auto-levels -> S-curve -> 4x4 Bayer ordered dither), and draws
// them on ONE canvas. The tiles fly in from scattered positions and depths,
// snap into place from the centre outwards, then stay alive: a few shimmer
// every frame and the pointer pushes them around on springs.
//
//   const m = createMosaic(canvas, { src, cell, levels, reducedMotion, background });
//   await m.ready;            // image loaded and sampled
//   m.setMode('photo');       // crossfade to the grayscale photo ('pixels' back)
//   m.replay(); m.skip();     // re-run / finish the assembly
//   m.destroy();              // stops the loop, observers and listeners
//
// The canvas must get its size from CSS (e.g. position:absolute; inset:0):
// the renderer only sets its backing-store size.
import { loadImage, seeded, clamp } from '../os/ui.js';

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const GREYS = Array.from({ length: 256 }, (_, g) => `rgb(${g},${g},${g})`);

const FLIGHT_DUR = 0.85;   // seconds one tile takes to land
const SPREAD = 0.55;       // centre-to-edge stagger, seconds
const JITTER = 0.18;
const SPRING_K = 120;
const SPRING_C = 12;
const PUSH = 2600;         // px/s² at the cursor
const MIX_TIME = 0.45;     // pixels <-> photo crossfade, seconds

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{src:string, cell?:number|((w:number,h:number)=>number), levels?:number,
 *          reducedMotion?:boolean, background?:string, gap?:number,
 *          focus?:[number,number], zoom?:number, glyphs?:boolean, contrast?:number,
 *          onStart?:Function, onAssembled?:Function, onLayout?:Function}} options
 */
export function createMosaic(canvas, options = {}) {
  const o = {
    cell: null,
    levels: 6,
    reducedMotion: false,
    background: '#0b0b0c',
    gap: 1,
    focus: [0.5, 0.5],
    zoom: 1,
    glyphs: true,
    contrast: 1.6,
    ...options,
  };
  const L = clamp(Math.round(o.levels), 2, 16);
  const ctx = canvas.getContext('2d', { alpha: false });

  let img = null;
  let destroyed = false;
  let W = 0, H = 0, dpr = 1, cell = 8, cols = 0, rows = 0, ox = 0, oy = 0;
  let n = 0;
  // per-tile state (CSS px)
  let hx, hy, x, y, vx, vy, sx, sy, sz, delay, flick, grey, glyph;
  let levelLists = [];      // tile indices per level (glyph tiles excluded)
  let glyphList = [];
  let lo = 0, hi = 1;       // luminance stretch, reused by the photo layer
  let crop = null;          // source rect in image px
  let photoCanvas = null;
  let sprite = null;

  let mode = 'pixels';
  let mix = 0;              // 0 = mosaic, 1 = photo
  let clock = 0;
  let started = false;
  let flying = false;
  let flightStart = 0;
  let flightTotal = 0;
  let settled = true;
  const pointer = { on: false, x: 0, y: 0 };
  let visible = true;
  let docVisible = !document.hidden;
  let raf = 0;
  let lastT = 0;
  let skipToggle = false;

  const rand = seeded('crypt-mosaic');

  // ── sampling ──────────────────────────────────────────────
  function measure() {
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const bw = Math.max(1, Math.round(W * dpr));
    const bh = Math.max(1, Math.round(H * dpr));
    if (canvas.width !== bw) canvas.width = bw;
    if (canvas.height !== bh) canvas.height = bh;
  }

  function pickCell() {
    if (typeof o.cell === 'function') return o.cell(W, H);
    if (o.cell) return o.cell;
    return clamp(Math.round(W / 48), 6, 10);
  }

  function resample() {
    if (!img || W < 8 || H < 8) { n = 0; return; }
    cell = Math.max(3, pickCell());
    cols = Math.max(1, Math.floor((W - o.gap) / cell));
    rows = Math.max(1, Math.floor((H - o.gap) / cell));
    ox = (W - cols * cell) / 2 + cell / 2;
    oy = (H - rows * cell) / 2 + cell / 2;

    // "cover" crop of the source around the focus point
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const aspect = cols / rows;
    let cw = iw, ch = ih;
    if (iw / ih > aspect) cw = ih * aspect; else ch = iw / aspect;
    const z = Math.max(1, o.zoom);
    cw /= z; ch /= z;
    const cx = clamp(iw * o.focus[0] - cw / 2, 0, iw - cw);
    const cy = clamp(ih * o.focus[1] - ch / 2, 0, ih - ch);
    crop = { x: cx, y: cy, w: cw, h: ch };

    // two-step downscale so each cell is a proper average
    const mid = document.createElement('canvas');
    mid.width = cols * 3; mid.height = rows * 3;
    const mctx = mid.getContext('2d');
    mctx.imageSmoothingQuality = 'high';
    mctx.drawImage(img, cx, cy, cw, ch, 0, 0, mid.width, mid.height);
    const small = document.createElement('canvas');
    small.width = cols; small.height = rows;
    const sctx = small.getContext('2d', { willReadFrequently: true });
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(mid, 0, 0, cols, rows);
    const data = sctx.getImageData(0, 0, cols, rows).data;

    const total = cols * rows;
    const lum = new Float32Array(total);
    const solid = new Uint8Array(total);
    const sample = [];
    for (let i = 0; i < total; i++) {
      const a = data[i * 4 + 3];
      if (a < 40) continue;
      solid[i] = 1;
      const l = (0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]) / 255;
      lum[i] = l;
      sample.push(l);
    }
    n = sample.length;
    sample.sort((a, b) => a - b);
    lo = n ? sample[Math.floor(n * 0.02)] : 0;
    hi = n ? sample[Math.min(n - 1, Math.floor(n * 0.985))] : 1;
    if (hi - lo < 0.05) { lo = 0; hi = 1; }

    hx = new Float32Array(n); hy = new Float32Array(n);
    x = new Float32Array(n); y = new Float32Array(n);
    vx = new Float32Array(n); vy = new Float32Array(n);
    sx = new Float32Array(n); sy = new Float32Array(n); sz = new Float32Array(n);
    delay = new Float32Array(n); flick = new Float32Array(n);
    grey = new Uint8Array(n); glyph = new Uint8Array(n);
    const lists = Array.from({ length: L }, () => []);
    const glyphs = [];
    const useGlyphs = o.glyphs && cell >= 7;
    const gcx = W / 2, gcy = H / 2;
    const maxR = Math.hypot(gcx, gcy) || 1;
    let maxDelay = 0;
    let k = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (!solid[i]) continue;
        const v = curve(clamp((lum[i] - lo) / (hi - lo), 0, 1), o.contrast);
        const t = (BAYER4[(r & 3) * 4 + (c & 3)] + 0.5) / 16;
        const level = clamp(Math.floor(v * (L - 1) + t), 0, L - 1);
        const px = ox + c * cell, py = oy + r * cell;
        hx[k] = px; hy[k] = py; x[k] = px; y[k] = py;
        grey[k] = Math.round(24 + (level / (L - 1)) * (242 - 24));
        if (useGlyphs && level === L - 1 && rand() < 0.16) { glyph[k] = 1; glyphs.push(k); }
        else lists[level].push(k);
        sx[k] = (-0.3 + rand() * 1.6) * W;
        sy[k] = (-0.3 + rand() * 1.6) * H;
        sz[k] = 2 + rand() * 3.2;
        const d = Math.hypot(px - gcx, py - gcy) / maxR;
        delay[k] = d * SPREAD + rand() * JITTER;
        if (delay[k] > maxDelay) maxDelay = delay[k];
        k++;
      }
    }
    flightTotal = maxDelay + FLIGHT_DUR;
    levelLists = lists.map((a) => Int32Array.from(a));
    glyphList = Int32Array.from(glyphs);
    settled = true;
    buildSprite();
    photoCanvas = null;
    if (mix > 0 || mode === 'photo') buildPhoto();
    o.onLayout?.(n, cols, rows);
  }

  /** S-curve contrast around mid-grey. */
  function curve(v, c) {
    return v < 0.5 ? 0.5 * Math.pow(2 * v, c) : 1 - 0.5 * Math.pow(2 * (1 - v), c);
  }

  /** A tiny file glyph (folded corner) used for some of the brightest tiles. */
  function buildSprite() {
    const s = Math.max(4, Math.round((cell - o.gap) * dpr));
    const c = document.createElement('canvas');
    c.width = s; c.height = s;
    const g = c.getContext('2d');
    const f = Math.round(s * 0.34);
    const inset = Math.max(1, Math.round(s * 0.1));
    g.fillStyle = GREYS[242];
    g.beginPath();
    g.moveTo(inset, 0); g.lineTo(s - f, 0); g.lineTo(s - inset, f);
    g.lineTo(s - inset, s); g.lineTo(inset, s); g.closePath();
    g.fill();
    g.fillStyle = GREYS[150];
    g.beginPath();
    g.moveTo(s - f, 0); g.lineTo(s - f, f); g.lineTo(s - inset, f); g.closePath();
    g.fill();
    if (s >= 14) {
      g.fillStyle = GREYS[120];
      const lh = Math.max(1, Math.round(s / 14));
      for (let i = 0; i < 3; i++) {
        const ly = Math.round(s * (0.45 + i * 0.16));
        g.fillRect(inset * 2, ly, Math.round(s * (i === 2 ? 0.35 : 0.55)), lh);
      }
    }
    sprite = c;
  }

  /** Grayscale photo for the crossfade, aligned with the tile grid. */
  function buildPhoto() {
    if (!img || !crop || W < 8) return;
    const c = document.createElement('canvas');
    c.width = canvas.width; c.height = canvas.height;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.fillStyle = o.background;
    g.fillRect(0, 0, c.width, c.height);
    const gx = Math.round((ox - cell / 2) * dpr), gy = Math.round((oy - cell / 2) * dpr);
    const gw = Math.round(cols * cell * dpr), gh = Math.round(rows * cell * dpr);
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, crop.x, crop.y, crop.w, crop.h, gx, gy, gw, gh);
    try {
      const id = g.getImageData(gx, gy, gw, gh);
      const d = id.data;
      const span = hi - lo || 1;
      for (let i = 0; i < d.length; i += 4) {
        const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
        const v = Math.round(clamp(curve(clamp((l - lo) / span, 0, 1), 1.15), 0, 1) * 245 + 6);
        d[i] = d[i + 1] = d[i + 2] = v;
      }
      g.putImageData(id, gx, gy);
    } catch { /* tainted: keep the colour photo */ }
    photoCanvas = c;
  }

  // ── animation ─────────────────────────────────────────────
  function canRun() {
    return !destroyed && visible && docVisible && img && n > 0;
  }

  function maybeStart() {
    if (started || !canRun()) return;
    started = true;
    if (o.reducedMotion) { snapHome(); return; }
    flying = true;
    flightStart = clock;
    o.onStart?.();
  }

  function snapHome() {
    flying = false;
    for (let i = 0; i < n; i++) { x[i] = hx[i]; y[i] = hy[i]; vx[i] = 0; vy[i] = 0; }
    settled = true;
  }

  function wantsLoop() {
    if (!canRun() || o.reducedMotion) return false;
    if (flying || !settled || pointer.on) return true;
    if (mix !== (mode === 'photo' ? 1 : 0)) return true;
    return mode === 'pixels'; // shimmer
  }

  function kick() {
    if (destroyed) return;
    if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(frame); }
  }

  function frame(t) {
    raf = 0;
    if (destroyed) return;
    maybeStart();
    const dt = Math.min(0.05, Math.max(0, (t - lastT) / 1000));
    const onlyShimmer = !flying && settled && !pointer.on && mix === 0 && mode === 'pixels';
    // idle shimmer runs at ~30fps to spare the battery
    if (onlyShimmer && (skipToggle = !skipToggle)) {
      if (wantsLoop()) raf = requestAnimationFrame(frame);
      return;
    }
    lastT = t;
    clock += dt;
    update(dt);
    draw();
    if (wantsLoop()) raf = requestAnimationFrame(frame);
  }

  function update(dt) {
    // crossfade
    const target = mode === 'photo' ? 1 : 0;
    if (o.reducedMotion) mix = target;
    else if (mix !== target) {
      mix = clamp(mix + Math.sign(target - mix) * (dt / MIX_TIME), 0, 1);
      if (Math.abs(mix - target) < 1e-3) mix = target;
    }
    if (mix > 0 && !photoCanvas) buildPhoto();

    if (flying) {
      if (clock - flightStart >= flightTotal) {
        snapHome();
        o.onAssembled?.();
      }
      return;
    }
    if (o.reducedMotion) return;

    const physics = !settled || pointer.on;
    const shimmer = mode === 'pixels' && mix < 1;
    if (shimmer) {
      const spawn = Math.max(1, Math.round(n * 0.003));
      for (let s = 0; s < spawn; s++) {
        const i = (rand() * n) | 0;
        flick[i] = (rand() < 0.5 ? -1 : 1) * (28 + rand() * 40);
      }
    }
    const decay = Math.exp(-dt * 7);
    const R = Math.max(36, Math.min(W, H) * 0.3);
    const R2 = R * R;
    let maxD = 0, maxV = 0;
    for (let i = 0; i < n; i++) {
      if (flick[i] !== 0) {
        flick[i] *= decay;
        if (Math.abs(flick[i]) < 2) flick[i] = 0;
      }
      if (!physics) continue;
      let ax = SPRING_K * (hx[i] - x[i]) - SPRING_C * vx[i];
      let ay = SPRING_K * (hy[i] - y[i]) - SPRING_C * vy[i];
      if (pointer.on) {
        const dx = x[i] - pointer.x, dy = y[i] - pointer.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < R2) {
          const d = Math.sqrt(d2) + 0.001;
          const f = (1 - d / R);
          const push = f * f * PUSH / d;
          ax += dx * push; ay += dy * push;
        }
      }
      vx[i] += ax * dt; vy[i] += ay * dt;
      x[i] += vx[i] * dt; y[i] += vy[i] * dt;
      const dd = Math.abs(hx[i] - x[i]) + Math.abs(hy[i] - y[i]);
      if (dd > maxD) maxD = dd;
      const vv = Math.abs(vx[i]) + Math.abs(vy[i]);
      if (vv > maxV) maxV = vv;
    }
    if (physics && !pointer.on && maxD < 0.25 && maxV < 3) snapHome();
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = o.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!n || (!started && !o.reducedMotion)) return;
    if (o.reducedMotion && !started) started = true;

    const fade = mix * mix * (3 - 2 * mix);
    const alpha = 1 - fade;
    if (alpha > 0.002) {
      ctx.globalAlpha = alpha;
      if (flying) drawFlight();
      else drawSettled(1 - 0.55 * fade);
    }
    if (fade > 0.002 && photoCanvas) {
      ctx.globalAlpha = fade;
      ctx.drawImage(photoCanvas, 0, 0);
    }
    ctx.globalAlpha = 1;
  }

  function drawSettled(shrink) {
    const s = Math.max(1, Math.round((cell - o.gap) * dpr * shrink));
    const half = s / 2;
    for (let l = 0; l < levelLists.length; l++) {
      const list = levelLists[l];
      if (!list.length) continue;
      ctx.fillStyle = GREYS[grey[list[0]]];
      for (let j = 0; j < list.length; j++) {
        const i = list[j];
        if (flick[i] !== 0) continue;
        ctx.fillRect(Math.round(x[i] * dpr - half), Math.round(y[i] * dpr - half), s, s);
      }
    }
    for (let i = 0; i < n; i++) {
      if (flick[i] === 0 || glyph[i]) continue;
      ctx.fillStyle = GREYS[clamp(Math.round(grey[i] + flick[i]), 12, 255)];
      ctx.fillRect(Math.round(x[i] * dpr - half), Math.round(y[i] * dpr - half), s, s);
    }
    if (sprite) {
      for (let j = 0; j < glyphList.length; j++) {
        const i = glyphList[j];
        ctx.drawImage(sprite, Math.round(x[i] * dpr - half), Math.round(y[i] * dpr - half), s, s);
      }
    }
  }

  function drawFlight() {
    const ft = clock - flightStart;
    const base = (cell - o.gap) * dpr;
    const s = Math.round(base);
    const half = s / 2;
    const baseAlpha = ctx.globalAlpha;
    // pass 1: landed tiles
    let last = -1;
    for (let i = 0; i < n; i++) {
      if (ft - delay[i] < FLIGHT_DUR) continue;
      if (glyph[i] && sprite) {
        ctx.drawImage(sprite, Math.round(hx[i] * dpr - half), Math.round(hy[i] * dpr - half), s, s);
        continue;
      }
      if (grey[i] !== last) { last = grey[i]; ctx.fillStyle = GREYS[last]; }
      ctx.fillRect(Math.round(hx[i] * dpr - half), Math.round(hy[i] * dpr - half), s, s);
    }
    // pass 2: tiles in the air, nearer = bigger and fainter
    for (let i = 0; i < n; i++) {
      const p = (ft - delay[i]) / FLIGHT_DUR;
      if (p <= 0 || p >= 1) continue;
      const q = 1 - p;
      const e = 1 - q * q * q;
      const scale = 1 + (sz[i] - 1) * Math.pow(q, 2.2);
      const px = (sx[i] + (hx[i] - sx[i]) * e) * dpr;
      const py = (sy[i] + (hy[i] - sy[i]) * e) * dpr;
      const size = base * scale;
      ctx.globalAlpha = baseAlpha * Math.min(1, p * 2.4) * (0.55 + 0.45 * (1 / scale));
      if (glyph[i] && sprite) {
        ctx.drawImage(sprite, px - size / 2, py - size / 2, size, size);
        continue;
      }
      if (grey[i] !== last) { last = grey[i]; ctx.fillStyle = GREYS[last]; }
      ctx.fillRect(px - size / 2, py - size / 2, size, size);
    }
    ctx.globalAlpha = baseAlpha;
  }

  // ── input ─────────────────────────────────────────────────
  function local(e) {
    const r = canvas.getBoundingClientRect();
    pointer.x = (e.clientX - r.left) * (W / (r.width || 1));
    pointer.y = (e.clientY - r.top) * (H / (r.height || 1));
  }
  const interactive = () => !o.reducedMotion && mode === 'pixels' && !flying && n > 0;
  function onMove(e) {
    if (!interactive()) return;
    local(e);
    pointer.on = true;
    settled = false;
    kick();
  }
  function onDown(e) {
    if (!interactive()) return;
    local(e);
    pointer.on = true;
    settled = false;
    // a poke: radial kick around the contact point
    const R = Math.max(40, Math.min(W, H) * 0.42);
    for (let i = 0; i < n; i++) {
      const dx = x[i] - pointer.x, dy = y[i] - pointer.y;
      const d = Math.hypot(dx, dy) + 0.001;
      if (d > R) continue;
      const f = (1 - d / R) * 520 / d;
      vx[i] += dx * f; vy[i] += dy * f;
    }
    kick();
  }
  function onLeave() { pointer.on = false; kick(); }
  function onUp(e) { if (e.pointerType !== 'mouse') onLeave(); }

  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('pointercancel', onLeave);
  canvas.addEventListener('pointerup', onUp);

  // ── observers ─────────────────────────────────────────────
  const ro = new ResizeObserver(() => {
    if (destroyed) return;
    const pw = W, ph = H;
    measure();
    if (Math.abs(pw - W) < 0.5 && Math.abs(ph - H) < 0.5 && n) { draw(); return; }
    resample();
    if (started && !flying) snapHome();
    maybeStart();
    draw();
    kick();
  });
  ro.observe(canvas);

  const io = new IntersectionObserver((entries) => {
    const e = entries[entries.length - 1];
    visible = e.isIntersecting;
    if (visible) kick();
  });
  io.observe(canvas);

  function onVis() {
    docVisible = !document.hidden;
    if (docVisible) kick();
  }
  document.addEventListener('visibilitychange', onVis);

  const ready = loadImage(o.src).then((im) => {
    if (destroyed) return;
    img = im;
    measure();
    resample();
    maybeStart();
    draw();
    kick();
  });

  return {
    ready,
    setMode(m) {
      mode = m === 'photo' ? 'photo' : 'pixels';
      if (mode === 'photo') { pointer.on = false; if (!photoCanvas) buildPhoto(); }
      if (o.reducedMotion) { mix = mode === 'photo' ? 1 : 0; draw(); return; }
      kick();
    },
    getMode: () => mode,
    replay() {
      if (!img) return;
      mode = 'pixels'; mix = 0;
      started = false; flying = false;
      maybeStart();
      draw();
      kick();
    },
    skip() {
      if (!img || (!flying && started)) return;
      started = true;
      snapHome();
      o.onAssembled?.();
      draw();
      kick();
    },
    isAssembling: () => flying || (!started && !o.reducedMotion && !!img),
    count: () => n,
    resize() { measure(); resample(); if (started && !flying) snapHome(); draw(); kick(); },
    destroy() {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('pointercancel', onLeave);
      canvas.removeEventListener('pointerup', onUp);
      photoCanvas = null; sprite = null; img = null;
    },
  };
}
