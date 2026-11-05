import {Easing, interpolate} from 'remotion';

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** 0..1 progress of t inside [t0, t1] (seconds) */
export const seg = (t: number, t0: number, t1: number) => clamp01((t - t0) / Math.max(1e-6, t1 - t0));
export const easeOut = (x: number) => Easing.out(Easing.cubic)(clamp01(x));
export const easeInOut = (x: number) => Easing.inOut(Easing.cubic)(clamp01(x));
export const easeOutBack = (x: number) => Easing.out(Easing.back(1.7))(clamp01(x));
export const easeOutExpo = (x: number) => Easing.out(Easing.exp)(clamp01(x));
export const bounceOut = (x: number) => Easing.bounce(clamp01(x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const map = (v: number, a: number, b: number, c: number, d: number) =>
  interpolate(v, [a, b], [c, d], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

export const fmtNum = (v: number, prefix = '', suffix = '', dec = 0) => {
  const s = Math.abs(v).toLocaleString('en-US', {minimumFractionDigits: dec, maximumFractionDigits: dec});
  return (v < 0 ? '-' : '') + prefix + s + suffix;
};
export const withAlpha = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${clamp01(a)})`;
};
export const mixHex = (a: string, b: string, t: number) => {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  const c = (s: number) => Math.round(((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t);
  return '#' + [16, 8, 0].map((s) => c(s).toString(16).padStart(2, '0')).join('');
};
/** '*Hide $10,000* in a drawer.' -> tokens with emphasis + glue-to-previous flag */
export const parseMarkup = (line: string) => {
  const out: {w: string; e: boolean; glue: boolean}[] = [];
  let emph = false, prevOpen = false;
  for (const part of line.split(/(\*)/)) {
    if (part === '*') { emph = !emph; continue; }
    if (!part) continue;
    part.split(/\s+/).filter(Boolean).forEach((w, k) => {
      out.push({w, e: emph, glue: k === 0 && out.length > 0 && !/^\s/.test(part) && prevOpen});
    });
    prevOpen = !/\s$/.test(part);
  }
  return out;
};
