// About Me: a "System Properties" dialog with four tabs. General (who is
// registered to this OS), Skills (a device-manager tree), GitHub (live
// numbers with an offline fallback) and Timeline (repos by month).
import './about.css';
import { h } from '../../os/ui.js';
import { icon } from '../../os/icons.js';
import { languageColors } from '../../data/repos.js';
import { loadGitHub, relTime } from './github.js';

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'skills', label: 'Skills' },
  { id: 'github', label: 'GitHub' },
  { id: 'timeline', label: 'Timeline' },
];

const CATEGORY = {
  languages: { label: 'Languages', icon: 'file-code' },
  web: { label: 'Web and graphics', icon: 'globe' },
  ai: { label: 'AI and ML', icon: 'computer' },
  tools: { label: 'Tools', icon: 'settings' },
};

const LEVELS = [
  { id: 'daily', label: 'daily', bars: 3, note: 'I reach for this every day.' },
  { id: 'often', label: 'often', bars: 2, note: 'I use this regularly.' },
  { id: 'learning', label: 'learning', bars: 1, note: 'Still learning this one, and enjoying it.' },
];

const APPLY_JOKES = [
  ['Settings applied', 'Nothing changed. I was already running at full settings.'],
  ['Curiosity: 100%', 'It does not go any higher. I checked.'],
  ['Changes saved', 'Sleep schedule left untouched, as requested by nobody.'],
  ['Apply', 'Applied one more coat of polish to the title bars.'],
];

const parseDay = (iso) => new Date(`${iso}T00:00:00`);
const fmtDate = (iso, opts = { day: 'numeric', month: 'short', year: 'numeric' }) => parseDay(iso).toLocaleDateString('en-GB', opts);
const daysSince = (iso) => Math.max(0, Math.floor((Date.now() - parseDay(iso).getTime()) / 86400000));
const lower1 = (s) => s.charAt(0).toLowerCase() + s.slice(1);

/** Hash a name to a stable colour for languages GitHub's palette here lacks. */
function langColor(name) {
  if (languageColors[name]) return languageColors[name];
  let x = 0;
  for (const c of String(name)) x = (x * 31 + c.charCodeAt(0)) >>> 0;
  return `hsl(${x % 360} 55% 52%)`;
}

