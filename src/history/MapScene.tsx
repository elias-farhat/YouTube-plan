import React from 'react';
import {useCurrentFrame} from 'remotion';
import {SceneProps} from '../scenes/common';
import {SERIF} from '../lib/fonts';
import {clamp01, easeInOut, easeOut, easeOutBack, lerp, mixHex, seg, withAlpha} from '../lib/anim';
import {BY_NAME, COUNTRIES, K, PRESETS, Place, SEAS, merc, parseYear, resolvePlace} from './geo';

const toRad = (d: number) => (d * Math.PI) / 180;
const parseView = (s: string): [number, number, number][] => s.split('>').map((x) => { const k = x.trim(); return PRESETS[k] ?? (k.split(',').map(Number) as [number, number, number]); });

/** Catmull-Rom through points, sampled; 2-point routes get a gentle arc. */
const smooth = (pts: [number, number][], per = 16): {p: [number, number]; wp: number}[] => {
  let P = pts;
  if (P.length === 2) {
    const [a, b] = P, dx = b[0] - a[0], dy = b[1] - a[1];
    P = [a, [(a[0] + b[0]) / 2 - dy * 0.14, (a[1] + b[1]) / 2 + dx * 0.14], b];
  }
  const out: {p: [number, number]; wp: number}[] = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    for (let s = 0; s < per; s++) {
      const t = s / per, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({p: [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])], wp: s === 0 ? i : -1});
    }
  }
  out.push({p: P[P.length - 1], wp: P.length - 1});
  return out;
};

const Chip: React.FC<{x: number; y: number; text: string; q: number; W: number}> = ({x, y, text, q, W}) => {
  const w = text.length * 16.5 + 34;
  const x0 = Math.min(Math.max(x - w / 2, 8), W - 8 - w);
  return (
    <g opacity={q}>
      <rect x={x0} y={y - 22} width={w} height={44} rx={14} fill="rgba(12,10,8,0.84)" />
      <text x={x0 + w / 2} y={y + 1} textAnchor="middle" dominantBaseline="central" fontFamily={SERIF} fontWeight={700} fontSize={29} fill="#faf0dc">{text}</text>
    </g>
  );
};

/**
 * visual: {type: map, year: "117 AD", from: "133 BC", view: "italy>empire", cities: [Rome], route: [A,B,C],
 *          labels: [{text: GAUL, at: [2.5, 46.5]}], label: "Greatest extent", origin: Rome, note}
 */
