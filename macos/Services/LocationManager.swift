import CoreLocation
import Foundation

@MainActor
final class LocationManager: NSObject, ObservableObject {
    @Published var currentLocation: CLLocation?
    @Published var locationName: String = "Current Location"
    @Published var locationSubtitle: String = "Locating..."

    private let manager = CLLocationManager()
    private let geocoder = CLGeocoder()

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    func requestLocation() {
        let status = manager.authorizationStatus
        switch status {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        case .authorizedAlways, .authorizedWhenInUse:
            manager.requestLocation()
        case .denied, .restricted:
            locationName = "Current Location"
            locationSubtitle = "Location access denied"
        @unknown default:
            locationName = "Current Location"
            locationSubtitle = "Location unavailable"
        }
    }

    private func reverseGeocode(_ location: CLLocation) {
        geocoder.cancelGeocode()
        geocoder.reverseGeocodeLocation(location) { [weak self] placemarks, _ in
            guard let self else { return }

            Task { @MainActor in
                guard let place = placemarks?.first else {
                    self.locationName = "Current Location"
                    self.locationSubtitle = String(
                        format: "%.4f, %.4f",
                        location.coordinate.latitude,
                        location.coordinate.longitude
                    )
                    return
                }

                let primary = place.subLocality ?? place.locality ?? place.name ?? "Current Location"
                let locality = place.locality ?? place.subAdministrativeArea ?? place.administrativeArea

                self.locationName = primary
                if let locality, locality.caseInsensitiveCompare(primary) != .orderedSame {
                    self.locationSubtitle = locality
                } else {
                    self.locationSubtitle = "Live location"
                }
            }
        }
    }
}

extension LocationManager: CLLocationManagerDelegate {
    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in
            self.requestLocation()
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        Task { @MainActor in
            self.currentLocation = location
            self.reverseGeocode(location)
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in
            self.locationName = "Current Location"
            self.locationSubtitle = error.localizedDescription
        }
    }
}
