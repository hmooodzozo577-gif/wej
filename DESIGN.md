---
name: "Wejhaty — Cinematic Compass Atlas"
description: "Arabic-first travel decisions guided by destination photography, compass cartography, and calm evidence-led UI."
colors:
  ink: "#17243a"
  ink-secondary: "#24344d"
  paper: "#f2eee5"
  paper-muted: "#e7e0d4"
  paper-raised: "#faf8f3"
  surface: "#fffdf8"
  text: "#1d293b"
  muted: "#626a78"
  line: "rgba(23, 36, 58, 0.15)"
  terracotta: "#a94828"
  terracotta-bright: "#cf6a42"
  teal: "#246b68"
  teal-bright: "#368c87"
  danger: "#b3492f"
  hero-navy: "#091827"
  hero-navy-raised: "#0b1b2a"
  wayfinding-orange: "#e66f43"
  wayfinding-orange-bright: "#ff956d"
  warm-white: "#fff9f3"
  dark-paper: "#111925"
  dark-paper-muted: "#1a2533"
  dark-paper-raised: "#202c3b"
  dark-surface: "#182331"
  dark-text: "#f0ede6"
  dark-muted: "#aeb7c3"
  dark-line: "rgba(239, 235, 225, 0.17)"
  dark-terracotta: "#e07851"
  dark-teal: "#69bbb4"
  dark-solid: "#0b121d"
typography:
  display-ltr:
    fontFamily: "Fraunces, Georgia, serif"
    fontWeight: 600
    lineHeight: 0.96
    letterSpacing: "-0.045em"
  display-rtl:
    fontFamily: "Cairo, Arial, sans-serif"
    fontWeight: 700
    lineHeight: 1.16
    letterSpacing: "0"
  body-ltr:
    fontFamily: "Inter, Arial, sans-serif"
    fontWeight: 400
  body-rtl:
    fontFamily: "Cairo, Arial, sans-serif"
    fontWeight: 400
  label:
    fontFamily: "inherit"
    fontSize: "0.78rem"
    fontWeight: 700
    lineHeight: 1.2
rounded:
  field: "5px"
  control: "7px"
  button: "8px"
  purpose-icon: "12px"
  badge: "14px"
  card: "16px"
  image: "18px"
  hero: "24px"
  circle: "50%"
spacing:
  field-block: "11px"
  field-inline: "14px"
  button-block: "13px"
  button-inline: "24px"
  card: "24px"
  gutter-mobile: "18px"
  gutter: "24px"
  section: "clamp(56px, 7vw, 92px)"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.button}"
    padding: "{spacing.button-block} {spacing.button-inline}"
  button-wayfinding:
    backgroundColor: "{colors.terracotta}"
    textColor: "{colors.warm-white}"
    rounded: "{rounded.button}"
    padding: "{spacing.button-block} {spacing.button-inline}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "{spacing.button-block} {spacing.button-inline}"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.field}"
    padding: "{spacing.field-block} {spacing.field-inline}"
    height: "44px"
  purpose-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
    padding: "18px 18px 16px"
  destination-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
---

# Design System: وجهتي / Wejhaty

## Overview

**Creative North Star: “Cinematic Compass Atlas / أطلس البوصلة السينمائي”**

Wejhaty turns travel discovery into a cinematic atlas rather than a generic catalog. A real destination photograph gives each journey a sense of place; an authored compass, fine route lines, deep ink navy, warm paper, and orange wayfinding express guidance. The product remains a practical decision tool, so evidence, uncertainty, and the deterministic recommendation method stay calm and readable.

The durable story is: see a real place, understand how Wejhaty helps, then choose a purpose. Home makes that story immediate through a session-stable catalog photograph, one promise, two actions, the compass, route details, and an in-frame destination badge. Destination detail uses a deliberate hybrid rhythm: a cinematic photographic opening establishes place, then a quiet editorial body turns facts and evidence into a readable travel brief. Other routes reuse the same world with less spectacle: photo-first destination surfaces, actionable choices, fine dividers, and compact information planes.

The visual world was selected as a code-led editorial travel atlas under seed `user-pinned-reference:e2c7b435-2026-09-20`. The finish contract remains binding: unreviewed and undocumented is unfinished, and every shipping raster carries provenance. Phase 17 received a `ship` finish-review verdict after its four requested fixes were resolved.

**Key Characteristics:**

- Verified destination photography supplies emotion and geographic specificity.
- Ink navy and warm paper establish trust; orange marks action and movement; teal carries supporting data.
- Compass cartography and route lines recur with restraint as the signature graphic language.
- Soft hero and card geometry supports photography while fine rules keep information editorial.
- Arabic is authored first, with equal English, RTL, LTR, light, dark, mobile, and desktop treatment.

