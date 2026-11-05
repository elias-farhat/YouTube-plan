"""Scenes available to every channel: kinetic text and big-number stat cards."""
from __future__ import annotations

import math

from ..canvas import (A, bounce, clamp, ease_in_out, ease_out, ease_out_back, ease_out_expo, fit_size,
                      fmt_num, lerp, mix, seg, text_w, wrap)
from .base import Scene, decimals_of, num, parse_markup

FONT_BY_CHANNEL = {"money": "black", "space": "xbold", "history": "serif"}


class Kinetic(Scene):
    """Big words slamming in, one row per `|` part.  `*word*` = highlighted."""

    def init(self):
        self.rows = [parse_markup(a) for a in self.v.args] or [parse_markup(self.opt("text", ""))]
        self.font = FONT_BY_CHANNEL[self.st.channel]
        self.pill = bool((self.st.seed >> 3) & 1) and self.st.channel != "history"
        maxw = self.w - 90
        self.sizes = []
        for row in self.rows:
            txt = self._join(row)
            has_emph = any(e for _, e, _g in row)
            base = 168 if has_emph else 128
            if self.st.channel == "history":
                base = int(base * 0.82)
            self.sizes.append(fit_size(txt, maxw, base, self.font, 54))

    @staticmethod
    def _join(row):
        return "".join((" " if i and not g else "") + w for i, (w, _e, g) in enumerate(row))

    def _row_width(self, row, size):
        sp = text_w(" ", size, self.font)
        return sum(text_w(w, size, self.font) for w, _e, _g in row) + sp * sum(1 for i, (_w, _e, g) in enumerate(row) if i and not g), sp

    def draw(self, cv, t, dur):
        pal, n = self.pal, len(self.rows)
        gaps = [s * 1.12 for s in self.sizes]
        total_h = sum(gaps)
        y = self.cy - total_h / 2 - 20
        step = min(0.6, max(0.25, dur * 0.5 / max(1, n)))
        # soft backdrop glow
        cv.glow(self.cx, self.cy, 520, pal["accent"], 0.20 + 0.04 * math.sin(t * 2))
        for i, (row, size) in enumerate(zip(self.rows, self.sizes)):
            t0 = 0.12 + i * step
            p = seg(t, t0, t0 + 0.5)
            rw, sp = self._row_width(row, size)
            ry = y + gaps[i] / 2
            y += gaps[i]
            if p <= 0:
                continue
            mode = self.st.kinetic
            x = self.cx - rw / 2
            sc, alpha, dx, dy = 1.0, clamp(p * 2.2), 0.0, 0.0
            if mode == "pop":
                sc = 0.45 + 0.55 * ease_out_back(p)
            elif mode == "slide":
                dx = (1 if i % 2 == 0 else -1) * (1 - ease_out_expo(p)) * 760
            elif mode == "drop":
                dy = -(1 - bounce(p)) * 360
            # 'stack' -> per-word pop below
            cur = x
            for k, (w, emph, glue) in enumerate(row):
                if glue:
                    cur -= sp
                wsz = size
                wp = p
                if mode == "stack":
                    wp = seg(t, t0 + k * 0.10, t0 + k * 0.10 + 0.35)
                    sc_w = 0.4 + 0.6 * ease_out_back(wp)
                    a_w = clamp(wp * 2.5)
                else:
                    sc_w, a_w = sc, alpha
                if a_w <= 0:
                    cur += text_w(w, size, self.font) + sp
                    continue
                ww = text_w(w, size, self.font)
                fs = max(8, wsz * sc_w)
                cxw = cur + ww / 2 + dx
                col = A(pal["hl"] if emph else pal["text"], a_w)
                if emph and self.pill:
                    pad = size * 0.16
                    cv.rrect(cxw - ww * sc_w / 2 - pad, ry + dy - size * 0.58 * sc_w, cxw + ww * sc_w / 2 + pad,
                             ry + dy + size * 0.58 * sc_w, size * 0.2, fill=A(pal["hl"], a_w))
                    col = A(pal["on_hl"], a_w)
                shadow = None
                if not pal["light"]:
                    shadow = (0, 6, (0, 0, 0, int(90 * a_w)))
                cv.text(cxw, ry + dy, w, fs, self.font, col, anchor="mm", shadow=shadow)
                cur += ww + sp
        # accent rule under the block
        u = ease_out_expo(seg(t, 0.35, 1.0))
        rule_w = 220 * u
        cv.rrect(self.cx - rule_w / 2, y + 36, self.cx + rule_w / 2, y + 48, 6, fill=A(pal["accent2"], 0.95))


