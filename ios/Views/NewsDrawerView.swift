import SwiftUI

struct NewsDrawerView: View {
    @Binding var articles: [NewsArticle]
    @Binding var isLoading: Bool
    @State private var selectedNewsURL: URL?

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Market News")
                    .font(.headline.weight(.semibold))
                Spacer()
            }
            .padding()

            if isLoading {
                ProgressView()
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
                            VStack(alignment: .leading, spacing: 8) {
                                Text(article.title)
                                    .font(.headline)
                                    .foregroundStyle(.primary)
                                HStack(spacing: 8) {
                                    Text(article.source)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                    Spacer()
                                    Text(article.publishedAt)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
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
}
