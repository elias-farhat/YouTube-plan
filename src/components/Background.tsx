import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {Plan, W, H} from '../lib/types';
import {withAlpha} from '../lib/anim';

/** Mulberry32 so motif positions are stable per video */
const rnd = (seed: number) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

const Money: React.FC<{plan: Plan; g: number}> = ({plan, g}) => {
  const p = plan.style.palette;
  const r = rnd(plan.style.seed + 5);
  const coins = React.useMemo(() => Array.from({length: 9}, () => ({x: r() * W, y: r() * H, r: 60 + r() * 110, sp: 10 + r() * 16, s: '$%€£+₿'[Math.floor(r() * 6)]})), []);
  const bars = React.useMemo(() => Array.from({length: 18}, () => 0.25 + r() * 0.75), []);
  const m = plan.style.motif;
  return (
    <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
      {m === 'grid' && (<>
        {Array.from({length: 24}, (_, i) => <rect key={'h' + i} x={0} y={i * 90 + ((g * 22) % 90) - 90} width={W} height={2} fill={withAlpha(p.text, 0.045)} />)}
        {Array.from({length: 13}, (_, i) => <rect key={'v' + i} x={i * 90} y={0} width={2} height={H} fill={withAlpha(p.text, 0.045)} />)}
      </>)}
      {m === 'coins' && coins.map((c, i) => {
        const y = ((c.y - g * c.sp * 3) % (H + 2 * c.r) + (H + 2 * c.r)) % (H + 2 * c.r) - c.r;
        return <g key={i}><circle cx={c.x} cy={y} r={c.r} fill="none" stroke={withAlpha(p.accent2, 0.12)} strokeWidth={5} />
          <text x={c.x} y={y} fontSize={c.r * 1.1} fontWeight={900} textAnchor="middle" dominantBaseline="central" fill={withAlpha(p.accent2, 0.12)}>{c.s}</text></g>;
      })}
      {m === 'bars' && bars.map((b, i) => {
        const h = (0.55 + 0.45 * Math.sin(g * 0.9 + i * 0.7)) * b * 360;
        return <rect key={i} x={30 + i * 58} y={H - h} width={40} height={h + 20} rx={10} fill={withAlpha(i % 3 === 0 ? p.accent2 : p.accent, 0.11)} />;
      })}
    </svg>
  );
};

const History: React.FC<{plan: Plan; g: number}> = ({plan, g}) => {
  const p = plan.style.palette;
  const m = plan.style.motif;
  const rot = g * 4;
  return (
    <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
      {m === 'compass' && (() => {
        const cx = W - 130, cy = H - 230, R = 250;
        return <g opacity={1}>
          <circle cx={cx} cy={cy} r={R} fill="none" stroke={withAlpha(p.accent2, 0.13)} strokeWidth={3} />
          <circle cx={cx} cy={cy} r={R * 0.72} fill="none" stroke={withAlpha(p.accent2, 0.1)} strokeWidth={2} />
          {[0, 1, 2, 3].map((k) => { const a = ((rot + 90 * k) * Math.PI) / 180; const pt = (ang: number, rr: number) => `${cx + rr * Math.cos(ang)},${cy + rr * Math.sin(ang)}`;
            return <polygon key={k} points={`${pt(a, R * 1.1)} ${pt(a + 1.57, R * 0.16)} ${pt(a - 1.57, R * 0.16)}`} fill={withAlpha(p.accent2, 0.14)} />; })}
        </g>;
      })()}
      {m === 'graticule' && Array.from({length: 13}, (_, i) => <circle key={i} cx={W / 2 + Math.sin(g * 0.15) * 40} cy={H + 900} r={900 + (i - 3) * 120} fill="none" stroke={withAlpha(p.accent2, 0.08)} strokeWidth={2} />)}
      {m === 'paper' && [0, 1, 2, 3].map((i) => <g key={i}>
        <circle cx={60} cy={60} r={120 + i * 22} fill="none" stroke={withAlpha(p.accent2, 0.18 - i * 0.03)} strokeWidth={3} strokeDasharray="0 9999" />
        <path d={`M ${60 + 120 + i * 22} 60 A ${120 + i * 22} ${120 + i * 22} 0 0 1 60 ${60 + 120 + i * 22}`} fill="none" stroke={withAlpha(p.accent2, 0.2 - i * 0.04)} strokeWidth={3} />
        <path d={`M ${W - 60 - 120 - i * 22} 60 A ${120 + i * 22} ${120 + i * 22} 0 0 0 ${W - 60} ${60 + 120 + i * 22}`} fill="none" stroke={withAlpha(p.accent2, 0.2 - i * 0.04)} strokeWidth={3} />
      </g>)}
    </svg>
  );
};

export const Background: React.FC<{plan: Plan}> = ({plan}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const g = frame / fps;
  const p = plan.style.palette;
  const drift = Math.sin(g * 0.35) * 40;
  return (
    <AbsoluteFill style={{background: `linear-gradient(180deg, ${p.bgTop}, ${p.bgBot})`}}>
      <AbsoluteFill style={{background: `radial-gradient(700px 700px at ${78 + drift / 20}% 18%, ${withAlpha(p.glow, 0.40)}, transparent 70%), radial-gradient(800px 800px at 10% 86%, ${withAlpha(p.glow, 0.24)}, transparent 70%)`}} />
      {plan.channel === 'money' && <Money plan={plan} g={g} />}
      {plan.channel === 'history' && <History plan={plan} g={g} />}
    </AbsoluteFill>
  );
};
