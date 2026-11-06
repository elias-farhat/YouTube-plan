import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {SceneProps} from './common';

/**
 * Retro pixel-art scene on a small canvas scaled up with hard pixels, locked to a BPM.
 *   bits: 32 (default, ~216 px wide, rich shading, 5 shades per colour)  |  16 (128 px, 4 shades)  |  8 (80 px, 4 Game-Boy greens)
 * visual: {type: pixel, scene: planets|rocket, bits: 32, palette: neon|sunset|aurora|gameboy, bpm: 120,
 *          lyrics: ["MERCURY IS HOT", ...], title: "PLANET SONG", res: 216}      one lyric per bar (4 beats)
 */
type Pal = {sky: string[]; neb: [string, string]; hi: string; a: string; b: string; c: string; text: string; panel: string; limit?: string[]};
const PALS: Record<string, Pal> = {
  neon: {sky: ['#05001a', '#0c0533', '#190a4d', '#2d1068'], neb: ['#6a1bd6', '#ff2a6d'], hi: '#d9f7ff', a: '#ff2a6d', b: '#05d9e8', c: '#ffd23f', text: '#ffffff', panel: '#07001f'},
  sunset: {sky: ['#14092e', '#2f1670', '#8e1a9e', '#e0287a'], neb: ['#ff8a00', '#ffd60a'], hi: '#fff3b0', a: '#ff5d73', b: '#ffb703', c: '#ffe66d', text: '#fff8e1', panel: '#14092e'},
  aurora: {sky: ['#020b12', '#052a2e', '#07483f', '#0b6a50'], neb: ['#18d6a0', '#3a7bff'], hi: '#e6fff6', a: '#5cffb0', b: '#4aa8ff', c: '#ffe27a', text: '#f3fffa', panel: '#020b12'},
  gameboy: {sky: ['#0f380f', '#0f380f', '#306230', '#306230'], neb: ['#306230', '#8bac0f'], hi: '#9bbc0f', a: '#8bac0f', b: '#8bac0f', c: '#9bbc0f', text: '#9bbc0f', panel: '#0f380f', limit: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f']},
};
const PRESET = {8: {res: 80, levels: 3}, 16: {res: 128, levels: 4}, 32: {res: 216, levels: 5}} as const;

// ---- colour helpers
const toRGB = (h: string): [number, number, number] => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const toHex = (c: number[]) => '#' + c.map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
const mix = (a: string, b: string, t: number) => { const x = toRGB(a), y = toRGB(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };
const ramp = (base: string, n: number) => Array.from({length: n}, (_, i) => { const k = i / (n - 1); return k < 0.5 ? mix('#000000', base, 0.3 + 1.4 * k) : mix(base, '#ffffff', (k - 0.5) * 0.9); });

// ---- 5x7 pixel font
const G: Record<string, string> = {};
const def = (ch: string, rows: string) => { G[ch] = rows.replace(/\s+/g, ''); };
def('A', '.###. #...# #...# ##### #...# #...# #...#'); def('B', '####. #...# #...# ####. #...# #...# ####.'); def('C', '.#### #.... #.... #.... #.... #.... .####');
def('D', '####. #...# #...# #...# #...# #...# ####.'); def('E', '##### #.... #.... ####. #.... #.... #####'); def('F', '##### #.... #.... ####. #.... #.... #....');
def('G', '.#### #.... #.... #..## #...# #...# .####'); def('H', '#...# #...# #...# ##### #...# #...# #...#'); def('I', '##### ..#.. ..#.. ..#.. ..#.. ..#.. #####');
def('J', '..### ...#. ...#. ...#. ...#. #..#. .##..'); def('K', '#...# #..#. #.#.. ##... #.#.. #..#. #...#'); def('L', '#.... #.... #.... #.... #.... #.... #####');
def('M', '#...# ##.## #.#.# #.#.# #...# #...# #...#'); def('N', '#...# ##..# ##..# #.#.# #..## #..## #...#'); def('O', '.###. #...# #...# #...# #...# #...# .###.');
def('P', '####. #...# #...# ####. #.... #.... #....'); def('Q', '.###. #...# #...# #...# #.#.# #..#. .##.#'); def('R', '####. #...# #...# ####. #.#.. #..#. #...#');
def('S', '.#### #.... #.... .###. ....# ....# ####.'); def('T', '##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..'); def('U', '#...# #...# #...# #...# #...# #...# .###.');
def('V', '#...# #...# #...# #...# #...# .#.#. ..#..'); def('W', '#...# #...# #...# #.#.# #.#.# ##.## #...#'); def('X', '#...# #...# .#.#. ..#.. .#.#. #...# #...#');
def('Y', '#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..'); def('Z', '##### ....# ...#. ..#.. .#... #.... #####');
def('0', '.###. #...# #..## #.#.# ##..# #...# .###.'); def('1', '..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.'); def('2', '.###. #...# ....# ...#. ..#.. .#... #####');
def('3', '.###. #...# ....# ..##. ....# #...# .###.'); def('4', '...#. ..##. .#.#. #..#. ##### ...#. ...#.'); def('5', '##### #.... ####. ....# ....# #...# .###.');
def('6', '..##. .#... #.... ####. #...# #...# .###.'); def('7', '##### ....# ...#. ..#.. .#... .#... .#...'); def('8', '.###. #...# #...# .###. #...# #...# .###.');
def('9', '.###. #...# #...# .#### ....# ...#. .##..');
def('.', '..... ..... ..... ..... ..... ..#.. ..#..'); def(',', '..... ..... ..... ..... ..#.. ..#.. .#...'); def('!', '..#.. ..#.. ..#.. ..#.. ..#.. ..... ..#..');
def('?', '.###. #...# ....# ...#. ..#.. ..... ..#..'); def(':', '..... ..#.. ..#.. ..... ..#.. ..#.. .....'); def('-', '..... ..... ..... ##### ..... ..... .....');
def("'", '..#.. ..#.. ..... ..... ..... ..... .....'); def('+', '..... ..#.. ..#.. ##### ..#.. ..#.. .....'); def(' ', '.................................');

const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const hash2 = (x: number, y: number) => hash(x * 57.3 + y * 131.9);
const smooth = (t: number) => t * t * (3 - 2 * t);
const vnoise = (x: number, y: number) => { const xi = Math.floor(x), yi = Math.floor(y), xf = smooth(x - xi), yf = smooth(y - yi); const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1); return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf; };
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bayer = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)];

