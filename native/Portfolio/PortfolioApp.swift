import SwiftUI

/// Native shell around the portfolio dashboard.
///
/// Deliberately loads the LIVE GitHub Pages build rather than bundling a copy:
/// the dashboard is useless without fresh quotes anyway, and loading remotely
/// means a `git push` updates this app on its next launch with no rebuild, no
/// re-signing and no reinstall.
///
/// NOTE ON NOTIFICATIONS: this app deliberately does NOT try to own them. Push
/// requires APNs, and the Push Notifications capability is unavailable on a free
/// Apple account. The home-screen PWA stays installed and keeps receiving Web
/// Push from the Cloudflare Worker exactly as before — that is the notification
/// path, and it is untouched by this app existing alongside it.
@main
struct PortfolioApp: App {
    static let url = URL(string: "https://vdrxppy99.github.io/Investing-app/")!

    var body: some Scene {
        WindowGroup {
            WebScreen(url: Self.url)
                .ignoresSafeArea(.container, edges: .bottom)
                .background(Color(red: 0.043, green: 0.059, blue: 0.090))  // #0B0F17 — Phase 1 canvas retarget
                .preferredColorScheme(.dark)
        }
    }
}
