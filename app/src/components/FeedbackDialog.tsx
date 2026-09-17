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
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [reference, setReference] = useState<string | null>(null);
  const [fileError, setFileError] = useState(false);
  const challenge = useRef<HTMLDivElement | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const dialog = useRef<HTMLElement | null>(null);
  // Shared with ResultRating/DestinationRating rather than reimplemented:
  // the previous ad hoc version here had no handling for a script that
  // fails to load, which left Submit disabled forever with no explanation
  // whenever Turnstile was configured but its challenge could not load
  // (blocked by an ad blocker, a firewall, or any network policy that
  // refuses challenges.cloudflare.com) — the root cause of the reported
  // "cannot be pressed or completed" bug.
  const turnstile = useTurnstile(challenge, open);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const openerElement = opener.current;
    document.body.style.overflow = 'hidden';
    dialog.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
      openerElement?.focus();
    };
  }, [open]);

  const chooseScreenshot = (file?: File) => {
    setFileError(false);
    setScreenshot(undefined);
    if (!file) return;
    if (file.size > 2_000_000 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setFileError(true);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setScreenshot(typeof reader.result === 'string' ? reader.result : undefined);
    reader.onerror = () => setFileError(true);
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (message.trim().length < 10 || status === 'saving' || turnstile.blocking) return;
    setStatus('saving');
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
    } else setStatus('failed');
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
              <div className="feedback-success">
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
                  <span>{strings.message}</span>
                  <textarea required minLength={10} maxLength={4000} rows={6} value={message} onChange={(event) => setMessage(event.target.value)} />
                </label>
                <label className="field">
                  <span>{strings.email}</span>
                  <input type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} />
                </label>
                <label className="field">
                  <span>{strings.screenshot}</span>
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => chooseScreenshot(event.target.files?.[0])} />
                </label>
                {fileError ? <p className="form-error">{strings.screenshotError}</p> : null}
                {turnstile.required ? <div ref={challenge} className="turnstile-slot" /> : null}
                {/* Acceptance fix — Send being disabled while the challenge
                    is still loading/rendering (turnstile.blocking, before
                    either a token or a failure) previously had NO visible
                    explanation at all: the empty .turnstile-slot has no
                    height until the widget renders, so a user who finished
                    typing could stare at a disabled button with no
                    indication anything was happening. */}
                {turnstile.required && turnstile.blocking && !turnstile.failed ? (
                  <p className="form-hint">{strings.verifyingChallenge}</p>
                ) : null}
                {turnstile.failed ? (
                  <p className="form-error" role="alert">
                    {strings.verificationFailed}{' '}
                    <button type="button" className="btn btn-ghost btn-sm" onClick={turnstile.retry}>{strings.retryVerification}</button>
                  </p>
                ) : null}
                {status === 'failed' ? <p className="form-error" role="alert">{strings.failed}</p> : null}
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
