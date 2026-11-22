// Terminal: a small fake shell (crypt-sh) over the portfolio data.
// Every piece of output is built with textContent, so nothing a visitor types
// is ever parsed as HTML. Links are only made for URLs that come from
// profile.js / repos.js.
import './terminal.css';
import { h } from '../../os/ui.js';
import { socialLinks } from '../../data/profile.js';
import { stats } from '../../data/repos.js';

const HIST_KEY = 'cryptos.terminal.history';
const HIST_MAX = 50;
const USER = 'shobhit';
const HOST = 'crypt-os';
const MAX_LINES = 1200;

/** Text segment with a colour class (g green, a amber, b blue, r red, m magenta, d dim, w bright). */
const S = (t, c) => ({ t: String(t), c });
const pad = (s, n) => (s.length >= n ? s.slice(0, n - 1) + '…' : s + ' '.repeat(n - s.length));

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

function closest(word, list) {
  let best = null, bestD = Infinity;
  for (const c of list) {
    const d = levenshtein(word.toLowerCase(), c.toLowerCase());
    if (d < bestD) { best = c; bestD = d; }
  }
  const limit = word.length <= 3 ? 1 : word.length <= 6 ? 2 : 3;
  return bestD <= limit ? best : null;
}

function tokenize(line) {
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(line))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

function commonPrefix(list) {
  if (!list.length) return '';
  let p = list[0];
  for (const s of list) while (!s.toLowerCase().startsWith(p.toLowerCase())) p = p.slice(0, -1);
  return p;
}

