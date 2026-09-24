# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Wejhaty serves Arabic-first travelers who need help choosing a destination for tourism, work, education, medical treatment, immigration, investment, wellness, or another stated purpose. English is supported as an equal product language. The product requires no account and must remain usable whether or not a traveler shares location or passport country.

## Product Purpose

Wejhaty helps a traveler move from broad preferences to a practical, explainable shortlist of countries. It combines an answer-driven deterministic questionnaire with a worldwide destination catalog, country details, optional proximity context, and honest data-coverage states. Success means the traveler can understand why a destination appeared, inspect the available evidence, and continue planning without mistaking estimates or missing data for verified facts.

## Positioning

Wejhaty's distinguishing mechanism is a deterministic recommendation engine over a worldwide catalog, paired with transparent reasons and explicit uncertainty. The interview gathers only supported preferences; Phase 14 remains the sole scoring and candidate-selection authority, and the browser-local Personal Match layer (Phase 18) may only reorder within Phase 14's top candidates, always labelled separately from a country's general suitability. Location may break otherwise-equal matches only when the traveler opts into proximity, and passport country is optional and used only to show entry requirements from destinations' official sources, never to rank.

## Operating Context

- Arabic is the default language; English, RTL, and LTR are first-class.
- The primary journeys are Home, purpose selection, questionnaire, results, Explore, and destination detail.
- Location permission is an optional enhancer for proximity, land-access, and nearest-destination features. Denial or unavailability must never block the product.
- Contact, suggestion, problem reports, and destination ratings are public feedback flows.
- The frontend is a React/TypeScript/Vite application deployed to GitHub Pages. Server integrations run in a Cloudflare Worker.
- The product must work on phones, tablets, laptops, and desktop screens in light, dark, and system themes.

## Capabilities and Constraints

- Phase 14 deterministic scoring and its weights are protected product logic.
- The questionnaire is deterministic and answer-driven. AI interview and AI explanation features are cancelled and must not return without a new explicit decision.
- Israel (`IL`/`ISR`) is excluded from every effective catalog and recommendation path. Monaco (`MC`/`MCO`) remains valid.
- Flight, hotel, accommodation, visa, and budget claims must never be fabricated. Estimates and relative price-level information remain clearly labelled.
- Precise coordinates remain in memory and are never sent to recommendation services or analytics.
- Browser location and self-reported passport country are separate concepts. The product collects no passport number.
- Sensitive personal or cultural traits are never inferred from nationality, language, locale, or location.
- All visible numbers use Latin digits in both languages.
- Missing, partial, sourced, and verified information must remain visibly distinguishable.
- Turnstile is not currently enabled and must not be represented as active.
- Entry-requirement coverage is partial (official sources for 34 destinations) and must be presented as partial; uncovered destinations say so instead of guessing.
- Arabic typography stays on the current font stack: the Thmanyah typeface's license does not permit web hosting from this public repository.

## Brand Commitments

- Product name: `وجهتي / Wejhaty`.
- Arabic must feel authored first, not translated after English.
- The experience should communicate trusted travel decision-making, exploration, calm confidence, clarity, and international usefulness without cultural stereotypes.
- Phase 17 may replace the incumbent visual identity when evidence supports a stronger system, while preserving product truth, routes, behavior, privacy, and accessible native interaction patterns.

## Evidence on Hand

- Current production code and tests cover the deterministic questionnaire, worldwide catalog, destination pages, location flows, feedback, and bilingual rendering.
- Destination imagery exists in `app/public/destinations/`; image presence alone is not evidence that every image is the ideal editorial choice.
- Country, city, tourism, price-level, travel, and provider data retain their source and coverage semantics in the current implementation and project documentation.
- The repository contains no verified testimonials, customer counts, or marketing proof that may be invented for the redesign.

## Product Principles

1. Help the traveler decide quickly, then let them inspect depth on demand.
2. Explain recommendations without weakening deterministic authority.
3. Treat uncertainty and missing coverage as product information, not visual clutter to hide.
4. Ask for location, passport country, and feedback only when their value is clear and participation remains optional.
5. Give Arabic, English, mobile, tablet, accessibility, and performance equal release weight.

## Release Status

Wejhaty v1.0.0 was released on 2026-09-24 (tag `wejhaty-v1.0.0`): Phase 20 (the public product) and Phase 21 (the operator dashboard) are user-accepted. The accepted product, including the Phase 17–20 visual identity, is frozen; any change to accepted behaviour, scoring, Personal Match, the frozen Passport feature or the visual identity needs an explicit new task. Current status and known limitations live in `PROJECT_STATE.md`.

## Operator Dashboard

The private `/admin` dashboard is a separate, Operate-mode surface for the product owner, not for travellers. It favours exact definitions over decoration: every figure states what it counts, over what denominator and window, and where it misleads (`/ADMIN_METRICS.md`). It is bilingual (Arabic RTL and English), labels every data value in the operator's language, stays desktop-first while remaining usable on a phone, and never shows a coordinate, an IP address, a fingerprint or passport data. Changes to it must not change the public site.

## Accessibility & Inclusion

Phase 17 must preserve semantic HTML, keyboard operation, visible focus, labelled controls, announced validation and async states, adequate contrast, reduced-motion support, readable Arabic and English typography, and touch targets appropriate for mobile and tablet use.
