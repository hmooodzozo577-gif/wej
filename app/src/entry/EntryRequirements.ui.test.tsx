// Phase 19 P19 — passport entry information in the product: Results and
// the Destination page, Arabic and English, with/without a passport,
// loading failures, stale data, session-only privacy and no ranking effect.
import { render, screen, waitFor, within } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppStateProvider } from '../state/AppStateContext';
import { useAppState } from '../state/hooks';
import { Results } from '../routes/Results';
import { Destination } from '../routes/Destination';
import { PersonalizationProvider } from '../personalization/PersonalizationProvider';
import { PERSONALIZATION_STORAGE_KEY, type StorageLike } from '../personalization/storage';
import { createProfile } from '../personalization/profile';
import type { Answers } from '../engine/types';
import realSnapshot from '../data/generated/entryRequirements.json';
import { parseEntrySnapshot } from './entryInfo';
import * as loader from './snapshotLoader';

const ANSWERS: Answers = { 'tourism-climate': 'cold', 'tourism-cost': 3, 'tourism-coastal': 100, 'tourism-safety': 75 };

function storage(): StorageLike {
  const data: Record<string, string> = {
    [PERSONALIZATION_STORAGE_KEY]: JSON.stringify(createProfile('tourism', ANSWERS, Object.keys(ANSWERS), new Date('2026-09-23T00:00:00Z'))),
  };
  return {
    getItem: (key) => (key in data ? data[key]! : null),
    setItem: (key, value) => { data[key] = value; },
    removeItem: (key) => { delete data[key]; },
  };
}

function Setup({ passport, lang }: { passport: string | null; lang: 'ar' | 'en' }) {
  const { dispatch } = useAppState();
  useEffect(() => {
    if (lang === 'en') dispatch({ type: 'SET_LANG', lang: 'en' });
    if (passport) dispatch({ type: 'SET_PASSPORT', countryCode: passport });
  }, [dispatch, lang, passport]);
  return null;
}

function renderAt(path: string, { passport = null, lang = 'ar' }: { passport?: string | null; lang?: 'ar' | 'en' } = {}, children: ReactNode = null) {
  return render(
    <AppStateProvider>
      <PersonalizationProvider storage={storage()}>
        <MemoryRouter initialEntries={[path]}>
          <Setup passport={passport} lang={lang} />
          {children}
          <Routes>
            <Route path="/results" element={<Results />} />
            <Route path="/destination/:id" element={<Destination />} />
            <Route path="/purpose" element={<p>purpose page</p>} />
          </Routes>
        </MemoryRouter>
      </PersonalizationProvider>
    </AppStateProvider>,
  );
}

/** Every percentage on the page except the top ring's count-up (animated
 *  from 0, so its value depends on timing) and the entry section itself. */
function percentages(container: HTMLElement): string[] {
  const clone = container.querySelector('.results-wrap')!.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.matchNum, .entry-card').forEach((node) => node.remove());
  return clone.textContent!.match(/\d+%/g) ?? [];
}

const cardOrder = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLAnchorElement>('.results-wrap a[href*="/destination/"]')].map((link) => link.getAttribute('href'));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Results — entry requirements', () => {
  it('shows nothing, and asks for nothing, without a passport (P13)', () => {
    const { container } = renderAt('/results');
    expect(container.querySelector('.entry-card')).toBeNull();
    expect(screen.queryByText(/متطلبات الدخول حسب جوازك/)).toBeNull();
  });

  it('lists each recommended destination with a sourced status, official links and the check date (AR)', async () => {
    const { container } = renderAt('/results', { passport: 'SA' });
    const card = await waitFor(() => {
      const found = container.querySelector<HTMLElement>('.entry-card');
      expect(found?.querySelector('.entry-list')).not.toBeNull();
      return found!;
    });
    expect(within(card).getByText('متطلبات الدخول حسب جوازك')).toBeInTheDocument();
    expect(card.querySelectorAll('.entry-row')).toHaveLength(5);
    expect(card.querySelector('.entry-checked')?.textContent).toMatch(/^آخر تحقق: \d{4}-\d{2}-\d{2}$/);
    expect(within(card).getByText('متطلبات الدخول والتأشيرات قد تتغيّر. تحقّق دائمًا من المصدر الرسمي قبل السفر.')).toBeInTheDocument();
    // Every link is to an official source, in a new tab, without an opener.
    for (const link of card.querySelectorAll<HTMLAnchorElement>('a')) {
      expect(link.href).toMatch(/^https:\/\//);
      expect(link.target).toBe('_blank');
      expect(link.rel).toBe('noopener noreferrer');
    }
  });

  it('renders in English', async () => {
    const { container } = renderAt('/results', { passport: 'SA', lang: 'en' });
    await waitFor(() => expect(container.querySelector('.entry-list')).not.toBeNull());
    expect(screen.getByText('Entry requirements for your passport')).toBeInTheDocument();
    expect(container.querySelector('.entry-checked')?.textContent).toMatch(/^Last checked: \d{4}-\d{2}-\d{2}$/);
  });

  it('never changes the recommendation order or any percentage (P15)', async () => {
    const without = renderAt('/results');
    const orderWithout = cardOrder(without.container);
    const pillsWithout = percentages(without.container);
    expect(pillsWithout.length).toBeGreaterThan(4);
    without.unmount();

    const withPassport = renderAt('/results', { passport: 'EG' });
    await waitFor(() => expect(withPassport.container.querySelector('.entry-list')).not.toBeNull());
    expect(cardOrder(withPassport.container)).toEqual(orderWithout);
    expect(percentages(withPassport.container)).toEqual(pillsWithout);
  });

  it('says so plainly when the data cannot be loaded (source unavailable / timeout)', async () => {
    vi.spyOn(loader, 'loadEntrySnapshot').mockResolvedValue(null);
    renderAt('/results', { passport: 'SA' });
    expect(await screen.findByText('تعذّر تحميل متطلبات الدخول الآن. تحقّق من المصدر الرسمي للوجهة قبل السفر.')).toBeInTheDocument();
  });

  it('withholds every visa status once the snapshot is stale, keeping the official links', async () => {
    const stale = parseEntrySnapshot(JSON.parse(JSON.stringify(realSnapshot)))!;
    stale.generatedAt = '2025-01-01T00:00:00.000Z';
    for (const source of Object.values(stale.sources)) source.checkedAt = '2025-01-01T00:00:00.000Z';
    vi.spyOn(loader, 'loadEntrySnapshot').mockResolvedValue(stale);
    const { container } = renderAt('/destination/france', { passport: 'SA' });
    const card = await waitFor(() => {
      const found = container.querySelector<HTMLElement>('.entry-card');
      expect(found?.textContent).toMatch(/لم نتمكن من تحديث هذه المعلومات مؤخرًا/);
      return found!;
    });
    expect(card.textContent).not.toMatch(/تأشيرة مطلوبة قبل السفر/);
    expect(card.querySelector('a[href^="https://eur-lex.europa.eu/"]')).not.toBeNull();
  });
});

