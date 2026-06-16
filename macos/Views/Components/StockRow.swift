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
                Text(String(format: "$%.2f", stock.price))
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
