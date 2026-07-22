import SwiftUI
import UIKit

struct SettingsView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.openURL) private var openURL
    @AppStorage("app_theme") private var rawTheme = "system"
    @State private var showDeleteAccount = false
    @State private var isUploadingAvatar = false
    @State private var avatarError: String?
    @State private var showChangeName = false
    @State private var brokerConnecting = false
    @State private var brokerStatus: String?
    @State private var brokerLinkURL: URL?


    var body: some View {
        NavigationStack {
            Group {
                settingsList
            }
            .navigationTitle("Settings")
        }
        .onAppear {
            appState.loadAvatar()
            appState.restoreBrokerageSelection()
        }
        .sheet(item: $brokerLinkURL) { url in
            SafariView(url: url)
                .ignoresSafeArea()
                .onDisappear {
                    // Portal closed -- re-sync so the new link registers
                    Task { await connectBrokerage() }
                }
        }
    }

    private func connectBrokerage(broker: String? = nil) async {
        brokerConnecting = true
        defer { brokerConnecting = false }
        // SnapTrade registration can transiently drop the connection -- retry
        // once before surfacing an error so one flaky request doesn't fail the flow.
        for attempt in 1...2 {
            do {
                let result = try await EpiphanyAPI.shared.syncBroker(broker: broker)
                if let link = result.linkUrl, let url = URL(string: link) {
                    brokerStatus = nil
                    brokerLinkURL = url
                } else if result.linked == true {
                    let names = (result.connections ?? []).compactMap { $0.brokerName }.filter { !$0.isEmpty }
                    let brokerName = names.isEmpty ? "" : names.joined(separator: ", ")
                    appState.saveBrokerageSelection(linked: true, name: brokerName)
                    brokerStatus = brokerName.isEmpty ? "Brokerage linked" : "Connected: \(brokerName)"
                    await appState.loadFinanceData()
                } else if result.skipped == true {
                    brokerStatus = "Brokerage sync not configured on the server"
                }
                return
            } catch {
                if attempt == 2 {
                    brokerStatus = "Connect failed: \(error.localizedDescription)"
                } else {
                    try? await Task.sleep(for: .seconds(1))
                }
            }
        }
    }

    private func disconnectBrokerage() async {
        brokerConnecting = true
        defer { brokerConnecting = false }
        do {
            try await EpiphanyAPI.shared.disconnectBroker()
            appState.clearBrokerageSelection()
            brokerStatus = "Brokerage disconnected"
        } catch {
            brokerStatus = "Disconnect failed: \(error.localizedDescription)"
        }
    }

    private var settingsList: some View {
        List {
            if appState.isLoggedIn {
                Section {
                    HStack(spacing: 10) {
                        avatarPickerButton
                        .buttonStyle(.plain)

                        VStack(alignment: .leading, spacing: 2) {
                            if let name = appState.user?.name, !name.isEmpty {
                                Text(name)
                                    .font(.body.weight(.semibold))
                            }
                            Text(appState.user?.email ?? "")
                                .font(.subheadline)
                                .foregroundStyle(appState.user?.name != nil ? .secondary : .primary)
                            Text(tierLabel)
                                .font(.caption)
                                .foregroundStyle(tierColor)
                        }
                    }
                    .padding(.vertical, 2)
                }

                // App Store builds must not link out to web payment (guideline
                // 3.1.1) -- tier is shown read-only in the profile row above;
                // StoreKit upgrade flow is a planned follow-up.
                Section("Brokerage") {
                    if appState.brokerLinked {
                        if !appState.brokerName.isEmpty {
                            Label(appState.brokerName, systemImage: "checkmark.circle.fill")
                                .foregroundStyle(.secondary)
                        }
                        Button {
                            Task { await connectBrokerage() }
                        } label: {
                            HStack {
                                Label("Re-sync brokerage", systemImage: "link")
                                Spacer()
                                if brokerConnecting {
                                    ProgressView()
                                        .controlSize(.small)
                                }
                            }
                        }
                        .disabled(brokerConnecting)
                        Button(role: .destructive) {
                            Task { await disconnectBrokerage() }
                        } label: {
                            Label("Disconnect brokerage", systemImage: "link.badge.minus")
                        }
                        .disabled(brokerConnecting)
                    } else {
                        // No hardcoded broker shortcuts -- the v4 connection
                        // portal shows the full searchable broker list.
                        Button {
                            Task { await connectBrokerage() }
                        } label: {
                            HStack {
                                Label("Connect brokerage", systemImage: "link")
                                Spacer()
                                if brokerConnecting {
                                    ProgressView()
                                        .controlSize(.small)
                                }
                            }
                        }
                        .disabled(brokerConnecting)
                    }
                    if let status = brokerStatus {
                        Text(status)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                Section {
                    AutopilotSection()
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                }

                Section("Appearance") {
                    AppearancePicker(rawTheme: $rawTheme)
                        .listRowInsets(EdgeInsets(top: 12, leading: 16, bottom: 12, trailing: 16))
                }

                Section("Legal") {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Epiphany provides educational and informational tools only and does not provide investment advice. Past performance does not guarantee future results. Brokerage connections are read-only.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(nil)
                    }
                    .padding(.vertical, 6)
                }

                Section("Account") {
                    Button("Change Name") {
                        showChangeName = true
                    }
                    NavigationLink("Security") {
                        SecuritySection()
                            .environment(appState)
                    }
                }


                Section {
                    Button(role: .destructive) {
                        Task { await appState.logout() }
                    } label: {
                        Text("Sign Out")
                            .frame(maxWidth: .infinity, alignment: .center)
                    }
                }

                Section("Danger Zone") {
                    Button(role: .destructive) {
                        showDeleteAccount = true
                    } label: {
                        Text("Delete Account")
                    }
                }
            } else {
                Section {
                    Button("Sign In") {
                        appState.showLoginInRegisterMode = false
                        appState.showLogin = true
                    }
                    .frame(maxWidth: .infinity, alignment: .center)
                    .tint(Palette.appleBlue)

                    Button("Register") {
                        appState.showLoginInRegisterMode = true
                        appState.showLogin = true
                    }
                    .frame(maxWidth: .infinity, alignment: .center)
                }
            }
        }
        .safeAreaInset(edge: .bottom) { Color.clear.frame(height: 80) }
        .sheet(isPresented: $showChangeName) {
            ChangeNameSheet()
                .environment(appState)
        }
        .sheet(isPresented: $showDeleteAccount) {
            DeleteAccountSheet()
                .environment(appState)
        }
    }


    private var avatarPickerButton: some View {
        VStack(alignment: .leading, spacing: 8) {
            Button {
                guard !isUploadingAvatar else { return }
                Task { await generateAndUploadAvatar() }
            } label: {
                ZStack {
                    if let data = appState.avatarImageData,
                       let uiImage = UIImage(data: data) {
                        Image(uiImage: uiImage)
                            .resizable()
                            .scaledToFit()
                            .frame(width: 44, height: 44)
                            .clipShape(Circle())
                            .frame(width: 56, height: 56)
                    } else {
                        Circle()
                            .fill(Palette.appleBlue.opacity(0.2))
                            .frame(width: 56, height: 56)
                        Text(avatarInitial)
                            .font(.title2.weight(.semibold))
                            .foregroundStyle(Palette.appleBlue)
                    }
                    if isUploadingAvatar {
                        Circle()
                            .fill(.black.opacity(0.5))
                            .frame(width: 56, height: 56)
                        ProgressView()
                            .tint(Palette.text)
                    }
                }
            }
            if let error = avatarError {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .padding(.horizontal)
            }
        }
    }

    private var avatarInitial: String {
        if let name = appState.user?.name, let first = name.first {
            return String(first).uppercased()
        }
        guard let email = appState.user?.email, let first = email.first else { return "?" }
        return String(first).uppercased()
    }

    @MainActor
    private func generateAndUploadAvatar() async {
        isUploadingAvatar = true
        let image = Self.generateNodeGraphImage()
        guard let jpegData = image.jpegData(compressionQuality: 0.9) else {
            isUploadingAvatar = false
            return
        }
        appState.saveAvatarData(jpegData)
        do {
            let avatarUrl = try await EpiphanyAPI.shared.uploadAvatar(imageData: jpegData)
            if var user = appState.user {
                user.avatarUrl = avatarUrl
                user.avatarUpdatedAt = Int(Date().timeIntervalSince1970)
                appState.user = user
            }
            avatarError = nil
        } catch {
            avatarError = error.localizedDescription
        }
        isUploadingAvatar = false
    }

    private static func generateNodeGraphImage() -> UIImage {
        let palettes: [UIColor] = [
            UIColor(red: 0.48, green: 0.67, blue: 0.48, alpha: 1),
            UIColor(red: 0.78, green: 0.57, blue: 0.23, alpha: 1),
            UIColor(red: 0.36, green: 0.56, blue: 0.79, alpha: 1),
            UIColor(red: 0.79, green: 0.42, blue: 0.42, alpha: 1),
            UIColor(red: 0.61, green: 0.48, blue: 0.79, alpha: 1),
            UIColor(red: 0.25, green: 0.72, blue: 0.73, alpha: 1),
            UIColor(red: 0.90, green: 0.36, blue: 0.56, alpha: 1),
        ]
        let nodeColor = palettes.randomElement()!
        let size: CGFloat = 200
        let cx: CGFloat = 100, cy: CGFloat = 100

        // 3 topology presets; pick one at random
        typealias Offsets = [(CGFloat, CGFloat)]
        typealias Edges = [(Int, Int)]
        let topologies: [(Offsets, Edges)] = [
            // Star/hub
            (
                [(0,-58),(46,-30),(55,18),(20,56),(-20,56),(-55,18),(-46,-30),(0,0)],
                [(7,0),(7,1),(7,2),(7,3),(7,4),(7,5),(7,6),(0,1),(1,2),(2,3),(3,4),(4,5),(5,6),(6,0)]
            ),
            // Hexagon ring + inner triangle
            (
                [(0,-55),(48,-27),(48,27),(0,55),(-48,27),(-48,-27),(0,-22),(22,11),(-22,11)],
                [(0,1),(1,2),(2,3),(3,4),(4,5),(5,0),(6,7),(7,8),(8,6),(0,6),(2,7),(4,8),(1,6),(3,7),(5,8)]
            ),
            // Scattered mesh
            (
                [(-38,-50),(18,-52),(52,-10),(44,42),(0,55),(-44,34),(-54,-10),(0,-10),(30,12),(-25,18)],
                [(0,1),(1,2),(2,3),(3,4),(4,5),(5,6),(6,0),(0,7),(1,7),(2,8),(3,8),(4,9),(5,9),(6,9),(7,8),(8,9),(7,9)]
            ),
        ]

        let (baseOffsets, allEdges) = topologies.randomElement()!
        let jitter: CGFloat = CGFloat.random(in: 10...20)
        // Scale offsets so the graph fills the circle (~2.5-7.5% edge padding)
        let fill: CGFloat = 1.1
        let nodes = baseOffsets.map { dx, dy in
            CGPoint(
                x: cx + dx * fill + CGFloat.random(in: -jitter...jitter),
                y: cy + dy * fill + CGFloat.random(in: -jitter...jitter)
            )
        }

        let edgeDensity = Double.random(in: 0.45...0.85)
        let activeEdges = allEdges.filter { _ in Double.random(in: 0...1) < edgeDensity }

        let renderer = UIGraphicsImageRenderer(size: CGSize(width: size, height: size))
        return renderer.image { ctx in
            let cgCtx = ctx.cgContext
            UIColor(white: 0.06, alpha: 1).setFill()
            UIBezierPath(ovalIn: CGRect(x: 0, y: 0, width: size, height: size)).fill()

            cgCtx.setStrokeColor(UIColor(white: 1, alpha: 0.25).cgColor)
            cgCtx.setLineWidth(1.5)
            cgCtx.setLineCap(.round)
            for (a, b) in activeEdges where a < nodes.count && b < nodes.count {
                cgCtx.move(to: nodes[a])
                cgCtx.addLine(to: nodes[b])
            }
            cgCtx.strokePath()

            nodeColor.setFill()
            for (i, node) in nodes.enumerated() {
                let r = CGFloat.random(in: 5...11)
                let isAccent = i == 0 || i == nodes.count / 2
                UIBezierPath(ovalIn: CGRect(x: node.x - r, y: node.y - r, width: r * 2, height: r * 2)).fill()
                if isAccent {
                    UIColor(white: 1, alpha: 0.35).setFill()
                    let dot: CGFloat = 3
                    UIBezierPath(ovalIn: CGRect(x: node.x - dot, y: node.y - dot, width: dot * 2, height: dot * 2)).fill()
                    nodeColor.setFill()
                }
            }
        }
    }

    private var tierLabel: String {
        switch appState.user?.tier?.lowercased() {
        case "starter", "weekly": return "Weekly"
        default: return "Free"
        }
    }

    private var tierColor: Color {
        appState.user?.tier?.lowercased() == "starter" || appState.user?.tier?.lowercased() == "weekly"
            ? Palette.appleBlue : .secondary
    }

    private var normalizedTier: SubscriptionTier {
        switch appState.user?.tier?.lowercased() {
        case "starter", "weekly": return .starter
        default: return .free
        }
    }
}

