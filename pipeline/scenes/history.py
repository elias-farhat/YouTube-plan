"""History channel: animated maps (Natural Earth 110m, Mercator) with territory ripples,
city pins, dashed animated routes and a year counter."""
from __future__ import annotations

import functools
import json
import math
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from ..canvas import (A, Canvas, clamp, ease_in_out, ease_out, ease_out_back, ease_out_expo, lerp, mix, seg, text_w)
from .base import Scene

DATA = Path(__file__).resolve().parent.parent / "data" / "world_110m.json"

PRESETS = {  # centre lon, centre lat, span of longitude (degrees) across the stage width
    "italy": (12.8, 42.0, 15),
    "med": (14.0, 38.5, 60),
    "empire": (15.0, 40.5, 58),
    "west_med": (5.0, 40.0, 40),
    "east_med": (29.0, 37.5, 38),
    "europe": (14.0, 47.0, 66),
    "wide": (18.0, 38.0, 90),
}
CITIES = {  # name -> (lat, lon)
    "rome": (41.9, 12.5), "carthage": (36.85, 10.32), "athens": (37.98, 23.73), "alexandria": (31.2, 29.9),
    "constantinople": (41.0, 28.98), "antioch": (36.2, 36.16), "carthago nova": (37.6, -0.98),
    "londinium": (51.5, -0.1), "pyrenees": (42.6, 1.0), "rhône": (44.2, 4.8), "rhone": (44.2, 4.8),
    "alps": (45.4, 7.3), "po valley": (45.1, 10.3), "cannae": (41.3, 16.13), "lutetia": (48.85, 2.35),
    "gades": (36.53, -6.29), "syracuse": (37.07, 15.29), "jerusalem": (31.77, 35.21), "ctesiphon": (33.1, 44.58),
    "mediolanum": (45.46, 9.19), "ravenna": (44.42, 12.2), "zama": (35.9, 9.4),
}
SEAS = [("MEDITERRANEAN SEA", 17.5, 34.6), ("ATLANTIC OCEAN", -9.5, 36.0), ("BLACK SEA", 34.0, 43.2),
        ("NORTH SEA", 3.0, 56.0), ("BALTIC", 19.5, 57.8)]


@functools.lru_cache(maxsize=1)
def world():
    raw = json.loads(DATA.read_text())["countries"]
    out = {}
    for c in raw:
        if c["continent"] == "Antarctica":
            continue
        rings = []
        for ring in c["rings"]:
            a = np.array(ring, np.float64)
            if len(a) < 3:
                continue
            lon, lat = np.radians(a[:, 0]), np.radians(np.clip(a[:, 1], -80, 80))
            X, Y = lon, np.log(np.tan(np.pi / 4 + lat / 2))
            xy = np.stack([X, Y], 1)
            rings.append((xy, xy.min(0), xy.max(0)))
        out[c["name"]] = rings
    return out


def merc(lon, lat):
    return math.radians(lon), math.log(math.tan(math.pi / 4 + math.radians(max(-80, min(80, lat))) / 2))


def parse_year(s):
    m = re.match(r"^\s*(\d+)\s*(BC|BCE|AD|CE)?\s*$", str(s), re.I)
    if not m:
        raise ValueError(f"bad year {s!r} (use e.g. '264 BC' or '117 AD')")
    y = int(m.group(1))
    return -y if (m.group(2) or "").upper() in ("BC", "BCE") else y


def fmt_year(y):
    return (f"{abs(int(y))}", "BC") if y < 0 else (f"{int(y)}", "AD")


def parse_territories(entries):
    """['264 BC | Italy, Sicily', ...] -> sorted [(year, [names])], validated against the dataset."""
    names = set(world())
    out = []
    for e in entries:
        yr, _, rest = e.partition("|")
        lst = [x.strip() for x in rest.split(",") if x.strip()]
        for n in lst:
            if n not in names:
                close = [x for x in names if n.lower()[:4] in x.lower()][:4]
                raise ValueError(f"territory: unknown country {n!r} (try: {', '.join(close) or 'see world_110m.json'})")
        out.append((parse_year(yr), lst))
    return sorted(out)


