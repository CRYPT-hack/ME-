// Repository data, curated from github.com/CRYPT-hack (snapshot: 17 Nov 2026).
// Forks are left out. Private repositories are shown without a link (their
// case pages still work). Edit freely: every section on the site reads from
// this one list.
//
// Fields
//   slug        stable id used in URLs and DOM ids
//   repo        exact GitHub repository name
//   title       display name
//   tagline     a few words, shown under titles
//   description one or two plain sentences: what it is and what it does
//   languages   main languages / tools, most important first
//   updated     ISO date of the last push
//   private     true = no public link
//   featured    true = appears in the TV-show showcase and the selected-work list
//   page        (unused here; kept from the original portfolio data)
//   cover       which generative cover to draw (see src/apps/explorer/covers.js)
//   facts       short specific facts, used by hover cards and case pages
//   image       optional real screenshot URL (bundled by Vite)

import codecityImage from '../assets/codecity.jpg';
import codecityStreetImage from '../assets/codecity-street.jpg';

const GH = 'https://github.com/CRYPT-hack/';

export const repos = [
  {
    slug: 'bob-the-builder',
    repo: 'BOB-THE-BUILDER-',
    title: 'Bob the Builder',
    tagline: 'We build your git city',
    description:
      'Renders any git repository as a 3D city that grows over its commit history. Every file is a building that rises when it is added, grows with its line count and sinks when it is deleted.',
    languages: ['JavaScript', 'Three.js', 'Node', 'Express', 'MongoDB'],
    updated: '2026-11-12',
    private: false,
    featured: true,
    page: 'projects/bob-the-builder/',
    cover: 'city',
    image: codecityImage,
    images: [codecityImage, codecityStreetImage],
    facts: [
      'One pass of git log --numstat rebuilds every file’s size at every commit',
      'Squarified treemap layout, so buildings grow in place',
      '12 building archetypes, 12 draw calls',
      'Ambient occlusion and window reveals in one shader',
    ],
  },
  {
    slug: 'agents-assemble',
    repo: 'agents_assemble-',
    title: 'Agents Assemble',
    tagline: 'Every coding agent, one workspace',
    description:
      'One workspace where every coding agent works the same project side by side. Each agent gets its own git worktree, a mailbox, a shared task board and file leases, so nobody overwrites or duplicates anybody.',
    languages: ['TypeScript', 'Node', 'MCP'],
    updated: '2026-11-09',
    private: false,
    featured: true,
    page: 'projects/agents-assemble/',
    cover: 'grid',
    facts: ['A git worktree per agent', 'Mailboxes and a shared task board', 'File leases stop two agents editing one file'],
  },
  {
    slug: 'sky-eye',
    repo: 'sky-eye',
    title: 'sky-eye',
    tagline: 'Vehicle detection on live drone video',
    description:
      'Reads a live video feed, detects and tracks trucks with RF-DETR, and saves a snapshot, a crop and a short clip for every one. A small HTTP API serves it all with a live annotated stream and a dashboard.',
    languages: ['Python', 'RF-DETR', 'PyTorch', 'TypeScript', 'React'],
    updated: '2026-11-07',
    private: true,
    featured: true,
    page: 'projects/sky-eye/',
    cover: 'scan',
    facts: [
      'Any source: HDMI capture card, RTSP/RTMP relay or a video file',
      'A snapshot, a crop and a clip per truck, written to disk',
      'Live MJPEG stream plus /api/trucks and /api/status',
      'Desktop, phone and webhook alerts with a cooldown',
    ],
  },
  {
    slug: 'crypt-assistant',
    repo: 'Assistant-',
    title: 'CRYPT',
    tagline: 'A personal assistant that never leaves the laptop',
    description:
      'A fully local Windows assistant. Say the wake phrase or press Ctrl+Space; a local LLM answers, calls typed and safety-gated skills for files, apps, devices, reminders and memory, and speaks the reply.',
    languages: ['Python', 'Ollama', 'faster-whisper', 'openWakeWord'],
    updated: '2026-07-16',
    private: true,
    featured: true,
    page: 'projects/crypt-assistant/',
    cover: 'wave',
    facts: [
      'Wake word, speech in and speech out, all on device',
      'Typed skills with safety gates before anything acts',
      'Local LLM through Ollama: no cloud, no API keys',
    ],
  },
  {
    slug: 'bstat',
    repo: 'Margin-Call-',
    title: 'bstat',
    tagline: 'How much of a backtest is luck',
    description:
      'An audit layer for trading backtests, not another engine. It sits on top of the backtester you already use and corrects the result for how many strategies were tried before this one looked good.',
    languages: ['Python', 'Statistics'],
    updated: '2026-08-29',
    private: true,
    featured: false,
    page: null,
    cover: 'wave',
    facts: ['Multiple-testing correction for Sharpe ratios', 'Works with backtrader, vectorbt, zipline and bt'],
  },
  {
    slug: 'autonomous-firac',
    repo: 'autonomous-firach',
    title: 'Autonomous FIRAC',
    tagline: 'A casebook that links itself',
    description:
      'A collaborative, version-controlled knowledge graph of legal case briefs written in the FIRAC method (facts, issue, rule, application, conclusion), by law students for law students.',
    languages: ['TypeScript', 'JavaScript', 'Docker'],
    updated: '2026-04-24',
    private: true,
    featured: false,
    page: null,
    cover: 'grid',
    facts: ['Five-section editor with autosave', 'Briefs link to each other like a wiki'],
  },
  {
    slug: 'ai-notebook',
    repo: 'ai-notebook-',
    title: 'AI Notebook',
    tagline: 'A notebook with an assistant in the margin',
    description:
      'A Jupyter-style web notebook with a built-in Claude assistant. Cells run inside an isolated Docker sandbox and notebooks are stored in PostgreSQL.',
    languages: ['Python', 'TypeScript', 'React', 'Docker', 'PostgreSQL'],
    updated: '2026-05-24',
    private: true,
    featured: false,
    page: null,
    cover: 'terminal',
    facts: ['Sandboxed cell execution', 'Markdown and output rendering'],
  },
  {
    slug: 'pricescout',
    repo: 'pricescout',
    title: 'PriceScout',
    tagline: 'One search, five shops',
    description:
      'Price comparison for Indian e-commerce: search once and see the item across Myntra, Flipkart, Amazon, Ajio and Meesho with the cheapest highlighted, or browse the biggest live discounts in one feed.',
    languages: ['TypeScript', 'JavaScript'],
    updated: '2026-06-13',
    private: true,
    featured: false,
    page: null,
    cover: 'grid',
    facts: ['Five retailers normalised into one comparable list', 'A live feed of the biggest discounts'],
  },
  {
    slug: 'pixel-companion',
    repo: 'pixel-companion',
    title: 'Pixel Companion',
    tagline: 'A pet that lives on top of every app',
    description: 'An Android screen pet: a pixel character that floats over every app and the home screen, animates, and can be dragged around.',
    languages: ['Kotlin', 'Android'],
    updated: '2026-06-14',
    private: true,
    featured: false,
    page: null,
    cover: 'origin',
    facts: ['Overlay foreground service', 'Its own renderer and drag handling'],
  },
  {
    slug: 'interlagos-racer',
    repo: 'nascar',
    title: 'Interlagos Racer',
    tagline: 'Ten cars, three laps, one server',
    description:
      'Browser multiplayer racing for ten players on a scaled Interlagos circuit. The server runs the physics; every client predicts its own car so steering never waits for the network.',
    languages: ['TypeScript', 'Three.js', 'Rapier', 'WebSocket'],
    updated: '2026-09-09',
    private: false,
    featured: true,
    page: null,
    cover: 'track',
    facts: ['Server-authoritative Rapier physics', 'Client-side prediction', 'Original assets only'],
  },
  {
    slug: 'no-parking-zone',
    repo: 'test_joe',
    title: 'No-Parking Zone Enforcement',
    tagline: 'A camera that writes the ticket',
    description:
      'YOLOv8 finds number plates, EasyOCR reads them, a Raspberry Pi 4 runs the camera, and offenders get an SMS warning. A FastAPI dashboard streams it all live.',
    languages: ['Python', 'YOLOv8', 'FastAPI', 'Raspberry Pi'],
    updated: '2026-04-29',
    private: false,
    featured: false,
    page: null,
    cover: 'scan',
    facts: ['Two-stage detection: vehicle, then plate', 'TensorRT engine when available'],
  },
  {
    slug: 'redline-review',
    repo: 'CAD-pdf-comparison',
    title: 'Redline Review',
    tagline: 'Spot every change between drawing revisions',
    description:
      'Load two revisions of a CAD drawing, pick the pages, and every change is marked. All rendering and comparison happens in the browser; the drawings never leave your machine.',
    languages: ['JavaScript', 'pdf.js', 'HTML'],
    updated: '2026-07-14',
    private: false,
    featured: true,
    page: 'projects/redline-review/',
    cover: 'blueprint',
    facts: ['Page alignment for re-exported revisions', 'Local-only processing'],
  },
  {
    slug: 'stress',
    repo: 'STRESS',
    title: 'STRESS',
    tagline: 'A study bot that will not let you quit',
    description:
      'A local terminal chatbot that quizzes you on ML, DSA and linear algebra, tracks your streak, and refuses to end the session until the day’s quota is done.',
    languages: ['Python', 'Shell'],
    updated: '2026-10-16',
    private: false,
    featured: false,
    page: null,
    cover: 'terminal',
    facts: ['Zero dependencies', 'No accounts, no cloud, no API keys'],
  },
  {
    slug: 'evm',
    repo: 'evm',
    title: 'Electronic Voting System',
    tagline: 'Counting, then checking the count',
    description:
      'A voting system that verifies the election outcome with counting principles and logical consistency checks: Flask handles voters and sessions, a C++ verifier counts.',
    languages: ['Python', 'Flask', 'C++', 'JavaScript'],
    updated: '2026-10-29',
    private: false,
    featured: false,
    page: null,
    cover: 'grid',
    facts: ['Discrete mathematics project', 'Independent C++ vote verifier'],
  },
  {
    slug: 'rest-api',
    repo: 'web-programming-',
    title: 'Posts API',
    tagline: 'Model, controller, route',
    description:
      'A REST backend on Node, Express and MongoDB Atlas with user authentication and full create, read, update and delete for posts.',
    languages: ['JavaScript', 'Express', 'MongoDB'],
    updated: '2026-11-02',
    private: false,
    featured: false,
    page: null,
    cover: 'terminal',
    facts: ['Auth endpoints', 'Full CRUD for posts'],
  },
  {
    slug: 'traffic-analysis',
    repo: 'traffic-analysis',
    title: 'Traffic Analysis',
    tagline: 'Weather, volume, and the hour of the crash',
    description:
      'Statistical analysis of how traffic volume, weather and time of day affect urban accident rates: correlation, regression and hypothesis tests.',
    languages: ['JavaScript', 'HTML', 'CSS'],
    updated: '2026-04-22',
    private: false,
    featured: false,
    page: null,
    cover: 'wave',
    facts: ['Correlation and regression', 'Hypothesis testing'],
  },
  {
    slug: 'chromium-canary',
    repo: 'chromium-',
    title: 'Chromium Canary patch',
    tagline: 'A patch for the browser itself',
    description:
      'A patch submission for Chromium Canary: written and statically verified, with the full toolchain build and test run in progress.',
    languages: ['C++', 'Chromium'],
    updated: '2026-11-14',
    private: false,
    featured: false,
    page: null,
    cover: 'blueprint',
    facts: ['Needs 100 GB of disk to build'],
  },
  {
    slug: 'ballotcheck',
    repo: 'Ballotcheck',
    title: 'Ballotcheck',
    tagline: 'Checking ballots',
    description: 'A ballot-checking tool with a Python backend and a web front end.',
    languages: ['Python', 'JavaScript', 'HTML'],
    updated: '2026-04-19',
    private: false,
    featured: false,
    page: null,
    cover: 'scan',
    facts: [],
  },
  {
    slug: 'wrist-band',
    repo: 'Wrist-band',
    title: 'Wrist-band',
    tagline: 'React, TypeScript, Vite',
    description: 'A React and TypeScript app built on Vite for a wristband project.',
    languages: ['TypeScript', 'React', 'Vite'],
    updated: '2026-04-19',
    private: false,
    featured: false,
    page: null,
    cover: 'wave',
    facts: [],
  },
  {
    slug: 'ai-agency',
    repo: 'ai-agency',
    title: 'AI Agency',
    tagline: 'Agents for hire',
    description: 'Tooling and a site for an AI agency, written in TypeScript.',
    languages: ['TypeScript', 'JavaScript', 'PowerShell'],
    updated: '2026-05-29',
    private: false,
    featured: false,
    page: null,
    cover: 'grid',
    facts: [],
  },
  {
    slug: 'first-commit',
    repo: 'FirstCommit-',
    title: 'First Commit',
    tagline: 'Where it started',
    description: 'The first repository: C, October 2025.',
    languages: ['C'],
    updated: '2025-10-15',
    private: false,
    featured: false,
    page: null,
    cover: 'origin',
    facts: [],
  },
].map((r) => ({ ...r, url: r.private ? null : GH + r.repo }));

export const featured = repos.filter((r) => r.featured);

export const bySlug = Object.fromEntries(repos.map((r) => [r.slug, r]));

/** Where a click on this repo should go: its case page, else GitHub, else null. */
export function hrefFor(repo, base = './') {
  if (repo.page) return base + repo.page;
  return repo.url;
}

/** Language → colour (GitHub's palette, so the colours already mean something). */
export const languageColors = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Python: '#3572A5',
  'C++': '#f34b7d',
  C: '#555555',
  HTML: '#e34c26',
  CSS: '#663399',
  Shell: '#89e051',
  PowerShell: '#012456',
};

export const stats = (() => {
  const langs = new Set(repos.flatMap((r) => r.languages));
  const primary = new Set(repos.map((r) => r.languages[0]));
  return {
    total: repos.length,
    public: repos.filter((r) => !r.private).length,
    featured: featured.length,
    languages: langs.size,
    primaryLanguages: primary.size,
    since: '2025-10-15',
  };
})();
