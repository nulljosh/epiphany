import Foundation

/// Live price helpers shared by the iPhone and Mac asset pages.
enum LivePrice {
    /// The latest price every 15 seconds while the caller's task lives. Reads the last 5-minute bar:
    /// Yahoo updates its close as trades land, at a fifth of the payload of a day of 1-minute bars.
    @MainActor
    static func poll(_ symbol: String, every interval: Duration = .seconds(15), update: (Double) -> Void) async {
        while !Task.isCancelled {
            if let last = try? await EpiphanyAPI.shared.fetchPriceHistory(symbol: symbol, range: "1d").history.last?.close,
               last > 0 {
                update(last)
            }
            try? await Task.sleep(for: interval)
        }
    }

    /// Day change against the previous close the list row was built from, so a live tick moves it too.
    static func changePercent(listPrice: Double, listPercent: Double, live: Double?) -> Double {
        let prevClose = listPrice / (1 + listPercent / 100)
        guard let live, prevClose > 0 else { return listPercent }
        return (live / prevClose - 1) * 100
    }

    /// "1M High" reads as one month, so stats name intraday ranges plainly.
    static func rangeName(_ range: String) -> String {
        switch range {
        case "1m", "1d": return "Day"
        case "15m": return "5D"  // 15-minute bars over five days
        default: return range.uppercased()
        }
    }
}
