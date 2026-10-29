import SwiftUI

/// The Epiphany logo mark: the lyre from icon.svg, drawn in its 1024 space so it
/// can animate (trim) instead of being a flat bitmap.
struct LyreShape: Shape {
    enum Part: CaseIterable { case bowl, leftArm, rightArm, bar, strings }
    var part: Part

    func path(in rect: CGRect) -> Path {
        let k = min(rect.width, rect.height) / 1024
        func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: rect.minX + x * k, y: rect.minY + y * k) }
        var path = Path()
        switch part {
        case .bowl:
            path.move(to: p(360, 612))
            path.addCurve(to: p(512, 796), control1: p(360, 740), control2: p(420, 796))
            path.addCurve(to: p(664, 612), control1: p(604, 796), control2: p(664, 740))
        case .leftArm:
            path.move(to: p(360, 612))
            path.addCurve(to: p(282, 300), control1: p(330, 500), control2: p(250, 420))
            path.addCurve(to: p(372, 236), control1: p(296, 248), control2: p(336, 226))
        case .rightArm:
            path.move(to: p(664, 612))
            path.addCurve(to: p(742, 300), control1: p(694, 500), control2: p(774, 420))
            path.addCurve(to: p(652, 236), control1: p(728, 248), control2: p(688, 226))
        case .bar:
            path.move(to: p(300, 352)); path.addLine(to: p(724, 352))
        case .strings:
            path.move(to: p(432, 352)); path.addLine(to: p(432, 760))
            path.move(to: p(512, 352)); path.addLine(to: p(512, 780))
            path.move(to: p(592, 352)); path.addLine(to: p(592, 760))
        }
        return path
    }

    var lineWidth: CGFloat {
        switch part {
        case .bowl, .leftArm, .rightArm: return 72
        case .bar: return 64
        case .strings: return 40
        }
    }
}
