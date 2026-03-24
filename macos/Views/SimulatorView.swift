import Charts
import SwiftUI

struct SimulatorView: View {
    @State private var simulator = TradingSimulator()
    @State private var chartPoints: [BalancePoint] = [BalancePoint(trade: 0, balance: 1.0)]
    @State private var lastChartUpdate: Date = .distantPast
    @State private var showWinOverlay = false
    @State private var achievementToast: Achievement?
    @State private var toastTask: Task<Void, Never>?
    @State private var previousTradeCount = 0

    private let startingBalance = 1.0
    private let chartUpdateInterval: TimeInterval = 0.4
    private let achievements = AchievementManager.shared
    private let leaderboard = SimulatorLeaderboard.shared

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                balanceHeader
                statsRow
                balanceChartCard
                positionCard
                controlsCard
                achievementsCard
                leaderboardCard
            }
            .padding(16)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.black.ignoresSafeArea())
        .overlay { winOverlay }
        .overlay(alignment: .top) { achievementToastView }
        .onDisappear { simulator.stop() }
        .onChange(of: simulator.balanceHistory.count) { _, _ in
            throttleChartUpdate()
        }
        .onChange(of: simulator.trades) { oldVal, newVal in
            guard newVal > oldVal else { return }
            handleTradeComplete()
        }
        .onChange(of: simulator.hasWon) { _, won in
            if won { triggerWinCelebration() }
        }
        .keyboardShortcut("r", modifiers: [.command, .shift])
    }

    // MARK: - Balance Header

    private var balanceHeader: some View {
        VStack(spacing: 4) {
            Text(balanceText)
                .font(.system(size: 48, weight: .bold, design: .rounded))
                .foregroundStyle(balanceColor)
                .contentTransition(.numericText())
            Text("Starting: $1.00")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
    }

    private var balanceText: String {
        CurrencyFormatter.formatAbbreviated(simulator.balance)
    }

    private var balanceColor: Color {
        if simulator.hasWon { return .yellow }
        if simulator.balance > startingBalance { return .green }
        if simulator.balance < startingBalance { return .red }
        return .white
    }

    // MARK: - Stats

    private var statsRow: some View {
        HStack(spacing: 12) {
            statCell("Trades", value: "\(simulator.trades)")
            statCell("Win Rate", value: winRateText)
            statCell("Streak", value: "\(simulator.winStreak)")
            statCell("Drawdown", value: String(format: "%.1f%%", simulator.maxDrawdown * 100))
        }
        .padding(12)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
    }

    private func statCell(_ title: String, value: String) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.headline.monospacedDigit())
                .contentTransition(.numericText())
            Text(title)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }

    private var winRateText: String {
        guard simulator.trades > 0 else { return "0%" }
        return String(format: "%.0f%%", Double(simulator.wins) / Double(simulator.trades) * 100)
    }

    // MARK: - Chart

    private var balanceChartCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Equity Curve")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            Chart(chartPoints) { point in
                LineMark(x: .value("Trade", point.trade), y: .value("Balance", point.balance))
                    .foregroundStyle(balanceColor)
                AreaMark(x: .value("Trade", point.trade), y: .value("Balance", point.balance))
                    .foregroundStyle(balanceColor.opacity(0.1))
            }
            .chartYScale(domain: .automatic(includesZero: false))
            .frame(height: 160)
        }
        .padding(14)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
    }

    // MARK: - Position

    private var positionCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Current Position")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)

            if let pos = simulator.currentPosition {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(pos.sym)
                            .font(.headline)
                        Text(String(format: "Size: $%.2f", pos.size))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 2) {
                        Text(String(format: "$%.4f", pos.entry))
                            .font(.subheadline.monospacedDigit())
                        Text(String(format: "Stop: $%.4f", pos.stop))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            } else {
                Text("No open position")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(14)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
    }

    // MARK: - Controls

    private var controlsCard: some View {
        HStack(spacing: 12) {
            Button(simulator.isRunning ? "Stop" : "Start") {
                if simulator.isRunning {
                    simulator.stop()
                } else {
                    simulator.start()
                    // Sound disabled
                }
            }
            .buttonStyle(.borderedProminent)
            .tint(simulator.isRunning ? .red : .green)

            Picker("Speed", selection: Binding(
                get: { simulator.speed },
                set: { simulator.speed = $0 }
            )) {
                Text("1x").tag(1.0)
                Text("2x").tag(2.0)
                Text("5x").tag(5.0)
                Text("10x").tag(10.0)
            }
            .pickerStyle(.segmented)
            .frame(maxWidth: 200)

            Spacer()

            Button("Reset") {
                resetSimulator()
            }
            .keyboardShortcut("r", modifiers: [.command, .shift])
        }
        .padding(14)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
    }

    // MARK: - Achievements

    private var achievementsCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Achievements")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 140))], spacing: 8) {
                ForEach(achievements.achievements) { achievement in
                    HStack(spacing: 8) {
                        Image(systemName: achievement.icon)
                            .font(.title3)
                            .foregroundStyle(achievement.isUnlocked ? .yellow : .secondary)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(achievement.title)
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(achievement.isUnlocked ? .primary : .secondary)
                            Text(achievement.description)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                    }
                    .padding(8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(achievement.isUnlocked ? Color.yellow.opacity(0.1) : Color.white.opacity(0.03), in: RoundedRectangle(cornerRadius: 8))
                }
            }
        }
        .padding(14)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
    }

    // MARK: - Leaderboard

    private var leaderboardCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Leaderboard")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)

            if leaderboard.entries.isEmpty {
                Text("No runs yet")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(Array(leaderboard.entries.prefix(5).enumerated()), id: \.element.id) { idx, entry in
                    HStack {
                        Text("#\(idx + 1)")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(.secondary)
                            .frame(width: 30, alignment: .leading)
                        Text(CurrencyFormatter.formatAbbreviated(entry.finalBalance))
                            .font(.subheadline.weight(.semibold).monospacedDigit())
                        Spacer()
                        Text("\(entry.trades) trades")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                }
            }
        }
        .padding(14)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
    }

    // MARK: - Win Overlay

    @ViewBuilder
    private var winOverlay: some View {
        if showWinOverlay {
            ZStack {
                Color.black.opacity(0.8).ignoresSafeArea()
                VStack(spacing: 16) {
                    Text("YOU WIN")
                        .font(.system(size: 56, weight: .black, design: .rounded))
                        .foregroundStyle(.yellow)
                    Text(CurrencyFormatter.formatAbbreviated(simulator.balance))
                        .font(.title.weight(.bold).monospacedDigit())
                    Text("From $1.00 in \(simulator.trades) trades")
                        .foregroundStyle(.secondary)
                    Button("Play Again") { resetSimulator() }
                        .buttonStyle(.borderedProminent)
                        .tint(.yellow)
                        .foregroundStyle(.black)
                }
            }
            .transition(.opacity)
        }
    }

    // MARK: - Toast

    @ViewBuilder
    private var achievementToastView: some View {
        if let toast = achievementToast {
            HStack(spacing: 10) {
                Image(systemName: toast.icon)
                    .font(.title3)
                    .foregroundStyle(.yellow)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Achievement Unlocked")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Text(toast.title)
                        .font(.subheadline.weight(.bold))
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(.ultraThinMaterial, in: Capsule())
            .padding(.top, 8)
            .transition(.move(edge: .top).combined(with: .opacity))
        }
    }

    // MARK: - Logic

    private func handleTradeComplete() {
        if simulator.lastTradeWasWin {
            // Sound disabled
        } else {
            // Sound disabled
        }

        achievements.check(
            balance: simulator.balance,
            trades: simulator.trades,
            wins: simulator.wins,
            losses: simulator.losses,
            winStreak: simulator.winStreak,
            maxDrawdown: simulator.maxDrawdown
        )

        if !achievements.pendingUnlocks.isEmpty {
            showNextAchievement()
        }
    }

    private func showNextAchievement() {
        guard !achievements.pendingUnlocks.isEmpty else { return }
        let next = achievements.pendingUnlocks.removeFirst()
        // Sound disabled
        withAnimation(.spring(duration: 0.4)) {
            achievementToast = next
        }
        toastTask?.cancel()
        toastTask = Task { @MainActor in
            try? await Task.sleep(for: .seconds(3))
            guard !Task.isCancelled else { return }
            withAnimation { achievementToast = nil }
            if !achievements.pendingUnlocks.isEmpty {
                try? await Task.sleep(for: .seconds(0.3))
                guard !Task.isCancelled else { return }
                showNextAchievement()
            }
        }
    }

    private func triggerWinCelebration() {
        throttleChartUpdate()
        saveToLeaderboard()
        // Sound disabled
        withAnimation(.spring(duration: 0.6)) {
            showWinOverlay = true
        }
    }

    private func throttleChartUpdate() {
        let now = Date()
        guard now.timeIntervalSince(lastChartUpdate) >= chartUpdateInterval else { return }
        lastChartUpdate = now
        let history = simulator.balanceHistory
        let maxPoints = 200
        if history.count <= maxPoints {
            chartPoints = history.enumerated().map { BalancePoint(trade: $0.offset, balance: $0.element) }
        } else {
            let step = Double(history.count) / Double(maxPoints)
            chartPoints = (0..<maxPoints).map { idx in
                BalancePoint(trade: idx, balance: history[min(Int(Double(idx) * step), history.count - 1)])
            }
        }
    }

    private func saveToLeaderboard() {
        let wr = simulator.trades > 0 ? Double(simulator.wins) / Double(simulator.trades) : 0
        leaderboard.record(balance: simulator.balance, trades: simulator.trades, winRate: wr, sharpe: 0, maxDrawdown: simulator.maxDrawdown)
    }

    private func resetSimulator() {
        toastTask?.cancel()
        achievementToast = nil
        achievements.pendingUnlocks.removeAll()
        withAnimation { showWinOverlay = false }
        simulator.reset()
        chartPoints = [BalancePoint(trade: 0, balance: 1.0)]
    }
}

private struct BalancePoint: Identifiable {
    let id = UUID()
    let trade: Int
    let balance: Double
}
