"""Procedural shaded planet sprites (numpy) - cached per (kind, radius)."""
from __future__ import annotations

import functools

import numpy as np
from PIL import Image

BASE = {
    "sun": (255, 190, 70), "earth": (40, 110, 210), "mercury": (150, 140, 130), "venus": (225, 190, 120),
    "mars": (200, 90, 55), "jupiter": (205, 160, 120), "saturn": (222, 200, 140), "neptune": (60, 100, 220),
    "uranus": (130, 215, 225), "moon": (190, 190, 195), "generic": (140, 150, 190),
}


@functools.lru_cache(maxsize=128)
def planet_sprite(kind: str, radius_px: int) -> Image.Image:
    kind = kind if kind in BASE else "generic"
    r = max(2, int(radius_px))
    pad = 2
    D = 2 * r + 2 * pad
    ax = (np.arange(D, dtype=np.float32) - (D - 1) / 2) / r
    x, y = np.meshgrid(ax, ax)
    d = np.hypot(x, y)
    inside = np.clip((1 - d) * r, 0, 1)  # anti-aliased coverage
    z = np.sqrt(np.clip(1 - x * x - y * y, 0, 1))
    L = np.array([-0.45, -0.55, 0.70], np.float32)
    L /= np.linalg.norm(L)
    lam = np.clip(x * L[0] + y * L[1] + z * L[2], 0, 1)
    base = np.array(BASE[kind], np.float32)
    col = np.ones((D, D, 3), np.float32) * base

    if kind == "earth":
        v = np.sin(3.1 * x + 1.0) + np.sin(4.7 * y - 2.0) + np.sin(3.9 * (x + y) + 0.6) + 0.6 * np.sin(9 * x - 5 * y)
        land = np.clip((v - 0.9) * 4, 0, 1)[..., None]
        col = col * (1 - land) + np.array([70, 160, 95], np.float32) * land
        cloud = np.clip((np.sin(6 * x + 2 * y + 1.3) * np.sin(5 * y - 3 * x) - 0.45) * 5, 0, 1)[..., None] * 0.55
        col = col * (1 - cloud) + 255 * cloud
    elif kind in ("jupiter", "saturn"):
        bands = np.sin(y * 13 + 0.7 * np.sin(x * 4)) * 0.5 + 0.5
        c2 = np.array([150, 95, 65] if kind == "jupiter" else [190, 165, 110], np.float32)
        col = col * (1 - bands[..., None] * 0.55) + c2 * bands[..., None] * 0.55
    elif kind == "sun":
        gran = np.sin(x * 9 + 2 * np.sin(y * 7)) * np.sin(y * 8 - x * 5)
        col = col + gran[..., None] * 9
        lam = 0.55 + 0.45 * lam  # sun is self-lit: flatter shading
        col = col * np.array([1.0, 1.0, 1.0], np.float32)
        col = col * (0.8 + 0.2 * z[..., None]) + np.array([255, 120, 0], np.float32) * (1 - z[..., None]) * 0.35
    elif kind in ("mars", "mercury", "moon", "venus"):
        crat = np.sin(x * 11 + 1) * np.sin(y * 9 - 2) * np.sin((x + y) * 7)
        col = col + crat[..., None] * 14

    shade = (0.22 + 0.78 * lam)[..., None] if kind != "sun" else lam[..., None]
    col = col * shade
    if kind in ("earth", "venus", "neptune", "uranus"):  # atmosphere rim
        rim = (np.clip(1 - z, 0, 1) ** 2.2)[..., None]
        col = col + rim * np.array([90, 160, 255], np.float32) * 0.9
    out = np.zeros((D, D, 4), np.uint8)
    out[..., :3] = np.clip(col, 0, 255).astype(np.uint8)
    out[..., 3] = (inside * 255).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def draw_planet(cv, cx, cy, r, kind, alpha=1.0, ring=False):
    """Paste a shaded planet; optional ring (Saturn-like)."""
    S = cv.S
    sp = planet_sprite(kind, int(round(r * S)))
    if alpha < 1:
        sp = sp.copy()
        sp.putalpha(sp.getchannel("A").point(lambda v: int(v * alpha)))
    if ring or kind == "saturn":
        from ..canvas import A as _A
        col = (220, 200, 150)
        cv.ellipse(cx, cy, r * 1.9, r * 0.55, outline=_A(col, 0.85 * alpha), width=max(2, r * 0.12))
        cv.img.paste(sp, (int(cx * S - sp.width / 2), int(cy * S - sp.height / 2)), sp)
        # front half of the ring over the planet
        S_ = cv.S
        cv.d.arc([(cx - r * 1.9) * S_, (cy - r * 0.55) * S_, (cx + r * 1.9) * S_, (cy + r * 0.55) * S_], 0, 180,
                 fill=_A(col, 0.95 * alpha), width=max(2, round(r * 0.12 * S_)))
        return
    cv.img.paste(sp, (int(cx * S - sp.width / 2), int(cy * S - sp.height / 2)), sp)
