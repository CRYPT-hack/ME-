// Generative TV covers for the Home "Now showing" set. One small painter per
// repo.cover kind, seeded by the repo slug so every channel always looks the
// same. Everything is drawn with 2D canvas primitives; no assets.
import { seeded } from '../../os/ui.js';

/**
 * Paint a cover for `repo` into ctx (w × h, already in device pixels).
 * @param {CanvasRenderingContext2D} ctx
 */
export function drawCover(ctx, w, h, repo) {
  const rnd = seeded(repo.slug || 'x');
  const paint = PAINTERS[repo.cover] || PAINTERS.grid;
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  paint(ctx, w, h, rnd);
  // shared lower shade so the title overlay always reads
  const g = ctx.createLinearGradient(0, h * 0.45, 0, h);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,.72)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Draw a real screenshot, cover-fitted, with the same shade. */
export function drawImageCover(ctx, w, h, img) {
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const iw = img.naturalWidth * s, ih = img.naturalHeight * s;
  ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
  const g = ctx.createLinearGradient(0, h * 0.4, 0, h);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,.75)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function sky(ctx, w, h, top, bottom) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function glow(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

const PAINTERS = {
  // isometric blocks growing out of a grid: a city made of files
  city(ctx, w, h, rnd) {
    sky(ctx, w, h, '#0b1640', '#1b0f33');
    glow(ctx, w * 0.75, h * 0.2, w * 0.4, 'rgba(255,120,80,.35)');
    const n = 7;
    const tile = Math.min(w, h) / 9.5;
    const ox = w / 2, oy = h * 0.32;
    const iso = (i, j) => [ox + (i - j) * tile * 0.87, oy + (i + j) * tile * 0.5];
    for (let s = 0; s < n * 2 - 1; s++) {
      for (let i = 0; i < n; i++) {
        const j = s - i;
        if (j < 0 || j >= n) continue;
        const ht = (0.3 + rnd() ** 2 * 3.2) * tile;
        const [x, y] = iso(i, j);
        const hue = 190 + rnd() * 50;
        const tw = tile * 0.87 * 0.82, th = tile * 0.5 * 0.82;
        // left face
        ctx.fillStyle = `hsl(${hue} 55% 32%)`;
        ctx.beginPath();
        ctx.moveTo(x - tw, y); ctx.lineTo(x, y + th); ctx.lineTo(x, y + th - ht); ctx.lineTo(x - tw, y - ht); ctx.closePath();
        ctx.fill();
        // right face
        ctx.fillStyle = `hsl(${hue} 50% 22%)`;
        ctx.beginPath();
        ctx.moveTo(x + tw, y); ctx.lineTo(x, y + th); ctx.lineTo(x, y + th - ht); ctx.lineTo(x + tw, y - ht); ctx.closePath();
        ctx.fill();
        // top
        ctx.fillStyle = `hsl(${hue} 70% 62%)`;
        ctx.beginPath();
        ctx.moveTo(x, y - ht - th); ctx.lineTo(x + tw, y - ht); ctx.lineTo(x, y + th - ht); ctx.lineTo(x - tw, y - ht); ctx.closePath();
        ctx.fill();
        // lit windows
        ctx.fillStyle = 'rgba(255,214,120,.85)';
        const rows = Math.floor(ht / (tile * 0.28));
        for (let r = 1; r < rows; r++) {
          if (rnd() < 0.45) continue;
          const wy = y - ht + r * tile * 0.28;
          ctx.fillRect(x - tw * 0.7, wy + th * 0.2, tw * 0.22, tile * 0.08);
          if (rnd() < 0.5) ctx.fillRect(x - tw * 0.35, wy + th * 0.4, tw * 0.22, tile * 0.08);
        }
      }
    }
  },

  // nodes around a shared desk: agents in one workspace
  grid(ctx, w, h, rnd) {
    sky(ctx, w, h, '#1a0b3a', '#0c1d3d');
    ctx.strokeStyle = 'rgba(140,170,255,.12)';
    ctx.lineWidth = Math.max(1, w / 400);
    const step = w / 16;
    for (let x = 0; x < w; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    const cx = w / 2, cy = h * 0.42;
    const k = 5 + Math.floor(rnd() * 3);
    const R = Math.min(w, h) * 0.3;
    const pts = [];
    for (let i = 0; i < k; i++) {
      const a = (i / k) * Math.PI * 2 + rnd() * 0.4;
      pts.push([cx + Math.cos(a) * R * (0.8 + rnd() * 0.4), cy + Math.sin(a) * R * 0.75]);
    }
    ctx.lineWidth = Math.max(1.5, w / 260);
    pts.forEach(([x, y], i) => {
      ctx.strokeStyle = `hsla(${260 + i * 25} 90% 70% / .55)`;
      ctx.setLineDash([w / 80, w / 120]);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();
    });
    ctx.setLineDash([]);
    glow(ctx, cx, cy, R * 0.7, 'rgba(160,120,255,.45)');
    ctx.fillStyle = '#e8e0ff';
    const s = w / 22;
    ctx.fillRect(cx - s, cy - s * 0.6, s * 2, s * 1.2);
    pts.forEach(([x, y], i) => {
      const r = w / 40;
      ctx.fillStyle = `hsl(${260 + i * 25} 85% 65%)`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.8)';
      ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.3, 0, Math.PI * 2); ctx.fill();
    });
  },

  // top-down road with detection boxes
  scan(ctx, w, h, rnd) {
    sky(ctx, w, h, '#0d1a12', '#06100a');
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-0.35);
    ctx.fillStyle = '#1f2a24';
    ctx.fillRect(-w, -h * 0.18, w * 2, h * 0.36);
    ctx.strokeStyle = 'rgba(230,230,200,.5)';
    ctx.setLineDash([w / 30, w / 40]);
    ctx.lineWidth = Math.max(1, w / 300);
    ctx.beginPath(); ctx.moveTo(-w, 0); ctx.lineTo(w, 0); ctx.stroke();
    ctx.setLineDash([]);
    for (let i = 0; i < 5; i++) {
      const x = -w * 0.6 + i * w * 0.3 + rnd() * w * 0.1;
      const y = (rnd() < 0.5 ? -1 : 1) * h * 0.08;
      const vw = w * (0.08 + rnd() * 0.06), vh = h * 0.08;
      ctx.fillStyle = `hsl(${rnd() * 60} 20% ${45 + rnd() * 20}%)`;
      ctx.fillRect(x - vw / 2, y - vh / 2, vw, vh);
      if (i % 2 === 0) {
        ctx.strokeStyle = '#7dff8a';
        ctx.lineWidth = Math.max(1.5, w / 220);
        ctx.strokeRect(x - vw / 2 - 4, y - vh / 2 - 4, vw + 8, vh + 8);
        ctx.fillStyle = '#7dff8a';
        ctx.font = `${Math.round(w / 40)}px monospace`;
        ctx.fillText(`truck ${(0.8 + rnd() * 0.19).toFixed(2)}`, x - vw / 2 - 4, y - vh / 2 - 8);
      }
    }
    ctx.restore();
    // crosshair
    ctx.strokeStyle = 'rgba(125,255,138,.4)';
    ctx.lineWidth = Math.max(1, w / 400);
    ctx.beginPath(); ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.28, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w / 2, h * 0.1); ctx.lineTo(w / 2, h * 0.9); ctx.moveTo(w * 0.15, h / 2); ctx.lineTo(w * 0.85, h / 2); ctx.stroke();
  },

  // stacked sine waves: voice, sound, a price chart
  wave(ctx, w, h, rnd) {
    sky(ctx, w, h, '#05223f', '#0a0f2e');
    glow(ctx, w * 0.5, h * 0.45, w * 0.45, 'rgba(60,180,255,.25)');
    const lines = 7;
    for (let l = 0; l < lines; l++) {
      const amp = h * (0.04 + rnd() * 0.12);
      const freq = 1.5 + rnd() * 3;
      const ph = rnd() * 6.28;
      ctx.strokeStyle = `hsla(${185 + l * 14} 90% ${55 + l * 4}% / ${0.35 + l / lines * 0.5})`;
      ctx.lineWidth = Math.max(1.5, w / (180 + l * 30));
      ctx.beginPath();
      for (let x = 0; x <= w; x += w / 120) {
        const t = x / w;
        const env = Math.sin(t * Math.PI);
        const y = h * 0.45 + Math.sin(t * freq * 6.28 + ph) * amp * env + (l - lines / 2) * h * 0.02;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  },

  // a closed race loop with cars
  track(ctx, w, h, rnd) {
    sky(ctx, w, h, '#13361c', '#0b2212');
    const cx = w / 2, cy = h * 0.44;
    const pts = [];
    const N = 120;
    const wob = [rnd(), rnd(), rnd()];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const r = 1 + 0.18 * Math.sin(a * 2 + wob[0] * 6) + 0.12 * Math.sin(a * 3 + wob[1] * 6);
      pts.push([cx + Math.cos(a) * w * 0.33 * r, cy + Math.sin(a) * h * 0.3 * r]);
    }
    const path = () => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#e5372b'; ctx.lineWidth = w / 22; path(); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.setLineDash([w / 60, w / 60]); ctx.lineWidth = w / 22; path(); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = '#3a3d42'; ctx.lineWidth = w / 26; path(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.setLineDash([w / 50, w / 40]); ctx.lineWidth = Math.max(1, w / 300); path(); ctx.stroke();
    ctx.setLineDash([]);
    for (let c = 0; c < 10; c++) {
      const p = pts[Math.floor((c / 10 + rnd() * 0.04) * N) % N];
      ctx.fillStyle = `hsl(${c * 36} 85% 58%)`;
      ctx.beginPath(); ctx.arc(p[0], p[1], w / 90, 0, Math.PI * 2); ctx.fill();
    }
  },

  // drafting grid with a redline cloud
  blueprint(ctx, w, h, rnd) {
    sky(ctx, w, h, '#0f3f8f', '#0a2c6a');
    ctx.strokeStyle = 'rgba(255,255,255,.12)';
    ctx.lineWidth = 1;
    const step = w / 24;
    for (let x = 0; x < w; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,255,255,.85)';
    ctx.lineWidth = Math.max(1.5, w / 260);
    const bx = w * 0.18, by = h * 0.16, bw = w * 0.64, bh = h * 0.5;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.strokeRect(bx + bw * 0.08, by + bh * 0.12, bw * 0.35, bh * 0.45);
    ctx.beginPath(); ctx.arc(bx + bw * 0.72, by + bh * 0.4, bh * 0.22, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(bx + bw * 0.72, by + bh * 0.4, bh * 0.08, 0, Math.PI * 2); ctx.stroke();
    // dimension line
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(bx, by - h * 0.05); ctx.lineTo(bx + bw, by - h * 0.05); ctx.stroke();
    // redline cloud
    ctx.strokeStyle = '#ff5a4f';
    ctx.lineWidth = Math.max(2, w / 180);
    const ccx = bx + bw * 0.72, ccy = by + bh * 0.4, cr = bh * 0.32;
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a0 = (i / 12) * Math.PI * 2, a1 = ((i + 1) / 12) * Math.PI * 2;
      const mx = ccx + Math.cos((a0 + a1) / 2) * cr * 1.12, my = ccy + Math.sin((a0 + a1) / 2) * cr * 1.12;
      if (i === 0) ctx.moveTo(ccx + Math.cos(a0) * cr, ccy + Math.sin(a0) * cr);
      ctx.quadraticCurveTo(mx, my, ccx + Math.cos(a1) * cr, ccy + Math.sin(a1) * cr);
    }
    ctx.stroke();
    void rnd;
  },

  // green phosphor code
  terminal(ctx, w, h, rnd) {
    sky(ctx, w, h, '#03110a', '#020805');
    const fs = Math.max(9, Math.round(w / 34));
    ctx.font = `${fs}px monospace`;
    const words = ['const', 'await', 'fetch()', 'return', 'git', 'push', '=>', '{ }', 'def', 'import', 'POST', '/api', '200 OK', 'true', 'null', 'quiz()', 'streak++'];
    let y = fs * 1.6;
    while (y < h * 0.9) {
      let x = fs + Math.floor(rnd() * 3) * fs * 1.5;
      const n = 2 + Math.floor(rnd() * 5);
      for (let i = 0; i < n && x < w - fs * 4; i++) {
        const word = words[Math.floor(rnd() * words.length)];
        ctx.fillStyle = rnd() < 0.2 ? '#ffd166' : `rgba(125,255,138,${0.5 + rnd() * 0.5})`;
        ctx.fillText(word, x, y);
        x += ctx.measureText(word + ' ').width;
      }
      y += fs * 1.35;
    }
    ctx.fillStyle = '#7dff8a';
    ctx.fillRect(fs, y - fs * 0.9, fs * 0.6, fs);
  },

  // one bright point and its rings: the first commit
  origin(ctx, w, h, rnd) {
    sky(ctx, w, h, '#05050c', '#0c0a1c');
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = `rgba(255,255,255,${rnd() * 0.6})`;
      ctx.fillRect(rnd() * w, rnd() * h, 1.5, 1.5);
    }
    const cx = w / 2, cy = h * 0.42;
    ctx.strokeStyle = 'rgba(255,214,120,.25)';
    for (let r = 1; r < 6; r++) {
      ctx.lineWidth = Math.max(1, w / 400);
      ctx.beginPath(); ctx.arc(cx, cy, r * Math.min(w, h) * 0.07, 0, Math.PI * 2); ctx.stroke();
    }
    glow(ctx, cx, cy, Math.min(w, h) * 0.3, 'rgba(255,200,90,.6)');
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(cx, cy, Math.min(w, h) * 0.02, 0, Math.PI * 2); ctx.fill();
  },
};
