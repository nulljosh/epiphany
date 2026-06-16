import SwiftUI

@main
struct EpiphanyApp: App {
    @State private var appState = AppState()
    @State private var showSplash = true
    @State private var hasStartedLaunchFlow = false

    var body: some Scene {
        WindowGroup {
            Group {
                if showSplash {
                    SplashView()
                        .transition(.opacity)
                } else {
                    ContentView()
                        .environment(appState)
                }
            }
            .task {
                guard !hasStartedLaunchFlow else { return }
                hasStartedLaunchFlow = true

                // Restore auth DURING splash so login sheet never flashes.
                await appState.restoreAuthentication()
                #if DEBUG
                appState.autoLoginIfNeeded()
                #endif
                appState.error = nil

                withAnimation(.easeOut(duration: 0.6)) {
                    showSplash = false
                }
            }
        }
    }
}
