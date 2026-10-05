import SwiftUI

// Read from the bundle so the title can't go stale again; only the bullets need a hand edit per release.
private let whatsNewVersion = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? ""
private let whatsNewBullets = [
    "Tap a map search result and it takes you there",
    "Close the keyboard with Done, or clear the search with one tap",
    "Places opens in about a second, even when the open map data is down",
]

/// A card drawn over the app, not a system sheet. As a sheet it was a third modal presenter at the app
/// root beside sign-in and onboarding, and two of them presenting at once left the whole screen dead to touches.
struct WhatsNewCard: View {
    @AppStorage("whats_new_seen_version") private var seenVersion = ""

    var body: some View {
        if seenVersion != whatsNewVersion {
            VStack(alignment: .leading, spacing: 20) {
                Text("What's New in v\(whatsNewVersion)")
                    .font(.title2.bold())

                VStack(alignment: .leading, spacing: 12) {
                    ForEach(whatsNewBullets, id: \.self) { bullet in
                        HStack(alignment: .top, spacing: 8) {
                            Text("•")
                            Text(bullet)
                        }
                    }
                }
                .font(.body)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

                Button {
                    withAnimation { seenVersion = whatsNewVersion }
                } label: {
                    Text("Got it")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
            }
            .padding(24)
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
            .shadow(color: .black.opacity(0.15), radius: 12, y: 4)
            .padding(.horizontal, 12)
            // Sits just above the tab bar; lower and the tab labels poke out from under it.
            .padding(.bottom, 62)
            .frame(maxHeight: .infinity, alignment: .bottom)
            .transition(.move(edge: .bottom).combined(with: .opacity))
        }
    }
}
