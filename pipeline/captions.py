"""Burned-in word-highlight captions (drawn with Pillow, no libass needed)."""
from __future__ import annotations

from .canvas import A, W, clamp, ease_out_back, mix, text_w

STYLES = {
    "pop":       dict(font="black", size=84, upper=True,  stroke=8),
    "underline": dict(font="xbold", size=78, upper=False, stroke=7),
    "bar":       dict(font="xbold", size=68, upper=False, stroke=0, panel=True),
    "glow":      dict(font="bold",  size=74, upper=False, stroke=5, glow=True),
    "serif":     dict(font="serif", size=64, upper=False, stroke=6),
}
MAX_W = 900


def _lum(c):
    return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255


def active_colour(pal):
    return pal["hl"] if not pal["light"] else (pal["accent"] if _lum(pal["accent"]) < 0.55 else pal["accent2"])


def make_chunks(words, max_words: int, max_chars: int = 30):
    """Group TWords into display chunks; break on punctuation / length."""
    chunks, cur = [], []
    for w in words:
        cur.append(w)
        txt = " ".join(x.shown for x in cur)
        end_punct = w.shown.endswith((".", "!", "?", ",", ";", ":"))
        if len(cur) >= max_words or len(txt) >= max_chars or (end_punct and len(cur) >= 2):
            chunks.append(cur)
            cur = []
    if cur:
        if chunks and len(cur) == 1 and len(chunks[-1]) < max_words + 1 and not chunks[-1][-1].shown.endswith((".", "!", "?")):
            chunks[-1].extend(cur)  # avoid orphan single word
        else:
            chunks.append(cur)
    return chunks


class CaptionTrack:
    """Pre-computed chunks for a segment; ``draw`` renders the right one for time t."""

    def __init__(self, seg, style):
        self.seg = seg
        self.style = style
        self.cfg = STYLES[style.caption]
        self.chunks = make_chunks(seg.words, style.pace["chunk"])
        # chunk i is visible from its first word until the next chunk starts
        self.starts = [c[0].t0 for c in self.chunks]
        self.starts[0] = min(self.starts[0], seg.speech_start) - 0.02

    def _layout(self, words, size, font, upper):
        toks = [(w.shown.upper() if upper else w.shown) for w in words]
        spc = text_w(" ", size, font)
        widths = [text_w(t, size, font) for t in toks]
        # greedy wrap into <=2 lines
        lines, cur, cw = [], [], 0
        for i, wd in enumerate(widths):
            add = wd + (spc if cur else 0)
            if cur and cw + add > MAX_W:
                lines.append(cur)
                cur, cw = [i], wd
            else:
                cur.append(i)
                cw += add
        lines.append(cur)
        return toks, widths, spc, lines

    def draw(self, cv, t):
        if not self.chunks:
            return
        k = 0
        for i, s in enumerate(self.starts):
            if t >= s:
                k = i
        words = self.chunks[k]
        age = t - self.starts[k]
        cfg, pal = self.cfg, self.style.pal
        font, upper = cfg["font"], cfg["upper"]
        size = cfg["size"]
        toks, widths, spc, lines = self._layout(words, size, font, upper)
        while max(sum(widths[i] for i in ln) + spc * (len(ln) - 1) for ln in lines) > MAX_W and size > 40:
            size -= 4
            toks, widths, spc, lines = self._layout(words, size, font, upper)

        pop = 0.90 + 0.10 * ease_out_back(clamp(age / 0.16)) if age < 0.16 else 1.0
        alpha = clamp(age / 0.08)
        lh = size * 1.22
        cx, cy = W / 2, self.style.cap_y
        block_h = lh * len(lines)
        acol = active_colour(pal)

        # active word = last word whose start <= t
        act = 0
        for i, w in enumerate(words):
            if t >= w.t0:
                act = i

        # panel
        if cfg.get("panel"):
            bw = max(sum(widths[i] for i in ln) + spc * (len(ln) - 1) for ln in lines) + 70
            bh = block_h + 34
            cv.rrect(cx - bw / 2 * pop, cy - bh / 2 * pop, cx + bw / 2 * pop, cy + bh / 2 * pop, 34 * pop,
                     fill=(14, 14, 20, int(205 * alpha)))

        S = size * pop
        for li, ln in enumerate(lines):
            lw = (sum(widths[i] for i in ln) + spc * (len(ln) - 1)) * pop
            x = cx - lw / 2
            ly = cy - block_h / 2 * pop + (li + 0.5) * lh * pop
            for i in ln:
                wd = widths[i] * pop
                is_act = i == act
                light = pal["light"] and not cfg.get("panel")
                col = A((12, 18, 24) if light else (255, 255, 255), alpha)
                stroke_col = A((255, 255, 255) if light else (8, 8, 14), alpha)
                if is_act:
                    if cfg.get("panel"):
                        cv.rrect(x - 12, ly - S * 0.58, x + wd + 12, ly + S * 0.58, 22 * pop,
                                 fill=A(acol, alpha))
                        col = A(pal["on_accent"], alpha)
                    else:
                        col = A(acol, alpha)
                    if cfg.get("glow"):
                        cv.glow(x + wd / 2, ly, wd * 0.75 + 40, acol, 0.55)
                    if self.style.caption in ("underline", "serif"):
                        cv.rrect(x, ly + S * 0.50, x + wd, ly + S * 0.50 + 9 * pop, 4,
                                 fill=A(acol if self.style.caption == "underline" else pal["accent2"], alpha))
                cv.text(x, ly, toks[i], S, font=font, fill=col, anchor="lm",
                        stroke=cfg["stroke"] * pop if not (cfg.get("panel")) else 0,
                        stroke_fill=stroke_col if cfg["stroke"] else None,
                        shadow=None if (cfg.get("panel") or light) else (0, 4, (0, 0, 0, int(110 * alpha))))
                x += wd + spc * pop
