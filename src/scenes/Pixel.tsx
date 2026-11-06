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
  pulsar: {sky: ['#02030c', '#050a24', '#08153f', '#0c2260'], neb: ['#1c4bd0', '#18d6ff'], hi: '#e6fbff', a: '#ff4fa3', b: '#37e6ff', c: '#ffe27a', text: '#ffffff', panel: '#02030c'},
  storm: {sky: ['#04050d', '#080c1f', '#101a3a', '#1b2a55'], neb: ['#2a3a7a', '#4a5a9a'], hi: '#e8f0ff', a: '#ffe27a', b: '#7fb0ff', c: '#fff6a8', text: '#ffffff', panel: '#04050d'},
  day: {sky: ['#4aa8ff', '#74c0ff', '#a5dbff', '#d8f1ff'], neb: ['#ffffff', '#e6f6ff'], hi: '#ffffff', a: '#ff8a3c', b: '#2f9bff', c: '#ffe14a', text: '#ffffff', panel: '#0a2a4a'},
  gameboy: {sky: ['#0f380f', '#0f380f', '#306230', '#306230'], neb: ['#306230', '#8bac0f'], hi: '#9bbc0f', a: '#8bac0f', b: '#8bac0f', c: '#9bbc0f', text: '#9bbc0f', panel: '#0f380f', limit: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f']},
};
const PRESET = {8: {res: 80, levels: 3}, 16: {res: 128, levels: 4}, 32: {res: 216, levels: 5}} as const;

// ---- colour helpers
const toRGB = (h: string): [number, number, number] => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const toHex = (c: number[]) => '#' + c.map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
const mix = (a: string, b: string, t: number) => { const x = toRGB(a), y = toRGB(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };
const ramp = (base: string, n: number) => Array.from({length: n}, (_, i) => { const k = i / (n - 1); return k < 0.5 ? mix('#000000', base, 0.3 + 1.4 * k) : mix(base, '#ffffff', (k - 0.5) * 0.9); });

import {FONT as G} from '../lib/pixelfont';

const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const hash2 = (x: number, y: number) => hash(x * 57.3 + y * 131.9);
const smooth = (t: number) => t * t * (3 - 2 * t);
const vnoise = (x: number, y: number) => { const xi = Math.floor(x), yi = Math.floor(y), xf = smooth(x - xi), yf = smooth(y - yi); const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1); return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf; };
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bayer = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)];

