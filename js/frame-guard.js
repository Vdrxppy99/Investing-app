'use strict';
/* ============ CLICKJACKING GUARD ============
   `frame-ancestors` is IGNORED when the CSP arrives in a <meta> tag (CSP spec:
   meta-delivered policies must ignore frame-ancestors, report-uri and sandbox),
   and GitHub Pages serves static files with no way to set X-Frame-Options or a
   real CSP response header. So neither of the two proper defences is available
   here and this is the only one left.

   It is a separate file, not an inline <script>, because our own CSP is
   `script-src 'self'` with no nonce — an inline script would be blocked by the
   very policy this is helping to make up for. Loaded first in <head> so it runs
   before any UI paints and before the vault ever asks for a passcode.

   Nothing in this app is ever framed on purpose: there is no <iframe> anywhere in
   index.html or js/ (verified), and the native shell loads the site as a
   top-level WKWebView document, where window.top === window.self. */
if (window.top !== window.self) {
  // Hide first, ask questions later — a framed passcode field must not be
  // clickable for even one frame while the navigation below is in flight.
  document.documentElement.style.display = 'none';
  try {
    window.top.location = window.self.location.href;  // break out of the frame
  } catch (_) {
    /* Cross-origin or sandboxed framer — we are not allowed to navigate it.
       The display:none above already means there is nothing to click, and the
       framer cannot undo it: it cannot reach into our document. */
  }
}
