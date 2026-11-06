#!/usr/bin/env node
/**
 * One command for everything:
 *   npm run render money            every script in scripts/money/
 *   npm run render all              every script of every channel
 *   npm run render scripts/space/foo.yaml
 * flags (put after `--` with npm):  --tts auto|edge|piper|none   --concurrency N   --any-length   --check   --out DIR
 *                                      --stills 3,10,20   (dev: write PNG stills to build/<video>/stills instead of rendering)
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadScript, findScripts, CHANNELS } from './lib/script.mjs';
import { pickStyle, describeStyle, NAMES, HANDLES } from './lib/variation.mjs';
import { buildSegments, buildBitsSegments, FPS, MIN_LEN, MAX_LEN, srtTime, clock } from './lib/timeline.mjs';
import { buildCues } from './lib/sfx.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

// ---------------------------------------------------------------- args ---
const argv = process.argv.slice(2);
const flags = { tts: 'auto', concurrency: Math.max(1, os.cpus().length - 0), anyLength: false, check: false, stills: null, out: 'output', voice: null, sfx: true };
const targets = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--tts') flags.tts = argv[++i];
  else if (a === '--concurrency') flags.concurrency = parseInt(argv[++i], 10);
  else if (a === '--any-length') flags.anyLength = true;
  else if (a === '--check') flags.check = true;
  else if (a === '--out') flags.out = argv[++i];
  else if (a === '--no-sfx') flags.sfx = false; // skip sound effects + ambient bed
  else if (a === '--voice') flags.voice = argv[++i]; // a recorded/CapCut voice-over to align the video to
  else if (a === '--stills') flags.stills = argv[++i].split(',').map(Number); // dev: render PNG stills at these seconds
  else if (a.startsWith('--')) { console.error(`unknown flag ${a}`); process.exit(1); }
  else targets.push(a);
}
if (!targets.length) {
  console.error(`usage: npm run render <${CHANNELS.join('|')}|all|path/to/script.yaml> [-- --tts auto|edge|piper|none] [--check]`);
  process.exit(1);
}

const files = [];
for (const t of targets) {
  if (t === 'all' || CHANNELS.includes(t) || t === 'demos') files.push(...findScripts(t === 'demos' ? 'demos' : t));
  else if (fs.existsSync(t)) files.push(t);
  else { console.error(`not a channel or script file: ${t}`); process.exit(1); }
}
if (!files.length) { console.error('no scripts found (put YAML files in scripts/<channel>/)'); process.exit(1); }

// ------------------------------------------------------------ helpers ---
function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(f); else yield f;
  }
}

const py = fs.existsSync('.venv/bin/python') ? path.resolve('.venv/bin/python') : 'python3';
const sh = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${args.slice(0, 3).join(' ')} failed (${r.status}): ${(r.stderr || r.stdout || '').trim().split('\n').slice(-6).join('\n')}`);
  return r.stdout;
};

function findBrowser() {
  if (process.env.REMOTION_BROWSER) return process.env.REMOTION_BROWSER;
  // Remotion's own browser (preferred, if it was downloaded successfully)
  const own = 'node_modules/.remotion/chrome-headless-shell';
  if (fs.existsSync(own) && fs.readdirSync(own).some((d) => d !== 'download.lock')) return null;
  const globs = ['/opt/pw-browsers', path.join(os.homedir(), '.cache/ms-playwright')];
  for (const base of globs) {
    if (!fs.existsSync(base)) continue;
    for (const d of fs.readdirSync(base).sort().reverse()) {
      for (const [dir, bin] of [['chromium_headless_shell', 'chrome-headless-shell-linux64/chrome-headless-shell'], ['chromium', 'chrome-linux64/chrome'], ['chromium', 'chrome-linux/chrome']]) {
        const p = path.join(base, d, bin);
        if (d.startsWith(dir) && fs.existsSync(p)) return p;
      }
    }
  }
  return null;
}
const BROWSER = findBrowser();

function runWithProgress(cmd, args, label, env = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { env: { ...process.env, ...env } });
    let tail = '', lastLogged = 0;
    const onData = (d) => {
      const s = d.toString();
      tail = (tail + s).slice(-3000);
      const m = [...s.matchAll(/Rendered (\d+)\/(\d+)/g)].pop() || [...s.matchAll(/(\d+)\s*\/\s*(\d+)/g)].pop() || [...s.matchAll(/(\d+)%/g)].pop();
      if (m) {
        const txt = m[2] ? `${m[1]}/${m[2]}` : m[1] + '%';
        if (process.stderr.isTTY) process.stderr.write(`\r  ${label}: ${txt}      `);
        else if (m[2] && (+m[1] === +m[2] || +m[1] - lastLogged >= Math.max(60, +m[2] / 5))) { lastLogged = +m[1]; console.log(`  ${label}: ${txt}`); }
      }
    };
    p.stdout.on('data', onData); p.stderr.on('data', onData);
    p.on('close', (code) => { if (process.stderr.isTTY) process.stderr.write('\r' + ' '.repeat(50) + '\r'); code === 0 ? resolve() : reject(new Error(`${label} failed (exit ${code})\n${tail.split('\n').slice(-12).join('\n')}`)); });
  });
}

function findVoiceFile(script) {
  if (flags.voice) return flags.voice;
  if (flags.tts === 'none' || !fs.existsSync('voices')) return null;
  const hit = fs.readdirSync('voices').find((f) => f.startsWith(`${script.channel}_${script.slug}.`) && /\.(m4a|mp3|wav|mp4|aac|ogg)$/.test(f));
  return hit ? path.join('voices', hit) : null;
}

function getVoice(script, style, workdir) {
  const vf = findVoiceFile(script);
  if (vf) {
    const lines = [...(script.demo ? [] : [script.hook.words]), ...script.lines.map((l) => l.words)].map((ws) => ws.map((w) => w.spoken.join(' ')).join(' '));
    const r = spawnSync(py, ['tools/voice_import.py'], { input: JSON.stringify({ lines, voiceFile: vf, outdir: workdir }), encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`voice import failed: ${(r.stderr || '').trim().split('\n').slice(-3).join(' | ')}`);
    return JSON.parse(r.stdout.trim().split('\n').pop());
  }
  if (flags.tts === 'none' || script.demo || script.mode === 'bits') return { engine: 'none', status: script.mode === 'bits' ? 'bits mode: no voice' : 'no voice (demo)', lines: null };
  const lines = [...(script.demo ? [] : [script.hook.words]), ...script.lines.map((l) => l.words)].map((ws) => ws.map((w) => w.spoken.join(' ')).join(' '));
  const req = { lines, voice: script.voice ?? ({ money: 'en-US-GuyNeural', space: 'en-US-AndrewNeural', history: 'en-GB-RyanNeural' })[script.channel], rate: style.pace.rate, outdir: workdir, engine: flags.tts };
  const r = spawnSync(py, [process.env.SHORTS_TTS_HELPER || 'tools/tts.py'], { input: JSON.stringify(req), encoding: 'utf8' });
  if (r.status !== 0) return { engine: 'none', status: `tts helper crashed: ${(r.stderr || '').trim().split('\n').pop()}`, lines: null };
  const out = JSON.parse(r.stdout.trim().split('\n').pop());
  if (flags.tts !== 'auto' && out.engine === 'none') throw new Error(`--tts ${flags.tts} requested but unavailable: ${out.status}`);
  return out;
}

function mixVoice(segs, audio, total, outFile) {
  const inputs = [], parts = [];
  segs.forEach((s, i) => {
    inputs.push('-i', audio[i].file);
    const ms = Math.round(s.speechStart * 1000);
    parts.push(`[${inputs.length / 2 - 1}:a]aresample=44100,aformat=channel_layouts=stereo,adelay=${ms}|${ms}[a${i}]`);
  });
  const mix = segs.map((_, i) => `[a${i}]`).join('');
  parts.push(`${mix}amix=inputs=${segs.length}:normalize=0,apad[out]`);
  sh('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', parts.join(';'), '-map', '[out]', '-t', total.toFixed(3), outFile]);
}

// -------------------------------------------------------------- render ---
let failures = 0;
for (const file of files) {
  console.log(`\n== ${file}`);
  try {
    const script = loadScript(file);
    const style = pickStyle(script.channel, script.seed, script.style);
    const key = `${script.channel}-${script.slug}`;
    const buildDir = path.join('build', key), genDir = path.join('public', 'gen', key);
    fs.mkdirSync(buildDir, { recursive: true }); fs.mkdirSync(genDir, { recursive: true });

    const voice = flags.check ? { engine: 'none', status: 'check only', lines: null } : getVoice(script, style, path.join(buildDir, 'tts'));
    const voiced = voice.lines != null;
    console.log(`  voice: ${voiced ? voice.status : `NONE -> silent render + narration.txt (${voice.status})`}`);
    const { segs, total } = script.mode === 'bits' ? buildBitsSegments(script, style, script.bpm ?? 120) : buildSegments(script, style, voiced ? voice.lines : null);
    const words = segs.reduce((a, s) => a + s.words.length, 0);
    console.log(`  ${script.channel} | "${script.title}" | ${segs.length} scenes | ${words} words | ${total.toFixed(1)}s | look: ${describeStyle(style)}`);
    if (!script.demo && (total < MIN_LEN || total > MAX_LEN)) {
      const msg = `length ${total.toFixed(1)}s is outside the ${MIN_LEN}-${MAX_LEN}s Shorts window (${total < MIN_LEN ? 'add' : 'cut'} ~${Math.round(Math.abs(total - 40) * 2.6)} words)`;
      if (!flags.anyLength) throw new Error(msg + ' - use --any-length to render anyway');
      console.log(`  ! ${msg}`);
    }
    if (flags.check) continue;

    const plan = {
      channel: script.channel, title: script.title, handle: script.handle ?? HANDLES[script.channel], channelName: script.badge ?? NAMES[script.channel],
      fps: FPS, totalFrames: Math.round(total * FPS), style, segs, territories: script.territories, audio: null, bgVideo: null,
    };
    const { cues, impacts } = buildCues(plan);
    plan.mode = script.mode; plan.song = script.song; plan.outfit = script.outfit; plan.hd = !!script.hd; plan.blip = script.blip;
    plan.music = script.music; plan.bpm = script.bpm; plan.chrome = script.chrome;
    plan.cues = cues; plan.impacts = flags.sfx ? impacts : impacts.filter((c) => false);
    if (voiced) mixVoice(segs, voice.lines, total, path.join(genDir, 'voice.wav'));
    if (flags.sfx) {
      // sound design: effects + ambient bed (+ the voice if there is one), ducked under speech
      fs.writeFileSync(path.join(buildDir, 'plan-audio.json'), JSON.stringify(plan));
      const args = ['tools/sfx.py', path.join(buildDir, 'plan-audio.json'), path.join(genDir, 'audio.wav')];
      if (voiced) args.push('--voice', path.join(genDir, 'voice.wav'));
      sh(py, args);
      plan.audio = `gen/${key}/audio.wav`;
    } else if (voiced) plan.audio = `gen/${key}/voice.wav`;
    const hasAudio = !!plan.audio;

    const planFile = path.join(buildDir, 'plan.json');
    const Comp = script.channel[0].toUpperCase() + script.channel.slice(1);
    const useManim = script.channel === 'space' && script.engine !== 'remotion';
    if (useManim) {
      fs.writeFileSync(planFile, JSON.stringify(plan));
      // the Manim video only depends on the plan (minus audio paths) and the scene code: reuse it when unchanged
      const hash = createHash('sha1').update(JSON.stringify({ ...plan, audio: null, cues: null, impacts: null })).update(fs.readFileSync('manim/space_scene.py')).update(fs.readFileSync('manim/planets.py')).digest('hex');
      const cached = path.join(buildDir, 'manim.sha1'), bgFile = path.join(genDir, 'bg.mp4');
      if (fs.existsSync(cached) && fs.readFileSync(cached, 'utf8') === hash && fs.existsSync(bgFile)) {
        console.log('  manim: unchanged, reusing last render');
      } else {
        console.log('  manim: rendering motion graphics ...');
        const media = path.join(buildDir, 'media');
        await runWithProgress(py, ['-m', 'manim', 'render', '-r', '1080,1920', '--fps', String(FPS), '--media_dir', media, '--disable_caching', '-v', 'WARNING', 'manim/space_scene.py', 'SpaceShort'], 'manim', { SHORTS_PLAN: path.resolve(planFile) });
        const mp4 = path.join(media, 'videos', 'space_scene', '1920p30', 'SpaceShort.mp4');
        if (!fs.existsSync(mp4)) throw new Error('manim did not produce SpaceShort.mp4');
        fs.copyFileSync(mp4, bgFile);
        fs.writeFileSync(cached, hash);
      }
      plan.bgVideo = `gen/${key}/bg.mp4`;
    }
    const audioFile = plan.audio ? path.join('public', plan.audio) : null;
    plan.audio = null;                       // audio is muxed afterwards: changing the voice/sfx never re-renders the frames
    fs.writeFileSync(planFile, JSON.stringify(plan));

    if (flags.stills) {
      for (const sec of flags.stills) {
        const out = path.join(buildDir, 'stills', `${String(sec).padStart(5, '0')}.png`);
        const a = ['remotion', 'still', 'src/index.ts', Comp, out, `--props=${planFile}`, `--frame=${Math.min(plan.totalFrames - 1, Math.round(sec * FPS))}`, '--log=warn'];
        if (BROWSER) a.push(`--browser-executable=${BROWSER}`);
        await runWithProgress('npx', a, `still ${sec}s`);
        console.log(`  still: ${out}`);
      }
      continue;
    }
    const rawOut = path.join(buildDir, 'remotion.mp4');
    const srcHash = createHash('sha1').update(JSON.stringify({ ...plan, cues: null })); // cues only affect audio; impacts (shake) are part of the frames
    for (const f of walk('src')) srcHash.update(fs.readFileSync(f));
    srcHash.update(fs.readFileSync('data/world_110m.json'));
    const vh = srcHash.digest('hex'), vhFile = path.join(buildDir, 'video.sha1');
    if (fs.existsSync(rawOut) && fs.existsSync(vhFile) && fs.readFileSync(vhFile, 'utf8') === vh) {
      console.log('  remotion: frames unchanged, reusing last render');
    } else {
      const args = ['remotion', 'render', 'src/index.ts', Comp, rawOut, `--props=${planFile}`, `--concurrency=${flags.concurrency}`, '--log=warn', '--overwrite', '--muted'];
      if (BROWSER) args.push(`--browser-executable=${BROWSER}`);
      await runWithProgress('npx', args, 'remotion');
      fs.writeFileSync(vhFile, vh);
    }

    fs.mkdirSync(flags.out, { recursive: true });
    const outDir = script.demo ? path.join(flags.out, 'demos') : flags.out;
    fs.mkdirSync(outDir, { recursive: true });
    const outMp4 = path.join(outDir, `${script.channel}_${script.slug}.mp4`);
    // dithered pixel art compresses badly: squeeze heavy renders (>25 MB) to a phone-friendly size
    const videoArgs = fs.statSync(rawOut).size > 25e6 ? ['-c:v', 'libx264', '-crf', '24', '-preset', 'medium', '-pix_fmt', 'yuv420p'] : ['-c:v', 'copy'];
    const audioIn = audioFile ? ['-i', audioFile] : ['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo'];
    sh('ffmpeg', ['-y', '-loglevel', 'error', '-i', rawOut, ...audioIn, '-map', '0:v', '-map', '1:a', ...videoArgs, '-c:a', 'aac', '-b:a', '192k', '-t', total.toFixed(3), '-movflags', '+faststart', outMp4]);

    // sidecars: narration text (for CapCut), cue sheet, SRT
    const base = outMp4.replace(/\.mp4$/, '');
    const spoken = (s) => s.words.map((w) => w.spoken).join(' ');
    fs.writeFileSync(`${base}.narration.txt`, `${script.title}\n\n` + segs.map(spoken).join('\n\n') + '\n');
    fs.writeFileSync(`${base}.cues.txt`, `${script.title}\nTotal ${total.toFixed(1)}s. Start each narration line at its time:\n\n` + segs.map((s) => `[${clock(s.speechStart)}]  ${spoken(s)}`).join('\n') + '\n');
    let n = 1; const srt = [];
    for (const s of segs) if (!s.isHook) { /* captions as written, grouped per line */
      for (let i = 0; i < s.words.length; i += style.pace.chunk) {
        const c = s.words.slice(i, i + style.pace.chunk), nxt = s.words[i + style.pace.chunk];
        srt.push(`${n++}\n${srtTime(c[0].start)} --> ${srtTime(nxt ? nxt.start : s.speechEnd + 0.1)}\n${c.map((w) => w.text).join(' ')}\n`);
      }
    }
    fs.writeFileSync(`${base}.srt`, srt.join('\n'));
    // upload text: title / description / hashtags / pinned comment (from the script's `youtube:` block, with sane fallbacks)
    const yt = script.youtube ?? {};
    if (!script.demo) {
    const tags = (yt.tags ?? [script.channel === 'money' ? 'Money' : script.channel === 'space' ? 'Space' : 'History', 'Shorts']).map((t) => '#' + String(t).replace(/^#/, '').replace(/\s+/g, ''));
    if (!tags.some((t) => t.toLowerCase() === '#shorts')) tags.unshift('#Shorts');
    const ytTitle = yt.title ?? script.title;
    const ytDesc = yt.description ?? `${script.hook.words.map((w) => w.shown).join(' ')} ${script.lines.slice(0, 2).map((l) => l.words.map((w) => w.shown).join(' ')).join(' ')}`;
    fs.writeFileSync(`${base}.youtube.txt`, `TITLE (${ytTitle.length}/100)\n${ytTitle}\n\nDESCRIPTION\n${ytDesc.trim()}\n\n${tags.join(' ')}\n` + (yt.pinned_comment ? `\nPINNED COMMENT\n${yt.pinned_comment}\n` : ''));
    console.log(`  title: ${ytTitle}`);
    }
    console.log(`  -> ${outMp4}  (${(fs.statSync(outMp4).size / 1e6).toFixed(1)} MB, ${voiced ? 'with voice' : 'no voice'}${flags.sfx ? ' + sound effects' : ''})`);
  } catch (e) {
    failures++;
    console.error(`  ERROR: ${e.message}`);
  }
}
process.exit(failures ? 1 : 0);
