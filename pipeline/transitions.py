"""Frame-level transitions between two full-size RGB frames (same size)."""
from __future__ import annotations

from PIL import Image, ImageDraw

from .canvas import clamp, ease_in_out


def transition(kind: str, a: Image.Image, b: Image.Image, q: float) -> Image.Image:
    """a = outgoing, b = incoming, q in 0..1"""
    q = ease_in_out(clamp(q))
    if q <= 0:
        return a
    if q >= 1:
        return b
    w, h = a.size
    if kind == "fade":
        return Image.blend(a, b, q)
    if kind == "slide":  # incoming slides up over a slowly rising outgoing
        out = a.copy()
        y = int(h * (1 - q))
        out.paste(a, (0, -int(h * q * 0.25)))
        out.paste(b, (0, y))
        return out
    if kind == "push":  # horizontal push
        out = Image.new("RGB", (w, h))
        x = int(w * q)
        out.paste(a, (-x, 0))
        out.paste(b, (w - x, 0))
        return out
    if kind == "wipe":  # circular reveal from the centre of the stage
        mask = Image.new("L", (w, h), 0)
        r = int(((w / 2) ** 2 + (h / 2) ** 2) ** 0.5 * q * 1.05)
        cx, cy = w // 2, int(h * 0.42)
        ImageDraw.Draw(mask).ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
        return Image.composite(b, a, mask)
    # zoom: incoming scales down from 1.18 while fading in
    s = 1.18 - 0.18 * q
    nw, nh = int(w * s), int(h * s)
    zb = b.resize((nw, nh), Image.BILINEAR).crop(((nw - w) // 2, (nh - h) // 2, (nw - w) // 2 + w, (nh - h) // 2 + h))
    return Image.blend(a, zb, q)
