// Phase 18 UI integration: Results, Destination, Explore, Surprise, reset,
// edit and save — with and without a saved profile, in Arabic and English.
// Storage is an in-memory stand-in injected into the provider.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppStateProvider } from '../state/AppStateContext';
import { useAppState } from '../state/hooks';
import { Results } from '../routes/Results';
import { Destination } from '../routes/Destination';
import { Explore } from '../routes/Explore';
import { Quiz } from '../routes/Quiz';
import { WORLD_CATALOG } from '../data/worldCatalog';
import { PersonalizationProvider } from './PersonalizationProvider';
import { usePersonalization } from './usePersonalization';
import { PERSONALIZATION_STORAGE_KEY, type StorageLike } from './storage';
import { createProfile } from './profile';
import { normalizePreferences } from './signals';
import { comparePersonal, personalMatchesFor } from './personalMatch';
import { sortByPersonalMatch } from './sortByPersonalMatch';
import { filteredCatalog, sortCatalog } from '../data/exploreCatalog';
import type { Answers } from '../engine/types';

const ANSWERS: Answers = { 'tourism-climate': 'cold', 'tourism-cost': 3, 'tourism-coastal': 100, 'tourism-safety': 75 };
const PATH = Object.keys(ANSWERS);

function memoryStorage(withProfile: boolean): StorageLike & { data: Record<string, string> } {
  const data: Record<string, string> = { 'wejhaty.theme': 'light' };
  if (withProfile) data[PERSONALIZATION_STORAGE_KEY] = JSON.stringify(createProfile('tourism', ANSWERS, PATH, new Date('2026-09-23T00:00:00Z')));
  return {
    data,
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

function Where() {
  const location = useLocation();
  return <output data-testid="where">{location.pathname}</output>;
}

function renderAt(path: string, storage: StorageLike, extraRoutes: ReactNode = null, lang: 'ar' | 'en' = 'ar') {
  return render(
    <AppStateProvider>
      <PersonalizationProvider storage={storage}>
        <MemoryRouter initialEntries={[path]}>
          {lang === 'en' ? <English /> : null}
          <Where />
          <Routes>
            <Route path="/results" element={<Results />} />
            <Route path="/destination/:id" element={<Destination />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/quiz/:purpose" element={<Quiz />} />
            <Route path="/purpose" element={<p>purpose page</p>} />
            {extraRoutes}
          </Routes>
        </MemoryRouter>
      </PersonalizationProvider>
    </AppStateProvider>,
  );
}

describe('Results — Phase 18', () => {
  it('rebuilds results from the saved profile after a reload, with labelled personal and general figures', () => {
    const { container } = renderAt('/results', memoryStorage(true));
    expect(screen.getByText('التوافق معك')).toBeInTheDocument();
    expect(container.querySelector('.top-pick-general')?.textContent).toMatch(/^الملاءمة العامة \(سياحة وإجازة\): \d+%$/);
    // Isolated so the number reads "63%" like the ring and pills, not "%63".
    expect(container.querySelector('.top-pick-general b')?.getAttribute('dir')).toBe('ltr');
    // Compact badges: only "NN%" visibly, the measure named for assistive tech.
    const pills = [...container.querySelectorAll('.results-grid .personal-pill')];
    expect(pills).toHaveLength(4);
    for (const pill of pills) {
      expect(pill.textContent).toMatch(/^\d+%$/);
      expect(pill.getAttribute('aria-label')).toMatch(/^التوافق معك \d+%$/);
    }
    expect(container.querySelector('.results-wrap')!.textContent).not.toMatch(/\d+% لك/);
    expect(screen.getByRole('button', { name: 'تعديل تفضيلاتي' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'إعادة تعيين التفضيلات' })).toBeInTheDocument();
    expect(screen.getByText(/تُحفظ تفضيلاتك على هذا المتصفح فقط/)).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: /^التوافق معك \d+%$/ }).length).toBeGreaterThanOrEqual(5);
  });

  it('sends a first-time visitor with no profile and no quiz to the questionnaire', () => {
    renderAt('/results', memoryStorage(false));
    expect(screen.getByTestId('where').textContent).toBe('/purpose');
  });

  it('reset clears only the profile and returns to the questionnaire', async () => {
    const storage = memoryStorage(true);
    renderAt('/results', storage);
    fireEvent.click(screen.getByRole('button', { name: 'إعادة تعيين التفضيلات' }));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/purpose'));
    expect(storage.data[PERSONALIZATION_STORAGE_KEY]).toBeUndefined();
    expect(storage.data['wejhaty.theme']).toBe('light');
  });

  it('edit replays the saved questionnaire with its answers pre-selected', async () => {
    renderAt('/results', memoryStorage(true));
    fireEvent.click(screen.getByRole('button', { name: 'تعديل تفضيلاتي' }));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/quiz/tourism'));
    const selected = screen.getAllByRole('radio').filter((radio) => radio.getAttribute('aria-checked') === 'true');
    expect(selected).toHaveLength(1);
    expect(selected[0]!.textContent).toContain('بارد');
  });

  it('writes clean English copy', () => {
    const { container } = renderAt('/results', memoryStorage(true), null, 'en');
    expect(screen.getByText('Personal match')).toBeInTheDocument();
    expect(container.querySelector('.top-pick-general')?.textContent).toMatch(/^General suitability \(Tourism & Vacation\): \d+%$/);
    const pill = container.querySelector('.results-grid .personal-pill')!;
    expect(pill.textContent).toMatch(/^\d+%$/);
    expect(pill.getAttribute('aria-label')).toMatch(/^Personal match \d+%$/);
    expect(container.querySelector('.results-wrap')!.textContent).not.toMatch(/for you|[؀-ۿ]{3,}/);
  });
});

