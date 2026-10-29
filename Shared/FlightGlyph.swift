import SwiftUI

/// A plane pointing where it flies, like a flight tracker, instead of a dot. SF's airplane faces east, so turn by heading minus 90.
struct FlightGlyph: View {
    let headingDeg: Int?
    var size: CGFloat = 16

    var body: some View {
        Image(systemName: "airplane")
            .font(.system(size: size, weight: .bold))
            .foregroundStyle(.white)
            .shadow(color: .black.opacity(0.7), radius: 1.5)
            .rotationEffect(.degrees(Double(headingDeg ?? 90) - 90))
            .frame(width: size + 10, height: size + 10)
            .contentShape(Rectangle())
    }
}
