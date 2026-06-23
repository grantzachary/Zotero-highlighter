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

  // Register the preferences pane (Zotero 7+ API). Guard it — both a synchronous
  // throw and a rejected promise — so a prefs-pane problem can never prevent the
  // reader relabel below from attaching.
  try {
    Promise.resolve(
      Zotero.PreferencePanes.register({
        pluginID: id,
        src: rootURI + "content/preferences.xhtml",
        scripts: [rootURI + "content/preferences.js"],
        label: "Colour Labels",
      })
    ).catch((e) =>
      Zotero.debug("[Annotation Colour Labels] prefs pane registration rejected: " + e)
    );
  } catch (e) {
    Zotero.debug("[Annotation Colour Labels] prefs pane registration threw: " + e);
  }

  // Attach to any readers already open.
  ACL.attachToAllWindows();

  // Pick up readers opened later. Confirmed on Zotero 9.0.4: 'tab' add/select
  // events fire when a PDF/EPUB reader tab opens.
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

// Main-window hooks. The library item pane (annotation rows) lives here, so
// (re)attach when a main window loads.
function onMainWindowLoad({ window }) {
  try {
    if (Zotero.AnnotationColourLabels) Zotero.AnnotationColourLabels.attachToMainWindow();
  } catch (e) {}
}
function onMainWindowUnload({ window }) {}
