import UIKit
import WebKit

/// JavaScript dialogs, bridged to native alerts.
///
/// WKWebView does NOT implement alert() / confirm() / prompt() on its own — with
/// no WKUIDelegate they are silent no-ops, and prompt() hands JavaScript back a
/// null as if the user had cancelled. That silently killed every flow in the app
/// that asks a question: restoring from the vault, setting a price alert,
/// changing the passcode, enabling cloud backup, the FI income question, and the
/// wipe confirmation. All of them looked like a dead button.
///
/// Presenting them natively is also a small upgrade — they now match the system
/// look rather than Safari's web dialog.
extension WebScreen.Coordinator: WKUIDelegate {

    // Every one of these MUST call its completion handler exactly once, or
    // WebKit leaves the page's JavaScript suspended forever.

    func webView(
        _ webView: WKWebView,
        runJavaScriptAlertPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping () -> Void
    ) {
        guard let host = Self.topViewController() else { return completionHandler() }
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        host.present(a, animated: true)
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptConfirmPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping (Bool) -> Void
    ) {
        guard let host = Self.topViewController() else { return completionHandler(false) }
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "Abbrechen", style: .cancel) { _ in completionHandler(false) })
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        host.present(a, animated: true)
    }

    func webView(
        _ webView: WKWebView,
        runJavaScriptTextInputPanelWithPrompt prompt: String,
        defaultText: String?,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping (String?) -> Void
    ) {
        guard let host = Self.topViewController() else { return completionHandler(nil) }
        let a = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        a.addTextField { field in
            field.text = defaultText
            // The prompts here are passcodes and price targets; neither wants
            // autocapitalisation or autocorrection helpfully rewriting them.
            field.autocapitalizationType = .none
            field.autocorrectionType = .no
            if prompt.localizedCaseInsensitiveContains("passcode") {
                field.isSecureTextEntry = true
            } else if prompt.contains("$") {
                field.keyboardType = .decimalPad
            }
        }
        a.addAction(UIAlertAction(title: "Abbrechen", style: .cancel) { _ in completionHandler(nil) })
        a.addAction(UIAlertAction(title: "OK", style: .default) { [weak a] _ in
            completionHandler(a?.textFields?.first?.text ?? "")
        })
        host.present(a, animated: true)
    }

    static func topViewController() -> UIViewController? {
        let root = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first(where: \.isKeyWindow)?
            .rootViewController
        var top = root
        while let presented = top?.presentedViewController { top = presented }
        return top
    }
}
