import XCTest
@testable import Epiphany

final class AccountGroupsTests: XCTestCase {
    func testCashFirstWithTotals() {
        let a: [FinanceData.Account] = [.init(name: "TFSA", type: "investment", balance: 250), .init(name: "MSB", type: "cash", balance: 1000),
                                        .init(name: "Gift", type: "gift", balance: 5), .init(name: "Spend", type: "cash", balance: 2), .init(name: "Old", type: "cash", balance: 0)]
        let g = AccountGroups.groups(a)
        XCTAssertEqual(g.map(\.type), ["cash", "investment", "gift"])
        XCTAssertEqual(g.map(\.total), [1002, 250, 5])
    }
}
