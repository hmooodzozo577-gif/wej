// v1.1 — /compare?ids=a,b[,c]. See compare/compareModel.ts for what is
// compared and what is deliberately not. The page is noindex (seo/meta.ts)
// and its URL carries destination ids only.
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppState, useI18n } from '../state/hooks';
import { usePersonalization } from '../personalization/usePersonalization';
import { WORLD_CATALOG } from '../data/worldCatalog';
import { nameOf } from '../data/destinationText';
import { FlagChip } from '../components/flags/FlagIcon';
import { Icon } from '../components/Icon';
import { Select } from '../components/Select';
import { COMPARE_COPY, COMPARE_MAX, COMPARE_MIN, buildComparison, compareEntries, compareSearch, parseCompareIds } from '../compare/compareModel';

export function Compare() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useAppState();
  const { lang, t } = useI18n();
  const { preferences } = usePersonalization();
  const copy = COMPARE_COPY[lang];
  const { ids, truncated } = parseCompareIds(location.search);
  const entries = compareEntries(ids);
  const origin = state.location.status === 'granted' ? state.location.coords ?? null : null;
  const sections = buildComparison(entries, { lang, t, preferences, origin });

  const setIds = (next: string[]) => navigate({ pathname: '/compare', search: compareSearch(next) }, { replace: true });
  const options = [...WORLD_CATALOG]
    .filter((entry) => !ids.includes(entry.id))
    .sort((a, b) => nameOf(a, lang).localeCompare(nameOf(b, lang), lang))
    .map((entry) => ({ value: entry.id, label: nameOf(entry, lang), icon: <FlagChip dest={entry} width={20} height={15} /> }));

  return (
    <section className="container compare-page" aria-labelledby="compare-title">
      <header className="compare-head">
        <h1 id="compare-title">{copy.title}</h1>
        <p className="compare-lead">{copy.lead}</p>
      </header>

      {truncated ? <p className="compare-note" role="note">{copy.limit}</p> : null}

      {entries.length < COMPARE_MAX ? (
        <div className="compare-add">
          <span id="compare-add-label" className="compare-add-label">{copy.add}</span>
          <Select
            labelledBy="compare-add-label"
            value=""
            placeholder={copy.addPlaceholder}
            options={options}
            onChange={(id) => setIds([...ids, id])}
            searchable
            searchPlaceholder={copy.search}
            emptyText={copy.noMatch}
            icon={<Icon name="plus" size={16} />}
          />
        </div>
      ) : null}

      {entries.length === 0 ? (
        <div className="detail-card compare-empty">
          <p>{copy.empty}</p>
          <Link className="btn btn-ghost" to="/favorites">{copy.toFavorites}</Link>
        </div>
      ) : (
        <>
          {entries.length < COMPARE_MIN ? <p className="compare-note" role="status">{copy.needMore}</p> : null}
          <div className="compare-scroll" role="region" aria-labelledby="compare-caption" tabIndex={0}>
            <table className="compare-table">
              <caption id="compare-caption" className="visually-hidden">{copy.caption}</caption>
              <thead>
                <tr>
                  <td className="compare-corner" />
                  {entries.map((entry) => (
                    <th key={entry.id} scope="col" className="compare-dest">
                      <span className="compare-dest-name">
                        <FlagChip dest={entry} width={22} height={16} />
                        <Link to={`/destination/${entry.id}`}>{nameOf(entry, lang)}</Link>
                      </span>
                      <button
                        type="button"
                        className="compare-remove"
                        aria-label={copy.remove(nameOf(entry, lang))}
                        title={copy.remove(nameOf(entry, lang))}
                        onClick={() => setIds(ids.filter((id) => id !== entry.id))}
                      >
                        <Icon name="close" size={16} />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              {sections.map((section) => (
                <tbody key={section.id}>
                  <tr className="compare-section-row">
                    <th scope="colgroup" colSpan={entries.length + 1}>
                      {section.title}
                      {section.id === 'suitability' ? <span className="compare-section-note">{copy.suitabilityNote}</span> : null}
                    </th>
                  </tr>
                  {section.rows.map((row) => (
                    <tr key={row.id}>
                      <th scope="row">{row.label}</th>
                      {row.cells.map((value, index) => (
                        <td key={entries[index]!.id} className={value.missing ? 'is-missing' : undefined}>
                          <span className="compare-value">{value.text}</span>
                          {value.note ? <span className="compare-cell-note">{value.note}</span> : null}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
          {!preferences ? (
            <p className="compare-note">
              {copy.personalNoProfile} <Link to="/purpose">{copy.personalCta}</Link>
            </p>
          ) : null}
          {!origin ? <p className="compare-note">{copy.distanceUnavailable}</p> : null}
        </>
      )}
    </section>
  );
}
