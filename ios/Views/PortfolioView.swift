import Charts
import SwiftUI
import UIKit

private enum IncomeScenario: String, CaseIterable, Identifiable {
    case plus500 = "+$500"
    case plus1000 = "+$1000"
    case double = "x2 Income"

    var id: String { rawValue }

    var label: String { rawValue }

    var color: Color {
        switch self {
        case .plus500: return Palette.successGreen
        case .plus1000: return Palette.warningAmber
        case .double: return Palette.purple
        }
    }

    func adjustedIncome(_ base: Double) -> Double {
        switch self {
        case .plus500: return base + 500
        case .plus1000: return base + 1000
        case .double: return base * 2
        }
    }
}

private let categoryColors: [String: Color] = [
    "housing": Palette.appleBlue,
    "food": Palette.successGreen,
    "transport": Palette.warningAmber,
    "transit": Palette.warningAmber,
    "utilities": Palette.purple,
    "entertainment": Palette.dangerRed,
    "health": Palette.cyan,
    "shopping": Palette.pink,
    "other": Palette.yellow,
    "insurance": Palette.brown,
    "subscriptions": Palette.indigo,
    "apps": Palette.indigo,
    "transfers": Palette.appleBlue.opacity(0.6),
    "vape": Palette.warningAmber,
    "alcohol": Palette.purple,
    "fitness": Palette.cyan,
    "uncategorized": Palette.overlay.opacity(0.25),
    "tech": Palette.appleBlue,
]

struct PortfolioView: View {
    @Environment(AppState.self) private var appState
    @State private var hasLoaded = false
    @State private var selectedSpendingMonth: String?
    @State private var lastHapticMonth: String?
    @State private var selectedSpendingX: CGFloat?
    @State private var activeScenarios: Set<IncomeScenario> = []
    @State private var expandedSpendingMonth: String?
    @State private var selectedStatementMonth: String?
    @State private var selectedCategory: String?
    @State private var isEditingDebt = false
    @State private var isEditingGoals = false
    @State private var editingDebtItems: [FinanceData.DebtItem] = []
    @State private var editingGoalItems: [FinanceData.Goal] = []
    @State private var calendarMonth = Date()
    @State private var selectedCalendarDay: Date?
    // Tally payday data comes from appState.tallyPayment
    @State private var cachedPredictions: [(month: String, total: Double)] = []
    @State private var lastPredictionKey: String = ""
    @State private var showStatementManager = false


    private var currencyCode: String {
        Locale.current.currency?.identifier ?? "USD"
    }

    private var spendingMonths: [FinanceData.SpendingMonth] {
        (appState.financeData?.spending ?? []).sorted { $0.sortKey < $1.sortKey }
    }

    private var spendingMonthsDescending: [FinanceData.SpendingMonth] {
        spendingMonths.reversed()
    }

    private var spendingForecast: SpendingForecast? {
        SpendingForecastBuilder.build(from: spendingMonths)
    }

    private var savingsForecast: SavingsForecast? {
        SavingsForecastBuilder.build(from: appState.statements)
    }

    private var selectedActualSpendingMonth: FinanceData.SpendingMonth? {
        guard let selectedSpendingMonth else { return nil }
        return spendingMonths.first { $0.month == selectedSpendingMonth }
    }

    private var selectedForecastPoint: SpendingForecast.Point? {
        guard let selectedSpendingMonth else { return nil }
        return spendingForecast?.points.first { $0.month == selectedSpendingMonth }
    }

    private var selectedSpendingValue: Double? {
        selectedActualSpendingMonth?.total ?? selectedForecastPoint?.median
    }

    private var resolvedPortfolio: Portfolio? {
        appState.portfolio ?? appState.financeData.map { Portfolio(financeData: $0, stocks: appState.stocks) }
    }

    private var changeColor: Color {
        guard let p = resolvedPortfolio else { return .secondary }
        return p.dayChange >= 0 ? Palette.successGreen : Palette.dangerRed
    }

    var body: some View {
        NavigationStack {
            Group {
                if !appState.isLoggedIn {
                    signInPrompt
                } else if resolvedPortfolio == nil && appState.financeData == nil {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    ScrollView {
                        VStack(spacing: 12) {
                            // Compact header: balance + payday inline
                            compactHeader
                                .padding(.top, 8)

                            combinedSpendingCard

                            if let portfolio = resolvedPortfolio, !portfolio.holdings.isEmpty {
                                holdingsContent(portfolio)
                            }

                            if hasDebtOrGoals {
                                timelineStrip
                            }

                            planningCard

                            Spacer(minLength: 24)
                        }
                    }
                    .refreshable {
                        async let f: Void = appState.loadFinanceData()
                        async let s: Void = appState.loadStatements()
                        _ = await (f, s)
                        Haptics.notification(.success)
                    }
                }
            }
            .navigationTitle("Portfolio")
        }
        .onAppear {
            guard !hasLoaded else { return }
            hasLoaded = true
            Task {
                async let financeLoad: Void = appState.loadFinanceData()
                async let statementsLoad: Void = appState.loadStatements()
                async let tallyLoad: Void = appState.loadTallyData()
                _ = await (financeLoad, statementsLoad, tallyLoad)
            }
        }
        .onChange(of: appState.isLoggedIn) { _, isLoggedIn in
            guard isLoggedIn else { return }
            Task {
                if appState.financeData == nil {
                    await appState.loadFinanceData()
                }
                if appState.statements.isEmpty {
                    await appState.loadStatements()
                }
            }
        }
    }

    private var signInPrompt: some View {
        ContentUnavailableView {
            Label("Portfolio", systemImage: "briefcase")
        } description: {
            Text("Sign in to view your spending, holdings, and statements.")
        } actions: {
            Button("Sign In") {
                appState.showLogin = true
            }
            .buttonStyle(.borderedProminent)
            .tint(Palette.appleBlue)
        }
    }


    private func holdingsContent(_ portfolio: Portfolio) -> some View {
        VStack(spacing: 24) {
            VStack(spacing: 8) {
                Text("TOTAL VALUE")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(Palette.textSecondary)
                    .tracking(0.8)
                Text(String(format: "$%.2f", portfolio.totalValue))
                    .font(.system(size: 44, weight: .heavy))
                    .foregroundStyle(Palette.text)
                HStack(spacing: 4) {
                    Text(String(format: "%@$%.2f", portfolio.dayChange >= 0 ? "+" : "", portfolio.dayChange))
                    Text(String(format: "(%.2f%%)", portfolio.dayChangePercent))
                }
                .font(.caption.weight(.semibold))
                .foregroundStyle(changeColor)
            }
            .padding(.top, 6)

            sectionCard("Holdings") {
                if portfolio.holdings.isEmpty {
                    emptyState("No holdings in portfolio")
                } else {
                    ForEach(portfolio.holdings) { holding in
                        HoldingRow(holding: holding)
                            .padding(.horizontal)
                            .padding(.vertical, 10)
                        if holding.id != portfolio.holdings.last?.id {
                            Divider().padding(.horizontal)
                        }
                    }
                }
            }
        }
    }

