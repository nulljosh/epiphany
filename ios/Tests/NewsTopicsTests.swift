import XCTest
@testable import Epiphany

final class NewsTopicsTests: XCTestCase {
    func testTagsHeadlinesByKeyword() {
        XCTAssertEqual(NewsTopics.topics("Binance says security incident froze $3B in assets"), ["Crypto"])
        XCTAssertEqual(NewsTopics.topics("Intel shares plunge 20% after quarterly results"), ["Markets", "Earnings"])
        XCTAssertEqual(NewsTopics.topics("Fed holds interest rates as inflation cools"), ["Economy"])
        XCTAssertEqual(NewsTopics.topics("Alex Rodriguez on failing and getting back up"), [])
        // "fed up" is a known miss of whole-word matching; "Federal" must not count as "fed".
        XCTAssertEqual(NewsTopics.topics("Federal judge rules on park"), [])
    }

    func testChipsOnlyWhenTheySplitTheList() {
        let titles = ["Bitcoin jumps", "Stocks rally", "A baseball story"]
        XCTAssertEqual(NewsTopics.chips(titles), ["All", "Markets", "Crypto"])
        XCTAssertEqual(NewsTopics.chips(["Bitcoin jumps", "Ether slides"]), ["All"])
        XCTAssertTrue(NewsTopics.passes("Bitcoin jumps", "Crypto"))
        XCTAssertFalse(NewsTopics.passes("Stocks rally", "Crypto"))
    }

    func testYoursChip() {
        let mine = [Stock(symbol: "AAPL", name: "Apple Inc.", price: 1)]
        let titles = ["Apple beats on iPhone sales", "Oil slides as OPEC meets"]
        XCTAssertEqual(NewsTopics.chips(titles, mine: mine).prefix(2), ["All", "Yours"])
        XCTAssertEqual(titles.filter { NewsTopics.passes($0, NewsTopics.yours, mine: mine) }, ["Apple beats on iPhone sales"])
        XCTAssertFalse(NewsTopics.chips(["Oil slides"], mine: mine).contains("Yours"))
    }
}
