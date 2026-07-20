import SwiftUI

private let whatsNewVersion = "2.5.1"
private let whatsNewBullets = [
    "New floating tab bar with fill icons and bounce animation",
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
