import React from 'react';
import {useCurrentFrame} from 'remotion';
import {fitText} from '@remotion/layout-utils';
import {SceneProps} from '../scenes/common';
import {SERIF, SANS} from '../lib/fonts';
import {clamp01, easeOut, easeOutBack, seg, withAlpha} from '../lib/anim';

/**
 * Cards that get STAMPED onto the screen one after another.
 * visual: {type: stamps, title: "Rome's answer", items: [{text: "Armed slaves", tag: "DONE"}, {text: "No negotiation", tag: "REFUSED"}]}
 */
export const Stamps: React.FC<SceneProps> = ({v, plan, dur}) => {
  const frame = useCurrentFrame();
  const t = frame / plan.fps;
  const p = plan.style.palette;
  const {w, h} = plan.style.stage;
  const items: {text: string; tag?: string}[] = (v.items ?? []).map((x: any) => (typeof x === 'string' ? {text: x} : x));
  const n = items.length;
  const step = Math.max(0.5, (dur * 0.6) / n);
  const cardH = Math.min(190, (h - 220) / n - 30);
  const font = plan.channel === 'history' ? SERIF : SANS;
  return (
    <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 34}}>
      {v.title && <div style={{fontFamily: SANS, fontWeight: 800, fontSize: 40, letterSpacing: 2, color: p.muted, textTransform: 'uppercase', opacity: clamp01(t / 0.3), marginBottom: 6}}>{v.title}</div>}
      {items.map((it, i) => {
        const t0 = 0.3 + i * step;
        const k = seg(t, t0, t0 + 0.22);
        if (k <= 0) return <div key={i} style={{height: cardH}} />;
        const sc = 2.2 - 1.2 * easeOut(k);
        const rot = (i % 2 ? 2.2 : -2.2) * (1 - 0.3 * easeOut(k));
        const dt = t - (t0 + 0.2);
        const ring = dt > 0 && dt < 0.5 ? dt / 0.5 : -1;
        const tag = seg(t, t0 + 0.3, t0 + 0.48);
        const tagFs = Math.min(56, cardH * 0.3);
        const tagW = it.tag ? it.tag.length * tagFs * 0.78 + 70 : 0;
        const textW = w - 90 - 72 - 18 - tagW - (it.tag ? 40 : 0);
        const fs = Math.min(70, cardH * 0.4, fitText({text: it.text.toUpperCase(), withinWidth: textW, fontFamily: font, fontWeight: 900}).fontSize);
        return (
          <div key={i} style={{position: 'relative', width: w - 90, height: cardH, transform: `scale(${sc}) rotate(${rot}deg)`, opacity: clamp01(k * 2.5), background: withAlpha(p.panel, 0.96), borderRadius: 22, borderLeft: `18px solid ${p.accent2}`, boxShadow: '0 14px 0 rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', padding: '0 36px', boxSizing: 'border-box'}}>
            <div style={{fontFamily: font, fontWeight: 900, fontSize: fs, color: p.text, textTransform: 'uppercase', lineHeight: 1.05, flex: 1}}>{it.text}</div>
            {it.tag && tag > 0 && (
              <div style={{position: 'absolute', right: 26, top: '50%', transform: `translateY(-50%) rotate(-8deg) scale(${2 - easeOutBack(tag, 1.2)})`, opacity: clamp01(tag * 3), border: `6px solid ${p.bad}`, color: p.bad, borderRadius: 14, padding: '4px 18px', fontFamily: SANS, fontWeight: 900, fontSize: tagFs, letterSpacing: 3}}>{it.tag}</div>
            )}
            {ring >= 0 && <div style={{position: 'absolute', left: '50%', top: '50%', width: 100 + ring * 900, height: 100 + ring * 900, marginLeft: -(50 + ring * 450), marginTop: -(50 + ring * 450), borderRadius: 999, border: `${6 * (1 - ring) + 1}px solid ${withAlpha(p.accent2, 1 - ring)}`}} />}
          </div>
        );
      })}
    </div>
  );
};
