# Faceless Shorts factory: Remotion + Manim

One YAML script in `scripts/<channel>/` → one **1080×1920, 30–50 s MP4 with burned-in captions** in `output/`.

| Channel | Engine | Look |
|---|---|---|
| `money` | **Remotion** (React) | animated line/bar charts, count-up numbers, bold kinetic text; dark background, green/gold accents |
| `space` | **Manim CE** (+ Remotion for captions) | 2D motion graphics: shaded planets, orbits, a light pulse with live timer, scale comparisons, counters |
| `history` | **Remotion** | animated Mercator map: a sweeping frontier that conquers territory (marching-dash borders), animated routes, pins, labels, year counter |

```bash
npm install                 # Remotion, React, js-yaml ... (also needs ffmpeg on PATH)
npm run setup               # creates .venv with Manim, edge-tts, Piper
npm run render all          # every script in scripts/*/   ->  output/
npm run render money        # one channel
npm run render scripts/space/sunlight-delay.yaml   # one script
```

Handy extras: `npm run check` (parse every script, estimate length, show the chosen look, no render), `npm test`, `npm run studio` (Remotion preview; the CLI injects real props, the studio shows a placeholder), and the dev flag `npm run render money -- --stills 3,12,25` which writes PNG stills to `build/<video>/stills/`.

## Next week's video

1. Copy a script: `cp scripts/money/coffee-habit.yaml scripts/money/my-topic.yaml`
2. Edit `title`, `hook`, `lines`.
3. `npm run check` (fits 30–50 s?) then `npm run render money`.

Outputs: `output/<channel>_<slug>.mp4` plus `.narration.txt`, `.cues.txt`, `.srt`.

## Script format (YAML)

```yaml
title: The $5 Habit That Costs You $172,000
hook: "Your daily coffee costs {$172,000|one hundred seventy two thousand dollars}."   # first ~2 s, spoken + shown huge
seed: 3                                    # optional: pins the look (default: hash of the title)
style: {palette: lime_gold, layout: B}     # optional: pin any part of the look
handle: "@MyChannel"                       # optional watermark
voice: en-US-GuyNeural                     # optional edge-tts voice
lines:
  - say: "Five dollars a day sounds like nothing."
    visual: {type: kinetic, text: ["*$5* a day", "sounds like", "*nothing*"]}
  - say: "But that is {$1,825|eighteen twenty five dollars} every single year."
    visual: {type: stat, label: "Five dollars a day", from: 0, to: 1825, prefix: "$", trend: down}
```

* `hook`: ≤ 8 words. It becomes a ~2 s opening scene: the sentence as giant kinetic text (captions are replaced by that text).
* `say`: narration for one scene. `{shown|spoken}` shows `$172,000` on screen but speaks "one hundred seventy two thousand dollars"; punctuation right after `}` stays attached.
* `visual`: omit it and the line gets auto kinetic text. `note:` adds a small footnote under the visual.
* The script must land in **30–50 s** (the renderer tells you how many words to add/cut; `--any-length` overrides).

### Visual types

| channel | type | fields |
|---|---|---|
| all | `kinetic` | `text: [rows]`, `*highlight*`, `dark: true` (black-out slam for the peak line) |
| money, history | `stat` | `label`, `value` **or** `from`+`to` (counts), `prefix`, `suffix`, `decimals`, `sub`, `trend: up\|down`, `impact: true` (shake + flash when the count lands) |
| money | `line` | `title`, `x: [tick labels]`, `y: [values]`, `prefix`, `suffix`, `color: green\|gold\|red`, `delta`, `ymin` |
| money | `bar` | `title`, `x`, `y`, `prefix`, `suffix`, `highlight: [i]`, `bad: [i]`, `orient: v\|h` |
| space | `counter` | `label`, `from`, `to`, `prefix`, `suffix`, `decimals`, `sub` |
| space | `orbit` | `vanish: true` (Sun winks out, its last light keeps travelling), `label` |
| space | `lightbeam` | `from`, `to`, `time: "8:19"`, `distance: "149.6 million km"`, `title` |
| space | `ladder` | `title`, `items: [{name, label}]` (Earth, Mars, Jupiter, Saturn, Neptune, ...), `note` |
| space | `scale` | `big: Sun`, `small: Earth`, `count: 109` |
| history | `battle` | `title`, `dead: 50000`, `rome`, `enemy` (schematic of Cannae: the pincers close, the legions fall) |
| history | `stamps` | `title`, `items: [{text, tag}]` (cards slammed onto the screen one by one) |
| history | `map` | `year: "117 AD"`, `from`, `view: empire` or `"italy>med"` (camera move) or `lon,lat,span`, `cities: [Rome]`, `route: [A, B, C]`, `labels: [{text, at: [lon, lat]}]`, `label`, `origin`, `icon: elephant\|ship\|army` (marching route head), `battles: [Cannae]` (red X), `burn: [Carthage]` (fire), `tint: red` |

History scripts declare territory once, by modern country (names from `data/world_110m.json`), and each `map` scene animates it:

