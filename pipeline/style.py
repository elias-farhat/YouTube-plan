"""Per-channel style templates + seeded per-video variation.

A *template* is the channel's identity (fonts, chart language, background motif,
scene vocabulary).  *Variation* is what changes between videos of the same
channel: palette, layout, caption style, transition, pacing, kinetic-text
animation, chart orientation, header style.  Everything is chosen from the
video seed (hash of the title unless ``seed:`` is set) and can be pinned with
``style: palette=ember layout=B ...`` in the script header.
"""
from __future__ import annotations

import hashlib
import random
from dataclasses import dataclass, field

from .canvas import rgb

# --------------------------------------------------------------- palettes ---
def _p(**kw):
    return {k: (rgb(v) if isinstance(v, str) else v) for k, v in kw.items()}


PALETTES = {
    "money": {
        "emerald": _p(bg_top="#06201a", bg_bot="#0d4434", glow="#1fa97a", accent="#3ddc97", accent2="#ffd166",
                      text="#f4fff9", muted="#8fc4b0", panel="#0f3a2e", bad="#ff5d6c", good="#3ddc97", on_accent="#04150f"),
        "navy_gold": _p(bg_top="#0a1230", bg_bot="#16306a", glow="#3c63d8", accent="#ffc83d", accent2="#5ad1ff",
                        text="#f7f9ff", muted="#9fb2e0", panel="#14285c", bad="#ff6b7a", good="#4ee3a0", on_accent="#111a33"),
        "ember": _p(bg_top="#1c0d12", bg_bot="#42162a", glow="#d8452e", accent="#ff6b4a", accent2="#ffd166",
                    text="#fff6f1", muted="#d6a79c", panel="#3a1722", bad="#ff6b4a", good="#7ee081", on_accent="#220a05"),
        "paper": _p(bg_top="#f6f8f4", bg_bot="#d9eadf", glow="#9fd8bd", accent="#0f9d6b", accent2="#ff7a1a",
                    text="#0d1b2a", muted="#5b7266", panel="#ffffff", bad="#e5484d", good="#0f9d6b", on_accent="#ffffff"),
        "violet": _p(bg_top="#120a2a", bg_bot="#2d1763", glow="#7c4dff", accent="#b388ff", accent2="#5eead4",
                     text="#f8f5ff", muted="#b9a7e6", panel="#261453", bad="#ff7a90", good="#5eead4", on_accent="#150a33"),
        "slate": _p(bg_top="#0e151d", bg_bot="#1f3345", glow="#2b8fc4", accent="#38bdf8", accent2="#fb7185",
                    text="#f1f7fc", muted="#8da6bb", panel="#18283a", bad="#fb7185", good="#4ade80", on_accent="#04141f"),
    },
    "space": {
        "nebula": _p(bg_top="#05030f", bg_bot="#160a33", glow="#6a2cc9", glow2="#ff4fa3", accent="#7df9ff", accent2="#ff7ad9",
                     text="#f6f4ff", muted="#a79bd6", panel="#1a1040", sun="#ffd36b", bad="#ff7a90", good="#7df9ff", on_accent="#05030f"),
        "aurora": _p(bg_top="#020b12", bg_bot="#06302f", glow="#12b886", glow2="#2f6bff", accent="#5cffb0", accent2="#6ec5ff",
                     text="#effff8", muted="#8ac7b2", panel="#0a2a2a", sun="#ffe27a", bad="#ff8a7a", good="#5cffb0", on_accent="#02110d"),
        "mars": _p(bg_top="#10050a", bg_bot="#3a1210", glow="#d9532b", glow2="#ffb347", accent="#ffb347", accent2="#ff6b4a",
                   text="#fff4ec", muted="#d7a592", panel="#2c0f0e", sun="#ffd36b", bad="#ff6b6b", good="#ffd36b", on_accent="#1c0803"),
        "deepgold": _p(bg_top="#030812", bg_bot="#0a1c3d", glow="#2551b8", glow2="#ffcf5a", accent="#ffcf5a", accent2="#73b7ff",
                       text="#f6f9ff", muted="#93a9d6", panel="#0e2147", sun="#ffcf5a", bad="#ff7a7a", good="#ffcf5a", on_accent="#0a1226"),
        "ice": _p(bg_top="#030a14", bg_bot="#0e2f55", glow="#4aa8ff", glow2="#b6f0ff", accent="#aeeaff", accent2="#7aa7ff",
                  text="#f3fbff", muted="#8fb7d6", panel="#0c2748", sun="#fff0b0", bad="#ff8f9a", good="#aeeaff", on_accent="#04101c"),
        "violet": _p(bg_top="#07030f", bg_bot="#25104f", glow="#9b5cff", glow2="#37e6c8", accent="#37e6c8", accent2="#c79bff",
                     text="#f8f4ff", muted="#b3a1e0", panel="#1d0f43", sun="#ffd36b", bad="#ff7da0", good="#37e6c8", on_accent="#06020f"),
    },
    "history": {
        "sepia": _p(bg_top="#1a120b", bg_bot="#33231a", glow="#8a5a2b", sea="#17384a", sea2="#10293a", land="#d9caa3",
                    border="#8b7650", accent="#b3282d", accent2="#e8b84a", text="#fbf3e2", muted="#c4b08a", panel="#2a1d14",
                    bad="#e0605e", good="#e8b84a", on_accent="#fff7e8", ink="#3a2a1a"),
        "midnight": _p(bg_top="#060b18", bg_bot="#101d3a", glow="#2f4f9a", sea="#0b1a33", sea2="#07111f", land="#2c3d5c",
                       border="#5a7098", accent="#f2c14e", accent2="#ff7a59", text="#f4f7ff", muted="#98a8cc", panel="#12213f",
                       bad="#ff7a59", good="#f2c14e", on_accent="#16120a", ink="#e8eefc"),
        "terracotta": _p(bg_top="#1f1410", bg_bot="#3d2218", glow="#c8553d", sea="#27403f", sea2="#1b2e2d", land="#ecd9b8",
                         border="#a58862", accent="#c8553d", accent2="#f0b67f", text="#fff6ea", muted="#d3b79a", panel="#32201a",
                         bad="#e66a4e", good="#f0b67f", on_accent="#fff6ea", ink="#3b2418"),
        "atlas": _p(bg_top="#efe5cf", bg_bot="#d9c9a6", glow="#f7efe0", sea="#a9cdd2", sea2="#8fb9c0", land="#f2e9d2",
                    border="#a28f69", accent="#a4343a", accent2="#2f6f8f", text="#2b2118", muted="#6b5a42", panel="#f8f1df",
                    bad="#a4343a", good="#2f6f8f", on_accent="#fff7e8", ink="#2b2118"),
        "ink": _p(bg_top="#0b0d11", bg_bot="#1a1e26", glow="#3a4252", sea="#11151b", sea2="#0b0e12", land="#3b4048",
                  border="#6a7280", accent="#ff5a36", accent2="#ffd0a8", text="#f3f4f6", muted="#9aa1ad", panel="#1b2029",
                  bad="#ff5a36", good="#ffd0a8", on_accent="#1a0803", ink="#f3f4f6"),
        "olive": _p(bg_top="#10150f", bg_bot="#24301f", glow="#7a8f4a", sea="#1d3331", sea2="#122422", land="#cfd2b0",
                    border="#8d9170", accent="#8e2f27", accent2="#e3c26a", text="#f6f4e4", muted="#b5b894", panel="#1f2a1b",
                    bad="#d1584c", good="#e3c26a", on_accent="#fff4e2", ink="#2a2d1b"),
    },
}

