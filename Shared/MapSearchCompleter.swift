import MapKit

/// As-you-type place suggestions for the map search bar.
///
/// ponytail: MKLocalSearchCompleter is Apple's built-in autocomplete — no HTTP
/// client, no debounce timer, no API key, no dependency. (Web can't use it, so
/// `LiveMapBackdrop.jsx` hits Nominatim with a hand-rolled 300ms debounce
/// instead; that difference is expected, not drift.)
@MainActor
@Observable
final class MapSearchCompleter: NSObject, @preconcurrency MKLocalSearchCompleterDelegate {
    var results: [MKLocalSearchCompletion] = []

    private let completer = MKLocalSearchCompleter()

    override init() {
        super.init()
        completer.delegate = self
        completer.resultTypes = [.address, .pointOfInterest]
    }

    /// Bias suggestions to whatever the user is currently looking at, matching
    /// how `searchVenues` uses the visible region rather than the GPS region.
    func update(query: String, region: MKCoordinateRegion?) {
        let trimmed = query.trimmingCharacters(in: .whitespaces)
        // Matches web's 3-character floor — shorter fragments return noise.
        guard trimmed.count >= 3 else {
            clear()
            return
        }
        if let region { completer.region = region }
        completer.queryFragment = trimmed
    }

    func clear() {
        results = []
        if completer.isSearching { completer.cancel() }
    }

    /// Resolve a suggestion to real coordinates. Picking a suggestion still
    /// costs one lookup — MKLocalSearchCompletion carries no coordinate.
    func coordinate(for completion: MKLocalSearchCompletion) async -> CLLocationCoordinate2D? {
        let request = MKLocalSearch.Request(completion: completion)
        guard let response = try? await MKLocalSearch(request: request).start() else { return nil }
        return response.mapItems.first?.placemark.coordinate
    }

    // ponytail: @preconcurrency on the conformance (above) is what lets these stay
    // main-actor isolated — MapKit calls them on the main thread but its protocol
    // isn't annotated, and MKLocalSearchCompletion isn't Sendable, so hopping
    // actors here would need a copy that can't legally cross.
    func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
        results = completer.results
    }

    func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
        results = []
    }
}
