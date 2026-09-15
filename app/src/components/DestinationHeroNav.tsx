// Item #3 — previous/next destination controls INSIDE the hero image.
//
// They used to be two full-width cards below the hero (.destination-pager),
// which the user's marked-up screenshot rejects: the controls belong in the
// hero's own side gutters, at the far left and far right edges, as a subtle
// translucent frame over the photography rather than a block of chrome
// underneath it.
//
// Design constraints this satisfies:
//   - translucent + blurred, so the country photo still reads through it
//   - a fixed light foreground with its own shadow, legible over both a
//     bright sky and a dark night shot (the same problem, and the same
//     solution, as the hero title — see wejhaty.css)
//   - 44px minimum hit area at every breakpoint, so it stays usable on touch
//   - the destination NAME is revealed on hover/focus as a compact inline
//     label, and is always in the accessible name, so a screen reader and a
//     keyboard user never get less information than a mouse user
//   - the arrow glyphs are physically left/right (see data/icons.json), so
//     they are mirrored in RTL by CSS — in Arabic, "previous" points toward
//     the start of the reading direction, which is the right-hand side
import { Link } from 'react-router-dom';
import type { CatalogEntry, Lang } from '../data/types';
import type { DestinationNavigation } from '../state/types';
import { nameOf } from '../data/destinationText';
import { Icon } from './Icon';

export interface HeroNavTarget {
  entry: CatalogEntry;
  navigation: DestinationNavigation;
}

/** Resolves the previous/next entries for the current destination from the
 *  preserved navigation context. Deliberately unchanged in behavior from the
 *  pager it replaces: same `ids` ordering (recommendation order, Explore's
 *  filtered+sorted order, or the direct-link alphabetical fallback), same
 *  index arithmetic, same "surprise has no siblings" rule. Only where the
 *  controls RENDER has changed. */
export function heroNavTargets(
  current: CatalogEntry,
  navigation: DestinationNavigation | null,
  catalog: CatalogEntry[],
): { previous?: HeroNavTarget; next?: HeroNavTarget } {
  if (!navigation || navigation.source === 'surprise') return {};
  const index = navigation.ids.indexOf(current.id);
  if (index < 0) return {};
  const at = (offset: number): HeroNavTarget | undefined => {
    const id = navigation.ids[index + offset];
    if (!id) return undefined;
    const entry = catalog.find((country) => country.id === id);
    return entry ? { entry, navigation: { ...navigation, index: index + offset } } : undefined;
  };
  return { previous: at(-1), next: at(1) };
}

export function HeroNavButton({
  target,
  direction,
  label,
  lang,
}: {
  target: HeroNavTarget;
  direction: 'previous' | 'next';
  label: string;
  lang: Lang;
}) {
  const name = nameOf(target.entry, lang);
  return (
    <Link
      className={`hero-nav hero-nav-${direction}`}
      to={`/destination/${target.entry.id}`}
      state={{ navigation: target.navigation }}
      aria-label={`${label}: ${name}`}
      title={`${label}: ${name}`}
    >
      <span className="hero-nav-icon" aria-hidden="true">
        <Icon name={direction === 'previous' ? 'arrowStart' : 'arrowEnd'} size={20} stroke={2.4} />
      </span>
      <span className="hero-nav-name" aria-hidden="true">{name}</span>
    </Link>
  );
}
