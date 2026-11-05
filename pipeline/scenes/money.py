"""Money channel scenes: animated line + bar charts (plus shared kinetic/stat)."""
from __future__ import annotations

import math

from ..canvas import (A, clamp, ease_in_out, ease_out, ease_out_back, fmt_num, lerp, mix, seg, text_w, wrap)
from .base import Scene, decimals_of, nums


def nice_ticks(lo, hi, n=4):
    span = max(hi - lo, 1e-9)
    raw = span / n
    mag = 10 ** math.floor(math.log10(raw))
    for m in (1, 2, 2.5, 5, 10):
        if raw <= m * mag:
            step = m * mag
            break
    start = math.floor(lo / step) * step
    end = math.ceil(hi / step) * step
    ticks, v = [], start
    while v <= end + step * 0.01:
        ticks.append(v)
        v += step
    return ticks


def short(v, prefix="", suffix="", scale=1):
    """Axis label; `scale` (1, 1e3, 1e6, 1e9) is chosen once per chart so every tick uses the same unit."""
    unit = {1: "", 1e3: "K", 1e6: "M", 1e9: "B"}[scale]
    x = v / scale
    s = f"{x:,.0f}" if abs(x - round(x)) < 1e-9 else f"{x:,.1f}"
    return prefix + s + unit + suffix


class LineChart(Scene):
    """opts: title, x=a,b,c (evenly spaced tick labels), y=1,2,3 ..., prefix, suffix,
    color=accent|bad|good, delta=-45% (badge at the end), ymin"""

    def init(self):
        o = self.opt
        self.title = o("title", "")
        self.ys = nums(o("y", ""))
        self.xl = [s.strip() for s in o("x", "").split(",") if s.strip()]
        self.prefix, self.suffix = o("prefix", ""), o("suffix", "")
        self.color = self.pal.get(o("color", "accent"), self.pal["accent"])
        self.delta = o("delta")
        if len(self.ys) < 2:
            raise ValueError("line chart needs y=... with at least two values")
        lo, hi = min(self.ys), max(self.ys)
        if o("ymin") is not None:
            lo = float(o("ymin"))
        self.ticks = nice_ticks(min(lo, 0) if lo > 0 and lo < hi * 0.5 else lo, hi, 4)
        top = max(abs(self.ticks[0]), abs(self.ticks[-1]))
        self.scale = 1e9 if top >= 1e9 else 1e6 if top >= 1e6 else 1e3 if top >= 1e4 else 1

    def draw(self, cv, t, dur):
        pal = self.pal
        L, R = self.x0 + 150, self.x1 - 50
        T, B = self.y0 + (170 if self.title else 80), self.bottom - 60
        a = clamp(seg(t, 0, 0.3))
        if self.title:
            for i, ln in enumerate(wrap(self.title, 42, "bold", self.w - 80)[:2]):
                cv.text(self.x0 + 30, self.y0 + 40 + i * 52, ln, 42, "bold", A(pal["text"], a), anchor="lm")
        lo, hi = self.ticks[0], self.ticks[-1]
        Y = lambda v: B - (v - lo) / (hi - lo) * (B - T)
        n = len(self.ys)
        X = lambda i: L + i / (n - 1) * (R - L)
        # grid
        for tv in self.ticks:
            y = Y(tv)
            cv.rect(L, y - 1, R, y + 1, fill=A(pal["muted"], 0.22 * a))
            cv.text(L - 18, y, short(tv, self.prefix, self.suffix, self.scale), 30, "medium", A(pal["muted"], a), anchor="rm")
        if self.xl:
            m = len(self.xl)
            for j, lab in enumerate(self.xl):
                x = L + (j / (m - 1) if m > 1 else 0) * (R - L)
                cv.text(x, B + 40, lab, 30, "medium", A(pal["muted"], a), anchor="mm")
        # progress
        u = ease_in_out(seg(t, 0.3, 0.3 + dur * 0.72))
        f = u * (n - 1)
        k = int(f)
        pts = [(X(i), Y(self.ys[i])) for i in range(k + 1)]
        if k < n - 1:
            fr = f - k
            pts.append((lerp(X(k), X(k + 1), fr), lerp(Y(self.ys[k]), Y(self.ys[k + 1]), fr)))
        if len(pts) >= 2:
            cv.poly(pts + [(pts[-1][0], B), (pts[0][0], B)], fill=A(self.color, 0.16))
            cv.line(pts, A(self.color, 1), 10)
        hx, hy = pts[-1]
        cv.glow(hx, hy, 70, self.color, 0.55)
        cv.circle(hx, hy, 17, fill=A(pal["text"], 1), outline=A(self.color, 1), width=7)
        # value bubble
        val = lerp(self.ys[k], self.ys[min(k + 1, n - 1)], f - k) if k < n - 1 else self.ys[-1]
        vt = fmt_num(val, self.prefix, self.suffix, max(decimals_of(self.opt("y", "").split(",")[0]), 0))
        tw = text_w(vt, 44, "xbold") + 44
        bx = min(max(hx, L + tw / 2), R - tw / 2)
        by = hy - 74 if hy - 74 > T - 30 else hy + 74
        cv.rrect(bx - tw / 2, by - 36, bx + tw / 2, by + 36, 22, fill=A(self.color, 1))
        cv.text(bx, by, vt, 44, "xbold", A(pal["on_accent"] if sum(self.color) > 380 else (255, 255, 255)), anchor="mm")
        # delta badge at the end
        if self.delta and u > 0.97:
            p = ease_out_back(seg(t, 0.3 + dur * 0.72, 0.3 + dur * 0.72 + 0.4))
            bw = text_w(self.delta, 56, "black") + 64
            cx, cy = (L + R) / 2 + 50, (T + B) / 2 - 40
            cv.rrect(cx - bw / 2 * p, cy - 52 * p, cx + bw / 2 * p, cy + 52 * p, 30 * p, fill=A(pal["bad"], 0.95))
            if p > 0.5:
                cv.text(cx, cy, self.delta, 56 * p, "black", (255, 255, 255, 255), anchor="mm")


