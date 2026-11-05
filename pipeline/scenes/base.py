"""Scene base class + helpers shared by every channel."""
from __future__ import annotations

import random
import re

from ..canvas import A, fmt_num


class Scene:
    """A scene draws the *stage* area for one narration line.

    ``draw(cv, t, dur)``: t = seconds since the segment started, dur = segment length.
    Scenes must be pure functions of (t, dur): all randomness comes from self.rng at init.
    """

    def __init__(self, vis, style, seed, ctx=None):
        self.v = vis
        self.st = style
        self.pal = style.pal
        self.x0, self.y0, self.x1, self.y1 = style.stage
        self.w = self.x1 - self.x0
        self.h = self.y1 - self.y0
        self.cx = (self.x0 + self.x1) / 2
        self.cy = (self.y0 + self.y1) / 2
        self.bottom = self.y1 - 56            # content bottom (footnote lives below)
        self.rng = random.Random(seed)
        self.ctx = ctx or {}
        self.init()

    def init(self):
        pass

    def opt(self, key, default=None):
        return self.v.opts.get(key, default)

    def draw(self, cv, t, dur):  # pragma: no cover
        raise NotImplementedError

    def draw_note(self, cv, t):
        note = self.opt("note")
        if note:
            a = min(1.0, max(0.0, (t - 0.5) / 0.4))
            cv.text(self.cx, self.y1 + 32, note, 27, "medium", A(self.pal["muted"], a * 0.95), anchor="mm")


def num(s, default=0.0):
    try:
        return float(str(s).replace(",", "").replace("$", "").replace("%", "").strip())
    except (TypeError, ValueError):
        return default


def nums(s):
    return [num(x) for x in str(s).split(",") if x.strip()]


def decimals_of(s):
    s = str(s)
    return len(s.split(".")[1]) if "." in s else 0


def parse_markup(line: str):
    """'Hide *$10,000* in a drawer.' -> [(word, emphasised, glued_to_previous), ...]"""
    out, emph, prev_open = [], False, False
    for part in re.split(r"(\*)", line):
        if part == "*":
            emph = not emph
            continue
        if not part:
            continue
        toks = part.split()
        for k, tok in enumerate(toks):
            glue = k == 0 and bool(out) and not part[0].isspace() and prev_open
            out.append((tok, emph, glue))
        prev_open = not part[-1].isspace()
    return out


_UNITS = {"s": 1, "sec": 1, "second": 1, "seconds": 1, "m": 60, "min": 60, "mins": 60, "minute": 60,
          "minutes": 60, "h": 3600, "hr": 3600, "hour": 3600, "hours": 3600, "d": 86400, "day": 86400, "days": 86400}


def parse_duration(s: str) -> float:
    """'8.3 min' / '4.2 hours' / '8:19' -> seconds"""
    s = s.strip().lower()
    m = re.match(r"^(\d+):(\d{2})(?::(\d{2}))?$", s)
    if m:
        a, b, c = int(m.group(1)), int(m.group(2)), m.group(3)
        return a * 3600 + b * 60 + int(c) if c else a * 60 + b
    m = re.match(r"^([\d.,]+)\s*([a-z]+)$", s)
    if m and m.group(2) in _UNITS:
        return float(m.group(1).replace(",", "")) * _UNITS[m.group(2)]
    return 0.0


def fmt_clock(sec: float) -> str:
    sec = int(round(sec))
    if sec >= 3600:
        return f"{sec // 3600}:{(sec % 3600) // 60:02d}:{sec % 60:02d}"
    return f"{sec // 60}:{sec % 60:02d}"


__all__ = ["Scene", "num", "nums", "decimals_of", "parse_markup", "parse_duration", "fmt_clock", "fmt_num"]
