import SwiftUI

struct PeopleView: View {
    @State private var query = ""
    @State private var profile: PersonProfile?
    @State private var recentSearches: [String] = []
    @State private var isSearching = false
    @State private var error: String?
    @State private var suggestionIndex = 0

    @State private var indexedPeople: [IndexedPerson] = []
    @State private var isLoadingIndex = false
    @State private var selectedPerson: IndexedPerson?

    private let recentsKey = "people.recentSearches"
    private let suggestionPool = [
        "Elon Musk", "Taylor Swift", "Justin Trudeau",
        "Mark Zuckerberg", "Beyonce", "Sam Altman",
        "Tim Cook", "Rihanna", "Jensen Huang",
        "LeBron James", "Drake", "Satya Nadella",
        "Oprah Winfrey", "Jeff Bezos", "Alexandria Ocasio-Cortez"
    ]

    private var currentSuggestions: [String] {
        let count = suggestionPool.count
        return (0..<4).map { suggestionPool[(suggestionIndex + $0) % count] }
    }

    private let columns = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12)
    ]

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                // Search bar always at top
                searchBar
                    .padding(.horizontal, 20)
                    .padding(.top, 12)
                    .padding(.bottom, 12)

                // Search results (when active)
                if let error {
                    errorView(error)
                } else if isSearching {
                    loadingView
                } else if let profile {
                    resultsView(profile)
                }

                // Divider between search and index
                if profile != nil || isSearching || error != nil {
                    Divider().padding(.vertical, 12).padding(.horizontal, 20)
                }

                // Index grid (always visible)
                indexSection
            }
            .padding(.bottom, 40)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(Palette.bgDark)
        .onAppear {
            loadRecents()
            loadIndex()
        }
        .sheet(item: $selectedPerson) { person in
            PersonDetailView(indexedPerson: person, onUpdate: { updated in
                if let idx = indexedPeople.firstIndex(where: { $0.id == updated.id }) {
                    indexedPeople[idx] = updated
                }
            }, onDelete: {
                indexedPeople.removeAll { $0.id == person.id }
            })
            .frame(minWidth: 500, minHeight: 600)
        }
    }

    // MARK: - Index Section (always visible below search)

    private var indexSection: some View {
        VStack(spacing: 0) {
            if isLoadingIndex && indexedPeople.isEmpty {
                VStack(spacing: 12) {
                    ProgressView().controlSize(.regular)
                    Text("Loading index...")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(.vertical, 24)
            } else if !indexedPeople.isEmpty {
                HStack {
                    Text("Indexed")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .textCase(.uppercase)
                    Spacer()
                    Text("\(indexedPeople.count)")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 8)

                LazyVGrid(columns: columns, spacing: 12) {
                    ForEach(indexedPeople) { person in
                        indexCard(person)
                    }
                }
                .padding(.horizontal, 20)

                if indexedPeople.count > 1 {
                    Divider().padding(.vertical, 12).padding(.horizontal, 20)
                    HStack {
                        Text("Connections")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                            .textCase(.uppercase)
                        Spacer()
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 8)

                    PersonGraphView(people: indexedPeople) { person in
                        selectedPerson = person
                    }
                    .frame(height: 360)
                    .padding(.horizontal, 20)
                }
            } else if profile == nil && !isSearching && error == nil {
                recentsView
            }
        }
    }

    private var searchBar: some View {
        HStack(spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.secondary)
                    .font(.subheadline)
                TextField("Search anyone...", text: $query)
                    .textFieldStyle(.plain)
                    .onSubmit { performSearch() }
                if !query.isEmpty {
                    Button {
                        query = ""
                        profile = nil
                        error = nil
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(.tertiary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 10))

            if !query.isEmpty {
                Button("Search") { performSearch() }
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Palette.appleBlue)
                    .buttonStyle(.plain)
            }
        }
    }

    private func errorView(_ message: String) -> some View {
        VStack(spacing: 12) {
            Spacer()
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 36))
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
                .buttonStyle(.plain)
            Spacer()
        }
    }

    private var loadingView: some View {
        VStack(spacing: 12) {
            Spacer()
            ProgressView()
                .controlSize(.regular)
            Text("Searching...")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Spacer()
        }
    }

    private func resultsView(_ profile: PersonProfile) -> some View {
        VStack(spacing: 0) {
            LazyVStack(spacing: 0) {
                if let image = profile.primaryImage, let imageURL = URL(string: image) {
                    AsyncImage(url: imageURL) { phase in
                        switch phase {
                        case .success(let img):
                            img.resizable()
                                .aspectRatio(contentMode: .fill)
                                .frame(width: 72, height: 72)
                                .clipShape(Circle())
                        default:
                            placeholderAvatar
                        }
                    }
                    .padding(.top, 8)
                    .padding(.bottom, 4)
                } else {
                    placeholderAvatar
                        .padding(.top, 8)
                        .padding(.bottom, 4)
                }

                Text(profile.query)
                    .font(.title2.weight(.bold))
                    .padding(.bottom, 4)

                Text("\(profile.results.count) results")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.bottom, 8)

                // Index from search button
                Button {
                    indexFromSearch(profile: profile)
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "plus.circle.fill")
                            .foregroundStyle(Palette.appleBlue)
                        Text("Add to Index")
                    }
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(.ultraThinMaterial, in: Capsule())
                }
                .buttonStyle(.plain)
                .padding(.bottom, 16)

                if !profile.socialLinks.isEmpty {
                    socialLinksSection(profile.socialLinks)
                        .padding(.bottom, 16)
                }

                ForEach(profile.results) { result in
                    resultCard(result)
                        .padding(.horizontal, 20)
                        .padding(.bottom, 8)
                }
            }
            .padding(.bottom, 40)
        }
    }

    private var placeholderAvatar: some View {
        Circle()
            .fill(Color.secondary.opacity(0.1))
            .frame(width: 72, height: 72)
            .overlay {
                Image(systemName: "person.fill")
                    .font(.title)
                    .foregroundStyle(.secondary)
            }
    }

    private func socialLinksSection(_ links: [SocialLink]) -> some View {
        ScrollView(.horizontal, showsIndicators: true) {
            HStack(spacing: 8) {
                ForEach(links) { link in
                    Button {
                        if let url = URL(string: link.url) {
                            NSWorkspace.shared.open(url)
                        }
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: link.systemImage)
                                .font(.caption)
                            Text(link.displayName)
                                .font(.caption.weight(.semibold))
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(.ultraThinMaterial, in: Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 20)
        }
    }

    private func resultCard(_ result: PersonSearchResult) -> some View {
        Button {
            if let url = URL(string: result.url) {
                NSWorkspace.shared.open(url)
            }
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
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
    }

    private var recentsView: some View {
        VStack(spacing: 0) {
                if recentSearches.isEmpty {
                    VStack(spacing: 12) {
                        Spacer()
                        Image(systemName: "person.crop.rectangle.stack")
                            .font(.system(size: 40))
                            .foregroundStyle(.tertiary)
                        Text("Search for anyone")
                            .font(.headline)
                        Text("Find public profiles, social accounts, and news mentions.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 40)

                        HStack(spacing: 8) {
                            ForEach(currentSuggestions, id: \.self) { name in
                                Button {
                                    query = name
                                    performSearch()
                                } label: {
                                    Text(name)
                                        .font(.caption.weight(.medium))
                                        .padding(.horizontal, 12)
                                        .padding(.vertical, 6)
                                        .background(.ultraThinMaterial, in: Capsule())
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .animation(.easeInOut, value: suggestionIndex)
                        .onAppear {
                            Timer.scheduledTimer(withTimeInterval: 3, repeats: true) { _ in
                                suggestionIndex = (suggestionIndex + 1) % suggestionPool.count
                            }
                        }

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
                        .buttonStyle(.plain)
                    }
                    .padding(.horizontal, 20)
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
                            .padding(.horizontal, 20)
                            .padding(.vertical, 10)
                        }
                        .buttonStyle(.plain)
                        Divider().padding(.leading, 52)
                    }
                }
            }
            .padding(.bottom, 40)
    }

    private func indexCard(_ person: IndexedPerson) -> some View {
        Button {
            selectedPerson = person
        } label: {
            VStack(spacing: 8) {
                if let image = person.image, let url = URL(string: image) {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let img):
                            img.resizable()
                                .aspectRatio(contentMode: .fill)
                                .frame(width: 48, height: 48)
                                .clipShape(Circle())
                        default:
                            personPlaceholder(size: 48)
                        }
                    }
                } else {
                    personPlaceholder(size: 48)
                }

                Text(person.name)
                    .font(.caption.weight(.semibold))
                    .lineLimit(1)
                    .foregroundStyle(.primary)

                if !person.tags.isEmpty {
                    Text(person.tags.prefix(2).joined(separator: ", "))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }

                if person.enrichment != nil {
                    Image(systemName: "sparkles")
                        .font(.caption2)
                        .foregroundStyle(Palette.warningAmber)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(10)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
    }

    private func personPlaceholder(size: CGFloat) -> some View {
        Circle()
            .fill(Color.secondary.opacity(0.1))
            .frame(width: size, height: size)
            .overlay {
                Image(systemName: "person.fill")
                    .font(size > 40 ? .title2 : .caption)
                    .foregroundStyle(.secondary)
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
                let result = try await EpiphanyAPI.shared.fetchPeople(query: trimmed)
                profile = result
            } catch {
                self.error = error.localizedDescription
            }
            isSearching = false
        }
    }

    private func loadIndex() {
        isLoadingIndex = true
        Task {
            do {
                indexedPeople = try await EpiphanyAPI.shared.fetchPeopleIndex()
            } catch {
                // Index is supplementary
            }
            isLoadingIndex = false
        }
    }

    private func indexFromSearch(profile: PersonProfile) {
        let name = profile.query
        let id = name.lowercased()
            .replacingOccurrences(of: "[^a-z0-9]+", with: "-", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
        let person = IndexedPerson(
            id: id,
            name: name,
            image: profile.primaryImage,
            bio: profile.results.first?.snippet,
            tags: [],
            notes: "",
            socials: profile.socialLinks,
            searchData: PersonSearchData(query: profile.query, results: profile.results, resultCount: profile.resultCount)
        )
        Task {
            do {
                let saved = try await EpiphanyAPI.shared.indexPerson(person)
                indexedPeople.insert(saved, at: 0)
            } catch {
                // Handled silently
            }
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
