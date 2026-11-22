// Viewer: opens one file. Three kinds:
//   { kind: 'repo', slug }          a README-style write-up of a repository
//   { kind: 'image', src, title }   an image on a checkerboard, zoom + pan
//   { kind: 'text', title, text }   plain text
import './viewer.css';
import { h, clamp } from '../../os/ui.js';
import { icon } from '../../os/icons.js';
import { repos } from '../../data/repos.js';
import { paintRepo, preloadPhotos, langColor } from '../explorer/covers.js';

const bySlug = Object.fromEntries(repos.map((r) => [r.slug, r]));

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-').map(Number);
  try { return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return iso; }
}

export function mount(body, ctx) {
  const { win, os } = ctx;
  const args = ctx.args || {};
  win.flush();
  const root = h('div.app-viewer');
  body.append(root);

  let inst = null;
  if (args.kind === 'repo' && bySlug[args.slug]) inst = repoView(root, ctx, bySlug[args.slug]);
  else if (args.kind === 'image' && typeof args.src === 'string' && args.src) inst = imageView(root, ctx, args);
  else if (args.kind === 'text') inst = textView(root, ctx, args);
  else {
    win.setTitle('Viewer');
    win.setStatus('Nothing to show');
    root.append(h('div.vw-none', {}, h('span', { html: icon('warning', 32) }), h('p', {}, 'This file could not be found. It may have moved, or it never existed.'),
      h('button.btn', { type: 'button', onclick: () => win.close() }, 'Close')));
    win.setMenu([{ label: 'File', items: [{ label: 'Close', action: () => win.close() }] }]);
    void os;
  }

  return {
    resize: () => inst?.resize?.(),
    destroy: () => inst?.destroy?.(),
  };
}

// ── repo README ───────────────────────────────────────────────────────────
function repoView(root, { win, os }, repo) {
  win.setTitle(`${repo.title} - Viewer`);
  win.setIcon('file-text');
  win.setStatus([`README.md`, repo.private ? `Updated ${fmtDate(repo.updated)}` : `${repo.repo} · updated ${fmtDate(repo.updated)}`]);
  root.classList.add('vw-doc');

  const hero = h('canvas.vw-hero', { width: 720, height: 200, 'aria-hidden': 'true' });
  const paintHero = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = 720;
    const hh = 200;
    hero.width = w * dpr;
    hero.height = hh * dpr;
    const g = hero.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintRepo(g, w, hh, repo);
  };
  paintHero();
  let alive = true;
  preloadPhotos(repos).then(() => { if (alive && repo.image) paintHero(); });

  const gh = repo.url
    ? h('a.btn.btn--primary.vw-gh', { href: repo.url, target: '_blank', rel: 'noopener noreferrer' }, h('span', { html: icon('github', 16) }), 'View on GitHub')
    : h('span.vw-badge.vw-badge--private', { title: 'Private: the code is not public' }, lock(), 'Private repository');

  const sections = [];
  sections.push(h('section.vw-sec', {}, h('h2', {}, 'What it is'), h('p', {}, repo.description)));
  if (repo.facts?.length) {
    sections.push(h('section.vw-sec', {}, h('h2', {}, 'Facts'), h('ul.vw-facts', {}, repo.facts.map((f) => h('li', {}, f)))));
  }
  sections.push(h('section.vw-sec', {}, h('h2', {}, 'Built with'),
    h('ul.vw-chips', { 'aria-label': 'Languages and tools' }, repo.languages.map((l) => h('li.vw-chip', {}, h('i.vw-dot', { style: { background: langColor(l) } }), l)))));
  const pics = repo.images?.length ? repo.images : repo.image ? [repo.image] : [];
  if (pics.length) {
    sections.push(h('section.vw-sec', {}, h('h2', {}, 'Screenshots'),
      h('div.vw-gallery', {}, pics.map((src, i) => {
        const name = `${repo.slug}-${i + 1}.${(/\.(png|jpe?g|webp|gif)/i.exec(src)?.[1] || 'png').replace('jpeg', 'jpg')}`;
        return h('button.vw-shot', { type: 'button', title: `Open ${name}`, onclick: () => os.open('viewer', { kind: 'image', src, title: name }) },
          h('img', { src, alt: `${repo.title}, screenshot ${i + 1}`, loading: 'lazy', decoding: 'async' }),
          h('span.vw-shot__name', {}, name));
      }))));
  }

  const doc = h('article.vw-readme', {},
    h('div.vw-file', {}, h('span', { html: icon('file-text', 16) }), 'README.md'),
    hero,
    h('header.vw-head', {},
      h('h1.vw-title', {}, repo.title),
      h('p.vw-tagline', {}, repo.tagline),
      h('p.vw-meta', {},
        repo.private ? null : h('span.vw-mono', {}, `CRYPT-hack/${repo.repo}`),
        h('span', {}, `Updated ${fmtDate(repo.updated)}`),
        repo.private ? null : h('span.vw-badge.vw-badge--public', {}, 'Public')),
      h('div.vw-actions', {},
        gh,
        h('button.btn', { type: 'button', onclick: () => os.open('explorer', { repo: repo.slug }) }, h('span', { html: icon('folder-open', 16) }), 'Open the folder'))),
    sections);
  root.append(h('div.vw-scroll', { tabindex: '0', 'aria-label': `${repo.title} README` }, doc));

  win.setMenu([
    { label: 'File', items: [
      { label: 'Open the folder in File Explorer', action: () => os.open('explorer', { repo: repo.slug }) },
      { label: 'View on GitHub', action: () => repo.url && window.open(repo.url, '_blank', 'noopener'), disabled: !repo.url },
      '-',
      { label: 'Close', action: () => win.close() },
    ] },
  ]);
  return { destroy() { alive = false; } };
}

