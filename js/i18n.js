/* ═══════════════════════════════════════════════════════════════════════════
   DEUTSCH — German localisation.

   Built as a TRANSLATION LAYER rather than by rewriting strings in place. The
   engine JS was restored from its last known-good state precisely because
   editing it caused glitches, and it emits hundreds of strings from a dozen
   files. Touching all of that would reintroduce exactly the class of bug this
   project spent days removing.

   So instead: a dictionary, and a MutationObserver that translates text as the
   engine renders it. The engine keeps speaking English internally; only what
   reaches the screen changes.

   SAFETY: only exact dictionary matches are replaced. Numbers, currency, tickers
   and fund names are never touched, because an unmatched string is left exactly
   as it was. There is no fuzzy matching and no regex over free text — a mistake
   there would corrupt displayed figures, which is the one thing that must never
   happen.

   ── ARCHITECTURE DECISION (German-coverage session 1 of 2) ──────────────────
   The post-render pass above (dictionary + DE_PATTERNS regexes) cannot be made
   complete — that's the root cause of the coverage gaps a bug-hunt session
   found, not an oversight in any one string. It only ever sees a string AFTER
   the engine has already assembled it, so it systematically misses two things:
     1. Static boilerplate nobody added to the dictionary. Not an architecture
        problem — the mechanism above already handles static text correctly
        once an entry exists. Fixed this session by adding the missing entries
        (see the "static gaps" additions below) — no new mechanism needed.
     2. Sentences built from a template literal with an interpolated figure —
        js/insights.js coach bodies, js/app.js's market countdown, etc. Every
        instance is a different string (the number changes), so it can never
        have a stable dictionary key, and writing one regex per sentence in
        DE_PATTERNS (which is how the few that ARE covered today got there)
        doesn't scale — it's exactly as easy to forget as the dictionary
        entries were, just discovered later and by a different symptom.

   For (2), the actual fix is translating at the RENDER SITE instead of after:
   t(), added below, is a tagged-template function — prefix an existing
   template literal with `t` and the STATIC segments (never the interpolated
   values) become the dictionary lookup, so every instance of a sentence shares
   one key regardless of what number lands in the middle:
     `Estimates: ... (beta ${beta.toFixed(2)}). Not financial advice.`
     becomes
     t`Estimates: ... (beta ${beta.toFixed(2)}). Not financial advice.`
   This is an INCREMENTAL migration, not a rewrite: the existing dictionary
   pass keeps doing exactly what it already does for static strings (including
   this session's new entries) — it is not being replaced, and no working
   coverage above is touched. t() is additive, for new and fixed strings only.
   Migrating js/insights.js's and js/sheets.js's existing template literals to
   t() — the actual bulk of the remaining gap — is session 2's work, once this
   session's guard test (test/i18n-coverage.spec.js) gives it a measured
   starting count instead of a guess.
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const DE = {
    /* ── navigation & chrome ─────────────────────────────────────────────── */
    "Portfolio": "Portfolio",
    "Markets": "Märkte",
    "Insights": "Analyse",
    "My Portfolio": "Mein Portfolio",
    "Example data": "Beispieldaten",
    "Settings": "Einstellungen",
    // The only one of the five tab labels with no entry at all (bug-hunt
    // finding) — on screen on every page via the persistent nav. "Übersicht"
    // (overview), not "Startseite" (start page) or the English loanword some
    // German apps keep: this tab IS an overview/dashboard (total + movers +
    // performance + insights in one glance), so the term matches what it does,
    // the convention several German banking/broker apps already use for the
    // same kind of screen.
    "Home": "Übersicht",

    /* ── static gaps (bug-hunt finding: never added to the dictionary, so the
       working post-render pass had nothing to match) ──────────────────────── */
    // The Portfolio tab's hero eyebrow, above the big total figure. "Gesamtwert"
    // (total value) — the term German brokerage/banking apps use for exactly
    // this label, not a literal "Gesamtportfolio".
    "Total portfolio": "Gesamtwert",
    // Markets search field's accessible label (singular "Search any stock or
    // ETF" below is a pre-existing, different entry for a different string;
    // this one is plural, "and" not "or") — same verb-final phrasing as that
    // existing entry, for consistency.
    "Search stocks and ETFs": "Aktien und ETFs suchen",
    // Insights sub-caption under "Analyse". "Einzahlungsbereinigt" (deposit-
    // adjusted) follows the standard German finance-writing pattern for "X-
    // bereinigt" (adjusted for X — cf. "inflationsbereinigt", inflation-
    // adjusted); reasonably confident, not verified against a style guide.
    "Deposit-adjusted · updated today": "Einzahlungsbereinigt · heute aktualisiert",
    // Insights stat-tile label for the sector breakdown. "Sektorengewichtung"
    // (sector weighting) — the term German fund fact sheets use for "how much
    // of the portfolio sits in which sector"; reasonably confident, not
    // verified against a style guide.
    "Sector exposure": "Sektorengewichtung",

    /* ── static gaps, session 2 (test/i18n-coverage.spec.js's measured leak list —
       these are static strings a template literal happens to embed, not ones that
       actually need t()'s interpolation: no value ever changes inside them). */
    // Home's cash row (js/portfolio.js renderList()). "Verrechnungskonto" is the
    // standard German brokerage term for a cash/settlement account.
    "Cash · settlement fund": "Bargeld · Verrechnungskonto",
    // Home's Daily Movers card heading (index.html, never added to the dictionary).
    "Your Daily Movers": "Deine Tagesbewegungen",
    // Home's "Performance" card heading (index.html).
    "Best performers": "Top-Performer",
    // Screen-reader-only table caption for the Insights heatmap (js/insights.js).
    "Monthly returns by year": "Monatliche Renditen nach Jahr",
    // Markets tab retry messages (js/explore.js) — only visible when a fetch
    // actually fails, so this session's own offline test environment is what
    // surfaced them, not real day-to-day use; static strings, no interpolation.
    "Couldn’t load — tap the Markets tab again to retry.": "Laden fehlgeschlagen — tippe erneut auf den Märkte-Tab, um es erneut zu versuchen.",
    "Couldn’t load — tap Markets again.": "Laden fehlgeschlagen — tippe erneut auf Märkte.",
    // Holding-detail sheet stat label (js/portfolio.js) — a different string from
    // the plain "Profit" entry above (exact-match only), so it needed its own entry.
    "Profit %": "Gewinn %",
    // Asset-worth sheet title (js/insights.js). "1Y" kept as-is, matching every
    // range button elsewhere in the app (1D/1W/1M/6M/YTD/1Y/5Y/MAX are never
    // translated, by existing convention) — not re-litigated here.
    "Asset worth · 1Y": "Vermögenswert · 1Y",
    // Erase-holdings confirm dialog (js/portfolio.js showConfirm() call).
    // The settings-sheet BUTTON (no "?") that opens the confirm dialog above —
    // a distinct string from it, needing its own entry.
    "Erase all holdings": "Alle Positionen löschen",
    "Erase all holdings?": "Alle Positionen löschen?",
    "ALL holdings, lots, cash and deposits will be removed from this device. Export a backup first if you might want them back.":
      "ALLE Positionen, Steuerpositionen, Bargeld und Einzahlungen werden von diesem Gerät entfernt. Exportiere zuerst ein Backup, falls du sie zurückhaben möchtest.",
    "Erase everything": "Alles löschen",

    /* ── t()-migrated dynamic sentences, session 2 ───────────────────────────
       Keys are %1/%2/… numbered, not the plain values a reader might expect —
       see t()'s own comment (below, in the language-switch section) for why:
       German clause order isn't English clause order, and a numbered
       placeholder is what lets a value be reordered or repeated. */
    // js/app.js marketCountdownText() — "Std."/"Min." are the standard German
    // abbreviations for Stunden/Minuten, matching how a German finance app
    // would show a countdown, not "h"/"m" carried over from English.
    "Markets close in %1h %2m": "Markt schließt in %1 Std. %2 Min.",
    "Markets open in %1h %2m": "Markt öffnet in %1 Std. %2 Min.",
    // js/portfolio.js setStatus() — the market-closed suffix on the live-price
    // status line (e.g. "Live · 3 min ago · market closed"). No interpolation of
    // its own; migrated to t() only because it's concatenated into a larger
    // dynamically-built string, so a plain dictionary entry could never match it
    // (the post-render pass only matches a text node's FULL trimmed content).
    " · market closed": " · Börse geschlossen",
    // js/insights.js openHealthSheet() sheet title.
    "Portfolio Health · %1/100": "Portfolio-Gesundheit · %1/100",
    // js/sheets.js openTaxSheet() sheet title.
    "Tax lots · all %1": "Steuerpositionen · alle %1",
    // js/insights.js renderProjection()'s dividend-growth note — composed from up
    // to four independently-conditional pieces (see the call site's own comment),
    // each t()-migrated separately so the existing conditional composition still
    // works unchanged; concatenating already-translated pieces, not translating
    // the concatenation as one string.
    "Dividends alone could grow from %1/yr today to ~%2/yr by %3. ":
      "Allein die Dividenden könnten von %1/Jahr heute auf ~%2/Jahr bis %3 wachsen. ",
    "What today's %1 can turn into on its own — no future deposits counted, compounded monthly at 4% / 7% / 10% a year. Long-run stock returns averaged 7–10% — nobody knows the future. ":
      "Was dein heutiges Vermögen von %1 allein daraus machen kann — ohne künftige Einzahlungen, monatlich verzinst mit 4 % / 7 % / 10 % pro Jahr. Langfristige Aktienrenditen lagen bei 7–10 % — niemand kennt die Zukunft. ",
    "Gold dashed line = your goal. ": "Die goldene gestrichelte Linie zeigt dein Ziel. ",
    "Not advice.": "Keine Anlageberatung.",

    /* ── The projection module, surfaced from #moreList/Home's own goal card ──
       js/insights.js's renderProjMod()/projAsOfText(). Real Monte Carlo fan
       chart (Phase 6's runMonteCarloProjection()), main run always at
       monthlyContribution:0, the what-if input's own re-run adds the rest. */
    "/month": "/Monat",
    "years": "Jahre",
    "/mo added": "/Monat dazu",
    "no more deposits": "keine weiteren Einzahlungen",
    "Adding %1/month, you have a %2 chance of reaching %3 by %4.":
      "Bei %1/Monat zusätzlich hast du eine %2-Chance, %3 bis %4 zu erreichen.",
    "With no more deposits, you have a %1 chance of reaching %2 by %3.":
      "Ohne weitere Einzahlungen hast du eine %1-Chance, %2 bis %3 zu erreichen.",
    "Adding %1/month, the median path reaches %2 by %3 — likely range %4.":
      "Bei %1/Monat zusätzlich erreicht der mittlere Pfad %2 bis %3 — wahrscheinliche Spanne %4.",
    "With no more deposits, the median path reaches %1 by %2 — likely range %3.":
      "Ohne weitere Einzahlungen erreicht der mittlere Pfad %1 bis %2 — wahrscheinliche Spanne %3.",
    "Computed just now": "Gerade eben berechnet",
    "Computed %1s ago": "Vor %1s berechnet",
    "Computed %1 min ago": "Vor %1 Min. berechnet",
    "Computed %1": "Berechnet am %1",

    /* ── Leaks the projection module's new dictionary candidates exposed ──────
       "years" and "/month" becoming candidates (above) surfaced two PRE-EXISTING
       gaps the i18n-coverage ratchet had never been able to see before, because
       neither word had ever been a candidate on its own: session 3's own
       Contributions goal line (renderContribMod, noted in that session's commit
       as one of the untranslated older goal lines — now fixed because it
       shares "/month" with this session's new module) and Crash test's/the old
       Projection sheet's own untranslated sentences (openCrashSheet,
       renderProjection — fixed above by renaming a shadowed `t` and wrapping
       the text, here just the dictionary entries). */
    "At %1/month you arrive %2. Adding $100 more makes it %3.":
      "Bei %1/Monat kommst du %2 an. Mit $100 mehr sind es %3.",
    "At %1/month you arrive %2.": "Bei %1/Monat kommst du %2 an.",
    "The other half of the story: <b>every one of these fully recovered</b> — in %1. Money you won't need for years can afford to ride it out; panic-selling at the bottom is the only move that makes the loss permanent.":
      "Die andere Hälfte der Geschichte: <b>jede einzelne davon hat sich vollständig erholt</b> — in %1. Geld, das du jahrelang nicht brauchst, kann die Durststrecke aussitzen; Panikverkäufe am Tiefpunkt sind der einzige Schritt, der den Verlust endgültig macht.",
    "In %1 years:": "In %1 Jahren:",
    "about 4 years": "etwa 4 Jahre",
    "about 5 months": "etwa 5 Monate",
    "about 2 years": "etwa 2 Jahre",
    "Your timing added %1 — about %2 off the goal date.": "Dein Timing hat dir %1 gebracht — etwa %2 früher am Ziel.",
    "Your timing cost you %1 — about %2 later on the goal date.": "Dein Timing hat dich %1 gekostet — etwa %2 später am Ziel.",

    /* ── Insights v2 modules surfaced from #moreList, session 3 ──────────────
       Crash test, Tax lots, Geographic mix and Asset worth's own labels and
       goal lines (js/insights.js renderCrashMod/renderTaxMod/renderGeoMod/
       renderWorthMod). Note: the OLDER goal lines from sessions 1-2 (Risk,
       Drawdown, XIRR, Contributions, Sector) are not covered here — they were
       never in the dictionary before this session either, a pre-existing gap
       out of this session's scope; not repeating it for the new sentences. */
    "2008 financial crisis": "Finanzkrise 2008",
    "2020 COVID crash": "Corona-Crash 2020",
    "2022 rate shock": "Zinsschock 2022",
    "past crashes, scaled to you": "vergangene Krisen, auf dich skaliert",
    "would fall hardest": "würde am stärksten fallen",
    "A repeat of the %1 costs you %2 — and pushes your goal from %3 to %4.":
      "Eine Wiederholung von %1 kostet dich %2 — und verschiebt dein Ziel von %3 auf %4.",
    "short-term vs long-term": "kurzfristig vs. langfristig",
    "goes long-term": "wird langfristig",
    "Every lot you own already qualifies for the long-term rate.":
      "Jede deiner Positionen erfüllt bereits die Bedingungen für den langfristigen Steuersatz.",
    "%1 has %2 in short-term gains — it turns long-term on %3.":
      "%1 hat %2 an kurzfristigen Gewinnen — wird am %3 langfristig.",
    "%1 is %2 of you — mostly through %3 and %4.": "%1 sind %2 von dir — größtenteils über %3 und %4.",
    "%1 is %2 of you, entirely through %3.": "%1 sind %2 von dir — vollständig über %3.",
    "by holding": "nach Position",

    /* ── lock screen ─────────────────────────────────────────────────────── */
    "Username": "Benutzername",
    "Passcode": "Passwort",
    "Create a passcode": "Passwort erstellen",
    "Repeat it": "Wiederholen",
    "Create passcode": "Passwort erstellen",
    "Unlock": "Entsperren",
    "Unlock with Face ID": "Mit Face ID entsperren",
    "Use passcode": "Passwort verwenden",
    "Forgot passcode?": "Passwort vergessen?",
    "Restore from backup": "Aus Backup wiederherstellen",
    "See an example portfolio": "Beispiel-Portfolio ansehen",
    "Enable Face ID": "Face ID aktivieren",
    "Not now": "Jetzt nicht",
    "Restore": "Wiederherstellen",
    "Cancel": "Abbrechen",
    "Sign in": "Anmelden",
    "Unlocking": "Wird entsperrt",
    "Welcome": "Willkommen",
    "Passcode from your old device": "Passwort deines alten Geräts",
    "Create a passcode to encrypt this device": "Erstelle ein Passwort zur Verschlüsselung dieses Geräts",
    "Set up Face ID": "Face ID einrichten",
    "Enter your passcode": "Gib dein Passwort ein",
    "Restore from a backup": "Aus einem Backup wiederherstellen",
    "Unlock to continue": "Entsperren zum Fortfahren",
    "Wrong passcode.": "Falsches Passwort.",
    "Those don’t match.": "Stimmt nicht überein.",
    "Use at least 6 characters.": "Mindestens 6 Zeichen verwenden.",
    "Erase": "Löschen",
    "Keep": "Behalten",

    /* ── portfolio ───────────────────────────────────────────────────────── */
    "Holdings": "Positionen",
    "Value": "Wert",
    "Today": "Heute",
    "Profit": "Gewinn",
    "Allocation": "Aufteilung",
    "Goal": "Ziel",
    "Total profit": "Gesamtgewinn",
    "Deposited": "Eingezahlt",
    "Return / yr": "Rendite / Jahr",
    "Cash": "Bargeld",
    "All": "Alle",
    "Change goal": "Ziel ändern",
    "Set goal": "Ziel festlegen",
    "Update goal": "Ziel aktualisieren",
    "Remove goal": "Ziel entfernen",
    "of goal": "vom Ziel",
    "OF GOAL": "VOM ZIEL",
    "to go": "verbleibend",
    "Goal reached": "Ziel erreicht",
    "Goal amount": "Zielbetrag",
    "No holdings yet": "Noch keine Positionen",
    "Open settings": "Einstellungen öffnen",
    "Add your first position with ⚙︎ above, or restore everything from a backup file.":
      "Füge oben mit ⚙︎ deine erste Position hinzu oder stelle alles aus einer Backup-Datei wieder her.",

    /* ── status line ─────────────────────────────────────────────────────── */
    "LIVE": "LIVE",
    "JUST NOW": "GERADE EBEN",
    "MARKET CLOSED": "BÖRSE GESCHLOSSEN",
    "MARKET OPEN": "BÖRSE GEÖFFNET",
    "Loading": "Wird geladen",
    "Loading…": "Wird geladen…",
    "Good morning": "Guten Morgen",
    "Good afternoon": "Guten Tag",
    "Good evening": "Guten Abend",
    "Good night": "Gute Nacht",
    "Moving with the market today": "Bewegt sich heute mit dem Markt",

    /* ── explore ─────────────────────────────────────────────────────────── */
    "Search any stock or ETF": "Aktie oder ETF suchen",
    "Indices": "Indizes",
    "Sectors today": "Sektoren heute",
    "Sectors": "Sektoren",
    "Screeners": "Screener",
    "Active": "Aktiv",
    "Gainers": "Gewinner",
    "Losers": "Verlierer",
    "Ideas": "Ideen",
    "Watchlist": "Merkliste",
    "Following": "Beobachtet",
    "Stocks you already own": "Aktien, die du bereits besitzt",
    "Nothing here yet": "Noch nichts hier",
    "Clear search": "Suche löschen",

    /* ── insights ────────────────────────────────────────────────────────── */
    "Performance": "Wertentwicklung",
    "Risk": "Risiko",
    "Income & tax": "Erträge & Steuern",
    "Future": "Zukunft",
    "Under the hood": "Unter der Haube",
    "Portfolio Health": "Portfolio-Gesundheit",
    "Portfolio health": "Portfolio-Gesundheit",
    "Next moves": "Nächste Schritte",
    "Crash test": "Krisentest",
    "Financial independence": "Finanzielle Unabhängigkeit",
    "Where this is headed": "Wohin es geht",
    "Stocks you indirectly own": "Aktien, die du indirekt besitzt",
    "Where your money lives": "Wo dein Geld liegt",
    "Asset worth": "Vermögenswert",
    "Contributions": "Einzahlungen",
    "Tax lots": "Steuerpositionen",
    "Tax Lots": "Steuerpositionen",
    "Monthly returns": "Monatliche Renditen",
    "Monthly Returns": "Monatliche Renditen",
    "Drawdown": "Rückgang",
    "Portfolio P/E": "Portfolio-KGV",
    "Period": "Zeitraum",
    "You": "Du",
    "Diversification": "Diversifikation",
    "Global exposure": "Globale Streuung",
    "Cost efficiency": "Kosteneffizienz",
    "Cash deployed": "Investiertes Kapital",
    "Excellent": "Ausgezeichnet",
    "Good": "Gut",
    "Fair": "Befriedigend",
    "Needs work": "Verbesserungswürdig",
    "Long-term gains": "Langfristige Gewinne",
    "Short-term gains": "Kurzfristige Gewinne",
    "Total": "Gesamt",
    "Asset": "Wert",
    "Owned": "Anzahl",
    "Realized": "Realisiert",
    "What this means": "Was das bedeutet",
    /* Not "J" — the heatmap's month headers are single letters and three of them
       are already J, so the year-total column has to stay distinguishable. */
    "Yr": "Jahr",

    /* ── coach items (js/insights.js coachItems) ─────────────────────────────
       These were never in the dictionary, so they rendered English under German
       card titles ("Nächste Schritte" above "Know your risk"). Bodies that carry
       a figure are handled by DE_PATTERNS below. */
    "Deploy idle cash": "Bargeld investieren",
    "Put idle cash to work": "Ungenutztes Bargeld arbeiten lassen",
    "Feed the laggard": "Nachzügler aufstocken",
    "Rebalance with new money": "Mit neuem Geld ausbalancieren",
    "Trim a big bet": "Große Einzelwette stutzen",
    "Know your risk": "Kenne dein Risiko",
    "100% stocks — know the ride": "100% Aktien — kenne die Fahrt",
    "Tax timing": "Steuerlicher Zeitpunkt",
    "Keep investing": "Weiter investieren",
    "Keep the contribution streak": "Einzahlungsserie fortsetzen",
    "Set a goal": "Ziel festlegen",
    "No target set yet": "Noch kein Ziel gesetzt",
    "Beating the bank": "Besser als die Bank",
    "Your money vs a savings account": "Dein Geld ggü. einem Sparkonto",
    "Give the money a number. A target unlocks the progress ring and a projected finish date on the Portfolio tab.":
      "Gib dem Geld eine Zahl. Ein Ziel schaltet den Fortschrittsring und ein voraussichtliches Enddatum im Portfolio-Tab frei.",
    "Add holdings to run the stress test.": "Positionen hinzufügen, um den Stresstest zu starten.",
    "Needs price history.": "Benötigt Kurshistorie.",

    /* ── table headers, deliberately short ───────────────────────────────────
       Long headers are what forced "DIVIDE-NDEN" / "UNREAL-ISIERT" to break
       mid-word in the fixed-layout gains table. This is the localisation half of
       the fix; the CSS half lives in components.css. No soft hyphens. */
    "Dividends": "Dividende",
    "Unrealized": "Nicht real.",

    /* ── sheets & recap ──────────────────────────────────────────────────── */
    "Market close": "Börsenschluss",
    "Market open": "Börsenstart",
    "Top movers": "Top-Bewegungen",
    "Laggards": "Nachzügler",
    "Close": "Schließen",
    "Save": "Speichern",
    "Done": "Fertig",
    "Edit": "Bearbeiten",
    "Delete": "Löschen",
    "Add": "Hinzufügen",
    "Retry": "Erneut versuchen",
    "Refresh": "Aktualisieren",
    "Refresh prices": "Kurse aktualisieren",
    "Hide amounts": "Beträge ausblenden",
    "Toggle theme": "Design wechseln",
    "Switch currency": "Währung wechseln",
    "Edit holdings": "Positionen bearbeiten",

    /* ── assistant ───────────────────────────────────────────────────────── */
    "Assistant": "Assistent",
    "Portfolio Assistant": "Portfolio-Assistent",
    "Ask about your money": "Frag zu deinem Geld",
    "Send": "Senden",
    "Ask a question": "Stelle eine Frage",
  };

  /* Longer sentences, matched on the trimmed full string. Kept separate so the
     short-label table above stays readable. */
  const SENTENCES = {
    "Your holdings are encrypted on this device. Nothing is sent anywhere. If you forget this passcode only a backup can recover the data.":
      "Deine Positionen werden auf diesem Gerät verschlüsselt. Nichts wird irgendwohin gesendet. Wenn du dieses Passwort vergisst, kann nur ein Backup die Daten wiederherstellen.",
    "Open with a glance instead of typing. Your passcode keeps working as the recovery key.":
      "Mit einem Blick öffnen statt zu tippen. Dein Passwort bleibt als Wiederherstellungsschlüssel bestehen.",
    "Funds that add something your current mix doesn't have. To research, not advice.":
      "Fonds, die deiner Mischung etwas hinzufügen. Zum Recherchieren, keine Anlageberatung.",
    "Held indirectly through your ETFs — your look-through.":
      "Indirekt über deine ETFs gehalten — dein Look-through.",
    "Nothing needs your attention. The portfolio is running clean.":
      "Nichts erfordert deine Aufmerksamkeit. Das Portfolio läuft sauber.",
    "Shows once at each market open and close.":
      "Erscheint einmal bei Börsenstart und Börsenschluss.",
    "Don't show automatically": "Nicht automatisch anzeigen",

    /* ── static gaps: footer disclaimers (bug-hunt finding — English on all five
       tabs, never added to the dictionary). "Keine Anlageberatung" is this
       codebase's own established term for "not advice" (see "Funds that add
       something..." above) — reused here rather than invented fresh, so the
       disclaimer reads the same way everywhere it appears. */
    "Built from your purchase history. Not financial advice.":
      "Basierend auf deiner Kaufhistorie. Keine Anlageberatung.",
    "Built from your purchase history. Prices from the Yahoo Finance free feed, refreshed while the US market is open. Not financial advice.":
      "Basierend auf deiner Kaufhistorie. Kurse von der kostenlosen Yahoo-Finance-Schnittstelle, aktualisiert während die US-Börse geöffnet ist. Keine Anlageberatung.",
    "Market data from the Yahoo Finance free feed. Not financial advice.":
      "Marktdaten von der kostenlosen Yahoo-Finance-Schnittstelle. Keine Anlageberatung.",
    "P/E and fee figures are estimates from published fund data. Risk is computed from your real price history. Not financial advice.":
      "KGV- und Gebührenangaben sind Schätzungen auf Basis veröffentlichter Fondsdaten. Das Risiko wird aus deiner tatsächlichen Kurshistorie berechnet. Keine Anlageberatung.",

    /* ── static gaps, session 2: longer body paragraphs the leak candidate list
       surfaced only via a short substring match ("Portfolio P/E", "Diversification",
       "Today") — the actual untranslated string in each case is this whole
       paragraph, not the short phrase. */
    "Portfolio P/E is the price you pay for every $1 of your holdings' annual earnings — a rough valuation gauge. Lower is \"cheaper,\" higher means more growth is priced in. It's a share-weighted blend across your funds.":
      "Das Portfolio-KGV ist der Preis, den du für jeden $1 Jahresgewinn deiner Positionen zahlst — ein grober Bewertungsmaßstab. Niedriger bedeutet \"günstiger\", höher heißt, dass mehr Wachstum bereits eingepreist ist. Es ist ein anteilsgewichteter Durchschnitt über all deine Fonds.",
    "Single-stock risk, global mix, cost and cash deployment are all strong by this score. It doesn't weigh sector or country concentration — see Sector exposure and Where your money lives below.":
      "Einzelaktienrisiko, globale Streuung, Kosten und Kapitaleinsatz sind laut dieser Bewertung allesamt stark. Sektor- oder Länderkonzentration fließt hier nicht ein — siehe Sektorengewichtung und Wo dein Geld liegt weiter unten.",
    "Today's holdings compounded at your own growth rate — no assumed future deposits (your rule). Not advice.":
      "Deine heutigen Positionen, hochgerechnet mit deiner eigenen Wachstumsrate — ohne angenommene künftige Einzahlungen (deine Vorgabe). Keine Anlageberatung.",
  };

  Object.assign(DE, SENTENCES);

  /* ── PATTERN PASS ─────────────────────────────────────────────────────────
     The exact-match table can only ever cover strings the engine emits verbatim.
     Every coach-item body interpolates a figure, so none of them could match a
     key — which is the second half of why German titles sat above English text.

     Every regex here captures the numeric parts and the replacement re-inserts
     them with $1/$2/… verbatim. Nothing computes, reformats or rounds a figure:
     a captured group is copied through byte-for-byte. Currency symbols, percent
     signs, tickers and dates all ride inside the capture groups.

     Anchored to the full trimmed string, and written against ENGLISH source, so
     an already-translated node can never match a second time. No /g flag — a
     stateful lastIndex on a shared regex would translate every other node. */
  const DE_PATTERNS = [
    /* Deploy idle cash */
    [/^(.+?) · ([\d.,]+)% uninvested$/,
      "$1 · $2% nicht investiert"],
    [/^(.+?) \(([\d.,]+)% of the portfolio\) is uninvested\. At your ~([\d.,]+)%\/yr pace that's ≈(.+?) of growth per year sitting out\.$/,
      "$1 ($2% des Portfolios) sind nicht investiert. Bei deinem Tempo von ~$3%/Jahr entgehen dir dadurch ≈$4 Wachstum pro Jahr."],

    /* Feed the laggard */
    [/^(.+?) is ([\d.,]+)% under target$/,
      "$1 liegt $2% unter Ziel"],
    [/^(.+?) sits ([\d.,]+)% below the target mix you set\. Pointing the next deposit at it restores your chosen balance — no selling, no taxes\.$/,
      "$1 liegt $2% unter der von dir gesetzten Zielmischung. Die nächste Einzahlung dorthin zu lenken stellt deine gewählte Balance wieder her — kein Verkauf, keine Steuern."],

    /* Trim a big bet */
    [/^(.+?) is ([\d.,]+)% of everything$/,
      "$1 macht $2% des Ganzen aus"],
    [/^(.+?) is a big single bet$/,
      "$1 ist eine große Einzelwette"],
    [/^([\d.,]+)% of everything rides on one company\. Steering new contributions to your index funds dilutes that gradually — no selling, no taxes\.$/,
      "$1% des Gesamtvermögens hängen an einem einzigen Unternehmen. Neue Einzahlungen in deine Indexfonds zu lenken verwässert das allmählich — kein Verkauf, keine Steuern."],

    /* Know your risk */
    [/^100% stocks · worst dip (.+?)%$/,
      "100% Aktien · schlimmster Rückgang $1%"],
    [/^Maximum long-run growth, but your worst drop so far was (.+?)%\. Fine for a long horizon; if a big goal is under ~5 years away, a slice of bonds \(BND\) softens the swings\.$/,
      "Maximales langfristiges Wachstum, aber dein bisher schlimmster Rückgang lag bei $1%. Für einen langen Horizont in Ordnung; steht ein großes Ziel in weniger als ~5 Jahren an, dämpft ein Anteil Anleihen (BND) die Schwankungen."],

    /* Tax timing */
    [/^(.+?) turns long-term in ([\d]+)d$/,
      "$1 wird in $2 Tagen langfristig"],
    [/^Selling (.+?)\? Wait until (.+)$/,
      "$1 verkaufen? Warte bis $2"],
    [/^A lot with (.+?) of gain turns long-term on (.+?) — before that, the gain would be taxed at the higher short-term rate\.$/,
      "Eine Position mit $1 Gewinn wird am $2 langfristig — davor würde der Gewinn zum höheren kurzfristigen Satz besteuert."],

    /* Keep investing */
    [/^([\d]+) days since your last buy$/,
      "Letzter Kauf vor $1 Tagen"],
    [/^Last buy was ([\d]+) days ago\. Your pace so far has been ~(.+?)\/mo\. The projection below shows what today's money does on its own — every new buy lifts the whole fan\.$/,
      "Letzter Kauf vor $1 Tagen. Dein bisheriges Tempo lag bei ~$2/Mon. Die Projektion unten zeigt, was das heutige Geld allein bewirkt — jeder neue Kauf hebt den ganzen Fächer."],

    /* Beating the bank. This body contains <b> elements, so the DOM splits it
       into several text nodes; each fragment is matched on its own. */
    [/^(.+?) vs a savings account$/,
      "$1 ggü. einem Sparkonto"],
    [/^If every deposit had gone into a ([\d.,]+)%\/yr savings account instead, you'd have$/,
      "Wäre jede Einzahlung stattdessen auf ein Sparkonto mit $1%/Jahr gegangen, hättest du heute"],
    [/^today\. You have$/,
      "· Du hast"],
    [/^ahead for taking the market ride\. Over decades this gap is where wealth actually comes from\.$/,
      "voraus dafür, dass du den Markt mitgefahren bist. Über Jahrzehnte ist genau diese Lücke der Ort, an dem Vermögen entsteht."],
    [/^behind for taking the market ride\. Over decades this gap is where wealth actually comes from\.$/,
      "zurück dafür, dass du den Markt mitgefahren bist. Über Jahrzehnte ist genau diese Lücke der Ort, an dem Vermögen entsteht."],

    /* Crash test rows */
    [/^healed in (.+)$/, "geheilt in $1"],
  ];

  /* A string that is ONLY punctuation and digits is never a translatable phrase,
     and is exactly what must never be touched: currency amounts, percentages,
     tickers, dates, table figures. The old guard rejected any string CONTAINING
     a digit, which silently refused every sentence with a number in it — i.e.
     every coach body and every stat caption. This narrows it to what it was
     actually protecting. */
  const NUMERIC_ONLY = /^[\s\d.,%+\-–—$€£/·:()]*$/;

  /* A string is only translated on an EXACT trimmed match. Anything containing a
     digit is skipped outright as a second line of defence, so no figure can ever
     be altered even if a key were added carelessly. */
  function translate(text) {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 220) return null;
    if (/\d/.test(trimmed)) return null;
    const hit = DE[trimmed];
    if (!hit || hit === trimmed) return null;
    return text.replace(trimmed, hit);
  }

  function walk(root) {
    if (!root) return;
    const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const p = n.parentNode;
        if (!p) return NodeFilter.FILTER_REJECT;
        const tag = p.nodeName;
        // Never touch script, style, inputs or anything explicitly opted out.
        if (tag === "SCRIPT" || tag === "STYLE" || tag === "TEXTAREA") return NodeFilter.FILTER_REJECT;
        if (p.closest && p.closest("[data-no-i18n]")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const jobs = [];
    let n;
    while ((n = it.nextNode())) {
      const out = translate(n.nodeValue);
      if (out !== null) jobs.push([n, out]);
    }
    jobs.forEach(([node, value]) => { node.nodeValue = value; });

    // Placeholders and accessible names are user-visible too.
    (root.querySelectorAll ? root.querySelectorAll("[placeholder],[aria-label]") : []).forEach((el) => {
      ["placeholder", "aria-label"].forEach((attr) => {
        const v = el.getAttribute(attr);
        if (!v) return;
        const out = translate(v);
        if (out !== null) el.setAttribute(attr, out);
      });
    });
  }

  /* ── language switch ──────────────────────────────────────────────────────
     German by default, English on demand — the owner uses it in German but shows
     it to other people in English.

     This is exactly what a translation LAYER buys: English is not a translation
     at all, it is simply the layer switched off, so the original strings the
     engine emits are what render. There is no second set of strings to maintain
     and no way for the two languages to drift apart.

     Switching reloads rather than untranslating in place. The engine re-renders
     constantly, so reversing a mutation would mean tracking every node it has
     ever touched; a reload is instant, exact, and cannot leave a half-translated
     screen behind. */
  const LANG_KEY = "pt_lang";
  const lang = () => {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      return (saved === "en" || saved === "de") ? saved : "en";
    } catch (_) { return "en"; }
  };
  window.appLang = lang;

  /* appLocale() — the ONE place that resolves the app's language setting to an
     Intl locale string. Every number/date formatter in the app routes through
     this instead of deriving a locale independently (a bug-hunt session found
     five-plus call sites each deriving 'de-DE'/'en-US' from state.view.ccy — the
     CURRENCY, not the language — so German with dollars rendered as American-
     formatted digits; a sixth call site was just as easy to add wrong as the
     first five, because nothing made that wrong). Locale controls SEPARATORS
     and date order; Intl.NumberFormat's own `currency` option (state.view.ccy)
     still controls which symbol appears — the two were always independent
     inputs to the same API, the bug was only ever which one drove locale.
     Decision — language drives formatting, not currency, not the browser's own
     locale — made once, here, not per call site: German with dollars is
     "153.959,57 $", not "$153,959.57". */
  window.appLocale = () => lang() === "de" ? "de-DE" : "en-US";

  /* t() — render-site translator for template literals (see the ARCHITECTURE
     DECISION comment at the top of this file). The STATIC segments (the strings
     array a tagged template receives) are joined into ONE dictionary key, with
     each interpolation replaced by its 1-based position — %1, %2, … — not a bare
     "%s". That numbering is the whole point: German clause order is routinely
     different from English (session-2 requirement, confirmed against the
     original bare-"%s" version, which failed this — see test/t-function.spec.js),
     so the DE dictionary VALUE has to be able to place %2 before %1, or use %1
     twice and never touch %2, or any other reordering — a bare split-and-zip by
     position can't express any of that, because it hands values to whichever
     template ends up being used in the ORDER THEY WERE PASSED, not by where the
     translator wants them. Numbering makes substitution a lookup by NUMBER
     instead: every %N in the final template (German or the untouched English
     fallback) is replaced by values[N-1], regardless of where in the string that
     number appears or how many times it repeats.
     Looked up in the same DE dictionary the post-render pass already uses (not a
     second dictionary to keep in sync). No dictionary entry, wrong language, or
     a value itself containing the literal substring "%1" etc. (none of this
     app's formatters emit that) all fall back to reassembling the untouched
     English template — same "English is the layer switched off" fallback as
     everywhere else in this file, never a blank or a thrown error. */
  function t(strings, ...values) {
    const key = strings.reduce((acc, s, i) => acc + s + (i < values.length ? `%${i + 1}` : ""), "");
    const template = (lang() === "de" && DE[key]) ? DE[key] : key;
    return template.replace(/%(\d+)/g, (m, n) => {
      const i = +n - 1;
      return i < values.length ? values[i] : m;
    });
  }
  window.t = t;

  window.setAppLang = (l) => {
    try { localStorage.setItem(LANG_KEY, l === "de" ? "de" : "en"); } catch (_) {}
    location.reload();
  };

  function mountToggle() {
    const bar = document.querySelector("#page-portfolio .appbar__actions");
    if (!bar || document.getElementById("langBtn")) return;
    const b = document.createElement("button");
    b.id = "langBtn";
    b.className = "iconbtn langbtn";
    b.type = "button";
    b.setAttribute("data-no-i18n", "");
    const other = lang() === "de" ? "EN" : "DE";
    b.textContent = other;
    b.setAttribute("aria-label", lang() === "de" ? "Switch to English" : "Auf Deutsch umstellen");
    b.onclick = () => window.setAppLang(lang() === "de" ? "en" : "de");
    bar.insertBefore(b, bar.firstChild);
  }

  function start() {
    mountToggle();
    new MutationObserver(mountToggle).observe(document.body, { childList: true, subtree: true });

    const cur = lang();
    document.documentElement.lang = cur;
    if (cur === "en") return; // Layer off for English: 0ms overhead

    const dict = DE;

    function translateStr(text) {
      const trimmed = text.trim();
      if (!trimmed || trimmed.length > 220 || NUMERIC_ONLY.test(trimmed)) return null;

      const hit = dict[trimmed];
      if (hit && hit !== trimmed) return text.replace(trimmed, () => hit);

      // Second pass, only once the exact table has missed.
      for (let i = 0; i < DE_PATTERNS.length; i++) {
        const re = DE_PATTERNS[i][0];
        if (!re.test(trimmed)) continue;
        const out = trimmed.replace(re, DE_PATTERNS[i][1]);
        // Replacement is passed as a function so a captured "$" from a currency
        // amount can never be re-read as a substitution token.
        if (out !== trimmed) return text.replace(trimmed, () => out);
      }
      return null;
    }

    function walkLocal(root) {
      if (!root) return;
      const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(n) {
          const p = n.parentNode;
          if (!p || p.nodeName === "SCRIPT" || p.nodeName === "STYLE" || p.nodeName === "TEXTAREA") return NodeFilter.FILTER_REJECT;
          if (p.closest && p.closest("[data-no-i18n]")) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      const jobs = [];
      let n;
      while ((n = it.nextNode())) {
        const out = translateStr(n.nodeValue);
        if (out !== null) jobs.push([n, out]);
      }
      jobs.forEach(([node, val]) => { node.nodeValue = val; });
    }

    walkLocal(document.body);
    new MutationObserver((records) => {
      for (const r of records) {
        r.addedNodes.forEach((n) => {
          if (n.nodeType === 1) walkLocal(n);
          else if (n.nodeType === 3) {
            const out = translateStr(n.nodeValue);
            if (out !== null) n.nodeValue = out;
          }
        });
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();

  window.i18nDE = DE;
})();

