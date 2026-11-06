#!/usr/bin/env python3
"""Procedural sound effects + ambient bed, mixed with the voice-over.  No samples, no network.

    python tools/sfx.py plan.json out.wav [--voice voice.wav] [--no-bed]

plan.json carries `cues` [{t, name, gain, dur?, f?}], `totalFrames`, `fps`, `channel`, `style.seed`
and `segs` (speech intervals, used to duck the bed under the voice).  Output: 44.1 kHz stereo wav.
Cue names: whoosh, whoosh_s, hit, boom, stamp, ping, tick, riser, draw, sweep, counter, clash, crackle, swell, sting, thud
"""
import json
import sys
import zlib

import numpy as np
from scipy.signal import butter, sosfilt

SR = 44100


def t_axis(d):
    return np.arange(int(d * SR)) / SR


def env_exp(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


def lp(x, f, order=2):
    return sosfilt(butter(order, min(f, SR / 2 - 100), "low", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, min(hi, SR / 2 - 100)], "band", fs=SR, output="sos"), x)


def fade(x, a=0.004, b=0.01):
    n = len(x)
    na, nb = min(n // 2, int(a * SR)), min(n // 2, int(b * SR))
    if na:
        x[:na] *= np.linspace(0, 1, na)
    if nb:
        x[-nb:] *= np.linspace(1, 0, nb)
    return x


def sweep_noise(rng, d, f0, f1, q=0.6, shape="bell"):
    """noise through a band-pass whose centre sweeps f0 -> f1 (block-wise filtering with carried state)"""
    n = int(d * SR)
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    block = 512
    zi = None
    for i in range(0, n, block):
        p = i / max(1, n)
        fc = f0 * (f1 / f0) ** p
        lo, hi = fc * (1 - q * 0.5), min(fc * (1 + q * 0.5), SR / 2 - 200)
        sos = butter(2, [lo, hi], "band", fs=SR, output="sos")
        if zi is None or zi.shape[0] != sos.shape[0]:
            zi = np.zeros((sos.shape[0], 2))
        seg, zi = sosfilt(sos, noise[i:i + block], zi=zi)
        out[i:i + block] = seg
    out /= np.max(np.abs(out)) + 1e-9
    x = np.linspace(0, 1, n)
    amp = np.sin(np.pi * x) ** 1.5 if shape == "bell" else (x ** 2 if shape == "rise" else (1 - x) ** 2)
    return out * amp


def sound(name, rng, dur=None, f=None):
    x = _sound(name, rng, dur, f)
    return x * (0.9 / (np.max(np.abs(x)) + 1e-9))   # every effect peaks at 0.9; cue gains do the balancing


def _sound(name, rng, dur=None, f=None):
    if name == "whoosh":
        return fade(sweep_noise(rng, 0.55, 300, 3800, 0.9)) * 0.9
    if name == "whoosh_s":
        return fade(sweep_noise(rng, 0.3, 700, 5000, 0.9)) * 0.7
    if name in ("hit", "thud"):
        d = 0.55 if name == "hit" else 0.35
        t = t_axis(d)
        fr = 55 + 120 * np.exp(-t * 28)
        body = np.sin(2 * np.pi * np.cumsum(fr) / SR) * env_exp(len(t), 0.16)
        click = lp(rng.standard_normal(len(t)), 3500) * env_exp(len(t), 0.02) * 0.7
        return fade(body + click) * 1.1
    if name == "boom":
        t = t_axis(2.2)
        fr = 38 + 90 * np.exp(-t * 6)
        body = np.sin(2 * np.pi * np.cumsum(fr) / SR) * env_exp(len(t), 0.7)
        rumble = lp(rng.standard_normal(len(t)), 160) * env_exp(len(t), 0.9) * 3.0
        crack = hp(rng.standard_normal(len(t)), 800) * env_exp(len(t), 0.03) * 0.5
        return fade(body + rumble + crack, 0.002, 0.2) * 1.2
    if name == "stamp":
        t = t_axis(0.4)
        thump = np.sin(2 * np.pi * np.cumsum(70 + 90 * np.exp(-t * 40)) / SR) * env_exp(len(t), 0.08)
        slap = bp(rng.standard_normal(len(t)), 900, 5000) * env_exp(len(t), 0.025)
        return fade(thump * 1.1 + slap * 0.8)
    if name == "ping":
        f0 = f or 880.0
        t = t_axis(1.1)
        s = sum(a * np.sin(2 * np.pi * f0 * m * t) * np.exp(-t * dcy) for m, a, dcy in ((1, 1.0, 5), (2.01, 0.35, 8), (3.0, 0.15, 12)))
        return fade(s * 0.5, 0.002, 0.05)
    if name == "tick":
        t = t_axis(0.05)
        return fade(bp(rng.standard_normal(len(t)), 1800, 6000) * env_exp(len(t), 0.006)) * 0.9
    if name == "riser":
        d = dur or 2.0
        n = int(d * SR)
        x = np.linspace(0, 1, n)
        noise = sweep_noise(rng, d, 200, 6000, 1.2, "rise")
        tone = np.sin(2 * np.pi * np.cumsum(110 * (8 ** x)) / SR) * x ** 2 * 0.35
        return fade(noise * 0.9 + tone, 0.02, 0.005)
    if name == "draw":
        d = dur or 1.5
        return fade(sweep_noise(rng, d, 500, 2500, 0.8, "bell") * 0.6, 0.05, 0.08)
    if name == "sweep":
        d = dur or 1.5
        return fade(sweep_noise(rng, d, 180, 2600, 1.0, "rise") * 0.85, 0.03, 0.01)
    if name == "counter":
        d = dur or 1.5
        n = int(d * SR)
        out = np.zeros(n)
        k = 0.0
        while k < d:
            tk = sound("tick", rng)
            i = int(k * SR)
            m = min(len(tk), n - i)
            if m > 0:
                out[i:i + m] += tk[:m] * (0.35 + 0.5 * k / d)
            k += max(0.045, 0.16 * (1 - k / d * 0.75))   # accelerating ticks
        return out
    if name == "clash":
        t = t_axis(0.35)
        noise = bp(rng.standard_normal(len(t)), 1500, 9000) * env_exp(len(t), 0.05)
        ring = sum(np.sin(2 * np.pi * fq * t) * np.exp(-t * dc) for fq, dc in ((2300, 14), (3170, 18), (4310, 22), (5870, 30))) * 0.12
        return fade(noise * 0.7 + ring)
    if name == "crackle":
        d = dur or 1.5
        n = int(d * SR)
        imp = (rng.random(n) < 0.0016) * rng.random(n)
        x = hp(sosfilt(butter(2, 7000, "low", fs=SR, output="sos"), imp), 900) * 14
        x += lp(rng.standard_normal(n), 400) * 0.15
        return fade(x * (0.6 + 0.4 * np.sin(np.linspace(0, 6, n)) ** 2), 0.1, 0.2)
    if name == "swell":
        d = dur or 1.6
        n = int(d * SR)
        t = t_axis(d)
        x = np.sin(np.pi * np.linspace(0, 1, n)) ** 2
        s = sum(np.sin(2 * np.pi * fq * t) for fq in (110, 164.8, 220, 329.6)) / 4
        return fade(s * x * 0.5 + lp(rng.standard_normal(n), 900) * x * 0.15, 0.1, 0.1)
    if name == "sting":
        t = t_axis(1.2)
        fr = 90 + 600 * np.exp(-t * 3)
        s = np.sin(2 * np.pi * np.cumsum(fr) / SR) * env_exp(len(t), 0.35)
        return fade(s * 0.6 + sound("boom", rng)[: len(t)] * 0.5, 0.002, 0.2)
    raise KeyError(name)


# ----------------------------------------------------------------- beds ---
def bed(channel, d, seed, rng):
    n = int(d * SR)
    t = np.arange(n) / SR
    roots = {"history": 55.0, "money": 110.0, "space": 82.4}
    root = roots[channel] * (2 ** ((seed % 5 - 2) / 12))
    x = np.zeros(n)
    ratios = {"history": (1, 1.5, 2.0, 2.97), "money": (1, 1.25, 1.5, 2.0), "space": (1, 1.5, 2.25, 3.0)}[channel]
    for k, r in enumerate(ratios):
        vib = 1 + 0.003 * np.sin(2 * np.pi * (0.13 + 0.05 * k) * t + k)
        ph = 2 * np.pi * np.cumsum(root * r * vib) / SR
        saw = (2 * ((ph / (2 * np.pi)) % 1) - 1) * 0.5 + np.sin(ph)
        x += saw * (0.5 if k else 1.0) * (0.6 + 0.4 * np.sin(2 * np.pi * (0.05 + 0.02 * k) * t + k * 2))
    x = lp(x, {"history": 380, "money": 900, "space": 700}[channel], 2)
    x /= np.max(np.abs(x)) + 1e-9
    if channel == "history":   # slow war-drum / heartbeat pulse
        beat = 60 / 52
        p = np.zeros(n)
        k = 0.0
        while k < d:
            th = sound("thud", rng) * 0.55
            i = int(k * SR)
            m = min(len(th), n - i)
            if m > 0:
                p[i:i + m] += th[:m]
            k += beat
        x = x * 0.8 + p * 0.45
    elif channel == "money":   # soft pulsing arp
        step = 60 / 100 / 2
        arp = np.zeros(n)
        notes = [1, 1.25, 1.5, 2.0, 1.5, 1.25]
        k, j = 0.0, 0
        while k < d:
            tt = t_axis(0.35)
            fq = root * 2 * notes[j % len(notes)]
            tone = np.sin(2 * np.pi * fq * tt) * np.exp(-tt * 9) * 0.5
            i = int(k * SR)
            m = min(len(tone), n - i)
            if m > 0:
                arp[i:i + m] += tone[:m]
            k += step
            j += 1
        x = x * 0.7 + arp * 0.35
    else:                      # space: airy sparkle
        sp = np.zeros(n)
        for _ in range(int(d * 0.8)):
            tt = t_axis(1.4)
            fq = root * rng.choice([6, 8, 9, 12, 16])
            tone = np.sin(2 * np.pi * fq * tt) * np.exp(-tt * 3) * 0.12
            i = int(rng.random() * (d - 1.5) * SR)
            sp[i:i + len(tone)] += tone
        x = x * 0.8 + sp
    return x * 0.5


def square(freq, d, duty=0.5):
    t = t_axis(d)
    return np.where((t * freq) % 1.0 < duty, 1.0, -1.0)


def chip_bed(d, bpm, seed, rng):
    """8-bit style loop locked to `bpm`: kick on 1 & 3, snare on 2 & 4, 8th hats, square bass, arpeggiated square lead.
    The beat grid starts at t=0, so a pixel scene that uses the same bpm and absolute time lands on the kicks."""
    n = int(d * SR)
    out = np.zeros(n)
    beat = 60.0 / bpm
    root = 110.0 * 2 ** ((seed % 5) / 12)          # A2-ish, key varies per video
    pent = [0, 3, 5, 7, 10, 12, 15, 12, 10, 7, 5, 3]  # minor pentatonic walk
    prog = [0, 0, 5, 3]                              # bass root per bar (semitones)
    def add(sig, t0, gain):
        i = int(t0 * SR)
        m = min(len(sig), n - i)
        if i >= 0 and m > 0:
            out[i:i + m] += sig[:m] * gain
    nb = int(d / beat) + 1
    for b in range(nb):
        t0 = b * beat
        bar, pos = divmod(b, 4)
        if pos in (0, 2):
            add(sound("thud", rng) * 1.1, t0, 0.9)                                # kick
        if pos in (1, 3):
            sn = hp(rng.standard_normal(int(0.16 * SR)), 1500) * env_exp(int(0.16 * SR), 0.05)
            add(sn / (np.max(np.abs(sn)) + 1e-9), t0, 0.5)                          # snare
        for h in range(2):                                                          # 8th hats
            th = t0 + h * beat / 2
            ht = hp(rng.standard_normal(int(0.04 * SR)), 6000) * env_exp(int(0.04 * SR), 0.01)
            add(ht / (np.max(np.abs(ht)) + 1e-9), th, 0.22 if h == 0 else 0.14)
            # square bass on the 8ths
            bf = root * 2 ** (prog[bar % 4] / 12) * (1 if (b * 2 + h) % 4 != 3 else 1.5)
            bn = square(bf, beat / 2 * 0.9, 0.5) * env_exp(int(beat / 2 * 0.9 * SR), 0.18)
            add(bn, th, 0.32)
        for q in range(4):                                                          # 16th-note arpeggio (lead)
            tq = t0 + q * beat / 4
            deg = pent[(bar * 4 + pos * 2 + q) % len(pent)] + prog[bar % 4]
            ln = square(root * 4 * 2 ** (deg / 12), beat / 4 * 0.85, 0.25) * env_exp(int(beat / 4 * 0.85 * SR), 0.09)
            add(ln, tq, 0.16)
    out = np.round(out * 7) / 7                                                      # bit-crush: 8-bit feel
    return out * 0.55


def pulse_bed(channel, d, bpm, seed, rng):
    """Not a song: the channel's ambient drone plus a soft, deep pulse on every beat (and a faint tick on the off-beat),
    on the same grid the pixel scenes use, so motion lands on the pulse."""
    n = int(d * SR)
    out = bed(channel, d, seed, rng) * 0.7
    beat = 60.0 / bpm
    for b in range(int(d / beat) + 1):
        t0 = b * beat
        th = sound("thud", rng)
        i = int(t0 * SR)
        m = min(len(th), n - i)
        if m > 0:
            out[i:i + m] += th[:m] * (0.5 if b % 4 == 0 else 0.32)
        tk = sound("tick", rng)
        j = int((t0 + beat / 2) * SR)
        m = min(len(tk), n - j)
        if m > 0:
            out[j:j + m] += tk[:m] * 0.07
    return out


def speech_duck(plan, n):
    """gain curve for the bed: lower while someone is speaking"""
    g = np.ones(n)
    for s in plan["segs"]:
        a, b = int(s["speechStart"] * SR), int(s["speechEnd"] * SR)
        g[max(0, a):min(n, b)] = 0.35
    k = int(0.15 * SR)
    return np.convolve(g, np.ones(k) / k, mode="same")


def main():
    args = sys.argv[1:]
    plan = json.load(open(args[0]))
    out = args[1]
    voice = args[args.index("--voice") + 1] if "--voice" in args else None
    use_bed = "--no-bed" not in args
    total = plan["totalFrames"] / plan["fps"]
    n = int(total * SR) + SR // 2
    rng = np.random.default_rng(plan["style"]["seed"] & 0xFFFFFFFF)
    mix = np.zeros(n)
    if use_bed:
        if plan.get("music") == "pulse":
            b = pulse_bed(plan["channel"], total + 0.5, plan.get("bpm") or 100, plan["style"]["seed"], rng)
        elif plan.get("music") == "chip":
            b = chip_bed(total + 0.5, plan.get("bpm") or 120, plan["style"]["seed"], rng)
        else:
            b = bed(plan["channel"], total + 0.5, plan["style"]["seed"], rng)
        g = speech_duck(plan, len(b))
        mix[: len(b)] += b * g * (1.0 if plan.get("music") == "chip" else 0.55)
    for c in plan.get("cues", []):
        s = sound(c["name"], np.random.default_rng(zlib.crc32(f"{c['name']}{c['t']:.2f}".encode())), c.get("dur"), c.get("f"))
        i = int(max(0, c["t"]) * SR)
        m = min(len(s), n - i)
        if m > 0:
            mix[i:i + m] += s[:m] * c.get("gain", 0.6) * 0.8
    if voice:
        mix *= 0.8                      # leave headroom for the voice
        import wave
        w = wave.open(voice)
        v = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(float) / 32768
        if w.getnchannels() == 2:
            v = v.reshape(-1, 2).mean(1)
        m = min(len(v), n)
        mix[:m] += v[:m] * 1.0
    # gentle master limiter
    peak = np.max(np.abs(mix)) + 1e-9
    if peak > 0.95:
        mix = np.tanh(mix / peak * 1.2) / np.tanh(1.2) * 0.95
    st = np.stack([mix, mix], 1)
    import wave
    with wave.open(out, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(st, -1, 1) * 32767).astype(np.int16).tobytes())


if __name__ == "__main__":
    main()
