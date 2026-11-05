export const FPS = 30;
export const MIN_LEN = 30, MAX_LEN = 50;
const letters = (w) => Math.max(1, w.replace(/[^A-Za-z0-9]/g, '').length);
const pause = (t) => (/[.!?:]$/.test(t) ? 0.32 : /[,;—-]$/.test(t) ? 0.16 : 0);

/** Estimated per-word timings (seconds from speech start) when no real TTS timing exists. */
export function estimate(words, speed) {
  let t = 0;
  const spans = words.map((w) => {
    const t0 = t;
    for (const sp of w.spoken) t += (0.13 + 0.047 * letters(sp)) * 1.22 * speed; // 1.22: calibrated against a real CapCut voice-over
    const span = [t0, t];
    t += pause(w.shown) * speed;
    return span;
  });
  const total = words.length ? t - pause(words.at(-1).shown) * speed : 0;
  return { spans, total };
}

function mapTts(words, wt) {
  const n = words.reduce((a, w) => a + w.spoken.length, 0);
  if (!wt || wt.length !== n) return null;
  let k = 0;
  return words.map((w) => { const s = [wt[k][0], wt[k + w.spoken.length - 1][1]]; k += w.spoken.length; return s; });
}

/**
 * Build the frame-accurate plan. items = [hook, ...lines]; audio[i] = {file,duration,words?} | null
 * The hook segment is held to ~2-2.6 s.
 */
export function buildSegments(script, style, audio) {
  const items = [{ ...script.hook, visual: script.hookVisual ?? null, isHook: true }, ...script.lines];
  const td = style.pace.trans / FPS;
  const segs = [];
  let t = 0;
  items.forEach((it, i) => {
    const a = audio?.[i] ?? null;
    const tight = !!a?.tight; // imported voice already has natural pauses: add only the transition time
    const lead = i === 0 ? 0.12 : td + (tight ? 0.03 : 0.1);
    let spans = null, speech;
    if (a) { speech = a.duration; spans = mapTts(it.words, a.words); }
    if (!spans) {
      const est = estimate(it.words, style.pace.speed);
      if (a) { const k = a.duration / Math.max(est.total, 1e-6); spans = est.spans.map(([x, y]) => [x * k, y * k]); }
      else { spans = est.spans; speech = est.total; }
    }
    let tail = (tight ? 0.04 : style.pace.gap) + (i === items.length - 1 ? 0.55 : 0);
    let dur = lead + speech + tail;
    if (it.isHook) dur = a ? Math.max(2.0, dur) : Math.min(2.6, Math.max(2.0, dur)); // the hook owns the first ~2 s
    const start = t, s0 = start + lead;
    segs.push({
      idx: i, isHook: !!it.isHook, sfx: it.sfx ?? [], say: it.say, shown: it.words.map((w) => w.shown).join(' '), visual: it.visual,
      startFrame: Math.round(start * FPS), endFrame: Math.round((start + dur) * FPS),
      speechStart: s0, speechEnd: s0 + speech,
      words: it.words.map((w, k) => ({ text: w.shown, spoken: w.spoken.join(' '), start: s0 + spans[k][0], end: s0 + spans[k][1] })),
    });
    t = start + dur;
  });
  segs.forEach((s, i) => { if (i < segs.length - 1) s.endFrame = segs[i + 1].startFrame; });
  return { segs, total: t };
}

export function srtTime(t) {
  const ms = Math.round(t * 1000);
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
}
export const clock = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(1).padStart(4, '0')}`;
