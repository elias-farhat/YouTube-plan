"""Space/science scenes: 2D motion graphics."""
from __future__ import annotations

import math
import re

from ..canvas import (A, clamp, ease_in_out, ease_out, ease_out_back, ease_out_expo, fit_size, fmt_num, lerp, mix, seg,
                      text_w, wrap)
from .base import Scene, fmt_clock, num, parse_duration
from .planets import draw_planet


class LightBeam(Scene):
    """A pulse of light leaves a source and crosses to a target, with live timer + distance.
    opts: from=Sun to=Earth time=8:19 distance=149.6 million km title=..."""

    def init(self):
        o = self.opt
        self.src, self.dst = o("from", "Sun"), o("to", "Earth")
        self.total = parse_duration(o("time", "8:19")) or 499
        m = re.match(r"^([\d.,]+)\s*(.*)$", o("distance", "149.6 million km"))
        self.dist_v = float(m.group(1).replace(",", "")) if m else 0
        self.dist_u = m.group(2) if m else ""
        self.dist_dec = len(m.group(1).split(".")[1]) if m and "." in m.group(1) else 0
        self.title = o("title", "")

    def draw(self, cv, t, dur):
        pal = self.pal
        a = clamp(seg(t, 0, 0.35))
        bx = self.x0 + 270
        sy = self.y0 + 150 + (60 if self.title else 0)
        ey = self.bottom - 110
        sr, er = 105, 44
        p = clamp(seg(t, 0.4, 0.4 + dur * 0.78))
        if self.title:
            cv.text(self.x0 + 30, self.y0 + 44, self.title.upper(), 36, "xbold", A(pal["muted"], a), anchor="lm")
        # guide line
        y_start, y_end = sy + sr, ey - er
        n = 36
        for i in range(n):
            yy = lerp(y_start, y_end, i / n)
            cv.circle(bx, yy, 3, fill=A(pal["muted"], 0.35 * a))
        # sun
        pulse = 1 + 0.03 * math.sin(t * 3)
        cv.glow(bx, sy, 260 * pulse, pal["sun"], 0.55 * a)
        draw_planet(cv, bx, sy, sr * pulse, "sun")
        cv.text(bx + sr + 36, sy, self.src.upper(), 40, "xbold", A(pal["text"], a), anchor="lm")
        # wavefronts
        reach = p * (y_end - sy)
        for k in range(4):
            rr = reach - k * 95
            if rr > sr + 6:
                fade = 1 - k * 0.22
                cv.arc(bx, sy, rr, 40, 140, A(pal["sun"], 0.55 * fade * a), 6)
        # photon trail + head
        hy = lerp(y_start, y_end, p)
        for k in range(10):
            ty = hy - k * 20
            if ty > y_start:
                cv.circle(bx, ty, 9 - k * 0.7, fill=A((255, 244, 200), (0.9 - k * 0.09) * a))
        cv.glow(bx, hy, 80, (255, 240, 190), 0.9 * a)
        cv.circle(bx, hy, 12, fill=(255, 255, 255, 255))
        # earth
        arrive = ease_out(seg(p, 0.96, 1.0))
        cv.glow(bx, ey, 130 + 80 * arrive, (90, 170, 255), (0.35 + 0.55 * arrive) * a)
        draw_planet(cv, bx, ey, er, "earth")
        cv.text(bx + er + 36, ey, self.dst.upper(), 40, "xbold", A(pal["text"], a), anchor="lm")
        if arrive > 0:
            for k in range(2):
                q = clamp(arrive * 1.4 - k * 0.4)
                if 0 < q < 1:
                    cv.circle(bx, ey, er + q * 120, outline=A((140, 200, 255), (1 - q) * 0.9), width=5)
        # readouts
        px = bx + 250
        mid = (sy + ey) / 2 - 30
        cv.text(px, mid - 120, "LIGHT TRAVEL TIME", 28, "bold", A(pal["muted"], a), anchor="lm")
        cv.text(px, mid - 40, fmt_clock(self.total * p), 130, "black", A(pal["accent"], a), anchor="lm",
                shadow=(0, 6, (0, 0, 0, 90)))
        cv.text(px, mid + 62, "DISTANCE", 28, "bold", A(pal["muted"], a), anchor="lm")
        cv.text(px, mid + 140, fmt_num(self.dist_v * p, "", "", self.dist_dec), 78, "black", A(pal["text"], a), anchor="lm")
        cv.text(px, mid + 212, self.dist_u, 38, "bold", A(pal["muted"], a), anchor="lm")


