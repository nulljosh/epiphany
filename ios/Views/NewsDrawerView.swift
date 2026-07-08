import SwiftUI

struct NewsDrawerView: View {
    @Binding var articles: [NewsArticle]
    @Binding var isLoading: Bool
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
                    .font(.title3.weight(.bold))
                if sourceCount > 0 {
                    Text("From \(sourceCount) source\(sourceCount == 1 ? "" : "s")")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal)
            .padding(.bottom, 12)

            Divider()
                .padding(.horizontal)

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
                                        Text(article.publishedAt)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)

                                Group {
                                    if let imageUrlString = article.imageUrl, let imageUrl = URL(string: imageUrlString) {
                                        AsyncImage(url: imageUrl) { phase in
                                            if let image = phase.image {
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
