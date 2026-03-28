import Foundation

struct FinanceData: Codable {
    var holdings: [Holding]
    var accounts: [Account]
    var budget: Budget?
    var debt: [DebtItem]
    var goals: [Goal]
    var spending: [SpendingMonth]

    private enum CodingKeys: String, CodingKey {
        case holdings, accounts, budget, debt, goals, spending
    }

    init(holdings: [Holding] = [], accounts: [Account] = [], budget: Budget? = nil, debt: [DebtItem] = [], goals: [Goal] = [], spending: [SpendingMonth] = []) {
        self.holdings = holdings
        self.accounts = accounts
        self.budget = budget
        self.debt = debt
        self.goals = goals
        self.spending = spending
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        holdings = (try? container.decode([Holding].self, forKey: .holdings)) ?? []
        accounts = (try? container.decode([Account].self, forKey: .accounts)) ?? []
        budget = try? container.decode(Budget.self, forKey: .budget)
        debt = (try? container.decode([DebtItem].self, forKey: .debt)) ?? []
        goals = (try? container.decode([Goal].self, forKey: .goals)) ?? []
        spending = (try? container.decode([SpendingMonth].self, forKey: .spending)) ?? []
    }

    struct Holding: Codable, Identifiable {
        let symbol: String
        let shares: Double
        let costBasis: Double
        let currency: String?

        var id: String { symbol }
    }

    struct Account: Codable, Identifiable {
        let name: String
        let type: String?
        let balance: Double
        let currency: String?

        var id: String { name }

        var typeLabel: String {
            switch type ?? "" {
            case "chequing": return "Chequing"
            case "investment": return "Investment"
            case "gift": return "Gift Card"
            default: return (type ?? "Account").capitalized
            }
        }
    }

    struct Budget: Codable {
        let income: [BudgetLine]
        let expenses: [BudgetLine]

        struct BudgetLine: Codable, Identifiable {
            let name: String
            let amount: Double
            let frequency: String
            let note: String?

            var id: String { name }

            var monthlyAmount: Double {
                switch frequency {
                case "biweekly": return amount * 26 / 12
                case "weekly": return amount * 52 / 12
                case "yearly", "annual": return amount / 12
                default: return amount
                }
            }
        }

        var totalMonthlyIncome: Double {
            income.reduce(0) { $0 + $1.monthlyAmount }
        }

        var totalMonthlyExpenses: Double {
            expenses.reduce(0) { $0 + $1.monthlyAmount }
        }

        var monthlySurplus: Double {
            totalMonthlyIncome - totalMonthlyExpenses
        }
    }

    struct DebtItem: Codable, Identifiable {
        var name: String
        var balance: Double
        var rate: Double
        var minPayment: Double
        var note: String?

        var id: String { name }
    }

    struct Goal: Codable, Identifiable {
        var name: String
        var target: Double
        var saved: Double
        var priority: String
        var deadline: String?
        var note: String?

        var id: String { name }

        var progress: Double {
            guard target > 0 else { return 0 }
            return min(saved / target, 1.0)
        }

        var priorityColor: String {
            switch priority {
            case "high": return "ff3b30"
            case "medium": return "f5a623"
            default: return "34c759"
            }
        }
    }

    struct SpendingMonth: Codable, Identifiable {
        let month: String
        let sortKey: String
        let total: Double
        let categories: [String: Double]

        var id: String { month }

        var sortedCategories: [(key: String, value: Double)] {
            categories.sorted { $0.value > $1.value }
        }

        private enum CodingKeys: String, CodingKey {
            case month
            case sortKey
            case sort_key
            case total
            case categories
        }

        init(month: String, sortKey: String, total: Double, categories: [String: Double]) {
            self.month = month
            self.sortKey = sortKey
            self.total = total
            self.categories = categories
        }

        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            let rawMonth = try container.decodeIfPresent(String.self, forKey: .month) ?? "Unknown"
            let rawSortKey = try container.decodeIfPresent(String.self, forKey: .sortKey)
                ?? container.decodeIfPresent(String.self, forKey: .sort_key)
            let total = try container.decodeIfPresent(Double.self, forKey: .total) ?? 0
            let categories = try container.decodeIfPresent([String: Double].self, forKey: .categories) ?? [:]

            self.month = Self.normalizedMonthLabel(rawMonth)
            self.sortKey = Self.normalizedSortKey(from: rawSortKey ?? rawMonth)
            self.total = total
            self.categories = categories
        }

        func encode(to encoder: Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)
            try container.encode(month, forKey: .month)
            try container.encode(sortKey, forKey: .sortKey)
            try container.encode(total, forKey: .total)
            try container.encode(categories, forKey: .categories)
        }

        private static func normalizedMonthLabel(_ value: String) -> String {
            let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
            if let parsed = parseMonth(trimmed) {
                return displayFormatter.string(from: parsed)
            }
            return trimmed
        }

        private static func normalizedSortKey(from value: String) -> String {
            let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
            if let parsed = parseMonth(trimmed) {
                return sortFormatter.string(from: parsed)
            }
            return trimmed
        }

        private static func parseMonth(_ value: String) -> Date? {
            for formatter in parseFormatters {
                if let date = formatter.date(from: value) {
                    return date
                }
            }
            return nil
        }

        private static let parseFormatters: [DateFormatter] = {
            let formats = ["MMM yyyy", "MMMM yyyy", "yyyy-MM", "yyyy-MM-dd"]
            return formats.map { format in
                let formatter = DateFormatter()
                formatter.locale = Locale(identifier: "en_US_POSIX")
                formatter.dateFormat = format
                return formatter
            }
        }()

        private static let displayFormatter: DateFormatter = {
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.dateFormat = "MMM yyyy"
            return formatter
        }()

        private static let sortFormatter: DateFormatter = {
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.dateFormat = "yyyy-MM"
            return formatter
        }()
    }
}
