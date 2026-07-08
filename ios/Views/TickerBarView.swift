import SwiftUI

private struct TickerDisplayItem: Identifiable {
    let id: Int
    let symbol: String
    let priceText: String
    let changeColor: Color
    let sparklineData: [Double]?
}

struct TickerBarView: View {
    let appState: AppState
    var onSelectStock: ((Stock) -> Void)? = nil
    var showSparklines: Bool = false
    var height: CGFloat = 32

    @State private var contentWidth: CGFloat = 0
    // Precomputed once per data change, not per animation frame -- formatting
    // currency + rebuilding this array at 60fps inside TimelineView was the
    // real cause of Markets-tab choppiness (competed with List scrolling).
    @State private var items: [TickerDisplayItem] = []

    private let itemSpacing: CGFloat = 18
    private var scrollSpeed: CGFloat { showSparklines ? 14 : 30 }

    private static let priceFormatter: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = "USD"
        f.minimumFractionDigits = 2
        f.maximumFractionDigits = 2
        return f
    }()

    var body: some View {
        Group {
            if items.isEmpty {
                EmptyView()
            } else {
                TimelineView(.animation(minimumInterval: 1.0 / 60.0)) { context in
                    let offset = scrollOffset(at: context.date)
                    HStack(spacing: itemSpacing) {
                        ForEach(items) { item in
                            Button {
                                if let stock = appState.stocks.first(where: { $0.symbol == item.symbol }) {
                                    onSelectStock?(stock)
                                }
                            } label: {
                                TickerItemView(item: item)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 12)
                    .fixedSize()
                    .background {
                        GeometryReader { proxy in
                            Color.clear
                                .task(id: proxy.size.width) {
                                    // Fires on first layout and every width change --
                                    // a 0-width pre-layout pass can't freeze the scroll
                                    contentWidth = (proxy.size.width + itemSpacing) / 2
                                }
                        }
                    }
                    .offset(x: -offset)
                }
                .frame(height: height)
                .clipped()
                .background(.thinMaterial)
                .overlay(alignment: .bottom) {
                    Divider()
                }
            }
        }
        .onAppear { rebuildItems() }
        .onChange(of: appState.stocks.map(\.symbol)) { _, _ in rebuildItems() }
        .onChange(of: appState.stocks.map(\.price)) { _, _ in rebuildItems() }
    }

    private func rebuildItems() {
        let stocks = appState.stocks
        let looped = stocks + stocks
        items = looped.enumerated().map { index, stock in
            TickerDisplayItem(
                id: index,
                symbol: stock.symbol,
                priceText: Self.priceFormatter.string(from: NSNumber(value: stock.price)) ?? "$0.00",
                changeColor: stock.change >= 0 ? Palette.successGreen : Palette.dangerRed,
                sparklineData: showSparklines ? appState.sparklineCache[stock.symbol] : nil
            )
        }
    }

    private func scrollOffset(at date: Date) -> CGFloat {
        guard contentWidth > 50 else { return 0 }
        let distance = CGFloat(date.timeIntervalSinceReferenceDate) * scrollSpeed
        return distance.truncatingRemainder(dividingBy: contentWidth)
    }
}

private struct TickerItemView: View {
    let item: TickerDisplayItem

    var body: some View {
        HStack(spacing: 6) {
            Text(item.symbol)
                .font(.caption.weight(.bold))
                .foregroundStyle(Palette.text)

            if let data = item.sparklineData, !data.isEmpty {
                SparklinePath(data: data, color: item.changeColor)
                    .frame(width: 32, height: 16)
            }

            Text(item.priceText)
                .font(.caption.weight(.semibold).monospacedDigit())
                .foregroundStyle(item.changeColor)
        }
        .lineLimit(1)
    }
}
