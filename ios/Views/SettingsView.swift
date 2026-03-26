import PhotosUI
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
    @State private var avatarItem: PhotosPickerItem?
    @State private var avatarImage: Image?
    @State private var hasLoadedAvatar = false
    @State private var isUploadingAvatar = false
    @State private var showConnectTally = false
    @State private var showChangeName = false

    @AppStorage("showEarthquakes") private var showEarthquakes = true
    @AppStorage("showFlights") private var showFlights = true
    @AppStorage("showIncidents") private var showIncidents = true
    @AppStorage("showWeatherAlerts") private var showWeatherAlerts = true
    @AppStorage("showCrime") private var showCrime = true
    @AppStorage("showLocalEvents") private var showLocalEvents = true
    @AppStorage("showTraffic") private var showTraffic = true

    var body: some View {
        NavigationStack {
            Group {
                settingsList
            }
            .navigationTitle("Settings")
        }
        .onAppear {
            guard !hasLoadedAvatar else { return }
            hasLoadedAvatar = true
            loadSavedAvatar()
        }
        .onChange(of: appState.user?.avatarUrl) { _, newUrl in
            if avatarImage == nil, newUrl != nil {
                loadSavedAvatar()
            }
        }
        .onChange(of: avatarItem) { _, newItem in
            guard let newItem else { return }
            uploadAvatar(item: newItem)
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
                        if let url = URL(string: "https://monica.heyitsmejosh.com/settings") {
                            openURL(url)
                        }
                    }
                    Button("Cancel", role: .cancel) {}
                } message: {
                    Text("Subscription upgrades are handled on the web. You will be redirected to Monica on the web to complete the upgrade.")
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

                mapSourcesSection

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

                mapSourcesSection
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

    private var mapSourcesSection: some View {
        Section("Map Sources") {
            Toggle("Earthquakes", isOn: $showEarthquakes)
            Toggle("Flights", isOn: $showFlights)
            Toggle("Incidents", isOn: $showIncidents)
            Toggle("Weather Alerts", isOn: $showWeatherAlerts)
            Toggle("Crime", isOn: $showCrime)
            Toggle("Local Events", isOn: $showLocalEvents)
            Toggle("Traffic", isOn: $showTraffic)
        }
    }

    private var avatarPickerButton: some View {
        let currentImage = avatarImage
        let initial = avatarInitial
        let uploading = isUploadingAvatar
        return PhotosPicker(selection: $avatarItem, matching: .images) {
            ZStack {
                if let currentImage {
                    currentImage
                        .resizable()
                        .scaledToFill()
                        .frame(width: 56, height: 56)
                        .clipShape(Circle())
                } else {
                    Circle()
                        .fill(Palette.appleBlue.opacity(0.2))
                        .frame(width: 56, height: 56)
                    Text(initial)
                        .font(.title2.weight(.semibold))
                        .foregroundStyle(Palette.appleBlue)
                }
                if uploading {
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

    private var avatarFileURL: URL {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        return docs.appendingPathComponent("monica_avatar.jpg")
    }

    private func saveAvatarData(_ data: Data) {
        try? data.write(to: avatarFileURL)
    }

    private func uploadAvatar(item: PhotosPickerItem) {
        Task { @MainActor in
            if let data = try? await item.loadTransferable(type: Data.self),
               let uiImage = UIImage(data: data) {
                avatarImage = Image(uiImage: uiImage)
                if let jpegData = uiImage.jpegData(compressionQuality: 0.8) {
                    saveAvatarData(jpegData)
                    isUploadingAvatar = true
                    _ = try? await MonicaAPI.shared.uploadAvatar(imageData: jpegData)
                    isUploadingAvatar = false
                }
            }
        }
    }

    private func loadSavedAvatar() {
        if let data = try? Data(contentsOf: avatarFileURL),
           let uiImage = UIImage(data: data) {
            avatarImage = Image(uiImage: uiImage)
            return
        }
        guard let urlString = appState.user?.avatarUrl,
              let url = URL(string: urlString) else { return }
        Task { @MainActor in
            if let (data, _) = try? await URLSession.shared.data(from: url),
               let uiImage = UIImage(data: data) {
                avatarImage = Image(uiImage: uiImage)
                saveAvatarData(data)
            }
        }
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
        case "pro": return Palette.warningAmber
        case "ultra": return Palette.purple
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

private struct ConnectTallySheet: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    @State private var username = ""
    @State private var password = ""
    @State private var isSubmitting = false
    @State private var localError: String?

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

                if let localError {
                    Section {
                        Text(localError)
                            .foregroundStyle(.red)
                    }
                }

                Section {
                    Button(isSubmitting ? "Connecting..." : "Connect") {
                        Task { await submit() }
                    }
                    .disabled(isSubmitting || username.isEmpty || password.isEmpty)
                }
            }
            .navigationTitle("Connect Tally")
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
        let errorMsg = await appState.connectTally(username: username, password: password)
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