**The Evidence Leads Rule.** Visual drama may invite exploration, but recommendation reasons, sources, missing coverage, and uncertainty remain easier to inspect than decoration.

## Colors

The palette moves between a warm paper reading environment and an ink-navy night atlas. The frontmatter is the normative source for exact values and theme counterparts.

### Primary

- **Atlas Ink:** anchors headings, the shell, primary buttons, feature panels, disclaimers, and dark-mode structure.
- **Wayfinding Terracotta:** marks primary action, selection, progress, focus, fine image frames, and directional details.
- **Cinematic Navy:** belongs to the Home hero and its deep photographic scrim; it is more saturated and immersive than the ordinary ink role.
- **Bright Route Orange:** appears over dark photography for high-contrast actions, compass needles, and route emphasis.

### Secondary

- **Evidence Teal:** supports suitability measures, selected data, field focus, and positive information states. It does not compete with the action color.

### Neutral

- **Warm Paper:** forms the light-mode canvas and its quiet ruled rhythm.
- **Raised Paper:** supports fields, cards, and subtle hover planes without becoming stark white.
- **Warm White:** keeps hero text and controls legible over photography.
- **Muted Ink:** carries explanatory copy, metadata, and secondary labels.
- **Fine Line:** separates sections, grids, and evidence groups with one-pixel structure.
- **Night Paper:** maps the same hierarchy into dark mode through navy surfaces rather than pure black.

**The Sparse Wayfinding Rule.** Reserve terracotta and bright orange for decisions, state, focus, and travel direction. Their rarity gives them authority.

**The Theme Role Rule.** Light and dark themes preserve hierarchy and composition; theme tokens change value without changing meaning.

## Typography

- **Display Font:** Fraunces for English; Cairo for Arabic
- **Body Font:** Inter for English; Cairo for Arabic
- **Label Font:** the active language body family

**Character:** English display text has an editorial, destination-magazine cadence. Arabic uses Cairo at stronger weight and more generous leading so it feels authored rather than fitted into English metrics.

### Hierarchy

- **Home Display** (600 LTR / 700 RTL, `clamp(3.5rem, 6.2vw, 6rem)`, `0.96` LTR / `1.16` RTL): the first-viewport promise, held near `9–10ch`.
- **Page Display** (600 LTR / 700 RTL, up to `clamp(2.6rem, 6vw, 5rem)`): route and destination titles.
- **Section Headline** (600 LTR / 700 RTL, `clamp(2rem, 4vw, 3.4rem)`): major editorial sections.
- **Question Title** (up to `clamp(1.45rem, 3vw, 2.25rem)`): deterministic interview prompts, capped near `26ch`.
- **Body** (400, commonly `0.88–1.18rem`): descriptions and evidence copy with relaxed `1.5–1.75` leading.
- **Label** (700–800, commonly `0.74–0.86rem`): compact metadata, actions, and evidence labels in sentence case.

All visible numbers use Latin digits in Arabic and English.

**The Script-Specific Display Rule.** Never apply Fraunces, tight English tracking, or English leading to Arabic display text.

## Layout

The global container is `1240px` with `24px` inline gutters, reduced to `18px` on phones. Major sections use fluid vertical rhythm (`clamp(56px, 7vw, 92px)`) and fine horizontal rules to connect content into one atlas rather than a stack of isolated panels.

- **Home:** a cinematic photograph fills a zoom-stable `560–610px` frame on desktop. The promise and actions occupy one side, the compass balances the other, and the destination badge remains inside the image. At `760px` and below, the frame becomes a `680–690px` single-column composition with the actions, statistics, compass, and badge preserved. Its height intentionally avoids viewport-height units so browser zoom cannot push the primary action outside the composition.
- **Purpose:** choices use two columns where space allows and one on phones. Cards remain comfortably tappable and visibly actionable before hover.
- **Quiz:** content is capped near `900px`; the question sheet and progress line carry the sequence without dashboard density.
- **Results and Explore:** destination imagery keeps a `16:10` landscape ratio. Results begin with one large top recommendation followed by a two-column grid; Explore uses a compact four-column catalog on wide screens before collapsing responsively.
- **Destination:** the photo-first hero uses `clamp(470px, 52vw, 650px)` on larger screens and a taller portrait-biased crop on phones. Below it, a narrower facts rail and wider editorial column form a calm reading layout, then become one column below `860px`. The overview spans the full narrative measure before parallel strengths and cautions; sourced decision-support sections continue below as ruled editorial blocks.
- **Navigation:** desktop links yield to the mobile menu below `860px`. At `760px` and below, theme, language, and Start move into the opened menu so every control remains available.

