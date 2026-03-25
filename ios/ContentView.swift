import SwiftUI

struct ContentView: View {
    @Environment(AppState.self) private var appState
    @State private var selectedTab = 0
    @State private var tickerSelectedStock: Stock?
 
    var body: some View {
        @Bindable var appState = appState

        TabView(selection: $selectedTab) {
            DeferredTab(isActive: selectedTab == 0) {
                SituationView()
            }
                .tabItem {
                    Label("Map", systemImage: "map")
                }
                .tag(0)

            DeferredTab(isActive: selectedTab == 1) {
                MarketsView()
            }
                .tabItem {
                    Label("Markets", systemImage: "chart.line.uptrend.xyaxis")
                }
                .tag(1)

            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gearshape")
                }
                .tag(2)
        }
        .onChange(of: selectedTab) { _, _ in
            Haptics.selection()
        }
        .tint(Palette.appleBlue)
        .safeAreaInset(edge: .top, spacing: 0) {
            if selectedTab == 1 {
                TickerBarView(appState: appState) { stock in
                    tickerSelectedStock = stock
                }
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
        _ = await (s, c, k)
    }
}

#Preview {
    ContentView()
        .environment(AppState())
}

private struct DeferredTab<Content: View>: View {
    let isActive: Bool
    @ViewBuilder let content: () -> Content
    @State private var hasActivated = false

    var body: some View {
        Group {
            if hasActivated || isActive {
                content()
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .onAppear {
            if isActive {
                hasActivated = true
            }
        }
        .onChange(of: isActive) { _, active in
            if active {
                hasActivated = true
            }
        }
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
