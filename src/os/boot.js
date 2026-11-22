// Boot sequence: a phosphor-green POST screen on a curved CRT, a progress bar,
// then a short "welcome" splash. Click or press any key to skip. A repeat
// visit in the same tab boots in a fraction of the time.
import { h } from './ui.js';

const SEEN = 'cryptos.booted';

/**
 * @param {{root:HTMLElement, profile:any, reducedMotion:boolean}} o
 * @returns {Promise<void>} resolves when the desktop should appear
 */
export function runBoot({ root, profile, reducedMotion }) {
  let fast = false;
  try { fast = sessionStorage.getItem(SEEN) === '1'; } catch { /* ignore */ }
  try { sessionStorage.setItem(SEEN, '1'); } catch { /* ignore */ }

  const date = new Date();
  const stamp = `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
  const steps = [
    'Detecting caffeine',
    'Mounting /home/shobhit',
    'Indexing repositories',
    'Warming up the GPU',
    'Loading desktop icons',
    'Waking the hamster',
    'Starting CRYPT OS',
  ];

  const lines = h('ol.boot__lines');
  const mem = h('span.boot__mem', {}, '0K');
  const bar = h('span.boot__fill');
  const pct = h('span.boot__pct', {}, '0%');
  const screen = h('div.boot__screen', {},
    h('div.boot__head', {},
      h('div', {},
        h('p.boot__strong', {}, 'CRYPT BIOS v4.20'),
        h('p', {}, `(C) ${date.getFullYear()} ${profile.name} · ${profile.handle}`)),
      h('span.boot__badge', { 'aria-hidden': 'true' }, '◉')),
    h('p', {}, 'Main processor : Curiosity @ 4.20 GHz'),
    h('p', {}, 'Memory test    : ', mem),
    lines,
    h('div.boot__bar', {}, h('span.boot__track', {}, bar), pct),
    h('p.boot__foot', {}, `${stamp}-CRYPT-OS-01 · press any key to skip`));
  const crt = h('div.boot__crt', {}, screen, h('div.boot__glass'));
  const welcome = h('div.boot__welcome', { hidden: true },
    h('div.boot__welcome-band'),
    h('p.boot__welcome-text', {}, 'welcome'),
    h('div.boot__welcome-band.boot__welcome-band--low'));
  const el = h('div.boot', { role: 'status', 'aria-live': 'polite', 'aria-label': 'Starting up' }, crt, welcome);
  root.append(el);

  return new Promise((resolve) => {
    let done = false;
    const timers = [];
    const at = (ms, fn) => timers.push(setTimeout(fn, fast || reducedMotion ? ms * 0.18 : ms));

    function finish() {
      if (done) return;
      done = true;
      timers.forEach(clearTimeout);
      removeEventListener('keydown', skip);
      el.removeEventListener('pointerdown', skip);
      crt.hidden = true;
      welcome.hidden = false;
      const hold = fast || reducedMotion ? 350 : 1100;
      setTimeout(() => {
        el.classList.add('is-out');
        resolve();
        setTimeout(() => el.remove(), 700);
      }, hold);
    }
    function skip() { finish(); }
    addEventListener('keydown', skip);
    el.addEventListener('pointerdown', skip);

    // memory counter
    let k = 0;
    const memTimer = setInterval(() => {
      k = Math.min(65536, k + 2048 + Math.floor(Math.random() * 3000));
      mem.textContent = `${k}K${k >= 65536 ? ' OK' : ''}`;
      if (k >= 65536) clearInterval(memTimer);
    }, fast ? 10 : 35);
    timers.push(memTimer);

    steps.forEach((s, i) => {
      at(500 + i * 380, () => {
        const li = h('li', {}, h('span', {}, s), h('span.boot__dots'), h('span.boot__ok', {}, '…'));
        lines.append(li);
        const p = Math.round(((i + 1) / steps.length) * 100);
        bar.style.width = `${p}%`;
        pct.textContent = `${p}%`;
        at(260, () => { li.lastChild.textContent = 'OK'; li.classList.add('is-ok'); });
      });
    });
    at(500 + steps.length * 380 + 450, finish);
  });
}

/** Full-screen shutdown / log-off screen. Resolves when the visitor clicks to boot again. */
export function runShutdown({ root, profile, sound, mode = 'shutdown' }) {
  sound.play('shutdown');
  const el = h('div.off', { role: 'dialog', 'aria-label': 'Shut down' },
    h('div.off__inner', {},
      h('p.off__title', {}, mode === 'logoff' ? `Logging off ${profile.firstName}…` : 'It is now safe to close this tab.'),
      h('p.off__sub', {}, 'Or click anywhere to start again.')));
  root.append(el);
  requestAnimationFrame(() => el.classList.add('is-in'));
  return new Promise((resolve) => {
    // whichever fires first wins; drop the other so nothing is left behind
    const go = () => {
      el.removeEventListener('pointerdown', go);
      removeEventListener('keydown', go);
      el.remove();
      resolve();
    };
    setTimeout(() => {
      el.addEventListener('pointerdown', go, { once: true });
      addEventListener('keydown', go, { once: true });
    }, 600);
  });
}
