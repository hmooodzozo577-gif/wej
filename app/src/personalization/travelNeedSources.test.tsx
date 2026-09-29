// v1.1 RC2 — the ODbL source notice under "why this destination suits you":
// shown only when a travel-need factor is part of the match, naming each
// database, linking it and the licence, and saying the thresholds are
// Wejhaty's own — never an OpenStreetMap rating.
import { render } from '@testing-library/react';
import { useEffect } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppStateProvider } from '../state/AppStateContext';
import { useAppState } from '../state/hooks';
import { Destination } from '../routes/Destination';
import type { Answers } from '../engine/types';
import { PersonalizationProvider } from './PersonalizationProvider';
import { PERSONALIZATION_STORAGE_KEY, type StorageLike } from './storage';
import { createProfile } from './profile';

const CORE: Answers = { 'tourism-climate': 'cold', 'tourism-cost': 3, 'tourism-coastal': 100, 'tourism-safety': 75 };

function storageWith(answers: Answers): StorageLike {
  const data: Record<string, string> = {
    'wejhaty.theme': 'light',
    [PERSONALIZATION_STORAGE_KEY]: JSON.stringify(createProfile('tourism', answers, Object.keys(answers), new Date('2026-09-27T00:00:00Z'))),
  };
  return {
    getItem: (key) => (key in data ? data[key]! : null),
    setItem: (key, value) => { data[key] = value; },
    removeItem: (key) => { delete data[key]; },
  };
}

function English() {
  const { dispatch } = useAppState();
  useEffect(() => { dispatch({ type: 'SET_LANG', lang: 'en' }); }, [dispatch]);
  return null;
}

function sourcesFor(answers: Answers, lang: 'ar' | 'en') {
  const { container, unmount } = render(
    <AppStateProvider>
      <PersonalizationProvider storage={storageWith(answers)}>
        <MemoryRouter initialEntries={['/destination/japan']}>
          {lang === 'en' ? <English /> : null}
          <Routes>
            <Route path="/destination/:id" element={<Destination />} />
          </Routes>
        </MemoryRouter>
      </PersonalizationProvider>
    </AppStateProvider>,
  );
  const notice = container.querySelector('.personal-match-card .personal-match-sources');
  const links = notice ? [...notice.querySelectorAll('a')].map((a) => [a.textContent, a.getAttribute('href')]) : [];
  const text = notice?.textContent ?? null;
  unmount();
  return { text, links };
}

const ALL_NEEDS: Answers = {
  ...CORE,
  'tourism-languageImportance': 100,
  'tourism-languages': 'ar,en',
  'tourism-islamicPractice': 100,
  'tourism-halalFood': 60,
};

describe('travel-need source notice', () => {
  it('Arabic: credits OpenStreetMap contributors and world-countries under the ODbL, and owns the thresholds', () => {
    const { text, links } = sourcesFor(ALL_NEEDS, 'ar');
    expect(links).toEqual([
      ['© مساهمو OpenStreetMap', 'https://www.openstreetmap.org/copyright'],
      ['ODbL', 'https://opendatacommons.org/licenses/odbl/1-0/'],
      ['mledoze/countries', 'https://github.com/mledoze/countries'],
      ['ODbL', 'https://opendatacommons.org/licenses/odbl/1-0/'],
    ]);
    expect(text).toMatch(/حدود احتسابها فمن منهجية وجهتي، وليست تقييمًا من OpenStreetMap/);
    expect(text).toMatch(/أعداد المساجد والأماكن الحلال من بيانات OpenStreetMap \(© مساهمو OpenStreetMap\)، متاحة بترخيص ODbL\./);
    expect(text).toMatch(/اللغات الرسمية من قاعدة بيانات world-countries \(mledoze\/countries\)، متاحة بترخيص ODbL\./);
  });

  it('English: the same notice, in English only', () => {
    const { text, links } = sourcesFor(ALL_NEEDS, 'en');
    expect(links.map(([label]) => label)).toEqual(['© OpenStreetMap contributors', 'ODbL', 'mledoze/countries', 'ODbL']);
    expect(text).toMatch(/Mosque and halal counts come from OpenStreetMap data \(© OpenStreetMap contributors\), available under the ODbL\./);
    expect(text).toMatch(/Official languages come from the world-countries database \(mledoze\/countries\), available under the ODbL\./);
    expect(text).toMatch(/Wejhaty's own method, not an OpenStreetMap rating/);
    expect(text).not.toMatch(/[؀-ۿ]/);
  });

  it('names only the source a factor actually uses', () => {
    const languageOnly = sourcesFor({ ...CORE, 'tourism-languageImportance': 60, 'tourism-languages': 'en' }, 'en');
    expect(languageOnly.links.map(([label]) => label)).toEqual(['mledoze/countries', 'ODbL']);
    const halalOnly = sourcesFor({ ...CORE, 'tourism-halalFood': 100 }, 'en');
    expect(halalOnly.links.map(([label]) => label)).toEqual(['© OpenStreetMap contributors', 'ODbL']);
  });

  it('is absent when no travel need is part of the match', () => {
    expect(sourcesFor(CORE, 'ar').text).toBeNull();
    expect(sourcesFor({ ...CORE, 'tourism-islamicPractice': 0, 'tourism-halalFood': 0 }, 'en').text).toBeNull();
  });
});
