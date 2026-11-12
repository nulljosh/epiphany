import SwiftUI

/// The welcome screen rows, shown once right after a new account signs up. Shared by iOS and macOS.
let epiphanyOnboardingSlides = [
    OnboardingSlide(symbol: "map",
                    title: "Map",
                    body: "Places, flights, incidents and weather alerts near you."),
    OnboardingSlide(symbol: "chart.line.uptrend.xyaxis",
                    title: "Markets",
                    body: "Quotes, charts, news and earnings dates."),
    OnboardingSlide(symbol: "briefcase",
                    title: "Portfolio",
                    body: "Drop in a bank statement to see spending and net worth."),
]

#Preview {
    OnboardingView(slides: epiphanyOnboardingSlides, finishLabel: "Continue") {}
}