class BarChart(Scene):
    """opts: title, x=labels, y=values, prefix, suffix, highlight=i,j  bad=i,j  orient=v|h"""

    def init(self):
        o = self.opt
        self.title = o("title", "")
        self.labels = [s.strip() for s in o("x", "").split(",")]
        self.vals = nums(o("y", ""))
        if len(self.vals) < 1 or len(self.labels) != len(self.vals):
            raise ValueError("bar chart needs x=... and y=... with the same number of items")
        self.prefix, self.suffix = o("prefix", ""), o("suffix", "")
        self.dec = max(decimals_of(s.strip()) for s in o("y").split(","))
        self.hi = set(int(i) for i in o("highlight", "").split(",") if i.strip())
        self.bad = set(int(i) for i in o("bad", "").split(",") if i.strip())
        self.orient = o("orient", self.st.orient)

    def _color(self, i):
        if i in self.bad:
            return self.pal["bad"]
        if i in self.hi:
            return self.pal["accent2"]
        return self.pal["accent"]

    def draw(self, cv, t, dur):
        pal = self.pal
        a = clamp(seg(t, 0, 0.3))
        n = len(self.vals)
        vmax = max(self.vals) * 1.08
        top = self.y0 + 40
        if self.title:
            for i, ln in enumerate(wrap(self.title, 42, "bold", self.w - 80)[:2]):
                cv.text(self.x0 + 30, self.y0 + 40 + i * 52, ln, 42, "bold", A(pal["text"], a), anchor="lm")
            top = self.y0 + 150
        stag = min(0.28, (dur * 0.5) / max(n, 1))
        if self.orient == "v":
            base = self.bottom - 110
            area_l, area_r = self.x0 + 40, self.x1 - 40
            slot = (area_r - area_l) / n
            bw = min(190, slot * 0.66)
            cv.rect(area_l, base, area_r, base + 4, fill=A(pal["muted"], 0.5 * a))
            for i, v in enumerate(self.vals):
                p = ease_out(seg(t, 0.25 + i * stag, 0.25 + i * stag + 0.8))
                cx = area_l + slot * (i + 0.5)
                hh = (base - top - 70) * v / vmax * p
                col = self._color(i)
                if hh > 2:
                    cv.rrect(cx - bw / 2, base - hh, cx + bw / 2, base, 18, fill=A(col, 1))
                    cv.rrect(cx - bw / 2, base - hh, cx - bw / 2 + bw * 0.28, base, 18, fill=A((255, 255, 255), 0.13))
                lab = fmt_num(v * p, self.prefix, self.suffix, self.dec)
                size = 46 if text_w(lab, 46, "xbold") < slot - 8 else 36
                cv.text(cx, base - hh - 34, lab, size, "xbold", A(pal["text"], clamp(p * 3)), anchor="mm")
                for j, ln in enumerate(wrap(self.labels[i], 32, "bold", slot - 10)[:2]):
                    cv.text(cx, base + 44 + j * 38, ln, 32, "bold", A(pal["muted"], a), anchor="mm")
        else:
            rows_h = (self.bottom - top - 10) / n
            thick = min(150 if n <= 3 else 86, rows_h * 0.5)
            L = self.x0 + 40
            maxw = self.w - 80
            for i, v in enumerate(self.vals):
                p = ease_out(seg(t, 0.25 + i * stag, 0.25 + i * stag + 0.8))
                ry = top + rows_h * i + rows_h * 0.5
                cv.text(L, ry - thick / 2 - 26, self.labels[i], 34, "bold", A(pal["muted"], a), anchor="lm")
                w = max(4, (maxw - 10) * v / vmax * p)
                col = self._color(i)
                cv.rrect(L, ry - thick / 2 + 4, L + w, ry + thick / 2 + 4, 20, fill=A(col, 1))
                cv.rrect(L, ry - thick / 2 + 4, L + w, ry - thick / 2 + 4 + thick * 0.3, 20, fill=A((255, 255, 255), 0.13))
                lab = fmt_num(v * p, self.prefix, self.suffix, self.dec)
                tw = text_w(lab, 48, "black")
                if w > tw + 50:
                    cv.text(L + w - 22, ry + 4, lab, 48, "black", A(pal["on_accent"], clamp(p * 3)), anchor="rm")
                else:
                    cv.text(L + w + 20, ry + 4, lab, 48, "black", A(pal["text"], clamp(p * 3)), anchor="lm")
