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
    "Explore": "Entdecken",
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
    "Dividends": "Dividenden",
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
    "Movers": "Bewegungen",
    "Active": "Aktiv",
    "Gainers": "Gewinner",
    "Losers": "Verlierer",
    "Ideas": "Ideen",
    "Watchlist": "Merkliste",
    "Following": "Beobachtet",
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
    "Unrealized": "Unrealisiert",
    "Realized": "Realisiert",
    "What this means": "Was das bedeutet",

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
    "Nothing needs your attention. The portfolio is running clean.":
      "Nichts erfordert deine Aufmerksamkeit. Das Portfolio läuft sauber.",
    "Shows once at each market open and close.":
      "Erscheint einmal bei Börsenstart und Börsenschluss.",
    "Don't show automatically": "Nicht automatisch anzeigen",
  };

  Object.assign(DE, SENTENCES);

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
  const SUPPORTED = ["en", "de", "es"];
  const lang = () => {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      return saved && SUPPORTED.includes(saved) ? saved : "en";
    } catch (_) { return "en"; }
  };
  window.appLang = lang;
  window.setAppLang = (l) => {
    try { localStorage.setItem(LANG_KEY, SUPPORTED.includes(l) ? l : "en"); } catch (_) {}
    location.reload();
  };

  /* Spanish translation dictionary */
  const ES = {
    "Portfolio": "Portafolio",
    "Explore": "Explorar",
    "Insights": "Análisis",
    "My Portfolio": "Mi Portafolio",
    "Example data": "Datos de ejemplo",
    "Settings": "Ajustes",
    "Holdings": "Posiciones",
    "Value": "Valor",
    "Today": "Hoy",
    "Profit": "Ganancia",
    "Allocation": "Asignación",
    "Goal": "Meta",
    "Dividends": "Dividendos",
    "Total profit": "Ganancia total",
    "Deposited": "Depositado",
    "Cash": "Efectivo",
    "LIVE": "EN VIVO",
    "Performance": "Rendimiento",
    "Risk": "Riesgo",
    "Tax lots": "Lotes fiscales",
    "Search any stock or ETF": "Buscar acción o ETF",
    "Watchlist": "Lista de seguimiento",
    "Close": "Cerrar",
    "Save": "Guardar",
    "Done": "Hecho"
  };

  function getDict() {
    const cur = lang();
    if (cur === "de") return DE;
    if (cur === "es") return ES;
    return null;
  }

  function mountToggle() {
    const bar = document.querySelector("#page-portfolio .appbar__actions");
    if (!bar || document.getElementById("langBtn")) return;
    const b = document.createElement("button");
    b.id = "langBtn";
    b.className = "iconbtn langbtn";
    b.type = "button";
    b.setAttribute("data-no-i18n", "");
    const cur = lang();
    b.textContent = cur.toUpperCase();
    b.setAttribute("aria-label", "Switch language (" + cur.toUpperCase() + ")");
    b.onclick = () => {
      const idx = SUPPORTED.indexOf(cur);
      const next = SUPPORTED[(idx + 1) % SUPPORTED.length];
      window.setAppLang(next);
    };
    bar.insertBefore(b, bar.firstChild);
  }

  function start() {
    mountToggle();
    new MutationObserver(mountToggle).observe(document.body, { childList: true, subtree: true });

    const cur = lang();
    document.documentElement.lang = cur;
    if (cur === "en") return; // Layer off for English: 0ms overhead

    const dict = getDict();
    if (!dict) return;

    function translateStr(text) {
      const trimmed = text.trim();
      if (!trimmed || trimmed.length > 220 || /\d/.test(trimmed)) return null;
      const hit = dict[trimmed];
      return (hit && hit !== trimmed) ? text.replace(trimmed, hit) : null;
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

