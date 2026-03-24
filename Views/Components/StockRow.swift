import SwiftUI

struct StockRow: View {
    let stock: Stock
    let isWatchlisted: Bool
    let onToggleWatchlist: (() -> Void)?

    init(stock: Stock, isWatchlisted: Bool = false, onToggleWatchlist: (() -> Void)? = nil) {
        self.stock = stock
        self.isWatchlisted = isWatchlisted
        self.onToggleWatchlist = onToggleWatchlist
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
                            .foregroundStyle(isWatchlisted ? Palette.warningAmber : .secondary)
                            .font(.caption)
                            .frame(width: 18, height: 18)
                    }
                    .buttonStyle(BounceButtonStyle())
                } else {
                    Color.clear
                        .frame(width: 18, height: 18)
                }
            }

            AsyncImage(url: URL(string: "https://financialmodelingprep.com/image-stock/\(stock.symbol).png")) { phase in
                switch phase {
                case .success(let image):
                    image.resizable()
                        .aspectRatio(contentMode: .fit)
                default:
                    InitialCircle(text: stock.symbol, color: Palette.appleBlue)
                }
            }
            .frame(width: 32, height: 32)
            .clipShape(RoundedRectangle(cornerRadius: 8))

            VStack(alignment: .leading, spacing: 2) {
                Text(stock.symbol.uppercased())
                    .font(.body.weight(.medium))
                Text(stock.name)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                Text(String(format: "$%.2f", stock.price))
                    .font(.body.weight(.medium))
                ChangePill(text: String(format: "%@%.2f%%", changeSign, stock.changePercent), color: changeColor)
            }
        }
        .padding(.vertical, 6)
        .contentShape(Rectangle())
    }
}
