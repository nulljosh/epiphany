import CoreLocation
import Foundation

private extension KeyedDecodingContainer {
    func lossyString(forKey key: Key) -> String? {
        if let value = try? decodeIfPresent(String.self, forKey: key) {
            return value
        }
        if let value = try? decodeIfPresent(Double.self, forKey: key) {
            return String(value)
        }
        if let value = try? decodeIfPresent(Int.self, forKey: key) {
            return String(value)
        }
        return nil
    }

    func lossyDouble(forKey key: Key) -> Double? {
        if let value = try? decodeIfPresent(Double.self, forKey: key) {
            return value
        }
        if let value = try? decodeIfPresent(Int.self, forKey: key) {
            return Double(value)
        }
        if let value = try? decodeIfPresent(String.self, forKey: key) {
            return Double(value)
        }
        return nil
    }

    func lossyInt(forKey key: Key) -> Int? {
        if let value = try? decodeIfPresent(Int.self, forKey: key) {
            return value
        }
        if let value = try? decodeIfPresent(Double.self, forKey: key) {
            return Int(value)
        }
        if let value = try? decodeIfPresent(String.self, forKey: key) {
            return Int(Double(value) ?? 0)
        }
        return nil
    }
}

struct Earthquake: Codable, Identifiable {
    let id: String
    let title: String
    let magnitude: Double
    let latitude: Double
    let longitude: Double
    let depthKm: Double?
    let place: String?
    let occurredAt: String?

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    enum CodingKeys: String, CodingKey {
        case id, title, magnitude, latitude, longitude, place
        case mag, lat, lon, time, depth
        case depthKm = "depth_km"
        case occurredAt = "occurred_at"
    }

    init(
        id: String,
        title: String,
        magnitude: Double,
        latitude: Double,
        longitude: Double,
        depthKm: Double?,
        place: String?,
        occurredAt: String?
    ) {
        self.id = id
        self.title = title
        self.magnitude = magnitude
        self.latitude = latitude
        self.longitude = longitude
        self.depthKm = depthKm
        self.place = place
        self.occurredAt = occurredAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        magnitude = container.lossyDouble(forKey: .magnitude)
            ?? container.lossyDouble(forKey: .mag)
            ?? 0
        latitude = container.lossyDouble(forKey: .latitude)
            ?? container.lossyDouble(forKey: .lat)
            ?? 0
        longitude = container.lossyDouble(forKey: .longitude)
            ?? container.lossyDouble(forKey: .lon)
            ?? 0
        depthKm = container.lossyDouble(forKey: .depthKm)
            ?? container.lossyDouble(forKey: .depth)
        place = container.lossyString(forKey: .place)
        occurredAt = container.lossyString(forKey: .occurredAt)
            ?? container.lossyString(forKey: .time)
        title = try container.decodeIfPresent(String.self, forKey: .title)
            ?? place
            ?? "Earthquake"
        id = container.lossyString(forKey: .id)
            ?? "\(title)-\(occurredAt ?? "unknown")-\(latitude)-\(longitude)"
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(title, forKey: .title)
        try container.encode(magnitude, forKey: .magnitude)
        try container.encode(latitude, forKey: .latitude)
        try container.encode(longitude, forKey: .longitude)
        try container.encodeIfPresent(depthKm, forKey: .depthKm)
        try container.encodeIfPresent(place, forKey: .place)
        try container.encodeIfPresent(occurredAt, forKey: .occurredAt)
    }
}

struct Flight: Codable, Identifiable {
    let id: String
    let callsign: String
    let origin: String?
    let destination: String?
    let latitude: Double
    let longitude: Double
    let altitudeFeet: Int?
    let status: String?

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    enum CodingKeys: String, CodingKey {
        case id, callsign, origin, destination, latitude, longitude, status
        case icao24, lat, lon, altitude
        case altitudeFeet = "altitude_feet"
    }

