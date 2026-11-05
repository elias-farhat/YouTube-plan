import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Plan} from '../lib/types';
import {clamp01, easeInOut} from '../lib/anim';

/** Camera shake: sum of decaying oscillations, one per impact (sound hit) */
export const shakeAt = (plan: Plan, tSec: number) => {
  let x = 0, y = 0;
  for (const im of plan.impacts ?? []) {
    const dt = tSec - im.t;
    if (dt < 0 || dt > 0.7) continue;
    const k = im.amp * Math.exp(-dt * 8.5);
    x += k * Math.sin(dt * 62 + im.t * 7);
    y += k * Math.cos(dt * 51 + im.t * 3) * 0.8;
  }
  return [x, y];
};

/**
 * One scene's window. Scenes never overlap: the previous scene has fully left (exit over `h` frames) before this one
 * enters (over `h` frames), and the narration starts after both.
 */
export const SceneShell: React.FC<{plan: Plan; from: number; length: number; first: boolean; last: boolean; shake?: boolean; children: React.ReactNode}> = ({plan, from, length, first, last, shake = true, children}) => {
  const frame = useCurrentFrame();
  const h = Math.max(2, Math.round(plan.style.pace.trans / 2));
  const pin = first ? 1 : easeInOut(clamp01(frame / h));
  const pout = last ? 0 : easeInOut(clamp01((frame - (length - h)) / h));
  const vis = pin * (1 - pout);
  let t = '';
  let style: React.CSSProperties = {opacity: vis};
  switch (plan.style.transition) {
    case 'slide': t = `translateY(${(1 - pin) * 120 - pout * 120}px)`; break;
    case 'zoom': t = `scale(${1 + (1 - pin) * 0.14 - pout * 0.08})`; break;
    case 'push': t = `translateX(${(1 - pin) * 900 - pout * 900}px)`; style = {opacity: 1}; break;
    case 'wipe': style = {opacity: 1, clipPath: `circle(${vis * 1500}px at 50% 45%)`}; break;
    default: break;
  }
  const [sx, sy] = shake ? shakeAt(plan, (from + frame) / plan.fps) : [0, 0];
  return <div style={{position: 'absolute', inset: 0, ...style, transform: `translate(${sx}px, ${sy}px) ${t}`}}>{children}</div>;
};
