import AuthenticationServices
import CryptoKit
import SwiftUI

/// Sign in with Apple and Google as 48 point capsules, matching the web's OAuthButtons.
struct SocialSignInButtons: View {
    @Binding var error: String?
    @Environment(AppState.self) private var appState
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.webAuthenticationSession) private var webAuthenticationSession
    // Every nonce handed to Apple, newest last. A double tap starts two requests and the
    // token that comes back can answer the older one, so match by the hash Apple signed.
    @State private var issuedNonces: [String] = []

    var body: some View {
        VStack(spacing: 12) {
            SignInWithAppleButton(.continue) { request in
                let nonce = AppleNonce.make()
                issuedNonces = Array((issuedNonces + [nonce]).suffix(5))
                request.requestedScopes = [.fullName, .email]
                request.nonce = AppleNonce.sha256(nonce)
            } onCompletion: { result in
                Task { await finishApple(result) }
            }
            .signInWithAppleButtonStyle(colorScheme == .dark ? .white : .black)
            .frame(height: 48)
            .clipShape(Capsule())

            Button {
                Task { await signInWithGoogle() }
            } label: {
                HStack(spacing: 10) {
                    Image("GoogleMark")
                        .resizable()
                        .frame(width: 18, height: 18)
                    Text("Continue with Google")
                        .fontWeight(.semibold)
                }
                .frame(maxWidth: .infinity, minHeight: 48)
                .foregroundStyle(.black)
                .background(.white, in: Capsule())
                .overlay(Capsule().strokeBorder(.black.opacity(0.12)))
                .contentShape(Capsule())
            }
            .buttonStyle(.plain)
        }
        .disabled(appState.isAuthenticating)
    }

    private func finishApple(_ result: Result<ASAuthorization, Error>) async {
        switch result {
        case .failure(let failure):
            if (failure as? ASAuthorizationError)?.code != .canceled {
                error = failure.localizedDescription
            }
        case .success(let authorization):
            guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                  let tokenData = credential.identityToken,
                  let token = String(data: tokenData, encoding: .utf8),
                  let nonce = AppleNonce.match(token: token, among: issuedNonces) else {
                error = "Apple sign-in did not finish. Try again."
                return
            }
            let name = credential.fullName
                .map { PersonNameComponentsFormatter().string(from: $0) }
                .flatMap { $0.isEmpty ? nil : $0 }
            await appState.signInWithApple(identityToken: token, nonce: nonce, fullName: name)
            error = appState.error
        }
    }

    private func signInWithGoogle() async {
        do {
            let callback = try await webAuthenticationSession.authenticate(
                using: EpiphanyAPI.shared.googleSignInURL,
                callbackURLScheme: "epiphany",
                preferredBrowserSession: .ephemeral
            )
            guard let token = URLComponents(url: callback, resolvingAgainstBaseURL: false)?
                .queryItems?.first(where: { $0.name == "token" })?.value else {
                error = "Google sign-in did not finish. Try again."
                return
            }
            await appState.signInWithGoogle(sessionToken: token)
            error = appState.error
        } catch let failure as ASWebAuthenticationSessionError where failure.code == .canceledLogin {
            return
        } catch {
            self.error = error.localizedDescription
        }
    }
}

enum AppleNonce {
    static func make() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return bytes.map { String(format: "%02x", $0) }.joined()
    }

    static func sha256(_ value: String) -> String {
        SHA256.hash(data: Data(value.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    /// The raw nonce whose hash Apple signed into this identity token, if we issued it.
    static func match(token: String, among nonces: [String]) -> String? {
        let parts = token.split(separator: ".")
        guard parts.count == 3 else { return nil }
        var payload = parts[1].replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        payload += String(repeating: "=", count: (4 - payload.count % 4) % 4)
        guard let data = Data(base64Encoded: payload),
              let claims = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let signed = claims["nonce"] as? String else { return nil }
        return nonces.last { sha256($0) == signed }
    }
}