# --------------------------------------------------------------- variants ---
LAYOUTS = {
    # name: (stage rect, caption centre y)
    "A": ((60, 250, 1020, 1200), 1370),   # visual on top, captions below
    "B": ((60, 560, 1020, 1500), 385),    # captions on top, visual below
    "C": ((60, 250, 1020, 1250), 1420),   # taller visual, captions low
}
PACING = {
    #            speech factor, transition s, tail gap s, words / caption chunk, camera push
    "snappy":    dict(speed=0.92, td=0.28, gap=0.16, chunk=3, zoom=0.05, rate="+8%"),
    "steady":    dict(speed=1.00, td=0.38, gap=0.28, chunk=4, zoom=0.09, rate="+0%"),
    "cinematic": dict(speed=1.10, td=0.55, gap=0.40, chunk=4, zoom=0.15, rate="-6%"),
}
TRANSITIONS = ["fade", "slide", "wipe", "zoom", "push"]
CAPTIONS = {
    "money": ["pop", "bar", "underline"],
    "space": ["glow", "pop", "bar"],
    "history": ["serif", "bar", "glow"],
}
KINETIC = ["pop", "slide", "drop", "stack"]
MOTIFS = {
    "money": ["grid", "coins", "bars"],
    "space": ["stars", "stars_nebula", "stars_streak"],
    "history": ["graticule", "compass", "paper"],
}
HEADERS = ["chip", "line", "banner"]
CHART_ORIENT = ["v", "h"]


