// Phase 16.5 completion pass — renders the one currently pending
// contextual follow-up (see adaptive/followupTemplates.ts and
// state/types.ts's PendingFollowup doc comment for the full
// architecture). Hybrid interaction: a bounded CHOICE (the template's
// own pre-authored, canonical-value-mapped options) plus an optional
// SHORT FREE-TEXT escape hatch, scoped to only this follow-up's
// candidate dimensions and gated by the same AI call budget the main
// NaturalPreferenceInput card uses.
import { useState } from 'react';
import { useAppState, useI18n } from '../state/hooks';
import { interpretPreferences, MAX_AI_CALLS_PER_INTERVIEW } from '../ai/aiService';
import { mapQuestionsForAi } from '../ai/mapQuestionsForAi';
import { QUESTION_BANKS } from '../data/questionBanks';
import type { PurposeId } from '../data/types';
import type { PendingFollowup } from '../state/types';

const FREE_TEXT_MAX_LENGTH = 120;

export function FollowupCard({ purposeId, followup }: { purposeId: PurposeId; followup: PendingFollowup }) {
  const { lang, t } = useI18n();
  const { state, dispatch } = useAppState();
  const fu = t.ai.followup;

  const [showFreeText, setShowFreeText] = useState(false);
  const [freeText, setFreeText] = useState('');
  const [freeTextStatus, setFreeTextStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  const aiCallsExhausted = state.aiCallsUsed >= MAX_AI_CALLS_PER_INTERVIEW;

  function choose(optionId: string) {
    dispatch({ type: 'RESOLVE_FOLLOWUP_CHOICE', optionId });
  }

  function skip() {
    dispatch({ type: 'DISMISS_FOLLOWUP' });
  }

  async function submitFreeText() {
    const trimmed = freeText.trim();
    if (trimmed.length === 0 || freeTextStatus === 'loading' || aiCallsExhausted) return;
    setFreeTextStatus('loading');
    dispatch({ type: 'INCREMENT_AI_CALLS' });
    // Bounded: only the candidate questions THIS follow-up named — never
    // the full bank, keeping the request small and the possible mapping
    // targets limited to what was already vetted for this clarification.
    const candidateQuestions = QUESTION_BANKS[purposeId].filter((q) => followup.candidateDimensionIds.includes(q.id));
    const result = await interpretPreferences(lang, trimmed, mapQuestionsForAi(candidateQuestions, lang));
    if (result.status === 'ok' && result.interpreted.length > 0) {
      for (const item of result.interpreted) {
        if (item.confidence === 'low') continue; // same confidence rule as the main card
        dispatch({ type: 'SET_ANSWER', questionId: item.questionId, value: item.value, provenance: 'ai_followup', confidence: item.confidence });
      }
      dispatch({ type: 'DISMISS_FOLLOWUP' });
    } else {
      setFreeTextStatus('error');
      return;
    }
    setFreeTextStatus('idle');
  }

  // Phase 16.5 TRUE adaptive-interview pass — Section 10: when the AI
  // itself decided a free-text clarification is more useful than a fixed
  // choice, the text input IS the primary UI, not a secondary escape
  // hatch behind a toggle (options is empty for this questionType — see
  // adaptive/useAdaptiveInterview.ts's toPendingFollowup).
  const isFreeTextPrimary = followup.questionType === 'free_text';

  return (
    <div className="ai-followup-card">
      <p className="ai-followup-prompt">{followup.prompt[lang]}</p>
      {followup.options.length > 0 && (
        <div className="ai-followup-options">
          {followup.options.map((opt) => (
            <button key={opt.id} type="button" className="btn btn-ghost btn-sm ai-followup-option" onClick={() => choose(opt.id)}>
              {opt.label[lang]}
            </button>
          ))}
        </div>
      )}

      {followup.allowFreeText && !isFreeTextPrimary && !showFreeText && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowFreeText(true)}>
          {fu.freeTextToggle}
        </button>
      )}

      {(isFreeTextPrimary || showFreeText) && (
        <div className="ai-followup-freetext">
          <textarea
            className="ai-interpret-textarea"
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            placeholder={fu.freeTextPlaceholder}
            maxLength={FREE_TEXT_MAX_LENGTH}
            rows={2}
            aria-label={fu.freeTextToggle}
          />
          {freeTextStatus === 'error' && (
            <p className="ai-interpret-note" aria-live="polite">
              {fu.freeTextError}
            </p>
          )}
          <div className="ai-interpret-actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={submitFreeText}
              disabled={freeText.trim().length === 0 || freeTextStatus === 'loading' || aiCallsExhausted}
            >
              {freeTextStatus === 'loading' ? fu.freeTextLoading : fu.freeTextSubmit}
            </button>
          </div>
        </div>
      )}

      <div className="ai-interpret-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={skip}>
          {fu.skip}
        </button>
      </div>
    </div>
  );
}
