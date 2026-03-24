import Foundation

struct User: Codable {
    let id: String?
    let email: String
    let tier: String?
    let verified: Bool?
    let stripeCustomerId: String?
    let avatarUrl: String?
}
