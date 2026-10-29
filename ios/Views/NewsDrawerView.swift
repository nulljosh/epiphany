import SwiftUI

struct NewsDrawerView: View {
    @Binding var articles: [NewsArticle]
    @Binding var isLoading: Bool
    // ponytail: at peek height the drawer is clipped to 84pt, so a centered
    // spinner reads as a stray circle poking out. Only show it once open.
    var isExpanded: Bool = true
    var brief: DailyBrief? = nil
    @State private var selectedNewsURL: URL?

    private var sourceCount: Int {
        Set(articles.map(\.source)).count
    }

    var body: some View {
        VStack(spacing: 0) {
            Capsule()
                .fill(.secondary.opacity(0.4))
                .frame(width: 36, height: 5)
                .padding(.top, 8)
                .padding(.bottom, 4)

            VStack(alignment: .leading, spacing: 2) {
                Text("Business News")
                    .font(.title2.weight(.bold))
                if sourceCount > 0 {
                    Text("From \(sourceCount) source\(sourceCount == 1 ? "" : "s")")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 20)
            .padding(.top, 4)
            .padding(.bottom, 12)

            Divider()
                .padding(.horizontal, 20)

            if isLoading {
                if isExpanded {
                    ProgressView()
                }
            } else if articles.isEmpty {
                ContentUnavailableView(
                    "No News",
                    systemImage: "newspaper",
                    description: Text("Markets news unavailable right now.")
                )
            } else {
                List {
                    ForEach(articles.prefix(20)) { article in
                        Button {
                            guard let url = URL(string: article.url) else { return }
                            selectedNewsURL = url
                        } label: {
                            HStack(alignment: .top, spacing: 10) {
                                VStack(alignment: .leading, spacing: 8) {
                                    Text(article.title)
                                        .font(.headline)
                                        .foregroundStyle(.primary)
                                    HStack(spacing: 8) {
                                        Text(article.source)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                        Spacer()
                                        Text(article.publishedRelative)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)

                                Group {
                                    if let imageUrl = article.thumbnailURL {
                                        CachedAsyncImage(url: imageUrl) { image in
                                            if let image {
                                                image.resizable().aspectRatio(contentMode: .fill)
                                            } else {
                                                newsPlaceholder
                                            }
                                        }
                                    } else {
                                        newsPlaceholder
                                    }
                                }
                                .frame(width: 60, height: 60)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                        }
                        .buttonStyle(PlainButtonStyle())
                        .listRowBackground(
                            RoundedRectangle(cornerRadius: 8)
                                .fill(.ultraThinMaterial)
                                .padding(2)
                        )
                    }
                }
            }
        }
        .sheet(item: $selectedNewsURL) { url in
            SafariView(url: url)
                .ignoresSafeArea()
        }
    }

    private var newsPlaceholder: some View {
        ZStack {
            Color.secondary.opacity(0.15)
            Image(systemName: "newspaper")
                .foregroundStyle(.secondary)
        }
    }
}

enum DrawerState: CaseIterable {
    case peek, medium, large
    func height(in totalHeight: CGFloat) -> CGFloat {
        switch self {
        // Handle + title + source line, so the subtitle isn't clipped.
        case .peek: return 84
        case .medium: return totalHeight * 0.45
        // Stops under the inline nav bar; the ticker now sits above it.
        case .large: return totalHeight - 80
        }
    }
}

/// Owns the drag state. It used to live on MarketsView, so every drag frame
/// re-evaluated the whole markets list (filter + sort + 180 rows) and the
/// drawer stuttered. Here only the drawer redraws while the finger moves.
struct NewsDrawerContainer: View {
    @Binding var articles: [NewsArticle]
    @Binding var isLoading: Bool
    var brief: DailyBrief?
    @Binding var drawerState: DrawerState
    // Plain @State (not @GestureState) so we can reset it to 0 *inside* the
    // release animation -- @GestureState resets instantly and pops the height.
    @State private var dragTranslation: CGFloat = 0

    var body: some View {
        GeometryReader { geo in
            let totalHeight = geo.size.height
            let maxHeight = totalHeight - 80
            let target = drawerState.height(in: totalHeight) - dragTranslation
            let peek = DrawerState.peek.height(in: totalHeight)
            let height = MarketsView.rubberBand(target, min: peek, max: maxHeight)
            VStack(spacing: 0) {
                NewsDrawerView(articles: $articles, isLoading: $isLoading, isExpanded: drawerState != .peek, brief: brief)
            }
            .frame(maxWidth: .infinity)
            // Fixed at max height -- the inner List never gets a new size
            // proposal during drag, so it never re-measures/re-lays-out its
            // lazy content.
            .frame(height: maxHeight, alignment: .top)
            .frame(height: height, alignment: .top)
            .clipped()
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16))
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .strokeBorder(.white.opacity(0.12), lineWidth: 0.5)
            )
            // Geometry already stops at the tab bar, so no extra bottom gap:
            // the peek sits flush on the tab bar instead of floating over rows.
            .overlay(alignment: .top) {
                Color.clear
                    .frame(height: 96)
                    .contentShape(Rectangle())
                    .gesture(
                        // Global space: this handle rides on the drawer's top edge, so a
                        // local translation shifts under the finger every frame and the
                        // drag jitters. Measured globally it tracks the finger 1:1.
                        DragGesture(minimumDistance: 0, coordinateSpace: .global)
                            .onChanged { value in
                                var t = SwiftUI.Transaction()
                                t.disablesAnimations = true
                                withTransaction(t) { dragTranslation = value.translation.height }
                            }
                            .onEnded { value in
                                let current = min(max(peek, drawerState.height(in: totalHeight) - value.translation.height), maxHeight)
                                var settled: DrawerState
                                if abs(value.translation.height) < 6 {
                                    // A tap slides it open (or shut) instead of doing nothing.
                                    settled = drawerState == .peek ? .medium : .peek
                                } else {
                                    // Project momentum so a flick settles past the nearest detent.
                                    let predicted = drawerState.height(in: totalHeight)
                                        - value.predictedEndTranslation.height
                                    settled = DrawerState.allCases.min(
                                        by: { abs($0.height(in: totalHeight) - predicted) < abs($1.height(in: totalHeight) - predicted) }
                                    ) ?? .peek
                                }
                                // Hand the finger's speed to the spring so release doesn't
                                // stall or lurch. initialVelocity is in units of the distance left.
                                let distance = settled.height(in: totalHeight) - current
                                let velocity = abs(distance) > 1 ? -value.velocity.height / distance : 0
                                if settled != drawerState { Haptics.impact(.light) }
                                // Reset drag AND snap the detent in one animation so the
                                // height interpolates continuously -- no instant pop.
                                withAnimation(.interpolatingSpring(duration: 0.5, bounce: 0.1, initialVelocity: velocity)) {
                                    drawerState = settled
                                    dragTranslation = 0
                                }
                            }
                    )
            }
            .padding(.horizontal, 8)
            .padding(.bottom, 4)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
        }
    }
}
