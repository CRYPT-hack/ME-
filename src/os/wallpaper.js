// The live desktop wallpaper: a procedural summer meadow (sky, sun, drifting
// clouds, rolling grass hills, pollen) with the resident hamster sitting on
// the near hill. Rendered with three.js on the desktop's own canvas.
//
// createWallpaper(canvas, { reducedMotion }) -> { setLevel(v), pulse(), setHidden(on), dispose() }
// - setLevel(0..1) is fed every frame by the music app while music plays: it
//   is smoothed (fast attack, slow release) and drives wind, clouds, the sun
//   halo and the hamster's bop. With no calls for a moment it settles back.
// - pulse() is a short sun flare and gust (~0.8 s).
// - setHidden(true) stops rendering while something opaque covers the whole
//   desktop (boot / shut-down screens, a maximised window); false resumes.
// - reduced motion: one static frame, re-rendered only on resize.
// - no WebGL: the canvas gets the CSS fallback class and methods are no-ops.
import * as THREE from 'three';
import { profile } from '../data/profile.js';
import { createMeadow } from './wallpaper/meadow.js';
import { makeHamsterCanvas, createHamster } from './wallpaper/hamster.js';
import { prng, smooth } from './wallpaper/noise.js';

const NOOP = Object.freeze({ setLevel() {}, pulse() {}, setHidden() {}, dispose() {} });
const MAX_DPR = 1.5;
const FRAME_MS = 1000 / 61; // cap at 60fps on high refresh screens
const FLARE_S = .8;
const HORIZON = .65; // the horizon, as a fraction of the screen from the top

/** Probe on a throwaway canvas so a device without WebGL falls back quietly. */
function hasWebGL() {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

function fallback(canvas) {
  canvas.classList.add('desk__wall--css');
  return NOOP;
}

export function createWallpaper(canvas, { reducedMotion = false } = {}) {
  if (!canvas) return NOOP;
  if (!hasWebGL()) return fallback(canvas);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas, alpha: false, antialias: false, powerPreference: 'low-power',
      stencil: false, depth: true, preserveDrawingBuffer: false,
    });
  } catch (err) {
    console.warn('wallpaper: WebGL unavailable, using the CSS meadow', err);
    return fallback(canvas);
  }

  let api;
  try {
    api = build(canvas, renderer, reducedMotion);
  } catch (err) {
    console.warn('wallpaper: meadow failed, using the CSS meadow', err);
    try { renderer.dispose(); renderer.forceContextLoss(); } catch { /* already gone */ }
    return fallback(canvas);
  }
  return api;
}

