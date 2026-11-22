// Resume.pdf: a one-page resume inside a PDF-viewer chrome. The portrait at
// the top is a live black-and-white pixel mosaic (src/lib/mosaic.js).
import './resume.css';
import { h } from '../../os/ui.js';
import { icon } from '../../os/icons.js';
import { socialLinks } from '../../data/profile.js';
import { createMosaic } from '../../lib/mosaic.js';

const ZOOMS = [0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
const SKILL_LABELS = { languages: 'Languages', web: 'Web & graphics', ai: 'AI & ML', tools: 'Tools' };

const svg = {
  minus: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8h9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  plus: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8h9M8 3.5v9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  print: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 6V2h7v4" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="1.5" y="6" width="13" height="6" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="4.5" y="9.5" width="7" height="5" fill="currentColor" opacity=".9"/><circle cx="12.3" cy="8" r=".8" fill="currentColor"/></svg>',
  pixels: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2" width="5" height="5" fill="currentColor"/><rect x="9" y="2" width="5" height="5" fill="currentColor" opacity=".55"/><rect x="2" y="9" width="5" height="5" fill="currentColor" opacity=".55"/><rect x="9" y="9" width="5" height="5" fill="currentColor"/></svg>',
  photo: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="2.5" width="13" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="5.5" cy="6.5" r="1.4" fill="currentColor"/><path d="m2.5 12.5 4-4 3 3 2-2 2.5 3" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
};

const firstSentence = (text) => (String(text).match(/^.*?[.!?](?=\s|$)/) || [text])[0];
const prettyUrl = (href) => href.replace(/^mailto:/, '').replace(/^https?:\/\//, '').replace(/\/$/, '');
const monthYear = (iso) => {
  try {
    return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  } catch { return iso; }
};

export function mount(body, ctx) {
  const { win, os } = ctx;
  const profile = os.profile;
  const repos = os.repos || [];
  const reduced = !!os.reducedMotion;
  const cleanups = [];
  const listen = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    cleanups.push(() => target.removeEventListener(type, fn, opts));
  };

  win.flush();
  win.setStatus('Resume.pdf · 1 page');

  // ── toolbar ───────────────────────────────────────────────
  const zoomOut = h('button.rs-tb__btn', { type: 'button', 'aria-label': 'Zoom out', title: 'Zoom out (-)', html: svg.minus });
  const zoomIn = h('button.rs-tb__btn', { type: 'button', 'aria-label': 'Zoom in', title: 'Zoom in (+)', html: svg.plus });
  const zoomLabel = h('output.rs-tb__zoom', { 'aria-live': 'polite' }, '100%');
  const zoomReset = h('button.rs-tb__zoomval', { type: 'button', title: 'Actual size (0)', 'aria-label': 'Reset zoom' }, zoomLabel);
  const printBtn = h('button.rs-tb__print', { type: 'button', title: 'Print or save as PDF', html: svg.print },
    h('span.rs-tb__print-long', {}, 'Print / Save as PDF'),
    h('span.rs-tb__print-short', {}, 'Print'));
  const toolbar = h('div.rs-tb', { role: 'toolbar', 'aria-label': 'PDF viewer' },
    h('div.rs-tb__doc', {}, h('span.rs-tb__icon', { html: icon('pdf', 16) }), h('span.rs-tb__name', {}, 'Resume.pdf')),
    h('div.rs-tb__mid', {},
      h('span.rs-tb__page', { 'aria-label': 'Page 1 of 1' }, h('span.rs-tb__pagebox', {}, '1'), ' / 1'),
      h('span.rs-tb__sep', { 'aria-hidden': 'true' }),
      h('div.rs-tb__zoomgrp', {}, zoomOut, zoomReset, zoomIn)),
    h('div.rs-tb__end', {}, printBtn));

  // ── portrait ──────────────────────────────────────────────
  const canvas = h('canvas.rs-portrait__canvas', { role: 'img', 'aria-label': `${profile.photoAlt} (pixel mosaic)` });
  const photoImg = h('img.rs-portrait__img', { src: profile.photo, alt: profile.photoAlt, loading: 'lazy', decoding: 'async' });
  const btnPixels = h('button.rs-seg__btn', { type: 'button', 'aria-pressed': 'true', html: svg.pixels }, h('span', {}, 'Pixels'));
  const btnPhoto = h('button.rs-seg__btn', { type: 'button', 'aria-pressed': 'false', html: svg.photo }, h('span', {}, 'Photo'));
  const seg = h('div.rs-seg.rs-portrait__toggle', { role: 'group', 'aria-label': 'Portrait style' }, btnPixels, btnPhoto);
  const frame = h('div.rs-portrait__frame', {}, canvas, photoImg, seg);
  const caption = h('figcaption.rs-portrait__cap', {}, 'Fig. 1: me, in six shades of grey.');
  const portrait = h('figure.rs-portrait', {}, frame, caption);

  // ── page ──────────────────────────────────────────────────
  const section = (title, ...content) => h('section.rs-sec', {},
    h('h2.rs-sec__title', {}, title), ...content);

  const stats = (() => {
    const pub = repos.filter((r) => !r.private).length;
    return `${repos.length} repositories (${pub} public) since ${monthYear(profile.since)}`;
  })();

  const head = h('header.rs-head', {},
    portrait,
    h('div.rs-id', {},
      h('p.rs-id__kicker', {}, 'Resume'),
      h('h1.rs-id__name', {}, profile.name),
      h('p.rs-id__role', {}, profile.role, profile.handle ? h('span.rs-id__handle', {}, ` · aka ${profile.handle}`) : null),
      h('ul.rs-id__meta', {},
        profile.location ? h('li', {}, h('span.rs-id__label', {}, 'Based in'), ' ', profile.location) : null,
        repos.length ? h('li', {}, h('span.rs-id__label', {}, 'Built'), ' ', stats) : null),
      profile.availability ? h('p.rs-id__avail', {}, h('span.rs-id__dot', { 'aria-hidden': 'true' }), profile.availability) : null));

  const summary = profile.tagline ? h('p.rs-summary', {}, profile.tagline) : null;

  // selected projects
  const featured = repos.filter((r) => r.featured);
  const projects = featured.length ? section('Selected projects',
    h('ul.rs-projects', {}, featured.map((r) => {
      const title = r.url
        ? h('a.rs-proj__title', { href: r.url, target: '_blank', rel: 'noopener noreferrer' }, r.title)
        : h('span.rs-proj__title', {}, r.title);
      const where = r.url
        ? h('a.rs-proj__where', { href: r.url, target: '_blank', rel: 'noopener noreferrer' }, prettyUrl(r.url))
        : h('span.rs-proj__where.rs-proj__where--private', {}, 'Private repository');
      return h('li.rs-proj', {},
        h('div.rs-proj__head', {}, title, where),
        h('p.rs-proj__desc', {}, firstSentence(r.description)),
        r.languages?.length ? h('p.rs-proj__langs', {}, r.languages.join(' · ')) : null);
    }))) : null;

  const experience = profile.experience?.length ? section('Experience',
    h('ul.rs-list', {}, profile.experience.map((e) => h('li.rs-item', {},
      h('div.rs-item__head', {},
        h('strong.rs-item__title', {}, [e.role, e.org].filter(Boolean).join(', ')),
        e.years ? h('span.rs-item__when', {}, e.years) : null),
      e.text ? h('p.rs-item__text', {}, e.text) : null)))) : null;

  const education = profile.education?.length ? section('Education',
    h('ul.rs-list', {}, profile.education.map((e) => h('li.rs-item', {},
      h('div.rs-item__head', {},
        h('strong.rs-item__title', {}, e.school || ''),
        e.years ? h('span.rs-item__when', {}, e.years) : null),
      e.degree ? h('p.rs-item__text', {}, e.degree) : null)))) : null;

  const skillGroups = Object.entries(profile.skills || {}).filter(([, list]) => list?.length);
  const skills = skillGroups.length ? section('Skills',
    h('dl.rs-skills', {}, skillGroups.flatMap(([key, list]) => [
      h('dt', {}, SKILL_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1)),
      h('dd', {}, h('ul.rs-chips', {}, list.map((s) => h('li', {}, s)))),
    ]))) : null;

  const interests = profile.interests?.length ? section('Interests',
    h('p.rs-plain', {}, profile.interests.join(', ') + '.')) : null;

  const links = socialLinks();
  const linksSec = links.length ? section('Links',
    h('ul.rs-links', {}, links.map((l) => h('li', {},
      h('span.rs-links__label', {}, l.label),
      h('a', { href: l.href, target: l.id === 'email' ? null : '_blank', rel: l.id === 'email' ? null : 'noopener noreferrer' }, prettyUrl(l.href)))))) : null;

  const page = h('article.rs-page', { 'aria-label': `Resume of ${profile.name}` },
    head,
    summary,
    h('div.rs-cols', {},
      h('div.rs-main', {}, projects, experience, education),
      h('aside.rs-side', {}, skills, interests, linksSec)),
    h('footer.rs-foot', {},
      h('span', {}, [profile.name, profile.links?.github ? prettyUrl(profile.links.github) : ''].filter(Boolean).join(' · ')),
      h('span', {}, 'Page 1 of 1')));

  const scroller = h('div.rs-scroll', {}, h('div.rs-stage', {}, page));
  const root = h('div.app-resume', {}, toolbar, scroller);
  body.append(root);

  // ── mosaic ────────────────────────────────────────────────
  let mosaic = null;
  try {
    mosaic = createMosaic(canvas, {
      src: profile.photo,
      levels: 6,
      // dense tiles so the portrait reads at a glance (~70 columns)
      cell: (w) => Math.max(4, Math.min(8, Math.round(w / 70))),
      reducedMotion: reduced,
      background: '#0c0c0d',
      focus: [0.38, 0.6],
      zoom: 1.2,
      onStart: () => os.sound?.play?.('whoosh'),
      onLayout: (n) => {
        if (n) caption.textContent = reduced
          ? `Fig. 1: me, as ${n.toLocaleString('en-US')} tiles in six shades of grey.`
          : `Fig. 1: me, as ${n.toLocaleString('en-US')} tiles. Poke them.`;
      },
    });
    mosaic.ready.catch(() => fallback());
  } catch (err) {
    console.warn('resume mosaic unavailable', err);
    fallback();
  }
  function fallback() {
    portrait.classList.add('is-fallback');
    seg.hidden = true;
    caption.textContent = 'Fig. 1: me.';
  }

  function setMode(m) {
    const photo = m === 'photo';
    btnPixels.setAttribute('aria-pressed', String(!photo));
    btnPhoto.setAttribute('aria-pressed', String(photo));
    frame.classList.toggle('is-photo', photo);
    mosaic?.setMode(m);
    os.sound?.play?.('tick');
  }
  listen(btnPixels, 'click', () => setMode('pixels'));
  listen(btnPhoto, 'click', () => setMode('photo'));

  // ── zoom ──────────────────────────────────────────────────
  let zi = ZOOMS.indexOf(1);
  function applyZoom() {
    const z = ZOOMS[zi];
    page.style.setProperty('--rs-zoom', String(z));
    root.classList.toggle('is-zoomed-in', z > 1);
    zoomLabel.textContent = `${Math.round(z * 100)}%`;
    zoomOut.disabled = zi === 0;
    zoomIn.disabled = zi === ZOOMS.length - 1;
  }
  const zoomBy = (d) => { zi = Math.max(0, Math.min(ZOOMS.length - 1, zi + d)); applyZoom(); };
  const zoomTo1 = () => { zi = ZOOMS.indexOf(1); applyZoom(); };
  listen(zoomOut, 'click', () => zoomBy(-1));
  listen(zoomIn, 'click', () => zoomBy(1));
  listen(zoomReset, 'click', zoomTo1);
  applyZoom();

  // ── print ─────────────────────────────────────────────────
  let printRoot = null;
  function buildPrint() {
    if (printRoot) return;
    const clone = page.cloneNode(true);
    clone.style.removeProperty('--rs-zoom');
    clone.querySelectorAll('canvas, .rs-portrait__toggle').forEach((n) => n.remove());
    const cap = clone.querySelector('.rs-portrait__cap');
    if (cap) cap.remove();
    const im = clone.querySelector('.rs-portrait__img');
    if (im) im.loading = 'eager';
    printRoot = h('div.app-resume.app-resume--print', { 'aria-hidden': 'true' }, clone);
    document.body.append(printRoot);
    document.documentElement.classList.add('app-resume-printing');
  }
  function clearPrint() {
    printRoot?.remove();
    printRoot = null;
    document.documentElement.classList.remove('app-resume-printing');
  }
  function printResume() {
    buildPrint();
    // let the cloned <img> decode before the print snapshot
    const im = printRoot.querySelector('img');
    const go = () => { try { window.print(); } catch { clearPrint(); } };
    if (im && !im.complete) {
      im.addEventListener('load', go, { once: true });
      im.addEventListener('error', go, { once: true });
    } else go();
  }
  // Ctrl+P from the browser menu while this window is in front prints the resume too
  listen(window, 'beforeprint', () => { if (os.wm?.active === win) buildPrint(); });
  listen(window, 'afterprint', clearPrint);
  listen(printBtn, 'click', printResume);

  // ── keyboard ──────────────────────────────────────────────
  listen(body, 'keydown', (e) => {
    if (e.key === 'Escape' && mosaic?.isAssembling()) { mosaic.skip(); e.preventDefault(); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) { e.preventDefault(); printResume(); return; }
    if (e.altKey) return;
    if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomBy(1); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomBy(-1); }
    else if (e.key === '0' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); zoomTo1(); }
  });

  // ── menu ──────────────────────────────────────────────────
  win.setMenu([
    { label: 'File', items: [
      { label: 'Download', action: printResume },
      { label: 'Print…', action: printResume },
      '-',
      { label: 'Close', action: () => win.close() },
    ] },
    { label: 'View', items: [
      { label: 'Zoom in', action: () => zoomBy(1) },
      { label: 'Zoom out', action: () => zoomBy(-1) },
      { label: 'Actual size', action: zoomTo1 },
      '-',
      { label: 'Pixels', action: () => setMode('pixels') },
      { label: 'Photo', action: () => setMode('photo') },
      { label: 'Replay the mosaic', action: replay, disabled: reduced },
    ] },
  ]);

  function replay() {
    scroller.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    btnPixels.setAttribute('aria-pressed', 'true');
    btnPhoto.setAttribute('aria-pressed', 'false');
    frame.classList.remove('is-photo');
    mosaic?.replay();
  }

  return {
    reopen() { replay(); },
    destroy() {
      cleanups.forEach((fn) => fn());
      clearPrint();
      mosaic?.destroy();
      mosaic = null;
    },
  };
}
