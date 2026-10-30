import SwiftUI

/// How the iPhone watchlist section orders its stocks; "My order" keeps the saved order.
enum WatchlistSort: String, CaseIterable, Identifiable {
    case manual, name, price, change
    var id: String { rawValue }
    var label: String {
        switch self {
        case .manual: "My Order"
        case .name: "Name"
        case .price: "Price"
        case .change: "% Change"
        }
    }

    /// Name A to Z; price and change biggest first, like Stocks.
    func apply(_ stocks: [Stock]) -> [Stock] {
        switch self {
        case .manual: stocks
        case .name: stocks.sorted { $0.symbol.localizedCompare($1.symbol) == .orderedAscending }
        case .price: stocks.sorted { $0.price > $1.price }
        case .change: stocks.sorted { $0.changePercent > $1.changePercent }
        }
    }
}

/// A small sort menu for the watchlist header.
struct WatchlistSortMenu: View {
    @Binding var sort: WatchlistSort

    var body: some View {
        Menu {
            Picker("Sort Watchlist", selection: $sort) {
                ForEach(WatchlistSort.allCases) { Text($0.label).tag($0) }
            }
        } label: {
            Image(systemName: "arrow.up.arrow.down")
                .font(.subheadline.weight(.semibold))
                .accessibilityLabel("Sort watchlist")
        }
    }
}
