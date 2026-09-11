// Ports renderQuiz() and its quiz-option/back/next event bindings from
// wejhaty.html.
//
// Phase 16.5 TRUE adaptive-interview pass — this now branches between two
// structurally distinct interview drivers, chosen by `effectiveInterviewStatus`:
//
// 'active'   — the NORMAL path (Section 0). adaptive/useAdaptiveInterview.ts
//              drives the AI next-turn loop; this component only renders
//              whatever it decides (a generated question via FollowupCard,
//              a loading state while one is being decided, or a completion
//              card) and never itself picks the next dimension to ask about.
// 'fallback' — Phase 15, FAILURE-FALLBACK ONLY (Section 19): the exact
//              original deterministic path/qIndex/selectNextQuestion-driven
//              question card, UNCHANGED, continuing from the CURRENT
//              confirmed profile. Entered either because the AI capability
//              was never configured (see ai/aiService.ts's isAiConfigured)
//              or because a real AI next-turn call failed/errored/timed
//              out/returned something invalid/hit quota — see
//              state/reducer.ts's SET_INTERVIEW_FALLBACK, a one-way switch.
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAppState, useI18n } from '../state/hooks';
import { QUESTION_BANKS } from '../data/questionBanks';
import type { PurposeId } from '../data/types';
import { QuestionOption } from '../components/QuestionOption';
import { ProgressBar } from '../components/ProgressBar';
import { Icon } from '../components/Icon';
import { rankDestinations } from '../engine';
import { NaturalPreferenceInput } from '../components/NaturalPreferenceInput';
import { FollowupCard } from '../components/FollowupCard';
import { selectNextQuestion, useAdaptiveInterview } from '../adaptive';
import { isAiConfigured } from '../ai/aiService';
import { buildLocationContext } from '../ai/buildLocationContext';
import { buildTravelProfile } from '../profile/travelProfile';
import { summarizeAnswer } from '../data/summaryMeta';
import type { PendingFollowup } from '../state/types';

function isPurposeId(value: string | undefined): value is PurposeId {
  return !!value && Object.prototype.hasOwnProperty.call(QUESTION_BANKS, value);
}

