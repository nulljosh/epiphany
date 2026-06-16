import XCTest
@testable import Epiphany

final class PersonSearchResultTests: XCTestCase {

    func testDecodesFullResult() throws {
        let json = """
        {
            "title": "Elon Musk - Wikipedia",
            "snippet": "Elon Reeve Musk is a businessman...",
            "url": "https://en.wikipedia.org/wiki/Elon_Musk",
            "displayUrl": "en.wikipedia.org",
            "imageUrl": "https://example.com/photo.jpg"
        }
        """.data(using: .utf8)!

        let result = try JSONDecoder().decode(PersonSearchResult.self, from: json)
        XCTAssertEqual(result.title, "Elon Musk - Wikipedia")
        XCTAssertEqual(result.snippet, "Elon Reeve Musk is a businessman...")
        XCTAssertEqual(result.url, "https://en.wikipedia.org/wiki/Elon_Musk")
        XCTAssertEqual(result.displayUrl, "en.wikipedia.org")
        XCTAssertEqual(result.imageUrl, "https://example.com/photo.jpg")
        XCTAssertEqual(result.id, "https://en.wikipedia.org/wiki/Elon_Musk")
    }

    func testDecodesWithMissingOptionalFields() throws {
        let json = """
        {
            "title": "Test",
            "snippet": "A snippet",
            "url": "https://example.com",
            "displayUrl": "example.com"
        }
        """.data(using: .utf8)!

        let result = try JSONDecoder().decode(PersonSearchResult.self, from: json)
        XCTAssertNil(result.imageUrl)
    }

    func testDecodesWithAllFieldsMissing() throws {
        let json = "{}".data(using: .utf8)!

        let result = try JSONDecoder().decode(PersonSearchResult.self, from: json)
        XCTAssertEqual(result.title, "")
        XCTAssertEqual(result.snippet, "")
        XCTAssertEqual(result.url, "")
        XCTAssertEqual(result.displayUrl, "")
    }

    func testDecodesWithSpecialCharacters() throws {
        let json = """
        {
            "title": "Beyonc\\u00e9 Knowles-Carter",
            "snippet": "Singer & actress",
            "url": "https://example.com/beyonc%C3%A9",
            "displayUrl": "example.com"
        }
        """.data(using: .utf8)!

        let result = try JSONDecoder().decode(PersonSearchResult.self, from: json)
        XCTAssertTrue(result.title.contains("Beyonc"))
    }
}

final class SocialLinkTests: XCTestCase {

    func testDecodesFullLink() throws {
        let json = """
        {
            "platform": "twitter",
            "url": "https://twitter.com/elonmusk",
            "username": "elonmusk",
            "icon": "bird"
        }
        """.data(using: .utf8)!

        let link = try JSONDecoder().decode(SocialLink.self, from: json)
        XCTAssertEqual(link.platform, "twitter")
        XCTAssertEqual(link.url, "https://twitter.com/elonmusk")
        XCTAssertEqual(link.username, "elonmusk")
        XCTAssertEqual(link.displayName, "@elonmusk")
        XCTAssertEqual(link.systemImage, "bird")
        XCTAssertEqual(link.id, "https://twitter.com/elonmusk")
    }

    func testDisplayNameFallsBackToPlatform() throws {
        let json = """
        {
            "platform": "linkedin",
            "url": "https://linkedin.com/in/somebody"
        }
        """.data(using: .utf8)!

        let link = try JSONDecoder().decode(SocialLink.self, from: json)
        XCTAssertEqual(link.displayName, "Linkedin")
    }

    func testDisplayNameWithEmptyUsername() throws {
        let json = """
        {
            "platform": "instagram",
            "url": "https://instagram.com/test",
            "username": ""
        }
        """.data(using: .utf8)!

        let link = try JSONDecoder().decode(SocialLink.self, from: json)
        XCTAssertEqual(link.displayName, "Instagram")
    }

    func testSystemImageFallsBackToGlobe() throws {
        let json = """
        {
            "platform": "website",
            "url": "https://example.com"
        }
        """.data(using: .utf8)!

        let link = try JSONDecoder().decode(SocialLink.self, from: json)
        XCTAssertEqual(link.systemImage, "globe")
    }

    func testSystemImageWithEmptyIcon() throws {
        let json = """
        {
            "platform": "twitter",
            "url": "https://twitter.com/test",
            "icon": ""
        }
        """.data(using: .utf8)!

        let link = try JSONDecoder().decode(SocialLink.self, from: json)
        XCTAssertEqual(link.systemImage, "globe")
    }
}

final class PersonProfileTests: XCTestCase {

    func testDecodesFullProfile() throws {
        let json = """
        {
            "query": "Elon Musk",
            "results": [
                {
                    "title": "Wikipedia",
                    "snippet": "CEO",
                    "url": "https://en.wikipedia.org/wiki/Elon_Musk",
                    "displayUrl": "en.wikipedia.org"
                }
            ],
            "socialLinks": [
                {
                    "platform": "twitter",
                    "url": "https://twitter.com/elonmusk",
                    "username": "elonmusk"
                }
            ],
            "primaryImage": "https://example.com/photo.jpg",
            "resultCount": 15
        }
        """.data(using: .utf8)!

        let profile = try JSONDecoder().decode(PersonProfile.self, from: json)
        XCTAssertEqual(profile.query, "Elon Musk")
        XCTAssertEqual(profile.results.count, 1)
        XCTAssertEqual(profile.socialLinks.count, 1)
        XCTAssertEqual(profile.primaryImage, "https://example.com/photo.jpg")
        XCTAssertEqual(profile.resultCount, 15)
    }

    func testDecodesEmptyProfile() throws {
        let json = """
        {
            "query": "Nobody Real",
            "results": [],
            "socialLinks": []
        }
        """.data(using: .utf8)!

        let profile = try JSONDecoder().decode(PersonProfile.self, from: json)
        XCTAssertTrue(profile.results.isEmpty)
        XCTAssertTrue(profile.socialLinks.isEmpty)
        XCTAssertNil(profile.primaryImage)
        XCTAssertNil(profile.resultCount)
    }
}
