// npm test  - fast checks, no rendering
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadScript, findScripts, parseNarration, parseYear } from '../tools/lib/script.mjs';
import { pickStyle } from '../tools/lib/variation.mjs';
import { buildSegments, MIN_LEN, MAX_LEN } from '../tools/lib/timeline.mjs';

test('{shown|spoken} markers keep trailing punctuation glued', () => {
  const w = parseNarration('about {$5,500|fifty five hundred dollars}. Done');
  assert.equal(w[1].shown, '$5,500.');
  assert.deepEqual(w[1].spoken, ['fifty', 'five', 'hundred', 'dollars']);
});

test('years parse BC/AD', () => {
  assert.equal(parseYear('264 BC'), -264);
  assert.equal(parseYear('117 AD'), 117);
});

test('every sample script loads and fits the 30-50 s Shorts window', () => {
  const files = findScripts('all');
  assert.equal(files.length >= 3, true);
  for (const f of files) {
    const s = loadScript(f);
    const style = pickStyle(s.channel, s.seed, s.style);
    const { total } = buildSegments(s, style, null);
    assert.equal(total >= MIN_LEN && total <= MAX_LEN, true, `${f}: ${total.toFixed(1)}s`);
  }
});

test('variation is deterministic, differs between videos, and money stays dark green/gold', () => {
  assert.deepEqual(pickStyle('money', 1), pickStyle('money', 1));
  const looks = new Set(Array.from({ length: 40 }, (_, i) => JSON.stringify(pickStyle('money', i * 977 + 3), (k, v) => (k === 'palette' ? undefined : v))));
  assert.equal(looks.size > 25, true);
  for (let i = 0; i < 12; i++) {
    const p = pickStyle('money', i).palette;
    assert.equal(parseInt(p.bgTop.slice(1, 3), 16) < 0x20, true, 'money background must be dark');
  }
  assert.throws(() => pickStyle('space', 1, { palette: 'nope' }), /unknown/);
});

test('bad scripts give readable errors', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 's-'));
  fs.mkdirSync(path.join(d, 'money'));
  const f = path.join(d, 'money', 'x.yaml');
  fs.writeFileSync(f, 'title: T\nhook: "Seven words is fine here ok yes"\nlines: []\n');
  assert.throws(() => loadScript(f), /hook has|lines/);
  fs.writeFileSync(f, 'title: T\nhook: Hi there\nlines:\n  - {say: a, visual: {type: orbit}}\n  - {say: b}\n  - {say: c}\n');
  assert.throws(() => loadScript(f), /not available for money/);
});
