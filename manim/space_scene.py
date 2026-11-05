"""Space channel: 2D motion graphics in Manim (planets, scale comparisons, counters, light pulses).

Rendered by tools/render.mjs:  SHORTS_PLAN=build/<video>/plan.json manim render ... manim/space_scene.py SpaceShort
The plan (same JSON Remotion reads) carries the palette, layout (stage rectangle), pacing and every scene's
start/end time.  Captions, header and voice are added afterwards by the Remotion overlay, so this scene only
draws the visuals and leaves the caption zone empty.
No LaTeX needed: all text is Pango `Text`.
"""
import json
import math
import os
import random
import sys

import numpy as np
from manim import *  # noqa: F401,F403
from manim.utils.rate_functions import ease_in_out_sine, ease_out_back, ease_out_bounce, ease_out_cubic, linear, rush_from, smooth  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from planets import planet_sprite  # noqa: E402

config.frame_height = 16
config.frame_width = 9
PX = 120.0  # px per manim unit (1080px / 9 units)
FONT = "Inter"


def hexc(s):
    return ManimColor(s)


def rgbv(h):
    h = h.lstrip('#')
    return [int(h[i:i + 2], 16) for i in (0, 2, 4)]


def px_to_units(x, y):
    return (x - 540) / PX, (960 - y) / PX


def parse_markup(line):
    """'The *Sun* is old.' -> [(word, emphasised)]"""
    out, emph = [], False
    for part in line.split("*"):
        for w in part.split():
            out.append((w, emph))
        emph = not emph
    return out


def planet(kind, diameter, hi_res=220):
    img = planet_sprite(kind, hi_res)
    m = ImageMobject(np.array(img))
    m.height = diameter
    return m


def fmt_clock(sec):
    sec = int(round(sec))
    return f"{sec // 3600}:{(sec % 3600) // 60:02d}:{sec % 60:02d}" if sec >= 3600 else f"{sec // 60}:{sec % 60:02d}"


def parse_duration(s):
    s = str(s).strip().lower()
    if ":" in s:
        p = [int(x) for x in s.split(":")]
        return p[0] * 60 + p[1] if len(p) == 2 else p[0] * 3600 + p[1] * 60 + p[2]
    n, _, u = s.partition(" ")
    mult = {"s": 1, "sec": 1, "second": 1, "seconds": 1, "min": 60, "minute": 60, "minutes": 60, "h": 3600, "hour": 3600, "hours": 3600}
    return float(n.replace(",", "")) * mult.get(u.strip(), 1)


