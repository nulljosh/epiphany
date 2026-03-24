import AuthenticationServices
import LocalAuthentication
import SwiftUI

struct LoginSheet: View {
    @Environment(AppState.self) private var appState
    @State private var email = ""
    @State private var password = ""
    @State private var showPassword = false
    @State private var isRegistering = false
    @State private var error: String?
    @State private var biometryType: LABiometryType = .none
    @FocusState private var focusedField: Field?

    private enum Field { case email, password }

    private var canUseBiometrics: Bool {
        biometryType != .none
    }

    private var biometricLabel: String {
        switch biometryType {
        case .faceID: return "Face ID"
        case .touchID: return "Touch ID"
        case .opticID: return "Optic ID"
        default: return "Biometrics"
        }
    }

    private var biometricIcon: String {
        switch biometryType {
        case .faceID: return "faceid"
        case .touchID: return "touchid"
        case .opticID: return "opticid"
        default: return "lock.shield"
        }
    }

    private var hasSavedCredentials: Bool {
        appState.hasSavedBiometricCredentials()
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Spacer()

                // Biometric login button
                if !isRegistering, canUseBiometrics, hasSavedCredentials {
                    Button(action: authenticateWithBiometrics) {
                        Label("Sign in with \(biometricLabel)", systemImage: biometricIcon)
                            .frame(maxWidth: .infinity)
                            .fontWeight(.semibold)
                    }
                    .buttonStyle(.bordered)
                    .tint(Palette.appleBlue)
                    .padding(.horizontal)

                    HStack {
                        Rectangle().frame(height: 1).foregroundStyle(.quaternary)
                        Text("or")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Rectangle().frame(height: 1).foregroundStyle(.quaternary)
                    }
                    .padding(.horizontal, 32)
                }

                // Sign in with Apple
                SignInWithAppleButton(
                    isRegistering ? .signUp : .signIn,
                    onRequest: { request in
                        request.requestedScopes = [.email, .fullName]
                    },
                    onCompletion: { result in
                        handleAppleSignIn(result)
                    }
                )
                .signInWithAppleButtonStyle(.black)
                .frame(height: 50)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .padding(.horizontal)

                HStack {
                    Rectangle().frame(height: 1).foregroundStyle(.quaternary)
                    Text("or")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Rectangle().frame(height: 1).foregroundStyle(.quaternary)
                }
                .padding(.horizontal, 32)

                VStack(spacing: 16) {
                    TextField("Email", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($focusedField, equals: .email)
                        .padding(12)
                        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 10))
                        .onSubmit { focusedField = .password }
                        .submitLabel(.next)

                    HStack(spacing: 0) {
                        Group {
                            if showPassword {
                                TextField("Password", text: $password)
                                    .textContentType(isRegistering ? .newPassword : .password)
                            } else {
                                SecureField("Password", text: $password)
                                    .textContentType(isRegistering ? .newPassword : .password)
                            }
                        }
                        .focused($focusedField, equals: .password)
                        .onSubmit { submitForm() }
                        .submitLabel(.go)

                        Button {
                            showPassword.toggle()
                        } label: {
                            Image(systemName: showPassword ? "eye.slash" : "eye")
                                .foregroundStyle(.secondary)
                                .frame(width: 32, height: 32)
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(12)
                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 10))
                }
                .padding(.horizontal)

                if let error {
                    Text(error)
                        .foregroundStyle(Palette.dangerRed)
                        .font(.caption)
                        .padding(.horizontal)
                }

                Button(action: submitForm) {
                    if appState.isAuthenticating {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                            .frame(height: 20)
                    } else {
                        Text(isRegistering ? "Create Account" : "Sign In")
                            .frame(maxWidth: .infinity)
                            .fontWeight(.semibold)
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(Palette.appleBlue)
                .disabled(email.isEmpty || password.isEmpty || appState.isAuthenticating)
                .padding(.horizontal)

                Button {
                    isRegistering.toggle()
                    error = nil
                } label: {
                    Text(isRegistering ? "Already have an account? Sign In" : "Don't have an account? Register")
                        .font(.caption)
                }
                .tint(.secondary)

                if !isRegistering {
                    Button {
                        requestPasswordReset()
                    } label: {
                        Text("Forgot password?")
                            .font(.caption)
                    }
                    .tint(.secondary)
                    .disabled(email.isEmpty)
                }

                Spacer()
                Spacer()
            }
            .navigationTitle(isRegistering ? "Register" : "Sign In")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        appState.showLogin = false
                        appState.error = nil
                    }
                }
            }
            .onAppear {
                biometryType = appState.biometricBiometryType()
            }
        }
    }

    private func submitForm() {
        guard !email.isEmpty, !password.isEmpty, !appState.isAuthenticating else { return }
        focusedField = nil
        Task {
            error = nil
            if isRegistering {
                await appState.register(email: email, password: password)
            } else {
                await appState.login(email: email, password: password)
            }
            if appState.error == nil {
                appState.saveBiometricCredentials(email: email, password: password)
            }
            error = appState.error
        }
    }

    private func requestPasswordReset() {
        guard !email.isEmpty else { return }
        Task {
            error = nil
            do {
                try await OpticonAPI.shared.forgotPassword(email: email)
                error = "Reset link sent if account exists."
            } catch {
                self.error = "Could not send reset link."
            }
        }
    }

    private func authenticateWithBiometrics() {
        Task {
            error = nil
            await appState.biometricLogin()
            error = appState.error
        }
    }

    private func handleAppleSignIn(_ result: Result<ASAuthorization, Error>) {
        switch result {
        case .success(let auth):
            guard let credential = auth.credential as? ASAuthorizationAppleIDCredential,
                  let identityToken = credential.identityToken,
                  let tokenString = String(data: identityToken, encoding: .utf8) else {
                error = "Failed to get Apple ID token"
                return
            }
            let appleEmail = credential.email
            let fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
                .compactMap { $0 }
                .joined(separator: " ")

            Task {
                error = nil
                await appState.signInWithApple(
                    identityToken: tokenString,
                    email: appleEmail,
                    fullName: fullName.isEmpty ? nil : fullName
                )
                error = appState.error
            }
        case .failure(let err):
            if (err as? ASAuthorizationError)?.code == .canceled { return }
            error = "Apple Sign In failed"
        }
    }
}
