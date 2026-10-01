import SwiftUI

struct ContentView: View {
    @Environment(AppState.self) private var appState
    @State private var selectedTab = 0
 
    var body: some View {
        @Bindable var appState = appState

        TabView(selection: $selectedTab) {
            SituationView()
                .tabItem { Label("Map", systemImage: "map") }
                .tag(0)

            MarketsView()
                .tabItem { Label("Markets", systemImage: "chart.line.uptrend.xyaxis") }
                .tag(1)

            if appState.isLoggedIn {
                PortfolioView()
                    .tabItem { Label("Portfolio", systemImage: "briefcase") }
                    .tag(2)
            }

            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape") }
                .tag(3)
        }
        .toolbar(appState.hideFloatingTabBar ? .hidden : .visible, for: .tabBar)
        .onChange(of: selectedTab) { _, _ in
            Haptics.selection()
        }
        .onChange(of: appState.isLoggedIn) { _, loggedIn in
            // Portfolio (tag 2) disappears from the TabView when signed out --
            // bounce off it back to Situation instead of landing on a blank tab.
            if !loggedIn, selectedTab == 2 { selectedTab = 0 }
        }
        .tint(Palette.appleBlue)
        .overlay(alignment: .top) {
            if let error = appState.error, !error.isEmpty {
                SharedErrorBanner(message: error) {
                    appState.error = nil
                }
                .padding(.top, 8)
            }
        }
        .task {
            if CommandLine.arguments.contains("UITEST_DEMO") {
                // Screenshots only: sample user and portfolio, public market data, no network login.
                appState.user = DemoData.user
                appState.financeData = DemoData.finance
                appState.financeDataLoaded = true
                // One after another: `async let` on the main-actor appState is a data-race error in Swift 6.
                await appState.loadStocks()
                await appState.loadCommodities()
                await appState.loadCrypto()
                await appState.loadFearGreed()
                appState.portfolio = Portfolio(financeData: DemoData.finance, stocks: appState.stocks)
                return
            }
            if CommandLine.arguments.contains("UITEST_SNAPSHOT"),
               let email = ProcessInfo.processInfo.environment["SNAPSHOT_EMAIL"],
               let password = ProcessInfo.processInfo.environment["SNAPSHOT_PASSWORD"] {
                await appState.login(email: email, password: password)
            }
            await preloadMarketData()
        }
        .sheet(isPresented: $appState.showLogin, onDismiss: { appState.showLoginInRegisterMode = false }) {
            LoginSheet(startInRegisterMode: appState.showLoginInRegisterMode)
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
        .liquidGlass(in: Capsule(), fallback: .ultraThinMaterial)
        .padding(.horizontal)
        .overlay(Capsule().stroke(Palette.overlay.opacity(0.1), lineWidth: 1))
    }
}
