import Charts
import SwiftUI

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
    "utilities": Palette.purple,
    "entertainment": Palette.dangerRed,
    "health": Palette.cyan,
    "shopping": Palette.pink,
    "other": Palette.yellow,
    "insurance": Palette.brown,
    "subscriptions": Palette.indigo,
]

struct PortfolioView: View {
    @Environment(AppState.self) private var appState
    @State private var selectedTab: FinanceTab = .spending
    @State private var hasLoaded = false
    @State private var selectedSpendingMonth: String?
    @State private var selectedSpendingX: CGFloat?
    @State private var activeScenarios: Set<IncomeScenario> = []
    @State private var expandedSpendingMonth: String?
    @State private var isEditingDebt = false
    @State private var isEditingGoals = false
    @State private var editingDebtItems: [FinanceData.DebtItem] = []
    @State private var editingGoalItems: [FinanceData.Goal] = []

    private enum FinanceTab: String, CaseIterable, Identifiable {
        case spending = "Spending"
        case holdings = "Holdings"
        case budget = "Budget"
        case debt = "Debt"
        case goals = "Goals"
        case statements = "Statements"

        var id: String { rawValue }
    }

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

    private var nextMonthDeltaText: String? {
        guard let forecast = spendingForecast,
              let lastActual = spendingMonths.last?.total
        else { return nil }

        let delta = forecast.summary.expectedNextMonth - lastActual
        let direction = delta >= 0 ? "+" : "-"
        let magnitude = abs(delta)
        let percent = lastActual == 0 ? 0 : (delta / lastActual) * 100
        let amountText = formattedCurrency(magnitude)
        let percentText = String(format: "%.1f", abs(percent))
        return "\(direction)\(amountText) (\(direction)\(percentText)%) vs latest"
    }

