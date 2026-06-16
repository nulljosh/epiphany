import Foundation

struct Statement: Codable, Identifiable {
    let filename: String
    let transactions: [Transaction]

    var id: String { filename }

    private enum CodingKeys: String, CodingKey {
        case filename
        case transactions
    }

    init(filename: String, transactions: [Transaction]) {
        self.filename = filename
        self.transactions = transactions
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        filename = try container.decodeIfPresent(String.self, forKey: .filename) ?? "Statement"
        transactions = try container.decodeIfPresent([Transaction].self, forKey: .transactions) ?? []
    }
}

struct Transaction: Codable, Identifiable {
    let date: String
    let description: String
    let amount: Double
    let balance: Double?
    let category: String?

    var id: String {
        "\(date)|\(description)|\(amount)"
    }

    private enum CodingKeys: String, CodingKey {
        case date
        case description
        case amount
        case balance
        case category
    }

    init(date: String, description: String, amount: Double, balance: Double? = nil, category: String? = nil) {
        self.date = date
        self.description = description
        self.amount = amount
        self.balance = balance
        self.category = category
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        date = try container.decodeIfPresent(String.self, forKey: .date) ?? ""
        description = try container.decodeIfPresent(String.self, forKey: .description) ?? ""
        amount = try container.decodeIfPresent(Double.self, forKey: .amount) ?? 0
        balance = try container.decodeIfPresent(Double.self, forKey: .balance)
        category = try container.decodeIfPresent(String.self, forKey: .category)
    }
}
