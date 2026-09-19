---
name: "Wejhaty — Travel Briefing Folio"
description: "Arabic-first travel decisions presented as a calm editorial briefing."
colors:
  light-ink: "#17243a"
  light-ink-secondary: "#24344d"
  light-paper: "#f2eee5"
  light-paper-muted: "#e7e0d4"
  light-paper-raised: "#faf8f3"
  light-terracotta: "#a94828"
  light-terracotta-bright: "#cf6a42"
  light-teal: "#246b68"
  light-teal-bright: "#368c87"
  light-text: "#1d293b"
  light-muted: "#626a78"
  light-surface: "#fffdf8"
  light-line: "rgba(23, 36, 58, 0.15)"
  light-danger: "#b3492f"
  dark-ink: "#f0ede6"
  dark-ink-secondary: "#d8dce3"
  dark-paper: "#111925"
  dark-paper-muted: "#1a2533"
  dark-paper-raised: "#202c3b"
  dark-terracotta: "#e07851"
  dark-terracotta-bright: "#ec946f"
  dark-teal: "#69bbb4"
  dark-teal-bright: "#82d0ca"
  dark-text: "#f0ede6"
  dark-muted: "#aeb7c3"
  dark-surface: "#182331"
  dark-line: "rgba(239, 235, 225, 0.17)"
  dark-danger: "#f08a72"
  dark-solid: "#0b121d"
  fixed-white: "#ffffff"
typography:
  display-ltr:
    fontFamily: "Fraunces, serif"
    fontWeight: 600
    lineHeight: 0.98
    letterSpacing: "-0.045em"
  display-rtl:
    fontFamily: "Cairo, sans-serif"
    fontWeight: 700
    lineHeight: 1.16
    letterSpacing: "0"
  body-ltr:
    fontFamily: "Inter, sans-serif"
    fontWeight: 400
  body-rtl:
    fontFamily: "Cairo, sans-serif"
    fontWeight: 400
  label:
    fontFamily: "inherit"
    fontSize: "0.78rem"
    fontWeight: 700
    lineHeight: 1.2
rounded:
  folio: "2px"
  chip: "4px"
  control: "5px"
  small: "7px"
  button: "8px"
  medium: "9px"
  large: "12px"
  circle: "100px"
spacing:
  chip-y: "5px"
  chip-x: "10px"
  field-y: "11px"
  field-x: "14px"
  card: "24px"
  container-mobile: "18px"
  container: "24px"
  section-min: "56px"
  section-max: "92px"
components:
  button-primary:
    backgroundColor: "{colors.light-ink}"
    textColor: "{colors.light-surface}"
    rounded: "{rounded.button}"
    padding: "13px 24px"
  button-accent:
    backgroundColor: "{colors.light-terracotta}"
    textColor: "{colors.fixed-white}"
    rounded: "{rounded.button}"
    padding: "13px 24px"
  button-ghost:
    backgroundColor: "color-mix(in srgb, #fffdf8 42%, transparent)"
    textColor: "{colors.light-ink}"
    rounded: "{rounded.button}"
    padding: "13px 24px"
  field:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-text}"
    rounded: "{rounded.control}"
    padding: "11px 14px"
    height: "44px"
  destination-card:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-text}"
    rounded: "{rounded.folio}"
  chip:
    backgroundColor: "{colors.light-paper-raised}"
    textColor: "{colors.light-ink-secondary}"
    rounded: "{rounded.chip}"
    padding: "5px 10px"
---

# Design System: وجهتي / Wejhaty

## Overview

**Creative North Star: “Travel Briefing Folio / ملف الرحلة التحريري”**

Wejhaty feels like a prepared travel dossier: warm ruled paper in light mode, deep navy paper in dark mode, strong destination photography, large editorial headings, numbered folio details, and compact evidence blocks. The visual voice is informed, calm, and practical. It supports decision-making without turning recommendation data into a dashboard aesthetic.

**Key characteristics:**

- Open layouts use hairline rules, generous section spacing, and restrained low-radius geometry.
- Terracotta marks action, selection, numbering, and emphasis; teal carries secondary data and positive measures.
- Destination imagery supplies energy while text, scores, sources, and caveats remain easy to inspect.
- Light and dark themes share the same hierarchy; theme changes token values rather than page composition.
- Arabic is the default authored experience, with English, RTL, and LTR treated as equal layouts.

## Colors

The palette combines parchment and navy with terracotta and teal accents. The frontmatter values are normative; each light role has a dark counterpart.

