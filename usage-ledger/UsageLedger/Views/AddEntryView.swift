import SwiftUI
import SwiftData

struct AddEntryView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \UsageProject.createdAt, order: .forward) private var projects: [UsageProject]

    @State private var title = ""
    @State private var provider: UsageProvider = .openAI
    @State private var model = ""
    @State private var inputTokens = 0
    @State private var outputTokens = 0
    @State private var cost = 0.0
    @State private var notes = ""
    @State private var selectedProject: UsageProject?
    @State private var newProjectName = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Entry") {
                    TextField("Prompt title", text: $title)
                    Picker("Provider", selection: $provider) {
                        ForEach(UsageProvider.allCases) { provider in
                            Text(provider.rawValue).tag(provider)
                        }
                    }
                    TextField("Model", text: $model)
                }

                Section("Usage") {
                    TextField("Input tokens", value: $inputTokens, format: .number)
                        .keyboardType(.numberPad)
                    TextField("Output tokens", value: $outputTokens, format: .number)
                        .keyboardType(.numberPad)
                    TextField("Cost", value: $cost, format: .number)
                        .keyboardType(.decimalPad)
                }

                Section("Project") {
                    if !projects.isEmpty {
                        Picker("Existing project", selection: $selectedProject) {
                            Text("None").tag(Optional<UsageProject>.none)
                            ForEach(projects) { project in
                                Text(project.name).tag(Optional(project))
                            }
                        }
                    }
                    TextField("Or new project", text: $newProjectName)
                }

                Section("Notes") {
                    TextField("Notes", text: $notes, axis: .vertical)
                }
            }
            .navigationTitle("Add Usage")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(title.isEmpty || model.isEmpty)
                }
            }
        }
    }

    private func save() {
        let project: UsageProject?
        if !newProjectName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            let created = UsageProject(name: newProjectName.trimmingCharacters(in: .whitespacesAndNewlines))
            modelContext.insert(created)
            project = created
        } else {
            project = selectedProject
        }

        let entry = UsageEntry(
            promptTitle: title,
            provider: provider,
            model: model,
            inputTokens: inputTokens,
            outputTokens: outputTokens,
            cost: cost,
            notes: notes,
            project: project
        )
        modelContext.insert(entry)
        dismiss()
    }
}
