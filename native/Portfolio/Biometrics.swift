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
    /// The Keychain account IS the username, and the stored data is the passcode —
    /// which is the correct model for a generic-password item and means Face ID
    /// restores a real credential pair rather than a bare secret. Passed in from
    /// the web layer so the account is whatever the owner signed in as.
    private static let fallbackAccount = "Isaacamsalu"

    private static func acct(_ a: String) -> String {
        let t = a.trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? fallbackAccount : t
    }

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
    static func isEnrolled(account: String) -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: acct(account),
            kSecReturnData as String: false,
            kSecUseAuthenticationUI as String: kSecUseAuthenticationUIFail,
        ]
        let status = SecItemCopyMatching(query as CFDictionary, nil)
        return status == errSecInteractionNotAllowed || status == errSecSuccess
    }

    static func save(account: String, secret: String) -> Bool {
        remove(account: account)
        guard let acl = SecAccessControlCreateWithFlags(
            nil,
            kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly,
            .biometryCurrentSet,
            nil
        ) else { return false }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: acct(account),
            kSecValueData as String: Data(secret.utf8),
            kSecAttrAccessControl as String: acl,
        ]
        return SecItemAdd(query as CFDictionary, nil) == errSecSuccess
    }

    /// Prompts Face ID and returns the secret, or nil on cancel/failure.
    /// Runs off the main thread because SecItemCopyMatching blocks while the
    /// biometric sheet is up.
    static func load(account: String, reason: String, completion: @escaping (String?, String?) -> Void) {
        let context = LAContext()
        context.localizedReason = reason
        // No "Enter Password" escape hatch in the system sheet — the app's own
        // passcode field is the fallback, and two competing ones is confusing.
        context.localizedFallbackTitle = ""

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: acct(account),
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

    static func remove(account: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: acct(account),
        ]
        SecItemDelete(query as CFDictionary)
    }
}
