import SwiftUI

struct ContentView: View {
    @Environment(AppState.self) private var appState
    @State private var selectedTab = 0
 
    var body: some View {
        @Bindable var appState = appState

        TabView(selection: $selectedTab) {
            SituationView()
                .tabItem {
                    Image(systemName: "map")
                }
                .tag(0)
                .toolbar(.hidden, for: .tabBar)

            MarketsView()
                .tabItem {
                    Image(systemName: "chart.line.uptrend.xyaxis")
                }
                .tag(1)
                .toolbar(.hidden, for: .tabBar)

            if appState.isLoggedIn {
                PortfolioView()
                    .tabItem {
                        Image(systemName: "briefcase")
                    }
                    .tag(2)
                    .toolbar(.hidden, for: .tabBar)
            }

            SettingsView()
                .tabItem {
                    Image(systemName: "gearshape")
                }
                .tag(3)
                .toolbar(.hidden, for: .tabBar)
        }
        .toolbar(.hidden, for: .tabBar)
        .onChange(of: selectedTab) { _, _ in
            Haptics.selection()
        }
        .onChange(of: appState.isLoggedIn) { _, loggedIn in
            // Portfolio (tag 2) disappears from the TabView when signed out --
            // bounce off it back to Situation instead of landing on a blank tab.
            if !loggedIn, selectedTab == 2 { selectedTab = 0 }
        }
        .tint(Palette.appleBlue)
        .overlay(alignment: .bottom) {
            if !appState.hideFloatingTabBar {
                FloatingTabBar(selectedTab: $selectedTab, showPortfolio: appState.isLoggedIn)
                    .padding(.bottom, 8)
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
        .task {
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


private struct FloatingTabBar: View {
    @Binding var selectedTab: Int
    var showPortfolio: Bool

    private let icons = ["map", "chart.line.uptrend.xyaxis", "briefcase", "gearshape"]
    private let filledIcons = ["map.fill", "chart.line.uptrend.xyaxis", "briefcase.fill", "gearshape.fill"]
    private let identifiers = ["tab-situation", "tab-markets", "tab-portfolio", "tab-settings"]

    var body: some View {
        HStack(spacing: 0) {
            ForEach(icons.indices, id: \.self) { index in
                if index != 2 || showPortfolio {
                    tabButton(index)
                }
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 10)
        .frame(maxWidth: 300)
        .background(.regularMaterial, in: Capsule())
        .overlay(Capsule().stroke(Palette.overlay.opacity(0.08), lineWidth: 1))
        .shadow(color: .black.opacity(0.12), radius: 12, y: 4)
    }

    private func tabButton(_ index: Int) -> some View {
        Button {
            selectedTab = index
            Haptics.selection()
        } label: {
            Image(systemName: selectedTab == index ? filledIcons[index] : icons[index])
                .font(.system(size: 20, weight: .medium))
                .foregroundStyle(selectedTab == index ? Palette.text : Palette.textSecondary)
                .symbolEffect(.bounce, value: selectedTab == index)
                .frame(width: 50, height: 40)
                .background {
                    if selectedTab == index {
                        Capsule().fill(Palette.overlay.opacity(0.08))
                    }
                }
        }
        .frame(maxWidth: .infinity)
        .accessibilityIdentifier(identifiers[index])
    }
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
