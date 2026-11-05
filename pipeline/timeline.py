"""Turn a parsed script (+ optional TTS audio) into a timed timeline."""
from __future__ import annotations

import re
from dataclasses import dataclass, field

FPS = 30
MIN_LEN, MAX_LEN = 30.0, 50.0


@dataclass
class TWord:
    shown: str
    t0: float  # seconds, relative to *video* start
    t1: float


@dataclass
class Seg:
    idx: int
    start: float
    end: float
    line_idx: int
    speech_start: float
    speech_end: float
    words: list = field(default_factory=list)  # list[TWord]
    audio: object = None                       # LineAudio | None

    @property
    def dur(self):
        return self.end - self.start


@dataclass
class Timeline:
    segs: list
    total: float
    voiced: bool

    def seg_at(self, t):
        for s in self.segs:
            if t < s.end:
                return s
        return self.segs[-1]


def _letters(w: str) -> int:
    return max(1, len(re.sub(r"[^A-Za-z0-9]", "", w)))


def _pause_after(tok: str) -> float:
    if tok.endswith((".", "!", "?", ":")):
        return 0.32
    if tok.endswith((",", ";", "—", "-")):
        return 0.16
    return 0.0


def estimate_word_times(line, speed: float):
    """Per-shown-word (t0, t1) seconds from speech start, estimated from text."""
    spans, t = [], 0.0
    for w in line.words:
        t0 = t
        for sp in w.spoken:
            t += (0.13 + 0.047 * _letters(sp)) * speed
        t1 = t
        spans.append([t0, t1])
        t += _pause_after(w.shown) * speed
    # last pause is not needed inside the line
    return spans, t - (_pause_after(line.words[-1].shown) * speed if line.words else 0)


def map_tts_words(line, word_times, total):
    """Map per-spoken-word TTS boundaries onto shown words (falls back to proportional)."""
    n_spoken = sum(len(w.spoken) for w in line.words)
    if not word_times or len(word_times) != n_spoken:
        return None
    spans, k = [], 0
    for w in line.words:
        n = len(w.spoken)
        spans.append([word_times[k][0], word_times[k + n - 1][1]])
        k += n
    return spans


def build_timeline(script, style, audios=None) -> Timeline:
    pace = style.pace
    td = pace["td"]
    segs, t = [], 0.0
    for i, line in enumerate(script.lines):
        lead = 0.30 if i == 0 else td + 0.10
        audio = audios[i] if audios else None
        spans = None
        if audio is not None:
            speech = audio.duration
            spans = map_tts_words(line, audio.word_times, speech)
        if spans is None:
            est, est_total = estimate_word_times(line, pace["speed"])
            if audio is not None:  # real duration known, proportional words
                scale = audio.duration / max(est_total, 1e-6)
                spans = [[a * scale, b * scale] for a, b in est]
                speech = audio.duration
            else:
                spans, speech = est, est_total
        tail = pace["gap"] + (0.55 if i == len(script.lines) - 1 else 0.0)
        start = t
        s0 = start + lead
        end = s0 + speech + tail
        words = [TWord(w.shown, s0 + a, s0 + b) for w, (a, b) in zip(line.words, spans)]
        segs.append(Seg(i, start, end, i, s0, s0 + speech, words, audio))
        t = end
    return Timeline(segs, t, voiced=audios is not None)


def fmt_ts(t, srt=False):
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}" if srt else f"{m:02d}:{s:02d}.{ms // 100}"
