// Phase 16 — AI API Integration, Capability A (natural preference
// interpretation). Phase 16.5 — CONFIRMED interpretations now genuinely
// remove their question from the remaining interview (not merely
// pre-select it) — see adaptive/selectNextQuestion.ts, which skips any
// question that already has an answer. This component is still fully
// optional: the questionnaire works perfectly without it, and every
// mutation it makes goes through the exact same reducer action a normal
// question answer does (SET_ANSWER), just tagged with provenance
// 'ai_interpreted' so the interview UI knows why.
//
// Confidence rule (Phase 16.5, task's own safety requirement): the AI
// is never trusted to have eliminated a question just because it
// proposed a mapping. A proposal is pre-checked (and so applied by
// default) only when the model's own reported confidence is 'high' or
// 'medium' — a 'low'-confidence guess is shown, clearly marked, but
// left UNCHECKED, so it is never silently applied. The traveler can
// still check and apply it manually — that is an explicit confirmation,
// not a silent elimination.
import { useEffect, useState, type FormEvent } from 'react';
import { useAppState, useI18n } from '../state/hooks';
import { interpretPreferences, MAX_AI_CALLS_PER_INTERVIEW } from '../ai/aiService';
import { mapQuestionsForAi } from '../ai/mapQuestionsForAi';
import { buildLocationContext } from '../ai/buildLocationContext';
import { summarizeAnswer } from '../data/summaryMeta';
import type { InterpretedPreference } from '../ai/types';
import type { PurposeId, Question } from '../data/types';
import { Icon } from './Icon';

type Status = 'idle' | 'loading' | 'proposed' | 'none' | 'unavailable' | 'error';

