import SwiftUI

/// Premium autopilot controls — mirrors the web Trade tab's Autopilot card.
/// Settings live in /api/broker/autopilot; trades execute server-side hourly
/// during market hours, so they keep running while the app is closed.
struct AutopilotSection: View {
    @State private var state: AutopilotState?
    @State private var errorText: String?
    @State private var saving = false
    @State private var connecting = false
    @Environment(\.openURL) private var openURL

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("AUTOPILOT")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                Spacer()
                if let s = state, s.pro {
                    Button(s.settings.enabled ? "ON" : "OFF") {
                        var next = s.settings
                        next.enabled.toggle()
                        Task { await save(next) }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(s.settings.enabled ? .green : .gray)
                    .disabled(saving)
                }
            }

            Text("Buys and sells through your linked brokerage hourly during market hours, even while the app is closed.")
                .font(.footnote)
                .foregroundStyle(.secondary)

            if let s = state {
                if !s.pro {
                    Label("Premium feature. Upgrade on the web to enable.", systemImage: "lock.fill")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                } else {
                    Text("Live mode trades with real money, capped at your max per trade.")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    Button {
                        Task { await connect() }
                    } label: {
                        if connecting {
                            ProgressView()
                                .controlSize(.small)
                        } else {
                            Label("Connect brokerage", systemImage: "link")
                                .font(.footnote.weight(.semibold))
                        }
                    }
                    .buttonStyle(.bordered)
                    .disabled(connecting)

                    ForEach(Array(s.trades.prefix(5))) { trade in
                        HStack {
                            Text(trade.side.uppercased())
                                .font(.caption.weight(.bold))
                                .foregroundStyle(trade.side == "buy" ? .green : .red)
                            Text("\(trade.qty.map { String(Int($0)) } ?? "-") \(trade.symbol)")
                                .font(.caption)
                            Spacer()
                            Text(trade.error == nil ? trade.mode : "\(trade.mode) failed")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            } else if let errorText {
                Text(errorText)
                    .font(.caption)
                    .foregroundStyle(.red)
            } else {
                ProgressView()
                    .controlSize(.small)
            }
        }
        .padding(Spacing.smPlus)
        .background(RoundedRectangle(cornerRadius: 12).fill(.thinMaterial))
        .task { await load() }
    }

    private func connect() async {
        connecting = true
        defer { connecting = false }
        do {
            let result = try await EpiphanyAPI.shared.syncBroker()
            if let link = result.linkUrl, let url = URL(string: link) {
                openURL(url)
            } else if result.skipped == true {
                errorText = "Brokerage sync not configured on the server"
            }
        } catch {
            errorText = "Connect failed"
        }
    }

    private func load() async {
        do {
            state = try await EpiphanyAPI.shared.fetchAutopilot()
        } catch {
            errorText = "Autopilot unavailable"
        }
    }

    private func save(_ next: AutopilotSettings) async {
        saving = true
        defer { saving = false }
        do {
            let saved = try await EpiphanyAPI.shared.updateAutopilot(next)
            state?.settings = saved
        } catch {
            errorText = "Save failed"
        }
    }
}
