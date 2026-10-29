import SwiftUI

@main
struct EpiphanyApp: App {
    @State private var appState = AppState()
    @AppStorage("app_theme") private var rawTheme = "system"
    @State private var showSplash = true
    @AppStorage("epiphany_menu_bar_ticker") private var showMenuBar = true

    var body: some Scene {
        WindowGroup(id: "main") {
            Group {
                if showSplash {
                    SplashView()
                        .transition(.opacity)
                } else {
                    ContentView()
                        .environment(appState)
                        .onboarding(key: "epiphany",
                                    signedIn: appState.user != nil,
                                    slides: epiphanyOnboardingSlides)
                }
            }
            .preferredColorScheme(rawTheme == "dark" ? .dark : rawTheme == "light" ? .light : nil)
            .task {
                let started = ContinuousClock.now
                // Restore the session behind the splash so the sign-in sheet never flashes.
                await appState.restoreAuthentication()
                appState.error = nil
                try? await Task.sleep(until: started + .seconds(2.2))
                withAnimation(.easeOut(duration: 0.6)) { showSplash = false }
            }
        }
        .windowStyle(.titleBar)
        .windowToolbarStyle(.unified)
        .defaultSize(width: 1200, height: 800)

        MenuBarExtra(isInserted: $showMenuBar) {
            MenuBarTicker(appState: appState)
        } label: {
            MenuBarTickerLabel(appState: appState)
        }
        .menuBarExtraStyle(.window)
    }
}