export function NaturalPreferenceInput({ purposeId, questions }: { purposeId: PurposeId; questions: Question[] }) {
  const { lang, t } = useI18n();
  const { state, dispatch } = useAppState();
  const ai = t.ai.interpret;

  const [text, setText] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [proposals, setProposals] = useState<InterpretedPreference[]>([]);
  const [unmapped, setUnmapped] = useState<string[]>([]);
  // Completion pass — location integration. Resolved ONCE per grant, a
  // plain country name only (see buildLocationContext.ts) — never a
  // coordinate reaches this component's own state or the AI request.
  // undefined (never resolved / no permission) is a fully normal,
  // fully supported state — the interview never depends on it.
  const [originCountry, setOriginCountry] = useState<string | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    buildLocationContext(state.location, lang).then((name) => {
      if (!cancelled) setOriginCountry(name);
    });
    return () => {
      cancelled = true;
    };
  }, [state.location, lang]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Phase 16.5 UX correction: this MUST be the centralized standalone-
  // summary builder (data/summaryMeta.ts), never `question.text +
  // option.label` — see that module's doc comment for the real
  // production bug this replaced ("ما الذي تفضله؟ — مزيج من الاثنين"
  // read alone answers nothing: a mix of WHAT?).
  function labelFor(questionId: string, value: string | number): string {
    return summarizeAnswer(purposeId, questionId, value, lang);
  }

  // Phase 16.5 — never ask the AI to interpret a dimension we already
  // know (direct answer or an earlier confirmed interpretation) — both
  // a real cost saving and the task's own "AI does not ask for
  // dimensions already satisfied" requirement.
  const openQuestions = questions.filter((q) => state.answers[q.id] === undefined);

  // Completion pass — hard AI call budget (aiService.ts's
  // MAX_AI_CALLS_PER_INTERVIEW). Checked here AND by FollowupCard's own
  // scoped free-text call, since both draw from the same counter.
  const aiCallsExhausted = state.aiCallsUsed >= MAX_AI_CALLS_PER_INTERVIEW;

  // Phase 16.5 TRUE adaptive-interview pass — this card no longer offers
  // its own deterministic contextual follow-up after a submission (that
  // was Task 3's rejected "deterministic classifier picks the next
  // clarification" architecture — see Section 0/4). Confirming or
  // dismissing an interpretation simply updates `answers`/`satisfaction`;
  // adaptive/useAdaptiveInterview.ts (mounted in Quiz.tsx, so it runs
  // even if this card is never touched) picks up from there and decides
  // the next AI turn itself, over the FULL dimension catalog rather than
  // only the fragments this one card's own `unmapped` output happened to
  // contain.

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (status === 'loading' || text.trim().length === 0 || aiCallsExhausted) return;
    setStatus('loading');
    dispatch({ type: 'INCREMENT_AI_CALLS' });
    const result = await interpretPreferences(lang, text, mapQuestionsForAi(openQuestions, lang), originCountry);
    if (result.status === 'ok') {
      setUnmapped(result.unmapped);
      if (result.interpreted.length === 0) {
        setStatus('none');
        return;
      }
      setProposals(result.interpreted);
      // Confidence rule: only 'high'/'medium' proposals start checked.
      setSelected(new Set(result.interpreted.filter((p) => p.confidence !== 'low').map((p) => p.questionId)));
      setStatus('proposed');
    } else if (result.status === 'unavailable') {
      setStatus('unavailable');
    } else {
      setStatus('error');
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onApply() {
    for (const p of proposals) {
      if (selected.has(p.questionId)) {
        dispatch({ type: 'SET_ANSWER', questionId: p.questionId, value: p.value, provenance: 'ai_interpreted', confidence: p.confidence });
      }
    }
    reset();
  }

  function reset() {
    setStatus('idle');
    setProposals([]);
    setUnmapped([]);
    setSelected(new Set());
    setText('');
  }

  // Phase 16.5 — the persistent "already accounted for" list: every
  // question currently satisfied by a CONFIRMED interpretation OR
  // (completion pass) a resolved contextual follow-up — never the ones
  // still only proposed above, and never a direct answer. This is what
  // keeps the benefit visible for the rest of the interview, not just
  // once right after applying — and it is the only place a satisfied
  // AI-derived dimension can be removed, restoring its question.
  const satisfiedEntries = questions
    .filter((q) => state.satisfaction[q.id] === 'ai_interpreted' || state.satisfaction[q.id] === 'ai_followup')
    .map((q) => ({ id: q.id, label: labelFor(q.id, state.answers[q.id]) }));

  return (
    <div className="detail-card ai-interpret-card">
      <h3>
        <Icon name="sparkle" size={16} /> {ai.title}
      </h3>
      <p className="ai-interpret-subtitle">{ai.subtitle}</p>
      <form onSubmit={onSubmit}>
        <textarea
          className="ai-interpret-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={ai.placeholder}
          rows={2}
          maxLength={500}
          aria-label={ai.title}
        />
        <div className="ai-interpret-actions">
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={status === 'loading' || text.trim().length === 0 || aiCallsExhausted}
          >
            {status === 'loading' ? ai.loading : ai.cta}
          </button>
        </div>
      </form>

      {status === 'unavailable' && (
        <p className="ai-interpret-note" aria-live="polite">
          {ai.unavailable}
        </p>
      )}
      {status === 'error' && (
        <p className="ai-interpret-note" aria-live="polite">
          {ai.error}
        </p>
      )}
      {status === 'none' && (
        <p className="ai-interpret-note" aria-live="polite">
          {ai.noneFound}
        </p>
      )}

      {status === 'proposed' && (
        <div className="ai-interpret-proposals">
          <div className="ai-interpret-proposed-title">{ai.proposedTitle}</div>
          {proposals.map((p) => (
            <label key={p.questionId} className="ai-interpret-proposal">
              <input type="checkbox" checked={selected.has(p.questionId)} onChange={() => toggle(p.questionId)} />
              <span>{labelFor(p.questionId, p.value)}</span>
              {p.confidence === 'low' && <span className="ai-interpret-low-confidence">{ai.lowConfidence}</span>}
            </label>
          ))}
          {unmapped.length > 0 && <p className="ai-interpret-note">{ai.unmappedNote}</p>}
          <div className="ai-interpret-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={onApply} disabled={selected.size === 0}>
              {ai.apply}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
              {ai.dismiss}
            </button>
          </div>
        </div>
      )}

      {satisfiedEntries.length > 0 && (
        <div className="ai-satisfied-list">
          <div className="ai-satisfied-title">
            <Icon name="check" size={14} /> {ai.satisfiedTitle}
          </div>
          <p className="ai-satisfied-subtitle">{ai.satisfiedSubtitle}</p>
          {satisfiedEntries.map((entry) => (
            <div key={entry.id} className="ai-satisfied-chip">
              <span>{entry.label}</span>
              <button
                type="button"
                className="ai-satisfied-remove"
                aria-label={ai.remove}
                onClick={() => dispatch({ type: 'REMOVE_AI_ANSWER', questionId: entry.id })}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
