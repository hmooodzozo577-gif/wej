# تِلقاء · TILQAA — Logo files (v2)

Approved concept: **A · the direction needle** — the two dots of تِ drawn as a compass needle
(saffron half = the bearing), with the custom rounded-Kufi wordmark (option 1).

Everything is true vector (custom-drawn strokes and shapes — no fonts, no embedded rasters).
PNG files are transparent exports of the same artwork.

## Which file where
| Place | File | Size |
|---|---|---|
| Website header (desktop) | `svg/tilqaa-horizontal--color.svg` | 36–44 px tall |
| Header on mobile / narrow nav | `svg/tilqaa-compact--color.svg` | 28–32 px; under 360 px wide use the symbol |
| Footer (dark #072523) | `svg/tilqaa-horizontal--color-on-dark.svg` | 32–40 px |
| Icon in UI ≥ 32 px | `svg/tilqaa-symbol--color.svg` | |
| Icon in UI < 32 px | `svg/tilqaa-symbol-small--color.svg` (heavier small-size cut) | 16–31 px |
| Favicon | `favicon/favicon.svg` + `favicon/favicon.ico` (16/32/48) | |
| iOS home screen | `favicon/apple-touch-icon.png` (180) | |
| Android / PWA | `favicon/favicon-192.png`, `favicon/app-icon-512.png`, `favicon/app-icon-maskable-512.png` | |
| English-only pages | `svg/tilqaa-latin--color.svg` | |
| Presentations, splash | `svg/tilqaa-primary-arabic--color.svg`, `svg/tilqaa-bilingual--color.svg` | |
| One-colour print, stamps, embossing | `svg/*--black.svg` / `svg/*--white.svg` (glyph knocked out = a true single ink) | |

```html
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#0E3F3D">
```

React: `TilqaaLogo.jsx` (React only, no other dependencies)
```jsx
<TilqaaLogo variant="horizontal" height={40} />                 // header, light
<TilqaaLogo variant="horizontal" tone="onDark" height={36} />   // footer, dark
<TilqaaLogo variant="symbolSmall" tone="mono" height={20} />    // inherits CSS color
```
Variants: horizontal · compact · primary · bilingual · latin · symbol · symbolSmall · wordmarkArabic · wordmarkLatin.

## Colours
| Name | HEX | RGB | Use |
|---|---|---|---|
| Oasis Ink | #0E3F3D | 14 63 61 | primary — letters, symbol tile, text |
| Saffron | #C77524 | 199 117 36 | accent — the needle's bearing half only; not for small text |
| Sand | #F5EFE4 | 245 239 228 | light background; letter inside the tile |
| Night Oasis | #072523 | 7 37 35 | dark background, footer |

Saffron was refined from #D9822B to #C77524 so the needle keeps ≥ 3:1 contrast on both the Ink tile (3.3:1)
and the Sand tile used on dark backgrounds (3.1:1). Ink on Sand: 10.2:1 · Sand on Night: 14.1:1.
Meaning never depends on colour: in one colour the needle still reads by shape.

## Typography (website)
The logo lettering is custom — never retype the logo in a font.
- Arabic display / headlines: **Reem Kufi** 500–700 (geometric Kufi, same family feel as the wordmark)
- UI and body, Arabic + Latin: **Readex Pro** 300–600 (its diamond dots echo the needle)
Both are SIL OFL (free for commercial use), on Google Fonts.

## Clear space & minimum size
x = diameter of the ق loop ≈ ⅓ of the horizontal/compact logo height (¼ of the tile for the symbol alone).
Keep x free on all sides (see `guides/clear-space.svg`).
Minimums: horizontal 32 px / 12 mm · compact 28 px / 10 mm · primary stacked 72 px / 24 mm ·
Arabic wordmark 22 px / 8 mm · symbol 16 px (use the small cut below 32 px).

## Don't
Retype the logo in a font · remove the kasra · stretch, rotate or add effects · recolour the needle outside the palette ·
place the bare تِ glyph next to the word without its tile.

## Source
`source/` regenerates every file: `python3 final_build.py && python3 export_png.py && node render.js jobs2.json && python3 make_react2.py` (render.js needs Node + Playwright).