    private var topSpendingDriverText: String? {
        guard let latest = spendingMonths.last,
              let topCategory = latest.sortedCategories.first
        else { return nil }
        return "\(topCategory.key.capitalized) is the largest recent category"
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
                        VStack(spacing: 16) {
                            tabSelector
                                .padding(.top, 12)

                            tabContent

                            Spacer(minLength: 24)
                        }
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
                _ = await (financeLoad, statementsLoad)
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

    @ViewBuilder
    private var tabContent: some View {
        switch selectedTab {
        case .spending:
            spendingContent
        case .holdings:
            if let portfolio = resolvedPortfolio {
                holdingsContent(portfolio)
            } else {
                sectionCard("Holdings") {
                    emptyState("No holdings data available")
                }
            }
        case .budget:
            budgetContent
        case .debt:
            debtContent
        case .goals:
            goalsContent
        case .statements:
            statementsContent
        }
    }

    private var signInPrompt: some View {
        VStack(spacing: 16) {
            Image(systemName: "briefcase")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            Text("Sign in to view your portfolio")
                .foregroundStyle(.secondary)
            Button("Sign In") {
                appState.showLogin = true
            }
            .buttonStyle(.borderedProminent)
            .tint(Palette.appleBlue)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var tabSelector: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(FinanceTab.allCases) { tab in
                    Button {
                        selectedTab = tab
                    } label: {
                        Text(tab.rawValue)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(selectedTab == tab ? Color.black : .white.opacity(0.86))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(
                                Capsule()
                                    .fill(selectedTab == tab ? Color.white : Color.white.opacity(0.08))
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal)
        }
    }

    private func holdingsContent(_ portfolio: Portfolio) -> some View {
        VStack(spacing: 24) {
            VStack(spacing: 8) {
                Text("Total Value")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(String(format: "$%.2f", portfolio.totalValue))
                    .font(.system(size: 44, weight: .bold))
                HStack(spacing: 4) {
                    Text(String(format: "%@$%.2f", portfolio.dayChange >= 0 ? "+" : "", portfolio.dayChange))
                    Text(String(format: "(%.2f%%)", portfolio.dayChangePercent))
                }
                .font(.caption)
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

    private var budgetContent: some View {
        sectionCard("Budget") {
            if let budget = appState.financeData?.budget {
                VStack(alignment: .leading, spacing: 16) {
                    budgetMetricRow(
                        title: "Monthly Income",
                        value: budget.totalMonthlyIncome,
                        progress: 1,
                        color: Palette.successGreen
                    )

                    let expenseProgress = budget.totalMonthlyIncome > 0
                        ? min(budget.totalMonthlyExpenses / budget.totalMonthlyIncome, 1)
                        : 0
                    budgetMetricRow(
                        title: "Monthly Expenses",
                        value: budget.totalMonthlyExpenses,
                        progress: expenseProgress,
                        color: Palette.dangerRed
                    )

                    budgetMetricRow(
                        title: "Monthly Surplus",
                        value: budget.monthlySurplus,
                        progress: budget.totalMonthlyIncome > 0
                            ? max(min(budget.monthlySurplus / budget.totalMonthlyIncome, 1), 0)
                            : 0,
                        color: budget.monthlySurplus >= 0 ? Palette.successGreen : Palette.dangerRed
                    )
                }
                .padding(.horizontal)
                .padding(.bottom, 12)
            } else {
                emptyState("No budget data available")
            }
        }
    }

    private var debtContent: some View {
        VStack(spacing: 0) {
            HStack {
                Text("DEBT")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .tracking(0.8)
                Spacer()
                Button {
                    editingDebtItems = appState.financeData?.debt ?? []
                    isEditingDebt = true
                } label: {
                    Image(systemName: "pencil.circle")
                        .foregroundStyle(Palette.appleBlue)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal)
            .padding(.bottom, 8)

            sectionCard("") {
                let debtItems = appState.financeData?.debt ?? []
                if debtItems.isEmpty {
                    emptyState("No debt data available")
                } else {
                    VStack(spacing: 0) {
                        ForEach(debtItems) { debt in
                            VStack(alignment: .leading, spacing: 4) {
                                Text(debt.name)
                                    .font(.headline)
                                HStack {
                                    Text(String(format: "Balance: $%.2f", debt.balance))
                                        .monospacedDigit()
                                    Spacer()
                                    Text(String(format: "Min: $%.2f", debt.minPayment))
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                        .monospacedDigit()
                                }
                            }
                            .padding(.horizontal)
                            .padding(.vertical, 10)

                            if debt.id != debtItems.last?.id {
                                Divider().padding(.horizontal)
                            }
                        }

                        Divider().padding(.horizontal)
                        HStack {
                            Text("Total")
                                .font(.headline)
                            Spacer()
                            Text(String(format: "$%.2f", debtItems.reduce(0) { $0 + $1.balance }))
                                .font(.headline)
                                .monospacedDigit()
                        }
                        .padding(.horizontal)
                        .padding(.vertical, 12)

                        if let budget = appState.financeData?.budget, budget.monthlySurplus > 0 {
                            Divider().padding(.horizontal)
                            debtPayoffProjection(debt: debtItems, surplus: budget.monthlySurplus)
                                .padding(.horizontal)
                                .padding(.vertical, 12)
                        }
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
    }

    private var goalsContent: some View {
        VStack(spacing: 0) {
            HStack {
                Text("GOALS")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .tracking(0.8)
                Spacer()
                Button {
                    editingGoalItems = appState.financeData?.goals ?? []
                    isEditingGoals = true
                } label: {
                    Image(systemName: "pencil.circle")
                        .foregroundStyle(Palette.appleBlue)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal)
            .padding(.bottom, 8)

            sectionCard("") {
                let goals = appState.financeData?.goals ?? []
                if goals.isEmpty {
                    emptyState("No goals data available")
                } else {
                    VStack(spacing: 0) {
                        ForEach(goals) { goal in
                            VStack(alignment: .leading, spacing: 8) {
                                HStack {
                                    Text(goal.name)
                                        .font(.headline)
                                    Spacer()
                                    Text(String(format: "$%.0f / $%.0f", goal.saved, goal.target))
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                        .monospacedDigit()
                                }
                                ProgressView(value: goal.progress)
                                    .tint(Palette.appleBlue)
                            }
                            .padding(.horizontal)
                            .padding(.vertical, 10)

                            if goal.id != goals.last?.id {
                                Divider().padding(.horizontal)
                            }
                        }
                    }
                }
            }
        }
        .sheet(isPresented: $isEditingGoals) {
            GoalEditorSheet(items: $editingGoalItems) {
                appState.financeData?.goals = editingGoalItems
                Task { await appState.saveFinanceData() }
            }
        }
    }

    private var spendingContent: some View {
        sectionCard("Spending") {
            let months = spendingMonthsDescending
            if months.isEmpty {
                emptyState("No spending data available")
            } else {
                VStack(spacing: 16) {
                    scenarioToggles
                        .padding(.horizontal)

                    spendingChart(months: spendingMonths, forecast: spendingForecast)
                        .padding(.horizontal)
                        .padding(.top, 4)

                    stackedCategoryChart(months: spendingMonths)
                        .padding(.horizontal)

                    ForEach(months) { month in
                        VStack(alignment: .leading, spacing: 8) {
                            Button {
                                withAnimation(.easeInOut(duration: 0.2)) {
                                    expandedSpendingMonth = expandedSpendingMonth == month.month ? nil : month.month
                                }
                            } label: {
                                HStack {
                                    Image(systemName: expandedSpendingMonth == month.month ? "chevron.down" : "chevron.right")
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                    Text(month.month)
                                        .font(.headline)
                                    Spacer()
                                    Text(String(format: "$%.2f", month.total))
                                        .font(.subheadline)
                                }
                            }
                            .buttonStyle(.plain)

                            if expandedSpendingMonth == month.month {
                                ForEach(month.sortedCategories, id: \.key) { category in
                                    VStack(spacing: 4) {
                                        HStack {
                                            Text(category.key)
                                                .font(.caption)
                                                .foregroundStyle(.secondary)
                                            Spacer()
                                            Text(String(format: "$%.2f (%d%%)", category.value, month.total > 0 ? Int(round(category.value / month.total * 100)) : 0))
                                                .font(.caption)
                                        }
                                        ProgressView(value: month.total > 0 ? min(category.value / month.total, 1) : 0)
                                            .tint(categoryColors[category.key.lowercased()] ?? Color.gray)
                                    }
                                }
                            } else {
                                ForEach(month.sortedCategories.prefix(3), id: \.key) { category in
                                    HStack {
                                        Text(category.key)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                        Spacer()
                                        Text(String(format: "$%.2f", category.value))
                                            .font(.caption)
                                    }
                                }
                            }
                        }
                        .padding(.horizontal)
                        .padding(.vertical, 10)

                        if month.id != months.last?.id {
                            Divider().padding(.horizontal)
                        }
                    }
                }
            }
        }
    }

    private var statementsContent: some View {
        sectionCard("Statements") {
            if appState.statements.isEmpty {
                emptyState("No statements available")
            } else {
                VStack(spacing: 0) {
                    ForEach(appState.statements) { statement in
                        DisclosureGroup {
                            VStack(spacing: 0) {
                                HStack(spacing: 12) {
                                    Text("Date")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                    Text("Description")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                    Text("Amount")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                        .frame(width: 92, alignment: .trailing)
                                }
                                .padding(.horizontal)
                                .padding(.top, 4)
                                .padding(.bottom, 8)

                                ForEach(statement.transactions) { transaction in
                                    HStack(spacing: 12) {
                                        Text(transaction.date)
                                            .font(.caption.monospaced())
                                            .frame(maxWidth: .infinity, alignment: .leading)
                                        Text(transaction.description)
                                            .font(.caption)
                                            .frame(maxWidth: .infinity, alignment: .leading)
                                            .lineLimit(2)
                                        Text(
                                            transaction.amount,
                                            format: .currency(code: currencyCode)
                                        )
                                        .font(.caption.monospaced())
                                        .foregroundStyle(
                                            transaction.amount >= 0
                                                ? Palette.successGreen
                                                : Palette.dangerRed
                                        )
                                        .frame(width: 92, alignment: .trailing)
                                    }
                                    .padding(.horizontal)
                                    .padding(.vertical, 8)

                                    if transaction.id != statement.transactions.last?.id {
                                        Divider().padding(.horizontal)
                                    }
                                }
                            }
                            .padding(.bottom, 10)
                        } label: {
                            HStack {
                                Text(statement.filename)
                                    .font(.headline)
                                Spacer()
                                Text("\(statement.transactions.count)")
                                    .font(.caption.monospaced())
                                    .foregroundStyle(.secondary)
                            }
                            .padding(.horizontal)
                            .padding(.vertical, 12)
                        }

                        if statement.id != appState.statements.last?.id {
                            Divider().padding(.horizontal)
                        }
                    }
                }
            }
        }
    }

    private func budgetMetricRow(title: String, value: Double, progress: Double, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(title)
                    .font(.subheadline)
                Spacer()
                Text(String(format: "$%.2f", value))
                    .font(.subheadline)
                    .monospacedDigit()
                    .foregroundStyle(value < 0 ? Palette.dangerRed : .primary)
            }
            ProgressView(value: max(min(progress, 1), 0))
                .tint(color)
        }
    }

    private func sectionCard<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
                .padding(.horizontal)
                .padding(.bottom, 8)
            content()
        }
        .padding(.vertical, 12)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
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
        forecast: SpendingForecast?
    ) -> some View {
        let yDomain = spendingChartDomain(months: months, forecast: forecast)
        let axisMonths = xAxisMonthLabels(months: months, forecast: forecast)
        let forecastStartMonth = forecast?.points.first?.month

        return VStack(alignment: HorizontalAlignment.leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 10) {
                Text("Spending Forecast")
                    .font(.headline)

                if let forecast {
                    Text(
                        "Next month expected: \(forecast.summary.expectedNextMonth, format: .currency(code: currencyCode))"
                    )
                    .font(.subheadline.weight(.semibold))

                    HStack(spacing: 8) {
                        if let nextMonthDeltaText {
                            insightChip(
                                title: "Delta",
                                value: nextMonthDeltaText,
                                tone: .blue
                            )
                        }

                        insightChip(
                            title: "Confidence Range",
                            value: "\(formattedCurrency(forecast.summary.rangeLow)) - \(formattedCurrency(forecast.summary.rangeHigh))",
                            tone: .green
                        )
                    }

                    if let topSpendingDriverText {
                        Text(topSpendingDriverText)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                } else {
                    Text("Add at least 3 months of reports to generate a forecast.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Chart {
                ForEach(months) { month in
                    LineMark(
                        x: .value("Month", month.month),
                        y: .value("Actual", month.total)
                    )
                    .foregroundStyle(Palette.appleBlue)
                    .lineStyle(StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))
                    .interpolationMethod(.catmullRom)

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
                    .interpolationMethod(.catmullRom)
                }

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
                        .interpolationMethod(.catmullRom)
                    }
                }

                if let forecastStartMonth {
                    RuleMark(x: .value("Forecast Starts", forecastStartMonth))
                        .foregroundStyle(Color.white.opacity(0.22))
                        .lineStyle(StrokeStyle(lineWidth: 1, dash: [3, 5]))
                        .annotation(position: .top, alignment: .trailing) {
                            Text("Forecast")
                                .font(.caption2.weight(.semibold))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Color.white.opacity(0.08), in: Capsule())
                        }
                }

                if let income = appState.financeData?.budget?.totalMonthlyIncome, income > 0 {
                    ForEach(Array(activeScenarios), id: \.self) { scenario in
                        let adjusted = scenario.adjustedIncome(income)
                        RuleMark(y: .value("Scenario", adjusted))
                            .foregroundStyle(scenario.color.opacity(0.7))
                            .lineStyle(StrokeStyle(lineWidth: 1.2, dash: [6, 4]))
                            .annotation(position: .top, alignment: .trailing) {
                                Text(scenario.label)
                                    .font(.caption2.weight(.semibold))
                                    .foregroundStyle(scenario.color)
                            }
                    }
                }

                if let selectedSpendingMonth {
                    RuleMark(x: .value("Selected Month", selectedSpendingMonth))
                        .foregroundStyle(Color.white.opacity(0.35))
                        .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4]))
                }
            }
            .frame(height: 220)
            .animation(.easeOut(duration: 0.12), value: selectedSpendingMonth)
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
                    .background(Color.white.opacity(0.03))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .chartOverlay { proxy in
                spendingChartOverlay(proxy: proxy)
            }
        }
        .padding(14)
        .background(Color.white.opacity(0.04), in: RoundedRectangle(cornerRadius: 16))
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
                        .onContinuousHover { phase in
                            switch phase {
                            case .active(let location):
                                updateHoverSelection(
                                    at: location,
                                    proxy: proxy,
                                    plotFrame: frame
                                )
                            case .ended:
                                clearSpendingSelection()
                            }
                        }
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
                updateHoverSelection(
                    at: value.location,
                    proxy: proxy,
                    plotFrame: plotFrame
                )
            }
    }

    private func updateHoverSelection(
        at location: CGPoint,
        proxy: ChartProxy,
        plotFrame: CGRect
    ) {
        let xPosition = location.x - plotFrame.origin.x

        guard xPosition >= 0,
              xPosition <= plotFrame.width,
              let month: String = proxy.value(atX: xPosition)
        else { return }

        updateSelectedSpendingMonth(month)
        selectedSpendingX = plotFrame.origin.x + xPosition
    }

    private func updateSelectedSpendingMonth(_ month: String) {
        guard selectedSpendingMonth != month else { return }
        selectedSpendingMonth = month
    }

    private func clearSpendingSelection() {
        selectedSpendingMonth = nil
        selectedSpendingX = nil
    }

    private func spendingTooltip(month: String, value: Double) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(month)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.white.opacity(0.72))

            if let actual = selectedActualSpendingMonth, actual.month == month {
                Text("Actual: \(actual.total, format: .currency(code: currencyCode))")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.white)
            }

