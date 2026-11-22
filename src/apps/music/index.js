// Music: "Tape Deck", a compact brushed-metal cassette player that plays four
// original tracks synthesised live with WebAudio (see engine.js / tracks.js),
// plus a Spotify section below it.
import './music.css';
import { h, clamp } from '../../os/ui.js';
import { icon } from '../../os/icons.js';
import { createEngine } from './engine.js';
import { tracks } from './tracks.js';

const VOL_KEY = 'cryptos.music.volume';
const SHUF_KEY = 'cryptos.music.shuffle';
const NOTE_KEY = 'cryptos.music.notified';
let notifiedThisSession = false;
let uid = 0;

/* ------------------------------------------------------------ helpers */

function readStore(key, fallback) {
  try { const v = localStorage.getItem(key); return v == null ? fallback : v; } catch { return fallback; }
}
function writeStore(key, value) {
  try { localStorage.setItem(key, String(value)); } catch { /* private mode */ }
}
function fmtTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

const EMBED_TYPES = new Set(['track', 'album', 'playlist', 'artist', 'episode', 'show']);

/**
 * Any open.spotify.com URL (or spotify:type:id URI) → the official embed URL,
 * with the query string stripped. Returns '' when it cannot be parsed.
 */
export function spotifyEmbedUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  const uri = raw.match(/^spotify:([a-z]+):([A-Za-z0-9]+)$/);
  if (uri && EMBED_TYPES.has(uri[1])) return `https://open.spotify.com/embed/${uri[1]}/${uri[2]}`;
  let url;
  try { url = new URL(raw); } catch { return ''; }
  if (url.hostname !== 'open.spotify.com') return '';
  const parts = url.pathname.split('/').filter(Boolean)
    .filter((p) => !/^intl-/i.test(p) && p !== 'embed');
  const i = parts.findIndex((p) => EMBED_TYPES.has(p));
  if (i < 0 || !parts[i + 1] || !/^[A-Za-z0-9]+$/.test(parts[i + 1])) return '';
  return `https://open.spotify.com/embed/${parts[i]}/${parts[i + 1]}`;
}

const SVG = {
  prev: '<path d="M3 3h2v10H3zM14 3v10L6 8z"/>',
  play: '<path d="M4 2.5v11l9.5-5.5z"/>',
  pause: '<path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z"/>',
  stop: '<path d="M3 3h10v10H3z"/>',
  next: '<path d="M11 3h2v10h-2zM2 3v10l8-5z"/>',
  shuffle: '<path d="M1 4h3l6 8h3v-2l3 3-3 3v-2h-4L3 6H1zM10 4h3V2l3 3-3 3V6h-3l-1.6 2.1-1.3-1.7z" transform="scale(.94)"/>',
  vol: '<path d="M2 6h3l4-3v10L5 10H2z"/><path d="M11 5.5a3.5 3.5 0 0 1 0 5M12.5 3.5a6 6 0 0 1 0 9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
};
const svg = (name, size = 16) =>
  `<svg viewBox="0 0 16 16" width="${size}" height="${size}" fill="currentColor" aria-hidden="true" focusable="false">${SVG[name]}</svg>`;

/** A cassette reel hub: a white ring with six teeth, drawn once as SVG. */
const HUB = `<svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">
  <circle cx="20" cy="20" r="18" fill="#e9e4d6" stroke="#9c968a" stroke-width="1"/>
  <circle cx="20" cy="20" r="9.5" fill="#1b1a18"/>
  ${[0, 60, 120, 180, 240, 300].map((a) => `<rect x="18.6" y="9.4" width="2.8" height="4.2" rx=".6" fill="#e9e4d6" transform="rotate(${a} 20 20)"/>`).join('')}
  ${[30, 150, 270].map((a) => `<circle cx="20" cy="5.6" r="2.3" fill="#bdb7a9" transform="rotate(${a} 20 20)"/>`).join('')}
</svg>`;

/* ---------------------------------------------------------------- app */

