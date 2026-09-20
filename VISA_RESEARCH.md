# Visa data research

Current conclusion as of 2026-09-20: Wejhaty must not publish easy/medium/hard
visa labels from its static destination data. Entry requirements depend on
passport nationality, destination, travel purpose, passport type, residence,
transit, trip length, and frequently changing exceptions. The current UI
therefore shows only a general warning and does not use the old generic
`visaDiff` value as a traveller-facing claim.

## Sources checked

- [IATA Travel Centre](https://www.iata.org/en/travel-centre/) describes a
  personalized requirements service backed by more than 1,000 official
  sources. It is suitable as a traveller verification destination.
- [IATA Timatic](https://www.iata.org/timatic) is the airline-grade structured
  product. IATA states that it receives up to 200 rule changes a day. Product
  integration is commercial and requires a contract; there is no verified
  anonymous public API in the current project.
- [European Commission Schengen guidance](https://home-affairs.ec.europa.eu/policies/schengen/visa-policy/applying-schengen-visa_en)
  and [EUR-Lex Regulation 2018/1806](https://eur-lex.europa.eu/legal-content/en/ALL/?uri=CELEX%3A32018R1806)
  provide official bloc-level lists, but exceptions still depend on the
  traveller and the specific trip.
- [GOV.UK visa checker](https://www.gov.uk/check-uk-visa) provides an official
  nationality-and-purpose flow for the United Kingdom.
- [U.S. Department of State Visa Waiver Program](https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visa-waiver-program.html)
  provides an official program list, with eligibility conditions beyond
  nationality alone.

## Feasible product design

1. Keep passport country optional and session-only, as it is today.
2. Integrate a licensed real-time provider such as Timatic, or maintain a
   destination-by-destination registry sourced from official authorities with
   a recorded source URL, retrieval time, rule version, trip purpose, and
   passport type.
3. Return a requirement category such as visa-free, electronic authorization,
   eVisa, visa on arrival, or visa required in advance. Do not convert the
   category into “easy/medium/hard” unless a documented, reproducible method is
   separately approved.
4. Fail closed to “not available”. Never reuse a country-wide static value for
   a passport-specific answer.
5. Preserve the permanent warning: “Check visa requirements with the official
   source before travel.” Link to the provider result and destination authority
   when available.
6. Apply the existing effective catalog exclusion before provider requests and
   before displaying results. Provider data never expands the catalog.

## Readiness

`READY — PROVIDER CONTRACT OR MAINTAINED OFFICIAL-SOURCE REGISTRY REQUIRED.`

No passport-specific visa requirement or difficulty label was implemented in
this round because the repository has no verified global source that can
support the claim.
