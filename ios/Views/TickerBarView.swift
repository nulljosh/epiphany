import SwiftUI

struct TickerBarView: View {
    let appState: AppState
    var onSelectStock: ((Stock) -> Void)? = nil

    @State private var contentWidth: CGFloat = 0
    @State private var cachedLoopingStocks: [Stock] = []

    private let itemSpacing: CGFloat = 18
    private let scrollSpeed: CGFloat = 30

    var body: some View {
        Group {
            if cachedLoopingStocks.isEmpty {
                EmptyView()
            } else {
                TimelineView(.animation(minimumInterval: 1.0 / 15.0)) { context in
                    let offset = scrollOffset(at: context.date)
                    HStack(spacing: itemSpacing) {
                        ForEach(Array(cachedLoopingStocks.enumerated()), id: \.offset) { _, stock in
                            Button {
                                onSelectStock?(stock)
                            } label: {
                                TickerItemView(stock: stock)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 12)
                    .fixedSize()
                    .background {
                        GeometryReader { proxy in
                            Color.clear
                                .onAppear {
                                    contentWidth = (proxy.size.width + itemSpacing) / 2
                                }
                                .onChange(of: proxy.size.width) { _, newWidth in
                                    contentWidth = (newWidth + itemSpacing) / 2
                                }
                        }
                    }
                    .offset(x: -offset)
                }
                .frame(height: 32)
                .clipped()
                .background(.thinMaterial)
                .overlay(alignment: .bottom) {
                    Divider()
                }
            }
        }
        .onChange(of: appState.stocks) { _, newStocks in
            cachedLoopingStocks = newStocks + newStocks
        }
        .onAppear {
            if !appState.stocks.isEmpty {
                cachedLoopingStocks = appState.stocks + appState.stocks
            }
        }
    }

    private func scrollOffset(at date: Date) -> CGFloat {
        guard contentWidth > 1 else { return 0 }
        let distance = CGFloat(date.timeIntervalSinceReferenceDate) * scrollSpeed
        return distance.truncatingRemainder(dividingBy: contentWidth)
    }
}

private struct TickerItemView: View {
    let stock: Stock

    private var changeColor: Color {
        stock.change >= 0 ? Palette.successGreen : Palette.dangerRed
    }

    var body: some View {
        HStack(spacing: 6) {
            Text(stock.symbol)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.primary)

            Text(stock.price, format: .currency(code: "USD").precision(.fractionLength(2)))
                .font(.caption.monospacedDigit())
                .foregroundStyle(changeColor)
        }
        .lineLimit(1)
    }
}
