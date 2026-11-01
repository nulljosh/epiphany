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

    /// Live chart: fold a fresh quote into the current minute's bar, or open the next bar.
    static func fold(_ price: Double, into history: [PriceHistory.DataPoint], now: Date = .now) -> [PriceHistory.DataPoint] {
        let minute = Date(timeIntervalSince1970: (now.timeIntervalSince1970 / 60).rounded(.down) * 60)
        var h = history
        if let last = h.last, let at = last.parsedDate, at >= minute {
            guard at == minute else { return h }
            h[h.count - 1] = .init(date: last.date, open: last.open, high: max(last.high ?? price, price), low: min(last.low ?? price, price), close: price, volume: last.volume)
        } else {
            h.append(.init(date: ISO8601DateFormatter().string(from: minute), open: h.last?.close ?? price, high: price, low: price, close: price, volume: nil))
        }
        return h
    }

    /// Day change against the previous close the list row was built from, so a live tick moves it too.
    static func changePercent(listPrice: Double, listPercent: Double, live: Double?) -> Double {
        let prevClose = listPrice / (1 + listPercent / 100)
        guard let live, prevClose > 0 else { return listPercent }
        return (live / prevClose - 1) * 100
    }

    /// Short picker labels: lowercase m is minutes, capital M is months, so "1m" and "1M" never collide.
    static func rangeLabel(_ range: String) -> String {
        switch range {
        case "1m", "15m": return range
        case "live": return "Live"
        case "1mo": return "1M"
        case "3mo": return "3M"
        case "6mo": return "6M"
        case "max": return "ALL"
        default: return range.uppercased()
        }
    }

    /// "1M High" reads as one month, so stats name intraday ranges plainly.
    static func rangeName(_ range: String) -> String {
        switch range {
        case "live", "1m", "1d": return "Day"
        case "15m": return "5D"  // 15-minute bars over five days
        case "max": return "All-Time"
        default: return rangeLabel(range)
        }
    }

    private struct Tick: Decodable { let type: String; let price: String? }

    /// Crypto ticks over Coinbase's public feed, at most one update a second. Returns when the socket
    /// drops or the symbol has no feed, so the caller can fall back to `poll`.
    @MainActor
    static func stream(_ symbol: String, update: (Double) -> Void) async {
        guard symbol.hasSuffix("-USD"), let url = URL(string: "wss://ws-feed.exchange.coinbase.com") else { return }
        let socket = URLSession.shared.webSocketTask(with: url)
        socket.resume()
        let subscribe = "{\"type\":\"subscribe\",\"product_ids\":[\"\(symbol)\"],\"channels\":[\"ticker\"]}"
        await withTaskCancellationHandler {
            guard (try? await socket.send(.string(subscribe))) != nil else { return }
            var last = Date.distantPast
            while !Task.isCancelled {
                guard let message = try? await socket.receive() else { return }
                guard case .string(let text) = message,
                      let tick = try? JSONDecoder().decode(Tick.self, from: Data(text.utf8)),
                      tick.type == "ticker", let price = tick.price.flatMap(Double.init), price > 0,
                      Date().timeIntervalSince(last) >= 1 else { continue }
                last = Date()
                update(price)
            }
        } onCancel: {
            socket.cancel(with: .goingAway, reason: nil)
        }
    }
}