export function Quiz() {
  const { purpose: purposeParam } = useParams<{ purpose: string }>();
  const navigate = useNavigate();
  const { state, dispatch } = useAppState();
  const { lang, t } = useI18n();
  const [validation, setValidation] = useState('');
  const [advancingFollowup, setAdvancingFollowup] = useState<{
    purposeId: PurposeId;
    turnCount: number;
    followup: PendingFollowup;
  } | null>(null);

  const validPurpose = isPurposeId(purposeParam);
  // True once SYNC_QUIZ_PURPOSE's effect (below) has landed — before that,
  // `state.answers`/`askedDimensionIds`/etc still belong to whatever
  // purpose was active previously, so the adaptive-interview hook must
  // not act on them yet (see its own purposeId-gating below).
  const purposeSynced = validPurpose && state.purpose === purposeParam;

  // Land on /quiz/:purpose fresh (direct nav, back/forward, or a purpose
  // switch that didn't go through startQuiz) — sync context to the URL.
  useEffect(() => {
    if (validPurpose && state.purpose !== purposeParam) {
      dispatch({ type: 'SYNC_QUIZ_PURPOSE', purpose: purposeParam });
    }
  }, [validPurpose, purposeParam, state.purpose, dispatch]);

  // Phase 16.5 completion pass — location integration, same derivation
  // NaturalPreferenceInput.tsx uses for its own request: a coarse country
  // NAME only, never a coordinate (see ai/buildLocationContext.ts).
  // Needed here too since the AI next-turn loop runs independently of
  // whether the traveler ever touches that card's textbox.
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

  // Phase 16.5 TRUE adaptive-interview pass — "never configured" is
  // treated as ordinary AI unavailability (Sections 19-20): render
  // exactly the fallback UI from the first tick, rather than flashing an
  // AI-loading state that can never resolve. A real mid-interview
  // failure instead flips `state.interviewStatus` itself (one-way, see
  // reducer.ts) once useAdaptiveInterview reports it.
  const aiConfigured = isAiConfigured();
  const effectiveInterviewStatus: 'active' | 'fallback' = aiConfigured ? state.interviewStatus : 'fallback';

  // Hooks must run unconditionally, before the early returns below — a
  // null purposeId (invalid route, or purpose not yet synced) makes the
  // hook a safe no-op rather than acting on stale/foreign-purpose state.
  useAdaptiveInterview(
    purposeSynced ? (purposeParam as PurposeId) : null,
    purposeSynced ? t.purposes[purposeParam as PurposeId].n : '',
    lang,
    originCountry,
    {
      answers: state.answers,
      askedDimensionIds: state.askedDimensionIds,
      interviewStatus: effectiveInterviewStatus,
      interviewComplete: state.interviewComplete,
      followup: state.followup,
      turnCount: state.turnCount,
    },
    dispatch,
  );

  if (!validPurpose) return <Navigate to="/purpose" replace />;
  if (!purposeSynced) return null; // one tick until the sync effect above lands

  const qz = t.quiz;
  const questions = QUESTION_BANKS[purposeParam];
  const purposeName = t.purposes[purposeParam].n;

  const onBackToPurpose = () => navigate('/purpose');

  // ---- 'active' mode: the AI next-turn loop is the normal driver -----------
  if (effectiveInterviewStatus === 'active') {
    const travelProfile = buildTravelProfile(purposeParam, state);
    const rankingFields = travelProfile.fields.filter((f) => f.classification === 'RANKING_SUPPORTED');
    const rankingResolved = rankingFields.filter((f) => f.status === 'confirmed').length;
    // Section 26 — truthful, profile-completion-based progress: never a
    // fixed "Question X of Y" promise the AI-driven path cannot honor
    // (the AI may finish early, or spend an extra turn clarifying).
    const progressPct = rankingFields.length > 0 ? Math.round((rankingResolved / rankingFields.length) * 100) : 100;

    const confirmedEntries = travelProfile.fields
      .filter((f) => f.classification === 'RANKING_SUPPORTED' && f.status === 'confirmed')
      // Section 32 — persistent summaries always come from the canonical
      // summaryMeta, never the AI turn's own transient prompt/option text.
      .map((f) => ({ id: f.questionId, label: summarizeAnswer(purposeParam, f.questionId, f.value!, lang) }));
    const followupWhileAdvancing =
      !state.followup &&
      advancingFollowup?.purposeId === purposeParam &&
      advancingFollowup.turnCount === state.turnCount
        ? advancingFollowup.followup
        : null;
    const visibleFollowup = state.followup ?? followupWhileAdvancing;

    return (
      <div className="quiz-wrap">
        <NaturalPreferenceInput purposeId={purposeParam} questions={questions} />
        <div className="quiz-top">
          <span className="quiz-count">
            {t.ai.turn.progressLabel} {rankingResolved} {qz.of} {rankingFields.length}
          </span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onBackToPurpose}>
            {qz.changePurpose}
          </button>
        </div>
        <ProgressBar percent={progressPct} />

        {state.interviewComplete ? (
          <div key="complete" className="ai-turn-card ai-turn-complete">
            <h2 className="q-text">{t.ai.turn.completeTitle}</h2>
            <p className="ai-interpret-subtitle">{t.ai.turn.completeBody}</p>
            {confirmedEntries.length > 0 && (
              <ul className="ai-turn-confirmed-list">
                {confirmedEntries.map((entry) => (
                  <li key={entry.id}>{entry.label}</li>
                ))}
              </ul>
            )}
            <div className="quiz-nav">
              <button type="button" className="btn btn-ghost" onClick={onBackToPurpose}>
                <Icon name="arrowStart" size={16} /> {qz.changePurpose}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const results = rankDestinations(purposeParam, state.answers);
                  dispatch({ type: 'SET_RESULTS', results });
                  navigate('/results');
                }}
              >
                {qz.seeResults} <Icon name="arrowEnd" size={16} />
              </button>
            </div>
          </div>
        ) : visibleFollowup ? (
          <FollowupCard
            key={visibleFollowup.templateId}
            purposeId={purposeParam}
            followup={visibleFollowup}
            advancing={!state.followup}
            onAdvanceStart={(followup) => setAdvancingFollowup({ purposeId: purposeParam, turnCount: state.turnCount, followup })}
          />
        ) : (
          <div className="q-card ai-turn-loading" aria-live="polite">
            {t.ai.turn.loading}
          </div>
        )}
      </div>
    );
  }

  // ---- 'fallback' mode: the ORIGINAL Phase 15 deterministic bank card ------
  // Phase 16.5 — `total` can no longer be the fixed bank length: a
  // confirmed natural-language interpretation genuinely REMOVES its
  // question from the remaining interview (adaptive/selectNextQuestion.ts
  // now skips any already-answered id), so the true number of
  // questions the traveler will actually see shrinks. Truthful,
  // recomputed-every-render denominator: bank size minus every
  // dimension already satisfied by a confirmed interpretation that
  // hasn't been walked through `path` — never less than `path.length`
  // itself (questions already shown are never un-counted, even if
  // more get satisfied afterward).
  const aiSatisfiedNotInPath = questions.filter(
    (qq) => state.satisfaction[qq.id] === 'ai_interpreted' && !state.path.includes(qq.id),
  ).length;
  const total = Math.max(questions.length - aiSatisfiedNotInPath, state.path.length, 1);
  const qIndex = Math.min(state.qIndex, total - 1);
  // Phase 15 — Adaptive Questions: the question actually shown at this
  // position is whichever id adaptive/selectNextQuestion.ts placed at
  // state.path[qIndex] (computed as the user progresses, one question
  // at a time — see reducer.ts), NOT questions[qIndex] by fixed array
  // order. The questions[qIndex] fallback only matters for the one
  // render tick between a purpose changing and SYNC_QUIZ_PURPOSE's
  // effect populating state.path (see the effect above).
  const q = questions.find((x) => x.id === state.path[qIndex]) ?? questions[qIndex];
  const progressPct = Math.round((qIndex / total) * 100 + (100 / total) * 0.15);
  const selected = state.answers[q.id];

  const hasDesc = q.options.some((o) => o.desc);
  let optsClass = 'q-options';
  if (hasDesc || q.options.length <= 2) optsClass += ' single-col';
  else if (q.options.length === 3) optsClass += ' cols-3';

  const onSelect = (value: string | number) => {
    dispatch({ type: 'SET_ANSWER', questionId: q.id, value });
    setValidation('');
  };

  const onBack = () => {
    if (qIndex > 0) dispatch({ type: 'PREV_QUESTION' });
  };

  // Phase 16.5 — "is this the last question" can no longer be a fixed
  // `qIndex < total - 1` comparison: `total` is now a truthful
  // ESTIMATE (see above), not a guaranteed exact count, and
  // overshooting it would call NEXT_QUESTION past the true end, where
  // the reducer safely no-ops (see reducer.ts) — leaving the traveler
  // stuck re-clicking "Next" on the final question forever. Determine
  // the real answer the same way the reducer's own NEXT_QUESTION does:
  // reuse a cached path entry if one exists, otherwise ask
  // selectNextQuestion directly (state.answers already includes this
  // question's own answer once selected — onSelect dispatches
  // synchronously before Next can be clicked). Shared by the button
  // label below and onNext's own decision, so they can never disagree.
  const hasMoreQuestions = qIndex + 1 < state.path.length || selectNextQuestion(questions, state.answers, state.path) !== null;

  const onNext = () => {
    if (state.answers[q.id] === undefined) {
      setValidation(qz.validation);
      return;
    }
    if (hasMoreQuestions) {
      dispatch({ type: 'NEXT_QUESTION' });
    } else {
      const results = rankDestinations(purposeParam, state.answers);
      dispatch({ type: 'SET_RESULTS', results });
      navigate('/results');
    }
  };

  return (
    <div className="quiz-wrap">
      {/* Phase 16.5 UX correction: the AI natural-language entry is NOT
          itself a numbered questionnaire question — it must read as its
          own section, with the interview's question progress belonging
          to the actual question card below it, not above the whole
          page. Order is now: AI entry (+ its own review/confirmation
          UI) -> progress -> question card. This holds in every state
          (before/after AI use, after elimination, during fallback)
          because NaturalPreferenceInput's own internal state governs
          its content, while `total`/`qIndex` below are recomputed from
          `state` on every render regardless of what the AI card is
          doing. See ProgressBar.test.tsx / Quiz.test.tsx for the
          regression proving this order structurally (DOM position, not
          just visual margin). */}
      <NaturalPreferenceInput purposeId={purposeParam} questions={questions} />
      <div className="quiz-top">
        <span className="quiz-count">
          {qz.question} {qIndex + 1} {qz.of} {total} — {purposeName}
        </span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBackToPurpose}>
          {qz.changePurpose}
        </button>
      </div>
      <ProgressBar percent={progressPct} />
      <div className="q-card" role="radiogroup" aria-label={lang === 'ar' ? q.text.ar : q.text.en}>
        <div className="q-eyebrow">{purposeName}</div>
        <h2 className="q-text">{lang === 'ar' ? q.text.ar : q.text.en}</h2>
        <div className={optsClass}>
          {q.options.map((o) => (
            <QuestionOption
              key={String(o.value)}
              option={o}
              lang={lang}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
        </div>
        <div className="quiz-validation" aria-live="polite">
          {validation}
        </div>
      </div>
      <div className="quiz-nav">
        <button type="button" className="btn btn-ghost" onClick={onBack} disabled={qIndex === 0}>
          <Icon name="arrowStart" size={16} /> {qz.back}
        </button>
        <button type="button" className="btn btn-primary" onClick={onNext}>
          {hasMoreQuestions ? qz.next : qz.seeResults} <Icon name="arrowEnd" size={16} />
        </button>
      </div>
    </div>
  );
}
