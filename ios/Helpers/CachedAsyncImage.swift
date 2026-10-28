import SwiftUI
import UIKit

/// News rows share a handful of publisher favicons. AsyncImage fetches once per row and drops the result on
/// scroll, so a list of 25 CNBC rows pays for 25 downloads. This keeps one decoded image per URL and one
/// download per URL in flight.
@MainActor
final class ThumbStore {
    static let shared = ThumbStore()
    private let cache = NSCache<NSURL, UIImage>()
    private var inflight: [URL: Task<UIImage?, Never>] = [:]

    func cached(_ url: URL) -> UIImage? { cache.object(forKey: url as NSURL) }

    func image(for url: URL) async -> UIImage? {
        if let hit = cached(url) { return hit }
        if let running = inflight[url] { return await running.value }
        let task = Task { () -> UIImage? in
            guard let (data, _) = try? await URLSession.shared.data(from: url) else { return nil }
            return UIImage(data: data)
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
    @State private var loaded: UIImage?

    var body: some View {
        let shown = loaded ?? url.flatMap { ThumbStore.shared.cached($0) }
        content(shown.map { Image(uiImage: $0) })
            .task(id: url) {
                guard let url else { return }
                loaded = await ThumbStore.shared.image(for: url)
            }
    }
}
