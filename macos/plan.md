# Epiphany macOS — Open Tasks

## 1. Bitmap avatar generator
`Views/SettingsView.swift` — currently shows initial letter only, no upload.

Add "Generate avatar" button next to the initial circle:
- On tap: generate 64x64 NSImage using NSBitmapImageRep, symmetric pixel pattern, random palette
- Upload via shared API client (same endpoint as iOS/web: POST `/api/avatar` with base64 JPEG)
- Reference: web impl at `epiphany/src/components/Settings.jsx:generateBitmapAvatar`

```swift
func generateBitmapAvatar() -> NSImage {
    let size = 64, tileSize = 8
    let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size,
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
        colorSpaceName: .calibratedRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    // fill pattern (same logic as iOS)
    NSGraphicsContext.restoreGraphicsState()
    let img = NSImage(size: NSSize(width: size, height: size))
    img.addRepresentation(rep)
    return img
}
```
