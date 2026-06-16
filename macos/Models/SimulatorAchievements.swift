import Foundation

struct Achievement: Identifiable, Codable, Equatable {
    let id: String
    let title: String
    let description: String
    let icon: String
    var unlockedAt: Date?

    var isUnlocked: Bool { unlockedAt != nil }
}

@MainActor
final class AchievementManager {
    static let shared = AchievementManager()

    private let key = "simulator.achievements"

    private(set) var achievements: [Achievement] = []
    var pendingUnlocks: [Achievement] = []

    private static let definitions: [Achievement] = [
        Achievement(id: "100", title: "$100 Club", description: "Reach $100 balance", icon: "dollarsign.circle"),
        Achievement(id: "1k", title: "Thousandaire", description: "Reach $1,000 balance", icon: "banknote"),
        Achievement(id: "1m", title: "Millionaire", description: "Reach $1,000,000 balance", icon: "crown"),
        Achievement(id: "1b", title: "Billionaire", description: "Reach $1,000,000,000 balance", icon: "building.columns"),
        Achievement(id: "10t", title: "Trillionaire", description: "Reach $10T and win the game", icon: "star.fill"),
        Achievement(id: "streak5", title: "Hot Streak", description: "Win 5 trades in a row", icon: "flame"),
        Achievement(id: "streak10", title: "Sharpshooter", description: "Win 10 trades in a row", icon: "scope"),
        Achievement(id: "winrate50", title: "50/50", description: "50%+ win rate after 20 trades", icon: "chart.pie"),
        Achievement(id: "lowdd", title: "Risk Manager", description: "Max drawdown under 10% after 50 trades", icon: "shield.checkered"),
        Achievement(id: "speed1k", title: "Speed Demon", description: "Reach $1K in under 500 trades", icon: "bolt.fill"),
    ]

    private init() {
        load()
    }

    func check(balance: Double, trades: Int, wins: Int, losses: Int, winStreak: Int, maxDrawdown: Double) {
        var changed = false

        let checks: [(String, Bool)] = [
            ("100", balance >= 100),
            ("1k", balance >= 1_000),
            ("1m", balance >= 1_000_000),
            ("1b", balance >= 1_000_000_000),
            ("10t", balance >= 10_000_000_000_000),
            ("streak5", winStreak >= 5),
            ("streak10", winStreak >= 10),
            ("winrate50", trades >= 20 && wins > 0 && Double(wins) / Double(trades) >= 0.5),
            ("lowdd", trades >= 50 && maxDrawdown < 0.10),
            ("speed1k", balance >= 1_000 && trades < 500),
        ]

        for (id, condition) in checks {
            guard condition else { continue }
            guard let idx = achievements.firstIndex(where: { $0.id == id }) else { continue }
            guard achievements[idx].unlockedAt == nil else { continue }
            achievements[idx].unlockedAt = Date()
            pendingUnlocks.append(achievements[idx])
            changed = true
        }

        if changed { save() }
    }

    func reset() {
        achievements = Self.definitions
        pendingUnlocks.removeAll()
        save()
    }

    private func load() {
        if let data = UserDefaults.standard.data(forKey: key),
           let saved = try? JSONDecoder().decode([Achievement].self, from: data) {
            var merged = Self.definitions
            for (i, def) in merged.enumerated() {
                if let match = saved.first(where: { $0.id == def.id }) {
                    merged[i].unlockedAt = match.unlockedAt
                }
            }
            achievements = merged
        } else {
            achievements = Self.definitions
        }
    }

    private func save() {
        guard let data = try? JSONEncoder().encode(achievements) else { return }
        UserDefaults.standard.set(data, forKey: key)
    }
}
