# Epiphany brand kit and design system

Apollo's lyre: the god of light and foresight, who saw what was coming.

## The mark
One bold flat white glyph on an accent gradient tile. No text, no outline, no emblem.

- `../Epiphany.icon` is the source of truth (Icon Composer). Light and dark fills are set in it.
- `../icon.svg` is the flat copy for READMEs (shown at 80 px). `icon-1024.png` is the App Store icon, no alpha.
- `mark.svg` is the glyph alone in `currentColor` for your own background.
- Clear space equal to the width of the glyph's thickest stroke. Smallest size 16 px.

## Colour
| Role | Value |
|---|---|
| Accent | `#1462e0` |
| Gradient top | `#5aaeff` |
| Text | `#1d1d1f` light, `#f5f5f7` dark |
| Background | `#ffffff` light, `#000000` dark; web and landing use night `#070b16` |
| Surface | `#f5f5f7` light, `#1c1c1e` dark; night surface `#0f1526`, line `#1e2740` |

The accent is for actions, links and the icon. Never brown, beige, purple or teal.

## Type
- **Epiphany Sans** for everything you read: Manrope under the SIL Open Font License, renamed and pinned by `scripts/gen_font.py`, with the curly quotes and apostrophe redrawn as laurel leaves from Apollo's crown. Four weights, 400 to 700, proportional with tabular figures so prices line up.
- **Epiphany Display** for headlines only: Cinzel (OFL), classical inscription capitals, set in caps with 0.04 em tracking. Never for body text, numbers or buttons.
- Fallback is the system stack. Scale 34/41 bold, 22/28, 17/24, 15/20, 13/18. Licences ship in `fonts/`.

## Theme
Apollo, god of light and foresight: the lyre is the mark, the laurel is the quote mark, the art is public domain engravings and statues of Apollo, dithered to halftone in the accent blue. One colour only; the theme lives in the drawing and the type, not in gold or gradients.

## Space and shape
- Space on the 8 point grid: 4, 8, 12, 16, 24, 32, 48. Side margin 20. Reading column 680.
- Radii: cards 28, grouped lists 20, controls fully round, icon 22 percent.
- Controls are 48 points tall capsules, one height in a row. Focus is a 4 point ring at 30 percent accent.
- Motion is 0.2 s ease and honours reduced motion.

`tokens.css` holds the app's accent. Everything else comes from the shared token file.
