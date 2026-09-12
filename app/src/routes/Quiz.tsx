import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { selectNextQuestion } from '../adaptive';
import { Icon } from '../components/Icon';
import { ProgressBar } from '../components/ProgressBar';
import { QuestionOption } from '../components/QuestionOption';
import { QUESTION_BANKS } from '../data/questionBanks';
import type { PurposeId } from '../data/types';
import { rankDestinations } from '../engine';
import { useAppState, useI18n } from '../state/hooks';

const OPTIONAL_RESULTS_AFTER = 5;
const ANSWER_TRANSITION_MS = 140;

function isPurposeId(value: string | undefined): value is PurposeId {
  return !!value && Object.prototype.hasOwnProperty.call(QUESTION_BANKS, value);
}

export function Quiz() {
  const { purpose: purposeParam } = useParams<{ purpose: string }>();
  const navigate = useNavigate();
  const { state, dispatch } = useAppState();
  const { lang, t } = useI18n();
  const [advancing, setAdvancing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const validPurpose = isPurposeId(purposeParam);
  const purposeSynced = validPurpose && state.purpose === purposeParam;

  useEffect(() => {
    if (validPurpose && state.purpose !== purposeParam) {
      dispatch({ type: 'SYNC_QUIZ_PURPOSE', purpose: purposeParam });
    }
  }, [dispatch, purposeParam, state.purpose, validPurpose]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  if (!validPurpose) return <Navigate to="/purpose" replace />;
  if (!purposeSynced) return null;

  const questions = QUESTION_BANKS[purposeParam];
  const purposeName = t.purposes[purposeParam].n;
  const qIndex = Math.min(state.qIndex, Math.max(0, state.path.length - 1));
  const question = questions.find((item) => item.id === state.path[qIndex]) ?? questions[0];
  const answeredCount = questions.filter((item) => state.answers[item.id] !== undefined).length;
  const hasCachedNext = qIndex + 1 < state.path.length;
  const computedNext = hasCachedNext ? questions.find((item) => item.id === state.path[qIndex + 1]) ?? null : selectNextQuestion(questions, state.answers, state.path);
  const hasMoreQuestions = computedNext !== null;
  const showCheckpoint =
    answeredCount >= OPTIONAL_RESULTS_AFTER &&
    !state.questionnaireCheckpointPassed &&
    state.answers[question.id] !== undefined &&
    hasMoreQuestions;
  const progressPct = Math.max(2, Math.round((answeredCount / Math.max(questions.length, 1)) * 100));

  const finish = (answers = state.answers) => {
    const results = rankDestinations(purposeParam, answers);
    dispatch({ type: 'SET_RESULTS', results });
    navigate('/results');
  };

  const onSelect = (value: string | number) => {
    if (advancing) return;
    const answers = { ...state.answers, [question.id]: value };
    const answeredAfter = questions.filter((item) => answers[item.id] !== undefined).length;
    const nextAfterAnswer = hasCachedNext
      ? computedNext
      : selectNextQuestion(questions, answers, state.path);

    dispatch({ type: 'SET_ANSWER', questionId: question.id, value });
    if (answeredAfter >= OPTIONAL_RESULTS_AFTER && !state.questionnaireCheckpointPassed && nextAfterAnswer) {
      return;
    }

    setAdvancing(true);
    timer.current = setTimeout(() => {
      if (nextAfterAnswer) dispatch({ type: 'NEXT_QUESTION' });
      else finish(answers);
      setAdvancing(false);
      timer.current = null;
    }, ANSWER_TRANSITION_MS);
  };

  const hasDescription = question.options.some((option) => option.desc);
  let optionsClass = 'q-options';
  if (hasDescription || question.options.length <= 2) optionsClass += ' single-col';
  else if (question.options.length === 3) optionsClass += ' cols-3';

  return (
    <div className="quiz-wrap">
      <div className="quiz-top">
        <span className="quiz-count">
          {t.quiz.question} {qIndex + 1} {t.quiz.of} {questions.length} — {purposeName}
        </span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/purpose')}>
          {t.quiz.changePurpose}
        </button>
      </div>
      <ProgressBar percent={progressPct} />

      {showCheckpoint ? (
        <div className="q-card quiz-checkpoint">
          <div className="q-eyebrow">{purposeName}</div>
          <h2 className="q-text">{t.quiz.checkpointTitle}</h2>
          <p>{t.quiz.checkpointBody}</p>
          <div className="quiz-checkpoint-actions">
            <button type="button" className="btn btn-primary" onClick={() => finish()}>
              {t.quiz.showResultsNow} <Icon name="arrowEnd" size={16} />
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => dispatch({ type: 'CONTINUE_QUESTIONS' })}>
              {t.quiz.continueQuestions}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div
            className="q-card"
            role="radiogroup"
            aria-label={lang === 'ar' ? question.text.ar : question.text.en}
            aria-busy={advancing}
          >
            <div className="q-eyebrow">{purposeName}</div>
            <h2 className="q-text">{lang === 'ar' ? question.text.ar : question.text.en}</h2>
            <div className={optionsClass}>
              {question.options.map((option) => (
                <QuestionOption
                  key={String(option.value)}
                  option={option}
                  lang={lang}
                  selected={state.answers[question.id]}
                  onSelect={onSelect}
                />
              ))}
            </div>
            <div className="quiz-next-status" aria-live="polite">
              {advancing ? <><span className="quiz-spinner" aria-hidden="true" /> {t.quiz.preparingNext}</> : null}
            </div>
          </div>
          <div className="quiz-nav">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => dispatch({ type: 'PREV_QUESTION' })}
              disabled={qIndex === 0 || advancing}
            >
              <Icon name="arrowStart" size={16} /> {t.quiz.back}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
