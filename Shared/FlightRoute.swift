import SwiftUI
import CoreLocation

/// Where a flight is going, from /api/flight-route (adsbdb by callsign).
struct FlightRoute: Decodable, Equatable {
    struct Airport: Decodable, Equatable {
        let code: String
        let city: String?
        let lat: Double
        let lon: Double
        var location: CLLocation { CLLocation(latitude: lat, longitude: lon) }
    }
    let airline: String?
    let origin: Airport
    let destination: Airport

    /// Share of the trip flown, 0 to 1, from where the plane is now.
    func progress(at coordinate: CLLocationCoordinate2D) -> Double {
        let here = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
        let flown = origin.location.distance(from: here)
        let left = here.distance(from: destination.location)
        return flown + left > 0 ? flown / (flown + left) : 0
    }

    func kmLeft(at coordinate: CLLocationCoordinate2D) -> Int {
        Int((CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude).distance(from: destination.location) / 1000).rounded())
    }
}

/// Origin to destination with a progress bar on a plane's detail sheet; nothing when the callsign has no known route.
struct FlightRouteCard: View {
    let flight: Flight
    @State private var route: FlightRoute?

    var body: some View {
        Group {
            if let route {
                let done = route.progress(at: flight.coordinate)
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        airport(route.origin, alignment: .leading)
                        Spacer()
                        Image(systemName: "airplane").foregroundStyle(.secondary)
                        Spacer()
                        airport(route.destination, alignment: .trailing)
                    }
                    ProgressView(value: done).tint(Palette.appleBlue)
                    Text("\(Int((done * 100).rounded()))% flown · \(route.kmLeft(at: flight.coordinate).formatted()) km to go" + (route.airline.map { " · \($0)" } ?? ""))
                        .font(.caption).foregroundStyle(.secondary)
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14))
                .accessibilityElement(children: .combine)
            }
        }
        .task(id: flight.callsign) {
            route = try? await EpiphanyAPI.shared.fetchFlightRoute(callsign: flight.callsign)
        }
    }

    private func airport(_ a: FlightRoute.Airport, alignment: HorizontalAlignment) -> some View {
        VStack(alignment: alignment, spacing: 2) {
            Text(a.code).font(.title3.weight(.bold))
            if let city = a.city { Text(city).font(.caption).foregroundStyle(.secondary) }
        }
    }
}