    private var averageMonthlySpending: Double {
        let months = spendingMonths
        guard !months.isEmpty else { return 0 }
        return months.map(\.total).reduce(0, +) / Double(months.count)
    }

    private var budgetContent: some View {
        sectionCard("Budget") {
            if let budget = appState.financeData?.budget {
                let actualExpenses = averageMonthlySpending > 0 ? averageMonthlySpending : budget.totalMonthlyExpenses
                let surplus = budget.totalMonthlyIncome - actualExpenses

                VStack(alignment: .leading, spacing: 16) {
                    budgetMetricRow(
                        title: "Monthly Income",
                        value: budget.totalMonthlyIncome,
                        progress: 1,
                        color: Palette.successGreen
                    )

                    let expenseProgress = budget.totalMonthlyIncome > 0
                        ? min(actualExpenses / budget.totalMonthlyIncome, 1)
                        : 0
                    budgetMetricRow(
                        title: "Avg Monthly Spending",
                        value: actualExpenses,
                        progress: expenseProgress,
                        color: Palette.dangerRed
                    )

                    budgetMetricRow(
                        title: "Monthly Surplus",
                        value: surplus,
                        progress: budget.totalMonthlyIncome > 0
                            ? max(min(surplus / budget.totalMonthlyIncome, 1), 0)
                            : 0,
                        color: surplus >= 0 ? Palette.successGreen : Palette.dangerRed
                    )
                }
                .padding(.horizontal)
                .padding(.bottom, 12)
            } else {
                emptyState("No budget data available")
            }
        }
    }

