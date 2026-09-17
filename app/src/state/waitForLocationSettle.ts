// Phase 16 workstream A — the geolocation/quiz race condition.
//
// ROOT CAUSE: Quiz.tsx and the reducer's own advance() already recompute
// `effectiveQuestionBank(purpose, !!state.location.coords)` fresh on every
// render/dispatch, so a resolved location DOES make location-dependent
// questions eligible again on the very next question. The one spot this
// does NOT help is the terminal "no more eligible questions -> show
// results" decision in Quiz.tsx's onSelect(): if that decision is made at
// the exact instant location.status is still 'requesting' (permission was
// just granted a moment ago and coordinates have not arrived yet), the
// flow finishes and moves to results WITHOUT ever having offered the
// location-dependent question — a moment later is too late, because
// nothing re-checks after the quiz has already moved on. That is the
// actual, irreversible race: not "location is ignored forever", but "the
// one moment location would have mattered passes while it is still
// merely pending."
//
// FIX: at exactly that decision point, wait briefly (bounded) for the
// pending request to settle before finalizing "no more questions". Every
// other decision point in the quiz already self-heals on its own, so
// nothing else needs this.
import type { LocationStatus } from './types';

/** How long the quiz is willing to hold the "no more questions" decision
 *  open for a still-pending geolocation result before giving up and using
 *  whatever is known. Short deliberately — most coarse (stage 1) fixes
 *  resolve well under this; not the full 8s STAGE_ONE_TIMEOUT_MS, because
 *  that would turn a rare pending window into a routine multi-second
 *  stall at the end of every fast quiz. */
export const LOCATION_SETTLE_TIMEOUT_MS = 2500;
const POLL_INTERVAL_MS = 100;

/** Polls `getStatus()` until it stops reporting 'requesting' or the bounded
 *  timeout elapses — never longer, never a second geolocation request (it
 *  only reads status; requestBrowserLocation() is never called from here).
 *  A pure, injectable function: `getStatus` and the two ms values are
 *  parameters precisely so this is testable without fake timers driving a
 *  full React render cycle. */
export async function waitForLocationSettle(
  getStatus: () => LocationStatus,
  timeoutMs: number = LOCATION_SETTLE_TIMEOUT_MS,
  pollIntervalMs: number = POLL_INTERVAL_MS,
): Promise<LocationStatus> {
  const deadline = Date.now() + timeoutMs;
  let status = getStatus();
  while (status === 'requesting' && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    status = getStatus();
  }
  return status;
}
