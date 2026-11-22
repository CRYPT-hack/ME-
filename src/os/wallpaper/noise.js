// Small numeric helpers shared by the wallpaper modules: a seeded PRNG,
// lattice value noise / fbm and a hex -> display-colour helper.
import * as THREE from 'three';

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** GLSL-style smoothstep; works with e0 > e1 too. */
export const smooth = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

const mod = (a, n) => ((a % n) + n) % n;

/** mulberry32: small, fast, good enough for scattering grass. */
export function prng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer lattice hash in [0, 1). */
const hash = (x, y) => {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Value noise. With `period`, the lattice wraps so a texture tiles seamlessly. */
export function noise(x, y, period = 0) {
  let ix = Math.floor(x), iy = Math.floor(y);
  let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  let jx = ix + 1, jy = iy + 1;
  if (period) { ix = mod(ix, period); jx = mod(jx, period); iy = mod(iy, period); jy = mod(jy, period); }
  return (hash(ix, iy) * (1 - fx) + hash(jx, iy) * fx) * (1 - fy)
    + (hash(ix, jy) * (1 - fx) + hash(jx, jy) * fx) * fy;
}

export function fbm(x, y) {
  return noise(x, y) * .57 + noise(x * 2.07 + 3, y * 2.07) * .26
    + noise(x * 4.13, y * 4.13 + 7) * .12 + noise(x * 8.31, y * 8.31) * .05;
}

/**
 * A hex colour as display (sRGB-encoded) components in a Vector3. Every
 * wallpaper material is a ShaderMaterial that writes these straight to the
 * screen, so there is no colour management in between.
 */
export const srgb = (hex) => {
  const c = new THREE.Color();
  c.setStyle(hex, THREE.SRGBColorSpace);
  const out = new THREE.Vector3();
  const rgb = { r: 0, g: 0, b: 0 };
  c.getRGB(rgb, THREE.SRGBColorSpace);
  return out.set(rgb.r, rgb.g, rgb.b);
};
