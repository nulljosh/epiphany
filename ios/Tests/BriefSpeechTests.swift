import XCTest
@testable import Epiphany

final class BriefSpeechTests: XCTestCase {
    func testSummaryThenPointsAsSentences() {
        let brief = DailyBrief(summary: "Stocks rose", points: ["NVDA up 3%", "Oil fell."], gainers: [], losers: [], generatedAt: "")
        XCTAssertEqual(BriefSpeech.text(brief), "Stocks rose. NVDA up 3%. Oil fell.")
    }
}
