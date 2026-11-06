#!/usr/bin/env node
/**
 * Render a Blender (bpy) 3D clip and turn it into public/gen/blender/<name>.mp4 (1080x1920) that scripts can use as
 *   visual: {type: clip, src: "gen/blender/earth.mp4", full: true}
 *   npm run render3d                       earth3d, 6 s, 540x960 frames, upscaled
 *   npm run render3d -- --seconds 8 --samples 24 --width 1080 --height 1920   (slow, cleaner)
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);
const py = fs.existsSync('.venv/bin/python') ? '.venv/bin/python' : 'python3';
const args = process.argv.slice(2);
const name = 'earth';
const dir = path.join('build', 'blender', name);
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
const secs = args.includes('--seconds') ? args[args.indexOf('--seconds') + 1] : '6';
console.log(`blender: rendering ${secs}s with Cycles (CPU) ... this takes a few minutes`);
let r = spawnSync(py, ['blender/earth3d.py', dir, ...args], { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status ?? 1);
fs.mkdirSync('public/gen/blender', { recursive: true });
const out = `public/gen/blender/${name}.mp4`;
r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', path.join(dir, 'f_%04d.png'), '-vf', 'scale=1080:1920:flags=lanczos', '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', out], { stdio: 'inherit' });
console.log(r.status === 0 ? `-> ${out}` : 'ffmpeg failed');
process.exit(r.status ?? 1);
