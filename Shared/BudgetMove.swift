import Foundation

/// YNAB's "move money": cover an overspent line from the line with the most left. Linked lines only, since an
/// unlinked line has no spending to say what it can spare. The total budget doesn't change.
/// Mirrors coverPlan and moveBudget in src/utils/budgetActual.js.
extension FinanceData.Budget {
    func coverPlan(for line: BudgetLine, in month: FinanceData.SpendingMonth?) -> (from: Int, to: Int, amount: Double)? {
        guard let to = expenses.firstIndex(where: { $0.id == line.id }),
              let spent = line.spent(in: month), spent > line.amount else { return nil }
        let need = ((spent - line.amount) * 100).rounded() / 100
        let best = expenses.indices
            .filter { $0 != to }
            .compactMap { i in expenses[i].spent(in: month).map { (i, ((expenses[i].amount - $0) * 100).rounded() / 100) } }
            .filter { $0.1 > 0 }
            .max { $0.1 < $1.1 }
        return best.map { (from: $0.0, to: to, amount: min(need, $0.1)) }
    }

    mutating func moveMoney(from: Int, to: Int, amount: Double) {
        guard expenses.indices.contains(from), expenses.indices.contains(to), from != to else { return }
        expenses[from].amount -= amount
        expenses[to].amount += amount
    }
}
