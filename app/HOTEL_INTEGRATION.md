# Live hotel/accommodation integration — architecture note (Phase 13.5b)

This document records the proposed architecture for a future live hotel
provider integration.

**Status: `NOT IMPLEMENTED — PROVIDER/ACCOUNT/CREDENTIALS REQUIRED`.**
No hotel-search Worker route, provider adapter, or frontend UI has been
built yet in THIS pass — see "Why no code this pass" below for the
explicit, disclosed scope decision. This document is the concrete plan
a future pass implements from, not a placeholder.

## What this explicitly is NOT

- Not a scraper. Booking.com, Google Hotels, and similar sites forbid
  scraping in their Terms of Service — never built, never will be,
  matching this project's existing Amadeus-only ("real, documented,
  authorized API only") convention.
- Not a source of fabricated prices. No hotel price is ever derived
  from `costLevel`, the Travel Cost Index (PLI), a country average, or
  any other formula — see `SECRETS.md` and `TRAVEL_COST_INDEX.md` for
  the identical rule already enforced for flights and general pricing.
  This is the same rule the user's roadmap cleanup (cancelling a
  fabricated "Numeric Accommodation Cost") already states explicitly.
- Not a replacement for `AccommodationInfo.tsx`'s existing qualitative
  cost-level card, which must be preserved regardless of whether this
  ever ships (see that file's own updated doc comment).

## Provider candidates (real, documented APIs only)

1. **Amadeus for Developers — Hotel Search / Hotel Booking API.**
   Strongest candidate: this project already holds a real, tested
   OAuth2 client-credentials integration against Amadeus for flights
   (`worker/src/amadeus.ts`), and Amadeus's Hotel APIs authenticate
   with the SAME `AMADEUS_API_KEY`/`AMADEUS_API_SECRET` pair — no new
   credential type, no new vendor relationship, no new legal review.
   Endpoints of interest: `GET /v1/reference-data/locations/hotels/by-city`
   (hotel list for a city) and `GET /v3/shopping/hotel-offers` (live
   availability/price for a set of hotel IDs, given check-in/check-out
   dates and occupancy). Same test/sandbox vs. production environment
   split as flights (`AMADEUS_ENV` in `wrangler.toml`).
2. **Booking.com Demand API (partner program).** Real, documented,
   official API — but requires a formal partner application/approval
   process, not a simple self-serve key. Worth a fallback candidate if
   Amadeus's hotel coverage/pricing proves insufficient, but not
   pursued first given the zero-new-integration-cost of option 1.
3. Any other provider must pass the same bar already established for
   flights: real, documented API; server-side-only credentials; no
   redistribution-restricted ToS; no requirement to fabricate or
   estimate data it does not actually return.

**Decision: candidate 1 (Amadeus Hotel APIs) is the one to implement
first**, specifically because it needs no new credential provisioning
step beyond what `SECRETS.md` already documents — the SAME
`AMADEUS_API_KEY`/`AMADEUS_API_SECRET` pair, once provisioned, unlocks
both flights and hotels.

## Planned architecture (mirrors the existing Amadeus flights pattern exactly)

Worker side (`worker/src/`):
- `hotels.ts` — new module, siblings `amadeus.ts`. Reuses
  `amadeus.ts`'s existing OAuth2 token-fetch/cache function (do not
  duplicate it) and adds `searchHotelOffers(env, params)` calling the
  two endpoints above. Same error-mapping discipline as flights: a
  zero-offer response is a normal, valid, empty result — never
  synthesized into a fake offer.
- A new `Env` field is NOT needed — `AMADEUS_API_KEY`/`_SECRET`/`_ENV`
  are already declared and already flow through `resolveAmadeusBaseUrl()`.
- `index.ts` — new route `POST /api/travel/hotels`, following the
  EXACT existing `/api/travel/flights` request-validate → provider-call →
  response-shape pattern (see `validateTravelSearchRequest`/
  `mapAmadeusErrorToResponseArgs` for the flights equivalent to mirror).
- Request shape: destination (ISO2 country code — this project's
  existing catalog identity, never a free-text city the model could
  hallucinate), check-in date, check-out date, occupancy (adults,
  optionally children/rooms). Bounded, validated field-by-field exactly
  like `validateTravelSearchRequest` does today.
- Response shape: a small, honest list of `{hotelId, name, offers:
  [{price: {currency, total}, checkInDate, checkOutDate, room:
  {description}}]}` — nothing invented beyond what Amadeus itself
  returns; an empty `offers` array is a legitimate "no availability"
  result, not an error.

Frontend side (`app/src/`):
- `travel/hotelService.ts` — new module, sibling `travelService.ts`,
  same safe-typed-result-for-every-failure-mode convention (never
  throws, `{status: 'ok'|'unavailable'|'invalid_request'|'error', ...}`).
- UI integration happens ONLY once real data is available (per this
  pass's own instruction: "unlikely this pass") — when it does, it must
  render as a clearly-labeled "LIVE HOTEL DATA" section, structurally
  separate from and never replacing `AccommodationInfo.tsx`'s
  qualitative cost-level card (see Section 63 of the originating task
  spec). No booking action unless Amadeus's own API genuinely supports
  a real booking flow for this integration tier (it does not, for the
  Hotel Search tier used here — booking would be a separate, later
  decision, not assumed here).

Tests (mirroring `worker/src/amadeus.test.ts`'s own coverage exactly):
missing dates/context → 400; loading/pending state; a valid live result;
zero results (empty `offers`, not an error); provider error → mapped,
never a raw upstream body; invalid/malformed upstream response → safely
handled; currency passed through, never converted/guessed; AR/EN;
portrait/landscape; no frontend secret exposure (credentials never
leave the Worker, exactly like flights); Phase-15-style fallback (the
existing qualitative card) when hotel data is unavailable.

## Why no code was written for this in this pass

The architecture can be implemented only after selecting a legitimate provider
and obtaining the required account and credentials. No hotel Worker route,
adapter, or live-result UI exists today. Keep the current qualitative
accommodation information until real provider data is available.

## Final status

**`NOT IMPLEMENTED — PROVIDER/ACCOUNT/CREDENTIALS REQUIRED`**

- Provider selected: Amadeus for Developers — Hotel Search / Hotel
  Booking API (same account/credentials as flights).
- Exact secrets needed: `AMADEUS_API_KEY`, `AMADEUS_API_SECRET` — the
  SAME two `SECRETS.md` already documents for flights; no new secret
  name, no new vendor relationship, no value ever requested in chat.
- Provisioning path (identical to flights, see `SECRETS.md`): from a
  machine with Wrangler authenticated (`wrangler login` or
  `CLOUDFLARE_API_TOKEN`), run `cd worker && npx wrangler secret put
  AMADEUS_API_KEY` and `npx wrangler secret put AMADEUS_API_SECRET`.
- Code readiness: architecture fully specified above; Worker
  route/provider module and frontend service are NOT yet implemented
  (explicit scope decision this pass, see above) — this is the one
  concrete remaining engineering task, not a research gap.
