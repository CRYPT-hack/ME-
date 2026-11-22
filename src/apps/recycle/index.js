// Recycle Bin: a details-view file list of things a student developer has
// (wisely) deleted. Restore throws a file back out with a joke; Empty burns
// the lot on a canvas. Nothing persists: a reload refills the bin.
import './recycle.css';
import { h } from '../../os/ui.js';
import { icon } from '../../os/icons.js';

const HOUR = 36e5;
const KB = 1024, MB = KB * 1024, GB = MB * 1024;

/** The bin's contents. `ago` is hours since deletion; `size` is bytes. */
const FILES = [
  {
    id: 'sleep', name: 'sleep_schedule.ics', icon: 'file', type: 'Calendar file',
    from: 'C:\\Users\\shobhit\\Calendar', ago: 3, size: 2 * KB,
    joke: 'sleep_schedule.ics is back. It will be ignored again by 2 AM.',
    body: [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Sleep',
      'DTSTART:23:00',
      'DTEND:07:00',
      'RRULE:FREQ=DAILY',
      'STATUS:CANCELLED',
      'COMMENT:moved to "after this one commit"',
      'END:VEVENT',
      'END:VCALENDAR',
    ],
  },
  {
    id: 'todo', name: 'todo_FINAL_final_v3.txt', icon: 'file-text', type: 'Text document',
    from: 'C:\\Users\\shobhit\\Desktop', ago: 9, size: 1.2 * KB,
    joke: 'Restored. todo_FINAL_final_v4.txt is already in the works.',
    body: [
      'TODO (final. really. v3)',
      '',
      '[x] make a todo list',
      '[x] rename it to FINAL',
      '[x] rename it to FINAL_final',
      '[ ] actually do item 4',
      '[ ] item 4',
      '[ ] stop starting new side projects',
      '[x] start a new side project',
    ],
  },
  {
    id: 'pwm', name: 'my_first_password_manager.py', icon: 'file-code', type: 'Python file',
    from: 'C:\\Users\\shobhit\\Projects\\old', ago: 30, size: 3.4 * KB,
    refuse: true,
    joke: 'Restore blocked. It kept every password in a dict called passwords. Some files should stay deleted.',
    body: [
      '# my first password manager (jk, please never)',
      '',
      'passwords = {',
      '    "everything": "password123",',
      '}',
      '',
      'def encrypt(p):',
      '    return p[::-1]  # military grade',
      '',
      '# TODO: learn what a hash is',
    ],
  },
  {
    id: 'nm', name: 'node_modules', icon: 'folder', type: 'File folder', dir: true,
    from: 'C:\\Users\\shobhit\\Projects\\bob-the-builder', ago: 52, size: 2.3 * GB,
    joke: 'node_modules restored. Your disk would like a word.',
    body: [
      'node_modules/',
      '  48,213 folders',
      '  391,004 files',
      '  1 package you actually installed',
      '',
      'Nobody has opened this folder and come back the same.',
      'Regenerate with: npm install (and a coffee)',
    ],
  },
  {
    id: 'fixlater', name: '"fix later" comments.txt', icon: 'file-text', type: 'Text document',
    from: 'Every repository', ago: 75, size: 14 * KB,
    joke: 'Restored. Later is still not now.',
    body: [
      '// TODO: fix later',
      '// TODO: fix later (seriously)',
      '// FIXME: this works but I do not know why',
      '// HACK: temporary (since day one)',
      '// TODO: remove before demo',
      '// TODO: remove after demo',
      '// NOTE: future me, sorry',
      '',
      '... 212 more',
    ],
  },
  {
    id: 'tabs', name: 'tabs-vs-spaces-debate.md', icon: 'file-text', type: 'Markdown file',
    from: 'C:\\Users\\shobhit\\Documents\\arguments', ago: 120, size: 88 * KB,
    joke: 'The debate is back on. The formatter has been notified.',
    body: [
      '# Tabs vs spaces',
      '',
      'Round 1: spaces win on a technicality.',
      'Round 2: tabs win on accessibility.',
      'Round 3: someone mentions 3-space indents. Silence.',
      '...',
      'Round 47: the formatter decides for everyone.',
      '',
      'Status: resolved by a config file nobody read.',
    ],
  },
  {
    id: 'procr', name: 'procrastination.exe', icon: 'settings', type: 'Application',
    from: 'C:\\Program Files\\Later', ago: 168, size: 0,
    delay: 4200,
    joke: 'procrastination.exe has finished restoring. It took its time.',
    body: [
      'procrastination.exe',
      '',
      'Version: will update tomorrow',
      'Publisher: future me',
      'Runs on: every deadline',
      '',
      'Install size: 0 bytes. It never got around to it.',
    ],
  },
  {
    id: 'center', name: 'css_center_div_attempts', icon: 'folder', type: 'File folder', dir: true,
    from: 'C:\\Users\\shobhit\\Projects\\web', ago: 260, size: 412 * KB,
    joke: 'All 37 attempts restored. Spoiler: display: grid; place-items: center.',
    body: [
      'attempt_01_margin-auto.css',
      'attempt_02_text-align-center.css',
      'attempt_03_position-absolute-50.css',
      'attempt_04_vertical-align-why.css',
      'attempt_05_table-cell-1999.css',
      '...',
      'attempt_36_transform-translate-minus-50.css',
      'attempt_37_display-grid-place-items-center.css  <- this one',
    ],
  },
  {
    id: 'merge', name: 'merge_conflict_strategy.txt', icon: 'file-text', type: 'Text document',
    from: 'C:\\Users\\shobhit\\Documents', ago: 400, size: 640,
    joke: 'Restored. Step 1 is still "accept both changes and hope".',
    body: [
      'How I resolve merge conflicts',
      '',
      '1. Read the conflict markers.',
      '2. Accept both changes.',
      '3. Run it. It does not run.',
      '4. Read the conflict markers properly this time.',
      '5. Commit message: "fix merge"',
      '6. Commit message: "fix merge (2)"',
    ],
  },
  {
    id: 'so', name: 'copied_from_forum_2011.js', icon: 'file-code', type: 'JavaScript file',
    from: 'C:\\Users\\shobhit\\Projects\\snippets', ago: 610, size: 5.1 * KB,
    joke: 'Restored. It still works and nobody still knows why.',
    body: [
      '// source: an answer from 2011 with 4,000 upvotes',
      '// do not touch. do not refactor. do not look at it directly.',
      '',
      'function magic(x) {',
      '  return ~~(x + 0.5) | 0 >>> 0;',
      '}',
      '',
      '// it works. that is all I know.',
    ],
  },
  {
    id: 'newfolder', name: 'New Folder (2)', icon: 'folder', type: 'File folder', dir: true,
    from: 'C:\\Users\\shobhit\\Desktop', ago: 900, size: 0,
    joke: 'New Folder (2) restored. It is still empty. It was always empty.',
    body: ['This folder is empty.', '', 'So was New Folder (1).'],
  },
];

