"""Brand art: Jan Cossiers, Prometheus Carrying Fire (1637, Prado, public domain), cropped head to torch and dithered to
halftone in the accent blue. Run: uv run --with pillow python scripts/gen_art.py <source.jpg> public/brand/prometheus.webp
Source: https://commons.wikimedia.org/wiki/File:Jan_Cossiers_-_Prometeo_trayendo_el_fuego,_1637.jpg"""
import sys
from PIL import Image, ImageDraw, ImageOps, ImageEnhance
src, out = sys.argv[1], sys.argv[2]
W, H, CELL = 1200, 1400, 9
BG, INK = (7, 12, 22), (74, 158, 255)
rgb = Image.open(src).convert('RGB').crop((0, 420, 1840, 2567)).resize((W, H), Image.LANCZOS)
# Warmth, not brightness: skin, cloak and fire are warm, the sky is cool, so the figure lights up and the sky drops to night.
r, g, b = rgb.split()
lum = rgb.convert('L')
px_r, px_b, px_l = r.load(), b.load(), lum.load()
im = Image.new('L', (W, H))
px = im.load()
for yy in range(H):
    for xx in range(W):
        w = max(0, px_r[xx, yy] - px_b[xx, yy]) / 110
        px[xx, yy] = int(min(1, w) * (0.35 + 0.65 * px_l[xx, yy] / 255) * 255)
im = ImageOps.autocontrast(im, cutoff=0.5)
canvas = Image.new('RGB', (W * 2, H * 2), BG)  # draw at 2x, downsample for clean dots
d = ImageDraw.Draw(canvas)
for y in range(0, H, CELL):
    for x in range(0, W, CELL):
        v = im.getpixel((min(x + CELL // 2, W - 1), min(y + CELL // 2, H - 1))) / 255
        r = (v ** 1.1) * CELL * 0.62  # light areas become big dots, shadows fall to the night background
        if r < 0.5: continue
        cx, cy = (x + CELL / 2) * 2, (y + CELL / 2) * 2
        d.ellipse((cx - r * 2, cy - r * 2, cx + r * 2, cy + r * 2), fill=INK)
canvas.resize((W, H), Image.LANCZOS).save(out, 'WEBP', quality=86)
