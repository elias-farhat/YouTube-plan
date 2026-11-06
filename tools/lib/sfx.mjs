// Sound-effect cues derived from the plan: what happens on screen decides what you hear.
// Times are seconds. Scene timing mirrors the Remotion scenes (src/**) and Manim scenes (manim/space_scene.py).
import { FPS } from './timeline.mjs';

const IMPACT = { hit: 12, boom: 22, stamp: 14, sting: 10 }; // screen-shake amplitude (px) per cue name

export function buildCues(plan) {
  const cues = [];
  const add = (t, name, gain = 0.6, extra = {}) => cues.push({ t: Math.max(0, +t.toFixed(3)), name, gain, ...extra });
  const n = plan.style.pace.trans, h = Math.round(n / 2);
  const space = plan.channel === 'space';
  const segs = plan.segs;
  segs.forEach((s, i) => {
    const start = s.startFrame / FPS, dur = (s.endFrame - s.startFrame) / FPS;
    const enter = i === 0 ? 0 : space ? start + n / FPS : (s.startFrame + h) / FPS;
    if (i > 0) add(start + 0.02, 'whoosh', 0.32);
    const v = s.visual;
    if (s.isHook && !v) {
      const words = (s.shown ?? s.say).split(/\s+/).length;
      const rows = Math.min(3, Math.max(1, Math.round(words / 2.4)));
      const step = Math.min(0.6, Math.max(0.22, (dur * 0.5) / rows));
      add(0, 'sting', 0.75);
      for (let r = 0; r < rows; r++) add(0.1 + r * step + (r === rows - 1 ? 0.14 : 0.05), r === rows - 1 ? 'hit' : 'whoosh_s', r === rows - 1 ? 0.85 : 0.3);
    } else if (!v) {
      add(enter + 0.15, 'whoosh_s', 0.3);
    } else if (v.type === 'kinetic') {
      const rows = Array.isArray(v.text) ? v.text : [v.text];
      const step = Math.min(0.6, Math.max(0.22, (dur * 0.5) / Math.max(1, rows.length)));
      rows.forEach((row, r) => {
        const t = enter + 0.1 + r * step;
        if (String(row).includes('*')) add(t + 0.12, v.dark ? 'boom' : 'hit', v.dark ? 1.0 : 0.75);
        else add(t + 0.04, 'whoosh_s', 0.28);
      });
      if (s.isHook) add(0, 'sting', 0.6);
    } else if (v.type === 'stat' || v.type === 'counter') {
      if (v.from !== undefined && v.to !== undefined) {
        const cd = Math.min(2.4, 0.25 + dur * 0.7) - 0.25;
        add(enter + 0.25, 'counter', 0.5, { dur: cd });
        add(enter + 0.25 + cd, v.impact ? 'boom' : 'hit', v.impact ? 0.95 : 0.55);
      } else add(enter + 0.12, 'stamp', 0.6);
    } else if (v.type === 'line') {
      add(enter + 0.3, 'draw', 0.35, { dur: dur * 0.72 });
      if (v.delta) add(enter + 0.3 + dur * 0.72, 'hit', 0.6);
    } else if (v.type === 'bar') {
      const stag = Math.min(0.28, (dur * 0.5) / v.y.length);
      v.y.forEach((_, k) => add(enter + 0.25 + k * stag + 0.25, 'ping', 0.4, { f: 660 + 120 * k }));
    } else if (v.type === 'map') {
      (v.cities ?? []).forEach((_, k) => add(enter + 0.5 + k * 0.35 + 0.2, 'ping', 0.4, { f: 988 }));
      if (v.route) add(enter + 0.4, 'draw', 0.4, { dur: dur * 0.72 });
      if (v.year !== undefined) {
        const gained = plan.territories?.some((tr) => tr.year === parseYearNum(v.year));
        if (gained) { const sd = Math.min(dur * 0.6, 2.2); add(enter + 0.35, 'sweep', 0.6, { dur: sd }); add(enter + 0.35 + sd, 'hit', 0.6); }
      }
      if (v.burn) add(enter + 0.5, 'crackle', 0.55, { dur: Math.min(dur * 0.8, 3) });
      (v.battles ?? []).forEach((_, k) => { for (let c = 0; c < 4; c++) add(enter + 0.6 + k * 0.4 + c * 0.2, 'clash', 0.35); add(enter + 1.2 + k * 0.4, 'hit', 0.7); });
    } else if (v.type === 'battle') {
      for (let c = 0; c < 9; c++) add(enter + dur * 0.3 + c * 0.22, 'clash', 0.3 + 0.03 * c);
      add(enter + dur * 0.72, 'boom', 0.9);
    } else if (v.type === 'stamps') {
      const k = v.items.length, st = Math.max(0.5, (dur * 0.6) / k);
      v.items.forEach((_, j) => add(enter + 0.3 + j * st, 'stamp', 0.85));
    } else if (v.type === 'pixel') {
      const sc = v.scene ?? 'planets';
      if (sc === 'fusion') { const k = v.layers ?? 5; for (let j = 0; j < k; j++) add(enter + 0.3 + ((dur - 1.0) * j) / k, 'ping', 0.45, { f: 520 + 110 * j }); }
      else if (sc === 'supernova' && v.phase === 'collapse') { add(enter, 'riser', 0.8, { dur: Math.max(1.2, dur - 0.25) }); add(enter + dur - 0.1, 'tick', 0.5); }
      else if (sc === 'supernova') { add(enter + 0.05, 'boom', 1.0); add(enter + 0.1, 'sweep', 0.5, { dur: 1.4 }); }
      else if (sc === 'nebula') add(enter + 0.2, 'swell', 0.45, { dur: Math.min(dur, 3) });
      else if (sc === 'disc') add(enter + 0.3, 'draw', 0.4, { dur: dur * 0.8 });
      else if (sc === 'cosmos') add(enter + 0.2, 'swell', 0.35, { dur: Math.min(dur, 2.5) });
      else if (sc === 'earth') { add(enter + 0.4, 'ping', 0.5, { f: 988 }); add(enter + 0.9, 'ping', 0.4, { f: 1318 }); }
      else if (sc === 'star' && s.isHook) add(0.0, 'sting', 0.6);
    } else if (v.type === 'lightbeam') {
      add(enter + 0.45, 'draw', 0.35, { dur: dur * 0.82 }); add(enter + 0.45 + dur * 0.82, 'ping', 0.5, { f: 1318 });
    } else if (v.type === 'ladder') {
      const k = v.items.length;
      v.items.forEach((_, j) => add(enter + 0.5 + ((dur - 1.0) * (j + 0.8)) / k, 'ping', 0.4, { f: 784 + 90 * j }));
    } else if (v.type === 'orbit' && v.vanish) {
      add(enter + 0.5 + (dur - 0.5) * 0.35, 'boom', 0.7);
    } else if (v.type === 'scale') {
      add(enter + 0.9, 'counter', 0.45, { dur: Math.max(1, dur * 0.8) - 0.4 });
    }
    // hints from the script: sfx: [riser, boom, hit, stamp, sting, whoosh]
    for (const hint of s.sfx ?? []) {
      if (hint === 'riser') add(Math.max(0, s.speechStart - 1.7), 'riser', 0.65, { dur: 1.7 });
      else if (hint === 'none') continue;
      else add(s.speechStart, hint, hint === 'boom' ? 1.0 : 0.8);
    }
  });
  const end = plan.totalFrames / FPS;
  add(end - 1.8, 'swell', 0.35, { dur: 1.7 });
  cues.sort((a, b) => a.t - b.t);
  const impacts = cues.filter((c) => IMPACT[c.name]).map((c) => ({ t: c.t, amp: IMPACT[c.name] * Math.min(1.2, c.gain + 0.3) }));
  return { cues, impacts };
}

function parseYearNum(s) {
  if (typeof s === 'number') return s;
  const m = String(s).match(/^\s*(\d+)\s*(BC|BCE|AD|CE)?\s*$/i);
  return m ? (/^(BC|BCE)$/i.test(m[2] || '') ? -parseInt(m[1], 10) : parseInt(m[1], 10)) : NaN;
}
