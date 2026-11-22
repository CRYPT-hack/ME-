// File Explorer: every repository as a folder. Opening it (and coming back to
// the root) throws a few hundred files at the screen first; one of them lands
// on every real item. Thumbnails or a sortable Details list, a blue task pane,
// an address bar with clickable segments, history, search and full keyboard
// control.
import './explorer.css';
import { h } from '../../os/ui.js';
import { icon } from '../../os/icons.js';
import { repos, stats } from '../../data/repos.js';
import { profile } from '../../data/profile.js';
import { bombard, preloadBombard } from '../../lib/bombard.js';
import { repoCover, folderThumb, imageThumb, preloadPhotos, langColor } from './covers.js';

const BASE = 'C:\\Users\\shobhit\\Projects';
const ROOT_NAME = 'Projects';
const bySlug = Object.fromEntries(repos.map((r) => [r.slug, r]));
const primaryLangs = [...new Set(repos.map((r) => r.languages[0]))].sort((a, b) => a.localeCompare(b));

const GROUPS = {
  featured: { name: 'Featured', note: 'The ones I would show you first', list: () => repos.filter((r) => r.featured) },
  public: { name: 'Public', note: 'Open on GitHub, read the code', list: () => repos.filter((r) => !r.private) },
  private: { name: 'Private', note: 'Private: the code is not public, but you can read about them', list: () => repos.filter((r) => r.private) },
  languages: { name: 'By language', note: 'Grouped by main language', list: () => [] },
};

// session-wide preferences (survive closing and reopening the window)
const prefs = { view: 'thumbs', collapsed: new Set() };

// ── tiny inline toolbar glyphs ─────────────────────────────────────────────
const G = {
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10.5" fill="url(#exg)" stroke="#1f7a1c"/><path d="M13.5 7 8.5 12l5 5M9 12h7" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  fwd: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10.5" fill="url(#exg)" stroke="#1f7a1c"/><path d="m10.5 7 5 5-5 5M15 12H8" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 6.5a1 1 0 0 1 1-1h6l2 2h9a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" fill="#f5c84d" stroke="#a87410"/><path d="M12 17v-7m-3.2 3 3.2-3.2 3.2 3.2" fill="none" stroke="#1f7a1c" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12 12 4l9 8" fill="none" stroke="#c2361b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 11v9h12v-9" fill="#fffdf4" stroke="#8a7a55"/><rect x="10" y="14" width="4" height="6" fill="#6b4a2a"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 8a8 8 0 1 0 1 6" fill="none" stroke="#2463e8" stroke-width="2.4" stroke-linecap="round"/><path d="M20.5 3.5V9h-5.5" fill="none" stroke="#2463e8" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  thumbs: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="1" fill="#6fa0f5" stroke="#2856b8"/><rect x="13" y="3" width="8" height="8" rx="1" fill="#f5c84d" stroke="#a87410"/><rect x="3" y="13" width="8" height="8" rx="1" fill="#7ad36b" stroke="#2f7d24"/><rect x="13" y="13" width="8" height="8" rx="1" fill="#f2856e" stroke="#a8341d"/></svg>',
  details: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="#2856b8"><rect x="3" y="4" width="3" height="3"/><rect x="3" y="10.5" width="3" height="3"/><rect x="3" y="17" width="3" height="3"/></g><g fill="#5b6f8a"><rect x="8" y="4.8" width="13" height="1.6"/><rect x="8" y="11.2" width="13" height="1.6"/><rect x="8" y="17.8" width="13" height="1.6"/></g></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6" fill="#dff0ff" stroke="#2856b8" stroke-width="2"/><path d="m14.5 14.5 6 6" stroke="#8a6a2a" stroke-width="3" stroke-linecap="round"/></svg>',
  tasks: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="3.5" width="19" height="17" rx="2" fill="#fff" stroke="#2856b8"/><rect x="3" y="4" width="7" height="16" fill="#7ba2e7"/></svg>',
  chev: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7.2" fill="#fff" stroke="#9fb3e6"/><path d="m5 6.5 3 3 3-3M5 9.5" fill="none" stroke="#2856b8" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  defs: '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="exg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fe07a"/><stop offset="1" stop-color="#2f9a2a"/></linearGradient></defs></svg>',
};

// ── the file system ───────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-').map(Number);
  try { return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return iso; }
}
const newest = (list) => list.reduce((a, r) => (r.updated > a ? r.updated : a), '');

function nameOf(key) {
  if (!key) return ROOT_NAME;
  if (GROUPS[key]) return GROUPS[key].name;
  if (key.startsWith('lang:')) return key.slice(5);
  return bySlug[key]?.title || key;
}

function isFolder(key) {
  return !!(GROUPS[key] || (key.startsWith('lang:') && primaryLangs.includes(key.slice(5))) || bySlug[key]);
}

