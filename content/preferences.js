/* Preferences pane logic for Annotation Colour Labels.
 * Loaded via the `scripts` array in PreferencePanes.register, so it runs in
 * the Settings window. `Zotero` is the app singleton and is available here, so
 * we reuse Zotero.AnnotationColourLabels rather than duplicating state.
 *
 * Confirmed on Zotero 9.0.4: `Zotero.AnnotationColourLabels` is reachable from
 * the prefs window (the pane renders all eight colour rows and live-refreshes
 * open readers). If a future version ever isolates it, load colourLabels.js
 * here too (add it to the `scripts` array in bootstrap.js).
 */

{
  const ACL = Zotero.AnnotationColourLabels;

  const buildRows = () => {
    const container = document.getElementById("acl-rows");
    if (!container || !ACL) return;
    container.textContent = "";

    const current = ACL.getCustomNames();

    for (const colour of ACL.COLORS) {
      const row = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
      row.style.cssText =
        "display:flex; align-items:center; gap:0.75em; margin:0.35em 0;";

      const swatch = document.createElementNS("http://www.w3.org/1999/xhtml", "span");
      swatch.style.cssText =
        "width:1.1em; height:1.1em; border-radius:3px; flex:0 0 auto;" +
        "border:1px solid rgba(0,0,0,0.25); background:" + colour.hex + ";";

      const def = document.createElementNS("http://www.w3.org/1999/xhtml", "span");
      def.textContent = colour.name;
      def.style.cssText = "width:5.5em; flex:0 0 auto; opacity:0.7;";

      const input = document.createElementNS("http://www.w3.org/1999/xhtml", "input");
      input.type = "text";
      input.placeholder = colour.name;
      input.value = current[colour.hex.toLowerCase()] || "";
      input.style.cssText = "flex:1 1 auto; padding:0.25em 0.4em;";
      input.dataset.hex = colour.hex.toLowerCase();
      input.addEventListener("input", save);

      row.appendChild(swatch);
      row.appendChild(def);
      row.appendChild(input);
      container.appendChild(row);
    }
  };

  const save = () => {
    if (!ACL) return;
    const map = {};
    for (const input of document.querySelectorAll("#acl-rows input[type='text']")) {
      const val = input.value.trim();
      if (val) map[input.dataset.hex] = val;
    }
    ACL.setCustomNames(map); // also refreshes open readers
  };

  // Wire a checkbox to a boolean pref, refreshing open readers on change.
  // (Both "command" and "change" are bound so it works whether the input
  // behaves as a XUL or an HTML control.)
  const wireToggle = (id, pref, initial) => {
    const box = document.getElementById(id);
    if (!box || !ACL) return;
    box.checked = initial;
    const onToggle = () => {
      Zotero.Prefs.set(pref, box.checked);
      ACL.refreshAllReaders();
    };
    box.addEventListener("command", onToggle);
    box.addEventListener("change", onToggle);
  };

  const wireToggles = () => {
    wireToggle("acl-enabled", ACL.PREF_ENABLED, ACL.isEnabled());
    wireToggle("acl-replace", ACL.PREF_REPLACE, ACL.shouldReplaceNames());
    wireToggle("acl-surface-picker", ACL.PREF_SURFACE_PICKER, ACL._surfaceOn(ACL.PREF_SURFACE_PICKER));
    wireToggle("acl-surface-sidebar", ACL.PREF_SURFACE_SIDEBAR, ACL._surfaceOn(ACL.PREF_SURFACE_SIDEBAR));
  };

  // The pane content may not be in the DOM the instant this script runs.
  const start = () => {
    if (!document.getElementById("acl-rows")) {
      setTimeout(start, 50);
      return;
    }
    wireToggles();
    buildRows();
  };
  start();
}
