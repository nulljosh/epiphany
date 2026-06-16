import SwiftUI

struct AlertsView: View {
    @Environment(AppState.self) private var appState
    @State private var showCreateSheet = false
    @State private var hasLoaded = false

    var body: some View {
        NavigationStack {
            Group {
                if !appState.isLoggedIn {
                    VStack(spacing: 16) {
                        Image(systemName: "bell.badge")
                            .font(.system(size: 48))
                            .foregroundStyle(.secondary)
                        Text("Sign in to manage alerts")
                            .foregroundStyle(.secondary)
                        Button("Sign In") {
                            appState.showLogin = true
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(Palette.appleBlue)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    alertsList
                }
            }
            .navigationTitle("Alerts")
            .toolbar {
                if appState.isLoggedIn {
                    ToolbarItem(placement: .automatic) {
                        Button {
                            showCreateSheet = true
                        } label: {
                            Image(systemName: "plus")
                        }
                    }
                }
            }
            .sheet(isPresented: $showCreateSheet) {
                CreateAlertSheet()
                    .environment(appState)
            }
        }
        .onAppear {
            guard !hasLoaded else { return }
            hasLoaded = true
            Task {
                await appState.loadAlerts()
            }
        }
        .onChange(of: appState.isLoggedIn) { _, isLoggedIn in
            guard isLoggedIn, appState.alerts.isEmpty else { return }
            Task {
                await appState.loadAlerts()
            }
        }
    }

    private var alertsList: some View {
        List {
            if !appState.activeAlerts.isEmpty {
                Section("Active") {
                    ForEach(appState.activeAlerts) { alert in
                        alertRow(alert)
                    }
                    .onDelete { indexSet in
                        let alerts = appState.activeAlerts
                        for index in indexSet {
                            let alert = alerts[index]
                            Task { await appState.deleteAlert(alert.id) }
                        }
                    }
                }
            }

            if !appState.triggeredAlerts.isEmpty {
                Section("Triggered") {
                    ForEach(appState.triggeredAlerts) { alert in
                        alertRow(alert)
                            .opacity(0.6)
                    }
                    .onDelete { indexSet in
                        let alerts = appState.triggeredAlerts
                        for index in indexSet {
                            let alert = alerts[index]
                            Task { await appState.deleteAlert(alert.id) }
                        }
                    }
                }
            }

            if appState.alerts.isEmpty {
                Section {
                    Text("No alerts yet")
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .center)
                }
            }
        }
    }

    private func alertRow(_ alert: PriceAlert) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(alert.symbol)
                    .font(.headline.monospaced())
                Text(alert.direction == .above ? "Above" : "Below")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(String(format: "$%.2f", alert.targetPrice))
                    .font(.body.monospaced())
                if alert.triggered {
                    Text("TRIGGERED")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(Palette.warningAmberAlt)
                }
            }
        }
    }
}

// MARK: - Create Alert Sheet

struct CreateAlertSheet: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var symbol = ""
    @State private var targetPrice = ""
    @State private var direction: PriceAlert.Direction = .above
    @State private var error: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Symbol") {
                    TextField("e.g. AAPL", text: $symbol)
                        .autocorrectionDisabled()
                        .font(.body.monospaced())
                }

                Section("Target Price") {
                    TextField("0.00", text: $targetPrice)
                        .font(.body.monospaced())
                }

                Section("Direction") {
                    Picker("Trigger when price goes", selection: $direction) {
                        Text("Above").tag(PriceAlert.Direction.above)
                        Text("Below").tag(PriceAlert.Direction.below)
                    }
                    .pickerStyle(.segmented)
                }

                if let error {
                    Section {
                        Text(error)
                            .foregroundStyle(Palette.dangerRed)
                            .font(.caption)
                    }
                }

                Section {
                    Button {
                        Task { await createAlert() }
                    } label: {
                        Text("Create Alert")
                            .frame(maxWidth: .infinity)
                            .fontWeight(.semibold)
                    }
                    .disabled(symbol.isEmpty || targetPrice.isEmpty)
                    .tint(Palette.appleBlue)
                }
            }
            .navigationTitle("New Alert")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private func createAlert() async {
        guard !symbol.isEmpty else {
            error = "Enter a symbol"
            return
        }
        guard let price = Double(targetPrice), price > 0 else {
            error = "Enter a valid price"
            return
        }
        await appState.createAlert(
            symbol: symbol.uppercased().trimmingCharacters(in: .whitespaces),
            targetPrice: price,
            direction: direction
        )
        dismiss()
    }
}