class Stat(Scene):
    """Big number / short phrase with label and sub-line.
    opts: label, value | (from, to), prefix, suffix, decimals, sub, trend=up|down"""

    def init(self):
        o = self.opt
        self.label = o("label", "")
        self.sub = o("sub", "")
        self.prefix, self.suffix = o("prefix", ""), o("suffix", "")
        if self.suffix[:1].isalpha():
            self.suffix = " " + self.suffix
        self.trend = o("trend")
        self.counting = o("from") is not None and o("to") is not None
        if self.counting:
            self.a, self.b = num(o("from")), num(o("to"))
            self.dec = int(o("decimals", max(decimals_of(o("from")), decimals_of(o("to")))))
        else:
            self.value = o("value", "") or (self.v.args[0] if self.v.args else "")
        self.font = FONT_BY_CHANNEL[self.st.channel]

    def _value_text(self, t, dur):
        if self.counting:
            p = ease_out(seg(t, 0.25, min(2.4, 0.25 + dur * 0.7)))
            return fmt_num(lerp(self.a, self.b, p), self.prefix, self.suffix, self.dec)
        return self.value

    def draw(self, cv, t, dur):
        pal, ch = self.pal, self.st.channel
        enter = ease_out_back(seg(t, 0.0, 0.55))
        a = clamp(seg(t, 0.0, 0.3))
        vt_full = self._value_text(t, dur)
        # use the widest string (end value) for sizing so the number doesn't jitter while counting
        vt_ref = fmt_num(max(abs(self.a), abs(self.b)) * (1 if True else 0), self.prefix, self.suffix, self.dec) if self.counting else vt_full
        size = fit_size(vt_ref, self.w - 140, 290, self.font, 70)
        lab_lines = wrap(self.label.upper(), 40, "xbold", self.w - 150)[:2] if self.label else []
        sub_lines = wrap(self.sub, 40, "bold", self.w - 190)[:3] if self.sub else []
        arrow_h = 120 if self.trend in ("up", "down") else 0
        h_lab = 52 * len(lab_lines) + (36 if lab_lines else 0)
        h_val = size * 1.05
        h_sub = 52 * len(sub_lines) + (30 if sub_lines else 0)
        total = h_lab + h_val + arrow_h + h_sub
        top = self.cy - total / 2 - 10
        y_lab = top
        y_val = top + h_lab + h_val / 2
        y_arrow = top + h_lab + h_val + 10
        y_sub = top + h_lab + h_val + arrow_h + 30

        # ---- channel-specific decoration ----
        if ch == "money":
            cv.rrect(self.x0 + 20, top - 70, self.x1 - 20, top + total + 60, 44, fill=A(pal["panel"], 0.92 * a))
            cv.rrect(self.x0 + 20, top - 70, self.x1 - 20, top - 56, 7, fill=A(pal["accent"], a))
        elif ch == "space":
            R0 = max(total / 2 + 60, 280)
            for k in range(3):
                r = R0 + k * 70
                rot = t * (30 + 12 * k) * (1 if k % 2 == 0 else -1)
                for j in range(0, 360, 12):
                    cv.arc(self.cx, top + total / 2, r * enter, rot + j, rot + j + 6, A(pal["accent"], 0.22 * a), 3)
            cv.glow(self.cx, top + total / 2, 380, pal["glow"], 0.55)
        else:  # history ornament
            for yy, d in ((top - 60, 1), (top + total + 40, -1)):
                w = (self.w - 120) * ease_out_expo(seg(t, 0.0, 0.7)) / 2
                cv.rect(self.cx - w, yy, self.cx + w, yy + 4, fill=A(pal["accent2"], a))
                cv.rect(self.cx - w, yy + d * 14, self.cx + w, yy + d * 14 + 2, fill=A(pal["accent2"], 0.6 * a))
                cv.poly([(self.cx, yy - 14), (self.cx + 14, yy + 2), (self.cx, yy + 18), (self.cx - 14, yy + 2)],
                        fill=A(pal["accent"] if not pal["light"] and False else pal["hl"], a))

        for i, ln in enumerate(lab_lines):
            cv.text(self.cx, y_lab + 26 + i * 52, ln, 40, "xbold", A(pal["muted"], a), anchor="mm")

        col = pal["hl"]
        if self.trend == "down":
            col = pal["bad"]
        elif self.trend == "up":
            col = pal["good"]
        shadow = (0, 8, (0, 0, 0, int(100 * a))) if not pal["light"] else None
        cv.text(self.cx, y_val, vt_full, size * (0.8 + 0.2 * enter), self.font, A(col, a), anchor="mm", shadow=shadow)

        if self.trend in ("up", "down"):
            ax, ay = self.cx, y_arrow + arrow_h / 2 - 8
            s_ = 1 if self.trend == "up" else -1
            p = ease_out_back(seg(t, 0.4, 0.9))
            pts = [(ax, ay - s_ * 34 * p), (ax + 44 * p, ay + s_ * 12 * p), (ax + 16 * p, ay + s_ * 12 * p),
                   (ax + 16 * p, ay + s_ * 38 * p), (ax - 16 * p, ay + s_ * 38 * p), (ax - 16 * p, ay + s_ * 12 * p),
                   (ax - 44 * p, ay + s_ * 12 * p)]
            cv.poly(pts, fill=A(col, a))

        for i, ln in enumerate(sub_lines):
            cv.text(self.cx, y_sub + 26 + i * 52, ln, 40, "bold", A(pal["text"], clamp(seg(t, 0.35, 0.8)) * 0.92), anchor="mm")
