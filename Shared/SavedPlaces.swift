import CoreLocation
import Foundation
import Observation
import SwiftUI

/// A place you keep an eye on (home, work), Citizen-style. Kept on this device.
struct SavedPlace: Codable, Identifiable, Hashable {
    var id = UUID()
    let name: String
    let latitude: Double
    let longitude: Double
    var coordinate: CLLocationCoordinate2D { CLLocationCoordinate2D(latitude: latitude, longitude: longitude) }
}

@MainActor
@Observable
final class SavedPlaces {
    static let shared = SavedPlaces()
    private static let key = "savedPlaces"
    private(set) var places: [SavedPlace]

    private init() {
        places = (UserDefaults.standard.data(forKey: Self.key))
            .flatMap { try? JSONDecoder().decode([SavedPlace].self, from: $0) } ?? []
    }

    func isSaved(_ c: CLLocationCoordinate2D) -> Bool { places.contains { Self.meters($0.coordinate, c) < 50 } }

    func toggle(name: String, at c: CLLocationCoordinate2D) {
        if isSaved(c) { places.removeAll { Self.meters($0.coordinate, c) < 50 } }
        else { places.append(SavedPlace(name: name, latitude: c.latitude, longitude: c.longitude)) }
        UserDefaults.standard.set(try? JSONEncoder().encode(places), forKey: Self.key)
    }

    /// How many of the given events sit within a kilometre of the place.
    static func nearbyCount(_ place: SavedPlace, events: [CLLocationCoordinate2D], radius: Double = 1000) -> Int {
        events.filter { meters(place.coordinate, $0) <= radius }.count
    }

    static func meters(_ a: CLLocationCoordinate2D, _ b: CLLocationCoordinate2D) -> Double {
        CLLocation(latitude: a.latitude, longitude: a.longitude).distance(from: CLLocation(latitude: b.latitude, longitude: b.longitude))
    }
}

/// Bookmark on a place card: tap to keep an eye on this place, tap again to let it go.
struct SavePlaceButton: View {
    let name: String
    let coordinate: CLLocationCoordinate2D
    private var store: SavedPlaces { .shared }

    var body: some View {
        let saved = store.isSaved(coordinate)
        Button { store.toggle(name: name, at: coordinate) } label: {
            Image(systemName: saved ? "bookmark.fill" : "bookmark")
                .font(.title3)
                .foregroundStyle(saved ? Color.accentColor : Color.secondary)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(saved ? "Remove from saved places" : "Save place")
    }
}

/// Map chip listing saved places with how much is going on near each. Hidden until one is saved.
struct SavedPlacesMenu: View {
    let events: [CLLocationCoordinate2D]
    let onPick: (SavedPlace) -> Void
    private var store: SavedPlaces { .shared }

    var body: some View {
        if !store.places.isEmpty {
            Menu {
                ForEach(store.places) { place in
                    let n = SavedPlaces.nearbyCount(place, events: events)
                    Button { onPick(place) } label: {
                        Text("\(place.name) · \(n == 0 ? "quiet" : "\(n) nearby")")
                    }
                }
            } label: {
                Label("Saved", systemImage: "bookmark.fill")
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 10).padding(.vertical, 7)
                    .foregroundStyle(.primary)
                    .liquidGlass(in: Capsule(), interactive: false, fallback: .ultraThinMaterial)
            }
            .fixedSize()
            .accessibilityLabel("Saved places")
        }
    }
}
