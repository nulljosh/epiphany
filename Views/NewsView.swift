import SwiftUI

struct NewsView: View {
    @Environment(AppState.self) private var appState
    @State private var articles: [NewsArticle] = []
    @State private var isLoading = false
    @State private var error: String?
    @State private var hasLoaded = false
    @Environment(\.openURL) private var openURL

    private var cleanArticles: [NewsArticle] {
        articles.filter { article in
            let title = article.title
            // Filter non-Latin script articles (non-English)
            let latinRange = title.rangeOfCharacter(from: .init(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"))
            guard latinRange != nil else { return false }
            // At least 60% Latin characters
            let latinCount = title.unicodeScalars.filter { $0.value < 128 }.count
            let ratio = Double(latinCount) / Double(max(title.count, 1))
            return ratio > 0.6 && title.count > 10
        }
    }

    var body: some View {
        NavigationStack {
            Group {
                if isLoading && articles.isEmpty {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if !isLoading && cleanArticles.isEmpty {
                    ContentUnavailableView(
                        "News Temporarily Unavailable",
                        systemImage: "newspaper",
                        description: Text("Pull to refresh or try again later.")
                    )
                    .refreshable {
                        await loadNews()
                    }
                } else {
                    List {
                        if let errorMessage = error {
                            Text(errorMessage)
                                .font(.caption)
                                .foregroundStyle(Palette.dangerRed)
                                .listRowBackground(
                                    RoundedRectangle(cornerRadius: 8)
                                        .fill(.ultraThinMaterial)
                                        .padding(2)
                                )
                        }

                        ForEach(cleanArticles) { article in
                            Button {
                                guard !article.url.isEmpty, let url = URL(string: article.url) else { return }
                                openURL(url)
                            } label: {
                                NewsRow(article: article)
                            }
                            .buttonStyle(BounceButtonStyle())
                            .listRowBackground(
                                RoundedRectangle(cornerRadius: 8)
                                    .fill(.ultraThinMaterial)
                                    .padding(2)
                            )
                        }
                    }
                    .refreshable {
                        await loadNews()
                    }
                }
            }
            .navigationTitle("News")
        }
        .onAppear {
            guard !hasLoaded else { return }
            hasLoaded = true
            Task {
                await loadNews()
            }
        }
    }

    private func loadNews() async {
        isLoading = true
        defer { isLoading = false }

        do {
            articles = try await OpticonAPI.shared.fetchNews()
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }
}

private struct NewsRow: View {
    let article: NewsArticle

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(cleanTitle)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(3)

                Text(bylineText)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            Spacer(minLength: 0)

            if let imageURL = articleImageURL {
                AsyncImage(url: imageURL) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                    default:
                        Palette.overlay.opacity(0.06)
                    }
                }
                .frame(width: 56, height: 56)
                .clipShape(RoundedRectangle(cornerRadius: 6))
            }
        }
        .padding(.vertical, 2)
    }

    private var cleanTitle: String {
        // Strip excess whitespace from GDELT titles
        article.title
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespaces)
    }

    private var articleImageURL: URL? {
        guard let urlString = article.imageUrl, !urlString.isEmpty else { return nil }
        return URL(string: urlString)
    }

    private var bylineText: String {
        let source = article.source.isEmpty ? "GDELT" : article.source
        let relativeDate = timeAgo(from: article.publishedAt)
        if relativeDate.isEmpty { return source }
        return "\(source)  \(relativeDate)"
    }

    private func timeAgo(from publishedAt: String) -> String {
        guard !publishedAt.isEmpty else { return "" }
        guard let date = parseDate(publishedAt) else { return "" }
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }

    private func parseDate(_ text: String) -> Date? {
        let standard = ISO8601DateFormatter()
        standard.formatOptions = [.withInternetDateTime]
        return standard.date(from: text)
    }
}
