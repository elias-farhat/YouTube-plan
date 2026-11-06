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
