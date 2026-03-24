import Charts
import SwiftUI
import UIKit

struct SimulatorView: View {
    @State private var simulator = TradingSimulator()
    @State private var chartPoints: [BalancePoint] = [BalancePoint(trade: 0, balance: 1.0)]
    @State private var lastChartUpdate: Date = .distantPast
    @State private var confettiParticles: [ConfettiParticle] = []
    @State private var showWinOverlay = false
    @State private var achievementToast: Achievement?
    @State private var toastTask: Task<Void, Never>?

    private let chartUpdateInterval: TimeInterval = 0.4
    private let achievements = AchievementManager.shared
    private let leaderboard = SimulatorLeaderboard.shared

    var body: some View {
        NavigationStack {
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
            .navigationTitle("Simulator")
            .background(Palette.bg.ignoresSafeArea())
            .overlay { winOverlay }
            .overlay(alignment: .top) { achievementToastView }
            .onDisappear { simulator.stop() }
            .background(ShakeDetector { handleShake() })
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
        }
    }

    // MARK: - Cards

    private var balanceHeader: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Balance")
                .font(.caption)
                .foregroundStyle(.secondary)

            Text(balanceText)
                .font(.system(size: 42, weight: .bold, design: .rounded))
                .monospacedDigit()
                .foregroundStyle(balanceColor)
                .contentTransition(.numericText())
                .animation(.default, value: balanceText)

