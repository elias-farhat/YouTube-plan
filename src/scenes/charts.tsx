import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {SceneProps} from './common';
import {SANS} from '../lib/fonts';
import {clamp01, easeInOut, easeOut, easeOutBack, fmtNum, lerp, seg, withAlpha} from '../lib/anim';

const niceTicks = (lo: number, hi: number, n = 4) => {
  const raw = Math.max(hi - lo, 1e-9) / n, mag = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].find((m) => raw <= m * mag) ?? 10) * mag;
  const out: number[] = [];
  for (let v = Math.floor(lo / step) * step; v <= Math.ceil(hi / step) * step + step * 0.01; v += step) out.push(v);
  return out;
};
const axis = (v: number, prefix: string, suffix: string, scale: number) => {
  if (v === 0) return prefix + '0' + suffix;
  const x = v / scale;
  const s = Math.abs(x - Math.round(x)) < 1e-9 ? x.toLocaleString('en-US', {maximumFractionDigits: 0}) : x.toLocaleString('en-US', {maximumFractionDigits: 1});
  return prefix + s + ({1: '', 1e3: 'K', 1e6: 'M', 1e9: 'B'} as any)[scale] + suffix;
};
const colorOf = (name: string | undefined, p: any) => (name === 'red' || name === 'bad' ? p.bad : name === 'gold' ? p.accent2 : name === 'green' ? p.accent : p.accent);
const Title: React.FC<{text?: string; p: any; a: number}> = ({text, p, a}) =>
  text ? <div style={{position: 'absolute', left: 30, right: 30, top: 14, fontFamily: SANS, fontWeight: 700, fontSize: 42, color: p.text, opacity: a, lineHeight: 1.25}}>{text}</div> : null;

/** line chart: title, x[] tick labels, y[] values, prefix, suffix, color green|gold|red, delta */
export const LineChart: React.FC<SceneProps> = ({v, plan, dur}) => {
  const frame = useCurrentFrame();
  const t = frame / plan.fps;
  const p = plan.style.palette;
  const {w, h} = plan.style.stage;
  const ys: number[] = v.y;
  const n = ys.length;
  const prefix = v.prefix ?? '', suffix = v.suffix ?? '';
  const lo = v.ymin ?? Math.min(...ys), hi = Math.max(...ys);
  const ticks = niceTicks(lo > 0 && lo < hi * 0.5 ? 0 : lo, hi);
  const top = Math.max(Math.abs(ticks[0]), Math.abs(ticks[ticks.length - 1]));
  const scale = top >= 1e9 ? 1e9 : top >= 1e6 ? 1e6 : top >= 1e4 ? 1e3 : 1;
  const L = 150, R = w - 50, T = v.title ? 170 : 80, B = h - 110;
  const Y = (val: number) => B - ((val - ticks[0]) / (ticks[ticks.length - 1] - ticks[0])) * (B - T);
  const X = (i: number) => L + (i / (n - 1)) * (R - L);
  const col = colorOf(v.color, p);
  const a = clamp01(t / 0.3);
  const u = easeInOut(seg(t, 0.3, 0.3 + dur * 0.72));
  const fi = u * (n - 1), k = Math.min(n - 1, Math.floor(fi));
  const pts: [number, number][] = Array.from({length: k + 1}, (_, i) => [X(i), Y(ys[i])]);
  if (k < n - 1) pts.push([lerp(X(k), X(k + 1), fi - k), lerp(Y(ys[k]), Y(ys[k + 1]), fi - k)]);
  const [hx, hy] = pts[pts.length - 1];
  const val = k < n - 1 ? lerp(ys[k], ys[k + 1], fi - k) : ys[n - 1];
  const dec = String(ys[0]).includes('.') ? String(ys[0]).split('.')[1].length : 0;
  const vt = fmtNum(val, prefix, suffix, dec);
  const bw = vt.length * 26 + 44;
  const bx = Math.min(Math.max(hx, L + bw / 2), R - bw / 2), by = hy - 74 > T - 30 ? hy - 74 : hy + 74;
  const labels: string[] = v.x ?? [];
  const dP = easeOutBack(seg(t, 0.3 + dur * 0.72, 0.3 + dur * 0.72 + 0.4));
  return (
    <svg width={w} height={h} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
      {ticks.map((tv, i) => (<g key={i}><rect x={L} y={Y(tv) - 1} width={R - L} height={2} fill={withAlpha(p.muted, 0.22 * a)} />
        <text x={L - 18} y={Y(tv)} textAnchor="end" dominantBaseline="central" fontFamily={SANS} fontWeight={500} fontSize={30} fill={withAlpha(p.muted, a)}>{axis(tv, prefix, suffix, scale)}</text></g>))}
      {labels.map((lab, j) => <text key={j} x={L + (labels.length > 1 ? j / (labels.length - 1) : 0) * (R - L)} y={B + 42} textAnchor="middle" fontFamily={SANS} fontWeight={500} fontSize={30} fill={withAlpha(p.muted, a)}>{lab}</text>)}
      {pts.length > 1 && <polygon points={[...pts, [pts[pts.length - 1][0], B], [pts[0][0], B]].map((q) => q.join(',')).join(' ')} fill={withAlpha(col, 0.16)} />}
      {pts.length > 1 && <polyline points={pts.map((q) => q.join(',')).join(' ')} fill="none" stroke={col} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />}
      <circle cx={hx} cy={hy} r={46} fill={withAlpha(col, 0.28)} />
      <circle cx={hx} cy={hy} r={17} fill={p.text} stroke={col} strokeWidth={7} />
      <rect x={bx - bw / 2} y={by - 36} width={bw} height={72} rx={22} fill={col} />
      <text x={bx} y={by + 2} textAnchor="middle" dominantBaseline="central" fontFamily={SANS} fontWeight={800} fontSize={44} fill={p.onAccent}>{vt}</text>
      {v.delta && u > 0.97 && (() => {
        const dw = String(v.delta).length * 36 + 64, cx = (L + R) / 2 + 50, cy = (T + B) / 2 - 40;
        return <g transform={`translate(${cx} ${cy}) scale(${dP})`}><rect x={-dw / 2} y={-52} width={dw} height={104} rx={30} fill={p.bad} /><text textAnchor="middle" dominantBaseline="central" fontFamily={SANS} fontWeight={900} fontSize={56} fill="#fff">{v.delta}</text></g>;
      })()}
      <foreignObject x={0} y={0} width={w} height={150}><Title text={v.title} p={p} a={a} /></foreignObject>
    </svg>
  );
};

