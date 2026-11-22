// Original glossy desktop icons, drawn as inline SVG (48×48 viewBox).
// icon(name, size) returns an SVG string; unknown names fall back to 'file'.
// Every gradient id is namespaced per call so icons can repeat on a page.

let seq = 0;

const DEFS = {
  // [gradient stops...] helpers used below
};

function lin(id, stops, x2 = 0, y2 = 1) {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops
    .map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`)
    .join('')}</linearGradient>`;
}

const ICONS = {
  home: (u) => `
    <defs>${lin(u + 'r', [[0, '#ff8a5c'], [1, '#c2361b']])}${lin(u + 'w', [[0, '#fffdf4'], [1, '#e4dcc4']])}</defs>
    <path d="M10 24h28v18H10z" fill="url(#${u}w)" stroke="#8a7a55" stroke-width="1.2"/>
    <path d="M5 25 24 8l19 17-3 3L24 14 8 28z" fill="url(#${u}r)" stroke="#7d200e" stroke-width="1.2" stroke-linejoin="round"/>
    <rect x="20" y="30" width="8" height="12" rx="1" fill="#6b4a2a"/>
    <rect x="31" y="28" width="6" height="6" fill="#7cc3ff" stroke="#3d6c94"/>`,
  user: (u) => `
    <defs>${lin(u + 's', [[0, '#7fc1ff'], [1, '#1d5fc4']])}${lin(u + 'f', [[0, '#ffe2c2'], [1, '#e9b78d']])}</defs>
    <rect x="6" y="6" width="36" height="28" rx="3" fill="#dfe8f3" stroke="#5b6f8a" stroke-width="1.2"/>
    <rect x="9" y="9" width="30" height="22" rx="1.5" fill="url(#${u}s)"/>
    <circle cx="24" cy="17" r="5" fill="url(#${u}f)"/>
    <path d="M14 31c1-6 5-8 10-8s9 2 10 8z" fill="#ffffff" opacity=".9"/>
    <path d="M18 34h12l2 6H16z" fill="#b9c5d3" stroke="#5b6f8a"/>
    <rect x="12" y="40" width="24" height="3" rx="1" fill="#8b9bb0"/>`,
  folder: (u) => `
    <defs>${lin(u + 'b', [[0, '#ffe58a'], [1, '#e8a91d']])}${lin(u + 'f', [[0, '#fff2b8'], [1, '#f2c044']])}</defs>
    <path d="M4 12a2 2 0 0 1 2-2h12l4 4h20a2 2 0 0 1 2 2v24a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" fill="url(#${u}b)" stroke="#a87410" stroke-width="1.2"/>
    <path d="M4 20h40v20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" fill="url(#${u}f)" stroke="#a87410" stroke-width="1.2"/>`,
  'folder-open': (u) => `
    <defs>${lin(u + 'b', [[0, '#ffe58a'], [1, '#e8a91d']])}${lin(u + 'f', [[0, '#fff6c9'], [1, '#f5c84d']])}</defs>
    <path d="M4 12a2 2 0 0 1 2-2h12l4 4h18a2 2 0 0 1 2 2v6H4z" fill="url(#${u}b)" stroke="#a87410" stroke-width="1.2"/>
    <rect x="9" y="15" width="26" height="14" fill="#fff" stroke="#9aa" />
    <path d="M2 22h40l-4 20H6z" fill="url(#${u}f)" stroke="#a87410" stroke-width="1.2" stroke-linejoin="round"/>`,
  pdf: (u) => `
    <defs>${lin(u + 'p', [[0, '#ffffff'], [1, '#e3e6ea']])}${lin(u + 'r', [[0, '#ff5a4f'], [1, '#b8160c']])}</defs>
    <path d="M10 4h20l10 10v30H10z" fill="url(#${u}p)" stroke="#7d8590" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M30 4v10h10" fill="#cfd5dc" stroke="#7d8590" stroke-width="1.2" stroke-linejoin="round"/>
    <rect x="6" y="24" width="26" height="12" rx="2" fill="url(#${u}r)"/>
    <text x="19" y="33" font-family="Tahoma,Verdana,sans-serif" font-size="8" font-weight="700" fill="#fff" text-anchor="middle">PDF</text>
    <path d="M15 40h20M15 16h12M15 20h18" stroke="#9aa3ad" stroke-width="1.4"/>`,
  mail: (u) => `
    <defs>${lin(u + 'm', [[0, '#ffffff'], [1, '#d9dde3']])}</defs>
    <rect x="5" y="11" width="38" height="27" rx="2" fill="url(#${u}m)" stroke="#6b7480" stroke-width="1.2"/>
    <path d="m6 13 18 14 18-14" fill="none" stroke="#6b7480" stroke-width="1.4"/>
    <path d="m6 37 13-12M42 37 29 25" stroke="#9aa3ad" stroke-width="1.2"/>
    <circle cx="38" cy="12" r="6" fill="#e5372b" stroke="#fff" stroke-width="1.5"/>`,
  terminal: (u) => `
    <defs>${lin(u + 't', [[0, '#4d5867'], [1, '#141920']])}</defs>
    <rect x="4" y="7" width="40" height="34" rx="3" fill="url(#${u}t)" stroke="#0b0e12" stroke-width="1.2"/>
    <rect x="4" y="7" width="40" height="7" rx="3" fill="#2f6fe0"/>
    <path d="m11 21 6 5-6 5" fill="none" stroke="#7dff8a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M20 33h12" stroke="#7dff8a" stroke-width="2.4" stroke-linecap="round"/>`,
  gamepad: (u) => `
    <defs>${lin(u + 'g', [[0, '#3c4f6a'], [1, '#121a26']])}${lin(u + 'b', [[0, '#66c0f4'], [1, '#1a6aa8']])}</defs>
    <path d="M14 15h20c6 0 9 5 10 12s-1 12-5 12-6-5-9-5H18c-3 0-5 5-9 5s-6-5-5-12 4-12 10-12z" fill="url(#${u}g)" stroke="#0a0f16" stroke-width="1.2"/>
    <path d="M12 22v8M8 26h8" stroke="#cfe6f7" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="33" cy="23" r="2.4" fill="url(#${u}b)"/><circle cx="38" cy="27" r="2.4" fill="#e85d5d"/>
    <circle cx="29" cy="27" r="2.4" fill="#7cd36c"/><circle cx="33" cy="31" r="2.4" fill="#f2c94c"/>`,
  music: (u) => `
    <defs>${lin(u + 'c', [[0, '#2b2f36'], [1, '#0d0f12']])}${lin(u + 'l', [[0, '#33e07a'], [1, '#0f9c47']])}</defs>
    <rect x="4" y="10" width="40" height="28" rx="3" fill="url(#${u}c)" stroke="#000" stroke-width="1.2"/>
    <rect x="8" y="14" width="32" height="12" rx="2" fill="url(#${u}l)"/>
    <circle cx="16" cy="20" r="3.5" fill="#0d0f12"/><circle cx="32" cy="20" r="3.5" fill="#0d0f12"/>
    <path d="M16 20h16" stroke="#0d0f12" stroke-width="1.5"/>
    <path d="M12 38l3-7h18l3 7" fill="#454b55"/>`,
  globe: (u) => `
    <defs><radialGradient id="${u}g" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#b9e4ff"/><stop offset=".6" stop-color="#2a8be0"/><stop offset="1" stop-color="#0b4f99"/></radialGradient></defs>
    <circle cx="24" cy="24" r="18" fill="url(#${u}g)" stroke="#0b3f7a" stroke-width="1.2"/>
    <path d="M14 14c4 2 4 6 8 6s2 6 6 7 0 7-3 9M30 9c-2 3 1 5 4 5s5 4 4 8" fill="none" stroke="#4fc24a" stroke-width="3.2" stroke-linecap="round"/>`,
  recycle: (u) => `
    <defs>${lin(u + 'b', [[0, '#f4f7fa'], [1, '#aab4c0']], 1, 0)}</defs>
    <path d="M12 14h24l-3 28H15z" fill="url(#${u}b)" stroke="#5d6875" stroke-width="1.2" stroke-linejoin="round"/>
    <rect x="9" y="9" width="30" height="5" rx="1.5" fill="#cfd6de" stroke="#5d6875" stroke-width="1.2"/>
    <path d="M19 19v19M24 19v19M29 19v19" stroke="#8792a0" stroke-width="1.4"/>`,
  'recycle-full': (u) => `
    <defs>${lin(u + 'b', [[0, '#f4f7fa'], [1, '#aab4c0']], 1, 0)}</defs>
    <path d="M14 8h10v8H14zM22 5h12v10H22z" fill="#fff" stroke="#8792a0"/>
    <path d="M12 14h24l-3 28H15z" fill="url(#${u}b)" stroke="#5d6875" stroke-width="1.2" stroke-linejoin="round"/>
    <rect x="9" y="11" width="30" height="5" rx="1.5" fill="#cfd6de" stroke="#5d6875" stroke-width="1.2"/>
    <path d="M19 21v17M24 21v17M29 21v17" stroke="#8792a0" stroke-width="1.4"/>`,
  file: (u) => `
    <defs>${lin(u + 'p', [[0, '#ffffff'], [1, '#e3e6ea']])}</defs>
    <path d="M11 4h18l9 9v31H11z" fill="url(#${u}p)" stroke="#7d8590" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M29 4v9h9" fill="#cfd5dc" stroke="#7d8590" stroke-width="1.2" stroke-linejoin="round"/>`,
  'file-code': (u) => `
    <defs>${lin(u + 'p', [[0, '#ffffff'], [1, '#e3e6ea']])}</defs>
    <path d="M11 4h18l9 9v31H11z" fill="url(#${u}p)" stroke="#7d8590" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M29 4v9h9" fill="#cfd5dc" stroke="#7d8590" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="m20 22-5 5 5 5M29 22l5 5-5 5" fill="none" stroke="#2f6fe0" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
  'file-text': (u) => `
    <defs>${lin(u + 'p', [[0, '#ffffff'], [1, '#e3e6ea']])}</defs>
    <path d="M11 4h18l9 9v31H11z" fill="url(#${u}p)" stroke="#7d8590" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M29 4v9h9" fill="#cfd5dc" stroke="#7d8590" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M16 20h16M16 25h16M16 30h16M16 35h10" stroke="#8a94a0" stroke-width="1.6"/>`,
  'file-image': (u) => `
    <defs>${lin(u + 'p', [[0, '#ffffff'], [1, '#e3e6ea']])}</defs>
    <path d="M11 4h18l9 9v31H11z" fill="url(#${u}p)" stroke="#7d8590" stroke-width="1.2" stroke-linejoin="round"/>
    <rect x="15" y="19" width="19" height="17" fill="#8fd0ff"/>
    <path d="m15 36 6-8 4 5 3-3 6 6z" fill="#49a83d"/><circle cx="29" cy="24" r="2.4" fill="#ffd34d"/>`,
  // generic "repository" glyph (a branch on a dark disc), not a vendor logo
  github: () => `
    <circle cx="24" cy="24" r="19" fill="#1b1f24"/>
    <path d="M18 17v14M31 20c0 7-13 4-13 11" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="18" cy="15" r="3.4" fill="#1b1f24" stroke="#fff" stroke-width="2.4"/>
    <circle cx="18" cy="33.5" r="3.4" fill="#1b1f24" stroke="#fff" stroke-width="2.4"/>
    <circle cx="31" cy="17" r="3.4" fill="#1b1f24" stroke="#fff" stroke-width="2.4"/>`,
  computer: (u) => `
    <defs>${lin(u + 's', [[0, '#6fd0ff'], [1, '#1f6fd0']])}</defs>
    <rect x="5" y="6" width="38" height="27" rx="2.5" fill="#e6ebf1" stroke="#5b6f8a" stroke-width="1.2"/>
    <rect x="8" y="9" width="32" height="21" fill="url(#${u}s)"/>
    <path d="M8 26c8-6 16 2 32-6v10H8z" fill="#55b947"/>
    <path d="M19 33h10l2 6H17z" fill="#b9c5d3" stroke="#5b6f8a"/><rect x="12" y="39" width="24" height="3" rx="1" fill="#8b9bb0"/>`,
  info: (u) => `
    <defs><radialGradient id="${u}i" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#9fd2ff"/><stop offset="1" stop-color="#1557c0"/></radialGradient></defs>
    <circle cx="24" cy="24" r="18" fill="url(#${u}i)" stroke="#0d3d8a" stroke-width="1.2"/>
    <circle cx="24" cy="15" r="2.6" fill="#fff"/><path d="M24 21v14" stroke="#fff" stroke-width="4.4" stroke-linecap="round"/>`,
  warning: (u) => `
    <defs>${lin(u + 'w', [[0, '#ffe066'], [1, '#e8a400']])}</defs>
    <path d="M24 6 44 40H4z" fill="url(#${u}w)" stroke="#8a6200" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M24 17v12" stroke="#222" stroke-width="4" stroke-linecap="round"/><circle cx="24" cy="34.5" r="2.4" fill="#222"/>`,
  power: (u) => `
    <defs>${lin(u + 'p', [[0, '#ff7b5f'], [1, '#c3260f']])}</defs>
    <rect x="5" y="5" width="38" height="38" rx="8" fill="url(#${u}p)" stroke="#7d1a0a" stroke-width="1.2"/>
    <path d="M17 16a11 11 0 1 0 14 0" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M24 11v13" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/>`,
  settings: (u) => `
    <defs>${lin(u + 'c', [[0, '#d8dee6'], [1, '#7f8b99']])}</defs>
    <path d="M21 4h6l1 5 4 2 4-3 4 4-3 4 2 4 5 1v6l-5 1-2 4 3 4-4 4-4-3-4 2-1 5h-6l-1-5-4-2-4 3-4-4 3-4-2-4-5-1v-6l5-1 2-4-3-4 4-4 4 3 4-2z" fill="url(#${u}c)" stroke="#4f5967" stroke-width="1.2" stroke-linejoin="round"/>
    <circle cx="24" cy="24" r="7" fill="#eef2f6" stroke="#4f5967" stroke-width="1.2"/>`,
  paint: (u) => `
    <defs>${lin(u + 'p', [[0, '#fff'], [1, '#e2dccb']])}</defs>
    <path d="M8 30c0-12 9-22 20-22 9 0 14 6 14 12 0 5-4 6-7 6-2 0-3 1-3 3s2 3 2 6-3 5-8 5C14 40 8 37 8 30z" fill="url(#${u}p)" stroke="#7a6d4f" stroke-width="1.2"/>
    <circle cx="18" cy="22" r="3" fill="#e5372b"/><circle cx="26" cy="16" r="3" fill="#2f6fe0"/><circle cx="35" cy="19" r="3" fill="#f2c94c"/><circle cx="16" cy="31" r="3" fill="#3cb043"/>`,
  star: (u) => `
    <defs>${lin(u + 's', [[0, '#fff1a6'], [1, '#f0a400']])}</defs>
    <path d="m24 5 5.6 12.4 13.4 1.4-10 9 2.9 13.2L24 34.3 12.1 41l2.9-13.2-10-9 13.4-1.4z" fill="url(#${u}s)" stroke="#9a6500" stroke-width="1.2" stroke-linejoin="round"/>`,
  hamster: (u) => `
    <circle cx="24" cy="26" r="15" fill="#e7b37a" stroke="#8a5a2b" stroke-width="1.2"/>
    <circle cx="13" cy="13" r="5" fill="#e7b37a" stroke="#8a5a2b"/><circle cx="35" cy="13" r="5" fill="#e7b37a" stroke="#8a5a2b"/>
    <path d="M9 22a15 15 0 0 1 30 0" fill="none" stroke="#222" stroke-width="3"/>
    <rect x="5" y="20" width="7" height="11" rx="3" fill="#2f6fe0"/><rect x="36" y="20" width="7" height="11" rx="3" fill="#2f6fe0"/>
    <circle cx="19" cy="25" r="2" fill="#222"/><circle cx="29" cy="25" r="2" fill="#222"/>
    <ellipse cx="24" cy="31" rx="7" ry="5" fill="#fbe3c6"/><circle cx="24" cy="29.5" r="1.4" fill="#c46a5a"/>`,
};

/**
 * @param {string} name icon key (see ICONS)
 * @param {number} [size=32] rendered size in CSS px
 * @returns {string} SVG markup
 */
export function icon(name, size = 32) {
  const draw = ICONS[name] || ICONS.file;
  const u = `ic${++seq}`;
  return `<svg class="icon" viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true" focusable="false">${draw(u)}</svg>`;
}

export const iconNames = Object.keys(ICONS);
void DEFS;
