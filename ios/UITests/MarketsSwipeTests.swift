import XCTest

/// Swipe and long press on a Markets row both offer Watch, like iOS Stocks.
@MainActor
final class MarketsSwipeTests: XCTestCase {
    func testRowSwipeAndLongPressOfferWatch() {
        let app = XCUIApplication()
        app.launchArguments += ["-qaTab", "1", "-whats_new_seen_version", "3.0.0"]
        app.launch()
        let row = app.buttons.containing(NSPredicate(format: "label BEGINSWITH 'NATGAS'")).firstMatch
        XCTAssertTrue(row.waitForExistence(timeout: 30))
        row.swipeLeft()
        let watch = app.buttons.matching(NSPredicate(format: "label == 'Watch' OR label == 'Unwatch'")).firstMatch
        XCTAssertTrue(watch.waitForExistence(timeout: 3), "swipe should reveal Watch")
        row.swipeRight()
        row.press(forDuration: 1.2)
        XCTAssertTrue(watch.waitForExistence(timeout: 3), "long press should offer Watch")
    }
}
