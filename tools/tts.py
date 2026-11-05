#!/usr/bin/env python3
"""TTS bridge.  Order: edge-tts (free neural voices, needs internet) -> Piper (offline) -> none.

stdin  : {"lines": ["spoken text", ...], "voice": "en-US-GuyNeural", "rate": "+0%", "outdir": "...",
          "engine": "auto|edge|piper|none"}
stdout : {"engine": "edge|piper|none", "status": "...", "lines": [{"file", "duration", "words"}...]}
         words = [[start, end], ...] per spoken word (edge only) or null.

Piper needs a voice model (.onnx + .onnx.json).  Drop one in models/piper/ (download any voice from
https://huggingface.co/rhasspy/piper-voices) or let this script try to fetch en_US-lessac-medium.
"""
import asyncio
import glob
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PIPER_DIR = os.path.join(ROOT, "models", "piper")
PIPER_DEFAULT = "en_US-lessac-medium"


def duration(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", path],
                         capture_output=True, text=True, check=True).stdout
    return float(json.loads(out)["format"]["duration"])


async def _edge_line(text, voice, rate, out):
    import edge_tts
    try:
        comm = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
    except TypeError:
        comm = edge_tts.Communicate(text, voice, rate=rate)
    words = []
    with open(out, "wb") as f:
        async for ch in comm.stream():
            if ch["type"] == "audio":
                f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                s = ch["offset"] / 1e7
                words.append([s, s + ch["duration"] / 1e7])
    return words


def run_edge(lines, voice, rate, outdir):
    async def go():
        res = []
        for i, text in enumerate(lines):
            p = os.path.join(outdir, f"line_{i:02d}.mp3")
            words = await asyncio.wait_for(_edge_line(text, voice, rate, p), timeout=25)
            if not os.path.exists(p) or os.path.getsize(p) < 500:
                raise RuntimeError("edge-tts returned no audio")
            res.append({"file": p, "duration": duration(p), "words": words or None})
        return res
    return asyncio.run(go())


def find_piper_model():
    found = sorted(glob.glob(os.path.join(PIPER_DIR, "*.onnx")))
    if found:
        return found[0]
    os.makedirs(PIPER_DIR, exist_ok=True)
    # try to fetch the default voice (will fail fast when huggingface is blocked)
    r = subprocess.run([sys.executable, "-m", "piper.download_voices", PIPER_DEFAULT, "--download-dir", PIPER_DIR],
                       capture_output=True, text=True, timeout=60)
    if r.returncode != 0:
        tail = (r.stderr.strip().splitlines() or ["download failed"])[-1][:100]
        raise RuntimeError(f"no local voice in models/piper and download failed ({tail})")
    found = sorted(glob.glob(os.path.join(PIPER_DIR, "*.onnx")))
    if not found:
        raise RuntimeError("no Piper voice model available")
    return found[0]


def run_piper(lines, outdir):
    model = find_piper_model()
    res = []
    for i, text in enumerate(lines):
        p = os.path.join(outdir, f"line_{i:02d}.wav")
        subprocess.run([sys.executable, "-m", "piper", "--model", model, "--output_file", p],
                       input=text.encode(), capture_output=True, timeout=120, check=True)
        res.append({"file": p, "duration": duration(p), "words": None})
    return res, os.path.basename(model)


def short(e):
    msg = str(e).splitlines()[0][:110] if str(e) else ""
    return f"{type(e).__name__}: {msg}".strip(": ")


def main():
    req = json.load(sys.stdin)
    lines, outdir = req["lines"], req["outdir"]
    engine = req.get("engine", "auto")
    os.makedirs(outdir, exist_ok=True)
    reasons = []
    if engine in ("auto", "edge"):
        try:
            res = run_edge(lines, req.get("voice", "en-US-AndrewNeural"), req.get("rate", "+0%"), outdir)
            print(json.dumps({"engine": "edge", "status": f"edge-tts voice {req.get('voice')}", "lines": res}))
            return
        except Exception as e:  # noqa: BLE001 - network blocked, package missing, service error...
            reasons.append(f"edge-tts: {short(e)}")
    if engine in ("auto", "piper"):
        try:
            res, model = run_piper(lines, outdir)
            print(json.dumps({"engine": "piper", "status": f"Piper voice {model}", "lines": res}))
            return
        except Exception as e:  # noqa: BLE001
            reasons.append(f"piper: {short(e)}")
    print(json.dumps({"engine": "none", "status": "; ".join(reasons) or "TTS disabled", "lines": None}))


if __name__ == "__main__":
    main()