class LightScale(Scene):
    """Pulse passes a column of bodies; each lights up with its light-travel time.
    args: Name@label  (e.g. Earth@8.3 min) ; opts: title, note"""

    def init(self):
        self.items = []
        for a in self.v.args:
            name, _, lab = a.partition("@")
            self.items.append((name.strip(), lab.strip()))
        if not self.items:
            raise ValueError("lightscale needs args like  Earth@8.3 min | Jupiter@43 min")
        self.title = self.opt("title", "Light travel time from the Sun")
        self.radius = {"earth": 30, "mars": 22, "jupiter": 64, "saturn": 54, "neptune": 38, "venus": 28, "mercury": 18,
                       "uranus": 40, "moon": 14}

    def draw(self, cv, t, dur):
        pal = self.pal
        a = clamp(seg(t, 0, 0.35))
        n = len(self.items)
        ax = self.x0 + 260
        top = self.y0 + 190
        bot = self.bottom - 40
        cv.text(self.x0 + 30, self.y0 + 44, self.title.upper(), 34, "xbold", A(pal["muted"], a), anchor="lm")
        # sun at the top
        cv.glow(ax, top - 40, 190, pal["sun"], 0.5 * a)
        draw_planet(cv, ax, top - 40, 70, "sun")
        cv.text(ax + 110, top - 40, "SUN", 40, "xbold", A(pal["text"], a), anchor="lm")
        ys = [lerp(top + 100, bot, i / max(1, n - 1)) for i in range(n)]
        cv.rect(ax - 2, top + 30, ax + 2, bot + 10, fill=A(pal["muted"], 0.3 * a))
        t_start, t_end = 0.5, 0.5 + dur * 0.78
        p = ease_in_out(seg(t, t_start, t_end))
        head = lerp(top + 30, ys[-1], p)
        # beam head
        for k in range(8):
            cv.circle(ax, head - k * 18, 10 - k, fill=A((255, 244, 200), (0.9 - k * 0.1) * a))
        cv.glow(ax, head, 90, (255, 240, 190), 0.8 * a)
        cv.circle(ax, head, 12, fill=(255, 255, 255, 255))
        for i, (name, lab) in enumerate(self.items):
            y = ys[i]
            lit = ease_out(seg(head, y - 40, y + 5))
            r = self.radius.get(name.lower(), 30)
            kind = name.lower()
            cv.glow(ax, y, r * 3 + 40, mix(pal["accent"], (255, 255, 255), 0.2), 0.7 * lit)
            draw_planet(cv, ax, y, r, kind, alpha=0.35 + 0.65 * lit)
            if lit > 0:
                cv.circle(ax, y, r + 14 + 50 * (1 - lit), outline=A(pal["accent"], (1 - lit) * 0.8), width=4)
            col_a = clamp(lit * 1.5)
            cv.text(ax - r - 36, y, name.upper(), 36, "xbold", A(pal["text"], 0.35 + 0.65 * col_a), anchor="rm")
            tx = ax + max(r, 40) + 50
            cv.text(tx, y, lab, 66 if text_w(lab, 66, "black") < 420 else 52, "black", A(pal["accent"], col_a), anchor="lm")


