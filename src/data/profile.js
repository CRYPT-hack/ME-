import photo from '../assets/profile.png';

// Everything personal lives here. Every app reads this one object.
// Empty strings are treated as "not set": the link or button is hidden (or the
// app shows a neutral state), never a broken link.
export const profile = {
  name: 'Shobhit Rai',
  firstName: 'Shobhit',
  handle: 'CRYPT-hack',
  role: 'Student developer',
  location: 'India',
  timezone: 'Asia/Kolkata',
  tagline: 'I build software you can look at: cities made of code, races run on one server, agents that share a desk.',
  availability: 'Open to internships and collaborations',
  since: '2025-10-15', // first commit

  // The portrait used by the resume mosaic, the start menu and About.
  // Replace src/assets/profile.png with a real photo any time: the mosaic is
  // generated from it at runtime (transparent pixels are treated as empty).
  photo,
  photoAlt: 'Shobhit’s avatar: a hamster wearing headphones',

  links: {
    github: 'https://github.com/CRYPT-hack',
    email: '',      // e.g. 'you@example.com'
    linkedin: '',   // e.g. 'https://www.linkedin.com/in/your-name'
    x: '',          // e.g. 'https://x.com/your-handle'
    instagram: '',  // e.g. 'https://instagram.com/your-handle'
    discord: '',    // e.g. 'yourname' (shown as text, copied on click)
  },

  // Steam. `profileUrl` is the public profile link
  // (https://steamcommunity.com/id/<name> or /profiles/<steamid64>).
  steam: {
    profileUrl: 'https://steamcommunity.com/profiles/76561199164379614/',
    personaName: 'CRYPT-hack',
    // Shown on the Steam app's shelf. Hours are yours to fill in; leave 0 to hide.
    favorites: [
      { title: 'Counter-Strike 2', hours: 0, note: 'Aim like I debug: one shot at a time' },
      { title: 'Forza Horizon 5', hours: 0, note: 'Why there is a racing game in my repos' },
      { title: 'Minecraft', hours: 0, note: 'Redstone was my first circuit board' },
      { title: 'Valorant', hours: 0, note: 'Ranked in patience' },
    ],
  },

  // Spotify. `profileUrl` = https://open.spotify.com/user/<id>.
  // `embed` = any open.spotify.com playlist / album / track / artist URL; when
  // set, the music app shows Spotify's official embed player for it.
  spotify: {
    profileUrl: '',
    embed: '',
    // Shown as "on repeat" even when nothing is linked yet.
    onRepeat: [
      { title: 'Late-night coding mix', artist: 'Lo-fi, synthwave, phonk' },
      { title: 'Race-day playlist', artist: 'Drum & bass' },
      { title: 'Focus', artist: 'Ambient / instrumental' },
    ],
  },

  // Facts that the About app, terminal and resume all draw from.
  skills: {
    languages: ['JavaScript', 'TypeScript', 'Python', 'C', 'C++'],
    web: ['Three.js', 'WebGL / GLSL', 'React', 'Vite', 'Node', 'Express', 'GSAP'],
    ai: ['PyTorch', 'RF-DETR', 'LLM agents', 'MCP'],
    tools: ['Git', 'MongoDB', 'Docker', 'Linux', 'PowerShell'],
  },
  interests: ['Generative graphics', 'Developer tools', 'Computer vision', 'Racing games', 'Music while coding'],
  education: [
    // { school: 'Your university', degree: 'B.Tech, Computer Science', years: '2024 – 2028' },
  ],
  experience: [
    { role: 'Builder', org: 'Independent projects', years: '2025 – now', text: 'Shipping open-source tools, 3D visualisations and AI pipelines; 20+ repositories since October 2025.' },
  ],
};

/** Filled-in social links, in display order. */
export function socialLinks() {
  const l = profile.links;
  const out = [];
  if (l.github) out.push({ id: 'github', label: 'GitHub', href: l.github });
  if (profile.steam.profileUrl) out.push({ id: 'steam', label: 'Steam', href: profile.steam.profileUrl });
  if (profile.spotify.profileUrl) out.push({ id: 'spotify', label: 'Spotify', href: profile.spotify.profileUrl });
  if (l.linkedin) out.push({ id: 'linkedin', label: 'LinkedIn', href: l.linkedin });
  if (l.x) out.push({ id: 'x', label: 'X', href: l.x });
  if (l.instagram) out.push({ id: 'instagram', label: 'Instagram', href: l.instagram });
  if (l.email) out.push({ id: 'email', label: 'Email', href: `mailto:${l.email}` });
  return out;
}
