import SwiftUI

/// The three screens a first-time, signed-out visitor sees. Shared by iOS and macOS.
let epiphanyOnboardingSlides = [
    OnboardingSlide(symbol: "wallet.bifold",
                    title: "Your money, one page",
                    body: "Epiphany pulls your accounts, holdings and spending into a single dashboard you can read in a glance."),
    OnboardingSlide(symbol: "chart.line.uptrend.xyaxis",
                    title: "Watch it move",
                    body: "Charts for net worth, allocation and performance update as your positions do. No spreadsheet upkeep."),
    OnboardingSlide(symbol: "bell.badge",
                    title: "Know before it stings",
                    body: "Set alerts on prices, balances and budgets so the number finds you instead of the other way round."),
]
