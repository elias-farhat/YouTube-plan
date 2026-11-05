import React from 'react';
import {AbsoluteFill, Audio, OffthreadVideo, Sequence, continueRender, delayRender, staticFile} from 'remotion';
import {Plan, Seg} from './lib/types';
import {loadFonts} from './lib/fonts';
import {Background} from './components/Background';
import {Chrome} from './components/Chrome';
import {Captions} from './components/Captions';
import {SceneShell} from './components/SceneShell';
import {Kinetic, Stat, Stage, SceneProps} from './scenes/common';
import {BarChart, LineChart} from './scenes/charts';
import {MapScene} from './history/MapScene';

loadFonts();

const SCENES: Record<string, React.FC<SceneProps>> = {kinetic: Kinetic, stat: Stat, line: LineChart, bar: BarChart, map: MapScene};

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

const SceneFor: React.FC<{seg: Seg; plan: Plan; dur: number}> = ({seg, plan, dur}) => {
  if (seg.isHook) {
    const v = {type: 'kinetic', text: hookRows(seg.shown ?? seg.say)};
    return <Stage plan={plan}><Kinetic v={v} plan={plan} dur={dur} big /></Stage>;
  }
  const v = seg.visual ?? {type: 'kinetic', text: autoRows(seg.shown ?? seg.say)};
  const C = SCENES[v.type];
  if (!C) throw new Error(`no ${plan.channel} scene for visual type "${v.type}"`);
  return <Stage plan={plan} v={v}><C v={v} plan={plan} dur={dur} /></Stage>;
};

/** Text is measured (fitText) while rendering, so wait until the custom fonts are really loaded. */
const useFontsReady = () => {
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    const h = delayRender('fonts');
    Promise.all([
      ...['500', '700', '800', '900'].map((w) => document.fonts.load(`${w} 100px ShortsInter`)),
      document.fonts.load('700 100px ShortsSerif'),
    ]).catch(() => undefined).then(() => { setReady(true); continueRender(h); });
  }, []);
  return ready;
};

export const Shorts: React.FC<Plan> = (plan) => {
  const fontsReady = useFontsReady();
  const n = plan.style.pace.trans;
  const space = plan.channel === 'space';
  if (!fontsReady) return null;
  return (
    <AbsoluteFill style={{background: plan.style.palette.bgTop}}>
      {space && plan.bgVideo ? <OffthreadVideo src={staticFile(plan.bgVideo)} muted style={{width: 1080, height: 1920}} /> : <Background plan={plan} />}
      {!space && plan.segs.map((seg, i) => {
        const last = i === plan.segs.length - 1;
        const len = seg.endFrame - seg.startFrame + (last ? 0 : n);
        return (
          <Sequence key={seg.idx} from={seg.startFrame} durationInFrames={Math.max(1, len)} layout="none">
            <SceneShell plan={plan} length={len} first={i === 0} last={last}>
              <SceneFor seg={seg} plan={plan} dur={(seg.endFrame - seg.startFrame) / plan.fps} />
            </SceneShell>
          </Sequence>
        );
      })}
      <Chrome plan={plan} />
      <Captions plan={plan} />
      {plan.audio && <Audio src={staticFile(plan.audio)} />}
    </AbsoluteFill>
  );
};
