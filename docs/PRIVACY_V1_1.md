# Privacy in v1.1 — what stays on the device, what is sent

Wejhaty stays anonymous and local-first. v1.1 adds no account, no
backend storage and no new telemetry dimension.

## Stored in this browser only

| Key | What | Cleared by |
|---|---|---|
| `wejhaty.personalization.v1` | the questionnaire answers (schema v2), including the optional language, Islamic-practice and halal answers, and the order asked | "Reset preferences", or clearing site data |
| `wejhaty.favorites.v1` | canonical destination ids only | removing each favorite, or clearing site data |
| `wejhaty.theme` | Light / Dark / Auto | the theme control |

Never stored: a passport or nationality, coordinates, a name, an email or
any identifier. The passport default taken from an already-granted
location is shown in the selector only; it becomes the session's passport
only if the traveller continues with it, and it is still never stored.

## Never sent anywhere

- The language, Islamic-practice and halal answers: no `quiz_answer`
  event, not counted in `answerCount`, not in the admin catalog, not known
  to the Worker.
- The passport default from location. No country code is ever sent; the
  existing anonymous `quiz_passport_choice` event carries only a yes/no,
  and only when the traveller presses Continue with a value in the field
  (showing the default sends nothing).
- Favorites and comparisons (no Worker call).

## Never in a URL, share text or page metadata

URLs carry destination ids only (`/destination/<id>/`,
`/compare?ids=`). Share text is the destination name, its canonical URL
and, only when the traveller shares from a page that shows it, the
Personal Match percentage. Static pages and runtime metadata describe
destinations, never a traveller.

## Evidence

- `app/src/routes/Quiz.travelNeeds.test.tsx` — no analytics event or count
  for the travel needs; saved locally; URL clean.
- `app/src/personalization/travelNeeds.test.ts` — share text and the admin
  catalog carry nothing about them.
- `app/src/components/passportDefault.test.tsx` — the default is displayed,
  never persisted, never overwrites a manual choice.
- `app/scripts/production-smoke.mjs` — per engine in production: the
  travel needs are never sent over the network and never reach the URL;
  the passport is neither stored nor sent.
