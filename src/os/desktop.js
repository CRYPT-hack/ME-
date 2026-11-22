// Desktop icons: click to select, double-click / Enter to open (single tap on
// touch), arrow keys to move the selection, rubber-band selection with the
// mouse, and a right-click menu.
import { h } from './ui.js';
import { icon } from './icons.js';

export function createDesktop({ root, os }) {
  const grid = h('ul.desk__icons', { role: 'listbox', 'aria-label': 'Desktop', 'aria-multiselectable': 'true' });
  const band = h('div.desk__band', { hidden: true });
  root.append(grid, band);

  const items = os.apps.filter((a) => a.desktop).map((a) => {
    const li = h('li.desk__icon', {
      role: 'option', tabindex: '-1', 'aria-selected': 'false',
      dataset: { app: a.id }, title: a.blurb || a.title,
    }, h('span.desk__glyph', { html: icon(a.icon, 40) }), h('span.desk__label', {}, a.title));
    grid.append(li);
    return li;
  });
  if (items[0]) items[0].tabIndex = 0;

  const coarse = window.matchMedia('(pointer: coarse)').matches;

  function select(li, { add = false } = {}) {
    if (!add) items.forEach((i) => { i.classList.remove('is-sel'); i.setAttribute('aria-selected', 'false'); });
    if (!li) return;
    li.classList.add('is-sel');
    li.setAttribute('aria-selected', 'true');
    items.forEach((i) => { i.tabIndex = i === li ? 0 : -1; });
  }

  function open(li) {
    os.sound.unlock();
    li.classList.add('is-launch');
    setTimeout(() => li.classList.remove('is-launch'), 400);
    os.open(li.dataset.app);
  }

  grid.addEventListener('click', (e) => {
    const li = e.target.closest('.desk__icon');
    if (!li) return;
    select(li, { add: e.ctrlKey || e.metaKey });
    if (coarse) open(li);
  });
  grid.addEventListener('dblclick', (e) => {
    const li = e.target.closest('.desk__icon');
    if (li && !coarse) open(li);
  });
  grid.addEventListener('keydown', (e) => {
    const li = e.target.closest('.desk__icon');
    if (!li) return;
    const i = items.indexOf(li);
    let next = null;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(li); return; }
    if (e.key === 'ArrowDown') next = items[i + 1];
    if (e.key === 'ArrowUp') next = items[i - 1];
    if (e.key === 'ArrowRight') next = items[Math.min(items.length - 1, i + perColumn())];
    if (e.key === 'ArrowLeft') next = items[Math.max(0, i - perColumn())];
    if (e.key === 'Home') next = items[0];
    if (e.key === 'End') next = items[items.length - 1];
    if (next) { e.preventDefault(); select(next); next.focus(); }
  });
  grid.addEventListener('focusin', (e) => {
    const li = e.target.closest('.desk__icon');
    if (li && !li.classList.contains('is-sel')) select(li);
  });

  function perColumn() {
    if (items.length < 2) return 1;
    const x0 = items[0].offsetLeft;
    const n = items.findIndex((i) => i.offsetLeft !== x0);
    return n > 0 ? n : items.length;
  }

  // rubber band on empty desktop
  root.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('.desk__icon, .win, .ctx') || e.pointerType === 'touch') return;
    if (e.target !== root && e.target !== grid && !e.target.classList.contains('desk__wall')) return;
    select(null);
    const sx = e.clientX, sy = e.clientY;
    root.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const x = Math.min(sx, ev.clientX), y = Math.min(sy, ev.clientY);
      const w = Math.abs(ev.clientX - sx), hh = Math.abs(ev.clientY - sy);
      if (w + hh < 4) return;
      band.hidden = false;
      Object.assign(band.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${hh}px` });
      for (const li of items) {
        const r = li.getBoundingClientRect();
        const hit = r.right > x && r.left < x + w && r.bottom > y && r.top < y + hh;
        li.classList.toggle('is-sel', hit);
        li.setAttribute('aria-selected', String(hit));
      }
    };
    const up = () => {
      band.hidden = true;
      root.removeEventListener('pointermove', move);
      root.removeEventListener('pointerup', up);
    };
    root.addEventListener('pointermove', move);
    root.addEventListener('pointerup', up);
  });

  // context menu
  let menu = null;
  const closeMenu = () => { menu?.remove(); menu = null; };
  root.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.win')) return;
    e.preventDefault();
    closeMenu();
    const li = e.target.closest('.desk__icon');
    const entries = li
      ? [
        ['Open', () => open(li)],
        ['-'],
        ['Properties', () => os.notify({ title: li.textContent, text: os.apps.find((a) => a.id === li.dataset.app)?.blurb || '', icon: 'info' })],
      ]
      : [
        ['Refresh', () => { items.forEach((i, n) => { i.style.animation = 'none'; void i.offsetWidth; i.style.animation = ''; i.style.animationDelay = `${n * 30}ms`; i.classList.add('is-refresh'); }); setTimeout(() => items.forEach((i) => i.classList.remove('is-refresh')), 900); }],
        ['Open File Explorer', () => os.open('explorer')],
        ['Open Terminal here', () => os.open('terminal')],
        ['-'],
        ['View this site’s source', () => window.open('https://github.com/CRYPT-hack/ME-', '_blank', 'noopener')],
        ['About CRYPT OS', () => os.open('about')],
      ];
    menu = h('div.ctx', { role: 'menu' });
    for (const [label, fn] of entries) {
      if (label === '-') { menu.append(h('hr')); continue; }
      menu.append(h('button.ctx__item', { type: 'button', role: 'menuitem', onclick: () => { closeMenu(); fn(); } }, label));
    }
    document.body.append(menu);
    const r = menu.getBoundingClientRect();
    menu.style.left = `${Math.min(e.clientX, innerWidth - r.width - 4)}px`;
    menu.style.top = `${Math.min(e.clientY, innerHeight - r.height - 44)}px`;
    menu.querySelector('button')?.focus();
  });
  document.addEventListener('pointerdown', (e) => { if (menu && !menu.contains(e.target)) closeMenu(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

  return {
    show() {
      items.forEach((li, n) => { li.style.animationDelay = `${120 + n * 55}ms`; });
      root.classList.add('is-ready');
    },
    focusFirst() { (items.find((i) => i.tabIndex === 0) || items[0])?.focus(); },
  };
}
