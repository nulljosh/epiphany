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
        // Credentials come from .env.accounts.local DEMO_EMAIL/DEMO_PASSWORD.
        // No fallback account: an empty demo login silently produced screenshots
        // with no portfolio and no settings data. Fail the run instead.
        let env = ProcessInfo.processInfo.environment
        guard let email = env["SNAPSHOT_EMAIL"], let password = env["SNAPSHOT_PASSWORD"] else {
            XCTFail("SNAPSHOT_EMAIL/SNAPSHOT_PASSWORD not set (pass via TEST_RUNNER_ prefix)")
            return app
        }
        app.launchEnvironment["SNAPSHOT_EMAIL"] = email
        app.launchEnvironment["SNAPSHOT_PASSWORD"] = password
        app.launch()

        // Wait for UI to settle: location fix arrives, map re-centers, tiles fetch.
        sleep(10)

        // Auto-login can take a few seconds. The Portfolio tab only renders once
        // isLoggedIn is true, so it is the login signal -- the old check watched
        // for a "Sign In" button that lives on a tab that isn't on screen yet, so
        // it always passed instantly and Portfolio was missing from the run.
        _ = app.buttons["tab-portfolio"].waitForExistence(timeout: 30)

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
            // ponytail: 20s, but a missed shot here usually means /api/stocks 500ed and the
            // list has only commodities/crypto -- check the API before blaming the timeout
            if row.waitForExistence(timeout: 20) {
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

        // Settings shares this launch: Portfolio and Settings are both plain tabs
        // with no sheet in between, and a third relaunch was reliably failing with
        // "Simulator device failed to launch ...xctrunner".
        if app.buttons["tab-settings"].waitForExistence(timeout: 5) {
            app.buttons["tab-settings"].tap()
            sleep(2)
            snapshot("5-settings")
        }
    }
}
