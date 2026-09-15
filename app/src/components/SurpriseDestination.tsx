// Item #9 — "Surprise Me" redesign. The previous version was a static
// conic-gradient disc with no flags, no names, and a single 900ms CSS spin
// — it never actually showed any candidate while "spinning". This version
// cycles through real candidate flags/names (a short reel, like a manual
// destination shuffle rather than a themed slot machine) before landing on
// the same winner the existing anti-repeat selection logic already picks —
// that selection logic is untouched, only the presentation around it changes.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CatalogEntry, ExploreStrings, Lang } from '../data/types';
import { nameOf } from '../data/destinationText';
import { DestinationImage } from './DestinationImage';
import { FlagChip } from './flags/FlagIcon';
import { Icon } from './Icon';
import { trackEvent } from '../telemetry/productDataClient';

const RECENT_STORAGE_KEY = 'wejhaty.surprise.recent';
const REEL_STEP_MS = 100;
const REEL_STEPS = 8;

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

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function SurpriseDestination({ candidates, lang, strings }: { candidates: CatalogEntry[]; lang: Lang; strings: ExploreStrings }) {
  const [open, setOpen] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [selected, setSelected] = useState<CatalogEntry | null>(null);
  const [reelEntry, setReelEntry] = useState<CatalogEntry | null>(null);
  const recent = useRef(recentIds());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    if (interval.current) clearInterval(interval.current);
  }, []);

  const visibleSelection = selected && candidates.some((candidate) => candidate.id === selected.id) ? selected : null;

  const spin = () => {
    if (!candidates.length || spinning) return;
    trackEvent('surprise_spin', { candidateCount: candidates.length }, { path: '/explore', locale: lang });
    let available = candidates.filter((candidate) => !recent.current.has(candidate.id));
    if (!available.length) {
      recent.current.clear();
      available = candidates;
    }
    const winner = available[randomIndex(available.length)]!;

    setOpen(true);
    setSpinning(true);
    setSelected(null);

    const finish = () => {
      recent.current.add(winner.id);
      saveRecent(recent.current);
      trackEvent('surprise_result', { countryCode: winner.countryCode }, { path: '/explore', locale: lang, countryCode: winner.countryCode });
      setReelEntry(winner);
      setSelected(winner);
      setSpinning(false);
      interval.current = null;
      timer.current = null;
    };

    if (prefersReducedMotion() || candidates.length < 2) {
      // No flashing reel for a reduced-motion preference — a single short
      // pause (still gives "spinning" state something to announce via
      // aria-live) then land directly on the real winner.
      timer.current = setTimeout(finish, 250);
      return;
    }

    let step = 0;
    interval.current = setInterval(() => {
      step += 1;
      if (step >= REEL_STEPS) {
        if (interval.current) clearInterval(interval.current);
        finish();
        return;
      }
      setReelEntry(candidates[randomIndex(candidates.length)]!);
    }, REEL_STEP_MS);
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
          <div className={`surprise-reel${spinning ? ' spinning' : ' landed'}`} aria-hidden={!spinning}>
            {reelEntry ? <FlagChip dest={reelEntry} width={54} height={40} /> : <span className="surprise-reel-placeholder" />}
          </div>
          {spinning ? (
            <strong>{strings.surpriseSpinning}</strong>
          ) : visibleSelection ? (
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
