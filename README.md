# Annotation Colour Labels (Zotero)

Rename the highlight colours in the Zotero reader so they mean something to
**you** — e.g. *Yellow → Key finding*, *Blue → Method*, *Green → Follow-up*.
The names show when you hover a colour while annotating.

It is **display-only**: it never changes your annotations, your library, or any
stored data. It only relabels what you see.

> **Status: working (v0.1.0).** Verified end-to-end on Zotero **9.0.4** —
> the Settings pane lists all eight colours, custom names save, and they
> appear as hover tooltips on the reader's colour swatches (relabelled live
> via a MutationObserver, display-only). Confirm on 7/8 before a wide release.

Why this exists: relabelling highlight colours has been one of the most-
requested Zotero features for years, and the older community plugins broke when
Zotero moved to versions 8 and 9. This is a fresh, current-version take —
public so anyone can use it.

## Supported versions

Zotero **7, 8, and 9** (`strict_min_version` 7.0, `strict_max_version` 9.0.*).
When a new major Zotero version lands, bump `strict_max_version` in
`manifest.json`, test, and re-release.

## Install (for users)

Once a release `.xpi` exists:

1. Download the `.xpi` from the Releases page (don't unzip it).
2. In Zotero: **Tools → Plugins → gear icon → Install Plugin From File**.
3. Pick the `.xpi`, then restart if prompted.
4. Configure names under **Settings → Colour Labels**.

## Develop

No build step — this is a plain bootstrapped plugin.

**Run from source (with live reloading of your edits):**

1. Find your Zotero *profile* directory (Help → Debug Output Logging → "Profile
   Directory" — or Tools → Developer).
2. In `<profile>/extensions/`, create a text file named exactly after the
   plugin id (see `manifest.json`): `annotation-colour-labels@grantzachary.github.io`.
3. Put **one line** in that file: the absolute path to this project folder
   (the folder containing `manifest.json`).
4. In `<profile>/prefs.js`, delete the lines containing
   `extensions.lastAppBuildId` and `extensions.lastAppVersion`.
5. Restart Zotero. After code changes, restart Zotero with the `-purgecaches`
   flag to force a fresh read.

Use a **separate Zotero profile** for development so your real library is safe.

**Quick testing:** Tools → Developer → Run JavaScript lets you poke the API,
e.g. `Zotero.AnnotationColourLabels.debugDumpReaderColorElements()`.

## Build the `.xpi`

The `.xpi` is just a zip of this folder with `manifest.json` at the root:

```bash
# from the project root (the folder containing manifest.json)
zip -r -FS ../annotation-colour-labels.xpi . \
  -x '.git/*' '.github/*' 'CLAUDE.md' '*.zip' '.DS_Store'
```

## Before you publish

The `manifest.json` identifiers are filled in:

- author **Grant Freeman**
- homepage / update_url under **github.com/grantzachary/Zotero-highlighter**
- id **`annotation-colour-labels@grantzachary.github.io`** — this is permanent;
  never change it once a release ships, or auto-updates break.

For auto-updates, publish an `updates.json` at the `update_url` listing the
version, the `update_link` to the released `.xpi`, and
`applications.zotero.strict_min_version` (see `CLAUDE.md` → Package & release).

## Licence

MIT — see [`LICENSE`](./LICENSE).
