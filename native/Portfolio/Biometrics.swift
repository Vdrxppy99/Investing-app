import Foundation
import LocalAuthentication
import Security

/// Face ID unlock for the native shell.
///
/// WHY THIS EXISTS: the web app unlocks with a WebAuthn passkey using the PRF
/// extension, and WKWebView does not expose WebAuthn at all. That works in Safari
/// and is simply unavailable inside this app, so Face ID could never fire here and
/// every launch fell back to typing the passcode.
///
/// This is the native equivalent, and the pattern banking apps use: the passcode
/// is stored as a generic-password Keychain item whose access control requires
/// biometry, so retrieving it *is* the Face ID prompt. The item is protected by
/// the Secure Enclave and cannot leave the device.
///
/// SECURITY TRADEOFF, STATED PLAINLY: before this, the passcode was stored
/// nowhere — it existed only in memory while being typed. It is now persisted, in
/// hardware-backed storage, gated behind the owner's face. That is a deliberate
/// change to the model, made with the owner's explicit agreement, and it is why
/// the flags below are the strict ones:
///
///   • kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly — never syncs to iCloud,
///     never restores to another device, and refuses to exist at all if the phone
///     has no device passcode set.
///   • .biometryCurrentSet — invalidated automatically if a face or fingerprint is
///     added or removed, so enrolling someone else's face cannot unlock the vault.
///
/// The vault's cryptography is untouched: this hands the passcode to the existing
/// unlockWithPass(), which derives the same KEK through the same PBKDF2 path.
enum Biometrics {
    private static let service = "de.portfolio.app.vault"
    /// The Keychain account field. It is only an identifier inside this app's own
    /// service namespace — nothing authenticates against it — but a real name is
    /// worth having: it is what shows if the item ever surfaces in a system UI,
    /// and it leaves room for more than one identity later.
    private static let account = "isaacamsalu"

    /// Is biometry usable on this device right now?
    static func available() -> Bool {
        var error: NSError?
        let ok = LAContext().canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error)
        return ok
    }

    /// Is a secret enrolled? Deliberately does NOT prompt: passing
    /// kSecUseAuthenticationUIFail makes the Keychain report that the item exists
    /// but needs authentication, which is exactly the answer we want without
    /// putting a Face ID sheet in front of the user just to check.
    static func isEnrolled() -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: false,
            kSecUseAuthenticationUI as String: kSecUseAuthenticationUIFail,
        ]
        let status = SecItemCopyMatching(query as CFDictionary, nil)
        return status == errSecInteractionNotAllowed || status == errSecSuccess
    }

    static func save(_ secret: String) -> Bool {
        remove()
        guard let acl = SecAccessControlCreateWithFlags(
            nil,
            kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,
            .biometryCurrentSet,
            nil
        ) else { return false }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: Data(secret.utf8),
            kSecAttrAccessControl as String: acl,
        ]
        return SecItemAdd(query as CFDictionary, nil) == errSecSuccess
    }

    /// Prompts Face ID and returns the secret, or nil on cancel/failure.
    /// Runs off the main thread because SecItemCopyMatching blocks while the
    /// biometric sheet is up.
    static func load(reason: String, completion: @escaping (String?, String?) -> Void) {
        let context = LAContext()
        context.localizedReason = reason
        // No "Enter Password" escape hatch in the system sheet — the app's own
        // passcode field is the fallback, and two competing ones is confusing.
        context.localizedFallbackTitle = ""

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
            kSecUseAuthenticationContext as String: context,
        ]

        DispatchQueue.global(qos: .userInitiated).async {
            var out: CFTypeRef?
            let status = SecItemCopyMatching(query as CFDictionary, &out)
            var secret: String?
            var failure: String?

            switch status {
            case errSecSuccess:
                secret = (out as? Data).flatMap { String(data: $0, encoding: .utf8) }
                if secret == nil { failure = "unreadable" }
            case errSecUserCanceled:
                failure = "cancelled"
            case errSecItemNotFound:
                failure = "not-enrolled"
            case errSecAuthFailed:
                failure = "auth-failed"
            default:
                // Most commonly errSecInteractionNotAllowed, which here means the
                // biometric set changed and .biometryCurrentSet invalidated the
                // item — the passcode has to re-enrol it.
                failure = "invalidated"
            }
            DispatchQueue.main.async { completion(secret, failure) }
        }
    }

    static func remove() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
