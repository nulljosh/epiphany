import SwiftUI

/// A named watchlist beyond the main one (server/api/watchlist-lists.js).
struct WatchlistList: Codable, Hashable, Identifiable {
    var name: String
    var symbols: [String]
    var id: String { name }
}

private struct WatchlistListsBody: Codable { let lists: [WatchlistList] }

extension EpiphanyAPI {
    func fetchWatchlistLists() async throws -> [WatchlistList] {
        try await watchlistListsRequest(method: "GET", body: nil)
    }

    @discardableResult
    func saveWatchlistLists(_ lists: [WatchlistList]) async throws -> [WatchlistList] {
        try await watchlistListsRequest(method: "PUT", body: try JSONEncoder().encode(WatchlistListsBody(lists: lists)))
    }
}

/// Header for the Watchlist section: pick the main list or a named one, or start a new one.
struct WatchlistListPicker: View {
    let lists: [WatchlistList]
    @Binding var active: String?
    let onCreate: (String) -> Void
    let onDelete: (String) -> Void
    @State private var naming = false
    @State private var draft = ""

    var body: some View {
        Menu {
            Picker("List", selection: $active) {
                Text("Watchlist").tag(String?.none)
                ForEach(lists) { Text($0.name).tag(Optional($0.name)) }
            }
            Button("New list…", systemImage: "plus") { draft = ""; naming = true }
            if let active {
                Button("Delete \(active)", systemImage: "trash", role: .destructive) { onDelete(active) }
            }
        } label: {
            HStack(spacing: 4) {
                Text(active ?? "Watchlist")
                Image(systemName: "chevron.down").font(.caption2.weight(.bold))
            }
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(.primary)
        }
        .fixedSize()
        .alert("New list", isPresented: $naming) {
            TextField("Name", text: $draft)
            Button("Create") {
                let name = draft.trimmingCharacters(in: .whitespaces)
                if !name.isEmpty { onCreate(name); active = name }
            }
            Button("Cancel", role: .cancel) {}
        }
    }
}

/// "Add to list" for a stock's context menu. Hidden until a named list exists.
struct AddToListMenu: View {
    let symbol: String
    let lists: [WatchlistList]
    let onToggle: (String, String) -> Void  // (list name, symbol)

    var body: some View {
        if !lists.isEmpty {
            Menu("Lists", systemImage: "list.bullet") {
                ForEach(lists) { list in
                    let on = list.symbols.contains(symbol)
                    Button(list.name, systemImage: on ? "checkmark" : "plus") { onToggle(list.name, symbol) }
                }
            }
        }
    }
}

// Kept out of AppState so that file stays small; same on iPhone and Mac.
extension AppState {
    func loadWatchlistLists() async {
        guard isLoggedIn else { return }
        if let lists = try? await EpiphanyAPI.shared.fetchWatchlistLists() { watchlistLists = lists }
    }

    /// Saves locally first so the screen answers at once; the server cleans and confirms.
    func updateWatchlistLists(_ lists: [WatchlistList]) {
        watchlistLists = lists
        Task { if let saved = try? await EpiphanyAPI.shared.saveWatchlistLists(lists) { watchlistLists = saved } }
    }

    func toggle(_ symbol: String, inList name: String) {
        updateWatchlistLists(watchlistLists.map { list in
            guard list.name == name else { return list }
            var l = list
            if let i = l.symbols.firstIndex(of: symbol) { l.symbols.remove(at: i) } else { l.symbols.append(symbol) }
            return l
        })
    }
}