function build(canvas, renderer, reducedMotion) {
  const host = canvas.parentElement || canvas;
  const small = Math.min(window.innerWidth, window.innerHeight) < 600
    || window.matchMedia?.('(pointer: coarse)').matches;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
  renderer.setClearColor(0x6ea8ea, 1);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.autoClear = true;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, .1, 260);
  camera.rotation.order = 'YXZ';

  const rand = prng(20240611);
  const meadow = createMeadow({ renderer, rand, blades: small ? 3600 : 7000, pollen: small ? 80 : 140 });
  scene.add(meadow.group);
  const S = meadow.shared;

  // compile the shader programs up front so the first visible frame does not hitch
  renderer.compile(scene, camera);
  const gl = renderer.getContext();
  if (gl.isContextLost?.()) throw new Error('context lost during setup');

  // ── state ──
  let disposed = false;
  let raf = 0, last = 0, lastFrame = 0;
  let time = reducedMotion ? 42 : 0; // seconds of animation
  let level = 0, target = 0, lastSet = -1;
  let flareAt = -1, flare = 0;
  let beat = 0;
  let width = 0, height = 0;
  let hamster = null;
  const hamAnchor = new THREE.Vector3();
  let hamH = 1;
  // wandering while music plays: he walks between random spots on the hills
  const hamPos = new THREE.Vector3();
  const hamGoal = new THREE.Vector3();
  const hamView = new THREE.Vector3();
  let hamScale = 0;      // world height per unit of view depth
  let hamPlaced = false;
  let vibe = 0;          // 0..1, rises while music keeps playing
  let walking = false, walkAmt = 0, pauseUntil = 0;
  const clock = () => performance.now() / 1000;

  // ── layout ──
  const tmp = new THREE.Vector3();
  const ray = new THREE.Vector3();

  function frameCamera() {
    const aspect = width / height;
    // a narrow screen needs a taller view so the hills still read as hills
    const fov = aspect < .8 ? 52 : aspect < 1.2 ? 46 : 40;
    const tanY = Math.tan(THREE.MathUtils.degToRad(fov / 2));
    camera.fov = fov;
    camera.aspect = aspect;
    camera.position.set(0, 0, 0);
    // tip the view up so the true horizon lands HORIZON of the way down
    camera.rotation.set(Math.atan((2 * HORIZON - 1) * tanY), 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    meadow.layout(camera, height);
  }

  /** The ground point under a screen position (NDC), by marching the view ray. */
  function groundAt(nx, ny, out) {
    ray.set(nx, ny, .5).unproject(camera).sub(camera.position).normalize();
    let prev = 0;
    for (let t = 1; t < 80; t += .25) {
      tmp.copy(ray).multiplyScalar(t);
      if (tmp.y <= meadow.heightAt(tmp.x, tmp.z)) {
        // refine between the last two steps
        let a = prev, b = t;
        for (let i = 0; i < 10; i++) {
          const m = (a + b) / 2;
          tmp.copy(ray).multiplyScalar(m);
          if (tmp.y <= meadow.heightAt(tmp.x, tmp.z)) b = m; else a = m;
        }
        tmp.copy(ray).multiplyScalar(b);
        return out.set(tmp.x, meadow.heightAt(tmp.x, tmp.z), tmp.z);
      }
      prev = t;
    }
    return null;
  }

  function placeHamster() {
    if (!hamster || !height) return;
    const aspect = width / height;
    // right third, low on the near hill; a little further right on wide screens
    const nx = aspect < .8 ? .42 : smooth(.8, 1.8, aspect) * .14 + .44;
    const ny = aspect < .8 ? -.62 : -.6;
    if (!groundAt(nx, ny, hamAnchor)) return;
    const depth = -tmp.copy(hamAnchor).applyMatrix4(camera.matrixWorldInverse).z;
    const tanY = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const px = THREE.MathUtils.clamp(height * .085, 54, 104);
    hamH = (px / height) * 2 * depth * tanY;
    hamScale = hamH / Math.max(depth, 1e-3);
    if (!hamPlaced || reducedMotion) { hamPos.copy(hamAnchor); hamGoal.copy(hamAnchor); hamPlaced = true; }
    putHamster();
  }

  function putHamster() {
    const depth = -hamView.copy(hamPos).applyMatrix4(camera.matrixWorldInverse).z;
    const h = hamScale * Math.max(depth, .5);
    hamster.place(hamPos, h);
    S.uHam.value.set(hamPos.x, hamPos.z, h * hamster.aspect * .62, S.uHam.value.w || .55);
  }

  /** A random spot on the hills, clear of the desktop icons on the left. */
  function pickSpot(out) {
    for (let i = 0; i < 6; i++) {
      const nx = -.45 + Math.random() * 1.3;
      const ny = -.42 - Math.random() * .38;
      if (groundAt(nx, ny, out)) return true;
    }
    return false;
  }

  function wander(dt, now) {
    if (!hamster || !hamPlaced || reducedMotion) return;
    const playing = level > .04;
    vibe += ((playing ? 1 : 0) - vibe) * (1 - Math.exp(-dt * (playing ? .9 : .5)));
    if (vibe > .35) {
      if (!walking && now > pauseUntil && pickSpot(hamGoal)) walking = true;
    } else if (vibe < .2 && hamPos.distanceToSquared(hamAnchor) > 1e-4) {
      hamGoal.copy(hamAnchor); walking = true; // music stopped: head home
    }
    if (walking) {
      const dx = hamGoal.x - hamPos.x, dz = hamGoal.z - hamPos.z;
      const dist = Math.hypot(dx, dz);
      const depth = -hamView.copy(hamPos).applyMatrix4(camera.matrixWorldInverse).z;
      const speed = hamScale * Math.max(depth, .5) * (1.1 + level * .9);
      if (dist <= speed * dt || dist < 1e-3) {
        hamPos.x = hamGoal.x; hamPos.z = hamGoal.z;
        walking = false;
        pauseUntil = now + 1.6 + Math.random() * 2.8; // stop and vibe for a bit
      } else {
        hamPos.x += (dx / dist) * speed * dt;
        hamPos.z += (dz / dist) * speed * dt;
        // face the way he walks (screen-space direction)
        const sx = hamView.copy(hamGoal).applyMatrix4(camera.matrixWorldInverse).x
          - tmp.copy(hamPos).applyMatrix4(camera.matrixWorldInverse).x;
        if (Math.abs(sx) > 1e-4) hamster.face(sx > 0 ? -1 : 1);
      }
      hamPos.y = meadow.heightAt(hamPos.x, hamPos.z);
    } else if (vibe < .2) {
      hamster.face(1);
    }
    walkAmt += ((walking ? 1 : 0) - walkAmt) * (1 - Math.exp(-dt * 8));
    putHamster();
  }

  function resize() {
    const w = Math.max(1, Math.round(host.clientWidth || window.innerWidth));
    const h = Math.max(1, Math.round(host.clientHeight || window.innerHeight));
    if (w === width && h === height) return false;
    width = w; height = h;
    renderer.setSize(w, h, false);
    frameCamera();
    placeHamster();
    return true;
  }

  // ── animation ──
  function step(dt) {
    const now = clock();
    // the music app stops calling setLevel when it stops: let it settle
    const want = lastSet >= 0 && now - lastSet < .3 ? target : 0;
    const k = want > level ? 1 - Math.exp(-dt * 16) : 1 - Math.exp(-dt * 1.5);
    level += (want - level) * k;
    if (level < 1e-4) level = 0;

    if (flareAt >= 0) {
      const t = now - flareAt;
      if (t >= FLARE_S) { flare = 0; flareAt = -1; } else {
        flare = t < .07 ? t / .07 : Math.pow(1 - (t - .07) / (FLARE_S - .07), 2);
      }
    }

    time += dt;
    S.uTime.value = time;
    S.uWindT.value += dt * (1 + level * 1.7 + flare * 2.2);
    S.uCloudT.value += dt * (1 + level * 3.2 + flare * 4);
    S.uLevel.value = level;
    S.uFlare.value = flare;
    beat += dt * (1.4 + level * 6.4);
    if (hamster) {
      wander(dt, now);
      const hop = hamster.update(time, beat, level, flare, walkAmt, vibe);
      S.uHam.value.w = .55 * Math.max(.25, 1 - hop * 3.2);
    }
  }

  function render() {
    if (disposed || gl.isContextLost()) return;
    renderer.render(scene, camera);
  }

  function loop(ms) {
    raf = requestAnimationFrame(loop);
    if (ms - lastFrame < FRAME_MS) return;
    lastFrame = ms;
    const dt = last ? Math.min((ms - last) / 1000, .1) : 1 / 60;
    last = ms;
    step(dt);
    render();
  }

  let covered = false;
  function start() {
    if (reducedMotion || disposed || raf || document.hidden || covered) return;
    last = 0; lastFrame = 0;
    raf = requestAnimationFrame(loop);
  }
  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  // ── wiring ──
  const onVisibility = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', onVisibility);

  let ro = null;
  const onResize = () => {
    if (disposed) return;
    if (resize() && (reducedMotion || !raf)) render();
  };
  if (typeof ResizeObserver === 'function') {
    ro = new ResizeObserver(onResize);
    ro.observe(host);
  } else {
    window.addEventListener('resize', onResize);
  }

  const onLost = (e) => { e.preventDefault(); stop(); };
  const onRestored = () => { if (disposed) return; render(); start(); };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  // ── the hamster ──
  let img = null;
  if (profile?.photo) {
    img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      if (disposed || !img.naturalWidth) return;
      try {
        const { canvas: pic, sits } = makeHamsterCanvas(img);
        hamster = createHamster(pic, sits);
        scene.add(hamster.mesh);
        placeHamster();
        hamster.update(time, beat, 0, 0);
        if (reducedMotion || !raf) render();
      } catch (err) {
        console.warn('wallpaper: hamster skipped', err);
        hamster = null;
      }
    };
    img.onerror = () => { img = null; };
    img.src = profile.photo;
  }

  resize();
  step(0);
  render();
  start();

  return {
    setLevel(v) {
      if (disposed || reducedMotion) return;
      target = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
      lastSet = clock();
    },
    pulse() {
      if (disposed || reducedMotion) return;
      flareAt = clock();
    },
    setHidden(on) {
      if (disposed || covered === !!on) return;
      covered = !!on;
      if (covered) stop(); else start();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      if (ro) ro.disconnect(); else window.removeEventListener('resize', onResize);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      if (img) { img.onload = img.onerror = null; img = null; }
      hamster?.dispose();
      hamster = null;
      meadow.dispose();
      renderer.renderLists.dispose();
      renderer.dispose();
    },
  };
}