describe('Destination — Phase 18', () => {
  it('shows the personal section beside — not instead of — general suitability', () => {
    const { container } = renderAt('/destination/japan', memoryStorage(true));
    expect(screen.getByRole('heading', { name: /لماذا تناسبك هذه الوجهة؟/ })).toBeInTheDocument();
    expect(container.querySelector('.personal-match-label')?.textContent).toBe('التوافق معك');
    expect(container.querySelector('.personal-match-value')?.textContent).toMatch(/^\d+%$/);
    expect(container.querySelector('.country-suitability-card')).toBeInTheDocument();
    const chip = container.querySelector('.detail-hero .detail-match-personal')!;
    expect(chip.querySelector('b')?.textContent).toMatch(/^\d+%$/);
    expect(chip.querySelector('b')?.getAttribute('dir')).toBe('ltr');
    expect(chip.getAttribute('aria-label')).toMatch(/^التوافق معك \d+%$/);
    expect(chip.textContent).not.toMatch(/لك$/);
    expect(screen.getByRole('button', { name: 'تعديل تفضيلاتي' })).toBeInTheDocument();
  });

  it('offers the questionnaire instead of a fake score when there is no profile', () => {
    const { container } = renderAt('/destination/japan', memoryStorage(false));
    const card = container.querySelector('.personal-match-card.is-empty')!;
    expect(within(card as HTMLElement).getByRole('link', { name: /اكتشف مدى توافقها معك/ })).toHaveAttribute('href', '/purpose');
    expect(container.querySelector('.personal-match-value')).toBeNull();
    expect(container.querySelector('.detail-hero .detail-match-personal')).toBeNull();
  });

  it('writes clean English copy, with and without a profile', () => {
    const withProfile = renderAt('/destination/japan', memoryStorage(true), null, 'en');
    expect(screen.getByRole('heading', { name: /Why this destination suits you/ })).toBeInTheDocument();
    const section = withProfile.container.querySelector('.personal-match-card')!;
    expect(section.querySelector('.personal-match-value')?.textContent).toMatch(/^\d+%$/);
    expect(section.querySelector('.personal-match-label')?.textContent).toBe('Personal match');
    expect(section.textContent).not.toMatch(/for you|[؀-ۿ]/);
    expect(withProfile.container.querySelector('.detail-match-personal')?.getAttribute('aria-label')).toMatch(/^Personal match \d+%$/);
    withProfile.unmount();

    const without = renderAt('/destination/japan', memoryStorage(false), null, 'en');
    expect(within(without.container.querySelector('.personal-match-card.is-empty') as HTMLElement).getByRole('link', { name: /See how well it fits you/ })).toBeInTheDocument();
  });
});