class Orbit(Scene):
    """Top-down solar system.  opts: vanish=1 (the Sun winks out; its last light keeps travelling)"""

    PLANETS = [("mercury", 100, 13, 2.6), ("venus", 175, 21, 1.9), ("earth", 255, 24, 1.45),
               ("mars", 335, 17, 1.05), ("jupiter", 425, 40, 0.62)]

    def init(self):
        self.vanish = self.opt("vanish") is not None
        self.angles = [self.rng.uniform(0, 6.28) for _ in self.PLANETS]
        self.label = self.opt("label", "")

    def draw(self, cv, t, dur):
        pal = self.pal
        a = clamp(seg(t, 0, 0.4))
        cx, cy = self.cx, self.cy + 10
        t_v = dur * 0.38
        sun_on = 1.0
        if self.vanish:
            sun_on = 1 - ease_in_out(seg(t, t_v, t_v + 0.35))
        glow_r = 250 + 10 * math.sin(t * 3)
        cv.glow(cx, cy, glow_r, pal["sun"], 0.55 * sun_on * a)
        for name, R, r, w in self.PLANETS:
            cv.circle(cx, cy, R, outline=A(pal["muted"], 0.24 * a), width=2)
        # last light ring
        if self.vanish and t > t_v:
            reach = (t - t_v) / max(0.1, (dur - t_v) * 0.95)
            rr = 40 + clamp(reach) * (255 - 40)
            cv.circle(cx, cy, rr, outline=A((255, 240, 190), 0.8 * (1 - 0.3 * clamp(reach))), width=6)
        for (name, R, r, w), a0 in zip(self.PLANETS, self.angles):
            ang = a0 + w * t * 0.9
            px, py = cx + R * math.cos(ang), cy + R * math.sin(ang)
            for k in range(1, 9):  # motion trail
                tg = ang - k * 0.045 * w
                cv.circle(cx + R * math.cos(tg), cy + R * math.sin(tg), max(1.5, r * 0.28 * (1 - k / 10)),
                          fill=A(pal["accent"], 0.35 * (1 - k / 9) * a))
            lit = 1.0
            if name == "earth":
                cv.circle(px, py, r + 10, outline=A(pal["accent"], 0.9 * a), width=3)
            draw_planet(cv, px, py, r, name, alpha=a)
            if name == "earth":
                cv.text(px, py + r + 38, "EARTH", 30, "xbold", A(pal["text"], a), anchor="mm", shadow=(0, 3, (0, 0, 0, 160)))
        draw_planet(cv, cx, cy, 52, "sun", alpha=max(0.0, sun_on * a))
        if self.vanish and t > t_v + 0.5:
            q = ease_out(seg(t, t_v + 0.5, t_v + 1.1))
            cv.text(cx, self.y0 + 70, self.label or "THE SUN JUST VANISHED...", 44, "black", A(pal["accent2"], q), anchor="mm")
            cv.text(cx, self.y0 + 126, "...and Earth keeps shining for 8 more minutes", 30, "bold", A(pal["muted"], q), anchor="mm")


class Sizes(Scene):
    """Sun vs Earth: a row of Earths across the Sun's diameter.  opts: count=109"""

    def init(self):
        self.count = int(num(self.opt("count", 109)))

    def draw(self, cv, t, dur):
        pal = self.pal
        a = clamp(seg(t, 0, 0.4))
        R = min(self.w / 2 - 20, (self.h - 430) / 2)
        cx, cy = self.cx, self.y0 + R + 30
        cv.glow(cx, cy, R * 1.5, pal["sun"], 0.4 * a)
        draw_planet(cv, cx, cy, R * ease_out_back(seg(t, 0, 0.7)), "sun")
        p = ease_in_out(seg(t, 0.5, 0.5 + dur * 0.65))
        n = int(self.count * p)
        d = 2 * R / self.count
        cv.rrect(cx - R, cy - d * 0.9, cx - R + 2 * R * p, cy + d * 0.9, d * 0.9, fill=(10, 20, 60, 150))
        for i in range(n):
            x = cx - R + d * (i + 0.5)
            cv.circle(x, cy, d * 0.47, fill=(70, 150, 255, 255), outline=(255, 255, 255, 255), width=0.9)
        # counter
        ty = cy + R + 95
        cv.text(self.cx, ty, f"{n}", 170, "black", A(pal["accent"], a), anchor="mm", shadow=(0, 8, (0, 0, 0, 90)))
        cv.text(self.cx, ty + 108, "Earths side by side", 44, "bold", A(pal["text"], a), anchor="mm")
        cv.text(self.cx, ty + 158, "fit across the Sun's width", 34, "medium", A(pal["muted"], a), anchor="mm")
