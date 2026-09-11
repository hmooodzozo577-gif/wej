export { selectNextQuestion } from './selectNextQuestion';
// Phase 16.5 TRUE adaptive-interview pass — kept exported for its own
// tests and as fallback/testing support ONLY (see followupTemplates.ts's
// own doc comment); no longer called from the normal interview path.
export { selectFollowup, MAX_FOLLOWUP_TURNS } from './followupTemplates';
export { useAdaptiveInterview, decideAdaptiveInterviewStep, toPendingFollowup } from './useAdaptiveInterview';
