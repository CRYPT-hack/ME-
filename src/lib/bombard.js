// File bombardment: a few hundred thumbnails burst out of a vanishing point,
// rush at the camera and fly past the screen edges, while one tile per real
// item decelerates and lands exactly on that item's rect.
//
//   const run = bombard({ layer, targets, sound, reducedMotion, from, onLand });
//   await run;        // resolves when the last tile has landed and faded
//   run.skip();       // or skipBombard(): finish immediately
//
// targets: [{ x, y, w, h, key, image?, sprite? }] in client coordinates.
//   image  – a canvas/image drawn as the landing tile (stretched to w×h)
//   sprite – an icon name from the atlas ('folder', 'file-code', ...)
// onLand(target, index) is called once per target as its tile touches down
// (and for every remaining target when skipped), so the caller can reveal the
// real item underneath and crossfade.
//
// One full-screen canvas, one texture atlas built once, typed arrays and no
// per-frame allocations. Click, wheel, resize or any key skips.
import { icon } from '../os/icons.js';
import { repos, languageColors } from '../data/repos.js';
import { seeded, loadImage } from '../os/ui.js';
import codecityUrl from '../assets/codecity.jpg';

const CELL = 128;
const ACOLS = 8;
const AROWS = 8;
const TAU = Math.PI * 2;
const ICON_NAMES = ['folder', 'file-code', 'file-text', 'file-image', 'pdf', 'gamepad', 'music', 'terminal', 'globe', 'github'];
const LAND_FADE = 190;   // ms the landed tile takes to dissolve into the DOM item
const FLASH = 280;       // ms of the little landing glow

let atlasPromise = null;
let current = null;

/** Build the sprite atlas ahead of time (safe to call repeatedly). */
export function preloadBombard() {
  if (!atlasPromise) atlasPromise = buildAtlas().catch((err) => { atlasPromise = null; throw err; });
  return atlasPromise;
}

/** Finish the running bombardment, if any, right now. */
export function skipBombard() { current?.skip(); }

export const isBombarding = () => !!current;

function lowPower() {
  try {
    const cores = navigator.hardwareConcurrency || 4;
    return cores <= 4 || window.matchMedia('(max-width: 720px)').matches || window.matchMedia('(pointer: coarse)').matches;
  } catch { return false; }
}

/**
 * @param {{layer?:HTMLElement, targets?:Array, count?:number, sound?:{play:Function},
 *          reducedMotion?:boolean, from?:{x:number,y:number}, onLand?:Function,
 *          extras?:CanvasImageSource[]}} opts
 * @returns {Promise<void> & {skip:()=>void}}
 */
