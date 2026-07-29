import SwiftUI
import WebKit

struct WebScreen: UIViewRepresentable {
    let url: URL

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        // Persistent store so the vault restore only has to be done once.
        config.websiteDataStore = .default()

        // Face ID bridge. WKWebView has no WebAuthn, so biometrics must come from
        // the native side — see Biometrics.swift.
        let controller = WKUserContentController()
        controller.add(context.coordinator, name: "bio")
        controller.addUserScript(WKUserScript(source: Coordinator.shim,
                                              injectionTime: .atDocumentStart,
                                              forMainFrameOnly: true))
        config.userContentController = controller

        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        // Without this, alert/confirm/prompt are silent no-ops — see Dialogs.swift.
        web.uiDelegate = context.coordinator
        web.isOpaque = false
        web.backgroundColor = .clear
        web.scrollView.backgroundColor = .clear
        web.allowsBackForwardNavigationGestures = false
        if #available(iOS 16.4, *) { web.isInspectable = true }

        // Pull to refresh — the one gesture a portfolio dashboard genuinely wants,
        // and something the home-screen PWA cannot offer.
        let refresh = UIRefreshControl()
        refresh.tintColor = .white
        refresh.addTarget(context.coordinator, action: #selector(Coordinator.reload(_:)), for: .valueChanged)
        web.scrollView.refreshControl = refresh
        context.coordinator.web = web

        web.load(URLRequest(url: url))
        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        weak var web: WKWebView?


        /// Injected before any page script, so vault.js sees it on first run.
        /// Promise-shaped to match the WebAuthn path it replaces.
        static let shim = """
        (function () {
          if (window.BasisNative) return;
          var seq = 0, waiting = {};
          window.__bioReply = function (id, ok, value, err) {
            var w = waiting[id]; if (!w) return; delete waiting[id];
            ok ? w.resolve(value) : w.reject(new Error(err || 'bio-failed'));
          };
          function call(action, payload) {
            return new Promise(function (resolve, reject) {
              var id = ++seq; waiting[id] = { resolve: resolve, reject: reject };
              window.webkit.messageHandlers.bio.postMessage(
                Object.assign({ action: action, id: id }, payload || {}));
            });
          }
          window.BasisNative = {
            available: true,
            bioAvailable: function () { return call('available'); },
            bioEnrolled:  function (user) { return call('enrolled', { user: String(user || '') }); },
            bioSave:      function (user, secret) { return call('save', { user: String(user || ''), secret: String(secret) }); },
            bioLoad:      function (user) { return call('load', { user: String(user || '') }); },
            bioClear:     function (user) { return call('clear', { user: String(user || '') }); },
            haptic:       function (style) { return call('haptic', { style: String(style || 'light') }); }
          };
        })();
        """

        func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let body = message.body as? [String: Any],
                  let action = body["action"] as? String,
                  let id = body["id"] as? Int else { return }

            let user = body["user"] as? String ?? ""

            switch action {
            case "haptic":
                let style = body["style"] as? String ?? "light"
                DispatchQueue.main.async {
                    if style == "success" {
                        let gen = UINotificationFeedbackGenerator()
                        gen.notificationOccurred(.success)
                    } else {
                        let gen = UIImpactFeedbackGenerator(style: style == "heavy" ? .heavy : (style == "medium" ? .medium : .light))
                        gen.impactOccurred()
                    }
                }
                reply(id, ok: true, value: true)
            case "available":
                reply(id, ok: true, value: Biometrics.available())
            case "enrolled":
                reply(id, ok: true, value: Biometrics.isEnrolled(account: user))
            case "save":
                let secret = body["secret"] as? String ?? ""
                reply(id, ok: true, value: secret.isEmpty ? false : Biometrics.save(account: user, secret: secret))
            case "clear":
                Biometrics.remove(account: user)
                reply(id, ok: true, value: true)
            case "load":
                Biometrics.load(account: user, reason: "Sign in to Basis") { [weak self] secret, failure in
                    if let secret {
                        self?.reply(id, ok: true, value: secret)
                    } else {
                        self?.reply(id, ok: false, value: nil, error: failure ?? "failed")
                    }
                }
            default:
                reply(id, ok: false, value: nil, error: "unknown-action")
            }
        }

        /// JSON-encoded so a secret containing quotes cannot break out of the call.
        private func reply(_ id: Int, ok: Bool, value: Any?, error: String? = nil) {
            func enc(_ any: Any?) -> String {
                guard let any,
                      let data = try? JSONSerialization.data(withJSONObject: [any]),
                      let s = String(data: data, encoding: .utf8) else { return "null" }
                return String(s.dropFirst().dropLast())
            }
            let js = "window.__bioReply(\(id), \(ok), \(enc(value)), \(enc(error)))"
            DispatchQueue.main.async { [weak self] in self?.web?.evaluateJavaScript(js) }
        }

        @objc func reload(_ sender: UIRefreshControl) {
            web?.reload()
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            webView.scrollView.refreshControl?.endRefreshing()
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            webView.scrollView.refreshControl?.endRefreshing()
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            webView.scrollView.refreshControl?.endRefreshing()
        }

        /// Keep the app itself on the dashboard; anything external opens in Safari
        /// rather than trapping the user in a webview with no chrome to escape it.
        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let target = navigationAction.request.url else {
                decisionHandler(.allow)
                return
            }
            let isApp = target.host == PortfolioApp.url.host
            if !isApp, navigationAction.navigationType == .linkActivated {
                UIApplication.shared.open(target)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }
    }
}