    init(
        id: String,
        callsign: String,
        origin: String?,
        destination: String?,
        latitude: Double,
        longitude: Double,
        altitudeFeet: Int?,
        status: String?
    ) {
        self.id = id
        self.callsign = callsign
        self.origin = origin
        self.destination = destination
        self.latitude = latitude
        self.longitude = longitude
        self.altitudeFeet = altitudeFeet
        self.status = status
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let fallbackId = container.lossyString(forKey: .icao24) ?? UUID().uuidString
        id = container.lossyString(forKey: .id) ?? fallbackId
        callsign = container.lossyString(forKey: .callsign) ?? fallbackId.uppercased()
        origin = container.lossyString(forKey: .origin)
        destination = container.lossyString(forKey: .destination)
        latitude = container.lossyDouble(forKey: .latitude)
            ?? container.lossyDouble(forKey: .lat)
            ?? 0
        longitude = container.lossyDouble(forKey: .longitude)
            ?? container.lossyDouble(forKey: .lon)
            ?? 0
        altitudeFeet = container.lossyInt(forKey: .altitudeFeet)
            ?? container.lossyInt(forKey: .altitude)
        status = container.lossyString(forKey: .status)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(callsign, forKey: .callsign)
        try container.encodeIfPresent(origin, forKey: .origin)
        try container.encodeIfPresent(destination, forKey: .destination)
        try container.encode(latitude, forKey: .latitude)
        try container.encode(longitude, forKey: .longitude)
        try container.encodeIfPresent(altitudeFeet, forKey: .altitudeFeet)
        try container.encodeIfPresent(status, forKey: .status)
    }
}

struct Incident: Codable, Identifiable {
    let id: String
    let title: String
    let severity: String
    let latitude: Double
    let longitude: Double
    let summary: String?
    let reportedAt: String?

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    enum CodingKeys: String, CodingKey {
        case id, title, severity, latitude, longitude, summary
        case type, lat, lon, description
        case reportedAt = "reported_at"
    }

    init(
        id: String,
        title: String,
        severity: String,
        latitude: Double,
        longitude: Double,
        summary: String?,
        reportedAt: String?
    ) {
        self.id = id
        self.title = title
        self.severity = severity
        self.latitude = latitude
        self.longitude = longitude
        self.summary = summary
        self.reportedAt = reportedAt
    }

    private static let lowSignalTypes: Set<String> = [
        "gate", "bollard", "barrier", "cattle_grid", "cycle_barrier",
        "debris", "jersey_barrier", "log", "spikes", "stile",
        "swing_gate", "toll_booth", "turnstile", "block",
        "fire_hydrant", "fire_extinguisher", "defibrillator",
        "phone", "siren", "assembly_point", "drinking_water",
    ]

    private static func normalizeTitle(_ raw: String) -> String {
        let cleaned = raw
            .replacingOccurrences(of: "_", with: " ")
            .replacingOccurrences(of: "-", with: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return cleaned.split(separator: " ")
            .map { $0.prefix(1).uppercased() + $0.dropFirst().lowercased() }
            .joined(separator: " ")
    }

    static func isLowSignal(_ raw: String) -> Bool {
        lowSignalTypes.contains(raw.lowercased().trimmingCharacters(in: .whitespacesAndNewlines))
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let rawTitle = container.lossyString(forKey: .title)
            ?? container.lossyString(forKey: .type)
            ?? "Incident"
        title = Self.normalizeTitle(rawTitle)
        severity = container.lossyString(forKey: .severity) ?? "info"
        latitude = container.lossyDouble(forKey: .latitude)
            ?? container.lossyDouble(forKey: .lat)
            ?? 0
        longitude = container.lossyDouble(forKey: .longitude)
            ?? container.lossyDouble(forKey: .lon)
            ?? 0
        summary = container.lossyString(forKey: .summary)
            ?? container.lossyString(forKey: .description)
        reportedAt = container.lossyString(forKey: .reportedAt)
        id = container.lossyString(forKey: .id)
            ?? "\(rawTitle)-\(latitude)-\(longitude)"
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(title, forKey: .title)
        try container.encode(severity, forKey: .severity)
        try container.encode(latitude, forKey: .latitude)
        try container.encode(longitude, forKey: .longitude)
        try container.encodeIfPresent(summary, forKey: .summary)
        try container.encodeIfPresent(reportedAt, forKey: .reportedAt)
    }
}

struct WeatherAlert: Codable, Identifiable {
    let id: String
    let title: String
    let severity: String
    let summary: String?
    let effectiveAt: String?
    let expiresAt: String?
    let lat: Double?
    let lon: Double?

    var coordinate: CLLocationCoordinate2D? {
        guard let lat, let lon else { return nil }
        return CLLocationCoordinate2D(latitude: lat, longitude: lon)
    }

