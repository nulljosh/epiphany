import XCTest

final class PreviewScreenshot: XCTestCase {

    func testCapturePreview() throws {
        let app = XCUIApplication()
        app.launch()

        // Wait for UI to settle
        sleep(3)

        let screenshot = app.windows.firstMatch.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = "preview"
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
