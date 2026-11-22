// Home: the landing page that opens at startup. A scrollable page inside a
// window: hero, a CRT "Now showing" set that flips through featured repos,
// what I build, off-the-clock apps, stats and a footer with my local time.
import './home.css';
import { h, clockText, loadImage } from '../../os/ui.js';
import { icon } from '../../os/icons.js';
import { featured, stats, bySlug } from '../../data/repos.js';
import { createTV } from './tv.js';

const BUILDS = [
  {
    icon: 'paint', title: '3D and visualisation',
    text: 'Things you understand by looking at them: a codebase as a city, a circuit you can race, drawings that mark their own changes.',
    slugs: ['bob-the-builder', 'interlagos-racer', 'redline-review', 'traffic-analysis'],
  },
  {
    icon: 'globe', title: 'Multiplayer and real-time',
    text: 'One server keeping many clients honest, and live feeds that have to keep up.',
    slugs: ['interlagos-racer', 'agents-assemble', 'sky-eye', 'no-parking-zone'],
  },
  {
    icon: 'computer', title: 'AI and vision',
    text: 'Models that watch video, listen for a wake word, read number plates and answer back.',
    slugs: ['sky-eye', 'crypt-assistant', 'no-parking-zone', 'ai-notebook', 'stress'],
  },
  {
    icon: 'settings', title: 'Developer tools',
    text: 'Tools for the work itself: shared desks for coding agents, honest backtests, notebooks with help in the margin.',
    slugs: ['agents-assemble', 'bob-the-builder', 'bstat', 'ai-notebook', 'chromium-canary'],
  },
];

function monthYear(iso, month = 'long') {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-US', { month, year: 'numeric' });
}

function daysSince(iso) {
  return Math.max(0, Math.floor((Date.now() - new Date(`${iso}T00:00:00`).getTime()) / 86400000));
}

const lower1 = (s) => s.charAt(0).toLowerCase() + s.slice(1);

