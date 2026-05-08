import MapKit
import SwiftUI

private enum MapLayerStyle: String, CaseIterable {
    case hybrid, satellite, standard, terrain

    var label: String {
        switch self {
        case .hybrid:    return "Hybrid"
        case .satellite: return "Satellite"
        case .standard:  return "Standard"
        case .terrain:   return "Terrain"
        }
    }

    var icon: String {
        switch self {
        case .hybrid:    return "map.fill"
        case .satellite: return "globe.americas.fill"
        case .standard:  return "map"
        case .terrain:   return "mountain.2"
        }
    }

    var mapStyle: MapStyle {
        switch self {
        case .hybrid:    return .hybrid(elevation: .realistic)
        case .satellite: return .imagery(elevation: .realistic)
        case .standard:  return .standard(elevation: .realistic)
        case .terrain:   return .standard(elevation: .realistic, pointsOfInterest: .all)
        }
    }
}

private enum VenueCategory: String, CaseIterable {
    case restaurant, gas, groceries, coffee, parks, shopping

    var label: String { rawValue.capitalized }

    var icon: String {
        switch self {
        case .restaurant: return "fork.knife"
        case .gas:        return "fuelpump.fill"
        case .groceries:  return "cart.fill"
        case .coffee:     return "cup.and.saucer.fill"
        case .parks:      return "leaf.fill"
        case .shopping:   return "bag.fill"
        }
    }

    var poiCategory: MKPointOfInterestCategory {
        switch self {
        case .restaurant: return .restaurant
        case .gas:        return .gasStation
        case .groceries:  return .foodMarket
        case .coffee:     return .cafe
        case .parks:      return .park
        case .shopping:   return .store
        }
    }

