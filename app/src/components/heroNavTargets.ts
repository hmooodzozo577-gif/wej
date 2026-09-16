// Item #3 — the pure "which destinations sit either side of this one"
// calculation, split out of DestinationHeroNav.tsx so that file exports only
// components (React Fast Refresh requirement; a lint-only concern with no
// behavior change).
import type { CatalogEntry } from '../data/types';
import type { DestinationNavigation } from '../state/types';

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