    private var financialCalendarContent: some View {
        let debtItems = appState.financeData?.debt ?? []
        let goals = appState.financeData?.goals ?? []
        let budget = appState.financeData?.budget
        let surplus = budget?.monthlySurplus ?? 0
        let cal = Calendar.current
        let events = buildCalendarEvents(debt: debtItems, goals: goals, surplus: surplus)
        let eventsByDay = Dictionary(grouping: events) { cal.startOfDay(for: $0.date) }

        return VStack(spacing: 0) {
            HStack {
                Text("CALENDAR")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(Palette.textSecondary)
                    .tracking(1.0)
                Spacer()
                HStack(spacing: 12) {
                    Button {
                        editingDebtItems = debtItems
                        isEditingDebt = true
                    } label: {
                        Label("Debt", systemImage: "creditcard")
                            .font(.caption2.weight(.medium))
                            .foregroundStyle(Palette.appleBlue)
                    }
                    Button {
                        editingGoalItems = goals
                        isEditingGoals = true
                    } label: {
                        Label("Goals", systemImage: "flag")
                            .font(.caption2.weight(.medium))
                            .foregroundStyle(Palette.appleBlue)
                    }
                }
            }
            .padding(.horizontal)
            .padding(.bottom, 8)

            sectionCard("") {
                VStack(spacing: 12) {
                    HStack {
                        Button { calendarMonth = cal.date(byAdding: .month, value: -1, to: calendarMonth) ?? calendarMonth } label: {
                            Image(systemName: "chevron.left")
                                .font(.body.weight(.semibold))
                        }
                        Spacer()
                        Text(calendarMonthLabel)
                            .font(.subheadline.weight(.bold))
                        Spacer()
                        Button { calendarMonth = cal.date(byAdding: .month, value: 1, to: calendarMonth) ?? calendarMonth } label: {
                            Image(systemName: "chevron.right")
                                .font(.body.weight(.semibold))
                        }
                    }
                    .padding(.horizontal)

                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 0), count: 7), spacing: 4) {
                        ForEach(["S","M","T","W","T","F","S"], id: \.self) { day in
                            Text(day)
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(.secondary)
                                .frame(height: 20)
                        }

                        ForEach(calendarDays, id: \.self) { date in
                            let isCurrentMonth = cal.isDate(date, equalTo: calendarMonth, toGranularity: .month)
                            let dayEvents = eventsByDay[cal.startOfDay(for: date)] ?? []
                            let isSelected = selectedCalendarDay.map { cal.isDate($0, inSameDayAs: date) } ?? false
                            let isToday = cal.isDateInToday(date)

                            Button {
                                if !dayEvents.isEmpty {
                                    selectedCalendarDay = isSelected ? nil : date
                                }
                            } label: {
                                VStack(spacing: 2) {
                                    Text("\(cal.component(.day, from: date))")
                                        .font(.caption)
                                        .fontWeight(isToday ? .bold : .regular)
                                        .foregroundStyle(
                                            isSelected ? Palette.bg :
                                            isCurrentMonth ? .primary : .secondary.opacity(0.5)
                                        )

                                    HStack(spacing: 2) {
                                        ForEach(Array(dayEvents.prefix(3).enumerated()), id: \.offset) { _, evt in
                                            Circle()
                                                .fill(evt.color)
                                                .frame(width: 5, height: 5)
                                        }
                                    }
                                    .frame(height: 6)
                                }
                                .frame(maxWidth: .infinity)
                                .frame(height: 36)
                                .background(
                                    isSelected ? Palette.appleBlue :
                                    isToday ? Palette.overlay.opacity(0.08) : .clear,
                                    in: RoundedRectangle(cornerRadius: 6)
                                )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 8)

                    if let selected = selectedCalendarDay {
                        let dayEvents = eventsByDay[cal.startOfDay(for: selected)] ?? []
                        if !dayEvents.isEmpty {
                            Divider().padding(.horizontal)
                            VStack(spacing: 6) {
                                ForEach(Array(dayEvents.enumerated()), id: \.offset) { _, event in
                                    HStack(spacing: 10) {
                                        Image(systemName: event.icon)
                                            .font(.body)
                                            .foregroundStyle(event.color)
                                            .frame(width: 24)
                                        VStack(alignment: .leading, spacing: 1) {
                                            Text(event.label)
                                                .font(.subheadline.weight(.medium))
                                            Text(event.detail)
                                                .font(.caption)
                                                .foregroundStyle(.secondary)
                                        }
                                        Spacer()
                                        if let amount = event.amount {
                                            Text(CurrencyFormatter.formatPrice(amount))
                                                .font(.caption.weight(.semibold))
                                                .monospacedDigit()
                                                .foregroundStyle(event.color)
                                        }
                                    }
                                    .padding(.horizontal)
                                }
                            }
                            .padding(.vertical, 6)
                        }
                    }

                    if !debtItems.isEmpty {
                        Divider().padding(.horizontal)
                        HStack {
                            Text("Total Debt")
                                .font(.caption.weight(.bold))
                                .foregroundStyle(Palette.text)
                            Spacer()
                            Text(CurrencyFormatter.formatPrice(debtItems.reduce(0) { $0 + $1.balance }))
                                .font(.caption.weight(.bold))
                                .monospacedDigit()
                                .foregroundStyle(Palette.dangerRed)
                        }
                        .padding(.horizontal)

                        let totalMonths = debtItems.reduce(0.0) { total, item in
                            let payment = max(item.minPayment, surplus > 0 ? surplus : item.minPayment)
                            return total + (payment > 0 ? item.balance / payment : 0)
                        }
                        Text("Debt-free in \(payoffTimeLabel(totalMonths))")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Palette.successGreen)
                            .padding(.horizontal)
                            .padding(.bottom, 4)
                    }
                }
            }
        }
        .sheet(isPresented: $isEditingDebt) {
            DebtEditorSheet(items: $editingDebtItems) {
                appState.financeData?.debt = editingDebtItems
                Task { await appState.saveFinanceData() }
            }
        }
        .sheet(isPresented: $isEditingGoals) {
            GoalEditorSheet(items: $editingGoalItems) {
                appState.financeData?.goals = editingGoalItems
                Task { await appState.saveFinanceData() }
            }
        }
    }

    private static let monthYearFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "MMMM yyyy"
        return f
    }()

    private var calendarMonthLabel: String {
        Self.monthYearFormatter.string(from: calendarMonth)
    }

    private var calendarDays: [Date] {
        let cal = Calendar.current
        let range = cal.range(of: .day, in: .month, for: calendarMonth)!
        let firstOfMonth = cal.date(from: cal.dateComponents([.year, .month], from: calendarMonth))!
        let weekday = cal.component(.weekday, from: firstOfMonth)
        let leadingBlanks = weekday - 1

        var days: [Date] = []
        if leadingBlanks > 0 {
            for i in (1...leadingBlanks).reversed() {
                days.append(cal.date(byAdding: .day, value: -i, to: firstOfMonth)!)
            }
        }
        for day in range {
            days.append(cal.date(byAdding: .day, value: day - 1, to: firstOfMonth)!)
        }
        let trailing = (7 - days.count % 7) % 7
        if let lastDay = days.last {
            for i in 1...max(trailing, 1) {
                if trailing == 0 { break }
                days.append(cal.date(byAdding: .day, value: i, to: lastDay)!)
            }
        }
        return days
    }

    private struct CalendarEvent {
        let date: Date
        let icon: String
        let label: String
        let detail: String
        let color: Color
        let amount: Double?
    }

    private func buildCalendarEvents(debt: [FinanceData.DebtItem], goals: [FinanceData.Goal], surplus: Double) -> [CalendarEvent] {
        var events: [CalendarEvent] = []
        let cal = Calendar.current
        let now = Date()

        for payment in UpcomingPayments.all {
            if let payDate = payment.dateResolver(), payDate >= cal.startOfDay(for: now) {
                events.append(CalendarEvent(
                    date: payDate,
                    icon: payment.icon,
                    label: payment.name,
                    detail: payment.recurring,
                    color: Palette.successGreen,
                    amount: payment.amount
                ))
            }
        }

        for item in debt {
            guard item.balance > 0 else { continue }
            let payment = max(item.minPayment, surplus > 0 ? surplus : item.minPayment)
            guard payment > 0 else { continue }
            let months = item.balance / payment
            let payoffDate = cal.date(byAdding: .day, value: Int(months * 30), to: now) ?? now

            events.append(CalendarEvent(
                date: payoffDate,
                icon: DebtCalc.icon(for: item.name),
                label: "\(item.name) paid off",
                detail: payoffTimeLabel(months),
                color: months <= 2 ? Palette.successGreen : Palette.warningAmber,
                amount: item.balance
            ))
        }

        for goal in goals {
            let remaining = goal.target - goal.saved
            if let deadlineStr = goal.deadline, let deadlineDate = DateParsing.parse(deadlineStr) {
                events.append(CalendarEvent(
                    date: deadlineDate,
                    icon: "flag.fill",
                    label: goal.name,
                    detail: String(format: "%.0f%% complete", goal.progress * 100),
                    color: Color(hex: goal.priorityColor),
                    amount: remaining > 0 ? remaining : nil
                ))
            } else if remaining > 0 {
                events.append(CalendarEvent(
                    date: now,
                    icon: "flag",
                    label: goal.name,
                    detail: String(format: "$%.0f / $%.0f", goal.saved, goal.target),
                    color: Color(hex: goal.priorityColor),
                    amount: remaining
                ))
            }
        }

        return events
    }

    private var compactHeader: some View {
        HStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 4) {
                if let portfolio = resolvedPortfolio {
                    Text(String(format: "$%.2f", portfolio.totalValue))
                        .font(.system(size: 32, weight: .heavy))
                        .foregroundStyle(Palette.text)
                    HStack(spacing: 4) {
                        Text(String(format: "%@$%.2f", portfolio.dayChange >= 0 ? "+" : "", portfolio.dayChange))
                        Text(String(format: "(%.1f%%)", portfolio.dayChangePercent))
                    }
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(changeColor)
                } else {
                    Text("Portfolio")
                        .font(.system(size: 32, weight: .heavy))
                        .foregroundStyle(Palette.text)
                }
            }
            Spacer()
            if let tally = appState.tallyPayment, let days = tally.daysUntilPayday {
                VStack(alignment: .trailing, spacing: 2) {
                    Image(systemName: "calendar.badge.clock")
                        .font(.title3)
                        .foregroundStyle(Palette.appleBlue)
                    Text("\(days)d")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(days <= 3 ? Palette.successGreen : .secondary)
                    if let amount = tally.paymentAmount {
                        Text(amount)
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(Palette.successGreen)
                    }
                }
            }
        }
        .padding(.horizontal)
    }

    private var hasDebtOrGoals: Bool {
        let debt = appState.financeData?.debt ?? []
        let goals = appState.financeData?.goals ?? []
        return !debt.isEmpty || !goals.isEmpty || !UpcomingPayments.all.isEmpty
    }

    private var timelineStrip: some View {
        let debt = appState.financeData?.debt ?? []
        let goals = appState.financeData?.goals ?? []
        return VStack(alignment: .leading, spacing: 10) {
            Text("TIMELINE")
                .font(.caption2.weight(.bold))
                .foregroundStyle(Palette.textSecondary)
                .tracking(1.0)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    if let tally = appState.tallyPayment, let days = tally.daysUntilPayday {
                        TimelineChip(
                            icon: "calendar.badge.clock",
                            label: "Payday",
                            detail: "\(days)d",
                            color: Palette.appleBlue
                        )
                    }

                    ForEach(Array(UpcomingPayments.all.enumerated()), id: \.offset) { _, payment in
                        if let days = UpcomingPayments.daysUntil(payment), days >= 0 {
                            TimelineChip(
                                icon: payment.icon,
                                label: payment.name,
                                detail: days == 0 ? "Today" : "\(days)d",
                                color: Palette.successGreen
                            )
                        }
                    }

                    ForEach(sortedDebtByPayoff(debt: debt), id: \.name) { item in
                        let months = DebtCalc.monthsToPayoff(item: item)
                        TimelineChip(
                            icon: DebtCalc.icon(for: item.name),
                            label: item.name,
                            detail: DebtCalc.payoffLabel(months),
                            color: months < 0.1 ? Palette.successGreen : months <= 3 ? Palette.warningAmber : Palette.dangerRed
                        )
                    }

                    ForEach(goals, id: \.name) { goal in
                        TimelineChip(
                            icon: "flag",
                            label: goal.name,
                            detail: String(format: "%.0f%%", goal.progress * 100),
                            color: Color(hex: goal.priorityColor)
                        )
                    }
                }
            }
        }
        .padding(.horizontal)
    }

    private func sortedDebtByPayoff(debt: [FinanceData.DebtItem]) -> [FinanceData.DebtItem] {
        debt.sorted { DebtCalc.monthsToPayoff(item: $0) < DebtCalc.monthsToPayoff(item: $1) }
    }

    private var combinedSpendingCard: some View {
        VStack(spacing: 16) {
            statementsChart

            if !spendingMonthsDescending.isEmpty {
                stackedCategoryChart(months: spendingMonths)
                    .padding(.horizontal)

                Button("Manage Statements") {
                    showStatementManager = true
                }
                .font(.caption.weight(.medium))
                .foregroundStyle(Palette.appleBlue)
                .padding(.bottom, 4)
            }
        }
        .sheet(isPresented: $showStatementManager) {
            StatementManagerSheet(appState: appState)
        }
    }

    private var planningCard: some View {
        VStack(spacing: 16) {
            budgetContent
            financialCalendarContent
        }
    }


    private var statementsChart: some View {
        let allTransactions = appState.statements.flatMap(\.transactions)
        let grouped = Dictionary(grouping: allTransactions) { String($0.date.prefix(7)) }
        let actuals = grouped
            .map { (month: $0.key, total: $0.value.reduce(0) { $0 + abs($1.amount) }, transactions: $0.value, predicted: false) }
            .sorted { $0.month < $1.month }

        // Monte Carlo: predict N months forward, cached to avoid re-rolling on drag
        let predictionKey = actuals.map(\.month).joined()
        let predictions: [(month: String, total: Double)]
        if predictionKey == lastPredictionKey && !cachedPredictions.isEmpty {
            predictions = cachedPredictions
        } else {
            let avgSpending = actuals.isEmpty ? 0 : actuals.map(\.total).reduce(0, +) / Double(actuals.count)
            let stdDev = actuals.count > 1
                ? sqrt(actuals.map { pow($0.total - avgSpending, 2) }.reduce(0, +) / Double(actuals.count - 1))
                : avgSpending * 0.15
            var newPredictions: [(month: String, total: Double)] = []
            if let lastMonth = actuals.last?.month, actuals.count >= 2 {
                let parts = lastMonth.split(separator: "-")
                if let year = Int(parts[0]), let mo = Int(parts[1]) {
                    // Use seeded random based on data hash for stability
                    var seed: UInt64 = 0x517cc1b727220a95
                    for c in predictionKey.utf8 { seed = seed &* 0x100000001b3 ^ UInt64(c) }
                    for i in 1...actuals.count {
                        let futureMonth = mo + i
                        let fYear = year + (futureMonth - 1) / 12
                        let fMo = ((futureMonth - 1) % 12) + 1
                        let label = String(format: "%04d-%02d", fYear, fMo)
                        seed = seed &* 6364136223846793005 &+ 1442695040888963407
                        let normalized = Double(seed >> 11) / Double(UInt64(1) << 53)
                        let noise = (normalized * 2 - 1) * stdDev
                        let predicted = max(avgSpending + noise, 0)
                        newPredictions.append((month: label, total: predicted))
                    }
                }
            }
            predictions = newPredictions
            cachedPredictions = newPredictions
            lastPredictionKey = predictionKey
        }
        let allData: [(month: String, total: Double, transactions: [Transaction], predicted: Bool)] =
            actuals + predictions.map { (month: $0.month, total: $0.total, transactions: [], predicted: true) }

        let selectedData = allData.first { $0.month == selectedStatementMonth }
        let displayTotal = selectedData?.total ?? actuals.last?.total
        let displayLabel: String
        if let selectedData {
            displayLabel = selectedData.predicted ? "\(selectedData.month) (forecast)" : selectedData.month
        } else {
            displayLabel = "this month"
        }

        let categorySource: (month: String, total: Double, transactions: [Transaction], predicted: Bool)?
        if let selected = selectedData, !selected.transactions.isEmpty {
            categorySource = selected
        } else {
            categorySource = actuals.last
        }
        let categoryTransactions = categorySource?.transactions ?? []
        let categories = Dictionary(grouping: categoryTransactions) { $0.category ?? "Other" }
            .map { (name: $0.key, total: $0.value.reduce(0) { $0 + abs($1.amount) }) }
            .sorted { $0.total > $1.total }

        let monthNames = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

        let forecast = spendingForecast

        return VStack(alignment: .leading, spacing: 12) {
            Text("SPENDING")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .tracking(0.8)
                .padding(.horizontal)

            if actuals.isEmpty {
                emptyState("No transaction data")
            } else {
                VStack(alignment: .leading, spacing: 4) {
                    if let total = displayTotal {
                        Text(total, format: .currency(code: currencyCode).precision(.fractionLength(0)))
                            .font(.system(size: 34, weight: .bold, design: .rounded))
                    }
                    Text(displayLabel)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if let forecast {
                        Text("Next month: \(forecast.summary.expectedNextMonth, format: .currency(code: currencyCode).precision(.fractionLength(0))) (\(forecast.summary.rangeLow, format: .currency(code: currencyCode).precision(.fractionLength(0))) - \(forecast.summary.rangeHigh, format: .currency(code: currencyCode).precision(.fractionLength(0))))")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.horizontal)

                Chart {
                    ForEach(allData.filter { !$0.predicted }, id: \.month) { item in
                        AreaMark(x: .value("Month", item.month), y: .value("Amount", item.total))
                            .foregroundStyle(Palette.appleBlue.opacity(0.15))
                        LineMark(x: .value("Month", item.month), y: .value("Amount", item.total))
                            .foregroundStyle(Palette.appleBlue)
                            .lineStyle(StrokeStyle(lineWidth: 2))
                    }
                    ForEach(predictions, id: \.month) { item in
                        LineMark(x: .value("Month", item.month), y: .value("Forecast", item.total))
                            .foregroundStyle(Palette.appleBlue.opacity(0.4))
                            .lineStyle(StrokeStyle(lineWidth: 1.5, dash: [6, 4]))
                            .interpolationMethod(.linear)
                    }
                    if let selected = selectedData {
                        RuleMark(x: .value("Month", selected.month))
                            .foregroundStyle(Palette.overlay.opacity(0.3))
                    }
                }
                .chartXAxis {
                    AxisMarks { value in
                        AxisValueLabel {
                            if let month = value.as(String.self), month.count >= 7 {
                                let monthNum = Int(month.suffix(2)) ?? 0
                                Text(monthNum > 0 && monthNum <= 12 ? monthNames[monthNum] : month)
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
                .chartYAxis {
                    AxisMarks(position: .leading) { value in
                        AxisGridLine()
                        AxisValueLabel {
                            if let amount = value.as(Double.self) {
                                Text(compactCurrency(amount))
                                    .font(.caption2)
                            }
                        }
                    }
                }
                .chartOverlay { proxy in
                    GeometryReader { geo in
                        if let plotFrame = proxy.plotFrame {
                            let frame = geo[plotFrame]
                            Rectangle().fill(.clear).contentShape(Rectangle())
                                .gesture(
                                    DragGesture(minimumDistance: 0)
                                        .onChanged { value in
                                            let x = value.location.x - frame.origin.x
                                            guard x >= 0, x <= frame.width,
                                                  let month: String = proxy.value(atX: x)
                                            else { return }
                                            if selectedStatementMonth != month {
                                                selectedStatementMonth = month
                                                Haptics.selection()
                                            }
                                        }
                                        .onEnded { _ in
                                            selectedStatementMonth = nil
                                        }
                                )
                        }
                    }
                }
                .frame(height: 200)
                .padding(.horizontal)

                if !categories.isEmpty {
                    Divider().padding(.horizontal)

                    TappablePieChart(
                        categories: Array(categories.prefix(5)),
                        selectedCategory: $selectedCategory
                    )
                    .frame(height: 200)
                    .padding(.horizontal)

                    let catTotal = categories.reduce(0.0) { $0 + $1.total }
                    VStack(spacing: 8) {
                        ForEach(categories.prefix(5), id: \.name) { cat in
                            let pct = catTotal > 0 ? cat.total / catTotal : 0
                            Button {
                                withAnimation(.spring(response: 0.35, dampingFraction: 0.7)) {
                                    selectedCategory = selectedCategory == cat.name ? nil : cat.name
                                }
                            } label: {
                                HStack(spacing: 8) {
                                    RoundedRectangle(cornerRadius: 3)
                                        .fill(categoryColors[cat.name.lowercased()] ?? Color.gray)
                                        .frame(width: 12, height: 12)
                                    Text(cat.name)
                                        .font(.caption)
                                        .foregroundStyle(selectedCategory == cat.name ? .primary : .secondary)
                                    Spacer()
                                    Text(String(format: "%.0f%%", pct * 100))
                                        .font(.caption.monospacedDigit())
                                        .foregroundStyle(.secondary)
                                    Text(cat.total, format: .currency(code: currencyCode).precision(.fractionLength(0)))
                                        .font(.caption.weight(.semibold).monospacedDigit())
                                }
                            }
                            .buttonStyle(BounceButtonStyle())
                            .padding(.vertical, 4)
                            .padding(.horizontal, 8)
                            .background(selectedCategory == cat.name ? Palette.overlay.opacity(0.06) : .clear, in: RoundedRectangle(cornerRadius: 8))
                        }
                    }
                    .padding(.horizontal)
                }
            }
        }
        .padding(.vertical, 16)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16))
        .padding(.horizontal)
    }

    private func budgetMetricRow(title: String, value: Double, progress: Double, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(title)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Palette.text)
                Spacer()
                Text(String(format: "$%.2f", value))
                    .font(.subheadline.weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(value < 0 ? Palette.dangerRed : Palette.text)
            }
            ProgressView(value: max(min(progress, 1), 0))
                .tint(color)
        }
    }

    private func sectionCard<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            if !title.isEmpty {
                Text(title.uppercased())
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(Palette.textSecondary)
                    .tracking(0.8)
                    .padding(.horizontal)
                    .padding(.bottom, 10)
            }
            content()
        }
        .padding(.vertical, 14)
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(.ultraThinMaterial)
                .overlay(
                    RoundedRectangle(cornerRadius: 14)
                        .stroke(Palette.overlay.opacity(0.06), lineWidth: 1)
                )
        )
        .padding(.horizontal)
    }

    private func emptyState(_ message: String) -> some View {
        Text(message)
            .font(.caption)
            .foregroundStyle(.secondary)
            .padding(.horizontal)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func spendingChart(
        months: [FinanceData.SpendingMonth],
        forecast: SpendingForecast?,
        monthlyIncome: Double? = nil
    ) -> some View {
        let yDomain = spendingChartDomain(months: months, forecast: forecast)
        let axisMonths = xAxisMonthLabels(months: months, forecast: forecast)

        return VStack(alignment: HorizontalAlignment.leading, spacing: 12) {
            Text("Spending & Savings Forecast")
                .font(.headline)

            if let forecast {
                VStack(alignment: HorizontalAlignment.leading, spacing: 6) {
                    Text(
                        "Next month expected: \(forecast.summary.expectedNextMonth, format: .currency(code: currencyCode))"
                    )
                    .font(.subheadline.weight(.semibold))

                    Text(
                        "Range: \(forecast.summary.rangeLow, format: .currency(code: currencyCode)) - \(forecast.summary.rangeHigh, format: .currency(code: currencyCode))"
                    )
                    .font(.caption)
                    .foregroundStyle(.secondary)

                    if let savings = savingsForecast {
                        HStack(spacing: 4) {
                            Circle()
                                .fill(Palette.warningAmber)
                                .frame(width: 6, height: 6)
                            Text("Avg savings: \(savings.avgMonthlySavings, format: .currency(code: currencyCode))/mo")
                                .font(.caption)
                                .foregroundStyle(Palette.warningAmber)
                        }
                    }
                }
            } else {
                Text("Add at least 3 months of reports to generate a forecast.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Chart {
                spendingActualMarks(months: months)
                spendingForecastMarks(forecast: forecast)
                savingsForecastMarks()
                spendingSelectionMark()
            }
            .frame(height: 220)
            .chartLegend(Visibility.hidden)
            .chartYScale(domain: yDomain)
            .chartXAxis {
                AxisMarks(position: .bottom, values: axisMonths) { value in
                    AxisGridLine()
                    AxisTick()
                    AxisValueLabel(centered: true) {
                        if let month = value.as(String.self) {
                            Text(shortMonthLabel(month))
                                .font(.caption2)
                        } else {
                            EmptyView()
                        }
                    }
                }
            }
            .chartYAxis {
                AxisMarks(position: .leading) { value in
                    AxisGridLine()
                    AxisTick()
                    AxisValueLabel {
                        if let amount = value.as(Double.self) {
                            Text(compactCurrency(amount))
                                .font(.caption2)
                        } else {
                            EmptyView()
                        }
                    }
                }
            }
            .chartPlotStyle { plot in
                plot
                    .background(Palette.overlay.opacity(0.03))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .chartOverlay { proxy in
                spendingChartOverlay(proxy: proxy)
            }
        }
        .padding(14)
        .background(Palette.overlay.opacity(0.04), in: RoundedRectangle(cornerRadius: 16))
    }

    @ChartContentBuilder
    private func spendingActualMarks(months: [FinanceData.SpendingMonth]) -> some ChartContent {
        ForEach(months) { month in
            LineMark(
                x: .value("Month", month.month),
                y: .value("Actual", month.total)
            )
            .foregroundStyle(Palette.appleBlue)
            .lineStyle(StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))

            AreaMark(
                x: .value("Month", month.month),
                y: .value("Actual", month.total)
            )
            .foregroundStyle(
                LinearGradient(
                    colors: [Palette.appleBlue.opacity(0.28), .clear],
                    startPoint: UnitPoint.top,
                    endPoint: UnitPoint.bottom
                )
            )
        }
    }

    @ChartContentBuilder
    private func spendingForecastMarks(forecast: SpendingForecast?) -> some ChartContent {
        if let forecast {
            ForEach(forecast.points) { point in
                AreaMark(
                    x: .value("Month", point.month),
                    yStart: .value("Low", point.low),
                    yEnd: .value("High", point.high)
                )
                .foregroundStyle(Palette.successGreen.opacity(0.18))

                LineMark(
                    x: .value("Month", point.month),
                    y: .value("Median Forecast", point.median)
                )
                .foregroundStyle(Palette.successGreen)
                .lineStyle(StrokeStyle(lineWidth: 2, dash: [6, 4]))
                .interpolationMethod(.linear)
            }
        }
    }

    @ChartContentBuilder
    private func savingsForecastMarks() -> some ChartContent {
        if let forecast = savingsForecast {
            ForEach(forecast.points) { point in
                AreaMark(
                    x: .value("Month", point.month),
                    yStart: .value("Savings Low", max(0, point.low)),
                    yEnd: .value("Savings High", max(0, point.high))
                )
                .foregroundStyle(Palette.warningAmber.opacity(0.15))

                LineMark(
                    x: .value("Month", point.month),
                    y: .value("Savings Forecast", max(0, point.median))
                )
                .foregroundStyle(Palette.warningAmber)
                .lineStyle(StrokeStyle(lineWidth: 2, dash: [6, 4]))
                .interpolationMethod(.linear)
            }
        }
    }

    @ChartContentBuilder
    private func spendingSelectionMark() -> some ChartContent {
        if let selectedSpendingMonth {
            RuleMark(x: .value("Selected Month", selectedSpendingMonth))
                .foregroundStyle(Palette.overlay.opacity(0.35))
                .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4]))
        }
    }

    private func spendingXAxisLabels(months: [String]) -> some View {
        HStack(alignment: .top) {
            ForEach(months, id: \.self) { month in
                Text(shortMonthLabel(month))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity)
                    .lineLimit(1)
            }
        }
        .padding(.top, 2)
    }

    private func spendingChartOverlay(proxy: ChartProxy) -> some View {
        GeometryReader { geometry in
            if let plotFrame = proxy.plotFrame {
                let frame = geometry[plotFrame]

                ZStack(alignment: .topLeading) {
                    Rectangle()
                        .fill(.clear)
                        .contentShape(Rectangle())
                        .gesture(scrubGesture(proxy: proxy, plotFrame: frame))
                        .onTapGesture {
                            clearSpendingSelection()
                        }

                    spendingTooltipOverlay(proxy: proxy, plotFrame: frame, geometryWidth: geometry.size.width)
                }
            } else {
                Color.clear
            }
        }
    }

    @ViewBuilder
    private func spendingTooltipOverlay(
        proxy: ChartProxy,
        plotFrame: CGRect,
        geometryWidth: CGFloat
    ) -> some View {
        if let month = selectedSpendingMonth,
           let value = selectedSpendingValue,
           let position = selectedTooltipPosition(
            proxy: proxy,
            plotFrame: plotFrame,
            geometryWidth: geometryWidth,
            value: value
           ) {
            spendingTooltip(month: month, value: value)
                .position(position)
        }
    }

    private func scrubGesture(proxy: ChartProxy, plotFrame: CGRect) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                let xPosition = value.location.x - plotFrame.origin.x

                guard xPosition >= 0,
                      xPosition <= plotFrame.width,
                      let month: String = proxy.value(atX: xPosition)
                else { return }

                updateSelectedSpendingMonth(month)
                selectedSpendingX = plotFrame.origin.x + xPosition
            }
            .onEnded { _ in
                lastHapticMonth = nil
            }
    }

    private func updateSelectedSpendingMonth(_ month: String) {
        guard selectedSpendingMonth != month else { return }
        selectedSpendingMonth = month

        guard lastHapticMonth != month else { return }
        let generator = UISelectionFeedbackGenerator()
        generator.selectionChanged()
        lastHapticMonth = month
    }

    private func clearSpendingSelection() {
        selectedSpendingMonth = nil
        selectedSpendingX = nil
        lastHapticMonth = nil
    }

    private func spendingTooltip(month: String, value: Double) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(month)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(Palette.text.opacity(0.72))
            Text(value, format: .currency(code: currencyCode))
                .font(.caption.weight(.bold))
                .foregroundStyle(Palette.text)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
        .overlay {
            RoundedRectangle(cornerRadius: 12)
                .stroke(Palette.overlay.opacity(0.08), lineWidth: 1)
        }
    }

    private func selectedTooltipPosition(
        proxy: ChartProxy,
        plotFrame: CGRect,
        geometryWidth: CGFloat,
        value: Double
    ) -> CGPoint? {
        guard let plotY = proxy.position(forY: value) else { return nil }
        let xPosition = selectedSpendingX ?? (plotFrame.origin.x + plotFrame.width / 2)
        return CGPoint(
            x: min(max(xPosition, 88), geometryWidth - 88),
            y: max(plotFrame.origin.y + plotY - 34, 20)
        )
    }

    private var scenarioToggles: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Income Scenarios")
                .font(.caption)
                .foregroundStyle(.secondary)
            HStack(spacing: 8) {
                ForEach(IncomeScenario.allCases) { scenario in
                    let isActive = activeScenarios.contains(scenario)
                    Button {
                        if isActive {
                            activeScenarios.remove(scenario)
                        } else {
                            activeScenarios.insert(scenario)
                        }
                    } label: {
                        Text(scenario.label)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(isActive ? Palette.bg : Palette.text.opacity(0.86))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(
                                Capsule()
                                    .fill(isActive ? scenario.color : Palette.overlay.opacity(0.08))
                            )
                    }
                    .buttonStyle(BounceButtonStyle())
                }
            }
        }
    }

    private func stackedCategoryChart(months: [FinanceData.SpendingMonth]) -> some View {
        return VStack(alignment: .leading, spacing: 12) {
            Text("Category Breakdown")
                .font(.headline)

            if months.isEmpty {
                Text("No data")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                Chart {
                    ForEach(months) { month in
                        ForEach(month.sortedCategories, id: \.key) { category in
                            BarMark(
                                x: .value("Month", month.month),
                                y: .value("Amount", category.value)
                            )
                            .foregroundStyle(by: .value("Category", category.key))
                        }
                    }
                }
                .chartForegroundStyleScale(mapping: { (cat: String) in
                    categoryColors[cat.lowercased()] ?? Color.gray
                })
                .chartLegend(position: .bottom, spacing: 8)
                .frame(height: 200)
                .chartPlotStyle { plot in
                    plot
                        .background(Palette.overlay.opacity(0.03))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .chartXAxis {
                    AxisMarks(position: .bottom) { value in
                        AxisGridLine()
                        AxisTick()
                        AxisValueLabel(centered: true) {
                            if let month = value.as(String.self) {
                                Text(shortMonthLabel(month))
                                    .font(.caption2)
                            } else {
                                EmptyView()
                            }
                        }
                    }
                }
                .chartYAxis {
                    AxisMarks(position: .leading) { value in
                        AxisGridLine()
                        AxisTick()
                        AxisValueLabel {
                            if let amount = value.as(Double.self) {
                                Text(compactCurrency(amount))
                                    .font(.caption2)
                            } else {
                                EmptyView()
                            }
                        }
                    }
                }
            }
        }
        .padding(14)
        .background(Palette.overlay.opacity(0.04), in: RoundedRectangle(cornerRadius: 16))
    }

    private func debtPayoffProjection(debt: [FinanceData.DebtItem], surplus: Double) -> some View {
        let sorted = debt.sorted { $0.balance < $1.balance }
        var projections: [(name: String, balance: Double, months: Double, cumulative: Double)] = []
        var cumulative: Double = 0

        for item in sorted {
            guard item.balance > 0 else { continue }
            let payment = max(item.minPayment, surplus)
            let months = payment > 0 ? item.balance / payment : 0
            cumulative += months
            projections.append((name: item.name, balance: item.balance, months: months, cumulative: cumulative))
        }

        return VStack(alignment: .leading, spacing: 12) {
            Text("Payoff Projection")
                .font(.headline)

            ForEach(Array(projections.enumerated()), id: \.offset) { _, proj in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(proj.name)
                            .font(.subheadline.weight(.semibold))
                        Spacer()
                        Text(String(format: "$%.2f", proj.balance))
                            .font(.caption)
                            .monospacedDigit()
                    }
                    Text(payoffTimeLabel(proj.months))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    ProgressView(value: 1.0)
                        .tint(Palette.successGreen)
                }
            }

            if let last = projections.last {
                Text("Debt-free in \(payoffTimeLabel(last.cumulative))")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Palette.successGreen)
            }
        }
    }

    private func payoffTimeLabel(_ months: Double) -> String {
        if months < 0.07 { return "< 1 week" }
        if months < 0.23 { return "~1 week" }
        if months < 0.5 { return "~2 weeks" }
        if months < 0.9 { return "~3 weeks" }
        if months < 1.5 { return "~1 month" }
        let rounded = Int(ceil(months))
        if rounded < 12 { return "~\(rounded) months" }
        let years = rounded / 12
        let remaining = rounded % 12
        if remaining == 0 { return "~\(years) year\(years > 1 ? "s" : "")" }
        return "~\(years)y \(remaining)mo"
    }

    private func spendingChartDomain(
        months: [FinanceData.SpendingMonth],
        forecast: SpendingForecast?
    ) -> ClosedRange<Double> {
        let actuals = months.map(\.total)
        let lows = forecast?.points.map(\.low) ?? []
        let medians = forecast?.points.map(\.median) ?? []
        let highs = forecast?.points.map(\.high) ?? []
        let combined = actuals + lows + medians + highs

        guard let minValue = combined.min(), let maxValue = combined.max() else {
            return -1000...5000
        }

        let coreUpper = max(
            actuals.max() ?? 0,
            (forecast?.summary.rangeHigh ?? 0) * 1.1
        )
        let lower = min(minValue, 0)
        let upper = max(coreUpper, maxValue * 0.75)
        let span = max(upper - lower, 1000)
        let padding = span * 0.12
        return (lower - padding)...(upper + padding)
    }

    private func compactCurrency(_ value: Double) -> String {
        let absValue = abs(value)
        let sign = value < 0 ? "-" : ""

        if absValue >= 1_000_000 {
            return "\(sign)$\(String(format: "%.1f", absValue / 1_000_000))M"
        }
        if absValue >= 1_000 {
            return "\(sign)$\(String(format: "%.0f", absValue / 1_000))K"
        }
        return "\(sign)$\(String(format: "%.0f", absValue))"
    }

    private func shortMonthLabel(_ label: String) -> String {
        let parts = label.split(separator: " ")
        guard let first = parts.first else { return label }
        return String(first.prefix(3))
    }

    private func xAxisMonthLabels(
        months: [FinanceData.SpendingMonth],
        forecast: SpendingForecast?
    ) -> [String] {
        let actualMonths = months.map(\.month)
        let forecastMonths = forecast?.points.map(\.month) ?? []
        let combined = actualMonths + forecastMonths

        guard combined.count > 6 else { return combined }

        return combined.enumerated().compactMap { index, month in
            let isLast = index == combined.count - 1
            return index.isMultiple(of: 2) || isLast ? month : nil
        }
    }
}

