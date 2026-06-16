import SwiftUI

struct PredictionsView: View {
    @Environment(AppState.self) private var appState
    @State private var hasLoaded = false
    @State private var searchText = ""

    private var filteredMarkets: [PredictionMarket] {
        let markets = appState.markets
        guard !searchText.isEmpty else { return markets }
        return markets.filter { market in
            market.question.localizedCaseInsensitiveContains(searchText) ||
            (market.description?.localizedCaseInsensitiveContains(searchText) ?? false)
        }
    }

    private var totalVolumeText: String {
        PredictionMarket.formatCurrency(appState.markets.compactMap { $0.volume24hr ?? $0.volume }.reduce(0, +))
    }

    var body: some View {
        NavigationStack {
            Group {
                if appState.markets.isEmpty {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 16) {
                            headerCard

                            VStack(spacing: 12) {
                                ForEach(filteredMarkets) { market in
                                    MarketCard(market: market)
                                }
                            }
                        }
                        .padding(.horizontal)
                        .padding(.top, 12)
                        .padding(.bottom, 96)
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

    private var headerCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Live Prediction Markets")
                        .font(.headline)
                    Text("\(filteredMarkets.count) active markets")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 4) {
                    Text("24h Volume")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(totalVolumeText)
                        .font(.subheadline.monospacedDigit().weight(.semibold))
                }
            }

            TextField("Search markets", text: $searchText)
                .textFieldStyle(.roundedBorder)
        }
        .padding(16)
        .background(Color.white.opacity(0.04), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}