class SpaceShort(Scene):
    def construct(self):
        plan = json.load(open(os.environ["SHORTS_PLAN"]))
        self.plan = plan
        st = plan["style"]
        self.st, self.pal = st, st["palette"]
        self.fps = plan["fps"]
        self.td = st["pace"]["trans"] / self.fps
        s = st["stage"]
        self.sw, self.sh = s["w"] / PX, s["h"] / PX
        self.cx, self.cy = px_to_units(s["x"] + s["w"] / 2, s["y"] + s["h"] / 2)
        self.rng = random.Random(st["seed"])
        self.build_background()

        prev = None
        for seg in plan["segs"]:
            start, end = seg["startFrame"] / self.fps, seg["endFrame"] / self.fps
            self.sync(start)
            if prev is not None:
                self.exit(prev)
            group = self.build_scene(seg, end)
            self.sync(end)
            prev = group
        self.sync(plan["totalFrames"] / self.fps)

    # ---------------------------------------------------------------- timing
    def sync(self, t):
        rem = t - self.time
        if rem > 1.5 / self.fps:
            self.wait(rem)

    def exit(self, group):
        """transition out (kind follows the video's transition style)"""
        k = self.st["transition"]
        d = max(self.td, 1.5 / self.fps)
        if k in ("slide", "push"):
            self.play(group.animate.shift(UP * 1.2 if k == "slide" else LEFT * 9).set_opacity(0), run_time=d, rate_func=smooth)
        elif k == "zoom":
            self.play(group.animate.scale(0.9).set_opacity(0), run_time=d)
        else:
            self.play(FadeOut(group), run_time=d)
        self.remove(group)

    # ------------------------------------------------------------ background
    def build_background(self):
        p, st = self.pal, self.st
        h, w = 640, 360
        y = np.linspace(0, 1, h)[:, None, None]
        top, bot = np.array(rgbv(p["bgTop"])), np.array(rgbv(p["bgBot"]))
        arr = top + (bot - top) * y
        yy, xx = np.mgrid[0:h, 0:w]
        for (gx, gy, r, col, s) in ((0.8, 0.14, 0.7, p["glow"], 0.45), (0.1, 0.85, 0.75, p.get("glow2", p["glow"]), 0.30 if st["motif"] == "nebula" else 0.16)):
            d = np.hypot((xx / w - gx) * 9, (yy / h - gy) * 16) / (r * 9)
            a = np.clip(1 - d, 0, 1) ** 2 * s
            arr = arr + (np.array(rgbv(col)) - arr) * a[..., None]
        bg = ImageMobject(np.clip(arr, 0, 255).astype(np.uint8))
        bg.set_resampling_algorithm(RESAMPLING_ALGORITHMS["bilinear"])
        bg.height = 16
        bg.width = max(bg.width, 9)
        bg.move_to(ORIGIN)
        self.add(bg)
        # parallax star field that drifts downward all video long
        r = self.rng
        stars = VGroup()
        speed = {"stars": 0.10, "nebula": 0.07, "streak": 0.35}.get(st["motif"], 0.1)
        for _ in range(150):
            x, yv = r.uniform(-4.6, 4.6), r.uniform(-8.5, 8 + 0.35 * 45 + 2)
            if st["motif"] == "streak" and r.random() < 0.3:
                m = Line([x, yv, 0], [x, yv + r.uniform(0.2, 0.7), 0], stroke_width=r.choice([1.5, 2.5]), stroke_opacity=r.uniform(0.25, 0.6), color=WHITE)
            else:
                m = Dot([x, yv, 0], radius=r.choice([0.012, 0.018, 0.025, 0.035]), color=hexc(p["accent"]) if r.random() < 0.15 else WHITE)
                m.set_opacity(r.uniform(0.3, 0.95))
            stars.add(m)
        stars.add_updater(lambda m, dt: m.shift(DOWN * dt * speed * 4))
        self.add(stars)

    # --------------------------------------------------------------- helpers
    def T(self, s, size, color=None, weight=BOLD, **kw):
        return Text(s, font=FONT, weight=weight, font_size=size, color=hexc(color or self.pal["text"]), **kw)

    def fit(self, m, max_w, max_h=None):
        if m.width > max_w:
            m.scale_to_fit_width(max_w)
        if max_h and m.height > max_h:
            m.scale_to_fit_height(max_h)
        return m

    def glow(self, center, r, color, n=0, op=0.07):
        """Smooth radial glow (alpha gradient image) reaching radius ~r*1.5."""
        D = 256
        ax = np.linspace(-1, 1, D)
        d = np.hypot(ax[None, :], ax[:, None])
        a = np.clip(1 - d, 0, 1) ** 2 * min(1.0, op * 7)
        arr = np.zeros((D, D, 4), np.uint8)
        arr[..., :3] = rgbv(color)
        arr[..., 3] = (a * 255).astype(np.uint8)
        m = ImageMobject(arr)
        m.height = r * 3.0
        m.move_to(center)
        return m

    def tl(self):
        return np.array([self.cx - self.sw / 2, self.cy + self.sh / 2, 0])

    # -------------------------------------------------------------- dispatch
    def build_scene(self, seg, end):
        if seg["isHook"]:
            words = (seg.get("shown") or seg["say"]).split()
            nrows = min(3, max(1, round(len(words) / 2.4)))
            per = math.ceil(len(words) / nrows)
            rows = [" ".join(words[i:i + per]) for i in range(0, len(words), per)]
            rows[-1] = f"*{rows[-1]}*"
            return self.kinetic({"text": rows}, end, big=True)
        v = seg.get("visual") or {"type": "kinetic", "text": self.auto_rows(seg.get("shown") or seg["say"])}
        fn = getattr(self, "scene_" + v["type"], None)
        if fn is None:
            raise ValueError(f"unknown space visual {v['type']}")
        return fn(v, end)

    @staticmethod
    def auto_rows(shown):
        w = shown.split()
        per = max(1, round(len(w) / 3))
        return [" ".join(w[i:i + per]) for i in range(0, len(w), per)][:4]

    def scene_kinetic(self, v, end):
        return self.kinetic(v, end)

    # --------------------------------------------------------------- kinetic
    def kinetic(self, v, end, big=False):
        p, mode = self.pal, self.st["kinetic"]
        rows_src = v["text"] if isinstance(v["text"], list) else [v["text"]]
        rows, anims = VGroup(), []
        for i, line in enumerate(rows_src):
            toks = parse_markup(line)
            txt, spans = "", []
            for w, e in toks:
                txt += (" " if txt else "")
                a0 = len(txt)
                txt += w
                if e:
                    spans.append((a0, len(txt)))
            t2c = {f"[{a0}:{b0}]": hexc(p["accent"]) for a0, b0 in spans}
            words = Text(txt, font=FONT, weight=HEAVY if spans else BOLD, font_size=96 if big else 80, color=hexc(p["text"]), t2c=t2c)
            self.fit(words, self.sw - 0.7)
            if spans and not big and words.width < self.sw - 1.2:
                words.scale(min(1.25, (self.sw - 0.7) / words.width))
            rows.add(words)
        rows.arrange(DOWN, buff=0.3).move_to([self.cx, self.cy, 0])
        glow = self.glow(rows.get_center(), 2.6, p["accent"], op=0.05)
        rule = Line(LEFT * 1.0, RIGHT * 1.0, stroke_width=9, color=hexc(p["accent2"])).next_to(rows, DOWN, buff=0.45)
        self.add(glow)
        dur = max(0.4, min(0.55, (end - self.time) * 0.35))
        step = 0.5
        for i, row in enumerate(rows):
            if mode == "slide":
                a = FadeIn(row, shift=(RIGHT if i % 2 else LEFT) * 5, rate_func=rush_from)
            elif mode == "drop":
                a = FadeIn(row, shift=DOWN * 3, rate_func=ease_out_bounce)
            elif mode == "stack":
                a = LaggedStart(*[FadeIn(w, scale=0.4) for w in row], lag_ratio=0.12)
            else:
                a = FadeIn(row, scale=0.45, rate_func=ease_out_back)
            anims.append(a)
        self.play(LaggedStart(*anims, lag_ratio=0.45), run_time=min(0.5 * len(rows_src) + 0.5, max(0.6, (end - self.time) * 0.6)))
        self.play(Create(rule), run_time=0.3)
        return Group(glow, rows, rule)

    # --------------------------------------------------------------- counter
    def scene_counter(self, v, end):
        p = self.pal
        frm, to = float(v.get("from", 0)), float(v["to"])
        dec = int(v.get("decimals", 0))
        pre, suf = v.get("prefix", ""), v.get("suffix", "")
        if suf[:1].isalpha():
            suf = " " + suf
        tr = ValueTracker(frm)
        fmt = lambda x: f"{pre}{x:,.{dec}f}{suf}"
        maxw = self.sw - 1.0
        full = self.T(fmt(max(abs(frm), abs(to))), 110, weight=HEAVY)
        scale = min(1.0, maxw / full.width)
        num = always_redraw(lambda: self.T(fmt(tr.get_value()), 110 * scale, p["accent"], weight=HEAVY).move_to([self.cx, self.cy, 0]))
        rings = VGroup(*[DashedVMobject(Circle(radius=2.3 + 0.55 * k, stroke_width=3, color=hexc(p["accent"]), stroke_opacity=0.35), num_dashes=40 + 8 * k) for k in range(3)]).move_to([self.cx, self.cy, 0])
        for k, r_ in enumerate(rings):
            r_.add_updater(lambda m, dt, k=k: m.rotate(dt * (0.25 + 0.1 * k) * (-1 if k % 2 else 1)))
        glow = self.glow([self.cx, self.cy, 0], 2.7, p["glow"], op=0.12)
        label = self.fit(self.T(v.get("label", "").upper(), 40, p["muted"], weight=BOLD), self.sw - 0.8).move_to([self.cx, self.cy + 1.6, 0]) if v.get("label") else VGroup()
        subs = VGroup()
        if v.get("sub"):
            sub = Paragraph(*self.wrap(v["sub"], 26), font=FONT, font_size=36, color=hexc(p["text"]), alignment="center", line_spacing=0.7)
            sub.move_to([self.cx, self.cy - 1.7, 0])
            subs.add(sub)
        self.add(glow, rings)
        self.play(FadeIn(label, shift=DOWN * 0.3), FadeIn(subs, shift=UP * 0.3), run_time=0.4)
        self.add(num)
        self.play(tr.animate.set_value(to), run_time=max(0.8, min(2.4, (end - self.time) * 0.7)), rate_func=ease_out_cubic)
        return Group(glow, rings, label, subs, num)

    @staticmethod
    def wrap(s, n):
        words, lines, cur = s.split(), [], ""
        for w in words:
            if len(cur) + len(w) + 1 > n and cur:
                lines.append(cur)
                cur = w
            else:
                cur = (cur + " " + w).strip()
        return lines + [cur] if cur else lines

    # ----------------------------------------------------------------- orbit
    def scene_orbit(self, v, end):
        p = self.pal
        c = np.array([self.cx, self.cy - 0.1, 0])
        R = min(self.sw / 2 - 0.35, self.sh / 2 - 0.9)
        spec = [("mercury", 0.22, 0.12, 2.6), ("venus", 0.40, 0.2, 1.9), ("earth", 0.60, 0.23, 1.45), ("mars", 0.78, 0.17, 1.05), ("jupiter", 1.0, 0.38, 0.62)]
        orbits = VGroup(*[Circle(radius=R * f, stroke_width=2, color=hexc(p["muted"]), stroke_opacity=0.28).move_to(c) for _, f, _, _ in spec])
        glow = self.glow(c, 1.3, p["sun"], op=0.09)
        sun = planet("sun", 1.0).move_to(c)
        group = Group(glow, orbits, sun)
        planets = []
        for (kind, f, d, w), a0 in zip(spec, [self.rng.uniform(0, math.tau) for _ in spec]):
            pm = planet(kind, d * 2).move_to(c + R * f * np.array([math.cos(a0), math.sin(a0), 0]))
            pm.add_updater(lambda m, dt, w=w: m.rotate(dt * w * 0.9, about_point=c))
            planets.append(pm)
            group.add(pm)
            if kind == "earth":
                tag = self.T("EARTH", 30, p["text"])
                tag.add_updater(lambda m, dt, pm=pm: m.move_to(pm.get_center() + DOWN * 0.5))
                ring = Circle(radius=0.34, stroke_width=3, color=hexc(p["accent"]))
                ring.add_updater(lambda m, dt, pm=pm: m.move_to(pm.get_center()))
                group.add(tag, ring)
        self.play(FadeIn(orbits), FadeIn(glow), FadeIn(sun), *[FadeIn(x) for x in planets], run_time=0.5)
        rem = end - self.time
        if v.get("vanish"):
            t_v = rem * 0.35
            self.wait(t_v)
            last = Circle(radius=0.6, stroke_width=6, color=hexc("#fff0be")).move_to(c)
            group.add(last)
            head = self.T(v.get("label", "THE SUN JUST VANISHED..."), 44, p["accent2"], weight=HEAVY).move_to([self.cx, self.cy + self.sh / 2 - 0.5, 0])
            sub = self.fit(self.T("...and Earth keeps shining for 8 more minutes", 30, p["muted"]), self.sw - 0.6).move_to(head.get_center() + DOWN * 0.7)
            self.fit(head, self.sw - 0.5)
            group.add(head, sub)
            self.play(FadeOut(sun), FadeOut(glow), FadeIn(head, shift=UP * 0.3), run_time=0.4)
            self.play(last.animate.scale(R * 0.6 / 0.6 / 1.0).set_stroke(opacity=0.25), FadeIn(sub), run_time=max(0.5, end - self.time - 0.15), rate_func=linear)
        return group

    # ------------------------------------------------------------- lightbeam
    def scene_lightbeam(self, v, end):
        p = self.pal
        total = parse_duration(v.get("time", "8:19"))
        dist_v, _, dist_u = str(v.get("distance", "149.6 million km")).partition(" ")
        dist_f = float(dist_v.replace(",", ""))
        dec = len(dist_v.split(".")[1]) if "." in dist_v else 0
        bx = self.cx - 1.5
        sy, ey = self.cy + self.sh / 2 - (1.55 if v.get("title") else 1.2), self.cy - self.sh / 2 + 1.0
        sun = planet("sun", 1.8).move_to([bx, sy, 0])
        glow = self.glow([bx, sy, 0], 1.5, p["sun"], op=0.09)
        earth = planet("earth", 0.8).move_to([bx, ey, 0])
        egl = self.glow([bx, ey, 0], 0.8, "#5aaaff", op=0.12)
        dots = VGroup(*[Dot([bx, sy - 1.0 - i * (sy - ey - 1.4) / 30, 0], radius=0.025, color=hexc(p["muted"])).set_opacity(0.35) for i in range(31)])
        sname = self.T(v.get("from", "Sun").upper(), 40).next_to(sun, RIGHT, buff=0.5)
        ename = self.T(v.get("to", "Earth").upper(), 40).next_to(earth, RIGHT, buff=0.5)
        title = self.T(v.get("title", "").upper(), 34, p["muted"]).move_to([self.cx, self.cy + self.sh / 2 - 0.3, 0]) if v.get("title") else VGroup()
        tr = ValueTracker(0)
        y_of = lambda q: sy - 1.0 - q * (sy - 1.0 - (ey + 0.45))
        pulse = always_redraw(lambda: VGroup(Dot([bx, y_of(tr.get_value()), 0], radius=0.14, color=WHITE), Circle(radius=0.34, stroke_width=0, fill_color=WHITE, fill_opacity=0.25).move_to([bx, y_of(tr.get_value()), 0]),
                                             *[Dot([bx, y_of(tr.get_value()) + 0.16 * k, 0], radius=0.11 - 0.011 * k, color=hexc("#fff4c8")).set_opacity(0.8 - 0.08 * k) for k in range(1, 9) if y_of(tr.get_value()) + 0.16 * k < sy - 0.9]))
        arcs = always_redraw(lambda: VGroup(*[Arc(radius=r_, start_angle=-PI / 2 - 0.75, angle=1.5, arc_center=[bx, sy, 0], stroke_width=5, color=hexc(p["sun"]), stroke_opacity=max(0, 0.55 - 0.13 * k))
                                              for k in range(4) for r_ in [0.9 + tr.get_value() * (sy - ey) - k * 0.8] if r_ > 1.0]))
        px_ = bx + 2.4
        mid = self.cy
        lab1 = self.T("LIGHT TRAVEL TIME", 26, p["muted"]).move_to([px_, mid + 1.5, 0], aligned_edge=LEFT)
        timer = always_redraw(lambda: self.T(fmt_clock(total * tr.get_value()), 100, p["accent"], weight=HEAVY).move_to([px_, mid + 0.55, 0], aligned_edge=LEFT))
        lab2 = self.T("DISTANCE", 26, p["muted"]).move_to([px_, mid - 0.75, 0], aligned_edge=LEFT)
        dist = always_redraw(lambda: self.T(f"{dist_f * tr.get_value():,.{dec}f}", 64, weight=HEAVY).move_to([px_, mid - 1.45, 0], aligned_edge=LEFT))
        unit = self.T(dist_u, 32, p["muted"]).move_to([px_, mid - 2.15, 0], aligned_edge=LEFT)
        for m in (lab1, lab2, unit):
            m.align_to([px_, 0, 0], LEFT)
        base = Group(egl, glow, dots, sun, earth, sname, ename, title, lab1, lab2, unit)
        self.play(FadeIn(base, shift=UP * 0.25), run_time=0.45)
        self.add(arcs, pulse, timer, dist)
        self.play(tr.animate.set_value(1), run_time=max(1.0, (end - self.time) * 0.82), rate_func=linear)
        ring = Circle(radius=0.45, stroke_width=5, color=hexc("#8cc8ff")).move_to([bx, ey, 0])
        self.play(ring.animate.scale(3).set_stroke(opacity=0), run_time=0.45)
        return Group(base, arcs, pulse, timer, dist)

    # ---------------------------------------------------------------- ladder
    def scene_ladder(self, v, end):
        p = self.pal
        items = v["items"]
        n = len(items)
        top, bot = self.cy + self.sh / 2 - 1.9, self.cy - self.sh / 2 + 0.7
        title = self.T(v.get("title", "Sunlight travel time").upper(), 34, p["muted"]).move_to([self.cx, self.cy + self.sh / 2 - 0.3, 0])
        sun = planet("sun", 1.2)
        sglow = self.glow(ORIGIN, 1.0, p["sun"], op=0.09)
        sname = self.T("SUN", 38).next_to(sun, RIGHT, buff=0.5)
        ys = [top - 0.9 - i * (top - 0.9 - bot) / max(1, n - 1) for i in range(n)]
        line = Line([0, top - 0.2, 0], [0, bot - 0.3, 0], stroke_width=3, color=hexc(p["muted"]), stroke_opacity=0.35)
        diam = {"earth": 0.55, "mars": 0.42, "jupiter": 1.15, "saturn": 0.95, "neptune": 0.7, "venus": 0.5, "mercury": 0.34, "uranus": 0.7}
        name_m = [self.T(it["name"].upper(), 32) for it in items]
        lab_m = [self.T(it["label"], 54, p["accent"], weight=HEAVY) for it in items]
        left = max(m.width for m in name_m) + 0.55 + 0.6
        right = max(m.width for m in lab_m) + 0.55 + 0.6
        ax = self.cx + (left - right) / 2
        sun.move_to([ax, top + 0.3, 0]); sglow.move_to([ax, top + 0.3, 0]); sname.next_to(sun, RIGHT, buff=0.5)
        line.move_to([ax, (top - 0.2 + bot - 0.3) / 2, 0])
        bodies, labels, names = [], [], []
        for it, y, nm, lb in zip(items, ys, name_m, lab_m):
            kind = it["name"].lower()
            dm = diam.get(kind, 0.6)
            b = planet(kind, dm).move_to([ax, y, 0]).set_opacity(0.3)
            bodies.append(b)
            names.append(nm.move_to([ax - 0.55 - dm / 2, y, 0], aligned_edge=RIGHT))
            labels.append(lb.move_to([ax + 0.55 + dm / 2, y, 0], aligned_edge=LEFT))
        self.play(FadeIn(Group(title, sun, sglow, sname, line, *bodies, *names)), run_time=0.4)
        pulse = VGroup(Circle(radius=0.28, stroke_width=0, fill_color=WHITE, fill_opacity=0.28), Dot(radius=0.11, color=WHITE)).move_to([ax, top - 0.2, 0])
        self.add(pulse)
        T = max(1.2, (end - self.time - 0.4) * 0.85) / n
        out = Group(title, sun, sglow, sname, line, *bodies, *names, pulse)
        for b, lab, y in zip(bodies, labels, ys):
            self.play(pulse.animate.move_to([ax, y, 0]), run_time=T * 0.8, rate_func=linear)
            self.play(b.animate.set_opacity(1), FadeIn(lab, shift=RIGHT * 0.4), Flash(b, color=hexc(p["accent"]), line_length=0.2, flash_radius=0.5), run_time=T * 0.2 + 0.05)
            out.add(lab)
        if v.get("note"):
            out.add(self.T(v["note"], 26, p["muted"]).move_to([self.cx, self.cy - self.sh / 2 + 0.15, 0]))
            self.add(out[-1])
        return out

    # ----------------------------------------------------------------- scale
    def scene_scale(self, v, end):
        p = self.pal
        count = int(v.get("count", 109))
        big, small = v.get("big", "Sun"), v.get("small", "Earth")
        R = min(self.sw / 2 - 0.2, (self.sh - 3.8) / 2)
        c = np.array([self.cx, self.cy + self.sh / 2 - R - 0.2, 0])
        sun = planet(big.lower(), R * 2).move_to(c)
        glow = self.glow(c, R * 1.05, p["sun"], op=0.07)
        d = 2 * R / count
        dots = VGroup(*[Dot([c[0] - R + d * (i + 0.5), c[1], 0], radius=d * 0.47, color=hexc("#58a6ff")).set_stroke(WHITE, 0.6) for i in range(count)])
        strip = RoundedRectangle(corner_radius=d, width=2 * R, height=d * 1.9, fill_color=hexc("#0a143c"), fill_opacity=0.7, stroke_width=0).move_to(c)
        tr = ValueTracker(0)
        num = always_redraw(lambda: self.T(f"{int(tr.get_value())}", 130, p["accent"], weight=HEAVY).move_to([self.cx, c[1] - R - 0.95, 0]))
        l1 = self.T(f"{small}s side by side", 42).move_to([self.cx, c[1] - R - 2.1, 0])
        l2 = self.T(f"fit across the {big}'s width", 30, p["muted"]).move_to([self.cx, c[1] - R - 2.7, 0])
        self.play(FadeIn(glow), GrowFromCenter(sun), run_time=0.6)
        self.play(FadeIn(strip), FadeIn(l1), FadeIn(l2), run_time=0.3)
        self.add(num)
        T = max(1.0, (end - self.time) * 0.8)
        self.play(LaggedStart(*[FadeIn(x, scale=2.5) for x in dots], lag_ratio=1.0 / count * 0.9), tr.animate.set_value(count), run_time=T, rate_func=ease_in_out_sine)
        return Group(glow, sun, strip, dots, num, l1, l2)
