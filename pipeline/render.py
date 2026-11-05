"""Frame loop -> ffmpeg, plus the sidecar files (narration, SRT, cues, json)."""
from __future__ import annotations

import json
import multiprocessing as mp
import os
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path

from .backgrounds import Background, chrome
from .canvas import Canvas, H, W
from .captions import CaptionTrack, make_chunks
from .scenes import REGISTRY, available
from .scenes.base import Scene
from .scenes.history import parse_territories
from .script import Script, Visual
from .style import Style
from .timeline import FPS, MAX_LEN, MIN_LEN, Timeline, fmt_ts
from .transitions import transition


@dataclass
class Job:
    script: Script
    style: Style
    timeline: Timeline
    S: int = 2
    captions: bool = True


# ------------------------------------------------------------ scene setup ---
def default_visual(line) -> Visual:
    words = line.shown_text.split()
    k = max(1, round(len(words) / 3))
    rows = [" ".join(words[i:i + k]) for i in range(0, len(words), k)]
    return Visual("kinetic", args=rows[:4], raw="(auto kinetic)")


def build_scenes(job: Job):
    ch = job.script.channel
    ctx = {}
    if ch == "history":
        ctx["territories"] = parse_territories(job.script.multi.get("territory", []))
    scenes = []
    for i, line in enumerate(job.script.lines):
        vis = line.visual or default_visual(line)
        cls = REGISTRY[ch].get(vis.kind)
        if cls is None:
            raise ValueError(f"{job.script.path}:{line.lineno}: unknown visual '{vis.kind}' for channel '{ch}'. "
                             f"Available: {', '.join(available(ch))}")
        scenes.append(cls(vis, job.style, job.style.seed * 31 + i, ctx))
    return scenes


class Renderer:
    def __init__(self, job: Job):
        self.job = job
        self.bg = Background(job.style, job.S)
        self.scenes = build_scenes(job)
        self.tracks = [CaptionTrack(s, job.style) for s in job.timeline.segs]
        self.total = job.timeline.total

    def _scene_img(self, idx, t, g):
        seg = self.job.timeline.segs[idx]
        cv = self.bg.canvas()
        self.bg.draw(cv, g)
        sc = self.scenes[idx]
        sc.draw(cv, t, seg.dur)
        sc.draw_note(cv, t)
        return cv.img

    def frame(self, f):
        job = self.job
        g = f / FPS
        seg = job.timeline.seg_at(g)
        t = g - seg.start
        img = self._scene_img(seg.idx, t, g)
        td = job.style.pace["td"]
        if seg.idx > 0 and t < td:
            prev = job.timeline.segs[seg.idx - 1]
            pimg = self._scene_img(prev.idx, prev.dur + t, g)
            img = transition(job.style.transition, pimg, img, t / td)
        cv = Canvas.wrap(img, job.S)
        chrome(cv, job.style, job.script.title, g, self.total)
        if job.captions:
            self.tracks[seg.idx].draw(cv, g)
        return cv.finish()


_R: Renderer | None = None


def _init_worker(job):
    global _R
    _R = Renderer(job)


def _frame(f):
    return _R.frame(f).tobytes()


def render_stills(job: Job, times, outdir: Path):
    r = Renderer(job)
    outdir.mkdir(parents=True, exist_ok=True)
    paths = []
    for t in times:
        p = outdir / f"{job.script.slug}_{t:05.1f}s.png"
        r.frame(int(round(t * FPS))).save(p)
        paths.append(p)
    return paths


# ------------------------------------------------------------------ audio ---
def mix_voice(timeline: Timeline, path: Path):
    segs = [s for s in timeline.segs if s.audio is not None]
    cmd = ["ffmpeg", "-y", "-loglevel", "error"]
    for s in segs:
        cmd += ["-i", str(s.audio.path)]
    parts = []
    for i, s in enumerate(segs):
        ms = int(s.speech_start * 1000)
        parts.append(f"[{i}:a]aresample=44100,aformat=channel_layouts=stereo,adelay={ms}|{ms}[a{i}]")
    mixin = "".join(f"[a{i}]" for i in range(len(segs)))
    parts.append(f"{mixin}amix=inputs={len(segs)}:normalize=0,apad[out]")
    cmd += ["-filter_complex", ";".join(parts), "-map", "[out]", "-t", f"{timeline.total:.3f}", str(path)]
    subprocess.run(cmd, check=True)


