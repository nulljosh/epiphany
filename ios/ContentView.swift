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

            MarketsView()
                .tabItem {
                    Image(systemName: "chart.line.uptrend.xyaxis")
                }
                .tag(1)

            PortfolioView()
                .tabItem {
                    Image(systemName: "briefcase")
                }
                .tag(2)

            SettingsView()
                .tabItem {
                    Image(systemName: "gearshape")
                }
                .tag(3)
        }
        .toolbar(.hidden, for: .tabBar)
        .onChange(of: selectedTab) { _, _ in
            Haptics.selection()
        }
        .tint(Palette.appleBlue)
        .overlay(alignment: .bottom) {
            FloatingTabBar(selectedTab: $selectedTab)
                .padding(.bottom, 8)
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


private struct FloatingTabBar: View {
    @Binding var selectedTab: Int

    private let icons = ["map", "chart.line.uptrend.xyaxis", "briefcase", "gearshape"]

    var body: some View {
        HStack(spacing: 0) {
            ForEach(icons.indices, id: \.self) { index in
                tabButton(index)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 10)
        .frame(maxWidth: 260)
        .background(.regularMaterial, in: Capsule())
        .overlay(Capsule().stroke(Palette.overlay.opacity(0.08), lineWidth: 1))
        .shadow(color: .black.opacity(0.12), radius: 12, y: 4)
    }

    private func tabButton(_ index: Int) -> some View {
        Button {
            selectedTab = index
            Haptics.selection()
        } label: {
            Image(systemName: icons[index])
                .font(.system(size: 18, weight: .medium))
                .foregroundStyle(selectedTab == index ? Palette.text : Palette.textSecondary)
                .frame(width: 44, height: 36)
                .background {
                    if selectedTab == index {
                        Capsule().fill(Palette.overlay.opacity(0.08))
                    }
                }
        }
        .frame(maxWidth: .infinity)
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
