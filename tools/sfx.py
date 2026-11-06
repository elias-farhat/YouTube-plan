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


def sound(name, rng, dur=None, f=None, voice=None):
    x = _sound(name, rng, dur, f, voice)
    return x * (0.9 / (np.max(np.abs(x)) + 1e-9))   # every effect peaks at 0.9; cue gains do the balancing


def _sound(name, rng, dur=None, f=None, voice=None):
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
    if name == "blip":                                   # speech blip; `voice` picks the character's sound
        f0 = f or 600.0
        v = voice or "retro"
        if v == "zap":                                    # bright saw with a falling chirp
            t = t_axis(0.05); fr = f0 * 1.15 * (1.6 - 5 * t)
            return fade(((2 * ((np.cumsum(fr) / SR) % 1.0) - 1) * np.exp(-t * 30)), 0.001, 0.01) * 0.6
        if v == "bubble":                                 # soft sine that bends upwards
            t = t_axis(0.08); fr = f0 * 0.7 * (0.85 + 5 * t)
            return fade(np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * 22), 0.002, 0.02)
        if v == "robot":                                  # low, buzzy ring-modulated square
            t = t_axis(0.065)
            return fade(np.where((t * f0 * 0.55) % 1.0 < 0.25, 1.0, -1.0) * (0.6 + 0.4 * np.sin(2 * np.pi * 95 * t)) * np.exp(-t * 26), 0.001, 0.012) * 0.6
        if v == "bell":                                   # glassy bell, a little ring
            t = t_axis(0.16)
            return fade(sum(a * np.sin(2 * np.pi * f0 * m * t) * np.exp(-t * dc) for m, a, dc in ((1, 1.0, 16), (2.76, 0.4, 22), (5.4, 0.18, 30))), 0.001, 0.03) * 0.55
        if v == "chirp":
            t = t_axis(0.04); fr = f0 * (1.0 + 11 * t)
            return fade((4 * np.abs((np.cumsum(fr) / SR) % 1.0 - 0.5) - 1) * np.exp(-t * 28), 0.001, 0.008)
        t = t_axis(0.055)                                 # retro (default)
        return fade(np.where((t * f0) % 1.0 < 0.5, 1.0, -1.0) * np.exp(-t * 38), 0.001, 0.01) * 0.6
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
    if name == "crack":                                   # lightning crack: sharp noise burst + falling rumble
        t = t_axis(1.6)
        c = hp(rng.standard_normal(len(t)), 900) * env_exp(len(t), 0.05)
        r = lp(rng.standard_normal(len(t)), 220) * env_exp(len(t), 0.5) * 2.0
        return fade(c * 1.1 + r, 0.001, 0.2)
    if name == "thunder":                                 # long rolling rumble
        d = dur or 2.8
        n = int(d * SR)
        x = np.linspace(0, 1, n)
        r = lp(rng.standard_normal(n), 260) * (np.sin(np.pi * x) ** 0.8) * (1 + 0.6 * np.sin(2 * np.pi * 5.5 * x + rng.random() * 6))
        return fade(r * 2.2, 0.15, 0.4)
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


def wave(kind, freq, n, duty=0.5):
    ph = (np.arange(n) / SR * freq) % 1.0
    if kind == "square":
        return np.where(ph < duty, 1.0, -1.0)
    if kind == "saw":
        return 2 * ph - 1
    if kind == "tri":
        return 4 * np.abs(ph - 0.5) - 1
    return np.sin(2 * np.pi * ph)


def pat(s):
    return [1.0 if c == "1" else 0.5 if c == "h" else 0.0 for c in s.replace(" ", "")]


