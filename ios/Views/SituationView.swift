import CoreLocation
import MapKit
import Network
import SwiftUI
import UIKit

private func aqiSwiftColor(_ aqi: Int) -> Color {
    if aqi <= 50 { return .green }
    if aqi <= 100 { return .yellow }
    if aqi <= 150 { return .orange }
    return .red
}

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
    @State private var aqiReadings: [AQIReading] = []

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
    @AppStorage("showAQI") private var showAQI = true
    @AppStorage("showHighAltFlights") private var showHighAltFlights = false
    @AppStorage("situation.mapLayer") private var mapLayerRaw = MapLayerStyle.hybrid.rawValue

    @State private var selectedVenueCategory: VenueCategory?
    @State private var venueResults: [MKMapItem] = []
    @State private var isSearchingVenues = false

    private var activeMapStyle: MapStyle {
        MapLayerStyle(rawValue: mapLayerRaw)?.mapStyle ?? .hybrid(elevation: .realistic)
    }

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
                        Text("⚠️")
                            .font(.caption)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var visibleFlights: [Flight] {
        flights.filter { showHighAltFlights || ($0.altitudeFeet ?? 0) <= 35000 }
    }

    @MapContentBuilder
    private var flightAnnotations: some MapContent {
        if showFlights {
            ForEach(visibleFlights) { flight in
                Annotation("Flight \(flight.callsign)", coordinate: flight.coordinate) {
                    Button {
                        Haptics.impact(.light)
                        selectedEvent = .flight(flight)
                    } label: {
                        Text("✈️")
                            .font(.title3)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private let maxAnnotationsPerCategory = 50
    private let maxIncidentAnnotations = 25

    @MapContentBuilder
    private var incidentAnnotations: some MapContent {
        if showIncidents {
            ForEach(Array(activeIncidents.prefix(maxIncidentAnnotations))) { incident in
                Annotation(incident.title, coordinate: incident.coordinate) {
                    Button {
                        Haptics.impact(.medium)
                        selectedEvent = .incident(incident)
                    } label: {
                        Text(incidentEmoji(incident.title))
                            .font(.caption)
                    }
                    .buttonStyle(.plain)
                }
            }
            ForEach(Array(infrastructureIncidents.prefix(15))) { incident in
                Annotation(incident.title, coordinate: incident.coordinate) {
                    Button {
                        Haptics.impact(.light)
                        selectedEvent = .incident(incident)
                    } label: {
                        Text(incidentEmoji(incident.title))
                            .font(.caption2)
                            .opacity(0.7)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var activeIncidents: [Incident] {
        incidents.filter { !$0.isInfrastructure }
    }

    private var infrastructureIncidents: [Incident] {
        incidents.filter { $0.isInfrastructure }
    }

    private func incidentEmoji(_ title: String) -> String {
        let t = title.lowercased()
        if t.contains("police") { return "🚔" }
        if t.contains("fire") || t.contains("hydrant") { return "🚒" }
        if t.contains("hospital") || t.contains("emergency") { return "🏥" }
        if t.contains("construction") || t.contains("road_works") { return "🚧" }
        if t.contains("border") || t.contains("crossing") { return "🛂" }
        if t.contains("accident") || t.contains("crash") { return "💥" }
        if t.contains("closure") || t.contains("blocked") { return "🚫" }
        if t.contains("hazard") { return "⚠️" }
        if t.contains("flood") || t.contains("water") { return "💧" }
        if t.contains("airport") { return "🛫" }
        if t.contains("train") || t.contains("transit") || t.contains("bus") { return "🚉" }
        return "⚠️"
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
                            Text("⛈️")
                                .font(.caption)
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
                        Text("🚨")
                            .font(.caption)
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
                            Text("📍")
                                .font(.caption)
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
                            Text("🚗")
                                .font(.caption)
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
                    Text("🔥")
                        .font(.caption)
                }
            }
        }
    }

    @MapContentBuilder
    private var aqiAnnotations: some MapContent {
        if showAQI {
            ForEach(aqiReadings.prefix(10)) { reading in
                Annotation("AQI \(reading.displayAQI)", coordinate: reading.coordinate) {
                    Button {
                        Haptics.impact(.light)
                        selectedEvent = .aqi(reading)
                    } label: {
                        ZStack {
                            Circle()
                                .fill(aqiSwiftColor(reading.displayAQI).opacity(0.15))
                                .frame(width: 32, height: 32)
                            Circle()
                                .strokeBorder(aqiSwiftColor(reading.displayAQI), lineWidth: 1.5)
                                .frame(width: 32, height: 32)
                            Text("\(reading.displayAQI)")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundStyle(aqiSwiftColor(reading.displayAQI))
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    @MapContentBuilder
    private var venueAnnotations: some MapContent {
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

    // MARK: - Computed helpers

    private var locatableLocalEvents: [LocalEvent] {
        localEvents.filter { $0.coordinate != nil }
    }

    private var totalEventCount: Int {
        earthquakes.count + flights.count + incidents.count + weatherAlerts.count
        + crimeIncidents.count + locatableLocalEvents.count
        + (trafficData?.incidents?.count ?? 0) + wildfires.count + aqiReadings.count
    }

    private var allSourcesDisabled: Bool {
        !showEarthquakes && !showFlights && !showIncidents && !showWeatherAlerts
        && !showCrime && !showLocalEvents && !showTraffic && !showWildfires && !showAQI
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
            aqiAnnotations
            venueAnnotations
            UserAnnotation()
        }
        .mapStyle(activeMapStyle)
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
        .overlay(alignment: .bottom) { venueCategoryBar }
        .overlay(alignment: .bottom) { statusOverlay }
        .overlay(alignment: .bottomTrailing) { layerPickerButton }
        .overlay(alignment: .bottomTrailing) { currentLocationButton }
    }

    @ViewBuilder
    private var venueCategoryBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(VenueCategory.allCases, id: \.self) { cat in
                    Button {
                        Haptics.impact(.light)
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
        .padding(.bottom, 155)
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
                .frame(width: 44, height: 44)
                .background(.ultraThinMaterial, in: Circle())
        }
        .padding(.trailing, 12)
        .padding(.bottom, 172)
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
            .opacity(0.95)
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

    // MARK: - Venue search

    private func searchVenues(_ category: VenueCategory) async {
        isSearchingVenues = true
        defer { isSearchingVenues = false }
        let request = MKLocalSearch.Request()
        request.region = currentRegion
        request.pointOfInterestFilter = MKPointOfInterestFilter(including: [category.poiCategory])
        request.resultTypes = .pointOfInterest
        if let response = try? await MKLocalSearch(request: request).start() {
            venueResults = response.mapItems
        }
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

        let completion = LoadCompletion(total: 9)

        // Each source loads independently and applies state as soon as it arrives.
        // No source blocks another.

        Task { @MainActor in
            defer { Task { await completion.done() } }
            guard showEarthquakes else { earthquakes = []; return }
            let r = await loadSection(label: "Earthquakes") { try await EpiphanyAPI.shared.fetchEarthquakes(lat: center.latitude, lon: center.longitude) }
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
            let r = await loadSection(label: "Incidents") { try await EpiphanyAPI.shared.fetchIncidents(lat: center.latitude, lon: center.longitude, lamin: lamin, lomin: lomin, lamax: lamax, lomax: lomax) }
            guard loadRegionId == regionId else { return }
            if r.error == nil || !r.value.isEmpty { incidents = r.value.filter { !Incident.isLowSignal($0.title) } }
            if let e = r.error { await completion.addError(e) }
        }

        Task { @MainActor in
            defer { Task { await completion.done() } }
            guard showWeatherAlerts else { weatherAlerts = []; return }
            let r = await loadSection(label: "Weather") { try await EpiphanyAPI.shared.fetchWeatherAlerts(lat: center.latitude, lon: center.longitude) }
            guard loadRegionId == regionId else { return }
            if r.error == nil || !r.value.isEmpty { weatherAlerts = r.value }
            if let e = r.error { await completion.addError(e) }
        }

        Task { @MainActor in
            defer { Task { await completion.done() } }
            guard showCrime else { crimeIncidents = []; return }
            let r = await loadSection(label: "Crime") { try await EpiphanyAPI.shared.fetchCrime(lat: center.latitude, lon: center.longitude) }
            guard loadRegionId == regionId else { return }
            if r.error == nil || !r.value.isEmpty { crimeIncidents = r.value }
            if let e = r.error { await completion.addError(e) }
        }

        Task { @MainActor in
            defer { Task { await completion.done() } }
            guard showLocalEvents else { localEvents = []; return }
            let r = await loadSection(label: "Local Events") { try await EpiphanyAPI.shared.fetchLocalEvents(lat: center.latitude, lon: center.longitude) }
            guard loadRegionId == regionId else { return }
            if r.error == nil || !r.value.isEmpty { localEvents = r.value }
            if let e = r.error { await completion.addError(e) }
        }

        Task { @MainActor in
            defer { Task { await completion.done() } }
            guard showTraffic else { trafficData = nil; return }
            let result = try? await EpiphanyAPI.shared.fetchTraffic(lat: center.latitude, lon: center.longitude, lamin: lamin, lomin: lomin, lamax: lamax, lomax: lomax)
            guard loadRegionId == regionId else { return }
            trafficData = result
        }

        Task { @MainActor in
            defer { Task { await completion.done() } }
            guard showWildfires else { wildfires = []; return }
            let r = await loadSection(label: "Wildfires") { try await EpiphanyAPI.shared.fetchWildfires(lat: center.latitude, lon: center.longitude) }
            guard loadRegionId == regionId else { return }
            if r.error == nil || !r.value.isEmpty { wildfires = r.value }
            if let e = r.error { await completion.addError(e) }
        }

        Task { @MainActor in
            defer { Task { await completion.done() } }
            guard showAQI else { aqiReadings = []; return }
            let r = await loadSection(label: "AQI") { try await EpiphanyAPI.shared.fetchAQI(lat: center.latitude, lon: center.longitude) }
            guard loadRegionId == regionId else { return }
            if r.error == nil || !r.value.isEmpty { aqiReadings = r.value }
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
                    try await EpiphanyAPI.shared.fetchIncidents(lat: centerLat, lon: centerLon, lamin: wideLamin, lomin: wideLomin, lamax: wideLamax, lomax: wideLomax)
                }
                guard loadRegionId == regionId else { isLoadingData = false; return }
                if r.value.count > currentIncidents.count { incidents = r.value.filter { !Incident.isLowSignal($0.title) } }
            }
            if needCrime {
                let r = await loadSection(label: "Crime") {
                    try await EpiphanyAPI.shared.fetchCrime(lat: centerLat, lon: centerLon)
                }
                guard loadRegionId == regionId else { isLoadingData = false; return }
                if r.value.count > currentCrime.count { crimeIncidents = r.value }
            }
            if needEvents {
                let r = await loadSection(label: "Local Events") {
                    try await EpiphanyAPI.shared.fetchLocalEvents(lat: centerLat, lon: centerLon)
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
            let flights = try await EpiphanyAPI.shared.fetchFlights(
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
    case aqi(AQIReading)

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
        case .aqi(let reading):
            return "aqi-\(reading.idValue)"
        }
    }
}

private struct SituationEventDetailView: View {
    let event: MapEventDetail

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack(spacing: 10) {
                    Image(systemName: eventIcon)
                        .font(.title2)
                        .foregroundStyle(eventColor)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(eventType)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(eventColor)
                            .textCase(.uppercase)
                        Text(title)
                            .font(.title3.weight(.bold))
                    }
                }

                if let subtitle {
                    Text(subtitle)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                VStack(spacing: 0) {
                    ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                        HStack(alignment: .top) {
                            Text(row.label)
                                .font(.subheadline.weight(.semibold))
                                .frame(width: 92, alignment: .leading)
                            Text(row.value)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                            Spacer(minLength: 0)
                        }
                        .padding(.vertical, 10)
                        Divider()
                    }
                }
                .padding(14)
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14))

                if let linkURL = eventURL {
                    Link(destination: linkURL) {
                        HStack {
                            Image(systemName: "safari")
                            Text("View More")
                                .font(.subheadline.weight(.semibold))
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
                    }
                }

                // Mini map + Directions
                if let coord = eventCoordinate {
                    Map(initialPosition: .region(MKCoordinateRegion(
                        center: coord,
                        span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01)
                    ))) {
                        Marker(title, coordinate: coord)
                            .tint(eventColor)
                    }
                    .frame(height: 140)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .disabled(true)

                    Button {
                        let mapItem = MKMapItem(placemark: MKPlacemark(coordinate: coord))
                        mapItem.name = title
                        mapItem.openInMaps(launchOptions: [
                            MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeDefault,
                        ])
                    } label: {
                        HStack {
                            Image(systemName: "arrow.triangle.turn.up.right.diamond.fill")
                            Text("Directions")
                                .font(.subheadline.weight(.semibold))
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
        }
        .navigationTitle("Details")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var eventCoordinate: CLLocationCoordinate2D? {
        switch event {
        case .earthquake(let q): return q.coordinate
        case .flight: return nil  // directions to a moving airplane make no sense
        case .incident(let i): return i.coordinate
        case .weatherAlert(let a): return a.coordinate
        case .crime(let c): return c.coordinate
        case .localEvent(let e): return e.coordinate
        case .trafficIncident(let t): return t.coordinate
        case .aqi(let r): return r.coordinate
        }
    }

    private var eventType: String {
        switch event {
        case .earthquake: return "Earthquake"
        case .flight: return "Flight"
        case .incident(let i): return i.isInfrastructure ? i.title : "Incident"
        case .weatherAlert: return "Weather Alert"
        case .crime: return "Crime"
        case .localEvent: return "Local Event"
        case .trafficIncident: return "Traffic"
        case .aqi: return "Air Quality"
        }
    }

    private var eventIcon: String {
        switch event {
        case .earthquake: return "waveform.path.ecg"
        case .flight: return "airplane"
        case .incident: return "exclamationmark.triangle.fill"
        case .weatherAlert: return "cloud.bolt.fill"
        case .crime: return "shield.lefthalf.filled"
        case .localEvent: return "mappin.circle.fill"
        case .trafficIncident: return "car.fill"
        case .aqi: return "aqi.medium"
        }
    }

    private var eventColor: Color {
        switch event {
        case .earthquake: return .orange
        case .flight: return Palette.appleBlue
        case .incident(let i): return i.severity == "critical" ? .red : .orange
        case .weatherAlert(let a): return a.severity == "severe" ? .red : .yellow
        case .crime: return .red
        case .localEvent: return Palette.appleBlue
        case .trafficIncident: return .orange
        case .aqi(let r): return aqiSwiftColor(r.displayAQI)
        }
    }

    private var eventURL: URL? {
        switch event {
        case .flight(let f):
            let cs = f.callsign.trimmingCharacters(in: .whitespaces)
            guard !cs.isEmpty else { return nil }
            return URL(string: "https://www.flightaware.com/live/flight/\(cs)")
        case .localEvent(let e):
            guard let urlStr = e.url else { return nil }
            return URL(string: urlStr)
        default:
            return nil
        }
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
        case .aqi(let r):
            return "AQI \(r.displayAQI) -- \(r.city ?? "Station")"
        }
    }

    private var subtitle: String? {
        switch event {
        case .earthquake(let quake):
            return quake.place
        case .flight(let flight):
            return flight.origin ?? flight.destination
        case .incident(let incident):
            return incident.summary ?? (incident.isInfrastructure ? incident.category.replacingOccurrences(of: "_", with: " ").capitalized : nil)
        case .weatherAlert(let alert):
            return alert.summary
        case .crime(let crime):
            return crime.category
        case .localEvent(let event):
            return event.eventDescription ?? event.venue ?? event.source
        case .trafficIncident(let incident):
            return incident.severity?.capitalized
        case .aqi(let r):
            return r.aqiLevel
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
            if let spd = flight.velocityKnots { result.append(("Speed", "\(spd) kts")) }
            if let hdg = flight.headingDeg { result.append(("Heading", "\(hdg)\u{00B0}")) }
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
            if let desc = event.eventDescription, !desc.isEmpty { result.append(("About", desc)) }
            if let date = event.date { result.append(("Date", date)) }
            if let source = event.source { result.append(("Source", source.capitalized)) }
            if let lat = event.latitude { result.append(("Latitude", String(format: "%.4f", lat))) }
            if let lon = event.longitude { result.append(("Longitude", String(format: "%.4f", lon))) }
            return result.isEmpty ? [("Info", "No details available")] : result
        case .trafficIncident(let incident):
            var result: [(label: String, value: String)] = []
            if let sev = incident.severity { result.append(("Severity", sev.capitalized)) }
            if let lat = incident.latitude { result.append(("Latitude", String(format: "%.4f", lat))) }
            if let lon = incident.longitude { result.append(("Longitude", String(format: "%.4f", lon))) }
            return result.isEmpty ? [("Info", "No details available")] : result
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