    var tint: Color {
        switch self {
        case .restaurant: return .orange
        case .gas:        return .yellow
        case .groceries:  return .green
        case .coffee:     return Color(red: 0.59, green: 0.39, blue: 0.2)
        case .parks:      return .mint
        case .shopping:   return .pink
        }
    }
}

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
    @State private var wildfires: [Wildfire] = []
    @State private var aqiReadings: [AQIReading] = []

    @State private var error: String?
    @State private var flightStatusMessage: String?
    @State private var hasLoaded = false
    @State private var selectedEvent: MapEventDetail?
    @State private var loadTask: Task<Void, Never>?

    @AppStorage("situation.mapLayer") private var mapLayerRaw = MapLayerStyle.hybrid.rawValue
    @State private var selectedVenueCategory: VenueCategory?
    @State private var venueResults: [MKMapItem] = []
    @State private var isSearchingVenues = false

    private var activeMapStyle: MapStyle {
        MapLayerStyle(rawValue: mapLayerRaw)?.mapStyle ?? .hybrid(elevation: .realistic)
    }

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
        .onChange(of: appState.situationWildfiresEnabled) { _, _ in
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

            // Active incidents (construction, road works) -- prominent
            ForEach(appState.situationIncidentsEnabled ? incidents.filter { !$0.isInfrastructure }.prefix(25).map { $0 } : []) { incident in
                Annotation(incident.title, coordinate: incident.coordinate) {
                    Button {
                        selectedEvent = .incident(incident)
                    } label: {
                        mapPin(color: Palette.mapBlue, emoji: "\u{1F6A7}", size: 15)
                    }
                    .buttonStyle(.plain)
                }
            }
            // Infrastructure (police, fire, hospital) -- smaller
            ForEach(appState.situationIncidentsEnabled ? incidents.filter { $0.isInfrastructure }.prefix(15).map { $0 } : []) { incident in
                Annotation(incident.title, coordinate: incident.coordinate) {
                    Button {
                        selectedEvent = .incident(incident)
                    } label: {
                        mapPin(color: Palette.mapBlue, emoji: "\u{1F6A7}", size: 10)
                    }
                    .buttonStyle(.plain)
                }
            }

            // Weather alerts have no coordinates -- displayed as overlay text, not map pins

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

            if appState.situationWildfiresEnabled {
                ForEach(wildfires) { fire in
                    Annotation("Wildfire", coordinate: CLLocationCoordinate2D(latitude: fire.lat, longitude: fire.lon)) {
                        Image(systemName: "flame.fill")
                            .font(.system(size: 12))
                            .foregroundStyle(Palette.dangerRed)
                    }
                }
            }

            ForEach(aqiReadings.prefix(10)) { reading in
                Annotation("AQI \(reading.displayAQI)", coordinate: reading.coordinate) {
                    Button {
                        selectedEvent = .aqi(reading)
                    } label: {
                        ZStack {
                            Circle()
                                .fill(aqiColor(reading.displayAQI).opacity(0.15))
                                .frame(width: 28, height: 28)
                            Circle()
                                .strokeBorder(aqiColor(reading.displayAQI), lineWidth: 1.5)
                                .frame(width: 28, height: 28)
                            Text("\(reading.displayAQI)")
                                .font(.system(size: 8, weight: .bold))
                                .foregroundStyle(aqiColor(reading.displayAQI))
                        }
                    }
                    .buttonStyle(.plain)
                }
            }

            if let cat = selectedVenueCategory {
                ForEach(venueResults, id: \.self) { item in
                    if let coord = item.placemark.location?.coordinate {
                        Annotation(item.name ?? cat.label, coordinate: coord) {
                            Image(systemName: cat.icon)
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(.white)
                                .padding(6)
                                .background(cat.tint, in: Circle())
                        }
                    }
                }
            }
        }
        .mapStyle(activeMapStyle)
        .overlay(alignment: .bottom) { venueCategoryBar }
        .overlay(alignment: .bottomTrailing) { layerPickerButton }
    }

    @ViewBuilder
    private var venueCategoryBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(VenueCategory.allCases, id: \.self) { cat in
                    Button {
                        if selectedVenueCategory == cat {
                            selectedVenueCategory = nil
                            venueResults = []
                        } else {
                            selectedVenueCategory = cat
                            Task { await searchVenues(cat) }
                        }
                    } label: {
                        HStack(spacing: 5) {
                            if isSearchingVenues && selectedVenueCategory == cat {
                                ProgressView().controlSize(.mini).tint(.white)
                            } else {
                                Image(systemName: cat.icon)
                                    .font(.caption.weight(.semibold))
                            }
                            Text(cat.label)
                                .font(.caption.weight(.semibold))
                        }
                        .padding(.horizontal, 11)
                        .padding(.vertical, 7)
                        .background(
                            selectedVenueCategory == cat ? cat.tint : Color.black.opacity(0.6),
                            in: Capsule()
                        )
                        .foregroundStyle(.white)
                        .overlay(
                            Capsule().stroke(
                                selectedVenueCategory == cat ? Color.clear : Color.white.opacity(0.15),
                                lineWidth: 1
                            )
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 14)
        }
        .padding(.bottom, 16)
    }

    @ViewBuilder
    private var layerPickerButton: some View {
        Menu {
            ForEach(MapLayerStyle.allCases, id: \.rawValue) { style in
                Button {
                    mapLayerRaw = style.rawValue
                } label: {
                    Label(style.label, systemImage: style.icon)
                }
            }
        } label: {
            Image(systemName: MapLayerStyle(rawValue: mapLayerRaw)?.icon ?? "map.fill")
                .font(.body.weight(.medium))
                .foregroundStyle(.white)
                .frame(width: 36, height: 36)
                .background(.ultraThinMaterial, in: Circle())
        }
        .padding(.trailing, 12)
        .padding(.bottom, 52)
    }

    private func searchVenues(_ category: VenueCategory) async {
        isSearchingVenues = true
        defer { isSearchingVenues = false }
        let request = MKLocalSearch.Request()
        request.region = visibleRegion
        request.pointOfInterestFilter = MKPointOfInterestFilter(including: [category.poiCategory])
        request.resultTypes = .pointOfInterest
        if let response = try? await MKLocalSearch(request: request).start() {
            venueResults = response.mapItems
        }
    }

    private func aqiColor(_ aqi: Int) -> Color {
        if aqi <= 50 { return .green }
        if aqi <= 100 { return .yellow }
        if aqi <= 150 { return .orange }
        return .red
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

        async let earthquakeLoad = loadEarthquakesIfEnabled(lat: center.latitude, lon: center.longitude)
        async let flightLoad = loadFlightsIfEnabled(lamin: lamin, lomin: lomin, lamax: lamax, lomax: lomax)
        async let incidentLoad = loadIncidentsIfEnabled(lat: center.latitude, lon: center.longitude)
        async let weatherLoad = loadWeatherIfEnabled(lat: center.latitude, lon: center.longitude)
        async let crimeLoad = loadCrimeIfEnabled(lat: center.latitude, lon: center.longitude)
        async let localEventsLoad = loadLocalEventsIfEnabled(lat: center.latitude, lon: center.longitude)
        async let trafficLoad = loadTrafficIfEnabled(lat: center.latitude, lon: center.longitude)
        async let wildfireLoad = loadWildfiresIfEnabled(lat: center.latitude, lon: center.longitude)
        async let aqiLoad = loadSection(label: "AQI") { try await EpiphanyAPI.shared.fetchAQI(lat: center.latitude, lon: center.longitude) }

        let earthquakeResult = await earthquakeLoad
        let flightResult = await flightLoad
        let incidentResult = await incidentLoad
        let weatherResult = await weatherLoad
        let crimeResult = await crimeLoad
        let localEventsResult = await localEventsLoad
        let trafficResult = await trafficLoad
        let wildfireResult = await wildfireLoad
        let aqiResult = await aqiLoad

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
        if wildfireResult.error == nil || !wildfireResult.value.isEmpty {
            wildfires = wildfireResult.value
        }
        if aqiResult.error == nil || !aqiResult.value.isEmpty {
            aqiReadings = aqiResult.value
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
            let feed = try await EpiphanyAPI.shared.fetchFlights(
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

    private func loadEarthquakesIfEnabled(lat: Double, lon: Double) async -> (value: [Earthquake], error: String?) {
        guard appState.situationEarthquakesEnabled else { return ([], nil) }
        return await loadSection(label: "Earthquakes") {
            try await EpiphanyAPI.shared.fetchEarthquakes(lat: lat, lon: lon)
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
            try await EpiphanyAPI.shared.fetchIncidents(lat: lat, lon: lon)
        }
    }

    private func loadWeatherIfEnabled(
        lat: Double,
        lon: Double
    ) async -> (value: [WeatherAlert], error: String?) {
        guard appState.situationWeatherEnabled else { return ([], nil) }
        return await loadSection(label: "Weather") {
            try await EpiphanyAPI.shared.fetchWeatherAlerts(lat: lat, lon: lon)
        }
    }

    private func loadCrimeIfEnabled(
        lat: Double,
        lon: Double
    ) async -> (value: [CrimeIncident], error: String?) {
        guard appState.situationCrimeEnabled else { return ([], nil) }
        return await loadSection(label: "Crime") {
            try await EpiphanyAPI.shared.fetchCrime(lat: lat, lon: lon)
        }
    }

    private func loadLocalEventsIfEnabled(
        lat: Double,
        lon: Double
    ) async -> (value: [LocalEvent], error: String?) {
        guard appState.situationLocalEventsEnabled else { return ([], nil) }
        return await loadSection(label: "Local Events") {
            try await EpiphanyAPI.shared.fetchLocalEvents(lat: lat, lon: lon)
        }
    }

    private func loadTrafficIfEnabled(
        lat: Double,
        lon: Double
    ) async -> (value: TrafficData?, error: String?) {
        guard appState.situationTrafficEnabled else { return (nil, nil) }
        do {
            let data = try await EpiphanyAPI.shared.fetchTraffic(lat: lat, lon: lon)
            return (data, nil)
        } catch {
            return (nil, "Traffic unavailable")
        }
    }

    private func loadWildfiresIfEnabled(
        lat: Double,
        lon: Double
    ) async -> (value: [Wildfire], error: String?) {
        guard appState.situationWildfiresEnabled else { wildfires = []; return ([], nil) }
        return await loadSection(label: "Wildfires") {
            try await EpiphanyAPI.shared.fetchWildfires(lat: lat, lon: lon)
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
    case aqi(AQIReading)

    var id: String {
        switch self {
        case .earthquake(let quake): return "quake-\(quake.id)"
        case .flight(let flight): return "flight-\(flight.id)"
        case .incident(let incident): return "incident-\(incident.id)"
        case .crime(let crime): return "crime-\(crime.id)"
        case .localEvent(let event): return "event-\(event.id)"
        case .trafficIncident(let incident): return "traffic-\(incident.id)"
        case .aqi(let r): return "aqi-\(r.idValue)"
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
        case .aqi(let r): return "AQI \(r.displayAQI) -- \(r.city ?? "Station")"
        }
    }

    private var subtitle: String? {
        switch event {
        case .earthquake(let quake): return quake.place
        case .flight(let flight): return flight.origin ?? flight.destination
        case .incident(let incident): return incident.summary ?? (incident.isInfrastructure ? incident.category.replacingOccurrences(of: "_", with: " ").capitalized : nil)
        case .crime(let crime): return crime.category
        case .localEvent(let event): return event.eventDescription ?? event.venue
        case .trafficIncident(let incident): return incident.severity?.capitalized
        case .aqi(let r): return r.aqiLevel
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
            var result: [(label: String, value: String)] = [
                ("Type", incident.title),
                ("Category", incident.category.replacingOccurrences(of: "_", with: " ").capitalized),
                ("Severity", incident.severity.capitalized),
            ]
            if let summary = incident.summary { result.append(("Summary", summary)) }
            if let reported = incident.reportedAt { result.append(("Reported", reported)) }
            result.append(("Latitude", String(format: "%.4f", incident.latitude)))
            result.append(("Longitude", String(format: "%.4f", incident.longitude)))
            return result
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
            var result: [(label: String, value: String)] = []
            if let venue = event.venue { result.append(("Venue", venue)) }
            if let desc = event.eventDescription, !desc.isEmpty { result.append(("About", desc)) }
            if let date = event.date { result.append(("Date", date)) }
            if let source = event.source { result.append(("Source", source.capitalized)) }
            if let lat = event.latitude, let lon = event.longitude {
                result.append(("Latitude", String(format: "%.4f", lat)))
                result.append(("Longitude", String(format: "%.4f", lon)))
            }
            return result.isEmpty ? [("Info", "No details available")] : result
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
        case .aqi(let r):
            var result: [(label: String, value: String)] = [
                ("AQI", "\(r.displayAQI)"),
                ("Level", r.aqiLevel),
            ]
            if let param = r.parameter, let val = r.value, let unit = r.unit {
                result.append((param, "\(val) \(unit)"))
            }
            if let city = r.city { result.append(("Station", city)) }
            result.append(("Latitude", String(format: "%.4f", r.lat)))
            result.append(("Longitude", String(format: "%.4f", r.lon)))
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
