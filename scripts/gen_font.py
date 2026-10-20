"""Epiphany Sans: Manrope (Mikhail Sharanda, SIL Open Font License 1.1, no reserved name), renamed, with its curly
quote marks redrawn as four point sparks, the moment an idea clicks.
Manrope is an open, proportionally spaced grotesque with tabular figures, so prices still line up in columns.

Same method as hermes's Hermes Sans and coda's Quip Sans: pinned release, renamed, OFL shipped beside the fonts,
original copyright kept in the name table, fixed timestamps so every build is the same bytes.

    python3 scripts/gen_font.py            # writes fonts/EpiphanySans-{Regular,Medium,Semibold,Bold}.{ttf,woff2} + OFL.txt
    python3 scripts/gen_font.py --check    # named Epiphany Sans, OFL present, original copyright kept
Needs fonttools and brotli (uv run --with fonttools --with brotli).
"""
import io
import os
import sys
import urllib.request

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, "fonts")
SOURCE = "https://cdn.jsdelivr.net/npm/@fontsource/manrope@5.2.5/"
WEIGHTS = {"Regular": 400, "Medium": 500, "Semibold": 600, "Bold": 700}
QUOTES = ((0x2018, 1), (0x2019, 1), (0x201C, 2), (0x201D, 2))


def fetch(path):
    """Bytes of one file from the pinned Manrope release."""
    with urllib.request.urlopen(SOURCE + path, timeout=60) as r:
        return r.read()


def spark(pen, x0, y0, w, h):
    """The icon's four point spark, pinched sides as quadratic curves through the centre's near corners."""
    cx, cy, k = x0 + w / 2, y0 + h / 2, 0.08
    pen.moveTo((cx, y0 + h))
    pen.qCurveTo((cx + k * w, cy + k * h), (x0 + w, cy))
    pen.qCurveTo((cx + k * w, cy - k * h), (cx, y0))
    pen.qCurveTo((cx - k * w, cy - k * h), (x0, cy))
    pen.qCurveTo((cx - k * w, cy + k * h), (cx, y0 + h))
    pen.closePath()


def redraw_quotes(font):
    """Replace the four curly quotes with sparks inside each original's box, so spacing never moves."""
    glyphs = font.getGlyphSet()
    glyf, hmtx, cmap = font["glyf"], font["hmtx"], font.getBestCmap()
    for cp, count in QUOTES:
        name = cmap[cp]
        bp = BoundsPen(glyphs)
        glyphs[name].draw(bp)
        x0, y0, x1, y1 = bp.bounds
        gap = 0.12 * (x1 - x0) if count == 2 else 0
        w = (x1 - x0 - gap) / count
        side = min(w, y1 - y0)                      # square sparks, centred in the old mark's box
        tt = TTGlyphPen(None)
        pen = TransformPen(tt, (1, 0, 0, 1, 0, 0))
        for i in range(count):
            left = x0 + i * (w + gap) + (w - side) / 2
            spark(pen, left, y0 + (y1 - y0 - side) / 2, side, side)
        glyf[name] = tt.glyph()
        glyf[name].recalcBounds(glyf)
        hmtx[name] = (hmtx[name][0], glyf[name].xMin)


def rename(font, style):
    """Give the outlines the Epiphany Sans name; copyright (0) and license (13, 14) stay as the authors wrote them."""
    names = {1: "Epiphany Sans", 2: style, 3: f"EpiphanySans-{style}", 4: f"Epiphany Sans {style}",
             5: "Version 1.000", 6: f"EpiphanySans-{style}", 16: "Epiphany Sans", 17: style}
    table = font["name"]
    table.names = [n for n in table.names if n.nameID in (0, 13, 14)]
    for nid, text in names.items():
        table.setName(text, nid, 3, 1, 0x409)
        table.setName(text, nid, 1, 0, 0)
    font["head"].created = font["head"].modified = 3_700_000_000
    font["OS/2"].achVendID = "EPHY"


def check():
    """Self-check of the shipped files."""
    assert os.path.exists(os.path.join(OUT, "OFL.txt")), "the OFL must ship with the fonts"
    for style in WEIGHTS:
        for ext in ("ttf", "woff2"):
            f = TTFont(os.path.join(OUT, f"EpiphanySans-{style}.{ext}"))
            assert f["name"].getDebugName(1) == "Epiphany Sans", "family name"
            assert f["name"].getDebugName(6) == f"EpiphanySans-{style}", "postscript name"
            assert f["name"].getDebugName(0), "the original copyright must stay in the name table"
            cmap, hmtx, glyf = f.getBestCmap(), f["hmtx"], f["glyf"]
            assert hmtx[cmap[ord("i")]][0] < hmtx[cmap[ord("m")]][0], "proportional: i must be narrower than m"
            for cp, n in QUOTES:
                g = glyf[cmap[cp]]
                assert g.numberOfContours == n, f"U+{cp:04X} is not the spark"
                assert 0 <= g.xMin and g.xMax <= hmtx[cmap[cp]][0], f"U+{cp:04X} spills out of its advance"
    print(f"font ok: Epiphany Sans (Manrope, OFL), {len(WEIGHTS)} weights, proportional, quotes are sparks")


def main():
    if "--check" in sys.argv:
        return check()
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "OFL.txt"), "wb") as f:
        f.write(fetch("LICENSE"))
    for style, weight in WEIGHTS.items():
        font = TTFont(io.BytesIO(fetch(f"files/manrope-latin-{weight}-normal.woff2")))
        redraw_quotes(font)
        rename(font, style)
        for ext, flavor in (("ttf", None), ("woff2", "woff2")):
            font.flavor = flavor
            font.save(os.path.join(OUT, f"EpiphanySans-{style}.{ext}"), reorderTables=False)
        print(f"EpiphanySans-{style}: Manrope {weight}")


if __name__ == "__main__":
    main()
