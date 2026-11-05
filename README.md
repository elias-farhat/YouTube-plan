# YouTube Shorts pipeline: money · space · history

Script file in → **1080×1920 MP4 (30–50 s) with burned-in, word-highlighted captions** out.
Pure Python (Pillow + numpy) for the animation, ffmpeg for encoding. No manim, no stock footage, nothing to download at render time.

| Channel | Template | Scene vocabulary |
|---|---|---|
| `money` | animated charts + kinetic text | `kinetic`, `stat`, `line`, `bar` |
| `space` | 2D motion graphics (shaded planets, light pulses, orbits) | `kinetic`, `stat`, `lightbeam`, `lightscale`, `orbit`, `sizes` |
| `history` | animated maps (Natural Earth, Mercator) with territory ripples, routes, year counter | `kinetic`, `stat`, `map` (alias `route`) |

## Quick start

```bash
pip install -r requirements.txt          # Pillow, numpy, edge-tts ; ffmpeg must be on PATH
./run_samples.sh                         # renders the 3 samples into samples/output/
python -m pipeline render my_script.txt -o output/
```

Useful commands:

```bash
python -m pipeline check  my_script.txt            # parse + estimated length + chosen look (instant)
python -m pipeline stills my_script.txt -o stills  # one PNG per line, to review the design fast
python -m pipeline render my_script.txt --scale 1  # 4x faster draft render (no supersampling)
python -m pipeline render my_script.txt --set palette=ember,layout=B,caption=bar
python -m pipeline render my_script.txt --tts none # force silent
python -m pipeline render my_script.txt --no-captions
```

A render takes about 45–70 s per video on 4 cores (2× supersampled for smooth edges).

## Script format

```text
title: Your Cash Is Quietly Shrinking
channel: money                    # money | space | history
seed: 3                           # optional - pins the look (default: hash of the title)
style: palette=ember layout=B     # optional - pin any part of the look
handle: @YourChannel              # optional watermark text
voice: en-US-GuyNeural            # optional Edge TTS voice
---
Hide {$10,000|ten thousand dollars} in a drawer and it quietly loses almost half its value.
> kinetic: Hide *$10,000* | in a drawer | and it quietly *shrinks*

The thief is inflation.
> stat: label=Inflation | value=3% | sub=lost every year | trend=down
```

* **Narration line** = one scene. Its duration is the spoken length of the line (real TTS audio length, or an estimate when silent).
* `{shown|spoken}` shows `$10,000` in the captions but speaks "ten thousand dollars" (TTS + timing). Punctuation right after `}` stays attached.
* **Visual note** `> kind: arg | arg | key=value` (optional; lines without one get auto kinetic text). `*word*` highlights in kinetic text. `note=...` adds a small footnote under the visual.
* Total length must land in **30–50 s** (guard rail; `--any-length` skips it). `python -m pipeline check` tells you the estimate and roughly how many words to cut/add.

### Visual notes

| channel | note | options |
|---|---|---|
| all | `kinetic: row \| row \| row` | rows split by `\|`, `*highlight*` |
| all | `stat:` | `label`, `value` **or** `from`+`to` (counts), `prefix`, `suffix`, `decimals`, `sub`, `trend=up\|down` |
| money | `line:` | `title`, `x=a,b,c` (tick labels), `y=1,2,3…`, `prefix`, `suffix`, `color=accent\|bad\|good`, `delta=-45%` |
| money | `bar:` | `title`, `x=…`, `y=…`, `prefix`, `suffix`, `highlight=1`, `bad=0`, `orient=v\|h` |
| space | `lightbeam:` | `from`, `to`, `time=8:19`, `distance=149.6 million km`, `title` |
| space | `lightscale:` | args `Earth@8.3 min \| Jupiter@43 min …`, `title` |
| space | `orbit:` | `vanish=1` (Sun winks out, last light keeps travelling), `label` |
| space | `sizes:` | `count=109` |
| history | `map:` | `year=117 AD`, `from=`, `view=empire` or `italy>med` (camera move), `cities=Rome,Carthage` (or `Name@lat,lon`), `route=A > B > C`, `label`, `origin` |