# Each song: 16 steps per bar (16th notes).  kick/snare/hat patterns, bass offsets (semitones or None), lead pattern + scale.
SONGS = {
    "arcade": dict(kick=pat("1000 0000 1000 0000"), snare=pat("0000 1000 0000 1000"), hat=pat("1h1h 1h1h 1h1h 1h1h"),
                   bass=[0, None, 0, None, 0, None, 7, None] * 2, bass_wave="square", lead=pat("1111 1111 1111 1111"), lead_wave="square", lead_duty=0.25,
                   lead_gate=0.85, lead_gain=0.16, lead_oct=4, scale=[0, 3, 5, 7, 10, 12, 15, 12, 10, 7, 5, 3], prog=[0, 0, 5, 3], crush=7),
    "storm": dict(kick=pat("1001 0010 1001 0010"), snare=pat("0000 1000 0000 1000"), hat=pat("1h1h 1h1h 1h1h 1h1h"),
                  bass=[0, 0, None, 0, 0, 0, None, 12, 0, 0, None, 0, 0, 7, None, 10], bass_wave="saw", lead=pat("1101 1011 1101 1011"), lead_wave="saw", lead_duty=0.5,
                  lead_gate=0.7, lead_gain=0.13, lead_oct=4, scale=[0, 3, 7, 10, 12, 10, 7, 3, 0, 5, 8, 12], prog=[0, -4, -2, -5], crush=6),
    "sunny": dict(kick=pat("1000 0010 1000 0010"), snare=pat("0000 1000 0000 1000"), hat=pat("1010 1010 1010 1010"),
                  bass=[0, None, None, 0, 7, None, None, 7, 5, None, None, 5, 7, None, 4, None], bass_wave="tri", lead=pat("1010 1010 1011 1010"), lead_wave="square", lead_duty=0.5,
                  lead_gate=0.5, lead_gain=0.2, lead_oct=4, scale=[0, 2, 4, 7, 9, 12, 9, 7, 4, 2, 4, 7], prog=[0, 5, 7, 5], crush=8),
    "mystery": dict(kick=pat("1000 0000 0000 1000"), snare=pat("0000 0000 0000 0000"), hat=pat("0010 0010 0010 0010"),
                    bass=[0, None, None, None, None, None, None, None, 7, None, None, None, None, None, None, None], bass_wave="sine", bass_gate=3.5, lead=pat("1010 1010 1010 1010"),
                    lead_wave="tri", lead_duty=0.5, lead_gate=0.9, lead_gain=0.22, lead_oct=4, scale=[0, 1, 3, 7, 8, 7, 3, 1], prog=[0, 0, -2, -4], echo=True, crush=9),
    "dream": dict(kick=pat("1000 0000 0010 0000"), snare=pat("0000 0000 0000 0000"), hat=pat("0010 0010 0010 0010"),
                  bass=[0, None, None, None, None, None, None, None, 5, None, None, None, None, None, None, None], bass_wave="sine", bass_gate=3.5, lead=pat("1010 1010 1010 1010"),
                  lead_wave="tri", lead_duty=0.5, lead_gate=1.2, lead_gain=0.2, lead_oct=4, scale=[0, 4, 7, 11, 12, 11, 7, 4], prog=[0, 5, 7, 4], echo=True, crush=10),
    "funk": dict(kick=pat("1001 0010 0100 0010"), snare=pat("0000 1000 0000 1001"), hat=pat("1h1h 1h1h 1h1h 1h1h"),
                 bass=[0, 0, None, 7, None, 5, None, 0, 0, None, 10, None, 7, None, 5, None], bass_wave="square", lead=pat("0010 0100 0010 0101"), lead_wave="square", lead_duty=0.25,
                 lead_gate=0.6, lead_gain=0.15, lead_oct=4, scale=[0, 3, 5, 7, 10, 12], prog=[0, 0, 5, 5], crush=7),
    "glitch": dict(kick=pat("1000 1000 1000 1000"), snare=pat("0000 0000 0000 0010"), hat=pat("0101 0101 0101 0101"),
                   bass=[0, 0, 12, 0, 0, 0, 12, 0, 0, 0, 12, 0, 0, 0, 12, 7], bass_wave="saw", lead=pat("1011 0110 1011 0110"), lead_wave="square", lead_duty=0.125,
                   lead_gate=0.5, lead_gain=0.13, lead_oct=4, scale=[0, 7, 12, 15, 19, 15, 12, 7], prog=[0, 0, 3, 5], crush=5),
    "epic": dict(kick=pat("1000 1000 1000 1000"), snare=pat("0000 1000 0000 1000"), hat=pat("0010 0010 0010 0010"),
                 bass=[0, None, 0, None, 0, None, 0, None, 0, None, 0, None, 7, None, 7, None], bass_wave="square", lead=pat("1000 0000 1000 0000"), lead_wave="square", lead_duty=0.5,
                 lead_gate=3.6, lead_gain=0.17, lead_oct=4, scale=[0, 7, 12, 10, 7, 3], prog=[0, -4, -9, -2], crash=True, crush=7),
}


