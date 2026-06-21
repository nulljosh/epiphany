import SwiftUI

/// Premium autopilot controls — mirrors the web Trade tab's Autopilot card.
/// Settings live in /api/broker/autopilot; trades execute server-side hourly
/// during market hours, so they keep running while the app is closed.
struct AutopilotSection: View {
    @State private var state: AutopilotState?
    @State private var errorText: String?
    @State private var saving = false
    @AppStorage("brokerLinked") private var brokerLinked = false
    @State private var maxNotional: Double = 10000
    @State private var hasChanges = false
    @Environment(AppState.self) private var appState
    @State private var showManualOrder = false
    @State private var manualSymbol = ""
    @State private var manualQty = ""
    @State private var manualSide = "buy"
    @State private var manualLoading = false
    @State private var manualError: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if brokerLinked && !showManualOrder {
                Button(action: { showManualOrder = true }) {
                    HStack {
                        Image(systemName: "plus.circle")
                        Text("Place Manual Order")
                            .font(.caption.weight(.semibold))
                        Spacer()
                    }
                    .foregroundStyle(.blue)
                }
                .buttonStyle(.bordered)
            }

            if showManualOrder {
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Text("Place Order")
                            .font(.caption.weight(.semibold))
                        Spacer()
                        Button(action: { showManualOrder = false }) {
                            Image(systemName: "xmark.circle.fill")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }

                    HStack(spacing: 8) {
                        TextField("Symbol", text: $manualSymbol)
                            .textFieldStyle(.roundedBorder)
                            .font(.caption)
                            .autocorrectionDisabled()
                            .textCase(.uppercase)
                        Picker("", selection: $manualSide) {
                            Text("Buy").tag("buy")
                            Text("Sell").tag("sell")
                        }
                        .pickerStyle(.segmented)
                        .font(.caption)
                    }

                    HStack(spacing: 8) {
                        TextField("Qty", text: $manualQty)
                            .textFieldStyle(.roundedBorder)
                            .font(.caption)
                            .keyboardType(.decimalPad)
                        Button(action: { Task { await placeManualOrder() } }) {
                            Text(manualLoading ? "..." : "Place")
                                .font(.caption.weight(.semibold))
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.green)
                        .disabled(manualLoading || manualSymbol.isEmpty || manualQty.isEmpty)
                    }

                    if let err = manualError {
                        Text(err)
                            .font(.caption)
                            .foregroundStyle(.red)
                    }
                }
                .padding(Spacing.xs)
                .background(RoundedRectangle(cornerRadius: 8).fill(.thinMaterial.opacity(0.5)))
            }

            HStack {
                HStack(spacing: 6) {
                    Text("SIMULATOR")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Text("PAPER-TRADING ONLY")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.orange, in: Capsule())
                }
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

            Text("Simulated trades execute hourly during market hours. No real money, no real orders.")
                .font(.footnote)
                .foregroundStyle(.secondary)

            if let s = state {
                if !s.pro {
                    Label("Premium feature. Upgrade on the web to enable.", systemImage: "lock.fill")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                } else {
                    Text("Paper-trading only. No real funds, no real orders, no real account impact.")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    if !brokerLinked {
                        Label("Link your brokerage in the Brokerage section above", systemImage: "link")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }

                    // Controls
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Text("Max per trade")
                                .font(.caption.weight(.semibold))
                            Spacer()
                            Text("$\(Int(maxNotional))")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Slider(value: $maxNotional, in: 1000...50000, step: 1000)
                            .onChange(of: maxNotional) { _, _ in hasChanges = true }

                        if hasChanges {
                            Button {
                                var next = s.settings
                                next.maxNotional = maxNotional
                                Task { await save(next) }
                            } label: {
                                HStack {
                                    Spacer()
                                    Text(saving ? "Saving..." : "Save Settings")
                                        .font(.caption.weight(.semibold))
                                    Spacer()
                                }
                            }
                            .buttonStyle(.bordered)
                            .disabled(saving)
                        }
                    }
                    .padding(Spacing.xs)
                    .background(RoundedRectangle(cornerRadius: 8).fill(.thinMaterial.opacity(0.5)))

                    if !s.trades.isEmpty {
                        Text("Recent trades")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }

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
            } else if let error = errorText {
                VStack(alignment: .leading, spacing: 8) {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.red)
                    Button(action: {
                        self.errorText = nil
                        Task { await load() }
                    }) {
                        Text("Retry")
                            .font(.caption.weight(.semibold))
                    }
                    .buttonStyle(.bordered)
                    .tint(.red)
                }
            } else {
                ProgressView()
                    .controlSize(.small)
            }
        }
        .padding(Spacing.smPlus)
        .background(RoundedRectangle(cornerRadius: 12).fill(.thinMaterial))
        .task { await load() }
    }

    private func load() async {
        do {
            let loaded = try await EpiphanyAPI.shared.fetchAutopilot()
            state = loaded
            maxNotional = loaded.settings.maxNotional
            hasChanges = false
        } catch {
            if let apiError = error as? APIError, case .unauthorized = apiError {
                appState.handleError(apiError)
            } else {
                errorText = "Autopilot unavailable"
            }
        }
    }

    private func save(_ next: AutopilotSettings) async {
        saving = true
        defer { saving = false }
        do {
            let saved = try await EpiphanyAPI.shared.updateAutopilot(next)
            state?.settings = saved
            hasChanges = false
        } catch {
            errorText = "Save failed"
        }
    }

    private func placeManualOrder() async {
        manualLoading = true
        defer { manualLoading = false }
        do {
            guard let qty = Double(manualQty) else {
                manualError = "Invalid quantity"
                return
            }
            try await EpiphanyAPI.shared.placeManualTrade(
                accountId: "default",
                symbol: manualSymbol,
                side: manualSide,
                qty: qty
            )
            manualSymbol = ""
            manualQty = ""
            manualError = nil
            showManualOrder = false
        } catch {
            manualError = error.localizedDescription
        }
    }
}
