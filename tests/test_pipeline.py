"""Fast checks (no rendering):  python -m unittest discover -s tests"""
import argparse
import tempfile
import unittest
from pathlib import Path

from pipeline import tts
from pipeline.cli import prepare
from pipeline.script import ScriptError, parse_narration, parse_script, parse_visual
from pipeline.style import PALETTES, pick_style
from pipeline.timeline import MAX_LEN, MIN_LEN, build_timeline

ROOT = Path(__file__).resolve().parent.parent
SAMPLES = sorted((ROOT / "samples" / "scripts").glob("*.txt"))


class ParserTests(unittest.TestCase):
    def test_marker_and_glued_punctuation(self):
        w = parse_narration("about {$5,500|fifty five hundred dollars}. Done")
        self.assertEqual(w[1].shown, "$5,500.")
        self.assertEqual(w[1].spoken, ["fifty", "five", "hundred", "dollars"])

    def test_visual_notes(self):
        v = parse_visual("bar: title=T | x=a,b | y=1,2 | Extra")
        self.assertEqual(v.kind, "bar")
        self.assertEqual(v.opts["y"], "1,2")
        self.assertEqual(v.args, ["Extra"])

    def test_bad_scripts(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "x.txt"
            p.write_text("title: x\nchannel: nope\n---\nhello\n")
            with self.assertRaises(ScriptError):
                parse_script(str(p))


class SampleTests(unittest.TestCase):
    def test_samples_fit_shorts_length(self):
        self.assertEqual(len(SAMPLES), 3)
        for p in SAMPLES:
            sc, style = prepare(str(p), argparse.Namespace(set=None))
            tl = build_timeline(sc, style, None)
            self.assertTrue(MIN_LEN <= tl.total <= MAX_LEN, f"{p.name}: {tl.total:.1f}s")
            self.assertFalse(tl.voiced)


class StyleTests(unittest.TestCase):
    def test_deterministic_and_varied(self):
        a = pick_style("money", 1).describe()
        self.assertEqual(a, pick_style("money", 1).describe())
        looks = {tuple(pick_style("money", s).describe().items()) for s in range(30)}
        self.assertGreater(len(looks), 20)
        self.assertEqual(pick_style("space", 5, {"palette": "mars"}).pal_name, "mars")
        with self.assertRaises(ValueError):
            pick_style("space", 5, {"palette": "nope"})


class CanvasTests(unittest.TestCase):
    def test_transparent_text_is_invisible(self):
        # Pillow draws alpha-0 text opaque in RGBA mode; Canvas.text must guard against it
        import numpy as np
        from PIL import Image
        from pipeline.canvas import Canvas
        bg = (200, 220, 210)
        cv = Canvas(Image.new("RGB", (400, 200), bg), 1)
        cv.text(10, 10, "HELLO", 60, "black", (0, 0, 0, 0), stroke=4, stroke_fill=(255, 255, 255, 0))
        self.assertEqual(int((np.asarray(cv.img) != np.array(bg)).any(2).sum()), 0)


class TTSFallbackTests(unittest.TestCase):
    def test_auto_falls_back_to_silent_when_tts_fails(self):
        orig = tts.synth_edge
        tts.synth_edge = lambda *a, **k: (_ for _ in ()).throw(OSError("network blocked"))
        try:
            audios, msg = tts.synthesize(["hi"], "auto", "v", "+0%", Path(tempfile.mkdtemp()))
            self.assertIsNone(audios)
            self.assertIn("silent", msg)
            with self.assertRaises(RuntimeError):
                tts.synthesize(["hi"], "edge", "v", "+0%", Path(tempfile.mkdtemp()))
        finally:
            tts.synth_edge = orig


if __name__ == "__main__":
    unittest.main()
