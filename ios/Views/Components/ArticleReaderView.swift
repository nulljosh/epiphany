import SwiftUI

struct ArticleReaderView: View {
    let url: URL
    @State private var article: MonicaAPI.ArticleContent?
    @State private var isLoading = true
    @State private var fallbackToSafari = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if fallbackToSafari {
                    SafariView(url: url)
                        .ignoresSafeArea()
                } else if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let article {
                    articleContent(article)
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Done") { dismiss() }
                        .font(.body.weight(.medium))
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button {
                            UIApplication.shared.open(url)
                        } label: {
                            Label("Open in Browser", systemImage: "safari")
                        }
                        ShareLink(item: url)
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
        }
        .task {
            await loadArticle()
        }
    }

    private func articleContent(_ article: MonicaAPI.ArticleContent) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text(article.title)
                    .font(.title2.weight(.bold))
                    .fixedSize(horizontal: false, vertical: true)

                if let byline = articleByline(article) {
                    Text(byline)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                Divider()

                Text(article.content)
                    .font(.body)
                    .lineSpacing(6)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding()
            .padding(.bottom, 40)
        }
    }

    private func articleByline(_ article: MonicaAPI.ArticleContent) -> String? {
        let parts: [String] = [article.author, article.siteName].compactMap { value in
            guard let s = value, !s.isEmpty else { return nil }
            return s
        }
        return parts.isEmpty ? nil : parts.joined(separator: " -- ")
    }

    private func loadArticle() async {
        do {
            article = try await MonicaAPI.shared.fetchArticle(url: url.absoluteString)
            if article?.content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == true {
                fallbackToSafari = true
            }
        } catch {
            fallbackToSafari = true
        }
        isLoading = false
    }
}
