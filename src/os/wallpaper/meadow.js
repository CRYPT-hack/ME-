// The procedural summer meadow behind the desktop: a deep blue sky with a
// sun and slowly turning rays, cumulus sprites drifting across it, a big
// rolling green hill with wind running through the grass and cloud shadows
// sliding over it, distant hazy hills and a few pollen motes.
//
// Everything is generated from noise at startup (no image files). Draw
// calls: sky, ground, grass blades (instanced), clouds (instanced), pollen.
// Every material is a ShaderMaterial that writes display (sRGB) colours
// directly, so there is no tone mapping or colour management in between.
//
// World layout: the eye sits at the origin looking down -z, tipped up a few
// degrees so the horizon lands about two thirds of the way down the screen.
// The valley floor is at y = -2.4; the near hill's crest is ~15 units away.
import * as THREE from 'three';
import { clamp01, smooth, noise, fbm, srgb } from './noise.js';

const SKY = {
  top: srgb('#1450c4'),
  mid: srgb('#3d86e4'),
  low: srgb('#86bdf0'),
  horizon: srgb('#d6e9f7'),
  halo: srgb('#fff5d8'),
  sun: srgb('#fffdf4'),
};
const CLOUD = { lit: srgb('#ffffff'), shade: srgb('#9fb3d4'), glow: srgb('#fff0c4') };
const GRASS = {
  deep: srgb('#3c9a26'),
  bright: srgb('#78c932'),
  yellow: srgb('#b5d140'),
  shade: srgb('#2c7a1c'),
  sheen: srgb('#2c3410'),
};
// key light for the ground: high, from the sun's side (right), a bit behind
const GROUND_LIGHT = new THREE.Vector3(.42, .86, -.3).normalize();
const Y0 = -2.4; // the valley floor in front of the hill
const GROUND = { x: 86, near: 1.5, far: 96, nx: 120, nz: 120 };

// ───────────────────────── terrain ─────────────────────────

/** Depth of the near hill's crest at x: it wanders a little. */
const crestQ = (x) => 15 + 2.2 * Math.sin(x * .09 + 1.2);
/** Height of the near hill's crest at x: high on the left, rolling down to the right. */
const crestH = (x) =>
  -.95 + 1.3 * Math.exp(-(((x + 4.5) / 7.5) ** 2))
  + .5 * Math.exp(-(((x - 10.5) / 4.6) ** 2))
  + .35 * Math.exp(-(((x + 19) / 6) ** 2));

/** Ground height at (x, z). */
export function meadowHeight(x, z) {
  const q = -z; // depth in front of the eye
  const cq = crestQ(x), ch = crestH(x);
  // the front face: a long smooth rise with a rounded top
  let h = Y0 + (ch - Y0) * smooth(.5, cq, q);
  // behind the crest it falls away into a hidden valley
  h -= (ch + 2.1) * smooth(cq, cq + 12, q);
  // distant rolling hills, lost in the haze before the far edge
  const far = smooth(24, 36, q);
  h += far * (fbm(x * .035 + 7.3, q * .045 + 1.1) * 2.3 - .75
    + 1.25 * Math.exp(-(((x - 17) / 12) ** 2) - (((q - 50) / 13) ** 2))
    + .8 * Math.exp(-(((x + 22) / 10) ** 2) - (((q - 44) / 10) ** 2)));
  // gentle swells so nothing is perfectly smooth
  h += (fbm(x * .15 + 2, z * .15 - 3) - .5) * .32 + (fbm(x * .42 - 5, z * .42 + 9) - .5) * .06;
  return h;
}

const _n = new THREE.Vector3();
function meadowNormal(x, z, out = _n) {
  const e = .06;
  const dx = meadowHeight(x + e, z) - meadowHeight(x - e, z);
  const dz = meadowHeight(x, z + e) - meadowHeight(x, z - e);
  return out.set(-dx, 2 * e, -dz).normalize();
}

/** Large-scale grass colour: two greens, yellow-green patches, deeper up close. */
function meadowColor(x, z, out) {
  const tone = smooth(.3, .74, fbm(x * .06 + 3.1, z * .085 - 5.2));
  out.copy(GRASS.deep).lerp(GRASS.bright, tone * .85);
  out.lerp(GRASS.yellow, smooth(.6, .74, fbm(x * .045 - 11, z * .06 + 4.4)) * .4);
  out.lerp(GRASS.shade, (1 - smooth(3, 9, -z)) * .55);
  return out;
}

