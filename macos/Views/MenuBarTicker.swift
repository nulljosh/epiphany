import SwiftUI
import UserNotifications

/// Watchlist prices in the menu bar, so a glance doesn't need the window.
/// The label also drives the refresh loop: prices every minute, price alerts every five.
/// ponytail: the loop lives on the label, so hiding the menu bar item also stops alerts; move it to an
/// app-level actor if people want alerts without the menu bar.
struct MenuBarTickerLabel: View {
    let appState: AppState

    var body: some View {
        Group {
            if let stock = MenuBarTicker.stocks(appState).first {
                HStack(spacing: 4) {
                    Image(systemName: stock.changePercent >= 0 ? "arrow.up.right" : "arrow.down.right")
                    Text("\(stock.symbol) \(CurrencyFormatter.formatPrice(stock.price))")
                }
            } else {
                Image(systemName: "chart.line.uptrend.xyaxis")
            }
        }
        .task {
            UNUserNotificationCenter.current().delegate = AlertBannerDelegate.shared
            var tick = 0
            while !Task.isCancelled {
                if tick > 0 { await appState.loadStocks(force: true) }
                if tick % 5 == 0, appState.isLoggedIn {
                    await appState.loadAlerts()
                    if !appState.activeAlerts.isEmpty { await AlertWatcher.check() }
                }
                tick += 1
                try? await Task.sleep(for: .seconds(60))
            }
        }
    }
}

struct MenuBarTicker: View {
    let appState: AppState
    @Environment(\.openWindow) private var openWindow

    /// The watchlist first; with no watchlist, the top of the market list.
    static func stocks(_ appState: AppState) -> [Stock] {
        let watched = appState.watchlistStocks
        return Array((watched.isEmpty ? appState.stocks : watched).prefix(8))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            let stocks = Self.stocks(appState)
            if stocks.isEmpty {
                Text("Prices load when Epiphany connects.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .padding(12)
            }
            ForEach(stocks) { stock in
                HStack {
                    VStack(alignment: .leading, spacing: 1) {
                        Text(stock.symbol).font(.callout.weight(.semibold))
                        Text(stock.name).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                    }
                    Spacer(minLength: 16)
                    VStack(alignment: .trailing, spacing: 1) {
                        Text(CurrencyFormatter.formatPrice(stock.price))
                            .font(.callout.weight(.semibold).monospacedDigit())
                        Text(String(format: "%+.2f%%", stock.changePercent))
                            .font(.caption.weight(.medium).monospacedDigit())
                            .foregroundStyle(stock.changePercent >= 0 ? Palette.successGreen : Palette.dangerRed)
                    }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
            }
            Divider().padding(.vertical, 4)
            HStack {
                Button("Open Epiphany") {
                    openWindow(id: "main")
                    NSApp.activate()
                }
                Spacer()
                Button("Quit") { NSApp.terminate(nil) }
            }
            .buttonStyle(.borderless)
            .padding(.horizontal, 12)
            .padding(.bottom, 8)
        }
        .frame(width: 280)
        .padding(.top, 6)
    }
}

/// macOS hides banners while the app is frontmost unless a delegate asks for them.
final class AlertBannerDelegate: NSObject, UNUserNotificationCenterDelegate, Sendable {
    static let shared = AlertBannerDelegate()

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async
        -> UNNotificationPresentationOptions { [.banner, .sound] }
}
