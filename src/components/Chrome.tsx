import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Plan, W} from '../lib/types';
import {fontFor} from '../lib/fonts';

/** Header (3 variants) + progress line + one-line title. Sits above scenes, below captions. */
export const Chrome: React.FC<{plan: Plan}> = ({plan}) => {
  const frame = useCurrentFrame();
  const st = plan.style, p = st.palette;
  const ff = plan.channel === 'history' ? fontFor('history') : fontFor('x');
  const prog = Math.min(1, frame / plan.totalFrames);
  const y = 120;
  const name = plan.channelName;
  const label: React.CSSProperties = {fontFamily: ff, fontWeight: plan.channel === 'history' ? 700 : 900, fontSize: 30, letterSpacing: 1};
  return (
    <div style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: 60, right: 60, top: 66, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.16)'}}>
        <div style={{width: `${prog * 100}%`, height: '100%', borderRadius: 3, background: p.accent}} />
      </div>
      {plan.chrome !== 'minimal' && st.header === 'chip' && (<>
        <div style={{position: 'absolute', left: 60, top: y - 30, height: 60, padding: '0 30px 0 26px', borderRadius: 30, background: p.accent, color: p.onAccent, display: 'flex', alignItems: 'center', gap: 14, ...label}}>
          <span style={{width: 14, height: 14, borderRadius: 7, background: p.onAccent}} />{name}
        </div>
        <div style={{position: 'absolute', right: 60, top: y - 20, color: p.muted, fontFamily: fontFor('x'), fontWeight: 700, fontSize: 30}}>{plan.handle}</div>
      </>)}
      {plan.chrome !== 'minimal' && st.header === 'line' && (
        <div style={{position: 'absolute', left: 60, right: 60, top: y - 22, height: 44, display: 'flex', alignItems: 'center', gap: 24, color: p.accent, ...label}}>
          <div style={{flex: 1, height: 2, background: p.accent, opacity: 0.6}} />{name}<div style={{flex: 1, height: 2, background: p.accent, opacity: 0.6}} />
        </div>
      )}
      {plan.chrome !== 'minimal' && st.header === 'banner' && (
        <div style={{position: 'absolute', left: 0, right: 0, top: y - 34, height: 68, background: p.accent, color: p.onAccent, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 60px', ...label}}>
          <span>{name}</span><span style={{fontFamily: fontFor('x'), fontWeight: 700, opacity: 0.85}}>{plan.handle}</span>
        </div>
      )}
      {plan.chrome !== 'minimal' && <div style={{position: 'absolute', left: 60, width: W - 120, top: 170, color: p.text, opacity: 0.92, fontFamily: fontFor('x'), fontWeight: 700, fontSize: 36, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{plan.title}</div>}
    </div>
  );
};
