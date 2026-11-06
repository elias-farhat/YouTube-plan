import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Plan, W} from '../lib/types';
import {FONT} from '../lib/pixelfont';
import {clamp01, easeOutBack} from '../lib/anim';

/**
 * "Bits" mode: DR. BIT, a pixel scientist (wild white hair, round glasses, moustache, lab coat, bow tie, bubbling flask)
 * speaks to the viewer. His line is typed in a speech bubble, one letter per 16th note, mouth in sync; he bobs on the beat
 * and reacts to the story (moods: talk | shock | worried | aha | happy).  No narration, no captions.
 */
const PIXEL = 6, CW = 160, CH = 66, CHAR_W = 50, TEXT_X = CHAR_W + 6;
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export const BitSpeech: React.FC<{plan: Plan}> = ({plan}) => {
  const frame = useCurrentFrame();
  const ref = React.useRef<HTMLCanvasElement>(null);
  const t = frame / plan.fps;
  const seg = [...plan.segs].reverse().find((s) => frame >= s.startFrame) ?? plan.segs[0];
  const b = seg.bits;
  const bpm = plan.bpm ?? 120;
  const beats = (t * bpm) / 60, beatIdx = Math.floor(beats), phase = beats - beatIdx;
  const text = b?.text ?? '';
  const mood = (seg as any).mood ?? 'talk';
  const accent = '#ffd23f';
  const lines: string[] = [];
  if (text) { let cur = ''; for (const w of text.split(' ')) { const tr = (cur + ' ' + w).trim(); if (tr.length <= 17 || !cur) cur = tr; else { lines.push(cur); cur = w; } } if (cur) lines.push(cur); }
  const shown = b ? Math.max(0, Math.min(text.length, Math.floor((t - b.start) / b.charT) + 1)) : 0;
  const lastReveal = b ? b.start + (shown - 1) * b.charT : -1;
  const typing = !!b && shown > 0 && t < b.start + text.length * b.charT + 0.05;
  const talking = typing && t - lastReveal < b.charT * 0.9 && text[shown - 1] !== ' ';
  const pop = easeOutBack(clamp01((t - seg.startFrame / plan.fps) / 0.3), 1.3);
  const leave = clamp01((seg.endFrame - frame) / 8);
  const segT = t - seg.startFrame / plan.fps;

  React.useLayoutEffect(() => {
    const ctx = ref.current!.getContext('2d')!;
    ctx.clearRect(0, 0, CW, CH);
    const R = (x: number, y: number, w: number, h: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); };
    const D = (x: number, y: number, c: string) => R(x, y, 1, 1, c);
    const disc = (cx: number, cy: number, r: number, c: string) => { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + 0.5) D(cx + x, cy + y, c); };
    const ring = (cx: number, cy: number, r: number, c: string) => { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) { const d = x * x + y * y; if (d <= r * r + 0.5 && d >= (r - 1) * (r - 1) - 0.5) D(cx + x, cy + y, c); } };
    const line = (x0: number, y0: number, x1: number, y1: number, c: string, th = 1) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) R(x0 + ((x1 - x0) * i) / Math.max(1, n), y0 + ((y1 - y0) * i) / Math.max(1, n), th, th, c); };
    const glyph = (ch: string, x: number, y: number, c: string) => { const g = FONT[ch] ?? FONT[' ']; ctx.fillStyle = c; for (let k = 0; k < 35; k++) if (g[k] === '#') ctx.fillRect(x + (k % 5), y + Math.floor(k / 5), 1, 1); };

    // ------------------------------------------------------------ speech bubble
    const nl = Math.max(1, lines.length), bx = TEXT_X - 4, bw = CW - bx - 1, bh = nl * 10 + 10, by = Math.round(Math.max(12, Math.min(CH - bh - 4, 33 - bh / 2)));   // bubble fits the text, level with his face
    R(bx + 1, by, bw - 2, bh, 'rgba(8,6,24,0.9)'); R(bx, by + 1, bw, bh - 2, 'rgba(8,6,24,0.9)');
    for (const [x, y, w, h] of [[bx + 1, by, bw - 2, 1], [bx + 1, by + bh - 1, bw - 2, 1], [bx, by + 1, 1, bh - 2], [bx + bw - 1, by + 1, 1, bh - 2]] as number[][]) R(x, y, w, h, accent);
    for (let k = 0; k < 4; k++) { R(bx - 3 + k, by + bh / 2 - 3 + k, 1, 7 - 2 * k, accent); R(bx - 2 + k, by + bh / 2 - 2 + k, 1, 5 - 2 * k, 'rgba(8,6,24,0.9)'); }   // tail towards Dr. Bit
    let remaining = shown;
    lines.forEach((ln, li) => {
      const y = by + 6 + li * 10;
      let x = TEXT_X;
      for (const ch of ln) { if (remaining <= 0) break; glyph(ch, x + 1, y + 1, '#000000'); glyph(ch, x, y, '#ffffff'); x += 6; remaining -= 1; }
      remaining -= 1;
    });
    if (b && shown >= text.length && phase < 0.5) { const li = Math.max(0, lines.length - 1), x = TEXT_X + (lines[li]?.length ?? 0) * 6; R(x, by + 6 + li * 10, 3, 7, accent); }
    if (seg.idx === 0 && segT < 3.4) { R(bx, 0, 40, 10, '#0a0e22'); R(bx, 0, 40, 1, accent); R(bx, 9, 40, 1, accent); R(bx, 0, 1, 10, accent); R(bx + 39, 0, 1, 10, accent); [...'DR. BIT'].forEach((ch, i) => glyph(ch, bx + 3 + i * 5, 1, '#ffffff')); }

    // ------------------------------------------------------------ DR. BIT
    // dark spotlight behind him so the white coat/hair stand out on bright scenes (daylight, lightning flashes)
    for (let y = 2; y < CH; y++) for (let x = 0; x < CHAR_W; x++) { const d = Math.hypot((x - 25) / 25, (y - 36) / 32); if (d < 1 && (1 - d) * 1.1 > ((x * 7 + y * 13) % 16) / 16 * 0.9) { ctx.fillStyle = 'rgba(10,8,34,0.62)'; ctx.fillRect(x, y, 1, 1); } }
    const SK = '#f2c9a3', SKd = '#d4a27a', HR = '#f6f6ff', HRd = '#b9bddf', COAT = '#f4f6ff', COATd = '#cdd3ee', LN = '#1a1d3a', TEAL = '#2ec4b6', TIE = '#ff4fa3', GL = '#bfeaff';
    const shock = mood === 'shock', worried = mood === 'worried', aha = mood === 'aha', happy = mood === 'happy';
    const bob = phase < 0.18 ? -1 : 0;
    const jit = shock ? Math.round((hash(frame) - 0.5) * 2) : 0;
    const ox = 5 + jit, oy = 12 + bob + (shock ? Math.round((hash(frame + 9) - 0.5) * 2) : 0);
    const P = (x: number, y: number, w: number, h: number, c: string) => R(ox + x, oy + y, w, h, c);
    const Q = (x: number, y: number, c: string) => D(ox + x, oy + y, c);

    // hair mass + spikes (they bounce on the beat; stand up in shock)
    const lift = (shock ? 5 : 0) + (phase < 0.2 ? 1 : 0);
    P(5, 5, 24, 11, HR); P(3, 9, 4, 11, HR); P(27, 9, 4, 11, HR); P(3, 12, 2, 8, HRd); P(29, 12, 2, 8, HRd);
    for (let i = 0; i < 9; i++) { const hx = 5 + i * 2.7, h = 3 + Math.round(hash(i * 3 + 1) * 4) + lift + Math.round(Math.sin(beats * Math.PI + i) * 0.7); P(hx, 5 - h, 3, h + 1, HR); P(hx + 1, 5 - h - 1, 1, 1, HR); P(hx, 5 - h + 1, 1, h, i % 2 ? HR : HRd); }
    // body: shirt, bow tie, coat, pocket with pens
    P(14, 31, 6, 3, SKd); P(11, 33, 12, 5, TEAL);
    P(4, 35, 26, 18, COAT); P(26, 36, 4, 17, COATd); P(4, 35, 26, 1, '#ffffff');
    line(ox + 10, oy + 35, ox + 17, oy + 46, COATd, 1); line(ox + 24, oy + 35, ox + 17, oy + 46, COATd, 1);
    P(16, 47, 2, 2, '#8a93b4'); P(16, 51, 2, 2, '#8a93b4');
    P(6, 41, 7, 6, COATd); P(6, 41, 7, 1, '#aab2d6'); P(7, 38, 1, 4, '#ff4a4a'); P(9, 37, 1, 5, '#4aa8ff'); P(11, 39, 1, 3, '#5cff9c'); P(22, 42, 4, 3, accent); P(23, 43, 2, 1, '#8a6a00');
    // face
    P(9, 13, 16, 18, SK); P(10, 12, 14, 1, SK); P(10, 31, 14, 1, SK); P(22, 14, 2, 16, SKd); P(8, 18, 1, 5, SKd); P(25, 18, 1, 5, SKd);
    P(10, 12, 14, 2, HR); P(11, 14, 3, 1, HR); P(17, 14, 2, 1, HR); P(21, 14, 3, 1, HR);                       // bangs
    // brows (bushy), glasses, eyes
    const by2 = shock || aha ? 12 : 15;
    if (worried) { P(10, 16, 5, 1, HR); P(13, 15, 2, 1, HR); P(19, 16, 5, 1, HR); P(19, 15, 2, 1, HR); } else { P(10, by2, 5, 2, HR); P(19, by2, 5, 2, HR); }
    const lx = [13, 21];
    lx.forEach((cx) => { disc(ox + cx, oy + 20, 4, GL); ring(ox + cx, oy + 20, 4, LN); });
    P(17, 20, 0.0, 1, LN); Q(16, 19, LN); Q(17, 19, LN);
    if (happy) { lx.forEach((cx) => { P(cx - 3, 22, 2, 1, LN); P(cx - 2, 21, 2, 1, LN); P(cx - 1, 20, 3, 1, LN); P(cx + 1, 21, 2, 1, LN); P(cx + 2, 22, 2, 1, LN); }); }
    else {
      const look = Math.round(Math.sin(t * 0.8) * 1), up = aha ? -1 : talking ? 0 : 0;
      const blink = beatIdx % 7 === 6 && phase < 0.25;
      lx.forEach((cx) => { if (blink) P(cx - 2, 20, 4, 1, LN); else if (shock) { P(cx - 1, 19, 2, 2, LN); } else { P(cx - 1 + look, 19 + up, 2, 3, LN); Q(cx - 1 + look, 19 + up, '#ffffff'); } });
    }
    const glint = (phase < 0.3 ? 1 : 0); if (glint) { Q(11, 17, '#ffffff'); Q(12, 16, '#ffffff'); Q(19, 17, '#ffffff'); Q(20, 16, '#ffffff'); }
    // nose, moustache, mouth
    P(16, 22, 2, 2, SKd); P(11, 25, 12, 3, HR); P(10, 26, 1, 3, HR); P(23, 26, 1, 3, HR); P(11, 27, 12, 1, HRd);
    const viseme = talking ? Math.floor(hash(shown) * 3) : -1;
    if (shock) { P(15, 28, 4, 3, LN); P(16, 30, 2, 1, '#ff7a90'); }
    else if (happy) { P(13, 28, 8, 3, LN); P(14, 30, 6, 1, '#ff7a90'); }
    else if (viseme === 2) { P(14, 28, 6, 3, LN); P(15, 30, 4, 1, '#ff7a90'); }
    else if (viseme === 1) { P(15, 28, 4, 2, LN); }
    else if (worried) { P(14, 29, 2, 1, LN); P(16, 28, 2, 1, LN); P(18, 29, 2, 1, LN); }
    else if (aha) { P(14, 28, 6, 2, LN); }
    else P(15, 29, 4, 1, LN);
    // bow tie on top of the shirt
    P(12, 33, 4, 3, TIE); P(18, 33, 4, 3, TIE); P(15, 33, 3, 3, '#c02f78');

    // arms: the gesturing arm (screen left) and the flask arm (screen right)
    const arm = (sx: number, sy: number, hx: number, hy: number) => { line(ox + sx, oy + sy, ox + hx, oy + hy, COAT, 4); line(ox + sx + 3, oy + sy + 1, ox + hx + 3, oy + hy + 1, COATd, 1); P(hx - 1, hy - 2, 4, 3, SK); };
    if (shock) arm(4, 38, -1, 20); else if (aha) { arm(4, 38, 1, 14); P(1, 10, 2, 4, SK); } else if (happy) arm(4, 38, -2 + Math.round(Math.sin(beats * 3) * 2), 24); else arm(4, 39, -1, 30 - (talking ? 2 : 0) - (phase < 0.2 ? 2 : 0));
    const fy = shock || happy ? 16 : 40, fxo = 38;
    line(ox + 27, oy + 39, ox + 34, oy + fy + 8, COAT, 4); P(33, fy + 7, 4, 3, SK);
    // the flask: green liquid with bubbles, glowing on the beat
    for (let r = 0; r < 9; r++) { const w = 3 + r; P(fxo - Math.floor(w / 2) + 0.0, fy + r, w, 1, r < 3 ? '#cfeeff' : '#5cff9c'); }
    P(fxo - 1, fy - 5, 3, 5, '#cfeeff'); P(fxo - 2, fy - 6, 5, 1, '#ffffff'); P(fxo - 3, fy + 8, 8, 1, '#2bbf6a');
    for (let i = 0; i < 4; i++) { const by3 = fy + 8 - ((t * 7 + i * 2.5) % 10); if (by3 > fy + 2) Q(fxo - 2 + (i % 3) * 2, by3, '#eaffff'); }
    if (phase < 0.25) for (let a = 0; a < 6.283; a += 0.5) Q(fxo + Math.cos(a) * 8, fy + 4 + Math.sin(a) * 8, '#5cff9c');

    // mood extras
    if (worried) { const sy = 13 + ((t * 8) % 6); P(25, sy, 2, 3, '#7fe3ff'); }
    if (aha) { disc(ox + 17, oy - 8, 4, '#ffe27a'); P(15, -4, 4, 3, '#8a93b4'); if (phase < 0.5) for (let a = 0; a < 6.283; a += 0.8) line(ox + 17 + Math.cos(a) * 6, oy - 8 + Math.sin(a) * 6, ox + 17 + Math.cos(a) * 9, oy - 8 + Math.sin(a) * 9, '#ffe27a', 1); }
    if (happy) for (let i = 0; i < 5; i++) { const a = beats * 2 + i * 1.3, sx = 17 + Math.cos(a) * (16 + i), sy = 8 + Math.sin(a) * 9; if (phase < 0.7) { Q(sx, sy, '#ffffff'); Q(sx - 1, sy, '#ffe27a'); Q(sx + 1, sy, '#ffe27a'); Q(sx, sy - 1, '#ffe27a'); Q(sx, sy + 1, '#ffe27a'); } }
  }, [frame, text, shown, talking, phase, mood]);

  if (!b) return null;
  return (
    <div style={{position: 'absolute', left: 0, width: W, display: 'flex', justifyContent: 'center', top: plan.style.capY, transform: `translateY(-50%) scale(${0.92 + 0.08 * pop})`, opacity: Math.min(1, pop * 1.2) * leave}}>
      <canvas ref={ref} width={CW} height={CH} style={{width: CW * PIXEL, height: CH * PIXEL, imageRendering: 'pixelated', display: 'block'}} />
    </div>
  );
};