    enum CodingKeys: String, CodingKey {
        case id, title, severity, summary, lat, lon
        case event, headline, expires
        case effectiveAt = "effective_at"
        case expiresAt = "expires_at"
    }

    init(
        id: String,
        title: String,
        severity: String,
        summary: String?,
        effectiveAt: String?,
        expiresAt: String?,
        lat: Double? = nil,
        lon: Double? = nil
    ) {
        self.id = id
        self.title = title
        self.severity = severity
        self.summary = summary
        self.effectiveAt = effectiveAt
        self.expiresAt = expiresAt
        self.lat = lat
        self.lon = lon
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let fallbackTitle = container.lossyString(forKey: .title)
            ?? container.lossyString(forKey: .event)
            ?? "Weather Alert"
        title = fallbackTitle
        severity = container.lossyString(forKey: .severity) ?? "info"
        summary = container.lossyString(forKey: .summary)
            ?? container.lossyString(forKey: .headline)
        effectiveAt = container.lossyString(forKey: .effectiveAt)
        expiresAt = container.lossyString(forKey: .expiresAt)
            ?? container.lossyString(forKey: .expires)
        id = container.lossyString(forKey: .id)
            ?? "\(fallbackTitle)-\(expiresAt ?? "none")"
        lat = container.lossyDouble(forKey: .lat)
        lon = container.lossyDouble(forKey: .lon)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(title, forKey: .title)
        try container.encode(severity, forKey: .severity)
        try container.encodeIfPresent(summary, forKey: .summary)
        try container.encodeIfPresent(effectiveAt, forKey: .effectiveAt)
        try container.encodeIfPresent(expiresAt, forKey: .expiresAt)
        try container.encodeIfPresent(lat, forKey: .lat)
        try container.encodeIfPresent(lon, forKey: .lon)
    }
}

// MARK: - Crime Incident

struct CrimeIncident: Codable, Identifiable {
    let id: String
    let title: String
    let category: String
    let severity: String
    let latitude: Double
    let longitude: Double
    let timestamp: String?
    let source: String?

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    enum CodingKeys: String, CodingKey {
        case id, title, category, severity, timestamp, source
        case lat, lng, latitude, longitude
    }

    init(
        id: String, title: String, category: String, severity: String,
        latitude: Double, longitude: Double, timestamp: String?, source: String?
    ) {
        self.id = id; self.title = title; self.category = category
        self.severity = severity; self.latitude = latitude; self.longitude = longitude
        self.timestamp = timestamp; self.source = source
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        title = container.lossyString(forKey: .title) ?? "Crime incident"
        category = container.lossyString(forKey: .category) ?? "Unknown"
        severity = container.lossyString(forKey: .severity) ?? "low"
        latitude = container.lossyDouble(forKey: .latitude)
            ?? container.lossyDouble(forKey: .lat) ?? 0
        longitude = container.lossyDouble(forKey: .longitude)
            ?? container.lossyDouble(forKey: .lng) ?? 0
        timestamp = container.lossyString(forKey: .timestamp)
        source = container.lossyString(forKey: .source)
        id = container.lossyString(forKey: .id)
            ?? "\(title)-\(latitude)-\(longitude)-\(timestamp ?? "")"
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(title, forKey: .title)
        try container.encode(category, forKey: .category)
        try container.encode(severity, forKey: .severity)
        try container.encode(latitude, forKey: .latitude)
        try container.encode(longitude, forKey: .longitude)
        try container.encodeIfPresent(timestamp, forKey: .timestamp)
        try container.encodeIfPresent(source, forKey: .source)
    }
}

// MARK: - Local Event

struct LocalEvent: Codable, Identifiable {
    let title: String
    let source: String?
    let latitude: Double?
    let longitude: Double?
    let date: String?
    let url: String?
    let venue: String?
    private let _stableId: String

    var id: String { _stableId }

