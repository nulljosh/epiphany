import SwiftUI

/// A short tour shown once, right after a new account signs up. Shared by iOS and macOS.
let epiphanyOnboardingSlides = [
    OnboardingSlide(symbol: "map",
                    title: "Map",
                    body: "See what's around you: places, flights, incidents and weather alerts. Tap a pin for details."),
    OnboardingSlide(symbol: "chart.line.uptrend.xyaxis",
                    title: "Markets",
                    body: "Tap any row for its chart. Tap the star to keep it on your watchlist. Pull up Business News from the bottom."),
    OnboardingSlide(symbol: "calendar.badge.plus",
                    title: "Earnings",
                    body: "When a stock reports in the next two weeks, its page shows the date. One tap adds it to your Calendar."),
    OnboardingSlide(symbol: "briefcase",
                    title: "Portfolio",
                    body: "Drop in a bank statement PDF to see your spending, budget and net worth on one page."),
]