export function mount(body, ctx) {
  const { os, win } = ctx;
  const p = os.profile;
  const repos = os.repos;
  const cleanups = [];
  let controller = null;
  let ghState = 'idle'; // idle | loading | done
  let applyN = 0;

  win.flush();
  win.setStatus(null);

  // --- tabs --------------------------------------------------------------
  const tabBtns = [];
  const panels = {};
  const tablist = h('div.ab-tabs', { role: 'tablist', 'aria-label': 'About me' });
  const sheet = h('div.ab-sheet');

  TABS.forEach((t) => {
    const btn = h('button.ab-tab', {
      type: 'button', role: 'tab', id: `ab-tab-${t.id}-${win.id}`,
      'aria-controls': `ab-panel-${t.id}-${win.id}`, 'aria-selected': 'false', tabindex: '-1',
      onclick: () => select(t.id, true),
    }, t.label);
    btn.dataset.tab = t.id;
    tabBtns.push(btn);
    tablist.append(btn);
    const panel = h('div.ab-panel', {
      role: 'tabpanel', id: `ab-panel-${t.id}-${win.id}`, 'aria-labelledby': btn.id, tabindex: '0', hidden: true,
    });
    panels[t.id] = panel;
    sheet.append(panel);
  });

  tablist.addEventListener('keydown', (e) => {
    const i = tabBtns.indexOf(document.activeElement);
    if (i < 0) return;
    let j = -1;
    if (e.key === 'ArrowRight') j = (i + 1) % tabBtns.length;
    else if (e.key === 'ArrowLeft') j = (i - 1 + tabBtns.length) % tabBtns.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = tabBtns.length - 1;
    if (j < 0) return;
    e.preventDefault();
    select(tabBtns[j].dataset.tab, true);
  });

  let current = null;
  function select(id, focus = false) {
    if (!panels[id]) id = 'general';
    if (current === id) { if (focus) tabBtns.find((b) => b.dataset.tab === id)?.focus(); return; }
    current = id;
    for (const b of tabBtns) {
      const on = b.dataset.tab === id;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      b.classList.toggle('is-active', on);
      if (on && focus) b.focus();
    }
    for (const [k, el] of Object.entries(panels)) el.hidden = k !== id;
    sheet.scrollTop = 0;
    if (id === 'github' && ghState === 'idle') loadGH(false);
  }

  // --- general -----------------------------------------------------------
  const uptime = daysSince(p.since);
  const spec = (k, v) => h('div.ab-spec', {}, h('dt', {}, k), h('dd', {}, v));
  const bio = [
    `I’m ${p.name}, a ${lower1(p.role)} from ${p.location}.`,
    p.tagline,
    p.availability ? `${p.availability}.` : '',
  ].filter(Boolean).join(' ');

  panels.general.append(
    h('div.ab-general', {},
      h('figure.ab-monitor', {},
        h('div.ab-monitor__case', {},
          h('div.ab-monitor__screen', {},
            h('img', { src: p.photo, alt: p.photoAlt || p.name, width: 128, height: 128, decoding: 'async' })),
          h('span.ab-monitor__led', { 'aria-hidden': 'true' })),
        h('span.ab-monitor__neck', { 'aria-hidden': 'true' }),
        h('span.ab-monitor__foot', { 'aria-hidden': 'true' }),
        h('figcaption.ab-logo', {}, h('span.ab-logo__mark', { 'aria-hidden': 'true' }), h('span', {}, 'CRYPT', h('b', {}, ' OS')))),
      h('div.ab-info', {},
        h('section.ab-block', {},
          h('h3', {}, 'System:'),
          h('p', {}, 'CRYPT OS'),
          h('p', {}, 'Portfolio Edition'),
          h('p.ab-muted', {}, `Build ${uptime} (one per day since the first commit)`)),
        h('section.ab-block', {},
          h('h3', {}, 'Registered to:'),
          h('p', {}, h('strong', {}, p.name)),
          h('p', {}, `@${p.handle}`),
          h('p.ab-muted', {}, p.role)),
        h('section.ab-block', {},
          h('h3', {}, 'Computer:'),
          h('dl.ab-specs', {},
            spec('Processor', 'Curiosity @ 3.0 GHz, overclocked after midnight'),
            spec('Memory', 'Every Stack Overflow answer ever read'),
            spec('Uptime', `${uptime.toLocaleString('en-US')} days (since ${fmtDate(p.since)})`),
            spec('Installed apps', `${os.apps.length}`),
            spec('Location', `${p.location} (${p.timezone})`),
            spec('Repositories', `${repos.length}, ${repos.filter((r) => !r.private).length} of them public`))))),
    h('fieldset.groupbox.ab-bio', {},
      h('legend', {}, 'About this user'),
      h('p', {}, bio),
      p.interests?.length ? h('p.ab-muted', {}, `Also into: ${p.interests.join(', ').toLowerCase()}.`) : null));

  // --- skills ------------------------------------------------------------
  const props = h('div.ab-props', { 'aria-live': 'polite' });
  const tree = h('ul.ab-tree', { role: 'list' });
  const rowBtns = [];
  let selectedRow = null;

  const levelFor = (i, n) => (i < Math.ceil(n * 0.34) ? LEVELS[0] : i < Math.ceil(n * 0.67) ? LEVELS[1] : LEVELS[2]);
  const usedIn = (skill) => {
    const key = skill.toLowerCase().split(/\s*\/\s*/)[0];
    return repos.filter((r) => r.languages.some((l) => l.toLowerCase() === key || l.toLowerCase().startsWith(`${key} `)));
  };

  function showProps(skill, lvl, cat, btn) {
    selectedRow?.classList.remove('is-selected');
    selectedRow = btn;
    btn.classList.add('is-selected');
    rowBtns.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    const used = usedIn(skill);
    props.replaceChildren(
      h('div.ab-props__head', {}, h('span', { html: icon('settings', 20) }), h('strong', {}, `${skill} Properties`)),
      h('dl.ab-specs', {},
        spec('Device type', CATEGORY[cat]?.label || cat),
        spec('Device status', 'This device is working properly.'),
        spec('Usage', `${lvl.label[0].toUpperCase()}${lvl.label.slice(1)}. ${lvl.note}`),
        spec('Found in', used.length
          ? `${used.length} ${used.length === 1 ? 'repository' : 'repositories'}: ${used.slice(0, 5).map((r) => r.title).join(', ')}${used.length > 5 ? '…' : ''}`
          : 'Not tagged on a repository here yet.')));
  }

  const host = h('li.ab-tree__host', {},
    h('div.ab-tree__root', {}, h('span', { html: icon('computer', 18) }), h('strong', {}, `${p.handle.toUpperCase()}-PC`)));
  const cats = h('ul.ab-tree__cats', { role: 'list' });
  host.append(cats);
  tree.append(host);

  Object.entries(p.skills || {}).forEach(([cat, list], ci) => {
    const meta = CATEGORY[cat] || { label: cat[0].toUpperCase() + cat.slice(1), icon: 'file' };
    const kids = h('ul.ab-tree__kids', { role: 'list', id: `ab-cat-${cat}-${win.id}` });
    const toggle = h('button.ab-tree__cat', {
      type: 'button', 'aria-expanded': ci < 2 ? 'true' : 'false', 'aria-controls': kids.id,
      onclick: () => {
        const open = toggle.getAttribute('aria-expanded') !== 'true';
        toggle.setAttribute('aria-expanded', String(open));
        kids.hidden = !open;
      },
    },
    h('span.ab-tree__twisty', { 'aria-hidden': 'true' }),
    h('span', { html: icon(meta.icon, 18) }),
    h('span', {}, meta.label),
    h('span.ab-muted', {}, ` (${list.length})`));
    kids.hidden = ci >= 2;
    list.forEach((skill, i) => {
      const lvl = levelFor(i, list.length);
      const btn = h('button.ab-dev', {
        type: 'button', 'aria-pressed': 'false',
        'aria-label': `${skill}, used ${lvl.label}`,
        onclick: () => showProps(skill, lvl, cat, btn),
      },
      h('span.ab-dev__chip', { 'aria-hidden': 'true' }),
      h('span.ab-dev__name', {}, skill),
      h('span.ab-meter', { 'aria-hidden': 'true', dataset: { bars: String(lvl.bars) } }, h('i'), h('i'), h('i')),
      h('span.ab-dev__lvl', { 'aria-hidden': 'true', dataset: { lvl: lvl.id } }, lvl.label));
      rowBtns.push(btn);
      kids.append(h('li', {}, btn));
    });
    cats.append(h('li', {}, toggle, kids));
  });

  props.append(h('p.ab-muted', {}, 'Select a device to see its properties.'));
  panels.skills.append(
    h('p.ab-lead', {}, 'Listed strongest first in each group. The labels say how often I reach for each one, not a made-up percentage.'),
    h('div.ab-dm', {}, tree),
    props);

  // --- github ----------------------------------------------------------------
  const ghStatus = h('div.ab-gh__status');
  const ghBody = h('div.ab-gh__body');
  const refreshBtn = h('button.btn', { type: 'button', onclick: () => loadGH(true) }, 'Refresh');
  panels.github.append(
    h('div.ab-gh__bar', {}, ghStatus, refreshBtn),
    ghBody);

  const skeleton = () => {
    ghStatus.replaceChildren(h('span.ab-pulse', { 'aria-hidden': 'true' }), h('span', {}, 'Asking GitHub…'));
    ghBody.setAttribute('aria-busy', 'true');
    ghBody.replaceChildren(
      h('div.ab-tiles', {}, [0, 1, 2].map(() => h('div.ab-tile.is-skel', {}, h('span.ab-skel.ab-skel--num'), h('span.ab-skel')))),
      h('h3.ab-h3', {}, 'Top languages'),
      h('div.ab-skel.ab-skel--bar'),
      h('h3.ab-h3', {}, 'Recently pushed'),
      h('ul.ab-recent', {}, [0, 1, 2, 3, 4].map(() => h('li.ab-recent__row.is-skel', {}, h('span.ab-skel'), h('span.ab-skel.ab-skel--short')))));
  };

  function renderGH({ publicRepos, followers, stars, langs, recent, live, note }) {
    ghBody.removeAttribute('aria-busy');
    ghStatus.replaceChildren(
      h('span.ab-dot', { class: live ? 'ab-dot is-live' : 'ab-dot is-off', 'aria-hidden': 'true' }),
      h('span', {}, note));
    const total = langs.reduce((s, l) => s + l.n, 0) || 1;
    ghBody.replaceChildren(
      h('div.ab-tiles', {},
        h('div.ab-tile', {}, h('strong', {}, String(publicRepos)), h('span', {}, 'public repos')),
        h('div.ab-tile', {}, h('strong', {}, followers == null ? '—' : String(followers)), h('span', {}, 'followers')),
        h('div.ab-tile', {}, h('strong', {}, stars == null ? '—' : String(stars)), h('span', {}, 'total stars'))),
      h('h3.ab-h3', {}, 'Top languages'),
      h('div.ab-langbar', { role: 'img', 'aria-label': langs.map((l) => `${l.name} ${Math.round((l.n / total) * 100)}%`).join(', ') },
        langs.map((l) => h('span', { style: { flexGrow: String(l.n), background: langColor(l.name) }, title: `${l.name}: ${l.n}` }))),
      h('ul.ab-legend', {}, langs.map((l) => h('li', {},
        h('i', { style: { background: langColor(l.name) } }),
        `${l.name} `, h('span.ab-muted', {}, `${Math.round((l.n / total) * 100)}%`)))),
      h('h3.ab-h3', {}, 'Recently pushed'),
      h('ul.ab-recent', {}, recent.map((r) => h('li.ab-recent__row', {},
        r.url
          ? h('a.ab-recent__name', { href: r.url, target: '_blank', rel: 'noopener noreferrer' }, r.name)
          : h('span.ab-recent__name', {}, r.name, h('span.ab-recent__priv', {}, 'Private repository')),
        r.lang ? h('span.ab-recent__lang', {}, h('i', { style: { background: langColor(r.lang) } }), r.lang) : h('span'),
        h('time.ab-recent__time', { datetime: r.when }, relTime(r.when))))));
  }

  const topLangs = (names) => {
    const m = new Map();
    for (const n of names) if (n) m.set(n, (m.get(n) || 0) + 1);
    return [...m.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n).slice(0, 6);
  };

  function renderOffline(reason) {
    const pub = repos.filter((r) => !r.private);
    const recent = [...repos].sort((a, b) => (a.updated < b.updated ? 1 : -1)).slice(0, 5)
      .map((r) => ({ name: r.title, url: r.url, lang: r.languages[0], when: `${r.updated}T12:00:00` }));
    renderGH({
      publicRepos: pub.length, followers: null, stars: null,
      langs: topLangs(repos.map((r) => r.languages[0])),
      recent, live: false,
      note: `Offline copy from my repo list. ${reason}`,
    });
  }

  async function loadGH(force) {
    controller?.abort();
    controller = new AbortController();
    const { signal } = controller;
    ghState = 'loading';
    refreshBtn.disabled = true;
    skeleton();
    try {
      const data = await loadGitHub(signal, { force });
      if (signal.aborted) return;
      const own = data.repos.filter((r) => !r.fork);
      renderGH({
        publicRepos: data.user.public_repos,
        followers: data.user.followers,
        stars: own.reduce((s, r) => s + r.stars, 0),
        langs: topLangs(own.map((r) => r.language)),
        recent: own.filter((r) => r.pushed_at).sort((a, b) => (a.pushed_at < b.pushed_at ? 1 : -1)).slice(0, 5)
          .map((r) => ({ name: r.name, url: r.html_url, lang: r.language, when: r.pushed_at })),
        live: true,
        note: `Live from GitHub${data.cached ? `, cached ${relTime(new Date(data.t).toISOString())}` : ', just now'}.`,
      });
    } catch (err) {
      if (signal.aborted || err?.name === 'AbortError') return;
      renderOffline(err?.rateLimited ? 'GitHub’s rate limit says try again later.' : 'GitHub could not be reached.');
    } finally {
      if (!signal.aborted) { ghState = 'done'; refreshBtn.disabled = false; }
    }
  }

  // --- timeline --------------------------------------------------------------
  const start = parseDay(p.since);
  const now = new Date();
  const months = [];
  for (let d = new Date(start.getFullYear(), start.getMonth(), 1); d <= now; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    months.push({ y: d.getFullYear(), m: d.getMonth(), items: [] });
  }
  for (const r of repos) {
    const d = parseDay(r.updated);
    const slot = months.find((x) => x.y === d.getFullYear() && x.m === d.getMonth());
    if (slot) slot.items.push(r);
  }
  months.forEach((x) => x.items.sort((a, b) => (a.updated < b.updated ? -1 : 1)));

  panels.timeline.append(
    h('p.ab-lead', {}, `From the first commit in ${fmtDate(p.since, { month: 'long', year: 'numeric' })} to now. Each project sits at the month of its latest push, so the busy end is what I’m still working on.`),
    h('ol.ab-tl', {}, months.map((x, i) => {
      const label = new Date(x.y, x.m, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
      const first = i === 0;
      const last = i === months.length - 1;
      return h('li.ab-tl__month', { class: `ab-tl__month${x.items.length ? '' : ' is-empty'}${last ? ' is-now' : ''}` },
        h('span.ab-tl__label', {}, label, first ? h('em', {}, 'first commit') : last ? h('em', {}, 'now') : null),
        h('span.ab-tl__rail', { 'aria-hidden': 'true' }),
        x.items.length
          ? h('ul.ab-tl__items', {}, x.items.map((r) => h('li', {},
            h('button.ab-tl__repo', {
              type: 'button',
              title: `${r.tagline} · ${fmtDate(r.updated)}${r.private ? ' · private repository' : ''}`,
              onclick: () => os.open('explorer', { repo: r.slug }),
            }, h('i', { 'aria-hidden': 'true' }), r.title, r.private ? h('span.ab-tl__priv', {}, 'private') : null))))
          : h('span.ab-tl__quiet', {}, 'no latest pushes'));
    })));

  // --- buttons -----------------------------------------------------------------
  const actions = h('div.ab-actions', {},
    h('button.btn.ab-btn', { type: 'button', onclick: () => win.close() }, 'OK'),
    h('button.btn.ab-btn', { type: 'button', onclick: () => win.close() }, 'Cancel'),
    h('button.btn.ab-btn', {
      type: 'button',
      onclick: () => {
        const [title, text] = APPLY_JOKES[applyN++ % APPLY_JOKES.length];
        os.notify({ title, text, icon: 'settings', timeout: 4500 });
      },
    }, 'Apply'));

  const root = h('div.app-about', {}, h('div.ab-frame', {}, tablist, sheet), actions);
  body.append(root);

  const onKey = (e) => {
    if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); win.close(); }
  };
  root.addEventListener('keydown', onKey);
  cleanups.push(() => root.removeEventListener('keydown', onKey));

  select(ctx.args?.tab || 'general');

  return {
    destroy() {
      controller?.abort();
      cleanups.forEach((fn) => fn());
    },
    reopen(args) { if (args?.tab) select(args.tab, true); },
  };
}
