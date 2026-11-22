// The app registry. Metadata lives here so the desktop, start menu, terminal
// and URL routing know every app without loading its code; `load()` pulls the
// module in on first open.
//
// App module contract (src/apps/<id>/index.js):
//
//   export function mount(body, ctx) {
//     // body: the window's content element (already empty, scrollable by CSS
//     //       class .win__body; add .win__body--flush on it via ctx.win.flush()
//     //       for edge-to-edge apps).
//     // ctx.win:  { el, body, id, setTitle(t), setStatus(t|null), setIcon(name),
//     //             setMenu([{label, items:[{label, action, disabled}]}]),
//     //             flush(), close(), focus(), minimize(), maximize(),
//     //             isMaximized(), rect() -> DOMRect, onClose(fn) }
//     // ctx.os:   see src/os/os.js (open, notify, sound, bus, apps, profile,
//     //           reducedMotion, isMobile, fx layer element, wallpaper)
//     // ctx.args: whatever was passed to os.open(id, args) (may be undefined)
//     return {
//       destroy() {},       // optional: stop loops, remove listeners
//       resize(rect) {},    // optional: window was resized / maximised
//       reopen(args) {},    // optional: os.open() was called again while open
//     };
//   }
//
// Apps style themselves in a sibling CSS file imported from their index.js,
// with every selector scoped under a unique root class (e.g. .app-explorer).

export const apps = [
  {
    id: 'home', title: 'Home', icon: 'home',
    width: 900, height: 640, desktop: true, start: 'main',
    blurb: 'Who I am, what I build',
    load: () => import('./home/index.js'),
  },
  {
    id: 'about', title: 'About Me', icon: 'user',
    width: 720, height: 600, desktop: true, start: 'main',
    blurb: 'Stats, skills and the story so far',
    load: () => import('./about/index.js'),
  },
  {
    id: 'explorer', title: 'File Explorer', icon: 'folder',
    width: 900, height: 600, desktop: true, start: 'main',
    blurb: 'Every project, as files',
    load: () => import('./explorer/index.js'),
  },
  {
    id: 'resume', title: 'Resume.pdf', icon: 'pdf',
    width: 760, height: 680, desktop: true, start: 'main',
    blurb: 'Skills, projects, contact',
    load: () => import('./resume/index.js'),
  },
  {
    id: 'steam', title: 'Steam', icon: 'gamepad',
    width: 780, height: 560, desktop: true, start: 'main',
    blurb: 'What I play',
    load: () => import('./steam/index.js'),
  },
  {
    id: 'music', title: 'Music', icon: 'music',
    width: 420, height: 560, desktop: true, start: 'main',
    blurb: 'Spotify and a tape deck',
    load: () => import('./music/index.js'),
  },
  {
    id: 'terminal', title: 'Terminal', icon: 'terminal',
    width: 700, height: 440, desktop: true, start: 'main',
    blurb: 'Type help',
    load: () => import('./terminal/index.js'),
  },
  {
    id: 'contact', title: 'Contact', icon: 'mail',
    width: 620, height: 560, desktop: true, start: 'main',
    blurb: 'Write me a message',
    load: () => import('./contact/index.js'),
  },
  {
    id: 'recycle', title: 'Recycle Bin', icon: 'recycle-full',
    width: 640, height: 440, desktop: true, start: false,
    blurb: 'Things I have deleted',
    load: () => import('./recycle/index.js'),
  },
  {
    id: 'viewer', title: 'Viewer', icon: 'file-text',
    width: 760, height: 560, desktop: false, start: false, singleton: false,
    blurb: 'Opens a single file',
    load: () => import('./viewer/index.js'),
  },
];

export const appById = Object.fromEntries(apps.map((a) => [a.id, a]));