/** bar chart: title, x[] labels, y[] values, prefix, suffix, highlight[], bad[], orient v|h */
export const BarChart: React.FC<SceneProps> = ({v, plan, dur}) => {
  const frame = useCurrentFrame();
  const t = frame / plan.fps;
  const p = plan.style.palette;
  const {w, h} = plan.style.stage;
  const vals: number[] = v.y, labels: string[] = v.x;
  const n = vals.length;
  const prefix = v.prefix ?? '', suffix = v.suffix ?? '';
  const orient = v.orient ?? plan.style.orient;
  const hi = new Set<number>(v.highlight ?? []), bad = new Set<number>(v.bad ?? []);
  const colour = (i: number) => (bad.has(i) ? p.bad : hi.has(i) ? p.accent2 : p.accent);
  const vmax = Math.max(...vals) * 1.08;
  const a = clamp01(t / 0.3);
  const top = v.title ? 150 : 40;
  const stag = Math.min(0.28, (dur * 0.5) / n);
  const prog = (i: number) => easeOut(seg(t, 0.25 + i * stag, 0.25 + i * stag + 0.8));
  const dec = vals.some((x) => !Number.isInteger(x)) ? 1 : 0;
  const bottom = h - 56;
  return (
    <svg width={w} height={h} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
      <foreignObject x={0} y={0} width={w} height={150}><Title text={v.title} p={p} a={a} /></foreignObject>
      {orient === 'v' ? (() => {
        const base = bottom - 110, l = 40, r = w - 40, slot = (r - l) / n, bw = Math.min(190, slot * 0.66);
        return <g><rect x={l} y={base} width={r - l} height={4} fill={withAlpha(p.muted, 0.5 * a)} />
          {vals.map((val, i) => { const pr = prog(i), cx = l + slot * (i + 0.5), hh = (base - top - 70) * (val / vmax) * pr;
            return <g key={i}><rect x={cx - bw / 2} y={base - hh} width={bw} height={Math.max(hh, 0)} rx={18} fill={colour(i)} />
              <rect x={cx - bw / 2} y={base - hh} width={bw * 0.28} height={Math.max(hh, 0)} rx={18} fill="rgba(255,255,255,0.13)" />
              <text x={cx} y={base - hh - 34} textAnchor="middle" dominantBaseline="central" fontFamily={SANS} fontWeight={800} fontSize={Math.min(46, (slot - 8) / Math.max(4, fmtNum(val, prefix, suffix, dec).length) * 1.8)} fill={withAlpha(p.text, clamp01(pr * 3))}>{fmtNum(val * pr, prefix, suffix, dec)}</text>
              <text x={cx} y={base + 46} textAnchor="middle" fontFamily={SANS} fontWeight={700} fontSize={32} fill={withAlpha(p.muted, a)}>{labels[i]}</text></g>; })}</g>;
      })() : (() => {
        const rowsH = (bottom - top - 10) / n, thick = Math.min(n <= 3 ? 150 : 86, rowsH * 0.5), l = 40, maxw = w - 80;
        return <g>{vals.map((val, i) => { const pr = prog(i), ry = top + rowsH * i + rowsH / 2, bw = Math.max(6, (maxw - 10) * (val / vmax) * pr);
          const lab = fmtNum(val * pr, prefix, suffix, dec), inside = bw > lab.length * 30 + 50;
          return <g key={i}><text x={l} y={ry - thick / 2 - 26} dominantBaseline="central" fontFamily={SANS} fontWeight={700} fontSize={34} fill={withAlpha(p.muted, a)}>{labels[i]}</text>
            <rect x={l} y={ry - thick / 2 + 4} width={bw} height={thick} rx={20} fill={colour(i)} />
            <rect x={l} y={ry - thick / 2 + 4} width={bw} height={thick * 0.3} rx={20} fill="rgba(255,255,255,0.13)" />
            <text x={inside ? l + bw - 22 : l + bw + 20} y={ry + 6} textAnchor={inside ? 'end' : 'start'} dominantBaseline="central" fontFamily={SANS} fontWeight={900} fontSize={48} fill={inside ? p.onAccent : withAlpha(p.text, clamp01(pr * 3))}>{lab}</text></g>; })}</g>;
      })()}
    </svg>
  );
};
