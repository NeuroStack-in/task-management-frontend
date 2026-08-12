# Sample Figma file — WorkPulse

Two ways to get this design into Figma. Both use the shipped **Meridian (Slate & Teal)** light
palette from [`src/app/globals.css`](../../src/app/globals.css) (`[data-palette="meridian"]`).

There is deliberately no `.fig` file here: that format is proprietary and undocumented, and only
Figma itself can write a valid one. These are the two import paths Figma actually supports.

## Option A — plugin script (recommended)

Produces a **real** Figma file: editable auto-layout frames, component sets with variant
properties, and published local styles. This is the one to use if anyone will actually design
against it.

1. Figma desktop app → **Plugins → Development → Import plugin from manifest…**
2. Pick [`plugin/manifest.json`](plugin/manifest.json).
3. Open any file → **Plugins → Development → WorkPulse — Sample File Generator**.

You get, on the current page:

| Frame | Contents |
| --- | --- |
| `01 · Foundations` | 16 colour swatches, the 9-step type scale, radius + elevation specs |
| `02 · Components` | Button and Status badge **component sets**, form fields, stat cards, table rows |
| `03 · Dashboard — 1440×1024` | A full app screen: sidebar, top bar, stat row, stacked bar chart, AI insight panel, people table |

Plus **28 paint styles** (`Brand/`, `Surface/`, `Text/`, `Status/`, `Border/`, `Chart/`) and
**9 text styles** (`Display/32` … `Overline/11`), all published locally so they show up in the
right-hand panel and can be applied to new layers.

Re-running the plugin replaces its own three frames rather than stacking duplicates, so it is
safe to iterate: edit `plugin/code.js`, hit **Plugins → Development → Run last plugin**
(<kbd>Ctrl/Cmd</kbd>+<kbd>Alt</kbd>+<kbd>P</kbd>).

Requires the **Inter** font (Regular / Medium / Semi Bold / Bold). It ships with Figma, so this
is only a problem if Inter has been removed locally.

## Option B — SVG import (zero setup)

[`workpulse-sample.svg`](workpulse-sample.svg) — drag it onto a Figma canvas.

Every `<g id="…">` arrives as a named group and every `<text>` as a live, editable text layer, so
it is genuinely useful for tracing over. What it *cannot* carry: auto-layout, components, variant
properties, and shared styles — SVG has no concept of any of those. Use this to look at the
design, use Option A to work on it.

## Changing the palette

Both files hardcode the Meridian light values. To retheme:

- **Plugin** — edit the `T` object at the top of `plugin/code.js` and re-run. One place, ~40 values.
- **SVG** — find/replace the hex values; there is no indirection.

`globals.css` defines 13 palettes — `meridian`, `fireopal`, `teal`, `violet`, `sapphire`, `dusk`,
`iron`, `corporate`, `evergreen`, `burgundy`, `cobalt`, `navy`, `petrol` — plus the legacy
Graphite & Indigo `:root`, each with a `.dark` variant. Copying another one into `T` is a straight
paste of that block's values.

## Content

The people, projects, and metrics are invented sample data — they are not seeded from
`src/data/` and do not correspond to any real record.
