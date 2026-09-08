# Wejhaty / وِجهتي --- Project Transfer Context

## Purpose of this file

This document transfers the current project context to a new Claude
account.\
The attached `wejhaty.html` is the current working website and should be
treated as the source of truth for the implemented state.

## Current status

-   The project is a prototype/demo travel-destination recommendation
    website.
-   The current implementation is a single self-contained HTML file.
-   Arabic is the default language.
-   English is supported through the built-in language switcher.
-   The website uses RTL for Arabic and LTR for English.
-   No login, registration, backend, database, or AI API is required.
-   The recommendation engine is local/deterministic.
-   The country flags problem has been successfully solved.
-   IMPORTANT: Do not replace, redraw, simplify, or break the current
    flag implementation.
-   The current HTML embeds the real flag SVG source directly, so the
    project does not depend on a separate flags folder or runtime flag
    URL.
-   The current website includes the landing page, purpose selection,
    dynamic questionnaire, results, destination details, and destination
    explorer.

## Important history

The project originally had a local flag-loading problem. The solution
was changed to use the actual SVG flag files from the established
`flag-icons` project and embed the required SVG sources directly into
the HTML. The current file contains the embedded flag system and maps
destination IDs to ISO country codes.

The current flag implementation must be preserved unless there is a
specific bug that needs fixing.

## Current visual direction

The design is intentionally premium and modern, with a
travel-tech/startup feel:

-   Warm paper-like background
-   Dark navy/ink
-   Teal
-   Gold accents
-   Rounded cards
-   Soft shadows
-   Subtle animations
-   Responsive layouts
-   Modern typography
-   Arabic typography using Cairo
-   English typography using Inter/Fraunces

Do not redesign the site unless explicitly instructed.

## Current main navigation

-   Home / الرئيسية
-   How It Works / كيف يعمل
-   Destinations / الوجهات
-   Start Quiz / ابدأ الاختبار
-   Arabic/English switch
-   Start Now / ابدأ الآن

## Current purposes

The project currently has 8 purposes:

1.  Tourism & Vacation / سياحة وإجازة
2.  Work & Career / العمل والوظيفة
3.  Education / التعليم
4.  Medical Treatment / العلاج الطبي
5.  Immigration & Relocation / الهجرة والاستقرار
6.  Investment / الاستثمار
7.  Relaxation & Wellness / الاستجمام والعافية
8.  Other / غرض آخر

## Questionnaire architecture

The questionnaire is dynamic. The question bank changes according to the
selected purpose.

Current general preference concepts include:

### Budget

-   Low --- up to 5,000 SAR
-   Medium --- 5,000--10,000 SAR
-   High --- 10,000--20,000 SAR
-   Luxury --- more than 20,000 SAR

### Climate

-   Hot & Sunny
-   Mild & Comfortable
-   Cold
-   Rainy & Changeable

The implementation internally also supports climate
categories/compatibility such as tropical, Mediterranean, temperate,
cold, and desert.

### Nature vs Cities

-   Nature
-   Cities
-   A Mix of Both

### Beaches vs Mountains

-   Beaches & Relaxation
-   Mountains & Nature
-   Both

### Adventure vs Relaxation

-   Adventure & Activities
-   A Mix of Both
-   Rest & Relaxation

The existing question bank also contains purpose-specific questions for
salary, job market, work-life balance, safety, career growth, tuition,
university ranking, healthcare quality, waiting time, immigration
friendliness, quality of life, business ease, stability, spa/wellness,
quietness, etc.

## Current recommendation engine

The current engine is data-driven and deterministic.

Important existing concepts:

-   Each question has a weight.
-   Questions can be `target`, `importance`, `climate`, `category`, or
    `flavor`.
-   `flavor` questions are currently excluded from numerical scoring.
-   Target questions compare a user's selected target value with a
    destination attribute.
-   Importance questions scale the effective weight based on how
    important the user says the factor is.
-   Climate questions use a compatibility matrix.
-   Each purpose has a destination baseline score where available.
-   A separate purpose-fit component is included in the current score.
-   Destinations are ranked descending by calculated score.
-   Recommendation reasons are currently derived from the strongest
    scored factors.
-   The results UI shows the top match and additional ranked
    destinations.

Do not assume the recommendation engine should be rewritten unless
explicitly requested.

## Current country database

The website contains these 30 destinations:

1.  Japan --- jp
2.  South Korea --- kr
3.  Malaysia --- my
4.  Thailand --- th
5.  Turkey --- tr
6.  United Arab Emirates --- ae
7.  Saudi Arabia --- sa
8.  Qatar --- qa
9.  Germany --- de
10. France --- fr
11. United Kingdom --- gb
12. Spain --- es
13. Italy --- it
14. Switzerland --- ch
15. Netherlands --- nl
16. Canada --- ca
17. United States --- us
18. Australia --- au
19. New Zealand --- nz
20. Singapore --- sg
21. Austria --- at
22. Portugal --- pt
23. Greece --- gr
24. Indonesia --- id
25. Norway --- no
26. Sweden --- se
27. Finland --- fi
28. Ireland --- ie
29. Czech Republic --- cz
30. Poland --- pl

