import Foundation

struct LeaderboardEntry: Identifiable, Codable {
    let id: UUID
    let date: Date
    let finalBalance: Double
    let trades: Int
    let winRate: Double
    let sharpe: Double
    let maxDrawdown: Double
}

@MainActor
final class SimulatorLeaderboard {
    static let shared = SimulatorLeaderboard()

    private let key = "simulator.leaderboard"
    private let maxEntries = 5

    private(set) var entries: [LeaderboardEntry] = []

    private init() {
        load()
    }

    func record(balance: Double, trades: Int, winRate: Double, sharpe: Double, maxDrawdown: Double) {
        guard trades >= 10 else { return }

        let entry = LeaderboardEntry(
            id: UUID(),
            date: Date(),
            finalBalance: balance,
            trades: trades,
            winRate: winRate,
            sharpe: sharpe,
            maxDrawdown: maxDrawdown
        )

        entries.append(entry)
        entries.sort { $0.finalBalance > $1.finalBalance }
        if entries.count > maxEntries {
            entries = Array(entries.prefix(maxEntries))
        }
        save()
    }

    func clear() {
        entries = []
        save()
    }

    private func load() {
        guard let data = UserDefaults.standard.data(forKey: key),
              let saved = try? JSONDecoder().decode([LeaderboardEntry].self, from: data)
        else { return }
        entries = saved
    }

    private func save() {
        guard let data = try? JSONEncoder().encode(entries) else { return }
        UserDefaults.standard.set(data, forKey: key)
    }
}
