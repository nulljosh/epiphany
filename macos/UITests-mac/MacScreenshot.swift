import XCTest

@MainActor
final class MacScreenshot: XCTestCase {

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testCaptureMacScreenshot() throws {
        let app = XCUIApplication()
        app.launchArguments.append("UITEST_SNAPSHOT")
        app.launchEnvironment["SNAPSHOT_EMAIL"] = "demo@heyitsmejosh.com"
        app.launchEnvironment["SNAPSHOT_PASSWORD"] = "EpiphanyDemo2026!"
        app.launch()
        sleep(8)

        app.activate()
        sleep(1)
        let window = app.windows.firstMatch
        XCTAssertTrue(window.waitForExistence(timeout: 10), "App window never appeared")
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
