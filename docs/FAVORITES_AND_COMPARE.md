# Favorites, Compare and Share (v1.1)

## Favorites — local only

- Stored in this browser only: `localStorage["wejhaty.favorites.v1"] =
  {"version":1,"ids":[...]}`. No account, no backend, no Worker call.
- Holds canonical destination ids only — never a country object, a
  passport, a location or any personalization answer
  (`app/src/favorites/store.ts`).
- Reading is defensive: bad JSON, an unknown or future version,
  duplicates, unknown ids, ids no longer in the catalog and the excluded
  countries all resolve to a clean list. Storage that is disabled, blocked
  or full never breaks a page (`app/src/site/safeStorage.ts`); the choice
  then lasts for the visit. Other tabs follow changes (`storage` event).
- Controls: a Favorite toggle (`aria-pressed`) under the destination hero
  and a small icon on Explore cards; announcements through one polite live
  region. The header link is hidden between 861 and 1099 px (no room
  without wrapping); the footer link is always there.
- The Favorites page lists them, opens a destination, removes one, and
  selects two or three for Compare.

## Compare — real data, no winner

- `/compare?ids=a,b,c` — the URL carries destination ids only; 2–3
  destinations; unknown, duplicate or excluded ids are dropped; `noindex`.
- Rows (`app/src/compare/compareModel.ts`): region, languages, currency,
  area, land borders, data coverage; General Suitability for each of the
  7 purposes with its confidence and coverage; Personal Match for each
  destination when the traveller has saved preferences (computed for that
  destination whatever its rank); straight-line distance when a location
  was shared.
- Never: a winner, a "best", a combined score, Passport/entry information,
  a Traveler Budget. Missing data reads "Not available".
- An accessible table: caption, column and row headers, section groups.
  On a phone the table scrolls inside its frame; the page itself never
  scrolls sideways.

## Share

- Web Share API when available; otherwise the link is copied; otherwise a
  read-only field shows it. Feedback is announced in Arabic or English.
- The shared URL is the destination's canonical page. The text may include
  the Personal Match percentage only when the traveller presses Share on a
  page that shows it. Never shared: quiz answers, the profile, a location,
  a passport, religious-practice, halal or language preferences.
