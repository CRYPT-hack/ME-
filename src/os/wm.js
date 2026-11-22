// Window manager: creates, stacks, drags, resizes, minimises and maximises
// windows. Knows nothing about apps beyond a title/icon/size; os.js wires an
// app's mount() into the window body.
import { h, esc, clamp, isMobile } from './ui.js';
import { icon } from './icons.js';

const TASKBAR_H = 40;
let nextId = 1;

export function createWM({ layer, bus, reducedMotion }) {
  /** @type {Map<number, any>} */
  const wins = new Map();
  let z = 10;
  let active = null;
  let cascade = 0;

  function area() {
    return { w: window.innerWidth, h: window.innerHeight - TASKBAR_H };
  }

  function emit() {
    bus.dispatchEvent(new CustomEvent('windows', { detail: list() }));
  }

  function list() {
    return [...wins.values()].map((w) => ({
      id: w.id, appId: w.appId, title: w.title, icon: w.iconName,
      minimized: w.minimized, active: w === active,
    }));
  }

  function focus(w) {
    if (!w) return;
    if (w.minimized) restore(w);
    if (active && active !== w) active.el.classList.remove('is-active');
    active = w;
    w.el.style.zIndex = ++z;
    w.el.classList.add('is-active');
    w.hooks.focus.forEach((fn) => fn());
    emit();
  }

  function topVisible() {
    let best = null;
    for (const w of wins.values()) {
      if (w.minimized) continue;
      if (!best || +w.el.style.zIndex > +best.el.style.zIndex) best = w;
    }
    return best;
  }

  function applyRect(w) {
    const s = w.el.style;
    if (w.maximized) {
      s.left = '0px'; s.top = '0px';
      s.width = '100%'; s.height = `calc(100% - ${TASKBAR_H}px)`;
    } else {
      s.left = `${w.x}px`; s.top = `${w.y}px`;
      s.width = `${w.w}px`; s.height = `${w.h}px`;
    }
  }

  function notifyResize(w) {
    const r = w.el.getBoundingClientRect();
    w.hooks.resize.forEach((fn) => fn(r));
  }

  function setMaximized(w, on) {
    w.maximized = on;
    w.el.classList.toggle('is-max', on);
    w.btnMax.setAttribute('aria-label', on ? 'Restore' : 'Maximise');
    w.btnMax.innerHTML = on ? glyph('restore') : glyph('max');
    applyRect(w);
    requestAnimationFrame(() => notifyResize(w));
  }

  function minimize(w) {
    if (w.minimized) return;
    w.minimized = true;
    w.el.classList.add('is-min');
    w.el.setAttribute('aria-hidden', 'true');
    if (active === w) {
      active = null;
      w.el.classList.remove('is-active');
      focus(topVisible());
    }
    emit();
  }

  function restore(w) {
    if (!w.minimized) return;
    w.minimized = false;
    w.el.classList.remove('is-min');
    w.el.removeAttribute('aria-hidden');
    emit();
  }

  function close(w) {
    if (!wins.has(w.id)) return;
    w.hooks.close.forEach((fn) => {
      try { fn(); } catch (err) { console.error(err); }
    });
    wins.delete(w.id);
    w.el.classList.add('is-closing');
    const done = () => w.el.remove();
    if (reducedMotion) done();
    else setTimeout(done, 160);
    if (active === w) {
      active = null;
      focus(topVisible());
    }
    emit();
  }

  /**
   * @param {{appId:string,title:string,icon:string,width?:number,height?:number,
   *          minWidth?:number,minHeight?:number,status?:boolean}} opts
   */
  function create(opts) {
    const id = nextId++;
    const { w: aw, h: ah } = area();
    const width = Math.min(opts.width || 720, aw - 16);
    const height = Math.min(opts.height || 520, ah - 16);
    const off = (cascade++ % 8) * 26;
    // keep clear of the desktop icon column when there is room
    const minX = aw - width > 120 ? 104 : 8;
    const x = clamp(Math.round((aw - width) / 2) - 40 + off, minX, Math.max(minX, aw - width - 8));
    const y = clamp(Math.round((ah - height) / 2) - 50 + off, 8, Math.max(8, ah - height - 8));

    const btnMin = h('button.win__btn.win__btn--min', { type: 'button', 'aria-label': 'Minimise', html: glyph('min') });
    const btnMax = h('button.win__btn.win__btn--max', { type: 'button', 'aria-label': 'Maximise', html: glyph('max') });
    const btnClose = h('button.win__btn.win__btn--close', { type: 'button', 'aria-label': 'Close', html: glyph('close') });
    const titleEl = h('h2.win__title', {}, opts.title);
    const iconEl = h('span.win__icon', { html: icon(opts.icon, 16) });
    const bar = h('header.win__bar', {}, iconEl, titleEl, h('div.win__btns', {}, btnMin, btnMax, btnClose));
    const menu = h('nav.win__menu', { hidden: true });
    const body = h('div.win__body', { tabindex: '-1' });
    const status = h('footer.win__status', { hidden: !opts.status });
    const el = h('section.win', {
      role: 'dialog',
      'aria-label': opts.title,
      dataset: { app: opts.appId, win: String(id) },
    }, bar, menu, body, status);
    for (const dir of ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw']) el.append(h(`div.win__rz.win__rz--${dir}`, { dataset: { dir } }));

    const w = {
      id, appId: opts.appId, el, body, bar, menu, titleEl, status, btnMax,
      title: opts.title, iconName: opts.icon,
      x, y, w: width, h: height,
      minW: opts.minWidth || 300, minH: opts.minHeight || 200,
      maximized: false, minimized: false,
      hooks: { close: [], resize: [], focus: [] },
    };
    wins.set(id, w);
    layer.append(el);
    applyRect(w);
    if (isMobile() || opts.maximized) setMaximized(w, true);
    if (!reducedMotion) {
      el.classList.add('is-opening');
      setTimeout(() => el.classList.remove('is-opening'), 220);
    }

    // stacking
    el.addEventListener('pointerdown', () => { if (active !== w) focus(w); }, true);
    btnMin.addEventListener('click', (e) => { e.stopPropagation(); minimize(w); });
    btnMax.addEventListener('click', (e) => { e.stopPropagation(); setMaximized(w, !w.maximized); });
    btnClose.addEventListener('click', (e) => { e.stopPropagation(); close(w); });
    bar.addEventListener('dblclick', (e) => {
      if (e.target.closest('.win__btn')) return;
      setMaximized(w, !w.maximized);
    });

    // dragging by the title bar
    bar.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('.win__btn') || isMobile()) return;
      const startX = e.clientX, startY = e.clientY;
      let ox = w.x, oy = w.y;
      let moved = false;
      bar.setPointerCapture(e.pointerId);
      const move = (ev) => {
        const dx = ev.clientX - startX, dy = ev.clientY - startY;
        if (!moved && Math.hypot(dx, dy) < 3) return;
        if (!moved && w.maximized) {
          // pull a maximised window out from under the cursor
          const ratio = (startX) / window.innerWidth;
          setMaximized(w, false);
          ox = clamp(startX - w.w * ratio, 0, window.innerWidth - w.w);
          oy = 0;
        }
        moved = true;
        el.classList.add('is-dragging');
        const { w: aw2, h: ah2 } = area();
        w.x = clamp(ox + dx, -w.w + 80, aw2 - 80);
        w.y = clamp(oy + dy, 0, ah2 - 28);
        applyRect(w);
      };
      const up = () => {
        el.classList.remove('is-dragging');
        bar.removeEventListener('pointermove', move);
        bar.removeEventListener('pointerup', up);
        bar.removeEventListener('pointercancel', up);
        if (moved && w.y <= 0) setMaximized(w, true); // drag to top edge = maximise
      };
      bar.addEventListener('pointermove', move);
      bar.addEventListener('pointerup', up);
      bar.addEventListener('pointercancel', up);
    });

    // resizing from any edge
    el.addEventListener('pointerdown', (e) => {
      const handle = e.target.closest('.win__rz');
      if (!handle || w.maximized || isMobile()) return;
      e.preventDefault();
      const dir = handle.dataset.dir;
      const sx = e.clientX, sy = e.clientY;
      const o = { x: w.x, y: w.y, w: w.w, h: w.h };
      handle.setPointerCapture(e.pointerId);
      el.classList.add('is-resizing');
      const move = (ev) => {
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (dir.includes('e')) w.w = Math.max(w.minW, o.w + dx);
        if (dir.includes('s')) w.h = Math.max(w.minH, o.h + dy);
        if (dir.includes('w')) { w.w = Math.max(w.minW, o.w - dx); w.x = o.x + o.w - w.w; }
        if (dir.includes('n')) { w.h = Math.max(w.minH, o.h - dy); w.y = Math.max(0, o.y + o.h - w.h); }
        applyRect(w);
        notifyResize(w);
      };
      const up = () => {
        el.classList.remove('is-resizing');
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        handle.removeEventListener('pointercancel', up);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
      handle.addEventListener('pointercancel', up);
    });

    const api = {
      id, el, body,
      get appId() { return w.appId; },
      setTitle(t) { w.title = t; titleEl.textContent = t; el.setAttribute('aria-label', t); emit(); },
      setIcon(name) { w.iconName = name; iconEl.innerHTML = icon(name, 16); emit(); },
      setStatus(t) {
        if (t == null) { status.hidden = true; return; }
        status.hidden = false;
        if (Array.isArray(t)) status.innerHTML = t.map((s) => `<span>${esc(s)}</span>`).join('');
        else status.innerHTML = `<span>${esc(t)}</span>`;
      },
      setMenu(menus) { renderMenu(menu, menus); },
      flush() { body.classList.add('win__body--flush'); },
      close: () => close(w),
      focus: () => focus(w),
      minimize: () => minimize(w),
      maximize: (on = true) => setMaximized(w, on),
      isMaximized: () => w.maximized,
      isMinimized: () => w.minimized,
      rect: () => body.getBoundingClientRect(),
      onClose(fn) { w.hooks.close.push(fn); },
      onResize(fn) { w.hooks.resize.push(fn); },
      onFocus(fn) { w.hooks.focus.push(fn); },
    };
    w.api = api;
    focus(w);
    return api;
  }

  // keep windows reachable after the viewport shrinks
  window.addEventListener('resize', () => {
    const { w: aw, h: ah } = area();
    for (const w of wins.values()) {
      if (isMobile() && !w.maximized) setMaximized(w, true);
      if (!w.maximized) {
        w.w = Math.min(w.w, aw - 8);
        w.h = Math.min(w.h, ah - 8);
        w.x = clamp(w.x, 0, Math.max(0, aw - w.w));
        w.y = clamp(w.y, 0, Math.max(0, ah - w.h));
        applyRect(w);
      }
      notifyResize(w);
    }
  });

  return {
    create,
    list,
    get active() { return active?.api ?? null; },
    byId: (id) => wins.get(id)?.api ?? null,
    findApp: (appId) => [...wins.values()].filter((w) => w.appId === appId).map((w) => w.api),
    focusId: (id) => focus(wins.get(id)),
    toggleId(id) {
      const w = wins.get(id);
      if (!w) return;
      if (w.minimized) focus(w);
      else if (active === w) minimize(w);
      else focus(w);
    },
    closeActive() { if (active) close(active); },
    minimizeAll() { for (const w of wins.values()) minimize(w); },
  };
}

