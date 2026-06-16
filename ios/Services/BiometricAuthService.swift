import Foundation
import LocalAuthentication

struct BiometricAuthService {
    func availableBiometryType() -> LABiometryType {
        let context = LAContext()
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil) else {
            return .none
        }
        return context.biometryType
    }

    func hasSavedCredentials() -> Bool {
        guard let savedEmail = UserDefaults.standard.string(forKey: KeychainHelper.savedEmailKey) else {
            return false
        }
        return KeychainHelper.load(account: savedEmail) != nil
    }

    func saveCredentials(email: String, password: String) {
        UserDefaults.standard.set(email, forKey: KeychainHelper.savedEmailKey)
        KeychainHelper.save(account: email, password: password)
    }

    func clearCredentials() {
        if let savedEmail = UserDefaults.standard.string(forKey: KeychainHelper.savedEmailKey) {
            KeychainHelper.delete(account: savedEmail)
        }
        UserDefaults.standard.removeObject(forKey: KeychainHelper.savedEmailKey)
    }

    func loadSavedCredentials() -> (email: String, password: String)? {
        guard let savedEmail = UserDefaults.standard.string(forKey: KeychainHelper.savedEmailKey),
              let savedPassword = KeychainHelper.load(account: savedEmail) else {
            return nil
        }
        return (savedEmail, savedPassword)
    }

    func authenticate(localizedReason: String) async throws {
        let context = LAContext()
        // Prefer biometrics, but allow passcode fallback when Face ID / Touch ID is temporarily unavailable.
        try await context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: localizedReason)
    }
}
