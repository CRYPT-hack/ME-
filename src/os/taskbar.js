// Taskbar: start button + start menu, one button per window, and the tray
// (sound toggle, a GitHub shortcut and a clock in the owner's timezone).
import { h, esc, clockText } from './ui.js';
import { icon } from './icons.js';
import { socialLinks } from '../data/profile.js';

export function createTaskbar({ root, os, onShutdown, onLogoff }) {
  const { profile } = os;
  const startBtn = h('button.tb__start', { type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': 'false' },
    h('span.tb__start-logo', { html: logo() }), h('span', {}, 'start'));
  const tasks = h('ul.tb__tasks', { 'aria-label': 'Open windows' });
  const soundBtn = h('button.tb__tray-btn', { type: 'button' });
  const ghBtn = h('a.tb__tray-btn', { href: profile.links.github, target: '_blank', rel: 'noopener', title: 'GitHub', html: icon('github', 16) });
  const clock = h('time.tb__clock');
  const tray = h('div.tb__tray', {}, soundBtn, ghBtn, clock);
  root.append(startBtn, tasks, tray);

  // ── tray ────────────────────────────────────────────────
  function paintSound() {
    const on = os.sound.enabled;
    soundBtn.innerHTML = on
      ? '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M2 6h3l4-3v10L5 10H2z" fill="#fff"/><path d="M11 5.5c1 .8 1 4.2 0 5M12.8 4c1.8 1.6 1.8 6.4 0 8" stroke="#fff" fill="none" stroke-width="1.2"/></svg>'
      : '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M2 6h3l4-3v10L5 10H2z" fill="#fff"/><path d="m11 6 4 4m0-4-4 4" stroke="#ff6b5b" stroke-width="1.6"/></svg>';
    soundBtn.setAttribute('aria-label', on ? 'Sound on. Click to mute' : 'Sound off. Click to unmute');
    soundBtn.title = on ? 'Sound: on' : 'Sound: off';
  }
  soundBtn.addEventListener('click', () => { os.sound.unlock(); os.sound.enabled = !os.sound.enabled; os.sound.play('click'); });
  os.sound.onChange(paintSound);
  paintSound();

  function tick() {
    const now = new Date();
    clock.textContent = clockText(profile.timezone, now);
    clock.title = `${profile.firstName}’s time · ${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: profile.timezone })}`;
  }
  tick();
  setInterval(tick, 15000);

  // ── window buttons ──────────────────────────────────────
  os.bus.addEventListener('windows', (e) => {
    tasks.innerHTML = '';
    for (const w of e.detail) {
      tasks.append(h('li', {}, h('button.tb__task', {
        type: 'button',
        class: `tb__task${w.active ? ' is-active' : ''}${w.minimized ? ' is-min' : ''}`,
        'aria-pressed': String(w.active),
        title: w.title,
        onclick: () => os.wm.toggleId(w.id),
      }, h('span.tb__task-icon', { html: icon(w.icon, 16) }), h('span.tb__task-label', {}, w.title))));
    }
  });

  // ── start menu ──────────────────────────────────────────
  const menu = buildStartMenu();
  document.body.append(menu);
  let open = false;
  function setOpen(v) {
    open = v;
    menu.hidden = !v;
    startBtn.classList.toggle('is-open', v);
    startBtn.setAttribute('aria-expanded', String(v));
    if (v) {
      os.sound.unlock();
      menu.querySelector('.sm__item')?.focus();
    }
  }
  startBtn.addEventListener('click', () => setOpen(!open));
  document.addEventListener('pointerdown', (e) => {
    if (open && !menu.contains(e.target) && !startBtn.contains(e.target)) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) { setOpen(false); startBtn.focus(); }
    // the Windows / Meta key, or Ctrl+Esc, toggles the menu
    if ((e.key === 'Meta' && !e.repeat) || (e.ctrlKey && e.key === 'Escape')) { e.preventDefault(); setOpen(!open); }
  });

  function buildStartMenu() {
    const run = (fn) => () => { setOpen(false); fn(); };
    const main = os.apps.filter((a) => a.start === 'main');
    const left = h('ul.sm__col.sm__col--left', {},
      main.map((a) => h('li', {}, h('button.sm__item', { type: 'button', onclick: run(() => os.open(a.id)) },
        h('span.sm__icon', { html: icon(a.icon, 28) }),
        h('span.sm__text', {}, h('strong', {}, a.title), h('small', {}, a.blurb || ''))))));
    const links = socialLinks();
    const right = h('ul.sm__col.sm__col--right', {},
      h('li', {}, h('button.sm__item.sm__item--small', { type: 'button', onclick: run(() => os.open('explorer')) }, h('span.sm__icon', { html: icon('folder-open', 22) }), h('span', {}, 'My Projects'))),
      h('li', {}, h('button.sm__item.sm__item--small', { type: 'button', onclick: run(() => os.open('resume')) }, h('span.sm__icon', { html: icon('pdf', 22) }), h('span', {}, 'My Resume'))),
      h('li', {}, h('button.sm__item.sm__item--small', { type: 'button', onclick: run(() => os.open('recycle')) }, h('span.sm__icon', { html: icon('recycle-full', 22) }), h('span', {}, 'Recycle Bin'))),
      h('li.sm__sep'),
      links.map((l) => h('li', {}, h('a.sm__item.sm__item--small', { href: l.href, target: '_blank', rel: 'noopener' },
        h('span.sm__icon', { html: icon(l.id === 'github' ? 'github' : l.id === 'steam' ? 'gamepad' : l.id === 'spotify' ? 'music' : l.id === 'email' ? 'mail' : 'globe', 22) }),
        h('span', {}, l.label)))),
      h('li.sm__sep'),
      h('li', {}, h('button.sm__item.sm__item--small', { type: 'button', onclick: run(() => os.open('terminal')) }, h('span.sm__icon', { html: icon('terminal', 22) }), h('span', {}, 'Run…'))),
    );
    const head = h('header.sm__head', {},
      h('img.sm__avatar', { src: profile.photo, alt: '' }),
      h('div', {}, h('strong', {}, profile.name), h('small', {}, `@${profile.handle}`)));
    const foot = h('footer.sm__foot', {},
      h('button.sm__foot-btn', { type: 'button', onclick: run(onLogoff) }, h('span', { html: icon('user', 20) }), 'Log Off'),
      h('button.sm__foot-btn', { type: 'button', onclick: run(onShutdown) }, h('span', { html: icon('power', 20) }), 'Shut Down'));
    return h('div.sm', { role: 'menu', hidden: true, 'aria-label': 'Start menu' }, head, h('div.sm__cols', {}, left, right), foot);
  }

  return { closeMenu: () => setOpen(false) };
}

function logo() {
  // CRYPT OS mark: a crescent "C" around a glowing core
  return `<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
    <path d="M14.8 4.6A7.4 7.4 0 1 0 14.8 15.4" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
    <circle cx="11" cy="10" r="2.6" fill="#ffe14d"/></svg>`;
}
void esc;
