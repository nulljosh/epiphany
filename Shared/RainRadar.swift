import SwiftUI
import MapKit

/// Newest RainViewer radar frame as one 512 px image centred on a point, at zoom 7 (the top zoom of the free API).
/// SwiftUI's Map has no tile overlays, so the image rides in an Annotation sized from the camera's span.
enum RainRadar {
    /// Longitude a 512 px zoom-7 image spans: two 256 px tiles of a 128-tile world.
    static let spanDegrees = 360.0 / 64

    static func latestPath() async -> String? {
        guard let url = URL(string: "https://api.rainviewer.com/public/weather-maps.json"),
              let (data, _) = try? await URLSession.shared.data(from: url),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let host = json["host"] as? String,
              let past = (json["radar"] as? [String: Any])?["past"] as? [[String: Any]],
              let path = past.last?["path"] as? String else { return nil }
        return host + path
    }

    static func imageURL(path: String, center: CLLocationCoordinate2D) -> URL? {
        URL(string: String(format: "%@/512/7/%.2f/%.2f/2/1_1.png", path, center.latitude, center.longitude))
    }

    /// Side of the image in points for a map `mapWidth` points wide showing `longitudeDelta` degrees.
    static func side(mapWidth: CGFloat, longitudeDelta: Double) -> CGFloat {
        longitudeDelta > 0 ? mapWidth * spanDegrees / longitudeDelta : 0
    }

    /// Fetch a new frame once the view has moved a quarter of the image away from it.
    static func needsRecentre(_ center: CLLocationCoordinate2D?, for view: CLLocationCoordinate2D) -> Bool {
        guard let center else { return true }
        return abs(center.latitude - view.latitude) > spanDegrees / 8 || abs(center.longitude - view.longitude) > spanDegrees / 4
    }
}

struct RainRadarImage: View {
    let url: URL
    let side: CGFloat

    var body: some View {
        AsyncImage(url: url) { $0.resizable() } placeholder: { Color.clear }
            .frame(width: side, height: side)
            .opacity(0.6)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }
}