export function bombard(opts = {}) {
  const { layer = document.body, targets = [], sound, reducedMotion = false, onLand, extras = [] } = opts;
  current?.skip();

  let done = false;
  let finish = () => {};
  const landed = new Uint8Array(targets.length);
  const land = (i) => {
    if (landed[i]) return;
    landed[i] = 1;
    try { onLand?.(targets[i], i); } catch (err) { console.error(err); }
  };

  const promise = new Promise((resolve) => {
    finish = () => {
      if (done) return;
      done = true;
      for (let i = 0; i < targets.length; i++) land(i);
      teardown();
      if (current === handle) current = null;
      resolve();
    };
  });
  const handle = promise;
  handle.skip = () => finish();
  current = handle;

  let teardown = () => {};

  if (reducedMotion) {
    finish();
    return handle;
  }

  preloadBombard().then((atlas) => {
    if (done) return;
    teardown = start(atlas);
  }).catch((err) => {
    console.warn('bombard: atlas failed, skipping', err);
    finish();
  });

  // ---------------------------------------------------------------------------
  function start(atlas) {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = document.createElement('canvas');
    canvas.className = 'bombard';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    Object.assign(canvas.style, {
      position: 'fixed', left: '0', top: '0', width: `${W}px`, height: `${H}px`, pointerEvents: 'none', zIndex: '1',
    });
    const g = canvas.getContext('2d');
    layer.append(canvas);

    const vpx = opts.from?.x ?? W / 2;
    const vpy = opts.from?.y ?? H / 2;
    const diag = Math.hypot(W, H);
    const low = lowPower();
    const nL = targets.length;
    const wanted = opts.count ?? (low ? 160 : 450);
    const nF = Math.max(40, wanted - nL);
    const n = nL + nF;
    const rnd = seeded((Date.now() & 0xffff) + 7);

    // sprite table: atlas pool + extras (covers etc.) + one per lander
    const sprites = atlas.pool.slice();
    for (const ex of extras) {
      if (!ex || !ex.width) continue;
      const sp = { src: ex, sx: 0, sy: 0, sw: ex.width, sh: ex.height };
      sprites.push(sp, sp);
    }
    const poolSize = sprites.length;

    // per-tile state (typed arrays, allocated once)
    const kind = new Uint8Array(n);       // 0 flyer, 1 lander
    const stateA = new Uint8Array(n);     // 0 waiting, 1 active, 2 done
    const spr = new Int32Array(n);
    const t0 = new Float32Array(n);
    const dur = new Float32Array(n);
    const X = new Float32Array(n);
    const Y = new Float32Array(n);
    const s0 = new Float32Array(n);
    const s1 = new Float32Array(n);
    const rot0 = new Float32Array(n);
    const spin = new Float32Array(n);
    const tum0 = new Float32Array(n);
    const tumv = new Float32Array(n);
    const tw = new Float32Array(n);
    const th = new Float32Array(n);
    const amp = new Float32Array(n);
    const dirC = new Float32Array(n);
    const dirS = new Float32Array(n);
    const rad = new Float32Array(n);
    // per-frame results
    const px = new Float32Array(n);
    const py = new Float32Array(n);
    const ps = new Float32Array(n);
    const prevS = new Float32Array(n);
    const pr = new Float32Array(n);
    const pt = new Float32Array(n);
    const pa = new Float32Array(n);
    const pk = new Float32Array(n);       // sort key: scale, or -1 when hidden
    const order = new Uint16Array(n);
    for (let i = 0; i < n; i++) order[i] = i;

    // landers: one per target, staggered in reading order
    for (let i = 0; i < nL; i++) {
      const t = targets[i];
      kind[i] = 1;
      let sp = null;
      if (t.image && t.image.width) sp = { src: t.image, sx: 0, sy: 0, sw: t.image.width, sh: t.image.height };
      else if (t.sprite && atlas.icons[t.sprite]) sp = atlas.icons[t.sprite];
      else sp = atlas.icons.file || sprites[Math.floor(rnd() * poolSize)];
      spr[i] = sprites.push(sp) - 1;
      const cx = t.x + t.w / 2;
      const cy = t.y + t.h / 2;
      X[i] = cx - vpx;
      Y[i] = cy - vpy;
      tw[i] = t.w;
      th[i] = t.h;
      const len = Math.hypot(X[i], Y[i]) || 1;
      dirC[i] = -Y[i] / len;          // perpendicular, for the curved approach
      dirS[i] = X[i] / len;
      amp[i] = (rnd() - 0.5) * Math.min(240, len * 0.7 + 40);
      s0[i] = 0.045 + rnd() * 0.035;
      t0[i] = 200 + (nL > 1 ? i / (nL - 1) : 0) * 620 + rnd() * 70;
      dur[i] = 1080 + rnd() * 200;
      rot0[i] = (rnd() - 0.5) * 2.6;
      tum0[i] = rnd() < 0.45 ? (rnd() < 0.5 ? -1 : 1) * TAU * (1 + Math.floor(rnd() * 2)) * 0.5 : 0;
    }

    // flyers: three overlapping bursts, front-loaded
    for (let k = 0; k < nF; k++) {
      const i = nL + k;
      const sp = sprites[Math.floor(rnd() * poolSize)];
      spr[i] = sprites.indexOf(sp);
      const ang = rnd() * TAU;
      const r = (0.06 + Math.pow(rnd(), 0.75) * 0.95) * diag * 0.5;
      X[i] = Math.cos(ang) * r;
      Y[i] = Math.sin(ang) * r * 0.82;
      rad[i] = Math.hypot(X[i], Y[i]) || 1;
      dirC[i] = X[i] / rad[i];
      dirS[i] = Y[i] / rad[i];
      const size = (32 + rnd() * 50) * (low ? 0.9 : 1);
      const m = Math.max(sp.sw, sp.sh);
      tw[i] = size * (sp.sw / m);
      th[i] = size * (sp.sh / m);
      s0[i] = 0.05 + rnd() * 0.05;
      s1[i] = Math.min(16, Math.max(2.4, (diag * 0.75) / rad[i]));
      const wave = rnd() < 0.5 ? 0 : rnd() < 0.6 ? 1 : 2;
      t0[i] = wave * 230 + Math.pow(rnd(), 1.4) * 330;
      dur[i] = 760 + rnd() * 620;
      rot0[i] = (rnd() - 0.5) * 1.4;
      spin[i] = (rnd() - 0.5) * 5;
      tum0[i] = rnd() * TAU;
      tumv[i] = rnd() < 0.35 ? (rnd() - 0.5) * 16 : 0;
    }

    const streak = atlas.streak;
    const glow = atlas.glow;
    const A = atlas.canvas;
    let useStreaks = true;
    let slow = 0;
    let lastTick = 0;
    let begin = 0;
    let lastNow = 0;
    let raf = 0;
    let flashes = 0;

    const onKey = (e) => {
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;
      e.preventDefault();
      e.stopPropagation();
      finish();
    };
    const onPoint = () => finish();
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onPoint, true);
    window.addEventListener('wheel', onPoint, { capture: true, passive: true });
    window.addEventListener('resize', onPoint);
    // safety nets: animation time (below) and wall-clock, for a hidden tab
    // where requestAnimationFrame stops
    const safety = setTimeout(finish, 7000);

    function frame(now) {
      if (done) return;
      if (!begin) {
        begin = now;
        lastNow = now;
        sound?.play?.('whoosh');
      }
      const dt = now - lastNow;
      lastNow = now;
      if (dt > 30) { if (++slow > 5) useStreaks = false; }
      const t = now - begin;
      if (t > 4200) { finish(); return; }
      let alive = 0;
      flashes = 0;

      // update ---------------------------------------------------------------
      for (let i = 0; i < n; i++) {
        if (stateA[i] === 2) { pk[i] = -1; continue; }
        const lt = t - t0[i];
        if (lt < 0) { pk[i] = -1; alive++; continue; }
        if (stateA[i] === 0) { stateA[i] = 1; prevS[i] = s0[i]; }
        alive++;
        const u = lt / dur[i];
        prevS[i] = ps[i] || s0[i];

        if (kind[i] === 1) {
          if (u >= 1) {
            if (!landed[i]) {
              land(i);
              if (now - lastTick > 42) { sound?.play?.('tick'); lastTick = now; }
            }
            const f = (lt - dur[i]) / LAND_FADE;
            if (f >= 1 && lt - dur[i] >= FLASH) { stateA[i] = 2; pk[i] = -1; alive--; continue; }
            px[i] = vpx + X[i];
            py[i] = vpy + Y[i];
            ps[i] = 1;
            pr[i] = 0;
            pt[i] = 1;
            pa[i] = f >= 1 ? 0 : 1 - f;
            pk[i] = 1;
            flashes++;
            continue;
          }
          let s;
          if (u < 0.74) {
            const p = u / 0.74;
            const q = 1 - (1 - p) * (1 - p);
            s = 1 / (1 / s0[i] + (1 / 1.1 - 1 / s0[i]) * q);
          } else {
            const p = (u - 0.74) / 0.26;
            const e = 1 - (1 - p) * (1 - p) * (1 - p);
            s = 1.1 - 0.1 * e;
          }
          const inv = 1 - u;
          const e3 = inv * inv * inv;          // 1 → 0, eases out
          const off = amp[i] * Math.sin(Math.PI * u) * inv;
          px[i] = vpx + X[i] * s + dirC[i] * off;
          py[i] = vpy + Y[i] * s + dirS[i] * off;
          ps[i] = s;
          pr[i] = rot0[i] * e3;
          pt[i] = tum0[i] ? Math.cos(tum0[i] * e3) : 1;
          pa[i] = u * 9 > 1 ? 1 : u * 9;
          pk[i] = s;
          continue;
        }

        // flyer
        if (u >= 1) { stateA[i] = 2; pk[i] = -1; alive--; continue; }
        // depth: half linear, half ease-out, so tiles grow early and still
        // rush past the camera at the end
        const e = 0.5 * u + 0.5 * (1 - (1 - u) * (1 - u));
        const s = 1 / (1 / s0[i] + (1 / s1[i] - 1 / s0[i]) * e);
        const x = vpx + X[i] * s;
        const y = vpy + Y[i] * s;
        const half = (tw[i] > th[i] ? tw[i] : th[i]) * s * 0.75;
        if (u > 0.15 && (x + half < 0 || x - half > W || y + half < 0 || y - half > H)) {
          stateA[i] = 2; pk[i] = -1; alive--; continue;
        }
        px[i] = x;
        py[i] = y;
        ps[i] = s;
        pr[i] = rot0[i] + spin[i] * u;
        pt[i] = tumv[i] ? Math.cos(tum0[i] + tumv[i] * u) : 1;
        const fin = u * 7 > 1 ? 1 : u * 7;
        const fout = u > 0.82 ? (1 - u) / 0.18 : 1;
        pa[i] = fin * fout;
        pk[i] = s;
      }

      // cheap z sort: insertion sort on an almost-sorted index list ----------
      for (let j = 1; j < n; j++) {
        const v = order[j];
        const key = pk[v];
        let k = j - 1;
        while (k >= 0 && pk[order[k]] > key) { order[k + 1] = order[k]; k--; }
        order[k + 1] = v;
      }

      // draw ----------------------------------------------------------------
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, canvas.width, canvas.height);

      if (t < 520) {
        const k = t / 520;
        const size = 80 + k * diag * 0.55;
        g.globalAlpha = (1 - k) * (1 - k) * 0.5;
        g.setTransform(dpr, 0, 0, dpr, dpr * vpx, dpr * vpy);
        g.drawImage(A, glow.sx, glow.sy, glow.sw, glow.sh, -size / 2, -size / 2, size, size);
      }

      for (let j = 0; j < n; j++) {
        const i = order[j];
        if (pk[i] < 0) continue;
        const a = pa[i];
        const s = ps[i];
        const x = px[i];
        const y = py[i];

        if (kind[i] === 1 && landed[i]) {
          // landing glow under the settled tile
          const f = (t - t0[i] - dur[i]) / FLASH;
          if (f < 1) {
            const gs = (tw[i] > th[i] ? tw[i] : th[i]) * (1.3 + f * 0.6);
            g.globalAlpha = (1 - f) * 0.45;
            g.setTransform(dpr, 0, 0, dpr, dpr * x, dpr * y);
            g.drawImage(A, glow.sx, glow.sy, glow.sw, glow.sh, -gs / 2, -gs / 2, gs, gs);
          }
          if (a <= 0.01) continue;
        }
        if (a <= 0.01) continue;

        if (useStreaks && kind[i] === 0) {
          const v = (s - prevS[i]) * rad[i];
          if (v > 2.5) {
            const len = v * 3.2 > 420 ? 420 : v * 3.2;
            const sw = (th[i] < tw[i] ? th[i] : tw[i]) * s * 0.55;
            g.globalAlpha = a * 0.55;
            g.setTransform(dpr * dirC[i], dpr * dirS[i], -dpr * dirS[i], dpr * dirC[i], dpr * x, dpr * y);
            g.drawImage(A, streak.sx, streak.sy, streak.sw, streak.sh, -len, -sw / 2, len, sw);
          }
        }

        const sp = sprites[spr[i]];
        const c = Math.cos(pr[i]) * s * dpr;
        const sn = Math.sin(pr[i]) * s * dpr;
        const tm = pt[i];
        g.globalAlpha = a;
        g.setTransform(c * tm, sn * tm, -sn, c, dpr * x, dpr * y);
        g.drawImage(sp.src, sp.sx, sp.sy, sp.sw, sp.sh, -tw[i] / 2, -th[i] / 2, tw[i], th[i]);
      }
      g.globalAlpha = 1;

      if (alive <= 0 && flashes === 0) { finish(); return; }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(safety);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onPoint, true);
      window.removeEventListener('wheel', onPoint, { capture: true });
      window.removeEventListener('resize', onPoint);
      canvas.remove();
    };
  }

  return handle;
}

