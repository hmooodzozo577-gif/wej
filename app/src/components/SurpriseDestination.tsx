// Item #11 — "Surprise me", second design pass.
//
// The previous pass replaced an abstract colour wheel with a flag reel. The
// user asked for another pass and explicitly freed the concept from the
// wheel/reel idea, so this is a TRAVEL COMPASS rather than a faster reel:
//
//   - a compass dial in Wejhaty's own ink/gold, with real tick marks and
//     localized cardinal letters — travel-native, and not a slot machine
//   - the needle sweeps while candidates cycle in the dial's centre window,
//     decelerating into its final position rather than stopping dead
//   - WHEN LOCATION IS KNOWN, the needle settles on the destination's REAL
//     great-circle bearing from the traveller, and the result is captioned
//     with that direction. That is a derived geographic fact (the same
//     technique as the nearby-country and city-distance features), not
//     decoration pretending to be data.
//   - with no location, the needle settles due north and NO direction is
//     claimed. The compass is then simply a dial that resolved; it never
//     implies a bearing it does not have.
//
// Unchanged on purpose: the selection itself. Candidates still come from the
// current filtered catalog, the winner is still drawn with crypto random
// from the not-recently-seen set, and the session anti-repeat list still
// clears only when candidates are exhausted. This is a presentation change.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CatalogEntry, ExploreStrings, Lang } from '../data/types';
import { nameOf } from '../data/destinationText';
import { bearingDegrees, compassPointOf } from '../data/geo';
import { countryInfoOf } from '../data/worldCatalog';
import type { LocationCoords } from '../state/types';
import { DestinationImage } from './DestinationImage';
import { FlagChip } from './flags/FlagIcon';
import { Icon } from './Icon';
import { trackEvent } from '../telemetry/productDataClient';

const RECENT_STORAGE_KEY = 'wejhaty.surprise.recent';
// Fast enough not to make anyone wait, long enough to read as a settle
// rather than a cut. Six cycles at 110ms plus the needle's own easing.
const CYCLE_STEP_MS = 110;
const CYCLE_STEPS = 6;

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

/** The dial: ticks plus localized cardinal letters. Pure presentation. */
function CompassDial({ lang }: { lang: Lang }) {
  const cardinals = lang === 'ar'
    ? { n: 'ش', e: 'ق', s: 'ج', w: 'غ' }
    : { n: 'N', e: 'E', s: 'S', w: 'W' };
  return (
    <>
      <span className="compass-ticks" aria-hidden="true">
        {Array.from({ length: 24 }, (_, index) => (
          <i key={index} style={{ transform: `rotate(${index * 15}deg)` }} />
        ))}
      </span>
      <span className="compass-cardinal compass-n" aria-hidden="true">{cardinals.n}</span>
      <span className="compass-cardinal compass-e" aria-hidden="true">{cardinals.e}</span>
      <span className="compass-cardinal compass-s" aria-hidden="true">{cardinals.s}</span>
      <span className="compass-cardinal compass-w" aria-hidden="true">{cardinals.w}</span>
    </>
  );
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
  const [cycleEntry, setCycleEntry] = useState<CatalogEntry | null>(null);
  const [needleAngle, setNeedleAngle] = useState(0);
  const recent = useRef(recentIds());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);
  // Accumulates so the needle always sweeps FORWARD to its next resting
  // angle instead of snapping backwards through the dial.
  const revolutions = useRef(0);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    if (interval.current) clearInterval(interval.current);
  }, []);

  const visibleSelection = selected && candidates.some((candidate) => candidate.id === selected.id) ? selected : null;

  /** The destination's real bearing from the traveller, or null when either
   *  the traveller's position or the destination's centroid is unknown. */
  const bearingTo = (destination: CatalogEntry): number | null => {
    if (!origin) return null;
    const info = countryInfoOf(destination.id);
    return info ? bearingDegrees(origin, info.latlng) : null;
  };

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
      setCycleEntry(winner);
      setSelected(winner);
      // Settle on the real bearing when there is one; due north otherwise,
      // which claims nothing.
      revolutions.current += 1;
      setNeedleAngle(revolutions.current * 360 + (bearingTo(winner) ?? 0));
      setSpinning(false);
      interval.current = null;
      timer.current = null;
    };

    if (prefersReducedMotion() || candidates.length < 2) {
      // No sweep and no flag cycling under a reduced-motion preference — a
      // short pause so the live region has something to announce, then the
      // real winner.
      timer.current = setTimeout(finish, 220);
      return;
    }

    let step = 0;
    interval.current = setInterval(() => {
      step += 1;
      if (step >= CYCLE_STEPS) {
        if (interval.current) clearInterval(interval.current);
        finish();
        return;
      }
      setCycleEntry(candidates[randomIndex(candidates.length)]!);
      // Keep the needle moving through the cycle so the settle reads as a
      // deceleration rather than a jump.
      setNeedleAngle((current) => current + 150 + randomIndex(90));
    }, CYCLE_STEP_MS);
  };

  const direction = visibleSelection ? directionOf(visibleSelection) : null;

  return (
    <section className="surprise-card" aria-labelledby="surprise-title">
      <div>
        <h2 id="surprise-title" className="display">{strings.surpriseTitle}</h2>
        <p>{strings.surpriseBody}</p>
        <button type="button" className="btn btn-gold" onClick={spin} disabled={!candidates.length || spinning}>
          <Icon name="compass" size={16} /> {visibleSelection ? strings.surpriseAgain : strings.surpriseSpin}
        </button>
      </div>

      {open ? (
        <div className="surprise-stage">
          <div className={`surprise-compass${spinning ? ' is-spinning' : ' is-settled'}`} aria-hidden="true">
            <CompassDial lang={lang} />
            <span className="compass-needle" style={{ transform: `rotate(${needleAngle}deg)` }} />
            <span className="compass-window">
              {cycleEntry ? <FlagChip dest={cycleEntry} width={44} height={33} /> : null}
            </span>
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