// MARK: - Debt Editor Sheet

private struct DebtEditorSheet: View {
    @Binding var items: [FinanceData.DebtItem]
    let onSave: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                ForEach($items) { $item in
                    VStack(alignment: .leading, spacing: 8) {
                        TextField("Name", text: $item.name)
                            .font(.headline)
                        HStack {
                            Text("Balance")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            TextField("0", value: $item.balance, format: .number)
                                .keyboardType(.decimalPad)
                                .multilineTextAlignment(.trailing)
                        }
                        HStack {
                            Text("Min Payment")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            TextField("0", value: $item.minPayment, format: .number)
                                .keyboardType(.decimalPad)
                                .multilineTextAlignment(.trailing)
                        }
                        TextField("Note", text: Binding(
                            get: { item.note ?? "" },
                            set: { item.note = $0.isEmpty ? nil : $0 }
                        ))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                }
                .onDelete { offsets in
                    items.remove(atOffsets: offsets)
                }

                Button {
                    items.append(FinanceData.DebtItem(name: "", balance: 0, rate: 0, minPayment: 0, note: nil))
                } label: {
                    Label("Add Debt", systemImage: "plus.circle")
                }
            }
            .navigationTitle("Edit Debt")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        onSave()
                        dismiss()
                    }
                    .bold()
                }
            }
        }
    }
}

