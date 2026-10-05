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
                     ? "\(filteredPlaces.count) mapped places · about 3 km"
                     : "\(filteredPlaces.count) geolocated events · connected feeds")
                    .font(.caption).foregroundStyle(.secondary)
                    .padding(8)
            }
        }
        .task {
            // ponytail: Apple's POI search answers in about a second, so it fills the list first.
            // The fuller OpenStreetMap inventory (behind /api/places) replaces it when Overpass is up;
            // it can take 30s to fail when it's down, which used to be 30s of spinner.
            places = await Self.applePlaces(near: center)
            isLoading = places.isEmpty
            if let mapped = try? await EpiphanyAPI.shared.fetchPlaces(
                lat: center.latitude, lon: center.longitude
            ), !mapped.isEmpty { places = mapped }
            if places.isEmpty { error = "Places are temporarily unavailable" }
            isLoading = false
            events = (try? await EpiphanyAPI.shared.fetchLocalEvents(
                lat: center.latitude, lon: center.longitude
            ))?.filter { $0.kind == "event" && $0.source != "news_rss" && $0.coordinate != nil } ?? []
        }
    }

    private static func applePlaces(near center: CLLocationCoordinate2D) async -> [LocalEvent] {
        let request = MKLocalPointsOfInterestRequest(center: center, radius: 3000)
        guard let items = try? await MKLocalSearch(request: request).start().mapItems else { return [] }
        let rows: [[String: Any]] = items.compactMap { item in
            guard let name = item.name else { return nil }
            let coordinate = item.placemark.coordinate
            let category = item.pointOfInterestCategory?.rawValue.replacingOccurrences(of: "MKPOICategory", with: "")
            return ["title": name, "category": category ?? "Place", "lat": coordinate.latitude,
                    "lon": coordinate.longitude, "source": "Apple Maps", "kind": "place"]
        }
        guard let data = try? JSONSerialization.data(withJSONObject: rows) else { return [] }
        return ((try? JSONDecoder().decode([LocalEvent].self, from: data)) ?? [])
            .sorted { $0.title.localizedCompare($1.title) == .orderedAscending }
    }
}
