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
                Text(alert.kind == "digest" ? "Watchlist" : alert.symbol)
                    .font(.headline)
                Text(alert.summary)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                if alert.kind != "earnings" && alert.kind != "digest" {
                    Text(CurrencyFormatter.formatPrice(alert.targetPrice))
                        .font(.body.weight(.medium))
                }
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
    @State private var kind = "price"
    @State private var error: String?
    @State private var isCreating = false

    var body: some View {
        NavigationStack {
            Form {
                if kind != "digest" {
                    Section("Symbol") {
                        TextField("e.g. AAPL", text: $symbol)
                            .textInputAutocapitalization(.characters)
                            .autocorrectionDisabled()
                            .font(.body.weight(.medium))
                    }
                }

                Section {
                    Picker("Alert me on", selection: $kind) {
                        ForEach(PriceAlert.kinds, id: \.id) { Text($0.label).tag($0.id) }
                    }
                    .pickerStyle(.segmented)
                } header: {
                    Text("Kind")
                } footer: {
                    if kind != "price" && kind != "move" {
                        Text(kind == "digest" ? "Every Sunday, one email with the stocks on your watchlists that report that week." : kind == "earnings" ? "Emails you the day before the report." : "Uses today's 52 week range. We email you when it hits, even with Epiphany closed.")
                    }
                }

                if kind == "move" {
                    Section {
                        TextField("10", text: $targetPrice)
                            .keyboardType(.decimalPad)
                            .font(.body.weight(.medium))
                    } header: {
                        Text("Move in a day (%)")
                    } footer: {
                        Text("We email you when it moves that much in a day, up or down.")
                    }
                }

                if kind == "price" {
                    Section("Target Price") {
                        TextField("0.00", text: $targetPrice)
                            .keyboardType(.decimalPad)
                            .font(.body.weight(.medium))
                    }

                    Section {
                        Picker("Trigger when price goes", selection: $direction) {
                            Text("Above").tag(PriceAlert.Direction.above)
                            Text("Below").tag(PriceAlert.Direction.below)
                        }
                        .pickerStyle(.segmented)
                    } header: {
                        Text("Direction")
                    } footer: {
                        Text("We email you when it hits, even with Epiphany closed.")
                    }
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
                    .disabled((symbol.isEmpty && kind != "digest") || ((kind == "price" || kind == "move") && targetPrice.isEmpty) || isCreating)
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
        guard !symbol.isEmpty || kind == "digest" else {
            error = "Enter a symbol"
            return
        }
        let price = parseAmount(targetPrice)
        if kind == "price" || kind == "move", (price ?? 0) <= 0 {
            error = "Enter a valid price"
            return
        }
        guard !isCreating else { return }
        isCreating = true
        defer { isCreating = false }
        await appState.createAlert(
            symbol: symbol.uppercased().trimmingCharacters(in: .whitespaces),
            targetPrice: kind == "price" || kind == "move" ? price : nil,
            direction: direction,
            kind: kind
        )
        dismiss()
    }
}