@dataclass
class Style:
    channel: str
    seed: int
    pal_name: str
    pal: dict
    layout: str
    stage: tuple
    cap_y: int
    caption: str
    pacing: str
    pace: dict
    transition: str
    kinetic: str
    motif: str
    header: str
    orient: str
    handle: str = ""
    extra: dict = field(default_factory=dict)

    def describe(self) -> dict:
        return dict(palette=self.pal_name, layout=self.layout, caption=self.caption, pacing=self.pacing,
                    transition=self.transition, kinetic=self.kinetic, motif=self.motif,
                    header=self.header, chart_orientation=self.orient, seed=self.seed)


DEFAULT_HANDLES = {"money": "@CentsAndSense", "space": "@CosmicBits", "history": "@MapsOfTime"}
CHANNEL_NAMES = {"money": "MONEY EXPLAINED", "space": "SPACE & SCIENCE", "history": "HISTORY IN MOTION"}


def seed_from_title(title: str) -> int:
    return int(hashlib.sha1(title.encode()).hexdigest()[:8], 16)


def parse_overrides(s: str) -> dict:
    out = {}
    for tok in (s or "").replace(",", " ").split():
        if "=" in tok:
            k, v = tok.split("=", 1)
            out[k.strip().lower()] = v.strip()
    return out


def _lum(c):
    return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255


def with_highlights(pal: dict) -> dict:
    """Add `hl` (text highlight colour that is legible on this palette's background) + `on_hl`."""
    pal = dict(pal)
    bg = tuple((a + b) / 2 for a, b in zip(pal["bg_top"], pal["bg_bot"]))
    pal["hl"] = pal["accent"] if abs(_lum(pal["accent"]) - _lum(bg)) > 0.30 else pal["accent2"]
    pal["on_hl"] = (14, 14, 20) if _lum(pal["hl"]) > 0.5 else (255, 255, 255)
    pal["light"] = _lum(bg) > 0.6
    return pal


def pick_style(channel: str, seed: int, overrides: dict | None = None, handle: str | None = None) -> Style:
    ov = overrides or {}
    rng = random.Random(seed * 7919 + sum(map(ord, channel)))  # stable across runs (no str hash())
    pals = PALETTES[channel]
    names = list(pals)

    def choose(options, key, default_rng=True):
        if key in ov:
            return ov[key]
        return rng.choice(options)

    pal_name = ov.get("palette") or names[seed % len(names)]
    if pal_name not in pals:
        raise ValueError(f"unknown palette {pal_name!r} for {channel}; choose from {', '.join(names)}")
    layout = choose(list(LAYOUTS), "layout").upper()
    if layout not in LAYOUTS:
        raise ValueError(f"unknown layout {layout!r}; choose from A, B, C")
    pacing = choose(list(PACING), "pacing")
    if pacing not in PACING:
        raise ValueError(f"unknown pacing {pacing!r}; choose from {', '.join(PACING)}")
    stage, cap_y = LAYOUTS[layout]
    return Style(
        channel=channel,
        seed=seed,
        pal_name=pal_name,
        pal=with_highlights(pals[pal_name]),
        layout=layout,
        stage=stage,
        cap_y=cap_y,
        caption=choose(CAPTIONS[channel], "caption"),
        pacing=pacing,
        pace=PACING[pacing],
        transition=choose(TRANSITIONS, "transition"),
        kinetic=choose(KINETIC, "kinetic"),
        motif=choose(MOTIFS[channel], "motif"),
        header=choose(HEADERS, "header"),
        orient=choose(CHART_ORIENT, "orient"),
        handle=handle or DEFAULT_HANDLES[channel],
    )
