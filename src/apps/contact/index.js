// Contact: an early-2000s style compose window. With an email address in
// profile.js it hands the message to the visitor's mail app (mailto:);
// without one it copies the message and points to GitHub instead.
import './contact.css';
import { h, clockText } from '../../os/ui.js';
import { icon } from '../../os/icons.js';
import { socialLinks } from '../../data/profile.js';

const DRAFT_KEY = 'cryptos.contact.draft';
const MAX = 2000;
const MIN = 10;
const SUBJECTS = ['Internship / job', 'Collaboration', 'Freelance project', 'Just saying hi', 'Something else'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const LINK_ICON = { github: 'github', email: 'mail', steam: 'gamepad', spotify: 'music' };

function readDraft() {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    return d && typeof d === 'object' ? d : null;
  } catch { return null; }
}
function writeDraft(d) {
  try {
    if (d) localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* private mode */ }
}

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* fall through */ }
  try {
    const ta = h('textarea', { style: { position: 'fixed', left: '-9999px', top: '0' }, readonly: true });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch { return false; }
}

const ENVELOPE_SVG = `
<svg viewBox="0 0 64 44" width="64" height="44" aria-hidden="true">
  <defs><linearGradient id="ctEnvG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffdf4"/><stop offset="1" stop-color="#e6dcc0"/></linearGradient></defs>
  <rect x="1.5" y="1.5" width="61" height="41" rx="3" fill="url(#ctEnvG)" stroke="#8a7a55" stroke-width="1.5"/>
  <path d="M2 41 26 21m36 20L38 21" stroke="#b5a57d" stroke-width="1.4" fill="none"/>
  <path class="flap" d="M2 3 32 26 62 3" fill="#f4ecd3" stroke="#8a7a55" stroke-width="1.5" stroke-linejoin="round"/>
  <circle cx="32" cy="25" r="4.2" fill="#d8321f" stroke="#8f1b12"/>
</svg>`;

