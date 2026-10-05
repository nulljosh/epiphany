import SwiftUI

// Read from the bundle so the title can't go stale again; only the bullets need a hand edit per release.
private let whatsNewVersion = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? ""
private let whatsNewBullets = [
    "Tapping a map search result now takes you there, and the keyboard closes",
    "Places always loads, using Apple Maps when the open map data is down",
    "Paper Autopilot status card in Settings",
]

struct WhatsNewSheet: View {
    @AppStorage("whats_new_seen_version") private var seenVersion = ""
    @State private var isPresented = false
    @State private var sheetHeight: CGFloat = 200

    var body: some View {
        Color.clear
            .onAppear { isPresented = seenVersion != whatsNewVersion }
            .sheet(isPresented: $isPresented) {
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
                        seenVersion = whatsNewVersion
                        isPresented = false
                    } label: {
                        Text("Got it")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                }
                .padding(24)
                .background {
                    GeometryReader { geo in
                        Color.clear.onAppear { sheetHeight = geo.size.height }
                    }
                }
                .presentationDetents([.height(sheetHeight)])
                .presentationDragIndicator(.visible)
            }
    }
}