function renderMenu(nav, menus) {
  nav.innerHTML = '';
  if (!menus || !menus.length) { nav.hidden = true; return; }
  nav.hidden = false;
  let openMenu = null;
  const closeAll = () => {
    openMenu?.classList.remove('is-open');
    openMenu = null;
    document.removeEventListener('pointerdown', outside, true);
  };
  const outside = (e) => { if (!nav.contains(e.target)) closeAll(); };
  for (const m of menus) {
    const drop = h('div.win__drop', { role: 'menu' });
    for (const it of m.items || []) {
      if (it === '-') { drop.append(h('hr')); continue; }
      drop.append(h('button.win__drop-item', {
        type: 'button', role: 'menuitem', disabled: !!it.disabled,
        onclick: () => { closeAll(); it.action?.(); },
      }, it.label));
    }
    const top = h('div.win__menu-top', {},
      h('button.win__menu-btn', {
        type: 'button', 'aria-haspopup': 'true',
        onclick: (e) => {
          const wrap = e.currentTarget.parentElement;
          if (openMenu === wrap) { closeAll(); return; }
          closeAll();
          openMenu = wrap;
          wrap.classList.add('is-open');
          document.addEventListener('pointerdown', outside, true);
        },
      }, m.label),
      drop);
    nav.append(top);
  }
}

function glyph(kind) {
  switch (kind) {
    case 'min': return '<svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="8" width="6" height="2" fill="currentColor"/></svg>';
    case 'max': return '<svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="2" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="2" y="2" width="8" height="2" fill="currentColor"/></svg>';
    case 'restore': return '<svg viewBox="0 0 12 12" aria-hidden="true"><rect x="4" y="1.5" width="6.5" height="6" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="1.5" y="4.5" width="6.5" height="6" fill="#3a6fd8" stroke="currentColor" stroke-width="1.3"/></svg>';
    default: return '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="m2.5 2.5 7 7m0-7-7 7" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>';
  }
}
