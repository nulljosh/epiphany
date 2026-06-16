import UserNotifications
import UIKit

// TODO: Requires APNs certificate setup in Apple Developer Console
@MainActor
@Observable
final class NotificationManager: NSObject {
    static let shared = NotificationManager()

    private(set) var isAuthorized = false
    private(set) var deviceToken: String?

    override private init() {
        super.init()
    }

    func requestAuthorization() async {
        do {
            let granted = try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .badge, .sound])
            isAuthorized = granted
            if granted {
                await MainActor.run {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }
        } catch {
            print("[Notifications] Auth failed: \(error)")
        }
    }

    func handleDeviceToken(_ token: Data) {
        deviceToken = token.map { String(format: "%02x", $0) }.joined()
        // TODO: Send deviceToken to backend for push delivery
    }

    func scheduleLocalAlert(title: String, body: String, delay: TimeInterval = 0) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default

        let trigger = delay > 0
            ? UNTimeIntervalNotificationTrigger(timeInterval: delay, repeats: false)
            : nil

        let request = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: trigger
        )

        UNUserNotificationCenter.current().add(request)
    }
}
