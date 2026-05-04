import UIKit
import WebKit

// Rasterizes SVG data to UIImage using a WKWebView snapshot.
// Used when a user's avatar URL points to an SVG (web-uploaded pixel art).
@MainActor
final class SVGRasterizer: NSObject, WKNavigationDelegate {
    private let webView: WKWebView
    private var continuation: CheckedContinuation<UIImage?, Never>?

    private init(size: CGSize) {
        webView = WKWebView(frame: CGRect(origin: .zero, size: size))
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        super.init()
        webView.navigationDelegate = self
    }

    static func rasterize(_ data: Data, size: CGSize = CGSize(width: 512, height: 512)) async -> UIImage? {
        guard let svg = String(data: data, encoding: .utf8), svg.contains("<svg") else { return nil }
        let r = SVGRasterizer(size: size)
        return await r.render(svg: svg, size: size)
    }

    private func render(svg: String, size: CGSize) async -> UIImage? {
        let w = Int(size.width), h = Int(size.height)
        let html = """
        <!DOCTYPE html><html>
        <head><style>*{margin:0;padding:0;overflow:hidden}
        body{width:\(w)px;height:\(h)px;background:transparent}
        svg{width:100%;height:100%;display:block}</style></head>
        <body>\(svg)</body></html>
        """
        // WKWebView must be in the view hierarchy to snapshot correctly.
        let window = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first?.windows.first
        window?.addSubview(webView)
        webView.isHidden = true

        let result = await withCheckedContinuation { cont in
            continuation = cont
            webView.loadHTMLString(html, baseURL: nil)
        }

        webView.removeFromSuperview()
        return result
    }

    nonisolated func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        Task { @MainActor [weak self] in
            guard let self else { return }
            let cfg = WKSnapshotConfiguration()
            cfg.rect = webView.bounds
            webView.takeSnapshot(with: cfg) { [weak self] image, _ in
                self?.continuation?.resume(returning: image)
                self?.continuation = nil
            }
        }
    }

    nonisolated func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        Task { @MainActor [weak self] in
            self?.continuation?.resume(returning: nil)
            self?.continuation = nil
        }
    }
}
