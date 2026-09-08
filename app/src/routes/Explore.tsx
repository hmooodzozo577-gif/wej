// Ports filteredDestinations() + renderExplore() from wejhaty.html.
import { useAppState, useI18n } from '../state/hooks';
import { DESTINATIONS } from '../data/destinations';
import { costLabel } from '../data/destinationText';
import { PURPOSES } from '../data/purposes';
import type { Destination, Region } from '../data/types';
import { DestinationCard } from '../components/DestinationCard';
import { Icon } from '../components/Icon';
import type { ExploreFilters } from '../state/types';

const REGIONS: Region[] = ['Asia', 'Europe', 'MiddleEast', 'NAmerica', 'Oceania'];

const PURPOSE_SCORE_KEY: Record<string, keyof Destination> = {
  tourism: 'pTourism',
  work: 'pWork',
  education: 'pEdu',
  medical: 'pMed',
  immigration: 'pImmi',
  investment: 'pInvest',
  wellness: 'pWellness',
};

function filteredDestinations(f: ExploreFilters): Destination[] {
  const q = f.q.trim().toLowerCase();
  return DESTINATIONS.filter((d) => {
    if (q) {
      const hay = (d.nameEn + ' ' + d.nameAr + ' ' + d.citiesEn.join(' ') + ' ' + d.citiesAr.join(' ')).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.region && d.region !== f.region) return false;
    if (f.cost && String(d.costLevel) !== f.cost) return false;
    if (f.purpose) {
      const key = PURPOSE_SCORE_KEY[f.purpose];
      if (key && (d[key] as number) < 65) return false;
    }
    return true;
  });
}

export function Explore() {
  const { state, dispatch } = useAppState();
  const { lang, t } = useI18n();
  const ex = t.explore;
  const purposeOpts = PURPOSES.filter((p) => p.id !== 'other');
  const list = filteredDestinations(state.explore);

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
                {REGIONS.map((r) => (
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
