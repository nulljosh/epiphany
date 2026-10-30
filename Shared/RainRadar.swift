import SwiftUI
import MapKit
import ImageIO

/// Newest RainViewer radar frame as one 512 px image centred on a point, at zoom 7 (the top zoom of the free API).
/// SwiftUI's Map has no tile overlays, so the image rides in an Annotation sized from the camera's span.
enum RainRadar {
    /// Longitude a 512 px zoom-7 image spans: two 256 px tiles of a 128-tile world.
    static let spanDegrees = 360.0 / 64

    struct Frame: Equatable {
        let path: String
        let time: Date
    }

    /// The last two hours of frames, oldest first (13, ten minutes apart).
    static func frames() async -> [Frame] {
        guard let url = URL(string: "https://api.rainviewer.com/public/weather-maps.json"),
              let (data, _) = try? await URLSession.shared.data(from: url),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let host = json["host"] as? String,
              let past = (json["radar"] as? [String: Any])?["past"] as? [[String: Any]] else { return [] }
        return past.compactMap { f in
            guard let path = f["path"] as? String, let t = f["time"] as? Double else { return nil }
            return Frame(path: host + path, time: Date(timeIntervalSince1970: t))
        }
    }

    /// Which frame plays at `date`: one every 0.7 s off the wall clock, holding the newest for three beats.
    /// The image and the time label both read it, so they stay in step without shared state.
    static func index(at date: Date, count: Int) -> Int {
        guard count > 0 else { return 0 }
        return min(Int(date.timeIntervalSince1970 / 0.7) % (count + 3), count - 1)
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

/// The radar frames around `center`, decoded once, played as a loop.
struct RainRadarLoop: View {
    let frames: [RainRadar.Frame]
    let center: CLLocationCoordinate2D
    let side: CGFloat
    @State private var images: [CGImage] = []

    var body: some View {
        // Sized up front: an annotation that starts at zero size stays there after the images arrive.
        TimelineView(.periodic(from: .now, by: 0.7)) { context in
            if images.isEmpty {
                Color.clear
            } else {
                Image(decorative: images[RainRadar.index(at: context.date, count: images.count)], scale: 1)
                    .resizable()
                    .opacity(0.6)
            }
        }
        .frame(width: side, height: side)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
        .task(id: "\(frames.last?.path ?? "")\(center.latitude),\(center.longitude)") {
            var loaded: [CGImage] = []
            for f in frames {
                guard let url = RainRadar.imageURL(path: f.path, center: center),
                      let (data, _) = try? await URLSession.shared.data(from: url),
                      let src = CGImageSourceCreateWithData(data as CFData, nil),
                      let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else { continue }
                loaded.append(img)
            }
            if !loaded.isEmpty { images = loaded }
        }
    }
}

/// "Radar 10:40" pill for the corner of the map, in step with RainRadarLoop.
struct RadarClock: View {
    let frames: [RainRadar.Frame]

    var body: some View {
        TimelineView(.periodic(from: .now, by: 0.7)) { context in
            let i = RainRadar.index(at: context.date, count: frames.count)
            Text("Radar \(frames[i].time.formatted(date: .omitted, time: .shortened))" + (i == frames.count - 1 ? " · latest" : ""))
                .font(.caption.monospacedDigit())
                .padding(.horizontal, 10).padding(.vertical, 5)
                .background(.regularMaterial, in: Capsule())
        }
        .allowsHitTesting(false)
    }
}

/// "Rainfall (warning) here · Metro Vancouver" across the top of the map when a warned area covers its centre.
struct WarningBanner: View {
    let alert: WeatherAlert

    var body: some View {
        HStack(spacing: 8) {
            Circle().fill(alert.fill).frame(width: 8, height: 8).accessibilityHidden(true)
            Text(alert.title + " here").fontWeight(.semibold).lineLimit(1)
        }
        .font(.footnote)
        .padding(.horizontal, 14).padding(.vertical, 7)
        .background(.regularMaterial, in: Capsule())
        .accessibilityElement(children: .combine)
    }
}
