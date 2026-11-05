"""Animated backgrounds + header/progress chrome, per channel template."""
from __future__ import annotations

import math
import random

import numpy as np
from PIL import Image

from .canvas import A, Canvas, H, W, clamp, gradient, mix, text_w
from .style import CHANNEL_NAMES


class Background:
    def __init__(self, style, S):
        self.st, self.S = style, S
        pal = style.pal
        glows = [(W * 0.78, 360, 700, pal["glow"], 0.40)]
        if style.channel == "space" and style.motif == "stars_nebula":
            glows = [(W * 0.15, 420, 760, pal["glow"], 0.55), (W * 0.9, 1250, 820, pal["glow2"], 0.38)]
        elif style.channel == "space":
            glows = [(W * 0.8, 300, 640, pal["glow"], 0.35), (W * 0.1, 1500, 640, pal.get("glow2", pal["glow"]), 0.18)]
        elif style.channel == "money":
            glows = [(W * 0.85, 250, 760, pal["glow"], 0.35), (W * 0.1, 1650, 800, pal["glow"], 0.25)]
        base = gradient(S, pal["bg_top"], pal["bg_bot"], glows)
        if style.channel == "history":  # baked paper-ish grain + vignette
            rng = np.random.default_rng(style.seed)
            arr = np.asarray(base).astype(np.int16)
            noise = rng.integers(-5, 6, size=(arr.shape[0] // 4, arr.shape[1] // 4, 1)).astype(np.int16)
            noise = np.kron(noise, np.ones((4, 4, 1), np.int16))
            arr = np.clip(arr + noise, 0, 255).astype(np.uint8)
            base = Image.fromarray(arr, "RGB")
        self.base = base
        r = random.Random(style.seed + 11)
        self.stars = [(r.uniform(0, W), r.uniform(0, H), r.choice([0.9, 1.2, 1.6, 2.2, 3.0]), r.uniform(0, 6.28),
                       r.uniform(0.2, 1.0)) for _ in range(190)]
        self.coins = [(r.uniform(0, W), r.uniform(0, H), r.uniform(60, 170), r.uniform(10, 26), r.choice("$%€£+")) for _ in range(9)]
        self.bars = [r.uniform(0.25, 1.0) for _ in range(18)]

    def canvas(self):
        return Canvas(self.base, self.S)

    def draw(self, cv, g):
        st, pal = self.st, self.st.pal
        ch = st.channel
        if ch == "space":
            streak = st.motif == "stars_streak"
            for (x, y, r, ph, sp) in self.stars:
                yy = (y + g * (14 + 38 * sp) * (3.2 if streak else 1)) % H
                tw = 0.55 + 0.45 * math.sin(g * 2.2 + ph)
                col = mix((255, 255, 255), pal["accent"], 0.25 * sp)
                if streak and sp > 0.55:
                    cv.line([(x, yy - 34 * sp), (x, yy)], A(col, 0.55 * tw), r * 0.9, caps=False)
                else:
                    cv.circle(x, yy, r * (0.8 + 0.3 * tw), fill=A(col, 0.35 + 0.55 * tw * sp))
        elif ch == "money":
            if st.motif == "grid":
                off = (g * 22) % 90
                for i in range(-1, 24):
                    y = i * 90 + off
                    cv.rect(0, y, W, y + 2, fill=A(pal["text"], 0.045))
                for i in range(0, 13):
                    cv.rect(i * 90, 0, i * 90 + 2, H, fill=A(pal["text"], 0.045))
            elif st.motif == "coins":
                for (x, y, r, sp, sym) in self.coins:
                    yy = (y - g * sp * 3) % (H + 2 * r) - r
                    cv.circle(x, yy, r, outline=A(pal["accent"], 0.10), width=5)
                    cv.text(x, yy, sym, r * 1.1, "black", A(pal["accent"], 0.10), anchor="mm")
            else:  # bars
                for i, hh in enumerate(self.bars):
                    h = (0.55 + 0.45 * math.sin(g * 0.9 + i * 0.7)) * hh * 360
                    x = 30 + i * 58
                    cv.rrect(x, H - h, x + 40, H + 20, 10, fill=A(pal["accent"], 0.10))
        else:  # history
            if st.motif == "compass":
                cx, cy, R = W - 130, H - 230, 250
                rot = g * 4
                cv.circle(cx, cy, R, outline=A(pal["accent2"], 0.12), width=3)
                cv.circle(cx, cy, R * 0.72, outline=A(pal["accent2"], 0.10), width=2)
                for k in range(4):
                    a = math.radians(rot + 90 * k)
                    tip = (cx + R * 1.1 * math.cos(a), cy + R * 1.1 * math.sin(a))
                    l = (cx + R * 0.16 * math.cos(a + 1.57), cy + R * 0.16 * math.sin(a + 1.57))
                    r_ = (cx + R * 0.16 * math.cos(a - 1.57), cy + R * 0.16 * math.sin(a - 1.57))
                    cv.poly([tip, l, r_], fill=A(pal["accent2"], 0.13))
            elif st.motif == "graticule":
                for i in range(-3, 10):
                    cv.arc(W / 2 + math.sin(g * 0.15) * 40, H + 900, 900 + i * 120, 215, 325, A(pal["accent2"], 0.08), 2)
                for i in range(-6, 7):
                    x0 = W / 2 + i * 150
                    cv.line([(x0, 1500), (W / 2 + i * 380, H)], A(pal["accent2"], 0.07), 2, caps=False)
            else:  # paper: soft vignette-ish corner flourishes
                for i in range(4):
                    cv.arc(60, 60, 120 + i * 22, 0, 90, A(pal["accent2"], 0.18 - i * 0.03), 3)
                    cv.arc(W - 60, 60, 120 + i * 22, 90, 180, A(pal["accent2"], 0.18 - i * 0.03), 3)


def chrome(cv, style, title, g, total):
    """Header (3 variants) + thin progress line.  Drawn above scenes, below captions."""
    pal, ch = style.pal, style.channel
    name = CHANNEL_NAMES[ch]
    font = "serif" if ch == "history" else "black"
    # progress
    cv.rrect(60, 66, W - 60, 72, 3, fill=A(pal["text"], 0.15))
    cv.rrect(60, 66, 60 + (W - 120) * clamp(g / total), 72, 3, fill=A(pal["accent"], 1))
    y = 120
    if style.header == "chip":
        tw = text_w(name, 30, font) + 70
        cv.rrect(60, y - 30, 60 + tw, y + 30, 30, fill=A(pal["accent"], 1))
        cv.circle(90, y, 7, fill=A(pal["on_accent"], 1))
        cv.text(110, y + 1, name, 30, font, A(pal["on_accent"], 1), anchor="lm")
        cv.text(W - 60, y, style.handle, 30, "bold", A(pal["muted"], 1), anchor="rm")
    elif style.header == "line":
        tw = text_w(name, 30, font) + 40
        cv.text(W / 2, y, name, 30, font, A(pal["accent"], 1), anchor="mm")
        cv.rect(60, y - 1, W / 2 - tw / 2, y + 1, fill=A(pal["accent"], 0.6))
        cv.rect(W / 2 + tw / 2, y - 1, W - 60, y + 1, fill=A(pal["accent"], 0.6))
    else:  # banner
        cv.rect(0, y - 34, W, y + 34, fill=A(pal["accent"], 1))
        cv.text(60, y + 1, name, 30, font, A(pal["on_accent"], 1), anchor="lm")
        cv.text(W - 60, y + 1, style.handle, 30, "bold", A(pal["on_accent"], 0.85), anchor="rm")
    # title (one line, ellipsised)
    t = title
    while text_w(t, 36, "bold") > W - 120 and len(t) > 8:
        t = t[:-2]
    if t != title:
        t = t.rstrip() + "…"
    cv.text(60, 196, t, 36, "bold", A(pal["text"], 0.92), anchor="lm")