// MARK: - Goal Editor Sheet

private struct GoalEditorSheet: View {
    @Binding var items: [FinanceData.Goal]
    let onSave: () -> Void
    @Environment(\.dismiss) private var dismiss

    private let priorities = ["low", "medium", "high"]

    var body: some View {
        NavigationStack {
            List {
                ForEach($items) { $item in
                    VStack(alignment: .leading, spacing: 8) {
                        TextField("Name", text: $item.name)
                            .font(.headline)
                        HStack {
                            Text("Target")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            TextField("0", value: $item.target, format: .number)
                                .keyboardType(.decimalPad)
                                .multilineTextAlignment(.trailing)
                        }
                        HStack {
                            Text("Saved")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            TextField("0", value: $item.saved, format: .number)
                                .keyboardType(.decimalPad)
                                .multilineTextAlignment(.trailing)
                        }
                        Picker("Priority", selection: $item.priority) {
                            ForEach(priorities, id: \.self) { Text($0.capitalized) }
                        }
                        .pickerStyle(.segmented)
                        TextField("Deadline (YYYY-MM)", text: Binding(
                            get: { item.deadline ?? "" },
                            set: { item.deadline = $0.isEmpty ? nil : $0 }
                        ))
                        .font(.caption)
                        TextField("Note", text: Binding(
                            get: { item.note ?? "" },
                            set: { item.note = $0.isEmpty ? nil : $0 }
                        ))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                }
                .onDelete { offsets in
                    items.remove(atOffsets: offsets)
                }

                Button {
                    items.append(FinanceData.Goal(name: "", target: 0, saved: 0, priority: "medium", deadline: nil, note: nil))
                } label: {
                    Label("Add Goal", systemImage: "plus.circle")
                }
            }
            .navigationTitle("Edit Goals")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        onSave()
                        dismiss()
                    }
                    .bold()
                }
            }
        }
    }
}

