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

const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/** Route head: elephant / ship / (default) arrow */
const Head: React.FC<{kind: string; x: number; y: number; ang: number; col: string; t: number}> = ({kind, x, y, ang, col, t}) => {
  const flip = Math.cos(ang) < 0 ? -1 : 1;
  const bob = Math.sin(t * 11) * 2.2;
  if (kind === 'elephant') {
    return (
      <g transform={`translate(${x} ${y + bob}) scale(${flip * 1.5} 1.5)`} stroke="#241a10" strokeWidth={2.4} strokeLinejoin="round">
        <rect x={-30} y={-17} width={52} height={30} rx={14} fill="#9a8f80" />
        {[-22, -10, 8, 18].map((lx, i) => <rect key={i} x={lx} y={8} width={8} height={17 + (Math.sin(t * 11 + i * 1.6) > 0 ? 2 : -1)} rx={3} fill="#857a6b" />)}
        <circle cx={26} cy={-8} r={14} fill="#a89d8e" />
        <circle cx={17} cy={-12} r={9} fill="#8d8273" />
        <path d="M36 -3 q13 6 7 23 q-3 7 -9 2" fill="none" stroke="#a89d8e" strokeWidth={7} strokeLinecap="round" />
        <path d="M34 3 q9 6 15 3" fill="none" stroke="#fff6e2" strokeWidth={3.5} strokeLinecap="round" />
        <circle cx={30} cy={-12} r={2.2} fill="#241a10" stroke="none" />
        <path d="M-28 -17 l-9 -6 l2 12" fill="#9a8f80" />
      </g>
    );
  }
  if (kind === 'ship') {
    return (
      <g transform={`translate(${x} ${y + bob}) rotate(${Math.sin(t * 5) * 4}) scale(${flip * 1.7} 1.7)`} stroke="#241a10" strokeWidth={2.4} strokeLinejoin="round">
        <path d="M-32 4 L32 4 L22 22 L-24 22 Z" fill="#6b4627" />
        <line x1={0} y1={4} x2={0} y2={-34} strokeWidth={3.5} />
        <path d="M2 -32 L30 -2 L2 -2 Z" fill="#f6eed8" />
        <path d="M-2 -28 L-22 -4 L-2 -4 Z" fill="#e9dfc4" />
      </g>
    );
  }
  return <polygon transform={`translate(${x} ${y}) rotate(${(ang * 180) / Math.PI})`} points="26,0 -14,-20 -14,20" fill={col} stroke="rgba(20,14,8,0.95)" strokeWidth={3} />;
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
  cx += 0.10 * Math.sin(t * 0.9); cy += 0.07 * Math.cos(t * 0.7);   // slight camera life
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
  const burns: Place[] = (v.burn ?? []).map(resolvePlace);
  const battles: Place[] = (v.battles ?? []).map(resolvePlace);
  // soldiers marching behind the head
  const dcum: number[] = [0];
  drawn.forEach((d, i) => { if (i) dcum.push(dcum[i - 1] + Math.hypot(d[0] - drawn[i - 1][0], d[1] - drawn[i - 1][1])); });
  const pointAt = (dist: number): [number, number] | null => {
    if (dist < 0 || drawn.length < 2) return null;
    for (let i = 1; i < drawn.length; i++) if (dcum[i] >= dist) { const f = (dist - dcum[i - 1]) / Math.max(1e-6, dcum[i] - dcum[i - 1]); return [lerp(drawn[i - 1][0], drawn[i][0], f), lerp(drawn[i - 1][1], drawn[i][1], f)]; }
    return null;
  };
  const headDist = dcum[dcum.length - 1] ?? 0;
  const labels: {text: string; at: [number, number]}[] = v.labels ?? [];
  const ink = '#faf0dc';
  const lab = v.label as string | undefined;
  const q = easeOut(seg(t, 0.2, 0.7));

  type Spec = {key: string; x: number; y: number; text: string; q: number; offs: [number, number][]};
  const specs: Spec[] = [];
  route.forEach((r, i) => { const wpIdx = rpts.findIndex((s2) => s2.wp === i); if (wpIdx < 0 || cum[wpIdx] > ru + 0.5) return; const [x, y] = px(r.lon, r.lat); specs.push({key: 'w' + i, x, y, text: r.name, q: 1, offs: [[0, -46], [0, 46], [80, -46], [-80, 46], [0, -94], [0, 94]]}); });
  cities.forEach((c, i) => { const qq = easeOutBack(seg(t, 0.5 + i * 0.35, 1.0 + i * 0.35)); if (qq <= 0) return; const [x, y] = px(c.lon, c.lat); specs.push({key: 'c' + i, x, y, text: c.name, q: clamp01(qq), offs: [[0, -40], [0, 40], [90, -40], [-90, 40]]}); });
  battles.forEach((c, i) => { const qq = easeOutBack(seg(t, 0.6 + i * 0.4, 1.1 + i * 0.4)); if (qq <= 0) return; const [x, y] = px(c.lon, c.lat); specs.push({key: 'b' + i, x, y, text: c.name, q: clamp01(qq), offs: [[0, 52], [0, -52], [96, 52], [-96, -52]]}); });
  burns.forEach((c, i) => { const qq = easeOutBack(seg(t, 0.6 + i * 0.3, 1.2 + i * 0.3)); if (qq <= 0) return; const [x, y] = px(c.lon, c.lat); specs.push({key: 'f' + i, x, y, text: c.name, q: clamp01(qq), offs: [[0, 56], [0, -90], [96, 56], [-96, 56]]}); });
  const placed: {x0: number; y0: number; x1: number; y1: number}[] = [{x0: 0, y0: 0, x1: 250, y1: 150}];
  if (lab) placed.push({x0: 0, y0: h - 110, x1: lab.length * 21 + 80, y1: h});
  const chips = specs.map((sp) => {
    const cw = sp.text.length * 16.5 + 34;
    const tryOff = (dx: number, dy: number) => { const x0 = Math.min(Math.max(sp.x + dx - cw / 2, 8), w - 8 - cw); return {x0, y0: sp.y + dy - 24, x1: x0 + cw, y1: sp.y + dy + 24}; };
    let pick = tryOff(...sp.offs[0]);
    for (const [dx, dy] of sp.offs) { const r = tryOff(dx, dy); if (!placed.some((q2) => !(r.x1 < q2.x0 || r.x0 > q2.x1 || r.y1 < q2.y0 || r.y0 > q2.y1))) { pick = r; break; } }
    placed.push(pick);
    return {...sp, cx: (pick.x0 + pick.x1) / 2, cy: (pick.y0 + pick.y1) / 2};
  });
  const tintA = v.tint === 'red' ? 0.18 + 0.05 * Math.sin(t * 6) : 0;

  return (
    <div style={{position: 'absolute', inset: 0, borderRadius: 38, overflow: 'hidden', border: `4px solid ${withAlpha(p.accent2, 0.9)}`, boxSizing: 'border-box'}}>
      <svg width={w} height={h} style={{position: 'absolute', left: -4, top: -4}}>
        <defs>
          <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={p.sea} /><stop offset="1" stopColor={p.sea2} /></linearGradient>
          <radialGradient id="fire"><stop offset="0" stopColor="rgba(255,170,60,0.85)" /><stop offset="0.5" stopColor="rgba(255,90,30,0.35)" /><stop offset="1" stopColor="rgba(255,60,20,0)" /></radialGradient>
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
          {Array.from({length: 13}, (_, k) => { const pt = pointAt(headDist - 24 - k * 15); if (!pt) return null; const j = (hash(k * 7) - 0.5) * 14;
            return <circle key={'sd' + k} cx={pt[0] + Math.sin(ang + 1.57) * j} cy={pt[1] + Math.cos(ang + 1.57) * j + Math.sin(t * 9 + k) * 1.6} r={5.2 - k * 0.12} fill="#fff6e2" stroke="rgba(20,14,8,0.95)" strokeWidth={2} />; })}
          {head && <Head kind={v.icon ?? 'army'} x={head[0]} y={head[1]} ang={ang} col={p.accent2} t={t} />}
        </>}
        {route.map((r, i) => { const wpIdx = rpts.findIndex((s2) => s2.wp === i); if (wpIdx < 0 || cum[wpIdx] > ru + 0.5) return null; const [x, y] = px(r.lon, r.lat);
          return <circle key={'w' + i} cx={x} cy={y} r={9} fill={p.accent2} stroke="rgba(20,14,8,1)" strokeWidth={3} />; })}
        {cities.map((c, i) => { const [x, y] = px(c.lon, c.lat); const qq = easeOutBack(seg(t, 0.5 + i * 0.35, 1.0 + i * 0.35)); if (qq <= 0) return null; const ph = (t * 1.3 + i * 0.4) % 1;
          return <g key={'c' + i}><circle cx={x} cy={y} r={8 + 34 * ph} fill="none" stroke={withAlpha(p.accent2, (1 - ph) * 0.8)} strokeWidth={3} /><circle cx={x} cy={y} r={11 * qq} fill={p.accent2} stroke="rgba(20,14,8,1)" strokeWidth={3} /></g>; })}
        {battles.map((c, i) => { const [x, y] = px(c.lon, c.lat); const qq = easeOutBack(seg(t, 0.6 + i * 0.4, 1.1 + i * 0.4)); if (qq <= 0) return null; const ph = (t * 1.6 + i * 0.3) % 1; const r = 20 * qq;
          return <g key={'b' + i}><circle cx={x} cy={y} r={10 + 60 * ph} fill="none" stroke={withAlpha('#ff4a36', (1 - ph) * 0.9)} strokeWidth={4} />
            <circle cx={x} cy={y} r={r + 8} fill="rgba(20,8,6,0.8)" /><g stroke="#ff5a46" strokeWidth={6} strokeLinecap="round"><line x1={x - r * 0.7} y1={y - r * 0.7} x2={x + r * 0.7} y2={y + r * 0.7} /><line x1={x + r * 0.7} y1={y - r * 0.7} x2={x - r * 0.7} y2={y + r * 0.7} /></g></g>; })}
        {burns.map((c, i) => { const [x, y] = px(c.lon, c.lat); const on = easeOut(seg(t, 0.6 + i * 0.3, 1.4 + i * 0.3)); if (on <= 0) return null;
          return <g key={'f' + i}><circle cx={x} cy={y} r={150 * on * (1 + 0.08 * Math.sin(t * 13))} fill="url(#fire)" />
            {Array.from({length: 22}, (_, k) => { const life = (t * 1.25 + k / 22 + hash(k + i * 9) * 0.3) % 1; const fx = x + (hash(k * 3 + 1) - 0.5) * 80 * (1 - life * 0.4) + Math.sin(t * 8 + k) * 5;
              const fy = y + 10 - life * 150 * on; const smoke = life > 0.62;
              return <circle key={k} cx={smoke ? fx + (life - 0.62) * 40 : fx} cy={smoke ? fy - (life - 0.62) * 50 : fy} r={smoke ? 12 + (life - 0.62) * 70 : 18 * (1 - life) + 3} fill={smoke ? `rgba(60,50,46,${0.42 * (1 - life)})` : life < 0.3 ? '#ffe27a' : life < 0.55 ? '#ff8a2a' : '#e0391e'} opacity={smoke ? 1 : (1 - life) * on} />; })}</g>; })}
        {chips.map((cp) => <Chip key={cp.key} x={cp.cx} y={cp.cy} text={cp.text} q={cp.q} W={w} />)}
        {tintA > 0 && <rect width={w} height={h} fill={`rgba(150,12,8,${tintA})`} />}
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
