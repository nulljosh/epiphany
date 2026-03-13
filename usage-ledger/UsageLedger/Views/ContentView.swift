import SwiftUI
import SwiftData

struct ContentView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \UsageEntry.timestamp, order: .reverse) private var entries: [UsageEntry]
    @Query(sort: \UsageProject.createdAt, order: .forward) private var projects: [UsageProject]

    @State private var showingAddEntry = false

    private var totalCost: Double { entries.reduce(0) { $0 + $1.cost } }
    private var totalTokens: Int { entries.reduce(0) { $0 + $1.totalTokens } }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack(spacing: 12) {
                        SummaryCard(title: "Entries", value: "\(entries.count)", subtitle: "total logged")
                        SummaryCard(title: "Cost", value: totalCost.formatted(.currency(code: "USD")), subtitle: "all time")
                    }
                    SummaryCard(title: "Tokens", value: "\(totalTokens)", subtitle: "input + output")
                }
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)

                Section("Recent Usage") {
                    if entries.isEmpty {
                        Text("No usage logged yet.")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(entries.prefix(20)) { entry in
                            VStack(alignment: .leading, spacing: 4) {
                                Text(entry.promptTitle).font(.headline)
                                Text("\(entry.provider.rawValue) • \(entry.model)")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                                Text("\(entry.totalTokens) tokens • \(entry.cost.formatted(.currency(code: entry.currency)))")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            .padding(.vertical, 4)
                        }
                        .onDelete(perform: deleteEntries)
                    }
                }

                Section("Projects") {
                    if projects.isEmpty {
                        Text("No projects yet.")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(projects) { project in
                            Text(project.name)
                        }
                    }
                }
            }
            .navigationTitle("UsageLedger")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingAddEntry = true
                    } label: {
                        Label("Add Entry", systemImage: "plus")
                    }
                }
                ToolbarItem(placement: .topBarLeading) {
                    Button("Seed") { seedIfNeeded() }
                }
            }
            .sheet(isPresented: $showingAddEntry) {
                AddEntryView()
            }
        }
    }

    private func deleteEntries(offsets: IndexSet) {
        for index in offsets {
            modelContext.delete(entries[index])
        }
    }

    private func seedIfNeeded() {
        guard projects.isEmpty && entries.isEmpty else { return }
        let project = UsageProject(name: "Arthur")
        let session = UsageSession(name: "Nightly Training", project: project)
        let entry = UsageEntry(
            promptTitle: "Baseline eval",
            provider: .custom,
            model: "arthur-v3-65m",
            inputTokens: 1200,
            outputTokens: 280,
            cost: 0,
            notes: "Seed entry",
            project: project,
            session: session
        )
        modelContext.insert(project)
        modelContext.insert(session)
        modelContext.insert(entry)
    }
}

#Preview {
    ContentView()
        .modelContainer(for: [UsageEntry.self, UsageProject.self, UsageSession.self], inMemory: true)
}
