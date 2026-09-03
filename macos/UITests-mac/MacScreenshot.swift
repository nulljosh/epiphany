import XCTest

@MainActor
final class MacScreenshot: XCTestCase {

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testCaptureMacScreenshot() throws {
        let env = ProcessInfo.processInfo.environment
        // Launch by path, not bundle id: LaunchServices has dozens of stale iOS-simulator
        // Epiphany.app registrations with the same id, and XCUIApplication() picks the wrong one.
        let runner = Bundle(for: MacScreenshot.self).bundleURL // .../Runner.app/Contents/PlugIns/X.xctest
        let appURL = runner.deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
            .deletingLastPathComponent().appendingPathComponent("Epiphany.app")
        let app = XCUIApplication(url: appURL)
        // ponytail: `-key value` launch args land in the UserDefaults argument domain, so
        // this forces dark mode + the flat map without touching app code. Hybrid/realistic
        // imagery never finished loading in 8s and washed the whole shot out.
        app.launchArguments += ["UITEST_SNAPSHOT", "-app_theme", "dark", "-situation.mapLayer", "standard", "-ApplePersistenceIgnoreState", "YES"]
        app.launchEnvironment["SNAPSHOT_EMAIL"] = env["TEST_RUNNER_SNAPSHOT_EMAIL"] ?? env["SNAPSHOT_EMAIL"] ?? "demo@heyitsmejosh.com"
        app.launchEnvironment["SNAPSHOT_PASSWORD"] = env["TEST_RUNNER_SNAPSHOT_PASSWORD"] ?? env["SNAPSHOT_PASSWORD"] ?? "EpiphanyDemo2026!"
        app.launch()
        sleep(5)
        app.activate()
        app.typeKey("1", modifierFlags: .command) // Situation tab
        sleep(25) // login + nine data layers + tiles

        let window = app.windows.firstMatch
        if !window.waitForExistence(timeout: 15) {
            XCTFail("App window never appeared: \(app.debugDescription)")
        }

        let screenshot = window.screenshot()
        let dir = NSTemporaryDirectory() + "epiphany-mac-screenshots"
        do {
            try FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
            try screenshot.pngRepresentation.write(to: URL(fileURLWithPath: "\(dir)/1-main.png"))
        } catch {
            XCTFail("Screenshot write failed: \(error)")
        }
    }
}
