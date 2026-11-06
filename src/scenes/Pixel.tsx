import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {SceneProps} from './common';

/**
 * Retro pixel-art scene drawn on a tiny canvas (default 96 px wide) and scaled up with hard pixels, locked to a BPM so
 * everything pulses on the beat (sun, planets, equalizer, screen kick, typed lyrics).
 * visual: {type: pixel, scene: planets|rocket, res: 96, palette: neon|gameboy|pico8|sunset, bpm: 120,
 *          lyrics: ["MERCURY IS HOT", ...], title: "PLANET SONG"}      one lyric per bar (4 beats)
 */
const PAL: Record<string, string[]> = {
  neon: ['#0b0033', '#2a1a5e', '#7a04eb', '#ff2a6d', '#05d9e8', '#d1f7ff', '#ffd300'],
  gameboy: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'],
  pico8: ['#000000', '#1d2b53', '#83769c', '#ff004d', '#29adff', '#fff1e8', '#ffec27', '#00e436', '#ffa300'],
  sunset: ['#1a0f3c', '#3d1a78', '#b5179e', '#f72585', '#ff9e00', '#fff3b0', '#ffd60a'],
};
type Roles = {bg: string; dim: string; mid: string; a: string; b: string; hi: string; sun: string; green: string};
const roles = (name: string): Roles => {
  const c = PAL[name] ?? PAL.neon;
  if (name === 'gameboy') return {bg: c[0], dim: c[1], mid: c[2], a: c[2], b: c[3], hi: c[3], sun: c[3], green: c[2]};
  if (name === 'pico8') return {bg: c[0], dim: c[1], mid: c[2], a: c[3], b: c[4], hi: c[5], sun: c[6], green: c[7]};
  return {bg: c[0], dim: c[1], mid: c[2], a: c[3], b: c[4], hi: c[5], sun: c[6], green: c[4]};
};

// 3x5 pixel font: five rows of three cells ('#' = on), joined into a 15-char string below
const GLYPHS: Record<string, string[]> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'], C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'], E: ['###', '#..', '##.', '#..', '###'], F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'], H: ['#.#', '#.#', '###', '#.#', '#.#'], I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'], K: ['#.#', '#.#', '##.', '#.#', '#.#'], L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'], N: ['##.', '#.#', '#.#', '#.#', '#.#'], O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'], Q: ['.#.', '#.#', '#.#', '##.', '.##'], R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'], T: ['###', '.#.', '.#.', '.#.', '.#.'], U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'], W: ['#.#', '#.#', '###', '###', '#.#'], X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'], Z: ['###', '..#', '.#.', '#..', '###'],
  '0': ['###', '#.#', '#.#', '#.#', '###'], '1': ['.#.', '##.', '.#.', '.#.', '###'], '2': ['##.', '..#', '.#.', '#..', '###'],
  '3': ['##.', '..#', '.#.', '..#', '##.'], '4': ['#.#', '#.#', '###', '..#', '..#'], '5': ['###', '#..', '##.', '..#', '##.'],
  '6': ['.##', '#..', '###', '#.#', '###'], '7': ['###', '..#', '.#.', '.#.', '.#.'], '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '##.'],
  '.': ['...', '...', '...', '...', '.#.'], ',': ['...', '...', '...', '.#.', '#..'], '!': ['.#.', '.#.', '.#.', '...', '.#.'],
  '?': ['##.', '..#', '.#.', '...', '.#.'], ':': ['...', '.#.', '...', '.#.', '...'], '-': ['...', '...', '###', '...', '...'],
  "'": ['.#.', '#..', '...', '...', '...'], '+': ['...', '.#.', '###', '.#.', '...'], ' ': ['...', '...', '...', '...', '...'],
};
const FONT: Record<string, string> = Object.fromEntries(Object.entries(GLYPHS).map(([k, rows]) => [k, rows.join('')]));

const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const ROCKET = ['....w....', '...www...', '...wbw...', '..wwbww..', '..wwwww..', '..wwwww..', '.rwwwwwr.', '.rwwwwwr.', 'rr.www.rr', 'r..www..r'];

