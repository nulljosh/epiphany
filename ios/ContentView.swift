import SwiftUI

struct ContentView: View {
    @Environment(AppState.self) private var appState
    @State private var selectedTab = 0
    @State private var tickerSelectedStock: Stock?
    @State private var showTicker = false
 
    var body: some View {
        @Bindable var appState = appState

        TabView(selection: $selectedTab) {
            SituationView()
                .tabItem {
                    Label("Map", systemImage: "map")
                }
                .tag(0)

            MarketsView()
                .tabItem {
                    Label("Markets", systemImage: "chart.line.uptrend.xyaxis")
                }
                .tag(1)

            PeopleView()
                .tabItem {
                    Label("People", systemImage: "person.crop.rectangle.stack")
                }
                .tag(2)

            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gearshape")
                }
                .tag(3)
        }
        .onChange(of: selectedTab) { _, _ in
            Haptics.selection()
        }
        .tint(Palette.appleBlue)
        .safeAreaInset(edge: .top, spacing: 0) {
            if showTicker {
                TickerBarView(appState: appState) { stock in
                    tickerSelectedStock = stock
                }
            }
        }
        .onChange(of: selectedTab) { _, tab in
            if tab == 1 && !appState.stocks.isEmpty {
                Task {
                    try? await Task.sleep(for: .milliseconds(400))
                    withAnimation(.easeIn(duration: 0.2)) { showTicker = true }
                }
            } else {
                showTicker = false
            }
        }
        .sheet(item: $tickerSelectedStock) { stock in
            NavigationStack {
                StockDetailView(stock: stock)
                    .environment(appState)
            }
        }
        .overlay(alignment: .top) {
            if let error = appState.error, !error.isEmpty {
                SharedErrorBanner(message: error) {
                    appState.error = nil
                }
                .padding(.top, 8)
            }
        }
        .task { await preloadMarketData() }
        .sheet(isPresented: $appState.showLogin) {
            LoginSheet()
                .environment(appState)
        }
    }

    private func preloadMarketData() async {
        async let s: Void = appState.loadStocks()
        async let c: Void = appState.loadCommodities()
        async let k: Void = appState.loadCrypto()
        async let w: Void = appState.loadWatchlist()
        async let f: Void = appState.loadFinanceData()
        async let t: Void = appState.loadTallyData()
        async let st: Void = appState.loadStatements()
        async let fg: Void = appState.loadFearGreed()
        _ = await (s, c, k, w, f, t, st, fg)
    }
}

#Preview {
    ContentView()
        .environment(AppState())
}


private struct SharedErrorBanner: View {
    let message: String
    let onDismiss: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(Palette.dangerRed)
            Text(message)
                .font(.caption)
                .lineLimit(2)
            Spacer(minLength: 8)
            Button("Dismiss", action: onDismiss)
                .font(.caption.weight(.semibold))
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(.ultraThinMaterial, in: Capsule())
        .padding(.horizontal)
        .overlay(Capsule().stroke(Palette.overlay.opacity(0.1), lineWidth: 1))
    }
}