            Text("Tick \(simulator.tick)")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .background(Self.cardBackground)
    }

    private var statsRow: some View {
        VStack(spacing: 12) {
            HStack(spacing: 12) {
                statCard(title: "Trades", value: "\(simulator.trades)")
                statCard(title: "Win Rate", value: winRateText)
                statCard(title: "W/L", value: "\(simulator.wins)/\(simulator.losses)")
            }
            HStack(spacing: 12) {
                statCard(title: "Sharpe", value: String(format: "%.2f", simulator.sharpeRatio))
                statCard(title: "Max DD", value: String(format: "%.1f%%", simulator.maxDrawdown * 100))
                statCard(title: "Streak", value: "\(simulator.winStreak)")
            }
        }
    }

    private var balanceChartCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Equity Curve")
                .font(.headline)

            Chart(chartPoints) { point in
                LineMark(
                    x: .value("Trade", point.trade),
                    y: .value("Balance", point.balance)
                )
                .interpolationMethod(.catmullRom)
                .foregroundStyle(Palette.overlay)

                AreaMark(
                    x: .value("Trade", point.trade),
                    y: .value("Balance", point.balance)
                )
                .interpolationMethod(.catmullRom)
                .foregroundStyle(
                    LinearGradient(
                        colors: [Palette.overlay.opacity(0.24), Palette.overlay.opacity(0.02)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
            }
            .frame(height: 220)
            .chartXAxis {
                AxisMarks(values: .automatic(desiredCount: 5))
            }
            .chartYAxis {
                AxisMarks(position: .leading)
            }
            .drawingGroup()
        }
        .padding(20)
        .background(Self.cardBackground)
    }

    @ViewBuilder
    private var positionCard: some View {
        if let position = simulator.currentPosition {
            VStack(alignment: .leading, spacing: 12) {
                Text("Current Position")
                    .font(.headline)

                HStack(alignment: .firstTextBaseline) {
                    Text(position.sym)
                        .font(.system(size: 28, weight: .bold, design: .rounded))
                    Spacer()
                    Text(positionDirectionText)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(positionDirectionColor)
                }

                HStack {
                    labelValue(title: "Entry", value: priceText(position.entry))
                    Spacer()
                    labelValue(title: "Stop", value: priceText(position.stop))
                    Spacer()
                    labelValue(title: "Target", value: priceText(position.target))
                }
            }
            .padding(20)
            .background(Self.cardBackground)
            .transition(.scale.combined(with: .opacity))
        }
    }

    private var controlsCard: some View {
        VStack(spacing: 16) {
            HStack(spacing: 12) {
                Button(simulator.hasWon ? "You Win!" : (simulator.isRunning ? "Stop" : "Start")) {
                    guard !simulator.hasWon else { return }
                    Haptics.impact(.medium)
                    if simulator.isRunning {
                        simulator.stop()
                        saveToLeaderboard()
                    } else {
                        simulator.start()
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(
                    simulator.hasWon ? Color.yellow.opacity(0.3) :
                    simulator.isRunning ? Color.red.opacity(0.22) : Color.green.opacity(0.22)
                )
                .foregroundStyle(Palette.text)
                .clipShape(RoundedRectangle(cornerRadius: 14))

                Button("Reset") {
                    Haptics.impact(.light)
                    resetSimulator()
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Palette.overlay.opacity(0.08))
                .foregroundStyle(Palette.text)
                .clipShape(RoundedRectangle(cornerRadius: 14))
            }
        }
        .padding(20)
        .background(Self.cardBackground)
    }

    // MARK: - Achievements

    private var achievementsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Achievements")
                .font(.headline)

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 5), spacing: 12) {
                ForEach(achievements.achievements) { achievement in
                    VStack(spacing: 4) {
                        Image(systemName: achievement.icon)
                            .font(.title2)
                            .foregroundStyle(achievement.isUnlocked ? .yellow : Palette.overlay.opacity(0.2))
                        Text(achievement.title)
                            .font(.system(size: 8))
                            .foregroundStyle(achievement.isUnlocked ? .primary : .secondary)
                            .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
        }
        .padding(20)
        .background(Self.cardBackground)
    }

    // MARK: - Leaderboard

    @ViewBuilder
    private var leaderboardCard: some View {
        if !leaderboard.entries.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                Text("Best Runs")
                    .font(.headline)

                ForEach(Array(leaderboard.entries.enumerated()), id: \.element.id) { index, entry in
                    HStack(spacing: 12) {
                        Text("#\(index + 1)")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(.yellow)
                            .frame(width: 24)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(CurrencyFormatter.formatAbbreviated(entry.finalBalance))
                                .font(.subheadline.weight(.semibold))
                                .monospacedDigit()
                            Text("\(entry.trades) trades | \(String(format: "%.0f%%", entry.winRate * 100)) WR")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }

                        Spacer()

                        Text(entry.date, style: .date)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                }
            }
            .padding(20)
            .background(Self.cardBackground)
        }
    }

    // MARK: - Achievement Toast

    @ViewBuilder
    private var achievementToastView: some View {
        if let toast = achievementToast {
            HStack(spacing: 10) {
                Image(systemName: toast.icon)
                    .font(.title3)
                    .foregroundStyle(.yellow)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Achievement Unlocked")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    Text(toast.title)
                        .font(.subheadline.weight(.bold))
                }
                Spacer()
            }
            .padding(14)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14))
            .padding(.horizontal)
            .padding(.top, 8)
            .transition(.move(edge: .top).combined(with: .opacity))
        }
    }

    // MARK: - Win Overlay

    @ViewBuilder
    private var winOverlay: some View {
        if showWinOverlay {
            ZStack {
                Color.black.opacity(0.6)
                    .ignoresSafeArea()
                    .onTapGesture {
                        withAnimation { showWinOverlay = false }
                    }

                VStack(spacing: 16) {
                    Text("YOU WIN!")
                        .font(.system(size: 56, weight: .black, design: .rounded))
                        .foregroundStyle(.yellow)

                    Text(balanceText)
                        .font(.system(size: 32, weight: .bold, design: .rounded))
                        .foregroundStyle(.green)

                    Text("\(simulator.trades) trades | \(winRateText) win rate")
                        .font(.headline)
                        .foregroundStyle(.white.opacity(0.7))

                    Button("Play Again") {
                        Haptics.impact(.medium)
                        resetSimulator()
                        simulator.start()
                    }
                    .padding(.horizontal, 32)
                    .padding(.vertical, 14)
                    .background(Color.green.opacity(0.3))
                    .foregroundStyle(.white)
                    .clipShape(Capsule())
                    .padding(.top, 8)
                }

                TimelineView(.animation) { timeline in
                    Canvas { context, size in
                        let now = timeline.date.timeIntervalSinceReferenceDate
                        for particle in confettiParticles {
                            let elapsed = now - particle.startTime
                            let x = particle.x * size.width + sin(elapsed * particle.wobbleSpeed) * 30
                            let y = particle.y * size.height + elapsed * particle.fallSpeed * size.height * 0.15
                            guard y < size.height + 20 else { continue }
                            let rotation = Angle.degrees(elapsed * particle.rotationSpeed)
                            context.opacity = max(0, 1 - elapsed / 5)
                            context.translateBy(x: x, y: y)
                            context.rotate(by: rotation)
                            let rect = CGRect(x: -4, y: -6, width: 8, height: 12)
                            context.fill(Path(rect), with: .color(particle.color))
                            context.rotate(by: -rotation)
                            context.translateBy(x: -x, y: -y)
                        }
                    }
                    .allowsHitTesting(false)
                    .ignoresSafeArea()
                }
            }
            .transition(.opacity)
        }
    }

    // MARK: - Helpers

    private func statCard(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.system(size: 22, weight: .semibold, design: .rounded))
                .monospacedDigit()
                .contentTransition(.numericText())
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Self.cardBackground)
    }

    private func labelValue(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.subheadline.weight(.semibold))
                .monospacedDigit()
        }
    }

    private var balanceText: String {
        CurrencyFormatter.formatAbbreviated(simulator.balance)
    }

    private var balanceColor: Color {
        if simulator.hasWon { return .yellow }
        if simulator.balance > 1.0 { return .green }
        if simulator.balance < 1.0 { return .red }
        return .white
    }

    private var winRateText: String {
        String(format: "%.0f%%", simulator.winRate * 100)
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
            chartPoints = (0..<maxPoints).map { i in
                let idx = min(Int(Double(i) * step), history.count - 1)
                return BalancePoint(trade: idx, balance: history[idx])
            }
        }
    }

    private func handleTradeComplete() {
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
        let now = Date().timeIntervalSinceReferenceDate
        let colors: [Color] = [.red, .green, .blue, .yellow, .orange, .pink, .purple, .cyan, .mint]
        confettiParticles = (0..<80).map { _ in
            ConfettiParticle(
                x: Double.random(in: 0...1),
                y: Double.random(in: -0.3...0),
                color: colors.randomElement() ?? .white,
                fallSpeed: Double.random(in: 0.3...0.8),
                wobbleSpeed: Double.random(in: 1...4),
                rotationSpeed: Double.random(in: 30...200),
                startTime: now + Double.random(in: 0...0.5)
            )
        }
        withAnimation(.spring(duration: 0.5)) { showWinOverlay = true }
    }

    private func handleShake() {
        guard !simulator.hasWon else { return }
        resetSimulator()
    }

    private func saveToLeaderboard() {
        leaderboard.record(
            balance: simulator.balance,
            trades: simulator.trades,
            winRate: simulator.winRate,
            sharpe: simulator.sharpeRatio,
            maxDrawdown: simulator.maxDrawdown
        )
    }

    private var positionDirectionText: String {
        guard let pnl = simulator.currentPnLPercent() else { return "Flat" }
        if pnl > 0 { return String(format: "Up %.2f%%", pnl * 100) }
        if pnl < 0 { return String(format: "Down %.2f%%", abs(pnl) * 100) }
        return "Flat"
    }

    private var positionDirectionColor: Color {
        guard let pnl = simulator.currentPnLPercent() else { return .secondary }
        if pnl > 0 { return .green }
        if pnl < 0 { return .red }
        return .secondary
    }

    private static let cardBackground = Palette.overlay.opacity(0.04)

    private func resetSimulator() {
        toastTask?.cancel()
        achievementToast = nil
        achievements.pendingUnlocks.removeAll()
        withAnimation { showWinOverlay = false }
        confettiParticles = []
        simulator.reset()
        chartPoints = [BalancePoint(trade: 0, balance: 1.0)]
    }

    private func priceText(_ value: Double) -> String {
        String(format: "$%.2f", value)
    }
}

// MARK: - Shake Detector

private struct ShakeDetector: UIViewRepresentable {
    let onShake: () -> Void

    func makeUIView(context: Context) -> ShakeDetectingView {
        let view = ShakeDetectingView()
        view.onShake = onShake
        return view
    }

    func updateUIView(_ uiView: ShakeDetectingView, context: Context) {
        uiView.onShake = onShake
    }
}

private final class ShakeDetectingView: UIView {
    var onShake: (() -> Void)?

    override var canBecomeFirstResponder: Bool { true }

    override func didMoveToWindow() {
        super.didMoveToWindow()
        becomeFirstResponder()
    }

    override func motionEnded(_ motion: UIEvent.EventSubtype, with event: UIEvent?) {
        if motion == .motionShake {
            onShake?()
        }
    }
}

// MARK: - Models

private struct BalancePoint: Identifiable {
    let trade: Int
    let balance: Double
    var id: Int { trade }
}

private struct ConfettiParticle {
    let x: Double
    let y: Double
    let color: Color
    let fallSpeed: Double
    let wobbleSpeed: Double
    let rotationSpeed: Double
    let startTime: TimeInterval
}

#Preview {
    SimulatorView()
}
