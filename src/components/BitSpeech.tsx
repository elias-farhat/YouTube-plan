import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Plan, W} from '../lib/types';
import {FONT} from '../lib/pixelfont';
import {clamp01, easeOutBack} from '../lib/anim';

/**
 * "Bits" mode: a little pixel character speaks to the viewer. The line is typed one letter per 16th note,
 * the mouth moves with every letter, the box and the character bounce on the beat. No narration, no captions.
 */
const PIXEL = 7, CW = 136, AV = 22;
const toRGB = (h: string): [number, number, number] => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };

export const BitSpeech: React.FC<{plan: Plan}> = ({plan}) => {
  const frame = useCurrentFrame();
  const ref = React.useRef<HTMLCanvasElement>(null);
  const t = frame / plan.fps;
  const seg = [...plan.segs].reverse().find((s) => frame >= s.startFrame) ?? plan.segs[0];
  const b = seg.bits;
  const p = plan.style.palette;
  const bpm = plan.bpm ?? 120;
  const beats = (t * bpm) / 60, beatIdx = Math.floor(beats), phase = beats - beatIdx;
  const text = b?.text ?? '';
  // wrap into lines of <= 16 characters
  const lines: string[] = [];
  if (text) { let cur = ''; for (const w of text.split(' ')) { const tr = (cur + ' ' + w).trim(); if (tr.length <= 16 || !cur) cur = tr; else { lines.push(cur); cur = w; } } if (cur) lines.push(cur); }
  const nLines = Math.max(lines.length, 1), CH = nLines * 10 + 12;
  const shown = b ? Math.max(0, Math.min(text.length, Math.floor((t - b.start) / b.charT) + 1)) : 0;
  const lastReveal = b ? b.start + (shown - 1) * b.charT : -1;
  const talking = b && shown > 0 && shown < text.length + 1 && t - lastReveal < b.charT * 0.9 && text[shown - 1] !== ' ' && t < b.start + text.length * b.charT + 0.05;
  const accent = p.accent2 && p.accent2 !== '#000000' ? p.accent2 : '#ffe27a';
  const pop = seg.startFrame === frame ? 0 : easeOutBack(clamp01((t - seg.startFrame / plan.fps) / 0.25), 1.3);
  const leave = clamp01((seg.endFrame - frame) / 8);

  React.useLayoutEffect(() => {
    const ctx = ref.current!.getContext('2d')!;
    ctx.clearRect(0, 0, CW, CH);
    const rect = (x: number, y: number, w: number, h: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
    const glyph = (ch: string, x: number, y: number, c: string) => { const g = FONT[ch] ?? FONT[' ']; ctx.fillStyle = c; for (let k = 0; k < 35; k++) if (g[k] === '#') ctx.fillRect(x + (k % 5), y + Math.floor(k / 5), 1, 1); };
    // panel
    rect(1, 1, CW - 2, CH - 2, 'rgba(8,6,24,0.88)');
    for (const [x, y, w, h] of [[1, 0, CW - 2, 1], [1, CH - 1, CW - 2, 1], [0, 1, 1, CH - 2], [CW - 1, 1, 1, CH - 2]] as number[][]) rect(x, y, w, h, accent);
    // the little bit character: bounces on the beat, blinks, mouth moves with each letter
    const bob = phase < 0.2 ? -1 : 0, ax = 5, ay = Math.round(CH / 2 - 8) + bob;
    const head = '#37e6ff', dark = '#0a6a80';
    rect(ax, ay, 14, 14, head); rect(ax, ay + 12, 14, 2, dark); rect(ax + 13, ay, 1, 14, dark);
    rect(ax + 6, ay - 3, 2, 3, head); rect(ax + 5, ay - 5, 4, 2, phase < 0.35 ? '#ffffff' : '#ff4fa3');      // antenna blinks on the beat
    const blink = beatIdx % 6 === 5 && phase < 0.25;
    if (blink) { rect(ax + 2, ay + 5, 3, 1, '#0a1530'); rect(ax + 9, ay + 5, 3, 1, '#0a1530'); }
    else { rect(ax + 2, ay + 4, 3, 3, '#0a1530'); rect(ax + 9, ay + 4, 3, 3, '#0a1530'); rect(ax + 2, ay + 4, 1, 1, '#ffffff'); rect(ax + 9, ay + 4, 1, 1, '#ffffff'); }
    if (talking) rect(ax + 4, ay + 9, 6, 3, '#0a1530'); else rect(ax + 4, ay + 10, 6, 1, '#0a1530');
    // typed text (outlined), cursor blinks on the beat once the line is complete
    let remaining = shown;
    lines.forEach((ln, li) => {
      const y = 6 + li * 10;
      let x = AV + 6;
      for (const ch of ln) {
        if (remaining <= 0) break;
        glyph(ch, x + 1, y + 1, '#000000'); glyph(ch, x, y, '#ffffff'); x += 6; remaining -= 1;
      }
      remaining -= 1; // the space between wrapped lines
    });
    if (b && shown >= text.length && phase < 0.5) { const li = lines.length - 1, x = AV + 6 + lines[li].length * 6; rect(x, 6 + li * 10, 3, 7, accent); }
  }, [frame, text, shown, talking, phase, nLines]);

  if (!b) return null;
  return (
    <div style={{position: 'absolute', left: 0, width: W, display: 'flex', justifyContent: 'center', top: plan.style.capY, transform: `translateY(-50%) scale(${0.9 + 0.1 * pop + (phase < 0.15 ? 0.012 : 0)})`, opacity: pop * leave}}>
      <canvas ref={ref} width={CW} height={CH} style={{width: CW * PIXEL, height: CH * PIXEL, imageRendering: 'pixelated', display: 'block'}} />
    </div>
  );
};
