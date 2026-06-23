# Annotation Colour Labels (Zotero)

Rename the highlight colours in the Zotero reader so they mean something to
**you** — e.g. *Yellow → Key finding*, *Blue → Method*, *Green → Follow-up*.
The names show when you hover a colour while annotating.

It is **display-only**: it never changes your annotations, your library, or any
stored data. It only relabels what you see.

## ⬇️ Download

**[Download the latest `.xpi`](https://github.com/grantzachary/Zotero-highlighter/releases/latest/download/annotation-colour-labels.xpi)**
— then in Zotero: **Tools → Plugins → ⚙ → Install Plugin From File**, pick the
`.xpi`, and configure under **Settings → Colour Labels**.

> **Status: working (v0.1.0).** Verified end-to-end on Zotero **9.0.4** — the
> Settings pane lists all eight colours, custom names save, and they appear in
> the reader's colour picker, the annotation sidebar, and the library item pane
> (display-only — your annotations and data are never changed).

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
   plugin id (see `manifest.json`), e.g. `annotation-colour-labels@YOUR_DOMAIN`.
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
zip -r -FS annotation-colour-labels.xpi . \
  -x '.git/*' '.github/*' 'updates.json' '*.zip' '*.xpi' '.DS_Store'
```

## Distribution & auto-updates

The manifest's `update_url` points at [`updates.json`](./updates.json) (served
raw from `main`). Zotero polls it and offers in-app updates. Each version's
`.xpi` is attached to a GitHub **Release** tagged `vX.Y.Z`, which `updates.json`
links to.

### Releasing a new version

1. Bump `version` in **both** `manifest.json` and `updates.json` (keep them in
   sync), and set `updates.json`'s `update_link` to the new tag's `.xpi`.
2. Rebuild the `.xpi` (above).
3. Create a GitHub Release tagged `vX.Y.Z` and upload the `.xpi` as an asset
   named `annotation-colour-labels.xpi` (so the `update_link` resolves).
4. Commit & push `manifest.json` + `updates.json`. Installed copies pick up the
   update on Zotero's next check.

The plugin **id** (`annotation-colour-labels@grantzachary.github.io`) is
permanent — never change it once released, or auto-updates break.

## Licence

MIT — see [`LICENSE`](./LICENSE).
