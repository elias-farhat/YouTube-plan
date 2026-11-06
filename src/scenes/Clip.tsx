import React from 'react';
import {OffthreadVideo, staticFile} from 'remotion';
import {SceneProps} from './common';

/**
 * Any pre-rendered video as a scene (Blender 3D renders, stock footage ...).
 * visual: {type: clip, src: "gen/blender/earth.mp4", full: true}   src is a path inside public/; full = fill the whole frame
 */
export const Clip: React.FC<SceneProps> = ({v, plan}) => {
  const {x, y, w, h} = plan.style.stage;
  if (v.full) {
    return <OffthreadVideo src={staticFile(v.src)} muted style={{position: 'absolute', left: -x, top: -y, width: 1080, height: 1920, objectFit: 'cover'}} />;
  }
  return (
    <div style={{position: 'absolute', inset: 0, borderRadius: 38, overflow: 'hidden', border: `4px solid ${plan.style.palette.accent2}`, boxSizing: 'border-box'}}>
      <OffthreadVideo src={staticFile(v.src)} muted style={{width: w, height: h, objectFit: 'cover'}} />
    </div>
  );
};