function lock() {
  return h('span.vw-lock', { html: '<svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="5" width="8" height="6" rx="1" fill="currentColor"/><path d="M4 5V3.6a2 2 0 0 1 4 0V5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>' });
}

// ── image ─────────────────────────────────────────────────────────────────
const MIN_Z = 0.05;
const MAX_Z = 16;

function imageView(root, { win, os }, { src, title }) {
  const name = title || 'Image';
  win.setTitle(`${name} - Viewer`);
  win.setIcon('file-image');
  win.setStatus(['Loading…']);
  root.classList.add('vw-image');

  const img = h('img.vw-img', { src, alt: name, draggable: 'false' });
  const stage = h('div.vw-stage', { tabindex: '0', role: 'img', 'aria-label': `${name}. Use plus and minus to zoom, arrows to pan.` }, img);
  const pct = h('output.vw-pct', { 'aria-live': 'polite' }, '');
  const tool = (label, glyph, fn) => h('button.vw-tool', { type: 'button', title: label, 'aria-label': label, onclick: fn }, h('span', { html: glyph }));
  const bar = h('div.vw-bar', { role: 'toolbar', 'aria-label': 'Zoom' },
    tool('Zoom out', svg('<path d="M5 10h10" stroke-width="2.4"/>'), () => zoomBy(1 / 1.25)),
    pct,
    tool('Zoom in', svg('<path d="M5 10h10M10 5v10" stroke-width="2.4"/>'), () => zoomBy(1.25)),
    h('span.vw-bar__sep'),
    h('button.vw-tool.vw-tool--text', { type: 'button', onclick: () => fit() }, 'Fit'),
    h('button.vw-tool.vw-tool--text', { type: 'button', onclick: () => actual() }, '1:1'),
    h('span.vw-bar__grow'),
    h('a.vw-tool.vw-tool--text', { href: src, target: '_blank', rel: 'noopener noreferrer' }, 'Open original'));
  root.append(bar, stage);

  let z = 1;
  let x = 0;
  let y = 0;
  let fitted = true;
  let iw = 0;
  let ih = 0;
  let raf = 0;
  let ready = false;
  let stale = false;     // a fit was skipped while the stage had no size
  win.onFocus(() => { if (stale && ready) requestAnimationFrame(() => { if (stale) fit(); }); });

  function apply() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      img.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${z})`;
      const p = `${Math.round(z * 100)}%`;
      pct.textContent = p;
      if (ready) win.setStatus([`${iw} × ${ih} pixels`, `Zoom ${p}${fitted ? ' (fit)' : ''}`, 'Wheel or pinch to zoom, drag to pan']);
    });
  }

  function bounds() {
    // keep at least a quarter of the image on screen
    const sw = stage.clientWidth;
    const sh = stage.clientHeight;
    const w = iw * z;
    const hgt = ih * z;
    const mx = Math.min(w, sw) * 0.25;
    const my = Math.min(hgt, sh) * 0.25;
    x = clamp(x, mx - w, sw - mx);
    y = clamp(y, my - hgt, sh - my);
  }

  function center() {
    x = (stage.clientWidth - iw * z) / 2;
    y = (stage.clientHeight - ih * z) / 2;
  }

  function fit() {
    if (!iw) return;
    // minimised (0x0 stage): fit again when the window comes back
    if (!stage.clientWidth) { fitted = true; stale = true; return; }
    stale = false;
    const sw = Math.max(40, stage.clientWidth - 32);
    const sh = Math.max(40, stage.clientHeight - 32);
    z = Math.min(sw / iw, sh / ih, 1);
    fitted = true;
    center();
    apply();
  }
  function actual() {
    if (!iw) return;
    zoomTo(1, stage.clientWidth / 2, stage.clientHeight / 2);
    fitted = false;
    center();
    apply();
  }
  function zoomTo(nz, cx, cy) {
    nz = clamp(nz, MIN_Z, MAX_Z);
    x = cx - (cx - x) * (nz / z);
    y = cy - (cy - y) * (nz / z);
    z = nz;
    fitted = false;
    bounds();
    apply();
  }
  function zoomBy(k, cx = stage.clientWidth / 2, cy = stage.clientHeight / 2) { zoomTo(z * k, cx, cy); }

  img.addEventListener('load', () => {
    iw = img.naturalWidth;
    ih = img.naturalHeight;
    ready = true;
    stage.classList.add('is-ready');
    fit();
  });
  img.addEventListener('error', () => {
    win.setStatus(['This image could not be loaded']);
    stage.append(h('p.vw-none', {}, 'This image could not be loaded.'));
    os.sound.play('error');
  });

  const local = (e) => {
    const r = stage.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  stage.addEventListener('wheel', (e) => {
    if (!ready) return;
    e.preventDefault();
    const [cx, cy] = local(e);
    const d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    zoomTo(z * Math.exp(-d * (e.ctrlKey ? 0.01 : 0.0018)), cx, cy);
  }, { passive: false });

  const pts = new Map();
  let pinch = null;
  let drag = null;
  stage.addEventListener('pointerdown', (e) => {
    if (!ready || (e.pointerType === 'mouse' && e.button !== 0)) return;
    stage.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, local(e));
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, z, mx: (a[0] + b[0]) / 2, my: (a[1] + b[1]) / 2, x, y };
      drag = null;
    } else if (pts.size === 1) {
      const [px, py] = local(e);
      drag = { px, py, x, y };
      stage.classList.add('is-grabbing');
    }
  });
  stage.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, local(e));
    if (pinch && pts.size >= 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
      const mx = (a[0] + b[0]) / 2;
      const my = (a[1] + b[1]) / 2;
      const nz = clamp(pinch.z * (d / pinch.d), MIN_Z, MAX_Z);
      // keep the pinch midpoint anchored, and follow it as it moves
      x = mx - (pinch.mx - pinch.x) * (nz / pinch.z);
      y = my - (pinch.my - pinch.y) * (nz / pinch.z);
      z = nz;
      fitted = false;
      bounds();
      apply();
    } else if (drag) {
      const [px, py] = local(e);
      x = drag.x + (px - drag.px);
      y = drag.y + (py - drag.py);
      fitted = false;
      bounds();
      apply();
    }
  });
  const up = (e) => {
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (pts.size === 1) {
      const [p] = [...pts.values()];
      drag = { px: p[0], py: p[1], x, y };
    } else if (!pts.size) {
      drag = null;
      stage.classList.remove('is-grabbing');
    }
  };
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', up);
  stage.addEventListener('dblclick', (e) => {
    if (!ready) return;
    const [cx, cy] = local(e);
    if (fitted || z < 0.99) zoomTo(Math.max(1, z * 2), cx, cy);
    else fit();
  });
  stage.addEventListener('keydown', (e) => {
    if (!ready) return;
    const step = 40;
    let handled = true;
    switch (e.key) {
      case '+': case '=': zoomBy(1.25); break;
      case '-': case '_': zoomBy(1 / 1.25); break;
      case '0': fit(); break;
      case '1': actual(); break;
      case 'ArrowLeft': x += step; fitted = false; bounds(); apply(); break;
      case 'ArrowRight': x -= step; fitted = false; bounds(); apply(); break;
      case 'ArrowUp': y += step; fitted = false; bounds(); apply(); break;
      case 'ArrowDown': y -= step; fitted = false; bounds(); apply(); break;
      default: handled = false;
    }
    if (handled) e.preventDefault();
  });

  win.setMenu([
    { label: 'File', items: [
      { label: 'Open original in a new tab', action: () => window.open(src, '_blank', 'noopener') },
      '-',
      { label: 'Close', action: () => win.close() },
    ] },
    { label: 'View', items: [
      { label: 'Zoom in', action: () => zoomBy(1.25) },
      { label: 'Zoom out', action: () => zoomBy(1 / 1.25) },
      '-',
      { label: 'Best fit', action: () => fit() },
      { label: 'Actual size', action: () => actual() },
    ] },
  ]);

  return {
    resize() {
      if (!ready) return;
      if (!stage.clientWidth) { if (fitted) stale = true; return; }
      if (fitted) fit(); else { bounds(); apply(); }
    },
    destroy() {
      cancelAnimationFrame(raf);
      raf = 0;
      pts.clear();
    },
  };
}

function svg(inner) {
  return `<svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round">${inner}</svg>`;
}

// ── text ──────────────────────────────────────────────────────────────────
function textView(root, { win }, { title, text }) {
  const name = title || 'Untitled.txt';
  win.setTitle(`${name} - Viewer`);
  win.setIcon('file-text');
  const str = String(text ?? '');
  const lines = str ? str.split('\n').length : 0;
  win.setStatus([`${lines} line${lines === 1 ? '' : 's'}`, `${str.length} characters`]);
  root.classList.add('vw-textmode');
  const pre = h('pre.vw-text', { tabindex: '0', 'aria-label': name }, str);
  root.append(pre);
  let wrap = true;
  const setMenu = () => win.setMenu([
    { label: 'File', items: [{ label: 'Close', action: () => win.close() }] },
    { label: 'Format', items: [{ label: `${wrap ? '• ' : ''}Word wrap`, action: () => { wrap = !wrap; pre.classList.toggle('is-nowrap', !wrap); setMenu(); } }] },
  ]);
  setMenu();
  return {};
}
