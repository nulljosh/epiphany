import SwiftUI

/// Map pins as emoji where one fits (Joshua, 2026-10-29): parks are 🌳, coffee is ☕.
/// Keyed by the SF Symbol each pin already picked, so every pin builder converts in one place.
enum MapEmoji {
    static let bySymbol: [String: String] = [
        "fork.knife": "🍽️", "fuelpump.fill": "⛽", "cart.fill": "🛒", "cup.and.saucer.fill": "☕",
        "leaf.fill": "🌳", "bag.fill": "🛍️", "star.fill": "⭐", "megaphone.fill": "📣",
        "graduationcap.fill": "🎓", "building.2.fill": "🏛️", "building.columns.fill": "🪦", "mappin": "📍",
        "waveform.path.ecg": "🫨", "car.fill": "🚗", "cone.fill": "🚧", "flame.fill": "🔥",
        "shield.fill": "🚓", "cross.fill": "🏥", "person.fill.checkmark": "🛂",
        "exclamationmark.triangle.fill": "⚠️", "xmark.octagon.fill": "⛔", "drop.fill": "🌊",
        "cloud.bolt.rain.fill": "⛈️", "cloud.bolt.fill": "⛈️", "light.beacon.max.fill": "🚨",
        "shield.lefthalf.filled": "🚨", "airplane": "✈️",
    ]
}

/// The emoji when there is one, otherwise the old white symbol in a tinted circle.
struct MapGlyph: View {
    let symbol: String
    let tint: Color
    var size: CGFloat = 18
    var selected = false

    var body: some View {
        if let emoji = MapEmoji.bySymbol[symbol] {
            Text(emoji)
                .font(.system(size: size))
                .padding(3)
                .background(Circle().fill(.white.opacity(selected ? 0.95 : 0)))
                .shadow(color: .black.opacity(0.35), radius: 1.5, y: 1)
                .scaleEffect(selected ? 1.2 : 1)
        } else {
            Image(systemName: symbol)
                .font(.system(size: size * 0.6, weight: .semibold))
                .foregroundStyle(.white)
                .padding(6)
                .background(tint, in: Circle())
        }
    }
}