export const Pixel: React.FC<SceneProps> = ({v, plan, dur, at = 0}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ref = React.useRef<HTMLCanvasElement>(null);
  const {x: stX, y: stY, w: stW, h: stH} = plan.style.stage;
  const full = !!v.full;                                   // fill the whole 1080x1920 frame instead of the stage box
  const w = full ? 1080 : stW, h = full ? 1920 : stH;
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
  const sc = R / 216;
  const pr = Math.min(1, t / Math.max(0.5, dur));         // progress through this scene (0..1)
  const eqOn = v.eq ?? (scene === 'planets' || scene === 'rocket');                                   // everything is laid out for 216 px and scaled

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
        if (n > (v.full ? 0.62 : 0.56) + bayer(x + 2, y + 1) * 0.12) c = (n > 0.72 ? nB.map((q, i) => q * (v.full ? 0.2 : 0.38) + c[i] * (v.full ? 0.8 : 0.62)) : nA.map((q, i) => q * (v.full ? 0.16 : 0.28) + c[i] * (v.full ? 0.84 : 0.72))) as [number, number, number];
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
    for (let i = 0; i < (v.stars ?? palName !== 'day' ? Math.round(70 * sc + 20) : 0); i++) {
      const layer = 1 + (i % 3), spd = (4 + kick * 3) * layer * sc;
      const x = Math.floor(hash(i) * R), y = Math.floor((hash(i + 77) * RH + t * spd) % RH);
      const tw = (beatIdx + i) % 7 === 0 && phase < 0.6;
      dot(x, y, tw || layer === 3 ? P.hi : mix(P.hi, '#000000', layer === 2 ? 0.45 : 0.7));
      if (layer === 3 && i % 5 === 0) { dot(x - 1, y, mix(P.hi, '#000000', 0.55)); dot(x + 1, y, mix(P.hi, '#000000', 0.55)); dot(x, y - 1, mix(P.hi, '#000000', 0.55)); dot(x, y + 1, mix(P.hi, '#000000', 0.55)); }
    }

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

    const cx0 = R / 2, cy0 = Math.round(full ? RH * 0.37 : RH * 0.46);
    const EL: Record<string, string> = {H: '#6fa8ff', HE: '#ffe27a', C: '#ff9a3c', O: '#ff4a4a', FE: '#c8ccd8', CA: '#f4f1e6', N: '#8be0ff'};
    const ease = (x: number) => { const q = Math.max(0, Math.min(1, x)); return q * q * (3 - 2 * q); };
    const easeO = (x: number) => 1 - (1 - Math.max(0, Math.min(1, x))) ** 3;
    /** glowing star: dithered halo + animated corona + shaded, granulated disc */
    const star = (cx: number, cy: number, sr: number, base: string, boost = 0) => {
      const rr = ramp(base, L);
      const halo = sr * 2.3;
      for (let y = -Math.ceil(halo); y <= Math.ceil(halo); y++) for (let x = -Math.ceil(halo); x <= Math.ceil(halo); x++) {
        const d = Math.hypot(x, y); if (d <= sr || d > halo) continue;
        const a = (1 - (d - sr) / (halo - sr)) ** 2.2 * (0.55 + boost);
        if (a > bayer(Math.round(cx) + x, Math.round(cy) + y)) dot(cx + x, cy + y, mix(base, '#000000', 0.45 + 0.4 * (d - sr) / (halo - sr)));
      }
      for (let a = 0; a < 6.283; a += 0.05) { const len = sr * (0.45 + 0.3 * Math.sin(a * 7 + t * 4) + 0.22 * Math.sin(a * 3 - t * 2) + 0.35 * kick + boost); for (let d = sr; d < sr + len + 1; d++) dot(cx + Math.cos(a) * d, cy + Math.sin(a) * d, d < sr + len * 0.5 ? mix(base, '#ffffff', 0.4) : mix(base, '#000000', 0.4)); }
      for (let y = -Math.ceil(sr); y <= Math.ceil(sr); y++) for (let x = -Math.ceil(sr); x <= Math.ceil(sr); x++) {
        const d = Math.hypot(x, y); if (d > sr) continue;
        const q = d / sr, gran = vnoise(x * 0.4 + t * 2, y * 0.4 - t) > 0.6 ? 0.1 : 0;
        dot(cx + x, cy + y, q < 0.3 ? mix(base, '#ffffff', 0.85) : rr[Math.max(0, Math.min(L - 1, Math.floor((1 - q + gran) * L * 0.98 + (bayer(x + 99, y) - 0.5))))]);
      }
    };
    const LAYERS: [string, string][] = [['H', EL.H], ['HE', EL.HE], ['C', EL.C], ['O', EL.O], ['FE', EL.FE]];
    const onion = (cx: number, cy: number, r0: number, reveal: number, flicker = true) => {
      LAYERS.forEach(([sym, col], j) => {
        if (reveal < j + 1e-6 && j > 0 && reveal < j) return;
        const rj = r0 * (1 - j * 0.19), age = Math.min(1, reveal - j);
        const rr = rj * (j === 0 ? 1 : Math.min(1, 0.5 + age * 0.5));
        const cr = ramp(col, L);
        for (let y = -Math.ceil(rr); y <= Math.ceil(rr); y++) for (let x = -Math.ceil(rr); x <= Math.ceil(rr); x++) {
          const d = Math.hypot(x, y); if (d > rr) continue;
          const k2 = 1 - d / rr + (bayer(Math.round(cx) + x, Math.round(cy) + y) - 0.5) * 0.4;
          dot(cx + x, cy + y, d > rr - 1 ? mix(col, '#000000', 0.7) : cr[Math.max(0, Math.min(L - 1, Math.floor(k2 * L * 0.9 + 0.8)))]);
          if (flicker && vnoise(x * 0.5 + t * 3, y * 0.5 - j) > 0.78 && d < rr - 2) dot(cx + x, cy + y, mix(col, '#ffffff', 0.55));
        }
      });
    };

    // ------------------------------------------------------------------ pulsar family
    const beam = (cx: number, cy: number, ang: number, len: number, wid: number, c1: string, c2: string) => {
      const ca = Math.cos(ang), sa = Math.sin(ang);
      for (let d = 5; d < len; d++) {
        const w = wid * (0.12 + 0.88 * d / len);
        for (let off = -w; off <= w; off++) {
          const a = Math.abs(off) / w, alpha = (1 - d / len) ** 0.8 * (1 - a * a);
          const px = cx + ca * d - sa * off, py = cy + sa * d + ca * off;
          if (alpha > bayer(Math.round(px), Math.round(py))) dot(px, py, a < 0.35 ? c1 : c2);
        }
      }
    };
    const pulsarAt = (cx: number, cy: number, ang: number, sz: number, len: number, wid: number) => {
      for (const k of [0, Math.PI]) beam(cx, cy, ang + k, len, wid, '#ffffff', P.b);
      for (let a = 0; a < 6.283; a += 0.1) { const rr = sz * (2.6 + kick * 0.8); dot(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, mix(P.b, '#000000', 0.55)); }
      for (let f = 0; f < 3; f++) for (let a = 0; a < 6.283; a += 0.12) { const r1 = sz * (1.6 + f * 1.1), x = Math.cos(a) * r1, y = Math.sin(a) * r1 * 0.55, ra = ang + 1.57; dot(cx + x * Math.cos(ra) - y * Math.sin(ra), cy + x * Math.sin(ra) + y * Math.cos(ra), mix(P.hi, '#000000', 0.62)); }
      sphere(cx, cy, sz + kick * 0.8, '#bfeaff', 'plain');
      dot(cx, cy, '#ffffff');
    };
    // ================================================================== science scenes
    const gy = Math.round(RH * 0.55);
    const lineD = (x0: number, y0: number, x1: number, y1: number, c: string) => { const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)))); for (let i = 0; i <= n; i++) dot(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c); };
    const blob = (bx: number, by: number, r: number, base: string) => { const rp = ramp(base, L); for (let y = -Math.ceil(r); y <= Math.ceil(r); y++) for (let x = -Math.ceil(r); x <= Math.ceil(r); x++) { const d = Math.hypot(x, y); if (d > r) continue; const lit = (1 - (y / r + 1) / 2) * 0.7 + (1 - d / r) * 0.3 + (bayer(Math.round(bx) + x, Math.round(by) + y) - 0.5) * 0.35; dot(bx + x, by + y, rp[Math.max(0, Math.min(L - 1, Math.floor(lit * L)))]); } };
    const cloudAt = (cx: number, cy: number, w: number, h: number, base: string, seed = 0) => { const n = Math.max(3, Math.round(w / 12)); for (let i = 0; i < n; i++) blob(cx - w / 2 + ((i + 0.5) * w) / n, cy + (hash(i + 7 + seed) - 0.5) * h * 0.35, h * (0.42 + 0.3 * hash(i + seed)), base); };
    const boltPts = (x0: number, y0: number, x1: number, y1: number, seed: number): [number, number][] => {
      const pts: [number, number][] = [[x0, y0]]; const steps = Math.max(2, Math.ceil((y1 - y0) / 6)); let x = x0;
      for (let i = 1; i <= steps; i++) { const f = i / steps; x += (x0 + (x1 - x0) * f - x) * 0.55 + (hash(seed * 17 + i * 3.1) - 0.5) * 11 * (1 - f * 0.6); pts.push([x, y0 + (y1 - y0) * f]); }
      pts[pts.length - 1] = [x1, y1]; return pts;
    };
    const boltDraw = (pts: [number, number][], from: number, to: number, core: string, halo: string) => {
      const a = Math.max(1, from), b = Math.min(to, pts.length - 1);
      for (let i = a; i <= b; i++) { lineD(pts[i - 1][0] - 1, pts[i - 1][1], pts[i][0] - 1, pts[i][1], halo); lineD(pts[i - 1][0] + 1, pts[i - 1][1], pts[i][0] + 1, pts[i][1], halo); }
      for (let i = a; i <= b; i++) lineD(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], core);
    };
    const branchesOf = (pts: [number, number][], seed: number) => [0.3, 0.5, 0.7].map((k, i) => { const b0 = pts[Math.floor(pts.length * k)], dir = hash(seed + i) > 0.5 ? 1 : -1; return boltPts(b0[0], b0[1], b0[0] + dir * (12 + hash(i + seed) * 12), b0[1] + 20 + hash(i + 3 + seed) * 10, seed + i * 9); });
    const groundDraw = (col = '#08111f', grass = '#1d3a2a') => { rect(0, gy, R, RH - gy, col); for (let x = 0; x < R; x++) { if (hash(x) > 0.5) dot(x, gy, grass); dot(x, gy + 1, mix(grass, '#000000', 0.5)); } };
    const treeAt = (x: number, base: number, h: number, c: string, d: string) => { rect(x - 1, base - h * 0.4, 3, h * 0.4, '#3b2a1a'); for (let k = 0; k < 3; k++) { const w = h * (0.34 - k * 0.07), yy = base - h * 0.32 - k * h * 0.2; for (let r = 0; r < h * 0.3; r++) { const ww = w * (1 - r / (h * 0.3)); rect(x - ww, yy - r, ww * 2 + 1, 1, r % 3 === 0 ? d : c); } } };
    const rain = (n: number) => { for (let i = 0; i < n; i++) { const x = hash(i * 1.3) * R, y = (hash(i + 4) * RH + t * 190) % gy; dot(x, y, '#6f9be0'); dot(x - 1, y + 2, '#3a5a9a'); } };
    const plusAt = (x: number, y: number, c: string) => { dot(x, y, c); dot(x - 1, y, c); dot(x + 1, y, c); dot(x, y - 1, c); dot(x, y + 1, c); };
    const minusAt = (x: number, y: number, c: string) => { dot(x - 1, y, c); dot(x, y, c); dot(x + 1, y, c); };
    const flashOver = (a: number) => { if (a > 0.02) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.9, a)})`; ctx.fillRect(-4, -4, R + 8, RH + 8); } };
    const tx = Math.round(R * 0.64), tyTop = gy - 36, boltSeed = 3;
    const along = (path: [number, number][], f: number): [number, number] => { const n = path.length - 1, k = Math.max(0, Math.min(n - 1e-6, f * n)), i = Math.floor(k), q = k - i; return [path[i][0] + (path[i + 1][0] - path[i][0]) * q, path[i][1] + (path[i + 1][1] - path[i][1]) * q]; };
    const co2 = (x: number, y: number, k = 1) => { sphere(x - 4 * k, y, 1.8 * k, '#ff4a4a', 'plain'); sphere(x + 4 * k, y, 1.8 * k, '#ff4a4a', 'plain'); sphere(x, y, 2.3 * k, '#6a6a76', 'plain'); };
    const sunAt = (x: number, y: number, r: number) => star(x, y, r, '#ffd23f', 0);

    if (scene === 'storm') {
      const ph = v.phase ?? 'strike';
      if (ph === 'strike') {
        cloudAt(R * 0.5, RH * 0.09, R * 1.2, RH * 0.14, '#303a62', 1); cloudAt(R * 0.2, RH * 0.17, R * 0.7, RH * 0.08, '#222a4a', 5); cloudAt(R * 0.82, RH * 0.16, R * 0.6, RH * 0.08, '#222a4a', 9);
        rain(70); groundDraw(); treeAt(R * 0.3, gy, 26, '#14301f', '#0c2014'); treeAt(tx, gy, 40, '#14301f', '#0c2014');
        const ts = 0.08, k = Math.max(0, Math.floor((t - ts) / 1.0)), age = t - ts - k;
        if (t >= ts) {
          const pts = boltPts(R * 0.5 + (hash(k) - 0.5) * 24, RH * 0.15, tx, tyTop, boltSeed + k), f = Math.max(0, 1 - age / 0.6);
          if (f > 0) { const core = mix(P.b, '#ffffff', f), halo = mix('#0a1a44', P.b, f); boltDraw(pts, 1, pts.length, core, halo); branchesOf(pts, boltSeed + k).forEach((b) => boltDraw(b, 1, b.length, core, halo)); }
          flashOver(Math.exp(-age * 9) * 0.8);
          if (age < 0.3) ctx.setTransform(1, 0, 0, 1, Math.round((hash(frame) - 0.5) * 5 * (1 - age / 0.3)), Math.round((hash(frame + 3) - 0.5) * 4 * (1 - age / 0.3)));
        }
      } else if (ph === 'ice') {
        cloudAt(R * 0.5, RH * 0.28, R * 1.3, RH * 0.5, '#202a4c', 2);
        for (let i = 0; i < 16; i++) { const x = R * (0.12 + 0.76 * hash(i)), y = RH * 0.5 - ((t * 15 * (0.6 + hash(i + 2)) + hash(i + 4) * RH * 0.5) % (RH * 0.46)); [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => dot(x + dx, y + dy, dx || dy ? P.b : '#ffffff')); }
        for (let i = 0; i < 12; i++) { const x = R * (0.1 + 0.8 * hash(i + 20)), y = RH * 0.06 + ((t * 24 * (0.6 + hash(i + 22)) + hash(i + 24) * RH * 0.5) % (RH * 0.46)); blob(x, y, 2.6, '#9fc0ff'); }
        for (let k = 0; k < 6; k++) { const te = 0.7 + k * 0.7, a = t - te; if (a < 0 || a > 0.5) continue; const x = R * (0.2 + 0.6 * hash(k + 50)), y = RH * (0.14 + 0.28 * hash(k + 60)), q = a / 0.5;
          for (let an = 0; an < 6.283; an += 0.5) { lineD(x + Math.cos(an) * 2, y + Math.sin(an) * 2, x + Math.cos(an) * (4 + q * 8), y + Math.sin(an) * (4 + q * 8), mix('#ffe27a', '#000000', q * 0.7)); }
          plusAt(x + 9, y - 9 - q * 4, mix('#ff7aa8', '#000000', q * 0.6)); minusAt(x - 10, y + 8 + q * 4, mix('#7fe3ff', '#000000', q * 0.6)); }
        [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => dot(14 + dx, 22 + dy, dx || dy ? P.b : '#ffffff')); draw('ICE', 22, 19, 1, P.hi); blob(14, 36, 2.6, '#9fc0ff'); draw('HAIL', 22, 33, 1, P.hi);
      } else if (ph === 'charge') {
        cloudAt(R * 0.5, RH * 0.17, R * 1.1, RH * 0.28, '#2c3558', 3); groundDraw();
        for (let i = 0; i < 30; i++) { const x = R * (0.12 + 0.76 * hash(i)), a = ease(pr * 1.7 - hash(i + 9) * 0.6); if (a <= 0) continue; plusAt(x, RH * (0.05 + 0.07 * hash(i + 3)), '#ff7aa8'); minusAt(x + 2, RH * (0.2 + 0.08 * hash(i + 7)), '#7fe3ff'); }
        for (let i = 0; i < 14; i++) { const a = ease((pr - 0.45) * 3 - hash(i) * 0.4); if (a > 0) plusAt(R * (i + 0.5) / 14, gy + 6 + (i % 2) * 5, '#ff7aa8'); }
        if (pr > 0.72) for (let i = 0; i < 9; i++) { const x = R * (0.1 + 0.8 * i / 8); for (let yy = gy - 2; yy > RH * 0.34; yy -= 5) if (Math.round(yy + t * 30) % 10 < 4) dot(x, yy, mix('#ffe27a', '#000000', 0.4)); }
        draw('+', R - 18, 10, 2, '#ff7aa8'); draw('-', R - 18, 40, 2, '#7fe3ff');
      } else if (ph === 'leader' || ph === 'return') {
        cloudAt(R * 0.5, RH * 0.1, R * 1.1, RH * 0.16, '#303a62', 1); rain(40); groundDraw(); treeAt(R * 0.3, gy, 26, '#14301f', '#0c2014'); treeAt(tx, gy, 40, '#14301f', '#0c2014');
        const pts = boltPts(R * 0.5 + 6, RH * 0.17, tx, tyTop, boltSeed), N = pts.length - 1, brs = branchesOf(pts, boltSeed);
        if (ph === 'leader') {
          const n = Math.min(N, Math.floor(pr * 1.1 * N / 3) * 3);
          boltDraw(pts, 1, n, '#7fb0ff', '#143064'); brs.forEach((b) => boltDraw(b, 1, Math.floor(b.length * Math.min(1, pr * 1.2)), '#4a78c8', '#10224a'));
          if (n < N) { const [px, py] = pts[n]; sphere(px, py, 2 + kick, '#cfe6ff', 'plain'); }
          const len = 3 + 16 * ease((pr - 0.4) / 0.55);
          for (let i = 0; i < 6; i++) lineD(tx + (i - 2.5) * 2, tyTop, tx + (i - 2.5) * 3.4, tyTop - len * (0.55 + 0.45 * hash(i)), '#ff9ac0');
          draw('LEADER', 10, 46, 1, '#9fc8ff'); draw('STREAMERS', tx - 22, tyTop - 26, 1, '#ff9ac0');
          if (n >= N - 3) { sphere(tx, tyTop, 4, '#ffffff', 'plain'); }
        } else {
          const t0 = 0.15, f = easeO((t - t0) / 0.5), headIdx = Math.round((1 - f) * N), age = Math.max(0, t - t0 - 0.5);
          boltDraw(pts, 1, N, '#7fb0ff', '#143064');
          if (t >= t0) {
            const fade = Math.max(0, 1 - age / 1.2), core = mix(P.b, '#ffffff', fade), halo = mix('#0a1a44', '#7fe3ff', fade);
            boltDraw(pts, Math.max(1, headIdx), N, core, halo); brs.forEach((b) => boltDraw(b, 1, b.length, mix('#4a78c8', '#ffffff', fade * f), halo));
            const [hx, hy] = pts[Math.max(0, headIdx)]; if (f < 1) sphere(hx, hy, 3, '#ffffff', 'plain');
            for (let a = 0; a < 3; a++) { const ay = gy - 12 - ((t * 60 + a * 36) % (gy - 20)), ax = tx + 14; lineD(ax, ay, ax, ay - 6, '#ffe27a'); lineD(ax - 3, ay - 3, ax, ay - 7, '#ffe27a'); lineD(ax + 3, ay - 3, ax, ay - 7, '#ffe27a'); }
            flashOver(Math.exp(-(t - t0) * 6) * 0.85);
            if (t - t0 < 0.45) ctx.setTransform(1, 0, 0, 1, Math.round((hash(frame) - 0.5) * 6), Math.round((hash(frame + 3) - 0.5) * 5));
            if (t > 0.7) draw('UP!', tx + 18, gy - 60 + Math.round(Math.sin(beats * 6) * 1), 3, '#ffe27a');
          }
        }
      } else if (ph === 'heat') {
        const baseY = Math.round(RH * 0.5), maxH = RH * 0.4, sx = Math.round(R * 0.3), lx = Math.round(R * 0.7);
        rect(10, baseY, R - 20, 2, '#3a4a7a');
        const g1 = easeO(pr * 2.2), g2 = easeO(pr * 1.7 - 0.15), sh = maxH * (5500 / 30000) * g1, lh = maxH * g2;
        for (let y = 0; y < sh; y++) rect(sx - 13, baseY - y, 26, 1, y % 4 === 3 ? '#a8481c' : '#ff8a2c');
        for (let y = 0; y < lh; y++) rect(lx - 13, baseY - y, 26, 1, y > lh - 4 ? '#ffffff' : y % 4 === 3 ? '#5a7ad0' : mix('#7fb0ff', '#ffffff', y / maxH));
        sunAt(sx, baseY - sh - 12, 5); draw('5,500 C', sx - 22, baseY - sh - 32, 1, '#ffd23f'); draw('SUN', sx - 8, baseY + 8, 2, '#ffb347');
        if (g2 > 0.5) { draw('30,000 C', lx - 28, baseY - lh - 14, 1, '#ffffff'); for (let i = 0; i < 8; i++) dot(lx - 10 + hash(i + Math.floor(t * 20)) * 20, baseY - lh - 2 - hash(i + 3 + Math.floor(t * 20)) * 8, '#e8f6ff'); }
        draw('BOLT', lx - 13, baseY + 8, 2, '#9fc8ff');
        if (g2 > 0.92) { const sc2 = 1 + 0.12 * kick; draw('5X', Math.round(R / 2 - 12 * sc2), Math.round(RH * 0.26), 4, '#ffe27a'); }
      } else if (ph === 'thunder') {
        groundDraw(); const bx = Math.round(R * 0.3), pts = boltPts(bx, RH * 0.04, bx, gy, 7), fade = Math.max(0, 1 - t / 0.5);
        if (fade > 0) boltDraw(pts, 1, pts.length, mix(P.b, '#ffffff', fade), mix('#0a1a44', P.b, fade)); flashOver(Math.exp(-t * 8) * 0.6);
        for (let k = 0; k < 5; k++) { const r = t * 34 - k * 13; if (r < 2) continue; for (let a = Math.PI; a < 2 * Math.PI + 0.02; a += 0.04) for (let th = 0; th < 2; th++) dot(bx + Math.cos(a) * (r - th), gy - 2 + Math.sin(a) * (r - th) * 0.9, mix('#bfe0ff', '#000000', Math.min(0.85, r / (R * 0.8) + k * 0.1))); }
        const fx = Math.round(R * 0.84), hit = t * 34 > fx - bx - 8;
        rect(fx - 3, gy - 20, 7, 7, '#e8c8a0'); rect(fx - 4, gy - 13, 9, 13, '#4a78c8'); rect(fx - 5, gy - 22 - (hit ? 2 : 0), 11, 3, '#2a2f4a');
        if (hit) { draw('BOOM', fx - 34, gy - 50 + Math.round((hash(frame) - 0.5) * 3), 3, '#ffe27a'); }
      } else if (ph === 'count') {
        groundDraw(); for (let x = 0; x < R; x++) { const mh = 10 + 8 * Math.sin(x * 0.06) + 6 * Math.sin(x * 0.17); for (let y = 0; y < mh; y++) dot(x, gy - y, mix('#10203a', '#08111f', y / mh)); }
        const bx = Math.round(R * 0.14), ts = 0.5, a = t - ts;
        if (a >= 0 && a < 0.8) { const pts = boltPts(bx, RH * 0.14, bx, gy - 4, 5), f = 1 - a / 0.8; boltDraw(pts, 1, pts.length, mix(P.b, '#ffffff', f), mix('#0a1a44', P.b, f)); flashOver(Math.exp(-a * 9) * 0.5); }
        const fx = Math.round(R * 0.84); rect(fx - 3, gy - 20, 7, 7, '#e8c8a0'); rect(fx - 4, gy - 13, 9, 13, '#4a78c8'); rect(fx - 5, gy - 22, 11, 3, '#2a2f4a');
        const r = Math.max(0, (t - ts) / 3.0) * (fx - bx - 6);
        if (a > 0) for (let an = -1.2; an < 1.2; an += 0.06) dot(bx + Math.cos(an) * r, gy - 14 + Math.sin(an) * r * 0.6, mix('#bfe0ff', '#000000', 0.5));
        const nn = t < 1.5 ? 0 : t < 2.5 ? 1 : t < 3.5 ? 2 : 3;
        if (nn > 0) { const kk = Math.max(0, 1 - ((t - 0.5) % 1) * 0 ); draw(String(nn), Math.round(R / 2 - 15), Math.round(RH * 0.1), 6, nn === 3 ? '#ffe27a' : '#ffffff'); }
        if (t > 3.6) { draw('3 S = 1 KM', Math.round(R / 2 - 30), Math.round(RH * 0.34), 2, '#ffe27a'); }
        if (t > 3.5) draw('BOOM', fx - 34, gy - 50, 2, '#ffe27a');
      }
    } else if (scene === 'plant') {
      const ph = v.phase ?? 'tree';
      const hillY = (x: number) => Math.round(RH * 0.5 + Math.sin(x * 0.04) * 3);
      const grassDraw = () => { for (let x = 0; x < R; x++) { const yy = hillY(x); rect(x, yy, 1, RH - yy, '#6b4a2a'); dot(x, yy, '#4ec85a'); dot(x, yy + 1, '#2f9a3a'); if (hash(x) > 0.6) dot(x, yy - 1, '#4ec85a'); for (let y = yy + 3; y < RH; y += 3) if (hash(x * 3 + y) > 0.8) dot(x, y, '#4f3820'); } };
      const treeP = (x: number, base: number, h: number, sway: number) => {
        rect(x - Math.max(2, h * 0.07), base - h * 0.5, Math.max(4, h * 0.14), h * 0.5, '#6b4a2a'); rect(x - Math.max(2, h * 0.07), base - h * 0.5, 2, h * 0.5, '#4f3820');
        [[0, -0.62, 0.3], [-0.2, -0.52, 0.22], [0.2, -0.52, 0.22], [-0.1, -0.78, 0.22], [0.12, -0.74, 0.2]].forEach(([dx, dy, rr]) => blob(x + dx * h + sway, base + dy * h, rr * h, '#3aa845'));
      };
      if (ph === 'tree') {
        grassDraw(); sunAt(R * 0.84, RH * 0.09, 9);
        const sway = Math.sin(beats * 0.6) * 1.5; treeP(R * 0.5, hillY(R * 0.5), 92, sway);
        const target: [number, number] = [R * 0.5 + sway, RH * 0.5 - 92 * 0.65];
        for (let i = 0; i < 16; i++) { const fr = (t * 0.3 + i / 16) % 1, sx = R * (0.04 + 0.92 * hash(i)), sy = RH * (0.05 + 0.2 * hash(i + 4)); if (fr > 0.94) continue; const e = ease(fr), x = sx + (target[0] - sx) * e, y = sy + (target[1] - sy) * e + Math.sin(fr * 6 + i) * 3; if (Math.hypot(x - target[0], y - target[1]) > 22) co2(x, y, 1.25); }
        draw('CO2', 10, RH * 0.04, 2, '#ffffff');
      } else if (ph === 'sunleaf') {
        const lcx = Math.round(R / 2), lcy = Math.round(RH * 0.32), rx = R * 0.44, ry = RH * 0.2;
        for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y++) for (let x = -Math.ceil(rx); x <= Math.ceil(rx); x++) { const d = Math.hypot(x / rx, y / ry); if (d > 1) continue; const sh = (1 - (y / ry + 1) / 2) * 0.6 + (bayer(x + 40, y + 40) - 0.5) * 0.3; dot(lcx + x, lcy + y, ramp('#3aa845', L)[Math.max(0, Math.min(L - 1, Math.floor((0.35 + sh) * L)))]); }
        lineD(lcx - rx, lcy, lcx + rx, lcy, '#b6f0a0'); for (let k = -4; k <= 4; k++) { if (!k) continue; lineD(lcx + k * rx * 0.2, lcy, lcx + k * rx * 0.2 + rx * 0.12, lcy - ry * 0.5, '#7fd87a'); lineD(lcx + k * rx * 0.2, lcy, lcx + k * rx * 0.2 + rx * 0.12, lcy + ry * 0.5, '#7fd87a'); }
        sunAt(R * 0.88, RH * 0.07, 9);
        const cp: [number, number][] = [[-0.55, -0.35], [-0.2, 0.3], [0.1, -0.4], [0.45, 0.25], [0.65, -0.2], [-0.8, 0.05]].map(([a, b]) => [lcx + a * rx * 0.8, lcy + b * ry * 0.8]);
        cp.forEach(([x, y], i) => { const hitA = (t * 0.9 + i / 6) % 1; const glow = hitA > 0.93 ? 1 : 0; for (let yy = -5; yy <= 5; yy++) for (let xx = -8; xx <= 8; xx++) if ((xx / 8) ** 2 + (yy / 5) ** 2 <= 1) dot(x + xx, y + yy, glow ? '#c8ff8a' : (yy % 3 === 0 ? '#2f8a3a' : '#1d6b2a')); if (glow) sphere(x, y, 3, '#fff6a8', 'plain'); });
        cp.forEach(([x, y], i) => { const s2 = (t * 0.9 + i / 6) % 1, px = R * 0.88 + (x - R * 0.88) * s2, py = RH * 0.07 + (y - RH * 0.07) * s2; for (let k = 0; k < 6; k++) { const q = Math.max(0, s2 - k * 0.025); dot(R * 0.88 + (x - R * 0.88) * q, RH * 0.07 + (y - RH * 0.07) * q, k ? mix('#ffe14a', '#4aa8ff', k / 6) : '#ffffff'); } });
        draw('CHLOROPLAST', Math.round(cp[1][0] - 28), Math.round(cp[1][1] + 12), 1, '#ffffff');
      } else if (ph === 'roots') {
        const soilY = Math.round(RH * 0.3);
        for (let y = soilY; y < RH; y++) for (let x = 0; x < R; x++) dot(x, y, ((x + y * 2) & 3) === 0 ? '#4f3820' : hash(x * 7 + y) > 0.93 ? '#8a6a44' : '#6b4a2a');
        for (let x = 0; x < R; x++) { dot(x, soilY, '#4ec85a'); dot(x, soilY - 1, hash(x) > 0.5 ? '#4ec85a' : '#2f9a3a'); }
        const cx1 = Math.round(R / 2); const stem: [number, number][] = [[cx1, soilY], [cx1 + 2, RH * 0.18], [cx1, RH * 0.04]];
        for (let y = RH * 0.04; y < soilY; y++) { rect(cx1 - 2 + Math.round(Math.sin(y * 0.1)), y, 4, 1, '#3aa845'); } blob(cx1 - 14, RH * 0.12, 8, '#4ec85a'); blob(cx1 + 14, RH * 0.17, 8, '#4ec85a'); blob(cx1, RH * 0.05, 7, '#4ec85a');
        const roots: [number, number][][] = [[[cx1, soilY], [cx1 - 4, soilY + 26], [cx1 - 2, soilY + 60]], [[cx1 - 2, soilY + 14], [cx1 - 30, soilY + 28], [cx1 - 52, soilY + 52]], [[cx1 + 2, soilY + 12], [cx1 + 28, soilY + 30], [cx1 + 54, soilY + 50]], [[cx1 - 3, soilY + 34], [cx1 - 20, soilY + 56], [cx1 - 28, soilY + 76]], [[cx1 + 2, soilY + 38], [cx1 + 22, soilY + 60], [cx1 + 30, soilY + 80]]];
        roots.forEach((r) => { for (let i = 1; i < r.length; i++) { lineD(r[i - 1][0], r[i - 1][1], r[i][0], r[i][1], '#c89a64'); lineD(r[i - 1][0] + 1, r[i - 1][1], r[i][0] + 1, r[i][1], '#8a6a44'); } });
        for (let i = 0; i < 30; i++) { const rt = roots[i % roots.length], f = (t * 0.35 + i / 30) % 1; const pos: [number, number] = f < 0.55 ? along(rt.slice().reverse(), f / 0.55) : along(stem, (f - 0.55) / 0.45); blob(pos[0], pos[1], 1.6, '#5fb8ff'); dot(pos[0] - 1, pos[1] - 1, '#ffffff'); }
        draw('WATER', 8, soilY + 48, 1, '#9fd8ff');
      } else if (ph === 'stomata') {
        for (let y = 0; y < RH * 0.62; y++) for (let x = 0; x < R; x++) dot(x, y, ((x + y) & 3) === 0 ? '#2f9a3a' : '#3aa845');
        const sx = Math.round(R / 2), sy = Math.round(RH * 0.33), open = 0.5 + 0.5 * Math.sin(beats * Math.PI * 0.5), gap = 2 + 9 * open;
        for (const dir of [-1, 1]) for (let a = -1.45; a < 1.45; a += 0.03) for (let th = 0; th < 9; th++) { const rr = 24 - th; dot(sx + dir * (gap / 2 + 9 - Math.cos(a) * 9 + th * 0.2) * 1.0 + dir * 0, sy + Math.sin(a) * rr * 0.95, th < 2 ? '#1d6b2a' : th > 6 ? '#bff0a8' : '#7be07a'); }
        rect(sx - gap / 2, sy - 22, gap, 44, '#0a2a12');
        for (let i = 0; i < 8; i++) { const fr = (t * 0.28 + i / 8) % 1, x = sx + Math.sin(i * 2.1 + fr * 5) * (6 + gap * 0.3), y = RH * 0.04 + fr * (sy - 10 - RH * 0.04); co2(x, y, 1.1); }
        draw('CO2', sx + 40, RH * 0.1, 2, '#ffffff'); draw('PORE', sx + 22, sy + 30, 1, '#ffffff');
      } else if (ph === 'split') {
        for (let y = 0; y < RH * 0.62; y++) for (let x = 0; x < R; x++) dot(x, y, hash(x * 0.3 + y) > 0.9 ? '#2f8a3a' : ((x + y) & 3) === 0 ? '#1d6b2a' : '#256f30');
        for (let k = 0; k < 5; k++) { rect(10, RH * 0.16 + k * 12, 34, 6, '#4ec85a'); rect(10, RH * 0.16 + k * 12, 34, 1, '#b6f0a0'); }
        const cxm = Math.round(R * 0.5), cym = Math.round(RH * 0.34), s0 = 0.15, a = t - s0;
        for (let m = 0; m < 3; m++) {
          const ox2 = (m - 1) * 56, mt = a - m * 0.55, oy2 = (m % 2) * 14;
          if (mt < -0.4) continue;
          if (mt < 0.5) { const x = cxm + ox2, y = cym + oy2; sphere(x, y, 5, '#ff4a4a', 'plain'); sphere(x - 6, y + 5, 3, '#ffffff', 'plain'); sphere(x + 6, y + 5, 3, '#ffffff', 'plain'); if (m === 0 && mt < 0.5) draw('H2O', x - 10, y - 16, 1, '#9fd8ff'); }
          if (mt > 0 && mt < 0.5) for (let k = 0; k < 4; k++) { const q = mt / 0.5, x = cxm + ox2 - 80 * 0 + 0, ly = RH * 0.02 + 0; lineD(R * 0.88 - 0, RH * 0.04, cxm + ox2 + (k - 2) * 1, cym + oy2 - 6, mix('#ffe14a', '#ffffff', k / 4)); }
          if (mt >= 0.5) { const q = Math.min(1, (mt - 0.5) / 1.4), x = cxm + ox2, y = cym + oy2; sphere(x - 3 - q * 6, y - q * 52, 4, '#ff4a4a', 'plain'); sphere(x + 4 - q * 6, y - q * 52, 4, '#ff4a4a', 'plain'); if (m === 0) draw('O2', x - 14 - q * 6, y - q * 52 - 14, 2, '#ffffff'); for (let h = 0; h < 2; h++) sphere(x + (h ? 8 : -8) + q * (30 + h * 14), y + 6 + q * 18, 2.4, '#ffffff', 'plain'); }
        }
        sunAt(R * 0.88, RH * 0.05, 8);
      } else if (ph === 'sugar') {
        for (let y = 0; y < RH * 0.62; y++) for (let x = 0; x < R; x++) dot(x, y, hash(x * 0.3 + y) > 0.92 ? '#2f8a3a' : ((x + y) & 3) === 0 ? '#1d6b2a' : '#256f30');
        const cxm = Math.round(R / 2), cym = Math.round(RH * 0.3), rr = 26;
        const ring = Array.from({length: 6}, (_, i) => [cxm + Math.cos((i / 6) * 6.283 - 1.57) * rr, cym + Math.sin((i / 6) * 6.283 - 1.57) * rr] as [number, number]);
        const done = Math.min(6, pr * 8);
        ring.forEach(([x, y], i) => { const a2 = Math.min(1, done - i); if (a2 <= 0) return; const sx = i % 2 ? R + 10 : -10, e = ease(a2), px = sx + (x - sx) * e, py = (RH * 0.05) + (y - RH * 0.05) * e; if (i > 0 && a2 >= 1) lineD(ring[i - 1][0], ring[i - 1][1], x, y, '#d8d8e4'); sphere(px, py, 4, '#6a6a76', 'plain'); if (a2 >= 1) { draw('C', Math.round(px - 2), Math.round(py - 3), 1, '#ffffff'); } });
        if (done >= 6) { lineD(ring[5][0], ring[5][1], ring[0][0], ring[0][1], '#d8d8e4'); sphere(cxm, cym, rr * 0.55 + kick * 2, '#ffe14a', 'plain'); draw('SUGAR', Math.round(cxm - 14), Math.round(cym - 4), 1, '#6a3a00'); draw('C6H12O6', Math.round(cxm - 21), Math.round(cym + rr + 14), 1, '#ffffff'); }
      } else if (ph === 'grow') {
        grassDraw(); sunAt(R * 0.84, RH * 0.09, 9);
        const g = ease(pr * 1.15), h = 18 + 78 * g; treeP(R * 0.5, hillY(R * 0.5), h, Math.sin(beats * 0.6) * 1.2);
        for (let i = 0; i < 10; i++) { const fr = (t * 0.5 + i / 10) % 1, x = R * 0.5, y = hillY(x) - h * (0.65 - 0.65 * fr); blob(x + Math.sin(i + fr * 5) * 4, y, 1.4, '#ffe14a'); }
        for (let i = 0; i < 10; i++) { const fr = (t * 0.3 + i / 10) % 1, sx = R * (0.04 + 0.92 * hash(i)), sy = RH * (0.05 + 0.2 * hash(i + 4)), tg: [number, number] = [R * 0.5, hillY(R * 0.5) - h * 0.65]; if (fr < 0.92) co2(sx + (tg[0] - sx) * ease(fr), sy + (tg[1] - sy) * ease(fr), 1.1); }
      }
    } else if (scene === 'pulsar') {
      const ang = beats * Math.PI + (v.offset ?? 0);
      const ex = R * 0.88, ey = cy0;                                  // a small Earth on the right: the beam hits it on every beat
      pulsarAt(cx0, cy0, ang, R * 0.035, R * 0.72, R * 0.07);
      const hit = Math.exp(-phase * 7);
      sphere(ex, ey, R * 0.035, '#2f6fe0', 'earth', t * 0.1);
      if (hit > 0.12) for (let a = 0; a < 6.283; a += 0.18) dot(ex + Math.cos(a) * (R * 0.05 + (1 - hit) * 8), ey + Math.sin(a) * (R * 0.05 + (1 - hit) * 8), mix(P.hi, '#000000', 1 - hit));
      dot(ex - 2, ey - 2, P.hi);
    } else if (scene === 'pulsars') {
      const rows: [string, string, number, number, string][] = [['VELA', '11 HZ', 0.7, 0.2, EL.H], ['CRAB', '30 HZ', 1.9, 0.5, '#ffe27a'], ['FASTEST', '716 HZ', 5.1, 0.8, '#ff4fa3']];
      rows.forEach(([name, hz, spd, at0, col], i) => {
        const g = ease((pr - at0 * 0.35 - i * 0.12) / 0.2); if (g <= 0) return;
        const y = RH * (0.13 + i * 0.165), x = R * 0.26;
        pulsarAt(x, y, beats * Math.PI * spd, R * 0.022, R * 0.2 * g, R * 0.025);
        draw(name, Math.round(R * 0.5), Math.round(y - 12), 1, mix(col, '#ffffff', 0.35));
        draw(hz, Math.round(R * 0.5), Math.round(y - 1), 2, col);
      });
    } else if (scene === 'plaque') {
      const gold = '#e8c06a', gd = mix(gold, '#000000', 0.5);
      if (v.phase !== 'map') {
        // Pioneer 10: big shaded dish with ribs, feed struts, hex bus, booms, and the gold plaque glinting on the beat
        const px = R * (0.34 + 0.12 * easeO(pr)) + Math.sin(beats * 0.5) * 2, py = cy0 + Math.sin(beats * 0.4) * 3;
        for (let i = 0; i < 22; i++) rect((hash(i) * R + R - (t * 110 * (0.5 + hash(i + 8))) % R) % R, hash(i + 3) * RH * 0.62, 6 + hash(i) * 14, 1, mix(P.hi, '#000000', 0.7));
        const rx = R * 0.105, ry = R * 0.17, dc = ramp('#cfd6e6', L);
        for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y++) for (let x = -Math.ceil(rx); x <= Math.ceil(rx); x++) {
          const d = Math.hypot(x / rx, y / ry); if (d > 1) continue;
          const sh = Math.max(0, Math.min(L - 1, Math.floor((0.35 + (x / rx) * 0.55 - Math.abs(y / ry) * 0.2 + (bayer(x + 50, y) - 0.5) * 0.3) * L)));
          dot(px + x, py + y, Math.round(d * 9) % 3 === 0 ? mix(dc[sh], '#000000', 0.25) : dc[sh]);   // concentric ribs
        }
        for (let a = 0; a < 6.283; a += 0.03) dot(px + Math.cos(a) * rx, py + Math.sin(a) * ry, '#ffffff');
        const fx = px + R * 0.17, fy = py;                                                       // feed horn in front of the dish
        for (const sy of [-ry * 0.92, 0, ry * 0.92]) for (let k = 0; k <= 30; k++) dot(px + (fx - px) * k / 30, py + sy + (fy - py - sy) * k / 30 + (sy === 0 ? 0 : 0), '#9aa3b4');
        rect(fx - 1, fy - 3, 6, 7, '#8a93a6'); rect(fx - 1, fy - 3, 6, 1, '#ffffff');
        const bx = px + R * 0.03, by = py - 7;                                                    // hex bus behind the dish centre
        rect(bx, by, 20, 15, '#9aa3b4'); rect(bx, by, 20, 2, '#ffffff'); rect(bx + 3, by + 4, 14, 8, '#6c768a');
        for (let k = 0; k < 40; k++) { dot(bx + 20 + k, by + 4 - Math.floor(k * 0.05), '#c4cad8'); dot(bx + 20 + k, by + 12 + Math.floor(k * 0.05), '#c4cad8'); }
        rect(bx + 58, by + 1, 12, 7, '#7a8296'); rect(bx + 58, by + 9, 12, 7, '#7a8296');         // RTG power packs on the booms
        const plx = px + R * 0.075, ply = py + ry * 0.62;                                          // the plaque, on the lower strut
        rect(plx, ply, 13, 9, '#e8c06a'); rect(plx + 1, ply + 1, 11, 7, '#8a6a2a'); rect(plx, ply, 13, 1, '#fff0c0');
        for (let k = 0; k < 5; k++) { rect(plx + 3 + k * 1.6, ply + 2 + (k % 2) * 3, 1, 2, '#e8c06a'); }
        if (phase < 0.35) { const gl = 3 + Math.round(phase * 14); for (let k = -gl; k <= gl; k++) { dot(plx + 6 + k, ply + 4, '#ffffff'); dot(plx + 6, ply + 4 + k, '#ffffff'); } }
        draw('PIONEER 10', Math.round(R * 0.5 - 30), Math.round(RH * 0.07), 1, P.hi); draw('1972', Math.round(R * 0.5 - 12), Math.round(RH * 0.07 + 11), 1, gold);
      } else {
        // the plaque's pulsar map: the Sun in the middle, 14 lines to 14 pulsars, binary tick marks for each spin rate
        const x0 = 14, y0 = Math.round(RH * 0.04), pw = R - 28, ph = Math.round(RH * 0.55);
        rect(x0, y0, pw, ph, '#0a0e22'); for (let k = 0; k < 2; k++) rect(x0 + k, y0 + k, pw - 2 * k, 1, gold), rect(x0 + k, y0 + ph - 1 - k, pw - 2 * k, 1, gold), rect(x0 + k, y0 + k, 1, ph - 2 * k, gold), rect(x0 + pw - 1 - k, y0 + k, 1, ph - 2 * k, gold);
        const mx = x0 + pw / 2 + 6, my = y0 + ph / 2;
        const angs = [20, 48, 75, 100, 128, 150, 172, 195, 215, 238, 262, 290, 318, 345], lens = [0.22, 0.35, 0.28, 0.4, 0.18, 0.33, 0.26, 0.38, 0.2, 0.3, 0.42, 0.24, 0.36, 0.31];
        const beatsPer = 60 / bpm, per = Math.max(0.16, Math.min(0.5, (dur - 0.8) / 15));
        const line = (a: number, len: number, prog: number, ticks: number, col: string) => {
          const ca = Math.cos(a), sa = Math.sin(a), L2 = len * prog;
          for (let d = 3; d < L2; d++) dot(mx + ca * d, my + sa * d * 0.78, col);
          if (prog >= 1) for (let k = 0; k < ticks; k++) { const d = len - 3 - k * 3, bit = hash(k * 7 + Math.round(len)) > 0.45 ? 4 : 2; for (let o = -bit; o <= bit; o++) dot(mx + ca * d - sa * o * 0.78 * 0.0 - sa * o, my + sa * d * 0.78 + ca * o, col); }
        };
        angs.forEach((deg, i) => {
          const prog = ease((t - 0.5 - i * per) / (per * 1.4)); if (prog <= 0) return;
          const a = (deg * Math.PI) / 180, len = lens[i] * R * 0.95;
          line(a, len, prog, 3 + (i % 3), gold);
          if (prog >= 1) { const ex = mx + Math.cos(a) * len, ey = my + Math.sin(a) * len * 0.78, bl = (beatIdx + i) % 4 === 0 && phase < 0.4; sphere(ex, ey, bl ? 2.4 : 1.6, bl ? '#ffffff' : '#bfeaff', 'plain'); }
        });
        const gp = ease((t - 0.3) / 0.8); line(Math.PI, R * 0.36, gp, 4, mix(gold, '#ffffff', 0.2));
        star(mx, my, 4 + kick, '#ffd23f', 0);
        if (t > 0.9) draw('SUN', Math.round(mx - 9), Math.round(my + 12), 1, P.c);
      }
    } else if (scene === 'drift') {
      const rc = R * 0.27, yr = Math.round(1972 + (2026 - 1972) * ease(pr));
      const ref = beats * 0.5 * Math.PI, lag = ease(pr) * 1.15, pul = ref - lag;
      for (let a = 0; a < 6.283; a += 0.02) { dot(cx0 + Math.cos(a) * rc, cy0 + Math.sin(a) * rc, '#6a78a8'); dot(cx0 + Math.cos(a) * (rc - 1), cy0 + Math.sin(a) * (rc - 1), '#2a3768'); }
      for (let k = 0; k < 12; k++) { const a = (k / 12) * 6.283, big = k % 3 === 0; for (let d = rc - (big ? 6 : 3); d < rc - 1; d++) dot(cx0 + Math.cos(a) * d, cy0 + Math.sin(a) * d, big ? P.hi : '#6a78a8'); }
      // the lag arc between the perfect clock and the pulsar
      for (let a = pul; a < ref; a += 0.02) for (let d = rc * 0.55; d < rc * 0.62; d++) dot(cx0 + Math.cos(a) * d, cy0 + Math.sin(a) * d, P.a);
      const hand = (a: number, len: number, col: string) => { for (let d = 0; d < len; d++) { dot(cx0 + Math.cos(a) * d, cy0 + Math.sin(a) * d, col); dot(cx0 + Math.cos(a) * d + 1, cy0 + Math.sin(a) * d, mix(col, '#000000', 0.5)); } };
      hand(ref, rc - 8, '#ffffff'); hand(pul, rc - 10, P.b);
      sphere(cx0, cy0, 3, '#ffffff', 'plain'); sphere(cx0 + Math.cos(pul) * (rc - 10), cy0 + Math.sin(pul) * (rc - 10), 2.2 + kick, P.b, 'plain');
      const ys = String(yr); draw(ys, Math.round(R / 2 - (ys.length * 6 - 1) * 1.5), Math.round(cy0 + rc + 16), 3, P.c);
      rect(10, 24, 6, 6, '#ffffff'); draw('CLOCK', 20, 23, 1, P.hi); rect(10, 38, 6, 6, P.b); draw('PULSAR', 20, 37, 1, P.hi);
    } else if (scene === 'galaxy') {
      const rot = beats * 0.012;
      for (let i = 0; i < 900; i++) {
        const arm = i % 4, u = hash(i * 1.7), rr = R * (0.03 + 0.44 * Math.pow(u, 0.75)), a = rot + arm * 1.5708 + Math.log(1 + rr * 0.08) * 3.1 + (hash(i + 9) - 0.5) * (0.5 - rr / R * 0.6);
        const x = cx0 + Math.cos(a) * rr, y = cy0 + Math.sin(a) * rr * 0.55, q = rr / (R * 0.47);
        dot(x, y, mix('#ffe9a8', i % 5 === 0 ? '#ff7fc8' : '#5aa8ff', Math.min(1, q * 1.1)));
      }
      star(cx0, cy0, R * 0.05, '#ffd9a0', 0);
      const sx = cx0 + R * 0.24, sy = cy0 + R * 0.09;                  // our Sun
      const pp: [number, number][] = [[-0.34, -0.1], [-0.12, -0.2], [0.04, 0.18], [-0.26, 0.14], [0.2, -0.17], [0.34, 0.02]];
      pp.forEach(([dx, dy], i) => { const g = ease((pr - 0.2 - i * 0.07) / 0.15); if (g <= 0) return; const px = cx0 + dx * R, py = cy0 + dy * R;
        const n = 26; for (let k = 0; k < n * g; k++) if (k % 2 === 0) dot(px + (sx - px) * (k / n), py + (sy - py) * (k / n), mix(P.hi, '#000000', 0.45));
        const bl = (beatIdx + i) % 3 === 0 && phase < 0.5; sphere(px, py, bl ? 2.6 : 1.6, bl ? '#ffffff' : P.b, 'plain'); });
      for (let a = 0; a < 6.283; a += 0.15) dot(sx + Math.cos(a) * (4 + kick * 4), sy + Math.sin(a) * (4 + kick * 4), P.c);
      sphere(sx, sy, 2.2, '#ffd23f', 'plain');
      if (pr > 0.45) draw('WE ARE HERE', Math.round(sx - 33), Math.round(sy + 11), 1, P.c);
    } else if (scene === 'star') {
      star(cx0, cy0, Math.round(R * 0.15 + kick * 3), v.color ?? '#ffa23a', 0.1);
      for (let i = 0; i < 7; i++) { const a = beats * (0.35 + i * 0.05) + i * 0.9, rr = R * (0.28 + 0.03 * (i % 3)); dot(cx0 + Math.cos(a) * rr, cy0 + Math.sin(a) * rr * 0.55, P.hi); dot(cx0 + Math.cos(a - 0.12) * rr, cy0 + Math.sin(a - 0.12) * rr * 0.55, mix(P.hi, '#000000', 0.6)); }
    } else if (scene === 'cosmos') {
      const e = ease((pr - 0.12) / 0.7);
      for (let i = 0; i < 90; i++) {
        const he = i % 6 === 0, k = i % 3;
        const bx = hash(i) * R + Math.sin(t * 0.8 + i) * 3, by = RH * 0.06 + hash(i + 9) * RH * 0.62 + Math.cos(t * 0.7 + i) * 3;
        const kx = R * (0.22 + 0.28 * k) + (hash(i + 3) - 0.5) * R * 0.1, ky = RH * (full ? 0.3 : 0.36) + (k % 2) * RH * 0.1 + (hash(i + 4) - 0.5) * R * 0.08;
        const x = bx + (kx - bx) * e, y = by + (ky - by) * e, col = he ? EL.HE : EL.H;
        dot(x, y, col); dot(x + 1, y, he ? col : mix(col, '#000000', 0.5)); dot(x - 1, y, mix(col, '#000000', 0.75)); dot(x, y - 1, mix(col, '#000000', 0.75));
        if (he) { dot(x, y + 1, col); dot(x + 1, y + 1, col); }
      }
      for (let k = 0; k < 3; k++) { const q = ease((pr - 0.68 - k * 0.07) / 0.2); if (q > 0) star(R * (0.22 + 0.28 * k), RH * (full ? 0.3 : 0.36) + (k % 2) * RH * 0.1, R * 0.045 * q + kick * 1.2, ['#7fb2ff', '#ffe27a', '#ffffff'][k]); }
      draw('H', 10, 20, 2, EL.H); draw('HE', 10, 36, 2, EL.HE);
    } else if (scene === 'fusion') {
      const rev = Math.min(5, pr * 6.2);
      onion(cx0, cy0, R * 0.3, rev);
      LAYERS.forEach(([sym, col], j) => {
        if (rev < j) return;
        const age = Math.min(1, (rev - j) * 1.5), ly = Math.round(cy0 - R * 0.27 + j * R * 0.135), lx = Math.round(R - 30 * sc - 6);
        const rj = R * 0.3 * (1 - j * 0.19);
        for (let xx = cx0 + rj * 0.7; xx < lx - 4; xx += 3) dot(xx, cy0 - rj * 0.5 + (ly - (cy0 - rj * 0.5)) * ((xx - cx0 - rj * 0.7) / Math.max(1, lx - 4 - cx0 - rj * 0.7)), mix(col, '#000000', 0.45));
        rect(lx - 3, ly - 2, 3, 3 + 8, col);
        draw(sym, lx + 3, ly - 1, 2, age >= 1 ? col : P.hi);
        const ph = (rev - j) * 1.5; if (ph > 0 && ph < 1) for (let a = 0; a < 6.283; a += 0.1) dot(cx0 + Math.cos(a) * rj * (1 + ph * 0.25), cy0 + Math.sin(a) * rj * (1 + ph * 0.25), mix(col, '#ffffff', 0.5));
      });
    } else if (scene === 'supernova') {
      const blast = v.phase === 'blast';
      if (!blast) {
        const q = ease(pr * pr * 1.0), rc = R * 0.3 * (1 - 0.88 * q);
        if (pr > 0.5) ctx.setTransform(1, 0, 0, 1, Math.round((hash(frame) - 0.5) * 3 * pr), Math.round((hash(frame + 40) - 0.5) * 3 * pr));
        onion(cx0, cy0, Math.max(3, rc), 5, false);
        for (let a = 0; a < 8; a++) { const ang = (a / 8) * 6.283 + 0.3, rr = R * 0.4 - ((t * 40 * (1 + pr * 3)) % (R * 0.22)); for (let d = 0; d < 4; d++) dot(cx0 + Math.cos(ang) * (rr - d), cy0 + Math.sin(ang) * (rr - d), d === 0 ? P.hi : mix(P.hi, '#000000', 0.5)); }
        if (pr > 0.8) star(cx0, cy0, 2 + (pr - 0.8) * 14, '#ffffff', 0.2);
      } else {
        if (t < 0.5) ctx.setTransform(1, 0, 0, 1, Math.round((hash(frame) - 0.5) * 8 * (1 - t / 0.5)), Math.round((hash(frame + 40) - 0.5) * 8 * (1 - t / 0.5)));
        const e = easeO(t / 3.0);
        for (const [k, col] of [[1, '#ffffff'], [0.82, '#ffe27a'], [0.62, '#ff8a2a'], [0.45, '#d8402a']] as [number, string][]) {
          const rr = R * 0.95 * e * k; if (rr < 2) continue;
          for (let a = 0; a < 6.283; a += Math.max(0.012, 0.6 / Math.max(rr, 8))) { for (let th = 0; th < 5; th++) dot(cx0 + Math.cos(a) * (rr - th), cy0 + Math.sin(a) * (rr - th), th < 2 ? col : mix(col, '#000000', 0.25 * th)); }
        }
        const dcol = [EL.C, EL.O, EL.FE, EL.CA, EL.N];
        for (let i = 0; i < 170; i++) {
          const ang = hash(i) * 6.283, sp = (0.18 + hash(i + 7) * 0.82) * R * 0.62, d = sp * easeO(t / 3.4), cxp = cx0 + Math.cos(ang) * d, cyp = cy0 + Math.sin(ang) * d;
          dot(cxp, cyp, dcol[i % 5]); if (hash(i + 3) > 0.6) dot(cxp + 1, cyp, dcol[i % 5]);
          for (let tr = 1; tr < 4; tr++) dot(cx0 + Math.cos(ang) * (d - tr * 2 * (1 - t / 4)), cy0 + Math.sin(ang) * (d - tr * 2 * (1 - t / 4)), mix(dcol[i % 5], '#000000', 0.35 * tr));
        }
        if (t > 0.5) { const nr = 2 + kick * 1.5; sphere(cx0, cy0, nr + 1, '#8be0ff', 'plain'); }
        if (t < 0.45) { ctx.fillStyle = `rgba(255,255,255,${0.9 * Math.exp(-t * 7)})`; ctx.fillRect(-4, -4, R + 8, RH + 8); }
      }
    } else if (scene === 'nebula') {
      const e = easeO(pr), rN = R * (0.14 + 0.42 * e);
      const cols = [EL.C, EL.O, EL.FE, EL.N, EL.CA].map(toRGB);
      for (let y = Math.max(0, Math.floor(cy0 - rN)); y < Math.min(RH, cy0 + rN); y++) for (let x = Math.max(0, Math.floor(cx0 - rN)); x < Math.min(R, cx0 + rN); x++) {
        const dx = x - cx0, dy = y - cy0, d = Math.hypot(dx, dy) / rN; if (d > 1) continue;
        const n = vnoise(x * 0.07 + t * 0.2, y * 0.07 - t * 0.15) * 0.6 + vnoise(x * 0.16, y * 0.16 + t * 0.3) * 0.4;
        if (n * (1 - d * 0.85) > 0.22 + bayer(x, y) * 0.25) { const c = cols[Math.floor(n * 9 + d * 5) % 5]; dot(x, y, toHex(c.map((q) => q * (0.55 + 0.45 * (1 - d))))); }
      }
      for (let i = 0; i < 40; i++) { const a = hash(i) * 6.283, d = (0.2 + hash(i + 3)) * rN * 0.9, col = [EL.C, EL.O, EL.FE, EL.CA][i % 4]; if ((beatIdx + i) % 3 === 0 && phase < 0.5) dot(cx0 + Math.cos(a) * d, cy0 + Math.sin(a) * d, '#ffffff'); else dot(cx0 + Math.cos(a) * d, cy0 + Math.sin(a) * d, col); }
      const leg: [string, string][] = [['C', EL.C], ['O', EL.O], ['FE', EL.FE], ['CA', EL.CA]];
      leg.forEach(([sy, col], i) => { if (pr > 0.12 + i * 0.16) { rect(10, 20 + i * 15, 8, 8, col); draw(sy, 22, 20 + i * 15, 1, P.hi); } });
    } else if (scene === 'disc') {
      const e = easeO(pr);
      for (let i = 0; i < 380; i++) {
        const r0 = R * (0.1 + 0.4 * hash(i)), a0 = hash(i + 3) * 6.283, om = 2.0 / (r0 / R + 0.14) * 0.5, inner = hash(i + 5) > 0.45;
        const rr = r0 * (1 - (inner ? 0.72 : 0.22) * Math.pow(e, 1.1)), a = a0 + om * t;
        const x = cx0 + Math.cos(a) * rr, y = cy0 + Math.sin(a) * rr * 0.5, fade = pr > 0.8 ? 1 - (pr - 0.8) / 0.25 : 1;
        if (hash(i + 8) < fade) { const dc = mix('#e0b684', '#fff0c8', Math.max(0, 1 - rr / (R * 0.5))); dot(x, y, dc); dot(x + 1, y, mix(dc, '#000000', 0.35)); if (i % 3 === 0) dot(x, y + 1, mix(dc, '#000000', 0.5)); }
      }
      star(cx0, cy0, R * 0.02 + R * 0.06 * e + kick * 1.2, '#ffd23f', 0.05);
      const lanes = [0.16, 0.24, 0.33, 0.42], kinds = ['moon', 'earth', 'mars', 'gas'], bases = ['#9a9a9a', '#2f6fe0', '#c8553d', '#d9a066'];
      lanes.forEach((ln, k) => { const g = ease((pr - 0.5 - k * 0.08) / 0.25); if (g <= 0) return; const a = hash(k + 4) * 6.283 + beats * (0.5 - k * 0.1), rr = R * ln;
        for (let aa = 0; aa < 6.283; aa += 0.06) if (Math.round(aa * 20) % 2 === 0) dot(cx0 + Math.cos(aa) * rr, cy0 + Math.sin(aa) * rr * 0.5, mix(P.hi, '#000000', 0.82));
        sphere(cx0 + Math.cos(a) * rr, cy0 + Math.sin(a) * rr * 0.5, (2 + k * 0.7) * g * sc + 1, bases[k], kinds[k], beats * 0.05); });
    } else if (scene === 'earth') {
      const rE = R * 0.24;
      const glow = rE * (1.15 + kick * 0.03);
      for (let a = 0; a < 6.283; a += 0.02) for (let d = rE; d < glow + 3; d += 1) if ((1 - (d - rE) / 4) > bayer(Math.round(a * 40), Math.round(d))) dot(cx0 + Math.cos(a) * d, cy0 + Math.sin(a) * d, mix('#4aa8ff', '#000000', (d - rE) / 5));
      sphere(cx0, cy0, rE, '#2f6fe0', 'earth', t * 0.04 + beats * 0.01);
      sphere(cx0 + Math.cos(beats * 0.35) * rE * 1.8, cy0 + Math.sin(beats * 0.35) * rE * 0.6, rE * 0.25, '#b8b8b8', 'moon');
      const motes: [string, string][] = [['FE', EL.FE], ['C', EL.C], ['O', EL.O], ['CA', EL.CA], ['N', EL.N], ['C', EL.C], ['FE', EL.FE], ['O', EL.O]];
      motes.forEach(([sy, col], i) => { const a = Math.min(1, Math.max(0, (pr - 0.05 - i * 0.08) / 0.2)); if (a <= 0) return;
        const y = cy0 + rE * 1.2 + 6 - ((t * 7 + i * 17) % (rE * 1.9)), x = cx0 + Math.sin(t * 0.8 + i * 2.1) * rE * 1.35 + (hash(i) - 0.5) * 20;
        if (Math.hypot(x - cx0, y - cy0) > rE + 4) draw(sy, x - 5, y, 1, a > 0.8 ? col : mix(col, '#000000', 0.5)); });
    } else if (scene === 'rocket') {
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
    for (let k = 0; k < (eqOn ? nb : 0); k++) {
      const hgt = Math.max(2, Math.round(maxH * (0.12 + 0.88 * hash(k * 3.1 + beatIdx * 7.7)) * (0.4 + 0.6 * (kick * 0.75 + 0.25))));
      const x = Math.floor((R - nb * bw) / 2) + k * bw;
      for (let y = 0; y < hgt; y++) {
        const q = y / maxH, c = q > 0.7 ? P.a : q > 0.4 ? P.c : P.b;
        rect(x, base - y, bw - 1, 1, y === hgt - 1 ? P.hi : (y % 3 === 2 ? mix(c, '#000000', 0.35) : c));
        if (y < hgt * 0.4) rect(x, base + 2 + y * 0.5, bw - 1, 1, mix(c, '#000000', 0.7));
      }
    }

    // ---------------------------------------------------------------- text (5x7 font, outlined, on a dark panel)
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

  const box: React.CSSProperties = full ? {position: 'absolute', left: -stX, top: -stY, width: 1080, height: 1920, background: '#000'} : {position: 'absolute', inset: 0, borderRadius: 38, overflow: 'hidden', border: `4px solid ${plan.style.palette.accent2}`, boxSizing: 'border-box', background: '#000'};
  const punch = beatIdx % 4 === 0 ? 1 + 0.018 * Math.exp(-phase * 12) : 1 + 0.006 * Math.exp(-phase * 12);   // tiny camera zoom on every beat, bigger on the downbeat
  return <div style={box}>
    <canvas ref={ref} width={R} height={RH} style={{width: '100%', height: '100%', imageRendering: 'pixelated', display: 'block', transform: `scale(${punch})`}} />
  </div>;
};
