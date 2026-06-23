# Annotation Colour Labels (Zotero)

Rename the highlight colours in the Zotero reader so they mean something to
**you** — e.g. *Yellow → Key finding*, *Blue → Method*, *Green → Follow-up*.
The names show when you hover a colour while annotating.

It is **display-only**: it never changes your annotations, your library, or any
stored data. It only relabels what you see.

> **Status: early scaffold (v0.1.0).** The plugin structure, preferences pane,
> and storage are in place. The one remaining piece — hooking the reader's
> colour UI on Zotero 8/9 — is wired up and ready to be finalised. See
> [`CLAUDE.md`](./CLAUDE.md) for the exact step to complete it.

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
cd zotero-annotation-colour-labels
zip -r -FS ../annotation-colour-labels.xpi . -x '.git/*' '.github/*' 'CLAUDE.md'
```

## Before you publish

Replace the placeholders in `manifest.json`:

- `YOUR NAME` → your name
- `YOUR_USERNAME` → your GitHub username
- `YOUR_DOMAIN` → any stable id suffix you control (e.g. your GitHub handle);
  the id just has to be unique and never change once released.

## Licence

MIT — see [`LICENSE`](./LICENSE).
