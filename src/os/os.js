// The OS object handed to every app as ctx.os. Opens apps into windows,
// shows tray notifications and owns shared services (sound, event bus,
// the full-screen fx layer and the wallpaper).
import { apps, appById } from '../apps/index.js';
import { profile } from '../data/profile.js';
import { repos } from '../data/repos.js';
import { createWM } from './wm.js';
import { createSound } from './sound.js';
import { h, esc, prefersReducedMotion, isMobile } from './ui.js';
import { icon } from './icons.js';

export function createOS({ windowLayer, fxLayer, notifyLayer }) {
  const bus = new EventTarget();
  const reducedMotion = prefersReducedMotion();
  const wm = createWM({ layer: windowLayer, bus, reducedMotion });
  const sound = createSound();
  /** id -> { win, instance } for singleton apps */
  const running = new Map();

  const os = {
    bus, wm, sound, apps, profile, repos, reducedMotion,
    isMobile,
    /** Full-screen layer above the windows for transitions (pointer-events: none). */
    fx: fxLayer,
    /** Set by main.js once the wallpaper exists: { setLevel(0..1), pulse() }. */
    wallpaper: null,

    /**
     * Open (or focus) an app. Returns the window api.
     * @param {string} id app id from src/apps/index.js
     * @param {any} [args]
     */
    async open(id, args) {
      const meta = appById[id];
      if (!meta) {
        os.notify({ title: 'Not found', text: `There is no app called “${id}”.`, icon: 'warning' });
        sound.play('error');
        return null;
      }
      const single = meta.singleton !== false;
      if (single && running.has(id)) {
        const r = running.get(id);
        r.win.focus();
        // still loading: keep the latest args and hand them over after mount
        if (r.instance) r.instance.reopen?.(args);
        else if (args !== undefined) r.pending = args;
        setHash(id);
        return r.win;
      }
      const win = wm.create({
        appId: id, title: meta.title, icon: meta.icon,
        width: meta.width, height: meta.height,
        minWidth: meta.minWidth, minHeight: meta.minHeight,
        status: true,
      });
      win.body.innerHTML = '<div class="win__loading">Loading…</div>';
      sound.play('open');
      const entry = { win, instance: null, closed: false, pending: undefined };
      if (single) running.set(id, entry);
      win.onClose(() => {
        entry.closed = true;
        sound.play('close');
        try { entry.instance?.destroy?.(); } catch (err) { console.error(err); }
        if (running.get(id) === entry) running.delete(id);
        if (location.hash === `#/${id}`) history.replaceState(null, '', location.pathname + location.search);
      });
      setHash(id);
      try {
        const mod = await meta.load();
        // the window was closed while the chunk loaded: do not start the app
        if (entry.closed) return win;
        win.body.innerHTML = '';
        const instance = (await mod.mount(win.body, { win, os, args })) || null;
        if (entry.closed) {
          // closed while mount() was still running: tear it down now
          try { instance?.destroy?.(); } catch (err) { console.error(err); }
          return win;
        }
        entry.instance = instance;
        if (instance?.resize) win.onResize((r) => instance.resize(r));
        if (entry.pending !== undefined) {
          const pending = entry.pending;
          entry.pending = undefined;
          instance?.reopen?.(pending);
        }
      } catch (err) {
        console.error(err);
        if (entry.closed) return win;
        win.body.innerHTML = `<div class="win__error">${icon('warning', 32)}<p>${esc(meta.title)} could not start.</p><pre>${esc(err?.message || err)}</pre></div>`;
        sound.play('error');
      }
      return win;
    },

    /** Is a singleton app currently open? */
    isOpen: (id) => running.has(id),

    /**
     * Tray balloon notification.
     * @param {{title:string,text?:string,icon?:string,timeout?:number,onClick?:Function}} n
     */
    notify({ title, text = '', icon: ic = 'info', timeout = 6000, onClick } = {}) {
      const close = () => {
        node.classList.add('is-leaving');
        setTimeout(() => node.remove(), 250);
      };
      // a clickable balloon puts its text in a real button so keyboards reach it
      const body = onClick
        ? h('button.balloon__text.balloon__act', { type: 'button' }, h('strong', {}, title), text ? h('span.balloon__p', {}, text) : null)
        : h('div.balloon__text', {}, h('strong', {}, title), text ? h('p', {}, text) : null);
      const node = h('div.balloon', { role: 'status' },
        h('span.balloon__icon', { html: icon(ic, 20) }),
        body,
        h('button.balloon__x', { type: 'button', 'aria-label': 'Dismiss', onclick: (e) => { e.stopPropagation(); close(); } }, '×'));
      if (onClick) {
        node.classList.add('is-clickable');
        node.addEventListener('click', () => { close(); onClick(); });
      }
      notifyLayer.append(node);
      sound.play('notify');
      if (timeout) setTimeout(close, timeout);
      return close;
    },
  };

  function setHash(id) {
    // only desktop apps get a deep link; helper windows (Viewer) do not
    if (!appById[id]?.desktop) return;
    if (location.hash !== `#/${id}`) history.replaceState(null, '', `#/${id}`);
  }

  return os;
}
