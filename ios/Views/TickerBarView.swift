import SwiftUI

struct TickerBarView: View {
    let appState: AppState
    var onSelectStock: ((Stock) -> Void)? = nil

    @State private var contentWidth: CGFloat = 0

    private let itemSpacing: CGFloat = 18
    private let scrollSpeed: CGFloat = 30

    var body: some View {
        // Read appState.stocks directly -- the old onAppear/onChange cache
        // raced the data load and could leave the bar empty or frozen.
        let loopingStocks = appState.stocks + appState.stocks
        Group {
            if loopingStocks.isEmpty {
                EmptyView()
            } else {
                TimelineView(.animation(minimumInterval: 1.0 / 60.0)) { context in
                    let offset = scrollOffset(at: context.date)
                    HStack(spacing: itemSpacing) {
                        ForEach(Array(loopingStocks.enumerated()), id: \.offset) { _, stock in
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
                                .task(id: proxy.size.width) {
                                    // Fires on first layout and every width change --
                                    // a 0-width pre-layout pass can't freeze the scroll
                                    contentWidth = (proxy.size.width + itemSpacing) / 2
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
    }

    private func scrollOffset(at date: Date) -> CGFloat {
        guard contentWidth > 50 else { return 0 }
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
                .font(.caption.weight(.bold))
                .foregroundStyle(Palette.text)

            Text(stock.price, format: .currency(code: "USD").precision(.fractionLength(2)))
                .font(.caption.weight(.semibold).monospacedDigit())
                .foregroundStyle(changeColor)
        }
        .lineLimit(1)
    }
}
