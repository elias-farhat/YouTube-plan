"""python -m pipeline render|stills|check SCRIPT..."""
from __future__ import annotations

import argparse
import os
import sys
import tempfile
from pathlib import Path

from .render import Job, check_length, encode, mix_voice, render_stills, write_sidecars
from .script import ScriptError, parse_script
from .style import parse_overrides, pick_style, seed_from_title
from .timeline import build_timeline
from . import tts as ttsmod


def prepare(path, args):
    sc = parse_script(path)
    seed = int(sc.meta["seed"]) if sc.meta.get("seed", "").lstrip("-").isdigit() else seed_from_title(sc.title)
    ov = parse_overrides(sc.meta.get("style", ""))
    for kv in getattr(args, "set", None) or []:
        ov.update(parse_overrides(kv))
    style = pick_style(sc.channel, seed, ov, sc.meta.get("handle"))
    return sc, style


def get_audio(sc, style, mode, workdir):
    voice = sc.meta.get("voice") or ttsmod.VOICES.get(sc.channel, ttsmod.DEFAULT_VOICE)
    return ttsmod.synthesize([l.spoken_text for l in sc.lines], mode, voice, style.pace["rate"], workdir)


def cmd_render(args):
    outdir = Path(args.out)
    outdir.mkdir(parents=True, exist_ok=True)
    rc = 0
    for path in args.scripts:
        print(f"== {path}")
        sc, style = prepare(path, args)
        with tempfile.TemporaryDirectory(prefix="shorts_") as tmp:
            tmp = Path(tmp)
            audios, status = get_audio(sc, style, args.tts, tmp)
            print(f"  {status}")
            tl = build_timeline(sc, style, audios)
            warn = check_length(tl)
            if warn:
                print(f"  ! {warn}", file=sys.stderr)
                if not args.any_length:
                    print("    (use --any-length to render anyway)", file=sys.stderr)
                    rc = 2
                    continue
            print(f"  channel={sc.channel} length={tl.total:.1f}s lines={len(sc.lines)} style={style.describe()}")
            job = Job(sc, style, tl, S=args.scale, captions=not args.no_captions)
            voice = None
            if tl.voiced:
                voice = tmp / "voice.wav"
                mix_voice(tl, voice)
            out = outdir / f"{sc.slug}.mp4"
            encode(job, out, args.workers, voice)
            write_sidecars(job, outdir, status)
            print(f"  -> {out}  ({out.stat().st_size / 1e6:.1f} MB)")
    return rc


def cmd_stills(args):
    rc = 0
    for path in args.scripts:
        sc, style = prepare(path, args)
        audios, status = get_audio(sc, style, "none", Path(tempfile.mkdtemp()))
        tl = build_timeline(sc, style, audios)
        times = [float(x) for x in args.times.split(",")] if args.times else \
            [min(tl.total - 0.05, s.start + min(s.dur * 0.85, s.dur - 0.1)) for s in tl.segs]
        job = Job(sc, style, tl, S=args.scale, captions=not args.no_captions)
        for p in render_stills(job, times, Path(args.out)):
            print(p)
    return rc


def cmd_check(args):
    rc = 0
    for path in args.scripts:
        sc, style = prepare(path, args)
        tl = build_timeline(sc, style, None)
        words = sum(len(l.words) for l in sc.lines)
        warn = check_length(tl)
        print(f"{path}: {sc.channel} | {len(sc.lines)} lines | {words} words | est. {tl.total:.1f}s | {style.describe()}")
        if warn:
            print(f"  ! {warn}")
            rc = 2
    return rc


def main(argv=None):
    ap = argparse.ArgumentParser(prog="pipeline", description="Script -> 1080x1920 Shorts with burned-in captions")
    sub = ap.add_subparsers(dest="cmd", required=True)

    def common(p):
        p.add_argument("scripts", nargs="+")
        p.add_argument("--scale", type=int, default=2, help="supersampling factor (2 = best, 1 = fast draft)")
        p.add_argument("--no-captions", action="store_true", help="omit burned-in captions")
        p.add_argument("--set", action="append", help="override style, e.g. --set palette=ember,layout=B")

    r = sub.add_parser("render", help="render MP4 + narration/SRT/cue files")
    common(r)
    r.add_argument("-o", "--out", default="output")
    r.add_argument("--tts", choices=["auto", "edge", "none"], default="auto",
                   help="auto: try Edge neural TTS, fall back to a silent render (default)")
    r.add_argument("--workers", type=int, default=os.cpu_count() or 2)
    r.add_argument("--any-length", action="store_true", help="skip the 30-50s length guard")
    r.set_defaults(fn=cmd_render)

    s = sub.add_parser("stills", help="dump PNG stills for design review")
    common(s)
    s.add_argument("-o", "--out", default="stills")
    s.add_argument("--times", help="comma separated seconds (default: end of every line)")
    s.set_defaults(fn=cmd_stills)

    c = sub.add_parser("check", help="parse + estimate length only")
    common(c)
    c.set_defaults(fn=cmd_check)

    args = ap.parse_args(argv)
    try:
        return args.fn(args)
    except (ScriptError, ValueError, RuntimeError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
