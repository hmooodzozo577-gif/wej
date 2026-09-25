// v1.1 — /favorites: the destinations saved on this device, with open,
// remove and select-for-compare. Local only (favorites/store.ts); noindex.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '../state/hooks';
import { useFavorites } from '../favorites/context';
import { FAVORITES_COPY } from '../favorites/copy';
import { compareEntries, compareSearch, COMPARE_MAX, COMPARE_MIN } from '../compare/compareModel';
import { continentOf } from '../data/worldCatalog';
import { nameOf } from '../data/destinationText';
import { FlagChip } from '../components/flags/FlagIcon';
import { Icon } from '../components/Icon';
import { announce } from '../site/announce';

export function Favorites() {
  const navigate = useNavigate();
  const { lang, t } = useI18n();
  const favorites = useFavorites();
  const copy = FAVORITES_COPY[lang];
  const entries = compareEntries(favorites.ids);
  const [selected, setSelected] = useState<string[]>([]);
  const chosen = selected.filter((id) => favorites.ids.includes(id));
  const atLimit = chosen.length >= COMPARE_MAX;

  const toggleSelected = (id: string) => {
    if (chosen.includes(id)) setSelected(chosen.filter((item) => item !== id));
    else if (!atLimit) setSelected([...chosen, id]);
  };

  return (
    <section className="container favorites-page" aria-labelledby="favorites-title">
      <header className="favorites-head">
        <h1 id="favorites-title">{copy.title}</h1>
        <p className="favorites-lead">{copy.lead}</p>
        {entries.length ? <p className="favorites-count">{copy.count(entries.length)}</p> : null}
        {!favorites.persisted ? <p className="compare-note" role="status">{copy.notRemembered}</p> : null}
      </header>

      {entries.length === 0 ? (
        <div className="detail-card favorites-empty">
          <h2>{copy.emptyTitle}</h2>
          <p>{copy.emptyBody}</p>
          <Link className="btn btn-primary" to="/explore">{copy.emptyCta}</Link>
        </div>
      ) : (
        <>
          <ul className="favorites-list">
            {entries.map((entry) => {
              const name = nameOf(entry, lang);
              const isChosen = chosen.includes(entry.id);
              return (
                <li key={entry.id} className="detail-card favorite-item">
                  <label className="favorite-select">
                    <input
                      type="checkbox"
                      checked={isChosen}
                      disabled={!isChosen && atLimit}
                      onChange={() => toggleSelected(entry.id)}
                      aria-label={copy.selectForCompare(name)}
                    />
                  </label>
                  <span className="favorite-name">
                    <FlagChip dest={entry} width={24} height={18} />
                    <span>
                      <Link to={`/destination/${entry.id}`} className="favorite-link">{name}</Link>
                      <span className="favorite-region">{t.regionLabels[continentOf(entry)]}</span>
                    </span>
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm favorite-remove"
                    aria-label={copy.removeFor(name)}
                    onClick={() => {
                      favorites.remove(entry.id);
                      announce(copy.removed(name));
                    }}
                  >
                    <Icon name="close" size={16} /> {copy.remove}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="favorites-compare">
            <p className="compare-note" aria-live="polite">{atLimit ? copy.compareLimit : copy.compareHint}</p>
            <button
              type="button"
              className="btn btn-primary"
              disabled={chosen.length < COMPARE_MIN}
              onClick={() => navigate({ pathname: '/compare', search: compareSearch(chosen) })}
            >
              <Icon name="columns" size={18} /> {copy.compareSelected(chosen.length)}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
