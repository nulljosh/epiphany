# Epiphany iOS — Open Tasks

## 1. Bitmap avatar generator
`Views/SettingsView.swift` — currently uses PhotosPicker + camera (lines ~243-250).

Replace with a "Generate" button:
- On tap: generate 64x64 UIImage from symmetric pixel pattern, random color palette
- Upload via existing `MonicaAPI.shared.uploadAvatar(imageData:)` 
- Remove PhotosPicker import and CameraPickerView
- Reference: web impl at `epiphany/src/components/Settings.jsx:generateBitmapAvatar`

```swift
// Pixel pattern generation
func generateBitmapAvatar() -> UIImage {
    let size = 64
    let tileSize = 8
    let palettes: [[UIColor]] = [ /* same palettes as web */ ]
    let palette = palettes.randomElement()!
    UIGraphicsBeginImageContext(CGSize(width: size, height: size))
    let ctx = UIGraphicsGetCurrentContext()!
    palette[3].setFill(); ctx.fill(CGRect(x:0,y:0,width:size,height:size))
    for row in 0..<8 {
        for col in 0..<4 {
            if Bool.random() {
                palette[Int.random(in: 0..<3)].setFill()
                ctx.fill(CGRect(x:col*tileSize, y:row*tileSize, width:tileSize, height:tileSize))
                ctx.fill(CGRect(x:(7-col)*tileSize, y:row*tileSize, width:tileSize, height:tileSize))
            }
        }
    }
    let img = UIGraphicsGetImageFromCurrentImageContext()!
    UIGraphicsEndImageContext()
    return img
}
```