def chip_bed(d, bpm, seed, rng, song="arcade"):
    """Chiptune locked to `bpm` (beat grid starts at t=0, so pixel scenes and Dr. Bit's bounce land on it).
    `song` picks one of SONGS: different scale, rhythm, bass and lead voice per video."""
    S = SONGS.get(song, SONGS["arcade"])
    n = int(d * SR)
    out = np.zeros(n)
    beat = 60.0 / bpm
    step = beat / 4
    root = 55.0 * 2 ** ((seed % 5) / 12)

    def add(sig, t0, g):
        i = int(t0 * SR)
        m = min(len(sig), n - i)
        if i >= 0 and m > 0:
            out[i:i + m] += sig[:m] * g

    note_i = 0
    for k in range(int(d / step) + 1):
        bar, st = divmod(k, 16)
        t0 = k * step
        prog = S["prog"][bar % len(S["prog"])]
        if S["kick"][st]:
            add(sound("thud", rng), t0, 0.9 * S["kick"][st])
        if S["snare"][st]:
            sn = hp(rng.standard_normal(int(0.16 * SR)), 1500) * env_exp(int(0.16 * SR), 0.05)
            add(sn / (np.max(np.abs(sn)) + 1e-9), t0, 0.5)
        if S["hat"][st]:
            ht = hp(rng.standard_normal(int(0.04 * SR)), 6500) * env_exp(int(0.04 * SR), 0.01)
            add(ht / (np.max(np.abs(ht)) + 1e-9), t0, 0.2 * S["hat"][st] + 0.06)
        if st == 0 and S.get("crash") and bar % 4 == 0:
            cr = hp(rng.standard_normal(int(0.7 * SR)), 3000) * env_exp(int(0.7 * SR), 0.25)
            add(cr / (np.max(np.abs(cr)) + 1e-9), t0, 0.25)
        b = S["bass"][st]
        if b is not None:
            ln = int(step * S.get("bass_gate", 1.8) * SR)
            add(wave(S["bass_wave"], root * 2 ** ((prog + b) / 12), ln) * env_exp(ln, 0.18 if S.get("bass_gate") is None else 1.2), t0, 0.32)
        if S["lead"][st]:
            deg = S["scale"][note_i % len(S["scale"])]
            note_i += 1
            ln = int(step * S["lead_gate"] * SR)
            sig = wave(S["lead_wave"], root * S["lead_oct"] * 2 ** ((deg + prog) / 12), ln, S["lead_duty"]) * env_exp(ln, 0.09 if S["lead_gate"] < 2 else 0.9)
            add(sig, t0, S["lead_gain"])
            if S.get("echo"):
                add(sig, t0 + beat * 0.75, S["lead_gain"] * 0.45)
    # steady pulse: a soft kick on every beat the song's own pattern skips, plus a quiet pad so the level never dips (clean loop)
    for kb in range(int(d / beat) + 1):
        if not S["kick"][(kb * 4) % 16]:
            add(sound("thud", rng), kb * beat, 0.30)
    tt = np.arange(n) / SR
    out += 0.05 * (np.sin(2 * np.pi * root * 2 * tt) + 0.7 * np.sin(2 * np.pi * root * 3 * tt)) * (0.85 + 0.15 * np.sin(2 * np.pi * tt / (beat * 4)))
    out = np.round(out * S["crush"]) / S["crush"]
    return out * 0.55


def pulse_bed(channel, d, bpm, seed, rng):
    """Not a song: the channel's ambient drone plus a soft, deep pulse on every beat (and a faint tick on the off-beat),
    on the same grid the pixel scenes use, so motion lands on the pulse."""
    n = int(d * SR)
    out = bed(channel, d, seed, rng) * 0.7
    beat = 60.0 / bpm
    for b in range(int(d / beat) + 1):
        t0 = b * beat
        def put(sig, tt, g):
            i = int(tt * SR)
            m = min(len(sig), n - i)
            if i >= 0 and m > 0:
                out[i:i + m] += sig[:m] * g
        put(sound("thud", rng), t0, 0.55 if b % 4 == 0 else 0.4)                       # soft kick on every beat
        if b % 2 == 1:                                                                    # light clap on 2 and 4
            cl = hp(rng.standard_normal(int(0.12 * SR)), 1200) * env_exp(int(0.12 * SR), 0.035)
            put(cl / (np.max(np.abs(cl)) + 1e-9), t0, 0.16)
        for q in range(4):                                                                # hats: off-beat louder, 16ths faint
            ht = hp(rng.standard_normal(int(0.03 * SR)), 7000) * env_exp(int(0.03 * SR), 0.008)
            put(ht / (np.max(np.abs(ht)) + 1e-9), t0 + q * beat / 4, 0.12 if q == 2 else 0.05)
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
    if plan["channel"] not in ("history", "money", "space"):
        plan["channel"] = "space"          # e.g. `science` reuses the space sound bed
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
            b = chip_bed(total + 0.5, plan.get("bpm") or 120, plan["style"]["seed"], rng, plan.get("song") or "arcade")
        else:
            b = bed(plan["channel"], total + 0.5, plan["style"]["seed"], rng)
        g = np.ones(len(b)) if plan.get("mode") == "bits" else speech_duck(plan, len(b))     # nobody narrates in bits mode: keep the beat full
        mix[: len(b)] += b * g * (1.0 if plan.get("music") == "chip" else 0.55)
    for c in plan.get("cues", []):
        s = sound(c["name"], np.random.default_rng(zlib.crc32(f"{c['name']}{c['t']:.2f}".encode())), c.get("dur"), c.get("f"), c.get("voice"))
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
    # master loudness: match the references (~ -15.5 dBFS average level), then limit
    hop = SR // 30
    fr = np.array([np.sqrt((mix[i * hop:(i + 1) * hop] ** 2).mean() + 1e-12) for i in range(len(mix) // hop)])
    cur = float(np.mean(20 * np.log10(fr + 1e-6)))
    if not voice:
        gain = float(np.clip(10 ** ((-18.4 - cur) / 20), 0.05, 3.0)); print(f"[sfx] mean {cur:.1f} dB gain {gain:.2f}", file=sys.stderr); mix *= gain
    # gentle master limiter
    peak = np.max(np.abs(mix)) + 1e-9
    if not voice:
        mix = np.tanh(mix) * 0.98          # soft clip: keeps the loudness set above (no peak re-normalising)
    elif peak > 0.95:
        mix = np.tanh(mix / peak * 1.2) / np.tanh(1.2) * 0.95
    st = np.stack([mix, mix], 1)
    import wave
    with wave.open(out, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(st, -1, 1) * 32767).astype(np.int16).tobytes())


if __name__ == "__main__":
    main()
