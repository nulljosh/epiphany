import SwiftUI
import Charts

/// Compound growth, one point per year: deposit `monthly` at each month end, compounding monthly.
/// Same math as `growthCurve` in src/utils/growth.js.
enum Growth {
    struct Point: Equatable { let year: Int; let contributed: Double; let value: Double }

    static func curve(monthly: Double, years: Int, rate: Double) -> [Point] {
        let r = rate / 100 / 12
        var value = 0.0
        var points = [Point(year: 0, contributed: 0, value: 0)]
        for m in stride(from: 1, through: max(years, 0) * 12, by: 1) {
            value = value * (1 + r) + monthly
            if m % 12 == 0 { points.append(Point(year: m / 12, contributed: monthly * Double(m), value: value)) }
        }
        return points
    }
}

/// What a monthly amount grows to: three fields, the end value, and the curve against what went in.
struct GrowthCalculatorCard: View {
    @State private var monthly = 500.0
    @State private var years = 20
    @State private var rate = 6.0

    private func dollars(_ n: Double) -> String { n.formatted(.currency(code: "USD").precision(.fractionLength(0))) }

    var body: some View {
        let points = Growth.curve(monthly: monthly, years: min(years, 60), rate: rate)
        let end = points.last ?? Growth.Point(year: 0, contributed: 0, value: 0)
        VStack(alignment: .leading, spacing: 10) {
            Text("Compound growth")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)
            HStack(spacing: 8) {
                field("Each month ($)") { TextField("500", value: $monthly, format: .number) }
                field("Years") { TextField("20", value: $years, format: .number) }
                field("Return a year (%)") { TextField("6", value: $rate, format: .number) }
            }
            Text(dollars(end.value))
                .font(.title.weight(.bold).monospacedDigit())
            Text("\(dollars(end.contributed)) put in, \(dollars(max(end.value - end.contributed, 0))) growth")
                .font(.footnote)
                .foregroundStyle(.secondary)
            Chart(points, id: \.year) { p in
                AreaMark(x: .value("Year", p.year), y: .value("Value", p.value))
                    .foregroundStyle(Palette.successGreen.opacity(0.18))
                LineMark(x: .value("Year", p.year), y: .value("Value", p.value), series: .value("Line", "Value"))
                    .foregroundStyle(Palette.successGreen)
                LineMark(x: .value("Year", p.year), y: .value("Put in", p.contributed), series: .value("Line", "Put in"))
                    .foregroundStyle(.secondary)
                    .lineStyle(StrokeStyle(lineWidth: 1.5, dash: [4, 4]))
            }
            .chartYAxis(.hidden)
            .frame(height: 120)
            .accessibilityLabel("Value against money put in, by year")
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.fill.quaternary, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private func field<F: View>(_ label: String, @ViewBuilder _ input: () -> F) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.caption2).foregroundStyle(.secondary).lineLimit(1).minimumScaleFactor(0.8)
            input()
                .textFieldStyle(.roundedBorder)
                .monospacedDigit()
                #if os(iOS)
                .keyboardType(.decimalPad)
                #endif
        }
    }
}
