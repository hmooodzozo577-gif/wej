// Ports renderQuiz() and its quiz-option/back/next event bindings from
// wejhaty.html.
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
import { selectNextQuestion } from '../adaptive';

function isPurposeId(value: string | undefined): value is PurposeId {
  return !!value && Object.prototype.hasOwnProperty.call(QUESTION_BANKS, value);
}

export function Quiz() {
  const { purpose: purposeParam } = useParams<{ purpose: string }>();
  const navigate = useNavigate();
  const { state, dispatch } = useAppState();
  const { lang, t } = useI18n();
  const [validation, setValidation] = useState('');

  const validPurpose = isPurposeId(purposeParam);

  // Land on /quiz/:purpose fresh (direct nav, back/forward, or a purpose
  // switch that didn't go through startQuiz) — sync context to the URL.
  useEffect(() => {
    if (validPurpose && state.purpose !== purposeParam) {
      dispatch({ type: 'SYNC_QUIZ_PURPOSE', purpose: purposeParam });
    }
  }, [validPurpose, purposeParam, state.purpose, dispatch]);

  if (!validPurpose) return <Navigate to="/purpose" replace />;
  if (state.purpose !== purposeParam) return null; // one tick until the sync effect above lands

  const qz = t.quiz;
  const questions = QUESTION_BANKS[purposeParam];
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
  const purposeName = t.purposes[purposeParam].n;

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
      <div className="quiz-top">
        <span className="quiz-count">
          {qz.question} {qIndex + 1} {qz.of} {total} — {purposeName}
        </span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/purpose')}>
          {qz.changePurpose}
        </button>
      </div>
      <ProgressBar percent={progressPct} />
      {/* Phase 16 — Capability A. Full purpose bank (all EXISTING
          questions, adaptive order or not) so a proposal can only ever
          land on a dimension the quiz itself already asks about. Purely
          additive: dismissing/ignoring this box changes nothing about
          the quiz below it. */}
      <NaturalPreferenceInput questions={questions} />
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