const fmtSize = (b, dir) => {
  if (dir && !b) return '';
  if (b < KB) return `${Math.round(b)} bytes`;
  if (b < MB) return `${Math.max(1, Math.round(b / KB))} KB`;
  if (b < GB) return `${(b / MB).toFixed(1)} MB`;
  return `${(b / GB).toFixed(1)} GB`;
};
const fmtDate = (t) => {
  try {
    return new Date(t).toLocaleString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch { return new Date(t).toISOString().slice(0, 16).replace('T', ' '); }
};

const COLS = [
  { key: 'name', label: 'Name' },
  { key: 'from', label: 'Original location' },
  { key: 'when', label: 'Date deleted' },
  { key: 'size', label: 'Size' },
];

const RESTORE_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 11a7 7 0 1 1 2 5" fill="none" stroke="#2a8a28" stroke-width="2.4" stroke-linecap="round"/><path d="M2.5 6.5 5 11.5l5-2.5" fill="none" stroke="#2a8a28" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function mount(body, ctx) {
  const { os, win } = ctx;
  const reduced = os.reducedMotion;
  win.flush();

  const now = Date.now();
  let items = FILES.map((f, i) => ({ ...f, when: now - f.ago * HOUR - i * 7 * 60e3 }));
  let sort = { key: 'when', dir: -1 };
  const selected = new Set();
  const leaving = new Set(); // ids whose restore is scheduled or animating
  let active = null; // id of the keyboard cursor
  let anchor = null; // for shift-click ranges
  let previewId = null;
  let burning = null; // { finish() } while the bin is on fire
  let lastFocus = null;
  let fireStop = null; // stops the particle loop, which outlives `burning`

  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
  const anims = new Set();
  const fxNodes = new Set();
  const uid = `rb${Math.random().toString(36).slice(2, 8)}`;

  // ── toolbar ────────────────────────────────────────────
  const tool = (cls, html, label, onclick) => h(`button.rb__tool${cls}`, { type: 'button', onclick },
    h('span.rb__toolicon', { html }), h('span', {}, label));
  const restoreBtn = tool('', RESTORE_SVG, 'Restore', () => restoreSelected());
  const previewBtn = tool('', icon('file-text', 20), 'Preview', () => { if (active) openPreview(active); });
  const emptyBtn = tool('.rb__tool--danger', icon('recycle', 20), 'Empty Recycle Bin', () => confirmEmpty());
  const toolbar = h('div.rb__toolbar', { role: 'toolbar', 'aria-label': 'Recycle Bin' },
    restoreBtn, previewBtn, h('span.rb__sep', { 'aria-hidden': 'true' }), emptyBtn);

  // ── task pane (wide windows only) ──────────────────────
  const taskEmpty = h('button.rb__task', { type: 'button', onclick: () => confirmEmpty() },
    h('span', { html: icon('recycle', 16) }), 'Empty the Recycle Bin');
  const taskRestore = h('button.rb__task', { type: 'button', onclick: () => restoreSelected() },
    h('span', { html: RESTORE_SVG }), 'Restore the selected items');
  const details = h('div.rb__details');
  const side = h('aside.rb__side', { 'aria-label': 'Tasks' },
    h('section.rb__box', {}, h('h3.rb__boxtitle', {}, 'Recycle Bin Tasks'), taskEmpty, taskRestore),
    h('section.rb__box', {}, h('h3.rb__boxtitle', {}, 'Details'), details));

  // ── list ───────────────────────────────────────────────
  const headBtns = COLS.map((c) => h('button.rb__th', {
    type: 'button', dataset: { key: c.key },
    onclick: () => { sort = sort.key === c.key ? { key: c.key, dir: -sort.dir } : { key: c.key, dir: c.key === 'name' || c.key === 'from' ? 1 : -1 }; render(); },
  }, c.label, h('span.rb__arrow', { 'aria-hidden': 'true' })));
  const head = h('div.rb__head', { role: 'presentation' }, ...headBtns);
  const listbox = h('div.rb__rows', {
    id: `${uid}-list`, role: 'listbox', tabindex: '0', 'aria-multiselectable': 'true', 'aria-label': 'Deleted files',
  });
  const empty = h('div.rb__empty', { hidden: true },
    h('span.rb__emptyicon', { html: icon('recycle', 72) }),
    h('p.rb__emptytitle', {}, 'The Recycle Bin is empty'),
    h('p.rb__emptysub', {}, 'All my mistakes are gone. New ones are being written as we speak.'));
  const canvas = h('canvas.rb__fire', { 'aria-hidden': 'true' });
  const listWrap = h('div.rb__list', {}, head, listbox, empty, canvas);

  // ── preview pane ───────────────────────────────────────
  const pvIcon = h('span.rb__pvicon');
  const pvTitle = h('h3.rb__pvtitle', { id: `${uid}-pvt` });
  const pvMeta = h('p.rb__pvmeta');
  const pvText = h('pre.rb__pvtext', { tabindex: '0', 'aria-label': 'File contents' });
  const pvRestore = h('button.btn.btn--primary', { type: 'button', onclick: () => { const id = previewId; closePreview(); restore([id]); } }, 'Restore');
  const pvClose = h('button.btn', { type: 'button', onclick: () => closePreview() }, 'Close');
  const preview = h('section.rb__preview', { hidden: true, role: 'region', 'aria-labelledby': pvTitle.id },
    h('header.rb__pvhead', {}, pvIcon, h('div.rb__pvwho', {}, pvTitle, pvMeta),
      h('button.rb__pvx', { type: 'button', 'aria-label': 'Close preview', onclick: () => closePreview() }, '×')),
    pvText,
    h('div.rb__pvbtns', {}, pvRestore, pvClose));

  // ── modal ──────────────────────────────────────────────
  const modal = h('div.rb__modal', { hidden: true });

  const main = h('div.rb__main', {}, side, listWrap, preview);
  const root = h('div.app-recycle', {}, toolbar, main, modal);
  body.append(root);

  // ── rendering ──────────────────────────────────────────
  const byId = (id) => items.find((f) => f.id === id);
  const rowEls = new Map();

  function sorted() {
    const k = sort.key, d = sort.dir;
    return [...items].sort((a, b) => {
      const va = a[k], vb = b[k];
      if (typeof va === 'number') return (va - vb) * d || a.name.localeCompare(b.name);
      return String(va).localeCompare(String(vb), 'en', { sensitivity: 'base' }) * d;
    });
  }

  function rowFor(f) {
    const optId = `${uid}-${f.id}`;
    const el = h('div.rb__row', {
      id: optId, role: 'option', dataset: { id: f.id },
      'aria-label': `${f.name}, ${f.type}. From ${f.from}. Deleted ${fmtDate(f.when)}${f.size || !f.dir ? `. ${fmtSize(f.size, f.dir) || '0 bytes'}` : ''}`,
    },
    h('span.rb__cell.rb__cell--name', {},
      h('span.rb__icon', { html: icon(f.icon, 20) }),
      h('span.rb__nametext', {}, h('span.rb__fname', {}, f.name), h('small.rb__sub', {}, f.from))),
    h('span.rb__cell.rb__cell--from', {}, f.from),
    h('span.rb__cell.rb__cell--when', {}, fmtDate(f.when)),
    h('span.rb__cell.rb__cell--size', {}, fmtSize(f.size, f.dir) || (f.dir ? '' : '0 bytes')));
    return el;
  }

  function render() {
    for (const b of headBtns) {
      const on = b.dataset.key === sort.key;
      b.classList.toggle('is-sorted', on);
      b.setAttribute('aria-label', `Sort by ${b.textContent}${on ? (sort.dir > 0 ? ', ascending' : ', descending') : ''}`);
      b.querySelector('.rb__arrow').textContent = on ? (sort.dir > 0 ? '▲' : '▼') : '';
    }
    const list = sorted();
    listbox.textContent = '';
    for (const f of list) {
      let el = rowEls.get(f.id);
      if (!el) { el = rowFor(f); rowEls.set(f.id, el); }
      listbox.append(el);
    }
    paintSelection();
    const isEmpty = !items.length;
    listbox.hidden = isEmpty;
    head.hidden = isEmpty;
    empty.hidden = !isEmpty;
    if (isEmpty) win.setIcon('recycle');
    updateChrome();
  }

  function paintSelection() {
    for (const [id, el] of rowEls) {
      const on = selected.has(id);
      el.classList.toggle('is-sel', on);
      el.setAttribute('aria-selected', on ? 'true' : 'false');
      el.classList.toggle('is-active', id === active);
    }
    if (active && rowEls.has(active) && byId(active)) {
      listbox.setAttribute('aria-activedescendant', `${uid}-${active}`);
    } else listbox.removeAttribute('aria-activedescendant');
    updateChrome();
  }

  function updateChrome() {
    const n = items.length;
    const sel = [...selected].filter(byId);
    const hasSel = sel.length > 0;
    restoreBtn.disabled = !hasSel || !!burning;
    taskRestore.disabled = !hasSel || !!burning;
    previewBtn.disabled = !active || !byId(active) || !!burning;
    emptyBtn.disabled = !n || !!burning;
    taskEmpty.disabled = !n || !!burning;
    taskRestore.lastChild.textContent = sel.length > 1 ? 'Restore the selected items' : 'Restore this item';
    const total = items.reduce((s, f) => s + f.size, 0);
    details.textContent = '';
    if (sel.length === 1) {
      const f = byId(sel[0]);
      details.append(h('strong', {}, f.name), h('span', {}, f.type), h('span', {}, `Deleted ${fmtDate(f.when)}`),
        f.size || !f.dir ? h('span', {}, `Size: ${fmtSize(f.size, f.dir) || '0 bytes'}`) : null);
    } else if (sel.length > 1) {
      const s = sel.reduce((a, id) => a + byId(id).size, 0);
      details.append(h('strong', {}, `${sel.length} items selected`), h('span', {}, `Total size: ${fmtSize(s) }`));
    } else {
      details.append(h('strong', {}, 'Recycle Bin'), h('span', {}, n ? `${n} item${n === 1 ? '' : 's'}, ${fmtSize(total)}` : 'Empty. Spotless. Suspicious.'));
    }
    if (sel.length) {
      const s = sel.reduce((a, id) => a + byId(id).size, 0);
      win.setStatus([`${sel.length} object${sel.length === 1 ? '' : 's'} selected`, fmtSize(s) || '0 bytes']);
    } else {
      win.setStatus(n
        ? [`${n} object${n === 1 ? '' : 's'}`, fmtSize(total), 'Double-click a file to peek inside']
        : ['0 objects', '0 bytes']);
    }
  }

  // ── selection ──────────────────────────────────────────
  const order = () => [...listbox.children].map((el) => el.dataset.id);

  function selectOnly(id) { selected.clear(); if (id) selected.add(id); active = id; anchor = id; paintSelection(); }
  function selectRange(id) {
    const ids = order();
    const a = ids.indexOf(anchor ?? id), b = ids.indexOf(id);
    if (a < 0 || b < 0) return selectOnly(id);
    selected.clear();
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) selected.add(ids[i]);
    active = id;
    paintSelection();
  }
  function toggle(id) {
    if (selected.has(id)) selected.delete(id); else selected.add(id);
    active = id; anchor = id;
    paintSelection();
  }
  function scrollIntoView(id) {
    rowEls.get(id)?.scrollIntoView({ block: 'nearest' });
  }

  listbox.addEventListener('click', (e) => {
    if (burning) return;
    const row = e.target.closest('.rb__row');
    if (!row) { selectOnly(null); return; }
    const id = row.dataset.id;
    if (e.shiftKey) selectRange(id);
    else if (e.ctrlKey || e.metaKey) toggle(id);
    else selectOnly(id);
    os.sound.play('click');
  });
  listbox.addEventListener('dblclick', (e) => {
    const row = e.target.closest('.rb__row');
    if (row && !burning) { selectOnly(row.dataset.id); openPreview(row.dataset.id); }
  });
  listbox.addEventListener('focus', () => {
    if (!active && items.length) { active = order()[0]; paintSelection(); }
  });
  listbox.addEventListener('keydown', (e) => {
    if (burning) return;
    const ids = order();
    if (!ids.length) return;
    let i = Math.max(0, ids.indexOf(active));
    const move = (j) => {
      j = Math.max(0, Math.min(ids.length - 1, j));
      const id = ids[j];
      if (e.shiftKey) selectRange(id);
      else if (e.ctrlKey || e.metaKey) { active = id; paintSelection(); }
      else selectOnly(id);
      scrollIntoView(id);
    };
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); move(ids.indexOf(active) < 0 ? 0 : i + 1); break;
      case 'ArrowUp': e.preventDefault(); move(i - 1); break;
      case 'Home': e.preventDefault(); move(0); break;
      case 'End': e.preventDefault(); move(ids.length - 1); break;
      case ' ':
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) toggle(active || ids[0]);
        else selectOnly(active || ids[0]);
        break;
      case 'Enter': e.preventDefault(); if (active) { if (!selected.has(active)) selectOnly(active); openPreview(active); } break;
      case 'a': case 'A':
        if (e.ctrlKey || e.metaKey) { e.preventDefault(); ids.forEach((id) => selected.add(id)); paintSelection(); }
        break;
      case 'Delete':
        e.preventDefault(); confirmEmpty(); break;
      default: break;
    }
  });

  // ── preview ────────────────────────────────────────────
  function openPreview(id) {
    const f = byId(id);
    if (!f) return;
    if (previewId == null) lastFocus = document.activeElement;
    previewId = id;
    pvIcon.innerHTML = icon(f.icon, 32);
    pvTitle.textContent = f.name;
    pvMeta.textContent = `${f.type} · from ${f.from}`;
    pvText.textContent = f.body.join('\n');
    pvText.scrollTop = 0;
    preview.hidden = false;
    root.classList.add('has-preview');
    os.sound.play('open');
    requestAnimationFrame(() => pvText.focus({ preventScroll: true }));
  }
  function closePreview() {
    if (previewId == null) return;
    previewId = null;
    preview.hidden = true;
    root.classList.remove('has-preview');
    const back = lastFocus && root.contains(lastFocus) && !lastFocus.closest('[hidden]') ? lastFocus : listbox;
    back.focus({ preventScroll: true });
  }
  preview.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePreview(); }
  });

  // ── restore ────────────────────────────────────────────
  function restoreSelected() {
    const ids = order().filter((id) => selected.has(id));
    if (ids.length) restore(ids);
  }

  function restore(ids) {
    if (burning) return;
    let i = 0;
    for (const id of ids) {
      const f = byId(id);
      if (!f || leaving.has(id)) continue;
      const el = rowEls.get(id);
      if (f.refuse) {
        os.sound.play('error');
        os.notify({ title: `Could not restore ${f.name}`, text: f.joke, icon: 'warning' });
        if (el && !reduced) {
          el.classList.remove('is-nope');
          void el.offsetWidth;
          el.classList.add('is-nope');
        }
        continue;
      }
      // already on its way out: a second Restore must not fly it (and notify) twice
      leaving.add(id);
      selected.delete(id);
      const delay = i++ * 140;
      later(() => {
        flyOut(el, f);
        if (f.delay) {
          os.notify({ title: 'Restoring procrastination.exe…', text: 'Estimated time remaining: soon™. Maybe.', icon: 'info', timeout: f.delay });
          later(() => os.notify({ title: `${f.name} restored`, text: f.joke, icon: 'info' }), f.delay);
        } else {
          os.notify({ title: `${f.name} restored`, text: f.joke, icon: 'info' });
        }
      }, delay);
    }
    paintSelection();
  }

  /** Throw the file's icon out of the window, collapse its row, drop it from the list. */
  function flyOut(el, f) {
    const done = () => {
      items = items.filter((x) => x.id !== f.id);
      leaving.delete(f.id);
      selected.delete(f.id);
      rowEls.delete(f.id);
      if (active === f.id) active = order().find((id) => id !== f.id && byId(id)) || null;
      if (previewId === f.id) closePreview();
      el?.remove();
      render();
      if (!items.length) {
        os.notify({ title: 'Recycle Bin', text: 'Everything is back where it came from. That is somehow worse.', icon: 'recycle' });
      }
    };
    if (reduced || !el || !el.isConnected || typeof el.animate !== 'function') { done(); return; }
    os.sound.play('whoosh');
    const iconEl = el.querySelector('.rb__icon');
    const r = iconEl.getBoundingClientRect();
    const ghost = h('div.app-recycle-fly', { 'aria-hidden': 'true', html: icon(f.icon, 40) },
      h('span', {}, f.name));
    ghost.style.left = `${r.left - 10}px`;
    ghost.style.top = `${r.top - 10}px`;
    os.fx?.append(ghost);
    fxNodes.add(ghost);
    // arc towards the top-left of the desktop, where restored things go
    const tx = -Math.max(120, r.left - 40) + (Math.random() * 60 - 30);
    const ty = -Math.max(60, r.top * 0.6) - 40;
    const fly = ghost.animate([
      { transform: 'translate(0,0) scale(.6) rotate(0deg)', opacity: 0 },
      { transform: 'translate(0,-14px) scale(1.15) rotate(-6deg)', opacity: 1, offset: 0.18 },
      { transform: `translate(${tx * 0.55}px, ${ty * 1.25}px) scale(1) rotate(-14deg)`, opacity: 1, offset: 0.6 },
      { transform: `translate(${tx}px, ${ty}px) scale(.5) rotate(-24deg)`, opacity: 0 },
    ], { duration: 900, easing: 'cubic-bezier(.3,.1,.3,1)', fill: 'forwards' });
    anims.add(fly);
    fly.onfinish = fly.oncancel = () => { anims.delete(fly); ghost.remove(); fxNodes.delete(ghost); };

    const hgt = el.offsetHeight;
    el.classList.add('is-leaving');
    const col = el.animate([
      { height: `${hgt}px`, opacity: 1, transform: 'translateX(0)' },
      { height: `${hgt}px`, opacity: 0, transform: 'translateX(-24px)', offset: 0.45 },
      { height: '0px', opacity: 0, transform: 'translateX(-24px)' },
    ], { duration: 420, easing: 'ease-in-out', fill: 'forwards' });
    anims.add(col);
    col.onfinish = () => { anims.delete(col); done(); };
    col.oncancel = () => { anims.delete(col); };
  }

  // ── empty: confirm, then burn ──────────────────────────
  function confirmEmpty() {
    if (!items.length || burning) return;
    const n = items.length;
    const titleId = `${uid}-mt`, descId = `${uid}-md`;
    const yes = h('button.btn.btn--primary', { type: 'button', onclick: () => { closeModal(); burn(); } }, 'Yes, delete them');
    const no = h('button.btn', { type: 'button', onclick: () => closeModal() }, 'No');
    const box = h('div.rb__dialog', { role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': titleId, 'aria-describedby': descId },
      h('div.rb__dialogbar', {}, h('span', { id: titleId }, 'Confirm Multiple File Delete'),
        h('button.rb__dialogx', { type: 'button', 'aria-label': 'Close', onclick: () => closeModal() }, '×')),
      h('div.rb__dialogbody', {},
        h('span.rb__dialogicon', { html: icon('warning', 40) }),
        h('p', { id: descId }, `Are you sure you want to permanently delete these ${n} item${n === 1 ? '' : 's'}? `,
          h('br'), h('small', {}, 'This includes node_modules. It will not be missed.'))),
      h('div.rb__dialogbtns', {}, yes, no));
    modal.textContent = '';
    modal.append(box);
    modal.hidden = false;
    lastFocus = document.activeElement;
    os.sound.play('error');
    requestAnimationFrame(() => yes.focus());
  }
  function closeModal() {
    if (modal.hidden) return;
    modal.hidden = true;
    modal.textContent = '';
    (lastFocus && root.contains(lastFocus) && !lastFocus.disabled ? lastFocus : listbox).focus({ preventScroll: true });
  }
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeModal(); return; }
    if (e.key !== 'Tab') return;
    const f = [...modal.querySelectorAll('button')];
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  modal.addEventListener('pointerdown', (e) => { if (e.target === modal) closeModal(); });

  function finishEmpty() {
    const freed = items.reduce((s, f) => s + f.size, 0);
    items = [];
    leaving.clear();
    selected.clear();
    rowEls.clear();
    active = null;
    closePreview();
    burning = null;
    root.classList.remove('is-burning');
    render();
    empty.classList.add('is-in');
    root.focus({ preventScroll: true });
    os.notify({ title: 'Recycle Bin emptied', text: `${fmtSize(freed)} freed. Most of it was node_modules.`, icon: 'recycle' });
  }

  function burn() {
    closePreview();
    if (reduced) { finishEmpty(); return; }
    const g = canvas.getContext('2d');
    if (!g) { finishEmpty(); return; }
    root.classList.add('is-burning');
    os.sound.play('whoosh');
    os.wallpaper?.pulse?.();

    const wrapRect = listWrap.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = wrapRect.width, H = wrapRect.height;
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    // rows that are on screen burn one after another; the rest just go
    const rows = [...listbox.children].map((el) => {
      const r = el.getBoundingClientRect();
      return { el, x: r.left - wrapRect.left, y: r.top - wrapRect.top, w: r.width, h: r.height };
    }).filter((r) => r.y + r.h > 0 && r.y < H);
    const STAGGER = 110, DUR = 620;
    rows.forEach((r, i) => { r.start = i * STAGGER; r.p = 0; });
    for (const el of listbox.children) if (!rows.some((r) => r.el === el)) el.style.visibility = 'hidden';
    head.classList.add('is-scorched');

    const parts = [];
    const MAXP = 900;
    // Prebuilt styles so the frame loop does not allocate a colour string per
    // particle or a gradient per row: ember colour is quantised by hue band and
    // remaining life, opacity goes through globalAlpha, and the burning front is
    // one gradient drawn at the origin and moved with translate().
    const HUE_BANDS = 8, LIFE_STEPS = 24;
    const EMBER = [];
    for (let b = 0; b < HUE_BANDS; b++) {
      const hue = 18 + (b + 0.5) * (32 / HUE_BANDS);
      for (let s = 0; s <= LIFE_STEPS; s++) {
        const k = s / LIFE_STEPS;
        EMBER.push(`hsl(${(hue + 20 * k).toFixed(1)},100%,${(45 + 22 * k).toFixed(1)}%)`);
      }
    }
    const ASH = 'rgb(70,64,58)';
    const FRONT = g.createLinearGradient(-26, 0, 6, 0);
    FRONT.addColorStop(0, 'rgba(255,120,20,0)');
    FRONT.addColorStop(0.7, 'rgba(255,150,40,.55)');
    FRONT.addColorStop(1, 'rgba(255,240,180,.95)');
    let raf = 0, t0 = performance.now(), last = t0, ended = false;
    let sparks = 0;

    function spawn(x, y, hot) {
      if (parts.length >= MAXP) return;
      const ash = !hot && Math.random() < 0.35;
      parts.push({
        x, y,
        vx: (Math.random() - 0.5) * (ash ? 0.05 : 0.09),
        vy: ash ? 0.01 + Math.random() * 0.04 : -(0.04 + Math.random() * 0.12),
        life: 0, max: ash ? 900 + Math.random() * 700 : 500 + Math.random() * 700,
        s: ash ? 1 + Math.random() * 2.2 : 0.8 + Math.random() * 2.2,
        ash,
        band: (Math.random() * HUE_BANDS) | 0,
      });
    }

    function frame(now) {
      const dt = Math.min(48, now - last); last = now;
      const t = now - t0;
      g.clearRect(0, 0, W, H);
      let allDone = true;
      for (const r of rows) {
        const p = Math.max(0, Math.min(1, (t - r.start) / DUR));
        if (p < 1) allDone = false;
        if (p <= 0) continue;
        const eased = 1 - Math.pow(1 - p, 1.6);
        const fx = r.x + r.w * eased;
        if (r.p < 1) {
          r.el.style.clipPath = `inset(0 0 0 ${(eased * 100).toFixed(2)}%)`;
          r.el.style.filter = `sepia(${Math.min(1, p * 2.2)}) saturate(${1 + p * 2}) brightness(${1 - p * 0.35})`;
          // the burning front
          g.save();
          g.translate(fx, 0);
          g.fillStyle = FRONT;
          g.fillRect(-26, r.y + 1, 32, r.h - 2);
          g.restore();
          const n = Math.round(dt / 5);
          for (let k = 0; k < n; k++) spawn(fx + (Math.random() - 0.6) * 10, r.y + Math.random() * r.h, Math.random() < 0.7);
          if (++sparks % 9 === 0) os.sound.play('tick');
        }
        r.p = p;
      }
      // particles: embers rise and flicker (additive), ash drifts down
      g.globalCompositeOperation = 'lighter';
      for (let i = parts.length - 1; i >= 0; i--) {
        const q = parts[i];
        q.life += dt;
        if (q.life >= q.max) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
        q.vx += (Math.random() - 0.5) * 0.006 * dt;
        q.vy += (q.ash ? 0.00004 : -0.00008) * dt;
        q.x += q.vx * dt; q.y += q.vy * dt;
        const k = 1 - q.life / q.max;
        if (q.ash) continue;
        g.fillStyle = EMBER[q.band * (LIFE_STEPS + 1) + Math.round(k * LIFE_STEPS)];
        g.globalAlpha = k * (0.6 + Math.random() * 0.4);
        g.beginPath(); g.arc(q.x, q.y, q.s * (0.5 + k * 0.7), 0, Math.PI * 2); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = ASH;
      for (const q of parts) {
        if (!q.ash) continue;
        g.globalAlpha = (1 - q.life / q.max) * 0.7;
        g.fillRect(q.x, q.y, q.s, q.s);
      }
      g.globalAlpha = 1;
      if (allDone && !ended) {
        ended = true;
        for (const r of rows) r.el.style.visibility = 'hidden';
        finishEmpty();
        empty.classList.add('is-in');
      }
      if (ended && !parts.length) { stop(); return; }
      raf = requestAnimationFrame(frame);
    }
    function stop() {
      cancelAnimationFrame(raf);
      raf = 0;
      g.clearRect(0, 0, W, H);
      head.classList.remove('is-scorched');
    }
    fireStop = stop;
    burning = {
      finish() { // Escape: skip to the end
        stop();
        if (!ended) { ended = true; finishEmpty(); }
      },
      stop,
    };
    updateChrome();
    raf = requestAnimationFrame(frame);
    root.focus({ preventScroll: true });
  }

  // global keys inside the window
  root.tabIndex = -1;
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (burning) { e.preventDefault(); burning.finish(); }
      else if (previewId != null) { e.preventDefault(); closePreview(); }
    }
  });

  win.setMenu([
    { label: 'File', items: [
      { label: 'Restore', action: () => restoreSelected() },
      { label: 'Preview', action: () => { if (active) openPreview(active); } },
      '-',
      { label: 'Empty Recycle Bin', action: () => confirmEmpty() },
      '-',
      { label: 'Close', action: () => win.close() },
    ] },
    { label: 'Edit', items: [
      { label: 'Select all', action: () => { order().forEach((id) => selected.add(id)); paintSelection(); listbox.focus(); } },
      { label: 'Invert selection', action: () => { for (const id of order()) { if (selected.has(id)) selected.delete(id); else selected.add(id); } paintSelection(); listbox.focus(); } },
    ] },
    { label: 'View', items: COLS.map((c) => ({ label: `Sort by ${c.label.toLowerCase()}`, action: () => { sort = { key: c.key, dir: c.key === 'name' || c.key === 'from' ? 1 : -1 }; render(); } })) },
  ]);

  render();
  if (!os.isMobile()) requestAnimationFrame(() => listbox.focus({ preventScroll: true }));

  return {
    reopen() { if (!burning) (items.length ? listbox : root).focus({ preventScroll: true }); },
    destroy() {
      try { burning?.stop(); fireStop?.(); } catch { /* ignore */ }
      burning = null;
      for (const id of timers) clearTimeout(id);
      timers.clear();
      for (const a of anims) { try { a.cancel(); } catch { /* ignore */ } }
      anims.clear();
      for (const n of fxNodes) n.remove();
      fxNodes.clear();
      root.remove();
    },
  };
}