/** Diffuse light the ground shader applies for a normal, minus cloud shade. */
const lightFor = (n) => .56 + .44 * Math.max(n.dot(GROUND_LIGHT), 0) + .06 * n.y;

// Shared GLSL: wind bands, cloud shadows, the hamster's contact shadow, haze.
const GROUND_COMMON = /* glsl */`
  uniform sampler2D uGrain;
  uniform vec3 uHaze, uSheen;
  uniform vec4 uHam;   // x, z, radius, strength
  uniform float uWindT, uCloudT, uLevel, uFlare;
  float windBand(vec2 p) {
    float w = texture2D(uGrain, p * vec2(.045, .07) + vec2(-uWindT * .021, uWindT * .004)).b * .65
      + texture2D(uGrain, p * vec2(.11, .16) + vec2(-uWindT * .047, .5)).b * .35;
    return smoothstep(.52, .86, w);
  }
  float cloudShade(vec2 p) {
    return smoothstep(.6, .84, texture2D(uGrain, p * .011 + vec2(-uCloudT * .0035, .27)).b);
  }
  float hamShadow(vec2 p) {
    vec2 s = (p - uHam.xy) / vec2(uHam.z, uHam.z * .62);
    float r = dot(s, s);
    return exp(-r * 2.6) * (1.0 - smoothstep(.6, 1.0, r)) * uHam.w;
  }
  float hazeAmount(float depth) {
    float haze = 1.0 - exp(-pow(max(depth - 16.0, 0.0) / 52.0, 2.0));
    return max(haze, smoothstep(78.0, 94.0, depth));
  }
`;

// ───────────────────────── sky ─────────────────────────