// MARK: - Statement Manager

private struct StatementManagerSheet: View {
    let appState: AppState
    @Environment(\.dismiss) private var dismiss

    private var months: [FinanceData.SpendingMonth] {
        (appState.financeData?.spending ?? []).sorted { $0.sortKey > $1.sortKey }
    }

    var body: some View {
        NavigationStack {
            List {
                if months.isEmpty {
                    Text("No statements imported yet.")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(months) { month in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(month.month)
                                    .font(.body.weight(.medium))
                                Text("\(month.sortedCategories.count) categories")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text(month.total, format: .currency(code: Locale.current.currency?.identifier ?? "USD").precision(.fractionLength(0)))
                                .font(.body.weight(.semibold))
                                .monospacedDigit()
                        }
                        .padding(.vertical, 4)
                    }
                    .onDelete { offsets in
                        let toDelete = offsets.map { months[$0].month }
                        for month in toDelete {
                            Task { await appState.deleteSpendingMonth(month) }
                        }
                    }
                }
            }
            .navigationTitle("Statements")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Done") { dismiss() }
                }
                if !months.isEmpty {
                    ToolbarItem(placement: .topBarTrailing) {
                        EditButton()
                    }
                }
            }
        }
    }
}

private struct TappablePieChart: View {
    let categories: [(name: String, total: Double)]
    @Binding var selectedCategory: String?

