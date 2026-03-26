import SwiftUI
import WebKit

struct PersonDetailView: View {
    let result: PersonSearchResult
    let profile: PersonProfile?
    @State private var showWebView = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                if !result.snippet.isEmpty {
                    snippetSection
                }
                if let profile, !profile.socialLinks.isEmpty {
                    socialSection(profile.socialLinks)
                }
                urlSection
                if let profile {
                    relatedSection(profile.results.filter { $0.url != result.url })
                }
            }
            .padding()
        }
        .background(Palette.bg)
        .navigationTitle("Profile")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Done") { dismiss() }
            }
            ToolbarItem(placement: .primaryAction) {
                Button {
                    if let url = URL(string: result.url) {
                        UIApplication.shared.open(url)
                    }
                } label: {
                    Image(systemName: "safari")
                }
            }
        }
        .sheet(isPresented: $showWebView) {
            if let url = URL(string: result.url) {
                NavigationStack {
                    InAppWebView(url: url)
                        .navigationTitle(result.displayUrl)
                        .navigationBarTitleDisplayMode(.inline)
                        .toolbar {
                            ToolbarItem(placement: .cancellationAction) {
                                Button("Done") { showWebView = false }
                            }
                        }
                }
            }
        }
    }

    private var header: some View {
        HStack(spacing: 14) {
            if let imageUrl = result.imageUrl, let url = URL(string: imageUrl) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let img):
                        img.resizable()
                            .aspectRatio(contentMode: .fill)
                            .frame(width: 56, height: 56)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    default:
                        placeholderIcon
                    }
                }
            } else {
                placeholderIcon
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(result.title)
                    .font(.headline)
                Text(result.displayUrl)
                    .font(.caption)
                    .foregroundStyle(Palette.appleBlue)
            }
        }
    }

    private var placeholderIcon: some View {
        RoundedRectangle(cornerRadius: 12)
            .fill(Palette.overlay.opacity(0.1))
            .frame(width: 56, height: 56)
            .overlay {
                Image(systemName: "person.fill")
                    .font(.title2)
                    .foregroundStyle(.secondary)
            }
    }

    private var snippetSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel("Summary")
            Text(result.snippet)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func socialSection(_ links: [SocialLink]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel("Social Profiles")
            ForEach(links) { link in
                Button {
                    if let url = URL(string: link.url) {
                        UIApplication.shared.open(url)
                    }
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: link.systemImage)
                            .frame(width: 24)
                            .foregroundStyle(Palette.appleBlue)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(link.platform.capitalized)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(.primary)
                            if let username = link.username {
                                Text("@\(username)")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        Spacer()
                        Image(systemName: "arrow.up.right")
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                    }
                    .padding(.vertical, 6)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var urlSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel("Source")
            Button {
                showWebView = true
            } label: {
                HStack {
                    Image(systemName: "globe")
                        .foregroundStyle(Palette.appleBlue)
                    Text(result.url)
                        .font(.caption)
                        .foregroundStyle(Palette.appleBlue)
                        .lineLimit(1)
                        .truncationMode(.middle)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
                .padding(12)
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 10))
            }
            .buttonStyle(.plain)
        }
    }

    private func relatedSection(_ results: [PersonSearchResult]) -> some View {
        Group {
            if !results.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    sectionLabel("Other Results")
                    ForEach(results.prefix(5)) { r in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(r.title)
                                .font(.subheadline.weight(.medium))
                                .lineLimit(1)
                            Text(r.snippet)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .lineLimit(2)
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
        }
    }

    private func sectionLabel(_ text: String) -> some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .foregroundStyle(.secondary)
            .textCase(.uppercase)
            .tracking(0.5)
    }
}

// MARK: - In-App Web View

struct InAppWebView: UIViewRepresentable {
    let url: URL

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.allowsBackForwardNavigationGestures = true
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}
}
