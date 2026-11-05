"""Script file parser.

Format (plain text)::

    title: Your Cash Is Shrinking
    channel: money                 # money | space | history
    seed: 7                        # optional: pins the look; default = hash of title
    handle: @CentsAndSense         # optional watermark
    voice: en-US-AndrewNeural      # optional TTS voice
    style: palette=ember layout=B caption=bar transition=wipe   # optional overrides
    territory: 264 BC | Italy      # history only, repeatable
    ---
    Narration line one. Use {$10,000|ten thousand dollars} for "shown | spoken".
    > kinetic: Hide *$10,000* | in a drawer          # visual note for that line
    Narration line two.
    > stat: label=Inflation | value=3% | sub=per year

A visual note is ``> kind: arg | arg | key=value | ...``.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

CHANNELS = ("money", "space", "history")


class ScriptError(ValueError):
    pass


@dataclass
class Word:
    shown: str
    spoken: list  # list[str]  (what a voice would actually say)


@dataclass
class Visual:
    kind: str
    args: list = field(default_factory=list)
    opts: dict = field(default_factory=dict)
    raw: str = ""


@dataclass
class Line:
    text: str            # as written
    words: list          # list[Word]
    visual: Visual | None
    lineno: int = 0

    @property
    def spoken_text(self) -> str:
        return " ".join(s for w in self.words for s in w.spoken)

    @property
    def shown_text(self) -> str:
        return " ".join(w.shown for w in self.words)


@dataclass
class Script:
    title: str
    channel: str
    meta: dict
    multi: dict          # repeatable header keys -> list of values
    lines: list
    path: str = ""

    @property
    def slug(self) -> str:
        return re.sub(r"[^a-z0-9]+", "-", self.title.lower()).strip("-")[:48] or "video"


_MARK = re.compile(r"\{([^|{}]+)\|([^{}]+)\}")
_REPEATABLE = {"territory"}


def parse_narration(text: str):
    """Split into Words, honouring {shown|spoken} overrides.
    Punctuation written directly after a marker (``{$5|five dollars}.``) stays glued to it."""
    words, pos, after_mark = [], 0, False

    def plain(chunk):
        nonlocal after_mark
        toks = chunk.split()
        if toks and after_mark and chunk and not chunk[0].isspace():
            words[-1].shown += toks[0]
            toks = toks[1:]
        after_mark = False
        words.extend(Word(t, [t]) for t in toks)

    for m in _MARK.finditer(text):
        plain(text[pos:m.start()])
        words.append(Word(m.group(1).strip(), m.group(2).split()))
        after_mark = True
        pos = m.end()
    plain(text[pos:])
    return words


_KV = re.compile(r"^([A-Za-z_][\w]*)\s*=\s*(.*)$")


def parse_visual(note: str) -> Visual:
    note = note.strip()
    if ":" in note:
        kind, rest = note.split(":", 1)
    else:
        kind, rest = note, ""
    v = Visual(kind.strip().lower(), raw=note)
    for part in rest.split("|"):
        part = part.strip()
        if not part:
            continue
        m = _KV.match(part)
        if m:
            v.opts[m.group(1).lower()] = m.group(2).strip()
        else:
            v.args.append(part)
    return v


def parse_script(path: str) -> Script:
    with open(path, encoding="utf-8") as f:
        raw = f.read().splitlines()

    meta, multi, lines = {}, {}, []
    body_start = None
    for i, ln in enumerate(raw):
        s = ln.strip()
        if s == "---":
            body_start = i + 1
            break
        if not s or s.startswith("#"):
            continue
        if ":" not in s:
            raise ScriptError(f"{path}:{i + 1}: header line needs 'key: value' (got {s!r})")
        k, v = s.split(":", 1)
        k = k.strip().lower()
        if k in _REPEATABLE:
            multi.setdefault(k, []).append(v.strip())
        else:
            meta[k] = v.strip()
    if body_start is None:
        raise ScriptError(f"{path}: missing '---' separator between header and narration")

    for i in range(body_start, len(raw)):
        s = raw[i].strip()
        if not s or s.startswith("#"):
            continue
        if s.startswith(">"):
            if not lines:
                raise ScriptError(f"{path}:{i + 1}: visual note before any narration line")
            if lines[-1].visual is not None:
                raise ScriptError(f"{path}:{i + 1}: only one visual note per narration line")
            lines[-1].visual = parse_visual(s[1:])
            continue
        lines.append(Line(text=s, words=parse_narration(s), visual=None, lineno=i + 1))

    title = meta.get("title")
    if not title:
        raise ScriptError(f"{path}: header needs 'title:'")
    channel = meta.get("channel", "").lower()
    if channel not in CHANNELS:
        raise ScriptError(f"{path}: 'channel:' must be one of {', '.join(CHANNELS)} (got {channel!r})")
    if not lines:
        raise ScriptError(f"{path}: no narration lines")
    return Script(title=title, channel=channel, meta=meta, multi=multi, lines=lines, path=path)