            if let forecastPoint = selectedForecastPoint, forecastPoint.month == month {
                Text("Forecast: \(forecastPoint.median, format: .currency(code: currencyCode))")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.white)
                Text("Range: \(forecastPoint.low, format: .currency(code: currencyCode)) - \(forecastPoint.high, format: .currency(code: currencyCode))")
                    .font(.caption2)
                    .foregroundStyle(.white.opacity(0.78))
            } else if selectedActualSpendingMonth == nil {
                Text(value, format: .currency(code: currencyCode))
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.white)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
        .overlay {
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.white.opacity(0.08), lineWidth: 1)
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
                            .foregroundStyle(isActive ? Color.black : .white.opacity(0.86))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(
                                Capsule()
                                    .fill(isActive ? scenario.color : Color.white.opacity(0.08))
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func stackedCategoryChart(months: [FinanceData.SpendingMonth]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
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
                        .background(Color.white.opacity(0.03))
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
        .background(Color.white.opacity(0.04), in: RoundedRectangle(cornerRadius: 16))
    }

    private func debtMonthsToPayoff(_ item: FinanceData.DebtItem) -> Double {
        guard item.balance > 0 else { return 0 }
        let payment = item.minPayment
        guard payment > 0 else { return Double.infinity }
        if item.balance <= payment { return 0 }
        let monthlyRate = item.rate / 100.0 / 12.0
        if monthlyRate <= 0 { return item.balance / payment }
        let ratio = item.balance * monthlyRate / payment
        if ratio >= 1.0 { return Double.infinity }
        return -log(1.0 - ratio) / log(1.0 + monthlyRate)
    }

    private func debtPayoffLabel(_ months: Double) -> String {
        if months.isInfinite { return "n/a" }
        if months < 0.1 { return "now" }
        let days = months * 30.44
        if days < 30 { return "\(Int(round(days)))d" }
        return "~\(Int(round(months)))mo"
    }

    private func debtPayoffProjection(debt: [FinanceData.DebtItem], surplus: Double) -> some View {
        let sorted = debt.sorted { $0.balance < $1.balance }
        var projections: [(name: String, balance: Double, months: Double, cumulative: Double)] = []
        var cumulative: Double = 0

        for item in sorted {
            guard item.balance > 0 else { continue }
            let months = debtMonthsToPayoff(item)
            cumulative += months.isFinite ? months : 0
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
                    Text(debtPayoffLabel(proj.months))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    ProgressView(value: 1.0)
                        .tint(Palette.successGreen)
                }
            }

            if let last = projections.last {
                Text("Debt-free in \(debtPayoffLabel(last.cumulative))")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Palette.successGreen)
            }
        }
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

    private func formattedCurrency(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currencyCode
        formatter.maximumFractionDigits = 2
        formatter.minimumFractionDigits = 2
        return formatter.string(from: NSNumber(value: value)) ?? String(format: "$%.2f", value)
    }

    private func shortMonthLabel(_ label: String) -> String {
        let parts = label.split(separator: " ")
        guard let first = parts.first else { return label }
        return String(first.prefix(3))
    }

    private func insightChip(title: String, value: String, tone: InsightTone) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title.uppercased())
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.secondary)
            Text(value)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.white)
                .lineLimit(2)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(tone.background, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
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

    private enum InsightTone {
        case blue
        case green

        var background: Color {
            switch self {
            case .blue:
                return Palette.linkBlue.opacity(0.16)
            case .green:
                return Palette.successGreen.opacity(0.14)
            }
        }
    }
}

