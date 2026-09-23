# Phase 18 — Personalization (Personal Match)

Anonymous, browser-local personalization layered on top of the protected
recommendation engine. No account, no server storage, no AI.

## Three separate numbers — never merged

| Concept | Question it answers | Source | Personalized? |
| --- | --- | --- | --- |
| **General suitability** ("مناسب لـ") | How suitable is this country for this purpose, for anyone? | `intelligence/` (Phase 15 WS3) | No |
| **Phase 14 match** | Candidate selection and baseline order for the quiz | `engine/` (protected, unchanged) | Answers + fixed purpose component |
| **Personal Match** ("XX% لك") | How well does this country fit *this traveller's own* stated preferences? | this module | Yes |

The UI shows General suitability and Personal Match, always labelled. The
Phase 14 score keeps deciding which countries are candidates and their
baseline order; its weights and numbers are never modified.

## Profile (schema v1) and persistence

`PersonalizationProfile` = `{ schemaVersion: 1, purpose, answers, path,
createdAt, updatedAt }`, stored as JSON under the localStorage key
`wejhaty.personalization.v1` (`storage.ts`).

- `answers` are the canonical quiz answers (question id → option value) —
  the traveller's preferences themselves. Signals are derived from them
  deterministically on every read, so there is one source of truth.
- `path` is the order the questions were asked, used to replay the same
  questionnaire for "edit my preferences".
- Never stored: coordinates, passport, names, identifiers. Location stays
  in memory only (existing privacy architecture); a location-based
  preference is simply *unavailable* after a reload until location is
  shared again.
- Reads are strict (`profile.ts`): unknown questions, unknown option values,
  a non-ISO timestamp, a wrong purpose or a schema version newer than the
  build all make the record invalid → the site behaves as a first visit.
  Corrupt JSON or storage that throws never breaks the page.
- Migrations: `PROFILE_MIGRATIONS[n]` upgrades a record from version `n` to
  `n + 1`. It is empty while v1 is the only schema; the runner is tested
  with injected steps and fails closed on any gap.
- Same browser/device only. Different devices, browsers, private windows or
  cleared site data start with no profile. There is no sync.

Lifecycle:

- **Complete the quiz** → the profile is saved (a new purpose starts a new
  profile; re-answering the same purpose keeps `createdAt`).
- **Edit my preferences** → replays the saved questionnaire with the saved
  answers pre-selected; finishing it updates the profile.
- **Start a new trip** → a fresh questionnaire; the saved profile stays in
  effect until the new questionnaire is completed, then it is replaced.
- **Reset preferences** → removes only this key and the quiz state derived
  from it. Theme, language and every other site preference are untouched.

## Signals (`signals.ts`)

Only answered questions become signals; unanswered never counts.

| Question kind | Signal | Notes |
| --- | --- | --- |
| climate | `climate` | compared with the shared climate-compatibility table |
| budget (cost) | `budget` | asymmetric (below) |
| urbanity, size, popularity | `target` | closeness on 0–100 |
| coast / island yes·no | `want` / `avoid` | "No preference" → neutral |
| importance (safety, health, income, …) | `importance` | weight × answer/100; "a deciding factor" = **strong**, "a secondary factor" = **minor** |
| proximity "yes" | `near` | needs a shared location; "distance does not matter" → neutral |
| land border "yes" | **hard constraint** | the only genuine requirement the questionnaire asks |

Explicit "no preference / does not matter" answers are *neutral*: recorded,
never scored, never penalized (including the medical "size does not matter"
option). Strength changes weight only — no preference, however strong, is
turned into a hard constraint. One signal per factor, like Phase 14's
dimension de-duplication.

## Personal Match formula (`personalMatch.ts`) — `personal-match-1.0`

For each signal, a fit 0–100:

- climate: `CLIMATE_COMPAT[chosen][country]`
- budget: at or under the chosen level `100 − 6 × levelsBelow`; above it
  `100 − 45 × levelsAbove` (so one level over = 55, two = 10)
- target: `100 − |country − chosen|`
- want: `country value`; avoid: `100 − country value` (coast/island are 0/100)
- importance: the country's normalized indicator (0–100)
- near: `100 × e^(−distanceKm / 4000)`

Then, over the signals that could be **evaluated** for that country:

```
personalMatch = round( (Σ wᵢ·fitᵢ + 8·50) / (Σ wᵢ + 8) ), clamped 0–100
```

The `8·50` term is a small neutral prior (≈ one typical preference): with
one or two answers the result stays near 50, so a single matching answer
can never show a confident-looking 100%.

**Unavailable ≠ mismatch.** A factor whose country value is a median
imputation in the recommendation dataset (`imputedKeys`), or a distance
without a shared location, is excluded from the score and listed as "not
counted". It never lowers the match.

- `coverage` = evaluated preference weight ÷ expressed preference weight.
- `confidence`: high = ≥ 4 evaluated and coverage ≥ 0.8; medium = ≥ 2 and
  ≥ 0.5; otherwise low. No evaluable preference → `score: null` (no number
  is shown).
- Factor outcome: positive ≥ 75, partial ≥ 50, negative < 50.
- Hard constraint (land border): pass / fail / unavailable (no location or
  an island origin, exactly like Phase 14's own filter). A failing country
  is `eligible: false` and sorts after every eligible one, whatever its
  weighted score.

Deterministic: same country data + same profile + same methodology version
→ same result. Bounded, finite, no NaN (swept in tests over 400 random
profiles × 194 countries).

## Ranking relationship with Phase 14

`refineRanking()` takes Phase 14's ranked list, keeps its **top 10** as the
candidate pool, and reorders only within it: eligible first → Personal
Match → visa convenience (when a passport and provider data exist) →
Phase 14 score → id. Phase 14's scores and weights are carried through
untouched. Countries outside Phase 14's top 10 are never promoted into the
results.

## Explanations (`explain.ts`, `copy.ts`)

Structured first (`FactorResult[]` grouped positive / partial / negative /
unavailable), rendered second. The one-line summary quotes the traveller's
own answers through the same vocabulary as the Phase 14 text
(`engine/answerVocabulary.ts`), names only positive factors as matches and
only negative factors as weaker, so it cannot contradict the score. Arabic
and English are controlled copy, never machine-translated.