export function mount(body, ctx) {
  const { os, win } = ctx;
  const { profile } = os;
  const spotify = profile.spotify || {};
  const reduced = !!os.reducedMotion;
  const id = `music${++uid}`;

  let engine = null;
  let ac = null;
  let index = 0;
  let state = 'stopped'; // 'playing' | 'paused' | 'stopped'
  let shuffle = readStore(SHUF_KEY, 'off') === 'on';
  let volume = clamp(Number(readStore(VOL_KEY, '0.7')) || 0.7, 0, 1);
  let raf = 0;
  let alive = true;
  let level = 0;
  let lastSec = -1;
  let rotL = 0, rotR = 0, lastFrame = 0;
  let freq = null, wave = null;
  let specW = 0, specH = 0, specDpr = 1;
  const peaks = new Float32Array(28);
  const bars = new Float32Array(28);
  const history = []; // indexes played, for Prev in shuffle mode

  win.flush();
  const root = h('div.app-music', { tabindex: '-1' });
  root.style.setProperty('--vol', String(volume));
  body.append(root);

  /* ---------- LCD */
  const marqueeText = h('span.app-music__marquee-text');
  const marquee = h('div.app-music__marquee', { 'aria-hidden': 'true' }, marqueeText);
  const nowLabel = h('span.sr-only', { 'aria-live': 'polite' });
  const timeEl = h('span.app-music__time', {}, '00:00');
  const durEl = h('span.app-music__dur', {}, '/ 00:00');
  const stateEl = h('span.app-music__state', {}, 'STOP');
  const trackNo = h('span.app-music__no', {}, '01');
  const shufLed = h('span.app-music__led', {}, 'SHUF');
  shufLed.classList.toggle('is-on', shuffle); // reflect the restored setting
  const spec = h('canvas.app-music__spec', { 'aria-hidden': 'true' });
  const specWrap = h('div.app-music__spec-wrap', {}, spec);
  const lcd = h('div.app-music__lcd', {},
    h('div.app-music__lcd-top', {}, stateEl, trackNo, shufLed, h('span.app-music__lcd-fill'), timeEl, durEl),
    marquee, nowLabel, specWrap);

  /* ---------- cassette */
  const packL = h('span.app-music__pack');
  const packR = h('span.app-music__pack');
  const hubL = h('span.app-music__hub', { html: HUB });
  const hubR = h('span.app-music__hub', { html: HUB });
  const tapeTitle = h('span.app-music__label-title');
  const tapeSide = h('span.app-music__label-side', {}, 'A');
  const cassette = h('div.app-music__cassette', { 'aria-hidden': 'true' },
    h('span.app-music__screw.is-tl'), h('span.app-music__screw.is-tr'), h('span.app-music__screw.is-bl'), h('span.app-music__screw.is-br'),
    h('div.app-music__label', {},
      h('div.app-music__label-row', {}, tapeSide, tapeTitle),
      h('div.app-music__label-lines')),
    h('div.app-music__window', {},
      h('span.app-music__reel', {}, packL, hubL),
      h('span.app-music__tape-run'),
      h('span.app-music__reel', {}, packR, hubR)),
    h('div.app-music__trap'));

  /* ---------- transport */
  const btn = (name, label, onclick, extra = {}) =>
    h('button.app-music__key', { type: 'button', 'aria-label': label, title: label, onclick, ...extra }, h('span', { html: svg(name) }));
  const prevBtn = btn('prev', 'Previous track', () => prev());
  const playBtn = btn('play', 'Play', () => toggle(), { class: 'app-music__key is-play' });
  const stopBtn = btn('stop', 'Stop', () => stop());
  const nextBtn = btn('next', 'Next track', () => next(true));
  const shufBtn = btn('shuffle', 'Shuffle', () => setShuffle(!shuffle), { 'aria-pressed': String(shuffle), class: 'app-music__key is-small' });
  const volInput = h('input.app-music__vol', {
    type: 'range', min: '0', max: '100', step: '1', value: String(Math.round(volume * 100)),
    'aria-label': 'Volume', id: `${id}-vol`,
  });
  volInput.addEventListener('input', onVolume);
  const transport = h('div.app-music__transport', {}, prevBtn, playBtn, stopBtn, nextBtn);
  const lower = h('div.app-music__lower', {},
    shufBtn,
    h('label.app-music__vol-wrap', { for: `${id}-vol` }, h('span', { html: svg('vol', 14) }), h('span.sr-only', {}, 'Volume')),
    volInput);

  const deck = h('section.app-music__deck', { 'aria-label': 'Tape deck' },
    h('div.app-music__brand', {}, h('span', {}, 'TAPE DECK'), h('small', {}, 'CR-04 · procedural stereo')),
    lcd, cassette, transport, lower);

  /* ---------- playlist */
  const list = h('ol.app-music__list', { 'aria-label': 'Tracks' });
  const rows = tracks.map((tr, i) => {
    const b = h('button.app-music__row', { type: 'button', onclick: () => pick(i) },
      h('span.app-music__row-no', {}, String(i + 1).padStart(2, '0')),
      h('span.app-music__row-main', {}, h('strong', {}, tr.title), h('small', {}, tr.tag)),
      h('span.app-music__row-dur', {}, fmtTime(durationOf(tr))));
    list.append(h('li', {}, b));
    return b;
  });

  /* ---------- spotify */
  const spotSection = buildSpotify();

  root.append(deck,
    h('section.app-music__side', { 'aria-labelledby': `${id}-tl` },
      h('h3.app-music__h', { id: `${id}-tl` }, 'Side A ', h('small', {}, 'all four made in code, right now, in your browser')),
      list),
    spotSection);

  root.addEventListener('keydown', onKey);

  let ro = null;
  if ('ResizeObserver' in window) {
    ro = new ResizeObserver(() => sizeSpec());
    ro.observe(specWrap);
  }
  sizeSpec();

  win.setMenu([
    {
      label: 'Playback', items: [
        { label: 'Play / Pause   Space', action: () => toggle() },
        { label: 'Stop', action: () => stop() },
        '-',
        { label: 'Next track', action: () => next(true) },
        { label: 'Previous track', action: () => prev() },
        '-',
        { label: 'Toggle shuffle', action: () => setShuffle(!shuffle) },
      ],
    },
    { label: 'Tracks', items: tracks.map((tr, i) => ({ label: `${i + 1}. ${tr.title}`, action: () => pick(i) })) },
    {
      label: 'Spotify', items: [
        { label: 'Open my Spotify', disabled: !spotify.profileUrl, action: () => spotify.profileUrl && window.open(spotify.profileUrl, '_blank', 'noopener') },
      ],
    },
  ]);

  showTrack();
  updateTime(true);
  paintIdle();

  /* ------------------------------------------------------------ audio */

  function durationOf(tr) { return (tr.bars * 16 * 60) / tr.bpm / 4; }

  function ensureEngine() {
    if (engine) return true;
    os.sound?.unlock?.();
    ac = os.sound?.context?.();
    if (!ac) {
      os.notify({ title: 'No audio here', text: 'This browser does not support WebAudio, so the tape deck stays quiet.', icon: 'warning' });
      return false;
    }
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    engine = createEngine(ac, { volume });
    freq = new Uint8Array(engine.analyser.frequencyBinCount);
    wave = new Float32Array(engine.analyser.fftSize);
    return true;
  }

  function onTrackEnd(at) {
    // gapless hand-over: the next track starts exactly where this one ended
    const n = nextIndex();
    history.push(index);
    index = n;
    engine.start(tracks[index], 0, at, onTrackEnd);
    showTrack();
  }

  function play() {
    if (!alive || !ensureEngine()) return;
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    engine.start(tracks[index], engine.step, 0, onTrackEnd);
    state = 'playing';
    firstPlayNote();
    syncState();
    startLoop();
  }

  function pause() {
    if (!engine || state !== 'playing') return;
    engine.halt(0.06);
    state = 'paused';
    syncState();
    os.wallpaper?.setLevel?.(0);
  }

  function stop() {
    if (engine) { engine.halt(0.06); engine.reset(); }
    const was = state;
    state = 'stopped';
    lastSec = -1;
    syncState();
    updateTime(true);
    os.wallpaper?.setLevel?.(0);
    if (was === 'stopped') paintIdle();
  }

  function toggle() {
    if (state === 'playing') pause(); else play();
  }

  /** Jump to track `i`; keeps playing if we were playing. */
  function goTo(i, remember = true) {
    if (remember && i !== index) history.push(index);
    if (history.length > 40) history.shift();
    index = (i + tracks.length) % tracks.length;
    const wasPlaying = state === 'playing';
    if (engine) {
      if (wasPlaying) engine.halt(0.04);
      engine.reset();
    }
    lastSec = -1;
    showTrack();
    if (wasPlaying) play();
    else { updateTime(true); paintIdle(); }
  }

  function pick(i) {
    if (i === index && state === 'playing') return;
    goTo(i);
    if (state !== 'playing') play();
  }

  function nextIndex() {
    if (!shuffle || tracks.length < 2) return (index + 1) % tracks.length;
    let n = index;
    while (n === index) n = Math.floor(Math.random() * tracks.length);
    return n;
  }

  function next() { goTo(nextIndex()); }

  function prev() {
    // a few seconds in, Prev restarts the track; at the start it goes back
    if (engine && engine.elapsed() > 3) { goTo(index, false); return; }
    if (shuffle && history.length) { goTo(history.pop(), false); return; }
    goTo(index - 1, false);
  }

  function setShuffle(on) {
    shuffle = !!on;
    writeStore(SHUF_KEY, shuffle ? 'on' : 'off');
    shufBtn.setAttribute('aria-pressed', String(shuffle));
    shufLed.classList.toggle('is-on', shuffle);
    os.sound?.play?.('click');
    syncStatus();
  }

  function onVolume() {
    volume = clamp(Number(volInput.value) / 100, 0, 1);
    engine?.setVolume(volume);
    root.style.setProperty('--vol', String(volume));
    writeStore(VOL_KEY, volume.toFixed(2));
    syncStatus();
  }

  function firstPlayNote() {
    if (notifiedThisSession || !os.wallpaper) return;
    let seen = false;
    try { seen = sessionStorage.getItem(NOTE_KEY) === '1'; sessionStorage.setItem(NOTE_KEY, '1'); } catch { /* blocked */ }
    notifiedThisSession = true;
    if (seen) return;
    setTimeout(() => {
      if (!alive) return;
      os.notify({
        title: 'The wallpaper can hear you',
        text: 'The desktop behind this window moves with the music. Pause to calm it down.',
        icon: 'music', timeout: 7000,
      });
    }, 900);
  }

  /* --------------------------------------------------------------- UI */

  function showTrack() {
    const tr = tracks[index];
    const text = `${tr.title} — ${tr.artist}`;
    marqueeText.replaceChildren(
      h('span', {}, `${text}  ·  ${tr.tag}`),
      h('span', { 'aria-hidden': 'true' }, `${text}  ·  ${tr.tag}`));
    marquee.style.setProperty('--len', String(text.length + tr.tag.length));
    tapeTitle.textContent = tr.title;
    tapeSide.textContent = String.fromCharCode(65 + (index % 2));
    trackNo.textContent = String(index + 1).padStart(2, '0');
    durEl.textContent = `/ ${fmtTime(durationOf(tr))}`;
    nowLabel.textContent = `Track ${index + 1}: ${text}`;
    rows.forEach((r, i) => {
      r.classList.toggle('is-current', i === index);
      if (i === index) r.setAttribute('aria-current', 'true'); else r.removeAttribute('aria-current');
    });
    root.style.setProperty('--hue', String([150, 28, 205, 330][index % 4]));
    syncStatus();
  }

  function syncState() {
    const playing = state === 'playing';
    root.classList.toggle('is-playing', playing);
    root.classList.toggle('is-paused', state === 'paused');
    playBtn.querySelector('span').innerHTML = svg(playing ? 'pause' : 'play');
    playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    playBtn.title = playing ? 'Pause' : 'Play';
    playBtn.setAttribute('aria-pressed', String(playing));
    stateEl.textContent = playing ? 'PLAY' : state === 'paused' ? 'PAUSE' : 'STOP';
    syncStatus();
  }

  function syncStatus() {
    win.setStatus([
      `Track ${index + 1} of ${tracks.length}`,
      state === 'playing' ? 'Playing' : state === 'paused' ? 'Paused' : 'Stopped',
      shuffle ? 'Shuffle on' : 'In order',
      `Volume ${Math.round(volume * 100)}%`,
    ]);
  }

  function updateTime(force) {
    const tr = tracks[index];
    const el = engine ? engine.elapsed() : 0;
    const sec = Math.floor(el);
    if (force || sec !== lastSec) {
      lastSec = sec;
      timeEl.textContent = fmtTime(el);
    }
    const p = clamp(el / durationOf(tr), 0, 1);
    // tape moves from the left pack to the right one as the track plays
    const l = 0.7 + 0.3 * (1 - p);
    const r = 0.7 + 0.3 * p;
    packL.style.transform = `scale(${l.toFixed(3)})`;
    packR.style.transform = `scale(${r.toFixed(3)})`;
    return { l, r };
  }

  /* ------------------------------------------------------- animation */

  function startLoop() {
    if (!raf && alive) { lastFrame = performance.now(); raf = requestAnimationFrame(frame); }
  }

  function frame(now) {
    raf = 0;
    if (!alive) return;
    const dt = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;
    const playing = state === 'playing' && engine;
    // While minimised, keep feeding the wallpaper but skip the window's own DOM
    // and canvas work; the next visible frame catches the LCD and reels up.
    const hidden = win.isMinimized();
    const { l, r } = hidden ? { l: 1, r: 1 } : updateTime(false);

    // reels: the hub turns faster when its pack is small (constant tape speed)
    if (playing && !reduced && !hidden) {
      rotL = (rotL + dt * 150 / l) % 360;
      rotR = (rotR + dt * 150 / r) % 360;
      hubL.style.transform = `rotate(${rotL.toFixed(1)}deg)`;
      hubR.style.transform = `rotate(${rotR.toFixed(1)}deg)`;
    }

    // spectrum + loudness
    let target = 0;
    if (playing) {
      engine.analyser.getByteFrequencyData(freq);
      engine.analyser.getFloatTimeDomainData(wave);
      let sum = 0;
      for (let i = 0; i < wave.length; i++) sum += wave[i] * wave[i];
      target = Math.pow(clamp(Math.sqrt(sum / wave.length) * 4, 0, 1), 0.8);
    }
    level += (target - level) * (target > level ? 0.35 : 0.08);
    if (playing) os.wallpaper?.setLevel?.(level);
    const active = hidden && playing ? true : drawSpectrum(playing, dt);

    if (playing || active) raf = requestAnimationFrame(frame);
  }

  function sizeSpec() {
    const rect = specWrap.getBoundingClientRect();
    specDpr = Math.min(2, window.devicePixelRatio || 1);
    specW = Math.max(1, Math.round(rect.width));
    specH = Math.max(1, Math.round(rect.height));
    spec.width = Math.round(specW * specDpr);
    spec.height = Math.round(specH * specDpr);
    if (state !== 'playing') paintIdle();
  }

  /** Draws the bars; returns true while anything is still falling. */
  function drawSpectrum(playing, dt) {
    const g = spec.getContext('2d');
    if (!g) return false;
    const n = bars.length;
    let moving = false;
    if (playing && freq) {
      // log-spaced bins from ~40 Hz to ~14 kHz
      const nyq = ac.sampleRate / 2;
      const bins = freq.length;
      for (let i = 0; i < n; i++) {
        const f0 = 40 * Math.pow(14000 / 40, i / n);
        const f1 = 40 * Math.pow(14000 / 40, (i + 1) / n);
        const a = Math.max(0, Math.floor((f0 / nyq) * bins));
        const b = Math.max(a + 1, Math.min(bins, Math.ceil((f1 / nyq) * bins)));
        let m = 0;
        for (let k = a; k < b; k++) if (freq[k] > m) m = freq[k];
        const v = Math.pow(m / 255, 1.4) * (0.85 + i / n * 0.35);
        bars[i] = v > bars[i] ? v : bars[i] - dt * 1.6;
      }
    } else {
      for (let i = 0; i < n; i++) bars[i] = Math.max(0, bars[i] - dt * 1.8);
    }
    g.setTransform(specDpr, 0, 0, specDpr, 0, 0);
    g.clearRect(0, 0, specW, specH);
    const gap = 2;
    const bw = (specW - gap * (n - 1)) / n;
    const seg = 3; // LCD segments
    for (let i = 0; i < n; i++) {
      const v = clamp(bars[i], 0, 1);
      peaks[i] = v > peaks[i] ? v : Math.max(0, peaks[i] - dt * 0.45);
      if (v > 0.002 || peaks[i] > 0.002) moving = true;
      const x = i * (bw + gap);
      // unlit ghost segments, like a real LCD
      g.fillStyle = 'rgba(30, 70, 40, .35)';
      for (let y = specH - seg; y >= 0; y -= seg + 1) g.fillRect(x, y, bw, seg);
      const hgt = Math.round(v * specH);
      g.fillStyle = '#9dff8c';
      for (let y = specH - seg; y >= specH - hgt; y -= seg + 1) g.fillRect(x, y, bw, seg);
      if (peaks[i] > 0.02) {
        g.fillStyle = '#e7ffd6';
        g.fillRect(x, Math.round(specH - peaks[i] * specH) - 1, bw, 2);
      }
    }
    return moving;
  }

  function paintIdle() {
    if (raf) return;
    drawSpectrum(false, 0);
  }

  function onKey(e) {
    if (e.target.closest('input, textarea, select, iframe, a')) return;
    if (e.key === ' ' && !e.target.closest('button, summary')) {
      e.preventDefault();
      toggle();
    } else if (e.key === 'MediaPlayPause') { toggle(); }
  }

  /* ---------------------------------------------------------- spotify */

  function buildSpotify() {
    const embed = spotifyEmbedUrl(spotify.embed);
    let content;
    if (embed) {
      content = h('iframe.app-music__embed', {
        src: embed, title: 'Spotify player', loading: 'lazy',
        allow: 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture',
        style: 'border-radius:12px', height: '152', width: '100%', frameborder: '0',
      });
    } else {
      const items = (spotify.onRepeat || []).filter((x) => x && x.title);
      content = h('div.app-music__repeat', {},
        h('div.app-music__repeat-head', {},
          h('span.app-music__repeat-art', { 'aria-hidden': 'true' }, h('i')),
          h('div', {},
            h('small', {}, 'Playlist'),
            h('strong', {}, 'On repeat'),
            h('span', {}, `${items.length} ${items.length === 1 ? 'mix' : 'mixes'} I keep coming back to`))),
        items.length
          ? h('ol.app-music__repeat-list', {}, ...items.map((it, i) => h('li', {},
            h('span.app-music__repeat-no', {}, String(i + 1)),
            h('span.app-music__repeat-main', {}, h('strong', {}, it.title), it.artist ? h('small', {}, it.artist) : null),
            h('span.app-music__eq', { 'aria-hidden': 'true' }, h('i'), h('i'), h('i')))))
          : h('p.app-music__muted', {}, 'Nothing on repeat yet.'));
    }
    const cta = spotify.profileUrl
      ? h('a.btn.app-music__spot-btn', { href: spotify.profileUrl, target: '_blank', rel: 'noopener noreferrer' }, h('span', { html: icon('music', 16) }), 'Open my Spotify')
      : h('div.app-music__spot-cta', {},
        h('button.btn.app-music__spot-btn', { type: 'button', disabled: true, 'aria-describedby': `${id}-spot-help` }, h('span', { html: icon('music', 16) }), 'Open my Spotify'),
        h('p.app-music__muted', { id: `${id}-spot-help` }, 'Spotify link coming soon'));
    return h('details.app-music__spot', { open: true },
      h('summary.app-music__spot-sum', {}, h('span', { html: icon('music', 16) }), h('span', {}, embed ? 'Spotify' : 'Spotify · on repeat'), h('span.app-music__chev', { 'aria-hidden': 'true' })),
      h('div.app-music__spot-body', {}, content, cta));
  }

  /* --------------------------------------------------------- lifecycle */

  return {
    resize() { sizeSpec(); },
    reopen(args) {
      if (args && Number.isInteger(args.track) && tracks[args.track]) pick(args.track);
    },
    destroy() {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      root.removeEventListener('keydown', onKey);
      volInput.removeEventListener('input', onVolume);
      ro?.disconnect();
      engine?.destroy();
      engine = null;
      os.wallpaper?.setLevel?.(0);
    },
  };
}