// MARK: - Debt Editor Sheet

private struct DebtEditorSheet: View {
    @Binding var items: [FinanceData.DebtItem]
    let onSave: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Button("Cancel") { dismiss() }
                Spacer()
                Text("Edit Debt").font(.headline)
                Spacer()
                Button("Save") {
                    onSave()
                    dismiss()
                }
                .bold()
            }
            .padding()

            Divider()

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
                                .multilineTextAlignment(.trailing)
                        }
                        HStack {
                            Text("Min Payment")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            TextField("0", value: $item.minPayment, format: .number)
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
        }
        .frame(minWidth: 400, minHeight: 400)
    }
}

// MARK: - Goal Editor Sheet

private struct GoalEditorSheet: View {
    @Binding var items: [FinanceData.Goal]
    let onSave: () -> Void
    @Environment(\.dismiss) private var dismiss

    private let priorities = ["low", "medium", "high"]

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Button("Cancel") { dismiss() }
                Spacer()
                Text("Edit Goals").font(.headline)
                Spacer()
                Button("Save") {
                    onSave()
                    dismiss()
                }
                .bold()
            }
            .padding()

            Divider()

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
                                .multilineTextAlignment(.trailing)
                        }
                        HStack {
                            Text("Saved")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            TextField("0", value: $item.saved, format: .number)
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
        }
        .frame(minWidth: 400, minHeight: 400)
    }
}
