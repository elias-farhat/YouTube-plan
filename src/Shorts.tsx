import React from 'react';
import {AbsoluteFill, Audio, OffthreadVideo, Sequence, continueRender, delayRender, staticFile} from 'remotion';
import {Plan, Seg} from './lib/types';
import {fontPromises, loadFonts} from './lib/fonts';
import {Background} from './components/Background';
import {Chrome} from './components/Chrome';
import {Captions} from './components/Captions';
import {BitSpeech} from './components/BitSpeech';
import {SceneShell} from './components/SceneShell';
import {Fx} from './components/Fx';
import {Kinetic, Stat, Stage, SceneProps} from './scenes/common';
import {BarChart, LineChart} from './scenes/charts';
import {MapScene} from './history/MapScene';
import {Battle} from './history/Battle';
import {Stamps} from './history/Stamps';
import {Pixel} from './scenes/Pixel';
import {Clip} from './scenes/Clip';

loadFonts();

const SCENES: Record<string, React.FC<SceneProps>> = {kinetic: Kinetic, stat: Stat, line: LineChart, bar: BarChart, map: MapScene, battle: Battle, stamps: Stamps, pixel: Pixel, clip: Clip};

/** Hook = the first ~2 s: the hook sentence as huge kinetic text, last row highlighted. */
const hookRows = (shown: string) => {
  const words = shown.split(/\s+/).filter(Boolean);
  const rows = Math.min(3, Math.max(1, Math.round(words.length / 2.4)));
  const per = Math.ceil(words.length / rows);
  const out: string[] = [];
  for (let i = 0; i < words.length; i += per) out.push(words.slice(i, i + per).join(' '));
  out[out.length - 1] = `*${out[out.length - 1]}*`;
  return out;
};
const autoRows = (shown: string) => {
  const w = shown.split(/\s+/).filter(Boolean);
  const per = Math.max(1, Math.round(w.length / 3));
  const rows: string[] = [];
  for (let i = 0; i < w.length; i += per) rows.push(w.slice(i, i + per).join(' '));
  return rows.slice(0, 4);
};

const SceneFor: React.FC<{seg: Seg; plan: Plan; dur: number; at: number}> = ({seg, plan, dur, at}) => {
  if (seg.isHook && !seg.visual) {
    const v = {type: 'kinetic', text: hookRows(seg.shown ?? seg.say)};
    return <Stage plan={plan}><Kinetic v={v} plan={plan} dur={dur} big /></Stage>;
  }
  const v = seg.visual ?? {type: 'kinetic', text: autoRows(seg.shown ?? seg.say)};
  const C = SCENES[v.type];
  if (!C) throw new Error(`no ${plan.channel} scene for visual type "${v.type}"`);
  return <Stage plan={plan} v={v}><C v={v} plan={plan} dur={dur} at={at} /></Stage>;
};

/** Text is measured (fitText) while rendering, so wait until the custom fonts are really loaded. */
const useFontsReady = () => {
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    const h = delayRender('fonts');
    Promise.all(fontPromises).catch(() => undefined).then(() => document.fonts.ready).then(() => { setReady(true); continueRender(h); });
  }, []);
  return ready;
};

export const Shorts: React.FC<Plan> = (plan) => {
  const fontsReady = useFontsReady();
  const n = plan.style.pace.trans;
  const space = !!plan.bgVideo;   // Manim draws the visuals itself
  if (!fontsReady) return null;
  return (
    <AbsoluteFill style={{background: plan.style.palette.bgTop}}>
      {space && plan.bgVideo ? <OffthreadVideo src={staticFile(plan.bgVideo)} muted style={{width: 1080, height: 1920}} /> : <Background plan={plan} />}
      {!space && plan.segs.map((seg, i) => {
        const last = i === plan.segs.length - 1;
        const h = Math.max(2, Math.round(n / 2));
        const a = i === 0 ? 0 : h, b = last ? 0 : h;          // enter after the previous scene left; leave after the boundary
        const from = seg.startFrame + a;
        const len = Math.max(1, seg.endFrame - seg.startFrame + b - a);
        const dark = !!seg.visual?.dark;
        return (
          <Sequence key={seg.idx} from={from} durationInFrames={len} layout="none">
            <SceneShell plan={plan} from={from} length={len} first={i === 0} last={last}>
              {dark && <div style={{position: 'absolute', inset: -80, background: 'rgba(0,0,0,0.93)'}} />}
              <SceneFor seg={seg} plan={plan} dur={len / plan.fps} at={from / plan.fps} />
            </SceneShell>
          </Sequence>
        );
      })}
      <Fx plan={plan} />
      <Chrome plan={plan} />
      {plan.mode === 'bits' ? <BitSpeech plan={plan} /> : <Captions plan={plan} />}
      {plan.audio && <Audio src={staticFile(plan.audio)} />}
    </AbsoluteFill>
  );
};