export function mount(body, ctx) {
  const { os, win } = ctx;
  const profile = os.profile;
  const email = profile.links.email;
  const github = profile.links.github;
  const reduced = os.reducedMotion;
  win.flush();

  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
  const fxNodes = new Set();
  const anims = new Set();

  // ── toolbar ────────────────────────────────────────────
  const toast = h('div.ct__toast', { role: 'status', 'aria-live': 'polite' });
  let toastTimer = 0;
  function showToast(text) {
    toast.textContent = text;
    toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-on'), 3600);
  }

  const sendBtn = h('button.ct__tool.ct__tool--send', { type: 'button', onclick: () => send() },
    h('span.ct__toolicon', { html: icon('mail', 22) }), h('span', {}, 'Send'));
  const attachTip = 'Attachments are off. Nobody needs another final_v2_REAL.zip.';
  const attachBtn = h('button.ct__tool', {
    type: 'button', 'aria-disabled': 'true', 'data-tip': attachTip, 'aria-label': `Attach (unavailable): ${attachTip}`,
    onclick: () => { os.sound.play('error'); showToast(attachTip); },
  }, h('span.ct__toolicon', { html: clipSvg() }), h('span', {}, 'Attach'));
  const spellBtn = h('button.ct__tool', {
    type: 'button', 'data-tip': 'Checks your spelling. Allegedly.',
    onclick: () => spelling(),
  }, h('span.ct__toolicon.ct__abc', {}, 'abc'), h('span', {}, 'Spelling'));
  const newBtn = h('button.ct__tool.ct__tool--small', { type: 'button', onclick: () => reset(true) },
    h('span.ct__toolicon', { html: icon('file-text', 18) }), h('span', {}, 'New'));
  const toolbar = h('div.ct__toolbar', { role: 'toolbar', 'aria-label': 'Message' },
    sendBtn, h('span.ct__sep', { 'aria-hidden': 'true' }), attachBtn, spellBtn, h('span.ct__grow'), newBtn);

  // ── compose form ───────────────────────────────────────
  const uid = `ct${Math.random().toString(36).slice(2, 8)}`;
  const toField = h('div.ct__to', { id: `${uid}-to`, 'aria-readonly': 'true' },
    h('span.ct__chip', {}, h('span.ct__chipicon', { html: icon('user', 16) }), profile.name),
    h('span.ct__addr', {}, email ? `<${email}>` : github ? 'via GitHub' : ''));
  const fromInput = h('input.field.ct__input', {
    id: `${uid}-from`, type: 'email', name: 'from', autocomplete: 'email', inputmode: 'email',
    placeholder: 'you@example.com', required: true, 'aria-describedby': `${uid}-from-err`,
  });
  const fromErr = h('p.ct__err', { id: `${uid}-from-err`, 'aria-live': 'polite' });
  const subjectSel = h('select.field.ct__input', { id: `${uid}-subj`, name: 'subject' },
    ...SUBJECTS.map((s) => h('option', { value: s }, s)));
  const msg = h('textarea.field.ct__msg', {
    id: `${uid}-msg`, name: 'message', maxlength: String(MAX), rows: '8',
    placeholder: `Hi ${profile.firstName}, …`, 'aria-describedby': `${uid}-msg-err ${uid}-count`, 'aria-label': 'Message',
  });
  const msgErr = h('p.ct__err', { id: `${uid}-msg-err`, 'aria-live': 'polite' });
  const count = h('span.ct__count', { id: `${uid}-count` });
  const saved = h('span.ct__saved');

  const row = (label, forId, control, extra) => h('div.ct__row', {},
    h('label.ct__label', { for: forId }, label), h('div.ct__ctl', {}, control, extra || null));
  const header = h('div.ct__hdr', {},
    h('div.ct__row', {}, h('span.ct__label', { id: `${uid}-tolabel` }, 'To:'), h('div.ct__ctl', {}, toField)),
    row('From:', fromInput.id, fromInput, fromErr),
    row('Subject:', subjectSel.id, subjectSel));
  toField.setAttribute('aria-labelledby', `${uid}-tolabel ${uid}-to`);
  const paper = h('div.ct__paper', {}, msg, h('div.ct__meta', {}, msgErr, h('span.ct__grow'), saved, count));
  const form = h('form.ct__compose', { novalidate: true, onsubmit: (e) => { e.preventDefault(); send(); } },
    header, paper);

  // ── other ways ─────────────────────────────────────────
  const aside = h('aside.ct__aside', { 'aria-labelledby': `${uid}-other` },
    h('h3.ct__asidetitle', { id: `${uid}-other` }, 'Other ways to reach me'));
  const links = socialLinks();
  const list = h('ul.ct__links');
  for (const l of links) {
    list.append(h('li', {}, h('a.ct__link', {
      href: l.href, target: l.href.startsWith('mailto:') ? null : '_blank', rel: 'noopener noreferrer',
    }, h('span.ct__linkicon', { html: icon(LINK_ICON[l.id] || 'globe', 20) }),
    h('span.ct__linktext', {}, h('strong', {}, l.label), h('small', {}, l.href.replace(/^mailto:|^https?:\/\/(www\.)?/g, ''))))));
  }
  if (profile.links.discord) {
    const handle = profile.links.discord;
    const dBtn = h('button.ct__link.ct__link--btn', {
      type: 'button', 'aria-label': `Copy Discord handle ${handle}`,
      onclick: async () => {
        const ok = await copyText(handle);
        dSmall.textContent = ok ? 'Copied!' : handle;
        later(() => { dSmall.textContent = `${handle} · click to copy`; }, 1800);
      },
    }, h('span.ct__linkicon', { html: icon('globe', 20) }), h('span.ct__linktext', {}, h('strong', {}, 'Discord'), null));
    const dSmall = h('small', {}, `${handle} · click to copy`);
    dBtn.querySelector('.ct__linktext').append(dSmall);
    list.append(h('li', {}, dBtn));
  }
  if (list.childElementCount) aside.append(list);
  else aside.append(h('p.ct__note', {}, 'Nothing else is linked yet. The form is the way.'));
  const clock = h('p.ct__note');
  const updateClock = () => { clock.textContent = `It is ${clockText(profile.timezone)} for me in ${profile.location}. I usually reply within a few days.`; };
  updateClock();
  const clockTimer = setInterval(updateClock, 30000);
  aside.append(h('p.ct__avail', {}, h('span.ct__dot', { 'aria-hidden': 'true' }), profile.availability), clock);

  // ── modal ──────────────────────────────────────────────
  const modal = h('div.ct__modal', { hidden: true });
  let lastFocus = null;
  function openModal({ title, text, iconName = 'info', extra = null, buttons }) {
    modal.textContent = '';
    const titleId = `${uid}-mt`;
    const descId = `${uid}-md`;
    const box = h('div.ct__dialog', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, 'aria-describedby': descId },
      h('div.ct__dialogbar', {}, h('span', { id: titleId }, title),
        h('button.ct__dialogx', { type: 'button', 'aria-label': 'Close', onclick: closeModal }, '×')),
      h('div.ct__dialogbody', {},
        h('span.ct__dialogicon', { html: icon(iconName, 40) }),
        h('div', {}, h('p', { id: descId }, text), extra)),
      h('div.ct__dialogbtns', {}, ...buttons));
    modal.append(box);
    modal.hidden = false;
    lastFocus = document.activeElement;
    requestAnimationFrame(() => (box.querySelector('.ct__dialogbtns > *') || box).focus());
  }
  function closeModal() {
    if (modal.hidden) return;
    modal.hidden = true;
    modal.textContent = '';
    (lastFocus && root.contains(lastFocus) ? lastFocus : sendBtn).focus();
  }
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeModal(); return; }
    if (e.key !== 'Tab') return;
    const f = [...modal.querySelectorAll('button, a[href], textarea')].filter((n) => !n.disabled);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  modal.addEventListener('pointerdown', (e) => { if (e.target === modal) closeModal(); });

  const root = h('div.app-contact', {}, toolbar,
    h('div.ct__main', {}, form, aside), modal, toast);
  body.append(root);

  // ── state / draft ──────────────────────────────────────
  let saveTimer = 0;
  let sending = false;
  const d = readDraft();
  if (d) {
    if (typeof d.from === 'string') fromInput.value = d.from.slice(0, 200);
    if (SUBJECTS.includes(d.subject)) subjectSel.value = d.subject;
    if (typeof d.body === 'string') msg.value = d.body.slice(0, MAX);
  }
  if (ctx.args?.subject && SUBJECTS.includes(ctx.args.subject) && !msg.value) subjectSel.value = ctx.args.subject;
  if (d && (d.body || d.from)) saved.textContent = 'Draft restored';

  function updateCount() {
    const n = msg.value.length;
    count.textContent = `${n} / ${MAX}`;
    count.classList.toggle('is-near', n > MAX * 0.9);
  }
  function status() {
    const n = msg.value.trim() ? msg.value.trim().split(/\s+/).length : 0;
    win.setStatus([email ? `To: ${profile.name}` : `To: ${profile.name} (via clipboard)`, `${n} word${n === 1 ? '' : 's'}`, saved.textContent || 'New message']);
  }
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const draft = { from: fromInput.value, subject: subjectSel.value, body: msg.value };
      if (!draft.from && !draft.body) { writeDraft(null); saved.textContent = ''; }
      else { writeDraft(draft); saved.textContent = `Draft saved ${clockText(undefined)}`; }
      status();
    }, 350);
  }
  updateCount();
  status();

  fromInput.addEventListener('input', () => { if (fromErr.textContent) validate(false); scheduleSave(); });
  fromInput.addEventListener('blur', () => { if (fromInput.value) validate(false, true); });
  subjectSel.addEventListener('change', scheduleSave);
  msg.addEventListener('input', () => { updateCount(); if (msgErr.textContent) validate(false); scheduleSave(); status(); });
  msg.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); }
  });

  function validate(focus = true, fromOnly = false) {
    let ok = true;
    const from = fromInput.value.trim();
    if (!from) { fromErr.textContent = 'Your email, so I can write back.'; ok = false; }
    else if (!EMAIL_RE.test(from)) { fromErr.textContent = 'That does not look like an email address yet.'; ok = false; }
    else fromErr.textContent = '';
    fromInput.setAttribute('aria-invalid', fromErr.textContent ? 'true' : 'false');
    if (fromOnly) return ok;
    const text = msg.value.trim();
    if (text.length < MIN) { msgErr.textContent = text ? `A few more words, please (${MIN} characters minimum).` : 'The message is empty.'; ok = false; }
    else msgErr.textContent = '';
    msg.setAttribute('aria-invalid', msgErr.textContent ? 'true' : 'false');
    if (!ok && focus) {
      (fromErr.textContent ? fromInput : msg).focus();
      os.sound.play('error');
      if (!reduced) {
        form.classList.remove('is-shake');
        void form.offsetWidth;
        form.classList.add('is-shake');
      }
    }
    return ok;
  }

  function compose() {
    return {
      subject: `[CRYPT OS] ${subjectSel.value}`,
      text: [
        `To: ${profile.name}`,
        `From: ${fromInput.value.trim()}`,
        `Subject: ${subjectSel.value}`,
        '',
        msg.value.trim(),
      ].join('\n'),
      body: `${msg.value.trim()}\n\n--\nFrom: ${fromInput.value.trim()} (sent from CRYPT OS)`,
    };
  }

  function reset(ask) {
    const dirty = msg.value.trim() || fromInput.value.trim();
    if (ask && dirty) {
      openModal({
        title: 'New message',
        text: 'Throw away this draft and start over?',
        iconName: 'warning',
        buttons: [
          h('button.btn.btn--primary', { type: 'button', onclick: () => { closeModal(); reset(false); } }, 'Discard draft'),
          h('button.btn', { type: 'button', onclick: closeModal }, 'Keep writing'),
        ],
      });
      return;
    }
    msg.value = '';
    fromInput.value = '';
    subjectSel.value = SUBJECTS[0];
    fromErr.textContent = ''; msgErr.textContent = '';
    fromInput.removeAttribute('aria-invalid'); msg.removeAttribute('aria-invalid');
    writeDraft(null);
    saved.textContent = '';
    updateCount();
    status();
    fromInput.focus();
  }

  function spelling() {
    os.sound.play('click');
    const n = msg.value.trim() ? msg.value.trim().split(/\s+/).length : 0;
    showToast(n
      ? `Spell check complete: ${n} word${n === 1 ? '' : 's'} checked, 0 mistakes found. It did not actually look, but it believes in you.`
      : 'Spell check complete. An empty message has no typos. Flawless.');
  }

  async function send() {
    if (sending) return;
    if (!validate(true)) return;
    sending = true;
    const c = compose();
    let copied = false;
    // Both of these need the click's user activation, so they run first.
    if (email) {
      const href = `mailto:${email}?subject=${encodeURIComponent(c.subject)}&body=${encodeURIComponent(c.body)}`;
      const a = h('a', { href });
      a.click();
    } else {
      copied = await copyText(c.text);
    }
    os.sound.play('whoosh');
    await flyEnvelope();
    sending = false;
    if (email) {
      openModal({
        title: 'Handed to your mail app',
        text: 'Your email app should now be open with the message filled in. Press send there and it is on its way to me. If nothing opened, copy the message instead.',
        iconName: 'mail',
        buttons: [
          h('button.btn.btn--primary', { type: 'button', onclick: () => { closeModal(); reset(false); } }, 'New message'),
          h('button.btn', { type: 'button', onclick: async (e) => { const ok = await copyText(c.text); e.currentTarget.textContent = ok ? 'Copied' : 'Copy failed'; } }, 'Copy message'),
          h('button.btn', { type: 'button', onclick: closeModal }, 'Close'),
        ],
      });
      return;
    }
    const extra = copied ? null : h('textarea.field.ct__fallback', { readonly: true, 'aria-label': 'Your message', rows: '5' }, c.text);
    openModal({
      title: copied ? 'Copied to your clipboard' : 'Here is your message',
      text: copied
        ? `I have not put an email address on this site yet, so your message is on your clipboard instead.${github ? ' The quickest way to reach me is GitHub: paste it there and I will see it.' : ''}`
        : `Your browser would not let me copy it, so here it is to copy by hand.${github ? ' The quickest way to reach me is GitHub.' : ''}`,
      iconName: copied ? 'info' : 'warning',
      extra,
      buttons: [
        github ? h('a.btn.btn--primary', { href: github, target: '_blank', rel: 'noopener noreferrer' }, h('span', { html: icon('github', 16) }), 'Open my GitHub') : null,
        h('button.btn', { type: 'button', onclick: () => { closeModal(); reset(false); } }, 'New message'),
        h('button.btn', { type: 'button', onclick: closeModal }, 'Close'),
      ].filter(Boolean),
    });
  }

  /** Fold the letter into an envelope and throw it at the top-right corner. */
  function flyEnvelope() {
    if (reduced || !os.fx || typeof Element.prototype.animate !== 'function') return Promise.resolve();
    const r = paper.getBoundingClientRect();
    const env = h('div.app-contact-fly', { html: ENVELOPE_SVG, 'aria-hidden': 'true' });
    const cx = r.left + r.width / 2 - 32;
    const cy = r.top + r.height / 2 - 22;
    env.style.left = `${cx}px`;
    env.style.top = `${cy}px`;
    os.fx.append(env);
    fxNodes.add(env);
    paper.classList.add('is-folding');
    const tx = window.innerWidth - cx + 60;
    const ty = -cy - 120;
    const a = env.animate([
      { transform: 'translate(0,0) scale(.3) rotate(0deg)', opacity: 0 },
      { transform: 'translate(0,0) scale(1.15) rotate(-4deg)', opacity: 1, offset: 0.2 },
      { transform: 'translate(0,6px) scale(1) rotate(0deg)', opacity: 1, offset: 0.34 },
      { transform: `translate(${tx * 0.35}px, ${ty * 0.12 - 40}px) scale(.85) rotate(14deg)`, opacity: 1, offset: 0.6 },
      { transform: `translate(${tx}px, ${ty}px) scale(.35) rotate(32deg)`, opacity: 0 },
    ], { duration: 1150, easing: 'cubic-bezier(.45,.05,.35,1)', fill: 'forwards' });
    anims.add(a);
    return new Promise((resolve) => {
      const done = () => {
        anims.delete(a);
        env.remove(); fxNodes.delete(env);
        paper.classList.remove('is-folding');
        resolve();
      };
      a.onfinish = done;
      a.oncancel = done;
    });
  }

  win.setMenu([
    { label: 'File', items: [
      { label: 'New message', action: () => reset(true) },
      { label: 'Send', action: () => send() },
      '-',
      { label: 'Close', action: () => win.close() },
    ] },
    { label: 'Tools', items: [
      { label: 'Spelling', action: () => spelling() },
      { label: 'Attach file…', disabled: true },
    ] },
  ]);

  if (!os.isMobile()) requestAnimationFrame(() => (fromInput.value ? msg : fromInput).focus({ preventScroll: true }));

  return {
    reopen(args) {
      if (args?.subject && SUBJECTS.includes(args.subject) && !msg.value.trim()) { subjectSel.value = args.subject; scheduleSave(); }
      (fromInput.value ? msg : fromInput).focus({ preventScroll: true });
    },
    destroy() {
      clearTimeout(saveTimer);
      clearTimeout(toastTimer);
      clearInterval(clockTimer);
      for (const id of timers) clearTimeout(id);
      timers.clear();
      for (const a of anims) { try { a.cancel(); } catch { /* ignore */ } }
      anims.clear();
      for (const n of fxNodes) n.remove();
      fxNodes.clear();
      // keep whatever was typed
      const draft = { from: fromInput.value, subject: subjectSel.value, body: msg.value };
      if (draft.from || draft.body) writeDraft(draft);
      root.remove();
    },
  };
}

function clipSvg() {
  return `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M16.5 6.5 8.4 14.6a2.2 2.2 0 0 0 3.1 3.1l8-8a4 4 0 0 0-5.6-5.6l-8.4 8.4a5.8 5.8 0 0 0 8.2 8.2l6.2-6.2" fill="none" stroke="#6a6a6a" stroke-width="1.8" stroke-linecap="round"/></svg>`;
}
