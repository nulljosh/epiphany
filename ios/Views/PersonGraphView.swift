import SwiftUI

struct PersonGraphView: View {
    let people: [IndexedPerson]
    var onSelect: ((IndexedPerson) -> Void)?

    @State private var nodes: [GraphNode] = []
    @State private var edges: [(Int, Int)] = []
    @State private var draggedIndex: Int?
    @State private var isSimulating = true

    struct GraphNode {
        var position: CGPoint
        var velocity: CGPoint = .zero
        var pinned = false
        let person: IndexedPerson
    }

    var body: some View {
        GeometryReader { geo in
            let bounds = geo.size
            TimelineView(.animation(paused: !isSimulating)) { _ in
                Canvas { context, size in
                    // Draw edges
                    for (i, j) in edges {
                        guard i < nodes.count, j < nodes.count else { continue }
                        var path = Path()
                        path.move(to: nodes[i].position)
                        path.addLine(to: nodes[j].position)
                        context.stroke(path, with: .color(.secondary.opacity(0.3)), lineWidth: 1)
                    }
                }
                .frame(width: bounds.width, height: bounds.height)
                .overlay {
                    ForEach(Array(nodes.enumerated()), id: \.offset) { index, node in
                        nodeView(node.person)
                            .position(node.position)
                            .gesture(
                                DragGesture()
                                    .onChanged { value in
                                        draggedIndex = index
                                        nodes[index].position = value.location
                                        nodes[index].pinned = true
                                    }
                                    .onEnded { _ in
                                        draggedIndex = nil
                                    }
                            )
                            .onTapGesture {
                                onSelect?(node.person)
                            }
                    }
                }
                .onChange(of: nodes.count) { _, _ in }
                .onAppear {
                    initializeGraph(bounds: bounds)
                }
            }
        }
        .background(Palette.bg)
        .navigationTitle("Graph")
        .navigationBarTitleDisplayMode(.inline)
        .onReceive(Timer.publish(every: 1.0 / 60.0, on: .main, in: .common).autoconnect()) { _ in
            guard isSimulating else { return }
            simulateStep()
        }
    }

    private func nodeView(_ person: IndexedPerson) -> some View {
        VStack(spacing: 4) {
            if let image = person.image, let url = URL(string: image) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let img):
                        img.resizable()
                            .aspectRatio(contentMode: .fill)
                            .frame(width: 36, height: 36)
                            .clipShape(Circle())
                    default:
                        Circle()
                            .fill(Palette.overlay.opacity(0.1))
                            .frame(width: 36, height: 36)
                            .overlay {
                                Image(systemName: "person.fill")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                    }
                }
            } else {
                Circle()
                    .fill(Palette.overlay.opacity(0.1))
                    .frame(width: 36, height: 36)
                    .overlay {
                        Image(systemName: "person.fill")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
            }
            Text(person.name.components(separatedBy: " ").first ?? person.name)
                .font(.caption2.weight(.medium))
                .lineLimit(1)
        }
    }

    // MARK: - Physics

    private func initializeGraph(bounds: CGSize) {
        let center = CGPoint(x: bounds.width / 2, y: bounds.height / 2)
        let radius = min(bounds.width, bounds.height) * 0.3

        nodes = people.enumerated().map { i, person in
            let angle = Double(i) / Double(max(people.count, 1)) * 2 * .pi
            let x = center.x + radius * cos(angle)
            let y = center.y + radius * sin(angle)
            return GraphNode(position: CGPoint(x: x, y: y), person: person)
        }

        // Build edges from relationships
        edges = []
        let nameToIndex = Dictionary(uniqueKeysWithValues: people.enumerated().map { ($1.name.lowercased(), $0) })
        for (i, person) in people.enumerated() {
            for rel in person.relationships {
                if let j = nameToIndex[rel.name.lowercased()], i < j {
                    edges.append((i, j))
                }
            }
        }
    }

    private func simulateStep() {
        guard nodes.count > 1 else {
            isSimulating = false
            return
        }

        let repulsion: CGFloat = 3000
        let attraction: CGFloat = 0.005
        let centerGravity: CGFloat = 0.01
        let damping: CGFloat = 0.85
        let minDistance: CGFloat = 40

        var forces = Array(repeating: CGPoint.zero, count: nodes.count)

        // Repulsion between all pairs
        for i in 0..<nodes.count {
            for j in (i + 1)..<nodes.count {
                let dx = nodes[i].position.x - nodes[j].position.x
                let dy = nodes[i].position.y - nodes[j].position.y
                let dist = max(sqrt(dx * dx + dy * dy), minDistance)
                let force = repulsion / (dist * dist)
                let fx = force * dx / dist
                let fy = force * dy / dist
                forces[i].x += fx
                forces[i].y += fy
                forces[j].x -= fx
                forces[j].y -= fy
            }
        }

        // Attraction along edges
        for (i, j) in edges {
            guard i < nodes.count, j < nodes.count else { continue }
            let dx = nodes[j].position.x - nodes[i].position.x
            let dy = nodes[j].position.y - nodes[i].position.y
            let fx = attraction * dx
            let fy = attraction * dy
            forces[i].x += fx
            forces[i].y += fy
            forces[j].x -= fx
            forces[j].y -= fy
        }

        // Center gravity
        let cx = nodes.map(\.position.x).reduce(0, +) / CGFloat(nodes.count)
        let cy = nodes.map(\.position.y).reduce(0, +) / CGFloat(nodes.count)

        var totalVelocity: CGFloat = 0

        for i in 0..<nodes.count {
            guard !nodes[i].pinned else { continue }
            forces[i].x += (cx - nodes[i].position.x) * centerGravity * CGFloat(nodes.count)
            forces[i].y += (cy - nodes[i].position.y) * centerGravity * CGFloat(nodes.count)

            nodes[i].velocity.x = (nodes[i].velocity.x + forces[i].x) * damping
            nodes[i].velocity.y = (nodes[i].velocity.y + forces[i].y) * damping

            nodes[i].position.x += nodes[i].velocity.x
            nodes[i].position.y += nodes[i].velocity.y

            totalVelocity += abs(nodes[i].velocity.x) + abs(nodes[i].velocity.y)
        }

        // Stop simulation when settled
        if totalVelocity < 0.5 {
            isSimulating = false
        }
    }
}
