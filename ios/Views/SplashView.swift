import SwiftUI

struct SplashView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var drawn: [LyreShape.Part: CGFloat] = [:]
    @State private var tileScale: CGFloat = 0.86
    @State private var tileOpacity: Double = 0
    @State private var textOpacity: Double = 0
    @State private var pluck = false

    private let tile: CGFloat = 220

    var body: some View {
        ZStack {
            Palette.bg
                .ignoresSafeArea()

            VStack(spacing: 28) {
                ZStack {
                    RoundedRectangle(cornerRadius: 49, style: .continuous)
                        .fill(LinearGradient(colors: [Color(hex: "5AAEFF"), Color(hex: "1462E0")],
                                             startPoint: .top, endPoint: .bottom))
                    ForEach(LyreShape.Part.allCases, id: \.self) { part in
                        let shape = LyreShape(part: part)
                        shape
                            .trim(from: 0, to: drawn[part] ?? 0)
                            .stroke(.white, style: StrokeStyle(lineWidth: shape.lineWidth * tile / 1024,
                                                               lineCap: .round, lineJoin: .round))
                            // strings shiver once, like a plucked lyre
                            .scaleEffect(x: part == .strings && pluck ? 1.06 : 1, y: 1)
                    }
                }
                .frame(width: tile, height: tile)
                .scaleEffect(tileScale)
                .opacity(tileOpacity)

                Text("EPIPHANY")
                    .font(.system(size: 16, weight: .light))
                    .tracking(8)
                    .foregroundStyle(Palette.overlay.opacity(0.5))
                    .opacity(textOpacity)
            }
        }
        .onAppear(perform: play)
    }

    private func play() {
        if reduceMotion {
            for part in LyreShape.Part.allCases { drawn[part] = 1 }
            tileScale = 1; tileOpacity = 1; textOpacity = 1
            return
        }
        withAnimation(.spring(response: 0.5, dampingFraction: 0.8)) { tileScale = 1; tileOpacity = 1 }
        // Frame first, then the strings, in the order you would draw it.
        for (i, part) in LyreShape.Part.allCases.enumerated() {
            withAnimation(.easeInOut(duration: 0.45).delay(0.15 + Double(i) * 0.14)) { drawn[part] = 1 }
        }
        withAnimation(.easeInOut(duration: 0.12).delay(1.3)) { pluck = true }
        withAnimation(.spring(response: 0.3, dampingFraction: 0.35).delay(1.42)) { pluck = false }
        withAnimation(.easeOut(duration: 0.4).delay(1.1)) { textOpacity = 1 }
    }
}

#Preview {
    SplashView()
}