// Explore renders the full ~194-card grid; give jsdom real headroom (same
// allowance as Explore.excludedCountries.test.tsx).
const FULL_GRID_TIMEOUT = 90000;
const firstCardName = (container: HTMLElement) => container.querySelector('.explore-grid .dest-card h3')?.textContent;
const sortBox = (lang: 'ar' | 'en' = 'ar') => screen.getByRole('combobox', { name: lang === 'ar' ? 'الترتيب' : 'Sort' });
const chooseSort = (label: string, lang: 'ar' | 'en' = 'ar') => {
  fireEvent.click(sortBox(lang));
  fireEvent.click(screen.getByRole('option', { name: label }));
};
const DEFAULT_ORDER = sortCatalog(filteredCatalog({ q: '', region: '', purpose: '', cost: '', sort: 'default' }), 'default', 'ar', null, undefined);
const MATCHES = personalMatchesFor(WORLD_CATALOG, normalizePreferences('tourism', ANSWERS));

describe('Explore — Phase 18', () => {
  it('without a profile: general default order, no personal sorts, no badges, no reset', () => {
    const { container } = renderAt('/explore', memoryStorage(false));
    expect(container.querySelectorAll('.personal-pill')).toHaveLength(0);
    expect(firstCardName(container)).toBe(DEFAULT_ORDER[0]!.nameAr);
    expect(sortBox().textContent).toContain('الترتيب الافتراضي');
    expect(screen.queryByRole('button', { name: 'إعادة تعيين التفضيلات' })).toBeNull();
    fireEvent.click(sortBox());
    expect(screen.queryByRole('option', { name: 'التوافق معك: الأعلى أولًا' })).toBeNull();
    expect(screen.queryByRole('option', { name: 'التوافق معك: الأقل أولًا' })).toBeNull();
  }, FULL_GRID_TIMEOUT);

  it('with a profile: opens on Personal Match highest first, sorts lowest first, and respects a manual choice', () => {
    const { container } = renderAt('/explore', memoryStorage(true));
    const desc = sortByPersonalMatch(DEFAULT_ORDER, MATCHES, 'desc');
    const asc = sortByPersonalMatch(DEFAULT_ORDER, MATCHES, 'asc');

    // Default with a profile, before any choice.
    expect(sortBox().textContent).toContain('التوافق معك: الأعلى أولًا');
    expect(firstCardName(container)).toBe(desc[0]!.nameAr);
    expect(container.querySelectorAll('.explore-grid .dest-card')).toHaveLength(WORLD_CATALOG.length);
    const pills = [...container.querySelectorAll('.explore-grid .personal-pill')];
    expect(pills.length).toBeGreaterThan(100);
    for (const pill of pills.slice(0, 20)) {
      expect(pill.textContent).toMatch(/^\d+%$/);
      expect(pill.getAttribute('aria-label')).toMatch(/^التوافق معك \d+%$/);
    }
    expect(screen.getByText('النسبة على كل بطاقة هي التوافق معك، بحسب تفضيلاتك المحفوظة.')).toBeInTheDocument();

    chooseSort('التوافق معك: الأقل أولًا');
    expect(firstCardName(container)).toBe(asc[0]!.nameAr);
    expect(container.querySelectorAll('.explore-grid .dest-card')).toHaveLength(WORLD_CATALOG.length);

    // A manual general sort is respected, including after later re-renders.
    chooseSort('الترتيب الافتراضي');
    expect(firstCardName(container)).toBe(DEFAULT_ORDER[0]!.nameAr);
    const search = container.querySelector('#exSearch')!;
    fireEvent.change(search, { target: { value: 'a' } });
    fireEvent.change(search, { target: { value: '' } });
    expect(sortBox().textContent).toContain('الترتيب الافتراضي');
    expect(firstCardName(container)).toBe(DEFAULT_ORDER[0]!.nameAr);
  }, FULL_GRID_TIMEOUT);

  it('draws the Surprise from the traveller’s best-fitting countries', async () => {
    const { container } = renderAt('/explore', memoryStorage(true));
    const ranked = [...WORLD_CATALOG].sort((a, b) => comparePersonal(MATCHES.get(a.id), MATCHES.get(b.id)));
    const pool = new Set(ranked.slice(0, 15).map((entry) => entry.nameAr));
    for (let i = 0; i < 3; i++) {
      const spin = screen.getByRole('button', { name: /حرّك البوصلة|اختيار وجهة أخرى/ });
      await waitFor(() => expect(spin).toBeEnabled(), { timeout: 3000 });
      fireEvent.click(spin);
      await waitFor(() => expect(container.querySelector('.surprise-result strong')).not.toBeNull(), { timeout: 3000 });
      expect(pool.has(container.querySelector('.surprise-result strong')!.textContent!)).toBe(true);
    }
  }, FULL_GRID_TIMEOUT);

  it('reset on Explore (with a personal sort active) clears only personalization and returns to the general default — English stays English', () => {
    const storage = memoryStorage(true);
    const { container } = renderAt('/explore', storage, null, 'en');
    const DEFAULT_EN = sortCatalog(filteredCatalog({ q: '', region: '', purpose: '', cost: '', sort: 'default' }), 'default', 'en', null, undefined);
    chooseSort('Personal match: Lowest first', 'en');
    expect(container.querySelectorAll('.personal-pill').length).toBeGreaterThan(100);

    fireEvent.click(screen.getByRole('button', { name: 'Reset preferences' }));
    // Light inline confirmation; cancelling changes nothing.
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(storage.data[PERSONALIZATION_STORAGE_KEY]).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Reset preferences' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm reset' }));

    expect(storage.data[PERSONALIZATION_STORAGE_KEY]).toBeUndefined();
    expect(storage.data['wejhaty.theme']).toBe('light');
    const status = container.querySelector('.explore-personal-status')!;
    expect(status.getAttribute('role')).toBe('status');
    expect(status.textContent).toContain('Your preferences were reset.');
    expect(document.activeElement).toBe(status);
    expect(screen.getByRole('link', { name: /Take the quiz again/ })).toHaveAttribute('href', '/purpose');
    expect(screen.getByTestId('where').textContent).toBe('/explore');
    expect(container.querySelectorAll('.personal-pill')).toHaveLength(0);
    expect(sortBox('en').textContent).toContain('Default order');
    expect(firstCardName(container)).toBe(DEFAULT_EN[0]!.nameEn);
    expect(container.querySelectorAll('.explore-grid .dest-card')).toHaveLength(WORLD_CATALOG.length);
    fireEvent.click(sortBox('en'));
    expect(screen.queryByRole('option', { name: /Personal match/ })).toBeNull();
    expect(document.querySelector('.explore-count')!.textContent).not.toMatch(/[؀-ۿ]/);
  }, FULL_GRID_TIMEOUT);
});