function folderItem(key) {
  let inside;
  if (key === 'languages') inside = primaryLangs.map((l) => repos.find((r) => r.languages[0] === l));
  else if (key.startsWith('lang:')) inside = repos.filter((r) => r.languages[0] === key.slice(5));
  else inside = GROUPS[key].list();
  const count = key === 'languages' ? primaryLangs.length : inside.length;
  return {
    key, kind: 'folder', name: nameOf(key), type: 'File folder', icon: 'folder',
    note: GROUPS[key]?.note || `${count} project${count === 1 ? '' : 's'} written mainly in ${key.slice(5)}`,
    count, lang: key.startsWith('lang:') ? key.slice(5) : '', updated: newest(inside.filter(Boolean)), visibility: '',
    thumb: () => folderThumb(key, inside.filter(Boolean)),
  };
}

function repoItem(r) {
  return {
    key: r.slug, kind: 'repo', name: r.title, type: 'Project folder', icon: 'folder', repo: r,
    note: r.tagline, lang: r.languages[0], updated: r.updated, visibility: r.private ? 'Private' : 'Public',
    thumb: () => repoCover(r),
  };
}

function repoFiles(r) {
  const base = { repo: r, updated: r.updated, visibility: r.private ? 'Private' : 'Public' };
  const out = [{
    ...base, key: `${r.slug}/README.md`, kind: 'readme', name: 'README.md', type: 'Markdown document',
    icon: 'file-text', lang: 'Markdown', note: 'What it is, what it does, how it works',
  }];
  if (r.url) {
    out.push({
      ...base, key: `${r.slug}/github.url`, kind: 'url', name: 'Open on GitHub.url', type: 'Internet shortcut',
      icon: 'globe', lang: '', note: r.url.replace(/^https?:\/\//, ''),
    });
  }
  (r.images || []).forEach((src, i) => {
    const ext = (/\.(png|jpe?g|webp|gif|avif)(?:$|\?)/i.exec(src)?.[1] || 'png').toLowerCase().replace('jpeg', 'jpg');
    out.push({
      ...base, key: `${r.slug}/img${i}`, kind: 'image', name: `${r.slug}-${i + 1}.${ext}`,
      type: ext === 'jpg' ? 'JPEG image' : `${ext.toUpperCase()} image`, icon: 'file-image', lang: '', src,
      note: 'Screenshot', thumb: () => imageThumb(src),
    });
  });
  for (const l of r.languages) {
    out.push({
      ...base, key: `${r.slug}/src:${l}`, kind: 'source', name: `${l} source`, type: `${l} source file`,
      icon: 'file-code', lang: l, note: `The ${l} side of ${r.title}`,
    });
  }
  return out;
}

function listing(path) {
  const key = path[path.length - 1] || '';
  if (!key) return [...Object.keys(GROUPS).map(folderItem), ...repos.map(repoItem)];
  if (key === 'languages') return primaryLangs.map((l) => folderItem(`lang:${l}`));
  if (key.startsWith('lang:')) return repos.filter((r) => r.languages[0] === key.slice(5)).map(repoItem);
  if (GROUPS[key]) return GROUPS[key].list().map(repoItem);
  if (bySlug[key]) return repoFiles(bySlug[key]);
  return [];
}

/** 'Featured', 'By language/Python', 'bob-the-builder' → path keys (invalid parts dropped). */
function parsePath(str) {
  const parts = String(str || '').split(/[\\/]+/).map((s) => s.trim()).filter(Boolean);
  if (parts[0] && /^projects$/i.test(parts[0])) parts.shift();
  const out = [];
  for (const p of parts) {
    const low = p.toLowerCase();
    const g = Object.keys(GROUPS).find((k) => k === low || GROUPS[k].name.toLowerCase() === low);
    if (g && !out.length) { out.push(g); continue; }
    if (out[out.length - 1] === 'languages') {
      const l = primaryLangs.find((x) => x.toLowerCase() === low);
      if (l) { out.push(`lang:${l}`); continue; }
    }
    const r = repos.find((x) => x.slug === low || x.repo.toLowerCase() === low || x.title.toLowerCase() === low);
    if (r) { out.push(r.slug); break; }
    break;
  }
  return out;
}

function pathFromArgs(args) {
  if (!args) return null;
  if (args.repo && bySlug[args.repo]) return [args.repo];
  if (typeof args.path === 'string') return parsePath(args.path);
  if (Array.isArray(args.path)) return args.path.filter(isFolder);
  return null;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const frame = () => new Promise((r) => requestAnimationFrame(() => r()));

// ── the app ───────────────────────────────────────────────────────────────
export function mount(body, ctx) {
  const { win, os } = ctx;
  win.flush();
  win.setIcon('folder-open');

  let path = pathFromArgs(ctx.args) || [];
  const back = [];
  const fwd = [];
  let items = [];        // everything in the folder
  let shown = [];        // after search + sort
  let sel = new Set();
  let focusIdx = -1;
  let anchor = -1;
  let query = '';
  let sort = { key: null, dir: 1 };
  let destroyed = false;
  let run = null;        // running bombardment
  let blastToken = 0;
  let pending = false;   // items hidden, waiting for their tile
  let paneOpen = false;  // narrow layouts: task pane drawer
  let lastPointer = window.matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse';

  const photosReady = preloadPhotos(repos);
  preloadBombard().catch(() => {});

  // ── DOM ────────────────────────────────────────────────────────────────
  const btn = (cls, label, glyph, onclick, extra = {}) => h(`button.ex-tb${cls}`, { type: 'button', title: label, 'aria-label': label, onclick, ...extra },
    h('span.ex-tb__g', { html: glyph }), h('span.ex-tb__l', {}, label));
  const bBack = btn('.ex-tb--labelled', 'Back', G.back, () => goBack());
  const bFwd = btn('', 'Forward', G.fwd, () => goForward());
  const bUp = btn('.ex-tb--labelled', 'Up', G.up, () => goUp());
  const bHome = btn('', 'Projects', G.home, () => goHome());
  const bRefresh = btn('.ex-tb--labelled', 'Refresh', G.refresh, () => refresh());
  const bThumbs = btn('.ex-tb--toggle', 'Thumbnails', G.thumbs, () => setView('thumbs'));
  const bDetails = btn('.ex-tb--toggle', 'Details', G.details, () => setView('details'));
  const bTasks = btn('.ex-tb--tasks', 'Tasks', G.tasks, () => togglePane(), { 'aria-expanded': 'false' });
  const search = h('input.ex-search__input', {
    type: 'search', placeholder: 'Search this folder', 'aria-label': 'Search this folder', spellcheck: 'false', autocomplete: 'off',
    oninput: () => { cancelBlast(); query = search.value.trim().toLowerCase(); sel.clear(); focusIdx = -1; renderList(); renderSide(); },
    onkeydown: (e) => {
      if (e.key === 'Escape' && search.value) { e.stopPropagation(); search.value = ''; query = ''; renderList(); renderSide(); }
      if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); focusItem(Math.max(0, focusIdx)); }
    },
  });
  const toolbar = h('div.ex-toolbar', { role: 'toolbar', 'aria-label': 'Explorer toolbar' },
    h('span', { html: G.defs }),
    bTasks, bBack, bFwd, bUp, h('span.ex-tb-sep'), bHome, bRefresh, h('span.ex-tb-sep'),
    h('div.ex-views', { role: 'group', 'aria-label': 'View' }, bThumbs, bDetails),
    h('label.ex-search', {}, h('span.ex-search__g', { html: G.search }), search));

  const crumbs = h('div.ex-addr__path');
  const address = h('div.ex-addr', {},
    h('span.ex-addr__label', {}, 'Address'),
    h('nav.ex-addr__field', { 'aria-label': 'Current folder' }, h('span.ex-addr__icon', { html: icon('folder-open', 16) }), crumbs));

  const pane = h('aside.ex-pane', { 'aria-label': 'Tasks and details' });
  const listEl = h('div.ex-list', { role: 'listbox', 'aria-multiselectable': 'true', 'aria-label': 'Folder contents', tabindex: '-1' });
  const heads = h('div.ex-heads');
  const empty = h('p.ex-empty', { hidden: true });
  const view = h('div.ex-view', {}, heads, listEl, empty);
  const scrim = h('div.ex-scrim', { onclick: () => togglePane(false) });
  const main = h('div.ex-main', {}, pane, scrim, view);
  const root = h('div.app-explorer', {}, toolbar, address, main);
  body.append(root);

  // ── rendering ──────────────────────────────────────────────────────────
  function current() { return path[path.length - 1] || ''; }
  function currentRepo() { return bySlug[current()] || null; }

  function filterSort() {
    let list = items;
    if (query) {
      list = list.filter((it) => [it.name, it.type, it.lang, it.note, it.repo?.languages.join(' ')]
        .some((s) => s && String(s).toLowerCase().includes(query)));
    }
    if (sort.key) {
      const k = sort.key;
      const val = (it) => (k === 'name' ? it.name : k === 'type' ? it.type : k === 'lang' ? it.lang || '' : k === 'updated' ? it.updated || '' : it.visibility || '');
      const folderRank = (it) => (it.kind === 'folder' ? 0 : it.kind === 'repo' ? 1 : 2);
      list = list.slice().sort((a, b) => (folderRank(a) - folderRank(b)) || (String(val(a)).localeCompare(String(val(b)), undefined, { numeric: true }) * sort.dir) || (a.n - b.n));
    }
    return list;
  }

  function artFor(it, small) {
    const th = it.thumb?.();
    if (th && th.url) {
      return h('img.ex-art', { src: th.url, alt: '', draggable: 'false', width: small ? 20 : 96, height: small ? 15 : 72 });
    }
    return h('span.ex-art.ex-art--icon', { html: icon(it.icon, small ? 16 : 56) });
  }

  function renderHeads() {
    heads.innerHTML = '';
    heads.hidden = prefs.view !== 'details';
    if (heads.hidden) return;
    const cols = [['name', 'Name'], ['type', 'Type'], ['lang', 'Language'], ['updated', 'Updated'], ['vis', 'Visibility']];
    for (const [k, label] of cols) {
      const on = sort.key === k;
      heads.append(h(`button.ex-head.ex-c--${k}`, {
        type: 'button', 'aria-sort': on ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none',
        title: `Sort by ${label.toLowerCase()}`,
        onclick: () => {
          if (sort.key === k) { if (sort.dir > 0) sort.dir = -1; else sort = { key: null, dir: 1 }; } else sort = { key: k, dir: k === 'updated' ? -1 : 1 };
          renderList();
        },
      }, label, on ? h('span.ex-head__arrow', { 'aria-hidden': 'true' }, sort.dir > 0 ? '▲' : '▼') : null));
    }
  }

  function renderList() {
    if (destroyed) return;
    const keepKeys = new Set(sel);
    shown = filterSort();
    sel = new Set([...keepKeys].filter((k) => shown.some((it) => it.key === k)));
    root.classList.toggle('is-details', prefs.view === 'details');
    renderHeads();
    listEl.innerHTML = '';
    const frag = document.createDocumentFragment();
    shown.forEach((it, i) => {
      const details = prefs.view === 'details';
      const el = h('div.ex-item', {
        role: 'option', tabindex: '-1', 'aria-selected': sel.has(it.key) ? 'true' : 'false',
        dataset: { i: String(i), kind: it.kind }, title: details ? null : `${it.name}\n${it.type}${it.note ? `\n${it.note}` : ''}`,
      });
      if (pending) el.classList.add('is-pending');
      if (details) {
        el.append(
          h('span.ex-cell.ex-c--name', {}, h('span.ex-item__art', {}, artFor(it, true)), h('span.ex-item__name', {}, it.name)),
          h('span.ex-cell.ex-c--type', {}, it.type),
          h('span.ex-cell.ex-c--lang', {}, it.lang ? h('i.ex-dot', { style: { background: langColor(it.lang) } }) : null, it.lang || ''),
          h('span.ex-cell.ex-c--updated', {}, fmtDate(it.updated)),
          h('span.ex-cell.ex-c--vis', {}, it.visibility ? h('span', { class: `ex-vis ex-vis--${it.visibility.toLowerCase()}` }, it.visibility) : ''));
      } else {
        const badge = it.repo && it.kind === 'repo' && it.repo.private ? h('span.ex-item__lock', { title: 'Private repository', html: '<svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="5" width="8" height="6" rx="1" fill="#6b6b70"/><path d="M4 5V3.6a2 2 0 0 1 4 0V5" fill="none" stroke="#6b6b70" stroke-width="1.4"/></svg>' }) : null;
        el.append(h('span.ex-item__art', {}, artFor(it, false), badge), h('span.ex-item__name', {}, it.name));
      }
      frag.append(el);
    });
    listEl.append(frag);
    if (focusIdx >= shown.length) focusIdx = shown.length - 1;
    updateRoving();
    empty.hidden = shown.length > 0;
    empty.textContent = query ? `Nothing in ${nameOf(current())} matches “${search.value}”.` : 'This folder is empty.';
    updateStatus();
    renderMenu();
  }

  function renderCrumbs() {
    crumbs.innerHTML = '';
    const segs = [{ label: BASE, depth: 0 }, ...path.map((k, i) => ({ label: nameOf(k), depth: i + 1 }))];
    segs.forEach((s, i) => {
      if (i) crumbs.append(h('span.ex-addr__sep', { 'aria-hidden': 'true' }, '\\'));
      const last = i === segs.length - 1;
      crumbs.append(h('button.ex-addr__seg', {
        type: 'button', 'aria-current': last ? 'location' : null,
        onclick: () => { if (!last) navigate(path.slice(0, s.depth)); },
      }, s.label));
    });
    crumbs.scrollLeft = crumbs.scrollWidth;
  }

  function updateButtons() {
    bBack.disabled = !back.length;
    bFwd.disabled = !fwd.length;
    bUp.disabled = !path.length;
    bHome.disabled = !path.length;
    bThumbs.setAttribute('aria-pressed', String(prefs.view === 'thumbs'));
    bDetails.setAttribute('aria-pressed', String(prefs.view === 'details'));
  }

  function updateStatus() {
    const n = shown.length;
    const parts = [`${n} object${n === 1 ? '' : 's'}${query && n !== items.length ? ` (of ${items.length})` : ''}`];
    const s = selected();
    if (s.length === 1) {
      const it = s[0];
      parts.push(`${it.name}: ${it.type}${it.lang && it.kind !== 'readme' ? ` · ${it.lang}` : ''}${it.updated ? ` · updated ${fmtDate(it.updated)}` : ''}${it.visibility ? ` · ${it.visibility}` : ''}`);
    } else if (s.length > 1) parts.push(`${s.length} objects selected`);
    else parts.push(currentRepo() ? currentRepo().tagline : (GROUPS[current()]?.note || (current() ? folderItem(current()).note : (lastPointer === 'touch' ? 'Tap a folder twice to open it' : 'Double-click a folder to open it'))));
    win.setStatus(parts);
  }

  function selected() { return shown.filter((it) => sel.has(it.key)); }

  function updateSel() {
    for (const el of listEl.children) {
      const it = shown[+el.dataset.i];
      el.setAttribute('aria-selected', sel.has(it.key) ? 'true' : 'false');
    }
    updateRoving();
    updateStatus();
    renderSide();
    renderMenu();
  }

  function updateRoving() {
    const els = listEl.children;
    for (let i = 0; i < els.length; i++) {
      els[i].tabIndex = i === (focusIdx < 0 ? 0 : focusIdx) ? 0 : -1;
      els[i].classList.toggle('is-focus', i === focusIdx);
    }
    listEl.tabIndex = els.length ? -1 : 0;
  }

  // ── task pane ───────────────────────────────────────────────────────────
  function section(id, title, content) {
    const open = !prefs.collapsed.has(id);
    const bodyEl = h('div.ex-task__body', { id: `ex-${id}-${win.id}`, hidden: !open }, content);
    const head = h('button.ex-task__head', {
      type: 'button', 'aria-expanded': String(open), 'aria-controls': bodyEl.id,
      onclick: () => {
        const now = prefs.collapsed.has(id);
        if (now) prefs.collapsed.delete(id); else prefs.collapsed.add(id);
        head.setAttribute('aria-expanded', String(now));
        bodyEl.hidden = !now;
      },
    }, h('span', {}, title), h('span.ex-task__chev', { html: G.chev }));
    return h('section.ex-task', { dataset: { sec: id } }, head, bodyEl);
  }

  const link = (ic, label, action, opts = {}) => {
    if (opts.href) {
      return h('a.ex-task__link', { href: opts.href, target: '_blank', rel: 'noopener noreferrer' },
        h('span.ex-task__ic', { html: icon(ic, 16) }), label);
    }
    return h('button.ex-task__link', { type: 'button', onclick: action, disabled: opts.disabled || null },
      h('span.ex-task__ic', { html: icon(ic, 16) }), label);
  };

  function taskLinks() {
    const s = selected();
    const out = [];
    const repo = s.length === 1 ? s[0].repo : currentRepo();
    if (s.length === 1) {
      const it = s[0];
      const label = { folder: 'Open this folder', repo: 'Open this project', readme: 'Read this file', url: 'Open the link in a new tab', image: 'View this picture', source: 'Read about this code' }[it.kind];
      out.push(link(it.kind === 'url' ? 'globe' : it.kind === 'image' ? 'file-image' : it.kind === 'folder' || it.kind === 'repo' ? 'folder-open' : 'file-text', label, () => openItem(it)));
      if (it.kind === 'repo') out.push(link('file-text', 'Read the README', () => os.open('viewer', { kind: 'repo', slug: it.repo.slug })));
    } else if (s.length > 1) {
      out.push(link('folder-open', `Open ${s.length} items`, () => openMany(s)));
      out.push(link('file', 'Clear the selection', () => { sel.clear(); updateSel(); }));
    } else if (currentRepo()) {
      out.push(link('file-text', 'Read the README', () => os.open('viewer', { kind: 'repo', slug: currentRepo().slug })));
    }
    if (repo && (s.length <= 1)) {
      if (repo.url) out.push(link('github', 'View on GitHub', null, { href: repo.url }));
      else out.push(h('p.ex-task__note', {}, h('span.ex-task__ic', { html: icon('warning', 16) }), 'Private repository: no public link yet'));
    }
    if (!s.length) {
      out.push(link('star', 'Throw the files at me again', () => refresh()));
      out.push(link('file-text', prefs.view === 'thumbs' ? 'Show the Details list' : 'Show Thumbnails', () => setView(prefs.view === 'thumbs' ? 'details' : 'thumbs')));
    }
    return out;
  }

  function placeLinks() {
    const out = [];
    if (path.length) out.push(link('folder', ROOT_NAME, () => goHome()));
    out.push(link('computer', 'Desktop', () => { togglePane(false); os.wm.minimizeAll(); }));
    out.push(link('pdf', 'Resume.pdf', () => os.open('resume')));
    out.push(link('mail', 'Contact', () => os.open('contact')));
    if (profile.links.github) out.push(link('github', 'My GitHub profile', null, { href: profile.links.github }));
    return out;
  }

  function detailsBox() {
    const s = selected();
    if (s.length > 1) return [h('p.ex-det__name', {}, `${s.length} items selected`)];
    const it = s[0] || null;
    const repo = it ? it.repo : currentRepo();
    const name = it ? it.name : nameOf(current());
    const type = it ? it.type : (repo ? 'Project folder' : 'File folder');
    const out = [h('p.ex-det__name', {}, name), h('p.ex-det__type', {}, type)];
    if (repo && (!it || it.kind === 'repo' || it.kind === 'readme')) {
      out.push(h('p.ex-det__tag', {}, repo.tagline));
      out.push(h('dl.ex-det__dl', {},
        h('dt', {}, 'Languages'), h('dd', {}, h('span.ex-chips', {}, repo.languages.map((l) => h('span.ex-chip', {}, h('i.ex-dot', { style: { background: langColor(l) } }), l)))),
        h('dt', {}, 'Updated'), h('dd', {}, fmtDate(repo.updated)),
        h('dt', {}, 'Visibility'), h('dd', {}, repo.private ? 'Private' : 'Public')));
    } else if (it && it.repo) {
      out.push(h('p.ex-det__tag', {}, it.note));
      out.push(h('dl.ex-det__dl', {},
        it.lang ? [h('dt', {}, 'Language'), h('dd', {}, h('span.ex-chip', {}, h('i.ex-dot', { style: { background: langColor(it.lang) } }), it.lang))] : null,
        h('dt', {}, 'Project'), h('dd', {}, it.repo.title),
        h('dt', {}, 'Updated'), h('dd', {}, fmtDate(it.updated)),
        h('dt', {}, 'Visibility'), h('dd', {}, it.visibility)));
    } else {
      const f = it || (current() ? folderItem(current()) : null);
      const count = it ? it.count : items.length;
      out.push(h('p.ex-det__tag', {}, f ? f.note : `My projects since ${fmtDate(stats.since)}.`));
      out.push(h('dl.ex-det__dl', {},
        h('dt', {}, 'Contains'), h('dd', {}, `${count} item${count === 1 ? '' : 's'}`),
        f?.updated ? [h('dt', {}, 'Last change'), h('dd', {}, fmtDate(f.updated))] : null,
        !f ? [h('dt', {}, 'Public'), h('dd', {}, `${stats.public} of ${stats.total}`)] : null));
    }
    return out;
  }

  function renderSide() {
    if (destroyed) return;
    pane.innerHTML = '';
    pane.append(
      section('tasks', 'File and Folder Tasks', h('div.ex-task__links', {}, taskLinks())),
      section('places', 'Other Places', h('div.ex-task__links', {}, placeLinks())),
      section('details', 'Details', h('div.ex-det', {}, detailsBox())));
  }

  function renderMenu() {
    const s = selected();
    const one = s.length === 1 ? s[0] : null;
    const gh = (one?.repo || currentRepo())?.url || null;
    win.setMenu([
      { label: 'File', items: [
        { label: s.length > 1 ? `Open ${s.length} items` : 'Open', action: () => openMany(s), disabled: !s.length },
        { label: 'View on GitHub', action: () => gh && window.open(gh, '_blank', 'noopener'), disabled: !gh },
        '-',
        { label: 'Up one level', action: () => goUp(), disabled: !path.length },
        '-',
        { label: 'Close', action: () => win.close() },
      ] },
      { label: 'Edit', items: [
        { label: 'Select all', action: () => selectAll(), disabled: !shown.length },
        { label: 'Invert selection', action: () => { sel = new Set(shown.filter((it) => !sel.has(it.key)).map((it) => it.key)); updateSel(); }, disabled: !shown.length },
        { label: 'Find in this folder', action: () => search.focus() },
      ] },
      { label: 'View', items: [
        { label: `${prefs.view === 'thumbs' ? '• ' : ''}Thumbnails`, action: () => setView('thumbs') },
        { label: `${prefs.view === 'details' ? '• ' : ''}Details`, action: () => setView('details') },
        '-',
        { label: 'Refresh', action: () => refresh() },
      ] },
      { label: 'Help', items: [
        { label: 'About File Explorer', action: () => about() },
      ] },
    ]);
  }

  function renderAll() {
    renderCrumbs();
    updateButtons();
    renderList();
    renderSide();
    win.setTitle(nameOf(current()));
  }

  // ── navigation ─────────────────────────────────────────────────────────
  function load(p) {
    path = p.slice();
    items = listing(path);
    items.forEach((it, n) => { it.n = n; });
    sel = new Set();
    focusIdx = -1;
    anchor = -1;
    if (query) { query = ''; search.value = ''; }
    view.scrollTop = 0;
  }

  function navigate(p, { record = true, blast: forceBlast = false } = {}) {
    if (destroyed) return;
    const same = p.length === path.length && p.every((k, i) => k === path[i]);
    if (same && !forceBlast) return;
    cancelBlast();
    if (record && !same) { back.push(path.slice()); fwd.length = 0; }
    const wasRoot = !path.length;
    load(p);
    togglePane(false);
    renderAll();
    os.sound.play('click');
    if (forceBlast || (!p.length && !wasRoot)) blast();
    else listEl.focus({ preventScroll: true });
  }

  function goBack() {
    if (!back.length) return;
    fwd.push(path.slice());
    navigate(back.pop(), { record: false });
  }
  function goForward() {
    if (!fwd.length) return;
    back.push(path.slice());
    navigate(fwd.pop(), { record: false });
  }
  function goUp() { if (path.length) navigate(path.slice(0, -1)); }
  function goHome() { if (path.length) navigate([]); }
  function refresh() {
    items = listing(path);
    items.forEach((it, n) => { it.n = n; });
    renderList();
    renderSide();
    blast();
  }

  function setView(v) {
    if (prefs.view === v) return;
    cancelBlast();
    prefs.view = v;
    updateButtons();
    renderList();
    renderSide();
    if (focusIdx >= 0) focusItem(focusIdx);
  }

  /** Open several items: navigate into the first folder only, open the rest. */
  function openMany(list) {
    let went = false;
    for (const it of list) {
      if (it.kind === 'folder' || it.kind === 'repo') {
        if (went) continue;
        went = true;
      }
      openItem(it);
    }
  }

  function openItem(it) {
    if (!it) return;
    switch (it.kind) {
      case 'folder':
      case 'repo':
        navigate(path.concat(it.key));
        break;
      case 'readme':
      case 'source':
        os.open('viewer', { kind: 'repo', slug: it.repo.slug });
        break;
      case 'url':
        if (it.repo.url) window.open(it.repo.url, '_blank', 'noopener');
        break;
      case 'image':
        os.open('viewer', { kind: 'image', src: it.src, title: it.name });
        break;
      default:
    }
  }

  function about() {
    os.open('viewer', {
      kind: 'text',
      title: 'About File Explorer',
      text: [
        'File Explorer, CRYPT OS edition',
        '',
        `My projects since ${fmtDate(stats.since)} are folders in here: ${stats.total} of them, ${stats.public} public.`,
        'Each one holds its README, a shortcut to GitHub when the code is public, any screenshots, and a file for each language it uses.',
        '',
        'Opening this window throws every file at you before it puts them away. That is a feature. Click or press any key to skip it.',
        '',
        'Keys',
        '  Arrows        move the selection (Shift extends it)',
        '  Enter         open',
        '  Backspace     up one level',
        '  Alt + Left    back      Alt + Right   forward',
        '  Ctrl + A      select all',
        '  F5            throw the files again',
      ].join('\n'),
    });
  }

  // ── selection + keyboard ──────────────────────────────────────────────────
  function selectAll() {
    sel = new Set(shown.map((it) => it.key));
    updateSel();
  }

  function focusItem(i, { extend = false, toggle = false, keep = false } = {}) {
    if (!shown.length) return;
    i = Math.max(0, Math.min(shown.length - 1, i));
    focusIdx = i;
    if (extend && anchor >= 0) {
      sel = new Set();
      const [a, b] = anchor < i ? [anchor, i] : [i, anchor];
      for (let k = a; k <= b; k++) sel.add(shown[k].key);
    } else if (toggle) {
      const k = shown[i].key;
      if (sel.has(k)) sel.delete(k); else sel.add(k);
      anchor = i;
    } else if (!keep) {
      sel = new Set([shown[i].key]);
      anchor = i;
    }
    updateSel();
    const el = listEl.children[i];
    if (el) {
      el.focus({ preventScroll: true });
      el.scrollIntoView({ block: 'nearest' });
    }
  }

  function columns() {
    if (prefs.view === 'details') return 1;
    const els = listEl.children;
    if (!els.length) return 1;
    const top = els[0].offsetTop;
    let c = 0;
    for (const el of els) { if (el.offsetTop !== top) break; c++; }
    return c || 1;
  }

  listEl.addEventListener('keydown', (e) => {
    if (e.target === search) return;
    const n = shown.length;
    const i = focusIdx < 0 ? -1 : focusIdx;
    const mod = { extend: e.shiftKey };
    const cols = columns();
    switch (e.key) {
      case 'ArrowRight': e.preventDefault(); focusItem(i < 0 ? 0 : i + (prefs.view === 'details' ? 0 : 1), mod); break;
      case 'ArrowLeft': e.preventDefault(); focusItem(i < 0 ? 0 : i - (prefs.view === 'details' ? 0 : 1), mod); break;
      case 'ArrowDown': e.preventDefault(); focusItem(i < 0 ? 0 : Math.min(n - 1, i + cols), mod); break;
      case 'ArrowUp': e.preventDefault(); focusItem(i < 0 ? 0 : Math.max(0, i - cols), mod); break;
      case 'Home': e.preventDefault(); focusItem(0, mod); break;
      case 'End': e.preventDefault(); focusItem(n - 1, mod); break;
      case 'Enter': {
        e.preventDefault();
        const s = selected();
        if (s.length) openMany(s.slice(0, 6)); else if (i >= 0) openItem(shown[i]);
        break;
      }
      case ' ':
        e.preventDefault();
        if (i >= 0) focusItem(i, { toggle: e.ctrlKey || e.metaKey });
        break;
      case 'a': case 'A':
        if (e.ctrlKey || e.metaKey) { e.preventDefault(); selectAll(); }
        break;
      default:
    }
  });

  root.addEventListener('keydown', (e) => {
    const inField = e.target === search;
    if (e.key === 'Backspace' && !inField) { e.preventDefault(); goUp(); }
    else if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); goBack(); }
    else if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); goForward(); }
    else if (e.key === 'F5') { e.preventDefault(); refresh(); }
    else if (e.key === 'F3' || ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F'))) { e.preventDefault(); search.focus(); search.select(); }
    else if (e.key === 'Escape' && paneOpen) { e.preventDefault(); togglePane(false); bTasks.focus(); }
    else if (e.key === 'Escape' && !inField && sel.size) { sel.clear(); updateSel(); }
  });

  listEl.addEventListener('click', (e) => {
    const el = e.target.closest('.ex-item');
    if (!el) { if (sel.size) { sel.clear(); updateSel(); } return; }
    const i = +el.dataset.i;
    const wasOnly = sel.size === 1 && sel.has(shown[i].key);
    focusItem(i, { extend: e.shiftKey, toggle: e.ctrlKey || e.metaKey });
    // touch: a second tap on the selected item opens it
    if (lastPointer === 'touch' && wasOnly && !e.shiftKey && !e.ctrlKey) openItem(shown[i]);
  });
  listEl.addEventListener('pointerdown', (e) => { lastPointer = e.pointerType; });
  listEl.addEventListener('dblclick', (e) => {
    const el = e.target.closest('.ex-item');
    if (el && lastPointer !== 'touch') openItem(shown[+el.dataset.i]);
  });
  // clicks on the empty area around the list clear the selection too
  view.addEventListener('click', (e) => {
    if (e.target === view && sel.size) { sel.clear(); updateSel(); }
  });

  function togglePane(force) {
    const next = force === undefined ? !paneOpen : !!force;
    if (next === paneOpen) return;
    paneOpen = next;
    root.classList.toggle('is-pane-open', paneOpen);
    bTasks.setAttribute('aria-expanded', String(paneOpen));
    if (paneOpen) pane.querySelector('button, a')?.focus();
  }

  // ── the bombardment ──────────────────────────────────────────────────────
  /** Stop any bombardment (running or about to start) and show every item. */
  function cancelBlast() {
    blastToken++;
    run?.skip();
    run = null;
    if (pending) {
      pending = false;
      for (const el of listEl.children) reveal(el, false);
    }
  }

  async function blast() {
    if (destroyed) return;
    const token = ++blastToken;
    run?.skip();
    if (os.reducedMotion) {
      listEl.classList.remove('is-fading');
      void listEl.offsetWidth;
      listEl.classList.add('is-fading');
      return;
    }
    pending = true;
    for (const el of listEl.children) el.classList.add('is-pending');

    // let the window finish opening, the screenshots decode and the atlas build
    const waits = [frame().then(frame), Promise.race([photosReady, wait(700)]), Promise.race([preloadBombard().catch(() => {}), wait(1500)])];
    if (win.el.classList.contains('is-opening')) waits.push(wait(240));
    await Promise.all(waits);
    if (destroyed || token !== blastToken) return;
    // minimised or sent behind another window during the wait: no show
    if (win.isMinimized() || os.wm.active !== win) { cancelBlast(); return; }
    renderList(); // pick up screenshots that just arrived (items stay hidden)

    const box = view.getBoundingClientRect();
    const targets = [];
    for (const el of listEl.children) {
      const it = shown[+el.dataset.i];
      const art = el.querySelector('.ex-art');
      const r = (art.querySelector('svg') || art).getBoundingClientRect();
      const visible = r.width > 2 && r.bottom > box.top && r.top < box.bottom && r.right > box.left && r.left < box.right;
      if (!visible || targets.length >= 120) { reveal(el, false); continue; }
      const th = it.thumb?.();
      targets.push({ x: r.left, y: r.top, w: r.width, h: r.height, key: it.key, el, image: th ? th.canvas : null, sprite: th ? null : it.icon });
    }
    if (!targets.length) {
      pending = false;
      for (const el of listEl.children) reveal(el, false);
      return;
    }
    const from = { x: box.left + box.width / 2, y: box.top + box.height * 0.45 };
    const mine = bombard({
      layer: os.fx, targets, sound: os.sound, reducedMotion: false, from,
      onLand: (t) => reveal(t.el, true),
    });
    run = mine;
    await mine;
    if (run === mine) run = null;
    if (token !== blastToken || destroyed) return;
    pending = false;
    for (const el of listEl.children) reveal(el, false);
    if (!root.contains(document.activeElement) || document.activeElement === listEl) {
      if (shown.length) listEl.children[Math.max(0, focusIdx)]?.focus({ preventScroll: true });
    }
  }

  function reveal(el, pop) {
    if (!el.classList.contains('is-pending')) return;
    el.classList.remove('is-pending');
    if (pop) {
      el.classList.add('is-landed');
      setTimeout(() => el.classList.remove('is-landed'), 400);
    }
  }

  photosReady.then(() => {
    if (!destroyed && !pending) { renderList(); renderSide(); }
  });

  // ── go ──────────────────────────────────────────────────────────────────
  load(path);
  renderAll();
  blast();

  return {
    reopen(args) {
      const p = pathFromArgs(args);
      togglePane(false);
      if (p) navigate(p, { blast: true });
      else navigate([], { blast: true });
    },
    resize() {
      // nothing to measure: the grid reflows with CSS; just keep focus in view
      if (focusIdx >= 0) listEl.children[focusIdx]?.scrollIntoView({ block: 'nearest' });
    },
    destroy() {
      destroyed = true;
      blastToken++;
      run?.skip();
      run = null;
    },
  };
}
