// Phase 16.5 completion pass — renders the one currently pending
// contextual follow-up (see adaptive/followupTemplates.ts and
// state/types.ts's PendingFollowup doc comment for the full
// architecture). The normal path renders the AI-generated question in
// the same accepted card/option controls as the deterministic interview.
// Any free-text interpretation remains scoped to this turn's candidate
// dimensions and to the same AI call budget as NaturalPreferenceInput.
import { useState } from 'react';
import { useAppState, useI18n } from '../state/hooks';
import { Icon } from './Icon';
import { interpretPreferences, MAX_AI_CALLS_PER_INTERVIEW } from '../ai/aiService';
import { mapQuestionsForAi } from '../ai/mapQuestionsForAi';
import { QUESTION_BANKS } from '../data/questionBanks';
import type { PurposeId } from '../data/types';
import type { PendingFollowup } from '../state/types';

const FREE_TEXT_MAX_LENGTH = 120;

export function FollowupCard({
  purposeId,
  followup,
  advancing = false,
  onAdvanceStart,
}: {
  purposeId: PurposeId;
  followup: PendingFollowup;
  advancing?: boolean;
  onAdvanceStart?: (followup: PendingFollowup) => void;
}) {
  const { lang, t } = useI18n();
  const { state, dispatch } = useAppState();
  const fu = t.ai.followup;

  const [showFreeText, setShowFreeText] = useState(false);
  const [freeText, setFreeText] = useState('');
  const [freeTextStatus, setFreeTextStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [validation, setValidation] = useState('');

  const aiCallsExhausted = state.aiCallsUsed >= MAX_AI_CALLS_PER_INTERVIEW;

  function choose(optionId: string) {
    if (advancing) return;
    setSelectedOptionId(optionId);
    setValidation('');
  }

  function confirmChoice() {
    if (advancing) return;
    if (!selectedOptionId) {
      setValidation(t.quiz.validation);
      return;
    }
    onAdvanceStart?.(followup);
    dispatch({ type: 'RESOLVE_FOLLOWUP_CHOICE', optionId: selectedOptionId });
  }

  function skip() {
    if (advancing) return;
    onAdvanceStart?.(followup);
    dispatch({ type: 'DISMISS_FOLLOWUP' });
  }

  async function submitFreeText() {
    const trimmed = freeText.trim();
    if (trimmed.length === 0 || freeTextStatus === 'loading' || aiCallsExhausted || advancing) return;
    setFreeTextStatus('loading');
    dispatch({ type: 'INCREMENT_AI_CALLS' });
    // Bounded: only the candidate questions THIS follow-up named — never
    // the full bank, keeping the request small and the possible mapping
    // targets limited to what was already vetted for this clarification.
    const candidateQuestions = QUESTION_BANKS[purposeId].filter((q) => followup.candidateDimensionIds.includes(q.id));
    const result = await interpretPreferences(lang, trimmed, mapQuestionsForAi(candidateQuestions, lang));
    if (result.status === 'ok' && result.interpreted.length > 0) {
      onAdvanceStart?.(followup);
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

  let optsClass = 'q-options';
  if (followup.options.length <= 2) optsClass += ' single-col';
  else if (followup.options.length === 3) optsClass += ' cols-3';

  return (
    <>
      <div
        className="q-card"
        role={followup.options.length > 0 ? 'radiogroup' : undefined}
        aria-label={followup.prompt[lang]}
        aria-busy={advancing || freeTextStatus === 'loading'}
      >
        <div className="q-eyebrow">{t.purposes[purposeId].n}</div>
        <h2 className="q-text">{followup.prompt[lang]}</h2>
        {followup.options.length > 0 && (
          <div className={optsClass}>
            {followup.options.map((opt) => {
              const selected = opt.id === selectedOptionId;
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`q-option${selected ? ' selected' : ''}`}
                  role="radio"
                  aria-checked={selected}
                  disabled={advancing}
                  onClick={() => choose(opt.id)}
                >
                  <span className="radio" />
                  <span className="opt-text">
                    <span className="opt-label">{opt.label[lang]}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {followup.allowFreeText && !isFreeTextPrimary && !showFreeText && (
          <button type="button" className="btn btn-ghost btn-sm ai-followup-toggle" onClick={() => setShowFreeText(true)} disabled={advancing}>
            {fu.freeTextToggle}
          </button>
        )}

        {(isFreeTextPrimary || showFreeText) && (
          <div className="ai-followup-freetext">
            <textarea
              className="ai-interpret-textarea"
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
            // impeccable critique finding: the OLD placeholder/aria-label
            // pair was authored for the quietness template's escape
            // hatch specifically ("places without a lot of people…" /
            // "None of these? describe it..."). Reused verbatim for an
            // AI-generated free_text turn about an unrelated topic (e.g.
            // cultural novelty), both read as mismatched — a generic
            // placeholder and the turn's own prompt as the accessible
            // name fit any topic instead.
              placeholder={isFreeTextPrimary ? fu.aiPromptPlaceholder : fu.freeTextPlaceholder}
              maxLength={FREE_TEXT_MAX_LENGTH}
              rows={2}
              aria-label={isFreeTextPrimary ? followup.prompt[lang] : fu.freeTextToggle}
              disabled={advancing}
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
                disabled={freeText.trim().length === 0 || freeTextStatus === 'loading' || aiCallsExhausted || advancing}
              >
                {freeTextStatus === 'loading' ? fu.freeTextLoading : fu.freeTextSubmit}
              </button>
            </div>
          </div>
        )}

        <div className="quiz-validation" aria-live="polite">
          {validation}
        </div>
        {advancing && <span className="visually-hidden" aria-live="polite">{t.ai.turn.loading}</span>}
      </div>

      <div className="quiz-nav">
        <button type="button" className="btn btn-ghost" onClick={skip} disabled={advancing}>
          {fu.skip}
        </button>
        {!isFreeTextPrimary && (
          <button type="button" className="btn btn-primary" onClick={confirmChoice} disabled={advancing}>
            {t.quiz.next} <Icon name="arrowEnd" size={16} />
          </button>
        )}
      </div>
    </>
  );
}