    var coordinate: CLLocationCoordinate2D? {
        guard let latitude, let longitude, latitude != 0, longitude != 0 else { return nil }
        return CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    enum CodingKeys: String, CodingKey {
        case title, source, date, url, venue
        case latitude, longitude, lat, lon, lng
    }

    enum StableIdCodingKey: String, CodingKey {
        case _stableId
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        title = (try? container.decode(String.self, forKey: .title)) ?? "Event"
        source = try? container.decodeIfPresent(String.self, forKey: .source)
        latitude = container.lossyDouble(forKey: .latitude)
            ?? container.lossyDouble(forKey: .lat)
        longitude = container.lossyDouble(forKey: .longitude)
            ?? container.lossyDouble(forKey: .lon)
            ?? container.lossyDouble(forKey: .lng)
        date = try? container.decodeIfPresent(String.self, forKey: .date)
        url = try? container.decodeIfPresent(String.self, forKey: .url)
        venue = try? container.decodeIfPresent(String.self, forKey: .venue)

        if let idContainer = try? decoder.container(keyedBy: StableIdCodingKey.self),
           let persisted = try? idContainer.decode(String.self, forKey: ._stableId) {
            _stableId = persisted
        } else if venue != nil || date != nil || (latitude != nil && longitude != nil) {
            _stableId = "\(title)-\(venue ?? "")-\(date ?? "")-\(latitude ?? 0)-\(longitude ?? 0)"
        } else {
            _stableId = UUID().uuidString
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(title, forKey: .title)
        try container.encodeIfPresent(source, forKey: .source)
        try container.encodeIfPresent(latitude, forKey: .latitude)
        try container.encodeIfPresent(longitude, forKey: .longitude)
        try container.encodeIfPresent(date, forKey: .date)
        try container.encodeIfPresent(url, forKey: .url)
        try container.encodeIfPresent(venue, forKey: .venue)
        var idContainer = encoder.container(keyedBy: StableIdCodingKey.self)
        try idContainer.encode(_stableId, forKey: ._stableId)
    }
}

// MARK: - Traffic Data

struct TrafficData: Codable {
    let flow: TrafficFlow?
    let incidents: [TrafficIncident]?

    struct TrafficFlow: Codable {
        let congestion: String?
        let currentSpeed: Double?
        let freeFlowSpeed: Double?
    }

    struct TrafficIncident: Codable, Identifiable {
        let rawId: String?
        let title: String?
        let latitude: Double?
        let longitude: Double?
        let severity: String?
        private let _stableId: String

        var id: String { _stableId }

        enum CodingKeys: String, CodingKey {
            case id, title, severity, latitude, longitude, lat, lon
        }

        private enum StableIdCodingKey: String, CodingKey {
            case _stableId
        }

        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            rawId = try? container.decodeIfPresent(String.self, forKey: .id)
            title = try? container.decodeIfPresent(String.self, forKey: .title)
            severity = try? container.decodeIfPresent(String.self, forKey: .severity)
            latitude = container.lossyDouble(forKey: .latitude)
                ?? container.lossyDouble(forKey: .lat)
            longitude = container.lossyDouble(forKey: .longitude)
                ?? container.lossyDouble(forKey: .lon)

            if let idContainer = try? decoder.container(keyedBy: StableIdCodingKey.self),
               let persisted = try? idContainer.decode(String.self, forKey: ._stableId) {
                _stableId = persisted
            } else if let raw = rawId, !raw.isEmpty {
                _stableId = raw
            } else {
                _stableId = "\(title ?? "traffic")-\(latitude ?? 0)-\(longitude ?? 0)-\(UUID().uuidString)"
            }
        }

        func encode(to encoder: Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)
            try container.encodeIfPresent(rawId, forKey: .id)
            try container.encodeIfPresent(title, forKey: .title)
            try container.encodeIfPresent(severity, forKey: .severity)
            try container.encodeIfPresent(latitude, forKey: .latitude)
            try container.encodeIfPresent(longitude, forKey: .longitude)
            var idContainer = encoder.container(keyedBy: StableIdCodingKey.self)
            try idContainer.encode(_stableId, forKey: ._stableId)
        }

        var coordinate: CLLocationCoordinate2D? {
            guard let latitude, let longitude else { return nil }
            return CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
        }
    }
}

// MARK: - Wildfire

struct WildfireResponse: Codable {
    let fires: [Wildfire]
    let source: String?
    let count: Int
}

struct Wildfire: Codable, Identifiable {
    let lat: Double
    let lon: Double
    let confidence: String?
    let brightness: Double?
    let date: String?
    let time: String?

    var id: String { "\(lat)-\(lon)-\(date ?? "")" }

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: lat, longitude: lon)
    }
}
