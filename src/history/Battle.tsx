import React from 'react';
import {useCurrentFrame} from 'remotion';
import {SceneProps} from '../scenes/common';
import {SERIF} from '../lib/fonts';
import {clamp01, easeInOut, easeOut, fmtNum, lerp, seg, withAlpha} from '../lib/anim';

const ROME = '#d9483b', CARTHAGE = '#f0c04a';
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const bez = (a: number[], c: number[], b: number[], t: number): [number, number] => [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]];

/**
 * Schematic of the Battle of Cannae: the Roman block drives into a Carthaginian centre that gives way, the wings
 * and cavalry close around it, and the legions are crushed.
 * visual: {type: battle, title: "CANNAE - 216 BC", dead: 50000, rome: "ROME", enemy: "CARTHAGE"}
 */
export const Battle: React.FC<SceneProps> = ({v, plan, dur}) => {
  const frame = useCurrentFrame();
  const t = frame / plan.fps;
  const p = plan.style.palette;
  const {w, h} = plan.style.stage;
  const cx = w / 2;
  const u = clamp01(t / dur);
  const intro = easeOut(seg(t, 0, 0.5));
  const adv = easeInOut(seg(u, 0.04, 0.34));      // Romans advance, centre gives way
  const pin = easeInOut(seg(u, 0.30, 0.70));      // pincers close
  const dead = seg(u, 0.68, 0.98);                // collapse
  const dead_n = Math.round(((v.dead as number) ?? 50000) * easeOut(dead));

  // Roman block
  const cols = 12, rows = 6;
  const romans: {x: number; y: number; die: number}[] = [];
  const squeeze = lerp(1, 0.62, pin);
  const rcy = lerp(h * 0.66, h * 0.52, adv);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const k = r * cols + c;
    romans.push({x: cx + (c - (cols - 1) / 2) * 36 * squeeze, y: rcy + (r - (rows - 1) / 2) * 26 * lerp(1, 0.8, pin), die: hash(k) * 0.9});
  }
  // Carthaginian centre: a line that bows towards the Romans, then bends away (crescent) as they push in
  const n = 18;
  const bow = lerp(70, -120, adv);
  const centre = Array.from({length: n}, (_, i) => {
    const q = (i / (n - 1)) * 2 - 1;
    return {x: cx + q * 250 * lerp(1, 0.78, pin), y: h * 0.34 + bow * (1 - q * q) + lerp(0, 30, pin) * q * q};
  });
  // infantry wings pivot inward to the Roman flanks
  const wingL = Array.from({length: 8}, (_, i) => ({x: lerp(cx - 330, cx - 245, pin) + (i % 2) * 28, y: lerp(h * 0.36, h * 0.5, pin) + Math.floor(i / 2) * 26}));
  const wingR = Array.from({length: 8}, (_, i) => ({x: lerp(cx + 330, cx + 245, pin) - (i % 2) * 28, y: lerp(h * 0.36, h * 0.5, pin) + Math.floor(i / 2) * 26}));
  // cavalry sweeps around behind
  const cavL = [[cx - 400, h * 0.46], [cx - 520, h * 0.86], [cx - 40, h * 0.9]], cavR = [[cx + 400, h * 0.46], [cx + 520, h * 0.86], [cx + 40, h * 0.9]];
  const cav = (path: number[][], off: number) => bez(path[0], path[1], path[2], easeInOut(clamp01(seg(u, 0.3, 0.7) * 1.0 + off)));
  const pathD = (path: number[][]) => `M ${path[0][0]} ${path[0][1]} Q ${path[1][0]} ${path[1][1]} ${path[2][0]} ${path[2][1]}`;
  const clashFlash = Math.max(0, Math.sin(t * 22) * 0.5 + 0.5) * clamp01(Math.min(seg(u, 0.3, 0.4), 1 - seg(u, 0.7, 0.8)));
  const U = (x: number, y: number, col: string, a = 1, rot = 0, sz = 1) => <rect x={x - 14 * sz} y={y - 9 * sz} width={28 * sz} height={18 * sz} rx={3} fill={col} stroke="rgba(0,0,0,0.45)" strokeWidth={1.5} opacity={a} transform={`rotate(${rot} ${x} ${y})`} />;
  const chip = (x: number, y: number, text: string, col: string) => (
    <g opacity={intro}><rect x={x - text.length * 11 - 18} y={y - 24} width={text.length * 22 + 36} height={48} rx={14} fill="rgba(12,10,8,0.86)" stroke={col} strokeWidth={3} />
      <text x={x} y={y + 2} textAnchor="middle" dominantBaseline="central" fontFamily={SERIF} fontWeight={700} fontSize={30} fill={col} letterSpacing={3}>{text}</text></g>
  );
  return (
    <div style={{position: 'absolute', inset: 0, borderRadius: 38, overflow: 'hidden', border: `4px solid ${withAlpha(p.accent2, 0.9)}`, boxSizing: 'border-box', background: `linear-gradient(180deg, ${p.sea2}, ${p.sea})`}}>
      <svg width={w} height={h} style={{position: 'absolute', left: -4, top: -4}}>
        <rect width={w} height={h} fill={p.land} opacity={0.9} />
        {Array.from({length: 12}, (_, i) => <line key={i} x1={0} x2={w} y1={i * 90} y2={i * 90} stroke={withAlpha(p.border!, 0.25)} strokeWidth={1.5} strokeDasharray="6 10" />)}
        <path d={`M ${w * 0.86} 0 C ${w * 0.78} ${h * 0.25}, ${w * 0.95} ${h * 0.5}, ${w * 0.84} ${h}`} stroke={withAlpha('#4c8fd0', 0.8)} strokeWidth={26} fill="none" opacity={0.7} />
        <text x={w * 0.9} y={h * 0.2} fontFamily={SERIF} fontSize={22} fill={withAlpha('#ffffff', 0.7)} letterSpacing={4} transform={`rotate(90 ${w * 0.9} ${h * 0.2})`}>RIVER AUFIDUS</text>
        {/* cavalry arrows */}
        {[cavL, cavR].map((pt, k) => <path key={k} d={pathD(pt)} fill="none" stroke={withAlpha(CARTHAGE, 0.9 * seg(u, 0.28, 0.4))} strokeWidth={6} strokeDasharray="18 12" strokeDashoffset={-frame * 3} strokeLinecap="round" />)}
        {centre.map((c, i) => <g key={'c' + i}>{U(c.x, c.y, CARTHAGE, intro)}</g>)}
        {wingL.map((c, i) => <g key={'l' + i}>{U(c.x, c.y, CARTHAGE, intro, 0, 0.9)}</g>)}
        {wingR.map((c, i) => <g key={'r' + i}>{U(c.x, c.y, CARTHAGE, intro, 0, 0.9)}</g>)}
        {romans.map((r, i) => {
          const d = easeOut(clamp01((dead - r.die * 0.8) / 0.25));
          return <g key={'m' + i}>{U(r.x, r.y, d > 0.5 ? '#3a1f1c' : ROME, intro * (1 - d * 0.55), d * (hash(i + 9) * 60 - 30), 1 - d * 0.25)}</g>;
        })}
        {[0, 1, 2, 3, 4, 5].map((k) => { const pL = cav(cavL, -k * 0.045), pR = cav(cavR, -k * 0.045); const a = intro * seg(u, 0.28, 0.34);
          return <g key={'v' + k}><circle cx={pL[0]} cy={pL[1]} r={11} fill={CARTHAGE} stroke="rgba(0,0,0,0.5)" strokeWidth={2} opacity={a} /><circle cx={pR[0]} cy={pR[1]} r={11} fill={CARTHAGE} stroke="rgba(0,0,0,0.5)" strokeWidth={2} opacity={a} /></g>; })}
        {/* clash sparks around the block */}
        {clashFlash > 0 && Array.from({length: 14}, (_, i) => { const a = hash(i + Math.floor(t * 10)) * Math.PI * 2, rr = 120 + hash(i * 3 + Math.floor(t * 12)) * 130;
          return <circle key={'s' + i} cx={cx + Math.cos(a) * rr * 1.4} cy={rcy + Math.sin(a) * rr * 0.5} r={3 + 4 * hash(i)} fill={i % 3 ? '#fff4c8' : '#ff9a3c'} opacity={clashFlash * 0.9} />; })}
        {chip(cx - 250, h * 0.14, v.enemy ?? 'CARTHAGE', CARTHAGE)}
        {chip(cx + 250, h * 0.14, v.rome ?? 'ROME', ROME)}
        <rect width={w} height={h} fill={ROME} opacity={0.12 * easeInOut(dead)} />
      </svg>
      {v.title && <div style={{position: 'absolute', left: 22, top: 22, padding: '10px 24px', borderRadius: 20, background: 'rgba(12,10,8,0.78)', border: `2px solid ${withAlpha(p.accent2, 0.9)}`, fontFamily: SERIF, fontSize: 38, color: '#faf0dc', opacity: intro}}>{v.title}</div>}
      {dead > 0 && (
        <div style={{position: 'absolute', left: 0, right: 0, bottom: 30, textAlign: 'center', opacity: clamp01(dead * 3)}}>
          <div style={{fontFamily: SERIF, fontWeight: 700, fontSize: 120, color: ROME, textShadow: '0 6px 0 rgba(0,0,0,0.5)', lineHeight: 1}}>{fmtNum(dead_n)}</div>
          <div style={{fontFamily: SERIF, fontSize: 36, color: '#faf0dc', letterSpacing: 4, marginTop: 6}}>ROMAN SOLDIERS KILLED</div>
        </div>
      )}
    </div>
  );
};
