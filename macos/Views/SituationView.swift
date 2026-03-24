import MapKit
import SwiftUI

struct SituationView: View {
    @Environment(AppState.self) private var appState

    private static let defaultRegion = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 49.1044, longitude: -122.6605),
        span: MKCoordinateSpan(latitudeDelta: 0.08, longitudeDelta: 0.08)
    )

    @StateObject private var locationManager = LocationManager()
    @State private var mapPosition = MapCameraPosition.region(
        SituationView.defaultRegion
    )
    @State private var visibleRegion = SituationView.defaultRegion

    @State private var earthquakes: [Earthquake] = []
    @State private var flights: [Flight] = []
    @State private var incidents: [Incident] = []
    @State private var weatherAlerts: [WeatherAlert] = []
    @State private var crimeIncidents: [CrimeIncident] = []
    @State private var localEvents: [LocalEvent] = []
    @State private var trafficData: TrafficData?

    @State private var error: String?
    @State private var flightStatusMessage: String?
    @State private var hasLoaded = false
    @State private var selectedEvent: MapEventDetail?
    @State private var loadTask: Task<Void, Never>?

    var body: some View {
        mapView
        .onAppear {
            guard !hasLoaded else { return }
            hasLoaded = true
            restoreSnapshot()
            locationManager.requestLocation()
            Task {
                await Task.yield()
                await loadData(for: visibleRegion)
            }
        }
        .onChange(of: locationManager.currentLocation) { _, location in
            guard let location else { return }
            let nearCached = abs(location.coordinate.latitude - visibleRegion.center.latitude) < 0.005
                && abs(location.coordinate.longitude - visibleRegion.center.longitude) < 0.005
            if nearCached { return }
            let region = MKCoordinateRegion(
                center: location.coordinate,
                span: MKCoordinateSpan(latitudeDelta: 1.4, longitudeDelta: 1.4)
            )
            visibleRegion = region
            mapPosition = .region(region)
            Task {
                await loadData(for: region)
            }
        }
        .onMapCameraChange(frequency: .onEnd) { context in
            let region = context.region
            visibleRegion = region
            loadTask?.cancel()
            loadTask = Task {
                try? await Task.sleep(for: .milliseconds(500))
                guard !Task.isCancelled else { return }
                await loadData(for: region)
            }
        }
        .sheet(item: $selectedEvent) { event in
            SituationEventDetailView(event: event)
                .frame(minWidth: 400, minHeight: 300)
        }
        .onChange(of: appState.situationEarthquakesEnabled) { _, _ in
            Task { await loadData(for: visibleRegion) }
        }
        .onChange(of: appState.situationFlightsEnabled) { _, _ in
            Task { await loadData(for: visibleRegion) }
        }
        .onChange(of: appState.situationIncidentsEnabled) { _, _ in
            Task { await loadData(for: visibleRegion) }
        }
        .onChange(of: appState.situationWeatherEnabled) { _, _ in
            Task { await loadData(for: visibleRegion) }
        }
        .onChange(of: appState.situationCrimeEnabled) { _, _ in
            Task { await loadData(for: visibleRegion) }
        }
        .onChange(of: appState.situationLocalEventsEnabled) { _, _ in
            Task { await loadData(for: visibleRegion) }
        }
        .onChange(of: appState.situationTrafficEnabled) { _, _ in
            Task { await loadData(for: visibleRegion) }
        }
    }

    private var mapView: some View {
        Map(position: $mapPosition) {
            if let currentLocation = locationManager.currentLocation {
                Annotation("Current Location", coordinate: currentLocation.coordinate) {
                    mapPin(
                        color: Palette.dangerRed,
                        emoji: "\u{1F4CD}",
                        size: 25,
                        padding: 0
                    )
                }
            }

            ForEach(appState.situationEarthquakesEnabled ? earthquakes : []) { quake in
                Annotation(quake.title, coordinate: quake.coordinate) {
                    Button {
                        selectedEvent = .earthquake(quake)
                    } label: {
                        mapPin(color: .red, emoji: "\u{1F30B}", size: 15)
                    }
                    .buttonStyle(.plain)
                }
            }

            ForEach(appState.situationFlightsEnabled ? flights : []) { flight in
                Annotation(flight.callsign, coordinate: flight.coordinate) {
                    Button {
                        selectedEvent = .flight(flight)
                    } label: {
                        mapPin(color: .cyan, emoji: "\u{2708}\u{FE0F}", size: 15)
                    }
                    .buttonStyle(.plain)
                }
            }

            ForEach(appState.situationIncidentsEnabled ? incidents : []) { incident in
                Annotation(incident.title, coordinate: incident.coordinate) {
                    Button {
                        selectedEvent = .incident(incident)
                    } label: {
                        mapPin(color: Palette.mapBlue, emoji: "\u{1F6A7}", size: 15)
                    }
                    .buttonStyle(.plain)
                }
            }

            ForEach(appState.situationWeatherEnabled ? weatherAlerts : []) { alert in
                // Weather alerts don't have coordinates, show as overlay text if needed
            }

            ForEach(appState.situationCrimeEnabled ? crimeIncidents : []) { crime in
                Annotation(crime.title, coordinate: crime.coordinate) {
                    Button {
                        selectedEvent = .crime(crime)
                    } label: {
                        mapPin(color: Palette.dangerRed, emoji: "\u{1F6A8}", size: 15)
                    }
                    .buttonStyle(.plain)
                }
            }

            ForEach(localEventAnnotations) { event in
                if let coord = event.coordinate {
                    Annotation(event.title, coordinate: coord) {
                        Button {
                            selectedEvent = .localEvent(event)
                        } label: {
                            mapPin(color: Palette.purple, emoji: "\u{1F389}", size: 15)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            ForEach(trafficIncidentAnnotations) { incident in
                if let coord = incident.coordinate {
                    Annotation(incident.title ?? "Traffic", coordinate: coord) {
                        Button {
                            selectedEvent = .trafficIncident(incident)
                        } label: {
                            mapPin(color: Palette.warningAmber, emoji: "\u{1F6A6}", size: 15)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .mapStyle(.standard(elevation: .realistic))
    }

    private var localEventAnnotations: [LocalEvent] {
        guard appState.situationLocalEventsEnabled else { return [] }
        return localEvents.filter { $0.coordinate != nil }
    }

    private var trafficIncidentAnnotations: [TrafficData.TrafficIncident] {
        guard appState.situationTrafficEnabled, let data = trafficData else { return [] }
        return (data.incidents ?? []).filter { $0.coordinate != nil }
    }

    private func mapPin(
        color: Color,
        emoji: String,
        size: CGFloat = 12,
        padding: CGFloat = 8
    ) -> some View {
        Text(emoji)
            .font(.system(size: size))
            .padding(padding)
            .shadow(color: .black.opacity(0.25), radius: 6, y: 2)
    }

    private func loadData(for region: MKCoordinateRegion) async {
        error = nil
        flightStatusMessage = nil
        defer { saveSnapshot() }

        let center = region.center
        let span = region.span
        let lamin = center.latitude - span.latitudeDelta / 2
        let lamax = center.latitude + span.latitudeDelta / 2
        let lomin = center.longitude - span.longitudeDelta / 2
        let lomax = center.longitude + span.longitudeDelta / 2

        async let earthquakeLoad = loadEarthquakesIfEnabled()
        async let flightLoad = loadFlightsIfEnabled(lamin: lamin, lomin: lomin, lamax: lamax, lomax: lomax)
        async let incidentLoad = loadIncidentsIfEnabled(lat: center.latitude, lon: center.longitude)
        async let weatherLoad = loadWeatherIfEnabled(lat: center.latitude, lon: center.longitude)
        async let crimeLoad = loadCrimeIfEnabled(lat: center.latitude, lon: center.longitude)
        async let localEventsLoad = loadLocalEventsIfEnabled(lat: center.latitude, lon: center.longitude)
        async let trafficLoad = loadTrafficIfEnabled(lat: center.latitude, lon: center.longitude)

        let earthquakeResult = await earthquakeLoad
        let flightResult = await flightLoad
        let incidentResult = await incidentLoad
        let weatherResult = await weatherLoad
        let crimeResult = await crimeLoad
        let localEventsResult = await localEventsLoad
        let trafficResult = await trafficLoad

        if earthquakeResult.error == nil || !earthquakeResult.value.isEmpty {
            earthquakes = earthquakeResult.value
        }
        if flightResult.error == nil || !flightResult.value.isEmpty {
            flights = flightResult.value
        }
        if incidentResult.error == nil || !incidentResult.value.isEmpty {
            incidents = incidentResult.value
        }
        if weatherResult.error == nil || !weatherResult.value.isEmpty {
            weatherAlerts = weatherResult.value
        }
        if crimeResult.error == nil || !crimeResult.value.isEmpty {
            crimeIncidents = crimeResult.value
        }
        if localEventsResult.error == nil || !localEventsResult.value.isEmpty {
            localEvents = localEventsResult.value
        }
        if let td = trafficResult.value {
            trafficData = td
        } else if trafficResult.error == nil {
            trafficData = nil
        }
        flightStatusMessage = flightResult.error

        let failures = [
            earthquakeResult.error,
            incidentResult.error,
            weatherResult.error,
            crimeResult.error,
            localEventsResult.error,
            trafficResult.error,
        ].compactMap { $0 }
        if !failures.isEmpty {
            error = failures.joined(separator: "  ")
        }
    }

    private func loadFlights(
        lamin: Double, lomin: Double, lamax: Double, lomax: Double
    ) async -> (value: [Flight], error: String?) {
        do {
            let feed = try await OpticonAPI.shared.fetchFlights(
                lamin: lamin, lomin: lomin, lamax: lamax, lomax: lomax
            )
            let status = (feed.meta?.status ?? "").lowercased()
            let message: String? = {
                if feed.meta?.degraded == true && feed.states.isEmpty {
                    return "Flights degraded"
                }
                if status == "stale" || status == "cache" || feed.meta?.cached == true {
                    return "\(feed.states.count) cached flights"
                }
                if feed.states.isEmpty {
                    return "0 flights"
                }
                return nil
            }()
            return (feed.states, message)
        } catch {
            return ([], "Flights degraded")
        }
    }

    private func loadEarthquakesIfEnabled() async -> (value: [Earthquake], error: String?) {
        guard appState.situationEarthquakesEnabled else { return ([], nil) }
        return await loadSection(label: "Earthquakes") {
            try await OpticonAPI.shared.fetchEarthquakes()
        }
    }

    private func loadFlightsIfEnabled(
        lamin: Double, lomin: Double, lamax: Double, lomax: Double
    ) async -> (value: [Flight], error: String?) {
        guard appState.situationFlightsEnabled else { return ([], nil) }
        return await loadFlights(lamin: lamin, lomin: lomin, lamax: lamax, lomax: lomax)
    }

    private func loadIncidentsIfEnabled(
        lat: Double,
        lon: Double
    ) async -> (value: [Incident], error: String?) {
        guard appState.situationIncidentsEnabled else { return ([], nil) }
        return await loadSection(label: "Incidents") {
            try await OpticonAPI.shared.fetchIncidents(lat: lat, lon: lon)
        }
    }

    private func loadWeatherIfEnabled(
        lat: Double,
        lon: Double
    ) async -> (value: [WeatherAlert], error: String?) {
        guard appState.situationWeatherEnabled else { return ([], nil) }
        return await loadSection(label: "Weather") {
            try await OpticonAPI.shared.fetchWeatherAlerts(lat: lat, lon: lon)
        }
    }

    private func loadCrimeIfEnabled(
        lat: Double,
        lon: Double
    ) async -> (value: [CrimeIncident], error: String?) {
        guard appState.situationCrimeEnabled else { return ([], nil) }
        return await loadSection(label: "Crime") {
            try await OpticonAPI.shared.fetchCrime(lat: lat, lon: lon)
        }
    }

    private func loadLocalEventsIfEnabled(
        lat: Double,
        lon: Double
    ) async -> (value: [LocalEvent], error: String?) {
        guard appState.situationLocalEventsEnabled else { return ([], nil) }
        return await loadSection(label: "Local Events") {
            try await OpticonAPI.shared.fetchLocalEvents(lat: lat, lon: lon)
        }
    }

    private func loadTrafficIfEnabled(
        lat: Double,
        lon: Double
    ) async -> (value: TrafficData?, error: String?) {
        guard appState.situationTrafficEnabled else { return (nil, nil) }
        do {
            let data = try await OpticonAPI.shared.fetchTraffic(lat: lat, lon: lon)
            return (data, nil)
        } catch {
            return (nil, "Traffic unavailable")
        }
    }

    private func loadSection<T>(
        label: String, _ operation: () async throws -> T
    ) async -> (value: T, error: String?) where T: RangeReplaceableCollection {
        do {
            return (try await operation(), nil)
        } catch {
            return (.init(), "\(label) unavailable")
        }
    }

    private func restoreSnapshot() {
        guard let data = UserDefaults.standard.data(forKey: snapshotKey),
              let snapshot = try? JSONDecoder().decode(SituationSnapshot.self, from: data)
        else {
            mapPosition = .region(visibleRegion)
            return
        }

        visibleRegion = MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: snapshot.centerLatitude, longitude: snapshot.centerLongitude),
            span: MKCoordinateSpan(latitudeDelta: snapshot.latitudeDelta, longitudeDelta: snapshot.longitudeDelta)
        )
        mapPosition = .region(visibleRegion)
        earthquakes = snapshot.earthquakes.map { $0.model }
        flights = snapshot.flights.map { $0.model }
        incidents = snapshot.incidents.map { $0.model }
        weatherAlerts = snapshot.weatherAlerts.map { $0.model }
        flightStatusMessage = snapshot.flightStatusMessage
    }

    private func saveSnapshot() {
        let snapshot = SituationSnapshot(
            centerLatitude: visibleRegion.center.latitude,
            centerLongitude: visibleRegion.center.longitude,
            latitudeDelta: visibleRegion.span.latitudeDelta,
            longitudeDelta: visibleRegion.span.longitudeDelta,
            earthquakes: earthquakes.map(SnapshotEarthquake.init),
            flights: flights.map(SnapshotFlight.init),
            incidents: incidents.map(SnapshotIncident.init),
            weatherAlerts: weatherAlerts.map(SnapshotWeatherAlert.init),
            flightStatusMessage: flightStatusMessage
        )
        guard let data = try? JSONEncoder().encode(snapshot) else { return }
        UserDefaults.standard.set(data, forKey: snapshotKey)
    }

    private var snapshotKey: String { "situation.snapshot.v1" }
}

private enum MapEventDetail: Identifiable {
    case earthquake(Earthquake)
    case flight(Flight)
    case incident(Incident)
    case crime(CrimeIncident)
    case localEvent(LocalEvent)
    case trafficIncident(TrafficData.TrafficIncident)

    var id: String {
        switch self {
        case .earthquake(let quake): return "quake-\(quake.id)"
        case .flight(let flight): return "flight-\(flight.id)"
        case .incident(let incident): return "incident-\(incident.id)"
        case .crime(let crime): return "crime-\(crime.id)"
        case .localEvent(let event): return "event-\(event.id)"
        case .trafficIncident(let incident): return "traffic-\(incident.id)"
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
        .preferredColorScheme(.dark)
    }

    private var title: String {
        switch event {
        case .earthquake(let quake): return quake.title
        case .flight(let flight): return flight.callsign
        case .incident(let incident): return incident.title
        case .crime(let crime): return crime.title
        case .localEvent(let event): return event.title
        case .trafficIncident(let incident): return incident.title ?? "Traffic Incident"
        }
    }

    private var subtitle: String? {
        switch event {
        case .earthquake(let quake): return quake.place
        case .flight(let flight): return flight.origin ?? flight.destination
        case .incident(let incident): return incident.summary
        case .crime(let crime): return crime.category
        case .localEvent(let event): return event.venue
        case .trafficIncident(let incident): return incident.severity?.capitalized
        }
    }

    private var rows: [(label: String, value: String)] {
        switch event {
        case .earthquake(let quake):
            return [
                ("Magnitude", String(format: "%.1f", quake.magnitude)),
                ("Depth", quake.depthKm.map { String(format: "%.1f km", $0) } ?? "Unknown"),
                ("Latitude", String(format: "%.4f", quake.latitude)),
                ("Longitude", String(format: "%.4f", quake.longitude)),
                ("Time", quake.occurredAt ?? "Unknown"),
            ]
        case .flight(let flight):
            return [
                ("Origin", flight.origin ?? "Unknown"),
                ("Destination", flight.destination ?? "Unknown"),
                ("Altitude", flight.altitudeFeet.map { "\($0) ft" } ?? "Unknown"),
                ("Latitude", String(format: "%.4f", flight.latitude)),
                ("Longitude", String(format: "%.4f", flight.longitude)),
                ("Status", flight.status ?? "Live"),
            ]
        case .incident(let incident):
            return [
                ("Severity", incident.severity.capitalized),
                ("Latitude", String(format: "%.4f", incident.latitude)),
                ("Longitude", String(format: "%.4f", incident.longitude)),
                ("Reported", incident.reportedAt ?? "Unknown"),
                ("Summary", incident.summary ?? "No summary"),
            ]
        case .crime(let crime):
            return [
                ("Category", crime.category),
                ("Severity", crime.severity.capitalized),
                ("Latitude", String(format: "%.4f", crime.latitude)),
                ("Longitude", String(format: "%.4f", crime.longitude)),
                ("Time", crime.timestamp ?? "Unknown"),
                ("Source", crime.source ?? "Unknown"),
            ]
        case .localEvent(let event):
            var result: [(label: String, value: String)] = [
                ("Venue", event.venue ?? "Unknown"),
                ("Date", event.date ?? "Unknown"),
            ]
            if let source = event.source {
                result.append(("Source", source))
            }
            if let lat = event.latitude, let lon = event.longitude {
                result.append(("Latitude", String(format: "%.4f", lat)))
                result.append(("Longitude", String(format: "%.4f", lon)))
            }
            return result
        case .trafficIncident(let incident):
            var result: [(label: String, value: String)] = []
            if let severity = incident.severity {
                result.append(("Severity", severity.capitalized))
            }
            if let lat = incident.latitude, let lon = incident.longitude {
                result.append(("Latitude", String(format: "%.4f", lat)))
                result.append(("Longitude", String(format: "%.4f", lon)))
            }
            return result
        }
    }
}

private struct SituationSnapshot: Codable {
    let centerLatitude: Double
    let centerLongitude: Double
    let latitudeDelta: Double
    let longitudeDelta: Double
    let earthquakes: [SnapshotEarthquake]
    let flights: [SnapshotFlight]
    let incidents: [SnapshotIncident]
    let weatherAlerts: [SnapshotWeatherAlert]
    let flightStatusMessage: String?
}

private struct SnapshotEarthquake: Codable {
    let id: String
    let title: String
    let magnitude: Double
    let latitude: Double
    let longitude: Double
    let depthKm: Double?
    let place: String?
    let occurredAt: String?

    init(_ quake: Earthquake) {
        id = quake.id; title = quake.title; magnitude = quake.magnitude
        latitude = quake.latitude; longitude = quake.longitude
        depthKm = quake.depthKm; place = quake.place; occurredAt = quake.occurredAt
    }

    var model: Earthquake {
        Earthquake(id: id, title: title, magnitude: magnitude, latitude: latitude,
                   longitude: longitude, depthKm: depthKm, place: place, occurredAt: occurredAt)
    }
}

private struct SnapshotFlight: Codable {
    let id: String; let callsign: String; let origin: String?; let destination: String?
    let latitude: Double; let longitude: Double; let altitudeFeet: Int?; let status: String?

    init(_ flight: Flight) {
        id = flight.id; callsign = flight.callsign; origin = flight.origin
        destination = flight.destination; latitude = flight.latitude
        longitude = flight.longitude; altitudeFeet = flight.altitudeFeet; status = flight.status
    }

    var model: Flight {
        Flight(id: id, callsign: callsign, origin: origin, destination: destination,
               latitude: latitude, longitude: longitude, altitudeFeet: altitudeFeet, status: status)
    }
}

private struct SnapshotIncident: Codable {
    let id: String; let title: String; let severity: String
    let latitude: Double; let longitude: Double; let summary: String?; let reportedAt: String?

    init(_ incident: Incident) {
        id = incident.id; title = incident.title; severity = incident.severity
        latitude = incident.latitude; longitude = incident.longitude
        summary = incident.summary; reportedAt = incident.reportedAt
    }

    var model: Incident {
        Incident(id: id, title: title, severity: severity, latitude: latitude,
                 longitude: longitude, summary: summary, reportedAt: reportedAt)
    }
}

private struct SnapshotWeatherAlert: Codable {
    let id: String; let title: String; let severity: String
    let summary: String?; let effectiveAt: String?; let expiresAt: String?

    init(_ alert: WeatherAlert) {
        id = alert.id; title = alert.title; severity = alert.severity
        summary = alert.summary; effectiveAt = alert.effectiveAt; expiresAt = alert.expiresAt
    }

    var model: WeatherAlert {
        WeatherAlert(id: id, title: title, severity: severity, summary: summary,
                     effectiveAt: effectiveAt, expiresAt: expiresAt)
    }
}
