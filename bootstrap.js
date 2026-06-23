/* ============================================================================
 * Annotation Colour Labels — bootstrap entry point (Zotero 7/8/9)
 * ----------------------------------------------------------------------------
 * Bootstrapped plugin: no build step. The .xpi is just a zip of this folder
 * with manifest.json at the root. Zotero calls the lifecycle functions below.
 *
 * Docs: https://www.zotero.org/support/dev/zotero_7_for_developers
 * ========================================================================== */

var ACL; // shorthand alias for Zotero.AnnotationColourLabels
var notifierID;

function install() {}

async function startup({ id, version, rootURI }) {
  // Load the main module — it defines Zotero.AnnotationColourLabels.
  Services.scriptloader.loadSubScript(rootURI + "content/colourLabels.js");
  ACL = Zotero.AnnotationColourLabels;
  ACL.init({ id, version, rootURI });

  // Register the preferences pane (Zotero 7+ API).
  // ⚠️ VERIFY this still registers cleanly on 8/9 (prefs-pane API is expected
  //    to be stable, but confirm the pane appears under Settings).
  Zotero.PreferencePanes.register({
    pluginID: id,
    src: rootURI + "content/preferences.xhtml",
    scripts: [rootURI + "content/preferences.js"],
    label: "Colour Labels",
  });

  // Attach to any readers already open.
  ACL.attachToAllWindows();

  // Pick up readers opened later. Tab events fire when a PDF/EPUB tab opens.
  // ⚠️ VERIFY the notifier type: 'tab' has historically covered reader tabs.
  try {
    notifierID = Zotero.Notifier.registerObserver(
      {
        notify(event, type, ids, extraData) {
          if (event === "add" || event === "select") {
            ACL.attachToAllWindows();
          }
        },
      },
      ["tab"],
      "annotation-colour-labels"
    );
  } catch (e) {
    Zotero.debug("[Annotation Colour Labels] notifier registration failed: " + e);
  }
}

function shutdown() {
  try {
    if (notifierID) Zotero.Notifier.unregisterObserver(notifierID);
  } catch (e) {}
  try {
    if (Zotero.AnnotationColourLabels) Zotero.AnnotationColourLabels.shutdown();
  } catch (e) {}
  ACL = undefined;
}

function uninstall() {}

// Main-window hooks — not needed for this plugin (all UI lives in the reader),
// but kept as no-ops so the lifecycle contract is complete and obvious.
function onMainWindowLoad({ window }) {}
function onMainWindowUnload({ window }) {}
