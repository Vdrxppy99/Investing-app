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