```yaml
territories:
  - {year: 264 BC, countries: [Italy]}
  - {year: 133 BC, countries: [Spain, Portugal, Tunisia, Greece]}
```

A scene with `year: 133 BC` shows earlier territory solid, and the countries gained in 133 BC are conquered by a dashed frontier ring sweeping out from the heart of the empire (the borders of the new land "march" with moving dashes). `route` draws a curved, dashed, animated path with an arrowhead and waypoint chips. Places are built-in names (Rome, Carthage, Athens, Alexandria, Alps, ...) or `"Name@lat,lon"`. Presets for `view`: `italy med empire west_med east_med europe wide`.

### More scene types

| type | what | fields |
|---|---|---|
| `pixel` | retro pixel art on a tiny canvas, **locked to a BPM** (sun/planets pulse, equalizer, typed lyrics, 1 px screen kick) | `scene: planets\|rocket`, `bits: 32\|16\|8` (32 = ~216 px wide, rich shading, readable 5x7 text; 16 = 128 px; 8 = 80 px, four Game-Boy greens), `res` (override the canvas width), `palette: neon\|sunset\|aurora\|gameboy`, `bpm`, `lyrics: [one per bar]`, `title`. Works in every channel. For a song feel add `music: chip` and `bpm:` at the top of the script: a chiptune (kick, snare, hats, square bass + arpeggio) is generated on the same beat grid |
| `clip` | any pre-rendered video as a scene (Blender renders, footage) | `src: "gen/blender/earth.mp4"` (inside `public/`), `full: true` for full-frame |

`engine: remotion` on a space script draws it with Remotion instead of Manim (needed for `pixel` / `clip` in the space channel).

### 3D with Blender

`npm run render3d` renders `blender/earth3d.py` with Blender's Python module (`pip install bpy`, ~400 MB, no GPU needed: Cycles on the CPU) into `public/gen/blender/earth.mp4`. That scene is a lit Earth (continents, clouds, atmosphere, night side) with an orbiting Moon, stars and a slow push-in; everything is procedural, no image files. It takes about 15 minutes for 6 s at 540x960 (upscaled to 1080x1920); `-- --width 1080 --height 1920 --samples 24` is cleaner and slower. Use it in a script with `{type: clip, src: "gen/blender/earth.mp4", full: true}`. New 3D scenes = new `blender/*.py` files.

### Showcase

`npm run render demos` renders one 6-8 s example of every animation type from `scripts/demos/*.yaml` into `output/demos/`. A demo script has `demo: true` (no hook scene, no 30-50 s rule) and `hold: 6` per line.

### "Bits" mode (no narration)

`mode: bits` at the top of a script removes the voice completely. A little pixel character types each line (`hook:` and every `say:`) on screen, one letter per 16th note, with a speech blip per letter, over a chiptune (`music: chip`, `bpm: 120`) and the sound effects. Each scene lasts a whole number of bars, so every cut lands on a downbeat (use 120 or 150 BPM so bars are whole frames). Keep lines short (~30 characters = a 6 s scene). See `scripts/space/hello-i-am-a-pulsar.yaml` and `stardust-you.yaml`.

### Science with Dr. Bit (`channel: science`)

General "how does it work?" videos (lightning, plants, devices...). Same `mode: bits` format, Dr. Bit speaks. The retention recipe baked into the scripts:

1. **Hook in under 3 s**: one shocking, true fact (`hook:` is typed twice as fast and starts on frame 1) with a visual hit on frame 1.
2. **Open loop** on the first or second line (a question or gap the next lines answer; never announce it).
3. **A new visual every 6 s** (one scene per line, whole bars), so nothing sits still.
4. **Peak = the twist** (`mood: aha`, riser, boom/shake).
5. **Payoff that calls back the hook**, then a useful bonus line.

Pixel science scenes so far: `storm` (strike, ice, charge, leader, return, heat, thunder, count) and `plant` (tree, sunleaf, roots, stomata, split, sugar, grow). See `scripts/science/`. Palettes for pixel scenes: `neon`, `sunset`, `aurora`, `pulsar`, `storm`, `day`, `gameboy`.

### Hook and peak

`hook` is the first ~2 s. By default it becomes giant kinetic text; give it a visual with `hook_visual:` (e.g. a counting number) and the spoken hook is captioned as usual. A line can carry `sfx: [riser]` (a tension build that ends where the line starts), `boom`, `hit`, `stamp` or `sting`. Put the riser on the line *before the peak* and `kinetic: {dark: true}` on the peak itself.

## Sound

Everything you hear is synthesised (`tools/sfx.py`, no samples, no network): whooshes on scene changes, hits on highlighted words, stamps, counter ticks, clashes, fire crackle, a riser and boom, plus a quiet ambient bed per channel (war-drum heartbeat for history, soft pulse for money, airy pad for space) that ducks under the voice. Cues are derived from what is on screen, and every hit also shakes the camera and flashes the frame. `--no-sfx` turns it all off. Audio is muxed after the frames are rendered, so changing the voice or sounds does **not** re-render the video.

