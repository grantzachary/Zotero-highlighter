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
