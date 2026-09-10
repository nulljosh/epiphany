import SwiftUI

struct StatementManagerSheet: View {
    let appState: AppState
    @Environment(\.dismiss) private var dismiss
    @State private var showFilePicker = false
    @State private var isUploading = false
    @State private var uploadError: String?
    @State private var statements: [Statement] = []
    @State private var selectedStatement: Statement?

    // ponytail: rows come from `statements` (the API's source of truth), not from
    // appState.financeData.spending — a freshly uploaded statement is always in the
    // former and only sometimes in the latter, which is why uploads looked like no-ops.
    private var sortedStatements: [Statement] {
        statements.sorted { ($0.spendingMonth?.sortKey ?? "") > ($1.spendingMonth?.sortKey ?? "") }
    }

    var body: some View {
        NavigationStack {
            List {
                if isUploading {
                    HStack(spacing: 10) {
                        ProgressView()
                        Text("Uploading statement…")
                            .foregroundStyle(.secondary)
                    }
                }
                if sortedStatements.isEmpty {
                    if !isUploading {
                        Text("No statements imported yet.")
                            .foregroundStyle(.secondary)
                    }
                } else {
                    ForEach(sortedStatements) { statement in
                        Button {
                            selectedStatement = statement
                        } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(statement.spendingMonth?.month ?? statement.filename)
                                        .font(.body.weight(.medium))
                                        .foregroundStyle(.primary)
                                    Text("\(statement.spendingMonth?.sortedCategories.count ?? 0) categories")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                Text(statement.spendingMonth?.total ?? 0, format: .currency(code: Locale.current.currency?.identifier ?? "USD").precision(.fractionLength(0)))
                                    .font(.body.weight(.semibold))
                                    .monospacedDigit()
                                    .foregroundStyle(.primary)
                            }
                            .padding(.vertical, 4)
                        }
                    }
                    .onDelete { offsets in
                        let toDelete = offsets.map { sortedStatements[$0] }
                        for statement in toDelete {
                            Task { await deleteStatement(statement) }
                        }
                    }
                }
            }
            .navigationTitle("Statements")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Done") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: { showFilePicker = true }) {
                        Image(systemName: "arrow.up.doc")
                    }
                    .disabled(isUploading)
                }
                if !statements.isEmpty {
                    ToolbarItem(placement: .topBarTrailing) {
                        EditButton()
                    }
                }
            }
            .fileImporter(isPresented: $showFilePicker, allowedContentTypes: [.pdf], onCompletion: { result in
                handleFileSelection(result)
            })
            // ponytail: a real two-way binding — `.constant(uploadError != nil)` swallowed
            // SwiftUI's dismissal write, so every upload failure was invisible.
            .alert("Upload Error", isPresented: Binding(
                get: { uploadError != nil },
                set: { if !$0 { uploadError = nil } }
            ), actions: {
                Button("OK") { uploadError = nil }
            }, message: {
                if let error = uploadError {
                    Text(error)
                }
            })
            .sheet(item: $selectedStatement) { statement in
                StatementTransactionsView(statement: statement) { updatedStatements in
                    statements = updatedStatements
                }
            }
            .task {
                do {
                    statements = try await EpiphanyAPI.shared.fetchStatements()
                } catch {
                    uploadError = error.localizedDescription
                }
            }
        }
    }

    private func deleteStatement(_ statement: Statement) async {
        do {
            statements = try await EpiphanyAPI.shared.deleteStatement(id: statement.id)
        } catch {
            uploadError = error.localizedDescription
        }
        await appState.deleteSpendingMonth(statement.spendingMonth?.month ?? "")
    }

    // ponytail: mirrors the server's cap. The real ceiling is Vercel's 4.5MB
    // serverless request-body limit, and we send the PDF base64-encoded (4/3
    // inflation) — so 3MB of PDF. Above that the platform 413s before the handler
    // runs, which is why oversized statements used to vanish with no error.
    private static let maxStatementBytes = 3 * 1024 * 1024

    private func handleFileSelection(_ result: Result<URL, Error>) {
        switch result {
        case .failure(let error):
            uploadError = "Failed to select file: \(error.localizedDescription)"
            return
        case .success(let url):
            // ponytail: a false return just means the URL isn't security-scoped (already
            // readable); only balance stopAccessing when we actually started it.
            let scoped = url.startAccessingSecurityScopedResource()
            defer { if scoped { url.stopAccessingSecurityScopedResource() } }

            do {
                let data = try Data(contentsOf: url)
                guard data.count <= Self.maxStatementBytes else {
                    let mb = Double(data.count) / 1024 / 1024
                    uploadError = String(format: "%@ is too large (%.1fMB) — statements must be under 3MB", url.lastPathComponent, mb)
                    return
                }
                upload(data: data, filename: url.lastPathComponent)
            } catch {
                uploadError = "Failed to read file: \(error.localizedDescription)"
            }
        }
    }

    private func upload(data: Data, filename: String) {
        let contentBase64 = data.base64EncodedString()
        isUploading = true
        Task {
            do {
                let updatedStatements = try await EpiphanyAPI.shared.uploadStatement(filename: filename, contentBase64: contentBase64)
                await MainActor.run {
                    isUploading = false
                    statements = updatedStatements
                    let newMonth = updatedStatements.first { $0.filename == filename }?.spendingMonth
                        ?? updatedStatements.last?.spendingMonth
                    if let newMonth {
                        // ponytail: financeData can be nil here (statements sheet is reachable
                        // before finance loads); optional-chained assignment used to drop the
                        // month silently, so seed the container instead.
                        var spending = appState.financeData?.spending ?? []
                        spending.removeAll { $0.month == newMonth.month }
                        spending.append(newMonth)
                        if appState.financeData != nil {
                            appState.financeData?.spending = spending
                        } else {
                            appState.financeData = FinanceData(spending: spending)
                        }
                    }
                }
            } catch {
                await MainActor.run {
                    isUploading = false
                    uploadError = error.localizedDescription
                }
            }
        }
    }
}

