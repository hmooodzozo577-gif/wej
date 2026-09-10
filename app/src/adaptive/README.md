# adaptive/

Phase 15 — Adaptive Questions. Pure, deterministic question-ORDERING
logic. Completely separate from `src/engine/` (Phase 14 scoring/
ranking) — this directory never imports `scoreDestination`/
`rankDestinations`, and `src/engine/` never imports this directory.
The boundary is deliberate: Phase 15 changes HOW Wejhaty asks
questions, never HOW Phase 14 scores the resulting answers.

## Audit performed before writing any adaptive code

Reinspected, from current source (not assumed):

- **`data/generated/questionBanks.json`** (8 purpose banks, 5-8
  questions each). Every question has `id`, `weight`, `kind`
  (`target` | `importance` | `climate` | `category` | `flavor`),
  `destKey` (absent for `flavor`), and bilingual `text`/`options`.
- **`engine/scoreDestination.ts`**: `kind: 'flavor'` questions are
  filtered out of scoring entirely (`weight: 0` in every bank, and
  explicitly excluded via `.filter((q) => q.kind !== 'flavor')`) — a
  `field`/`category`/`sector` icebreaker question exists in 4 of the 8
  banks (work/education/medical/investment), purely contextual, never
  affects the score regardless of its value.
- **A missing answer is ALREADY safe, by construction**:
  `if (ans === undefined) return;` inside `scoreDestination`'s
  `questions.forEach` — an unanswered question is excluded from both
  `totalWeighted` and `totalWeight`, neither rewarded nor penalized.
  This was true before Phase 15 and required no change — it is the
  reason a reordering-only design (see below) carries zero scoring
  risk regardless of which order the same eventual answer set arrives
  in.
- **`rankDestinations(purposeId, answers)`** takes the final answers
  object only — no question order, no "which were asked when"
  parameter exists anywhere in Phase 14. Order is invisible to Phase
  14 by construction, not by a promise this phase has to keep.
- **`routes/Quiz.tsx`** (pre-Phase-15): `qIndex` was a plain array
  index into `QUESTION_BANKS[purpose]`; every question was mandatory
  before "Next" (`if (state.answers[q.id] === undefined) { showValidation; return; }`)
  even though the engine itself tolerates omission — the UI enforced
  full completion, the engine did not require it. Progress was a fixed
  `qIndex+1 of total` (`total = questions.length`).
- **`state/reducer.ts`**: `SET_ANSWER` merges into `answers`;
  `NEXT_QUESTION`/`PREV_QUESTION` were `qIndex±1`; `START_QUIZ`/
  `SYNC_QUIZ_PURPOSE` reset `qIndex`/`answers`/`results`;
  `RESTART_ALL` additionally clears `purpose`.

### Conclusions this audit produced (documented, not assumed)

1. **Every non-flavor question is required by the recommendation
   engine** in the sense that it IS a real scoring dimension the user
   might care about — none of the 8 banks' `target`/`importance`/
   `climate` questions are redundant with another. None were found to
   be "genuinely irrelevant" in a way the engine's own semantics would
   safely justify skipping (see "Why reordering, not skipping" below).
2. `flavor` questions are optional in the sense that skipping them
   would have literally zero scoring effect — but they were kept
   mandatory anyway (asked, always first) since they are cheap, fast,
   and provide real context (used nowhere else in this phase, but not
   removed from the flow either).
3. Changing question ORDER never affects `rankDestinations`'s output
   for a fixed final answer set — proven directly by the parity test
   (`adaptiveParity.test.ts`) rather than assumed from reading the
   code.

## Why reordering, not skipping

The task's own instruction is explicit: *"Do not skip questions just
to make Phase 15 look adaptive. If the recommendation engine requires
the dimension, ask it."* Every real (non-flavor) question in every
bank is a genuine, independent scoring dimension — inventing a
semantic "this one is irrelevant given that answer" rule for any of
them would be exactly the kind of unjustified fabrication the task
warns against, and no such genuine irrelevance was found during the
audit above. So Phase 15 here is a pure **reorder**: every question in
a purpose's bank is still asked, eventually — `selectNextQuestion`
only decides which UNASKED question is most worth asking NEXT, given
what's been learned so far. Total question count per purpose is
therefore unchanged from before this phase, which is also why the
progress UI needed no change (see "Progress UX" in the final report —
`Question X of Y` was already, and remains, truthful).

## The adaptive rule (see `selectNextQuestion.ts` for the exact code)

1. `flavor` questions always first (unchanged position from before).
2. Among the rest, priority = the question's own real `weight`
   (already-existing data, not invented), adjusted by one genuine,
   answer-derived signal: the running average of the user's own
   `importance`-kind answers so far. `scoreDestination.ts` computes an
   `importance` question's effective weight as `weight * (answer /
   100)` — so a user trending toward high importance answers is, by
   direct mathematical consequence of their own input, making
   `importance`-kind dimensions carry more real weight in their
   eventual score; prioritizing more of them next follows directly
   from that fact. A user trending low is doing the opposite, so
   `target`/`climate` questions (fixed weight regardless of the
   answer) are prioritized instead, to guarantee their signal lands
   early either way.
3. Ties broken by original bank order — fixed and deterministic.

No randomness. No timestamps. No object/Map iteration-order
dependency (plain arrays and explicit index lookups throughout). See
`selectNextQuestion.test.ts` for the enumerated-path/determinism
proofs and `adaptiveParity.test.ts` for the Phase 14 parity guarantee.
