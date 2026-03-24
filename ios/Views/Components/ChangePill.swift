import SwiftUI

struct ChangePill: View {
    let text: String
    let color: Color

    var body: some View {
        Text(text)
            .font(.caption2.weight(.semibold))
            .foregroundStyle(.white)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(color, in: Capsule())
    }
}

struct InitialCircle: View {
    let text: String
    var color: Color = .secondary
    var size: CGFloat = 32

    var body: some View {
        ZStack {
            Circle().fill(color.opacity(0.15))
            Text(String(text.prefix(1)))
                .font(.caption2.weight(.bold))
                .foregroundStyle(color)
        }
        .frame(width: size, height: size)
    }
}
