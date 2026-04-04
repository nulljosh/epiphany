import CoreLocation
import MapKit
import Network
import SwiftUI
import UIKit

struct SituationView: View {
    @State private var locationManager = LocationManager()
    @State private var mapPosition = MapCameraPosition.region(LocationManager.fallbackRegion)

    @State private var earthquakes: [Earthquake] = []
    @State private var flights: [Flight] = []
    @State private var incidents: [Incident] = []
    @State private var weatherAlerts: [WeatherAlert] = []
    @State private var crimeIncidents: [CrimeIncident] = []
    @State private var localEvents: [LocalEvent] = []
    @State private var trafficData: TrafficData?
    @State private var wildfires: [Wildfire] = []

    @State private var error: String?
    @State private var flightStatusMessage: String?
    @State private var hasLoaded = false
    @State private var showLiveMap = false
    @State private var selectedEvent: MapEventDetail?
    @State private var loadTask: Task<Void, Never>?
    @State private var isLoadingData = false
    @State private var isOffline = false
    @State private var networkMonitor: NWPathMonitor?
    @State private var lastSnapshotSave: Date = .distantPast
    @State private var loadRegionId: UUID?

    @AppStorage("showEarthquakes") private var showEarthquakes = true
    @AppStorage("showFlights") private var showFlights = true
    @AppStorage("showIncidents") private var showIncidents = true
    @AppStorage("showWeatherAlerts") private var showWeatherAlerts = true
    @AppStorage("showCrime") private var showCrime = true
    @AppStorage("showLocalEvents") private var showLocalEvents = true
    @AppStorage("showTraffic") private var showTraffic = true
    @AppStorage("showWildfires") private var showWildfires = true

    private var currentRegion: MKCoordinateRegion {
        locationManager.region ?? LocationManager.fallbackRegion
    }

    var body: some View {
        Group {
            if showLiveMap {
                mapView
            } else {
                mapPlaceholder
            }
        }
        .ignoresSafeArea()
        .onAppear {
            startNetworkMonitor()
            guard !hasLoaded else { return }
            hasLoaded = true
            restoreSnapshot()
            showLiveMap = true
            locationManager.requestLocation()
        }
        .onDisappear {
            networkMonitor?.cancel()
            networkMonitor = nil
        }
        .onChange(of: locationManager.locationUpdateCount) { _, _ in
            guard let region = locationManager.region else { return }
            let needsFlyTo = needsMapFlyTo(to: region)

            if needsFlyTo {
                mapPosition = .region(region)
            }
            guard !isOffline else { return }
            Task {
                await loadData(region: region)
            }
        }
        .onChange(of: isOffline) { _, offline in
            if !offline, let region = locationManager.region {
                Task { await loadData(region: region) }
            }
        }
        .sheet(item: $selectedEvent) { event in
            NavigationStack {
                SituationEventDetailView(event: event)
            }
            .presentationDetents([.medium, .large])
        }
    }

    // MARK: - Annotations

