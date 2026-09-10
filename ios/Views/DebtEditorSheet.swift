import SwiftUI

struct DebtEditorSheet: View {
    @Binding var items: [FinanceData.DebtItem]
    let onSave: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                ForEach($items) { $item in
                    VStack(alignment: .leading, spacing: 8) {
                        TextField("Name", text: $item.name)
                            .font(.headline)
                        HStack {
                            Text("Balance")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            TextField("0", value: $item.balance, format: .number)
                                .keyboardType(.decimalPad)
                                .multilineTextAlignment(.trailing)
                        }
                        HStack {
                            Text("Min Payment")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            TextField("0", value: $item.minPayment, format: .number)
                                .keyboardType(.decimalPad)
                                .multilineTextAlignment(.trailing)
                        }
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
                    items.append(FinanceData.DebtItem(name: "", balance: 0, rate: 0, minPayment: 0, note: nil))
                } label: {
                    Label("Add Debt", systemImage: "plus.circle")
                }
            }
            .navigationTitle("Edit Debt")
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

