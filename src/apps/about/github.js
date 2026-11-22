// Live GitHub numbers for the About dialog. Unauthenticated REST calls,
// cached in sessionStorage for 30 minutes; on any failure the caller falls
// back to the repos.js snapshot.
const USER_URL = 'https://api.github.com/users/CRYPT-hack';
const REPOS_URL = 'https://api.github.com/users/CRYPT-hack/repos?per_page=100&sort=pushed';
const KEY = 'cryptos.about.github.v1';
const TTL = 30 * 60 * 1000;

function readCache() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (!c || Date.now() - c.t > TTL) return null;
    return c;
  } catch { return null; }
}

function writeCache(data) {
  try { sessionStorage.setItem(KEY, JSON.stringify(data)); } catch { /* storage full or blocked */ }
}

export class GitHubError extends Error {
  constructor(message, { rateLimited = false, status = 0 } = {}) {
    super(message);
    this.rateLimited = rateLimited;
    this.status = status;
  }
}

async function getJSON(url, signal) {
  const res = await fetch(url, { signal, headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) {
    const rateLimited = (res.status === 403 || res.status === 429) && res.headers.get('x-ratelimit-remaining') === '0';
    throw new GitHubError(`GitHub answered ${res.status}`, { rateLimited: rateLimited || res.status === 429, status: res.status });
  }
  return res.json();
}

/**
 * @param {AbortSignal} signal
 * @param {{force?:boolean}} [opts]
 * @returns {Promise<{t:number, user:object, repos:object[], cached:boolean}>}
 */
export async function loadGitHub(signal, { force = false } = {}) {
  if (!force) {
    const c = readCache();
    if (c) return { ...c, cached: true };
  }
  const [user, list] = await Promise.all([getJSON(USER_URL, signal), getJSON(REPOS_URL, signal)]);
  const data = {
    t: Date.now(),
    user: {
      login: user.login,
      public_repos: user.public_repos,
      followers: user.followers,
      following: user.following,
      html_url: user.html_url,
    },
    repos: (Array.isArray(list) ? list : []).map((r) => ({
      name: r.name,
      html_url: r.html_url,
      language: r.language,
      stars: r.stargazers_count || 0,
      pushed_at: r.pushed_at,
      fork: !!r.fork,
      description: r.description || '',
    })),
  };
  writeCache(data);
  return { ...data, cached: false };
}

const rtf = typeof Intl !== 'undefined' && Intl.RelativeTimeFormat ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' }) : null;

/** "3 days ago", "last month" */
export function relTime(iso, now = Date.now()) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const s = (t - now) / 1000;
  const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [u, sec] of units) {
    if (Math.abs(s) >= sec || u === 'minute') {
      const v = Math.round(s / sec);
      return rtf ? rtf.format(v, u) : `${Math.abs(v)} ${u}${Math.abs(v) === 1 ? '' : 's'} ago`;
    }
  }
  return '';
}
