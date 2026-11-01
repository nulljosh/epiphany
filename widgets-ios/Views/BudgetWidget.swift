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
        .description("Spent this month against your income, and the budget lines closest to their limit.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline])
    }
}

struct BudgetWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: BudgetEntry

    private var tint: Color { entry.isOver ? .red : .green }

    var body: some View {
        switch family {
        case .accessoryInline:
            Text("Spent \(money(entry.spent)) of \(money(entry.income))")
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 2) {
                Text("Budget").font(.caption2.weight(.semibold)).widgetAccentable()
                Text("\(money(entry.spent)) of \(money(entry.income))").font(.headline)
                ProgressView(value: entry.progress)
            }
        case .systemMedium:
            HStack(alignment: .top, spacing: 16) {
                summary
                if entry.lines.isEmpty {
                    Spacer()
                    VStack(alignment: .trailing, spacing: 4) {
                        Text(entry.isOver ? "Over by" : "Left").font(.caption).foregroundStyle(.secondary)
                        Text(money(abs(entry.remaining))).font(.title3.weight(.semibold)).foregroundStyle(tint)
                    }
                } else {
                    // Per line, the same on-track colours as the Budget tab: green to 90%, amber to 110%, red past it.
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(entry.lines, id: \.self) { l in
                            VStack(alignment: .leading, spacing: 3) {
                                HStack {
                                    Text(l.name).font(.caption.weight(.semibold)).lineLimit(1)
                                    Spacer()
                                    Text("\(money(l.spent)) / \(money(l.amount))").font(.caption2).foregroundStyle(.secondary).monospacedDigit()
                                }
                                ProgressView(value: min(l.ratio, 1)).tint(l.ratio <= 0.9 ? .green : l.ratio <= 1.1 ? .orange : .red)
                            }
                        }
                    }
                    .frame(maxWidth: .infinity)
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
