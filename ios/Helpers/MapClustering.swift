import CoreLocation
import MapKit

/// A grid cell's worth of nearby map items.
struct MapCluster<Item>: Identifiable {
    let id: String
    let coordinate: CLLocationCoordinate2D
    let items: [Item]

    var count: Int { items.count }
    /// Non-nil when this "cluster" is really just one pin, so callers can render
    /// the normal annotation instead of a count badge.
    var single: Item? { items.count == 1 ? items.first : nil }
}

/// Buckets `items` into a lat/lon grid sized off the visible span, so pin density
/// stays roughly flat as you zoom out instead of piling up into an unreadable mess.
///
/// ponytail: a grid, not a real clustering algorithm. SwiftUI's `Map`/`Annotation`
/// (the iOS 17 API this app uses) exposes no clustering of its own —
/// `clusteringIdentifier` lives on UIKit's `MKAnnotationView` — so this mirrors what
/// the web does with supercluster, minus the hierarchy. Known ceilings: cells are
/// fixed-size in degrees (so they skew physically narrower toward the poles) and it
/// doesn't handle the antimeridian. Upgrade path if either bites: drop to `MKMapView`
/// via `UIViewRepresentable` and use real `MKClusterAnnotation`s.
///
/// Nothing is dropped — every item lands in exactly one cluster.
func clusterByGrid<Item>(
    _ items: [Item],
    in span: MKCoordinateSpan,
    cellsAcross: Double = 10,
    coordinate: (Item) -> CLLocationCoordinate2D?
) -> [MapCluster<Item>] {
    let latCell = span.latitudeDelta / cellsAcross
    let lonCell = span.longitudeDelta / cellsAcross
    guard latCell.isFinite, lonCell.isFinite, latCell > 0, lonCell > 0 else {
        // Degenerate span — pass everything through unclustered rather than divide by zero.
        return items.compactMap { item in
            coordinate(item).map { MapCluster(id: "\($0.latitude),\($0.longitude)", coordinate: $0, items: [item]) }
        }
    }

    var order: [String] = []
    var buckets: [String: [(Item, CLLocationCoordinate2D)]] = [:]

    for item in items {
        guard let coord = coordinate(item), coord.latitude.isFinite, coord.longitude.isFinite else { continue }
        let row = (coord.latitude / latCell).rounded(.down)
        let col = (coord.longitude / lonCell).rounded(.down)
        let key = "\(row):\(col)"
        if buckets[key] == nil {
            buckets[key] = []
            order.append(key)
        }
        buckets[key]?.append((item, coord))
    }

    // Insertion order keeps SwiftUI's diffing stable between camera changes.
    return order.compactMap { key in
        guard let members = buckets[key], !members.isEmpty else { return nil }
        let latitude = members.reduce(0.0) { $0 + $1.1.latitude } / Double(members.count)
        let longitude = members.reduce(0.0) { $0 + $1.1.longitude } / Double(members.count)
        return MapCluster(
            id: key,
            coordinate: CLLocationCoordinate2D(latitude: latitude, longitude: longitude),
            items: members.map(\.0)
        )
    }
}
