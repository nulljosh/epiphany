import SwiftUI
import Observation

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
                                .listRowInsets(EdgeInsets(top: 2, leading: 16, bottom: 2, trailing: 16))
                                .listRowSeparator(.hidden)
                                .listRowBackground(
                                    RoundedRectangle(cornerRadius: 8)
                                        .fill(.ultraThinMaterial)
                                        .padding(.vertical, 1)
                                        .padding(.horizontal, 4)
                                )
                        }
                    }
                    .listStyle(.plain)
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
            indicators = try await EpiphanyAPI.shared.fetchMacro()
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
        let v = indicator.value
        // FRED FYFSD (federal deficit) is reported in millions of dollars; show as trillions like web.
        if indicator.id == "deficit" {
            let trillions = v / 1_000_000
            let sign = trillions < 0 ? "-" : ""
            return "\(sign)$\(String(format: "%.2f", abs(trillions)))T"
        }
        switch indicator.unit {
        case "%":
            return String(format: "%.2f%%", v)
        case "K":
            let n = v >= 10000 ? (v / 1000).rounded() : v.rounded()
            return "\(Int(n).formatted(.number))K"
        case "B USD":
            let n = v >= 10000 ? (v / 1000).rounded() : v.rounded()
            let sign = v < 0 ? "-" : ""
            return "\(sign)$\(Int(abs(n)).formatted(.number))B"
        case "index":
            return v.formatted(.number.precision(.fractionLength(0...1)))
        default:
            return v.formatted(.number.precision(.fractionLength(0...2)))
        }
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
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text(indicator.name)
                    .font(.subheadline.weight(.semibold))
                Text(formattedDate)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                Text(valueText)
                    .font(.subheadline.weight(.semibold))
                Text(changeText)
                    .font(.caption2.weight(.medium))
                    .foregroundStyle(changeColor)
            }
        }
        .padding(.vertical, 6)
    }

    private func parseDate(_ text: String) -> Date? {
        DateParsing.parse(text)
    }
}
