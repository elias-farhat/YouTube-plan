import fs from 'node:fs';
import path from 'node:path';
import * as yaml from 'js-yaml';
import { seedFromText } from './variation.mjs';

export const CHANNELS = ['money', 'space', 'history'];
export const VISUALS = {
  money: ['kinetic', 'stat', 'line', 'bar'],
  space: ['kinetic', 'counter', 'orbit', 'lightbeam', 'ladder', 'scale'],
  history: ['kinetic', 'stat', 'map', 'battle', 'stamps'],
};

const MARK = /\{([^|{}]+)\|([^{}]+)\}/g;

/** "about {$5,500|fifty five hundred dollars}." -> [{shown, spoken[]}] */
export function parseNarration(text) {
  const words = [];
  let pos = 0, afterMark = false;
  const plain = (chunk) => {
    const toks = chunk.split(/\s+/).filter(Boolean);
    if (toks.length && afterMark && chunk.length && !/^\s/.test(chunk)) {
      words[words.length - 1].shown += toks.shift();
    }
    afterMark = false;
    for (const t of toks) words.push({ shown: t, spoken: [t] });
  };
  for (const m of text.matchAll(MARK)) {
    plain(text.slice(pos, m.index));
    words.push({ shown: m[1].trim(), spoken: m[2].trim().split(/\s+/) });
    afterMark = true;
    pos = m.index + m[0].length;
  }
  plain(text.slice(pos));
  return words;
}

export function parseYear(s) {
  if (typeof s === 'number') return s;
  const m = String(s).match(/^\s*(\d+)\s*(BC|BCE|AD|CE)?\s*$/i);
  if (!m) throw new Error(`bad year "${s}" (use e.g. "264 BC" or "117 AD")`);
  const y = parseInt(m[1], 10);
  return /^(BC|BCE)$/i.test(m[2] || '') ? -y : y;
}

export function loadScript(file) {
  const raw = yaml.load(fs.readFileSync(file, 'utf8'));
  const fail = (msg) => { throw new Error(`${file}: ${msg}`); };
  if (!raw || typeof raw !== 'object') fail('not a YAML mapping');
  const channel = raw.channel ?? path.basename(path.dirname(path.resolve(file)));
  if (!CHANNELS.includes(channel)) fail(`channel must be one of ${CHANNELS.join(', ')} (put the file in scripts/<channel>/ or set channel:)`);
  if (!raw.title || typeof raw.title !== 'string') fail('missing "title"');
  if (!raw.hook || typeof raw.hook !== 'string') fail('missing "hook" (the first-2-seconds line)');
  if (!Array.isArray(raw.lines) || raw.lines.length < 3) fail('"lines" must be a list with at least 3 items');
  const hookWords = parseNarration(raw.hook);
  if (hookWords.length > 8) fail(`hook has ${hookWords.length} words; keep it to ~7 so it lands in 2 seconds`);

  const lines = raw.lines.map((l, i) => {
    if (!l || typeof l.say !== 'string') fail(`lines[${i}] needs "say" (the narration)`);
    const v = l.visual;
    if (v !== undefined && v !== null) {
      if (typeof v !== 'object' || !v.type) fail(`lines[${i}].visual needs a "type" (${VISUALS[channel].join(', ')})`);
      if (!VISUALS[channel].includes(v.type)) fail(`lines[${i}].visual.type "${v.type}" is not available for ${channel}. Use: ${VISUALS[channel].join(', ')}`);
    }
    const sfx = l.sfx === undefined ? [] : Array.isArray(l.sfx) ? l.sfx : [l.sfx];
    return { say: l.say.trim(), words: parseNarration(l.say), visual: v ?? null, sfx };
  });
  let territories = [];
  if (raw.territories) {
    territories = raw.territories.map((t, i) => {
      if (!t.countries?.length) fail(`territories[${i}] needs year + countries`);
      return { year: parseYear(t.year), countries: t.countries };
    }).sort((a, b) => a.year - b.year);
  }
  const seed = Number.isInteger(raw.seed) ? raw.seed : seedFromText(raw.title);
  const slug = raw.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'video';
  return {
    file, channel, title: raw.title.trim(), slug, seed, handle: raw.handle, voice: raw.voice,
    style: raw.style ?? {}, hook: { say: raw.hook.trim(), words: hookWords, sfx: [] }, hookVisual: raw.hook_visual ?? null, lines, territories,
  };
}

export function findScripts(channel, root = 'scripts') {
  const chans = channel === 'all' ? CHANNELS : [channel];
  const out = [];
  for (const c of chans) {
    const dir = path.join(root, c);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).sort()) if (/\.ya?ml$/.test(f)) out.push(path.join(dir, f));
  }
  return out;
}