export const MapScene: React.FC<SceneProps> = ({v, plan, dur}) => {
  const frame = useCurrentFrame();
  const t = frame / plan.fps;
  const st = plan.style, p = st.palette;
  const {w, h} = st.stage;
  const terr = plan.territories;
  const year = v.year !== undefined ? parseYear(v.year) : null;
  const held: string[] = [], gained: string[] = [];
  if (year !== null) for (const tr of terr) { if (tr.year === year) gained.push(...tr.countries); else if (tr.year < year) held.push(...tr.countries); }

  // camera
  const views = parseView(v.view ?? 'empire');
  let cx: number, cy: number, span: number;
  if (views.length > 1) {
    const q = easeInOut(seg(t, 0, dur * 0.9));
    cx = lerp(views[0][0], views[1][0], q); cy = lerp(views[0][1], views[1][1], q);
    span = Math.exp(lerp(Math.log(views[0][2]), Math.log(views[1][2]), q));
  } else {
    const q = easeInOut(seg(t, 0, dur));
    const drift = ((st.seed % 5) - 2) * 0.6;
    cx = views[0][0] + drift * q; cy = views[0][1]; span = views[0][2] * (1 - st.pace.zoom * q);
  }
  const [Xc, Yc] = merc(cx, cy);
  const z = w / toRad(span) / K;
  const px = (lon: number, lat: number): [number, number] => { const [X, Y] = merc(lon, lat); return [(X - Xc) * z + w / 2, (Y - Yc) * z + h / 2]; };
  const vx0 = Xc - w / 2 / z, vx1 = Xc + w / 2 / z, vy0 = Yc - h / 2 / z, vy1 = Yc + h / 2 / z;
  const visible = (b: number[]) => !(b[2] < vx0 || b[0] > vx1 || b[3] < vy0 || b[1] > vy1);
  const heldSet = new Set(held), gainedSet = new Set(gained);
  const vis = COUNTRIES.filter((c) => visible(c.bbox));

  // sweep geometry (origin = centre of held territory, or of the gained territory)
  const ref = (held.length ? held : gained).filter((n) => BY_NAME[n]);
  let ox = 0, oy = 0;
  if (v.origin) { const o = resolvePlace(v.origin); [ox, oy] = merc(o.lon, o.lat); }
  else if (ref.length) { ox = ref.reduce((a, n) => a + BY_NAME[n].center[0], 0) / ref.length; oy = ref.reduce((a, n) => a + BY_NAME[n].center[1], 0) / ref.length; }
  const maxD = Math.max(1, ...gained.filter((n) => BY_NAME[n]).map((n) => { const b = BY_NAME[n].bbox; return Math.max(...[[b[0], b[1]], [b[2], b[1]], [b[0], b[3]], [b[2], b[3]]].map(([x, y]) => Math.hypot(x - ox, y - oy))); })) * 1.02;
  const sweepEnd = 0.35 + Math.min(dur * 0.6, 2.2);
  const R = maxD * easeOut(seg(t, 0.35, sweepEnd));
  const flash = 1 - seg(t, sweepEnd - 0.2, sweepEnd + 1.0);
  const heldA = clamp01(t / 0.4);
  const newFill = mixHex(p.accent, p.accent2, 0.65 * flash);
  const dark = mixHex(p.accent, '#000000', 0.3);

  // route
  const route: Place[] = (v.route ?? []).map(resolvePlace);
  const rpts = route.length >= 2 ? smooth(route.map((r) => px(r.lon, r.lat))) : [];
  let cum: number[] = [], total = 0;
  rpts.forEach((s, i) => { if (i) total += Math.hypot(s.p[0] - rpts[i - 1].p[0], s.p[1] - rpts[i - 1].p[1]); cum.push(total); });
  const ru = easeInOut(seg(t, 0.4, 0.4 + dur * 0.72)) * total;
  const drawn: [number, number][] = [];
  for (let i = 0; i < rpts.length; i++) {
    if (cum[i] <= ru) drawn.push(rpts[i].p);
    else { const a = rpts[i - 1], f = (ru - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]); drawn.push([lerp(a.p[0], rpts[i].p[0], f), lerp(a.p[1], rpts[i].p[1], f)]); break; }
  }
  const head = drawn[drawn.length - 1], prev = drawn[Math.max(0, drawn.length - 4)];
  const ang = head && prev ? Math.atan2(head[1] - prev[1], head[0] - prev[0]) : 0;

  // year counter
  let yearText: {n: string; era: string} | null = null;
  if (year !== null) {
    const earlier = terr.filter((x) => x.year < year).map((x) => x.year);
    const y0 = v.from !== undefined ? parseYear(v.from) : earlier.length ? Math.max(...earlier) : year;
    const yv = Math.round(lerp(y0, year, easeInOut(seg(t, 0.15, 0.15 + Math.min(1.6, dur * 0.55)))));
    yearText = {n: String(Math.abs(yv)), era: yv < 0 ? 'BC' : 'AD'};
  }
  const cities: Place[] = (v.cities ?? []).map(resolvePlace);
  const labels: {text: string; at: [number, number]}[] = v.labels ?? [];
  const ink = '#faf0dc';
  const lab = v.label as string | undefined;
  const q = easeOut(seg(t, 0.2, 0.7));

  return (
    <div style={{position: 'absolute', inset: 0, borderRadius: 38, overflow: 'hidden', border: `4px solid ${withAlpha(p.accent2, 0.9)}`, boxSizing: 'border-box'}}>
      <svg width={w} height={h} style={{position: 'absolute', left: -4, top: -4}}>
        <defs>
          <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={p.sea} /><stop offset="1" stopColor={p.sea2} /></linearGradient>
          <mask id="sweep" maskUnits="userSpaceOnUse" x={-9999} y={-9999} width={19999} height={19999}>
            <circle cx={ox} cy={oy} r={R} fill="#fff" />
          </mask>
        </defs>
        <rect width={w} height={h} fill="url(#sea)" />
        {[-30, -20, -10, 0, 10, 20, 30, 40, 50, 60, 70].map((lo) => { const [x] = px(lo, 0); return x > 0 && x < w ? <line key={'lo' + lo} x1={x} y1={0} x2={x} y2={h} stroke={withAlpha(p.muted!, 0.1)} strokeWidth={1.5} /> : null; })}
        {[10, 20, 30, 40, 50, 60, 70].map((la) => { const [, y] = px(0, la); return y > 0 && y < h ? <line key={'la' + la} x1={0} y1={y} x2={w} y2={y} stroke={withAlpha(p.muted!, 0.1)} strokeWidth={1.5} /> : null; })}
        <g transform={`translate(${w / 2} ${h / 2}) scale(${z}) translate(${-Xc} ${-Yc})`}>
          {vis.map((c) => <path key={c.name} d={c.d} fill={p.land} stroke={p.border} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />)}
          {vis.filter((c) => heldSet.has(c.name)).map((c) => <path key={'h' + c.name} d={c.d} fill={withAlpha(p.accent, 0.62 * heldA)} stroke={withAlpha(dark, 0.95)} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />)}
          <g mask="url(#sweep)">
            {vis.filter((c) => gainedSet.has(c.name)).map((c) => <path key={'n' + c.name} d={c.d} fill={withAlpha(newFill, 0.8)} stroke={mixHex(p.accent2, '#ffffff', 0.3)} strokeWidth={2.4 + 2.5 * flash} strokeDasharray="12 8" strokeDashoffset={-frame * 1.3} vectorEffect="non-scaling-stroke" />)}
          </g>
          {gained.length > 0 && R > 0 && R < maxD * 0.995 && <>
            <circle cx={ox} cy={oy} r={R} fill="none" stroke={p.accent2} strokeWidth={5} strokeDasharray="22 14" strokeDashoffset={-frame * 2} vectorEffect="non-scaling-stroke" opacity={0.95} />
            <circle cx={ox} cy={oy} r={R * 0.93} fill="none" stroke={p.accent2} strokeWidth={2} vectorEffect="non-scaling-stroke" opacity={0.4} />
          </>}
        </g>
        {SEAS.map(([txt, lo, la]) => { const [x, y] = px(lo, la); const half = txt.length * 9.5; return x > half + 12 && x < w - half - 12 && y > 40 && y < h - 40 ?
          <text key={txt} x={x} y={y} textAnchor="middle" dominantBaseline="central" fontFamily={SERIF} fontSize={22} letterSpacing={7} fill={withAlpha(p.muted!, 0.55)}>{txt}</text> : null; })}
        {labels.map((l, i) => { const [x, y] = px(l.at[0], l.at[1]); const a = easeOut(seg(t, 0.9 + i * 0.25, 1.5 + i * 0.25));
          return a > 0 ? <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="central" fontFamily={SERIF} fontSize={30} letterSpacing={5} fill={ink} stroke="rgba(12,10,8,0.9)" strokeWidth={6} paintOrder="stroke" opacity={a}>{l.text.toUpperCase()}</text> : null; })}
        {rpts.length > 0 && drawn.length > 1 && <>
          <polyline points={drawn.map((d) => d.join(',')).join(' ')} fill="none" stroke="rgba(20,14,8,0.92)" strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" />
          <polyline points={drawn.map((d) => d.join(',')).join(' ')} fill="none" stroke={p.accent2} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="26 14" strokeDashoffset={-frame * 2.4} />
          {head && <polygon transform={`translate(${head[0]} ${head[1]}) rotate(${(ang * 180) / Math.PI})`} points="26,0 -14,-20 -14,20" fill={p.accent2} stroke="rgba(20,14,8,0.95)" strokeWidth={3} />}
        </>}
        {route.map((r, i) => { const wpIdx = rpts.findIndex((s) => s.wp === i); if (wpIdx < 0 || cum[wpIdx] > ru + 0.5) return null; const [x, y] = px(r.lon, r.lat);
          return <g key={'w' + i}><circle cx={x} cy={y} r={9} fill={p.accent2} stroke="rgba(20,14,8,1)" strokeWidth={3} /><Chip x={x} y={y + (i % 2 ? 46 : -46)} text={r.name} q={1} W={w} /></g>; })}
        {cities.map((c, i) => { const [x, y] = px(c.lon, c.lat); const qq = easeOutBack(seg(t, 0.5 + i * 0.35, 1.0 + i * 0.35)); if (qq <= 0) return null; const ph = (t * 1.3 + i * 0.4) % 1;
          return <g key={'c' + i}><circle cx={x} cy={y} r={8 + 34 * ph} fill="none" stroke={withAlpha(p.accent2, (1 - ph) * 0.8)} strokeWidth={3} />
            <circle cx={x} cy={y} r={11 * qq} fill={p.accent2} stroke="rgba(20,14,8,1)" strokeWidth={3} /><Chip x={x} y={y - 38} text={c.name} q={clamp01(qq)} W={w} /></g>; })}
      </svg>
      {yearText && (
        <div style={{position: 'absolute', left: 22, top: 22, height: 116, padding: '0 28px 0 22px', borderRadius: 22, background: 'rgba(12,10,8,0.76)', border: `2px solid ${withAlpha(p.accent2, 0.9)}`, display: 'flex', alignItems: 'baseline', gap: 14, fontFamily: SERIF, color: ink}}>
          <span style={{fontSize: 92, fontWeight: 700, lineHeight: '110px'}}>{yearText.n}</span><span style={{fontSize: 38, color: p.accent2}}>{yearText.era}</span>
        </div>
      )}
      {lab && (
        <div style={{position: 'absolute', left: 24 - (1 - q) * 600, bottom: 28, height: 64, padding: '0 28px', borderRadius: 18, background: 'rgba(12,10,8,0.8)', border: `2px solid ${withAlpha(p.accent2, 0.9)}`, display: 'flex', alignItems: 'center', fontFamily: SERIF, fontSize: 38, color: ink}}>{lab}</div>
      )}
    </div>
  );
};
