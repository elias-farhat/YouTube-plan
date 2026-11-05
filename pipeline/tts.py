"""Text-to-speech with graceful fallback.

Backends
--------
* ``edge``  - Microsoft Edge neural voices through the ``edge-tts`` package
              (free, needs internet access to speech.platform.bing.com).
* ``none``  - silent video; timings are estimated from the text.

``auto`` tries ``edge`` first and drops to ``none`` if the network blocks it,
so the pipeline always produces a usable video + narration text for CapCut.
"""
from __future__ import annotations

import asyncio
import json
import subprocess
from dataclasses import dataclass
from pathlib import Path

DEFAULT_VOICE = "en-US-AndrewNeural"
VOICES = {  # nice defaults per channel
    "money": "en-US-GuyNeural",
    "space": "en-US-AndrewNeural",
    "history": "en-GB-RyanNeural",
}


@dataclass
class LineAudio:
    path: Path
    duration: float
    word_times: list | None  # [(start, end)] per *spoken* word, seconds from clip start; may be None


def audio_duration(path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(path)],
        capture_output=True, text=True, check=True).stdout
    return float(json.loads(out)["format"]["duration"])


async def _edge_one(text, voice, rate, out_path):
    import edge_tts

    try:
        comm = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
    except TypeError:  # older edge-tts has no `boundary` argument (always word boundaries)
        comm = edge_tts.Communicate(text, voice, rate=rate)
    words = []
    with open(out_path, "wb") as f:
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                start = chunk["offset"] / 1e7
                words.append((start, start + chunk["duration"] / 1e7))
    return words


def synth_edge(lines: list[str], voice: str, rate: str, workdir: Path, timeout=30):
    """Returns list[LineAudio]; raises on any failure."""
    try:
        import edge_tts  # noqa: F401
    except ImportError as e:
        raise RuntimeError("edge-tts is not installed (pip install edge-tts)") from e

    async def run():
        res = []
        for i, text in enumerate(lines):
            p = workdir / f"line_{i:02d}.mp3"
            words = await asyncio.wait_for(_edge_one(text, voice, rate, p), timeout=timeout)
            if not p.exists() or p.stat().st_size < 500:
                raise RuntimeError("TTS returned no audio")
            res.append(LineAudio(p, audio_duration(p), words or None))
        return res

    return asyncio.run(run())


def synthesize(lines: list[str], mode: str, voice: str, rate: str, workdir: Path):
    """-> (list[LineAudio] | None, status message)."""
    workdir.mkdir(parents=True, exist_ok=True)
    if mode == "none":
        return None, "TTS disabled (--tts none): silent render"
    try:
        res = synth_edge(lines, voice, rate, workdir)
        return res, f"TTS ok: edge-tts voice {voice}"
    except Exception as e:  # network blocked, package missing, service error...
        reason = f"{type(e).__name__}: {str(e).splitlines()[0][:90]}" if str(e) else type(e).__name__
        if mode == "edge":
            raise RuntimeError(f"--tts edge requested but TTS failed ({reason})") from e
        return None, f"TTS unavailable ({reason}) -> silent render + narration files for CapCut"
