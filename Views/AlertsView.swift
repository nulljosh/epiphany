import SwiftUI

struct AlertsView: View {
    @Environment(AppState.self) private var appState
    @State private var showCreateSheet = false
    @State private var hasLoaded = false

    var body: some View {
        NavigationStack {
            Group {
                if !appState.isLoggedIn {
                    ContentUnavailableView {
                        Label("Alerts", systemImage: "bell.badge")
                    } description: {
                        Text("Sign in to create and manage price alerts.")
                    } actions: {
                        Button("Sign In") {
                            appState.showLogin = true
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(Palette.appleBlue)
                    }
                } else {
                    alertsList
                }
            }
            .navigationTitle("Alerts")
            .toolbar {
                if appState.isLoggedIn {
                    ToolbarItem(placement: .topBarTrailing) {
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
                ContentUnavailableView(
                    "No Alerts",
                    systemImage: "bell.slash",
                    description: Text("Tap + to create a price alert for any symbol.")
                )
                .listRowBackground(Color.clear)
            }
        }
    }

    private func alertRow(_ alert: PriceAlert) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(alert.symbol)
                    .font(.headline)
                Text(alert.direction == .above ? "Above" : "Below")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(String(format: "$%.2f", alert.targetPrice))
                    .font(.body.weight(.medium))
                if alert.triggered {
                    Text("TRIGGERED")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(Palette.warningAmber)
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
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                        .font(.body.weight(.medium))
                }

                Section("Target Price") {
                    TextField("0.00", text: $targetPrice)
                        .keyboardType(.decimalPad)
                        .font(.body.weight(.medium))
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
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
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
