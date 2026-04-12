import SafariServices
import SwiftUI

struct PersonDetailView: View {
    // Search result mode
    var result: PersonSearchResult?
    var profile: PersonProfile?
    var onIndex: ((IndexedPerson) -> Void)?

    // Indexed person mode
    var indexedPerson: IndexedPerson?
    var onUpdate: ((IndexedPerson) -> Void)?
    var onDelete: (() -> Void)?

    @State private var showWebView = false
    @State private var webURL: String = ""
    @State private var mentions: [NewsMention] = []
    @State private var isLoadingMentions = false
    @State private var isEnriching = false
    @State private var enrichment: PersonEnrichment?
    @State private var editingTags = false
    @State private var tagInput = ""
    @State private var editingNotes = false
    @State private var notesInput = ""
    @State private var isIndexing = false
    @State private var indexed = false
    @Environment(\.dismiss) private var dismiss

    private var isIndexedMode: Bool { indexedPerson != nil }

    private var displayName: String {
        indexedPerson?.name ?? result?.title ?? ""
    }

    private var displayImage: String? {
        indexedPerson?.image ?? result?.imageUrl
    }

    private var displaySnippet: String? {
        indexedPerson?.bio ?? result?.snippet
    }

    init(result: PersonSearchResult, profile: PersonProfile?, onIndex: ((IndexedPerson) -> Void)? = nil) {
        self.result = result
        self.profile = profile
        self.onIndex = onIndex
    }

