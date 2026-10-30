import SwiftUI
import MapKit

/// An active tropical storm from /api/storms (National Hurricane Center: Atlantic, East and Central Pacific).
struct Storm: Decodable, Identifiable {
    let id: String
    let name: String
    let kind: String
    let windKt: Int?
    let lat: Double
    let lon: Double
    let movement: String?
    let track: [[Double]]?
    let cone: AlertShape?

    var coordinate: CLLocationCoordinate2D { CLLocationCoordinate2D(latitude: lat, longitude: lon) }

    var trackCoordinates: [CLLocationCoordinate2D] {
        (track ?? []).compactMap { $0.count >= 2 ? CLLocationCoordinate2D(latitude: $0[1], longitude: $0[0]) : nil }
    }

    var coneRings: [[CLLocationCoordinate2D]] {
        (cone?.rings ?? []).map { $0.compactMap { $0.count >= 2 ? CLLocationCoordinate2D(latitude: $0[1], longitude: $0[0]) : nil } }
    }

    var label: String { ["\(kind) \(name)", windKt.map { "\($0) kt" }].compactMap { $0 }.joined(separator: " · ") }
}

/// Forecast cone, forecast track and a pin at the centre of each storm, for either app's Map.
struct StormContent: MapContent {
    let storms: [Storm]

    var body: some MapContent {
        ForEach(storms) { storm in
            ForEach(Array(storm.coneRings.enumerated()), id: \.offset) { _, ring in
                MapPolygon(coordinates: ring).foregroundStyle(.orange.opacity(0.15))
            }
            if storm.trackCoordinates.count > 1 {
                MapPolyline(coordinates: storm.trackCoordinates)
                    .stroke(.red, style: StrokeStyle(lineWidth: 2, dash: [6, 4]))
            }
            Annotation(storm.label, coordinate: storm.coordinate) {
                Image(systemName: "hurricane")
                    .font(.headline.weight(.bold))
                    .foregroundStyle(.white)
                    .padding(6)
                    .background(Circle().fill(.red))
                    .accessibilityLabel(storm.label)
            }
        }
    }
}
