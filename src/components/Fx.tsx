import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Plan} from '../lib/types';
import {clamp01, withAlpha} from '../lib/anim';

/** Quick light flash on every impact + a cinematic vignette */
export const Fx: React.FC<{plan: Plan}> = ({plan}) => {
  const frame = useCurrentFrame();
  const t = frame / plan.fps;
  let flash = 0;
  for (const im of plan.impacts ?? []) {
    const dt = t - im.t;
    if (dt >= 0 && dt < 0.3) flash += (im.amp / 22) * 0.3 * Math.exp(-dt * 16);
  }
  const p = plan.style.palette;
  return (
    <>
      <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 42%, rgba(0,0,0,0) 52%, rgba(0,0,0,0.46) 100%)', pointerEvents: 'none'}} />
      {flash > 0.01 && <div style={{position: 'absolute', inset: 0, background: withAlpha(p.text, clamp01(flash)), mixBlendMode: 'screen', pointerEvents: 'none'}} />}
    </>
  );
};
