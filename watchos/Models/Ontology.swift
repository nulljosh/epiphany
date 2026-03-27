import Foundation

// MARK: - Ontology Object Types

enum OntologyObjectType: String, Codable, CaseIterable {
    case asset, person, event, place, account, transaction, note, alert, decision
}

enum RelationshipType: String, Codable, CaseIterable {
    case owns, locatedAt = "located_at", mentions, relatedTo = "related_to", causedBy = "caused_by", partOf = "part_of"
}

// MARK: - Models

struct OntologyObject: Codable, Identifiable, Hashable {
    let id: String
    let type: OntologyObjectType
    var name: String
    var properties: [String: AnyCodable]
    var source: String
    var createdAt: String
    var updatedAt: String

    static func == (lhs: OntologyObject, rhs: OntologyObject) -> Bool {
        lhs.id == rhs.id
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }

    // Convenience accessors for common properties
    var lat: Double? { properties["lat"]?.doubleValue }
    var lon: Double? { properties["lon"]?.doubleValue }
    var symbol: String? { properties["symbol"]?.stringValue }
    var eventType: String? { properties["eventType"]?.stringValue }
    var severity: String? { properties["severity"]?.stringValue }
}

struct OntologyRelationship: Codable {
    let type: RelationshipType
    let sourceId: String
    let targetId: String
    var properties: [String: AnyCodable]
    var createdAt: String
}

// MARK: - API Response Types

struct OntologyListResponse: Codable {
    let objects: [OntologyObject]
    let total: Int
    let offset: Int
    let limit: Int
}

struct OntologyRelationshipsResponse: Codable {
    var outbound: [OntologyRelationship]?
    var inbound: [OntologyRelationship]?
}

struct OntologyStatsResponse: Codable {
    let counts: [String: Int]
    let total: Int
}

struct OntologyBatchResponse: Codable {
    let ok: Bool
    let upserted: Int
}

// MARK: - AnyCodable (lightweight type-erased Codable)

struct AnyCodable: Codable, Hashable {
    let value: Any

    var stringValue: String? { value as? String }
    var doubleValue: Double? { value as? Double ?? (value as? Int).map(Double.init) }
    var intValue: Int? { value as? Int }
    var boolValue: Bool? { value as? Bool }

    init(_ value: Any) { self.value = value }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let s = try? container.decode(String.self) { value = s }
        else if let d = try? container.decode(Double.self) { value = d }
        else if let i = try? container.decode(Int.self) { value = i }
        else if let b = try? container.decode(Bool.self) { value = b }
        else if container.decodeNil() { value = NSNull() }
        else { value = try container.decode([String: AnyCodable].self) }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        if let s = value as? String { try container.encode(s) }
        else if let d = value as? Double { try container.encode(d) }
        else if let i = value as? Int { try container.encode(i) }
        else if let b = value as? Bool { try container.encode(b) }
        else if value is NSNull { try container.encodeNil() }
        else if let dict = value as? [String: AnyCodable] { try container.encode(dict) }
        else { try container.encodeNil() }
    }

    static func == (lhs: AnyCodable, rhs: AnyCodable) -> Bool {
        String(describing: lhs.value) == String(describing: rhs.value)
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(String(describing: value))
    }
}
