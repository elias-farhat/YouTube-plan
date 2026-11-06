#!/usr/bin/env python3
"""Import a voice-over recorded elsewhere (CapCut TTS, your own mic) and align it to a script.

Same stdin/stdout protocol as tools/tts.py, so render.mjs can use it as the "voice":
  stdin : {"lines": ["spoken text", ...], "voiceFile": "voices/x.m4a", "outdir": "..."}
  stdout: {"engine": "imported", "status": "...", "lines": [{"file","duration","words","tight":true}]}

How: find speech chunks from the audio energy (pauses > 0.22 s split chunks), then a small DP assigns
consecutive chunks to consecutive words of the script (a chunk never spans two lines; pauses prefer to sit
at commas / full stops; predicted duration comes from word length).  Extra audio after the last script word
(e.g. a dropped outro line) is ignored.  Each line is cut into its own clip and gets per-word timings, so the
video re-times itself to the voice (scenes stretch, captions follow the words).
"""
import json
import os
import re
import subprocess
import sys
import wave

import numpy as np

HOP = 0.01


def weight(w):
    """rough spoken length of a word: digits are read out ("264" = "two sixty four"), BC/AD are spelled"""
    core = re.sub(r"[^A-Za-z0-9]", "", w)
    if re.search(r"\d", core):
        n = len(core) * 3.5
    elif len(core) <= 3 and core.isupper():
        n = len(core) * 2.5
    else:
        n = len(core)
    return 0.13 + 0.047 * max(1, n)


def decode(path, out):
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", path, "-vn", "-ac", "1", "-ar", "44100", out], check=True)
    w = wave.open(out)
    x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(float) / 32768
    return x, w.getframerate()


def chunks_from_audio(x, sr, min_gap=0.22, min_len=0.15, return_db=False):
    hop = int(sr * HOP)
    n = len(x) // hop
    e = np.sqrt(np.mean(x[: n * hop].reshape(n, hop) ** 2, axis=1))
    db = 20 * np.log10(e + 1e-9)
    thr = max(-55.0, np.percentile(db, 95) - 32)
    on = db > thr
    segs, start = [], None
    for i, v in enumerate(on):
        if v and start is None:
            start = i
        elif not v and start is not None:
            segs.append([start, i])
            start = None
    if start is not None:
        segs.append([start, n])
    merged = [segs[0]]
    for a, b in segs[1:]:
        if (a - merged[-1][1]) * HOP < min_gap:
            merged[-1][1] = b
        else:
            merged.append([a, b])
    chunks_ = [(a * HOP, b * HOP) for a, b in merged if (b - a) * HOP >= min_len]
    return (chunks_, db) if return_db else chunks_


ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()
TENS = "x x twenty thirty forty fifty sixty seventy eighty ninety".split()


