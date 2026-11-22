// Thumbnail art for the File Explorer (and the Viewer's README header).
// Every repo gets a small generative cover seeded by its slug, painted from
// its languages' colours; repos with a real screenshot use that instead.
// Folders get a folder with the covers of what is inside peeking out.
// Canvases are cached, so the bombardment can draw the exact same pixels the
// grid shows.
import { seeded, loadImage } from '../../os/ui.js';
import { languageColors } from '../../data/repos.js';

export const THUMB_W = 96;
export const THUMB_H = 72;
const SCALE = 2; // cover canvases are drawn at 2x for crisp HiDPI thumbnails

const cache = new Map();   // key -> { canvas, url }
const photos = new Map();  // src -> HTMLImageElement
let photoPromise = null;

/** A stable colour for any language/tool name. */
export function langColor(name) {
  if (languageColors[name]) return languageColors[name];
  let hsh = 0;
  for (const c of String(name)) hsh = (hsh * 31 + c.charCodeAt(0)) | 0;
  return hslHex(Math.abs(hsh) % 360, 0.52, 0.48);
}

function hslHex(hu, sa, li) {
  const k = (n) => (n + hu / 30) % 12;
  const a = sa * Math.min(li, 1 - li);
  const f = (n) => Math.round(255 * (li - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
  return '#' + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

/** Preload every screenshot the explorer shows (repo.image + repo.images). */
export function preloadPhotos(repos) {
  if (photoPromise) return photoPromise;
  const srcs = new Set();
  for (const r of repos) {
    if (r.image) srcs.add(r.image);
    for (const s of r.images || []) srcs.add(s);
  }
  photoPromise = Promise.all([...srcs].map((src) => loadImage(src)
    .then((img) => { photos.set(src, img); })
    .catch(() => { /* a missing screenshot just keeps the generative cover */ })))
    .then(() => {
      // screenshots arrived: drop cached covers that should now use them
      for (const k of [...cache.keys()]) if (k.startsWith('repo:') || k.startsWith('dir:') || k.startsWith('img:')) cache.delete(k);
    });
  return photoPromise;
}

export const photoFor = (src) => photos.get(src) || null;

function entry(key, w, h, paint) {
  let e = cache.get(key);
  if (e) return e;
  const canvas = document.createElement('canvas');
  canvas.width = w * SCALE;
  canvas.height = h * SCALE;
  const g = canvas.getContext('2d');
  g.scale(SCALE, SCALE);
  paint(g, w, h);
  e = { canvas, url: null };
  cache.set(key, e);
  return e;
}

/** data URL for an entry (lazily encoded once). */
function urlOf(e) {
  if (!e.url) {
    try { e.url = e.canvas.toDataURL('image/png'); } catch { e.url = ''; }
  }
  return e.url;
}

/** Cover for a repo: { canvas, url }. */
export function repoCover(repo, w = THUMB_W, h = THUMB_H) {
  const e = entry(`repo:${repo.slug}:${w}x${h}`, w, h, (g) => paintRepo(g, w, h, repo));
  return { canvas: e.canvas, get url() { return urlOf(e); } };
}

/** Folder thumbnail with up to three covers peeking out. */
export function folderThumb(key, inside, w = THUMB_W, h = THUMB_H) {
  const e = entry(`dir:${key}:${w}x${h}`, w, h, (g) => paintFolder(g, w, h, inside));
  return { canvas: e.canvas, get url() { return urlOf(e); } };
}

/** A screenshot cropped to the thumbnail box (cover fit), on white. */
export function imageThumb(src, w = THUMB_W, h = THUMB_H) {
  const img = photos.get(src);
  if (!img) return null;
  const e = entry(`img:${src}:${w}x${h}`, w, h, (g) => {
    g.fillStyle = '#fff';
    g.fillRect(0, 0, w, h);
    coverFit(g, img, 2, 2, w - 4, h - 4);
    g.strokeStyle = 'rgba(0,0,0,.28)';
    g.strokeRect(0.5, 0.5, w - 1, h - 1);
  });
  return { canvas: e.canvas, get url() { return urlOf(e); } };
}

function coverFit(g, img, x, y, w, h) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const s = Math.max(w / iw, h / ih);
  const sw = w / s;
  const sh = h / s;
  g.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
}

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function hexToRgb(c) {
  const m = /^#([0-9a-f]{6})$/i.exec(c);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function shade(c, k) {
  const rgb = hexToRgb(c);
  if (!rgb) return c;
  const f = (v) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k);
  return `rgb(${f(rgb[0])},${f(rgb[1])},${f(rgb[2])})`;
}
function alpha(c, a) {
  const rgb = hexToRgb(c);
  if (!rgb) return c;
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
}

// ── repo covers ───────────────────────────────────────────────────────────

/** Paint a repo cover into g (CSS px coordinates). Exported for the Viewer. */
export function paintRepo(g, w, h, repo) {
  const photo = repo.image ? photos.get(repo.image) : null;
  g.save();
  rr(g, 0, 0, w, h, Math.min(6, w * 0.06));
  g.clip();
  if (photo) {
    coverFit(g, photo, 0, 0, w, h);
  } else {
    const rnd = seeded(repo.slug);
    const cols = repo.languages.slice(0, 3).map(langColor);
    while (cols.length < 3) cols.push(cols[cols.length - 1] || '#3a6fd8');
    (PAINTERS[repo.cover] || PAINTERS.grid)(g, w, h, rnd, cols);
  }
  // gloss + language stripe
  const gl = g.createLinearGradient(0, 0, 0, h);
  gl.addColorStop(0, 'rgba(255,255,255,.22)');
  gl.addColorStop(0.42, 'rgba(255,255,255,0)');
  gl.addColorStop(1, 'rgba(0,0,0,.18)');
  g.fillStyle = gl;
  g.fillRect(0, 0, w, h);
  const stripe = Math.max(3, h * 0.05);
  let x = 0;
  const langs = repo.languages.slice(0, 4);
  langs.forEach((l, i) => {
    const sw = i === langs.length - 1 ? w - x : w * (i === 0 ? 0.5 : 0.5 / (langs.length - 1));
    g.fillStyle = langColor(l);
    g.fillRect(x, h - stripe, sw + 0.5, stripe);
    x += sw;
  });
  g.restore();
  g.strokeStyle = 'rgba(10,25,70,.45)';
  g.lineWidth = 1;
  rr(g, 0.5, 0.5, w - 1, h - 1, Math.min(6, w * 0.06));
  g.stroke();
}

function bg(g, w, h, a, b) {
  const lg = g.createLinearGradient(0, 0, w, h);
  lg.addColorStop(0, a);
  lg.addColorStop(1, b);
  g.fillStyle = lg;
  g.fillRect(0, 0, w, h);
}

const PAINTERS = {
  city(g, w, h, rnd, c) {
    bg(g, w, h, '#101a48', '#2a1240');
    const sun = g.createRadialGradient(w * 0.72, h * 0.3, 0, w * 0.72, h * 0.3, w * 0.4);
    sun.addColorStop(0, 'rgba(255,150,90,.55)');
    sun.addColorStop(1, 'rgba(255,150,90,0)');
    g.fillStyle = sun;
    g.fillRect(0, 0, w, h);
    const base = h * 0.86;
    for (let i = 0; i < 16; i++) {
      const bw = w * (0.05 + rnd() * 0.07);
      const bx = rnd() * w - bw / 2;
      const bh = h * (0.15 + rnd() * 0.6);
      const col = c[i % 3];
      g.fillStyle = shade(col, -0.45);
      g.fillRect(bx, base - bh, bw, bh);
      g.fillStyle = shade(col, -0.15);
      g.fillRect(bx, base - bh, bw * 0.55, bh);
      g.fillStyle = 'rgba(255,230,150,.75)';
      for (let wy = base - bh + 3; wy < base - 3; wy += 4) {
        if (rnd() < 0.45) g.fillRect(bx + 1.5, wy, 1.6, 1.6);
      }
    }
    g.fillStyle = '#0b0f26';
    g.fillRect(0, base, w, h - base);
  },
  grid(g, w, h, rnd, c) {
    bg(g, w, h, shade(c[0], -0.55), shade(c[1], -0.7));
    const n = 7;
    const cw = w / n;
    const rows = Math.ceil(h / cw);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < n; x++) {
        const v = rnd();
        if (v < 0.42) continue;
        g.fillStyle = alpha(c[Math.floor(rnd() * 3)], 0.35 + v * 0.55);
        rr(g, x * cw + 2, y * cw + 2, cw - 4, cw - 4, 2);
        g.fill();
      }
    }
    g.strokeStyle = 'rgba(255,255,255,.12)';
    g.lineWidth = 1;
    for (let x = 0; x <= n; x++) { g.beginPath(); g.moveTo(x * cw, 0); g.lineTo(x * cw, h); g.stroke(); }
    for (let y = 0; y <= rows; y++) { g.beginPath(); g.moveTo(0, y * cw); g.lineTo(w, y * cw); g.stroke(); }
  },
  scan(g, w, h, rnd, c) {
    bg(g, w, h, '#06281c', '#0a1424');
    const cx = w * 0.5, cy = h * 0.52;
    g.strokeStyle = 'rgba(120,255,170,.28)';
    g.lineWidth = 1;
    for (let r = 8; r < w * 0.7; r += 11) { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); }
    const a0 = rnd() * Math.PI * 2;
    const sweep = g.createLinearGradient(cx, cy, cx + Math.cos(a0) * w, cy + Math.sin(a0) * w);
    sweep.addColorStop(0, 'rgba(140,255,180,.55)');
    sweep.addColorStop(1, 'rgba(140,255,180,0)');
    g.fillStyle = sweep;
    g.beginPath();
    g.moveTo(cx, cy);
    g.arc(cx, cy, w, a0 - 0.5, a0);
    g.closePath();
    g.fill();
    for (let i = 0; i < 3; i++) {
      const bw = w * (0.14 + rnd() * 0.12), bh = bw * 0.7;
      const bx = rnd() * (w - bw), by = rnd() * (h - bh - 6);
      g.strokeStyle = shade(c[i % 3], 0.35);
      g.lineWidth = 1.4;
      g.strokeRect(bx, by, bw, bh);
      g.fillStyle = g.strokeStyle;
      g.fillRect(bx, by - 4, bw * 0.6, 4);
    }
  },
  wave(g, w, h, rnd, c) {
    bg(g, w, h, shade(c[0], -0.6), '#0d1030');
    for (let k = 0; k < 5; k++) {
      const amp = h * (0.06 + rnd() * 0.1);
      const fr = 1.5 + rnd() * 3;
      const ph = rnd() * 6;
      const y0 = h * (0.3 + k * 0.13);
      g.beginPath();
      g.moveTo(0, h);
      for (let x = 0; x <= w; x += 3) g.lineTo(x, y0 + Math.sin((x / w) * fr * Math.PI + ph) * amp);
      g.lineTo(w, h);
      g.closePath();
      g.fillStyle = alpha(c[k % 3], 0.28 + k * 0.09);
      g.fill();
    }
  },
  terminal(g, w, h, rnd, c) {
    g.fillStyle = '#10141d';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#242b3a';
    g.fillRect(0, 0, w, 9);
    ['#ff6b5e', '#ffc145', '#3fcf6b'].forEach((col, i) => {
      g.fillStyle = col;
      g.beginPath();
      g.arc(6 + i * 7, 4.5, 2.2, 0, Math.PI * 2);
      g.fill();
    });
    const pal = ['#7dff8a', '#7dd3fc', '#fde68a', '#f9a8d4', ...c.map((x) => shade(x, 0.3))];
    for (let y = 15; y < h - 8; y += 6) {
      let x = 5;
      if (rnd() < 0.3) { g.fillStyle = '#7dff8a'; g.fillRect(x, y, 3, 3); x += 6; }
      x += Math.floor(rnd() * 3) * 5;
      const segs = 1 + Math.floor(rnd() * 3);
      for (let s = 0; s < segs && x < w - 10; s++) {
        const len = 6 + rnd() * 24;
        g.fillStyle = pal[Math.floor(rnd() * pal.length)];
        g.fillRect(x, y, Math.min(len, w - 6 - x), 3);
        x += len + 3;
      }
    }
    g.fillStyle = '#7dff8a';
    g.fillRect(5, h - 12, 5, 4);
  },
  origin(g, w, h, rnd, c) {
    bg(g, w, h, '#20242e', shade(c[0], -0.5));
    const px = Math.max(4, Math.round(w / 16));
    for (let y = 0; y < h; y += px) {
      for (let x = 0; x < w; x += px) {
        const d = Math.hypot(x - w / 2, y - h / 2) / (w * 0.5);
        if (rnd() > 1.05 - d * 0.9) continue;
        g.fillStyle = alpha(c[Math.floor(rnd() * 3)], 0.15 + rnd() * 0.5 * (1 - d));
        g.fillRect(x, y, px - 1, px - 1);
      }
    }
    g.fillStyle = 'rgba(255,255,255,.9)';
    g.font = `700 ${Math.round(h * 0.34)}px ${'"JetBrains Mono", Consolas, monospace'}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('{ }', w / 2, h / 2);
  },
  track(g, w, h, rnd, c) {
    bg(g, w, h, '#1f5a2a', '#123d1b');
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const pts = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const r = 0.6 + rnd() * 0.35;
      pts.push([w / 2 + Math.cos(a) * w * 0.38 * r, h / 2 + Math.sin(a) * h * 0.34 * r]);
    }
    const path = () => {
      g.beginPath();
      for (let i = 0; i <= pts.length; i++) {
        const p = pts[i % pts.length];
        const q = pts[(i + 1) % pts.length];
        const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
        if (i === 0) g.moveTo(mx, my); else g.quadraticCurveTo(p[0], p[1], mx, my);
      }
    };
    path(); g.strokeStyle = '#e8e3d0'; g.lineWidth = 9; g.stroke();
    path(); g.strokeStyle = '#3b3f47'; g.lineWidth = 7; g.stroke();
    g.setLineDash([3, 4]);
    path(); g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 0.8; g.stroke();
    g.setLineDash([]);
    for (let i = 0; i < 4; i++) {
      const p = pts[Math.floor(rnd() * pts.length)];
      g.fillStyle = ['#e5372b', '#ffd23c', '#3d8dff', '#fff'][i];
      g.fillRect(p[0] - 2, p[1] - 1.5, 4, 3);
    }
  },
  blueprint(g, w, h, rnd) {
    bg(g, w, h, '#1d4fa8', '#143a80');
    g.strokeStyle = 'rgba(255,255,255,.13)';
    g.lineWidth = 1;
    for (let x = 0; x < w; x += 6) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, h); g.stroke(); }
    for (let y = 0; y < h; y += 6) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(w, y + 0.5); g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,.85)';
    g.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) {
      const bw = w * (0.2 + rnd() * 0.3), bh = h * (0.2 + rnd() * 0.3);
      g.strokeRect(rnd() * (w - bw), rnd() * (h - bh), bw, bh);
    }
    g.strokeStyle = '#ff6a5a';
    g.lineWidth = 1.6;
    g.beginPath();
    g.arc(w * (0.3 + rnd() * 0.4), h * (0.3 + rnd() * 0.4), h * 0.16, 0, Math.PI * 2);
    g.stroke();
  },
};

// ── folder thumbnails ───────────────────────────────────────────────────────

function paintFolder(g, w, h, inside) {
  const fw = w * 0.86;
  const fh = h * 0.86;
  const x = (w - fw) / 2;
  const y = h - fh - 1;
  // back plate + tab
  const back = g.createLinearGradient(0, y, 0, y + fh);
  back.addColorStop(0, '#ffe07a');
  back.addColorStop(1, '#e0a01c');
  g.fillStyle = back;
  g.strokeStyle = '#a87410';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(x + 3, y + fh);
  g.lineTo(x + 3, y + 8);
  g.quadraticCurveTo(x + 3, y + 4, x + 7, y + 4);
  g.lineTo(x + fw * 0.34, y + 4);
  g.lineTo(x + fw * 0.42, y + 10);
  g.lineTo(x + fw - 4, y + 10);
  g.quadraticCurveTo(x + fw, y + 10, x + fw, y + 14);
  g.lineTo(x + fw, y + fh);
  g.closePath();
  g.fill();
  g.stroke();
  // papers peeking out
  const shown = (inside || []).slice(0, 3);
  shown.forEach((r, i) => {
    const pw = fw * 0.5;
    const ph = pw * 0.75;
    const px = x + fw * 0.12 + i * fw * 0.17;
    const py = y + 13 - (i === 1 ? 3 : 0);
    g.save();
    g.translate(px + pw / 2, py + ph / 2);
    g.rotate((i - 1) * 0.09);
    g.fillStyle = '#fff';
    g.fillRect(-pw / 2 - 1.5, -ph / 2 - 1.5, pw + 3, ph + 3);
    if (r && r.slug) paintRepoInto(g, -pw / 2, -ph / 2, pw, ph, r);
    g.restore();
  });
  if (!shown.length) {
    g.fillStyle = '#fff';
    g.fillRect(x + fw * 0.18, y + 12, fw * 0.6, fh * 0.4);
  }
  // front flap
  const front = g.createLinearGradient(0, y + fh * 0.42, 0, y + fh);
  front.addColorStop(0, 'rgba(255,240,170,.97)');
  front.addColorStop(1, 'rgba(242,186,52,.98)');
  g.fillStyle = front;
  g.beginPath();
  g.moveTo(x, y + fh * 0.42);
  g.lineTo(x + fw - 1, y + fh * 0.42);
  g.lineTo(x + fw - 3, y + fh);
  g.lineTo(x + 3, y + fh);
  g.closePath();
  g.fill();
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,.45)';
  g.fillRect(x + 2, y + fh * 0.42 + 1, fw - 5, 2);
}

function paintRepoInto(g, x, y, w, h, repo) {
  g.save();
  g.translate(x, y);
  paintRepo(g, w, h, repo);
  g.restore();
}
