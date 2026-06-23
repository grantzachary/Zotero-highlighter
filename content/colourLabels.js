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
   * ⚠️ VERIFY the exact hex set against the running client. Prefer reading
   *    Zotero's own list at runtime if you can confirm the API (it is likely
   *    exposed on Zotero.Annotations — check `Zotero.Annotations` in the
   *    Run JavaScript window). The table below is a safe fallback and is what
   *    the preferences pane renders.
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

  isEnabled() {
    try {
      return Zotero.Prefs.get(this.PREF_ENABLED) !== false;
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
      // ⚠️ VERIFY: Zotero.Reader exposes open reader instances. The internal
      //    array has historically been Zotero.Reader._readers. Confirm and,
      //    if a public iterator exists in 8/9, prefer that.
      const readers = (Zotero.Reader && Zotero.Reader._readers) || [];
      for (const reader of readers) this.attachToReader(reader);
    } catch (e) {
      this.log("attachToAllWindows failed: " + e);
    }
  },

  /**
   * Hook a single reader instance. We relabel once now, then keep the labels
   * correct as the reader rebuilds its toolbars/menus via a MutationObserver.
   *
   * ⚠️ This is the part to verify. See debugDumpReaderColorElements() and
   *    CLAUDE.md for the procedure to confirm `doc` and the CONFIG selectors.
   */
  attachToReader(reader) {
    if (!this.isEnabled()) return;
    const doc = this._readerDocument(reader);
    if (!doc) return;

    this.applyLabels(doc);

    if (!this._observers.has(doc)) {
      const win = doc.defaultView;
      // Coalesce mutation bursts into one relabel per frame. The attribute
      // filter deliberately excludes our write targets (title/aria-label) so
      // relabelling can't re-trigger the observer; new swatches still arrive
      // via childList, and an in-place colour change via data-color/class.
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
    }
  },

  detachFromAllReaders() {
    // WeakMap isn't iterable; rely on readers closing to GC their observers,
    // but disconnect any we can still reach.
    try {
      const readers = (Zotero.Reader && Zotero.Reader._readers) || [];
      for (const reader of readers) {
        const doc = this._readerDocument(reader);
        const obs = doc && this._observers.get(doc);
        if (obs) {
          obs.disconnect();
          this._observers.delete(doc);
        }
      }
    } catch (e) {
      this.log("detach failed: " + e);
    }
  },

  refreshAllReaders() {
    const readers = (Zotero.Reader && Zotero.Reader._readers) || [];
    for (const reader of readers) {
      const doc = this._readerDocument(reader);
      if (doc) this.applyLabels(doc);
    }
  },

  /**
   * Resolve the DOM document that holds the reader's colour UI.
   * ⚠️ VERIFY: the reader renders inside an iframe. The internal handle has
   *    historically been reader._iframeWindow / reader._internalReader. Use
   *    debugDumpReaderColorElements() to confirm where the swatches live.
   */
  _readerDocument(reader) {
    if (!reader) return null;
    // The reader UI lives in an iframe; the handle has shifted across versions,
    // so try the known candidates and take the first that yields a usable
    // document. The colour toolbar/menu live in this primary reader document
    // (the nested PDF-view iframe is a separate document we don't need here).
    // ⚠️ Confirm the winning handle on 8/9 via debugDumpReaderColorElements().
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
   * fixed in one place once confirmed against the live reader.
   * ⚠️ THESE ARE EDUCATED GUESSES — verify and replace.
   */
  CONFIG: {
    // Elements that represent a single colour choice. The reader builds its
    // colour picker (annotating toolbar popup AND the right-click "change
    // colour" menu) as a row of <button> swatches, each with the colour name
    // in `title` and an inner element/icon carrying the colour. We match
    // broadly; the per-node colour read + known-palette guard below keep us
    // from touching any non-colour button this happens to catch.
    // ⚠️ Confirm against a live reader via debugDumpReaderColorElements().
    swatchSelectors: [
      "[data-color]",
      ".color-picker button",
      ".colors button",
      "button.toolbar-button[title]",
      "[role='option'][title]",
    ],
    // How to read a swatch's colour, tried in order. STRUCTURAL sources only —
    // never the label we overwrite — so relabelling stays idempotent.
    colorReaders: [
      (el) => el.getAttribute && el.getAttribute("data-color"),
      (el) => {
        const filled = el.querySelector && el.querySelector("[fill]");
        return filled && filled.getAttribute("fill");
      },
      (el) => {
        const inner = el.querySelector && el.querySelector("*");
        return inner && inner.style && inner.style.backgroundColor;
      },
      (el) => el.style && el.style.backgroundColor,
    ],
    // Where to write the custom label. Set both so the hover tooltip and the
    // accessibility name match.
    writeTargets: ["title", "aria-label"],
  },

  applyLabels(doc) {
    if (!this.isEnabled()) return;
    try {
      const selector = this.CONFIG.swatchSelectors.join(", ");
      const nodes = doc.querySelectorAll(selector);
      for (const el of nodes) {
        // Resolve the swatch's colour once and cache it on the node. Later
        // observer passes read the cache, so overwriting the visible label can
        // never change which colour the swatch maps to.
        let hex = el.dataset ? el.dataset.aclHex : null;
        if (!hex) {
          hex = this._normaliseColor(this._readColor(el));
          if (hex && el.dataset) el.dataset.aclHex = hex;
        }
        if (!hex || !this._isKnownColor(hex)) continue;
        const label = this.labelFor(hex);
        if (!label) continue;
        for (const attr of this.CONFIG.writeTargets) {
          // Skip no-op writes so we don't generate pointless mutations.
          if (el.getAttribute(attr) !== label) el.setAttribute(attr, label);
        }
      }
    } catch (e) {
      this.log("applyLabels error: " + e);
    }
  },

  _readColor(el) {
    for (const fn of this.CONFIG.colorReaders) {
      try {
        const v = fn(el);
        if (v) return v;
      } catch (e) {
        /* try next */
      }
    }
    return null;
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
