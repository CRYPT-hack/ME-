// The resident hamster: the profile photo, cut out of its background, as a
// small camera-facing billboard sitting in the grass on the near hill. It
// breathes, sways a little, and bops along when music plays.
//
// The cut-out is made at runtime so the photo can be swapped any time:
// - a PNG with real transparency is used as is;
// - an opaque photo gets a warm-colour subject mask (fur, skin) that is
//   closed, hole-filled and opened, keeping the largest blob;
// - if that does not look like a plausible subject, the photo is shown as a
//   tiny polaroid on a stick instead.
import * as THREE from 'three';

/** Separable square-kernel dilate (max) or erode (min) of a 0/1 mask. */
function morph(src, W, H, r, dilate) {
  const tmp = new Uint8Array(W * H), out = new Uint8Array(W * H);
  const hit = dilate ? 1 : 0, miss = dilate ? 0 : 1;
  for (let y = 0; y < H; y++) {
    const row = y * W;
    for (let x = 0; x < W; x++) {
      let v = miss;
      for (let k = -r; k <= r; k++) {
        const xx = x + k;
        if (xx < 0 || xx >= W) { if (!dilate) { v = 0; break; } continue; }
        if (src[row + xx] === hit) { v = hit; break; }
      }
      tmp[row + x] = v;
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let v = miss;
      for (let k = -r; k <= r; k++) {
        const yy = y + k;
        if (yy < 0 || yy >= H) { if (!dilate) { v = 0; break; } continue; }
        if (tmp[yy * W + x] === hit) { v = hit; break; }
      }
      out[y * W + x] = v;
    }
  }
  return out;
}

/** Keep only the largest 4-connected blob of a mask; returns [mask, area]. */
function largestBlob(mask, W, H) {
  const label = new Int32Array(W * H);
  const stack = new Int32Array(W * H);
  let best = 0, bestId = 0, id = 0;
  for (let i = 0; i < W * H; i++) {
    if (!mask[i] || label[i]) continue;
    id++;
    let sp = 0, area = 0;
    stack[sp++] = i; label[i] = id;
    while (sp) {
      const j = stack[--sp]; area++;
      const x = j % W, y = (j / W) | 0;
      if (x > 0 && mask[j - 1] && !label[j - 1]) { label[j - 1] = id; stack[sp++] = j - 1; }
      if (x < W - 1 && mask[j + 1] && !label[j + 1]) { label[j + 1] = id; stack[sp++] = j + 1; }
      if (y > 0 && mask[j - W] && !label[j - W]) { label[j - W] = id; stack[sp++] = j - W; }
      if (y < H - 1 && mask[j + W] && !label[j + W]) { label[j + W] = id; stack[sp++] = j + W; }
    }
    if (area > best) { best = area; bestId = id; }
  }
  const out = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) out[i] = label[i] === bestId && bestId ? 1 : 0;
  return [out, best];
}

/** Fill the holes of a mask: everything not reachable from the border. */
function fillHoles(mask, W, H) {
  const outside = new Uint8Array(W * H);
  const stack = new Int32Array(W * H);
  let sp = 0;
  const seed = (i) => { if (!mask[i] && !outside[i]) { outside[i] = 1; stack[sp++] = i; } };
  for (let x = 0; x < W; x++) { seed(x); seed((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { seed(y * W); seed(y * W + W - 1); }
  while (sp) {
    const j = stack[--sp];
    const x = j % W, y = (j / W) | 0;
    if (x > 0) seed(j - 1);
    if (x < W - 1) seed(j + 1);
    if (y > 0) seed(j - W);
    if (y < H - 1) seed(j + W);
  }
  const out = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) out[i] = outside[i] ? 0 : 1;
  return out;
}

/** Subject mask for an opaque photo, or null if it does not look right. */
function warmSubjectMask(data, W, H) {
  const N = W * H;
  let mask = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const sat = (mx - mn) / (mx + 1e-6);
    const warm = r >= g && g >= b * .9 && r - b > 45 && r > 95 && sat > .22;
    const pale = r > 170 && g > 130 && r - b > 25 && r >= g;
    mask[i] = warm || pale ? 1 : 0;
  }
  const s = Math.min(W, H);
  const rc = Math.max(3, Math.round(s * .032)), ro = Math.max(2, Math.round(s * .02));
  mask = morph(morph(mask, W, H, rc, true), W, H, rc, false);
  let area;
  [mask, area] = largestBlob(mask, W, H);
  if (area < N * .03 || area > N * .7) return null;
  mask = fillHoles(mask, W, H);
  mask = morph(morph(mask, W, H, ro, false), W, H, ro, true);
  return mask;
}

/** Crop the masked subject into its own canvas with a softened edge. */
function cropMasked(img, ctx, data, mask, W, H) {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!mask[y * W + x]) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0 || x1 - x0 < W * .12 || y1 - y0 < H * .12) return null;
  const pad = 2;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
  x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  const out = document.createElement('canvas');
  out.width = cw; out.height = ch;
  const octx = out.getContext('2d');
  const od = octx.createImageData(cw, ch);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const sx = x + x0, sy = y + y0;
    // 3x3 box blur of the mask: a soft one-pixel edge
    let a = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = sx + dx, yy = sy + dy;
      if (xx >= 0 && yy >= 0 && xx < W && yy < H) a += mask[yy * W + xx];
    }
    const si = (sy * W + sx) * 4, di = (y * cw + x) * 4;
    od.data[di] = data[si]; od.data[di + 1] = data[si + 1]; od.data[di + 2] = data[si + 2];
    od.data[di + 3] = Math.round((a / 9) * (data[si + 3] / 255) * 255);
  }
  octx.putImageData(od, 0, 0);
  return out;
}

