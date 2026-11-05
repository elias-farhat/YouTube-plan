import {staticFile} from 'remotion';
import {loadFont} from '@remotion/fonts';

export const SANS = 'ShortsInter';
export const SERIF = 'ShortsSerif';
let started = false;
export const fontPromises: Promise<unknown>[] = [];
export const loadFonts = () => {
  if (started) return;
  started = true;
  const w: [string, string][] = [['500', 'Inter-Medium.otf'], ['700', 'Inter-Bold.otf'], ['800', 'Inter-ExtraBold.otf'], ['900', 'Inter-Black.otf']];
  w.forEach(([weight, f]) => fontPromises.push(loadFont({family: SANS, url: staticFile(`fonts/${f}`), weight})));
  fontPromises.push(loadFont({family: SERIF, url: staticFile('fonts/DejaVuSerif-Bold.ttf'), weight: '700'}));
};
export const fontFor = (channel: string) => (channel === 'history' ? SERIF : SANS);
