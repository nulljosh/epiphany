import SwiftUI
import Charts

struct MacroView: View {
    @Environment(AppState.self) private var appState
    @State private var indicators: [MacroIndicator] = []
    @State private var isLoading = false
    @State private var error: String?
    @State private var hasLoaded = false

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && indicators.isEmpty {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List {
                        if let errorMessage = error {
                            Text(errorMessage)
                                .font(.caption)
                                .foregroundStyle(Palette.dangerRed)
                                .listRowBackground(
                                    RoundedRectangle(cornerRadius: 8)
                                        .fill(.ultraThinMaterial)
                                        .padding(2)
                                )
                        }

                        if indicators.isEmpty && !isLoading {
                            ContentUnavailableView(
                                "No Economic Indicators",
                                systemImage: "chart.bar.doc.horizontal",
                                description: Text("Pull to refresh and try again.")
                            )
                            .listRowBackground(Color.clear)
                        }

                        ForEach(indicators) { indicator in
                            MacroIndicatorRow(indicator: indicator)
                                .listRowBackground(
                                    RoundedRectangle(cornerRadius: 8)
                                        .fill(.ultraThinMaterial)
                                        .padding(2)
                                )
                        }
                    }
                    .refreshable {
                        await loadMacro()
                    }
                }
            }
            .navigationTitle("Macro")
        }
        .onAppear {
            guard !hasLoaded else { return }
            hasLoaded = true
            Task {
                await loadMacro()
            }
        }
    }

    private func loadMacro() async {
        isLoading = true
        defer { isLoading = false }

        do {
            indicators = try await MonicaAPI.shared.fetchMacro()
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }
}

private struct MacroIndicatorRow: View {
    let indicator: MacroIndicator

    private var changeColor: Color {
        indicator.change >= 0 ? Palette.successGreen : Palette.dangerRed
    }

    private var valueText: String {
        if indicator.unit == "%" {
            return String(format: "%.2f%%", indicator.value)
        }
        if indicator.unit == "$" {
            return String(format: "$%.2f", indicator.value)
        }
        if indicator.unit.isEmpty {
            return String(format: "%.2f", indicator.value)
        }
        return String(format: "%.2f %@", indicator.value, indicator.unit)
    }

    private var changeText: String {
        let value = String(format: "%@%.2f", indicator.change >= 0 ? "+" : "", indicator.change)
        let percent = String(format: "%@%.2f%%", indicator.changePercent >= 0 ? "+" : "", indicator.changePercent)
        return "\(value) (\(percent))"
    }

    private var formattedDate: String {
        guard let parsed = parseDate(indicator.date) else { return indicator.date }
        return parsed.formatted(date: .abbreviated, time: .omitted)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(indicator.name)
                        .font(.headline)
                    Text(formattedDate)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 2) {
                    Text(valueText)
                        .font(.headline.monospaced())
                    Text(changeText)
                        .font(.caption.monospaced())
                        .foregroundStyle(changeColor)
                }
            }

            if let series = indicator.series, !series.isEmpty {
                Chart(series) { point in
                    if let pointDate = parseDate(point.date) {
                        LineMark(
                            x: .value("Date", pointDate),
                            y: .value("Value", point.value)
                        )
                        .interpolationMethod(.catmullRom)
                        .foregroundStyle(Palette.appleBlue)
                    }
                }
                .chartXAxis(.hidden)
                .chartYAxis(.hidden)
                .frame(height: 72)
            }
        }
        .padding(.vertical, 4)
    }

    private func parseDate(_ text: String) -> Date? {
        let withFractions = ISO8601DateFormatter()
        withFractions.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = withFractions.date(from: text) { return date }

        let standard = ISO8601DateFormatter()
        standard.formatOptions = [.withInternetDateTime]
        if let date = standard.date(from: text) { return date }

        let dateOnly = DateFormatter()
        dateOnly.locale = Locale(identifier: "en_US_POSIX")
        dateOnly.dateFormat = "yyyy-MM-dd"
        return dateOnly.date(from: text)
    }
}
