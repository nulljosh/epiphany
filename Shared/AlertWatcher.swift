#if os(iOS)
import BackgroundTasks
#endif
import Foundation
import UserNotifications

/// Price alerts as local notifications. iOS wakes the app for a background refresh (best effort,
/// usually every 15 to 60 minutes); the Mac checks on a timer while it runs, menu bar included.
/// Either way we check active alerts against live quotes and post to Notification Center.
/// ponytail: on-device polling, not APNs. Server push needs an APNs key; swap this out when one exists.
enum AlertWatcher {
    static let taskID = "com.heyitsmejosh.epiphany.alerts"
    private static let firedKey = "alert_watcher_fired_ids"

    #if os(iOS)
    static func schedule() {
        let request = BGAppRefreshTaskRequest(identifier: taskID)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
        try? BGTaskScheduler.shared.submit(request)
    }
    #endif

    /// Notifies once for each active alert whose target the live price has crossed.
    static func check() async {
        guard let alerts = try? await EpiphanyAPI.shared.fetchAlerts() else { return }
        let active = alerts.filter { !$0.triggered }
        guard !active.isEmpty else { return }
        let symbols = Array(Set(active.map(\.symbol)))
        guard let quotes = try? await EpiphanyAPI.shared.fetchQuotes(symbols: symbols) else { return }
        let prices = Dictionary(quotes.map { ($0.symbol, $0.price) }, uniquingKeysWith: { a, _ in a })

        var fired = Set(UserDefaults.standard.stringArray(forKey: firedKey) ?? [])
        for alert in active where !fired.contains(alert.id) {
            guard let price = prices[alert.symbol], crossed(alert, price) else { continue }
            let content = UNMutableNotificationContent()
            content.title = "\(alert.symbol) is \(alert.direction == .above ? "above" : "below") \(CurrencyFormatter.formatPrice(alert.targetPrice))"
            content.body = "Now \(CurrencyFormatter.formatPrice(price))."
            content.sound = .default
            try? await UNUserNotificationCenter.current()
                .add(UNNotificationRequest(identifier: "alert-\(alert.id)", content: content, trigger: nil))
            fired.insert(alert.id)
        }
        // Forget alerts that were deleted so the set doesn't grow forever.
        fired.formIntersection(alerts.map(\.id))
        UserDefaults.standard.set(Array(fired), forKey: firedKey)
    }

    static func crossed(_ alert: PriceAlert, _ price: Double) -> Bool {
        alert.direction == .above ? price >= alert.targetPrice : price <= alert.targetPrice
    }
}
