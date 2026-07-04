import XCTest

@MainActor
final class PreviewScreenshot: XCTestCase {

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    private func launchAuthenticated() -> XCUIApplication {
        let app = XCUIApplication()
        setupSnapshot(app)
        app.launchArguments.append("UITEST_SNAPSHOT")
        // Public demo account seeded specifically for App Store review/screenshots
        // (see .env.accounts.local DEMO_EMAIL/DEMO_PASSWORD) -- not a real user's data.
        app.launchEnvironment["SNAPSHOT_EMAIL"] = ProcessInfo.processInfo.environment["SNAPSHOT_EMAIL"] ?? "demo@heyitsmejosh.com"
        app.launchEnvironment["SNAPSHOT_PASSWORD"] = ProcessInfo.processInfo.environment["SNAPSHOT_PASSWORD"] ?? "EpiphanyDemo2026!"
        app.launch()

        // Wait for UI to settle: location fix arrives, map re-centers, tiles fetch.
        sleep(10)

        // Auto-login can take a few seconds; wait for the Portfolio "Sign In"
        // placeholder to disappear before screenshotting authenticated tabs.
        let signInButton = app.buttons["Sign In"]
        for _ in 0..<20 {
            if !signInButton.exists { break }
            sleep(1)
        }

        let gotIt = app.buttons["Got it"]
        if gotIt.waitForExistence(timeout: 3) {
            gotIt.tap()
        }
        return app
    }

    func testCaptureAppStoreScreenshots() throws {
        // Run 1: Situation, Markets, and a fresh tap into stock detail.
        // (Kept in one launch since the map needs its 10s location settle time once.)
        var app = launchAuthenticated()
        snapshot("1-situation")

        if app.buttons["tab-markets"].waitForExistence(timeout: 5) {
            app.buttons["tab-markets"].tap()
            sleep(2)
            snapshot("2-markets")

            let row = app.buttons["market-stock-row"].firstMatch
            if row.waitForExistence(timeout: 5) {
                row.tap()
                sleep(2)
                snapshot("3-stock-detail")
            }
        }
        app.terminate()

        // Run 2: fresh launch straight to Portfolio -- avoids needing to dismiss
        // the stock-detail sheet (no close button, drag-to-dismiss proved flaky
        // in CI and produced duplicate screenshots instead of advancing tabs).
        app = launchAuthenticated()
        if app.buttons["tab-portfolio"].waitForExistence(timeout: 5) {
            app.buttons["tab-portfolio"].tap()
            sleep(2)
            snapshot("4-portfolio")
        }
        app.terminate()

        // Run 3: fresh launch straight to Settings.
        app = launchAuthenticated()
        if app.buttons["tab-settings"].waitForExistence(timeout: 5) {
            app.buttons["tab-settings"].tap()
            sleep(2)
            snapshot("5-settings")
        }
    }
}
