import React from 'react';
import {useCurrentFrame, useVideoConfig, spring} from 'remotion';
import {fitText} from '@remotion/layout-utils';
import {Plan, Visual} from '../lib/types';
import {SANS, SERIF, fontFor} from '../lib/fonts';
import {bounceOut, clamp01, easeOut, easeOutBack, easeOutExpo, fmtNum, lerp, parseMarkup, seg, withAlpha} from '../lib/anim';

export type SceneProps = {v: Visual; plan: Plan; dur: number; at?: number};  // at = absolute time (s) the scene starts, for beat sync

/** Absolutely positioned stage rectangle (+ optional footnote under it). */
export const Stage: React.FC<{plan: Plan; v?: Visual; children: React.ReactNode}> = ({plan, v, children}) => {
  const frame = useCurrentFrame();
  const {x, y, w, h} = plan.style.stage;
  const a = clamp01((frame / plan.fps - 0.5) / 0.4);
  return (
    <>
      <div style={{position: 'absolute', left: x, top: y, width: w, height: h}}>{children}</div>
      {v?.note && <div style={{position: 'absolute', left: x, width: w, top: y + h + 14, textAlign: 'center', fontFamily: SANS, fontWeight: 500, fontSize: 27, color: plan.style.palette.muted, opacity: a * 0.95}}>{v.note}</div>}
    </>
  );
};

const KFONT = {money: {f: SANS, w: 900}, space: {f: SANS, w: 800}, science: {f: SANS, w: 800}, history: {f: SERIF, w: 700}} as const;

export const Kinetic: React.FC<SceneProps & {big?: boolean}> = ({v, plan, dur, big}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const st = plan.style, p = st.palette;
  const {f, w: fw} = KFONT[plan.channel];
  const {w: W_, h: H_} = st.stage;
  const rowsRaw: string[] = Array.isArray(v.text) ? v.text : [String(v.text ?? '')];
  const rows = rowsRaw.map(parseMarkup);
  const huge = big || !!v.dark;
  const sizes = rows.map((r) => {
    const txt = r.map((x, i) => (i && !x.glue ? ' ' : '') + x.w).join('');
    const base = (huge ? 210 : r.some((x) => x.e) ? 168 : 128) * (plan.channel === 'history' ? 0.82 : 1);
    return Math.min(base, fitText({text: txt, withinWidth: W_ - 120, fontFamily: f, fontWeight: fw}).fontSize);
  });
  const step = Math.min(0.6, Math.max(0.22, (dur * 0.5) / Math.max(1, rows.length)));
  const dark = plan.channel !== 'history' || p.bgTop < '#555555' || !!v.dark;
  const hl = v.dark ? p.accent2 : p.hl;
  const ringRef: {v: {r: number; a: number} | null} = {v: null};
  return (
    <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: Math.round(Math.max(...sizes) * 0.14)}}>
      <div style={{position: 'absolute', left: W_ / 2 - 520, top: H_ / 2 - 520, width: 1040, height: 1040, borderRadius: 520, background: `radial-gradient(circle, ${withAlpha(v.dark ? p.bad : p.accent, 0.22)}, transparent 68%)`}} />
      {rows.map((row, i) => {
        const t0 = 0.1 + i * step;
        const pr = seg(t, t0, t0 + 0.42);
        const mode = v.dark ? 'pop' : st.kinetic;
        const emphRow = row.some((x) => x.e);
        const dt = t - (t0 + 0.12);
        const punch = emphRow && dt > 0 && dt < 0.4 ? Math.exp(-dt * 13) * 0.1 : 0;   // lands on the sound hit
        if (emphRow && huge && !ringRef.v && dt > 0 && dt < 0.55) ringRef.v = {r: 60 + dt * 1500, a: 1 - dt / 0.55};
        let rowStyle: React.CSSProperties = {};
        if (mode === 'pop') rowStyle = {transform: `scale(${0.5 + 0.5 * easeOutBack(pr, 1.15) + punch})`, opacity: clamp01(pr * 3)};
        if (mode === 'slide') rowStyle = {transform: `translateX(${(i % 2 ? -1 : 1) * (1 - easeOutExpo(pr)) * 760}px) scale(${1 + punch})`, opacity: clamp01(pr * 4)};
        if (mode === 'drop') rowStyle = {transform: `translateY(${-(1 - bounceOut(pr)) * 320}px) scale(${1 + punch})`, opacity: clamp01(pr * 4)};
        if (mode === 'stack') rowStyle = {transform: `scale(${1 + punch})`};
        return (
          <div key={i} style={{display: 'flex', flexWrap: 'nowrap', justifyContent: 'center', alignItems: 'center', fontFamily: f, fontWeight: fw, fontSize: sizes[i], lineHeight: 1.1, whiteSpace: 'nowrap', ...rowStyle}}>
            {row.map((tk, k) => {
              let ws: React.CSSProperties = {};
              if (mode === 'stack') {
                const wp = seg(t, t0 + k * 0.09, t0 + k * 0.09 + 0.3);
                ws = {transform: `scale(${0.5 + 0.5 * easeOutBack(wp, 1.1)})`, opacity: clamp01(wp * 3)};
              }
              const emph = tk.e;
              const pill = emph && st.pill && plan.channel !== 'history' && !v.dark;
              return (
                <span key={k} style={{display: 'inline-block', marginLeft: k === 0 || tk.glue ? 0 : sizes[i] * 0.26, color: pill ? p.onHl : emph ? hl : v.dark ? '#fff' : p.text, background: pill ? p.hl : undefined, borderRadius: sizes[i] * 0.2, padding: pill ? `0 ${sizes[i] * 0.16}px` : undefined, textShadow: dark ? '0 6px 0 rgba(0,0,0,0.3)' : undefined, ...ws}}>{tk.w}</span>
              );
            })}
          </div>
        );
      })}
      {ringRef.v && <div style={{position: 'absolute', left: W_ / 2 - ringRef.v.r, top: H_ / 2 - ringRef.v.r, width: ringRef.v.r * 2, height: ringRef.v.r * 2, borderRadius: ringRef.v.r, border: `${6 * ringRef.v.a + 1}px solid ${withAlpha(hl, ringRef.v.a * 0.9)}`}} />}
      <div style={{height: 12, borderRadius: 6, width: 220 * easeOutExpo(seg(t, 0.35, 1.0)), background: p.accent2}} />
    </div>
  );
};

