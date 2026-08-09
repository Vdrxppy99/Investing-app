/* ═══════════════════════════════════════════════════════════════════════════
   TAPPABLE — things that look tappable and were not.

   Found by walking the app in the simulator and then exercising every
   interactive element programmatically, rather than sampling a few by hand.

   Deliberately a SEPARATE FILE. The engine JS was restored wholesale from the
   last known-good commit precisely because editing it is what produced the
   glitches; this adds interaction by delegation without touching a line of it.
   Delegation also means it keeps working across re-renders, which matters
   because these lists are rebuilt on every price tick.

   Everything here only ever calls the engine's OWN sheet openers, so nothing new
   is computed and nothing is displayed that the app did not already have.
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  /** Resolve a ticker from a row, preferring the data attribute the engine sets. */
  function symOf(el) {
    const withData = el.closest("[data-sym]");
    if (withData) return withData.getAttribute("data-sym");
    // Allocation legend rows carry the ticker as a bare text node between the
    // colour dot and the percentage, so read the first word-like token.
    const text = (el.textContent || "").trim();
    const m = text.match(/^[A-Z][A-Z.\-]{0,5}/);
    return m ? m[0].replace(".", "-") : null;
  }

  window.triggerHaptic = function (style) {
    style = style || 'light';
    try {
      if (window.BasisNative && typeof window.BasisNative.haptic === 'function') {
        window.BasisNative.haptic(style);
      } else if (navigator.vibrate) {
        navigator.vibrate(style === 'heavy' ? 25 : (style === 'medium' ? 15 : 8));
      }
    } catch (_) {}
  };

  document.addEventListener("click", function (e) {
    const btn = e.target.closest("button, .tabbar__item, .rail-nav__item, .hrow, .mrow, .chip");
    if (btn) {
      window.triggerHaptic(btn.classList.contains("tabbar__item") ? "medium" : "light");
    }

    // ── Allocation legend: tapping a slice should open that holding, the same as
    //    tapping its row in the list. It reads as a list of your funds, so not
    //    responding felt broken.
    const leg = e.target.closest("#allocLegend .alg, #allocClasses .alg");
    if (leg) {
      const sym = symOf(leg);
      if (sym && typeof window.openDetail === "function") {
        try { window.openDetail(sym); } catch (_) {}
      }
      return;
    }

    // #ideaList and #watchList rows used to be wired here too ("same row markup,
    // same handler" as the comment above once said) — removed (UPGRADE_PLAN.md
    // Phase 4): both live inside #page-markets/#page-following, which js/app.js's
    // page-level delegation (`.closest('.mrow, .idx-card')`) already covers via
    // the generic .mrow selector. Both listeners fired on every click (neither
    // calls stopPropagation, and click bubbles from the row through #page-markets/
    // #page-following up to document), so every tap called openStockSheet() twice —
    // confirmed by instrumenting the call count, not assumed from reading the code.
  });

  // Press feedback for these rows lives in css/components.css (.tappable-fb rule) —
  // a CSP style-src with no 'unsafe-inline' blocks a JS-injected <style> element,
  // and this rule is static, so it belongs in the stylesheet, not built here.
})();
