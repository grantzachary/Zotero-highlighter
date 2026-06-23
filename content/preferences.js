/* Preferences pane logic for Annotation Colour Labels.
 * Loaded via the `scripts` array in PreferencePanes.register, so it runs in
 * the Settings window. `Zotero` is the app singleton and is available here, so
 * we reuse Zotero.AnnotationColourLabels rather than duplicating state.
 *
 * ⚠️ VERIFY: confirm `Zotero.AnnotationColourLabels` is reachable from the
 *    prefs window on 8/9. If scoping ever isolates it, load colourLabels.js
 *    here too (add it to the `scripts` array in bootstrap.js).
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

  const wireEnabled = () => {
    const box = document.getElementById("acl-enabled");
    if (!box || !ACL) return;
    box.checked = ACL.isEnabled();
    box.addEventListener("command", () => {
      Zotero.Prefs.set(ACL.PREF_ENABLED, box.checked);
      ACL.refreshAllReaders();
    });
    box.addEventListener("change", () => {
      Zotero.Prefs.set(ACL.PREF_ENABLED, box.checked);
      ACL.refreshAllReaders();
    });
  };

  // The pane content may not be in the DOM the instant this script runs.
  const start = () => {
    if (!document.getElementById("acl-rows")) {
      setTimeout(start, 50);
      return;
    }
    wireEnabled();
    buildRows();
  };
  start();
}