## Variation (nothing looks mass-produced)

A seed (hash of the title, or `seed:`) picks, per video: **palette** (6 per channel; money is always dark with green/gold accents), **layout** `A/B/C` (visual on top / captions on top / tall visual), **pacing** (snappy, steady, cinematic: speech speed, transition length, gaps, camera push), **caption style** (3 per channel), **transition** (fade, slide, wipe, zoom, push), **kinetic animation** (pop, slide, drop, stack + pill/colour highlights), **header** (chip, line, banner), **background motif** and chart orientation. Pin any of them with `style:` in the script. `npm run check` prints the look of every script.

## Voice: edge-tts → Piper → silent

`tools/tts.py` tries, in order:

1. **edge-tts** (free neural voices; needs internet access to Microsoft's endpoint). Gives real word timings, so captions follow the voice.
2. **Piper** (offline). Needs a voice model: download e.g. `en_US-lessac-medium.onnx` + `.onnx.json` from <https://huggingface.co/rhasspy/piper-voices> into `models/piper/` (the script also tries to fetch it automatically).
3. **No voice.** The video is rendered silent (with a silent audio track so uploaders accept it), captions stay burned in, and `output/<name>.narration.txt` + `.cues.txt` (start time of each line) are written for you to voice in CapCut: import the MP4 → Text → Text to speech (or record) → place each line at its cue time. Timings assume ~150 words per minute.

Force a mode with `npm run render money -- --tts none|edge|piper`.

### Round trip with CapCut (voice recorded elsewhere)

1. `npm run render history` → silent video + `.narration.txt` / `.cues.txt`.
2. Voice it in CapCut (paste the narration), export, and drop the file in `voices/` named `<channel>_<slug>.m4a` (e.g. `voices/history_rome-never-quit.m4a`; mp3/wav/mp4 also work), or pass `--voice path/to/file`.
3. `npm run render history` again: `tools/voice_import.py` finds the speech chunks, aligns them to the script lines (using offline speech recognition as a second signal), cuts a clip per line, and the whole video **re-times itself to the voice**: scenes stretch, captions follow the words. Extra audio after the last script line (a dropped outro) is ignored.

## Layout

```
scripts/<channel>/*.yaml   input         output/   MP4 + narration/cues/srt
tools/render.mjs           the one command (YAML -> TTS -> plan -> Manim/Remotion -> ffmpeg)
tools/lib/                 script loader, seeded variation + palettes, timeline
tools/tts.py               edge-tts / Piper bridge        tools/build_map_data.py   regenerate map data
src/                       Remotion: Shorts.tsx (all channels), components/ (captions, chrome, background), scenes/ (money + shared), history/ (map)
manim/space_scene.py       Manim scenes for the space channel
data/world_110m.json       Natural Earth 110m countries (public domain)
public/fonts/              Inter (OFL) + DejaVu Serif, bundled so renders look identical everywhere
.agents/skills, .claude/skills   the official Remotion agent skills (npx skills add remotion-dev/skills)
```

## Requirements and notes

* Node 20+, Python 3.10+, ffmpeg. Manim on Linux also needs Pango/Cairo dev packages (`apt install libpango1.0-dev` on Debian/Ubuntu); no LaTeX needed (text only).
* Remotion renders with its own headless Chrome. If that download is blocked, the renderer falls back to a local Chromium (Playwright's, or set `REMOTION_BROWSER=/path/to/chrome`).
* Rendering takes roughly 1 min (money), 2 min (history), 3 min (space) on 4 cores.
* Remotion is free for individuals and small teams but has a company license above that size: check <https://www.remotion.dev/docs/license>.
* History territory is drawn by modern country on a 110 m map, an intentional simplification (the sample says so on screen).

### Dr. Bit placement (`bit:`)
Per line (and `hook_bit:` / `outro_bit:`): `bit: {x: 0.2, y: 0.8, s: 5}` = full-body Dr. Bit standing IN the scene (feet at x,y as fractions of the frame, `s` = pixel scale, `flip: true` to face left) with the text box above his head; `bit: off` = he leaves so the diagram/close-up is unobstructed (text box stays at the top); no `bit:` = small in the bottom-left corner. Costume via `outfit:` (lab, storm, gardener, astronaut, diver, hardhat).

Pointer + walking: `bit: {x: 0.2, y: 0.8, s: 5, point: {x: 0.5, y: 0.3}}` makes Dr. Bit raise a pointer stick at that spot (with a pulsing marker; he turns to face it). `to: {x: 0.7, y: 0.8}` makes him walk there during the first second of the line (legs step). Both can be combined.
Scenes added: `ocean` (reef/glow/pressure), `sky` (prism/scatter/sunset), `microwave` (oven/molecule/depth), `touch` (grid/charge/finger/scan/glove). Songs: arcade, storm, sunny, mystery, epic, dream, funk, glitch. Blips: retro, zap, bubble, robot, bell, chirp.