    init(indexedPerson: IndexedPerson, onUpdate: ((IndexedPerson) -> Void)? = nil, onDelete: (() -> Void)? = nil) {
        self.indexedPerson = indexedPerson
        self.onUpdate = onUpdate
        self.onDelete = onDelete
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                if isIndexedMode {
                    actionButtons
                    if let enrichment = enrichment ?? indexedPerson?.enrichment {
                        intelligenceSection(enrichment)
                    }
                    tagsSection
                    notesSection
                    mentionsSection
                    timelineSection
                    relationshipsSection
                } else {
                    indexButton
                    if let profile, !profile.socialLinks.isEmpty {
                        socialSection(profile.socialLinks)
                    }
                    urlSection
                    if let profile {
                        relatedSection(profile.results.filter { $0.url != result?.url })
                    }
                }
            }
            .padding()
        }
        .background(Palette.bg)
        .navigationTitle(isIndexedMode ? "Person" : "Profile")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Done") { dismiss() }
            }
            if let url = result?.url ?? indexedPerson?.socials.first?.url {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        if let url = URL(string: url) {
                            UIApplication.shared.open(url)
                        }
                    } label: {
                        Image(systemName: "safari")
                    }
                }
            }
        }
        .sheet(isPresented: $showWebView) {
            if let url = URL(string: webURL) {
                SafariView(url: url)
                    .ignoresSafeArea()
            }
        }
        .onAppear {
            if let person = indexedPerson {
                enrichment = person.enrichment
                loadMentions(personId: person.id)
            }
        }
    }

    // MARK: - Header

    private var header: some View {
        VStack(spacing: 8) {
            if let imageUrl = displayImage, let url = URL(string: imageUrl) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let img):
                        img.resizable()
                            .aspectRatio(contentMode: .fill)
                            .frame(width: 80, height: 80)
                            .clipShape(Circle())
                    default:
                        placeholderIcon
                    }
                }
            } else {
                placeholderIcon
            }

            Text(displayName)
                .font(.title2.weight(.bold))

            if let enrichment = enrichment ?? indexedPerson?.enrichment {
                if let role = enrichment.role, let company = enrichment.company {
                    Text("\(role) @ \(company)")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                } else if let role = enrichment.role {
                    Text(role)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                if let location = enrichment.location {
                    Text(location)
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }
            } else if let url = result?.displayUrl {
                Text(url)
                    .font(.caption)
                    .foregroundStyle(Palette.appleBlue)
            }

            if let bio = displaySnippet, !bio.isEmpty {
                Text(bio)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var placeholderIcon: some View {
        Circle()
            .fill(Palette.overlay.opacity(0.1))
            .frame(width: 80, height: 80)
            .overlay {
                Image(systemName: "person.fill")
                    .font(.title)
                    .foregroundStyle(.secondary)
            }
    }

    // MARK: - Snippet

    private func snippetSection(_ text: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel("Summary")
            Text(text)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: - Index Button (search mode)

    private var indexButton: some View {
        Button {
            guard let result, let profile else { return }
            isIndexing = true
            let person = IndexedPerson(
                id: result.title.lowercased().replacingOccurrences(of: "[^a-z0-9]+", with: "-", options: .regularExpression).trimmingCharacters(in: CharacterSet(charactersIn: "-")),
                name: result.title,
                image: result.imageUrl ?? profile.primaryImage,
                bio: result.snippet,
                tags: [],
                notes: "",
                socials: profile.socialLinks,
                searchData: PersonSearchData(query: profile.query, results: profile.results, resultCount: profile.resultCount)
            )
            onIndex?(person)
            indexed = true
            isIndexing = false
        } label: {
            HStack {
                if isIndexing {
                    ProgressView()
                        .controlSize(.small)
                } else if indexed {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(Palette.successGreen)
                    Text("Indexed")
                } else {
                    Image(systemName: "plus.circle.fill")
                        .foregroundStyle(Palette.appleBlue)
                    Text("Add to Index")
                }
            }
            .font(.subheadline.weight(.semibold))
            .frame(maxWidth: .infinity)
            .padding(12)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
        .disabled(indexed || isIndexing)
    }

    // MARK: - Action Buttons (indexed mode)

    private var actionButtons: some View {
        HStack(spacing: 12) {
            Button {
                performEnrich()
            } label: {
                HStack(spacing: 6) {
                    if isEnriching {
                        ProgressView()
                            .controlSize(.small)
                    } else {
                        Image(systemName: "sparkles")
                    }
                    Text(isEnriching ? "Enriching..." : "AI Enrich")
                }
                .font(.subheadline.weight(.semibold))
                .frame(maxWidth: .infinity)
                .padding(10)
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 10))
            }
            .buttonStyle(.plain)
            .disabled(isEnriching)

            Button(role: .destructive) {
                performDelete()
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "trash")
                    Text("Remove")
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Palette.dangerRed)
                .frame(maxWidth: .infinity)
                .padding(10)
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 10))
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Intelligence

    private func intelligenceSection(_ data: PersonEnrichment) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionLabel("Intelligence")

            VStack(alignment: .leading, spacing: 8) {
                if let company = data.company {
                    intelRow(icon: "building.2", label: "Company", value: company)
                }
                if let location = data.location {
                    intelRow(icon: "mappin.and.ellipse", label: "Location", value: location)
                }
                if let sentiment = data.sentiment {
                    intelRow(icon: "face.smiling", label: "Sentiment", value: sentiment)
                }

                if !data.keyFacts.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Key Facts")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                        ForEach(data.keyFacts, id: \.self) { fact in
                            HStack(alignment: .top, spacing: 6) {
                                Text("*")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                Text(fact)
                                    .font(.caption)
                                    .foregroundStyle(.primary)
                            }
                        }
                    }
                }

                if !data.associates.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Associates")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.secondary)
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 6) {
                                ForEach(data.associates, id: \.self) { name in
                                    Text(name)
                                        .font(.caption2.weight(.medium))
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 4)
                                        .background(.ultraThinMaterial, in: Capsule())
                                }
                            }
                        }
                    }
                }

                if !data.industryTags.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            ForEach(data.industryTags, id: \.self) { tag in
                                Text(tag)
                                    .font(.caption2.weight(.medium))
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(Palette.appleBlue.opacity(0.15), in: Capsule())
                                    .foregroundStyle(Palette.appleBlue)
                            }
                        }
                    }
                }
            }
            .padding(12)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
        }
    }

    private func intelRow(icon: String, label: String, value: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(width: 20)
            VStack(alignment: .leading, spacing: 1) {
                Text(label)
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                Text(value)
                    .font(.caption)
                    .foregroundStyle(.primary)
            }
        }
    }

    // MARK: - Tags

    private var tagsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                sectionLabel("Tags")
                Spacer()
                Button(editingTags ? "Done" : "Edit") {
                    editingTags.toggle()
                }
                .font(.caption.weight(.medium))
                .foregroundStyle(Palette.appleBlue)
            }

            if let person = indexedPerson {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(person.tags, id: \.self) { tag in
                            HStack(spacing: 4) {
                                Text(tag)
                                    .font(.caption2.weight(.medium))
                                if editingTags {
                                    Button {
                                        removeTag(tag)
                                    } label: {
                                        Image(systemName: "xmark")
                                            .font(.system(size: 8, weight: .bold))
                                    }
                                }
                            }
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(.ultraThinMaterial, in: Capsule())
                        }
                    }
                }
            }

            if editingTags {
                HStack(spacing: 8) {
                    TextField("Add tag...", text: $tagInput)
                        .font(.caption)
                        .textFieldStyle(.roundedBorder)
                        .submitLabel(.done)
                        .onSubmit { addTag() }
                    Button("Add") { addTag() }
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Palette.appleBlue)
                        .disabled(tagInput.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }

    // MARK: - Notes

    private var notesSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                sectionLabel("Notes")
                Spacer()
                Button(editingNotes ? "Save" : "Edit") {
                    if editingNotes { saveNotes() }
                    else { notesInput = indexedPerson?.notes ?? "" }
                    editingNotes.toggle()
                }
                .font(.caption.weight(.medium))
                .foregroundStyle(Palette.appleBlue)
            }

            if editingNotes {
                TextEditor(text: $notesInput)
                    .font(.caption)
                    .frame(minHeight: 60)
                    .padding(8)
                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 10))
            } else if let notes = indexedPerson?.notes, !notes.isEmpty {
                Text(notes)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 10))
            } else {
                Text("No notes yet")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
        }
    }

    // MARK: - Mentions

    private var mentionsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel("Mentions")

            if isLoadingMentions {
                HStack(spacing: 8) {
                    ProgressView().controlSize(.small)
                    Text("Loading mentions...")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            } else if mentions.isEmpty {
                Text("No recent mentions found")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            } else {
                ForEach(mentions.prefix(5)) { mention in
                    Button {
                        webURL = mention.url
                        showWebView = true
                    } label: {
                        HStack(spacing: 10) {
                            if let image = mention.image, let url = URL(string: image) {
                                AsyncImage(url: url) { phase in
                                    switch phase {
                                    case .success(let img):
                                        img.resizable()
                                            .aspectRatio(contentMode: .fill)
                                            .frame(width: 44, height: 44)
                                            .clipShape(RoundedRectangle(cornerRadius: 6))
                                    default:
                                        RoundedRectangle(cornerRadius: 6)
                                            .fill(Color.secondary.opacity(0.1))
                                            .frame(width: 44, height: 44)
                                    }
                                }
                            }
                            VStack(alignment: .leading, spacing: 2) {
                                Text(mention.title)
                                    .font(.caption.weight(.medium))
                                    .foregroundStyle(.primary)
                                    .lineLimit(2)
                                    .multilineTextAlignment(.leading)
                                HStack(spacing: 4) {
                                    if let source = mention.source {
                                        Text(source)
                                            .font(.caption2)
                                            .foregroundStyle(.secondary)
                                    }
                                    if let date = mention.publishedAt {
                                        Text(formatDate(date))
                                            .font(.caption2)
                                            .foregroundStyle(.tertiary)
                                    }
                                }
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.caption2)
                                .foregroundStyle(.tertiary)
                        }
                        .padding(10)
                        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 10))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: - Timeline

    private var timelineSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel("Timeline")

            VStack(alignment: .leading, spacing: 0) {
                ForEach(timelineEvents, id: \.label) { event in
                    HStack(alignment: .top, spacing: 12) {
                        VStack(spacing: 0) {
                            Circle()
                                .fill(event.color)
                                .frame(width: 8, height: 8)
                            if event.label != timelineEvents.last?.label {
                                Rectangle()
                                    .fill(Color.secondary.opacity(0.2))
                                    .frame(width: 1)
                                    .frame(maxHeight: .infinity)
                            }
                        }
                        .frame(width: 8)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(event.label)
                                .font(.caption.weight(.medium))
                            Text(event.date)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        .padding(.bottom, 12)
                    }
                }
            }
        }
    }

    private struct TimelineEvent {
        let label: String
        let date: String
        let color: Color
    }

    private var timelineEvents: [TimelineEvent] {
        var events: [TimelineEvent] = []

        if let created = indexedPerson?.createdAt {
            events.append(TimelineEvent(label: "Indexed", date: formatDate(created), color: Palette.appleBlue))
        }
        if let enrichedAt = (enrichment ?? indexedPerson?.enrichment)?.enrichedAt {
            events.append(TimelineEvent(label: "AI Enriched", date: formatDate(enrichedAt), color: Palette.warningAmber))
        }
        for mention in mentions.prefix(3) {
            if let date = mention.publishedAt {
                let source = mention.source ?? "News"
                events.append(TimelineEvent(label: "Mentioned by \(source)", date: formatDate(date), color: Palette.successGreen))
            }
        }

        return events
    }

    // MARK: - Relationships

    private var relationshipsSection: some View {
        Group {
            if let person = indexedPerson, !person.relationships.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    sectionLabel("Relationships")
                    ForEach(person.relationships, id: \.self) { rel in
                        HStack(spacing: 8) {
                            Text(rel.type)
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(.secondary)
                                .textCase(.uppercase)
                            Text(rel.name)
                                .font(.caption)
                                .foregroundStyle(.primary)
                            Spacer()
                        }
                        .padding(10)
                        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 10))
                    }
                }
            }
        }
    }

    // MARK: - Social Section (search mode)

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
            if let resultUrl = result?.url {
                Button {
                    webURL = resultUrl
                    showWebView = true
                } label: {
                    HStack {
                        Image(systemName: "globe")
                            .foregroundStyle(Palette.appleBlue)
                        Text(resultUrl)
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

    // MARK: - Helpers

    private func sectionLabel(_ text: String) -> some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .foregroundStyle(.secondary)
            .textCase(.uppercase)
            .tracking(0.5)
    }

    private func formatDate(_ iso: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: iso) {
            let display = DateFormatter()
            display.dateStyle = .medium
            display.timeStyle = .short
            return display.string(from: date)
        }
        formatter.formatOptions = [.withInternetDateTime]
        if let date = formatter.date(from: iso) {
            let display = DateFormatter()
            display.dateStyle = .medium
            display.timeStyle = .short
            return display.string(from: date)
        }
        return iso
    }

    // MARK: - Actions

    private func performEnrich() {
        guard let person = indexedPerson else { return }
        isEnriching = true
        Task {
            do {
                if let result = try await EpiphanyAPI.shared.enrichPerson(personId: person.id) {
                    enrichment = result
                    var updated = person
                    updated.enrichment = result
                    onUpdate?(updated)
                }
            } catch {
                // Show inline -- no global error
            }
            isEnriching = false
        }
    }

    private func performDelete() {
        guard let person = indexedPerson else { return }
        Task {
            do {
                try await EpiphanyAPI.shared.deletePerson(id: person.id)
                onDelete?()
                dismiss()
            } catch {
                // Handled silently
            }
        }
    }

    private func loadMentions(personId: String) {
        isLoadingMentions = true
        Task {
            do {
                mentions = try await EpiphanyAPI.shared.fetchCrossref(personId: personId)
            } catch {
                // No mentions is fine
            }
            isLoadingMentions = false
        }
    }

    private func addTag() {
        let tag = tagInput.trimmingCharacters(in: .whitespaces)
        guard !tag.isEmpty, var person = indexedPerson else { return }
        if !person.tags.contains(tag) {
            person.tags.append(tag)
            updatePerson(person)
        }
        tagInput = ""
    }

    private func removeTag(_ tag: String) {
        guard var person = indexedPerson else { return }
        person.tags.removeAll { $0 == tag }
        updatePerson(person)
    }

    private func saveNotes() {
        guard var person = indexedPerson else { return }
        person.notes = notesInput
        updatePerson(person)
    }

    private func updatePerson(_ person: IndexedPerson) {
        Task {
            do {
                let updated = try await EpiphanyAPI.shared.updatePerson(person)
                onUpdate?(updated)
            } catch {
                // Revert handled by caller
            }
        }
    }
}
