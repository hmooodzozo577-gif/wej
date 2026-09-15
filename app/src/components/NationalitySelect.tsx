// Item #13 — optional, skippable nationality selection. Deliberately NOT
// part of the deterministic quiz `answers` (never scored, never affects
// ranking) and never inferred from `state.location` — location is where the
// user IS, nationality is what passport they hold, and this app must never
// conflate the two. A native <input list> + <datalist> gives real type-to-
// search behavior (matches "searchable/selectable") without a bespoke
// combobox, while staying fully keyboard-operable and screen-reader
// friendly out of the box.
import { useEffect, useId, useState } from 'react';
import { useAppState, useI18n } from '../state/hooks';
import { WORLD_CATALOG } from '../data/worldCatalog';
import { nameOf } from '../data/destinationText';
import { Icon } from './Icon';

export function NationalitySelect() {
  const { state, dispatch } = useAppState();
  const { lang, t } = useI18n();
  const n = t.nationality;
  const listId = useId();

  const options = [...WORLD_CATALOG].sort((a, b) =>
    nameOf(a, lang).localeCompare(nameOf(b, lang), lang === 'ar' ? 'ar' : 'en'));
  const current = state.nationalityCode ? options.find((c) => c.countryCode === state.nationalityCode) : undefined;

  const [text, setText] = useState(current ? nameOf(current, lang) : '');
  useEffect(() => {
    setText(current ? nameOf(current, lang) : '');
    // Only resync from committed state/language changes, not every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.nationalityCode, lang]);

  const commit = (value: string) => {
    const trimmed = value.trim();
    setText(value);
    if (!trimmed) {
      if (state.nationalityCode !== null) dispatch({ type: 'SET_NATIONALITY', countryCode: null });
      return;
    }
    const match = options.find((c) => nameOf(c, lang) === trimmed);
    if (match && match.countryCode !== state.nationalityCode) dispatch({ type: 'SET_NATIONALITY', countryCode: match.countryCode });
  };

  const clear = () => {
    dispatch({ type: 'SET_NATIONALITY', countryCode: null });
    setText('');
  };

  return (
    <div className="detail-card nationality-select">
      <h3>
        <Icon name="cap" size={18} /> {n.title}
      </h3>
      <p>{n.sub}</p>
      <div className="field">
        <label htmlFor={`nationality-${listId}`}>{n.label}</label>
        <input
          id={`nationality-${listId}`}
          list={`nationality-options-${listId}`}
          type="text"
          value={text}
          placeholder={n.placeholder}
          autoComplete="off"
          onChange={(event) => commit(event.target.value)}
        />
        <datalist id={`nationality-options-${listId}`}>
          {options.map((country) => (
            <option key={country.id} value={nameOf(country, lang)} />
          ))}
        </datalist>
      </div>
      {current ? (
        <button type="button" className="btn btn-ghost btn-sm" onClick={clear}>
          {n.clear}
        </button>
      ) : null}
      <p className="city-data-note">{n.privacyNote}</p>
    </div>
  );
}