describe('Destination — entry requirements', () => {
  it('shows the sourced facts for a covered pair (Saudi passport → France)', async () => {
    const { container } = renderAt('/destination/france', { passport: 'SA' });
    const card = await waitFor(() => {
      const found = container.querySelector<HTMLElement>('.entry-card .entry-status');
      expect(found).not.toBeNull();
      return found!.closest<HTMLElement>('.entry-card')!;
    });
    expect(within(card).getByText('تأشيرة مطلوبة قبل السفر')).toBeInTheDocument();
    expect(card.querySelector('a[href="https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:02018R1806-20251230"]')).not.toBeNull();
  });

  it('shows allowed stay, passport validity and extra steps only where the source states them', async () => {
    const maldives = renderAt('/destination/mv', { passport: 'SA', lang: 'en' });
    await waitFor(() => expect(maldives.container.querySelector('.entry-facts')).not.toBeNull());
    expect(screen.getByText('Visa on arrival')).toBeInTheDocument();
    expect(screen.getByText('A passport with a machine-readable zone (MRZ) and at least 1 month’s validity')).toBeInTheDocument();
    expect(screen.getByText('Submit the Traveller Declaration within 96 hours before arrival')).toBeInTheDocument();
    maldives.unmount();

    const uk = renderAt('/destination/uk', { passport: 'US', lang: 'en' });
    await waitFor(() => expect(uk.container.querySelector('.entry-status')).not.toBeNull());
    expect(uk.container.querySelector('.entry-card')!.textContent).not.toMatch(/Stay|Passport validity/);
  });

  it('is honest about an uncovered destination', async () => {
    const { container } = renderAt('/destination/japan', { passport: 'SA', lang: 'en' });
    await waitFor(() => expect(container.querySelector('.entry-status')).not.toBeNull());
    expect(screen.getByText('Not covered by our sources')).toBeInTheDocument();
    expect(screen.getByText(/We do not have a supported official source for this destination yet/)).toBeInTheDocument();
  });

  it('renders nothing without a passport', () => {
    const { container } = renderAt('/destination/france');
    expect(container.querySelector('.entry-card')).toBeNull();
  });
});

describe('privacy (P14)', () => {
  it('keeps the passport in memory only: no storage, no URL, gone after a reload', async () => {
    const local = vi.spyOn(Storage.prototype, 'setItem');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const first = renderAt('/results', { passport: 'SA' });
    await waitFor(() => expect(first.container.querySelector('.entry-list')).not.toBeNull());
    for (const [, value] of local.mock.calls) expect(String(value)).not.toMatch(/"?SA"?$|passport/i);
    // The lookup is local: no request carries the passport anywhere.
    for (const [input, init] of fetchSpy.mock.calls) {
      expect(String(input)).not.toMatch(/visa|passport/i);
      expect(String(init?.body ?? '')).not.toMatch(/passport/i);
    }
    first.unmount();

    // A "reload": a fresh provider tree with no passport step taken.
    const second = renderAt('/results');
    expect(second.container.querySelector('.entry-card')).toBeNull();
  });
});