private struct ChangeEmailSheet: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var newEmail = ""
    @State private var password = ""
    @State private var isSubmitting = false
    @State private var localError: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("New Email") {
                    TextField("name@example.com", text: $newEmail)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.emailAddress)
                }

                Section("Confirm Password") {
                    SecureField("Current password", text: $password)
                }

                if let localError {
                    Section {
                        Text(localError)
                            .foregroundStyle(.red)
                    }
                }

                Section {
                    Button(isSubmitting ? "Updating..." : "Update Email") {
                        Task { await submit() }
                    }
                    .disabled(isSubmitting || newEmail.isEmpty || password.isEmpty)
                }
            }
            .navigationTitle("Change Email")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private func submit() async {
        isSubmitting = true
        defer { isSubmitting = false }
        let success = await appState.changeEmail(to: newEmail.trimmingCharacters(in: .whitespacesAndNewlines), password: password)
        if success {
            dismiss()
        } else {
            localError = appState.error
        }
    }
}

private struct ChangePasswordSheet: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var currentPassword = ""
    @State private var newPassword = ""
    @State private var confirmPassword = ""
    @State private var isSubmitting = false
    @State private var localError: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Current Password") {
                    SecureField("Current password", text: $currentPassword)
                }

                Section("New Password") {
                    SecureField("New password", text: $newPassword)
                    SecureField("Confirm new password", text: $confirmPassword)
                }

                if let localError {
                    Section {
                        Text(localError)
                            .foregroundStyle(.red)
                    }
                }

                Section {
                    Button(isSubmitting ? "Updating..." : "Update Password") {
                        Task { await submit() }
                    }
                    .disabled(isSubmitting || currentPassword.isEmpty || newPassword.isEmpty || confirmPassword.isEmpty)
                }
            }
            .navigationTitle("Change Password")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private func submit() async {
        guard newPassword == confirmPassword else {
            localError = "Passwords do not match"
            return
        }
        guard newPassword.count >= 8 else {
            localError = "Password must be at least 8 characters"
            return
        }

        isSubmitting = true
        defer { isSubmitting = false }
        let success = await appState.changePassword(currentPassword: currentPassword, newPassword: newPassword)
        if success {
            dismiss()
        } else {
            localError = appState.error
        }
    }
}

