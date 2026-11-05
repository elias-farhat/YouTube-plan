"""Drawing primitives.

Everything is authored in *logical* 1080x1920 coordinates.  A Canvas draws at
``S``x resolution (default 2) and is box-filtered down at the end, which gives
smooth, anti-aliased edges with plain Pillow.
"""
from __future__ import annotations

import functools
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920

FONT_DIR = Path(__file__).parent / "assets" / "fonts"
FONT_FILES = {
    "medium": "Inter-Medium.otf",
    "bold": "Inter-Bold.otf",
    "xbold": "Inter-ExtraBold.otf",
    "black": "Inter-Black.otf",
    "serif": "DejaVuSerif-Bold.ttf",
}


@functools.lru_cache(maxsize=1024)
def _font(name: str, px: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_DIR / FONT_FILES[name]), max(1, int(px)))


# ---------------------------------------------------------------- colours ---
def rgb(h: str):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def mix(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def A(c, a=1.0):
    """colour + alpha (0..1) -> RGBA tuple"""
    return (int(c[0]), int(c[1]), int(c[2]), int(max(0.0, min(1.0, a)) * 255))


# ----------------------------------------------------------------- easing ---
def clamp(x, lo=0.0, hi=1.0):
    return lo if x < lo else hi if x > hi else x


def lerp(a, b, t):
    return a + (b - a) * t


def seg(t, t0, t1):
    """0..1 progress of t inside [t0, t1]"""
    if t1 <= t0:
        return 1.0 if t >= t1 else 0.0
    return clamp((t - t0) / (t1 - t0))


def ease_out(t):
    t = clamp(t)
    return 1 - (1 - t) ** 3


def ease_in_out(t):
    t = clamp(t)
    return 3 * t * t - 2 * t * t * t


def ease_out_expo(t):
    t = clamp(t)
    return 1.0 if t >= 1 else 1 - 2 ** (-10 * t)


def ease_out_back(t, s=1.70158):
    t = clamp(t) - 1
    return 1 + (s + 1) * t ** 3 + s * t ** 2


def bounce(t):
    t = clamp(t)
    if t < 1 / 2.75:
        return 7.5625 * t * t
    if t < 2 / 2.75:
        t -= 1.5 / 2.75
        return 7.5625 * t * t + 0.75
    if t < 2.5 / 2.75:
        t -= 2.25 / 2.75
        return 7.5625 * t * t + 0.9375
    t -= 2.625 / 2.75
    return 7.5625 * t * t + 0.984375


# --------------------------------------------------------- bg generation ---
def gradient(S, top, bottom, glows=()):
    """Vertical gradient (+ optional soft radial glows) as an RGB image."""
    w, h = W * S, H * S
    t = np.linspace(0, 1, h, dtype=np.float32)[:, None, None]
    top = np.array(top, np.float32)[None, None, :]
    bot = np.array(bottom, np.float32)[None, None, :]
    arr = np.repeat(top + (bot - top) * t, w, axis=1)
    if glows:
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        for (cx, cy, r, col, strength) in glows:
            d = np.hypot(xx - cx * S, yy - cy * S) / (r * S)
            a = np.clip(1 - d, 0, 1) ** 2 * strength
            arr += (np.array(col, np.float32)[None, None, :] - arr) * a[..., None]
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB")


@functools.lru_cache(maxsize=256)
def _glow_sprite(D, color, strength_q):
    n = np.linspace(-1, 1, D, dtype=np.float32)
    d = np.hypot(n[None, :], n[:, None])
    a = np.clip(1 - d, 0, 1) ** 2 * (strength_q / 20.0) * 255
    mask = Image.fromarray(a.astype(np.uint8), "L")
    return Image.new("RGB", (D, D), color), mask


class Canvas:
    def __init__(self, base: Image.Image, S: int = 2):
        self.S = S
        self.img = base.copy()
        self.d = ImageDraw.Draw(self.img, "RGBA")

    @classmethod
    def wrap(cls, img: Image.Image, S: int = 2) -> "Canvas":
        """Draw on an existing image without copying it."""
        c = cls.__new__(cls)
        c.S, c.img = S, img
        c.d = ImageDraw.Draw(img, "RGBA")
        return c

    # --- shapes -----------------------------------------------------------
    def rect(self, x0, y0, x1, y1, fill=None, outline=None, width=1):
        S = self.S
        self.d.rectangle([x0 * S, y0 * S, x1 * S, y1 * S], fill=fill, outline=outline,
                         width=max(1, round(width * S)))

    def rrect(self, x0, y0, x1, y1, r, fill=None, outline=None, width=1):
        S = self.S
        self.d.rounded_rectangle([x0 * S, y0 * S, x1 * S, y1 * S], radius=r * S, fill=fill,
                                 outline=outline, width=max(1, round(width * S)))

    def circle(self, cx, cy, r, fill=None, outline=None, width=1):
        S = self.S
        if r <= 0:
            return
        self.d.ellipse([(cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S], fill=fill,
                       outline=outline, width=max(1, round(width * S)))

    def ellipse(self, cx, cy, rx, ry, fill=None, outline=None, width=1):
        S = self.S
        self.d.ellipse([(cx - rx) * S, (cy - ry) * S, (cx + rx) * S, (cy + ry) * S], fill=fill,
                       outline=outline, width=max(1, round(width * S)))

    def arc(self, cx, cy, r, a0, a1, fill, width=4):
        S = self.S
        self.d.arc([(cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S], a0, a1, fill=fill,
                   width=max(1, round(width * S)))

    def line(self, pts, fill, width=4, caps=True):
        S = self.S
        flat = [(x * S, y * S) for x, y in pts]
        if len(flat) < 2:
            return
        self.d.line(flat, fill=fill, width=max(1, round(width * S)), joint="curve")
        if caps and width >= 4:
            for (x, y) in (pts[0], pts[-1]):
                self.circle(x, y, width / 2, fill=fill)

    def poly(self, pts, fill=None, outline=None, width=1):
        S = self.S
        flat = [(x * S, y * S) for x, y in pts]
        if len(flat) < 3:
            return
        if fill is not None:
            self.d.polygon(flat, fill=fill)
        if outline is not None:
            self.d.line(flat + [flat[0]], fill=outline, width=max(1, round(width * S)), joint="curve")

    def glow(self, cx, cy, r, color, strength=1.0):
        if r <= 0 or strength <= 0:
            return
        S = self.S
        D = int(round(r * 2 * S / 8)) * 8 + 8
        q = int(round(clamp(strength, 0, 1) * 20))
        if q == 0:
            return
        sprite, mask = _glow_sprite(D, tuple(color), q)
        self.img.paste(sprite, (int(cx * S - D / 2), int(cy * S - D / 2)), mask)

    # --- text ---------------------------------------------------------------
    def text(self, x, y, s, size, font="bold", fill=(255, 255, 255, 255), anchor="la",
             stroke=0, stroke_fill=None, shadow=None):
        S = self.S
        # Pillow draws alpha-0 text as fully OPAQUE in RGBA mode, so skip invisible text explicitly
        if len(fill) == 4 and fill[3] < 2:
            return
        if stroke and stroke_fill is not None and len(stroke_fill) == 4 and stroke_fill[3] < 2:
            stroke = 0
        if shadow and len(shadow[2]) == 4 and shadow[2][3] < 2:
            shadow = None
        f = _font(font, round(size * S))
        if shadow:
            dx, dy, col = shadow
            self.d.text(((x + dx) * S, (y + dy) * S), s, font=f, fill=col, anchor=anchor,
                        stroke_width=round(stroke * S), stroke_fill=col if stroke else None)
        self.d.text((x * S, y * S), s, font=f, fill=fill, anchor=anchor,
                    stroke_width=round(stroke * S), stroke_fill=stroke_fill)

    def finish(self) -> Image.Image:
        return self.img.reduce(self.S) if self.S > 1 else self.img


# -------------------------------------------------- measuring (no canvas) ---
def text_w(s, size, font="bold", S=2):
    return _font(font, round(size * S)).getlength(s) / S


def fit_size(s, max_w, max_size, font="bold", min_size=20):
    size = max_size
    while size > min_size and text_w(s, size, font) > max_w:
        size -= 2
    return size


def wrap(s, size, font, max_w):
    words, lines, cur = s.split(), [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if text_w(trial, size, font) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def fmt_num(v, prefix="", suffix="", decimals=0, sep=True):
    s = f"{v:,.{decimals}f}" if sep else f"{v:.{decimals}f}"
    neg = s.startswith("-")
    s = s.lstrip("-")
    return ("-" if neg else "") + prefix + s + suffix