function readHistory() {
  try {
    const v = JSON.parse(localStorage.getItem(HIST_KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(-HIST_MAX) : [];
  } catch { return []; }
}
function writeHistory(list) {
  try { localStorage.setItem(HIST_KEY, JSON.stringify(list.slice(-HIST_MAX))); } catch { /* private mode */ }
}

// An original hamster with headphones (the site's mascot).
const HAMSTER = [
  '      .-"""""""-.     ',
  '    .\'  ^     ^  \'.   ',
  '   [|  (o)   (o)  |]  ',
  '   [|     >w<     |]  ',
  '    \\   \'-...-\'   /   ',
  '     \'-.._____..-\'    ',
  '     (  )     (  )    ',
  '      ""       ""     ',
];

const TRAIN = [
  '                 _____   ______________   ______________   ',
  '       ___      | ___ |_|              |_|              |  ',
  '  ____|   |_____|| . ||_|   CRYPT OS   |_| node_modules |  ',
  ' [_____________|_|___|__|______________|_|______________|  ',
  '   (W)-(W)-(W)      (W)    (W)    (W)    (W)    (W)    (W) ',
];
const WHEEL = ['-', '\\', '|', '/'];
const SMOKE = ['  o  O   o   .  O', ' O   o  .  O   o ', '  .  O   o  .   O'];

export function mount(body, ctx) {
  const { os, win } = ctx;
  const profile = os.profile;
  const repos = os.repos;
  const reduced = os.reducedMotion;
  win.flush();

  // ── allowlisted links ───────────────────────────────────
  const allowed = new Set();
  for (const s of socialLinks()) allowed.add(s.href);
  for (const v of Object.values(profile.links)) if (v && /^https?:\/\//.test(v)) allowed.add(v);
  if (profile.steam.profileUrl) allowed.add(profile.steam.profileUrl);
  if (profile.spotify.profileUrl) allowed.add(profile.spotify.profileUrl);
  for (const r of repos) if (r.url) allowed.add(r.url);
  const L = (href, t) => ({ href, t: t ?? href.replace(/^mailto:/, '') });

  // ── DOM ────────────────────────────────────────────────
  const root = h('div.app-terminal');
  const screen = h('div.term__screen');
  const out = h('div.term__out', { role: 'log', 'aria-live': 'polite', 'aria-label': 'Terminal output' });
  const promptEl = h('span.term__prompt', { 'aria-hidden': 'true' });
  const preEl = h('span');
  const curEl = h('span.term__cur');
  const postEl = h('span');
  const mirror = h('span.term__mirror', { 'aria-hidden': 'true' }, preEl, curEl, postEl);
  const input = h('input.term__input', {
    type: 'text', autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off',
    spellcheck: 'false', enterkeyhint: 'go', 'aria-label': 'Terminal command',
  });
  const field = h('span.term__field', {}, mirror, input);
  const row = h('div.term__row', {}, promptEl, field);
  screen.append(out, row);

  const keyBtn = (label, aria, fn) => h('button.term__key', {
    type: 'button', 'aria-label': aria,
    onpointerdown: (e) => e.preventDefault(), // keep the keyboard open
    onclick: () => { fn(); input.focus({ preventScroll: true }); },
  }, label);
  const keys = h('div.term__keys', {},
    keyBtn('Tab', 'Complete', () => complete()),
    keyBtn('↑', 'Previous command', () => histStep(-1)),
    keyBtn('↓', 'Next command', () => histStep(1)),
    keyBtn('clear', 'Clear the screen', () => clear()),
    keyBtn('help', 'Run help', () => run('help')),
  );
  root.append(screen, keys);
  body.append(root);

  // ── state ──────────────────────────────────────────────
  let cwd = '';
  let history = readHistory();
  let hIdx = history.length;
  let draft = '';
  let busy = null; // { stop() } while an animation owns the screen
  let scrollRaf = 0;
  let typingTimer = 0;
  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };

  const path = () => (cwd ? `~/${cwd}` : '~');
  function renderPrompt() {
    promptEl.textContent = '';
    for (const p of promptParts()) promptEl.append(seg(p));
    win.setStatus(['crypt-sh', path(), `${history.length} in history`]);
  }
  function promptParts() {
    return [S(`${USER}@${HOST}`, 'g'), S(':', 'w'), S(path(), 'b'), S('$ ', 'w')];
  }

  // ── output ─────────────────────────────────────────────
  function seg(p) {
    if (p == null || p === false) return document.createTextNode('');
    if (typeof p === 'string' || typeof p === 'number') return document.createTextNode(String(p));
    if (p.href) {
      if (!allowed.has(p.href)) return h('span.tc-w', {}, p.t);
      return h('a.term__a', { href: p.href, target: p.href.startsWith('mailto:') ? null : '_blank', rel: 'noopener noreferrer' }, p.t);
    }
    return h(`span.tc-${p.c || 'w'}`, {}, p.t);
  }
  function lineNode(ln) {
    const parts = Array.isArray(ln) ? ln : ln.parts;
    const el = h('div.term__l');
    if (!Array.isArray(ln) && ln.nowrap) el.classList.add('is-nowrap');
    if (!parts.length) el.append(' ');
    for (const p of parts) el.append(seg(p));
    return el;
  }
  /** Append lines. Each line is an array of parts (string | S() | L()), or a plain string. */
  function emit(lines) {
    const frag = document.createDocumentFragment();
    lines.forEach((ln, i) => {
      const el = lineNode(typeof ln === 'string' ? [ln] : ln);
      if (!reduced) {
        el.classList.add('is-in');
        el.style.animationDelay = `${Math.min(i, 40) * 11}ms`;
      }
      frag.append(el);
    });
    out.append(frag);
    while (out.childElementCount > MAX_LINES) out.firstElementChild.remove();
    scrollDown();
  }
  const say = (...parts) => emit([parts]);
  function scrollDown() {
    cancelAnimationFrame(scrollRaf);
    scrollRaf = requestAnimationFrame(() => { screen.scrollTop = screen.scrollHeight; });
  }
  function clear() { out.textContent = ''; scrollDown(); }

  // ── input mirror (block cursor) ────────────────────────
  function syncMirror() {
    const v = input.value;
    const pos = input.selectionEnd ?? v.length;
    preEl.textContent = v.slice(0, pos);
    curEl.textContent = v[pos] ?? ' ';
    postEl.textContent = v.slice(pos + 1);
  }
  function typing() {
    root.classList.add('is-typing');
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => root.classList.remove('is-typing'), 480);
  }
  const onSel = () => { if (document.activeElement === input) syncMirror(); };
  document.addEventListener('selectionchange', onSel);

  // ── filesystem model ───────────────────────────────────
  const ROOT_FILES = ['README.md', 'skills.txt', 'contact.txt'];
  const DIRS = {
    projects: () => repos.map((r) => `${r.slug}.md`),
    featured: () => repos.filter((r) => r.featured).map((r) => `${r.slug}.md`),
    private: () => repos.filter((r) => r.private).map((r) => `${r.slug}.md`),
    apps: () => os.apps.map((a) => `${a.id}.app`),
  };
  const entries = (dir) => (dir ? DIRS[dir]() : [...Object.keys(DIRS).map((d) => `${d}/`), ...ROOT_FILES]);

  /** Resolve a directory path to '' (home), a dir name, or null. */
  function resolveDir(p = '') {
    let parts = cwd ? [cwd] : [];
    let rest = p.trim();
    if (rest === '/' || rest.startsWith('~') || rest.startsWith('/')) { parts = []; rest = rest.replace(/^~\/?|^\/+/, ''); }
    for (const s of rest.split('/')) {
      if (!s || s === '.') continue;
      if (s === '..') parts.pop();
      else parts.push(s);
    }
    if (!parts.length) return '';
    if (parts.length === 1 && DIRS[parts[0]]) return parts[0];
    return null;
  }
  /** Resolve a file path to { dir, name } or null. */
  function resolveFile(p) {
    const i = p.lastIndexOf('/');
    const dirPart = i >= 0 ? p.slice(0, i) || '/' : '';
    let name = i >= 0 ? p.slice(i + 1) : p;
    const dir = dirPart ? resolveDir(dirPart) : cwd;
    if (dir == null || !name) return null;
    const list = entries(dir);
    if (!list.includes(name) && list.includes(`${name}.md`)) name = `${name}.md`;
    if (!list.includes(name) && list.includes(`${name}.app`)) name = `${name}.app`;
    return list.includes(name) ? { dir, name } : null;
  }
  const repoBySlug = (s) => repos.find((r) => r.slug === s);

  // ── commands ───────────────────────────────────────────
  const appIds = () => os.apps.map((a) => a.id);

  const COMMANDS = {
    help: { desc: 'list commands (help <command> for one)', args: () => Object.keys(COMMANDS), run: cmdHelp },
    whoami: { desc: 'who is behind this', run: () => emit([
      [S(USER, 'g')],
      [`${profile.name} (${profile.handle}), ${profile.role.toLowerCase()} in ${profile.location}.`],
    ]) },
    about: { desc: 'the short story', run: cmdAbout },
    ls: { desc: 'list a directory: ls [projects|featured|private|apps] [-l]', args: 'dirs', run: cmdLs },
    cd: { desc: 'change directory', args: 'dirs', run: cmdCd },
    pwd: { desc: 'print the current directory', run: () => say(`/home/${USER}${cwd ? '/' + cwd : ''}`) },
    cat: { desc: 'print a file: cat README.md, cat <project>.md', args: 'files', run: cmdCat },
    open: { desc: 'open an app: open explorer', args: appIds, run: cmdOpen },
    projects: { desc: 'every repository in a table', run: cmdProjects },
    skills: { desc: 'what I work with', run: cmdSkills },
    socials: { desc: 'where to find me', run: cmdSocials },
    steam: { desc: 'what I play', run: cmdSteam },
    spotify: { desc: 'what I listen to', run: cmdSpotify },
    neofetch: { desc: 'system info, hamster included', run: cmdNeofetch },
    date: { desc: 'the time here and for me', run: cmdDate },
    echo: { desc: 'print some text', run: (_a, rest) => say(rest.replace(/\$USER\b/g, USER).replace(/\$SHELL\b/g, 'crypt-sh')) },
    history: { desc: 'commands you have typed (history -c clears)', run: cmdHistory },
    clear: { desc: 'clear the screen (Ctrl+L)', run: clear },
    sudo: { desc: 'try it', args: () => Object.keys(COMMANDS), run: cmdSudo },
    hire: { desc: 'the pitch, then the contact form', run: cmdHire },
    matrix: { desc: 'green rain (any key stops it)', run: cmdMatrix },
    sl: { desc: 'you meant ls. Here is a train', run: cmdTrain },
    train: { desc: 'same train', run: cmdTrain, hidden: true },
    exit: { desc: 'close the terminal', run: () => { say(S('logout', 'd')); later(() => win.close(), 260); } },
  };
  const ALIASES = { '?': 'help', man: 'help', dir: 'ls', cls: 'clear', type: 'cat', quit: 'exit', logout: 'exit', ll: 'ls' };
  const visibleCommands = () => Object.keys(COMMANDS).filter((k) => !COMMANDS[k].hidden);

  function cmdHelp(args) {
    if (args[0]) {
      const name = ALIASES[args[0]] || args[0];
      const c = COMMANDS[name];
      if (!c) return say(S(`help: no such command: ${args[0]}`, 'r'));
      return say(S(name, 'g'), '  ', c.desc);
    }
    const names = visibleCommands();
    const w = Math.max(...names.map((n) => n.length)) + 3;
    emit([
      [S('crypt-sh', 'a'), ', the CRYPT OS shell. Commands:'],
      [],
      ...names.map((n) => ({ parts: ['  ', S(pad(n, w), 'g'), S(COMMANDS[n].desc, 'w')] })),
      [],
      [S('Tab', 'a'), ' completes, ', S('↑ ↓', 'a'), ' walk history, ', S('Ctrl+L', 'a'), ' clears.'],
    ]);
  }

  function cmdAbout() {
    const exp = profile.experience[0];
    emit([
      [S(profile.name, 'a'), S(` · ${profile.role} · ${profile.location}`, 'd')],
      [],
      [profile.tagline],
      exp ? [S(`${exp.role}, ${exp.org} (${exp.years}): `, 'b'), exp.text] : [],
      [S('Into: ', 'b'), profile.interests.join(', ')],
      [S('Status: ', 'b'), S(profile.availability, 'g')],
      [],
      [S('The long version: ', 'd'), S('open about', 'g')],
    ]);
  }

  function cmdLs(args) {
    const long = args.some((a) => /^-\w*l/.test(a)) || false;
    const target = args.find((a) => !a.startsWith('-'));
    let dir = cwd;
    if (target != null) {
      dir = resolveDir(target);
      if (dir == null) {
        const f = resolveFile(target);
        if (f) return say(f.name);
        return say(S(`ls: cannot access '${target}': No such file or directory`, 'r'));
      }
    }
    const list = entries(dir);
    if (!dir) {
      if (long) {
        return emit(list.map((n) => n.endsWith('/')
          ? { parts: [S('drwxr-xr-x  ', 'd'), S(n, 'b')], nowrap: true }
          : { parts: [S('-rw-r--r--  ', 'd'), n], nowrap: true }));
      }
      const parts = [];
      list.forEach((n, i) => { if (i) parts.push('   '); parts.push(n.endsWith('/') ? S(n, 'b') : n); });
      return emit([parts]);
    }
    if (dir === 'apps') {
      if (long) return emit(os.apps.map((a) => ({ parts: [S('-rwxr-xr-x  ', 'd'), S(pad(`${a.id}.app`, 14), 'a'), S(a.blurb || a.title, 'd')], nowrap: true })));
      const parts = [];
      list.forEach((n, i) => { if (i) parts.push('   '); parts.push(S(n, 'a')); });
      return emit([parts, [S("Run one with: open <name>", 'd')]]);
    }
    const rs = list.map((n) => repoBySlug(n.replace(/\.md$/, ''))).filter(Boolean);
    if (long) {
      return emit(rs.map((r) => ({
        parts: [S(r.private ? '-rw-------  ' : '-rw-r--r--  ', 'd'), S(r.updated + '  ', 'd'),
          S(pad(r.private ? 'private' : 'public', 9), r.private ? 'm' : 'g'), `${r.slug}.md`],
        nowrap: true,
      })));
    }
    const parts = [];
    rs.forEach((r, i) => { if (i) parts.push('   '); parts.push(S(`${r.slug}.md`, r.private ? 'm' : 'w')); });
    emit([parts, [S(`${rs.length} files. Read one with: cat <name>.md`, 'd')]]);
  }

  function cmdCd(args) {
    const target = args[0] ?? '~';
    const dir = resolveDir(target);
    if (dir == null) {
      if (resolveFile(target)) return say(S(`cd: not a directory: ${target}`, 'r'));
      const guess = closest(target.replace(/\/$/, ''), Object.keys(DIRS));
      return say(S(`cd: no such directory: ${target}`, 'r'), guess ? S(`  (did you mean ${guess}?)`, 'd') : '');
    }
    cwd = dir;
    renderPrompt();
  }

  function catRepo(r) {
    const lines = [
      [S(`# ${r.title}`, 'a')],
      [S(`> ${r.tagline}`, 'd')],
      [],
      [r.description],
      [],
      [S('Languages: ', 'b'), r.languages.join(', ')],
      [S('Updated:   ', 'b'), r.updated],
    ];
    if (r.facts?.length) {
      lines.push([S('Facts:', 'b')]);
      for (const f of r.facts) lines.push(['  - ', f]);
    }
    lines.push([]);
    lines.push(r.url ? [S('Repo: ', 'b'), L(r.url)] : [S('Repo: ', 'b'), S('Private repository', 'm')]);
    emit(lines);
  }

  function cmdCat(args) {
    if (!args.length) return say(S('usage: cat <file>   (try: cat README.md)', 'd'));
    for (const arg of args) {
      let f = resolveFile(arg);
      if (!f) {
        // be forgiving: a project slug works from anywhere
        const r = repoBySlug(arg.replace(/^.*\//, '').replace(/\.md$/, ''));
        if (r) { catRepo(r); continue; }
        if (resolveDir(arg) != null) { say(S(`cat: ${arg}: Is a directory`, 'r')); continue; }
        if (ROOT_FILES.includes(arg)) { say(S(`cat: ${arg}: not here. It lives in ~ (cd ~)`, 'r')); continue; }
        say(S(`cat: ${arg}: No such file or directory`, 'r'));
        continue;
      }
      if (f.name.endsWith('.app')) {
        const id = f.name.replace(/\.app$/, '');
        say(S(`cat: ${f.name}: binary file. Run it with: open ${id}`, 'd'));
        continue;
      }
      if (f.name === 'README.md') {
        emit([
          [S('# CRYPT OS', 'a')],
          [],
          [`Hi, I'm ${profile.firstName} (${profile.handle}). ${profile.tagline}`],
          ['This whole site is a tiny operating system. Some things to try:'],
          [],
          ...[
            ['ls projects', 'every repository, as a file'],
            ['cat bob-the-builder.md', 'read about one'],
            ['open explorer', 'the same, with more drama'],
            ['neofetch', 'system info, hamster included'],
            ['hire', 'the short pitch'],
          ].map(([c, d]) => ({ parts: ['  ', S(pad(c, 24), 'g'), S(d, 'd')] })),
        ]);
      } else if (f.name === 'skills.txt') {
        cmdSkills();
      } else if (f.name === 'contact.txt') {
        cmdSocials();
        say(S('Or write to me here: ', 'd'), S('open contact', 'g'));
      } else {
        const r = repoBySlug(f.name.replace(/\.md$/, ''));
        if (r) catRepo(r);
      }
    }
  }

  function cmdOpen(args) {
    const id = (args[0] || '').toLowerCase().replace(/\.app$/, '');
    if (!id) {
      const w = Math.max(...appIds().map((a) => a.length)) + 3;
      return emit([
        [S('usage: open <app>', 'd')],
        ...os.apps.map((a) => ({ parts: ['  ', S(pad(a.id, w), 'a'), a.title] })),
      ]);
    }
    const meta = os.apps.find((a) => a.id === id);
    if (!meta) {
      const guess = closest(id, appIds());
      return say(S(`open: no app called '${id}'`, 'r'), guess ? S(`  (did you mean ${guess}?)`, 'd') : '');
    }
    if (id === 'terminal') return say(S("You're already in it.", 'd'));
    say(S(`Opening ${meta.title}…`, 'd'));
    os.open(id);
  }

  function cmdProjects() {
    const tw = Math.min(28, Math.max(...repos.map((r) => r.title.length)) + 2);
    const lw = 13;
    const lines = [
      { parts: [S(pad('TITLE', tw), 'a'), S(pad('LANGUAGE', lw), 'a'), S('VISIBILITY', 'a')], nowrap: true },
      { parts: [S('─'.repeat(tw + lw + 10), 'd')], nowrap: true },
    ];
    for (const r of repos) {
      const title = pad(r.title, tw);
      const t = title.trimEnd();
      lines.push({
        parts: [r.url ? L(r.url, t) : S(t, 'w'), ' '.repeat(title.length - t.length),
          S(pad(r.languages[0] || '?', lw), 'b'),
          r.private ? S('private', 'm') : S('public', 'g')],
        nowrap: true,
      });
    }
    lines.push([]);
    lines.push([S(`${stats.total} repositories, ${stats.public} public. `, 'd'), S('cat <slug>.md', 'g'), S(' for details, ', 'd'), S('ls projects', 'g'), S(' for slugs.', 'd')]);
    emit(lines);
  }

  function cmdSkills() {
    const names = { languages: 'Languages', web: 'Web & 3D', ai: 'AI', tools: 'Tools' };
    const lines = [];
    for (const [k, list] of Object.entries(profile.skills)) {
      const parts = [S(pad(names[k] || k, 11), 'a')];
      list.forEach((s, i) => { if (i) parts.push(S(' · ', 'd')); parts.push(S(s, 'g')); });
      lines.push(parts);
    }
    emit(lines);
  }

  function cmdSocials() {
    const links = socialLinks();
    const lines = links.map((s) => ['  ', S(pad(s.label, 11), 'a'), L(s.href)]);
    if (profile.links.discord) lines.push(['  ', S(pad('Discord', 11), 'a'), S(profile.links.discord, 'w')]);
    if (!lines.length) lines.push([S('Nothing linked yet.', 'd')]);
    emit([[S('Find me here:', 'b')], ...lines]);
  }

  function cmdSteam() {
    const st = profile.steam;
    const lines = [[S('Steam', 'a'), S(` · ${st.personaName}`, 'd')]];
    lines.push(st.profileUrl ? [S('Profile: ', 'b'), L(st.profileUrl)] : [S('Profile: not linked yet', 'd')]);
    lines.push([]);
    for (const g of st.favorites) {
      lines.push(['  ', S(g.title, 'g'), g.hours ? S(`  ${g.hours} h`, 'b') : '', S(`  ${g.note}`, 'd')]);
    }
    lines.push([]);
    lines.push([S('The shelf, with art: ', 'd'), S('open steam', 'g')]);
    emit(lines);
  }

  function cmdSpotify() {
    const sp = profile.spotify;
    const lines = [[S('On repeat', 'a')]];
    for (const t of sp.onRepeat) lines.push(['  ♪ ', S(t.title, 'g'), S(`  ${t.artist}`, 'd')]);
    lines.push([]);
    lines.push(sp.profileUrl ? [S('Profile: ', 'b'), L(sp.profileUrl)] : [S('Spotify profile: not linked yet', 'd')]);
    lines.push([S('The player: ', 'd'), S('open music', 'g')]);
    emit(lines);
  }

  function charsPerLine() {
    const probe = h('span.term__probe', {}, 'MMMMMMMMMM');
    out.append(probe);
    const cw = probe.getBoundingClientRect().width / 10 || 8;
    probe.remove();
    return Math.floor((screen.clientWidth - 24) / cw);
  }

  function cmdNeofetch() {
    const days = Math.max(0, Math.floor((Date.now() - Date.parse(profile.since)) / 864e5));
    const counts = {};
    for (const r of repos) { const l = r.languages[0]; if (l) counts[l] = (counts[l] || 0) + 1; }
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([l, n]) => `${l} (${n})`).join(', ');
    const title = `${USER}@${HOST}`;
    const kv = (k, v, c = 'w') => [S(`${k}: `, 'a'), S(v, c)];
    const info = [
      [S(USER, 'g'), S('@', 'w'), S(HOST, 'g')],
      [S('─'.repeat(title.length), 'd')],
      kv('OS', 'CRYPT OS (browser edition)'),
      kv('Host', `${profile.name} (${profile.handle})`),
      kv('Role', profile.role),
      kv('Location', `${profile.location} · ${profile.timezone}`),
      kv('Uptime', `${days} days since the first commit`),
      kv('Repos', `${stats.total} (${stats.public} public, ${stats.total - stats.public} private)`),
      kv('Top langs', top),
      kv('Shell', 'crypt-sh 1.0'),
      kv('Resolution', `${window.innerWidth}x${window.innerHeight}`),
      kv('Status', profile.availability, 'g'),
      [],
      [1, 2, 3, 4, 5, 6, 7, 8].map((i) => S('   ', `k${i}`)),
    ];
    const art = HAMSTER.map((l) => l.split(/(\[\||\|\]|\(o\)|>w<)/).filter(Boolean).map((p) =>
      (p === '[|' || p === '|]') ? S(p, 'b') : p === '(o)' ? S(p, 'w') : p === '>w<' ? S(p, 'r') : S(p, 'a')));
    const artW = HAMSTER[0].length;
    if (charsPerLine() < artW + 46) {
      emit([...art.map((p) => ({ parts: p, nowrap: true })), [], ...info]);
      return;
    }
    const n = Math.max(art.length, info.length);
    const lines = [];
    for (let i = 0; i < n; i++) {
      const a = art[i] || [S(' '.repeat(artW), 'a')];
      lines.push({ parts: [...a, '  ', ...(info[i] || [])], nowrap: true });
    }
    emit(lines);
  }

  function cmdDate() {
    const fmt = (tz) => {
      try {
        return new Date().toLocaleString('en-US', { timeZone: tz, weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' });
      } catch { return new Date().toString(); }
    };
    emit([
      [S(pad('You', 8), 'a'), fmt(undefined)],
      [S(pad('Me', 8), 'a'), fmt(profile.timezone), S(`  (${profile.location})`, 'd')],
    ]);
  }

  function cmdHistory(args) {
    if (args[0] === '-c') {
      history = []; hIdx = 0; writeHistory(history); renderPrompt();
      return say(S('History cleared.', 'd'));
    }
    if (!history.length) return say(S('Nothing yet.', 'd'));
    const w = String(history.length).length + 2;
    emit(history.map((c, i) => [S(String(i + 1).padStart(w), 'd'), '  ', c]));
  }

  function cmdSudo(args, rest) {
    if (!args.length) return say(S('usage: sudo <command>. Results not guaranteed.', 'd'));
    if (/rm\s+-\w*r\w*f|rm\s+-\w*f\w*r/.test(rest)) {
      emit([
        [S('Nice try.', 'r')],
        ['Everything I delete already ends up in the Recycle Bin. Have a look: ', S('open recycle', 'g')],
      ]);
      return;
    }
    if (args[0] === 'hire') { say(S('No sudo needed for that. Gladly.', 'g')); cmdHire(); return; }
    const lines = [
      `${USER} is not in the sudoers file. This incident will be reported to the hamster.`,
      'Permission denied. You need root, and all I have is a hamster.',
      'sudo: 3 incorrect password attempts. (You typed none. Impressive.)',
      'Request forwarded to the admin. The admin is also me. Request denied.',
      `Root access is reserved for people who have read all ${stats.total} READMEs.`,
    ];
    say(S(lines[Math.floor(Math.random() * lines.length)], 'r'));
  }

  function cmdHire() {
    const gh = profile.links.github;
    emit([
      [S('The short version', 'a')],
      ['  - ', `${profile.role} in ${profile.location} (${profile.timezone}). `, S(profile.availability + '.', 'g')],
      ['  - ', `${stats.total} repositories since ${new Date(profile.since).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}: 3D visualisation, computer vision, agent tooling.`],
      ['  - ', `I work in ${profile.skills.languages.slice(0, 3).join(', ')} and ship things you can click.`],
      gh ? ['  - ', 'Code: ', L(gh)] : [],
      [],
      [S('Opening Contact…', 'd')],
    ]);
    later(() => os.open('contact', { subject: 'Internship / job' }), reduced ? 100 : 900);
  }

  // ── matrix rain ────────────────────────────────────────
  function cmdMatrix() {
    if (reduced) {
      say(S('Reduced motion is on, so the rain stays in your imagination. It is very green.', 'g'));
      return;
    }
    say(S('Entering the matrix. Press any key to leave.', 'g'));
    const cvs = h('canvas.term__fx', { 'aria-hidden': 'true' });
    root.append(cvs);
    const g = cvs.getContext('2d');
    const glyphs = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789CRYPT<>{}$#*+=';
    const fs = 15;
    let W = 0, H = 0, cols = [], raf = 0, last = performance.now();
    const t0 = last;
    const pick = () => glyphs[(Math.random() * glyphs.length) | 0];
    function size() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = root.clientWidth; H = root.clientHeight;
      cvs.width = Math.max(1, W * dpr); cvs.height = Math.max(1, H * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = '#030805'; g.fillRect(0, 0, W, H);
      const n = Math.ceil(W / fs);
      cols = Array.from({ length: n }, () => ({ y: -Math.random() * (H / fs) * 1.2, cell: -1, v: 0.18 + Math.random() * 0.32, ch: pick() }));
    }
    size();
    function frame(now) {
      const dt = Math.min(64, now - last); last = now;
      g.fillStyle = `rgba(3, 8, 5, ${1 - Math.pow(0.93, dt / 16.7)})`;
      g.fillRect(0, 0, W, H);
      g.font = `${fs}px "JetBrains Mono", ui-monospace, monospace`;
      g.textBaseline = 'top';
      for (let i = 0; i < cols.length; i++) {
        const c = cols[i];
        c.y += c.v * dt / 16.7;
        const cell = Math.floor(c.y);
        if (cell !== c.cell) {
          // repaint the old head in green, draw the new head bright
          if (c.cell >= 0) {
            g.fillStyle = '#030805'; g.fillRect(i * fs, c.cell * fs, fs, fs);
            g.fillStyle = '#3fdc5a'; g.fillText(c.ch, i * fs, c.cell * fs);
          }
          c.cell = cell;
          c.ch = pick();
          if (cell >= 0) { g.fillStyle = '#e6ffe9'; g.fillText(c.ch, i * fs, cell * fs); }
          if (cell * fs > H && Math.random() > 0.9) { c.y = -Math.random() * 8; c.cell = -1; c.v = 0.18 + Math.random() * 0.32; }
        }
      }
      if (now - t0 > 12000) { stop(false); return; }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    function stop(teardown) {
      cancelAnimationFrame(raf);
      if (teardown === true) { busy = null; return; } // window closing: no focus, no output
      cvs.classList.add('is-out');
      later(() => cvs.remove(), 320);
      endBusy();
      say(S('Back in the terminal. The hamster saw everything.', 'd'));
    }
    startBusy({ stop: (teardown) => stop(teardown), resize: size });
  }

  // ── train ──────────────────────────────────────────────
  function trainText(f) {
    const smoke = SMOKE[Math.floor(f / 3) % SMOKE.length];
    const wheel = WHEEL[f % WHEEL.length];
    return [' '.repeat(6) + smoke, ...TRAIN.slice(0, 4), TRAIN[4].replace(/W/g, wheel)].join('\n');
  }
  function cmdTrain() {
    if (reduced) {
      emit([...trainText(0).split('\n').map((l) => ({ parts: [S(l, 'a')], nowrap: true })), [S('The train is parked (reduced motion). Choo choo.', 'd')]]);
      return;
    }
    const pre = h('pre.term__train', { 'aria-hidden': 'true' }, trainText(0));
    const layer = h('div.term__trainlayer', {}, pre);
    root.append(layer);
    const W = root.clientWidth;
    const tw = pre.offsetWidth;
    let x = W, f = 0, acc = 0, last = performance.now(), raf = 0;
    const speed = Math.max(0.28, (W + tw) / 4200); // px per ms: about 4 s across
    function frame(now) {
      const dt = Math.min(64, now - last); last = now;
      x -= speed * dt;
      acc += dt;
      if (acc > 90) { acc = 0; f++; pre.textContent = trainText(f); }
      pre.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
      if (x < -tw) { stop(true); return; }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    function stop(done, teardown) {
      cancelAnimationFrame(raf);
      layer.remove();
      if (teardown) { busy = null; return; } // window closing: no focus, no output
      endBusy();
      say(S(done ? 'Choo choo. (You probably meant ls.)' : 'The train has been stopped. Nobody was hurt.', 'd'));
    }
    startBusy({ stop: (teardown) => stop(false, teardown === true) });
  }

  function startBusy(b) {
    busy = b;
    root.classList.add('is-busy');
    input.blur();
    root.focus({ preventScroll: true });
  }
  function endBusy() {
    busy = null;
    root.classList.remove('is-busy');
    if (!os.isMobile()) input.focus({ preventScroll: true });
    scrollDown();
  }

  // ── run / history / completion ─────────────────────────
  function pushHistory(line) {
    if (history[history.length - 1] !== line) history.push(line);
    if (history.length > HIST_MAX) history = history.slice(-HIST_MAX);
    writeHistory(history);
    hIdx = history.length;
    draft = '';
  }

  function run(raw, echo = true) {
    if (echo) emit([[...promptParts(), raw]]);
    const line = raw.trim();
    if (!line) return;
    pushHistory(line);
    const args = tokenize(line);
    const typed = args.shift();
    const name = typed.toLowerCase();
    const rest = line.replace(/^\S+\s*/, '');
    const key = COMMANDS[name] ? name : ALIASES[name];
    if (!key) { unknown(typed); renderPrompt(); return; }
    try {
      COMMANDS[key].run(args, rest);
    } catch (err) {
      console.error(err);
      say(S(`crypt-sh: ${key} crashed. That one is on me.`, 'r'));
    }
    renderPrompt();
  }

  function unknown(name) {
    if (os.apps.some((a) => a.id === name.toLowerCase())) {
      return say(S(`crypt-sh: ${name} is an app. Try: `, 'r'), S(`open ${name.toLowerCase()}`, 'g'));
    }
    const guess = closest(name, [...visibleCommands(), ...Object.keys(ALIASES)]);
    const target = guess ? (ALIASES[guess] || guess) : null;
    say(S(`crypt-sh: command not found: ${name}`, 'r'),
      target ? S(`. Did you mean `, 'd') : S('. Type ', 'd'),
      S(target || 'help', 'g'),
      S(target ? '?' : ' for the list.', 'd'));
  }

  function histStep(dir) {
    if (!history.length) return;
    if (hIdx === history.length) draft = input.value;
    hIdx = Math.max(0, Math.min(history.length, hIdx + dir));
    input.value = hIdx === history.length ? draft : history[hIdx];
    const end = input.value.length;
    input.setSelectionRange(end, end);
    syncMirror();
  }

  function complete() {
    const v = input.value;
    const pos = input.selectionEnd ?? v.length;
    const before = v.slice(0, pos);
    const after = v.slice(pos);
    const m = before.match(/^(\s*)(\S*)$/);
    let partial, cands, head;
    if (m) {
      partial = m[2];
      head = m[1];
      cands = visibleCommands();
    } else {
      const words = tokenize(before);
      const cmd = (words[0] || '').toLowerCase();
      const c = COMMANDS[cmd] || COMMANDS[ALIASES[cmd]];
      const endsSpace = /\s$/.test(before);
      partial = endsSpace ? '' : before.slice(before.search(/\S*$/));
      head = before.slice(0, before.length - partial.length);
      const spec = c?.args;
      if (!spec) return;
      if (typeof spec === 'function') cands = spec();
      else {
        // path completion
        const slash = partial.lastIndexOf('/');
        const dirPart = slash >= 0 ? partial.slice(0, slash + 1) : '';
        const dir = dirPart ? resolveDir(dirPart) : cwd;
        if (dir == null) return;
        let list = entries(dir);
        if (spec === 'dirs') list = list.filter((n) => n.endsWith('/'));
        if (spec === 'dirs' && dir) list = ['../'];
        cands = list.map((n) => dirPart + n);
        // cat finds a project from anywhere, so offer project files too
        if (spec === 'files' && !dirPart) {
          for (const r of repos) if (!cands.includes(`${r.slug}.md`)) cands.push(`${r.slug}.md`);
        }
      }
    }
    const lower = partial.toLowerCase();
    const matches = cands.filter((c) => c.toLowerCase().startsWith(lower));
    if (!matches.length) { os.sound.play('click'); return; }
    let next;
    if (matches.length === 1) {
      next = matches[0] + (matches[0].endsWith('/') ? '' : ' ');
    } else {
      const cp = commonPrefix(matches);
      if (cp.length > partial.length) next = cp;
      else {
        emit([[...promptParts(), v], matches.map((x, i) => (i ? '   ' + x : x)).map((x) => S(x, 'g'))]);
        return;
      }
    }
    input.value = head + next + after;
    const p = (head + next).length;
    input.setSelectionRange(p, p);
    syncMirror();
  }

  // ── events ─────────────────────────────────────────────
  input.addEventListener('keydown', (e) => {
    if (busy) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      const v = input.value;
      input.value = '';
      syncMirror();
      run(v);
    } else if (e.key === 'ArrowUp') { e.preventDefault(); histStep(-1); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); histStep(1); }
    else if (e.key === 'Tab') {
      if (e.shiftKey) return; // let Shift+Tab leave the terminal
      e.preventDefault(); complete();
    } else if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) { e.preventDefault(); clear(); }
    else if (e.ctrlKey && (e.key === 'c' || e.key === 'C') && input.selectionStart === input.selectionEnd) {
      e.preventDefault();
      emit([[...promptParts(), input.value, S('^C', 'd')]]);
      input.value = ''; hIdx = history.length; syncMirror();
    } else if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) { e.preventDefault(); input.value = ''; syncMirror(); }
    else if (e.key === 'Escape') { if (input.value) { e.preventDefault(); input.value = ''; syncMirror(); } }
    typing();
  });
  input.addEventListener('input', () => { syncMirror(); typing(); });
  input.addEventListener('focus', () => { root.classList.add('is-focused'); syncMirror(); });
  input.addEventListener('blur', () => root.classList.remove('is-focused'));

  // while an animation runs, any key or tap stops it
  root.tabIndex = -1;
  const onRootKey = (e) => {
    if (!busy) return;
    if (e.key === 'Tab' || e.key === 'Shift' || e.key === 'Alt' || e.key === 'Control' || e.key === 'Meta') return;
    e.preventDefault();
    e.stopPropagation();
    busy.stop();
  };
  root.addEventListener('keydown', onRootKey, true);
  root.addEventListener('pointerdown', (e) => {
    if (busy) { e.preventDefault(); busy.stop(); }
  });

  // click anywhere focuses the prompt, unless the visitor is selecting text or clicking a link
  root.addEventListener('click', (e) => {
    if (busy) return;
    if (e.target.closest('a, button')) return;
    const sel = window.getSelection?.();
    if (sel && String(sel).length) return;
    input.focus({ preventScroll: true });
    if (!os.isMobile()) scrollDown();
  });
  // a link click must not trigger a window focus steal; also play a click
  out.addEventListener('click', (e) => { if (e.target.closest('a')) os.sound.play('click'); });

  win.setMenu([
    { label: 'File', items: [
      { label: 'Clear screen', action: () => clear() },
      { label: 'Clear history', action: () => run('history -c') },
      '-',
      { label: 'Exit', action: () => win.close() },
    ] },
    { label: 'Run', items: [
      { label: 'help', action: () => run('help') },
      { label: 'neofetch', action: () => run('neofetch') },
      { label: 'projects', action: () => run('projects') },
      { label: 'matrix', action: () => run('matrix') },
    ] },
  ]);

  // ── welcome ────────────────────────────────────────────
  renderPrompt();
  syncMirror();
  const lastLogin = (() => {
    try { return new Date().toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
  })();
  emit([
    [S('CRYPT OS', 'a'), S(' crypt-sh 1.0', 'd')],
    [S(`Last login: ${lastLogin} on ttys001`, 'd')],
    [],
    ['Welcome. Type ', S('help', 'g'), ' to see what I can do, or ', S('neofetch', 'g'), ' to say hi.'],
    [],
  ]);
  if (ctx.args?.command) run(String(ctx.args.command));
  if (!os.isMobile()) requestAnimationFrame(() => input.focus({ preventScroll: true }));

  return {
    resize() { busy?.resize?.(); scrollDown(); },
    reopen(args) {
      if (args?.command && !busy) run(String(args.command));
      if (!busy) input.focus({ preventScroll: true });
    },
    destroy() {
      try { busy?.stop?.(true); } catch { /* ignore */ }
      busy = null;
      cancelAnimationFrame(scrollRaf);
      clearTimeout(typingTimer);
      for (const id of timers) clearTimeout(id);
      timers.clear();
      document.removeEventListener('selectionchange', onSel);
      root.remove();
    },
  };
}
