import SwiftUI
import StoreKit

struct SettingsView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.openURL) private var openURL
    @AppStorage("app_theme") private var rawTheme = "system"
    @AppStorage("epiphany_menu_bar_ticker") private var showMenuBar = true
    @AppStorage("showRainRadar") private var showRainRadar = false
    @AppStorage("showStorms") private var showStorms = true
    @State private var isUploadingAvatar = false
    // Apple allows a link to outside checkout only on the US storefront; elsewhere Pro needs IAP.
    @State private var isUSStorefront = false
    @State private var showChangeEmail = false
    @State private var showChangePassword = false
    @State private var showDeleteAccount = false
    @State private var brokerConnecting = false
    @State private var brokerStatus: String?
    @State private var staleBroker: String?

    var body: some View {
        NavigationStack {
            settingsContent
                .navigationTitle("Settings")
        }
        .onAppear {
            appState.loadAvatar()
            appState.restoreBrokerageSelection()
        }
        .task { await checkStaleBroker() }
        // The reconnect portal runs in the browser; coming back to the app is the cue to look again.
        .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in
            if staleBroker != nil { Task { await checkStaleBroker() } }
        }
    }

    private func checkStaleBroker() async {
        guard appState.brokerLinked, let r = try? await EpiphanyAPI.shared.syncBroker() else { return }
        staleBroker = r.connections?.first { $0.disabled == true }?.brokerName
        if staleBroker == nil, brokerStatus?.hasPrefix("Finish linking") == true { brokerStatus = "Reconnected" }
    }

    private func connectBrokerage(action: String? = nil) async {
        brokerConnecting = true
        defer { brokerConnecting = false }
        do {
            let result = try await EpiphanyAPI.shared.syncBroker(action: action)
            if result.upgradeRequired == true {
                brokerStatus = "Connecting another brokerage is a Premium feature."
                return
            }
            if let link = result.linkUrl, let url = URL(string: link) {
                brokerStatus = "Finish linking in the browser, then come back here."
                openURL(url)
            } else if result.linked == true {
                staleBroker = result.connections?.first { $0.disabled == true }?.brokerName
                let names = (result.connections ?? []).compactMap { $0.brokerName }.filter { !$0.isEmpty }
                let brokerName = names.isEmpty ? appState.brokerName : names.joined(separator: ", ")
                appState.saveBrokerageSelection(linked: true, name: brokerName)
                brokerStatus = brokerName.isEmpty ? "Brokerage linked" : "Connected: \(brokerName)"
            } else if result.skipped == true {
                brokerStatus = "Brokerage sync not configured on the server"
            }
        } catch {
            brokerStatus = "Connect failed: \(error.localizedDescription)"
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

    private var brokerageCard: some View {
        settingsCard("Brokerage", subtitle: "Connect a brokerage through SnapTrade to sync holdings and cash.") {
            VStack(alignment: .leading, spacing: 10) {
                if appState.brokerLinked {
                    if let stale = staleBroker {
                        Button {
                            Task { await connectBrokerage(action: "reconnect") }
                        } label: {
                            Label("Reconnect \(stale), it stopped syncing", systemImage: "exclamationmark.triangle.fill")
                                .foregroundStyle(.orange)
                        }
                        .disabled(brokerConnecting)
                    } else if !appState.brokerName.isEmpty {
                        Label(appState.brokerName, systemImage: "checkmark.circle.fill")
                            .foregroundStyle(.secondary)
                    }
                    HStack(spacing: 12) {
                        Button {
                            Task { await connectBrokerage(action: "connect-additional") }
                        } label: {
                            Label("Connect another brokerage", systemImage: "plus.circle")
                        }
                        .disabled(brokerConnecting)

                        Button(role: .destructive) {
                            Task { await disconnectBrokerage() }
                        } label: {
                            Label("Disconnect", systemImage: "link.badge.minus")
                        }
                        .disabled(brokerConnecting)
                    }
                } else {
                    Button {
                        Task { await connectBrokerage() }
                    } label: {
                        Label("Connect brokerage", systemImage: "link")
                    }
                    .disabled(brokerConnecting)
                }
                if brokerConnecting {
                    ProgressView().controlSize(.small)
                }
                if let status = brokerStatus {
                    Text(status)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    private var settingsContent: some View {
        ScrollView {
            VStack(spacing: 18) {
                if appState.isLoggedIn {
                    profileCard
                    if appState.user?.tier != "pro" && isUSStorefront { proCard }
                    accountCard
                    brokerageCard
                    mapSourcesCard
                    appearanceCard
                    signOutCard
                    dangerZoneCard
                } else {
                    signedOutCard
                    appearanceCard
                }
            }
            .task { isUSStorefront = await Storefront.current?.countryCode == "USA" }
            // A settings column, not a billboard: System Settings width, centred.
            .frame(maxWidth: 680)
            .padding(.horizontal, 20)
            .padding(.top, 16)
            .padding(.bottom, 96)
            .frame(maxWidth: .infinity)
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
    }

    private var appearanceCard: some View {
        settingsCard("Appearance", subtitle: "Choose how the app looks across light, dark, and system modes.") {
            AppearancePicker(rawTheme: $rawTheme)
        }
    }

    private var profileCard: some View {
        ZStack(alignment: .leading) {
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(Color.primary.opacity(0.05))

            VStack(alignment: .leading, spacing: 16) {
                HStack(spacing: 18) {
                    Button { Task { await newAvatar() } } label: { ZStack {
                        if let data = appState.avatarImageData,
                           let nsImage = NSImage(data: data) {
                            Image(nsImage: nsImage)
                                .resizable()
                                .scaledToFill()
                                .frame(width: 80, height: 80)
                                .clipShape(Circle())
                        } else {
                            Circle()
                                .fill(Color.primary.opacity(0.12))
                                .frame(width: 80, height: 80)
                            Text(avatarInitial)
                                .font(.title2.weight(.bold))
                                .foregroundStyle(.primary)
                        }
                        if isUploadingAvatar {
                            Circle().fill(.black.opacity(0.45)).frame(width: 80, height: 80)
                            ProgressView().controlSize(.small)
                        }
                    } }
                    .buttonStyle(.plain)
                    .help("New avatar")
                    .accessibilityLabel("New avatar")

                    VStack(alignment: .leading, spacing: 4) {
                        Text(appState.user?.email ?? "")
                            .font(.title2.weight(.semibold))
                        Text("Click your picture for a new one")
                            .font(.callout)
                            .foregroundStyle(.secondary)
                    }
                    Spacer(minLength: 0)
                }
            }
            .padding(Spacing.lg)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .stroke(Color.primary.opacity(0.08), lineWidth: 1)
        )
    }

    private var accountCard: some View {
        settingsCard("Account", subtitle: "Update the credentials tied to this macOS session.") {
            HStack(spacing: 12) {
                actionTile(
                    title: "Change Email",
                    subtitle: "Update your login address",
                    systemImage: "envelope"
                ) {
                    showChangeEmail = true
                }

                actionTile(
                    title: "Change Password",
                    subtitle: "Rotate your account password",
                    systemImage: "lock"
                ) {
                    showChangePassword = true
                }
            }
            Divider()
            Toggle("Show ticker bar", isOn: Binding(
                get: { UserDefaults.standard.object(forKey: "epiphany_show_ticker") as? Bool ?? true },
                set: { UserDefaults.standard.set($0, forKey: "epiphany_show_ticker") }
            ))
            .padding(.top, 4)
            Toggle("Show prices in the menu bar", isOn: $showMenuBar)
        }
    }

    private var mapSourcesCard: some View {
        settingsCard("Map Sources", subtitle: "Choose which live feeds appear on the map.") {
            VStack(spacing: 12) {
                sourceToggleRow(
                    title: "Earthquakes",
                    subtitle: "Seismic activity and tremors",
                    systemImage: "waveform.path.ecg",
                    isOn: sourceBinding(\.situationEarthquakesEnabled)
                )
                sourceToggleRow(
                    title: "Flights",
                    subtitle: "Aircraft positions and movement",
                    systemImage: "airplane",
                    isOn: sourceBinding(\.situationFlightsEnabled)
                )
                if appState.situationFlightsEnabled {
                    FlightKindToggles()
                        .padding(.leading, 36)
                }
                sourceToggleRow(
                    title: "Incidents",
                    subtitle: "Closures, alerts, and disruptions",
                    systemImage: "exclamationmark.triangle",
                    isOn: sourceBinding(\.situationIncidentsEnabled)
                )
                sourceToggleRow(
                    title: "Weather Alerts",
                    subtitle: "Warnings, watches, and advisories",
                    systemImage: "cloud.rain",
                    isOn: sourceBinding(\.situationWeatherEnabled)
                )
                sourceToggleRow(
                    title: "Crime",
                    subtitle: "Crime incidents and reports",
                    systemImage: "shield.lefthalf.filled",
                    isOn: sourceBinding(\.situationCrimeEnabled)
                )
                sourceToggleRow(
                    title: "Local Events",
                    subtitle: "Nearby events and happenings",
                    systemImage: "calendar.badge.clock",
                    isOn: sourceBinding(\.situationLocalEventsEnabled)
                )
                sourceToggleRow(
                    title: "Traffic",
                    subtitle: "Traffic incidents and congestion",
                    systemImage: "car.fill",
                    isOn: sourceBinding(\.situationTrafficEnabled)
                )
                sourceToggleRow(
                    title: "Wildfires",
                    subtitle: "Active wildfire hotspots from NASA",
                    systemImage: "flame",
                    isOn: sourceBinding(\.situationWildfiresEnabled)
                )
                sourceToggleRow(
                    title: "Rain Radar",
                    subtitle: "Latest radar frame from RainViewer",
                    systemImage: "cloud.rain",
                    isOn: $showRainRadar
                )
                sourceToggleRow(
                    title: "Tropical Storms",
                    subtitle: "Hurricane tracks and cones from the NHC",
                    systemImage: "hurricane",
                    isOn: $showStorms
                )
            }
        }
    }

    private var proCard: some View {
        settingsCard("Epiphany Pro", subtitle: "Portfolio, ontology and deep data. $1.99 a month or $14.99 a year, billed on the web.") {
            Link("Get Epiphany Pro", destination: URL(string: "https://epiphany.jaybulb.com/?pro=1")!)
                .buttonStyle(.borderedProminent)
        }
    }

    private var signOutCard: some View {
        settingsCard("Session", subtitle: "End the current authenticated session on this Mac.") {
            Button(role: .destructive) {
                Task { await appState.logout() }
            } label: {
                Text("Sign Out")
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
            .buttonStyle(.bordered)
            .tint(.red)
        }
    }

    private var dangerZoneCard: some View {
        settingsCard("Danger Zone", subtitle: "Permanent account actions live here.") {
            Button(role: .destructive) {
                showDeleteAccount = true
            } label: {
                HStack {
                    Label("Delete Account", systemImage: "trash")
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.secondary)
                }
                .padding(Spacing.smPlus)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(Color.red.opacity(0.08))
                )
            }
            .buttonStyle(.plain)
        }
    }

    private var signedOutCard: some View {
        settingsCard("Sign In", subtitle: "Authenticate to manage your Epiphany account and source toggles.") {
            Button("Open Login") {
                appState.showLogin = true
            }
            .buttonStyle(.borderedProminent)
            .tint(Palette.linkBlue)
        }
    }

    private var avatarInitial: String {
        guard let email = appState.user?.email, let first = email.first else { return "?" }
        return String(first).uppercased()
    }


    private func sourceBinding(_ keyPath: ReferenceWritableKeyPath<AppState, Bool>) -> Binding<Bool> {
        Binding(
            get: { appState[keyPath: keyPath] },
            set: { appState[keyPath: keyPath] = $0 }
        )
    }

    private func newAvatar() async {
        guard !isUploadingAvatar else { return }
        isUploadingAvatar = true
        defer { isUploadingAvatar = false }
        // 9 Epiphany glyphs x 12 duotones (old file names), the same files the iPhone and web pick from.
        let gods = ["aphrodite", "ares", "artemis", "athena", "demeter", "dionysus", "hera", "hermes", "zeus"]
        guard let url = URL(string: "https://epiphany.jaybulb.com/avatars/gods/\(gods.randomElement()!)-\(Int.random(in: 0..<12)).jpg"),
              let (data, _) = try? await URLSession.shared.data(from: url), NSImage(data: data) != nil else { return }
        appState.saveAvatarData(data)
        try? await EpiphanyAPI.shared.uploadAvatar(imageData: data)
    }

    private func settingsCard<Content: View>(
        _ title: String,
        subtitle: String,
        @ViewBuilder content: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            content()
        }
        .padding(Spacing.mdPlus)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(.ultraThinMaterial)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(Color.primary.opacity(0.06), lineWidth: 1)
        )
    }

    private func actionTile(
        title: String,
        subtitle: String,
        systemImage: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 10) {
                Image(systemName: systemImage)
                    .font(.headline.weight(.semibold))
                    .foregroundStyle(Palette.paleBlueAlt)
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            .frame(maxWidth: .infinity, minHeight: 112, alignment: .topLeading)
            .padding(Spacing.smPlus)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Color.primary.opacity(0.04))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(Color.primary.opacity(0.05), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private func sourceToggleRow(
        title: String,
        subtitle: String,
        systemImage: String,
        isOn: Binding<Bool>
    ) -> some View {
        HStack(spacing: 14) {
            Image(systemName: systemImage)
                .font(.headline)
                .foregroundStyle(Palette.paleBlueAlt)
                .frame(width: 22)

            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Toggle("", isOn: isOn)
                .labelsHidden()
                .toggleStyle(.switch)
        }
        .padding(Spacing.smPlus)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color.primary.opacity(0.04))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Color.primary.opacity(0.05), lineWidth: 1)
        )
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
                        .autocorrectionDisabled()
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
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private func submit() async {
        isSubmitting = true
        defer { isSubmitting = false }
        let success = await appState.changeEmail(
            to: newEmail.trimmingCharacters(in: .whitespacesAndNewlines),
            password: password
        )
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
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
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
        let success = await appState.changePassword(
            currentPassword: currentPassword,
            newPassword: newPassword
        )
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
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
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
                                    .stroke(rawTheme == id ? Palette.linkBlue : Color.primary.opacity(0.08), lineWidth: 2)
                            )
                        Text(label)
                            .font(.caption.weight(.medium))
                            .foregroundStyle(rawTheme == id ? Palette.linkBlue : .secondary)
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