Each destination currently contains structured demo attributes
including:

-   ID
-   English/Arabic names
-   Region
-   Major cities
-   English/Arabic descriptions
-   Cost level
-   Safety
-   Climate
-   Nature
-   Urban
-   Beaches
-   Adventure
-   Culture
-   Nightlife
-   Salary
-   Job market
-   Career growth
-   English-language suitability
-   Tuition
-   University ranking
-   Healthcare
-   Waiting time
-   Immigration friendliness
-   Quality of life
-   Ease of business
-   Growth
-   Stability
-   Spa
-   Quietness
-   Visa difficulty
-   Living cost
-   Purpose-specific baseline scores
-   Strengths
-   Weaknesses
-   Languages

All of this is demo/sample data and is not intended to represent current
official statistics.

## Current pages/views

The current single-page implementation supports these views:

### Home

Hero section, explanation, how-it-works section, purpose previews,
disclaimer, footer.

### Purpose selection

User selects one of the 8 purposes.

### Quiz

Step-by-step questions with:

-   Progress bar
-   Question counter
-   Answer cards
-   Back
-   Next
-   Validation if no answer is selected
-   Dynamic questions based on purpose

### Results

Shows ranked destination recommendations.

The UI includes:

-   Top match
-   Match percentage
-   Reasons
-   Destination cards
-   Country flags
-   Cost
-   Safety
-   Climate
-   Details button
-   Start again
-   Browse all destinations

### Destination details

Shows:

-   Country name and flag
-   Match score when available
-   Overview
-   Why it matches
-   Major cities
-   Strengths
-   Things to consider
-   Best suited for
-   Cost
-   Safety
-   Climate
-   Language
-   Visa difficulty
-   Living cost
-   Region

### Destination explorer

Allows browsing all destinations without taking the quiz, with:

-   Search
-   Region filter
-   Purpose filter
-   Cost filter
-   Result count
-   Empty state/reset filters

## Current flag system --- CRITICAL

The current HTML uses an embedded flag system.

Important details:

-   Destination IDs are mapped to ISO alpha-2 codes.
-   Actual SVG flag sources are embedded inside the HTML.
-   The embedded SVGs came from the established `flag-icons` library.
-   The implementation rewrites internal SVG IDs when instantiating
    flags so multiple copies can safely coexist.
-   Flags are used both as small chips and as larger banner layers.
-   The banner uses a blurred full-bleed flag background plus a crisp
    centered flag.
-   There is a fallback badge only if a flag is missing.

Do not manually recreate any flags.

## Current technical structure

Although this is not React, it is organized inside the HTML using clear
sections:

-   I18N
-   Icons
-   Region visuals
-   Destination data
-   Embedded flag system
-   Question banks
-   Purpose metadata
-   Recommendation engine
-   Reason builder
-   State/router
-   Render functions
-   Event binding
-   Global bindings

## Current implementation constraints

When continuing development:

1.  Preserve working functionality.
2.  Preserve the current visual identity.
3.  Preserve the working flag system.
4.  Preserve Arabic/English support.
5.  Preserve RTL/LTR behavior.
6.  Avoid unnecessary rewrites.
7.  Do not introduce AI unless explicitly requested.
8.  Do not add a backend unless explicitly requested.
9.  Do not remove the 30-country demo database.
10. Keep recommendation data separate from UI logic where practical.
11. Keep the project suitable for a prototype/demo.
12. Treat `wejhaty.html` as the current source of truth.

## What has NOT been approved yet

Do not assume that any previously discussed future idea is approved.

In particular, do not automatically:

-   migrate to React
-   rewrite the recommendation engine
-   add AI
-   add authentication
-   add a backend
-   add external APIs
-   redesign the interface

Those are separate future decisions.

## Working rule for the new Claude account

Before modifying anything:

1.  Read and understand `wejhaty.html`.
2.  Inspect the existing implementation.
3.  Explain what you intend to change.
4.  Make only the requested changes.
5.  Avoid touching unrelated working systems.
6.  After changes, test the affected flow.

## Files being transferred

-   `wejhaty.html` --- current working website.
-   `WEJHATY_PROJECT_CONTEXT.md` --- this project context/transfer
    document.

The current HTML is self-contained regarding the country flags, so the
working site does not require the previously used external/local flags
folder.

## Current handoff point

The flag issue has been solved successfully.

The project is now ready for the next feature or improvement, but no
specific next development step should be assumed. Wait for explicit
instructions.
