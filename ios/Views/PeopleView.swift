import SwiftUI

struct PeopleView: View {
    @State private var query = ""
    @State private var profile: PersonProfile?
    @State private var recentSearches: [String] = []
    @State private var isSearching = false
    @State private var error: String?
    @State private var selectedResult: PersonSearchResult?

    private let recentsKey = "people.recentSearches"

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                searchBar
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
                    .padding(.bottom, 12)

                if let error {
                    errorView(error)
                } else if isSearching {
                    loadingView
                } else if let profile {
                    resultsView(profile)
                } else {
                    recentsView
                }
            }
            .background(Palette.bg)
            .navigationTitle("People")
            .navigationBarTitleDisplayMode(.large)
            .onAppear { loadRecents() }
            .sheet(item: $selectedResult) { result in
                NavigationStack {
                    PersonDetailView(result: result, profile: profile)
                }
            }
        }
    }

    // MARK: - Search bar

    private var searchBar: some View {
        HStack(spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.secondary)
                    .font(.subheadline)
                TextField("Search anyone...", text: $query)
                    .textInputAutocapitalization(.words)
                    .autocorrectionDisabled()
                    .submitLabel(.search)
                    .onSubmit { performSearch() }
                if !query.isEmpty {
                    Button {
                        query = ""
                        profile = nil
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(.tertiary)
                    }
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))

            if !query.isEmpty {
                Button("Search") { performSearch() }
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Palette.appleBlue)
            }
        }
    }

    // MARK: - Error

    private func errorView(_ message: String) -> some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 40))
                .foregroundStyle(.secondary)
            Text("Search failed")
                .font(.headline)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
            Button("Try Again") { performSearch() }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Palette.appleBlue)
            Spacer()
        }
    }

    // MARK: - Loading

    private var loadingView: some View {
        VStack(spacing: 16) {
            Spacer()
            ProgressView()
                .controlSize(.large)
            Text("Searching...")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Spacer()
        }
    }

    // MARK: - Results

    private func resultsView(_ profile: PersonProfile) -> some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                if let image = profile.primaryImage, let imageURL = URL(string: image) {
                    AsyncImage(url: imageURL) { phase in
                        switch phase {
                        case .success(let img):
                            img.resizable()
                                .aspectRatio(contentMode: .fill)
                                .frame(width: 80, height: 80)
                                .clipShape(Circle())
                        default:
                            Circle()
                                .fill(Palette.overlay.opacity(0.1))
                                .frame(width: 80, height: 80)
                                .overlay {
                                    Image(systemName: "person.fill")
                                        .font(.title)
                                        .foregroundStyle(.secondary)
                                }
                        }
                    }
                    .padding(.top, 8)
                    .padding(.bottom, 4)
                }

                Text(profile.query)
                    .font(.title2.weight(.bold))
                    .padding(.bottom, 4)

                Text("\(profile.results.count) results")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.bottom, 16)

                if !profile.socialLinks.isEmpty {
                    socialLinksSection(profile.socialLinks)
                        .padding(.bottom, 16)
                }

                ForEach(profile.results) { result in
                    resultCard(result)
                        .padding(.horizontal, 16)
                        .padding(.bottom, 8)
                }
            }
            .padding(.bottom, 80)
        }
    }

    private func socialLinksSection(_ links: [SocialLink]) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(links) { link in
                    Button {
                        if let url = URL(string: link.url) {
                            UIApplication.shared.open(url)
                        }
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: link.systemImage)
                                .font(.caption)
                            Text(link.displayName)
                                .font(.caption.weight(.semibold))
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(.ultraThinMaterial, in: Capsule())
                    }
                    .tint(.primary)
                }
            }
            .padding(.horizontal, 16)
        }
    }

    private func resultCard(_ result: PersonSearchResult) -> some View {
        Button {
            selectedResult = result
        } label: {
            VStack(alignment: .leading, spacing: 6) {
                Text(result.title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)

                Text(result.snippet)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(3)
                    .multilineTextAlignment(.leading)

                Text(result.displayUrl)
                    .font(.caption2)
                    .foregroundStyle(Palette.appleBlue)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Recents

    private var recentsView: some View {
        ScrollView {
            VStack(spacing: 0) {
                if recentSearches.isEmpty {
                    VStack(spacing: 16) {
                        Spacer()
                        Image(systemName: "person.crop.rectangle.stack")
                            .font(.system(size: 48))
                            .foregroundStyle(.tertiary)
                        Text("Search for anyone")
                            .font(.headline)
                        Text("Find public profiles, social accounts, and news mentions.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 40)
                        Spacer()
                    }
                    .frame(maxHeight: .infinity)
                } else {
                    HStack {
                        Text("Recent")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                            .textCase(.uppercase)
                        Spacer()
                        Button("Clear") {
                            recentSearches = []
                            saveRecents()
                        }
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 16)
                    .padding(.bottom, 8)

                    ForEach(recentSearches, id: \.self) { name in
                        Button {
                            query = name
                            performSearch()
                        } label: {
                            HStack(spacing: 12) {
                                Image(systemName: "clock.arrow.circlepath")
                                    .foregroundStyle(.secondary)
                                    .font(.subheadline)
                                Text(name)
                                    .font(.subheadline)
                                    .foregroundStyle(.primary)
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .font(.caption2)
                                    .foregroundStyle(.tertiary)
                            }
                            .padding(.horizontal, 16)
                            .padding(.vertical, 12)
                        }
                        .buttonStyle(.plain)
                        Divider().padding(.leading, 48)
                    }
                }
            }
            .padding(.bottom, 80)
        }
    }

    // MARK: - Actions

    private func performSearch() {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        query = trimmed
        isSearching = true
        error = nil

        addToRecents(trimmed)

        Task {
            do {
                let result = try await OpticonAPI.shared.fetchPeople(query: trimmed)
                profile = result
            } catch {
                self.error = error.localizedDescription
            }
            isSearching = false
        }
    }

    private func addToRecents(_ name: String) {
        recentSearches.removeAll { $0.lowercased() == name.lowercased() }
        recentSearches.insert(name, at: 0)
        if recentSearches.count > 20 { recentSearches = Array(recentSearches.prefix(20)) }
        saveRecents()
    }

    private func loadRecents() {
        recentSearches = UserDefaults.standard.stringArray(forKey: recentsKey) ?? []
    }

    private func saveRecents() {
        UserDefaults.standard.set(recentSearches, forKey: recentsKey)
    }
}
