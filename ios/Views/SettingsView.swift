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
    @State private var isUploadingAvatar = false
    @State private var showConnectTally = false
    @State private var showChangeName = false
    @State private var showAvatarOptions = false
    @State private var showPhotoPicker = false
    @State private var showCamera = false


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
            showAvatarOptions = true
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
        .confirmationDialog("Change Profile Photo", isPresented: $showAvatarOptions) {
            Button("Photo Library") { showPhotoPicker = true }
            if UIImagePickerController.isSourceTypeAvailable(.camera) {
                Button("Take Photo") { showCamera = true }
            }
            Button("Cancel", role: .cancel) {}
        }
        .photosPicker(isPresented: $showPhotoPicker, selection: $avatarItem, matching: .images)
        .fullScreenCover(isPresented: $showCamera) {
            CameraPickerView { image in
                if let jpegData = image.downsizedForAvatar().jpegData(compressionQuality: 0.7) {
                    appState.saveAvatarData(jpegData)
                    isUploadingAvatar = true
                    Task {
                        _ = try? await MonicaAPI.shared.uploadAvatar(imageData: jpegData)
                        isUploadingAvatar = false
                    }
                }
            }
            .ignoresSafeArea()
        }
    }

    private var avatarInitial: String {
        if let name = appState.user?.name, let first = name.first {
            return String(first).uppercased()
        }
        guard let email = appState.user?.email, let first = email.first else { return "?" }
        return String(first).uppercased()
    }

    private func uploadAvatar(item: PhotosPickerItem) {
        Task { @MainActor in
            if let data = try? await item.loadTransferable(type: Data.self),
               let uiImage = UIImage(data: data) {
                let resized = uiImage.downsizedForAvatar()
                if let jpegData = resized.jpegData(compressionQuality: 0.7) {
                    appState.saveAvatarData(jpegData)
                    isUploadingAvatar = true
                    _ = try? await MonicaAPI.shared.uploadAvatar(imageData: jpegData)
                    isUploadingAvatar = false
                }
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
        switch appState.user?.tier?.lowercased() {
        case "starter", "weekly": return Palette.appleBlue
        case "pro": return Palette.warningAmber
        default: return .secondary
        }
    }

    private var normalizedTier: SubscriptionTier {
        switch appState.user?.tier?.lowercased() {
        case "starter", "weekly":
            return .starter
        case "pro":
            return .pro
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
    case starter
    case pro

    var id: String { rawValue }

    var title: String {
        switch self {
        case .free:
            return "Free"
        case .starter:
            return "Weekly"
        case .pro:
            return "Pro"
        }
    }

    var price: String? {
        switch self {
        case .free:
            return "Free"
        case .starter:
            return "$1/wk"
        case .pro:
            return "$4/wk"
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

struct MapSourcesSettingsView: View {
    @AppStorage("showEarthquakes") private var showEarthquakes = true
    @AppStorage("showFlights") private var showFlights = true
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

struct CameraPickerView: UIViewControllerRepresentable {
    let onCapture: (UIImage) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.cameraCaptureMode = .photo
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraPickerView
        init(_ parent: CameraPickerView) { self.parent = parent }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            if let image = info[.originalImage] as? UIImage {
                parent.onCapture(image)
            }
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }
    }
}

private extension UIImage {
    func downsizedForAvatar(maxDimension: CGFloat = 512) -> UIImage {
        let maxSide = max(size.width, size.height)
        guard maxSide > maxDimension else { return self }
        let scale = maxDimension / maxSide
        let newSize = CGSize(width: size.width * scale, height: size.height * scale)
        let renderer = UIGraphicsImageRenderer(size: newSize)
        return renderer.image { _ in draw(in: CGRect(origin: .zero, size: newSize)) }
    }
}
