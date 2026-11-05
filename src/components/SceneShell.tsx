import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Plan} from '../lib/types';
import {clamp01, easeInOut, easeOut} from '../lib/anim';

/** Wraps a scene (stage area) and applies the video's transition: enter over the first `trans` frames, exit over the last. */
export const SceneShell: React.FC<{plan: Plan; length: number; first: boolean; last: boolean; children: React.ReactNode}> = ({plan, length, first, last, children}) => {
  const frame = useCurrentFrame();
  const n = plan.style.pace.trans;
  const pin = first ? 1 : easeInOut(clamp01(frame / n));
  const pout = last ? 0 : easeInOut(clamp01((frame - (length - n)) / n));
  let style: React.CSSProperties = {};
  switch (plan.style.transition) {
    case 'fade': style = {opacity: pin * (1 - pout)}; break;
    case 'slide': style = {opacity: pin * (1 - pout), transform: `translateY(${(1 - pin) * 140 - pout * 140}px)`}; break;
    case 'zoom': style = {opacity: pin * (1 - pout), transform: `scale(${1 + (1 - pin) * 0.16 - pout * 0.06})`}; break;
    case 'push': style = {transform: `translateX(${(1 - pin) * 1080 - pout * 1080}px)`}; break;
    case 'wipe': style = {opacity: 1 - pout, clipPath: `circle(${pin * 1400}px at 50% 45%)`}; break;
  }
  return <div style={{position: 'absolute', inset: 0, ...style}}>{children}</div>;
};