private struct DeleteAccountSheet: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var password = ""
    @State private var isSubmitting = false
    @State private var localError: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("This permanently deletes your Epiphany account and associated data.")
                        .foregroundStyle(.secondary)
                }

                Section("Confirm Password") {
                    SecureField("Current password", text: $password)
                }

                if let localError {
                    Section {
                        Text(localError)
                            .foregroundStyle(.red)
                    }
                }

                Section {
                    Button(isSubmitting ? "Deleting..." : "Delete Account", role: .destructive) {
                        Task { await submit() }
                    }
                    .disabled(isSubmitting || password.isEmpty)
                }
            }
            .navigationTitle("Delete Account")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private func submit() async {
        isSubmitting = true
        defer { isSubmitting = false }
        let success = await appState.deleteAccount(password: password)
        if success {
            dismiss()
        } else {
            localError = appState.error
        }
    }
}

private enum SubscriptionTier: String, CaseIterable, Identifiable {
    case free
    case starter

    var id: String { rawValue }

    var title: String {
        switch self {
        case .free: return "Free"
        case .starter: return "Weekly"
        }
    }

    var price: String? {
        switch self {
        case .free: return "Free"
        case .starter: return "$1/wk"
        }
    }
}

private struct ChangeNameSheet: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var isSubmitting = false
    @State private var localError: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Display Name") {
                    TextField("Your name", text: $name)
                        .textInputAutocapitalization(.words)
                        .autocorrectionDisabled()
                }

                if let localError {
                    Section {
                        Text(localError)
                            .foregroundStyle(.red)
                    }
                }

                Section {
                    Button(isSubmitting ? "Saving..." : "Save") {
                        Task { await submit() }
                    }
                    .disabled(isSubmitting || name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .navigationTitle("Change Name")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
            }
            .onAppear {
                name = appState.user?.name ?? ""
            }
        }
    }

    private func submit() async {
        isSubmitting = true
        defer { isSubmitting = false }
        let success = await appState.changeName(name: name.trimmingCharacters(in: .whitespaces))
        if success {
            dismiss()
        } else {
            localError = appState.error
        }
    }
}

