// Phase 20 — why the questionnaire was opened.
//
// Two entry intents exist:
//   - general recommendation (Home / Purpose → Quiz → Results) — the default,
//     carried by no state at all;
//   - destination match (Destination X → "اكتشف مدى توافقها معك" → Purpose →
//     Quiz → back to X, which then shows X's Personal Match).
//
// The target destination is NAVIGATION INTENT only. It travels in React
// Router's location state from one screen to the next (which also survives
// a reload of that same history entry) and is never written to the
// personalization profile, analytics, browser storage or the URL. Leaving
// the flow through any other link simply drops it.
import { WORLD_CATALOG } from '../data/worldCatalog';

export interface DestinationMatchIntent {
  kind: 'destinationMatch';
  destinationId: string;
}

/** Location state carried by the screens of a destination-match flow. */
export interface QuizIntentState {
  quizIntent: DestinationMatchIntent;
}

/** Location state for the destination page reached at the end of the flow:
 *  asks it to bring the Personal Match section into view once. */
export interface PersonalMatchFocusState {
  personalMatchFocus: true;
}

export function destinationMatchState(destinationId: string): QuizIntentState {
  return { quizIntent: { kind: 'destinationMatch', destinationId } };
}

/** Reads a destination-match intent from location state. History state is
 *  script-writable, so anything malformed, or a destination that is not in
 *  the catalog (including an excluded country), is treated as no intent —
 *  the general flow. */
export function readDestinationMatchIntent(state: unknown): DestinationMatchIntent | null {
  if (!state || typeof state !== 'object') return null;
  const intent = (state as { quizIntent?: unknown }).quizIntent;
  if (!intent || typeof intent !== 'object') return null;
  const { kind, destinationId } = intent as { kind?: unknown; destinationId?: unknown };
  if (kind !== 'destinationMatch' || typeof destinationId !== 'string') return null;
  return WORLD_CATALOG.some((entry) => entry.id === destinationId) ? { kind, destinationId } : null;
}

export function isPersonalMatchFocusState(state: unknown): boolean {
  return !!state && typeof state === 'object' && (state as { personalMatchFocus?: unknown }).personalMatchFocus === true;
}
