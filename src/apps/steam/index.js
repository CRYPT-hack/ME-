// Steam: a dark game-client style profile. Original design, generic
// gamepad iconography, procedural cover art (no real game art or logos).
import './steam.css';
import { h, seeded } from '../../os/ui.js';
import { icon } from '../../os/icons.js';

const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'library', label: 'Library' },
  { id: 'achievements', label: 'Achievements' },
];

const PLAY_JOKES = [
  ['Launching…', 'Just kidding. Back to coding.'],
  ['Update required (41.7 GB)', 'I will write a shader while it downloads.'],
  ['Compiling shaders…', 'Mine, not the game’s. Same feeling though.'],
  ['Cannot launch', 'A pull request is waiting for review first.'],
  ['Matchmaking…', 'Estimated wait: until the build goes green.'],
  ['Launching…', 'The game launched a terminal instead. Suspicious.'],
];

let uid = 0;

/** ISO 'YYYY-MM-DD' → local Date (no timezone shift). */
function parseDay(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function fmtDay(iso) {
  try { return parseDay(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}

/* ---------------------------------------------------------------- covers */

function hashStr(s) {
  let x = 2166136261;
  for (const c of s) x = Math.imul(x ^ c.charCodeAt(0), 16777619);
  return x >>> 0;
}

/**
 * Draw procedural cover art for a title: a two-hue gradient, a geometric motif
 * picked from the title's hash and the title in heavy type.
 */
function drawCover(canvas, title, { w = 460, h: hh = 215, label = true } = {}) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(hh * dpr);
  const g = canvas.getContext('2d');
  if (!g) return;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const rnd = seeded(hashStr(title));
  const hue = Math.floor(rnd() * 360);
  const hue2 = (hue + 40 + rnd() * 120) % 360;

  const bg = g.createLinearGradient(0, 0, w, hh);
  bg.addColorStop(0, `hsl(${hue} 70% 22%)`);
  bg.addColorStop(0.55, `hsl(${(hue + hue2) / 2} 65% 30%)`);
  bg.addColorStop(1, `hsl(${hue2} 75% 42%)`);
  g.fillStyle = bg;
  g.fillRect(0, 0, w, hh);

  const motif = Math.floor(rnd() * 5);
  g.save();
  g.globalCompositeOperation = 'lighter';
  if (motif === 0) {
    // concentric rings around an off-centre point
    const cx = w * (0.55 + rnd() * 0.35), cy = hh * (0.2 + rnd() * 0.5);
    for (let r = 14; r < w; r += 14 + rnd() * 10) {
      g.strokeStyle = `hsla(${hue2} 90% 70% / ${0.06 + rnd() * 0.12})`;
      g.lineWidth = 1 + rnd() * 5;
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
    }
  } else if (motif === 1) {
    // speed stripes
    g.translate(w / 2, hh / 2);
    g.rotate(-0.35 - rnd() * 0.3);
    for (let i = 0; i < 26; i++) {
      const y = (rnd() - 0.5) * hh * 2;
      g.fillStyle = `hsla(${rnd() > 0.5 ? hue2 : hue} 95% 65% / ${0.05 + rnd() * 0.18})`;
      g.fillRect(-w, y, w * 2, 2 + rnd() * 16);
    }
  } else if (motif === 2) {
    // perspective grid with a horizon sun
    const hy = hh * 0.55;
    const sun = g.createRadialGradient(w * 0.7, hy, 0, w * 0.7, hy, hh * 0.55);
    sun.addColorStop(0, `hsla(${hue2} 100% 70% / .55)`);
    sun.addColorStop(1, 'hsla(0 0% 0% / 0)');
    g.fillStyle = sun; g.fillRect(0, 0, w, hh);
    g.strokeStyle = `hsla(${hue2} 100% 75% / .28)`;
    g.lineWidth = 1;
    for (let i = -14; i <= 14; i++) {
      g.beginPath(); g.moveTo(w / 2 + i * 6, hy); g.lineTo(w / 2 + i * 60, hh); g.stroke();
    }
    for (let k = 1; k < 9; k++) {
      const y = hy + (hh - hy) * Math.pow(k / 8, 1.8);
      g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
    }
  } else if (motif === 3) {
    // scattered triangles
    for (let i = 0; i < 34; i++) {
      const x = rnd() * w, y = rnd() * hh, s = 8 + rnd() * 46, a = rnd() * Math.PI;
      g.fillStyle = `hsla(${rnd() > 0.4 ? hue2 : hue} 90% 66% / ${0.05 + rnd() * 0.16})`;
      g.beginPath();
      for (let k = 0; k < 3; k++) g.lineTo(x + Math.cos(a + k * 2.094) * s, y + Math.sin(a + k * 2.094) * s);
      g.fill();
    }
  } else {
    // voxel blocks rising from the bottom
    const cols = 18, cw = w / cols;
    for (let c = 0; c < cols; c++) {
      const n = Math.floor(rnd() * 7);
      for (let r = 0; r < n; r++) {
        g.fillStyle = `hsla(${hue2} 80% ${50 + rnd() * 20}% / ${0.08 + rnd() * 0.18})`;
        g.fillRect(c * cw + 1, hh - (r + 1) * cw + 1, cw - 2, cw - 2);
      }
    }
  }
  g.restore();

  // vignette so the title stays readable
  const v = g.createLinearGradient(0, hh * 0.35, 0, hh);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,.62)');
  g.fillStyle = v; g.fillRect(0, 0, w, hh);

  if (!label) return;
  const text = title.toUpperCase();
  let size = Math.min(54, hh * 0.3);
  g.font = `800 ${size}px "Noto Sans", Tahoma, Verdana, sans-serif`;
  while (g.measureText(text).width > w - 36 && size > 12) {
    size -= 2;
    g.font = `800 ${size}px "Noto Sans", Tahoma, Verdana, sans-serif`;
  }
  g.textBaseline = 'alphabetic';
  g.shadowColor = 'rgba(0,0,0,.55)';
  g.shadowBlur = 12;
  g.shadowOffsetY = 2;
  g.fillStyle = '#fff';
  g.fillText(text, 18, hh - 20);
  g.shadowColor = 'transparent';
  g.fillStyle = `hsl(${hue2} 95% 70%)`;
  g.fillRect(18, hh - 14, Math.min(g.measureText(text).width, 90), 3);
}

/* ---------------------------------------------------------- achievements */

function buildAchievements(profile, repos) {
  const find = (slug) => repos.find((r) => r.slug === slug);
  const pub = repos.filter((r) => !r.private);
  const priv = repos.filter((r) => r.private);
  const langs = new Set(repos.flatMap((r) => r.languages));
  const gpu = repos.filter((r) => r.languages.some((l) => /three\.js|webgl|glsl/i.test(l)));
  const vision = repos.filter((r) => r.languages.some((l) => /rf-detr|yolo/i.test(l)));
  const bob = find('bob-the-builder');
  const race = find('interlagos-racer');
  const first = find('first-commit');
  const list = [];
  const progress = (value, target) => ({ value, target, done: value >= target });

  list.push({
    title: 'First Commit', icon: 'file-code',
    text: `Pushed my first repository${first?.languages?.[0] ? `, written in ${first.languages[0]}` : ''}.`,
    unlocked: true, date: profile.since || first?.updated,
  });
  if (bob) list.push({
    title: 'City Planner', icon: 'home',
    text: 'Built Bob the Builder: any git repository grows into a 3D city.',
    unlocked: true, meta: `Latest push ${fmtDay(bob.updated)}`,
  });
  if (race) list.push({
    title: 'Pit Crew', icon: 'gamepad',
    text: 'Ran ten cars on one server with Interlagos Racer.',
    unlocked: true, meta: `Latest push ${fmtDay(race.updated)}`,
  });
  const p20 = progress(repos.length, 20);
  list.push({
    title: 'Twenty Strong', icon: 'folder',
    text: 'Reach 20 repositories.', unlocked: p20.done, progress: p20,
    meta: `${repos.length} repositories`,
  });
  const pGpu = progress(gpu.length, 2);
  list.push({
    title: 'Shader Whisperer', icon: 'paint',
    text: 'Ship projects that live on the GPU.', unlocked: pGpu.done, progress: pGpu,
    meta: gpu.map((r) => r.title).join(', ') || 'None yet',
  });
  const pPriv = progress(priv.length, 5);
  list.push({
    title: 'Private Collection', icon: 'folder-open',
    text: 'Keep a few projects under wraps.', unlocked: pPriv.done, progress: pPriv,
    meta: `${priv.length} private repositories`,
  });
  const pPub = progress(pub.length, 10);
  list.push({
    title: 'Open Book', icon: 'github',
    text: 'Make ten repositories public.', unlocked: pPub.done, progress: pPub,
    meta: `${pub.length} public repositories`,
  });
  const pLang = progress(langs.size, 25);
  list.push({
    title: 'Polyglot', icon: 'terminal',
    text: 'Use 25 different languages and tools across projects.', unlocked: pLang.done, progress: pLang,
    meta: `${langs.size} so far`,
  });
  if (vision.length) {
    const pVis = progress(vision.length, 2);
    list.push({
      title: 'Eye in the Sky', icon: 'computer',
      text: 'Teach a camera to spot things on its own.', unlocked: pVis.done, progress: pVis,
      meta: vision.map((r) => r.title).join(', '),
    });
  }
  list.push({
    title: 'Get Hired', icon: 'star',
    text: profile.availability ? `Locked. Currently: ${profile.availability.toLowerCase()}.` : 'Locked.',
    unlocked: false, hint: 'Your company could unlock this one',
  });
  list.push({
    title: 'Touch Grass', icon: 'globe',
    text: 'Locked. Spend a full day without opening a terminal.',
    unlocked: false, progress: { value: 0, target: 1, done: false }, hint: 'Progress resets every time I type ls',
  });
  return list;
}

/* ------------------------------------------------------------------- app */

export function mount(body, ctx) {
  const { os, win } = ctx;
  const { profile, repos } = os;
  const steam = profile.steam || {};
  const favorites = (steam.favorites || []).filter((f) => f && f.title);
  const id = `steam${++uid}`;
  const reduced = !!os.reducedMotion;
  const timers = new Set();
  let alive = true;
  let current = null;
  const covers = []; // [canvas, title, opts] for the font redraw
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (alive) fn(); }, ms); timers.add(t); return t; };

  const achievements = buildAchievements(profile, repos);
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const level = repos.length;
  const langCount = new Set(repos.flatMap((r) => r.languages)).size;

  win.flush();
  const root = h('div.app-steam');
  body.append(root);

  /* header */
  const persona = steam.personaName || profile.handle || profile.name;
  const avatar = h('div.app-steam__avatar', {},
    profile.photo ? h('img', { src: profile.photo, alt: profile.photoAlt || `${persona}’s avatar`, width: 72, height: 72, draggable: 'false' }) : h('span', { html: icon('user', 48) }),
    h('span.app-steam__dot', { title: 'Online' }));
  const header = h('header.app-steam__head', {},
    avatar,
    h('div.app-steam__who', {},
      h('div.app-steam__name-row', {},
        h('h2.app-steam__name', {}, persona),
        h('span.app-steam__level', { title: 'One level per repository' }, h('span.app-steam__level-label', {}, 'Level'), h('b', {}, String(level)))),
      h('p.app-steam__real', {}, `${profile.name}${profile.location ? ` · ${profile.location}` : ''}`),
      h('p.app-steam__status', {}, h('span.app-steam__online', {}, 'Online'), ' · probably writing shaders')),
    h('dl.app-steam__stats', {},
      stat('Repos', repos.length),
      stat('Achievements', `${unlockedCount}/${achievements.length}`),
      stat('Languages', langCount)));

  function stat(label, value) {
    return h('div', {}, h('dt', {}, label), h('dd', {}, String(value)));
  }

  /* tabs */
  const tablist = h('div.app-steam__tabs', { role: 'tablist', 'aria-label': 'Steam sections' });
  const panels = {};
  const tabBtns = {};
  for (const t of TABS) {
    const btn = h('button.app-steam__tab', {
      type: 'button', role: 'tab', id: `${id}-tab-${t.id}`,
      'aria-controls': `${id}-panel-${t.id}`, 'aria-selected': 'false', tabindex: '-1',
      onclick: () => select(t.id, true),
    }, t.label);
    tabBtns[t.id] = btn;
    tablist.append(btn);
    panels[t.id] = h('section.app-steam__panel', {
      role: 'tabpanel', id: `${id}-panel-${t.id}`, 'aria-labelledby': `${id}-tab-${t.id}`, tabindex: '0', hidden: true,
    });
  }
  tablist.addEventListener('keydown', onTabKey);

  const scroller = h('div.app-steam__scroll', {}, ...Object.values(panels));
  root.append(header, tablist, scroller);

  buildProfile(panels.profile);
  buildLibrary(panels.library);
  buildAchievementsPanel(panels.achievements);

  // redraw covers once the webfont is ready so the titles use it
  document.fonts?.ready?.then(() => { if (alive) covers.forEach(([c, t, o]) => drawCover(c, t, o)); });

  win.setMenu([
    { label: 'View', items: TABS.map((t) => ({ label: t.label, action: () => select(t.id, true) })) },
    {
      label: 'Go', items: [
        { label: 'My Steam profile', disabled: !steam.profileUrl, action: () => steam.profileUrl && window.open(steam.profileUrl, '_blank', 'noopener') },
        { label: 'My GitHub', disabled: !profile.links?.github, action: () => window.open(profile.links.github, '_blank', 'noopener') },
      ],
    },
  ]);

  select(ctx.args?.tab && panels[ctx.args.tab] ? ctx.args.tab : 'profile', false);

  /* ------------------------------------------------------------ panels */

  function buildProfile(panel) {
    const shelf = h('div.app-steam__shelf');
    if (!favorites.length) shelf.append(h('p.app-steam__empty', {}, 'No favourites on the shelf yet.'));
    favorites.forEach((f, i) => {
      const c = h('canvas.app-steam__cover', { 'aria-hidden': 'true' });
      const opts = { w: 460, h: 215 };
      drawCover(c, f.title, opts);
      covers.push([c, f.title, opts]);
      shelf.append(h('article.app-steam__card', { style: `--i:${i}` },
        h('div.app-steam__cover-wrap', {}, c),
        h('div.app-steam__card-body', {},
          h('h4', {}, f.title),
          f.hours > 0 ? h('p.app-steam__hours', {}, `${Number(f.hours).toLocaleString('en-US')} hrs on record`) : null,
          f.note ? h('p.app-steam__note', {}, f.note) : null)));
    });

    const recent = [...repos].sort((a, b) => (a.updated < b.updated ? 1 : -1)).slice(0, 5);
    const activity = h('ul.app-steam__activity', {}, ...recent.map((r) =>
      h('li', {},
        h('span.app-steam__act-ic', { html: icon(r.private ? 'folder' : 'file-code', 22) }),
        h('div.app-steam__act-text', {},
          h('div', {},
            'Pushed to ',
            r.url
              ? h('a', { href: r.url, target: '_blank', rel: 'noopener noreferrer' }, r.title)
              : h('strong', {}, r.title),
            r.url ? null : h('span.app-steam__private', {}, 'Private repository')),
          h('small', {}, `${fmtDay(r.updated)} · ${r.languages.slice(0, 3).join(', ')}`)))));

    // An empty profileUrl means "not set" (see profile.js): hide the CTA.
    const cta = steam.profileUrl
      ? h('a.btn.btn--primary.btn--big.app-steam__cta', { href: steam.profileUrl, target: '_blank', rel: 'noopener noreferrer' }, h('span', { html: icon('gamepad', 18) }), 'View my Steam profile')
      : null;

    panel.append(
      h('h3.app-steam__h', {}, 'Favourite games'),
      shelf,
      h('div.app-steam__split', {},
        h('div', {},
          h('h3.app-steam__h', {}, 'Recent activity ', h('small', {}, 'mostly commits, honestly')),
          activity),
        h('aside.app-steam__side', {},
          h('h3.app-steam__h', {}, 'Profile'),
          h('p.app-steam__side-text', {}, profile.tagline || ''),
          cta)));
  }

  function buildLibrary(panel) {
    const list = h('ul.app-steam__lib');
    if (!favorites.length) list.append(h('li.app-steam__empty', {}, 'The library is empty.'));
    favorites.forEach((f, i) => {
      const c = h('canvas.app-steam__thumb', { 'aria-hidden': 'true' });
      const opts = { w: 184, h: 86, label: false };
      drawCover(c, f.title, opts);
      covers.push([c, f.title, opts]);
      const bar = h('span.app-steam__launch-bar');
      const btn = h('button.app-steam__play', { type: 'button', 'aria-label': `Play ${f.title}` },
        h('span', { html: playSvg() }), h('span.app-steam__play-label', {}, 'Play'), bar);
      btn.addEventListener('click', () => play(btn, f, i));
      list.append(h('li.app-steam__lib-row', { style: `--i:${i}` },
        h('div.app-steam__thumb-wrap', {}, c),
        h('div.app-steam__lib-text', {},
          h('h4', {}, f.title),
          h('p', {}, f.note || ''),
          f.hours > 0 ? h('small', {}, `${Number(f.hours).toLocaleString('en-US')} hrs on record`) : null),
        btn));
    });
    panel.append(
      h('div.app-steam__lib-head', {},
        h('h3.app-steam__h', {}, `Library `, h('small', {}, `${favorites.length} games`)),
        h('p.app-steam__lib-tip', {}, 'The Play buttons work. Sort of.')),
      list);
  }

  let jokeIndex = 0;
  function play(btn, f) {
    if (btn.classList.contains('is-launching')) return;
    os.sound?.play?.('click');
    btn.classList.add('is-launching');
    btn.querySelector('.app-steam__play-label').textContent = 'Launching…';
    const [title, text] = PLAY_JOKES[jokeIndex++ % PLAY_JOKES.length];
    later(() => {
      btn.classList.remove('is-launching');
      btn.querySelector('.app-steam__play-label').textContent = 'Play';
      os.wallpaper?.pulse?.();
      os.notify({ title: `${f.title}: ${title}`, text, icon: 'gamepad', timeout: 5000 });
    }, reduced ? 150 : 1100);
  }

  function buildAchievementsPanel(panel) {
    const pct = Math.round((unlockedCount / achievements.length) * 100);
    panel.append(h('div.app-steam__ach-head', {},
      h('h3.app-steam__h', {}, 'Developer achievements'),
      h('p', {}, `${unlockedCount} of ${achievements.length} unlocked (${pct}%)`),
      h('div.app-steam__meter', { role: 'progressbar', 'aria-label': 'Achievements unlocked', 'aria-valuemin': '0', 'aria-valuemax': String(achievements.length), 'aria-valuenow': String(unlockedCount) },
        h('span', { style: `--p:${pct / 100}` }))));
    const grid = h('ul.app-steam__ach');
    achievements.forEach((a, i) => {
      const p = a.progress;
      const pr = p ? Math.min(1, p.value / p.target) : 0;
      grid.append(h(`li.app-steam__ach-item${a.unlocked ? '.is-unlocked' : '.is-locked'}`, { style: `--i:${i}` },
        h('span.app-steam__badge', { html: icon(a.icon, 30) }),
        h('div.app-steam__ach-text', {},
          h('h4', {}, a.title, a.unlocked ? null : h('span.app-steam__lock', {}, ' — locked')),
          h('p', {}, a.text),
          p ? h('div.app-steam__ach-progress', {},
            h('div.app-steam__bar', { role: 'progressbar', 'aria-label': `${a.title} progress`, 'aria-valuemin': '0', 'aria-valuemax': String(p.target), 'aria-valuenow': String(Math.min(p.value, p.target)) },
              h('span', { style: `--p:${pr}` })),
            h('small', {}, `${Math.min(p.value, p.target)} / ${p.target}`)) : null,
          h('small.app-steam__ach-meta', {},
            a.unlocked ? (a.date ? `Unlocked ${fmtDay(a.date)}` : 'Unlocked') : (a.hint || 'Locked'),
            a.meta ? ` · ${a.meta}` : ''))));
    });
    panel.append(grid);
  }

  /* -------------------------------------------------------------- tabs */

  function select(tab, fromUser) {
    if (!panels[tab]) return;
    if (current === tab) return;
    if (fromUser) os.sound?.play?.('click');
    current = tab;
    for (const t of TABS) {
      const on = t.id === tab;
      tabBtns[t.id].setAttribute('aria-selected', on ? 'true' : 'false');
      tabBtns[t.id].tabIndex = on ? 0 : -1;
      tabBtns[t.id].classList.toggle('is-active', on);
      panels[t.id].hidden = !on;
    }
    scroller.scrollTop = 0;
    const panel = panels[tab];
    // replay the entrance / shine animation each time a tab is shown
    if (!reduced) {
      panel.classList.remove('is-in');
      void panel.offsetWidth; // restart CSS animations once per tab switch
      panel.classList.add('is-in');
    } else {
      panel.classList.add('is-in');
    }
    const label = TABS.find((t) => t.id === tab).label;
    win.setStatus([label, `${favorites.length} games`, `${unlockedCount} of ${achievements.length} achievements`]);
  }

  function onTabKey(e) {
    const ids = TABS.map((t) => t.id);
    let i = ids.indexOf(current);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') i = (i + 1) % ids.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') i = (i - 1 + ids.length) % ids.length;
    else if (e.key === 'Home') i = 0;
    else if (e.key === 'End') i = ids.length - 1;
    else return;
    e.preventDefault();
    select(ids[i], true);
    tabBtns[ids[i]].focus();
  }

  return {
    reopen(args) {
      if (args?.tab && panels[args.tab]) select(args.tab, false);
    },
    destroy() {
      alive = false;
      timers.forEach(clearTimeout);
      timers.clear();
      tablist.removeEventListener('keydown', onTabKey);
      covers.length = 0;
    },
  };
}

function playSvg() {
  return '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg>';
}