Use CSS logical properties for spacing, rules, overlays, and directional cues. RTL mirrors through layout and icon direction, without direction-specific JavaScript.

**The Photograph Carries Place Rule.** Major imagery owns enough area to establish a destination; supporting cards and evidence stay compact around it.

## Elevation & Depth

The system uses a restrained hybrid of tonal layering and ambient depth. Ordinary reading sections rely on paper tone and one-pixel rules. Shadows appear where a surface overlaps photography, opens above the page, or responds to interaction: the Home hero, destination badge, quiz sheet, listbox, top recommendation, and lifted cards.

### Shadow Vocabulary

- **Ambient Low** (`0 10px 28px rgba(20, 31, 43, 0.06)`): quiet resting depth for interactive cards and compact form planes.
- **Interactive Lift** (`0 20px 44px rgba(20, 31, 43, 0.13)`): destination-card hover and focus feedback.
- **Cinematic Frame** (`0 26px 70px rgba(2, 12, 23, 0.32)`): the Home hero against the navy stage.
- **Dark Feature** (`0 22px 54px rgba(7, 17, 29, 0.20)`): the top recommendation and other dark photographic features.
- **System Overlay** (`0 20px 48px -34px rgba(23, 36, 58, 0.55)`): listboxes, captions, and legacy overlay surfaces that need separation without a hard edge.

Photography gains additional depth from a directional scrim, a thin orange inner frame, gentle saturation control, and selective backdrop blur.

**The Flat Until Interaction Rule.** Use rules and tonal separation for ordinary content. Add lift only when overlap, hierarchy, or interaction state needs it.

## Shapes

The primary silhouette is softly rectangular: fields use `5px`, controls `7px`, buttons `8px`, purpose icons `12px`, destination badges `14px`, cards `16px`, supporting imagery `18px`, and major heroes `24px`. Inside photographic frames, square-cropped image edges are acceptable when the outer container supplies the softness.

Circles are reserved for compass geometry, the brand mark, selection marks, radio indicators, rating stars, and hero navigation controls. Full pills remain functional exceptions for compact metadata or segmented controls; they are not the default container language.

**The Cartographic Geometry Rule.** Pair soft photographic frames with fine straight rules and precise circular compass details. Avoid ornamental blobs and arbitrary capsules.

## Components

### Buttons

- **Shape:** compact rounded rectangle (`8px`) with bold language-aware type and `13px 24px` default padding.
- **Primary:** ink surface with raised-paper text for dependable product actions.
- **Wayfinding:** terracotta in ordinary content and brighter orange over the Home photograph; use for the decisive next step.
- **Ghost:** transparent or lightly translucent surface with a fine border; over photography it becomes warm white on a navy glass plane.
- **Hover / Focus:** a restrained `1px` upward response where appropriate, plus the global `2.5px` focus outline and `3px` offset. Disabled controls keep their geometry and lower opacity.

### Fields and Selects

Fields use a `1.5px` line, raised surface, `5px` corners, `11px 14px` padding, and a `44px` minimum trigger height. Focus shifts the border to teal while keyboard focus retains the visible terracotta outline. Custom listboxes preserve search, selected and active states, a `320px / 60vh` maximum height, and drop-up behavior near the viewport edge.

### Purpose Cards

Purpose choices are real buttons with `16px` corners, a fine border, `24px 22px 22px` padding, an outlined icon tile, a directional arrow, and a visible selected mark. Hover or focus lifts the card `5px`; press returns it toward the page. Selected state combines the terracotta border, ring, icon fill, and check mark.

### Destination Cards

Destination cards are whole-card links with `16px` corners, one-pixel borders, a verified `16:10` photograph, evidence chips, and a bottom action row. Hover or focus lifts the surface `6px`, enriches the image slightly, and turns the action row toward terracotta. Result cards add a `3px` terracotta top rule.

### Destination Detail

The destination page pairs a tall cinematic hero with a quiet editorial body. The hero uses an authored cover crop, a directional navy scrim, asymmetrical soft corners, restrained route detail, and compact source disclosure. Orange appears only in wayfinding lines, match state, focus, and decisive controls; it never becomes a broad decorative wash.

Below the hero, ordinary information sections sit on the page rather than inside a stack of elevated cards. Fine rules, whitespace, and a narrow facts rail establish hierarchy; rounded or tinted containers remain reserved for content that is interactive, personalized, or meaningfully set apart.

**The Surface-Specific Image Rule.** Hero and card imagery are separate delivery roles. Cards use the smaller derivative and their own focal position; heroes use the larger responsive source set, intrinsic dimensions, and independent hero focal position. Keep both crops in shared metadata so a correction improves every consumer without per-page overrides, and preserve verified provenance, bilingual alt text where the image is meaningful, and explicit source disclosure where a hero image is decorative.

