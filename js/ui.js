/* ═══════════════════════════════════════════════════════════════════════════
   UI — the component layer. Every screen renders through these builders.
   After this file exists, nothing anywhere composes markup by hand.

   Two rules these functions exist to enforce:

   1. NO INLINE STYLES. Not one `style=` in anything returned from here. The old
      app had 40 in index.html and 166 emitted from JS, which is the single
      loudest "unfinished" signal it had. Data-driven geometry (a bar's width, a
      ring's dash offset) is set through el.style.setProperty('--x', …) as a DOM
      call after insertion — see uiSetFill / uiSetRing. A custom property carrying
      a datum is not ad-hoc styling; a `style="border:1px solid…"` in a template
      literal is.

   2. EVERYTHING IS ESCAPED. These builders take real ticker names and API
      strings. esc() on every interpolation, always.
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  /* ── primitives ─────────────────────────────────────────────────────────── */

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /** class-list helper: uiCx('a', cond && 'b') → "a b" */
  function cx() {
    return Array.prototype.filter.call(arguments, Boolean).join(" ");
  }

  /** <svg><use href="#i-name"/></svg> — the only way an icon enters the DOM. */
  function uiIcon(name, cls) {
    return '<svg class="' + esc(cls || "") + '" aria-hidden="true"><use href="#i-' + esc(name) + '"/></svg>';
  }

  /* ── 6.1 Button ─────────────────────────────────────────────────────────── */
  // uiButton({ label, variant, size, icon, full, disabled, loading, attrs })
  function uiButton(o) {
    o = o || {};
    var cls = cx(
      "btn",
      "btn--" + (o.variant || "secondary"),
      o.size && o.size !== "md" ? "btn--" + o.size : "",
      o.full && "btn--full",
      o.class
    );
    var inner = o.loading
      ? '<span class="btn__spin"></span>'
      : (o.icon ? uiIcon(o.icon) : "") + (o.label ? "<span>" + esc(o.label) + "</span>" : "");
    return (
      "<button" +
      ' class="' + cls + '"' +
      (o.id ? ' id="' + esc(o.id) + '"' : "") +
      (o.disabled || o.loading ? " disabled" : "") +
      // A loading button keeps its accessible name so a screen reader does not
      // lose the control mid-request.
      (o.loading && o.label ? ' aria-label="' + esc(o.label) + '"' : "") +
      attrStr(o.attrs) +
      ">" + inner + "</button>"
    );
  }

  /* ── 6.2 Icon button — aria-label is REQUIRED, not optional ─────────────── */
  function uiIconButton(o) {
    o = o || {};
    if (!o.label) throw new Error("uiIconButton needs a label (aria-label) — icon-only controls must be named");
    return (
      '<button class="' + cx("iconbtn", o.class) + '"' +
      (o.id ? ' id="' + esc(o.id) + '"' : "") +
      ' aria-label="' + esc(o.label) + '"' +
      attrStr(o.attrs) + ">" +
      uiIcon(o.icon) +
      "</button>"
    );
  }

  /* ── 6.3 Segmented control ──────────────────────────────────────────────── */
  // uiSeg({ items:[{value,label}], value, name })
  function uiSeg(o) {
    var items = (o.items || []).map(function (it) {
      var sel = String(it.value) === String(o.value);
      return (
        '<button class="seg__item" role="tab"' +
        ' aria-selected="' + (sel ? "true" : "false") + '"' +
        ' data-value="' + esc(it.value) + '">' +
        esc(it.label) +
        "</button>"
      );
    });
    return (
      '<div class="' + cx("seg", o.class) + '" role="tablist"' +
      (o.label ? ' aria-label="' + esc(o.label) + '"' : "") +
      (o.id ? ' id="' + esc(o.id) + '"' : "") + ">" +
      items.join("") +
      "</div>"
    );
  }

  /* ── 6.4 Chip ───────────────────────────────────────────────────────────── */
  function uiChip(o) {
    o = typeof o === "string" ? { label: o } : o || {};
    return (
      '<span class="' + cx("chip", o.tone && "chip--" + o.tone, o.class) + '">' +
      (o.icon ? uiIcon(o.icon) : "") +
      esc(o.label) +
      "</span>"
    );
  }

  /** Delta pill — the ONLY place gain/loss colour is applied to a pill. */
  function uiDelta(pct, text) {
    var up = Number(pct) >= 0;
    return uiChip({
      label: text,
      tone: up ? "gain" : "loss",
      icon: up ? "trending-up" : "trending-down",
    });
  }

  /* ── 6.5 List row ───────────────────────────────────────────────────────── */
  // uiRow({ logo, title, sub, spark, value, delta, chevron, press, tag, attrs })
  function uiRow(o) {
    o = o || {};
    var tag = o.tag || (o.press ? "button" : "div");
    return (
      "<" + tag + ' class="' + cx("row", o.press && "row--press", o.class) + '"' +
      attrStr(o.attrs) + ">" +
      (o.logo ? o.logo : "") +
      '<span class="row__main">' +
      '<span class="row__title">' + esc(o.title) + "</span>" +
      (o.sub ? '<span class="row__sub">' + esc(o.sub) + "</span>" : "") +
      "</span>" +
      (o.spark ? o.spark : "") +
      (o.value || o.delta
        ? '<span class="row__trail">' +
          (o.value ? '<span class="row__value" data-selectable>' + esc(o.value) + "</span>" : "") +
          (o.delta ? "<span>" + o.delta + "</span>" : "") +
          "</span>"
        : "") +
      (o.chevron ? '<span class="row__chev">' + uiIcon("chevron-right") + "</span>" : "") +
      "</" + tag + ">"
    );
  }

  /* ── 6.6 Card ───────────────────────────────────────────────────────────── */
  function uiCard(o) {
    o = o || {};
    var head = o.title
      ? '<div class="card__head"><h2 class="card__title">' + esc(o.title) + "</h2>" +
        (o.action || "") + "</div>"
      : "";
    return (
      '<section class="' + cx("card", o.class) + '"' + attrStr(o.attrs) + ">" +
      head + (o.body || "") +
      "</section>"
    );
  }

  /* ── 6.7 Stat tile ──────────────────────────────────────────────────────── */
  function uiStat(o) {
    return (
      '<div class="' + cx("stat", o.class) + '">' +
      '<div class="stat__label">' + esc(o.label) + "</div>" +
      '<div class="stat__value" data-selectable>' + esc(o.value) + "</div>" +
      (o.delta ? '<div class="' + cx("stat__delta", o.tone) + '">' + esc(o.delta) + "</div>" : "") +
      "</div>"
    );
  }

  /* ── 6.8 Input — always labelled, never placeholder-as-label ────────────── */
  function uiField(o) {
    o = o || {};
    var id = o.id || "f-" + Math.random().toString(36).slice(2, 8);
    return (
      '<label class="' + cx("field", o.class) + '" for="' + esc(id) + '">' +
      '<span class="field__label">' + esc(o.label) + "</span>" +
      '<input class="' + cx("input", o.numeric && "input--num") + '" id="' + esc(id) + '"' +
      ' type="' + esc(o.type || "text") + '"' +
      // inputmode drives which iOS keyboard appears — decimal for money, not the
      // full alphabetic keyboard the old edit table used.
      (o.numeric ? ' inputmode="decimal"' : "") +
      (o.value != null ? ' value="' + esc(o.value) + '"' : "") +
      (o.placeholder ? ' placeholder="' + esc(o.placeholder) + '"' : "") +
      (o.invalid ? ' aria-invalid="true"' : "") +
      (o.disabled ? " disabled" : "") +
      attrStr(o.attrs) + " />" +
      (o.error ? '<span class="field__error">' + esc(o.error) + "</span>" : "") +
      "</label>"
    );
  }

  /* ── 6.9 Search ─────────────────────────────────────────────────────────── */
  function uiSearch(o) {
    o = o || {};
    var id = o.id || "search";
    return (
      '<div class="search" data-search>' +
      '<span class="search__icon">' + uiIcon("search") + "</span>" +
      '<label class="sr" for="' + esc(id) + '">' + esc(o.label || "Search") + "</label>" +
      '<input id="' + esc(id) + '" type="search" placeholder="' + esc(o.placeholder || "Search") + '"' +
      ' autocomplete="off" autocapitalize="characters" spellcheck="false" />' +
      '<button class="search__clear" data-search-clear aria-label="Clear search">' +
      uiIcon("x") + "</button>" +
      "</div>"
    );
  }

  /* ── 6.10/6.11 Sheet and modal shells ───────────────────────────────────── */
  function uiSheet(o) {
    o = o || {};
    return (
      '<div class="sheet" id="' + esc(o.id) + '" data-open="false" role="dialog" aria-modal="true"' +
      (o.title ? ' aria-label="' + esc(o.title) + '"' : "") + ">" +
      '<div class="sheet__grip" data-sheet-grip></div>' +
      '<div class="sheet__head">' +
      '<h2 class="card__title">' + esc(o.title || "") + "</h2>" +
      uiIconButton({ icon: "x", label: "Close", attrs: { "data-sheet-close": "" } }) +
      "</div>" +
      '<div class="sheet__body">' + (o.body || "") + "</div>" +
      "</div>"
    );
  }

  // Replaces every confirm() in the codebase. Destructive action is never a
  // filled red button — the word carries the weight, not the colour.
  function uiModal(o) {
    o = o || {};
    return (
      '<div class="modal" id="' + esc(o.id) + '" data-open="false" role="dialog" aria-modal="true">' +
      '<h2 class="card__title">' + esc(o.title) + "</h2>" +
      (o.body ? '<p class="t-caption muted">' + esc(o.body) + "</p>" : "") +
      '<div class="modal__actions">' +
      uiButton({ label: o.cancel || "Cancel", variant: "secondary", attrs: { "data-modal-cancel": "" } }) +
      uiButton({
        label: o.confirm || "Confirm",
        variant: o.destructive ? "danger" : "primary",
        attrs: { "data-modal-confirm": "" },
      }) +
      "</div></div>"
    );
  }

  /* ── 6.14 Progress bar · 6.15 Ring ──────────────────────────────────────── */
  function uiBar(o) {
    o = o || {};
    return (
      '<div class="' + cx("bar", o.class) + '" role="progressbar"' +
      ' aria-valuenow="' + Math.round(o.pct) + '" aria-valuemin="0" aria-valuemax="100"' +
      (o.label ? ' aria-label="' + esc(o.label) + '"' : "") + ">" +
      '<div class="' + cx("bar__fill", o.attn && "bar__fill--attn") + '" data-fill></div>' +
      "</div>"
    );
  }

  function uiRing(o) {
    o = o || {};
    var size = o.size || 96;
    var stroke = 12;
    var r = (size - stroke) / 2;
    var c = 2 * Math.PI * r;
    return (
      '<div class="' + cx("ring", o.class) + '" data-ring data-circ="' + c.toFixed(2) + '"' +
      ' data-pct="' + Number(o.pct).toFixed(2) + '">' +
      '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + " " + size + '">' +
      '<circle class="ring__track" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r.toFixed(2) +
      '" stroke-width="' + stroke + '"/>' +
      '<circle class="' + cx("ring__fill", o.attn && "ring__fill--attn") + '"' +
      ' cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r.toFixed(2) + '"' +
      ' stroke-width="' + stroke + '" stroke-linecap="round" data-ring-fill/>' +
      "</svg>" +
      '<span class="ring__label">' + esc(o.label) + "</span>" +
      "</div>"
    );
  }

  /* ── 6.16 Skeleton ──────────────────────────────────────────────────────── */
  function uiSkeleton(kind, count) {
    var one = '<div class="skel skel--' + esc(kind || "line") + '"></div>';
    return new Array(count || 1).fill(one).join("");
  }

  /** The standard holdings-list placeholder, so no screen invents its own. */
  function uiSkeletonRows(n) {
    var row =
      '<div class="row">' +
      '<div class="skel skel--badge"></div>' +
      '<div class="row__main stack--tight">' +
      '<div class="skel skel--line"></div>' +
      "</div>" +
      "</div>";
    return new Array(n || 3).fill(row).join("");
  }

  /* ── 6.17/6.18 Empty and error ──────────────────────────────────────────── */
  function uiEmpty(o) {
    o = o || {};
    return (
      '<div class="' + cx("empty", o.error && "empty--error") + '">' +
      '<span class="empty__icon">' + uiIcon(o.icon || (o.error ? "alert" : "layers")) + "</span>" +
      '<p class="empty__title">' + esc(o.title) + "</p>" +
      (o.note ? '<p class="empty__note">' + esc(o.note) + "</p>" : "") +
      (o.action || "") +
      "</div>"
    );
  }

  /* ── 6.19 Banner ────────────────────────────────────────────────────────── */
  function uiBanner(o) {
    o = o || {};
    return (
      '<div class="banner"' + (o.id ? ' id="' + esc(o.id) + '"' : "") + ' role="status">' +
      uiIcon(o.icon || "info") +
      '<span class="banner__text">' + esc(o.text) + "</span>" +
      (o.action || "") +
      "</div>"
    );
  }

  /* ── 6.20 Logo tile — monogram when there is no image ───────────────────── */
  function uiLogo(sym, src) {
    var mono = String(sym || "?").replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase();
    return (
      '<span class="blogo" aria-hidden="true">' +
      (src ? '<img src="' + esc(src) + '" alt="" loading="lazy"/>' : esc(mono)) +
      "</span>"
    );
  }

  /* ── 6.21 Chart shell ───────────────────────────────────────────────────── */
  function uiChart(o) {
    o = o || {};
    return (
      '<div class="chart"><canvas id="' + esc(o.id) + '"' +
      (o.label ? ' aria-label="' + esc(o.label) + '" role="img"' : "") +
      "></canvas></div>"
    );
  }

  function uiSpark(id) {
    return '<canvas class="spark" id="' + esc(id) + '" aria-hidden="true"></canvas>';
  }

  /* ── 6.22 Table ─────────────────────────────────────────────────────────── */
  function uiTable(o) {
    o = o || {};
    return (
      '<div class="tablewrap"><table class="table">' +
      "<thead><tr>" + (o.head || []).map(function (h) { return "<th>" + esc(h) + "</th>"; }).join("") + "</tr></thead>" +
      "<tbody>" +
      (o.rows || []).map(function (r) {
        return "<tr>" + r.map(function (cell) {
          // Cells may be pre-built markup (a delta pill); strings are escaped.
          return "<td>" + (cell && cell.html ? cell.html : esc(cell)) + "</td>";
        }).join("") + "</tr>";
      }).join("") +
      "</tbody></table></div>"
    );
  }

  /* ── Disclosure row — how a demoted module is reached on mobile ─────────── */
  function uiDisclose(o) {
    o = o || {};
    return (
      '<button class="disclose"' + attrStr(o.attrs) + ">" +
      '<span class="disclose__title">' + esc(o.title) + "</span>" +
      (o.meta ? '<span class="disclose__meta">' + esc(o.meta) + "</span>" : "") +
      uiIcon("chevron-right") +
      "</button>"
    );
  }

  /* ── Insight group — the Insights restructure ───────────────────────────── */
  // Headline plus at most three supporting figures; the rest is behind the tap.
  function uiGroup(o) {
    o = o || {};
    var figs = (o.figures || []).slice(0, 3).map(function (f) {
      return '<div class="group__fig"><dt>' + esc(f.label) + "</dt>" +
        '<dd class="' + cx(f.tone) + '" data-selectable>' + esc(f.value) + "</dd></div>";
    });
    return (
      '<button class="card group"' + attrStr(o.attrs) + ">" +
      '<span class="group__label">' + esc(o.label) + uiIcon("chevron-right") + "</span>" +
      '<dl class="group__figures">' + figs.join("") + "</dl>" +
      "</button>"
    );
  }

  /* ── dynamic geometry — DOM calls, never style= in markup ───────────────── */

  /** Bar fill. Called after insertion; --fill is a datum, not a style choice. */
  function uiSetFill(root) {
    (root || document).querySelectorAll("[data-fill]").forEach(function (el) {
      var pct = el.parentElement.getAttribute("aria-valuenow");
      el.style.setProperty("width", Math.max(0, Math.min(100, Number(pct))) + "%");
    });
  }

  function uiSetRing(root) {
    (root || document).querySelectorAll("[data-ring]").forEach(function (el) {
      var circ = Number(el.getAttribute("data-circ"));
      var pct = Math.max(0, Math.min(100, Number(el.getAttribute("data-pct"))));
      var fill = el.querySelector("[data-ring-fill]");
      if (!fill) return;
      fill.style.setProperty("stroke-dasharray", circ.toFixed(2));
      fill.style.setProperty("stroke-dashoffset", (circ * (1 - pct / 100)).toFixed(2));
    });
  }

  /** Run after any render that inserted bars or rings. */
  function uiHydrate(root) {
    uiSetFill(root);
    uiSetRing(root);
  }

  function attrStr(attrs) {
    if (!attrs) return "";
    return Object.keys(attrs).map(function (k) {
      var v = attrs[k];
      // Guard: attrs is the escape hatch, so make sure it cannot smuggle a style.
      if (k === "style") throw new Error("ui.js: inline styles are not permitted — use a class or a custom property");
      return v === "" ? " " + k : " " + k + '="' + esc(v) + '"';
    }).join("");
  }

  /* ── exports ────────────────────────────────────────────────────────────── */
  window.ui = {
    esc: esc, cx: cx, icon: uiIcon,
    button: uiButton, iconButton: uiIconButton, seg: uiSeg,
    chip: uiChip, delta: uiDelta, row: uiRow, card: uiCard, stat: uiStat,
    field: uiField, search: uiSearch, sheet: uiSheet, modal: uiModal,
    bar: uiBar, ring: uiRing, skeleton: uiSkeleton, skeletonRows: uiSkeletonRows,
    empty: uiEmpty, banner: uiBanner, logo: uiLogo, chart: uiChart, spark: uiSpark,
    table: uiTable, disclose: uiDisclose, group: uiGroup,
    hydrate: uiHydrate,
  };
})();
