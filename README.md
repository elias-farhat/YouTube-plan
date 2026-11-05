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
| all | `kinetic` | `text: [rows]`, `*highlight*` |
| money, history | `stat` | `label`, `value` **or** `from`+`to` (counts), `prefix`, `suffix`, `decimals`, `sub`, `trend: up\|down` |
| money | `line` | `title`, `x: [tick labels]`, `y: [values]`, `prefix`, `suffix`, `color: green\|gold\|red`, `delta`, `ymin` |
| money | `bar` | `title`, `x`, `y`, `prefix`, `suffix`, `highlight: [i]`, `bad: [i]`, `orient: v\|h` |
| space | `counter` | `label`, `from`, `to`, `prefix`, `suffix`, `decimals`, `sub` |
| space | `orbit` | `vanish: true` (Sun winks out, its last light keeps travelling), `label` |
| space | `lightbeam` | `from`, `to`, `time: "8:19"`, `distance: "149.6 million km"`, `title` |
| space | `ladder` | `title`, `items: [{name, label}]` (Earth, Mars, Jupiter, Saturn, Neptune, ...), `note` |
| space | `scale` | `big: Sun`, `small: Earth`, `count: 109` |
| history | `map` | `year: "117 AD"`, `from`, `view: empire` or `"italy>med"` (camera move) or `lon,lat,span`, `cities: [Rome]`, `route: [A, B, C]`, `labels: [{text, at: [lon, lat]}]`, `label`, `origin` |

History scripts declare territory once, by modern country (names from `data/world_110m.json`), and each `map` scene animates it:

```yaml
territories:
  - {year: 264 BC, countries: [Italy]}
  - {year: 133 BC, countries: [Spain, Portugal, Tunisia, Greece]}
```

A scene with `year: 133 BC` shows earlier territory solid, and the countries gained in 133 BC are conquered by a dashed frontier ring sweeping out from the heart of the empire (the borders of the new land "march" with moving dashes). `route` draws a curved, dashed, animated path with an arrowhead and waypoint chips. Places are built-in names (Rome, Carthage, Athens, Alexandria, Alps, ...) or `"Name@lat,lon"`. Presets for `view`: `italy med empire west_med east_med europe wide`.

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
