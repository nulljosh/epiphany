import XCTest

final class PreviewScreenshot: XCTestCase {

    func testCapturePreview() throws {
        let app = XCUIApplication()
        app.launch()

        // Wait for UI to settle: location fix arrives, map re-centers on Langley,
        // tiles fetch, indicators populate. ~8s on a cold sim.
        sleep(8)

        let screenshot = app.windows.firstMatch.screenshot()
        let attachment = XCTAttachment(screenshot: screenshot)
        attachment.name = "preview"
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
