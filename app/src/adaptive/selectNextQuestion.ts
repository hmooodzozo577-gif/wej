// Phase 15 — Adaptive Questions. Pure, deterministic question-ORDERING
// layer, completely separate from src/engine/ (Phase 14 scoring/
// ranking, which this module never imports from and never calls) —
// see this directory's README.md for the full audit this was built on
// and why reordering (not skipping) was chosen.
//
// Contract: given a purpose's full question bank, the answers given so
// far, and which question ids have already been shown, returns the
// single next question to ask, or `null` once every question in the
// bank has been asked. Same inputs -> same output, always: no
// randomness, no timestamps, no dependency on object/Map iteration
// order (arrays and explicit index lookups only), no network, no AI.
import type { Question } from '../data/types';
// Type-only import — zero runtime coupling to engine/ (Phase 14). This
// module never calls scoreDestination/rankDestinations and never will;
// `Answers` (`Record<string, string | number>`) is just the shared
// answer-state shape, already the single source of truth reducer.ts
// itself imports from the same place.
import type { Answers } from '../engine';

/** Threshold (0-100) separating a "high" from a "low" running average
 *  of the user's own 'importance' answers so far. 55 sits just above
 *  the midpoint of the 0-100 scale these answers are always given on
 *  (see data/generated/questionBanks.json — every importance option
 *  set spans roughly 10-85) — not tuned against any specific bank. */
const IMPORTANCE_MOMENTUM_THRESHOLD = 55;

/** Small, fixed priority bump — enough to reorder ties, never enough
 *  to override a genuinely higher base `weight` (the smallest real
 *  weight gap between two questions in any bank is 1; every bump here
 *  is well below what would invert an already-decisive weight
 *  ordering by more than one adjacent tie). */
const ADAPTIVE_BOOST = 5;

function priority(q: Question, avgImportance: number | null): number {
  let p = q.weight;
  if (avgImportance === null) return p;
  if (avgImportance >= IMPORTANCE_MOMENTUM_THRESHOLD && q.kind === 'importance') {
    p += ADAPTIVE_BOOST;
  } else if (avgImportance < IMPORTANCE_MOMENTUM_THRESHOLD && (q.kind === 'target' || q.kind === 'climate')) {
    p += ADAPTIVE_BOOST;
  }
  return p;
}

/** Deterministic next-question selection.
 *
 * Rules, in order:
 * 1. `flavor`-kind questions (weight 0, never scored — see
 *    engine/scoreDestination.ts's own `kind !== 'flavor'` filter)
 *    always come first, in the bank's own original relative order —
 *    a stable icebreaker/context question, unchanged from before this
 *    phase for every bank that has one.
 * 2. Among the rest, highest `priority()` first — base priority is the
 *    question's own real `weight` (how much it actually influences the
 *    final score, per scoreDestination.ts), adjusted by a genuine,
 *    answer-derived signal: the running average of 'importance'-kind
 *    answers given so far. In scoreDestination.ts, an 'importance'
 *    question's EFFECTIVE weight is `weight * (answer / 100)` — so a
 *    user who answers importance questions high is, by construction,
 *    making importance-kind dimensions carry MORE real weight in their
 *    own eventual score; prioritizing more of them next is a direct,
 *    provable consequence of that fact, not an invented correlation.
 *    Symmetrically, a user trending low on importance answers is
 *    making those dimensions carry LESS weight for themselves — so
 *    'target'/'climate' questions (whose weight is fixed regardless of
 *    the answer given) are prioritized instead, to guarantee their
 *    fixed-weight signal is captured early.
 * 3. Ties broken by the question's original position in the bank
 *    array — fixed, deterministic, never insertion-order-by-accident
 *    (every candidate's index is read from the SAME `bank` array
 *    passed in, not recomputed from a Set/Map).
 *
 * Never skips a real (non-flavor) question — every one is returned
 * eventually; this is a REORDER, not a SKIP. */
export function selectNextQuestion(bank: Question[], answers: Answers, askedIds: string[]): Question | null {
  const askedSet = new Set(askedIds);
  const remaining = bank.filter((q) => !askedSet.has(q.id));
  if (remaining.length === 0) return null;

  const flavorRemaining = remaining.filter((q) => q.kind === 'flavor');
  if (flavorRemaining.length > 0) return flavorRemaining[0];

  const importanceValues = bank
    .filter((q) => q.kind === 'importance' && answers[q.id] !== undefined)
    .map((q) => answers[q.id] as number);
  const avgImportance = importanceValues.length > 0 ? importanceValues.reduce((a, b) => a + b, 0) / importanceValues.length : null;

  let best = remaining[0];
  let bestPriority = priority(best, avgImportance);
  let bestIndex = bank.indexOf(best);
  for (const q of remaining.slice(1)) {
    const p = priority(q, avgImportance);
    const idx = bank.indexOf(q);
    if (p > bestPriority || (p === bestPriority && idx < bestIndex)) {
      best = q;
      bestPriority = p;
      bestIndex = idx;
    }
  }
  return best;
}