    var body: some View {
        Chart {
            ForEach(categories, id: \.name) { cat in
                SectorMark(
                    angle: .value("Amount", cat.total),
                    innerRadius: .ratio(0.6),
                    outerRadius: .ratio(selectedCategory == cat.name ? 1.0 : 0.9)
                )
                .foregroundStyle(categoryColors[cat.name.lowercased()] ?? Color.gray)
                .opacity(selectedCategory == nil || selectedCategory == cat.name ? 1 : 0.4)
            }
        }
        .overlay {
            GeometryReader { geo in
                Color.clear
                    .contentShape(Circle())
                    .onTapGesture { location in
                        let center = CGPoint(x: geo.size.width / 2, y: geo.size.height / 2)
                        let dx = location.x - center.x
                        let dy = location.y - center.y
                        let dist = sqrt(dx * dx + dy * dy)
                        let radius = min(geo.size.width, geo.size.height) / 2
                        guard dist > radius * 0.6, dist < radius * 1.0 else { return }
                        var angle = atan2(dx, -dy)
                        if angle < 0 { angle += 2 * .pi }
                        let fraction = angle / (2 * .pi)
                        let total = categories.reduce(0.0) { $0 + $1.total }
                        guard total > 0 else { return }
                        let target = fraction * total
                        var cumulative = 0.0
                        for cat in categories {
                            cumulative += cat.total
                            if target <= cumulative {
                                withAnimation(.spring(response: 0.35, dampingFraction: 0.7)) {
                                    selectedCategory = selectedCategory == cat.name ? nil : cat.name
                                }
                                Haptics.selection()
                                return
                            }
                        }
                    }
            }
        }
    }
}