function createSky(shared) {
  const material = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: {
      uTime: shared.uTime, uSunDir: shared.uSunDir, uLevel: shared.uLevel, uFlare: shared.uFlare,
      uSunRight: { value: new THREE.Vector3(1, 0, 0) }, uSunUp: { value: new THREE.Vector3(0, 1, 0) },
      uInvProj: { value: new THREE.Matrix4() }, uCamRot: { value: new THREE.Matrix3() },
      uTop: { value: SKY.top }, uMid: { value: SKY.mid }, uLow: { value: SKY.low },
      uHorizon: { value: SKY.horizon }, uHalo: { value: SKY.halo }, uSun: { value: SKY.sun },
    },
    vertexShader: /* glsl */`
      uniform mat4 uInvProj;
      uniform mat3 uCamRot;
      varying vec3 vDir;
      void main() {
        // the world-space view ray through this corner of the screen
        vec4 v = uInvProj * vec4(position.xy, 1.0, 1.0);
        vDir = uCamRot * (v.xyz / v.w);
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uTop, uMid, uLow, uHorizon, uHalo, uSun, uSunDir, uSunRight, uSunUp;
      uniform float uTime, uLevel, uFlare;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        // about 26 degrees of sky are in view: the whole gradient fits there
        float t = clamp(d.y / .44, 0.0, 1.0);
        vec3 col = mix(uHorizon, uLow, smoothstep(0.0, .16, t));
        col = mix(col, uMid, smoothstep(.1, .5, t));
        col = mix(col, uTop, smoothstep(.42, 1.0, t));
        // the sun: a soft disc, a warm bloom and faint, slowly turning rays
        vec3 o = d - uSunDir;
        float a = length(o);
        float boost = 1.0 + uLevel * .45 + uFlare * 1.3;
        float glow = exp(-a * a * 700.0) * .55 + exp(-a * 11.0 / (1.0 + uFlare * .5)) * .3 + exp(-a * 3.2) * .1;
        float ang = atan(dot(o, uSunUp), dot(o, uSunRight) + 1e-5);
        float rays = .6 * sin(ang * 7.0 + uTime * .04) + .4 * sin(ang * 12.0 - uTime * .027 + 1.7);
        rays = smoothstep(-.1, 1.0, rays) * (.75 + .25 * sin(uTime * .5 + ang * 3.0));
        glow += rays * exp(-a * (4.0 - uLevel * 1.2)) * smoothstep(.02, .08, a) * (.12 + uLevel * .08 + uFlare * .16);
        col = mix(col, uHalo, clamp(glow * boost, 0.0, 1.0));
        float r = .0145 * (1.0 + uFlare * .22 + uLevel * .06);
        col = mix(col, uSun, 1.0 - smoothstep(r * .9, r * 1.12, a));
        col += uHalo * uFlare * .12 * exp(-a * 2.0);
        col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - .5) / 255.0;
        gl_FragColor = vec4(min(col, vec3(1.0)), 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -100;
  return mesh;
}

// ───────────────────────── ground ─────────────────────────

/** A tiling RGBA noise texture: R fine blades, G tufts, B soft noise (wind, cloud shade). */
function createGrainTexture(renderer) {
  const S = 256, data = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S;
    const blades = noise(u * 128, v * 128, 128) * .6 + noise(u * 64 + .5, v * 64, 64) * .4;
    const tufts = noise(u * 48, v * 48 + .5, 48) * .55 + noise(u * 24 + .5, v * 24 + .5, 24) * .45;
    const soft = noise(u * 4, v * 4, 4) * .55 + noise(u * 8 + .5, v * 8, 8) * .3 + noise(u * 16, v * 16 + .5, 16) * .15;
    const i = (y * S + x) * 4;
    data[i] = clamp01((blades - .5) * 2.1 + .5) * 255;
    data[i + 1] = clamp01((tufts - .5) * 1.9 + .5) * 255;
    data[i + 2] = clamp01((soft - .5) * 1.6 + .5) * 255;
    data[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, S, S);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy?.() || 1);
  texture.needsUpdate = true;
  return texture;
}

function createGround(shared, grain) {
  const { x: X, near, far, nx, nz } = GROUND;
  // PlaneGeometry only for its grid and winding; the vertices are placed
  // here, closest together around the near hill and sparse in the haze.
  const geometry = new THREE.PlaneGeometry(1, 1, nx, nz);
  geometry.rotateX(-Math.PI / 2);
  const p = geometry.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const color = new THREE.Vector3();
  for (let iz = 0; iz <= nz; iz++) {
    const w = 1 - iz / nz; // 1 at the far edge, 0 at the near edge
    const z = -(near + (far - near) * Math.pow(w, 1.8));
    for (let ix = 0; ix <= nx; ix++) {
      const s = (ix / nx) * 2 - 1;
      const x = X * (.32 * s + .68 * s * s * s);
      const i = iz * (nx + 1) + ix;
      p.setXYZ(i, x, meadowHeight(x, z), z);
      meadowColor(x, z, color);
      colors[i * 3] = color.x; colors[i * 3 + 1] = color.y; colors[i * 3 + 2] = color.z;
    }
  }
  p.needsUpdate = true;
  geometry.deleteAttribute('uv');
  geometry.setAttribute('aGrass', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: shared.uTime, uWindT: shared.uWindT, uCloudT: shared.uCloudT,
      uLevel: shared.uLevel, uFlare: shared.uFlare,
      uSunDir: shared.uSunDir, uHaze: shared.uHaze, uHam: shared.uHam,
      uGrain: { value: grain },
      uLight: { value: GROUND_LIGHT },
      uSheen: { value: GRASS.sheen },
    },
    vertexShader: /* glsl */`
      attribute vec3 aGrass;
      varying vec3 vWorld, vNormal, vGrass;
      varying float vDepth;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vec4 mv = viewMatrix * world;
        vWorld = world.xyz;
        vNormal = normal;
        vGrass = aGrass;
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      ${GROUND_COMMON}
      uniform vec3 uLight, uSunDir;
      varying vec3 vWorld, vNormal, vGrass;
      varying float vDepth;
      void main() {
        vec3 n = normalize(vNormal);
        vec2 p = vWorld.xz;
        // fine grain, stretched along the view so it reads as blades up close
        float blades = (texture2D(uGrain, p * vec2(2.1, .38)).r - .5) * .3
          + (texture2D(uGrain, p * vec2(6.3, 1.2) + vec2(.31, .67)).g - .5) * .22;
        // wind: broad bands of lifted, lighter blades moving left to right
        float wind = windBand(p) * (1.0 + uLevel * .9 + uFlare * .8);
        float cloud = cloudShade(p);
        float ndl = dot(n, uLight);
        float light = (.56 + .44 * max(ndl, 0.0) + .06 * n.y) * (1.0 - cloud * .13);
        vec3 col = vGrass * light * (1.0 + blades);
        col += uSheen * wind * (1.0 + blades * 2.0);
        // slopes seen against the sun glow at the edge
        vec3 v = normalize(cameraPosition - vWorld);
        col += vec3(.2, .19, .06) * pow(1.0 - max(dot(n, v), 0.0), 4.0) * max(dot(-v, uSunDir), 0.0);
        col *= 1.0 - hamShadow(p) * vec3(.6, .5, .56);
        gl_FragColor = vec4(mix(col, uHaze, hazeAmount(vDepth)), 1.0);
      }`,
  });
  return new THREE.Mesh(geometry, material);
}

// ───────────────────────── grass blades ─────────────────────────

/**
 * Thousands of single-triangle blades on the face of the near hill. They
 * are what visibly sways when music plays; the ground's sheen bands carry
 * the same wind further back.
 */
function createBlades(shared, grain, rand, count) {
  const aBlade = new Float32Array(count * 4); // base xyz, height
  const aShape = new Float32Array(count * 4); // width, lean, phase, tip tint
  const aColor = new Float32Array(count * 3);
  const color = new THREE.Vector3();
  let n = 0;
  for (let tries = 0; n < count && tries < count * 3; tries++) {
    const q = 2.6 + 19 * Math.pow(rand(), 1.35);
    const x = (rand() * 2 - 1) * q * 1.08;
    if (q > crestQ(x) + .7) continue; // hidden behind the crest
    const z = -q;
    const y = meadowHeight(x, z);
    const nrm = meadowNormal(x, z);
    const h = q * .0105 * (.6 + .8 * rand());
    aBlade.set([x, y - h * .08, z, h], n * 4);
    aShape.set([h * (.16 + rand() * .08), (rand() - .5) * .5, rand(), rand()], n * 4);
    meadowColor(x, z, color).multiplyScalar(lightFor(nrm) * (.86 + rand() * .22));
    aColor.set([color.x, color.y, color.z], n * 3);
    n++;
  }
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-.5, 0, 0, .5, 0, 0, 0, 1, 0]), 3));
  geometry.setAttribute('aBlade', new THREE.InstancedBufferAttribute(aBlade.subarray(0, n * 4), 4));
  geometry.setAttribute('aShape', new THREE.InstancedBufferAttribute(aShape.subarray(0, n * 4), 4));
  geometry.setAttribute('aColor', new THREE.InstancedBufferAttribute(aColor.subarray(0, n * 3), 3));
  geometry.instanceCount = n;

  const material = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uWindT: shared.uWindT, uCloudT: shared.uCloudT, uLevel: shared.uLevel, uFlare: shared.uFlare,
      uHaze: shared.uHaze, uHam: shared.uHam,
      uGrain: { value: grain }, uSheen: { value: GRASS.sheen },
      uTip: { value: srgb('#d9ec6a') },
    },
    vertexShader: /* glsl */`
      attribute vec4 aBlade, aShape;
      attribute vec3 aColor;
      uniform float uWindT, uLevel, uFlare;
      varying vec3 vColor, vWorld;
      varying float vTip, vDepth, vTint;
      void main() {
        vec3 base = aBlade.xyz;
        float h = aBlade.w, k = position.y;
        // a steady breeze, a flutter, and gust bands rolling left to right
        float sway = sin(uWindT * 1.7 + base.x * .55 + base.z * .35 + aShape.z * 6.2832) * .6
          + sin(uWindT * 3.1 + base.x * 1.3 + aShape.z * 3.0) * .25;
        float gust = smoothstep(.15, 1.0, sin(base.x * .23 - uWindT * 1.15 + base.z * .13));
        float amp = .16 + uLevel * .24 + uFlare * .3;
        float bend = (sway * amp + gust * (.3 + uLevel * .45 + uFlare * .55) + aShape.y) * k * k;
        vec3 p = base + vec3(position.x * aShape.x + bend * h, k * h * (1.0 - .3 * bend * bend), bend * h * .2);
        vec4 world = modelMatrix * vec4(p, 1.0);
        vec4 mv = viewMatrix * world;
        vWorld = world.xyz;
        vColor = aColor;
        vTip = k;
        vTint = aShape.w;
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      ${GROUND_COMMON}
      uniform vec3 uTip;
      varying vec3 vColor, vWorld;
      varying float vTip, vDepth, vTint;
      void main() {
        vec2 p = vWorld.xz;
        vec3 col = vColor * (.78 + .32 * vTip);
        col = mix(col, uTip * (.7 + .3 * vTint), vTip * vTip * (.18 + .22 * vTint));
        col += uSheen * windBand(p) * (1.2 + uLevel + uFlare) * vTip;
        col *= 1.0 - cloudShade(p) * .13;
        col *= 1.0 - hamShadow(p) * vec3(.6, .5, .56) * (1.0 - vTip * .6);
        gl_FragColor = vec4(mix(col, uHaze, hazeAmount(vDepth)), 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  return mesh;
}

// ───────────────────────── clouds ─────────────────────────

const ATLAS = { tw: 256, th: 128, cols: 3, rows: 2 };

/**
 * Six cumulus sprites in one atlas: R is the light (warm on top, shaded
 * underneath), G the density. Each is a row of round puffs on a flat base
 * with bigger puffs heaped over the middle, edges broken up with noise, lit
 * like balls from the sun's side (up and right).
 */
function createCloudAtlas(rand) {
  const { tw: TW, th: TH, cols, rows } = ATLAS;
  const W = TW * cols, H = TH * rows;
  const data = new Uint8Array(W * H * 4);
  const dens = new Float32Array(TW * TH);
  const lobe = new Float32Array(TW * TH);
  const at = (x, y) => (x < 0 || y < 0 || x >= TW || y >= TH ? 0 : dens[y * TW + x]);
  const LX = .45, LY = -.62, LZ = .64; // toward the sun: right, up, out of the page
  for (let tile = 0; tile < cols * rows; tile++) {
    const ox = (tile % cols) * TW, oy = Math.floor(tile / cols) * TH;
    const baseY = 100 + rand() * 10;
    const left = 28 + rand() * 18, right = TW - 28 - rand() * 18;
    const tall = .75 + rand() * .5;
    const puffs = [];
    const add = (x, r, lift) => {
      r = Math.max(Math.min(r, x - 4, TW - 4 - x), 6);
      puffs.push(x, Math.max(baseY - r * .6 - lift, r + 4), r);
    };
    const n = 7 + Math.floor(rand() * 4);
    for (let i = 0; i < n; i++) {
      const f = (i + .5 + (rand() - .5) * .5) / n;
      add(left + (right - left) * f, 13 + 14 * Math.sin(Math.PI * f) * (.7 + .3 * rand()), 0);
    }
    const m = 3 + Math.floor(rand() * 3);
    for (let j = 0; j < m; j++) {
      const f = .2 + .6 * (j + .5 + (rand() - .5) * .7) / m;
      const hump = Math.sin(Math.PI * f);
      add(left + (right - left) * f, (17 + 15 * rand()) * hump * tall, hump * tall * (18 + rand() * 20));
    }
    const sx = rand() * 40, sy = rand() * 40;
    for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
      let s = 0, lit = 0;
      for (let k = 0; k < puffs.length; k += 3) {
        const dx = (x - puffs[k]) / puffs[k + 2], dy = (y - puffs[k + 1]) / puffs[k + 2];
        const d2 = dx * dx + dy * dy;
        if (d2 >= 1) continue;
        const w = (1 - d2) * (1 - d2);
        s += w;
        lit += w * Math.max(dx * LX + dy * LY + Math.sqrt(1 - d2) * LZ, 0);
      }
      let d = 0;
      if (s > 0) {
        const edge = (noise(x * .06 + sx, y * .06 + sy) * .65 + noise(x * .15 + sy, y * .15 + sx) * .35 - .5) * .7;
        d = smooth(.2, .62, s + edge * Math.min(s * 3, 1)) * smooth(baseY + 4, baseY - 10, y);
      }
      dens[y * TW + x] = d;
      lobe[y * TW + x] = s > 0 ? lit / s : 0;
    }
    for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
      const d = dens[y * TW + x];
      let occ = 0; // cloud between this pixel and the sun (up and to the right)
      for (let k = 1; k <= 6; k++) occ += at(Math.round(x + k * 2), Math.round(y - k * 5));
      const height = smooth(baseY, baseY - 70, y);
      const light = clamp01(Math.exp(-occ * .5) * .42 + lobe[y * TW + x] * .36 + height * .24 + (1 - d) * .14);
      const i = ((oy + TH - 1 - y) * W + ox + x) * 4; // flipped: the cloud's top is up in UV
      data[i] = light * 255;
      data[i + 1] = d * 255;
      data[i + 2] = 0;
      data[i + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, W, H);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter; // no mips: tiles would bleed into each other
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function createClouds(shared, rand) {
  const COUNT = 12;
  const clouds = [];
  for (let i = 0; i < COUNT; i++) {
    // big, low banks near the horizon; smaller clouds higher up
    const big = i % 3 === 0;
    const distance = 30 + rand() * 40;
    const elevation = THREE.MathUtils.degToRad(big ? 2.2 + rand() * 4.5 : 6 + rand() * 15);
    clouds.push({
      phase: (i + rand() * .7) / COUNT,
      distance,
      elevation,
      width: big ? .28 + rand() * .12 : .12 + rand() * .12, // radians across
      tile: (big ? i / 3 : i + 2) % (ATLAS.cols * ATLAS.rows),
      speed: 1 / (160 + distance * 2.4 + rand() * 60), // loops per second
      haze: clamp01(.06 + .3 * (1 - smooth(.04, .16, elevation)) + .12 * smooth(35, 70, distance)),
    });
  }
  clouds.sort((a, b) => b.distance - a.distance); // back to front
  const aCloud = new Float32Array(COUNT * 4), aTile = new Float32Array(COUNT * 4);
  clouds.forEach((c, i) => {
    aCloud.set([c.phase, c.distance, c.elevation, c.width], i * 4);
    aTile.set([(c.tile % ATLAS.cols) / ATLAS.cols, Math.floor(c.tile / ATLAS.cols) / ATLAS.rows, c.speed, c.haze], i * 4);
  });
  const geometry = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(1, 1);
  geometry.index = quad.index;
  geometry.setAttribute('position', quad.attributes.position);
  geometry.setAttribute('aCloud', new THREE.InstancedBufferAttribute(aCloud, 4));
  geometry.setAttribute('aTile', new THREE.InstancedBufferAttribute(aTile, 4));
  geometry.instanceCount = COUNT;
  const atlas = createCloudAtlas(rand);
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {
      uCloudT: shared.uCloudT, uHaze: shared.uHaze,
      uAtlas: { value: atlas },
      uTanX: { value: .56 }, uSize: { value: 1 },
      uSunView: { value: new THREE.Vector3(0, 0, -1) },
      uLit: { value: CLOUD.lit }, uShade: { value: CLOUD.shade }, uGlow: { value: CLOUD.glow },
    },
    vertexShader: /* glsl */`
      attribute vec4 aCloud; // phase, distance, elevation (rad), width (rad)
      attribute vec4 aTile;  // atlas offset (xy), loops per second, haze
      uniform float uCloudT, uTanX, uSize;
      varying vec2 vUv;
      varying vec3 vView;
      varying float vHaze;
      void main() {
        float dist = aCloud.y;
        float width = dist * aCloud.w * uSize;
        float zc = cameraPosition.z - dist;
        // loop a little wider than the view, entering and leaving off-screen
        float span = dist * max(uTanX, .5) + width * .62;
        float x = (fract(aCloud.x + uCloudT * aTile.z) * 2.0 - 1.0) * span;
        vec4 mv = viewMatrix * vec4(x, cameraPosition.y + dist * tan(aCloud.z), zc, 1.0);
        mv.xy += position.xy * vec2(width, width * .5);
        vView = mv.xyz;
        vUv = aTile.xy + (position.xy + .5) * vec2(${(1 / ATLAS.cols).toFixed(6)}, ${(1 / ATLAS.rows).toFixed(6)});
        vHaze = aTile.w;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uAtlas;
      uniform vec3 uLit, uShade, uGlow, uHaze, uSunView;
      varying vec2 vUv;
      varying vec3 vView;
      varying float vHaze;
      void main() {
        vec4 t = texture2D(uAtlas, vUv);
        float a = t.g;
        if (a < .003) discard;
        vec3 col = mix(uShade, uLit, t.r);
        // a bright lining on the thin edges of a cloud passing near the sun
        float s = max(dot(normalize(vView), uSunView), 0.0);
        col += uGlow * (pow(s, 400.0) * 1.2 + pow(s, 40.0) * .25) * (1.15 - a);
        col = mix(col, uHaze, vHaze);
        gl_FragColor = vec4(min(col, vec3(1.0)), a);
      }`,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  quad.dispose(); // its buffers now belong to the instanced geometry
  return { mesh, atlas };
}

// ───────────────────────── pollen ─────────────────────────

function createPollen(shared, count, rand) {
  const positions = new Float32Array(count * 3), seeds = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const q = 3 + rand() * 13;
    positions.set([(rand() - .5) * 24, -2.3 + rand() * 2.6, -q], i * 3);
    seeds.set([rand(), rand(), rand(), rand()], i * 4);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {
      uTime: shared.uTime, uWindT: shared.uWindT,
      uViewScale: { value: 1000 }, uColor: { value: srgb('#fff4d2') },
    },
    vertexShader: /* glsl */`
      attribute vec4 aSeed;
      uniform float uTime, uWindT, uViewScale;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        // carried slowly left to right on the breeze, bobbing as they go
        p.x = mod(p.x + 12.0 + uWindT * (.1 + aSeed.x * .14), 24.0) - 12.0;
        p.y += sin(uTime * (.2 + aSeed.y * .25) + aSeed.z * 6.2832) * .3;
        p.z += cos(uTime * (.15 + aSeed.w * .2) + aSeed.x * 6.2832) * .25;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp((.012 + aSeed.y * .018) * uViewScale / max(-mv.z, .1), 1.0, 6.0);
        // now and then a mote turns and catches the sun
        float glint = pow(.5 + .5 * sin(uTime * (.5 + aSeed.w) + aSeed.z * 40.0), 8.0);
        vAlpha = (.18 + .6 * glint) * (1.0 - smoothstep(10.0, 12.0, abs(p.x)));
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float r = dot(p, p);
        if (r > 1.0) discard;
        gl_FragColor = vec4(uColor, (1.0 - r) * (1.0 - r) * vAlpha);
      }`,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 10;
  return points;
}

// ───────────────────────── meadow ─────────────────────────

export function createMeadow({ renderer, rand, blades = 7000, pollen = 140 }) {
  const group = new THREE.Group();
  const shared = {
    uTime: { value: 0 },    // real seconds (sun rays, pollen bob)
    uWindT: { value: 0 },   // wind phase: runs faster with the music
    uCloudT: { value: 0 },  // cloud phase: likewise
    uLevel: { value: 0 },   // smoothed music level 0..1
    uFlare: { value: 0 },   // pulse() envelope 0..1
    uSunDir: { value: new THREE.Vector3(.3, .3, -1).normalize() },
    uHaze: { value: SKY.horizon },
    uHam: { value: new THREE.Vector4(0, 0, 1, 0) },
  };
  const grain = createGrainTexture(renderer);
  const sky = createSky(shared);
  const ground = createGround(shared, grain);
  const grass = createBlades(shared, grain, rand, blades);
  const clouds = createClouds(shared, rand);
  const motes = createPollen(shared, pollen, rand);
  group.add(sky, ground, grass, clouds.mesh, motes);

  const up = new THREE.Vector3(0, 1, 0);
  const sunView = new THREE.Vector3();

  /** Call after the camera's projection/aspect/matrixWorld changed. */
  function layout(camera, heightPx) {
    const tanY = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const k = smooth(.6, 1.6, camera.aspect);
    // the sun sits upper right whatever the aspect, clear of the icons
    sunView.set((.5 + .1 * k) * tanY * camera.aspect, .6 * tanY, -1);
    const dir = shared.uSunDir.value.copy(sunView).transformDirection(camera.matrixWorld);
    const su = sky.material.uniforms;
    su.uSunRight.value.crossVectors(dir, up).normalize();
    su.uSunUp.value.crossVectors(su.uSunRight.value, dir);
    su.uInvProj.value.copy(camera.projectionMatrixInverse);
    su.uCamRot.value.setFromMatrix4(camera.matrixWorld);
    const cu = clouds.mesh.material.uniforms;
    cu.uTanX.value = tanY * camera.aspect;
    cu.uSize.value = THREE.MathUtils.clamp(Math.sqrt(camera.aspect / 1.78), .7, 1.15);
    cu.uSunView.value.copy(sunView).normalize();
    motes.material.uniforms.uViewScale.value = heightPx / (2 * tanY);
  }

  return {
    group,
    shared,
    heightAt: meadowHeight,
    layout,
    dispose() {
      grain.dispose();
      clouds.atlas.dispose();
      group.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
      group.removeFromParent();
    },
  };
}
