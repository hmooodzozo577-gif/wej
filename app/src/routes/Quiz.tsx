import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { selectNextQuestion } from '../adaptive';
import { Icon } from '../components/Icon';
import { ProgressBar } from '../components/ProgressBar';
import { QuestionOption } from '../components/QuestionOption';
import { effectiveQuestionBank, QUESTION_BANKS } from '../data/questionBanks';
import type { PurposeId } from '../data/types';
import { rankDestinations } from '../engine';
import { useAppState, useI18n } from '../state/hooks';
import { trackEvent } from '../telemetry/productDataClient';
import { PassportSelect } from '../components/PassportSelect';
import { useVisaProviderActive } from '../visa/useVisaRequirements';
import { waitForLocationSettle } from '../state/waitForLocationSettle';
import { CompassMark } from '../components/CompassMark';

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
  const [motionDirection, setMotionDirection] = useState<'forward' | 'back'>('forward');
  // Phase 16 workstream A — the geolocation/quiz race condition. See
  // waitForLocationSettle.ts for the full root-cause explanation: this is
  // shown only in the narrow window where the quiz would otherwise finish
  // while a geolocation request that was actually granted is still
  // resolving, so that moment gets a bounded chance to complete instead of
  // silently never asking the location-dependent question.
  const [waitingForLocation, setWaitingForLocation] = useState(false);
  // Always-current mirror of `state`, readable from inside the async gap
  // in onSelect() below (after an `await`, the closed-over `state` from
  // the render that started the handler is stale — this ref is not).
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  // Item #12D — the passport question is the LAST step of the questionnaire,
  // not a card below the results. It has to be answerable while the ranking
  // is still being decided; below the results it could not affect anything.
  const [passportStep, setPassportStep] = useState(false);
  // Acceptance item #5 — asked once, fails closed: until a Worker actually
  // reports a configured provider, the step says the personalization is not
  // running rather than implying it is.
  const visaProviderActive = useVisaProviderActive();
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

  const questions = effectiveQuestionBank(purposeParam, !!state.location.coords);
  const reachableQuestionCount = new Set(questions.map((item) => item.profileKey ?? item.id)).size;
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
  const progressPct = Math.max(2, Math.round((answeredCount / Math.max(reachableQuestionCount, 1)) * 100));

  /** Ends the questionnaire and shows the passport step. Ranking happens
   *  after it, so a passport chosen there is available to the visa layer. */
  const requestResults = () => {
    setPassportStep(true);
  };

  const finish = (answers = state.answers) => {
    const results = rankDestinations(purposeParam, answers, state.location.coords);
    trackEvent('quiz_results_generated', {
      purpose: purposeParam,
      answerCount: Object.keys(answers).length,
      results: results.slice(0, 5).map((item) => ({ countryCode: item.dest.countryCode, score: item.score })),
    }, { path: `/quiz/${purposeParam}`, locale: lang });
    dispatch({ type: 'SET_RESULTS', results });
    navigate('/results');
  };

  const onSelect = async (value: string | number) => {
    if (advancing) return;
    const answers = { ...state.answers, [question.id]: value };
    const answeredAfter = questions.filter((item) => answers[item.id] !== undefined).length;
    let nextAfterAnswer = hasCachedNext
      ? computedNext
      : selectNextQuestion(questions, answers, state.path);

    dispatch({ type: 'SET_ANSWER', questionId: question.id, value });
    trackEvent('quiz_answer', { purpose: purposeParam, questionId: question.id, value, questionNumber: qIndex + 1 }, { path: `/quiz/${purposeParam}`, locale: lang });
    if (answeredAfter >= OPTIONAL_RESULTS_AFTER && !state.questionnaireCheckpointPassed && nextAfterAnswer) {
      return;
    }

    // The one genuinely irreversible decision: about to declare "no more
    // questions" and move to results while a geolocation request that was
    // actually granted permission is still resolving. Every other point in
    // the flow already re-derives eligibility fresh from live location
    // state on its own (effectiveQuestionBank() is recomputed on every
    // render and inside the reducer's own advance()), so only this one
    // spot needs to hold briefly rather than finalize immediately.
    if (!nextAfterAnswer && stateRef.current.location.status === 'requesting') {
      setWaitingForLocation(true);
      await waitForLocationSettle(() => stateRef.current.location.status);
      setWaitingForLocation(false);
      const freshQuestions = effectiveQuestionBank(purposeParam, !!stateRef.current.location.coords);
      nextAfterAnswer = selectNextQuestion(freshQuestions, answers, state.path);
    }

    setAdvancing(true);
    setMotionDirection('forward');
    timer.current = setTimeout(() => {
      if (nextAfterAnswer) dispatch({ type: 'NEXT_QUESTION' });
      else requestResults();
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
          {t.quiz.question} {qIndex + 1} {t.quiz.of} {reachableQuestionCount} — {purposeName}
        </span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/purpose')}>
          {t.quiz.changePurpose}
        </button>
      </div>
      <ProgressBar percent={progressPct} />

      {passportStep ? (
        <div className="q-card quiz-passport">
          <h2 className="q-text">{t.passport.title}</h2>
          <p>{t.passport.body}</p>
          {/* Acceptance item #5 — the explanation, in the order a traveller
              needs it: what the answer is FOR, what it does to the results
              right now (which today is nothing, because no provider is
              live), and what we never ask for. The middle line is driven by
              the Worker's real provider state, not by a hard-coded claim. */}
          <p className="passport-why">{t.passport.purposeNote}</p>
          <p className="passport-why">
            {visaProviderActive ? t.passport.providerActiveNote : t.passport.providerInactiveNote}
          </p>
          <PassportSelect />
          <p className="city-data-note">{t.passport.privacyNote}</p>
          <div className="quiz-checkpoint-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                trackEvent('quiz_passport_choice', { chosen: state.passportCode !== null }, { path: `/quiz/${purposeParam}`, locale: lang });
                finish();
              }}
            >
              {t.passport.continueCta} <Icon name="arrowEnd" size={16} />
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                // Skipping clears any earlier choice: "skip" must mean the
                // passport plays no part, not "keep whatever was set before".
                dispatch({ type: 'SET_PASSPORT', countryCode: null });
                trackEvent('quiz_passport_choice', { chosen: false }, { path: `/quiz/${purposeParam}`, locale: lang });
                finish();
              }}
            >
              {t.passport.skip}
            </button>
          </div>
        </div>
      ) : showCheckpoint ? (
        <div className="q-card quiz-checkpoint">
          <h2 className="q-text">{t.quiz.checkpointTitle}</h2>
          <p>{t.quiz.checkpointBody}</p>
          <div className="quiz-checkpoint-actions">
            <button type="button" className="btn btn-primary" onClick={() => {
              trackEvent('quiz_checkpoint_choice', { choice: 'results', answerCount: answeredCount }, { path: `/quiz/${purposeParam}`, locale: lang });
              requestResults();
            }}>
              {t.quiz.showResultsNow} <Icon name="arrowEnd" size={16} />
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => {
              trackEvent('quiz_checkpoint_choice', { choice: 'continue', answerCount: answeredCount }, { path: `/quiz/${purposeParam}`, locale: lang });
              dispatch({ type: 'CONTINUE_QUESTIONS' });
            }}>
              {t.quiz.continueQuestions}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div
            key={question.id}
            className={`q-card quiz-question-card motion-${motionDirection}`}
            role="radiogroup"
            aria-label={lang === 'ar' ? question.text.ar : question.text.en}
            aria-busy={advancing}
          >
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
              {waitingForLocation ? (
                <><CompassMark className="quiz-spinner" size={22} /> {t.quiz.waitingForLocation}</>
              ) : advancing ? (
                <><CompassMark className="quiz-spinner" size={22} /> {t.quiz.preparingNext}</>
              ) : null}
            </div>
          </div>
          <div className="quiz-nav">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setMotionDirection('back');
                dispatch({ type: 'PREV_QUESTION' });
              }}
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