/** Big number card. visual: label, value | (from,to), prefix, suffix, decimals, sub, trend: up|down */
export const Stat: React.FC<SceneProps> = ({v, plan, dur}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const p = plan.style.palette;
  const f = fontFor(plan.channel);
  const fw = plan.channel === 'history' ? 700 : 900;
  const {w, h} = plan.style.stage;
  const counting = v.from !== undefined && v.to !== undefined;
  const dec = v.decimals ?? 0;
  const prefix = v.prefix ?? '', suffix = v.suffix ?? '';
  const full = counting ? fmtNum(Math.max(Math.abs(v.from), Math.abs(v.to)), prefix, suffix, dec) : String(v.value ?? '');
  const shown = counting ? fmtNum(lerp(v.from, v.to, easeOut(seg(t, 0.25, Math.min(2.4, 0.25 + dur * 0.7)))), prefix, suffix, dec) : full;
  const size = Math.min(290, fitText({text: full, withinWidth: w - 140, fontFamily: f, fontWeight: fw}).fontSize);
  const enter = easeOutBack(seg(t, 0, 0.55));
  const a = clamp01(t / 0.3);
  const tEnd = counting ? Math.min(2.4, 0.25 + dur * 0.7) : 0.12;
  const since = t - tEnd;
  const pulse = v.impact && since > 0 && since < 0.5 ? Math.exp(-since * 9) * 0.14 : 0;   // lands on the sound hit
  const trend = v.trend as 'up' | 'down' | undefined;
  const col = trend === 'down' ? p.bad : trend === 'up' ? p.hl : p.hl;
  const isMoney = plan.channel === 'money';
  const arrowP = easeOutBack(seg(t, 0.4, 0.9));
  return (
    <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{position: 'relative', width: w - 40, padding: '70px 40px 60px', borderRadius: 44, background: isMoney ? withAlpha(p.panel, 0.94 * a) : 'transparent', borderTop: isMoney ? `14px solid ${p.accent2}` : undefined, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: a, textAlign: 'center'}}>
        {plan.channel === 'history' && <div style={{position: 'absolute', left: 20, right: 20, top: 0, height: 4, background: p.accent2}} />}
        {plan.channel === 'history' && <div style={{position: 'absolute', left: 20, right: 20, bottom: 0, height: 4, background: p.accent2}} />}
        {v.label && <div style={{fontFamily: SANS, fontWeight: 800, fontSize: 40, letterSpacing: 1, color: p.muted, textTransform: 'uppercase', marginBottom: 30}}>{v.label}</div>}
        <div style={{fontFamily: f, fontWeight: fw, fontSize: size * (0.8 + 0.2 * enter + pulse), color: v.impact && since > 0 ? p.bad : col, lineHeight: 1.05, textShadow: '0 8px 0 rgba(0,0,0,0.25)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap'}}>{shown}</div>
        {trend && (
          <svg width={120} height={110} style={{marginTop: 10}}>
            <polygon fill={col} transform={trend === 'down' ? 'translate(60 55) scale(1 -1) translate(-60 -55)' : undefined}
              points={[[60, 55 - 44], [60 + 44, 55 + 6], [60 + 16, 55 + 6], [60 + 16, 55 + 40], [60 - 16, 55 + 40], [60 - 16, 55 + 6], [60 - 44, 55 + 6]].map(([x, y]) => `${60 + (x - 60) * arrowP},${55 + (y - 55) * arrowP}`).join(' ')} />
          </svg>
        )}
        {v.sub && <div style={{fontFamily: SANS, fontWeight: 700, fontSize: 40, color: p.text, opacity: 0.92 * clamp01((t - 0.35) / 0.45), marginTop: 26, maxWidth: w - 190, lineHeight: 1.3}}>{v.sub}</div>}
      </div>
    </div>
  );
};
