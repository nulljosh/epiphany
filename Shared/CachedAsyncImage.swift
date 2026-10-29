import SwiftUI
#if canImport(UIKit)
import UIKit
typealias PlatformImage = UIImage
private func makeImage(_ i: PlatformImage) -> Image { Image(uiImage: i) }
#else
import AppKit
typealias PlatformImage = NSImage
private func makeImage(_ i: PlatformImage) -> Image { Image(nsImage: i) }
#endif

/// News rows share a handful of publisher favicons. AsyncImage fetches once per row and drops the result on
/// scroll, so a list of 25 CNBC rows pays for 25 downloads. This keeps one decoded image per URL and one
/// download per URL in flight.
@MainActor
final class ThumbStore {
    static let shared = ThumbStore()
    private let cache = NSCache<NSURL, PlatformImage>()
    private var inflight: [URL: Task<PlatformImage?, Never>] = [:]

    func cached(_ url: URL) -> PlatformImage? { cache.object(forKey: url as NSURL) }

    func image(for url: URL) async -> PlatformImage? {
        if let hit = cached(url) { return hit }
        if let running = inflight[url] { return await running.value }
        let task = Task { () -> PlatformImage? in
            guard let (data, _) = try? await URLSession.shared.data(from: url) else { return nil }
            return PlatformImage(data: data)
        }
        inflight[url] = task
        let image = await task.value
        inflight[url] = nil
        if let image { cache.setObject(image, forKey: url as NSURL) }
        return image
    }
}

/// Same shape as AsyncImage's content closure, minus the phase: the loaded image, or nil while it loads or fails.
struct CachedAsyncImage<Content: View>: View {
    let url: URL?
    @ViewBuilder var content: (Image?) -> Content
    @State private var loaded: PlatformImage?

    var body: some View {
        let shown = loaded ?? url.flatMap { ThumbStore.shared.cached($0) }
        content(shown.map { makeImage($0) })
            .task(id: url) {
                guard let url else { return }
                loaded = await ThumbStore.shared.image(for: url)
            }
    }
}
