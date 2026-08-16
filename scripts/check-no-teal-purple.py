#!/usr/bin/env python3
"""Fail if any teal/cyan/purple/indigo colour re-enters the UI.

Standing house rule: no teal, no purple, anywhere, on any platform. This scans
by *hue* rather than by colour name, because the first pass at this missed a
dozen raw hex literals (`#9d4edd`, `#67e8f9`) that no name-based grep would
catch.

Exit 0 = clean. Exit 1 = a violation re-entered; the offending file:line and
hex are printed.

Run: python3 scripts/check-no-teal-purple.py
"""
import colorsys
import pathlib
import re
import sys

# Hue bands, in degrees, that the rule forbids.
TEAL = (165, 200)
PURPLE = (255, 310)

# Real companies' brand colours, used to tint their ticker rows in App.jsx's
# ASSETS map. These are *data* — a company's actual identity — not a design
# choice, so recolouring them would make the app wrong rather than compliant.
# Anything not on this list is ours and must comply.
BRAND_ALLOWLIST = {
    "#4d148c",  # FedEx
    "#a100ff",  # Accenture
    "#049fd9",  # Cisco
    "#00a1e0",  # Salesforce
    "#00a2ed",  # Microsoft
    "#00a8e0",  # AT&T
    "#00a3e0",  # NextEra Energy
    "#00aeef",  # Comcast/NBC
    "#6b2d8b",  # Bristol-Myers Squibb
}

ROOTS = ["src", "server", "ios", "macos", "watchos",
         "widgets-ios", "widgets-macos", "public", "index.html"]
EXTS = {".js", ".jsx", ".swift", ".css", ".html", ".json"}
HEX = re.compile(r"#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b")


def hue_sat_light(hex_str):
    h = hex_str.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    hue, light, sat = colorsys.rgb_to_hls(r, g, b)
    return hue * 360, sat, light


def iter_files(root_dir):
    p = pathlib.Path(root_dir)
    if p.is_file():
        yield p
        return
    for f in p.rglob("*"):
        if f.suffix in EXTS and "node_modules" not in str(f) and ".build" not in str(f):
            yield f


def main():
    violations = []
    for root in ROOTS:
        for f in iter_files(root):
            try:
                text = f.read_text(errors="ignore")
            except OSError:
                continue
            for m in HEX.finditer(text):
                hexcode = m.group(0)
                if hexcode.lower() in BRAND_ALLOWLIST:
                    continue
                hue, sat, light = hue_sat_light(hexcode)
                # Near-greys, near-blacks and near-whites carry no hue worth judging.
                if sat < 0.15 or light < 0.08 or light > 0.95:
                    continue
                if TEAL[0] <= hue <= TEAL[1] or PURPLE[0] <= hue <= PURPLE[1]:
                    line = text[:m.start()].count("\n") + 1
                    band = "teal/cyan" if hue <= TEAL[1] else "purple/indigo"
                    violations.append(f"{f}:{line}  {hexcode}  hue {hue:.0f} ({band})")

    if violations:
        print(f"{len(violations)} teal/purple violation(s):\n")
        for v in violations:
            print(f"  {v}")
        print("\nReplace with the shared palette: slate #8CA0B3, paleBlue #7FB2FF, sand #C2A878.")
        return 1

    print("clean - no teal/cyan/purple/indigo in the UI")
    return 0


if __name__ == "__main__":
    sys.exit(main())
