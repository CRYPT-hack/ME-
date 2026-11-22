// The "Now showing" CRT. A canvas screen that flips between featured repos
// with a burst of static. Everything is drawn on demand: the canvas only
// animates for the ~half second of a channel change.
import { h } from '../../os/ui.js';
import { drawCover, drawImageCover } from './covers.js';

const DWELL = 4000;   // ms on each channel
const STEP = 200;     // auto-advance timer resolution
const NOISE_IN = 190; // ms of pure static
const NOISE_OUT = 470;

export function createTV(mount, { channels, reduced, sound, loadImage, onOpen, onChange }) {
  const n = channels.length;
  let idx = 0;
  let prevIdx = -1;
  let raf = 0;
  let tStart = 0;
  let switching = false;
  let textSwapped = true;
  let elapsed = 0;
  let hidden = false;
  let hovering = false;
  let focusInside = false;
  let inView = true;
  let destroyed = false;
  let rot = 0;
  let cw = 0, ch = 0;

  const covers = new Map(); // slug -> canvas
  const images = new Map(); // slug -> HTMLImageElement

  // --- DOM -----------------------------------------------------------------
  const canvas = h('canvas.tv__canvas', { 'aria-hidden': 'true' });
  const g = canvas.getContext('2d');
  const noise = document.createElement('canvas');
  const ng = noise.getContext('2d');
  let noiseData = null;

  const osd = h('span.tv__osd', { 'aria-hidden': 'true' }, 'CH 01');
  const badge = h('span.tv__badge');
  const title = h('strong.tv__title');
  const tag = h('span.tv__tag');
  const info = h('span.tv__info', {}, badge, title, tag);
  const bar = h('i');
  const progress = h('span.tv__progress', { 'aria-hidden': 'true' }, bar);
  const screen = h('button.tv__screen', { type: 'button', onclick: () => onOpen(channels[idx]) },
    canvas,
    h('span.tv__fx.tv__scan', { 'aria-hidden': 'true' }),
    h('span.tv__fx.tv__roll', { 'aria-hidden': 'true' }),
    h('span.tv__fx.tv__vignette', { 'aria-hidden': 'true' }),
    h('span.tv__fx.tv__glare', { 'aria-hidden': 'true' }),
    osd,
    h('span.tv__air', { 'aria-hidden': 'true' }, h('i'), 'ON AIR'),
    info, progress);

  const lcd = h('span.tv__lcd', { 'aria-hidden': 'true' }, '01');
  const dialUp = h('span.tv__dial');
  const dialDown = h('span.tv__dial');
  const knobUp = h('button.tv__knob', { type: 'button', 'aria-label': 'Next channel', onclick: () => next(1) }, dialUp);
  const knobDown = h('button.tv__knob', { type: 'button', 'aria-label': 'Previous channel', onclick: () => next(-1) }, dialDown);

  const panel = h('div.tv__panel', {},
    h('span.tv__brand', { 'aria-hidden': 'true' }, 'CRYPT', h('b', {}, 'VISION')),
    lcd,
    h('div.tv__knobs', {},
      h('div.tv__knobwrap', {}, knobDown, h('span.tv__knoblabel', { 'aria-hidden': 'true' }, 'CH −')),
      h('div.tv__knobwrap', {}, knobUp, h('span.tv__knoblabel', { 'aria-hidden': 'true' }, 'CH +'))),
    h('span.tv__grille', { 'aria-hidden': 'true' }),
    h('span.tv__power', { 'aria-hidden': 'true' }, h('i'), 'POWER'));

  const dots = channels.map((r, i) => h('button.tv__dot', {
    type: 'button', 'aria-label': `Channel ${i + 1}: ${r.title}`, onclick: () => go(i, i > idx ? 1 : -1),
  }));
  const desc = h('p.tv__desc');
  const langs = h('p.tv__langs');
  const live = h('span.sr-only', { 'aria-live': 'polite' });

  const tv = h('div.tv', {},
    h('div.tv__set', {},
      h('span.tv__antenna', { 'aria-hidden': 'true' }),
      h('div.tv__cabinet', {}, h('div.tv__bezel', {}, screen), panel),
      h('span.tv__feet', { 'aria-hidden': 'true' })),
    h('div.tv__below', {},
      h('div.tv__dots', { role: 'group', 'aria-label': 'Channels' }, dots),
      desc, langs),
    live);
  mount.append(tv);

  // --- text ------------------------------------------------------------------
  function setText(r, i) {
    const num = String(i + 1).padStart(2, '0');
    osd.textContent = `CH ${num}`;
    lcd.textContent = num;
    badge.textContent = r.private ? 'Private repository' : 'Public repo';
    badge.classList.toggle('is-private', !!r.private);
    title.textContent = r.title;
    tag.textContent = r.tagline;
    desc.textContent = r.description;
    langs.textContent = r.languages.join(' · ');
    screen.setAttribute('aria-label', `Now showing ${r.title}: ${r.tagline}. Open in the File Explorer`);
    dots.forEach((d, k) => d.setAttribute('aria-current', k === i ? 'true' : 'false'));
    onChange?.(r);
  }

  // --- drawing ---------------------------------------------------------------
  function coverFor(r) {
    let c = covers.get(r.slug);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = cw; c.height = ch;
    const cg = c.getContext('2d');
    const img = images.get(r.slug);
    if (img) drawImageCover(cg, cw, ch, img);
    else drawCover(cg, cw, ch, r);
    covers.set(r.slug, c);
    return c;
  }

  function paintCover(r, alpha = 1) {
    if (!cw) return;
    g.globalAlpha = alpha;
    g.drawImage(coverFor(r), 0, 0);
    g.globalAlpha = 1;
  }

  function paintNoise(alpha, t) {
    if (!noiseData) return;
    const buf = new Uint32Array(noiseData.data.buffer);
    for (let i = 0; i < buf.length; i++) {
      const v = (Math.random() * 255) | 0;
      buf[i] = 0xff000000 | (v << 16) | (v << 8) | v;
    }
    ng.putImageData(noiseData, 0, 0);
    g.save();
    g.globalAlpha = alpha;
    g.imageSmoothingEnabled = false;
    // a little vertical roll while the signal is lost
    const off = ((t * 0.6) % ch) | 0;
    g.drawImage(noise, 0, off, cw, ch);
    g.drawImage(noise, 0, off - ch, cw, ch);
    // horizontal tear bands
    g.globalAlpha = alpha * 0.35;
    g.fillStyle = '#fff';
    for (let k = 0; k < 3; k++) g.fillRect(0, Math.random() * ch, cw, Math.random() * ch * 0.04);
    g.restore();
  }

  function paintStatic() {
    cancelAnimationFrame(raf);
    switching = false;
    screen.classList.remove('is-switching');
    if (!textSwapped) { textSwapped = true; setText(channels[idx], idx); }
    if (!cw) return;
    g.clearRect(0, 0, cw, ch);
    paintCover(channels[idx]);
  }

  function frame(now) {
    const t = now - tStart;
    g.clearRect(0, 0, cw, ch);
    if (t < NOISE_IN) {
      if (prevIdx >= 0) paintCover(channels[prevIdx], 1 - t / NOISE_IN);
      paintNoise(0.55 + 0.45 * (t / NOISE_IN), t);
    } else if (t < NOISE_OUT) {
      if (!textSwapped) {
        textSwapped = true;
        setText(channels[idx], idx);
        screen.classList.remove('is-switching');
        if (Math.random() < 0.6) sound?.play('tick');
      }
      paintCover(channels[idx]);
      paintNoise(1 - (t - NOISE_IN) / (NOISE_OUT - NOISE_IN), t);
    } else {
      paintStatic();
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  function go(i, dir = 1) {
    if (destroyed || !n) return;
    const target = ((i % n) + n) % n;
    if (target === idx && !switching) return;
    prevIdx = idx;
    idx = target;
    elapsed = 0;
    bar.style.transform = 'scaleX(0)';
    rot += dir * 36;
    (dir > 0 ? dialUp : dialDown).style.transform = `rotate(${rot}deg)`;
    sound?.play('tick');
    live.textContent = `Channel ${idx + 1}: ${channels[idx].title}`;
    if (!reduced) osd.animate?.([{ opacity: 1, transform: 'scale(1.15)' }, { opacity: 1, transform: 'none', offset: 0.6 }, { opacity: 0.6 }], { duration: 1600, easing: 'ease-out' });
    if (reduced || hidden || !cw) {
      textSwapped = false;
      paintStatic();
      return;
    }
    textSwapped = false;
    switching = true;
    screen.classList.add('is-switching');
    cancelAnimationFrame(raf);
    tStart = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function next(dir) { go(idx + dir, dir); }

  // --- sizing ------------------------------------------------------------------
  function resize() {
    const rect = screen.getBoundingClientRect();
    if (!rect.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(rect.width * dpr), hh = Math.round(rect.height * dpr);
    if (w === cw && hh === ch) return;
    cw = w; ch = hh;
    canvas.width = cw; canvas.height = ch;
    noise.width = Math.max(1, Math.ceil(cw / (3 * dpr)));
    noise.height = Math.max(1, Math.ceil(ch / (3 * dpr)));
    noiseData = ng.createImageData(noise.width, noise.height);
    covers.clear();
    if (!switching) paintStatic();
  }
  const ro = new ResizeObserver(() => resize());
  ro.observe(screen);

  // real screenshots, where a repo has one
  for (const r of channels) {
    if (!r.image) continue;
    loadImage(r.image).then((img) => {
      if (destroyed) return;
      images.set(r.slug, img);
      covers.delete(r.slug);
      if (channels[idx] === r && !switching) paintStatic();
    }).catch(() => { /* keep the generative cover */ });
  }

  // --- auto-advance ------------------------------------------------------------
  const paused = () => reduced || hidden || hovering || focusInside || !inView || n < 2;
  const timer = setInterval(() => {
    if (paused()) return;
    elapsed += STEP;
    bar.style.transform = `scaleX(${Math.min(1, elapsed / DWELL)})`;
    if (elapsed >= DWELL) next(1);
  }, STEP);

  const io = new IntersectionObserver((es) => { inView = es[es.length - 1].isIntersecting; }, { threshold: 0.25 });
  io.observe(screen);

  const listeners = [
    [tv, 'pointerenter', (e) => { if (e.pointerType === 'mouse') hovering = true; }],
    [tv, 'pointerleave', () => { hovering = false; }],
    [tv, 'focusin', () => { focusInside = true; }],
    [tv, 'focusout', (e) => { if (!tv.contains(e.relatedTarget)) focusInside = false; }],
    [tv, 'keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); next(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); next(-1); }
    }],
  ];
  listeners.forEach(([t, ty, fn]) => t.addEventListener(ty, fn));

  if (reduced) progress.hidden = true;
  setText(channels[0], 0);
  requestAnimationFrame(() => { if (!destroyed) resize(); });

  return {
    next,
    resize,
    skip() { if (switching) paintStatic(); },
    setHidden(v) {
      hidden = !!v;
      if (hidden && switching) paintStatic();
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      clearInterval(timer);
      ro.disconnect();
      io.disconnect();
      listeners.forEach(([t, ty, fn]) => t.removeEventListener(ty, fn));
      covers.clear();
      images.clear();
    },
  };
}