- **Paper roles:** `paper` is the page canvas, `paper-muted` separates quiet regions, and `paper-raised` supports subtle hover and track states.
- **Ink roles:** `ink` anchors headings, primary buttons, dark feature panels, disclaimers, and the footer; `ink-secondary` supports secondary navigation text.
- **Surface role:** `surface` is the field, listbox, card, and caption plane. In dark mode it becomes a raised navy, not literal white.
- **Terracotta role:** primary action, selected state, focus, progress, folio numbering, and the four-pixel footer rule.
- **Teal role:** measures, suitability bars, secondary status, and field hover/focus borders.
- **Line role:** quiet structural separators. Prefer one-pixel rules and divided grids over boxed decoration.
- **Danger role:** validation and submission failures only; dark forms use the lifted dark danger value.

**The Sparse Accent Rule.** Terracotta identifies decisions and state. Do not spread it across large backgrounds or ordinary body copy.

## Typography

English uses Fraunces for display and Inter for body text. Arabic uses Cairo for both roles, with weight and leading creating hierarchy. The brand name follows the same language-aware switch.

- **Hero display:** `clamp(2.8rem, 6vw, 5.6rem)` on Home; English uses tight `0.98` leading and `-0.045em` tracking, while Arabic uses `1.16` leading and no negative tracking.
- **Page display:** `clamp(2.6rem, 6vw, 5rem)` for route and destination titles; section headings use `clamp(2rem, 4vw, 3.4rem)`.
- **Question title:** `clamp(1.45rem, 3vw, 2.25rem)`, capped near `26ch` to keep prompts scannable.
- **Body:** inherited Inter or Cairo, commonly `0.88–1.18rem`, with muted explanatory copy around `1.55–1.65` line-height.
- **Labels:** compact, bold, and usually muted at `0.74–0.85rem`; sentence case remains the default.
- **Visible numbers:** always render with Latin digits in Arabic and English.

**The Script-Specific Display Rule.** Never apply Fraunces, tight English tracking, or English leading to Arabic display text.

## Layout

The global container is `1240px` wide with `24px` inline padding, reduced to `18px` at `640px` and below. Sections use fluid vertical padding from `56px` to `92px`. The page canvas carries a subtle horizontal rule every `44px`.

- **Desktop:** Home is an asymmetric two-column editorial spread. Destination pages use a `0.72fr / 1.6fr` information grid. Results feature a large two-column top pick followed by a two-column card grid. Explore uses a full-width filter rule followed by a three-column destination grid.
- **At `980px`:** Home and destination grids become one column. Location, destination-rating, and result-rating layouts simplify to two columns.
- **At `860px`:** the desktop nav links hide and the hamburger/mobile menu takes over; inherited destination and Explore grids also begin collapsing.
- **At `760px`:** editorial rows stack, purpose and step grids become one column, top-pick content stacks, and rating/location sections become block layouts.
- **At `640px`:** container padding tightens, results and suitability internals reduce to phone layouts.
- **At `520px`:** Home statistics become a two-column grid, fields/toolbars are single column, and destination images reduce from `220px` to `205px` high.
- Use CSS logical properties for inline spacing, rules, overlays, and alignment. RTL must mirror without direction-specific JavaScript.

## Elevation & Depth

The system is flat by default. Most sections and cards use background tone, one-pixel rules, image contrast, and editorial overlap instead of shadows. The single ambient shadow is `0 20px 48px -34px rgba(23, 36, 58, 0.55)` and is reserved for the Home image caption, quiz sheet, open listbox, and destination-card hover.

Home’s folio image gets depth from a thin offset terracotta frame and an overlapping caption. The sticky navigation uses translucent paper plus `blur(16px)` and slight saturation. Destination heroes use a dark bottom gradient so fixed-white titles remain legible over photography.

**The Flat-at-Rest Rule.** Destination cards, detail sections, filters, and ordinary content planes remain shadowless until state or overlap needs depth.

## Shapes

The dominant silhouette is a near-square folio edge: `2px` for imagery, feature panels, destination cards, disclaimers, and rating containers. Chips use `4px`; fields and options use `5px`; buttons use `8px`. Circular geometry is limited to the brand mark, purpose icons, radio indicators, stars’ focus shape, and hero navigation controls.

Use full pills only where inherited interaction semantics require them, such as theme selection and progress/suitability tracks. Do not restore the former large rounded-card language to Phase 17 surfaces.

## Components

### Navigation

Keep the `68px` sticky translucent bar. Desktop links are plain text with a terracotta bottom rule on hover. Language, theme, and the primary CTA stay grouped opposite the brand. At mobile widths, preserve the `42px` hamburger and ruled vertical menu.

### Home

Pair a maximum-`12ch` editorial headline (`13ch` in RTL) with a tall destination image (`min(610px, 68vh)`, minimum `460px`). The image is slightly desaturated, framed by the offset rule, indexed with a large folio number, and captioned by an overlapping surface. Statistics and process steps are divided by rules. Purpose choices form a two-column divided list and collapse to one column.

