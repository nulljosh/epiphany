import SwiftUI

struct GoalEditorSheet: View {
    @Binding var items: [FinanceData.Goal]
    let onSave: () -> Void
    @Environment(\.dismiss) private var dismiss

    private let priorities = ["low", "medium", "high"]

    var body: some View {
        NavigationStack {
            List {
                ForEach($items) { $item in
                    VStack(alignment: .leading, spacing: 8) {
                        TextField("Name", text: $item.name)
                            .font(.headline)
                        HStack {
                            Text("Target")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            TextField("0", value: $item.target, format: .number)
                                .keyboardType(.decimalPad)
                                .multilineTextAlignment(.trailing)
                        }
                        HStack {
                            Text("Saved")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            TextField("0", value: $item.saved, format: .number)
                                .keyboardType(.decimalPad)
                                .multilineTextAlignment(.trailing)
                        }
                        Picker("Priority", selection: $item.priority) {
                            ForEach(priorities, id: \.self) { Text($0.capitalized) }
                        }
                        .pickerStyle(.segmented)
                        TextField("Deadline (YYYY-MM)", text: Binding(
                            get: { item.deadline ?? "" },
                            set: { item.deadline = $0.isEmpty ? nil : $0 }
                        ))
                        .font(.caption)
                        TextField("Note", text: Binding(
                            get: { item.note ?? "" },
                            set: { item.note = $0.isEmpty ? nil : $0 }
                        ))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                }
                .onDelete { offsets in
                    items.remove(atOffsets: offsets)
                }

                Button {
                    items.append(FinanceData.Goal(name: "", target: 0, saved: 0, priority: "medium", deadline: nil, note: nil))
                } label: {
                    Label("Add Goal", systemImage: "plus.circle")
                }
            }
            .navigationTitle("Edit Goals")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        onSave()
                        dismiss()
                    }
                    .bold()
                }
            }
        }
    }
}