export const Pixel: React.FC<SceneProps> = ({v, plan, at = 0}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ref = React.useRef<HTMLCanvasElement>(null);
  const {w, h} = plan.style.stage;
  const bits: 8 | 16 | 32 = v.bits ?? 32;
  const preset = PRESET[bits] ?? PRESET[32];
  const R = v.res ?? preset.res, RH = Math.round((R * h) / w);
  const L = preset.levels;
  const t = frame / fps;
  const bpm = v.bpm ?? plan.bpm ?? 120;
  const beats = ((at + t) * bpm) / 60;
  const beatIdx = Math.floor(beats), phase = beats - beatIdx;
  const kick = Math.exp(-phase * 6);
  const palName = v.palette ?? (bits === 8 ? 'gameboy' : 'neon');
  const P = PALS[palName] ?? PALS.neon;
  const scene = v.scene ?? 'planets';
  const lyrics: string[] = v.lyrics ?? [];
  const sc = R / 216;                                   // everything is laid out for 216 px and scaled

  React.useLayoutEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext('2d', {willReadFrequently: true})!;
    ctx.imageSmoothingEnabled = false;
    const near = (hex: string) => {
      if (!P.limit) return hex;
      const c = toRGB(hex); let best = P.limit[0], bd = 1e9;
      for (const q of P.limit) { const d = toRGB(q).reduce((s, x, i) => s + (x - c[i]) ** 2, 0); if (d < bd) { bd = d; best = q; } }
      return best;
    };
    const dot = (x: number, y: number, c: string) => { ctx.fillStyle = near(c); ctx.fillRect(Math.round(x), Math.round(y), 1, 1); };
    const rect = (x: number, y: number, ww: number, hh: number, c: string) => { ctx.fillStyle = near(c); ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(ww)), Math.max(1, Math.round(hh)), ); };

    // ---------------------------------------------------------------- background: dithered sky + drifting nebula
    const img = ctx.createImageData(R, RH);
    const sky = P.sky.map(toRGB), nA = toRGB(P.neb[0]), nB = toRGB(P.neb[1]);
    const drift = t * 0.6 + beats * 0.02;
    for (let y = 0; y < RH; y++) {
      for (let x = 0; x < R; x++) {
        const gy = (y / RH) * (sky.length - 1), gi = Math.floor(gy), gf = gy - gi;
        const band = gf > bayer(x, y) ? Math.min(sky.length - 1, gi + 1) : gi;
        let c: [number, number, number] = sky[band];
        const n = vnoise((x / R) * 4 + drift, (y / RH) * 5 - drift * 0.5) * 0.65 + vnoise((x / R) * 9 - drift * 0.7, (y / RH) * 11) * 0.35;
        if (n > 0.56 + bayer(x + 2, y + 1) * 0.12) c = (n > 0.68 ? nB.map((q, i) => q * 0.38 + c[i] * 0.62) : nA.map((q, i) => q * 0.28 + c[i] * 0.72)) as [number, number, number];
        if (P.limit) { const hx = near(toHex(c)); c = toRGB(hx); }
        const o = (y * R + x) * 4; img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
      }
    }
    // 1 px screen kick on every bar's downbeat
    const bar = Math.floor(beats / 4), onBar = beatIdx % 4 === 0 && phase < 0.16;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.putImageData(img, 0, 0);
    if (onBar) ctx.setTransform(1, 0, 0, 1, beatIdx % 8 === 0 ? 1 : -1, 1);
    if (beatIdx % 4 === 0 && phase < 0.05) { ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(-2, -2, R + 4, RH + 4); }

    // ---------------------------------------------------------------- stars: three parallax layers + sparkles
    for (let i = 0; i < Math.round(70 * sc + 20); i++) {
      const layer = 1 + (i % 3), spd = (4 + kick * 3) * layer * sc;
      const x = Math.floor(hash(i) * R), y = Math.floor((hash(i + 77) * RH + t * spd) % RH);
      const tw = (beatIdx + i) % 7 === 0 && phase < 0.6;
      dot(x, y, tw || layer === 3 ? P.hi : mix(P.hi, '#000000', layer === 2 ? 0.45 : 0.7));
      if (layer === 3 && i % 5 === 0) { dot(x - 1, y, mix(P.hi, '#000000', 0.55)); dot(x + 1, y, mix(P.hi, '#000000', 0.55)); dot(x, y - 1, mix(P.hi, '#000000', 0.55)); dot(x, y + 1, mix(P.hi, '#000000', 0.55)); }
    }

    // ---------------------------------------------------------------- sprites
    const light = (dx: number, dy: number, r: number) => (dx * -0.55 + dy * -0.62) / r;          // -1 (shadow) .. 1 (lit)
    /** shaded sphere; kind: plain | earth | gas | moon | mars */
    const sphere = (cx: number, cy: number, r: number, base: string, kind = 'plain', spin = 0) => {
      const rp = ramp(base, L), rw = ramp('#2f6fe0', L), rg = ramp('#3a9a3c', L), rc = ramp('#ffffff', L);
      const ri = Math.ceil(r);
      for (let y = -ri; y <= ri; y++) for (let x = -ri; x <= ri; x++) {
        const d = Math.hypot(x, y);
        if (d > r) continue;
        const z = Math.sqrt(Math.max(0, 1 - (d / r) ** 2));
        let lit = (light(x, y, r) * 0.5 + 0.5) * 0.8 + z * 0.25;                                 // 0..1
        lit += (bayer(Math.round(cx) + x, Math.round(cy) + y) - 0.5) * (1 / L);                 // ordered dither between shades
        let idx = Math.max(0, Math.min(L - 1, Math.floor(lit * L)));
        let col = rp[idx];
        if (kind === 'earth') {
          const lon = Math.asin(x / r) / 1.57 + spin, lat = y / r;
          const land = vnoise(lon * 3.2 + 5, lat * 2.6 + 2) * 0.7 + vnoise(lon * 7, lat * 6) * 0.3 > 0.56;
          col = land ? rg[idx] : rw[idx];
          if (Math.abs(lat) > 0.86) col = rc[idx];
          if (vnoise(lon * 5 + 20 + spin * 0.6, lat * 4) > 0.7) col = rc[Math.min(L - 1, idx + 1)];
        } else if (kind === 'gas') {
          const band = Math.floor(((y / r) * 0.5 + 0.5) * 9 + Math.sin(x * 0.35 + spin * 4) * 0.6);
          col = ramp(band % 3 === 0 ? mix(base, '#7a3b1c', 0.55) : band % 3 === 1 ? base : mix(base, '#ffffff', 0.3), L)[idx];
          if (Math.hypot(x - r * 0.25, y - r * 0.25) < r * 0.2) col = ramp('#c43b2a', L)[idx];
        } else if (kind === 'moon') {
          const cr = vnoise(x * 0.5 + 9, y * 0.5 + 4); col = rp[Math.max(0, idx - (cr > 0.7 ? 1 : 0))];
        } else if (kind === 'mars') {
          const ice = Math.abs(y / r) > 0.88; col = ice ? rc[idx] : rp[Math.max(0, idx - (vnoise(x * 0.4 + spin * 3, y * 0.4) > 0.62 ? 1 : 0))];
        }
        dot(cx + x, cy + y, col);
      }
    };
    const ringsOf = (cx: number, cy: number, r: number, front: boolean) => {
      for (let a = front ? 0 : Math.PI; a < (front ? Math.PI : 2 * Math.PI); a += 0.025) for (const k of [1.55, 1.7, 1.85]) {
        dot(cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k * 0.32, k === 1.7 ? mix('#e8d8a8', '#000000', 0.35) : '#e8d8a8');
      }
    };

    if (scene === 'rocket') {
      for (let i = 0; i < 3; i++) {
        const sp = 0.9 + i * 0.45, py = ((t * 16 * sp + i * RH * 0.37) % (RH + 80 * sc)) - 40 * sc;
        const px = i === 1 ? R * 0.8 : R * (0.15 + 0.12 * i);
        sphere(px, py, (11 + i * 6) * sc, [P.a, P.b, P.c][i], ['mars', 'plain', 'gas'][i], t * 0.15);
      }
      for (let i = 0; i < 16; i++) { const x = Math.floor(hash(i + 9) * R), y = Math.floor((hash(i + 20) * RH + t * 150 * sc * (1 + kick)) % RH); rect(x, y, 1, (5 + kick * 8) * sc, mix(P.hi, '#000000', 0.4)); }
      const cx = Math.round(R / 2 + Math.sin(beats * 0.9) * 8 * sc), cy = Math.round(RH * 0.38 + Math.sin(beats * 1.6) * 3 * sc);
      // flame: layered, flickering, bigger on the kick
      for (let i = 0; i < 26; i++) {
        const life = ((t * 5 + i / 26 + hash(i) * 0.3) % 1), fy = cy + 22 * sc + life * (26 + kick * 22) * sc, fx = cx + (hash(i * 3) - 0.5) * 10 * sc * (1 - life * 0.6);
        dot(fx, fy, life < 0.25 ? '#ffffff' : life < 0.55 ? P.c : life < 0.8 ? P.a : mix(P.a, '#000000', 0.6));
        if (life < 0.5) dot(fx + 1, fy, life < 0.25 ? '#fff6c8' : P.c);
      }
      // rocket: shaded body, nose cone, window, fins
      const body = ramp('#dfe6f2', L), red = ramp(P.a, L);
      for (let y = -22; y <= 22; y++) {
        const half = y < -10 ? Math.round(2 + (y + 22) * 0.55) : y > 14 ? Math.round(7 - (y - 14) * 0.25) : 7;
        for (let x = -half; x <= half; x++) { const s = Math.max(0, Math.min(L - 1, Math.floor((0.65 - (x + 8) / 22 + (y < -12 ? 0.18 : 0)) * L + 0.5))); dot(cx + Math.round(x * sc), cy + Math.round(y * sc), (y < -10 ? red : body)[L - 1 - s]); }
      }
      for (let y = 4; y < 22; y++) for (let k = 0; k < Math.round((y - 2) * 0.6); k++) { dot(cx - Math.round((8 + k) * sc), cy + Math.round(y * sc), red[1 + (k % 2)]); dot(cx + Math.round((8 + k) * sc), cy + Math.round(y * sc), red[1 + ((k + 1) % 2)]); }
      sphere(cx, cy - 2 * sc, 4.5 * sc, P.b, 'plain');
    } else {
      // ---------------- planets: a lit solar system, orbiting on the beat
      const cx = R / 2, sy = RH * 0.27, flat = 0.55;
      const lanes = [R * 0.13, R * 0.2, R * 0.28, R * 0.35, R * 0.43];
      lanes.forEach((r) => { for (let a = 0; a < 6.283; a += 0.04) if (Math.round(a * 25) % 2 === 0) dot(cx + Math.cos(a) * r, sy + Math.sin(a) * r * flat, mix(P.hi, '#000000', 0.8)); });
      // sun: gradient disc + animated corona
      const sr = Math.round(R * 0.062 + kick * 2);
      const sunR = ramp('#ffb000', L);
      for (let a = 0; a < 6.283; a += 0.05) { const len = sr * (0.5 + 0.35 * Math.sin(a * 7 + t * 4) + 0.25 * Math.sin(a * 3 - t * 2) + 0.35 * kick); for (let d = sr; d < sr + len + 2; d++) dot(cx + Math.cos(a) * d, sy + Math.sin(a) * d, d < sr + len * 0.5 ? P.c : mix(P.a, '#000000', 0.5)); }
      for (let y = -sr; y <= sr; y++) for (let x = -sr; x <= sr; x++) { const d = Math.hypot(x, y); if (d > sr) continue; const q = d / sr; const gran = vnoise(x * 0.4 + t * 2, y * 0.4) > 0.6 ? 0.08 : 0; dot(cx + x, sy + y, q < 0.35 ? '#fff6c8' : sunR[Math.max(0, Math.min(L - 1, Math.floor((1 - q + gran) * L * 0.95 + (bayer(x + 99, y) - 0.5))))]); }
      // planets sorted by depth
      type Pl = {x: number; y: number; r: number; base: string; kind: string; ring?: boolean; moon?: boolean};
      const defs: [number, number, string, string, number, boolean?][] = [[0, 0.5, '#9a9a9a', 'moon', 0.55], [1, 0.48, '#f0c070', 'plain', 0.4], [2, 0.5, '#2f6fe0', 'earth', 0.3, true], [3, 0.38, '#c8553d', 'mars', 0.22], [4, 0.95, '#d9a066', 'gas', 0.12], [4, 0.8, '#e8c88a', 'plain', 0.09, true]];
      const pls: Pl[] = defs.map(([li, rr, base, kind, om, ring], i) => {
        const a = hash(i + 4) * 6.283 + beats * om * 0.8, r = lanes[li] * (i === 5 ? 0.93 : 1);
        const bounce = beatIdx % (i + 2) === 0 && phase < 0.22 ? 1 : 0;
        return {x: cx + Math.cos(a) * r, y: sy + Math.sin(a) * r * flat, r: R * 0.034 * rr * 2 + bounce, base, kind, ring: kind === 'plain' && ring && i === 5, moon: kind === 'earth'};
      }).sort((p, q) => p.y - q.y);
      pls.forEach((p) => {
        const spin = beats * 0.05;
        if (p.ring) ringsOf(p.x, p.y, p.r, false);
        sphere(p.x, p.y, p.r, p.base, p.kind, spin);
        if (p.ring) ringsOf(p.x, p.y, p.r, true);
        if (p.moon) { const ma = beats * 1.2; sphere(p.x + Math.cos(ma) * p.r * 2.1, p.y + Math.sin(ma) * p.r * 0.9, p.r * 0.32, '#b8b8b8', 'moon'); }
      });
    }

    // ---------------------------------------------------------------- equalizer with peaks + reflection
    const nb = Math.max(12, Math.round(30 * sc)), bw = Math.floor(R / nb), base = RH - Math.round(10 * sc), maxH = Math.round(RH * 0.15);
    for (let k = 0; k < nb; k++) {
      const hgt = Math.max(2, Math.round(maxH * (0.12 + 0.88 * hash(k * 3.1 + beatIdx * 7.7)) * (0.4 + 0.6 * (kick * 0.75 + 0.25))));
      const x = Math.floor((R - nb * bw) / 2) + k * bw;
      for (let y = 0; y < hgt; y++) {
        const q = y / maxH, c = q > 0.7 ? P.a : q > 0.4 ? P.c : P.b;
        rect(x, base - y, bw - 1, 1, y === hgt - 1 ? P.hi : (y % 3 === 2 ? mix(c, '#000000', 0.35) : c));
        if (y < hgt * 0.4) rect(x, base + 2 + y * 0.5, bw - 1, 1, mix(c, '#000000', 0.7));
      }
    }

    // ---------------------------------------------------------------- text (5x7 font, outlined, on a dark panel)
    const CH = 6;
    const textW = (s: string, k: number) => (s.length * CH - 1) * k;
    const wrap = (s: string, k: number) => { const out: string[] = []; let cur = ''; for (const wd of s.split(' ')) { const tr = (cur + ' ' + wd).trim(); if (textW(tr, k) <= R - 12 || !cur) cur = tr; else { out.push(cur); cur = wd; } } if (cur) out.push(cur); return out; };
    const glyph = (chr: string, x: number, y: number, k: number, c: string) => { const g = G[chr] ?? G[' ']; for (let i = 0; i < 35; i++) if (g[i] === '#') rect(x + (i % 5) * k, y + Math.floor(i / 5) * k, k, k, c); };
    const draw = (s: string, x: number, y: number, k: number, c: string) => {
      let cx = x;
      for (const chr of s.toUpperCase()) {
        for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) glyph(chr, cx + ox, y + oy, k, '#000000');   // outline
        glyph(chr, cx + 1, y + k, k, mix(c, '#000000', 0.55));                                                                                    // drop shadow
        glyph(chr, cx, y, k, c);
        cx += CH * k;
      }
    };
    if (lyrics.length) {
      const line = lyrics[((bar % lyrics.length) + lyrics.length) % lyrics.length];
      let k = Math.max(1, Math.round(2.4 * sc)); let lines = wrap(line, k);
      if (lines.length > 2 && k > 1) { k -= 1; lines = wrap(line, k); }
      const lh = 9 * k, top = Math.round(RH * 0.56), ph = lines.length * lh + 8;
      ctx.fillStyle = near(P.panel); ctx.globalAlpha = 0.82; ctx.fillRect(4, top - 4, R - 8, ph); ctx.globalAlpha = 1;       // readability panel
      rect(4, top - 4, R - 8, 1, P.a); rect(4, top - 4 + ph - 1, R - 8, 1, P.b);
      const reveal = Math.min(line.length, Math.floor(((beats % 4) / 1.6) * line.length) + 1);
      let shown = 0;
      lines.forEach((ln, i) => {
        const part = ln.slice(0, Math.max(0, reveal - shown)); shown += ln.length + 1;
        draw(part, Math.round((R - textW(ln, k)) / 2), top + i * lh, k, kick > 0.55 ? P.hi : P.text);
      });
    }
    if (v.title) { const k = Math.max(1, Math.round(1.4 * sc)); const s = String(v.title); draw(s, Math.round((R - textW(s, k)) / 2), Math.round(4 * sc), k, P.c); }
  }, [frame, R, RH, palName, scene, bpm, at, bits]);

  return <div style={{position: 'absolute', inset: 0, borderRadius: 38, overflow: 'hidden', border: `4px solid ${plan.style.palette.accent2}`, boxSizing: 'border-box', background: '#000'}}>
    <canvas ref={ref} width={R} height={RH} style={{width: '100%', height: '100%', imageRendering: 'pixelated', display: 'block'}} />
  </div>;
};
