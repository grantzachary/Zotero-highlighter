// Default preferences for Annotation Colour Labels.
// These live under the extensions.zotero.annotation-colour-labels.* branch.
//
// `names` stores a JSON object mapping a colour hex (lowercase) to the custom
// label the user wants shown. An empty object means "use Zotero's defaults".
//
// Example once the user has set things up:
//   {"#ffd400":"Key finding","#2ea8e5":"Method","#5fb236":"Follow-up"}

pref("extensions.zotero.annotation-colour-labels.names", "{}");

// When false, the plugin leaves Zotero's native labels untouched (a quick
// global off-switch the preferences pane can toggle).
pref("extensions.zotero.annotation-colour-labels.enabled", true);

// When true, the picker's visible colour name is replaced with the custom name
// (e.g. "Yellow" → "Key finding"). When false, the colour name stays visible
// and the custom name shows on hover only — friendlier for colour-blind users.
pref("extensions.zotero.annotation-colour-labels.replaceNames", true);

// "Apply in:" surface toggles — which parts of the UI get the custom names.
pref("extensions.zotero.annotation-colour-labels.surfacePicker", true);
pref("extensions.zotero.annotation-colour-labels.surfaceSidebar", true);
