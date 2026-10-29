import SwiftUI

/// A plane pointing where it flies, like a flight tracker, instead of a dot.
/// The ✈️ emoji points northeast, so it turns by heading minus 45. Joshua asked for the emoji (2026-10-29),
/// the one exception to the no-emoji rule.
struct FlightGlyph: View {
    let headingDeg: Int?
    var size: CGFloat = 16

    var body: some View {
        Text("✈️")
            .font(.system(size: size))
            .shadow(color: .black.opacity(0.5), radius: 1)
            .rotationEffect(.degrees(Double(headingDeg ?? 45) - 45))
            .frame(width: size + 10, height: size + 10)
            .contentShape(Rectangle())
    }
}
