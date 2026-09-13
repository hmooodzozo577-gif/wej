import { useState } from 'react';
import type { Lang, ResultsStrings } from '../data/types';
import type { RankedResult } from '../engine';
import { nameOf } from '../data/destinationText';
import { submitRating } from '../telemetry/productDataClient';

const REASONS = ['relevant', 'easy_to_understand', 'unexpected', 'missing_info'] as const;

export function ResultRating({ results, lang, strings }: { results: RankedResult[]; lang: Lang; strings: ResultsStrings }) {
  const [score, setScore] = useState(0);
  const [reasons, setReasons] = useState<string[]>([]);
  const [votes, setVotes] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const reasonLabels = {
    relevant: strings.ratingRelevant,
    easy_to_understand: strings.ratingClear,
    unexpected: strings.ratingUnexpected,
    missing_info: strings.ratingMissingInfo,
  };

  const toggleReason = (reason: string) => setReasons((current) =>
    current.includes(reason) ? current.filter((item) => item !== reason) : [...current, reason]);

  const save = async () => {
    if (!score || status === 'saving') return;
    setStatus('saving');
    const response = await submitRating({
      overallScore: score,
      reasons,
      countryVotes: Object.entries(votes).map(([countryCode, useful]) => ({ countryCode, useful })),
      resultContext: results.slice(0, 5).map((item) => ({ countryCode: item.dest.countryCode, score: item.score })),
    }, { path: '/results', locale: lang });
    setStatus(response.ok ? 'saved' : 'failed');
  };

  if (status === 'saved') return <section className="result-rating detail-card"><strong>{strings.ratingThanks}</strong></section>;

  return (
    <section className="result-rating detail-card" aria-labelledby="rating-title">
      <h2 id="rating-title">{strings.ratingTitle}</h2>
      <p>{strings.ratingBody}</p>
      <div className="rating-stars" role="group" aria-label={strings.ratingTitle}>
        {[1, 2, 3, 4, 5].map((value) => (
          <button type="button" key={value} className={value <= score ? 'selected' : ''} aria-label={`${value} / 5`} onClick={() => setScore(value)}>★</button>
        ))}
      </div>
      {score ? (
        <div className="rating-reasons">
          <strong>{strings.ratingReasonsTitle}</strong>
          <div className="pill-list">
            {REASONS.map((reason) => (
              <button type="button" className={`meta-chip${reasons.includes(reason) ? ' selected' : ''}`} key={reason} onClick={() => toggleReason(reason)}>{reasonLabels[reason]}</button>
            ))}
          </div>
        </div>
      ) : null}
      <details className="rating-countries">
        <summary>{strings.rateCountries}</summary>
        <div>
          {results.slice(0, 5).map((item) => (
            <div className="rating-country" key={item.dest.countryCode}>
              <span>{nameOf(item.dest, lang)}</span>
              <div>
                <button type="button" className={votes[item.dest.countryCode] === true ? 'selected' : ''} aria-label={`${strings.usefulYes} ${nameOf(item.dest, lang)}`} onClick={() => setVotes((current) => ({ ...current, [item.dest.countryCode]: true }))}>{strings.usefulYes}</button>
                <button type="button" className={votes[item.dest.countryCode] === false ? 'selected' : ''} aria-label={`${strings.usefulNo} ${nameOf(item.dest, lang)}`} onClick={() => setVotes((current) => ({ ...current, [item.dest.countryCode]: false }))}>{strings.usefulNo}</button>
              </div>
            </div>
          ))}
        </div>
      </details>
      {status === 'failed' ? <p className="form-error">{strings.ratingFailed}</p> : null}
      <button type="button" className="btn btn-primary" disabled={!score || status === 'saving'} onClick={save}>{status === 'saving' ? strings.ratingSaving : strings.submitRating}</button>
    </section>
  );
}
