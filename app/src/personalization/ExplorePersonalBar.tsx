// Phase 18 acceptance — Explore's personalization line: what the card
// percentages mean, and a secondary "reset preferences" action with a light
// inline confirmation (no modal). After a reset the traveller stays on
// Explore, sees a short confirmation and a quiet way back into the quiz.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useI18n } from '../state/hooks';
import { PERSONAL_COPY } from './copy';
import { usePersonalization } from './usePersonalization';
import { useResetPreferences } from './useResetPreferences';

type Step = 'idle' | 'confirming' | 'done';

export function ExplorePersonalBar() {
  const { lang } = useI18n();
  const pc = PERSONAL_COPY[lang];
  const { profile, preferences } = usePersonalization();
  const resetPreferences = useResetPreferences();
  const [step, setStep] = useState<Step>('idle');
  const cancelRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef<HTMLParagraphElement>(null);

  // Keep keyboard focus on the flow: onto "Cancel" when the confirmation
  // opens (the safe choice), onto the confirmation once the reset is done.
  useEffect(() => {
    if (step === 'confirming') cancelRef.current?.focus();
    if (step === 'done') doneRef.current?.focus();
  }, [step]);

  if (step === 'done') {
    return (
      <div className="explore-personal-bar is-done">
        <p className="explore-personal-status" role="status" tabIndex={-1} ref={doneRef}>
          <Icon name="check" size={15} /> {pc.resetDone}
        </p>
        <Link className="explore-personal-link" to="/purpose">
          {pc.retakeQuiz} <Icon name="arrowEnd" size={14} />
        </Link>
      </div>
    );
  }

  if (!profile) return null;

  if (step === 'confirming') {
    return (
      <div className="explore-personal-bar is-confirming" role="group" aria-label={pc.resetPrefs}>
        <p className="explore-personal-note">{pc.resetConfirm}</p>
        <div className="explore-personal-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              resetPreferences();
              setStep('done');
            }}
          >
            {pc.resetConfirmYes}
          </button>
          <button type="button" className="btn btn-ghost btn-sm explore-personal-cancel" ref={cancelRef} onClick={() => setStep('idle')}>
            {pc.resetCancel}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="explore-personal-bar">
      {preferences?.signals.length ? (
        <p className="explore-personal-note">
          <Icon name="compass" size={15} /> {pc.exploreNote}
        </p>
      ) : null}
      <button type="button" className="btn btn-ghost btn-sm explore-personal-reset" onClick={() => setStep('confirming')}>
        {pc.resetPrefs}
      </button>
    </div>
  );
}
