import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Plan, W} from '../lib/types';
import {FONT} from '../lib/pixelfont';
import {clamp01, easeOutBack} from '../lib/anim';
import {hd2d} from '../lib/hd2d';

/**
 * "Bits" mode: DR. BIT, a pixel scientist (wild white hair, round glasses, moustache, lab coat, bow tie, bubbling flask)
 * speaks to the viewer. His line is typed in a speech bubble, one letter per 16th note, mouth in sync; he bobs on the beat
 * and reacts to the story (moods: talk | shock | worried | aha | happy).  No narration, no captions.
 */
const PIXEL = 6, CHAR_PX = 5, CW = 50, CH = 82, CHAR_W = 50;   // Dr. Bit: small canvas, bottom-left.  Text: its own box at the TOP, next to the action
const BW = 150, BH = 66, BPIX = 6;
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export const BitSpeech: React.FC<{plan: Plan}> = ({plan}) => {
  const frame = useCurrentFrame();
  const ref = React.useRef<HTMLCanvasElement>(null);
  const refB = React.useRef<HTMLCanvasElement>(null);
  const loC = React.useRef<HTMLCanvasElement | null>(null);
  const hd = !!plan.hd;
  const t = frame / plan.fps;
  const seg = [...plan.segs].reverse().find((s) => frame >= s.startFrame) ?? plan.segs[0];
  const b = seg.bits;
  const bpm = plan.bpm ?? 120;
  const beats = (t * bpm) / 60, beatIdx = Math.floor(beats), phase = beats - beatIdx;
  const text = b?.text ?? '';
  const mood = (seg as any).mood ?? 'talk';
  const accent = '#ffd23f';
  const lines: string[] = [];
  if (text) { let cur = ''; for (const w of text.split(' ')) { const tr = (cur + ' ' + w).trim(); if (tr.length <= 22 || !cur) cur = tr; else { lines.push(cur); cur = w; } } if (cur) lines.push(cur); }
  const shown = b ? Math.max(0, Math.min(text.length, Math.floor((t - b.start) / b.charT) + 1)) : 0;
  const lastReveal = b ? b.start + (shown - 1) * b.charT : -1;
  const typing = !!b && shown > 0 && t < b.start + text.length * b.charT + 0.05;
  const talking = typing && t - lastReveal < b.charT * 0.9 && text[shown - 1] !== ' ';
  const pop = easeOutBack(clamp01((t - seg.startFrame / plan.fps) / 0.3), 1.3);
  const leave = clamp01((seg.endFrame - 1 - frame) / 10);
  const segT = t - seg.startFrame / plan.fps;
  // placement: default = small in the bottom-left corner; bit:{x,y,s} = full-body Dr. Bit standing IN the scene (feet at x,y as fractions of the frame), bubble above his head; bit:'off' = he leaves, text box stays at the top
  const place = (seg as any).bit ?? null;
  const stage = place && place !== 'off' ? place : null;
  const hidden = place === 'off';
  const sCh = stage ? (stage.s ?? 5) : CHAR_PX;
  const nlines = Math.max(1, lines.length), bhPx = (nlines * 10 + 10);
  const walkT = stage?.to ? clamp01(segT / 1.0) : 1, mvT = walkT * walkT * (3 - 2 * walkT);   // walks from (x,y) to `to` in the first second
  const moving = !!stage?.to && walkT < 1 && segT > 0;
  const feetX = stage ? (stage.x + (stage.to ? (stage.to.x - stage.x) * mvT : 0)) * W : 0, feetY = stage ? (stage.y + (stage.to ? (stage.to.y - stage.y) * mvT : 0)) * 1920 : 0;
  const pt = stage?.point ?? null, pointing = !!pt && segT > 0.25;
  const flipped = stage ? (stage.flip ?? (pt ? pt.x * W < feetX - 40 : (stage.to ? stage.to.x < stage.x : false))) : false;
  const headTop = feetY - CH * sCh + 10 * sCh;                                  // top of his hair
  const bubbleW = (Math.max(8, ...lines.map((l) => l.length)) * 6 + 12) * BPIX;
  const boxL = stage ? Math.max(16, Math.min(W - 16 - bubbleW, feetX - bubbleW / 2)) : 0;         // text box centred over his head, kept on screen
  const bubbleLeft = stage ? boxL - (BW * BPIX - bubbleW) / 2 : 0;                                   // canvas left edge
  const tailX = stage ? Math.max(8, Math.min(BW - 8, Math.round((feetX - bubbleLeft) / BPIX))) : 0;

  React.useLayoutEffect(() => {
    if (!refB.current) return;
    const target = ref.current;
    const cvC = hd ? (loC.current ?? (loC.current = document.createElement('canvas'))) : (target ?? document.createElement('canvas')); cvC.width = CW; cvC.height = CH;
    const ctxC = cvC.getContext('2d')!, ctxB = refB.current.getContext('2d')!;
    let ctx = ctxB;
    ctxC.clearRect(0, 0, CW, CH); ctxB.clearRect(0, 0, BW, BH);
    const R = (x: number, y: number, w: number, h: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); };
    const D = (x: number, y: number, c: string) => R(x, y, 1, 1, c);
    const disc = (cx: number, cy: number, r: number, c: string) => { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + 0.5) D(cx + x, cy + y, c); };
    const ring = (cx: number, cy: number, r: number, c: string) => { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) { const d = x * x + y * y; if (d <= r * r + 0.5 && d >= (r - 1) * (r - 1) - 0.5) D(cx + x, cy + y, c); } };
    const line = (x0: number, y0: number, x1: number, y1: number, c: string, th = 1) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) R(x0 + ((x1 - x0) * i) / Math.max(1, n), y0 + ((y1 - y0) * i) / Math.max(1, n), th, th, c); };
    const glyph = (ch: string, x: number, y: number, c: string) => { const g = FONT[ch] ?? FONT[' ']; ctx.fillStyle = c; for (let k = 0; k < 35; k++) if (g[k] === '#') ctx.fillRect(x + (k % 5), y + Math.floor(k / 5), 1, 1); };

    // ------------------------------------------------------------ speech bubble
    const TEXT_X0 = 6, nl = Math.max(1, lines.length), maxc = Math.max(8, ...lines.map((l) => l.length));
    const bw = maxc * 6 + 12, bx = Math.round((BW - bw) / 2), TEXT_X = bx + 6, bh = nl * 10 + 10, by = 11;      // box fits the text, centred
    R(bx + 1, by, bw - 2, bh, 'rgba(8,6,24,0.92)'); R(bx, by + 1, bw, bh - 2, 'rgba(8,6,24,0.92)');
    for (const [x, y, w, h] of [[bx + 1, by, bw - 2, 1], [bx + 1, by + bh - 1, bw - 2, 1], [bx, by + 1, 1, bh - 2], [bx + bw - 1, by + 1, 1, bh - 2]] as number[][]) R(x, y, w, h, accent);
    let remaining = shown;
    lines.forEach((ln, li) => {
      const y = by + 6 + li * 10;
      let x = TEXT_X;
      for (const ch of ln) { if (remaining <= 0) break; glyph(ch, x + 1, y + 1, '#000000'); glyph(ch, x, y, '#ffffff'); x += 6; remaining -= 1; }
      remaining -= 1;
    });
    if (b && shown >= text.length && phase < 0.5) { const li = Math.max(0, lines.length - 1), x = TEXT_X + (lines[li]?.length ?? 0) * 6; R(x, by + 6 + li * 10, 3, 7, accent); }
    if (seg.idx === 0 && segT < 3.4) { R(bx, 0, 40, 10, '#0a0e22'); R(bx, 0, 40, 1, accent); R(bx, 9, 40, 1, accent); R(bx, 0, 1, 10, accent); R(bx + 39, 0, 1, 10, accent); [...'DR. BIT'].forEach((ch, i) => glyph(ch, bx + 3 + i * 5, 1, '#ffffff')); }
    void TEXT_X0;
    if (stage) { const ty = by + bh; for (let k = 0; k < 4; k++) { R(tailX - 3 + k, ty + k, 7 - 2 * k, 1, 'rgba(8,6,24,0.92)'); } R(tailX - 4, ty - 1, 1, 1, accent); R(tailX + 4, ty - 1, 1, 1, accent); for (let k = 0; k < 4; k++) { R(tailX - 3 + k, ty + k, 1, 1, accent); R(tailX + 3 - k, ty + k, 1, 1, accent); } }
    if (shown === 0) ctxB.clearRect(0, by - 1, BW, BH);                                    // no empty box before the first letter
    ctx = ctxC;

    // ------------------------------------------------------------ DR. BIT
    // dark spotlight behind him so the white coat/hair stand out on bright scenes (daylight, lightning flashes)
    if (!stage) for (let y = 2; y < CH; y++) for (let x = 0; x < CHAR_W; x++) { const d = Math.hypot((x - 25) / 25, (y - 36) / 32); if (d < 1 && (1 - d) * 1.1 > ((x * 7 + y * 13) % 16) / 16 * 0.9) { ctx.fillStyle = 'rgba(10,8,34,0.62)'; ctx.fillRect(x, y, 1, 1); } }
    const SK = '#f2c9a3', SKd = '#d4a27a', HR = '#f6f6ff', HRd = '#b9bddf', COAT = '#f4f6ff', COATd = '#cdd3ee', LN = '#1a1d3a', TEAL = '#2ec4b6', TIE = '#ff4fa3', GL = '#bfeaff';
    const shock = mood === 'shock', worried = mood === 'worried', aha = mood === 'aha', happy = mood === 'happy';
    const bob = plan.outfit === 'astronaut' ? Math.round(Math.sin(t * 1.7) * 2) : plan.outfit === 'diver' ? Math.round(Math.sin(t * 1.2) * 1.5) : phase < 0.18 ? -1 : 0;   // space/sea: float instead of bounce
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

    // legs + shoes (full body), stepping on the beat
    const TR: Record<string, string> = {lab: '#3b4a8c', storm: '#e0a800', gardener: '#6a4f2a', astronaut: '#eef1fb', diver: '#b9792f', hardhat: '#ff8a1f'};
    const trc = TR[plan.outfit ?? 'lab'] ?? TR.lab, step = moving ? Math.floor(frame / 4) % 2 : beatIdx % 2 === 0 ? 1 : 0, lift2 = moving ? 1 : phase < 0.25 ? 1 : 0;
    P(9, 53, 6, 11 - (step ? lift2 : 0), trc); P(19, 53, 6, 11 - (step ? 0 : lift2), trc);
    P(15, 53, 4, 6, trc === '#eef1fb' ? '#cdd3ee' : '#222a55');
    P(7, 64 - (step ? lift2 : 0), 9, 3, '#23233a'); P(18, 64 - (step ? 0 : lift2), 9, 3, '#23233a');
    P(7, 64 - (step ? lift2 : 0), 9, 1, '#4a4a6a'); P(18, 64 - (step ? 0 : lift2), 9, 1, '#4a4a6a');
    // ---- outfit: costume + ambient effects so Dr. Bit lives inside the scene (diver, astronaut, storm, gardener, hardhat)
    const outfit = plan.outfit ?? 'lab';
    const bowl = (rim: string, glass: string, shine: string) => {                    // glass helmet over the whole head
      for (let y = -2; y <= 33; y++) for (let x = -1; x <= 35; x++) { const d = Math.hypot((x - 17) / 18.5, (y - 15) / 19); if (d <= 1) { if (d > 0.9) Q(x, y, rim); else Q(x, y, glass); } }
      for (let k = 0; k < 6; k++) { Q(5 + k, 4 + k * 0, shine); } for (let k = 0; k < 5; k++) { Q(4, 8 + k, shine); }
    };
    if (outfit === 'diver') {
      P(5, 31, 24, 5, '#b9792f'); P(5, 31, 24, 1, '#e8b25a'); P(5, 35, 24, 1, '#7a4a18'); for (let k = 0; k < 5; k++) Q(8 + k * 5, 33, '#ffe9a8');
      bowl('#c98a3a', 'rgba(110,210,255,0.30)', '#e8fbff');
      line(ox + 31, oy + 33, ox + 40, oy + 20, '#1a2a3a', 2);
      for (let i = 0; i < 6; i++) { const q = ((t * 5 + i * 1.7) % 10) / 10; const bx2 = 36 + Math.sin(t * 3 + i * 2) * 3 + i % 3, by4 = 18 - q * 30; if (by4 > -oy) { ring(ox + bx2, oy + by4, 1 + (i % 2), '#d8f6ff'); } }
    } else if (outfit === 'astronaut') {
      P(6, 33, 22, 4, '#9aa4c4'); P(6, 33, 22, 1, '#ffffff'); P(10, 39, 14, 10, '#eef1fb'); P(10, 39, 14, 1, '#ffffff');
      P(12, 41, 3, 2, '#ff4a4a'); P(16, 41, 3, 2, '#4aa8ff'); P(20, 41, 3, 2, '#5cff9c'); P(11, 46, 12, 1, '#9aa4c4');
      bowl('#e6eaf8', 'rgba(255,190,60,0.16)', '#ffffff');
      for (let i = 0; i < 7; i++) { const sx = Math.round(hash(i + 3) * 36) - 1, sy = Math.round(hash(i + 11) * 52) - 6; if (((frame + i * 7) % 24) < 14) Q(sx, sy, '#ffffff'); }
    } else if (outfit === 'storm') {
      P(4, 35, 26, 18, '#ffcf2e'); P(26, 36, 4, 17, '#e0a800'); P(4, 35, 26, 1, '#fff0a0'); P(16, 36, 2, 17, '#c98f00'); for (let k = 0; k < 3; k++) P(15, 38 + k * 5, 4, 2, '#7a5600');
      P(3, 3, 28, 6, '#ffcf2e'); P(1, 8, 32, 3, '#e0a800'); P(3, 3, 28, 1, '#fff0a0');
      for (let i = 0; i < 14; i++) { const rx = Math.round(hash(i + 1) * 40), ry = ((frame * 3 + i * 11) % 66) - 4; line(rx, ry, rx - 1, ry + 3, '#9fd8ff', 1); }
    } else if (outfit === 'gardener') {
      P(8, 38, 18, 15, '#3fae5a'); P(8, 38, 18, 1, '#6fe08a'); P(12, 44, 10, 5, '#2f8a46'); P(11, 36, 2, 3, '#3fae5a'); P(21, 36, 2, 3, '#3fae5a');
      P(-3, 6, 40, 3, '#e8c36a'); P(-3, 8, 40, 1, '#b8913a'); P(7, -2, 20, 9, '#f0d27a'); P(7, 4, 20, 2, '#d33f49'); P(12, -4, 1, 3, '#f0d27a');
      for (let i = 0; i < 4; i++) { const lx2 = ((t * 6 + i * 9) % 40) - 2, ly = 6 + ((i * 17) % 40) + Math.sin(t * 2 + i) * 2; P(lx2, ly, 2, 1, '#6fe08a'); Q(lx2 + 2, ly - 1, '#3fae5a'); }
    } else if (outfit === 'hardhat') {
      P(7, 40, 3, 13, '#ff8a1f'); P(24, 40, 3, 13, '#ff8a1f'); P(5, 35, 24, 3, '#ff8a1f');
      P(5, 0, 24, 9, '#ffc400'); P(4, 7, 26, 3, '#e0a800'); P(5, 0, 24, 1, '#fff0a0'); P(15, -2, 4, 3, '#ffc400'); P(14, 2, 6, 4, '#ffffff'); P(15, 3, 4, 2, '#fff7a0');
      if (phase < 0.6) for (let k = 0; k < 4; k++) Q(17 + k * 2, 6 + k * 0, 'rgba(255,255,160,0.8)');
    }
    // arms: the gesturing arm (screen left) and the flask arm (screen right)
    const arm = (sx: number, sy: number, hx: number, hy: number) => { line(ox + sx, oy + sy, ox + hx, oy + hy, COAT, 4); line(ox + sx + 3, oy + sy + 1, ox + hx + 3, oy + hy + 1, COATd, 1); P(hx - 1, hy - 2, 4, 3, SK); };
    if (shock) arm(4, 38, -1, 20); else if (aha) { arm(4, 38, 1, 14); P(1, 10, 2, 4, SK); } else if (happy) arm(4, 38, -2 + Math.round(Math.sin(beats * 3) * 2), 24); else arm(4, 39, -1, 30 - (talking ? 2 : 0) - (phase < 0.2 ? 2 : 0));
    if (pointing) { line(ox + 27, oy + 39, ox + 34, oy + 31, COAT, 4); P(33, 28, 4, 3, SK); P(34, 27, 2, 1, SK); }
    else {
    const fy = shock || happy ? 16 : 40, fxo = 38;
    line(ox + 27, oy + 39, ox + 34, oy + fy + 8, COAT, 4); P(33, fy + 7, 4, 3, SK);
    // the flask: green liquid with bubbles, glowing on the beat
    for (let r = 0; r < 9; r++) { const w = 3 + r; P(fxo - Math.floor(w / 2) + 0.0, fy + r, w, 1, r < 3 ? '#cfeeff' : '#5cff9c'); }
    P(fxo - 1, fy - 5, 3, 5, '#cfeeff'); P(fxo - 2, fy - 6, 5, 1, '#ffffff'); P(fxo - 3, fy + 8, 8, 1, '#2bbf6a');
    for (let i = 0; i < 4; i++) { const by3 = fy + 8 - ((t * 7 + i * 2.5) % 10); if (by3 > fy + 2) Q(fxo - 2 + (i % 3) * 2, by3, '#eaffff'); }
    if (phase < 0.25) for (let a = 0; a < 6.283; a += 0.5) Q(fxo + Math.cos(a) * 8, fy + 4 + Math.sin(a) * 8, '#5cff9c');

    }
    // mood extras
    if (worried) { const sy = 13 + ((t * 8) % 6); P(25, sy, 2, 3, '#7fe3ff'); }
    if (aha) { disc(ox + 17, oy - 8, 4, '#ffe27a'); P(15, -4, 4, 3, '#8a93b4'); if (phase < 0.5) for (let a = 0; a < 6.283; a += 0.8) line(ox + 17 + Math.cos(a) * 6, oy - 8 + Math.sin(a) * 6, ox + 17 + Math.cos(a) * 9, oy - 8 + Math.sin(a) * 9, '#ffe27a', 1); }
    if (happy) for (let i = 0; i < 5; i++) { const a = beats * 2 + i * 1.3, sx = 17 + Math.cos(a) * (16 + i), sy = 8 + Math.sin(a) * 9; if (phase < 0.7) { Q(sx, sy, '#ffffff'); Q(sx - 1, sy, '#ffe27a'); Q(sx + 1, sy, '#ffe27a'); Q(sx, sy - 1, '#ffe27a'); Q(sx, sy + 1, '#ffe27a'); } }
    // dark 1-px outline so the white coat/hair read on any background (used instead of the spotlight when he stands in the scene)
    if (stage) {
      const tmp = document.createElement('canvas'); tmp.width = CW; tmp.height = CH; const tc = tmp.getContext('2d')!;
      tc.drawImage(cvC, 0, 0); tc.globalCompositeOperation = 'source-in'; tc.fillStyle = '#0a0822'; tc.fillRect(0, 0, CW, CH);
      ctxC.globalCompositeOperation = 'destination-over';
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) ctxC.drawImage(tmp, dx, dy);
      ctxC.globalCompositeOperation = 'source-over';
    }
    if (hd && target) hd2d(cvC, target, 2, 1);
  }, [frame, text, shown, talking, phase, mood, place, pointing, moving]);

  if (!b) return null;
  const sc = 0.92 + 0.08 * pop, op = Math.min(1, pop * 1.2) * leave;
  const bubbleTop = stage ? headTop - (11 + bhPx + 6) * BPIX : 150;
  return (
    <>
      <div style={{position: 'absolute', left: stage ? bubbleLeft : 0, width: stage ? BW * BPIX : W, display: 'flex', justifyContent: 'center', top: bubbleTop, zIndex: 5, transform: `scale(${sc})`, transformOrigin: stage ? 'bottom center' : 'top center', opacity: op}}>
        <canvas ref={refB} width={BW} height={BH} style={{width: BW * BPIX, height: BH * BPIX, imageRendering: 'pixelated', display: 'block'}} />
      </div>
      {!hidden && stage && <div style={{position: 'absolute', left: feetX - 36 * sCh, top: feetY - 7 * sCh, width: 72 * sCh, height: 14 * sCh, borderRadius: '50%', background: 'rgba(0,0,0,0.38)', filter: 'blur(8px)', opacity: op}} />}
      {!hidden && (stage ? (
        <div style={{position: 'absolute', left: feetX - (CW * sCh) / 2, top: feetY - CH * sCh, transform: `scale(${sc}) ${flipped ? 'scaleX(-1)' : ''}`, transformOrigin: 'bottom center', opacity: op}}>
          <canvas ref={ref} width={CW * (hd ? 2 : 1)} height={CH * (hd ? 2 : 1)} style={{width: CW * sCh, height: CH * sCh, imageRendering: hd ? 'auto' : 'pixelated', display: 'block'}} />
        </div>
      ) : (
        <div style={{position: 'absolute', left: 26, bottom: 230, transform: `scale(${sc})`, transformOrigin: 'bottom left', opacity: op}}>
          <canvas ref={ref} width={CW * (hd ? 2 : 1)} height={CH * (hd ? 2 : 1)} style={{width: CW * CHAR_PX, height: CH * CHAR_PX, imageRendering: hd ? 'auto' : 'pixelated', display: 'block'}} />
        </div>
      ))}
      {stage && !hidden && pt && pointing && (() => {
        const left = feetX - (CW * sCh) / 2, top = feetY - CH * sCh;
        const hx = left + (flipped ? CW - 40 : 40) * sCh, hy = top + 42 * sCh, tx = pt.x * W, ty = pt.y * 1920;
        const ext = clamp01((segT - 0.25) / 0.25), len = Math.max(0, Math.hypot(tx - hx, ty - hy) - 30) * ext, ang = (Math.atan2(ty - hy, tx - hx) * 180) / Math.PI;
        const pulse = 1 + 0.3 * Math.exp(-phase * 6);
        return (
          <>
            <div style={{position: 'absolute', left: hx, top: hy - 6, width: len, height: 12, transformOrigin: '0 50%', transform: `rotate(${ang}deg)`, background: 'repeating-linear-gradient(90deg,#d99a45 0 24px,#8a5a1c 24px 30px)', boxShadow: '0 0 0 6px #0a0822', opacity: op}} />
            <div style={{position: 'absolute', left: tx - 44, top: ty - 44, width: 88, height: 88, border: '10px solid #ffd23f', boxShadow: '0 0 0 6px #0a0822', transform: `rotate(45deg) scale(${pulse * ext})`, opacity: op * ext}} />
          </>
        );
      })()}
    </>
  );
};
