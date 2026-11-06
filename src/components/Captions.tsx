import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {Plan, Seg, Word, W} from '../lib/types';
import {easeOutBack, clamp01, withAlpha} from '../lib/anim';
import {SANS, SERIF} from '../lib/fonts';
import {FONT} from '../lib/pixelfont';

const CFG = {
  pop: {font: SANS, weight: 900, size: 84, upper: true, stroke: 9},
  underline: {font: SANS, weight: 800, size: 78, upper: false, stroke: 8},
  bar: {font: SANS, weight: 800, size: 68, upper: false, stroke: 0},
  glow: {font: SANS, weight: 700, size: 74, upper: false, stroke: 6},
  serif: {font: SERIF, weight: 700, size: 64, upper: false, stroke: 7},
} as const;

export const makeChunks = (words: Word[], maxWords: number, maxChars = 30): Word[][] => {
  const chunks: Word[][] = [];
  let cur: Word[] = [];
  for (const w of words) {
    cur.push(w);
    const txt = cur.map((x) => x.text).join(' ');
    const end = /[.!?,;:]$/.test(w.text);
    if (cur.length >= maxWords || txt.length >= maxChars || (end && cur.length >= 2)) { chunks.push(cur); cur = []; }
  }
  if (cur.length) {
    const last = chunks[chunks.length - 1];
    if (last && cur.length === 1 && last.length < maxWords + 1 && !/[.!?]$/.test(last[last.length - 1].text)) last.push(...cur);
    else chunks.push(cur);
  }
  return chunks;
};

/** Captions drawn with the 5x7 pixel font on a tiny canvas (8 CSS px per pixel), outlined, on a dark panel; the spoken word lights up. */
const PIXEL = 8, PW = 128;
const PixelCaption: React.FC<{words: string[]; act: number; accent: string}> = ({words, act, accent}) => {
  const ref = React.useRef<HTMLCanvasElement>(null);
  const maxChars = 20;
  const lines: {w: string; i: number}[][] = [];
  let cur: {w: string; i: number}[] = [], len = 0;
  words.forEach((w, i) => { const add = (cur.length ? 1 : 0) + w.length; if (cur.length && len + add > maxChars) { lines.push(cur); cur = []; len = 0; } len += (cur.length ? 1 : 0) + w.length; cur.push({w: w.toUpperCase(), i}); });
  if (cur.length) lines.push(cur);
  const PH = lines.length * 10 + 8;
  const longest = Math.max(...lines.map((l) => l.reduce((a, x) => a + x.w.length, 0) + l.length - 1));
  const CW = Math.min(PW, longest * 6 + 12);   // panel hugs the text
  React.useLayoutEffect(() => {
    const ctx = ref.current!.getContext('2d')!;
    ctx.clearRect(0, 0, CW, PH);
    ctx.fillStyle = 'rgba(8,6,24,0.86)'; ctx.fillRect(1, 1, CW - 2, PH - 2);
    ctx.fillStyle = accent; ctx.fillRect(1, 0, CW - 2, 1); ctx.fillRect(1, PH - 1, CW - 2, 1); ctx.fillRect(0, 1, 1, PH - 2); ctx.fillRect(CW - 1, 1, 1, PH - 2);
    const glyph = (ch: string, x: number, y: number, col: string) => { const g = FONT[ch] ?? FONT[' ']; ctx.fillStyle = col; for (let k = 0; k < 35; k++) if (g[k] === '#') ctx.fillRect(x + (k % 5), y + Math.floor(k / 5), 1, 1); };
    lines.forEach((ln, li) => {
      const text = ln.map((x) => x.w).join(' ');
      let x = Math.round((CW - (text.length * 6 - 1)) / 2);
      const y = 5 + li * 10;
      ln.forEach((wd, wi) => {
        const col = wd.i === act ? accent : '#ffffff';
        for (const ch of wd.w) { glyph(ch, x + 1, y + 1, '#000000'); glyph(ch, x, y, col); x += 6; }
        x += 6; // space
      });
    });
  }, [words.join(' '), act, accent, CW]);
  return <canvas ref={ref} width={CW} height={PH} style={{width: CW * PIXEL, height: PH * PIXEL, imageRendering: 'pixelated', display: 'block'}} />;
};