### Quiz

Use a `3px` terracotta progress line and one raised question sheet with a dark top rule. Options have at least `64px` height. Selection uses a subtle terracotta wash plus a `3px` inset rule on the logical start edge; the rule mirrors in RTL. Preserve the checkpoint, back action, passport step, validation, and bounded waiting status patterns.

### Results

Lead with a solid ink feature panel and a large photographic block. Overlay match percentage and label at the image’s logical end. Secondary matches use flat `2px` image cards with `220px` crops and lift only `2px` on hover. Keep reasons, evidence chips, uncertainty copy, visa state, and rerun/explore actions visible.

### Explore

Use a large page title, optional location-personalization region, surprise action, then a filter toolbar bounded by horizontal rules. Search and custom listboxes share the same field language. The custom listbox keeps keyboard navigation, search for long sets, selected/active states, max-height behavior, and drop-up behavior near a viewport edge.

### Destination

Use a full-width photographic hero (`clamp(340px, 45vw, 560px)`) with dark gradient, fixed-white text, match badge, and `44px` translucent edge navigation. Below it, keep the narrow facts rail and wider editorial content grid. Detail content is separated by top rules; paired overview sections use divided cells rather than standalone floating cards.

### Suitable for

Show the highest-scoring purpose first, then disclose the remaining ranked purposes with a minimum-`44px` Show more/less control. Each row uses a score, teal bar, confidence/update metadata, and an optional native details disclosure for methodology, components, missing data, and sources. Insufficient data remains visibly distinct and never receives a fabricated score.

### Buttons, fields, and chips

- Primary buttons use ink; accent buttons use terracotta; ghost buttons use a translucent surface and line border. All are bold, compact, and move upward only `1px` on hover.
- Fields use a `1.5px` line, surface background, `5px` corners, and inherited language font. Focus shifts the border to teal; custom listboxes also receive a visible terracotta focus ring.
- Chips are compact evidence labels with `4px` corners. Selected interactive chips use a terracotta border and wash. Do not use chips as decoration or hide long evidence inside them.

### Rating and feedback forms

Results and destination ratings share the same star, comment, validation, verification, and submit patterns. On desktop, text/stars, textarea, and submit form a compact three-column row; at `980px` they reduce to two columns and at `760px` they stack. Stars are `44px` minimum targets, muted when unselected, terracotta when selected, and keyboard-operable as a radiogroup. Textareas have an `88px` minimum height and remain vertically resizable.

### Images

Use catalog-backed destination imagery with authored Arabic and English alt text. Home loads its featured image eagerly; repeated destination cards lazy-load and decode asynchronously. Preserve the stored crop position, `object-fit: cover`, slight Phase 17 desaturation, photo attribution, and honest fallback behavior. Imagery must never imply unsupported facts.

### Accessibility and motion

Preserve semantic buttons, links, headings, regions, labels, native details, live status/error messaging, and the custom listbox’s ARIA keyboard contract. The global focus indicator is a `2.5px` terracotta outline with `3px` offset. Maintain `44px` touch targets for hero navigation, select triggers, suitability disclosure, and rating stars.

Transitions are short (`140–180ms`) and limited to state feedback, small lifts, chevrons, and entry fades. `prefers-reduced-motion: reduce` collapses animation and transition duration, disables decorative reel motion, and restores automatic scrolling.

## Do's and Don'ts

### Do

- **Do** preserve Arabic-first copy, English parity, logical-property mirroring, and script-specific typography.
- **Do** distinguish verified, sourced, estimated, partial, missing, and unavailable information in visible UI.
- **Do** keep recommendation reasons and rating/form states clear in light and dark themes.
- **Do** use Latin digits for every visible number in both languages.
- **Do** treat location and passport country as separate, optional inputs with clear value and recovery states.

### Don't

- **Don't** alter Phase 14 scoring, weights, deterministic question behavior, or recommendation authority through visual work.
- **Don't** restore an AI interview or AI-generated explanation without an explicit product decision.
- **Don't** fabricate flight, hotel, accommodation, visa, budget, suitability, testimonial, or customer-count claims.
- **Don't** hide uncertainty, missing coverage, sources, or provider/check-date context to make a screen look cleaner.
- **Don't** send precise coordinates outside their in-memory location flow or infer sensitive traits from nationality, language, locale, or location.
- **Don't** collect a passport number, conflate passport country with browser location, or visually imply an inactive provider or Turnstile integration is active.
- **Don't** reintroduce Israel (`IL`/`ISR`) into any catalog or recommendation surface; Monaco (`MC`/`MCO`) remains valid.
- **Don't** replace the folio’s ruled structure with generic rounded floating cards, gratuitous gradients, heavy shadows, or decorative accent color.
