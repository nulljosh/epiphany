import SwiftUI
import UIKit

struct SettingsView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.openURL) private var openURL
    @State private var showUpgradeAlert = false
    @State private var upgradeTarget: SubscriptionTier?
    @State private var showChangeEmail = false
    @State private var showChangePassword = false
    @State private var showDeleteAccount = false
    @State private var isUploadingAvatar = false
    @State private var showConnectTally = false
    @State private var showChangeName = false


    var body: some View {
        NavigationStack {
            Group {
                settingsList
            }
            .navigationTitle("Settings")
        }
        .onAppear {
            if appState.avatarImageData == nil {
                appState.loadAvatar()
            }
        }
    }

    private var settingsList: some View {
        List {
            if appState.isLoggedIn {
                Section {
                    HStack(spacing: 14) {
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
                    .padding(.vertical, 4)
                }

                Section("Subscription") {
                    ForEach(SubscriptionTier.allCases) { tier in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(tier.title)
                                if let price = tier.price {
                                    Text(price)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }

                            Spacer()

                            if normalizedTier == tier {
                                Image(systemName: "checkmark")
                                    .font(.body.weight(.semibold))
                                    .foregroundStyle(Palette.appleBlue)
                            } else if tier != .free {
                                Text("Upgrade")
                                    .font(.caption.weight(.medium))
                                    .foregroundStyle(Palette.appleBlue)
                            }
                        }
                        .contentShape(Rectangle())
                        .onTapGesture {
                            guard tier != normalizedTier, tier != .free else { return }
                            upgradeTarget = tier
                            showUpgradeAlert = true
                        }
                    }
                }
                .alert("Upgrade to \(upgradeTarget?.title ?? "")", isPresented: $showUpgradeAlert) {
                    Button("Open Web Upgrade") {
                        // StoreKit 2 requires App Store Connect product setup;
                        // linking to web upgrade page for now.
                        if let url = URL(string: "https://epiphany.heyitsmejosh.com/settings") {
                            openURL(url)
                        }
                    }
                    Button("Cancel", role: .cancel) {}
                } message: {
                    Text("Subscription upgrades are handled on the web. You will be redirected to Epiphany on the web to complete the upgrade.")
                }

                Section("Account") {
                    Button("Change Name") {
                        showChangeName = true
                    }

                    Button("Change Email") {
                        showChangeEmail = true
                    }

                    Button("Change Password") {
                        showChangePassword = true
                    }
                }


                Section("Tally") {
                    if appState.tallyConnected {
                        HStack {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundStyle(Palette.successGreen)
                            Text("Connected")
                            Spacer()
                            if let payment = appState.tallyPayment {
                                if let amount = payment.paymentAmount {
                                    Text(amount)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                        Button("Disconnect", role: .destructive) {
                            appState.disconnectTally()
                        }
                    } else {
                        Button("Connect Tally") {
                            showConnectTally = true
                        }
                        .foregroundStyle(Palette.appleBlue)
                    }
                }

                Section {
                    NavigationLink {
                        MapSourcesSettingsView()
                    } label: {
                        Label("Map Sources", systemImage: "map")
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
                        appState.showLogin = true
                    }
                    .frame(maxWidth: .infinity, alignment: .center)
                    .tint(Palette.appleBlue)
                }

                Section {
                    NavigationLink {
                        MapSourcesSettingsView()
                    } label: {
                        Label("Map Sources", systemImage: "map")
                    }
                }
            }
        }
        .sheet(isPresented: $showChangeName) {
            ChangeNameSheet()
                .environment(appState)
        }
        .sheet(isPresented: $showChangeEmail) {
            ChangeEmailSheet()
                .environment(appState)
        }
        .sheet(isPresented: $showChangePassword) {
            ChangePasswordSheet()
                .environment(appState)
        }
        .sheet(isPresented: $showDeleteAccount) {
            DeleteAccountSheet()
                .environment(appState)
        }
        .sheet(isPresented: $showConnectTally) {
            ConnectTallySheet()
                .environment(appState)
        }
    }


    private var avatarPickerButton: some View {
        Button {
            guard !isUploadingAvatar else { return }
            Task { await generateAndUploadAvatar() }
        } label: {
            ZStack {
                if let data = appState.avatarImageData,
                   let uiImage = UIImage(data: data) {
                    Image(uiImage: uiImage)
                        .resizable()
                        .scaledToFill()
                        .frame(width: 56, height: 56)
                        .clipShape(Circle())
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
        isUploadingAvatar = false
        _ = try? await EpiphanyAPI.shared.uploadAvatar(imageData: jpegData)
    }

    private static func generateNodeGraphImage() -> UIImage {
        let palettes: [UIColor] = [
            UIColor(red: 0.48, green: 0.67, blue: 0.48, alpha: 1), // sage
            UIColor(red: 0.78, green: 0.57, blue: 0.23, alpha: 1), // amber
            UIColor(red: 0.36, green: 0.56, blue: 0.79, alpha: 1), // blue
            UIColor(red: 0.79, green: 0.42, blue: 0.42, alpha: 1), // coral
            UIColor(red: 0.61, green: 0.48, blue: 0.79, alpha: 1), // violet
        ]
        let nodeColor = palettes.randomElement()!
        let size: CGFloat = 200
        let cx: CGFloat = 100, cy: CGFloat = 100
        let jitter: CGFloat = 5

        let baseOffsets: [(CGFloat, CGFloat)] = [
            (0, -48), (-36, -26), (36, -26),
            (-48, 8), (0, 0), (48, 8),
            (-20, 48), (20, 48)
        ]
        let nodes = baseOffsets.map { dx, dy in
            CGPoint(
                x: cx + dx + CGFloat.random(in: -jitter...jitter),
                y: cy + dy + CGFloat.random(in: -jitter...jitter)
            )
        }

        let allEdges: [(Int, Int)] = [
            (0,1),(0,2),(1,3),(2,5),(1,4),(2,4),
            (3,4),(4,5),(3,6),(5,7),(4,6),(4,7),(6,7)
        ]
        let activeEdges = allEdges.filter { _ in Double.random(in: 0...1) > 0.25 }

        let renderer = UIGraphicsImageRenderer(size: CGSize(width: size, height: size))
        return renderer.image { ctx in
            let cgCtx = ctx.cgContext
            UIColor(white: 0.06, alpha: 1).setFill()
            UIBezierPath(ovalIn: CGRect(x: 0, y: 0, width: size, height: size)).fill()

            cgCtx.setStrokeColor(UIColor(white: 1, alpha: 0.22).cgColor)
            cgCtx.setLineWidth(1.5)
            cgCtx.setLineCap(.round)
            for (a, b) in activeEdges {
                cgCtx.move(to: nodes[a])
                cgCtx.addLine(to: nodes[b])
            }
            cgCtx.strokePath()

            nodeColor.setFill()
            for (i, node) in nodes.enumerated() {
                let r: CGFloat = (i == 0 || i == 4) ? 9 : 7
                UIBezierPath(ovalIn: CGRect(x: node.x - r, y: node.y - r, width: r * 2, height: r * 2)).fill()
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

private struct ConnectTallySheet: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var username = ""
    @State private var password = ""
    @State private var step: ConnectStep = .idle
    @State private var localError: String?

    private enum ConnectStep {
        case idle, loggingIn, fetchingData
        var label: String {
            switch self {
            case .idle: return "Connect"
            case .loggingIn: return "Logging in to BC Self-Serve..."
            case .fetchingData: return "Fetching payment data... (30s)"
            }
        }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text("Connect your Tally account to see payment info in your portfolio.")
                        .foregroundStyle(.secondary)
                }

                Section("BC Self-Serve Credentials") {
                    TextField("Username", text: $username)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    SecureField("Password", text: $password)
                }

                if step != .idle {
                    Section {
                        HStack(spacing: 10) {
                            ProgressView()
                            Text(step.label)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                    }
                }

                if let localError {
                    Section {
                        Text(localError)
                            .foregroundStyle(.red)
                    }
                }

                Section {
                    Button(step == .idle ? "Connect" : step.label) {
                        Task { await submit() }
                    }
                    .disabled(step != .idle || username.isEmpty || password.isEmpty)
                }
            }
            .navigationTitle("Connect Tally")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                        .disabled(step != .idle)
                }
            }
        }
    }

    private func submit() async {
        localError = nil
        step = .loggingIn
        try? await Task.sleep(nanoseconds: 100_000_000)
        step = .fetchingData
        let errorMsg = await appState.connectTally(username: username, password: password)
        step = .idle
        if errorMsg == nil {
            dismiss()
        } else {
            localError = errorMsg
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


