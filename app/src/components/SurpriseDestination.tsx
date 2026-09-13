import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CatalogEntry, ExploreStrings, Lang } from '../data/types';
import { nameOf } from '../data/destinationText';
import { DestinationImage } from './DestinationImage';
import { Icon } from './Icon';
import { trackEvent } from '../telemetry/productDataClient';

const RECENT_STORAGE_KEY = 'wejhaty.surprise.recent';

function recentIds(): Set<string> {
  try {
    const stored = JSON.parse(sessionStorage.getItem(RECENT_STORAGE_KEY) ?? '[]');
    return new Set(Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

function saveRecent(ids: Set<string>) {
  sessionStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify([...ids]));
}

function randomIndex(length: number): number {
  if (length <= 1) return 0;
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0]! % length;
}

export function SurpriseDestination({ candidates, lang, strings }: { candidates: CatalogEntry[]; lang: Lang; strings: ExploreStrings }) {
  const [open, setOpen] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [selected, setSelected] = useState<CatalogEntry | null>(null);
  const recent = useRef(recentIds());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const visibleSelection = selected && candidates.some((candidate) => candidate.id === selected.id) ? selected : null;

  const spin = () => {
    if (!candidates.length || spinning) return;
    trackEvent('surprise_spin', { candidateCount: candidates.length }, { path: '/explore', locale: lang });
    setOpen(true);
    setSpinning(true);
    timer.current = setTimeout(() => {
      let available = candidates.filter((candidate) => !recent.current.has(candidate.id));
      if (!available.length) {
        recent.current.clear();
        available = candidates;
      }
      const winner = available[randomIndex(available.length)]!;
      recent.current.add(winner.id);
      saveRecent(recent.current);
      trackEvent('surprise_result', { countryCode: winner.countryCode }, { path: '/explore', locale: lang, countryCode: winner.countryCode });
      setSelected(winner);
      setSpinning(false);
      timer.current = null;
    }, 900);
  };

  return (
    <section className="surprise-card" aria-labelledby="surprise-title">
      <div>
        <h2 id="surprise-title" className="display">{strings.surpriseTitle}</h2>
        <p>{strings.surpriseBody}</p>
        <button type="button" className="btn btn-gold" onClick={spin} disabled={!candidates.length || spinning}>
          <Icon name="sparkle" size={16} /> {visibleSelection ? strings.surpriseAgain : strings.surpriseSpin}
        </button>
      </div>
      {open ? (
        <div className="surprise-stage" aria-live="polite" aria-busy={spinning}>
          <div className={`surprise-wheel${spinning ? ' spinning' : ''}`} aria-hidden="true"><span /></div>
          {spinning ? <strong>{strings.surpriseSpinning}</strong> : visibleSelection ? (
            <div className="surprise-result">
              <DestinationImage destination={visibleSelection} lang={lang} />
              <strong>{nameOf(visibleSelection, lang)}</strong>
              <Link className="btn btn-primary btn-sm" to={`/destination/${visibleSelection.id}`} state={{ navigation: { source: 'surprise', ids: [visibleSelection.id], index: 0 } }}>
                {strings.surpriseOpen} <Icon name="arrowEnd" size={15} />
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
