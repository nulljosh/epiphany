import SwiftUI

struct PredictionsView: View {
    @Environment(AppState.self) private var appState
    @State private var hasLoaded = false

    var body: some View {
        NavigationStack {
            Group {
                if appState.markets.isEmpty && !hasLoaded {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if appState.markets.isEmpty {
                    ContentUnavailableView(
                        "No Prediction Markets",
                        systemImage: "chart.pie",
                        description: Text("Polymarket data is temporarily unavailable. Pull to refresh.")
                    )
                } else {
                    List(appState.markets) { market in
                        MarketCard(market: market)
                            .listRowBackground(
                                RoundedRectangle(cornerRadius: 8)
                                    .fill(.ultraThinMaterial)
                                    .padding(2)
                            )
                    }
                }
            }
            .navigationTitle("Predictions")
        }
        .onAppear {
            guard !hasLoaded else { return }
            hasLoaded = true
            Task {
                await appState.loadMarkets()
            }
        }
    }
}
