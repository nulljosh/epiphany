import SwiftUI

/// Display-only Autopilot card, the same on iOS and macOS. It shows the paper-trading status the web card shows
/// (running or off, what runs when, last trade) and nothing else: no manual orders, no live switch, no enrollment.
/// Enrollment stays on the web, which is also the App Review fallback in ios/APPSTORE.md (Guideline 3.2.1).
struct PaperAutopilotCard: View {
    @State private var state: AutopilotState?
    @State private var loaded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Autopilot")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            if let state, state.pro {
                Text(Self.status(state))
                    .font(.footnote)
            } else if state != nil {
                Text("Premium feature. Turn it on from the web app.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            } else if loaded {
                Text("Status isn't available right now.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .task {
            state = try? await EpiphanyAPI.shared.fetchAutopilot()
            loaded = true
        }
    }

    /// One plain sentence: never blank, never "idle".
    static func status(_ s: AutopilotState) -> String {
        guard s.settings.enabled else { return "Autopilot is off. Turn it on from the web app." }
        let money = s.settings.mode == "live" ? "live" : "paper"
        var text = "Running on \(money) money. Stocks trade at each 9:30 ET open"
        text += s.settings.allowCrypto ? ", Bitcoin is checked every day, weekends too." : "."
        if let t = s.trades.first {
            text += " Last trade: \(t.side) \(t.symbol)\(t.error == nil ? "" : " (failed)")."
        } else {
            text += " First trade comes at the next check."
        }
        return text
    }
}
