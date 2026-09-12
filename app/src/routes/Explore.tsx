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
import { WORLD_CATALOG, continentOf } from '../data/worldCatalog';
import type { CatalogEntry, Continent } from '../data/types';
import { RECOMMENDATION_PROFILE_BY_CODE } from '../data/worldRecommendation';
import { DestinationCard } from '../components/DestinationCard';
import { LocationPersonalize } from '../components/LocationPersonalize';
import { Icon } from '../components/Icon';
import type { ExploreFilters } from '../state/types';

const CONTINENTS: Continent[] = ['Africa', 'Asia', 'Europe', 'MiddleEast', 'NAmerica', 'SouthAmerica', 'Oceania'];

function searchHaystack(d: CatalogEntry): string {
  const parts = [d.nameEn, d.nameAr];
  if (d.recommendationReady) {
    parts.push(...d.citiesEn, ...d.citiesAr);
  } else if (d.capitalEn) {
    parts.push(d.capitalEn);
  }
  return parts.join(' ').toLowerCase();
}

function filteredCatalog(f: ExploreFilters): CatalogEntry[] {
  const q = f.q.trim().toLowerCase();
  return WORLD_CATALOG.filter((d) => {
    if (q && !searchHaystack(d).includes(q)) return false;
    if (f.region && continentOf(d) !== f.region) return false;
    // Cost and purpose filters only apply to recommendation-ready entries —
    // a basic country has neither field, so it's excluded rather than
    // silently shown as a false match.
    if (f.cost && String(RECOMMENDATION_PROFILE_BY_CODE.get(d.countryCode)?.costLevel) !== f.cost) return false;
    if (f.purpose) {
      const profile = RECOMMENDATION_PROFILE_BY_CODE.get(d.countryCode);
      if (!profile) return false;
      const profileKey = f.purpose === 'work' ? 'opportunity' : f.purpose === 'education' ? 'education' : f.purpose === 'medical' ? 'health' : f.purpose === 'investment' ? 'investment' : 'popularity';
      if (profile[profileKey] < 55) return false;
    }
    return true;
  });
}

export function Explore() {
  const { state, dispatch } = useAppState();
  const { lang, t } = useI18n();
  const ex = t.explore;
  const purposeOpts = PURPOSES.filter((p) => p.id !== 'other');
  const list = filteredCatalog(state.explore);

  const setFilter = (key: keyof ExploreFilters, value: string) =>
    dispatch({ type: 'SET_EXPLORE_FILTER', key, value });

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
          <div className="explore-toolbar">
            <div className="field">
              <label htmlFor="exSearch">{ex.search}</label>
              <input
                type="text"
                id="exSearch"
                value={state.explore.q}
                placeholder={ex.search}
                onChange={(e) => setFilter('q', e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="exRegion">{ex.region}</label>
              <select id="exRegion" value={state.explore.region} onChange={(e) => setFilter('region', e.target.value)}>
                <option value="">{ex.allRegions}</option>
                {CONTINENTS.map((r) => (
                  <option value={r} key={r}>
                    {t.regionLabels[r]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="exPurpose">{ex.purpose}</label>
              <select id="exPurpose" value={state.explore.purpose} onChange={(e) => setFilter('purpose', e.target.value)}>
                <option value="">{ex.allPurposes}</option>
                {purposeOpts.map((p) => (
                  <option value={p.id} key={p.id}>
                    {t.purposes[p.id].n}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="exCost">{ex.cost}</label>
              <select id="exCost" value={state.explore.cost} onChange={(e) => setFilter('cost', e.target.value)}>
                <option value="">{ex.allCosts}</option>
                {[1, 2, 3, 4].map((c) => (
                  <option value={String(c)} key={c}>
                    {costLabel(t.costLevels, c)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="explore-count">
            {list.length} {ex.results}
          </div>
          {list.length ? (
            <div className="explore-grid">
              {list.map((d) => (
                <DestinationCard key={d.id} dest={d} lang={lang} t={t} />
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
                onClick={() => dispatch({ type: 'RESET_EXPLORE_FILTERS' })}
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
