import SwiftUI

/// "Good morning" by the hour, and what the total did since the last visit. Mirrors greeting and sinceLastVisit in moneyGlance.js.
enum Greeting {
    static func text(hour: Int) -> String {
        hour < 5 ? "Good evening" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
    }

    static func since(prevValue: Double, prevAt: Date, value: Double, now: Date = .now) -> (diff: Double, when: String)? {
        let diff = value - prevValue
        let hours = now.timeIntervalSince(prevAt) / 3600
        guard abs(diff) >= 0.01, hours >= 1 else { return nil }
        let when = hours < 24 ? "earlier today" : hours < 48 ? "yesterday" : "\(Int(hours / 24)) days ago"
        return (diff, when)
    }
}

/// The line over the portfolio total ("Up $12 since yesterday"); remembers this visit's total for the next one.
struct GreetingLine: View {
    let total: Double
    @AppStorage("last_visit_value") private var savedValue = 0.0
    @AppStorage("last_visit_at") private var savedAt = 0.0
    @State private var prev: (value: Double, at: Date)?

    var body: some View {
        let since = prev.flatMap { Greeting.since(prevValue: $0.value, prevAt: $0.at, value: total) }
        // No "Good morning" (Joshua, 2026-10-30): only what the total did since the last visit.
        Text(since.map { s in "\(s.diff >= 0 ? "Up" : "Down") \(CurrencyFormatter.formatPrice(abs(s.diff))) since \(s.when)." } ?? "")
            .foregroundStyle(since.map { $0.diff >= 0 ? Palette.successGreen : Palette.dangerRed } ?? Palette.textSecondary)
            .font(.subheadline.weight(.semibold))
            .frame(maxHeight: since == nil ? 0 : nil)  // collapsed, not removed: the save below must still run
            .onAppear {
                if prev == nil, savedAt > 0 { prev = (savedValue, Date(timeIntervalSince1970: savedAt)) }
            }
            .onChange(of: total, initial: true) { _, t in
                guard t > 0 else { return }
                savedValue = t
                savedAt = Date.now.timeIntervalSince1970
            }
    }
}
