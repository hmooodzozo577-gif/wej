import { useEffect, useRef, useState } from 'react';
import type { FeedbackStrings, Lang } from '../data/types';
import { submitFeedback } from '../telemetry/productDataClient';
import { useTurnstile } from '../telemetry/turnstile';
import { Select } from './Select';

export function FeedbackDialog({ lang, strings, countryCode }: { lang: Lang; strings: FeedbackStrings; countryCode?: string }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('suggestion');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [screenshot, setScreenshot] = useState<string | undefined>();
  const [screenshotName, setScreenshotName] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [reference, setReference] = useState<string | null>(null);
  const [failureCode, setFailureCode] = useState<string | null>(null);
  const [fileError, setFileError] = useState(false);
  const challenge = useRef<HTMLDivElement | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const dialog = useRef<HTMLElement | null>(null);
  // Shared with ResultRating/DestinationRating so loading, failure, and retry
  // behavior stays consistent whenever the production challenge is enabled.
  const turnstile = useTurnstile(challenge, open);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const openerElement = opener.current;
    document.body.style.overflow = 'hidden';
    dialog.current?.focus();
    const keepFocusInDialog = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !dialog.current) return;
      const focusable = [...dialog.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
      )].filter((element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true');
      if (!focusable.length) {
        event.preventDefault();
        dialog.current.focus();
        return;
      }
      const first = focusable[0]!;
      const last = focusable.at(-1)!;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === dialog.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', keepFocusInDialog);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', keepFocusInDialog);
      openerElement?.focus();
    };
  }, [open]);

  const chooseScreenshot = (file?: File) => {
    setFileError(false);
    setScreenshot(undefined);
    setScreenshotName('');
    if (!file) return;
    if (file.size > 2_000_000 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setFileError(true);
      return;
    }
    setScreenshotName(file.name);
    const reader = new FileReader();
    reader.onload = () => setScreenshot(typeof reader.result === 'string' ? reader.result : undefined);
    reader.onerror = () => {
      setScreenshotName('');
      setFileError(true);
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (message.trim().length < 10 || status === 'saving' || turnstile.blocking) return;
    setStatus('saving');
    setFailureCode(null);
    const result = await submitFeedback({
      type,
      message: message.trim(),
      email: email.trim() || undefined,
      screenshotDataUrl: screenshot,
      ...(turnstile.token ? { turnstileToken: turnstile.token } : {}),
    }, {
      path: window.location.pathname.replace(/^\/wej/, '') || '/',
      locale: lang,
      countryCode,
    });
    if (result.ok) {
      setReference(typeof result.data?.referenceId === 'string' ? result.data.referenceId : null);
      setStatus('saved');
    } else {
      setFailureCode(typeof result.data?.error === 'string' ? result.data.error : null);
      setStatus('failed');
    }
  };

  return (
    <>
      <button ref={opener} type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>{strings.open}</button>
      {open ? (
        <div className="feedback-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section ref={dialog} className="feedback-dialog" role="dialog" aria-modal="true" aria-labelledby="feedback-title" tabIndex={-1}>
            <div className="feedback-dialog-head">
              <h2 id="feedback-title">{countryCode ? strings.countryTitle : strings.title}</h2>
              <button type="button" className="feedback-close" aria-label={strings.close} onClick={() => setOpen(false)}>×</button>
            </div>
            {status === 'saved' ? (
              <div className="feedback-success" role="status" aria-live="polite">
                <p>{strings.thanks}</p>
                {reference ? <strong>{strings.reference}: {reference}</strong> : null}
              </div>
            ) : (
              <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
                {/* A <label> cannot wrap the custom listbox trigger (a
                    <button> is not a labelable control), so the visible text
                    is wired up with aria-labelledby instead of nesting. */}
                <div className="field">
                  <span id="feedback-type-label">{strings.type}</span>
                  <Select
                    id="feedback-type"
                    labelledBy="feedback-type-label"
                    value={type}
                    options={[
                      { value: 'wrong_info', label: strings.wrongInfo },
                      { value: 'image', label: strings.image },
                      { value: 'bug', label: strings.bug },
                      { value: 'suggestion', label: strings.suggestion },
                      { value: 'results', label: strings.results },
                      { value: 'translation', label: strings.translation },
                      { value: 'other', label: strings.other },
                    ]}
                    onChange={setType}
                  />
                </div>
                <label className="field">
                  <span id="feedback-message-label">{strings.message}</span>
                  <textarea
                    required
                    minLength={10}
                    maxLength={4000}
                    rows={6}
                    value={message}
                    aria-labelledby="feedback-message-label"
                    aria-describedby="feedback-message-hint"
                    onChange={(event) => setMessage(event.target.value)}
                  />
                  <small id="feedback-message-hint" className="form-hint">{strings.messageHint}</small>
                </label>
                <label className="field">
                  <span>{strings.email}</span>
                  <input type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} />
                </label>
                <div className="field feedback-file-field">
                  <span id="feedback-screenshot-label">{strings.screenshot}</span>
                  <input
                    id="feedback-screenshot"
                    className="visually-hidden feedback-file-input"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    aria-labelledby="feedback-screenshot-label feedback-file-trigger"
                    onChange={(event) => chooseScreenshot(event.target.files?.[0])}
                  />
                  <div className="feedback-file-control">
                    <label id="feedback-file-trigger" htmlFor="feedback-screenshot" className="btn btn-ghost btn-sm feedback-file-trigger">
                      {strings.chooseFile}
                    </label>
                    <span className="feedback-file-name" aria-live="polite">{screenshotName || strings.noFileSelected}</span>
                  </div>
                </div>
                {fileError ? <p className="form-error">{strings.screenshotError}</p> : null}
                {turnstile.required ? <div ref={challenge} className="turnstile-slot" /> : null}
                {/* If the optional production challenge is loading, explain
                    the temporary disabled state instead of leaving it silent. */}
                {turnstile.required && turnstile.blocking && !turnstile.failed ? (
                  <p className="form-hint">{strings.verifyingChallenge}</p>
                ) : null}
                {turnstile.failed ? (
                  <p className="form-error" role="alert">
                    {strings.verificationFailed}{' '}
                    <button type="button" className="btn btn-ghost btn-sm" onClick={turnstile.retry}>{strings.retryVerification}</button>
                  </p>
                ) : null}
                {status === 'failed' ? (
                  <p className="form-error" role="alert">
                    {failureCode === 'rate_limited'
                      ? strings.rateLimited
                      : failureCode === 'challenge_failed'
                        ? strings.challengeRejected
                        : failureCode === 'product_data_unavailable'
                          ? strings.serviceUnavailable
                          : strings.failed}
                  </p>
                ) : null}
                <button type="submit" className="btn btn-primary" disabled={message.trim().length < 10 || status === 'saving' || turnstile.blocking}>
                  {status === 'saving' ? strings.saving : strings.submit}
                </button>
              </form>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
