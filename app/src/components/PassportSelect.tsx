// Item #12D — the optional passport question, asked BEFORE results.
//
// What changed and why: this used to be a "nationality" field rendered
// BELOW the recommendations, where by construction it could not affect
// them. It is now (a) a passport question, because that is what every entry-
// requirement provider actually keys on and what a traveller can answer
// unambiguously, and (b) part of the questionnaire, immediately before the
// results transition, so the answer exists while the ranking is still being
// decided.
//
// It remains OPTIONAL and skippable. Skipping is not a penalty: with no
// passport, visa data simply does not participate (see visa/visaRanking.ts),
// and no destination is marked down for the absence.
//
// It is NEVER inferred from location. Location says where the traveller is;
// a passport says what document they hold. Those are different facts and
// this component reads neither from the other.
import { useMemo } from 'react';
import { useAppState, useI18n } from '../state/hooks';
import { WORLD_CATALOG } from '../data/worldCatalog';
import { nameOf } from '../data/destinationText';
import { FlagChip } from './flags/FlagIcon';
import { Icon } from './Icon';
import { Select } from './Select';

export function PassportSelect({ id = 'passport-select' }: { id?: string }) {
  const { state, dispatch } = useAppState();
  const { lang, t } = useI18n();
  const p = t.passport;

  // ~194 options, so the searchable variant of the listbox: typing filters,
  // and each row carries its own flag so the list is scannable rather than a
  // wall of country names.
  const options = useMemo(
    () =>
      [...WORLD_CATALOG]
        .sort((a, b) => nameOf(a, lang).localeCompare(nameOf(b, lang), lang === 'ar' ? 'ar' : 'en'))
        .map((country) => ({
          value: country.countryCode,
          label: nameOf(country, lang),
          icon: <FlagChip dest={country} width={20} height={15} />,
        })),
    [lang],
  );

  return (
    <div className="field passport-field">
      <span id={`${id}-label`} className="field-label">{p.label}</span>
      <Select
        id={id}
        labelledBy={`${id}-label`}
        value={state.passportCode ?? ''}
        options={options}
        placeholder={p.placeholder}
        searchable
        searchPlaceholder={p.searchPlaceholder}
        emptyText={p.noMatches}
        icon={<Icon name="shield" size={15} />}
        onChange={(value) => dispatch({ type: 'SET_PASSPORT', countryCode: value || null })}
      />
      {state.passportCode ? (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 10 }}
          onClick={() => dispatch({ type: 'SET_PASSPORT', countryCode: null })}
        >
          {p.clear}
        </button>
      ) : null}
    </div>
  );
}
