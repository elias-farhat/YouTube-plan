# Reference videos: measured at 30 fps (frame-by-frame, no eyeballing)

Five reference Shorts: solar flare (v6), wombat (v2), LHC (v3), Chelyabinsk (v4), Mandelbrot (v7). All 720x1280, 30 fps, 44-56 s.

| | solar | wombat | LHC | meteor | mandelbrot |
|---|---|---|---|---|---|
| duration (s) | 56.0 | 46.0 | 52.5 | 44.0 | 45.0 |
| pixel block (px at 720 wide) | 4 | 4 | 4-8 | 4 | 4 |
| distinct colours / frame (5-bit) | ~700 | ~700 | ~1000 | ~850 | ~600 |
| on-screen text changes, median gap (s) | 2.0 | 2.0 | 2.4 | 2.6 | counter ticks |
| first-frame vs last-frame mean abs diff (0-255) | 8.1 | **1.3** | **1.8** | **2.3** | 9.8 |
| last frame vs middle frame | 45.7 | 19.0 | 24.9 | 70.7 | 211 |
| loudness first 1 s / last 1 s (dBFS) | -14.1 / -13.4 | -16.3 / -16.7 | -17.3 / -18.5 | -9.8 / -10.2 | -12.9 / -15.2 |
| tempo (autocorrelation) | 60/120 | 60/120 | ~64 (128) | 120 | ~64 (128) |
| energy share low / mid / high band | .26/.68/.06 | .15/.82/.03 | .20/.69/.10 | .19/.80/.02 | .17/.81/.02 |

## What the numbers say
1. **They end where they start.** Three of five end on a frame within 1.3-2.3 of frame 0 (vs 19-70 against the middle), and the audio level at the end equals the start. No fade, no silence tail: a seamless loop. Ours ended on a 2.0 s hold and a decaying tail, so it felt cut off.
2. **Audio starts at full level on frame 0** (peak loudness at t=0.0 s in two of them). The hook lands immediately.
3. **Text changes every ~2-2.5 s** inside long continuous scenes (scenes last 6-14 s). Ours changed text and scene every ~4.9 s.
4. **120 BPM (or 128) music**, almost all energy in 150-2000 Hz, i.e. a quiet melodic bed, no vocals.
5. **Native pixel art at a 4 px grid** (180x320 art scaled x4), ~600-1000 colours.
6. A persistent **@handle watermark**, a title card on frame 0 and a headphone icon on frame 0.

## Applied so far
- `outro:` line: Dr. Bit closes over the opening scene, last scene never fades -> loop-friendly ending.
- `pace: quick`: scenes snap to 2 beats (1 s at 120 BPM) instead of a bar, so text changes every ~3 s.
- `outfit:` Dr. Bit costume (`lab`, `storm`, `gardener`, `astronaut`, `diver`, `hardhat`) with ambient effects (floating, bubbles, rain, falling leaves).

# Batch 2: hearing test (w1, 36.0 s) and skin cells (w2, 32.1 s), 720x1280 @30 fps

| | hearing | skin | earlier 5 (range) | ours (science) |
|---|---|---|---|---|
| visual change events per second | 1.08 | 1.03 | 0.0-1.2 | 0.43-1.66 |
| events that land on the 15-frame beat grid (120 BPM; chance = 0.20) | **0.79** | **1.00** | 0.23-0.86 | quick pace: 2-beat snap |
| median gap between events | 0.55 s | 0.50 s (one beat) | 0.5-6 s | 0.5-1.6 s |
| mean pixel change per frame (motion) | 4.3 | 11.7 | 1.2-11.3 | 1.5-4.1 |
| first vs last frame difference (loop) | **2.1** | **1.9** | 1.3-9.8 | 4.4-13.7 (was 49-57 on 2 videos, fixed) |
| music tempo (autocorrelation) | 120 | 120 (corr .88) | 60-128 | 120 / 150 |
| energy below 150 Hz | 0.83 | 0.81 | 0.15-0.26 | 0.53-0.68 |
| loudness first 1 s / last 1 s (dBFS) | -14.6 / -16.1 | -15.3 / -16.7 | equal within 1.5 dB | n/a |

New findings
1. **Everything is quantised to the beat.** In 3 of the 7 references 79-100% of visual changes fall on the 15-frame grid (chance is 20%): cuts, text swaps, counter ticks. The counter in the skin video ticks every 15 frames.
2. **A persistent HUD**: a big gold number/title at the top that keeps updating (8,000 Hz -> 16,000 Hz; "SINCE YOU HIT PLAY 738 -> 14,000" live counter tied to the elapsed time), small white captions inside the scene, and a viewer prompt in the hook ("CAN YOU HEAR THIS?") and the outro ("COMMENT YOUR NUMBER", "FUN TEST, NOT MEDICAL").
3. **One hero scene with a moving camera** instead of many scene changes (cochlea spiral zooming for 25 s; brick wall scrolling for 25 s), ending back on the opening frame.
4. **Bass-heavy mix**: 81-83% of the energy below 150 Hz versus 15-26% in batch 1 (ours 53-68%).
5. The dominant-frequency track of the hearing tone could not be measured reliably (the music masks the sine), so no sweep schedule is claimed.

Applied: the loop outro now restarts the opening scene in its START state (loop error 49-57 -> 4.4-4.9).

# Ours vs references, same script (tools: frame diff at 30 fps on 90x160 gray, 22 kHz audio)

| Metric | References avg / median | Ours before | Ours after avg / median |
|---|---|---|---|
| Loop: first vs last frame (lower = seamless) | 3.90 / 2.11 | 8.22 | **0.28 / 0.28** |
| Beat-locked changes (own tempo grid) | 0.65 / 0.79 | 0.70 (150 BPM videos mis-measured on a 15f grid) | **0.94 / 1.00** |
| Beat clarity (autocorrelation) | 0.71 / 0.73 | 0.50 | 0.65 / 0.67 |
| Average loudness (dBFS) | -16.4 / -15.0 | -18.8 | -15.8 / -15.8 |
| Start vs end loudness jump (dB) | 2.73 / 3.54 | 4.21 | 3.09 / 2.49 |
| Motion per frame | 5.27 / 3.42 | 2.25 | 2.71 / 2.75 |
| Motion in first 3 s | 4.38 / 1.97 | 3.39 | 3.93 / 2.83 |
| Visual changes per second | 0.60 / 0.66 | 1.20 | 1.63 / 1.80 |
| Energy below 150 Hz | 0.37 / 0.20 | 0.59 | 0.68 / 0.68 |
| Colours per frame | 869 / 681 | 959 | 974 / 1050 |

Open gaps: motion (mean 2.71 vs 5.27; the reference mean is lifted by the two scrolling/zooming videos at 11.3 and 11.7, the median gap is 2.75 vs 3.42), beat clarity (0.65 vs 0.71), sky video start/end loudness jump (8.8 dB).
