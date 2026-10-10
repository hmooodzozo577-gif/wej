# Brand assets — تِلقاء / TILQAA

`tilqaa-v2/` holds the approved files from **TILQAA logo package v2**
(concept A, "the direction needle"; brand sheet `TILQAA-brand-sheet.pdf`).
Only the files the site uses are kept here; `tilqaa-v2/README.md` is the
package's own guide (sizes, clear space, colours, don'ts), copied verbatim.

| In this folder | Used for |
|---|---|
| `svg/tilqaa-horizontal--color*.svg` | header ≥ 861px (40 px), footer (34 px), sharing image |
| `svg/tilqaa-compact--color*.svg` | header 360–860px (32 px) |
| `svg/tilqaa-symbol-small--color*.svg` | header < 360px (32 px) |
| `svg/tilqaa-symbol--color*.svg` | «قصة الاسم» dialog (64 px) |
| `favicon/*` | copied byte for byte to `public/` by `scripts/generate-brand-assets.mjs` |
| `guides/clear-space.svg` | clear-space reference |

- `app/src/brand/TilqaaLogo.tsx` draws the same artwork inline (shapes
  copied from the package's `TilqaaLogo.jsx`, typed, four variants only);
  `TilqaaLogo.test.tsx` checks it shape for shape against these SVGs.
  `--color-on-dark` files differ from `--color` only in colour; the site
  switches with the `--tq-*` custom properties in `wejhaty.css`.
- `brandAssets.test.ts` checks the served icons are these files.
- Not in the repository (kept with the owner): the brand sheet, the PNG
  exports, the black/white single-ink cuts, the other variants and the
  package's `source/` generator.
- Fonts recommended by the package (Reem Kufi, Readex Pro) are **not**
  used: the site keeps its current type; the logo itself is drawn, never
  typed.