export const Pixel: React.FC<SceneProps> = ({v, plan, dur, at = 0}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const ref = React.useRef<HTMLCanvasElement>(null);
  const {w, h} = plan.style.stage;
  const R = v.res ?? 96, RH = Math.round((R * h) / w);
  const t = frame / fps;
  const bpm = v.bpm ?? plan.bpm ?? 120;
  const beats = ((at + t) * bpm) / 60;
  const beatIdx = Math.floor(beats), phase = beats - beatIdx;
  const kick = Math.exp(-phase * 6);
  const name = v.palette ?? 'neon';
  const C = roles(name);
  const scene = v.scene ?? 'planets';
  const lyrics: string[] = v.lyrics ?? [];

  React.useLayoutEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const dot = (x: number, y: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); };
    const rect = (x: number, y: number, ww: number, hh: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), ww, hh); };
    const disc = (cx: number, cy: number, r: number, base: string, dark: string, lit = true) => {
      for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
        const d = Math.hypot(x, y);
        if (d > r + 0.2) continue;
        const sh = (x * -0.6 + y * -0.6) / Math.max(1, r);
        let c = base;
        if (lit) { if (sh < -0.42) c = dark; else if (sh < -0.12 && (x + y) % 2 === 0) c = dark; }
        dot(cx + x, cy + y, c);
      }
    };
    const glyphW = (s: number) => 4 * s;
    const text = (str: string, x: number, y: number, s: number, c: string, shadow?: string) => {
      let cx = x;
      for (const ch of str.toUpperCase()) {
        const g = FONT[ch] ?? FONT[' '];
        for (let i = 0; i < 15; i++) if (g[i] === '#') { if (shadow) rect(cx + (i % 3) * s + 1, y + Math.floor(i / 3) * s + 1, s, s, shadow); rect(cx + (i % 3) * s, y + Math.floor(i / 3) * s, s, s, c); }
        cx += glyphW(s);
      }
    };
    const textW = (str: string, s: number) => str.length * glyphW(s) - s;
    const wrap = (str: string, s: number) => {
      const out: string[] = []; let cur = '';
      for (const wd of str.split(' ')) { const tr = (cur + ' ' + wd).trim(); if (textW(tr, s) <= R - 8 || !cur) cur = tr; else { out.push(cur); cur = wd; } }
      if (cur) out.push(cur);
      return out;
    };

    // ---- screen kick: 1 px jitter on every bar's downbeat
    const bar = Math.floor(beats / 4), onBar = beatIdx % 4 === 0 && phase < 0.18;
    ctx.setTransform(1, 0, 0, 1, onBar ? (beatIdx % 8 === 0 ? 1 : -1) : 0, onBar ? 1 : 0);
    const flash = beatIdx % 4 === 0 && phase < 0.07;
    rect(-2, -2, R + 4, RH + 4, flash ? C.dim : C.bg);

    // ---- stars (scroll faster on the kick)
    const scroll = (t * 6 + kick * 1.5) ;
    for (let i = 0; i < 46; i++) {
      const layer = 1 + (i % 3);
      const x = Math.floor(hash(i) * R), y = Math.floor((hash(i + 50) * RH + scroll * layer * 3) % RH);
      const tw = (beatIdx + i) % 6 === 0 && phase < 0.5;
      dot(x, y, tw ? C.hi : layer === 3 ? C.mid : C.dim);
      if (tw) { dot(x - 1, y, C.mid); dot(x + 1, y, C.mid); dot(x, y - 1, C.mid); dot(x, y + 1, C.mid); }
    }

    if (scene === 'rocket') {
      const cx = Math.round(R / 2 + Math.sin(beats * 0.9) * 6), cy = Math.round(RH * 0.40 + Math.sin(beats * 1.6) * 2);
      // passing planets
      for (let i = 0; i < 3; i++) {
        const sp = 0.9 + i * 0.5, py = ((t * 9 * sp + i * RH * 0.37) % (RH + 30)) - 15;
        const px = i === 1 ? R * 0.78 : R * (0.16 + 0.1 * i);
        disc(Math.round(px), Math.round(py), 5 + i * 2, [C.a, C.b, C.sun][i], C.dim);
      }
      // speed lines
      for (let i = 0; i < 9; i++) { const x = Math.floor(hash(i + 9) * R), y = Math.floor((hash(i + 20) * RH + t * 70 * (1 + kick)) % RH); rect(x, y, 1, 4 + Math.floor(kick * 4), C.mid); }
      // flame (flickers every frame, bigger on the beat)
      const fl = 3 + Math.floor(kick * 4) + (frame % 3 === 0 ? 1 : 0);
      for (let i = 0; i < fl; i++) { rect(cx - 1 + (i % 2), cy + 10 + i, 3 - (i > 3 ? 1 : 0), 1, i < 2 ? C.hi : i < 4 ? C.sun : C.a); }
      ROCKET.forEach((row, ry) => [...row].forEach((ch, rx) => { if (ch === '.') return; dot(cx - 4 + rx, cy + ry, ({w: C.hi, g: C.mid, r: C.a, b: C.b, y: C.sun} as any)[ch]); }));
    } else {
      const cx = Math.round(R / 2), sy = Math.round(RH * 0.30);
      const radii = [R * 0.16, R * 0.25, R * 0.34, R * 0.43];
      radii.forEach((r) => { for (let a = 0; a < 6.283; a += 0.07) if (Math.round(a * 14) % 2 === 0) dot(cx + Math.cos(a) * r, sy + Math.sin(a) * r * 0.6, C.dim); });
      // sun with beat-pulsed rays
      const sr = Math.round(R * 0.07 + kick * 1.4);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283 + beats * 0.15, len = sr + 3 + (i % 2 ? 2 : 4) * (0.5 + kick); for (let d = sr + 1; d < len; d++) dot(cx + Math.cos(a) * d, sy + Math.sin(a) * d, i % 2 ? C.sun : C.hi); }
      disc(cx, sy, sr, C.sun, C.a, false);
      rect(cx - 2, sy - 1, 1, 1, C.hi);
      const planets: [number, number, string, string, number][] = [[0, 1, C.mid, C.dim, 0.55], [1, 2, C.sun, C.a, 0.4], [2, 2, C.b, C.dim, 0.3], [3, 3, C.a, C.dim, 0.2]];
      planets.forEach(([ri, pr, col, dk, om], i) => {
        const a = hash(i + 3) * 6.283 + beats * om, r = radii[ri];
        disc(cx + Math.cos(a) * r, sy + Math.sin(a) * r * 0.6, pr + (beatIdx % (i + 2) === 0 && phase < 0.25 ? 1 : 0), col, dk);
      });
      // a ringed giant on the outer lane
      { const a = 2 + beats * 0.12, px = cx + Math.cos(a) * R * 0.43, py = sy + Math.sin(a) * R * 0.43 * 0.6; disc(px, py, 4, C.sun, C.a); for (let k = -7; k <= 7; k++) dot(px + k, py + Math.round(k * 0.25), k % 3 === 0 ? C.hi : C.b); }
    }

    // ---- equalizer on the beat
    const nb = 16, bw = Math.floor(R / (nb + 1)), base = RH - 4, maxH = Math.round(RH * 0.17);
    for (let k = 0; k < nb; k++) {
      const hgt = Math.max(2, Math.round(maxH * (0.15 + 0.85 * hash(k * 3.1 + beatIdx * 7.7)) * (0.45 + 0.55 * (kick * 0.7 + 0.3))));
      const x = 4 + k * (bw + 0) + 1;
      for (let y = 0; y < hgt; y++) rect(x, base - y, bw - 1, 1, y > hgt - 3 ? C.hi : y % 4 === 3 ? C.dim : k % 2 ? C.a : C.b);
    }
    // ---- lyrics: typed out over the first beats of each bar, flashing on the beat
    if (lyrics.length) {
      const line = lyrics[((bar % lyrics.length) + lyrics.length) % lyrics.length];
      const reveal = Math.min(line.length, Math.floor(((beats % 4) / 1.6) * line.length) + 1);
      let s = textW(line, 3) <= R - 8 ? 3 : 2; let lines = wrap(line, s);
      if (lines.length > 2) { s = 1; lines = wrap(line, s); }
      let shown = 0;
      lines.forEach((ln, i) => {
        const part = ln.slice(0, Math.max(0, reveal - shown)); shown += ln.length + 1;
        const y = Math.round(RH * 0.585) + i * (6 * s);
        text(part, Math.round((R - textW(ln, s)) / 2), y, s, kick > 0.55 ? C.hi : C.sun, C.dim);
      });
    }
    if (v.title) text(v.title, Math.round((R - textW(String(v.title), 1)) / 2), 3, 1, C.hi);
  }, [frame, R, RH, name, scene, bpm, at]);

  return <div style={{position: 'absolute', inset: 0, borderRadius: 38, overflow: 'hidden', border: `4px solid ${plan.style.palette.accent2}`, boxSizing: 'border-box', background: '#000'}}>
    <canvas ref={ref} width={R} height={RH} style={{width: '100%', height: '100%', imageRendering: 'pixelated', display: 'block'}} />
  </div>;
};
