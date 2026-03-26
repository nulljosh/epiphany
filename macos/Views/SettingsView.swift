import SwiftUI

struct SettingsView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.openURL) private var openURL
    @State private var showUpgradeAlert = false
    @State private var upgradeTarget: SubscriptionTier?
    @State private var showChangeEmail = false
    @State private var showChangePassword = false
    @State private var showDeleteAccount = false
    @State private var avatarImage: NSImage?
    @State private var hasLoadedAvatar = false

    var body: some View {
        NavigationStack {
            settingsContent
                .navigationTitle("Settings")
        }
        .onAppear {
            guard !hasLoadedAvatar else { return }
            hasLoadedAvatar = true
            loadAvatar()
        }
    }

    private var settingsContent: some View {
        ScrollView {
            VStack(spacing: 18) {
                if appState.isLoggedIn {
                    profileCard
                    subscriptionCard
                    accountCard
                    mapSourcesCard
                    signOutCard
                    dangerZoneCard
                } else {
                    signedOutCard
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 16)
            .padding(.bottom, 96)
        }
        .alert("Upgrade to \(upgradeTarget?.title ?? "")", isPresented: $showUpgradeAlert) {
            Button("Open Web Upgrade") {
                if let url = URL(string: "https://opticon.heyitsmejosh.com/settings") {
                    openURL(url)
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Subscription upgrades are handled on the web. You will be redirected to Monica on the web to complete the upgrade.")
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

    private var profileCard: some View {
        ZStack(alignment: .topTrailing) {
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(Color.white.opacity(0.05))

            VStack(alignment: .leading, spacing: 16) {
                HStack(spacing: 14) {
                    ZStack {
                        if let avatarImage {
                            Image(nsImage: avatarImage)
                                .resizable()
                                .scaledToFill()
                                .frame(width: 62, height: 62)
                                .clipShape(Circle())
                        } else {
                            Circle()
                                .fill(Color.white.opacity(0.12))
                                .frame(width: 62, height: 62)
                            Text(avatarInitial)
                                .font(.title2.weight(.bold))
                                .foregroundStyle(.white)
                        }
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text(appState.user?.email ?? "")
                            .font(.headline)
                        Text("Monica \(tierLabel)")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(tierColor)
                    }
                }

                HStack(spacing: 10) {
                    statPill(title: "Plan", value: tierLabel)
                    statPill(title: "Sources", value: "\(enabledSourceCount)/7 on")
                    statPill(title: "Shell", value: "macOS")
                }
            }
            .padding(20)
        }
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .stroke(Color.white.opacity(0.08), lineWidth: 1)
        )
    }

    private var subscriptionCard: some View {
        settingsCard("Subscription", subtitle: "Manage what plan you are on and where upgrades happen.") {
            VStack(spacing: 10) {
                ForEach(SubscriptionTier.allCases) { tier in
                    Button {
                        guard tier != normalizedTier, tier != .free else { return }
                        upgradeTarget = tier
                        showUpgradeAlert = true
                    } label: {
                        HStack(spacing: 14) {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(tier.title)
                                    .font(.subheadline.weight(.semibold))
                                if let price = tier.price {
                                    Text(price)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }

                            Spacer()

                            if normalizedTier == tier {
                                Label("Current", systemImage: "checkmark.circle.fill")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(Palette.cyanAlt)
                            } else if tier != .free {
                                Text("Upgrade")
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(Palette.linkBlue)
                            }
                        }
                        .padding(14)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .fill(normalizedTier == tier ? Color.white.opacity(0.08) : Color.white.opacity(0.04))
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .stroke(normalizedTier == tier ? Palette.linkBlue.opacity(0.35) : Color.white.opacity(0.05), lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
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
            }
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
                .padding(14)
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
        settingsCard("Sign In", subtitle: "Authenticate to manage your Monica account and source toggles.") {
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

    private func loadAvatar() {
        guard let urlString = appState.user?.avatarUrl,
              let url = URL(string: urlString) else { return }
        Task { @MainActor in
            if let (data, _) = try? await URLSession.shared.data(from: url),
               let image = NSImage(data: data) {
                avatarImage = image
            }
        }
    }

    private func sourceBinding(_ keyPath: ReferenceWritableKeyPath<AppState, Bool>) -> Binding<Bool> {
        Binding(
            get: { appState[keyPath: keyPath] },
            set: { appState[keyPath: keyPath] = $0 }
        )
    }

    private var tierLabel: String {
        switch appState.user?.tier {
        case "starter": return "Starter"
        case "pro": return "Pro"
        case "ultra": return "Ultra"
        default: return "Free"
        }
    }

    private var tierColor: Color {
        switch appState.user?.tier {
        case "starter": return Palette.appleBlue
        case "pro": return Palette.warningAmberAlt
        case "ultra": return Palette.ultraPurple
        default: return .secondary
        }
    }

    private var normalizedTier: SubscriptionTier {
        switch appState.user?.tier?.lowercased() {
        case "starter", "pro":
            return .pro
        case "ultra":
            return .ultra
        default:
            return .free
        }
    }

    private var enabledSourceCount: Int {
        [
            appState.situationEarthquakesEnabled,
            appState.situationFlightsEnabled,
            appState.situationIncidentsEnabled,
            appState.situationWeatherEnabled,
            appState.situationCrimeEnabled,
            appState.situationLocalEventsEnabled,
            appState.situationTrafficEnabled,
        ]
        .filter { $0 }
        .count
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
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(.ultraThinMaterial)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(Color.white.opacity(0.06), lineWidth: 1)
        )
    }

    private func statPill(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title.uppercased())
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.white.opacity(0.55))
            Text(value)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.white)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 9)
        .background(
            Capsule()
                .fill(Color.white.opacity(0.08))
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
                    .foregroundStyle(Palette.cyanAlt)
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            .frame(maxWidth: .infinity, minHeight: 112, alignment: .topLeading)
            .padding(14)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Color.white.opacity(0.04))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(Color.white.opacity(0.05), lineWidth: 1)
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
                .foregroundStyle(Palette.cyanAlt)
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
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color.white.opacity(0.04))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Color.white.opacity(0.05), lineWidth: 1)
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
                    Text("This permanently deletes your Monica account and associated data.")
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

private enum SubscriptionTier: String, CaseIterable, Identifiable {
    case free
    case pro
    case ultra

    var id: String { rawValue }

    var title: String {
        switch self {
        case .free:
            return "Free"
        case .pro:
            return "Pro"
        case .ultra:
            return "Ultra"
        }
    }

    var price: String? {
        switch self {
        case .free:
            return "Free"
        case .pro:
            return "$20/mo"
        case .ultra:
            return "$50/mo"
        }
    }
}
