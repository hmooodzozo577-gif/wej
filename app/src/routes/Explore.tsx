// Ports filteredDestinations() + renderExplore() from wejhaty.html.
//
// Phase 10: the data source is now the full worldwide WORLD_CATALOG (195)
// instead of just DESTINATIONS (30) — the toolbar, layout, and card grid
// are otherwise unchanged. The purpose/cost filters only make sense for
// recommendation-ready entries (a basic country has no costLevel/pTourism
// etc.), so they now explicitly exclude non-recommendation-ready entries
// rather than silently letting them through unfiltered or crashing on a
// missing field.
import { useAppState, useI18n } from '../state/hooks';
import { costLabel } from '../data/destinationText';
import { PURPOSES } from '../data/purposes';
import type { Continent } from '../data/types';
import { DestinationCard } from '../components/DestinationCard';
import { LocationPersonalize } from '../components/LocationPersonalize';
import { Icon } from '../components/Icon';
import { Select } from '../components/Select';
import { LOCATION_DEPENDENT_SORTS, type ExploreFilters } from '../state/types';
import { SurpriseDestination } from '../components/SurpriseDestination';
import { filteredCatalog, sortCatalog } from '../data/exploreCatalog';
import { trackEvent } from '../telemetry/productDataClient';
import { useResolvedCountryCode } from '../geo/useResolvedCountryCode';
import { TravelRouteDecor } from '../components/TravelRouteDecor';

const CONTINENTS: Continent[] = ['Africa', 'Asia', 'Europe', 'MiddleEast', 'NAmerica', 'SouthAmerica', 'Oceania'];

export function Explore() {
  const { state, dispatch } = useAppState();
  const { lang, t } = useI18n();
  const ex = t.explore;
  const purposeOpts = PURPOSES.filter((p) => p.id !== 'other');
  const hasLocation = !!state.location.coords;
  // Acceptance fix — the traveller's own current country, resolved through
  // the real point-in-polygon resolver (see geo/useResolvedCountryCode.ts
  // for exactly why the old nearest-centroid approach is unreliable here).
  // undefined while unresolved: sortCatalog treats that as "don't exclude
  // anything yet" rather than guessing, so an uncertain resolution never
  // hides the wrong country.
  const currentCountryCode = useResolvedCountryCode(state.location.coords);
  const filtered = filteredCatalog(state.explore);
  // Item #7 — a distance sort saved in state before location was lost must
  // not keep claiming to sort by distance. Fall back to the default order.
  const effectiveSort = !hasLocation && LOCATION_DEPENDENT_SORTS.includes(state.explore.sort) ? 'default' : state.explore.sort;
  const list = sortCatalog(filtered, effectiveSort, lang, state.location.coords, currentCountryCode);
  const navigationIds = list.map((item) => item.id);

  const sortOptions = [
    { value: 'default', label: ex.sortDefault },
    { value: 'name-asc', label: ex.sortNameAsc },
    { value: 'name-desc', label: ex.sortNameDesc },
    { value: 'area-desc', label: ex.sortAreaDesc },
    { value: 'area-asc', label: ex.sortAreaAsc },
    { value: 'cost-asc', label: ex.sortCostAsc },
    { value: 'cost-desc', label: ex.sortCostDesc },
    ...(hasLocation
      ? [
          { value: 'nearest', label: ex.sortNearest },
          { value: 'farthest', label: ex.sortFarthest },
        ]
      : []),
  ];

  const setFilter = (key: keyof ExploreFilters, value: string) => {
    dispatch({ type: 'SET_EXPLORE_FILTER', key, value });
    if (key !== 'q') trackEvent('explore_filter_changed', { filter: key, value: value || 'all' }, { path: '/explore', locale: lang });
  };

  return (
    <>
      <section className="page-hero page-hero-ambient">
        <TravelRouteDecor variant="explore-header" />
        <div className="container">
          <h1 className="display">{ex.title}</h1>
          <p>{ex.sub}</p>
        </div>
      </section>
      <section className="section" style={{ paddingTop: 30 }}>
        <div className="container">
          <LocationPersonalize />
          <SurpriseDestination candidates={list} lang={lang} strings={ex} origin={state.location.coords} />
          <div className="explore-toolbar">
            <div className="field">
              <label htmlFor="exSearch">{ex.search}</label>
              <input
                type="text"
                id="exSearch"
                value={state.explore.q}
                placeholder={ex.search}
                onChange={(e) => setFilter('q', e.target.value)}
                onBlur={() => trackEvent('explore_search', { used: state.explore.q.trim().length > 0, length: state.explore.q.trim().length }, { path: '/explore', locale: lang })}
              />
            </div>
            <div className="field">
              <span id="exSortLabel" className="field-label">{ex.sort}</span>
              <Select
                id="exSort"
                labelledBy="exSortLabel"
                value={effectiveSort}
                icon={<Icon name="trending" size={15} />}
                options={sortOptions}
                onChange={(value) => setFilter('sort', value)}
              />
              {/* Item #7 — clear gated UX: the distance sorts are not offered
                  at all without real location context, and the reason is
                  stated instead of silently omitting them. */}
              {hasLocation ? null : <small className="field-note">{ex.sortDistanceLocked}</small>}
            </div>
            <div className="field">
              <span id="exRegionLabel" className="field-label">{ex.region}</span>
              <Select
                id="exRegion"
                labelledBy="exRegionLabel"
                value={state.explore.region}
                icon={<Icon name="globe" size={15} />}
                options={[
                  { value: '', label: ex.allRegions },
                  ...CONTINENTS.map((r) => ({ value: r, label: t.regionLabels[r] })),
                ]}
                onChange={(value) => setFilter('region', value)}
              />
            </div>
            <div className="field">
              <span id="exPurposeLabel" className="field-label">{ex.purpose}</span>
              <Select
                id="exPurpose"
                labelledBy="exPurposeLabel"
                value={state.explore.purpose}
                icon={<Icon name="compass" size={15} />}
                options={[
                  { value: '', label: ex.allPurposes },
                  ...purposeOpts.map((p) => ({ value: p.id, label: t.purposes[p.id].n })),
                ]}
                onChange={(value) => setFilter('purpose', value)}
              />
            </div>
            <div className="field">
              <span id="exCostLabel" className="field-label">{ex.cost}</span>
              <Select
                id="exCost"
                labelledBy="exCostLabel"
                value={state.explore.cost}
                icon={<Icon name="tag" size={15} />}
                options={[
                  { value: '', label: ex.allCosts },
                  ...[1, 2, 3, 4].map((c) => ({ value: String(c), label: costLabel(t.costLevels, c) })),
                ]}
                onChange={(value) => setFilter('cost', value)}
              />
            </div>
          </div>
          <div className="explore-count">
            {list.length} {ex.results}
          </div>
          {list.length ? (
            <div className="explore-grid">
              {list.map((d, index) => (
                <DestinationCard key={d.id} dest={d} lang={lang} t={t} navigation={{ source: 'explore', ids: navigationIds, index }} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Icon name="search" size={34} stroke={1.6} />
              <h3>{ex.noResults}</h3>
              <p>{ex.noResultsSub}</p>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  trackEvent('explore_filters_reset', {}, { path: '/explore', locale: lang });
                  dispatch({ type: 'RESET_EXPLORE_FILTERS' });
                }}
              >
                {ex.clearFilters}
              </button>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
