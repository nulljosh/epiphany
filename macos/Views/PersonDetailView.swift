import SwiftUI

struct PersonDetailView: View {
    let indexedPerson: IndexedPerson
    var onUpdate: ((IndexedPerson) -> Void)?
    var onDelete: (() -> Void)?

    @State private var person: IndexedPerson
    @State private var mentions: [NewsMention] = []
    @State private var isLoadingMentions = false
    @State private var isEnriching = false
    @State private var enrichment: PersonEnrichment?
    @State private var tagInput = ""
    @State private var notesText = ""
    @State private var notesSaveTask: Task<Void, Never>?
    @Environment(\.dismiss) private var dismiss

    init(indexedPerson: IndexedPerson, onUpdate: ((IndexedPerson) -> Void)? = nil, onDelete: (() -> Void)? = nil) {
        self.indexedPerson = indexedPerson
        self.onUpdate = onUpdate
        self.onDelete = onDelete
        _person = State(initialValue: indexedPerson)
        _enrichment = State(initialValue: indexedPerson.enrichment)
        _notesText = State(initialValue: indexedPerson.notes)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                header
                actionButtons

                if let enrichment = enrichment {
                    intelligenceSection(enrichment)
                }

                mentionsSection
                timelineSection
                relationshipsSection
                socialSection
                tagsSection
                notesSection
                deleteSection
            }
            .padding(24)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Palette.bgDark)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Done") { dismiss() }
            }
            if let url = person.socials.first?.url, let link = URL(string: url) {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        NSWorkspace.shared.open(link)
                    } label: {
                        Image(systemName: "safari")
                    }
                }
            }
        }
        .onAppear {
            loadMentions()
        }
    }

    // MARK: - Header

    private var header: some View {
        VStack(spacing: 8) {
            if let imageUrl = person.image, let url = URL(string: imageUrl) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let img):
                        img.resizable()
                            .aspectRatio(contentMode: .fill)
                            .frame(width: 80, height: 80)
                            .clipShape(Circle())
                    default:
                        placeholderAvatar
                    }
                }
            } else {
                placeholderAvatar
            }

            Text(person.name)
                .font(.title2.weight(.bold))

            if let enrichment {
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
            }

            if let bio = person.bio, !bio.isEmpty {
                Text(bio)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var placeholderAvatar: some View {
        Circle()
            .fill(Color.secondary.opacity(0.1))
            .frame(width: 80, height: 80)
            .overlay {
                Image(systemName: "person.fill")
                    .font(.title)
                    .foregroundStyle(.secondary)
            }
    }

    // MARK: - Actions

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
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
            }
            .buttonStyle(.plain)
            .disabled(isEnriching)
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
                        ScrollView(.horizontal, showsIndicators: true) {
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
                    ScrollView(.horizontal, showsIndicators: true) {
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
                        if let url = URL(string: mention.url) {
                            NSWorkspace.shared.open(url)
                        }
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
                            Image(systemName: "arrow.up.right")
                                .font(.caption2)
                                .foregroundStyle(.tertiary)
                        }
                        .padding(10)
                        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
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
                ForEach(Array(timelineEvents.enumerated()), id: \.offset) { index, event in
                    HStack(alignment: .top, spacing: 12) {
                        VStack(spacing: 0) {
                            Circle()
                                .fill(event.color)
                                .frame(width: 8, height: 8)
                            if index < timelineEvents.count - 1 {
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
        if let created = person.createdAt {
            events.append(TimelineEvent(label: "Indexed", date: formatDate(created), color: Palette.appleBlue))
        }
        if let enrichedAt = enrichment?.enrichedAt {
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
            if !person.relationships.isEmpty {
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
                        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
                    }
                }
            }
        }
    }

    // MARK: - Social Links

    private var socialSection: some View {
        Group {
            if !person.socials.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    sectionLabel("Social")
                    ScrollView(.horizontal, showsIndicators: true) {
                        HStack(spacing: 8) {
                            ForEach(person.socials) { link in
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
                    }
                }
            }
        }
    }

    // MARK: - Tags

    private var tagsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel("Tags")

            if !person.tags.isEmpty {
                ScrollView(.horizontal, showsIndicators: true) {
                    HStack(spacing: 6) {
                        ForEach(person.tags, id: \.self) { tag in
                            HStack(spacing: 4) {
                                Text(tag)
                                    .font(.caption2.weight(.medium))
                                Button {
                                    removeTag(tag)
                                } label: {
                                    Image(systemName: "xmark")
                                        .font(.system(size: 8, weight: .bold))
                                }
                                .buttonStyle(.plain)
                            }
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(.ultraThinMaterial, in: Capsule())
                        }
                    }
                }
            }

            HStack(spacing: 8) {
                TextField("Add tag...", text: $tagInput)
                    .font(.caption)
                    .textFieldStyle(.plain)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 8))
                    .onSubmit { addTag() }
                Button("Add") { addTag() }
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Palette.appleBlue)
                    .buttonStyle(.plain)
                    .disabled(tagInput.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
    }

    // MARK: - Notes

    private var notesSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionLabel("Notes")

            TextEditor(text: $notesText)
                .font(.caption)
                .frame(minHeight: 80)
                .padding(8)
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
                .onChange(of: notesText) { _, newValue in
                    notesSaveTask?.cancel()
                    notesSaveTask = Task {
                        try? await Task.sleep(nanoseconds: 1_000_000_000)
                        guard !Task.isCancelled else { return }
                        var updated = person
                        updated.notes = newValue
                        savePerson(updated)
                    }
                }
        }
    }

    // MARK: - Delete

    private var deleteSection: some View {
        Button {
            performDelete()
        } label: {
            HStack(spacing: 6) {
                Image(systemName: "trash")
                Text("Delete Person")
            }
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(Palette.dangerRed)
            .frame(maxWidth: .infinity)
            .padding(10)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
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
        isEnriching = true
        Task {
            do {
                if let result = try await EpiphanyAPI.shared.enrichPerson(personId: person.id) {
                    enrichment = result
                    var updated = person
                    updated.enrichment = result
                    person = updated
                    onUpdate?(updated)
                }
            } catch {
                // Inline handling
            }
            isEnriching = false
        }
    }

    private func performDelete() {
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

    private func loadMentions() {
        isLoadingMentions = true
        Task {
            do {
                mentions = try await EpiphanyAPI.shared.fetchCrossref(personId: person.id)
            } catch {
                // No mentions is fine
            }
            isLoadingMentions = false
        }
    }

    private func addTag() {
        let tag = tagInput.trimmingCharacters(in: .whitespaces)
        guard !tag.isEmpty, !person.tags.contains(tag) else { return }
        person.tags.append(tag)
        tagInput = ""
        savePerson(person)
    }

    private func removeTag(_ tag: String) {
        person.tags.removeAll { $0 == tag }
        savePerson(person)
    }

    private func savePerson(_ updated: IndexedPerson) {
        Task {
            do {
                let saved = try await EpiphanyAPI.shared.updatePerson(updated)
                person = saved
                onUpdate?(saved)
            } catch {
                // Revert handled by caller
            }
        }
    }
}
