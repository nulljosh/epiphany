import XCTest

@MainActor
final class PreviewScreenshot: XCTestCase {

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testCaptureAppStoreScreenshots() throws {
        let app = XCUIApplication()
        setupSnapshot(app)
        app.launchArguments.append("UITEST_SNAPSHOT")
        // Public demo account seeded specifically for App Store review/screenshots
        // (see .env.accounts.local DEMO_EMAIL/DEMO_PASSWORD) -- not a real user's data.
        app.launchEnvironment["SNAPSHOT_EMAIL"] = "demo@heyitsmejosh.com"
        app.launchEnvironment["SNAPSHOT_PASSWORD"] = "EpiphanyDemo2026!"
        app.launch()

        // Wait for UI to settle: location fix arrives, map re-centers, tiles fetch.
        sleep(10)
        snapshot("1-situation")

        // Auto-login (if SNAPSHOT_EMAIL/PASSWORD were set) can take a few seconds;
        // wait for the Portfolio "Sign In" placeholder to disappear before screenshotting
        // the authenticated tabs, instead of guessing a fixed delay.
        let signInButton = app.buttons["Sign In"]
        for _ in 0..<20 {
            if !signInButton.exists { break }
            sleep(1)
        }

        let tabs = [
            ("tab-markets", "2-markets"),
            ("tab-portfolio", "4-portfolio"),
            ("tab-settings", "5-settings"),
        ]
        for (identifier, name) in tabs {
            let button = app.buttons[identifier]
            if button.waitForExistence(timeout: 5) {
                button.tap()
                sleep(2)
                snapshot(name)
            }
        }
    }
}
