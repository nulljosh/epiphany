import SwiftUI

struct ContentView: View {
    var body: some View {
        TabView {
            PortfolioGlance()
            MarketView()
            WatchlistView()
        }
        .tabViewStyle(.verticalPage)
    }
}