def spoken_number(n):
    if n < 20:
        return ONES[n]
    if n < 100:
        return TENS[n // 10] + ("" if n % 10 == 0 else " " + ONES[n % 10])
    if n < 1000:
        return ONES[n // 100] + " hundred" + ("" if n % 100 == 0 else " " + spoken_number(n % 100))
    return spoken_number(n // 1000) + " thousand" + ("" if n % 1000 == 0 else " " + spoken_number(n % 1000))


def norm_word(w):
    """script word -> letters a recogniser would produce ('264' -> 'twohundredsixtyfour', 'BC' -> 'bc')"""
    core = re.sub(r"[^A-Za-z0-9]", "", w)
    if core.isdigit():
        return spoken_number(int(core)).replace(" ", "")
    return core.lower()


def asr_texts(x, sr, chunks):
    """Offline recognition of every chunk (pocketsphinx) -> list of letter strings; [] if unavailable."""
    try:
        from pocketsphinx import Decoder, get_model_path
    except ImportError:
        return None
    mp = get_model_path()
    d = Decoder(hmm=os.path.join(mp, "en-us/en-us"), lm=os.path.join(mp, "en-us/en-us.lm.bin"),
                dict=os.path.join(mp, "en-us/cmudict-en-us.dict"), loglevel="FATAL")
    y = np.interp(np.arange(0, len(x), sr / 16000.0), np.arange(len(x)), x)
    pcm = (np.clip(y, -1, 1) * 32767).astype(np.int16).tobytes()
    out = []
    for a, b in chunks:
        d.start_utt()
        d.process_raw(pcm[int(max(0, a - 0.1) * 16000) * 2: int((b + 0.1) * 16000) * 2], False, True)
        d.end_utt()
        out.append(re.sub(r"[^a-z]", "", d.hyp().hypstr.lower()) if d.hyp() else "")
    return out


def align(chunks, lines, asr=None):
    """-> (words, spans, used): spans[i] = (first_word, end_word) for chunk i; chunks after `used` are ignored.
    A chunk may span several lines (speaker ran sentences together); cuts inside a chunk are refined later.
    Cost = how well the recognised text matches the script words + how well the duration fits + pauses at punctuation."""
    from difflib import SequenceMatcher
    words = []  # (line, idx_in_line, text, weight, ends_phrase, ends_line, letters)
    for li, text in enumerate(lines):
        toks = text.split()
        for k, t in enumerate(toks):
            words.append((li, k, t, weight(t), bool(re.search(r"[.,;:!?]$", t)), k == len(toks) - 1, norm_word(t)))
    N, C = len(words), len(chunks)
    dur = [b - a for a, b in chunks]
    cw = np.concatenate([[0], np.cumsum([w[3] for w in words])])
    INF = 1e18

    def run(used):
        rate = sum(dur[:used]) / cw[N]
        dp = np.full((used + 1, N + 1), INF)
        back = {}
        dp[0][0] = 0
        for i in range(used):
            for j in range(N):
                if dp[i][j] >= INF:
                    continue
                for k in range(j + 1, N + 1):
                    pred = rate * (cw[k] - cw[j])
                    cost = 0.5 * ((dur[i] - pred) / (0.4 + pred)) ** 2 + (0.0 if words[k - 1][4] or words[k - 1][5] else 0.6)
                    if asr and asr[i]:
                        txt = "".join(w[6] for w in words[j:k])
                        cost += 4.0 * (1 - SequenceMatcher(None, asr[i], txt).ratio())
                    if dp[i][j] + cost < dp[i + 1][k]:
                        dp[i + 1][k] = dp[i][j] + cost
                        back[(i + 1, k)] = j
        return dp[used][N], back

    best = None
    for used in range(len(lines), C + 1):
        cost, back = run(used)
        cost += (1.5 if asr else 2.5) * (C - used)  # every ignored trailing chunk has to be paid for
        if cost < INF and (best is None or cost < best[0]):
            best = (cost, used, back)
    if best is None:
        raise RuntimeError("could not align the audio to the script (too few speech chunks?)")
    _, used, back = best
    spans, i, k = [], used, N
    while i > 0:
        j = back[(i, k)]
        spans.append((j, k))
        i, k = i - 1, j
    spans.reverse()
    return words, spans, used


def main():
    req = json.load(sys.stdin)
    lines, out = req["lines"], req["outdir"]
    os.makedirs(out, exist_ok=True)
    full = os.path.join(out, "voice_full.wav")
    x, sr = decode(req["voiceFile"], full)
    chunks, db = chunks_from_audio(x, sr, return_db=True)
    asr = asr_texts(x, sr, chunks)
    words, spans, used = align(chunks, lines, asr)

    # per-word times: proportional inside each chunk
    wt = [None] * len(words)
    chunk_of = [None] * len(words)
    for c, (j, k) in enumerate(spans):
        a, b = chunks[c]
        ws = [words[m][3] for m in range(j, k)]
        tot, t = sum(ws), a
        for m, w in zip(range(j, k), ws):
            wt[m] = [t, t + (b - a) * w / tot]
            chunk_of[m] = c
            t += (b - a) * w / tot

    first = {}
    last = {}
    for m, w in enumerate(words):
        first.setdefault(w[0], m)
        last[w[0]] = m
    n_lines = len(lines)
    for li in range(n_lines):
        if li not in first:
            raise RuntimeError(f"no audio found for line {li}: {lines[li]!r}")

    def quietest(t0, half=0.35):
        a, b = int(max(0, t0 - half) / HOP), int((t0 + half) / HOP)
        seg = db[a:b]
        return (a + int(np.argmin(seg))) * HOP if len(seg) else t0

    # cut points between consecutive lines
    cuts = []
    for li in range(1, n_lines):
        pw, nw = last[li - 1], first[li]
        if chunk_of[pw] == chunk_of[nw]:      # no pause between the lines: cut at the quietest moment near the estimate
            cuts.append(quietest(wt[nw][0]))
        else:                                  # pause between them: cut in the middle of the gap
            cuts.append((wt[pw][1] + wt[nw][0]) / 2)

    total_dur = len(x) / sr
    res = []
    for li in range(n_lines):
        w0, w1 = wt[first[li]][0], wt[last[li]][1]
        c0 = cuts[li - 1] if li > 0 else 0.0
        c1 = cuts[li] if li < n_lines - 1 else total_dur
        t0 = max(c0, w0 - 0.10)
        t1 = min(c1, w1 + 0.14)
        if t1 - t0 < 0.2:
            t1 = t0 + 0.2
        f = os.path.join(out, f"line_{li:02d}.wav")
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-ss", f"{t0:.3f}", "-t", f"{t1 - t0:.3f}", "-i", full,
                        "-af", f"afade=t=in:d=0.012,afade=t=out:st={max(0, t1 - t0 - 0.03):.3f}:d=0.03", f], check=True)
        rel = [[max(0.0, wt[m][0] - t0), max(0.01, wt[m][1] - t0)] for m in range(first[li], last[li] + 1)]
        res.append({"file": f, "duration": t1 - t0, "words": rel, "tight": True})
    extra = len(chunks) - used
    status = f"imported voice {os.path.basename(req['voiceFile'])} ({len(chunks)} speech chunks" + (f", ignored {extra} trailing" if extra else "") + ")"
    print(json.dumps({"engine": "imported", "status": status, "lines": res}))


if __name__ == "__main__":
    main()
