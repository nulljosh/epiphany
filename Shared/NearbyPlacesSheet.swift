import MapKit
import SwiftUI

struct NearbyPlacesSheet: View {
    let center: CLLocationCoordinate2D
    let onSelect: (LocalEvent) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var places: [LocalEvent] = []
    @State private var events: [LocalEvent] = []
    @State private var section = 0
    @State private var query = ""
    @State private var isLoading = true
    @State private var error: String?

    private var filteredPlaces: [LocalEvent] {
        let items = section == 0 ? places : events
        guard !query.isEmpty else { return items }
        return items.filter {
            $0.title.localizedCaseInsensitiveContains(query) ||
            ($0.category?.localizedCaseInsensitiveContains(query) ?? false)
        }
    }

    var body: some View {
        NavigationStack {
            VStack {
                Picker("Browse", selection: $section) {
                    Text("Places").tag(0)
                    Text("Events").tag(1)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)
                if isLoading {
                    ProgressView("Loading mapped places")
                } else if let error {
                    ContentUnavailableView(error, systemImage: "wifi.exclamationmark")
                } else if filteredPlaces.isEmpty && section == 1 {
                    ContentUnavailableView("No verified local events", systemImage: "calendar")
                } else {
                    List(filteredPlaces) { place in
                        Button {
                            guard place.coordinate != nil else { return }
                            onSelect(place)
                            dismiss()
                        } label: {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(place.title).foregroundStyle(.primary)
                                Text(place.category ?? "Place")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                    .searchable(text: $query, prompt: "Find a place or category")
                }
            }
            .navigationTitle("Near map center")
            .safeAreaInset(edge: .bottom) {
                Text(section == 0
                     ? "\(filteredPlaces.count) mapped places · OpenStreetMap · about 6 km"
                     : "\(filteredPlaces.count) geolocated events · connected feeds")
                    .font(.caption).foregroundStyle(.secondary)
                    .padding(8)
            }
        }
        .task {
            do {
                places = try await EpiphanyAPI.shared.fetchPlaces(
                    lat: center.latitude, lon: center.longitude
                )
            } catch {
                self.error = "Places are temporarily unavailable"
            }
            isLoading = false
            events = (try? await EpiphanyAPI.shared.fetchLocalEvents(
                lat: center.latitude, lon: center.longitude
            ))?.filter { $0.kind == "event" && $0.source != "news_rss" && $0.coordinate != nil } ?? []
        }
    }
}
