import SwiftUI

// Read from the bundle so the title can't go stale again; only the bullets need a hand edit per release.
// Major.minor only: a patch (10.0.1) is a fix, so it never brings the card back.
private let whatsNewVersion = (Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "")
    .split(separator: ".").prefix(2).joined(separator: ".")
// Three short bullets at most, a few words each (Joshua, 2026-10-30).
private let whatsNewBullets = [
    "A banner when you’re in a weather warning",
    "Rain radar plays the last two hours",
    "Weather on the map: radar, warnings, storms",
]

/// A card drawn over the app, not a system sheet. As a sheet it was a third modal presenter at the app
/// root beside sign-in and onboarding, and two of them presenting at once left the whole screen dead to touches.
struct WhatsNewCard: View {
    @AppStorage("whats_new_seen_version") private var seenVersion = ""

    var body: some View {
        // Older builds stored the full x.y.z; compare that the same way.
        if seenVersion.split(separator: ".").prefix(2).joined(separator: ".") != whatsNewVersion {
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