export function mount(body, ctx) {
  const { os, win } = ctx;
  const p = os.profile;
  const repos = os.repos;
  const reduced = os.reducedMotion;
  const cleanups = [];
  const on = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    cleanups.push(() => target.removeEventListener(type, fn, opts));
  };

  const openRepo = (slug) => os.open('explorer', { repo: slug });

  // --- hero -------------------------------------------------------------
  const what = (p.tagline.split(':')[1] || '').trim().replace(/\.$/, '');
  const intro1 = `I’m ${p.firstName}, a ${lower1(p.role)} in ${p.location}${what ? `, and lately that means ${what}` : ''}.`;
  const intro2 = `That’s ${repos.length} repositories since ${monthYear(p.since)}${p.availability ? `, and I’m ${lower1(p.availability)}` : ''}.`;

  const heroTime = h('span.hm-card__time', {}, '');
  const hero = h('section.hm-hero', { 'aria-labelledby': 'hm-h1' },
    h('div.hm-hero__copy', {},
      h('p.hm-kicker', {}, h('span.hm-kicker__dot'), 'CRYPT OS · Home'),
      h('h1.hm-hero__title#hm-h1', {}, 'I build software you can ', h('em', {}, 'look at'), '.'),
      h('p.hm-hero__intro', {}, intro1, ' ', intro2),
      h('div.hm-hero__cta', {},
        h('button.btn.btn--primary.btn--big.hm-cta', { type: 'button', onclick: () => os.open('explorer') },
          h('span', { html: icon('folder-open', 20) }), 'Open my projects'),
        h('button.btn.btn--big.hm-cta', { type: 'button', onclick: () => os.open('resume') },
          h('span', { html: icon('pdf', 20) }), 'Read my resume')),
      h('p.hm-hero__note', {}, 'Fair warning: the project files fly in.')),
    h('div.hm-card', { 'aria-hidden': 'true' },
      h('div.hm-card__photo', {}, h('img', { src: p.photo, alt: '', width: 96, height: 96, decoding: 'async' })),
      h('strong.hm-card__name', {}, p.name),
      h('span.hm-card__handle', {}, `@${p.handle}`),
      h('span.hm-card__meta', {}, p.location, ' · ', heroTime)));

  // --- now showing --------------------------------------------------------
  const tvMount = h('div.hm-tv-slot');
  const nowShowing = h('section.hm-sec.hm-now', { 'aria-labelledby': 'hm-now-h' },
    h('header.hm-sec__head.hm-reveal', {},
      h('h2.hm-sec__title#hm-now-h', {}, 'Now showing'),
      h('p.hm-sec__sub', {}, 'Featured projects on rotation. Change the channel, or click the screen to open one.')),
    h('div.hm-reveal', {}, tvMount));

  // --- what I build -------------------------------------------------------
  const builds = h('section.hm-sec', { 'aria-labelledby': 'hm-build-h' },
    h('header.hm-sec__head.hm-reveal', {},
      h('h2.hm-sec__title#hm-build-h', {}, 'What I build'),
      h('p.hm-sec__sub', {}, 'Four things I keep coming back to, and the repos that prove it.')),
    h('div.hm-builds', {}, BUILDS.map((b, i) => {
      const list = b.slugs.map((s) => bySlug[s]).filter(Boolean);
      return h('article.hm-build.hm-reveal', { style: { '--d': `${i * 70}ms` } },
        h('div.hm-build__icon', { html: icon(b.icon, 36) }),
        h('h3.hm-build__title', {}, b.title),
        h('p.hm-build__text', {}, b.text),
        h('ul.hm-build__repos', {}, list.map((r) => h('li', {},
          h('button.hm-chip', {
            type: 'button',
            title: r.private ? `${r.title} (private repository)` : r.tagline,
            onclick: () => openRepo(r.slug),
          }, r.title, r.private ? h('span.hm-chip__lock', { 'aria-label': 'private' }, '●') : null)))));
    })));

  // --- off the clock ------------------------------------------------------
  const games = (p.steam?.favorites || []).map((g) => g.title).slice(0, 3);
  const track = p.spotify?.onRepeat?.[0];
  const offCards = [
    { id: 'steam', icon: 'gamepad', title: 'Steam', text: games.length ? `Playing: ${games.join(', ')}` : 'What I play' },
    { id: 'music', icon: 'music', title: 'Music', text: track ? `On repeat: ${track.title}` : 'What I listen to' },
    { id: 'terminal', icon: 'terminal', title: 'Terminal', text: 'A real prompt. Type help and see what it knows.' },
  ];
  const offClock = h('section.hm-sec', { 'aria-labelledby': 'hm-off-h' },
    h('header.hm-sec__head.hm-reveal', {},
      h('h2.hm-sec__title#hm-off-h', {}, 'Off the clock')),
    h('div.hm-off', {}, offCards.map((c, i) => h('button.hm-off__card.hm-reveal', {
      type: 'button', style: { '--d': `${i * 70}ms` }, onclick: () => os.open(c.id),
    },
    h('span.hm-off__icon', { html: icon(c.icon, 32) }),
    h('span.hm-off__text', {}, h('strong', {}, c.title), h('span', {}, c.text)),
    h('span.hm-off__arrow', { 'aria-hidden': 'true' }, '›')))));

  // --- stats ----------------------------------------------------------------
  const priv = stats.total - stats.public;
  const statItems = [
    { nums: [stats.total], label: 'repositories' },
    { nums: [stats.languages], label: 'languages and tools' },
    { nums: [stats.public, priv], sep: ' / ', label: 'public / private' },
    { text: monthYear(p.since, 'short'), label: 'coding since', sub: daysSince(p.since) },
  ];
  const countEls = [];
  const statsRow = h('section.hm-stats.hm-reveal', { 'aria-label': 'Numbers' }, statItems.map((s) => {
    const val = h('span.hm-stat__val');
    if (s.text) val.append(s.text);
    else s.nums.forEach((n, i) => {
      if (i) val.append(h('span.hm-stat__sep', {}, s.sep));
      const el = h('span', { dataset: { to: String(n) } }, reduced ? String(n) : '0');
      countEls.push(el);
      val.append(el);
    });
    let sub = null;
    if (s.sub != null) {
      const el = h('span', { dataset: { to: String(s.sub) } }, reduced ? String(s.sub) : '0');
      countEls.push(el);
      sub = h('span.hm-stat__sub', {}, el, ' days ago');
    }
    return h('div.hm-stat', {}, val, h('span.hm-stat__label', {}, s.label), sub);
  }));

  // --- footer ---------------------------------------------------------------
  const footTime = h('strong', {}, '');
  const footer = h('footer.hm-foot.hm-reveal', {},
    h('div.hm-foot__copy', {},
      h('h2.hm-foot__title', {}, 'Say hi.'),
      h('p', {}, 'Internship, collaboration, or a bug in this OS: I read everything.'),
      h('p.hm-foot__time', {}, 'It’s ', footTime, ` for me in ${p.location}.`)),
    h('div.hm-foot__actions', {},
      h('button.btn.btn--primary.btn--big', { type: 'button', onclick: () => os.open('contact') },
        h('span', { html: icon('mail', 20) }), 'Say hi'),
      p.links?.github ? h('a.btn.btn--big', { href: p.links.github, target: '_blank', rel: 'noopener noreferrer' },
        h('span', { html: icon('github', 20) }), 'GitHub') : null));

  const root = h('div.app-home', {},
    h('div.hm-page', {}, hero, nowShowing, builds, offClock, statsRow, footer));
  body.append(root);

  // --- live clock -------------------------------------------------------------
  const tick = () => {
    const t = clockText(p.timezone);
    heroTime.textContent = t;
    footTime.textContent = t;
  };
  tick();
  const clock = setInterval(tick, 30000);
  cleanups.push(() => clearInterval(clock));

  // --- tv -------------------------------------------------------------------
  const channels = featured.length ? featured : repos.slice(0, 5);
  const tv = createTV(tvMount, {
    channels, reduced, sound: os.sound, loadImage,
    onOpen: (r) => openRepo(r.slug),
    onChange: (r) => win.setStatus(['Home', `${repos.length} repositories`, `Now showing: ${r.title}`]),
  });
  cleanups.push(() => tv.destroy());

  const syncPause = () => tv.setHidden(document.hidden || win.isMinimized());
  on(os.bus, 'windows', syncPause);
  on(document, 'visibilitychange', syncPause);

  // --- scroll reveal + count-up (rooted at the window body) -------------------
  const reveals = [...root.querySelectorAll('.hm-reveal')];
  let counted = false;
  const runCounts = (instant) => {
    if (counted) return;
    counted = true;
    const start = performance.now();
    const dur = 1100;
    const step = (now) => {
      const k = instant ? 1 : Math.min(1, (now - start) / dur);
      const e = 1 - (1 - k) ** 3;
      for (const el of countEls) el.textContent = String(Math.round(+el.dataset.to * e));
      if (k < 1) countRaf = requestAnimationFrame(step);
    };
    if (instant) step(start); else countRaf = requestAnimationFrame(step);
  };
  let countRaf = 0;
  cleanups.push(() => cancelAnimationFrame(countRaf));

  const showAll = () => {
    reveals.forEach((el) => el.classList.add('is-in'));
    cancelAnimationFrame(countRaf);
    counted = false;
    runCounts(true);
  };

  if (reduced || !('IntersectionObserver' in window)) {
    showAll();
  } else {
    root.classList.add('is-animated');
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
        if (e.target === statsRow) runCounts(false);
      }
    }, { root: body, threshold: 0.12, rootMargin: '0px 0px -24px 0px' });
    reveals.forEach((el) => io.observe(el));
    cleanups.push(() => io.disconnect());
  }

  // Escape skips every animation on the page
  on(root, 'keydown', (e) => {
    if (e.key === 'Escape') { showAll(); tv.skip(); }
  });

  win.setMenu([
    { label: 'View', items: [
      { label: 'Back to top', action: () => body.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }) },
      { label: 'Next channel', action: () => tv.next(1) },
      { label: 'Previous channel', action: () => tv.next(-1) },
    ] },
    { label: 'Go', items: [
      { label: 'Projects', action: () => os.open('explorer') },
      { label: 'Resume', action: () => os.open('resume') },
      { label: 'About me', action: () => os.open('about') },
      '-',
      { label: 'Contact', action: () => os.open('contact') },
    ] },
  ]);

  return {
    destroy() {
      while (cleanups.length) {
        try { cleanups.pop()(); } catch (err) { console.error(err); }
      }
    },
    resize() { tv.resize(); },
    reopen() { body.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); },
  };
}
