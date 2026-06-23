/* ============================================================================
 * Annotation Colour Labels — main module
 * ----------------------------------------------------------------------------
 * This file is loaded by bootstrap.js and attaches everything to
 * `Zotero.AnnotationColourLabels` so the reader hook AND the preferences pane
 * can share one source of truth.
 *
 * SOLVED in this scaffold:
 *   - preference storage (read/write the colour -> custom-name map)
 *   - the canonical colour table used by the preferences pane
 *   - the public API shape (init / attach / refresh)
 *   - a discovery helper to find the right reader selectors (see DEBUG section)
 *
 * NOT YET SOLVED (the one real unknown — see CLAUDE.md "The one hard part"):
 *   - the exact selectors / hook point for the reader's colour UI in
 *     Zotero 8/9. Everything is wired up around a single CONFIG block and a
 *     debug helper so this can be nailed down quickly against a live reader.
 * ========================================================================== */

Zotero.AnnotationColourLabels = {
  id: null,
  version: null,
  rootURI: null,
  _initialised: false,
  _observers: new WeakMap(), // reader document -> MutationObserver

  /* ----- Canonical colour table -------------------------------------------
   * Zotero ships a fixed palette of annotation colours. The first five are the
   * long-standing ones; orange / magenta / grey were added in 6.0.22.
   *
   * Confirmed on Zotero 9.0.4: all eight hexes below match the reader's own
   * picker swatches exactly (verified by reading each swatch's SVG fill in a
   * live reader). This table is also what the preferences pane renders.
   */
  COLORS: [
    { hex: "#ffd400", name: "Yellow" },
    { hex: "#ff6666", name: "Red" },
    { hex: "#5fb236", name: "Green" },
    { hex: "#2ea8e5", name: "Blue" },
    { hex: "#a28ae5", name: "Purple" },
    { hex: "#e56eee", name: "Magenta" },
    { hex: "#f19837", name: "Orange" },
    { hex: "#aaaaaa", name: "Grey" },
  ],

  /* ----- Lifecycle --------------------------------------------------------- */
  init({ id, version, rootURI }) {
    if (this._initialised) return;
    this.id = id;
    this.version = version;
    this.rootURI = rootURI;
    this._initialised = true;
    this.log("Initialised v" + version);
  },

  shutdown() {
    // Detach every observer we created.
    try {
      this.detachFromAllReaders();
    } catch (e) {
      this.log("Error during shutdown: " + e);
    }
    delete Zotero.AnnotationColourLabels;
  },

  /* ----- Preferences ------------------------------------------------------
   * Keys are passed WITHOUT the `extensions.zotero.` prefix and read/written
   * with the global flag omitted, so Zotero resolves them under that branch —
   * matching the defaults registered in prefs.js
   * (extensions.zotero.annotation-colour-labels.*). Code-side fallbacks below
   * mean the plugin still behaves correctly even if those defaults aren't
   * loaded on a given version.
   */
  PREF_NAMES: "annotation-colour-labels.names",
  PREF_ENABLED: "annotation-colour-labels.enabled",
  PREF_REPLACE: "annotation-colour-labels.replaceNames",
  // Per-surface "Apply in:" toggles (all default on).
  PREF_SURFACE_PICKER: "annotation-colour-labels.surfacePicker",
  PREF_SURFACE_SIDEBAR: "annotation-colour-labels.surfaceSidebar",
  PREF_SURFACE_LIBRARY: "annotation-colour-labels.surfaceLibrary",

  /** A surface toggle defaults to on unless explicitly set false. */
  _surfaceOn(pref) {
    try {
      return Zotero.Prefs.get(pref) !== false;
    } catch (e) {
      return true;
    }
  },

  isEnabled() {
    try {
      return Zotero.Prefs.get(this.PREF_ENABLED) !== false;
    } catch (e) {
      return true;
    }
  },

  /** When true, swap the picker's visible colour name for the custom one. When
   * false, keep the native colour name visible and show the custom name on
   * hover only (better for colour-blind users who rely on the colour word). */
  shouldReplaceNames() {
    try {
      return Zotero.Prefs.get(this.PREF_REPLACE) !== false;
    } catch (e) {
      return true;
    }
  },

  /** Returns { "#ffd400": "Key finding", ... } — only colours the user renamed. */
  getCustomNames() {
    try {
      const raw = Zotero.Prefs.get(this.PREF_NAMES);
      if (!raw) return {};
      const obj = JSON.parse(raw);
      // Normalise keys to lowercase hex.
      const out = {};
      for (const k of Object.keys(obj)) {
        if (obj[k] && String(obj[k]).trim()) out[k.toLowerCase()] = obj[k];
      }
      return out;
    } catch (e) {
      this.log("Could not parse names pref: " + e);
      return {};
    }
  },

  setCustomNames(map) {
    Zotero.Prefs.set(this.PREF_NAMES, JSON.stringify(map || {}));
    this.refreshAllReaders();
  },

  /** The label to show for a colour: custom name if set, otherwise the default. */
  labelFor(hex) {
    const custom = this.getCustomNames();
    const key = (hex || "").toLowerCase();
    if (custom[key]) return custom[key];
    const known = this.COLORS.find((c) => c.hex.toLowerCase() === key);
    return known ? known.name : hex;
  },

  /** True only for the fixed annotation palette — so the broad swatch
   * selectors below can never relabel an unrelated toolbar button. */
  _isKnownColor(hex) {
    const key = (hex || "").toLowerCase();
    return this.COLORS.some((c) => c.hex.toLowerCase() === key);
  },

  /* ----- Reader integration ----------------------------------------------- */

  /**
   * Attach to every reader window that is currently open.
   * bootstrap.js calls this on startup; new readers are picked up via
   * onReaderInstance() below.
   */
  attachToAllWindows() {
    try {
      // Confirmed on Zotero 9.0.4: open readers live in Zotero.Reader._readers.
      const readers = (Zotero.Reader && Zotero.Reader._readers) || [];
      for (const reader of readers) this.attachToReader(reader);
    } catch (e) {
      this.log("attachToAllWindows failed: " + e);
    }
    // The library item pane (annotation rows) lives in the main window.
    this.attachToMainWindow();
  },

  /**
   * Hook a single reader instance. We relabel once now, then keep the labels
   * correct as the reader rebuilds its toolbars/menus via a MutationObserver.
   * Confirmed working on Zotero 9.0.4.
   */
  attachToReader(reader) {
    if (!this.isEnabled() || !reader) return;
    const doc = this._readerDocument(reader);
    if (doc) {
      this._observe(doc);
      return;
    }
    // The reader iframe often isn't ready the instant its tab opens (or at
    // startup with restored tabs). Retry until the document exists, then attach,
    // so the observer is never silently skipped due to a timing race.
    const tries = reader._aclAttachTries || 0;
    if (tries >= 40) return; // ~10s cap, then give up
    reader._aclAttachTries = tries + 1;
    const win = this._mainWindowDoc() && this._mainWindowDoc().defaultView;
    if (win && win.setTimeout) win.setTimeout(() => this.attachToReader(reader), 250);
  },

  /** Hook the main Zotero window so the item pane's annotation rows get the
   * custom names too (the "library" surface). */
  attachToMainWindow() {
    if (!this.isEnabled()) return;
    const doc = this._mainWindowDoc();
    if (doc) {
      this._mainDoc = doc;
      this._observe(doc);
    }
  },

  /** Relabel `doc` now and keep it correct via a debounced MutationObserver.
   * Shared by the reader and main-window attach paths. */
  _observe(doc) {
    if (!doc) return;
    this.applyLabels(doc);
    if (this._observers.has(doc)) return;
    const win = doc.defaultView;
    // Coalesce mutation bursts into one relabel per frame. The attribute filter
    // deliberately excludes our write targets (title/aria-label) so relabelling
    // can't re-trigger the observer; new swatches/rows arrive via childList and
    // in-place colour changes via data-color/class/fill.
    let scheduled = false;
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      win.requestAnimationFrame(() => {
        scheduled = false;
        this.applyLabels(doc);
      });
    };
    const obs = new win.MutationObserver(schedule);
    obs.observe(doc.body || doc.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-color", "class", "fill"],
    });
    this._observers.set(doc, obs);
  },

  _mainWindowDoc() {
    try {
      const win = Zotero.getMainWindow && Zotero.getMainWindow();
      return (win && win.document) || null;
    } catch (e) {
      return null;
    }
  },

  /** Disconnect every observer we can still reach and strip the labels we added,
   * so disable/uninstall leaves the reader AND the main window as we found them. */
  detachFromAllReaders() {
    try {
      const docs = [];
      const readers = (Zotero.Reader && Zotero.Reader._readers) || [];
      for (const reader of readers) {
        const doc = this._readerDocument(reader);
        if (doc) docs.push(doc);
      }
      if (this._mainDoc) docs.push(this._mainDoc);
      for (const doc of docs) {
        try {
          this.removeLabels(doc);
        } catch (e) {
          /* best effort */
        }
        const obs = this._observers.get(doc);
        if (obs) {
          obs.disconnect();
          this._observers.delete(doc);
        }
      }
      this._mainDoc = null;
    } catch (e) {
      this.log("detach failed: " + e);
    }
  },

  refreshAllReaders() {
    const enabled = this.isEnabled();
    const docs = [];
    const readers = (Zotero.Reader && Zotero.Reader._readers) || [];
    for (const reader of readers) {
      const doc = this._readerDocument(reader);
      if (doc) docs.push(doc);
    }
    const mainDoc = this._mainDoc || this._mainWindowDoc();
    if (mainDoc) docs.push(mainDoc);
    for (const doc of docs) {
      // When toggled off, actively strip existing labels rather than just
      // ceasing to add them — otherwise stale tooltips linger until re-render.
      if (enabled) this.applyLabels(doc);
      else this.removeLabels(doc);
    }
  },

  /**
   * Resolve the DOM document that holds the reader's colour UI.
   * Confirmed on Zotero 9.0.4: the colour toolbar/picker live in
   * reader._iframeWindow.document (resource://zotero/reader/reader.html).
   */
  _readerDocument(reader) {
    if (!reader) return null;
    // The reader UI lives in an iframe; the handle has shifted across versions,
    // so try the known candidates and take the first that yields a usable
    // document. _iframeWindow.document wins on Zotero 9; the others are
    // fallbacks for older/newer builds. (The nested PDF-view iframe is a
    // separate document we don't need here.)
    const candidates = [
      () => reader._iframeWindow && reader._iframeWindow.document,
      () => reader._iframe && reader._iframe.contentDocument,
      () => reader._window && reader._window.document,
    ];
    for (const get of candidates) {
      try {
        const doc = get();
        if (doc && doc.querySelectorAll) return doc;
      } catch (e) {
        /* try next */
      }
    }
    return null;
  },

  /* ----- The actual relabel ----------------------------------------------
   * CONFIG: every selector the relabel depends on lives here so it can be
   * adjusted in one place if a future Zotero reader changes its markup.
   * Confirmed against Zotero 9.0.4 (see CONFIG comment below).
   */
  CONFIG: {
    // Confirmed against the Zotero 9 reader (resource://zotero/reader/reader.html)
    // via debugDumpReaderColorElements(). A colour swatch is a <button> whose
    // colour lives in a descendant SVG node's `fill` attribute, e.g.
    //   button.row.basic > div.icon > svg > path[fill="#ffd400"]
    // The button carries no native title/aria, so we add the hover tooltip
    // there. Right-click / menu pickers may instead use data-color — handled.
    //
    // We find colour *sources* (anything carrying a known palette colour), then
    // walk up to the swatch element the user actually hovers/clicks.
    colorSourceSelector: "[fill], [data-color]",
    swatchSelector: "button, [role='option'], [role='menuitem'], [data-color]",
    // The toolbar "Pick a Color" dropdown opener shows the *current* colour
    // (not a choice) and has its own functional tooltip — never relabel it.
    skipSelector: ".toolbar-dropdown-button",
  },

  /** Find the swatch element a colour-source node belongs to, or null if it is
   * not a colour swatch we should touch. */
  _swatchFor(src) {
    const c = this.CONFIG;
    const hex = this._normaliseColor(
      (src.getAttribute && (src.getAttribute("data-color") || src.getAttribute("fill"))) || ""
    );
    if (!hex || !this._isKnownColor(hex)) return null;
    const target = (src.closest && src.closest(c.swatchSelector)) || src;
    if (c.skipSelector && target.closest && target.closest(c.skipSelector)) return null;
    return { target, hex };
  },

  /** The text node that holds a swatch's visible colour name, e.g. the "Yellow"
   * text node sitting right after the swatch's <div class="icon">. Null if the
   * swatch has no visible text label (icon-only pickers). */
  _labelNode(button) {
    for (const n of button.childNodes) {
      if (n.nodeType === 3 && n.nodeValue && n.nodeValue.trim()) return n;
    }
    return null;
  },

  applyLabels(doc) {
    if (!this.isEnabled()) return;
    const custom = this.getCustomNames();
    // Each surface is independently toggleable. When a surface is off we
    // actively undo it (not just skip), so turning it off clears stale labels.
    if (this._surfaceOn(this.PREF_SURFACE_PICKER)) this._applyPicker(doc, custom);
    else this._removePicker(doc);
    if (this._surfaceOn(this.PREF_SURFACE_SIDEBAR)) this._applySidebar(doc, custom);
    else this._removeSidebar(doc);
    if (this._surfaceOn(this.PREF_SURFACE_LIBRARY)) this._applyLibrary(doc, custom);
    else this._removeLibrary(doc);
  },

  /** Strip everything we added across all surfaces, restoring native state.
   * Used on disable/shutdown so nothing is left behind. */
  removeLabels(doc) {
    this._removePicker(doc);
    this._removeSidebar(doc);
    this._removeLibrary(doc);
  },

  /* ----- Surface: the reader colour picker --------------------------------
   * Covers the toolbar dropdown, the text-selection popup, the right-click
   * "change colour" menu, and the colour choices in an annotation popup — all
   * the same <button> swatches. */
  _applyPicker(doc, custom) {
    try {
      const replace = this.shouldReplaceNames();
      for (const src of doc.querySelectorAll(this.CONFIG.colorSourceSelector)) {
        const hit = this._swatchFor(src);
        if (!hit) continue;
        const { target } = hit;
        const name = custom[hit.hex]; // only colours the user actually renamed
        const labelNode = this._labelNode(target);

        // Hover tooltip: the custom name, or restore native (no tooltip) if the
        // colour isn't renamed.
        if (name) {
          if (target.getAttribute("title") !== name) target.setAttribute("title", name);
        } else if (target.hasAttribute("title")) {
          target.removeAttribute("title");
        }

        // Visible name in the picker row. Replace it only when the user opted in
        // AND has set a custom name; otherwise leave (or restore) the native
        // colour name so the accessible/visible label stays correct.
        if (labelNode) {
          if (replace && name) {
            if (target.dataset && target.dataset.aclOrig == null) {
              target.dataset.aclOrig = labelNode.nodeValue;
            }
            if (labelNode.nodeValue !== name) labelNode.nodeValue = name;
          } else if (target.dataset && target.dataset.aclOrig != null) {
            if (labelNode.nodeValue !== target.dataset.aclOrig) {
              labelNode.nodeValue = target.dataset.aclOrig;
            }
            delete target.dataset.aclOrig;
          }
        }
      }
    } catch (e) {
      this.log("_applyPicker error: " + e);
    }
  },

  _removePicker(doc) {
    try {
      for (const src of doc.querySelectorAll(this.CONFIG.colorSourceSelector)) {
        const hit = this._swatchFor(src);
        if (!hit) continue;
        const { target } = hit;
        target.removeAttribute("title");
        target.removeAttribute("aria-label");
        const labelNode = this._labelNode(target);
        if (labelNode && target.dataset && target.dataset.aclOrig != null) {
          labelNode.nodeValue = target.dataset.aclOrig;
          delete target.dataset.aclOrig;
        }
      }
    } catch (e) {
      this.log("_removePicker error: " + e);
    }
  },

  /* ----- Surface: the annotation sidebar list -----------------------------
   * Confirmed on Zotero 9.0.4: each card is
   *   div.annotation[data-sidebar-annotation-id]
   * and its colour is an inline `color` on a `.icon` element (the SVG uses
   * currentColor). There is no worded name, so we add the custom name as a
   * hover tooltip on that icon, marked with data-acl-tip for clean removal. */
  _applySidebar(doc, custom) {
    try {
      for (const el of this._sidebarColorIcons(doc)) {
        const hex = this._normaliseColor(el.style && el.style.color);
        const name = hex && custom[hex];
        if (name) {
          if (el.getAttribute("title") !== name) el.setAttribute("title", name);
          if (el.dataset) el.dataset.aclTip = "1";
        } else if (el.dataset && el.dataset.aclTip != null) {
          el.removeAttribute("title");
          delete el.dataset.aclTip;
        }
      }
    } catch (e) {
      this.log("_applySidebar error: " + e);
    }
  },

  _removeSidebar(doc) {
    try {
      for (const el of this._sidebarColorIcons(doc)) {
        if (el.dataset && el.dataset.aclTip != null) {
          el.removeAttribute("title");
          delete el.dataset.aclTip;
        }
      }
    } catch (e) {
      this.log("_removeSidebar error: " + e);
    }
  },

  /** Colour-bearing icons inside annotation sidebar cards. */
  _sidebarColorIcons(doc) {
    const out = [];
    for (const card of doc.querySelectorAll(".annotation[data-sidebar-annotation-id]")) {
      for (const el of card.querySelectorAll("[style*='color']")) {
        const hex = this._normaliseColor(el.style && el.style.color);
        if (hex && this._isKnownColor(hex)) out.push(el);
      }
    }
    return out;
  },

  /* ----- Surface: the library item pane -----------------------------------
   * Confirmed on Zotero 9.0.4: the main window's item pane lists annotations as
   *   div.annotation-row > img.annotation-icon[style="fill: rgb(...)"]
   * Again no worded name, so we add the custom name as a hover tooltip on the
   * colour icon, marked with data-acl-tip for clean removal. */
  _applyLibrary(doc, custom) {
    try {
      for (const el of this._libraryColorIcons(doc)) {
        const hex = this._normaliseColor(el.style && el.style.fill);
        const name = hex && custom[hex];
        if (name) {
          if (el.getAttribute("title") !== name) el.setAttribute("title", name);
          if (el.dataset) el.dataset.aclTip = "1";
        } else if (el.dataset && el.dataset.aclTip != null) {
          el.removeAttribute("title");
          delete el.dataset.aclTip;
        }
      }
    } catch (e) {
      this.log("_applyLibrary error: " + e);
    }
  },

  _removeLibrary(doc) {
    try {
      for (const el of this._libraryColorIcons(doc)) {
        if (el.dataset && el.dataset.aclTip != null) {
          el.removeAttribute("title");
          delete el.dataset.aclTip;
        }
      }
    } catch (e) {
      this.log("_removeLibrary error: " + e);
    }
  },

  /** Colour-bearing annotation-row icons in the main window's item pane. */
  _libraryColorIcons(doc) {
    const out = [];
    for (const el of doc.querySelectorAll(".annotation-row [style*='fill']")) {
      const hex = this._normaliseColor(el.style && el.style.fill);
      if (hex && this._isKnownColor(hex)) out.push(el);
    }
    return out;
  },

  /** Turn "rgb(255, 212, 0)" or "#FFD400" into a canonical "#ffd400". */
  _normaliseColor(value) {
    if (!value) return null;
    value = String(value).trim().toLowerCase();
    if (value.startsWith("#")) {
      return value.length === 4
        ? "#" + value[1] + value[1] + value[2] + value[2] + value[3] + value[3]
        : value;
    }
    const m = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (m) {
      const hex = (n) => parseInt(n, 10).toString(16).padStart(2, "0");
      return "#" + hex(m[1]) + hex(m[2]) + hex(m[3]);
    }
    return null;
  },

  /* ----- DEBUG: run this to crack the unknown ------------------------------
   * Open a PDF in Zotero, then in Tools → Developer → Run JavaScript paste:
   *
   *     Zotero.AnnotationColourLabels.debugDumpReaderColorElements();
   *
   * It prints, to the Debug Output log, every plausible colour element in the
   * active reader along with its attributes and computed background colour.
   * Use that to fill in CONFIG above with real selectors.
   */
  debugDumpReaderColorElements() {
    const readers = (Zotero.Reader && Zotero.Reader._readers) || [];
    this.log("=== reader colour element dump: " + readers.length + " reader(s) ===");
    for (const reader of readers) {
      const doc = this._readerDocument(reader);
      if (!doc) {
        const handles = Object.keys(reader || {})
          .filter((k) => /iframe|window/i.test(k))
          .join(", ");
        this.log(
          "(no document resolved — _readerDocument returned null. " +
            "iframe/window-ish keys on this reader: [" + handles + "] — " +
            "add the right one to _readerDocument)"
        );
        continue;
      }
      this.log(
        "resolved reader document OK. title=" + JSON.stringify(doc.title) +
          " url=" + (doc.location && doc.location.href)
      );
      this._debugDumpDoc(doc, "reader document");
      // The colour UI may live in a nested iframe; dump those too.
      for (const frame of doc.querySelectorAll("iframe")) {
        try {
          const fdoc = frame.contentDocument;
          if (fdoc) this._debugDumpDoc(fdoc, "nested iframe src=" + (frame.src || "(none)"));
        } catch (e) {
          /* cross-origin or not yet loaded */
        }
      }
    }
    this.log("=== end dump ===");
  },

  _debugDumpDoc(doc, where) {
    const win = doc.defaultView;
    const candidates = doc.querySelectorAll(
      "[data-color], [class*='color'], [class*='colour'], button[title], [role='option']"
    );
    this.log("-- " + where + ": " + candidates.length + " candidate node(s) --");
    let shown = 0;
    for (const el of candidates) {
      if (shown >= 80) break; // keep the log readable
      const inner = el.querySelector && el.querySelector("*");
      const filled = el.querySelector && el.querySelector("[fill]");
      const info = {
        tag: el.tagName,
        class: el.getAttribute("class"),
        role: el.getAttribute("role"),
        dataColor: el.getAttribute("data-color"),
        ariaLabel: el.getAttribute("aria-label"),
        title: el.getAttribute("title"),
        bg: win.getComputedStyle(el).backgroundColor || "",
        innerBg: inner ? (win.getComputedStyle(inner).backgroundColor || "") : null,
        svgFill: filled ? filled.getAttribute("fill") : null,
      };
      this.log(JSON.stringify(info));
      shown++;
    }
  },

  log(msg) {
    Zotero.debug("[Annotation Colour Labels] " + msg);
  },
};