### Navigation

The `68px` sticky bar uses translucent paper and `16px` backdrop blur. Desktop links are plain text with a terracotta underline on hover. The circular compass brand mark, language switch, theme selector, and Start action stay compact. Mobile shows brand and menu in the bar, then exposes every other control inside the ruled menu.

### Cinematic Hero and Compass

Home uses one eligible catalog destination selected once per browser session. The photograph fills the frame with `object-fit: cover`, an authored crop, a directional navy scrim, the promise, two actions, a modern compass, and an in-frame destination badge. “رحلتك تبدأ من هنا / Your journey starts here” sits at the primary decision point; “وجهات أقرب إليك / Destinations closer to you” introduces four small country labels around the compass. Those labels come from the same evidence-backed Hero pool, exclude the featured country, remain stable within the session, and keep a short cross-session anti-repeat history.

The Home route layer is structurally outside the clipped photograph. One continuous SVG path can therefore cross the image and continue into the surrounding page stage. Its original plane silhouette follows a substantial curved path over the shared `16s` travel-slow token rather than oscillating a few pixels. A much sparser global route pattern (`2100 × 1500px`) carries the same travel language into public pages without turning dense content into wallpaper. Light mode reduces its contrast; reduced motion freezes the plane at a legible point while retaining the route.

The compass is a product symbol for guided choice. It appears strongly on Home, in the Surprise interaction, and in miniature while the quiz prepares the next question. Destination and Explore surfaces use lighter route detail.

**The Compass With Purpose Rule.** Use compass and route graphics only where the traveler is choosing, orienting, or moving through a journey.

### Quiz, Results, and Information Surfaces

Quiz options have at least `64px` height and combine a subtle selected wash with a `3px` logical-start inset rule. Results lead with a dark photographic top recommendation, then restrained destination cards. “Suitable for” keeps the highest eligible purpose first and discloses the deterministic remainder in order; scores, confidence, missing data, methodology, and sources never change for animation.

Rating surfaces remain compact: `44px` star targets, a short optional textarea, clear required and error states, and a restrained success transition. Visa, price, provider, and city information retain their existing sourced, verified, estimated, partial, missing, and unavailable distinctions.

### Motion and Accessibility

State feedback uses the centralized fast (`140ms`), normal (`280ms`), authored (`760ms`), and travel-slow (`16s`) durations. Quiz questions enter from the direction of travel; result cards use a restrained four-card stagger; the Hero's primary plane uses travel-slow for its long route. A second, quieter plane travels the Hero's other route in the opposite direction at its own slower pace (`21s`) — both are real, continuous motion rather than one live route beside one static line; the second stays visually subordinate (lower opacity, smaller scale) so it reads as a background travel signal, not a second focal point. `prefers-reduced-motion: reduce` disables continuous and decorative animation, removes staggers, and makes state transitions effectively immediate.

Decorative compass, route, and plane graphics are hidden from assistive technology. Interactive surfaces use semantic buttons or links, visible focus, announced validation and async states, and `44px` minimum touch targets where precision matters.

## Do's and Don'ts

### Do:

- **Do** use verified catalog photography with authored crops, accurate bilingual alt text, and honest fallback behavior.
- **Do** preserve Arabic-first copy, English parity, logical-property mirroring, and script-specific typography.
- **Do** keep the recommendation method, reasons, sources, uncertainty, and recovery states visible in light and dark themes.
- **Do** distinguish verified, sourced, estimated, partial, missing, and unavailable information in visible UI.
- **Do** keep browser location and passport country separate, optional, and clear about the value of sharing each.
- **Do** use orange for decisions and movement, teal for supporting data, and fine rules for information structure.
- **Do** keep every visible number in Latin digits and every important interaction keyboard and touch accessible.

### Don't:

- **Don't** turn destination discovery back into a generic catalog grid or a stack of interchangeable rounded cards.
- **Don't** use compass marks, route lines, planes, pills, or editorial numbering as arbitrary decoration.
- **Don't** fabricate photography, prices, visa status, availability, suitability evidence, testimonials, or customer counts.
- **Don't** hide missing coverage, source context, provider state, or deterministic recommendation reasoning for visual simplicity.
- **Don't** let visual work alter Phase 14 scoring, questionnaire branching, optional location and passport boundaries, privacy, or catalog exclusions.
- **Don't** imply an inactive data provider or Turnstile integration is active, collect a passport number, or infer passport country from browser location.
- **Don't** reintroduce Israel (`IL`/`ISR`) into catalog or recommendation surfaces; Monaco (`MC`/`MCO`) remains valid.
