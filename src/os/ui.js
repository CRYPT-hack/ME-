// Small DOM helpers shared by the OS and every app.

/** Escape text for safe use inside HTML markup. */
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Create an element. `h('button.btn', {type:'button', onclick}, 'Label')`.
 * Selector supports tag, .classes and #id. Props starting with "on" become
 * listeners; `html` sets innerHTML; `dataset`/`style` objects are merged.
 */
export function h(selector, props = {}, ...children) {
  const m = selector.match(/^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i);
  const node = document.createElement((m && m[1]) || 'div');
  if (m && m[2]) {
    for (const part of m[2].match(/[.#][\w-]+/g)) {
      if (part[0] === '.') node.classList.add(part.slice(1));
      else node.id = part.slice(1);
    }
  }
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'html') node.innerHTML = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** True on narrow screens, where every window opens maximised. */
export const isMobile = () => window.matchMedia('(max-width: 720px)').matches;

/** Seeded PRNG (mulberry32) so procedural content is stable between visits. */
export function seeded(seed = 1) {
  let a = typeof seed === 'string' ? [...seed].reduce((s, c) => Math.imul(s ^ c.charCodeAt(0), 2654435761), 7) : seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Load an image URL into an HTMLImageElement (resolves when decoded). */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Format a time in the profile's timezone, e.g. "7:28 PM". */
export function clockText(timeZone, date = new Date()) {
  try {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone });
  } catch {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
}
