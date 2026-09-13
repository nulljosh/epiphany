import MapKit
import SwiftUI

struct NearbyPlacesSheet: View {
    let center: CLLocationCoordinate2D
    let onSelect: (CLLocationCoordinate2D) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var places: [LocalEvent] = []
    @State private var query = ""
    @State private var isLoading = true
    @State private var error: String?

    private var filteredPlaces: [LocalEvent] {
        guard !query.isEmpty else { return places }
        return places.filter {
            $0.title.localizedCaseInsensitiveContains(query) ||
            ($0.category?.localizedCaseInsensitiveContains(query) ?? false)
        }
    }

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView("Loading mapped places")
                } else if let error {
                    ContentUnavailableView(error, systemImage: "wifi.exclamationmark")
                } else {
                    List(filteredPlaces) { place in
                        Button {
                            guard let coordinate = place.coordinate else { return }
                            onSelect(coordinate)
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
            .navigationTitle("Places near map center")
            .safeAreaInset(edge: .bottom) {
                Text("\(filteredPlaces.count) mapped places · OpenStreetMap · about 6 km")
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
        }
    }
}
