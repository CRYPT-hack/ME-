// CRYPT OS entry: boot screen → desktop. Everything visual lives in src/os
// (the shell) and src/apps (one folder per app).
import './styles/base.css';
import './styles/os.css';
import { createOS } from './os/os.js';
import { createDesktop } from './os/desktop.js';
import { createTaskbar } from './os/taskbar.js';
import { runBoot, runShutdown } from './os/boot.js';
import { appById } from './apps/index.js';

const $ = (s) => document.querySelector(s);

const os = createOS({ windowLayer: $('#windows'), fxLayer: $('#fx'), notifyLayer: $('#balloons') });
window.__os = import.meta.env.DEV ? os : undefined;

const desktop = createDesktop({ root: $('#desk'), os });

async function shutdown(mode) {
  // close everything, then show the off screen
  for (const w of os.wm.list()) os.wm.byId(w.id)?.close();
  document.body.classList.add('is-off');
  await runShutdown({ root: document.body, profile: os.profile, sound: os.sound, mode });
  document.body.classList.remove('is-off');
  await boot();
}

createTaskbar({ root: $('#taskbar'), os, onShutdown: () => shutdown('shutdown'), onLogoff: () => shutdown('logoff') });

// The wallpaper pulls in three.js, so it loads in its own chunk while the
// boot screen is up. Until then (or if WebGL fails) the CSS meadow shows.
const wallCanvas = $('.desk__wall');
wallCanvas.classList.add('desk__wall--css');
import('./os/wallpaper.js')
  .then(({ createWallpaper }) => {
    wallCanvas.classList.remove('desk__wall--css');
    os.wallpaper = createWallpaper(wallCanvas, { reducedMotion: os.reducedMotion });
  })
  .catch((err) => {
    wallCanvas.classList.add('desk__wall--css');
    console.warn('wallpaper fell back to CSS', err);
  });

async function boot() {
  document.body.classList.add('is-booting');
  await runBoot({ root: document.body, profile: os.profile, reducedMotion: os.reducedMotion });
  document.body.classList.remove('is-booting');
  os.sound.unlock();
  os.sound.play('startup');
  desktop.show();

  // deep link: #/explorer opens that app; a first visit opens Home
  const id = location.hash.replace(/^#\/?/, '');
  setTimeout(() => {
    if (id && appById[id]) os.open(id);
    else if (!os.isMobile()) os.open('home');
    setTimeout(() => os.notify({
      title: 'Try the File Explorer',
      text: 'Every project I have built is in there. Brace yourself.',
      icon: 'folder',
      timeout: 9000,
      onClick: () => os.open('explorer'),
    }), 2600);
  }, 450);
}

window.addEventListener('hashchange', () => {
  const id = location.hash.replace(/^#\/?/, '');
  if (id && appById[id] && !os.isOpen(id)) os.open(id);
});

// keyboard: Alt+W closes the active window (Ctrl+W would close the tab)
window.addEventListener('keydown', (e) => {
  if (e.altKey && (e.key === 'w' || e.key === 'W')) { e.preventDefault(); os.wm.closeActive(); }
  if (e.altKey && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); os.wm.minimizeAll(); desktop.focusFirst(); }
});

boot();
