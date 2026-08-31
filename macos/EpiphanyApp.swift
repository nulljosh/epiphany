import SwiftUI

@main
struct EpiphanyApp: App {
    @State private var appState = AppState()
    @AppStorage("app_theme") private var rawTheme = "system"

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(appState)
                .preferredColorScheme(rawTheme == "dark" ? .dark : rawTheme == "light" ? .light : nil)
                .task {
                    await appState.restoreAuthentication()
                    appState.error = nil
                }
                .shareApp("https://epiphany.heyitsmejosh.com")
        }
        .windowStyle(.titleBar)
        .windowToolbarStyle(.unified)
        .defaultSize(width: 1200, height: 800)
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
