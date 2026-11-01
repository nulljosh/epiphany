import XCTest

/// Landscape pass (#54): every tab on sample data, turned sideways, kept as an attachment to look at.
@MainActor
final class LandscapeTests: XCTestCase {
    func testEveryTabInLandscape() {
        let app = XCUIApplication()
        app.launchArguments += ["UITEST_DEMO", "-whats_new_seen_version", "99.0.0"]
        app.launch()
        XCUIDevice.shared.orientation = .landscapeLeft
        sleep(8)
        if app.buttons["Got it"].waitForExistence(timeout: 2) { app.buttons["Got it"].tap() }
        let tabs = app.tabBars.buttons
        let names = (0..<tabs.count).map { tabs.element(boundBy: $0).label }
        for name in names {
            app.tabBars.buttons[name].tap()
            sleep(4)
            let shot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
            shot.name = "landscape-\(name)"
            shot.lifetime = .keepAlways
            add(shot)
        }
        XCUIDevice.shared.orientation = .portrait
    }
}
