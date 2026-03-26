import SwiftUI

struct CompactNewsRow: View {
    let article: NewsArticle

    private var relativeTime: String {
        guard !article.publishedAt.isEmpty else { return "" }
        let formatters: [DateFormatter] = {
            let iso = DateFormatter()
            iso.dateFormat = "yyyy-MM-dd'T'HH:mm:ss'Z'"
            iso.timeZone = TimeZone(identifier: "UTC")
            let iso2 = DateFormatter()
            iso2.dateFormat = "yyyy-MM-dd'T'HH:mm:ssZ"
            return [iso, iso2]
        }()
        var parsed: Date?
        for fmt in formatters {
            if let d = fmt.date(from: article.publishedAt) { parsed = d; break }
        }
        guard let date = parsed else { return "" }
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }

    private var sourceInitial: String {
        String(article.source.prefix(1)).uppercased()
    }

    private var sourceColor: Color {
        let hash = article.source.unicodeScalars.reduce(0) { $0 + Int($1.value) }
        let colors: [Color] = [.blue, .purple, .orange, .teal, .pink, .indigo, .mint]
        return colors[hash % colors.count]
    }

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            ZStack {
                Circle().fill(sourceColor.opacity(0.2))
                Text(sourceInitial)
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(sourceColor)
            }
            .frame(width: 28, height: 28)

            VStack(alignment: .leading, spacing: 4) {
                Text(article.title)
                    .font(.subheadline.weight(.medium))
                    .lineLimit(2)
                    .foregroundStyle(.primary)

                HStack(spacing: 6) {
                    Text(article.source)
                        .font(.caption2.weight(.medium))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(.ultraThinMaterial, in: Capsule())
                    if !relativeTime.isEmpty {
                        Text(relativeTime)
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                }
            }

            Spacer(minLength: 0)

            if let imageUrl = article.imageUrl, let url = URL(string: imageUrl) {
                AsyncImage(url: url) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFill()
                    } else {
                        Color.clear
                    }
                }
                .frame(width: 48, height: 48)
                .clipShape(RoundedRectangle(cornerRadius: 6))
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 4)
    }
}
