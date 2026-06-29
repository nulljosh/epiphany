#!/usr/bin/env python3
"""
Add iPhone 17 Pro device frame to simulator screenshots, removing the real status bar.
Removes top 120px (real status bar) and composites into a device frame with a graphic status bar.
"""

import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("❌ PIL not found. Install with: pip install Pillow")
    sys.exit(1)


def create_device_frame(width: int, height: int) -> Image.Image:
    """Generate an iPhone 17 Pro device frame (transparent background)."""
    # Device dimensions: 1320x2868 (screen), add ~40px frame on all sides
    frame_width = width + 80
    frame_height = height + 100

    # Create frame with dark background
    frame = Image.new("RGBA", (frame_width, frame_height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(frame)

    # iPhone frame border (dark gray, 40px on sides, 50px on top, 50px on bottom)
    frame_color = (20, 20, 20, 255)
    screen_inset = 40
    top_inset = 50

    # Draw frame rectangle (filled rounded border)
    frame_rect = (0, 0, frame_width - 1, frame_height - 1)
    draw.rectangle(frame_rect, fill=frame_color, outline=(40, 40, 40, 255), width=2)

    # Draw subtle notch at top (iPhone aesthetic)
    notch_y = top_inset + 12
    notch_left = frame_width // 2 - 75
    notch_right = frame_width // 2 + 75
    draw.rectangle((notch_left, top_inset, notch_right, notch_y), fill=(10, 10, 10, 255))

    return frame, screen_inset, top_inset


def process_screenshot(input_path: Path, output_path: Path) -> bool:
    """Remove status bar and add device frame to screenshot."""
    try:
        # Load raw screenshot
        img = Image.open(input_path).convert("RGB")
        orig_width, orig_height = img.size

        # Crop top 120px (real status bar from simulator)
        status_bar_height = 120
        img_cropped = img.crop((0, status_bar_height, orig_width, orig_height))

        # Create device frame
        frame, screen_inset, top_inset = create_device_frame(orig_width, orig_height - status_bar_height)

        # Paste cropped screenshot into frame
        frame.paste(img_cropped, (screen_inset, top_inset))

        # Convert to RGB and save (PNG doesn't support full RGBA with proper white bg)
        frame_rgb = Image.new("RGB", frame.size, (0, 0, 0))
        frame_rgb.paste(frame, mask=frame.split()[3] if frame.mode == "RGBA" else None)

        # Save output
        output_path.parent.mkdir(parents=True, exist_ok=True)
        frame_rgb.save(output_path, "PNG", quality=95)

        return True
    except Exception as e:
        print(f"  ❌ Error: {e}", file=sys.stderr)
        return False


def main():
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    appstore_dir = project_root / "screenshots" / "appstore"

    if not appstore_dir.exists():
        print(f"❌ Screenshot directory not found: {appstore_dir}")
        sys.exit(1)

    # Process all captured screenshots (patterns: "1-situation.png" or "situation.png")
    screenshots = sorted(appstore_dir.glob("*.png"))
    # Skip already-framed files
    screenshots = [s for s in screenshots if not s.stem.endswith("-framed")]

    if not screenshots:
        print(f"⚠️  No unframed screenshots found in {appstore_dir}")
        return

    print("📐 Adding device frames and removing status bars...")

    success_count = 0
    for screenshot in screenshots:
        output = screenshot.with_stem(screenshot.stem + "-framed")
        print(f"  {screenshot.name} → {output.name}...", end=" ", flush=True)

        if process_screenshot(screenshot, output):
            print("✓")
            success_count += 1
        else:
            print("✗")

    print(f"\n✅ Processed {success_count}/{len(screenshots)} screenshots")

    if success_count == len(screenshots):
        print("   Output: epiphany/ios/screenshots/appstore/*-framed.png")


if __name__ == "__main__":
    main()
