import SwiftUI

struct TickerBarView: View {
    let appState: AppState
    var onSelectStock: ((Stock) -> Void)? = nil

    @State private var trackOffset: CGFloat = 0
    @State private var isHovering = false
    @State private var containerWidth: CGFloat = 0
    @State private var singleTrackWidth: CGFloat = 0

    private let itemSpacing: CGFloat = 18
    private let animationSpeed: CGFloat = 40

    private var visibleStocks: [Stock] {
        Array(appState.stocks.prefix(14))
    }

    private var stockIdentity: Int {
        var hasher = Hasher()
        for stock in visibleStocks { hasher.combine(stock.id) }
        return hasher.finalize()
    }

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                if visibleStocks.isEmpty {
                    Color.clear
                } else {
                    HStack(spacing: itemSpacing) {
                        tickerTrack(visibleStocks, measureWidth: true)
                        tickerTrack(visibleStocks, measureWidth: false)
                    }
                    .fixedSize(horizontal: true, vertical: false)
                    .offset(x: trackOffset)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            .contentShape(Rectangle())
            .onHover { hovering in
                isHovering = hovering
            }
            .onAppear { containerWidth = geometry.size.width }
            .onChange(of: geometry.size.width) { _, w in containerWidth = w }
        }
        .onChange(of: animationInputs) { _, _ in
            syncAnimation()
        }
        .padding(.horizontal, 12)
        .frame(maxWidth: .infinity)
        .frame(height: 40)
        .background(.thinMaterial)
        .overlay(alignment: .bottom) {
            Divider()
        }
        .clipped()
    }

    private func tickerTrack(_ stocks: [Stock], measureWidth: Bool) -> some View {
        HStack(spacing: itemSpacing) {
            ForEach(stocks) { stock in
                Button {
                    onSelectStock?(stock)
                } label: {
                    TickerItemView(stock: stock)
                }
                .buttonStyle(.plain)
            }
        }
        .fixedSize(horizontal: true, vertical: false)
        .background(measureWidth ? AnyView(widthReader) : AnyView(EmptyView()))
    }

    private var widthReader: some View {
        GeometryReader { geo in
            Color.clear
                .onAppear { singleTrackWidth = geo.size.width }
                .onChange(of: geo.size.width) { _, w in singleTrackWidth = w }
        }
    }

    private var animationInputs: [Int] {
        [stockIdentity, Int(singleTrackWidth), Int(containerWidth), isHovering ? 1 : 0]
    }

    private func syncAnimation() {
        guard !isHovering, singleTrackWidth > containerWidth, visibleStocks.count > 1 else {
            withAnimation(.none) { trackOffset = 0 }
            return
        }

        let distance = singleTrackWidth + itemSpacing
        let duration = max(distance / animationSpeed, 12)

        trackOffset = 0
        withAnimation(.linear(duration: duration).repeatForever(autoreverses: false)) {
            trackOffset = -distance
        }
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
        .padding(.vertical, 2)
        .lineLimit(1)
        .fixedSize(horizontal: true, vertical: false)
    }
}
