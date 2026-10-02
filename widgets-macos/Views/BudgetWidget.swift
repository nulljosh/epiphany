import WidgetKit
import SwiftUI

struct BudgetWidget: Widget {
    let kind = "BudgetWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: BudgetProvider()) { entry in
            BudgetWidgetView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Budget")
        .description("Spent this month against your income.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct BudgetWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: BudgetEntry

    private var tint: Color { entry.isOver ? .red : .green }

    var body: some View {
        switch family {
        case .systemMedium:
            HStack(alignment: .top, spacing: 16) {
                summary
                Spacer()
                VStack(alignment: .trailing, spacing: 4) {
                    Text(entry.isOver ? "Over by" : "Left").font(.caption).foregroundStyle(.secondary)
                    Text(money(abs(entry.remaining))).font(.title3.weight(.semibold)).foregroundStyle(tint)
                }
            }
            .padding(.vertical, 2)
        default:
            summary
        }
    }

    private var summary: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(entry.month.isEmpty ? "Spent" : entry.month)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            Text(money(entry.spent))
                .font(.system(.title2, design: .rounded).weight(.bold))
                .minimumScaleFactor(0.7)
                .lineLimit(1)
            ProgressView(value: entry.progress).tint(tint)
            Text("of \(money(entry.income)) income")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func money(_ value: Double) -> String {
        value.formatted(.currency(code: "CAD").precision(.fractionLength(0)))
    }
}