/** Renders nothing; exposes the latest personalization API to the test. */
function probe() {
  const holder: { api: ReturnType<typeof usePersonalization> | null } = { api: null };
  function Probe() {
    const api = usePersonalization();
    useEffect(() => {
      holder.api = api;
    });
    return null;
  }
  return { Probe, current: () => holder.api! };
}

describe('Personalization provider', () => {
  it('saves the profile when a questionnaire completes and survives a remount (same browser)', () => {
    const storage = memoryStorage(false);
    const { Probe, current } = probe();
    const { unmount } = render(<PersonalizationProvider storage={storage}><Probe /></PersonalizationProvider>);
    expect(current().profile).toBeNull();
    act(() => current().saveFromQuiz('tourism', ANSWERS, PATH));
    expect(current().profile?.answers).toEqual(ANSWERS);
    expect(current().persisted).toBe(true);
    unmount();
    render(<PersonalizationProvider storage={storage}><Probe /></PersonalizationProvider>);
    expect(current().profile?.answers).toEqual(ANSWERS);
    expect(current().preferences?.signals.length).toBe(4);
  });

  it('keeps working for the visit when storage refuses writes', () => {
    const refusing: StorageLike = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); }, removeItem: () => {} };
    const { Probe, current } = probe();
    render(<PersonalizationProvider storage={refusing}><Probe /></PersonalizationProvider>);
    act(() => current().saveFromQuiz('tourism', ANSWERS, PATH));
    expect(current().profile?.purpose).toBe('tourism');
    expect(current().persisted).toBe(false);
  });

  it('survives repeated reset / new-trip cycles', () => {
    const storage = memoryStorage(true);
    const { Probe, current } = probe();
    render(<PersonalizationProvider storage={storage}><Probe /></PersonalizationProvider>);
    for (let i = 0; i < 5; i++) {
      act(() => current().reset());
      expect(current().profile).toBeNull();
      act(() => current().saveFromQuiz(i % 2 ? 'work' : 'tourism', i % 2 ? { 'work-climate': 'temperate' } : ANSWERS, []));
      expect(current().profile).not.toBeNull();
    }
    expect(JSON.parse(storage.data[PERSONALIZATION_STORAGE_KEY]!).purpose).toBe('tourism');
  });
});