History videos define territory once in the header, by modern country (`world_110m.json` names), and every `map: year=…` note animates it: countries gained in that year ripple in from the centre of the empire, earlier gains stay filled.

```text
territory: 264 BC | Italy
territory: 133 BC | Spain, Portugal, Tunisia, Greece
```

View presets: `italy`, `med`, `empire`, `west_med`, `east_med`, `europe`, `wide`, or `lon,lat,span_degrees`.

## How videos stay different

Each channel is a *template* (fonts, chart/map language, background motif). Per video, a seed (hash of the title, or `seed:`) picks from:

* **palette** (6 per channel, incl. a light theme), **layout** `A/B/C` (captions below / above / low + taller visual),
* **caption style** (3 per channel), **header** (chip / line / banner), **background motif** (3 per channel),
* **pacing** (snappy / steady / cinematic: speech speed, transition length, gaps, camera push), **transition** (fade, slide, wipe, zoom, push),
* **kinetic-text animation** (pop, slide, drop, stack, plus pill vs colour highlights) and **chart orientation** (vertical / horizontal bars).

Every part can be pinned from the script header (`style:`) or with `--set`. The chosen look is printed on render and stored in `<slug>.json`.

## Voice: TTS or CapCut

`--tts auto` (default) tries Microsoft Edge neural voices via `edge-tts` (free, needs internet). If the network blocks it, the render **falls back to a silent MP4** (with a silent audio track so editors/uploaders accept it) and writes everything you need to add a voice yourself. In this repo's samples that fallback was used, because the build sandbox could not reach the TTS service.

Next to every `<slug>.mp4` you get:

| file | use |
|---|---|
| `<slug>.narration.txt` | the full voice-over text (numbers written the way they should be spoken) |
| `<slug>.cues.txt` | `[mm:ss.s] line`: when each narration line should start |
| `<slug>.srt` | the burned-in captions as timed subtitles |
| `<slug>.json` | durations, chosen style, per-line timings |

**CapCut workflow:** import the MP4 → Text → *Text to speech* (or record your own) for each line in `cues.txt`, starting it at the cue time → nudge speed so each line ends before the next cue. Timings are estimated for a ~150 wpm read, so a normal TTS voice lands within a fraction of a second. If you would rather caption inside CapCut, render with `--no-captions`.

When TTS works, line audio is rendered per line, mixed at the exact speech start of each scene, and the captions use the real word timings from the voice.

## Layout of the repo

```
pipeline/            script.py  parse the script          style.py       palettes + seeded variation
                     tts.py     Edge TTS + fallback       timeline.py    timing (real audio or estimate)
                     captions.py  burned-in captions      transitions.py scene-to-scene transitions
                     backgrounds.py  motifs + header      render.py      frame loop -> ffmpeg, sidecar files
                     scenes/    common · money · space (+ planets) · history
                     data/world_110m.json   Natural Earth 110m countries (public domain)
                     assets/fonts/          Inter (OFL) + DejaVu Serif
samples/scripts/     one script per channel          samples/output/   the rendered samples
tools/build_map_data.py   regenerate the map data     tests/            python -m unittest discover -s tests
```

### Adding a scene

Subclass `Scene` (`pipeline/scenes/base.py`), implement `draw(cv, t, dur)` (draw in 1080×1920 logical coordinates inside `self.x0..x1, self.y0..y1`; be a pure function of `t`), and register it in `pipeline/scenes/__init__.py`.

## Notes and limits

* History territories are drawn by **modern country** on a 110 m map, which is a deliberate simplification (the sample says so on screen). For finer borders swap in a higher-resolution dataset via `tools/build_map_data.py`.
* The sample facts are conservative and illustrative (the money numbers are straight compound-interest arithmetic, not advice).
* Fonts are bundled so renders are identical everywhere; Inter is SIL OFL licensed.