const lum = (hex: string) => { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };

const SegCaptions: React.FC<{seg: Seg; plan: Plan}> = ({seg, plan}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const st = plan.style, p = st.palette;
  const cfg = CFG[st.caption === 'pixel' ? 'pop' : st.caption];
  const chunks = React.useMemo(() => makeChunks(seg.words, st.pace.chunk), [seg, st.pace.chunk]);
  if (!chunks.length) return null;
  const starts = chunks.map((c) => c[0].start);
  starts[0] = Math.min(starts[0], seg.speechStart) - 0.02;
  let k = -1;
  starts.forEach((s, i) => { if (t >= s) k = i; });
  if (k < 0) return null;
  const words = chunks[k];
  const age = t - starts[k];
  const alpha = clamp01(age / 0.08);
  const pop = age < 0.16 ? 0.9 + 0.1 * easeOutBack(age / 0.16) : 1;
  let act = 0;
  words.forEach((w, i) => { if (t >= w.start) act = i; });
  const acol = lum(p.accent) > 0.38 ? p.accent : p.accent2;
  const size = Math.round(words.map((w) => w.text).join(' ').length > 26 ? cfg.size * 0.92 : cfg.size);
  const panel = st.caption === 'bar';
  if (st.caption === 'pixel') {
    return (
      <div style={{position: 'absolute', left: 0, width: W, display: 'flex', justifyContent: 'center', top: st.capY, transform: `translateY(-50%) scale(${pop})`, opacity: alpha}}>
        <PixelCaption words={words.map((w) => w.text)} act={act} accent={acol} />
      </div>
    );
  }
  return (
    <div style={{position: 'absolute', left: (W - 940) / 2, width: 940, top: st.capY, transform: `translateY(-50%) scale(${pop})`, opacity: alpha, display: 'flex', justifyContent: 'center'}}>
      <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: size * 0.26, rowGap: 0, lineHeight: 1.18, padding: panel ? '20px 38px' : 0, background: panel ? 'rgba(14,14,20,0.80)' : undefined, borderRadius: 34}}>
        {words.map((w, i) => {
          const isAct = i === act;
          const txt = cfg.upper ? w.text.toUpperCase() : w.text;
          const style: React.CSSProperties = {fontFamily: cfg.font, fontWeight: cfg.weight, fontSize: size, color: '#fff', position: 'relative', display: 'inline-block'};
          if (cfg.stroke) { (style as any).WebkitTextStroke = `${cfg.stroke}px rgba(8,8,14,1)`; (style as any).paintOrder = 'stroke fill'; style.textShadow = '0 5px 0 rgba(0,0,0,0.35)'; }
          if (isAct) {
            style.color = panel ? p.onAccent : acol;
            if (panel) { style.background = acol; style.borderRadius = 22; style.padding = '0 12px'; style.margin = '0 -12px'; }
            if (st.caption === 'glow') style.textShadow = `0 0 28px ${withAlpha(acol, 0.9)}, 0 0 60px ${withAlpha(acol, 0.55)}`;
          }
          return (
            <span key={i} style={style}>
              {txt}
              {isAct && (st.caption === 'underline' || st.caption === 'serif') && (
                <span style={{position: 'absolute', left: 0, right: 0, bottom: -2, height: 9, borderRadius: 4, background: st.caption === 'serif' ? p.accent2 : acol}} />
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
};

export const Captions: React.FC<{plan: Plan}> = ({plan}) => {
  const frame = useCurrentFrame();
  const t = frame / plan.fps;
  // the segment currently speaking (captions stay with their own line, hook is shown as big text instead)
  const seg = [...plan.segs].reverse().find((s) => frame >= s.startFrame) ?? plan.segs[0];
  if (seg.isHook && !seg.visual) return null;
  return <SegCaptions key={seg.idx} seg={{...seg}} plan={plan} />;
};
