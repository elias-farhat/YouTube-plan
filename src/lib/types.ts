export type Word = {text: string; spoken: string; start: number; end: number}; // seconds
export type Visual = {type: string; [k: string]: any};
export type Seg = {
  idx: number; isHook: boolean; say: string; shown?: string; sfx?: string[]; bits?: {text: string; start: number; charT: number}; visual: Visual | null;
  startFrame: number; endFrame: number; speechStart: number; speechEnd: number; words: Word[];
};
export type Palette = {
  bgTop: string; bgBot: string; glow: string; glow2?: string; accent: string; accent2: string; text: string;
  muted: string; panel: string; bad: string; onAccent: string; hl: string; onHl: string;
  sea?: string; sea2?: string; land?: string; border?: string; ink?: string; sun?: string;
};
export type Style = {
  seed: number; paletteName: string; palette: Palette; layout: 'A' | 'B' | 'C';
  stage: {x: number; y: number; w: number; h: number}; capY: number;
  pacing: string; pace: {speed: number; trans: number; gap: number; chunk: number; zoom: number; spring: {damping: number; stiffness: number}};
  caption: 'pop' | 'bar' | 'underline' | 'glow' | 'serif' | 'pixel'; transition: 'fade' | 'slide' | 'wipe' | 'zoom' | 'push';
  kinetic: 'pop' | 'slide' | 'drop' | 'stack'; motif: string; header: 'chip' | 'line' | 'banner'; orient: 'v' | 'h'; pill: boolean;
};
export type Plan = {
  channel: 'money' | 'space' | 'history'; title: string; handle: string; channelName: string;
  fps: number; totalFrames: number; style: Style; segs: Seg[];
  territories: {year: number; countries: string[]}[];
  audio?: string | null; bgVideo?: string | null;
  bpm?: number | null; music?: string | null; chrome?: 'full' | 'minimal'; mode?: 'voice' | 'bits';
  impacts?: {t: number; amp: number}[];   // sound hits -> camera shake + flash
};
export const W = 1080;
export const H = 1920;
