import SwiftUI

@main
struct EpiphanyApp: App {
    @State private var appState = AppState()
    @State private var showSplash = true
    @State private var hasStartedLaunchFlow = false
    @AppStorage("app_theme") private var rawTheme = "system"

    var body: some Scene {
        WindowGroup {
            Group {
                if showSplash {
                    SplashView()
                        .transition(.opacity)
                } else {
                    ContentView()
                        .environment(appState)
                        .overlay { WhatsNewSheet() }
                }
            }
            .preferredColorScheme(rawTheme == "dark" ? .dark : rawTheme == "light" ? .light : nil)
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
            .shareApp("https://epiphany.heyitsmejosh.com")
        }
    }
}

// MARK: - Share

// ponytail: one overlay rather than a per-screen toolbar button — these root views share no
// navigation container to hang a .toolbar on. Move it into a toolbar per screen if this ever
// covers something that matters.
private struct AppShareOverlay: ViewModifier {
    let link: String

    func body(content: Content) -> some View {
        content.overlay(alignment: .bottomTrailing) {
            if let url = URL(string: link) {
                ShareLink(item: url) {
                    Image(systemName: "square.and.arrow.up")
                        .font(.system(size: 15, weight: .medium))
                        .padding(10)
                        .background(.regularMaterial, in: Circle())
                }
                .buttonStyle(.plain)
                .padding(16)
            }
        }
    }
}

private extension View {
    func shareApp(_ link: String) -> some View { modifier(AppShareOverlay(link: link)) }
}