def encode(job: Job, out_mp4: Path, workers: int, voice_wav: Path | None):
    tl = job.timeline
    n = int(round(tl.total * FPS))
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
           "-r", str(FPS), "-i", "-"]
    if voice_wav:
        cmd += ["-i", str(voice_wav)]
    else:
        cmd += ["-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"]
    cmd += ["-t", f"{n / FPS:.3f}", "-map", "0:v", "-map", "1:a",
            "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-profile:v", "high", "-level", "4.2",
            "-pix_fmt", "yuv420p", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
            "-r", str(FPS), "-g", str(FPS * 2), "-movflags", "+faststart",
            "-c:a", "aac", "-b:a", "160k", "-ar", "44100", str(out_mp4)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    t0 = time.time()
    try:
        try:
            ctx = mp.get_context("fork")
        except ValueError:
            ctx = mp.get_context()
        with ctx.Pool(workers, initializer=_init_worker, initargs=(job,)) as pool:
            for i, buf in enumerate(pool.imap(_frame, range(n), chunksize=6)):
                proc.stdin.write(buf)
                if i % 60 == 0:
                    el = time.time() - t0
                    eta = el / (i + 1) * (n - i - 1)
                    print(f"\r  frame {i + 1}/{n}  ({el:4.0f}s elapsed, ~{eta:3.0f}s left)", end="", file=sys.stderr, flush=True)
        proc.stdin.close()
        rc = proc.wait()
    except BaseException:
        proc.kill()
        raise
    print(f"\r  frame {n}/{n}  done in {time.time() - t0:.0f}s" + " " * 20, file=sys.stderr)
    if rc != 0:
        raise RuntimeError(f"ffmpeg exited with {rc}")


# -------------------------------------------------------------- sidecars ---
def write_sidecars(job: Job, outdir: Path, status: str):
    sc, tl, slug = job.script, job.timeline, job.script.slug
    # narration text (spoken form: numbers written as words where the script says so)
    lines = [l.spoken_text for l in sc.lines]
    (outdir / f"{slug}.narration.txt").write_text(sc.title + "\n\n" + "\n\n".join(lines) + "\n", encoding="utf-8")
    # voice-over cue sheet
    cue = [f"{sc.title}", f"Total length {tl.total:.1f}s - start each line of narration at its time:", ""]
    for s in tl.segs:
        cue.append(f"[{fmt_ts(s.speech_start)}]  {sc.lines[s.idx].spoken_text}")
    (outdir / f"{slug}.cues.txt").write_text("\n".join(cue) + "\n", encoding="utf-8")
    # SRT
    srt, n = [], 1
    for s in tl.segs:
        chunks = make_chunks(s.words, job.style.pace["chunk"])
        for i, c in enumerate(chunks):
            a = c[0].t0
            b = chunks[i + 1][0].t0 if i + 1 < len(chunks) else s.speech_end + 0.1
            srt.append(f"{n}\n{fmt_ts(a, True)} --> {fmt_ts(b, True)}\n{' '.join(w.shown for w in c)}\n")
            n += 1
    (outdir / f"{slug}.srt").write_text("\n".join(srt), encoding="utf-8")
    meta = dict(title=sc.title, channel=sc.channel, duration=round(tl.total, 2), voiced=tl.voiced, tts=status,
                style=job.style.describe(),
                lines=[dict(start=round(s.start, 2), end=round(s.end, 2), speech_start=round(s.speech_start, 2),
                            text=sc.lines[s.idx].spoken_text, visual=sc.lines[s.idx].visual.raw if sc.lines[s.idx].visual else None)
                       for s in tl.segs])
    (outdir / f"{slug}.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    return meta


def check_length(tl: Timeline):
    if not (MIN_LEN <= tl.total <= MAX_LEN):
        return (f"length {tl.total:.1f}s is outside the {MIN_LEN:.0f}-{MAX_LEN:.0f}s Shorts target "
                f"({'add' if tl.total < MIN_LEN else 'cut'} roughly "
                f"{abs(round((tl.total - (MIN_LEN + MAX_LEN) / 2) * 2.6))} words)")
    return None
