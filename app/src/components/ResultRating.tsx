// Item #13A — overall feedback on a whole recommendation set.
//
// What changed: the form was a 1-5 score, four reason pills, and a
// per-country "useful / not useful" row. The acceptance round replaced that
// composition with 1-5 stars, an optional free-text box, and Submit — and
// removed "useful / not useful" explicitly. Per-destination feedback now
// lives on the destination page instead (DestinationRating.tsx), where the
// traveller is actually looking at the destination.
//
// Submission states (item #13C): Submit is disabled and the requirement is
// stated BEFORE the traveller tries; a request shows a loading state;
// success and failure are both explicit, and failure offers a retry that
// keeps what was typed.
import { useRef, useState } from 'react';
import type { Lang, ResultsStrings } from '../data/types';
import type { RankedResult } from '../engine';
import { submitRating } from '../telemetry/productDataClient';
import { StarRating } from './StarRating';
import { useTurnstile } from '../telemetry/turnstile';

export function ResultRating({ results, lang, strings }: { results: RankedResult[]; lang: Lang; strings: ResultsStrings }) {
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  // Inert unless a Turnstile site key was configured at build time, which is
  // how this stays a no-op in the current production build.
  const turnstileSlot = useRef<HTMLDivElement | null>(null);
  const turnstile = useTurnstile(turnstileSlot, status !== 'saved');

  const save = async () => {
    if (!score || status === 'saving' || turnstile.blocking) return;
    setStatus('saving');
    const response = await submitRating({
      kind: 'results',
      overallScore: score,
      ...(comment.trim() ? { comment: comment.trim() } : {}),
      ...(turnstile.token ? { turnstileToken: turnstile.token } : {}),
      resultContext: results.slice(0, 5).map((item) => ({ countryCode: item.dest.countryCode, score: item.score })),
    }, { path: '/results', locale: lang });
    setStatus(response.ok ? 'saved' : 'failed');
  };

  if (status === 'saved') {
    return (
      <section className="result-rating detail-card">
        <strong>{strings.ratingThanks}</strong>
      </section>
    );
  }

  return (
    <section className="result-rating detail-card" aria-labelledby="rating-title">
      <h2 id="rating-title">{strings.ratingTitle}</h2>
      <p>{strings.ratingBody}</p>

      <StarRating value={score} onChange={setScore} label={strings.ratingStarsLabel} lang={lang} disabled={status === 'saving'} />

      <div className="field rating-comment">
        <label htmlFor="rating-comment">{strings.ratingCommentLabel}</label>
        <textarea
          id="rating-comment"
          rows={3}
          value={comment}
          placeholder={strings.ratingCommentPlaceholder}
          disabled={status === 'saving'}
          onChange={(event) => setComment(event.target.value)}
        />
      </div>

      {turnstile.required ? <div ref={turnstileSlot} className="turnstile-slot" /> : null}

      {/* Said up front, not discovered by clicking a dead button. */}
      {!score ? <p className="rating-required">{strings.ratingRequiredNote}</p> : null}
      {status === 'failed' ? <p className="form-error" role="alert">{strings.ratingFailed}</p> : null}

      <button type="button" className="btn btn-primary" disabled={!score || status === 'saving' || turnstile.blocking} onClick={save}>
        {status === 'saving' ? strings.ratingSaving : status === 'failed' ? strings.ratingRetry : strings.submitRating}
      </button>
    </section>
  );
}
