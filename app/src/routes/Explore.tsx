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
import type { ExploreFilters } from '../state/types';
import { SurpriseDestination } from '../components/SurpriseDestination';
import { filteredCatalog, sortCatalog } from '../data/exploreCatalog';
import { trackEvent } from '../telemetry/productDataClient';

const CONTINENTS: Continent[] = ['Africa', 'Asia', 'Europe', 'MiddleEast', 'NAmerica', 'SouthAmerica', 'Oceania'];

export function Explore() {
  const { state, dispatch } = useAppState();
  const { lang, t } = useI18n();
  const ex = t.explore;
  const purposeOpts = PURPOSES.filter((p) => p.id !== 'other');
  const filtered = filteredCatalog(state.explore);
  const list = sortCatalog(filtered, state.explore.sort, lang, state.location.coords);
  const navigationIds = list.map((item) => item.id);

  const setFilter = (key: keyof ExploreFilters, value: string) => {
    dispatch({ type: 'SET_EXPLORE_FILTER', key, value });
    if (key !== 'q') trackEvent('explore_filter_changed', { filter: key, value: value || 'all' }, { path: '/explore', locale: lang });
  };

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <h1 className="display">{ex.title}</h1>
          <p>{ex.sub}</p>
        </div>
      </section>
      <section className="section" style={{ paddingTop: 30 }}>
        <div className="container">
          <LocationPersonalize />
          <SurpriseDestination candidates={list} lang={lang} strings={ex} />
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
              <label htmlFor="exSort">{ex.sort}</label>
              <Select id="exSort" value={state.explore.sort} icon={<Icon name="trending" size={15} />} onChange={(e) => setFilter('sort', e.target.value)}>
                <option value="default">{ex.sortDefault}</option>
                <option value="name-asc">{ex.sortNameAsc}</option>
                <option value="name-desc">{ex.sortNameDesc}</option>
                <option value="area-desc">{ex.sortAreaDesc}</option>
                <option value="area-asc">{ex.sortAreaAsc}</option>
                <option value="cost-asc">{ex.sortCostAsc}</option>
                <option value="cost-desc">{ex.sortCostDesc}</option>
                {state.location.coords ? <option value="nearest">{ex.sortNearest}</option> : null}
              </Select>
            </div>
            <div className="field">
              <label htmlFor="exRegion">{ex.region}</label>
              <Select id="exRegion" value={state.explore.region} icon={<Icon name="globe" size={15} />} onChange={(e) => setFilter('region', e.target.value)}>
                <option value="">{ex.allRegions}</option>
                {CONTINENTS.map((r) => (
                  <option value={r} key={r}>
                    {t.regionLabels[r]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="field">
              <label htmlFor="exPurpose">{ex.purpose}</label>
              <Select id="exPurpose" value={state.explore.purpose} icon={<Icon name="compass" size={15} />} onChange={(e) => setFilter('purpose', e.target.value)}>
                <option value="">{ex.allPurposes}</option>
                {purposeOpts.map((p) => (
                  <option value={p.id} key={p.id}>
                    {t.purposes[p.id].n}
                  </option>
                ))}
              </Select>
            </div>
            <div className="field">
              <label htmlFor="exCost">{ex.cost}</label>
              <Select id="exCost" value={state.explore.cost} icon={<Icon name="tag" size={15} />} onChange={(e) => setFilter('cost', e.target.value)}>
                <option value="">{ex.allCosts}</option>
                {[1, 2, 3, 4].map((c) => (
                  <option value={String(c)} key={c}>
                    {costLabel(t.costLevels, c)}
                  </option>
                ))}
              </Select>
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
