// "Surprise me" — the FLAG-REEL design, restored.
//
// Acceptance item #4: the user compared the travel-compass redesign against
// the reel that preceded it and preferred the reel, so this is a targeted UI
// rollback to the presentation in commit 5838723 — recovered from Git
// history, not rewritten from memory. The compass dial, its ticks, cardinal
// letters and needle are gone.
//
// What was NOT rolled back, because these are later fixes rather than part
// of the rejected design:
//   - saveRecent() survives a blocked or full sessionStorage instead of
//     throwing out of the click handler
//   - ONE live region wraps the outcome only, so a screen reader hears
//     "choosing…" and then the destination — not each of the 8 cycled flags
//   - the reel itself is aria-hidden at all times; it is a decorative
//     duplicate of the result the outcome region already announces
//   - the real direction caption (a great-circle bearing from the traveller
//     to the winner, absent when there is no location) stays, because it is
//     a sourced geographic fact rather than compass decoration
//
// Unchanged throughout both design passes, on purpose: the selection itself.
// Candidates come from the current filtered catalog, the winner is drawn
// with crypto random from the not-recently-seen set, and the session
// anti-repeat list clears only when candidates are exhausted.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CatalogEntry, ExploreStrings, Lang } from '../data/types';
import { nameOf } from '../data/destinationText';
import { compassPointOf } from '../data/geo';
import { countryInfoOf } from '../data/worldCatalog';
import type { LocationCoords } from '../state/types';
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
  try {
    sessionStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // A blocked or full sessionStorage must never break the feature; the
    // anti-repeat list simply does not survive this page.
  }
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

export function SurpriseDestination({
  candidates,
  lang,
  strings,
  origin,
}: {
  candidates: CatalogEntry[];
  lang: Lang;
  strings: ExploreStrings;
  /** The traveller's coordinates, when they have shared them. Only ever used
   *  to compute a real bearing to the chosen destination. */
  origin?: LocationCoords | null;
}) {
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

  const directionOf = (destination: CatalogEntry): string | null => {
    if (!origin) return null;
    const info = countryInfoOf(destination.id);
    if (!info) return null;
    return strings.surpriseDirections[compassPointOf(origin, info.latlng)] ?? null;
  };

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
      // pause (so the live region still has "choosing…" to announce) then
      // land directly on the real winner.
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

  const direction = visibleSelection ? directionOf(visibleSelection) : null;

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
        <div className="surprise-stage">
          <div className={`surprise-reel${spinning ? ' spinning' : ' landed'}`} aria-hidden="true">
            {reelEntry ? <FlagChip dest={reelEntry} width={54} height={40} /> : <span className="surprise-reel-placeholder" />}
          </div>

          {/* One live region for the whole outcome, so a screen reader hears
              "choosing…" and then the destination — not every cycled flag. */}
          <div className="surprise-outcome" aria-live="polite" aria-busy={spinning}>
            {spinning ? (
              <strong>{strings.surpriseSpinning}</strong>
            ) : visibleSelection ? (
              <div className="surprise-result">
                <DestinationImage destination={visibleSelection} lang={lang} />
                <strong>{nameOf(visibleSelection, lang)}</strong>
                {direction ? (
                  <span className="meta-chip surprise-direction">
                    <Icon name="compass" size={13} stroke={2.4} /> {direction}
                  </span>
                ) : null}
                <Link
                  className="btn btn-primary btn-sm"
                  to={`/destination/${visibleSelection.id}`}
                  state={{ navigation: { source: 'surprise', ids: [visibleSelection.id], index: 0 } }}
                >
                  {strings.surpriseOpen} <Icon name="arrowEnd" size={15} />
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