def resolve_city(s):
    s = s.strip()
    if "@" in s:
        name, _, ll = s.partition("@")
        lat, lon = [float(x) for x in ll.split(",")]
        return name.strip(), lat, lon
    k = s.lower()
    if k not in CITIES:
        raise ValueError(f"unknown place {s!r}: use Name@lat,lon or one of {', '.join(sorted(CITIES))}")
    return s, *CITIES[k]


@functools.lru_cache(maxsize=16)
def _round_mask(w, h, r):
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], radius=r, fill=255)
    return m


class MapScene(Scene):
    """opts: year=117 AD  from=(start year for counter)  view=empire | italy>med  cities=Rome,Carthage
    route=A > B > C  label=Text  origin=Rome  pan=dlon,dlat"""

    def init(self):
        o = self.opt
        self.terr = self.ctx.get("territories", [])
        self.year = parse_year(o("year")) if o("year") else None
        self.year_from = parse_year(o("from")) if o("from") else None
        v = o("view", "empire")
        a, _, b = v.partition(">")
        self.view_a = PRESETS[a.strip()] if a.strip() in PRESETS else tuple(float(x) for x in a.split(","))
        self.view_b = (PRESETS[b.strip()] if b.strip() in PRESETS else tuple(float(x) for x in b.split(","))) if b else None
        self.cities = [resolve_city(c) for c in o("cities", "").split(",") if c.strip()]
        self.route = [resolve_city(c) for c in o("route", "").split(">") if c.strip()]
        self.label = o("label", "")
        # territory state
        self.held, self.new = [], []
        if self.year is not None and self.terr:
            for y, names in self.terr:
                if y == self.year:
                    self.new.extend(names)      # gained in this step -> ripples in
                elif y < self.year:
                    self.held.extend(names)
        self.origin = None
        if o("origin"):
            _, la, lo = resolve_city(o("origin"))
            self.origin = (lo, la)
        w = world()
        def centre(name):
            big = max(w[name], key=lambda r: (r[2][0] - r[1][0]) * (r[2][1] - r[1][1]))
            return (big[1] + big[2]) / 2
        if self.origin is None:
            ref = self.held or self.new
            pts = [centre(n) for n in ref] if ref else [np.array(merc(12.5, 41.9))]
            self.origin_m = np.mean(pts, 0)
        else:
            self.origin_m = np.array(merc(*self.origin))
        self.delay = {}
        for n in self.new:
            d = float(np.hypot(*(centre(n) - self.origin_m)))
            self.delay[n] = d
        dmax = max(self.delay.values()) if self.delay else 1
        self.delay = {n: d / (dmax or 1) for n, d in self.delay.items()}
        drift = (self.st.seed % 5 - 2) * 0.6   # per-video camera drift
        self.drift = drift

    # ---------------------------------------------------------------- view
    def _view(self, t, dur):
        p = ease_in_out(seg(t, 0, dur))
        la = self.view_a
        if self.view_b:
            lb = self.view_b
            cx, cy = lerp(la[0], lb[0], ease_in_out(seg(t, 0, dur * 0.9))), lerp(la[1], lb[1], ease_in_out(seg(t, 0, dur * 0.9)))
            span = math.exp(lerp(math.log(la[2]), math.log(lb[2]), ease_in_out(seg(t, 0, dur * 0.9))))
        else:
            zoom = self.st.pace["zoom"]
            cx, cy = la[0] + self.drift * p, la[1]
            span = la[2] * (1 - zoom * p)
        return cx, cy, span

    def draw(self, cv, t, dur):
        pal, S = self.pal, cv.S
        sw, sh = int(self.w), int(self.h)
        img = Image.new("RGB", (sw * S, sh * S), pal["sea"])
        m = Canvas(img, S)
        # sea gradient (cheap): lighter band toward top
        for i in range(0, sh, 40):
            c = mix(pal["sea"], pal["sea2"], i / sh)
            m.rect(0, i, sw, i + 40, fill=c)
        cxl, cyl, span = self._view(t, dur)
        k = sw / math.radians(span)                      # pixels per mercator unit
        Xc, Yc = merc(cxl, cyl)
        P = lambda lon, lat: ((merc(lon, lat)[0] - Xc) * k + sw / 2, (Yc - merc(lon, lat)[1]) * k + sh / 2)

        # graticule
        for lon in range(-30, 71, 10):
            x, _ = P(lon, 0)
            if 0 <= x <= sw:
                m.line([(x, 0), (x, sh)], A(pal["muted"], 0.10), 1.5, caps=False)
        for lat in range(10, 71, 10):
            _, y = P(0, lat)
            if 0 <= y <= sh:
                m.line([(0, y), (sw, y)], A(pal["muted"], 0.10), 1.5, caps=False)

        # land
        wd = world()
        vx0, vx1 = Xc - sw / 2 / k, Xc + sw / 2 / k
        vy0, vy1 = Yc - sh / 2 / k, Yc + sh / 2 / k

        def arr(ring):
            xy = ring[0]
            out = np.empty_like(xy)
            out[:, 0] = (xy[:, 0] - Xc) * k + sw / 2
            out[:, 1] = (Yc - xy[:, 1]) * k + sh / 2
            return (out * S).ravel().tolist()

        def visible(ring):
            return not (ring[2][0] < vx0 or ring[1][0] > vx1 or ring[2][1] < vy0 or ring[1][1] > vy1)

        land, border = pal["land"], pal["border"]
        for name, rings in wd.items():
            for ring in rings:
                if visible(ring):
                    m.d.polygon(arr(ring), fill=land + (255,), outline=border + (255,), width=max(1, round(1.2 * S)))
        # territories
        acc, acc2 = pal["accent"], pal["accent2"]
        held_col = acc
        for name in self.held:
            for ring in wd[name]:
                if visible(ring):
                    m.d.polygon(arr(ring), fill=A(held_col, 0.62 * clamp(seg(t, 0, 0.4))),
                                outline=A(mix(acc, (0, 0, 0), 0.25), 0.95), width=max(1, round(1.6 * S)))
        t_open = 0.35
        spread = max(0.4, dur * 0.5)
        for name in self.new:
            p = ease_out(seg(t, t_open + self.delay[name] * spread, t_open + self.delay[name] * spread + 0.6))
            if p <= 0:
                continue
            flash = 1 - clamp((t - (t_open + self.delay[name] * spread + 0.3)) / 0.9)
            fill = mix(held_col, acc2, 0.65 * flash)
            for ring in wd[name]:
                if visible(ring):
                    m.d.polygon(arr(ring), fill=A(fill, 0.78 * p), outline=A(mix(acc2, (255, 255, 255), 0.3), p),
                                width=max(1, round((2.0 + 2.5 * flash) * S)))

        # sea labels
        for txt, lon, lat in SEAS:
            x, y = P(lon, lat)
            label = " ".join(txt)
            half = text_w(label, 22, "serif") / 2
            if half + 12 < x < sw - half - 12 and 40 < y < sh - 40:
                m.text(x, y, label, 22, "serif", A(pal["muted"], 0.55), anchor="mm")

        # route (dashed, animated)
        if len(self.route) >= 2:
            self._draw_route(m, t, dur, P)

        # city pins
        for i, (name, lat, lon) in enumerate(self.cities):
            x, y = P(lon, lat)
            q = ease_out_back(seg(t, 0.5 + i * 0.35, 1.0 + i * 0.35))
            if q <= 0:
                continue
            ph = (t * 1.3 + i * 0.4) % 1
            m.circle(x, y, 8 + 34 * ph, outline=A(pal["accent2"], (1 - ph) * 0.8), width=3)
            m.circle(x, y, 11 * q, fill=A(pal["accent2"], 1), outline=A((20, 14, 8), 1), width=3)
            self._chip(m, x, y - 38, name, q, pal)

        # label ribbon + year counter
        if self.label:
            q = ease_out(seg(t, 0.2, 0.7))
            tw = text_w(self.label, 38, "serif") + 56
            xx = 24 - (1 - q) * (tw + 40)
            m.rrect(xx, sh - 92, xx + tw, sh - 28, 18, fill=A((12, 10, 8), 0.78), outline=A(pal["accent2"], 0.9), width=2)
            m.text(xx + tw / 2, sh - 60, self.label, 38, "serif", A((250, 240, 220), 1), anchor="mm")
        if self.year is not None:
            y0 = self.year_from if self.year_from is not None else (
                max([y for y, _ in self.terr if y < self.year], default=self.year) if self.terr else self.year)
            yv = lerp(y0, self.year, ease_in_out(seg(t, 0.15, 0.15 + min(1.6, dur * 0.55))))
            num_, era = fmt_year(round(yv))
            nw = text_w(num_, 92, "serif")
            m.rrect(22, 22, 22 + nw + 150, 138, 22, fill=A((12, 10, 8), 0.74), outline=A(pal["accent2"], 0.9), width=2)
            m.text(44, 80, num_, 92, "serif", A((250, 240, 220), 1), anchor="lm")
            m.text(44 + nw + 14, 98, era, 38, "serif", A(pal["accent2"], 1), anchor="lm")

        # paste with rounded mask + frame
        mask = _round_mask(sw * S, sh * S, 38 * S)
        cv.img.paste(m.img, (int(self.x0 * S), int(self.y0 * S)), mask)
        cv.rrect(self.x0, self.y0, self.x1, self.y1, 38, outline=A(pal["accent2"], 0.9), width=4)

    def _chip(self, m, x, y, name, q, pal):
        tw = text_w(name, 30, "serif") + 30
        x0, x1 = x - tw / 2, x + tw / 2
        x0c = max(8, x0); x1c = x0c + tw
        if x1c > m.img.width / m.S - 8:
            x1c = m.img.width / m.S - 8; x0c = x1c - tw
        m.rrect(x0c, y - 22 * q, x1c, y + 22 * q, 14, fill=A((12, 10, 8), 0.82 * q))
        if q > 0.6:
            m.text((x0c + x1c) / 2, y, name, 30, "serif", A((250, 240, 220), q), anchor="mm")

    def _draw_route(self, m, t, dur, P):
        pal = self.pal
        pts = [P(lon, lat) for (_, lat, lon) in self.route]
        lens = [math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
        total = sum(lens)
        u = ease_in_out(seg(t, 0.4, 0.4 + dur * 0.72)) * total
        col = pal["accent2"]
        pos, last_dir, reached = 0.0, (1, 0), 0
        dash, gap = 24, 14
        x_last = pts[0]
        for i, L in enumerate(lens):
            (ax, ay), (bx, by) = pts[i], pts[i + 1]
            if L < 1e-6:
                continue
            dx, dy = (bx - ax) / L, (by - ay) / L
            seg_end = min(u - pos, L)
            if seg_end <= 0:
                break
            d = 0.0
            while d < seg_end:
                d1 = min(d + dash, seg_end)
                m.line([(ax + dx * d, ay + dy * d), (ax + dx * d1, ay + dy * d1)], A((20, 14, 8), 0.9), 11, caps=False)
                m.line([(ax + dx * d, ay + dy * d), (ax + dx * d1, ay + dy * d1)], A(col, 1), 7, caps=False)
                d += dash + gap
            last_dir = (dx, dy)
            x_last = (ax + dx * seg_end, ay + dy * seg_end)
            if u >= pos + L - 0.01:
                reached = i + 1
            pos += L
        # waypoints
        for i, (name, lat, lon) in enumerate(self.route):
            if i <= reached:
                x, y = pts[i]
                m.circle(x, y, 9, fill=A(col, 1), outline=A((20, 14, 8), 1), width=3)
                if 0 < i < len(self.route) - 1 or i in (0, len(self.route) - 1):
                    self._chip(m, x, y + (46 if i % 2 else -46), name, 1.0, pal)
        # arrow head
        hx, hy = x_last
        dx, dy = last_dir
        nx, ny = -dy, dx
        s = 22
        m.poly([(hx + dx * s, hy + dy * s), (hx - dx * s * 0.6 + nx * s * 0.8, hy - dy * s * 0.6 + ny * s * 0.8),
                (hx - dx * s * 0.6 - nx * s * 0.8, hy - dy * s * 0.6 - ny * s * 0.8)], fill=A(col, 1),
               outline=A((20, 14, 8), 1), width=3)