    @MapContentBuilder
    private var earthquakeAnnotations: some MapContent {
        if showEarthquakes {
            ForEach(Array(earthquakes.prefix(maxAnnotationsPerCategory))) { quake in
                Annotation(quake.place ?? quake.title, coordinate: quake.coordinate) {
                    Button {
                        Haptics.impact(.light)
                        selectedEvent = .earthquake(quake)
                    } label: {
                        sfPin("mountain.2.fill", color: .orange)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    @MapContentBuilder
    private var flightAnnotations: some MapContent {
        if showFlights {
            ForEach(flights) { flight in
                Annotation("Flight \(flight.callsign)", coordinate: flight.coordinate) {
                    Button {
                        Haptics.impact(.light)
                        selectedEvent = .flight(flight)
                    } label: {
                        sfPin("airplane", color: .cyan)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private let maxAnnotationsPerCategory = 15

    @MapContentBuilder
    private var incidentAnnotations: some MapContent {
        if showIncidents {
            ForEach(Array(incidents.prefix(maxAnnotationsPerCategory))) { incident in
                Annotation(incident.title, coordinate: incident.coordinate) {
                    Button {
                        Haptics.impact(.medium)
                        selectedEvent = .incident(incident)
                    } label: {
                        sfPin(incidentSymbol(incident.title), color: incidentColor(incident.title))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func incidentSymbol(_ title: String) -> String {
        let t = title.lowercased()
        if t.contains("police") { return "shield.fill" }
        if t.contains("fire") || t.contains("hydrant") { return "flame.fill" }
        if t.contains("hospital") || t.contains("emergency") { return "cross.fill" }
        if t.contains("construction") || t.contains("road_works") { return "cone.fill" }
        if t.contains("border") || t.contains("crossing") { return "person.fill.checkmark" }
        if t.contains("accident") || t.contains("crash") { return "exclamationmark.triangle.fill" }
        if t.contains("closure") || t.contains("blocked") { return "xmark.octagon.fill" }
        if t.contains("hazard") { return "exclamationmark.triangle.fill" }
        if t.contains("flood") || t.contains("water") { return "drop.fill" }
        return "exclamationmark.triangle.fill"
    }

    private func incidentColor(_ title: String) -> Color {
        let t = title.lowercased()
        if t.contains("police") { return .blue }
        if t.contains("fire") || t.contains("hydrant") { return .red }
        if t.contains("hospital") || t.contains("emergency") { return .red }
        if t.contains("accident") || t.contains("crash") { return .orange }
        if t.contains("construction") || t.contains("road_works") { return .yellow }
        if t.contains("closure") || t.contains("blocked") { return .red }
        if t.contains("hazard") { return .orange }
        return .orange
    }

    @MapContentBuilder
    private var weatherAnnotations: some MapContent {
        if showWeatherAlerts {
            ForEach(weatherAlerts) { alert in
                if let coord = alert.coordinate {
                    Annotation(alert.title, coordinate: coord) {
                        Button {
                            Haptics.impact(.medium)
                            selectedEvent = .weatherAlert(alert)
                        } label: {
                            sfPin("cloud.bolt.fill", color: .yellow)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    @MapContentBuilder
    private var crimeAnnotations: some MapContent {
        if showCrime {
            ForEach(Array(crimeIncidents.prefix(maxAnnotationsPerCategory))) { crime in
                Annotation(crime.title, coordinate: crime.coordinate) {
                    Button {
                        Haptics.impact(.medium)
                        selectedEvent = .crime(crime)
                    } label: {
                        sfPin("exclamationmark.circle.fill", color: .red)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    @MapContentBuilder
    private var localEventAnnotations: some MapContent {
        if showLocalEvents {
            ForEach(locatableLocalEvents) { event in
                if let coord = event.coordinate {
                    Annotation(event.title, coordinate: coord) {
                        Button {
                            Haptics.impact(.light)
                            selectedEvent = .localEvent(event)
                        } label: {
                            sfPin("mappin", color: .green)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    @MapContentBuilder
    private var trafficAnnotations: some MapContent {
        if showTraffic {
            ForEach(trafficData?.incidents ?? []) { incident in
                if let coord = incident.coordinate {
                    Annotation(incident.title ?? "Traffic", coordinate: coord) {
                        Button {
                            Haptics.impact(.light)
                            selectedEvent = .trafficIncident(incident)
                        } label: {
                            sfPin("car.fill", color: .mint)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    @MapContentBuilder
    private var wildfireAnnotations: some MapContent {
        if showWildfires {
            ForEach(wildfires) { fire in
                Annotation("Wildfire", coordinate: fire.coordinate) {
                    Image(systemName: "flame.fill")
                        .font(.caption)
                        .foregroundStyle(.orange)
                        .padding(4)
                        .background(.black.opacity(0.6), in: Circle())
                }
            }
        }
    }

    // MARK: - Computed helpers

    private var locatableLocalEvents: [LocalEvent] {
        localEvents.filter { $0.coordinate != nil }
    }

    private var totalEventCount: Int {
        earthquakes.count + flights.count + incidents.count + weatherAlerts.count
        + crimeIncidents.count + locatableLocalEvents.count
        + (trafficData?.incidents?.count ?? 0) + wildfires.count
    }

    private var allSourcesDisabled: Bool {
        !showEarthquakes && !showFlights && !showIncidents && !showWeatherAlerts
        && !showCrime && !showLocalEvents && !showTraffic && !showWildfires
    }

    // MARK: - Overlays

    @ViewBuilder
    private var errorOverlay: some View {
        if let error {
            HStack(spacing: 6) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(.orange)
                Text(error)
                    .font(.caption)
                    .lineLimit(2)
                Spacer(minLength: 4)
                Button("Retry") {
                    if let region = locationManager.region {
                        Task { await loadData(region: region) }
                    }
                }
                .font(.caption.weight(.semibold))
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(.ultraThinMaterial, in: Capsule())
            .padding(.horizontal)
            .padding(.top, 60)
            .transition(.move(edge: .top).combined(with: .opacity))
        }
    }

    @ViewBuilder
    private var statusOverlay: some View {
        if isOffline {
            HStack(spacing: 6) {
                Image(systemName: "wifi.slash")
                    .foregroundStyle(.secondary)
                Text("Offline -- showing cached data")
                    .font(.caption2.weight(.medium))
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(.ultraThinMaterial, in: Capsule())
            .padding(.bottom, 100)
        } else if isLoadingData {
            HStack(spacing: 6) {
                ProgressView()
                    .controlSize(.mini)
                Text("Updating...")
                    .font(.caption2.weight(.medium))
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(.ultraThinMaterial, in: Capsule())
            .padding(.bottom, 100)
        } else if totalEventCount == 0 && allSourcesDisabled {
            Text("Enable data sources in Settings")
                .font(.caption)
                .foregroundStyle(.secondary)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(.ultraThinMaterial, in: Capsule())
                .padding(.bottom, 100)
        } else if totalEventCount > 0 && totalEventCount < 3 {
            Text("Quiet area -- \(totalEventCount) events found")
                .font(.caption2.weight(.medium))
                .foregroundStyle(.secondary)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(.ultraThinMaterial, in: Capsule())
                .padding(.bottom, 100)
        } else if totalEventCount >= 3 {
            Text("\(totalEventCount) events nearby")
                .font(.caption2.weight(.medium))
                .foregroundStyle(.secondary)
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(.ultraThinMaterial, in: Capsule())
                .padding(.bottom, 100)
        }
    }

    // MARK: - Map

    private var mapView: some View {
        Map(position: $mapPosition) {
            earthquakeAnnotations
            flightAnnotations
            incidentAnnotations
            weatherAnnotations
            crimeAnnotations
            localEventAnnotations
            trafficAnnotations
            wildfireAnnotations
            UserAnnotation()
        }
        .mapStyle(.standard(elevation: .realistic))
        .onMapCameraChange(frequency: .onEnd) { context in
            let region = context.region
            loadTask?.cancel()
            loadTask = Task {
                try? await Task.sleep(for: .milliseconds(500))
                guard !Task.isCancelled else { return }
                guard !isOffline else { return }
                await loadData(region: region)
            }
        }
        .overlay(alignment: .top) { errorOverlay }
        .overlay(alignment: .bottom) { statusOverlay }
        .overlay(alignment: .bottomTrailing) { currentLocationButton }
    }

    @ViewBuilder
    private var currentLocationButton: some View {
        Button {
            Haptics.impact(.light)
            if let region = locationManager.region {
                withAnimation { mapPosition = .region(region) }
            } else {
                withAnimation { mapPosition = .userLocation(fallback: .automatic) }
            }
        } label: {
            Image(systemName: "location.fill")
                .font(.body.weight(.medium))
                .foregroundStyle(.white)
                .frame(width: 44, height: 44)
                .background(.ultraThinMaterial, in: Circle())
        }
        .padding(.trailing, 12)
        .padding(.bottom, 120)
    }

    private var mapPlaceholder: some View {
        Palette.bg
    }

    private func sfPin(_ systemName: String, color: Color = .white) -> some View {
        Image(systemName: systemName)
            .font(.title2)
            .foregroundStyle(color)
            .shadow(color: .black.opacity(0.5), radius: 2, y: 1)
    }

    // MARK: - Network monitor

    private func startNetworkMonitor() {
        let monitor = NWPathMonitor()
        monitor.pathUpdateHandler = { path in
            Task { @MainActor in
                let offline = path.status != .satisfied
                if isOffline != offline {
                    withAnimation(.easeInOut) {
                        isOffline = offline
                    }
                }
            }
        }
        monitor.start(queue: DispatchQueue(label: "network-monitor"))
        networkMonitor = monitor
    }

    // MARK: - Data loading (incremental, per-source Tasks)

    private func loadData(region: MKCoordinateRegion) async {
        error = nil
        flightStatusMessage = nil
        isLoadingData = true

        let regionId = UUID()
        loadRegionId = regionId

        let center = region.center
        let span = region.span
        let lamin = center.latitude - span.latitudeDelta / 2
        let lamax = center.latitude + span.latitudeDelta / 2
        let lomin = center.longitude - span.longitudeDelta / 2
        let lomax = center.longitude + span.longitudeDelta / 2

        let completion = LoadCompletion(total: 8)

        // Each source loads independently and applies state as soon as it arrives.
        // No source blocks another.

        Task { @MainActor in
            defer { Task { await completion.done() } }
            guard showEarthquakes else { earthquakes = []; return }
            let r = await loadSection(label: "Earthquakes") { try await MonicaAPI.shared.fetchEarthquakes() }
            guard loadRegionId == regionId else { return }
            if r.error == nil || !r.value.isEmpty { earthquakes = r.value }
            if let e = r.error { await completion.addError(e) }
        }

        Task { @MainActor in
            defer { Task { await completion.done() } }
            guard showFlights else { flights = []; return }
            let r = await loadFlights(lamin: lamin, lomin: lomin, lamax: lamax, lomax: lomax)
            guard loadRegionId == regionId else { return }
            if r.error == nil || !r.value.isEmpty { flights = r.value }
            flightStatusMessage = r.error
        }

        Task { @MainActor in
            defer { Task { await completion.done() } }
            guard showIncidents else { incidents = []; return }
            let r = await loadSection(label: "Incidents") { try await MonicaAPI.shared.fetchIncidents(lat: center.latitude, lon: center.longitude, lamin: lamin, lomin: lomin, lamax: lamax, lomax: lomax) }
            guard loadRegionId == regionId else { return }
            if r.error == nil || !r.value.isEmpty { incidents = r.value.filter { !Incident.isLowSignal($0.title) } }
            if let e = r.error { await completion.addError(e) }
        }

        Task { @MainActor in
            defer { Task { await completion.done() } }
            guard showWeatherAlerts else { weatherAlerts = []; return }
            let r = await loadSection(label: "Weather") { try await MonicaAPI.shared.fetchWeatherAlerts(lat: center.latitude, lon: center.longitude) }
            guard loadRegionId == regionId else { return }
            if r.error == nil || !r.value.isEmpty { weatherAlerts = r.value }
            if let e = r.error { await completion.addError(e) }
        }

        Task { @MainActor in
            defer { Task { await completion.done() } }
            guard showCrime else { crimeIncidents = []; return }
            let r = await loadSection(label: "Crime") { try await MonicaAPI.shared.fetchCrime(lat: center.latitude, lon: center.longitude) }
            guard loadRegionId == regionId else { return }
            if r.error == nil || !r.value.isEmpty { crimeIncidents = r.value }
            if let e = r.error { await completion.addError(e) }
        }

        Task { @MainActor in
            defer { Task { await completion.done() } }
            guard showLocalEvents else { localEvents = []; return }
            let r = await loadSection(label: "Local Events") { try await MonicaAPI.shared.fetchLocalEvents(lat: center.latitude, lon: center.longitude) }
            guard loadRegionId == regionId else { return }
            if r.error == nil || !r.value.isEmpty { localEvents = r.value }
            if let e = r.error { await completion.addError(e) }
        }

        Task { @MainActor in
            defer { Task { await completion.done() } }
            guard showTraffic else { trafficData = nil; return }
            let result = try? await MonicaAPI.shared.fetchTraffic(lat: center.latitude, lon: center.longitude, lamin: lamin, lomin: lomin, lamax: lamax, lomax: lomax)
            guard loadRegionId == regionId else { return }
            trafficData = result
        }

        Task { @MainActor in
            defer { Task { await completion.done() } }
            guard showWildfires else { wildfires = []; return }
            let r = await loadSection(label: "Wildfires") { try await MonicaAPI.shared.fetchWildfires(lat: center.latitude, lon: center.longitude) }
            guard loadRegionId == regionId else { return }
            if r.error == nil || !r.value.isEmpty { wildfires = r.value }
            if let e = r.error { await completion.addError(e) }
        }

        // Wait for all sources, then finalize
        await completion.waitForAll()

        // Auto-widen: if results are sparse, expand search area and re-fetch sparse sources
        let currentTotal = totalEventCount
        let currentSpan = span.latitudeDelta
        if currentTotal < 5 && currentSpan < 0.5 {
            let wideFactor = 3.0
            let wideLamin = center.latitude - (span.latitudeDelta * wideFactor / 2)
            let wideLamax = center.latitude + (span.latitudeDelta * wideFactor / 2)
            let wideLomin = center.longitude - (span.longitudeDelta * wideFactor / 2)
            let wideLomax = center.longitude + (span.longitudeDelta * wideFactor / 2)
            let centerLat = center.latitude
            let centerLon = center.longitude

            let needIncidents = showIncidents && incidents.count < 3
            let needCrime = showCrime && crimeIncidents.isEmpty
            let needEvents = showLocalEvents && localEvents.count < 3
            let currentIncidents = incidents
            let currentCrime = crimeIncidents
            let currentLocal = localEvents

            if needIncidents {
                let r = await loadSection(label: "Incidents") {
                    try await MonicaAPI.shared.fetchIncidents(lat: centerLat, lon: centerLon, lamin: wideLamin, lomin: wideLomin, lamax: wideLamax, lomax: wideLomax)
                }
                guard loadRegionId == regionId else { isLoadingData = false; return }
                if r.value.count > currentIncidents.count { incidents = r.value.filter { !Incident.isLowSignal($0.title) } }
            }
            if needCrime {
                let r = await loadSection(label: "Crime") {
                    try await MonicaAPI.shared.fetchCrime(lat: centerLat, lon: centerLon)
                }
                guard loadRegionId == regionId else { isLoadingData = false; return }
                if r.value.count > currentCrime.count { crimeIncidents = r.value }
            }
            if needEvents {
                let r = await loadSection(label: "Local Events") {
                    try await MonicaAPI.shared.fetchLocalEvents(lat: centerLat, lon: centerLon)
                }
                guard loadRegionId == regionId else { isLoadingData = false; return }
                if r.value.count > currentLocal.count { localEvents = r.value }
            }
        }

        isLoadingData = false

        let failures = await completion.errors
        if !failures.isEmpty {
            withAnimation(.easeInOut) {
                error = failures.joined(separator: "  ")
            }
            Task {
                try? await Task.sleep(for: .seconds(5))
                withAnimation(.easeInOut) {
                    error = nil
                }
            }
        }

        throttledSaveSnapshot()
    }

    private func loadFlights(
        lamin: Double,
        lomin: Double,
        lamax: Double,
        lomax: Double
    ) async -> (value: [Flight], error: String?) {
        do {
            let flights = try await MonicaAPI.shared.fetchFlights(
                lamin: lamin,
                lomin: lomin,
                lamax: lamax,
                lomax: lomax
            )
            return (flights, nil)
        } catch let apiError as APIError {
            if case .httpError(let code, _) = apiError, code == 502 {
                return ([], "Flights unavailable")
            }
            return ([], "Flights unavailable")
        } catch {
            return ([], "Flights unavailable")
        }
    }

    private func loadSection<T>(
        label: String,
        _ operation: () async throws -> T
    ) async -> (value: T, error: String?) where T: RangeReplaceableCollection {
        do {
            return (try await operation(), nil)
        } catch {
            return (.init(), "\(label) unavailable")
        }
    }

    // MARK: - Snapshot

    private func restoreSnapshot() {
        guard let data = UserDefaults.standard.data(forKey: snapshotKey),
              let snapshot = try? JSONDecoder().decode(SituationSnapshot.self, from: data)
        else {
            return
        }

        if let lat = snapshot.centerLatitude, let lon = snapshot.centerLongitude {
            let region = MKCoordinateRegion(
                center: CLLocationCoordinate2D(latitude: lat, longitude: lon),
                span: MKCoordinateSpan(latitudeDelta: 0.08, longitudeDelta: 0.08)
            )
            mapPosition = .region(region)
        }

        earthquakes = snapshot.earthquakes
        flights = snapshot.flights
        incidents = snapshot.incidents
        weatherAlerts = snapshot.weatherAlerts
        crimeIncidents = snapshot.crimeIncidents ?? []
        localEvents = snapshot.localEvents ?? []
        flightStatusMessage = snapshot.flightStatusMessage
    }

    private func throttledSaveSnapshot() {
        let now = Date()
        guard now.timeIntervalSince(lastSnapshotSave) >= 5 else { return }
        lastSnapshotSave = now
        saveSnapshot()
    }

    private func saveSnapshot() {
        let center = currentRegion.center
        let snapshot = SituationSnapshot(
            centerLatitude: center.latitude,
            centerLongitude: center.longitude,
            earthquakes: earthquakes,
            flights: flights,
            incidents: incidents,
            weatherAlerts: weatherAlerts,
            crimeIncidents: crimeIncidents,
            localEvents: localEvents,
            flightStatusMessage: flightStatusMessage
        )

        guard let data = try? JSONEncoder().encode(snapshot) else { return }
        UserDefaults.standard.set(data, forKey: snapshotKey)
    }

    private func needsMapFlyTo(to region: MKCoordinateRegion) -> Bool {
        guard let current = mapPosition.region else { return true }
        let dLat = abs(current.center.latitude - region.center.latitude)
        let dLon = abs(current.center.longitude - region.center.longitude)
        return dLat > 0.005 || dLon > 0.005
    }

    private var snapshotKey: String {
        "situation.snapshot.v2"
    }
}

// MARK: - Load Completion Actor

private actor LoadCompletion {
    private let total: Int
    private var completed = 0
    private var _errors: [String] = []
    private var continuation: CheckedContinuation<Void, Never>?

    init(total: Int) {
        self.total = total
    }

    func done() {
        completed += 1
        if completed >= total {
            continuation?.resume()
            continuation = nil
        }
    }

    func addError(_ error: String) {
        _errors.append(error)
    }

    var errors: [String] { _errors }

    func waitForAll() async {
        if completed >= total { return }
        await withCheckedContinuation { cont in
            if completed >= total {
                cont.resume()
            } else {
                continuation = cont
            }
        }
    }
}

// MARK: - Location Manager

@MainActor
@Observable
private final class LocationManager: NSObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    var region: MKCoordinateRegion?
    var placeName: String?
    var locationUpdateCount = 0
    private var hasResolved = false

    static let fallbackRegion = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 40.7128, longitude: -74.0060),
        span: MKCoordinateSpan(latitudeDelta: 0.08, longitudeDelta: 0.08)
    )

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyKilometer
    }

    func requestLocation() {
        let status = manager.authorizationStatus
        switch status {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        case .authorizedWhenInUse, .authorizedAlways:
            manager.requestLocation()
        default:
            applyFallback()
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        Task { @MainActor in
            guard !hasResolved else { return }
            hasResolved = true
            let coord = location.coordinate
            region = MKCoordinateRegion(
                center: coord,
                span: MKCoordinateSpan(latitudeDelta: 0.08, longitudeDelta: 0.08)
            )
            locationUpdateCount += 1
            reverseGeocode(location)
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in
            guard !hasResolved else { return }
            applyFallback()
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        Task { @MainActor in
            switch status {
            case .authorizedWhenInUse, .authorizedAlways:
                if !hasResolved {
                    self.manager.requestLocation()
                }
            case .denied, .restricted:
                if !hasResolved {
                    applyFallback()
                }
            default:
                break
            }
        }
    }

    private func applyFallback() {
        hasResolved = true
        region = Self.fallbackRegion
        placeName = "New York"
        locationUpdateCount += 1
    }

    private func reverseGeocode(_ location: CLLocation) {
        let geocoder = CLGeocoder()
        geocoder.reverseGeocodeLocation(location) { placemarks, _ in
            Task { @MainActor [weak self] in
                self?.placeName = placemarks?.first?.locality ?? "Current Location"
            }
        }
    }
}

// MARK: - Event Detail

private enum MapEventDetail: Identifiable {
    case earthquake(Earthquake)
    case flight(Flight)
    case incident(Incident)
    case weatherAlert(WeatherAlert)
    case crime(CrimeIncident)
    case localEvent(LocalEvent)
    case trafficIncident(TrafficData.TrafficIncident)

    var id: String {
        switch self {
        case .earthquake(let quake):
            return "quake-\(quake.id)"
        case .flight(let flight):
            return "flight-\(flight.id)"
        case .incident(let incident):
            return "incident-\(incident.id)"
        case .weatherAlert(let alert):
            return "weather-\(alert.id)"
        case .crime(let crime):
            return "crime-\(crime.id)"
        case .localEvent(let event):
            return "local-\(event.id)"
        case .trafficIncident(let incident):
            return "traffic-\(incident.id)"
        }
    }
}

private struct SituationEventDetailView: View {
    let event: MapEventDetail

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text(title)
                    .font(.title3.weight(.bold))

                if let subtitle {
                    Text(subtitle)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                ForEach(rows, id: \.label) { row in
                    HStack(alignment: .top) {
                        Text(row.label)
                            .font(.subheadline.weight(.semibold))
                            .frame(width: 92, alignment: .leading)
                        Text(row.value)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Spacer(minLength: 0)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
        }
        .navigationTitle("Details")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var title: String {
        switch event {
        case .earthquake(let quake):
            if let place = quake.place {
                return "Magnitude \(String(format: "%.1f", quake.magnitude)) earthquake near \(place)"
            }
            return "Magnitude \(String(format: "%.1f", quake.magnitude)) earthquake"
        case .flight(let flight):
            var result = "Flight \(flight.callsign)"
            if let origin = flight.origin { result += " from \(origin)" }
            if let dest = flight.destination { result += " to \(dest)" }
            return result
        case .incident(let incident):
            return incident.title
        case .weatherAlert(let alert):
            return alert.title
        case .crime(let crime):
            return crime.title
        case .localEvent(let event):
            return event.title
        case .trafficIncident(let incident):
            return incident.title ?? "Traffic Incident"
        }
    }

    private var subtitle: String? {
        switch event {
        case .earthquake(let quake):
            return quake.place
        case .flight(let flight):
            return flight.origin ?? flight.destination
        case .incident(let incident):
            return incident.summary
        case .weatherAlert(let alert):
            return alert.summary
        case .crime(let crime):
            return crime.category
        case .localEvent(let event):
            return event.venue ?? event.source
        case .trafficIncident(let incident):
            return incident.severity?.capitalized
        }
    }

    private var rows: [(label: String, value: String)] {
        switch event {
        case .earthquake(let quake):
            var result: [(label: String, value: String)] = [
                ("Magnitude", String(format: "%.1f", quake.magnitude)),
            ]
            if let depth = quake.depthKm { result.append(("Depth", String(format: "%.1f km", depth))) }
            result.append(("Latitude", String(format: "%.4f", quake.latitude)))
            result.append(("Longitude", String(format: "%.4f", quake.longitude)))
            if let time = quake.occurredAt { result.append(("Time", time)) }
            return result
        case .flight(let flight):
            var result: [(label: String, value: String)] = []
            if let origin = flight.origin { result.append(("Origin", origin)) }
            if let dest = flight.destination { result.append(("Destination", dest)) }
            if let alt = flight.altitudeFeet { result.append(("Altitude", "\(alt) ft")) }
            result.append(("Latitude", String(format: "%.4f", flight.latitude)))
            result.append(("Longitude", String(format: "%.4f", flight.longitude)))
            result.append(("Status", flight.status ?? "Live"))
            return result
        case .incident(let incident):
            var result: [(label: String, value: String)] = [
                ("Severity", incident.severity.capitalized),
                ("Latitude", String(format: "%.4f", incident.latitude)),
                ("Longitude", String(format: "%.4f", incident.longitude)),
            ]
            if let reported = incident.reportedAt { result.append(("Reported", reported)) }
            if let summary = incident.summary { result.append(("Summary", summary)) }
            return result
        case .weatherAlert(let alert):
            var result: [(label: String, value: String)] = [
                ("Severity", alert.severity.capitalized),
            ]
            if let lat = alert.lat { result.append(("Latitude", String(format: "%.4f", lat))) }
            if let lon = alert.lon { result.append(("Longitude", String(format: "%.4f", lon))) }
            if let expires = alert.expiresAt { result.append(("Expires", expires)) }
            if let summary = alert.summary { result.append(("Details", summary)) }
            return result
        case .crime(let crime):
            var result: [(label: String, value: String)] = [
                ("Category", crime.category),
                ("Severity", crime.severity.capitalized),
                ("Latitude", String(format: "%.4f", crime.latitude)),
                ("Longitude", String(format: "%.4f", crime.longitude)),
            ]
            if let ts = crime.timestamp { result.append(("Time", ts)) }
            if let src = crime.source { result.append(("Source", src)) }
            return result
        case .localEvent(let event):
            var result: [(label: String, value: String)] = []
            if let venue = event.venue { result.append(("Venue", venue)) }
            if let date = event.date { result.append(("Date", date)) }
            if let source = event.source { result.append(("Source", source)) }
            if let lat = event.latitude { result.append(("Latitude", String(format: "%.4f", lat))) }
            if let lon = event.longitude { result.append(("Longitude", String(format: "%.4f", lon))) }
            return result.isEmpty ? [("Info", "No details available")] : result
        case .trafficIncident(let incident):
            var result: [(label: String, value: String)] = []
            if let sev = incident.severity { result.append(("Severity", sev.capitalized)) }
            if let lat = incident.latitude { result.append(("Latitude", String(format: "%.4f", lat))) }
            if let lon = incident.longitude { result.append(("Longitude", String(format: "%.4f", lon))) }
            return result.isEmpty ? [("Info", "No details available")] : result
        }
    }
}

// MARK: - Snapshot

private struct SituationSnapshot: Codable {
    let centerLatitude: Double?
    let centerLongitude: Double?
    let earthquakes: [Earthquake]
    let flights: [Flight]
    let incidents: [Incident]
    let weatherAlerts: [WeatherAlert]
    let crimeIncidents: [CrimeIncident]?
    let localEvents: [LocalEvent]?
    let flightStatusMessage: String?
}
