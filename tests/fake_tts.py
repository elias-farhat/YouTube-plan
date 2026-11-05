#!/usr/bin/env python3
"""Stub TTS for testing the *voiced* render path offline: same protocol as tools/tts.py,
but 'speaks' a tone (0.28 s per word) and returns word timings.  Used with SHORTS_TTS_HELPER=tests/fake_tts.py"""
import json, os, subprocess, sys
req = json.load(sys.stdin)
os.makedirs(req["outdir"], exist_ok=True)
lines = []
for i, text in enumerate(req["lines"]):
    n = len(text.split())
    dur = 0.28 * n
    f = os.path.join(req["outdir"], f"line_{i:02d}.wav")
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "lavfi", "-i", f"sine=frequency={220 + 30 * (i % 5)}:duration={dur}", "-af", "volume=0.3", f], check=True)
    lines.append({"file": f, "duration": dur, "words": [[k * 0.28, (k + 1) * 0.28] for k in range(n)]})
print(json.dumps({"engine": "edge", "status": "fake tones (test)", "lines": lines}))
