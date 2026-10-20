"""Epiphany Sans: Manrope (Mikhail Sharanda, SIL Open Font License 1.1, no reserved name), renamed, with its curly
quote marks redrawn as laurel leaves, Apollo's crown.
Manrope is an open, proportionally spaced grotesque with tabular figures, so prices still line up in columns.

Same method as hermes's Hermes Sans and coda's Quip Sans: pinned release, renamed, OFL shipped beside the fonts,
original copyright kept in the name table, fixed timestamps so every build is the same bytes.

    python3 scripts/gen_font.py            # writes fonts/<App>Sans-*, <App>Display-* (ttf, woff2) and both OFLs
    python3 scripts/gen_font.py --check    # names, licences, copyright and the leaf quotes
Epiphany Display is Tenor Sans (Denis Masharov, SIL OFL 1.1), a sans with classical inscription proportions, for headlines, renamed the same way.
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
DISPLAY_SOURCE = "https://cdn.jsdelivr.net/npm/@fontsource/tenor-sans@5.2.5/"
APP = "Epiphany"                     # the one line to change on a rename
WEIGHTS = {"Regular": 400, "Medium": 500, "Semibold": 600, "Bold": 700}
DISPLAY_WEIGHTS = {"Regular": 400}
QUOTES = ((0x2018, 1), (0x2019, 1), (0x201C, 2), (0x201D, 2))


def fetch(path, source=SOURCE):
    """Bytes of one file from a pinned release."""
    with urllib.request.urlopen(source + path, timeout=60) as r:
        return r.read()


def leaf(pen, x0, y0, w, h, lean_left=False):
    """Apollo's laurel leaf: pointed at both tips, symmetric about a slightly leaning axis; drawn clockwise."""
    lean = 0.15 * w
    bottom = (x0 + w - lean, y0) if lean_left else (x0 + lean, y0)
    top = (x0 + lean, y0 + h) if lean_left else (x0 + w - lean, y0 + h)
    mx, my = (bottom[0] + top[0]) / 2, (bottom[1] + top[1]) / 2
    dx, dy = top[0] - bottom[0], top[1] - bottom[1]
    length = (dx * dx + dy * dy) ** 0.5
    off = 0.75 * w                                   # control offset; the leaf bulges half of this each side
    nx, ny = -dy / length * off, dx / length * off   # left of the axis
    pen.moveTo(bottom)
    pen.qCurveTo((mx + nx, my + ny), top)
    pen.qCurveTo((mx - nx, my - ny), bottom)
    pen.closePath()


def redraw_quotes(font):
    """Replace the four curly quotes with laurel leaves inside each original's box, so spacing never moves."""
    glyphs = font.getGlyphSet()
    glyf, hmtx, cmap = font["glyf"], font["hmtx"], font.getBestCmap()
    for cp, count in QUOTES:
        name = cmap[cp]
        bp = BoundsPen(glyphs)
        glyphs[name].draw(bp)
        x0, y0, x1, y1 = bp.bounds
        gap = 0.12 * (x1 - x0) if count == 2 else 0
        w = (x1 - x0 - gap) / count
        tt = TTGlyphPen(None)
        pen = TransformPen(tt, (1, 0, 0, 1, 0, 0))
        for i in range(count):
            # each leaf fills its old mark's own box, so it reads as a quote, not an accent
            leaf(pen, x0 + i * (w + gap), y0, w, y1 - y0, lean_left=cp in (0x2018, 0x201C))
        glyf[name] = tt.glyph()
        glyf[name].recalcBounds(glyf)
        hmtx[name] = (hmtx[name][0], glyf[name].xMin)


def rename(font, style, family=f"{APP} Sans"):
    """Give the outlines our family name; copyright (0) and license (13, 14) stay as the authors wrote them."""
    ps = family.replace(" ", "")
    names = {1: family, 2: style, 3: f"{ps}-{style}", 4: f"{family} {style}",
             5: "Version 1.000", 6: f"{ps}-{style}", 16: family, 17: style}
    table = font["name"]
    table.names = [n for n in table.names if n.nameID in (0, 13, 14)]
    for nid, text in names.items():
        table.setName(text, nid, 3, 1, 0x409)
        table.setName(text, nid, 1, 0, 0)
    font["head"].created = font["head"].modified = 3_700_000_000
    font["OS/2"].achVendID = "EPHY"


SANS, DISPLAY = f"{APP}Sans", f"{APP}Display"


def check():
    """Self-check of the shipped files."""
    for lic in ("OFL.txt", "OFL-Tenor.txt"):
        assert os.path.exists(os.path.join(OUT, lic)), f"{lic} must ship with the fonts"
    for style in WEIGHTS:
        for ext in ("ttf", "woff2"):
            f = TTFont(os.path.join(OUT, f"{SANS}-{style}.{ext}"))
            assert f["name"].getDebugName(1) == f"{APP} Sans", "family name"
            assert f["name"].getDebugName(6) == f"{SANS}-{style}", "postscript name"
            assert f["name"].getDebugName(0), "the original copyright must stay in the name table"
            cmap, hmtx, glyf = f.getBestCmap(), f["hmtx"], f["glyf"]
            assert hmtx[cmap[ord("i")]][0] < hmtx[cmap[ord("m")]][0], "proportional: i must be narrower than m"
            for cp, n in QUOTES:
                g = glyf[cmap[cp]]
                assert g.numberOfContours == n, f"U+{cp:04X} is not the leaf"
                assert 0 <= g.xMin and g.xMax <= hmtx[cmap[cp]][0], f"U+{cp:04X} spills out of its advance"
    for style in DISPLAY_WEIGHTS:
        f = TTFont(os.path.join(OUT, f"{DISPLAY}-{style}.woff2"))
        assert f["name"].getDebugName(1) == f"{APP} Display" and f["name"].getDebugName(0), "display name and copyright"
    print(f"font ok: {APP} Sans (Manrope) and {APP} Display (Tenor Sans), OFL, quotes are laurel leaves")


def build(source, files, weights, family, out_name, quotes):
    """Fetch each weight, optionally redraw the quotes, rename, and save ttf and woff2."""
    for style, weight in weights.items():
        font = TTFont(io.BytesIO(fetch(files.format(weight=weight), source)))
        if quotes:
            redraw_quotes(font)
        rename(font, style, family)
        for ext, flavor in (("ttf", None), ("woff2", "woff2")):
            font.flavor = flavor
            font.save(os.path.join(OUT, f"{out_name}-{style}.{ext}"), reorderTables=False)
        print(f"{out_name}-{style}: {weight}")


def main():
    if "--check" in sys.argv:
        return check()
    os.makedirs(OUT, exist_ok=True)
    for name, source in (("OFL.txt", SOURCE), ("OFL-Tenor.txt", DISPLAY_SOURCE)):
        with open(os.path.join(OUT, name), "wb") as f:
            f.write(fetch("LICENSE", source))
    build(SOURCE, "files/manrope-latin-{weight}-normal.woff2", WEIGHTS, f"{APP} Sans", SANS, quotes=True)
    build(DISPLAY_SOURCE, "files/tenor-sans-latin-{weight}-normal.woff2", DISPLAY_WEIGHTS, f"{APP} Display", DISPLAY, quotes=False)


if __name__ == "__main__":
    main()
