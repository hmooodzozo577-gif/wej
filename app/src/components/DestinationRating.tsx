// Item #13B — per-destination feedback, at the bottom of every destination
// page.
//
// It works whichever route the traveller arrived by — recommendations,
// Explore, a surprise result, or a direct link — so the same page always
// offers the same thing. The route is recorded as coarse context ('results',
// 'explore', 'surprise', 'direct') because it changes how the rating should
// be read; it is never a precise location and never identifying.
//
// Submission states (item #13C) match ResultRating exactly, via the same
// star control: the requirement is stated before the traveller tries, the
// request has a loading state, and a failure offers a retry that keeps what
// was typed.
import { useState } from 'react';
import type { CatalogEntry, DestinationRatingStrings, Lang } from '../data/types';
import type { DestinationNavigation } from '../state/types';
import { submitRating } from '../telemetry/productDataClient';
import { StarRating } from './StarRating';

function originOf(navigation: DestinationNavigation | null): 'results' | 'explore' | 'surprise' | 'direct' {
  if (!navigation) return 'direct';
  return navigation.source;
}

export function DestinationRating({
  destination,
  navigation,
  lang,
  strings,
}: {
  destination: CatalogEntry;
  navigation: DestinationNavigation | null;
  lang: Lang;
  strings: DestinationRatingStrings;
}) {
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');

  const save = async () => {
    if (!score || status === 'saving') return;
    setStatus('saving');
    const response = await submitRating({
      kind: 'destination',
      overallScore: score,
      countryCode: destination.countryCode,
      origin: originOf(navigation),
      // Spread rather than `comment: ... || undefined`: an explicit
      // `comment: undefined` is still a key on the wire.
      ...(comment.trim() ? { comment: comment.trim() } : {}),
    }, { path: `/destination/${destination.id}`, locale: lang, countryCode: destination.countryCode });
    setStatus(response.ok ? 'saved' : 'failed');
  };

  if (status === 'saved') {
    return (
      <section className="detail-card destination-rating">
        <strong>{strings.thanks}</strong>
      </section>
    );
  }

  return (
    <section className="detail-card destination-rating" aria-labelledby="destination-rating-title">
      <h3 id="destination-rating-title">{strings.title}</h3>
      <p>{strings.body}</p>

      <StarRating value={score} onChange={setScore} label={strings.starsLabel} lang={lang} disabled={status === 'saving'} />

      <div className="field rating-comment">
        <label htmlFor="destination-rating-comment">{strings.commentLabel}</label>
        <textarea
          id="destination-rating-comment"
          rows={3}
          value={comment}
          placeholder={strings.commentPlaceholder}
          disabled={status === 'saving'}
          onChange={(event) => setComment(event.target.value)}
        />
      </div>

      {!score ? <p className="rating-required">{strings.requiredNote}</p> : null}
      {status === 'failed' ? <p className="form-error" role="alert">{strings.failed}</p> : null}

      <button type="button" className="btn btn-primary" disabled={!score || status === 'saving'} onClick={save}>
        {status === 'saving' ? strings.saving : status === 'failed' ? strings.retry : strings.submit}
      </button>
    </section>
  );
}
