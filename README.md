# CRYPT OS — Shobhit Rai

**Live:** https://crypt-hack.github.io/ME-/

My portfolio as a tiny desktop operating system. It boots from a green-phosphor
BIOS screen into a glossy early-2000s desktop with a live meadow wallpaper, and
everything about me is an app.

| App | What it does |
|---|---|
| **Home** | Who I am, a CRT TV cycling through my featured projects, stats. |
| **File Explorer** | Every repository as folders and files. Opening it (or going back to the root) bombards the screen with hundreds of flying files that land in the grid. |
| **Resume.pdf** | A PDF-style resume whose portrait assembles itself as a black-and-white pixel mosaic you can push around with the cursor. Print / Save as PDF prints just the page. |
| **Steam** | What I play, plus developer achievements unlocked from my repos. |
| **Music** | A tape deck playing procedurally generated tracks (WebAudio). The wallpaper reacts to the music. Shows my Spotify when linked. |
| **About Me** | System-properties dialog: specs, skills, live GitHub stats, a timeline. |
| **Terminal** | `help`, `neofetch`, `projects`, `open explorer`, `matrix`… |
| **Contact** | A mail composer that opens your email client (or copies the message). |
| **Recycle Bin** | Things I have deleted. Restore them at your own risk. |

Windows drag, resize, minimise, maximise (double-click the title bar or drag
it to the top edge), and every app has a deep link: `#/explorer`, `#/resume`…
Keyboard: arrow keys + Enter on the desktop, Alt+W closes a window, Alt+D shows
the desktop, Ctrl+Esc opens the start menu.

Inspired by [iqbalsurya.com](https://iqbalsurya.com) (the desktop-OS idea) and
[vadimcarazan.com](https://vadimcarazan.com) (the file bombardment and the
pixel portrait). No code, text or assets were taken from either site, and no
third-party logos are used.

## Make it yours

Everything personal is in **`src/data/profile.js`**:

- `steam.profileUrl` — your Steam profile link (the Steam app's button lights up)
- `spotify.profileUrl` and `spotify.embed` — your Spotify profile and any
  playlist/album/track link to embed in the Music app
- `links` — email, LinkedIn, X, Instagram, Discord (empty = hidden)
- `education`, `experience`, `skills`, `interests` — used by Resume, About and Terminal
- `photo` — replace `src/assets/profile.png`; the resume mosaic is generated from it

Projects come from `src/data/repos.js`.

## Run it

```bash
npm install
npm run dev       # http://localhost:5180
npm run build     # static site in dist/ (relative paths, works from any folder)
npm run preview
```

## Layout

```
src/main.js            boot → desktop
src/os/                window manager, desktop, taskbar + start menu, boot, sounds, icons, wallpaper
src/apps/<id>/         one folder per app (registry in src/apps/index.js)
src/lib/               bombardment and mosaic effects
src/data/              profile and repositories
```
