import MapKit
import SwiftUI

/// "12 min drive · 8.4 km" from where you are. Apple's ETA, no key. Hidden until it lands or if it fails.
struct DriveTimeLabel: View {
    let item: MKMapItem
    @State private var eta: MKDirections.ETAResponse?

    var body: some View {
        Group {
            if let eta {
                Label(text(eta), systemImage: "car.fill")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .task(id: item) { eta = await fetch() }
    }

    @MainActor
    private func fetch() async -> MKDirections.ETAResponse? {
        let request = MKDirections.Request()
        request.source = .forCurrentLocation()
        request.destination = item
        request.transportType = .automobile
        return try? await MKDirections(request: request).calculateETA()
    }

    private func text(_ eta: MKDirections.ETAResponse) -> String {
        let time = Duration.seconds(eta.expectedTravelTime)
            .formatted(.units(allowed: [.hours, .minutes], width: .abbreviated))
        let distance = Measurement(value: eta.distance, unit: UnitLength.meters)
            .formatted(.measurement(width: .abbreviated, usage: .road))
        return "\(time) drive · \(distance)"
    }
}
