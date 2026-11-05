import React from 'react';
import {CalculateMetadataFunction, Composition} from 'remotion';
import {Shorts} from './Shorts';
import {Plan} from './lib/types';

const placeholder = (channel: Plan['channel']): Plan => ({
  channel, title: 'Placeholder (the CLI injects the real plan with --props)', handle: '@channel', channelName: channel.toUpperCase(), fps: 30, totalFrames: 90,
  style: {seed: 1, paletteName: 'x', layout: 'A', stage: {x: 60, y: 250, w: 960, h: 950}, capY: 1370, pacing: 'steady', pace: {speed: 1, trans: 11, gap: 0.3, chunk: 4, zoom: 0.09, spring: {damping: 16, stiffness: 140}},
    caption: 'pop', transition: 'fade', kinetic: 'pop', motif: 'grid', header: 'chip', orient: 'v', pill: false,
    palette: {bgTop: '#04130f', bgBot: '#0b3a2b', glow: '#1fa97a', accent: '#3ddc97', accent2: '#ffd166', text: '#f4fff9', muted: '#8fc4b0', panel: '#0d2f25', bad: '#ff5d6c', onAccent: '#04150f', hl: '#3ddc97', onHl: '#0e0e14', sea: '#17384a', sea2: '#10293a', land: '#d9caa3', border: '#8b7650'}},
  segs: [{idx: 0, isHook: true, say: 'Placeholder hook', visual: null, startFrame: 0, endFrame: 90, speechStart: 0.1, speechEnd: 2, words: []}], territories: [],
});

const meta: CalculateMetadataFunction<Plan> = async ({props}) => ({durationInFrames: props.totalFrames, fps: props.fps});

export const Root: React.FC = () => (
  <>
    {(['money', 'space', 'history'] as const).map((c) => (
      <Composition key={c} id={c[0].toUpperCase() + c.slice(1)} component={Shorts} durationInFrames={90} fps={30} width={1080} height={1920} defaultProps={placeholder(c)} calculateMetadata={meta} />
    ))}
  </>
);
