import WidgetKit
import SwiftUI

struct BudgetEntry: TimelineEntry {
    let date: Date
    let income: Double
    let spent: Double
    let month: String
    let isPlaceholder: Bool

    var remaining: Double { income - spent }
    var progress: Double { income > 0 ? min(spent / income, 1) : 0 }
    var isOver: Bool { income > 0 && spent > income }

    static var placeholder: BudgetEntry {
        BudgetEntry(date: .now, income: 3200, spent: 1840, month: "This month", isPlaceholder: true)
    }
}

/// No network: the app writes the two budget numbers into the App Group after every
/// finance or statement load, because the widget cannot use the app's session.
struct BudgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> BudgetEntry { .placeholder }

    func getSnapshot(in context: Context, completion: @escaping (BudgetEntry) -> Void) {
        completion(context.isPreview ? .placeholder : (WidgetAPI.cachedBudget() ?? .placeholder))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<BudgetEntry>) -> Void) {
        let entry = WidgetAPI.cachedBudget() ?? .placeholder
        let next = Calendar.current.date(byAdding: .hour, value: 6, to: .now)!
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}