/** Fallback: the photo as a tiny polaroid on a stick. */
function polaroid(img) {
  const S = 128, B = 9, BOT = 24, STICK = 46;
  const out = document.createElement('canvas');
  out.width = S + B * 2; out.height = S + B + BOT + STICK;
  const c = out.getContext('2d');
  c.fillStyle = '#8a5a2b';
  c.fillRect(out.width / 2 - 3, S + B + BOT - 4, 6, STICK + 4);
  c.fillStyle = '#fbf8ef';
  c.fillRect(0, 0, out.width, S + B + BOT);
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  c.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, B, B, S, S);
  return out;
}

/** Build the billboard picture for an image element. */
export function makeHamsterCanvas(img) {
  const MAX = 480;
  const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
  const W = Math.max(1, Math.round(img.naturalWidth * scale));
  const H = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, W, H);
  let data;
  try { data = ctx.getImageData(0, 0, W, H).data; } catch { return { canvas: polaroid(img), sits: .06 }; }
  let clear = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 128) clear++;
  let mask;
  if (clear > W * H * .03) {
    mask = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) mask[i] = data[i * 4 + 3] >= 128 ? 1 : 0;
  } else {
    mask = warmSubjectMask(data, W, H);
  }
  const cut = mask && cropMasked(img, ctx, data, mask, W, H);
  return cut ? { canvas: cut, sits: .1 } : { canvas: polaroid(img), sits: .06 };
}

/**
 * The billboard mesh. `anchor` is the ground point it stands on; `size` its
 * world height. update() animates the hop/sway and returns the current hop
 * (0..1) so the contact shadow can shrink while it is in the air.
 */
export function createHamster(canvas, sits) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  const aspect = canvas.width / canvas.height;
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {
      uMap: { value: texture },
      uAnchor: { value: new THREE.Vector3() },
      uSize: { value: new THREE.Vector2(aspect, 1) },
      uSink: { value: sits },
      uHop: { value: 0 }, uTilt: { value: 0 }, uSquash: { value: 0 }, uFlip: { value: 1 },
    },
    vertexShader: /* glsl */`
      uniform vec3 uAnchor;
      uniform vec2 uSize;
      uniform float uSink, uHop, uTilt, uSquash, uFlip;
      varying vec2 vUv;
      void main() {
        vec4 mv = viewMatrix * vec4(uAnchor, 1.0);
        // base at the anchor, sunk a little into the grass; squash and stretch around the feet
        vec2 q = vec2(position.x * (1.0 - uSquash * .5), (position.y + .5) * (1.0 + uSquash) - uSink);
        float c = cos(uTilt), s = sin(uTilt);
        q = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
        mv.xy += q * uSize + vec2(0.0, uHop * uSize.y);
        vUv = vec2(.5 - position.x * uFlip, position.y + .5); // mirrored: it faces into the scene; uFlip turns it around
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uMap;
      varying vec2 vUv;
      void main() {
        vec4 t = texture2D(uMap, vUv);
        if (t.a < .02) discard;
        // the photo is dusky; lift it into the meadow's afternoon light
        vec3 col = pow(t.rgb, vec3(.86)) * 1.1 + vec3(.03, .025, 0.0);
        gl_FragColor = vec4(min(col, vec3(1.0)), t.a);
      }`,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  quad.frustumCulled = false;
  quad.renderOrder = 5;
  const u = material.uniforms;

  return {
    mesh: quad,
    aspect,
    sits,
    place(anchor, height) {
      u.uAnchor.value.copy(anchor);
      u.uSize.value.set(height * aspect, height);
    },
    /** Face left (-1) or right (1); eased so it turns rather than snaps. */
    face(dir) { this._face = dir; },
    /**
     * t: seconds, beat: phase that runs faster with music, level 0..1,
     * flare 0..1, walk 0..1 (moving), vibe 0..1 (music has been on a while).
     */
    update(t, beat, level, flare, walk = 0, vibe = 0) {
      const f = this._face ?? 1;
      u.uFlip.value += (f - u.uFlip.value) * .18;
      if (Math.abs(u.uFlip.value) < .08) u.uFlip.value = .08 * Math.sign(f);
      const bop = Math.pow(Math.abs(Math.sin(beat)), 1.6);
      const groove = level * (.6 + vibe * .8);
      // walking: quick little hops with a waddle
      const stepPh = t * 11;
      const stepHop = Math.abs(Math.sin(stepPh)) * .14 * walk;
      // standing and vibing: head-bang on the beat, sway on the bar
      const dance = 1 - walk;
      const hop = bop * groove * .2 * dance + stepHop
        + Math.sin(Math.min(flare, 1) * Math.PI) * .22 * (flare > 0 ? 1 : 0);
      u.uHop.value = hop + (.5 + .5 * Math.sin(t * 1.8)) * .025;
      u.uSquash.value = Math.sin(t * 2.1) * .025 + (bop - .5) * groove * .16 * dance - stepHop * .3;
      u.uTilt.value = Math.sin(t * 1.3) * .035
        + Math.sin(beat * .5) * groove * .22 * dance
        + Math.sin(stepPh) * .12 * walk;
      return hop;
    },
    dispose() {
      texture.dispose();
      quad.geometry.dispose();
      material.dispose();
      quad.removeFromParent();
    },
  };
}
