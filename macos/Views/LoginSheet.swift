import SwiftUI
import LocalAuthentication

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
        biometryType == .faceID ? "Face ID" : "Touch ID"
    }

    private var biometricIcon: String {
        biometryType == .faceID ? "faceid" : "touchid"
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

                VStack(spacing: 16) {
                    TextField("Email", text: $email)
                        .textContentType(.emailAddress)
                        .autocorrectionDisabled()
                        .focused($focusedField, equals: .email)
                        .padding(12)
                        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 10))
                        .onSubmit { focusedField = .password }

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

                Spacer()
                Spacer()
            }
            .navigationTitle(isRegistering ? "Register" : "Sign In")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        appState.showLogin = false
                        appState.error = nil
                    }
                }
            }
            .onAppear {
                biometryType = appState.biometricBiometryType()
                if let saved = appState.savedCredentials {
                    if email.isEmpty {
                        email = saved.email
                    }
                    if password.isEmpty {
                        password = saved.password
                    }
                }
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
            error = appState.error
        }
    }

    private func authenticateWithBiometrics() {
        Task {
            error = nil
            await appState.biometricLogin()
            error = appState.error
        }
    }
}
