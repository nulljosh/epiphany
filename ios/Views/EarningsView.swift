import SwiftUI
import EventKit

/// Upcoming earnings for everything on screen, with Calendar and .ics export.
enum EarningsCalendar {
    /// Write-only access: one all-day event per report. Returns the symbols saved.
    static func add(_ stocks: [Stock]) async -> Set<String>? {
        let store = EKEventStore()
        guard (try? await store.requestWriteOnlyAccessToEvents()) == true else { return nil }
        var saved = Set<String>()
        for stock in stocks {
            guard let ts = stock.nextEarnings else { continue }
            let event = EKEvent(eventStore: store)
            event.title = "\(stock.symbol) earnings"
            event.startDate = Date(timeIntervalSince1970: ts)
            event.endDate = event.startDate
            event.isAllDay = true
            event.calendar = store.defaultCalendarForNewEvents
            if (try? store.save(event, span: .thisEvent, commit: false)) != nil { saved.insert(stock.symbol) }
        }
        try? store.commit()
        return saved
    }

    /// An .ics file any calendar app opens, for people who skip the permission prompt.
    static func icsFile(for stocks: [Stock]) -> URL? {
        let day = DateFormatter()
        day.dateFormat = "yyyyMMdd"
        day.timeZone = .current
        let stamp = Date.now.formatted(.iso8601.year().month().day().time(includingFractionalSeconds: false).timeSeparator(.omitted).dateSeparator(.omitted)) + "Z"
        var lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Epiphany//Earnings//EN"]
        for stock in stocks {
            guard let ts = stock.nextEarnings else { continue }
            let date = Date(timeIntervalSince1970: ts)
            lines += ["BEGIN:VEVENT",
                      "UID:\(stock.symbol)-\(day.string(from: date))@epiphany",
                      "DTSTAMP:\(stamp)",
                      "DTSTART;VALUE=DATE:\(day.string(from: date))",
                      "SUMMARY:\(stock.symbol) earnings",
                      "END:VEVENT"]
        }
        lines.append("END:VCALENDAR")
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("Epiphany earnings.ics")
        do { try lines.joined(separator: "\r\n").write(to: url, atomically: true, encoding: .utf8) } catch { return nil }
        return url
    }
}

struct EarningsView: View {
    @Environment(AppState.self) private var appState
    @State private var added: Set<String> = []
    @State private var denied = false
    @State private var icsURL: URL?

    private var upcoming: [Stock] {
        let start = Calendar.current.startOfDay(for: .now).timeIntervalSince1970
        var seen = Set<String>()
        return (appState.watchlistStocks + appState.stocks)
            .filter { ($0.nextEarnings ?? 0) >= start && seen.insert($0.symbol).inserted }
            .sorted { ($0.nextEarnings ?? 0) < ($1.nextEarnings ?? 0) }
    }

    var body: some View {
        let stocks = upcoming
        Group {
            if stocks.isEmpty {
                ContentUnavailableView("No Earnings Dates", systemImage: "calendar",
                                       description: Text("None of your stocks have a report coming up."))
            } else {
                List(stocks) { stock in
                    row(stock)
                        .padding(.horizontal, 16)
                        .alignmentGuide(.listRowSeparatorLeading) { _ in 0 }
                        .alignmentGuide(.listRowSeparatorTrailing) { $0.width }
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                }
                .listStyle(.plain)
            }
        }
        .navigationTitle("Earnings")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if !stocks.isEmpty {
                ToolbarItemGroup(placement: .topBarTrailing) {
                    if let icsURL { ShareLink(item: icsURL) { Image(systemName: "square.and.arrow.up") } }
                    Button("Add all") { add(stocks) }
                        .disabled(stocks.allSatisfy { added.contains($0.symbol) })
                }
            }
        }
        .task(id: stocks.map(\.symbol)) { icsURL = EarningsCalendar.icsFile(for: stocks) }
        .alert("Calendar access is off", isPresented: $denied) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("Allow Epiphany to add events in Settings, or use the share button for an .ics file.")
        }
    }

    private func row(_ stock: Stock) -> some View {
        let date = Date(timeIntervalSince1970: stock.nextEarnings ?? 0)
        return HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 1) {
                Text(stock.symbol.uppercased()).font(.body.weight(.semibold))
                Text(stock.name).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 1) {
                Text(date.formatted(.dateTime.month(.abbreviated).day())).font(.body.weight(.semibold))
                Text(date.formatted(.dateTime.weekday(.wide))).font(.caption2).foregroundStyle(.secondary)
            }
            Button { add([stock]) } label: {
                Image(systemName: added.contains(stock.symbol) ? "checkmark.circle.fill" : "calendar.badge.plus")
                    .font(.title3)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .disabled(added.contains(stock.symbol))
            .accessibilityLabel(added.contains(stock.symbol) ? "\(stock.symbol) added to Calendar" : "Add \(stock.symbol) earnings to Calendar")
        }
        .padding(.vertical, 4)
    }

    private func add(_ stocks: [Stock]) {
        Task {
            guard let saved = await EarningsCalendar.add(stocks) else { denied = true; return }
            added.formUnion(saved)
        }
    }
}
