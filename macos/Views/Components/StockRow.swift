import SwiftUI

struct SparklinePath: View {
    let data: [Double]
    var color: Color = .green

    var body: some View {
        GeometryReader { geo in
            let minVal = data.min() ?? 0
            let maxVal = data.max() ?? 1
            let range = max(maxVal - minVal, 0.01)
            Path { path in
                for (i, val) in data.enumerated() {
                    let x = geo.size.width * CGFloat(i) / CGFloat(max(data.count - 1, 1))
                    let y = geo.size.height * (1 - CGFloat((val - minVal) / range))
                    if i == 0 { path.move(to: CGPoint(x: x, y: y)) }
                    else { path.addLine(to: CGPoint(x: x, y: y)) }
                }
            }
            .stroke(color, lineWidth: 1.5)
        }
    }
}

/// Sparkline in the iOS Stocks style: line, a fade underneath, and a dotted
/// line at the previous close.
struct SparklineChart: View {
    let data: [Double]
    var baseline: Double? = nil
    var color: Color = .green

    var body: some View {
        GeometryReader { geo in
            let values = data + (baseline.map { [$0] } ?? [])
            let lo = values.min() ?? 0
            let range = max((values.max() ?? 1) - lo, 0.0001)
            let w = geo.size.width, h = geo.size.height
            let point = { (i: Int, v: Double) in
                CGPoint(x: w * CGFloat(i) / CGFloat(max(data.count - 1, 1)),
                        y: h * (1 - CGFloat((v - lo) / range)))
            }
            let line = Path { p in
                for (i, v) in data.enumerated() {
                    i == 0 ? p.move(to: point(i, v)) : p.addLine(to: point(i, v))
                }
            }
            ZStack {
                Path { p in
                    p.addPath(line)
                    p.addLine(to: CGPoint(x: w, y: h))
                    p.addLine(to: CGPoint(x: 0, y: h))
                    p.closeSubpath()
                }
                .fill(LinearGradient(colors: [color.opacity(0.35), color.opacity(0)],
                                     startPoint: .top, endPoint: .bottom))
                line.stroke(color, style: StrokeStyle(lineWidth: 1.5, lineJoin: .round))
                if let baseline {
                    let y = h * (1 - CGFloat((baseline - lo) / range))
                    Path { p in p.move(to: CGPoint(x: 0, y: y)); p.addLine(to: CGPoint(x: w, y: y)) }
                        .stroke(Color.secondary.opacity(0.6), style: StrokeStyle(lineWidth: 1, dash: [2, 3]))
                }
            }
        }
    }
}

/// One quote row, laid out like the iOS Stocks list.
struct QuoteRow: View {
    let symbol: String
    let name: String
    let price: Double
    let changePercent: Double
    var sparklineData: [Double]? = nil
    /// Green or red behind the price for a moment when it ticks, like TradingView.
    @State private var flash: Color?

    var body: some View {
        let color = changePercent >= 0 ? Palette.successGreen : Palette.dangerRed
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(symbol.uppercased())
                    .font(.body.weight(.bold))
                    .foregroundStyle(.primary)
                Text(name)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 8)
            if let data = sparklineData, data.count > 1 {
                // Previous close, from today's change.
                SparklineChart(data: data, baseline: price / (1 + changePercent / 100), color: color)
                    .frame(width: 64, height: 36)
            }
            VStack(alignment: .trailing, spacing: 4) {
                Text(price.formatted(.number.precision(.fractionLength(2)).locale(Locale(identifier: "en_US"))))
                    .font(.body.weight(.medium).monospacedDigit())
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .padding(.horizontal, 4)
                    .background((flash ?? .clear).opacity(0.3), in: RoundedRectangle(cornerRadius: 4))
                    .padding(.horizontal, -4)
                Text(String(format: "%@%.2f%%", changePercent >= 0 ? "+" : "", changePercent))
                    .font(.footnote.weight(.semibold).monospacedDigit())
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                    .frame(width: 72, height: 26)
                    .background(color, in: RoundedRectangle(cornerRadius: 6, style: .continuous))
            }
            .frame(minWidth: 96, alignment: .trailing)
        }
        .padding(.vertical, 12)
        .contentShape(Rectangle())
        .onChange(of: price) { old, new in
            guard old != new else { return }
            flash = new > old ? Palette.successGreen : Palette.dangerRed
            withAnimation(.easeOut(duration: 0.8).delay(0.2)) { flash = nil }
        }
    }
}

struct StockRow: View {
    let stock: Stock
    let isWatchlisted: Bool
    let onToggleWatchlist: (() -> Void)?
    var sparklineData: [Double]? = nil

    init(stock: Stock, isWatchlisted: Bool = false, onToggleWatchlist: (() -> Void)? = nil, sparklineData: [Double]? = nil) {
        self.stock = stock
        self.isWatchlisted = isWatchlisted
        self.onToggleWatchlist = onToggleWatchlist
        self.sparklineData = sparklineData
    }

    private var changeColor: Color {
        stock.change >= 0 ? Palette.successGreen : Palette.dangerRed
    }

    private var changeSign: String {
        stock.change >= 0 ? "+" : ""
    }

    var body: some View {
        HStack(spacing: 10) {
            Group {
                if let onToggle = onToggleWatchlist {
                    Button {
                        onToggle()
                    } label: {
                        Image(systemName: isWatchlisted ? "star.fill" : "star")
                            .foregroundStyle(isWatchlisted ? Palette.warningAmberAlt : .secondary)
                            .font(.caption)
                            .frame(width: 18, height: 18)
                    }
                    .buttonStyle(.plain)
                } else {
                    Color.clear
                        .frame(width: 18, height: 18)
                }
            }

            AsyncImage(url: URL(string: "https://financialmodelingprep.com/image-stock/\(stock.symbol).png")) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().aspectRatio(contentMode: .fit)
                default:
                    ZStack {
                        Circle().fill(Palette.appleBlue.opacity(0.15))
                        Text(String(stock.symbol.prefix(1)))
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(Palette.appleBlue)
                    }
                }
            }
            .frame(width: 28, height: 28)
            .clipShape(RoundedRectangle(cornerRadius: 6))

            VStack(alignment: .leading, spacing: 2) {
                Text(stock.symbol.uppercased())
                    .font(.body.weight(.medium))
                Text(stock.name)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()

            if let data = sparklineData, data.count >= 2 {
                SparklinePath(data: data, color: changeColor)
                    .frame(width: 50, height: 20)
            }

            VStack(alignment: .trailing, spacing: 4) {
                Text(CurrencyFormatter.formatPrice(stock.price))
                    .font(.body.weight(.medium))
                Text(String(format: "%@%.2f%%", changeSign, stock.changePercent))
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(changeColor, in: Capsule())
            }
        }
    }
}
