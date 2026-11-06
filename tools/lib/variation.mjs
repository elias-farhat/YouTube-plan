import { createHash } from 'node:crypto';
import { PALETTES } from './palettes.mjs';

export function seedFromText(s) {
  return parseInt(createHash('sha1').update(s).digest('hex').slice(0, 8), 16);
}
export function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const LAYOUTS = {
  A: { stage: { x: 60, y: 250, w: 960, h: 950 }, capY: 1370 }, // visual on top, captions below
  B: { stage: { x: 60, y: 560, w: 960, h: 940 }, capY: 385 },  // captions on top, visual below
  C: { stage: { x: 60, y: 250, w: 960, h: 1000 }, capY: 1420 }, // taller visual, captions low
};
export const PACING = {
  snappy: { speed: 0.92, trans: 8, gap: 0.16, chunk: 3, zoom: 0.05, spring: { damping: 14, stiffness: 190 }, rate: '+8%' },
  steady: { speed: 1.0, trans: 11, gap: 0.28, chunk: 4, zoom: 0.09, spring: { damping: 16, stiffness: 140 }, rate: '+0%' },
  cinematic: { speed: 1.1, trans: 16, gap: 0.4, chunk: 4, zoom: 0.15, spring: { damping: 20, stiffness: 90 }, rate: '-6%' },
};
export const TRANSITIONS = ['fade', 'slide', 'wipe', 'zoom', 'push'];
export const CAPTIONS = { money: ['pop', 'bar', 'underline'], space: ['glow', 'pop', 'bar'], history: ['serif', 'bar', 'glow'], science: ['glow', 'pop', 'bar'] };
export const KINETIC = ['pop', 'slide', 'drop', 'stack'];
export const MOTIFS = { money: ['grid', 'coins', 'bars'], space: ['stars', 'nebula', 'streak'], history: ['graticule', 'compass', 'paper'], science: ['stars', 'nebula', 'streak'] };
export const HEADERS = ['chip', 'line', 'banner'];
export const ORIENT = ['v', 'h'];
export const NAMES = { money: 'MONEY EXPLAINED', space: 'SPACE & SCIENCE', history: 'HISTORY IN MOTION', science: 'SCIENCE WITH DR. BIT' };
export const HANDLES = { money: '@CentsAndSense', space: '@CosmicBits', history: '@MapsOfTime', science: '@DrBitScience' };

const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
const mixHex = (a, b) => { const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16); const c = (s) => Math.round((((x >> s) & 255) + ((y >> s) & 255)) / 2); return lum('#' + [16, 8, 0].map((s) => c(s).toString(16).padStart(2, '0')).join('')); };

export function pickStyle(channel, seed, overrides = {}) {
  const r = rng(seed * 7919 + channel.length * 131);
  const choose = (arr, key) => {
    const v = overrides[key];
    if (v !== undefined) {
      if (!arr.includes(v)) throw new Error(`style.${key}: "${v}" is not valid for ${channel}; choose from ${arr.join(', ')}`);
      return v;
    }
    return arr[Math.floor(r() * arr.length)];
  };
  const names = Object.keys(PALETTES[channel]);
  const paletteName = overrides.palette ?? names[seed % names.length];
  if (!PALETTES[channel][paletteName]) throw new Error(`style.palette: "${paletteName}" unknown for ${channel}; choose from ${names.join(', ')}`);
  const pal = { ...PALETTES[channel][paletteName] };
  const bgLum = mixHex(pal.bgTop, pal.bgBot);
  pal.hl = Math.abs(lum(pal.accent) - bgLum) > 0.3 ? pal.accent : pal.accent2;
  pal.onHl = lum(pal.hl) > 0.5 ? '#0e0e14' : '#ffffff';
  const layout = choose(Object.keys(LAYOUTS), 'layout');
  const pacing = choose(Object.keys(PACING), 'pacing');
  return {
    seed, paletteName, palette: pal, layout, ...LAYOUTS[layout],
    pacing, pace: PACING[pacing],
    caption: overrides.caption === 'pixel' ? 'pixel' : choose(CAPTIONS[channel], 'caption'),   // pixel captions are opt-in (they match the pixel scenes)
    transition: choose(TRANSITIONS, 'transition'),
    kinetic: choose(KINETIC, 'kinetic'),
    motif: choose(MOTIFS[channel], 'motif'),
    header: choose(HEADERS, 'header'),
    orient: choose(ORIENT, 'orient'),
    pill: ((seed >> 3) & 1) === 1,
  };
}
export function describeStyle(s) {
  return `${s.paletteName}/${s.layout}/${s.pacing}/${s.caption}/${s.transition}/${s.kinetic}/${s.motif}/${s.header}`;
}