struct MapSourcesSettingsView: View {
    @AppStorage("showEarthquakes") private var showEarthquakes = true
    @AppStorage("showFlights") private var showFlights = true
    @AppStorage("showHighAltFlights") private var showHighAltFlights = false
    @AppStorage("showIncidents") private var showIncidents = true
    @AppStorage("showWeatherAlerts") private var showWeatherAlerts = true
    @AppStorage("showCrime") private var showCrime = true
    @AppStorage("showLocalEvents") private var showLocalEvents = true
    @AppStorage("showTraffic") private var showTraffic = true
    @AppStorage("showWildfires") private var showWildfires = true

    var body: some View {
        List {
            Section {
                Toggle("Earthquakes", isOn: $showEarthquakes)
                Toggle("Flights", isOn: $showFlights)
                if showFlights {
                    Toggle("High-Altitude Flights (>35,000 ft)", isOn: $showHighAltFlights)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Toggle("Incidents", isOn: $showIncidents)
                Toggle("Weather Alerts", isOn: $showWeatherAlerts)
                Toggle("Crime", isOn: $showCrime)
                Toggle("Local Events", isOn: $showLocalEvents)
                Toggle("Traffic", isOn: $showTraffic)
                Toggle("Wildfires", isOn: $showWildfires)
            }
        }
        .navigationTitle("Map Sources")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct SecuritySection: View {
    @Environment(AppState.self) private var appState
    @State private var showChangeEmail = false
    @State private var showChangePassword = false

    var body: some View {
        List {
            Section {
                Button("Change Email") { showChangeEmail = true }
                Button("Change Password") { showChangePassword = true }
            }
        }
        .navigationTitle("Security")
        .sheet(isPresented: $showChangeEmail) {
            ChangeEmailSheet().environment(appState)
        }
        .sheet(isPresented: $showChangePassword) {
            ChangePasswordSheet().environment(appState)
        }
    }
}

private struct AppearancePicker: View {
    @Binding var rawTheme: String
    private let options = [("light", "Light"), ("dark", "Dark"), ("system", "System")]

    var body: some View {
        HStack(spacing: 12) {
            ForEach(options, id: \.0) { id, label in
                Button { rawTheme = id } label: {
                    VStack(spacing: 8) {
                        themePreview(id)
                            .frame(height: 56)
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                    .stroke(rawTheme == id ? Color.accentColor : Color.primary.opacity(0.12), lineWidth: 2)
                            )
                        Text(label)
                            .font(.caption.weight(.medium))
                            .foregroundStyle(rawTheme == id ? Color.accentColor : Color.secondary)
                    }
                }
                .buttonStyle(.plain)
                .frame(maxWidth: .infinity)
            }
        }
    }

    @ViewBuilder
    private func themePreview(_ id: String) -> some View {
        switch id {
        case "light":
            RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Color(white: 0.92))
        case "dark":
            RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Color(white: 0.12))
        default:
            GeometryReader { geo in
                ZStack {
                    Color(white: 0.92)
                    Path { p in
                        p.move(to: CGPoint(x: geo.size.width, y: 0))
                        p.addLine(to: CGPoint(x: geo.size.width, y: geo.size.height))
                        p.addLine(to: CGPoint(x: 0, y: geo.size.height))
                        p.closeSubpath()
                    }.fill(Color(white: 0.12))
                }
            }
        }
    }
}