// ── atlas ───────────────────────────────────────────────────────────────────

function rasterIcon(name, size) {
  const svg = icon(name, size).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
  return loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function fit(g, text, x, y, max) {
  let t = String(text || '');
  if (g.measureText(t).width <= max) { g.fillText(t, x, y); return; }
  while (t.length > 1 && g.measureText(t + '…').width > max) t = t.slice(0, -1);
  g.fillText(t + '…', x, y);
}

async function buildAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = CELL * ACOLS;
  canvas.height = CELL * AROWS;
  const g = canvas.getContext('2d');
  const rnd = seeded('crypt-os-bombard');
  let slot = 0;
  const cell = () => {
    const s = slot++;
    return [(s % ACOLS) * CELL, Math.floor(s / ACOLS) * CELL];
  };
  const full = () => slot >= ACOLS * AROWS;
  const pool = [];
  const icons = {};
  const sprite = (sx, sy, sw, sh) => ({ src: canvas, sx, sy, sw, sh });

  try { await Promise.race([document.fonts?.ready, wait(600)]); } catch { /* fonts optional */ }

  // file-type icons (rasterised from the shell's own SVGs)
  const imgs = await Promise.all(ICON_NAMES.concat('file').map((nm) => rasterIcon(nm, 112).catch(() => null)));
  ICON_NAMES.concat('file').forEach((nm, i) => {
    if (!imgs[i]) return;
    const [x, y] = cell();
    g.drawImage(imgs[i], x + 8, y + 8, 112, 112);
    icons[nm] = sprite(x + 8, y + 8, 112, 112);
    if (nm !== 'file') pool.push(icons[nm], icons[nm], icons[nm]);
  });

  // mini repo cards
  for (const r of repos) {
    if (full()) break;
    const [x0, y0] = cell();
    const x = x0 + 2;
    const y = y0 + 22;
    const w = 124;
    const h = 84;
    const col = languageColors[r.languages[0]] || '#8a8f98';
    g.save();
    rr(g, x + 0.5, y + 0.5, w - 1, h - 1, 7);
    g.fillStyle = '#fffdf6';
    g.fill();
    g.save();
    g.clip();
    g.fillStyle = col;
    g.fillRect(x, y, w, 8);
    g.fillStyle = 'rgba(0,0,0,.07)';
    g.fillRect(x + 9, y + 50, w - 34, 4);
    g.fillRect(x + 9, y + 58, w - 52, 4);
    g.restore();
    g.strokeStyle = 'rgba(16,30,70,.5)';
    g.lineWidth = 1;
    g.stroke();
    g.textBaseline = 'top';
    g.fillStyle = '#1d1d1f';
    g.font = '700 13px "Noto Sans", Tahoma, Verdana, sans-serif';
    fit(g, r.title, x + 9, y + 15, w - 18);
    g.fillStyle = '#6b6b70';
    g.font = '9.5px "Noto Sans", Tahoma, Verdana, sans-serif';
    fit(g, r.tagline, x + 9, y + 33, w - 18);
    g.fillStyle = col;
    g.beginPath();
    g.arc(x + 14, y + 73, 4, 0, TAU);
    g.fill();
    g.fillStyle = '#4a4a4f';
    g.font = '600 9.5px "Noto Sans", Tahoma, Verdana, sans-serif';
    fit(g, r.languages[0], x + 22, y + 67, 70);
    if (r.private) {
      g.fillStyle = '#7b7b80';
      rr(g, x + w - 19, y + 68, 10, 8, 1.5);
      g.fill();
      g.strokeStyle = '#7b7b80';
      g.lineWidth = 1.6;
      g.beginPath();
      g.arc(x + w - 14, y + 68, 3, Math.PI, 0);
      g.stroke();
    }
    g.restore();
    pool.push(sprite(x - 1, y - 1, w + 2, h + 2));
  }

  // code snippet thumbnails
  const codeCols = ['#7dd3fc', '#f9a8d4', '#fde68a', '#a7f3d0', '#c4b5fd', '#94a3b8', '#fdba74'];
  for (let v = 0; v < 6 && !full(); v++) {
    const [x0, y0] = cell();
    const x = x0 + 14;
    const y = y0 + 4;
    const w = 100;
    const h = 120;
    rr(g, x, y, w, h, 6);
    g.fillStyle = '#1b1f2a';
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,.16)';
    g.stroke();
    g.fillStyle = '#272d3c';
    g.fillRect(x + 1, y + 1, w - 2, 13);
    ['#ff6b5e', '#ffc145', '#3fcf6b'].forEach((c, k) => {
      g.fillStyle = c;
      g.beginPath();
      g.arc(x + 9 + k * 8, y + 7.5, 2.6, 0, TAU);
      g.fill();
    });
    for (let ly = y + 22; ly < y + h - 8; ly += 8) {
      let lx = x + 8 + Math.floor(rnd() * 3) * 7;
      const segs = 1 + Math.floor(rnd() * 3);
      for (let k = 0; k < segs && lx < x + w - 14; k++) {
        const len = 8 + rnd() * 30;
        g.fillStyle = codeCols[Math.floor(rnd() * codeCols.length)];
        g.fillRect(lx, ly, Math.min(len, x + w - 8 - lx), 3.5);
        lx += len + 4;
      }
    }
    pool.push(sprite(x, y, w, h));
  }

  // mini windows
  for (let v = 0; v < 3 && !full(); v++) {
    const [x0, y0] = cell();
    const x = x0 + 4;
    const y = y0 + 18;
    const w = 120;
    const h = 92;
    rr(g, x, y, w, h, 5);
    g.fillStyle = '#0a46d6';
    g.fill();
    const tg = g.createLinearGradient(0, y, 0, y + 16);
    tg.addColorStop(0, '#3d8dff');
    tg.addColorStop(1, '#0a3fb4');
    g.fillStyle = tg;
    g.fillRect(x + 1, y + 1, w - 2, 15);
    g.fillStyle = '#e2553a';
    g.fillRect(x + w - 15, y + 3, 11, 11);
    g.fillStyle = '#ece9d8';
    g.fillRect(x + 3, y + 17, w - 6, h - 20);
    g.fillStyle = '#fff';
    g.fillRect(x + 8, y + 23, w - 16, h - 32);
    for (let k = 0; k < 6; k++) {
      g.fillStyle = ['#f2c044', '#3178c6', '#e34c26', '#3fae3a', '#f1e05a', '#663399'][(k + v * 2) % 6];
      g.fillRect(x + 14 + (k % 3) * 32, y + 29 + Math.floor(k / 3) * 26, 18, 16);
    }
    pool.push(sprite(x, y, w, h));
  }

  // crops of the code-city screenshot, like little photo prints
  try {
    const img = await loadImage(codecityUrl);
    for (let v = 0; v < 5 && !full(); v++) {
      const [x0, y0] = cell();
      const x = x0 + 2;
      const y = y0 + 22;
      const w = 124;
      const h = 84;
      const z = 0.35 + rnd() * 0.5;
      const sw = img.naturalWidth * z;
      const sh = sw * (h / w);
      const sx = rnd() * (img.naturalWidth - sw);
      const sy = rnd() * Math.max(0, img.naturalHeight - sh);
      g.fillStyle = '#fff';
      g.fillRect(x, y, w, h);
      g.drawImage(img, sx, sy, sw, Math.min(sh, img.naturalHeight), x + 3, y + 3, w - 6, h - 6);
      g.strokeStyle = 'rgba(0,0,0,.35)';
      g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      const sp = sprite(x, y, w, h);
      pool.push(sp, sp);
    }
  } catch { /* screenshot optional */ }

  // motion streak: a tapered gradient, drawn behind fast tiles
  let streak = null;
  if (!full()) {
    const [x, y] = cell();
    const sg = g.createLinearGradient(x, 0, x + CELL, 0);
    sg.addColorStop(0, 'rgba(190,220,255,0)');
    sg.addColorStop(0.7, 'rgba(210,230,255,.45)');
    sg.addColorStop(1, 'rgba(255,255,255,.9)');
    g.fillStyle = sg;
    g.beginPath();
    g.moveTo(x, y + 32);
    g.lineTo(x + CELL - 8, y + 4);
    g.quadraticCurveTo(x + CELL, y + 32, x + CELL - 8, y + 60);
    g.closePath();
    g.fill();
    streak = sprite(x, y, CELL, 64);
  }

  // soft glow for the burst and the landings
  let glow = null;
  if (!full()) {
    const [x, y] = cell();
    const rg = g.createRadialGradient(x + 64, y + 64, 0, x + 64, y + 64, 63);
    rg.addColorStop(0, 'rgba(255,255,255,.95)');
    rg.addColorStop(0.35, 'rgba(170,210,255,.45)');
    rg.addColorStop(1, 'rgba(120,170,255,0)');
    g.fillStyle = rg;
    g.fillRect(x, y, CELL, CELL);
    glow = sprite(x, y, CELL, CELL);
  }

  if (!pool.length) throw new Error('empty atlas');
  return { canvas, pool, icons, streak: streak || pool[0], glow: glow || pool[0] };
}
