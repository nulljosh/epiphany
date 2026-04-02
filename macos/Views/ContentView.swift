import SwiftUI

struct ContentView: View {
    @Environment(AppState.self) private var appState
    @State private var selectedSection: AppSection = .situation
    @State private var tickerSelectedStock: Stock?

    enum AppSection: String, CaseIterable, Identifiable {
        case situation = "Map"
        case markets = "Markets"
        case portfolio = "Portfolio"
        case settings = "Settings"
        case people = "People"

        var id: String { rawValue }

        var icon: String {
            switch self {
            case .situation: return "map"
            case .markets: return "chart.line.uptrend.xyaxis"
            case .portfolio: return "briefcase"
            case .settings: return "gearshape"
            case .people: return "person.2"
            }
        }
    }

    var body: some View {
        @Bindable var appState = appState

        ZStack {
            VStack(spacing: 0) {
                if selectedSection == .markets {
                    TickerBarView(appState: appState) { stock in
                        tickerSelectedStock = stock
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.horizontal, 20)
                    .padding(.top, 10)
                    .padding(.bottom, 4)
                }

                detailView
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            BottomTabBar(selectedSection: $selectedSection)
                .padding(.horizontal, 24)
                .padding(.top, 8)
                .padding(.bottom, 12)
                .frame(maxWidth: .infinity)
        }
        .navigationTitle(selectedSection.rawValue)
        .sheet(item: $tickerSelectedStock) { stock in
            StockDetailView(stock: stock)
                .environment(appState)
                .frame(minWidth: 500, minHeight: 400)
        }
        .overlay(alignment: .top) {
            if let error = appState.error, !error.isEmpty {
                SharedErrorBanner(message: error) {
                    appState.error = nil
                }
                .padding(.top, 8)
            }
        }
        .sheet(isPresented: $appState.showLogin) {
            LoginSheet()
                .environment(appState)
                .frame(minWidth: 400, minHeight: 400)
        }
    }

    @ViewBuilder
    private var detailView: some View {
        switch selectedSection {
        case .situation:
            SituationView()
        case .markets:
            MarketsView()
        case .portfolio:
            PortfolioView()
        case .settings:
            SettingsView()
        case .people:
            PeopleView()
        }
    }
}

private struct BottomTabBar: View {
    @Binding var selectedSection: ContentView.AppSection

    var body: some View {
        HStack(spacing: 2) {
            ForEach(ContentView.AppSection.allCases) { section in
                tabCell(for: section)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 8)
        .frame(maxWidth: 760)
        .frame(height: 64)
        .background(
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .fill(.ultraThinMaterial)
                .allowsHitTesting(false)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .fill(Color.white.opacity(0.04))
                .allowsHitTesting(false)
                .overlay(
                    RoundedRectangle(cornerRadius: 22, style: .continuous)
                        .stroke(Color.white.opacity(0.12), lineWidth: 1)
                        .allowsHitTesting(false)
                )
        )
    }

    private func isSelected(_ section: ContentView.AppSection) -> Bool {
        selectedSection == section
    }

    private func tabCell(for section: ContentView.AppSection) -> some View {
        let selected = isSelected(section)

        return VStack(spacing: 3) {
            Image(systemName: section.icon)
                .font(.system(size: 14, weight: .semibold))
            Text(section.rawValue)
                .font(.system(size: 10, weight: .semibold))
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, minHeight: 44)
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .foregroundStyle(selected ? .white : Color.white.opacity(0.64))
        .background(tabBackground(selected: selected))
        .overlay(tabBorder(selected: selected))
        .background(shortcutBridge(for: section))
        .contentShape(Rectangle())
        .onTapGesture {
            selectedSection = section
        }
    }

    @ViewBuilder
    private func shortcutBridge(for section: ContentView.AppSection) -> some View {
        Button("") {
            selectedSection = section
        }
        .keyboardShortcut(section.shortcutKey, modifiers: [.command])
        .labelsHidden()
        .opacity(0.001)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private func tabBackground(selected: Bool) -> some View {
        RoundedRectangle(cornerRadius: 14, style: .continuous)
            .fill(selected ? AnyShapeStyle(selectedGradient) : AnyShapeStyle(Color.clear))
    }

    private func tabBorder(selected: Bool) -> some View {
        RoundedRectangle(cornerRadius: 14, style: .continuous)
            .stroke(Color.white.opacity(selected ? 0.14 : 0), lineWidth: 1)
    }

    private var selectedGradient: LinearGradient {
        LinearGradient(
            colors: [Color.white.opacity(0.14), Color.white.opacity(0.08)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }
}

private extension ContentView.AppSection {
    var shortcutKey: KeyEquivalent {
        switch self {
        case .situation: return "1"
        case .markets: return "2"
        case .portfolio: return "3"
        case .settings: return "4"
        case .people: return "5"
        }
    }
}

private struct SharedErrorBanner: View {
    let message: String
    let onDismiss: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(Palette.dangerRed)
            Text(message)
                .font(.caption)
                .lineLimit(2)
            Spacer(minLength: 8)
            Button("Dismiss", action: onDismiss)
                .font(.caption.weight(.semibold))
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(.ultraThinMaterial, in: Capsule())
        .padding(.horizontal)
    }
}
