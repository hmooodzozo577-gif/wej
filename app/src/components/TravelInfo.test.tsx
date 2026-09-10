// Phase 13.6 — TravelInfo: no-location prompt, loading state, safe
// fallback to the offline distance/duration estimate (the REAL current
// app behavior, since no VITE_TRAVEL_WORKER_URL is configured — no
// mocking needed to exercise it), the same-country skip case, and the
// (mocked) real-offer rendering path. Real geo/airport/world-catalog data
// throughout — only searchFlights() is mocked, and only where a real
// Worker response is needed.
import { useReducer, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppStateContext } from '../state/context';
import { appReducer, initialAppState } from '../state/reducer';
import type { AppState } from '../state/types';
import { TravelInfo } from './TravelInfo';
import { WORLD_CATALOG } from '../data/worldCatalog';
import type { Lang } from '../data/types';
import * as travelService from '../travel/travelService';

const france = WORLD_CATALOG.find((e) => e.id === 'france')!;
const saudiArabia = WORLD_CATALOG.find((e) => e.id === 'ksa')!;
const RIYADH = { lat: 24.7136, lng: 46.6753 };

function renderWith(lang: Lang, locationOverride: Partial<AppState['location']> = {}, destination = france) {
  function Providers({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(appReducer, {
      ...initialAppState,
      lang,
      location: { status: 'idle', coords: null, ...locationOverride },
    });
    return <AppStateContext.Provider value={{ state, dispatch }}>{children}</AppStateContext.Provider>;
  }
  return render(
    <Providers>
      <MemoryRouter>
        <TravelInfo destination={destination} />
      </MemoryRouter>
    </Providers>,
  );
}

describe('Phase 13.6 — TravelInfo: no location granted', () => {
  it('shows a prompt to set location, with a link to /explore, in English', () => {
    renderWith('en');
    expect(screen.getByText(/Share your location to see travel distance/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Set your location' })).toHaveAttribute('href', '/explore');
  });

  it('shows the same prompt in Arabic', () => {
    renderWith('ar');
    expect(screen.getByText(/شارك موقعك لرؤية مسافة السفر/)).toBeInTheDocument();
  });

  it('never attempts a search or shows any travel numbers without a granted location', () => {
    renderWith('en');
    expect(screen.queryByText(/Distance/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Flight time/)).not.toBeInTheDocument();
  });

  it('landscape-composition pass: message and action are separate block-level elements, not one crowded inline paragraph', () => {
    // Real user visual QA found the sentence + inline chip-styled Link
    // wrapping poorly in the narrow compact row at tablet/landscape
    // widths. Structural guard: the action link must NOT be a
    // descendant of the message <p> (which is how it produced that
    // inline-wrap problem) — it's its own sibling element now.
    const { container } = renderWith('en');
    const paragraph = screen.getByText(/Share your location to see travel distance/);
    expect(paragraph.tagName).toBe('P');
    const link = screen.getByRole('link', { name: 'Set your location' });
    expect(paragraph.contains(link)).toBe(false);
    // Still inside the same card, still reachable — just not nested in
    // the sentence.
    expect(container.querySelector('.travel-card')!.contains(link)).toBe(true);
  });

  it('the action link keeps working (still a real /explore link) — no behavioral regression from the presentation fix', () => {
    renderWith('en');
    expect(screen.getByRole('link', { name: 'Set your location' })).toHaveAttribute('href', '/explore');
  });
});

describe('Phase 13.6 — TravelInfo: loading state', () => {
  it('shows a loading message immediately after a location is granted', () => {
    renderWith('en', { status: 'granted', coords: RIYADH });
    expect(screen.getByText('Looking up travel info…')).toBeInTheDocument();
  });
});

describe('Phase 13.6 — TravelInfo: safe fallback estimate (real app behavior — no Worker configured)', () => {
  it('falls back to the deterministic offline distance/duration estimate, never a fake price', async () => {
    renderWith('en', { status: 'granted', coords: RIYADH }, france);
    await waitFor(() => expect(screen.getByText('4,609.6 km')).toBeInTheDocument());
    expect(screen.getByText('6h 16m')).toBeInTheDocument();
    expect(screen.getByText(/Estimated straight-line distance and flight time/)).toBeInTheDocument();
    // Never a price/ticket in the fallback state.
    expect(screen.queryByText('Price')).not.toBeInTheDocument();
  });

  it('renders the same fallback in Arabic with correctly localized units', async () => {
    renderWith('ar', { status: 'granted', coords: RIYADH }, france);
    await waitFor(() => expect(screen.getByText('4,609.6 كم')).toBeInTheDocument());
    expect(screen.getByText('6س 16د')).toBeInTheDocument();
  });
});

describe('Phase 13.6 — TravelInfo: same-country destination', () => {
  it('renders nothing when the destination is the same country as the resolved origin', async () => {
    const { container } = renderWith('en', { status: 'granted', coords: RIYADH }, saudiArabia);
    await waitFor(() => expect(container.querySelector('.detail-card')).not.toBeInTheDocument());
  });
});

describe('Phase 13.6 — TravelInfo: real offer found (Worker mocked)', () => {
  it('renders price, duration, and stops from a real searchFlights() "ok" result', async () => {
    const offer = {
      id: 'off-1',
      segments: [
        {
          origin: { iata: 'RUH', name: 'RUH', countryCode: 'SA' },
          destination: { iata: 'LIG', name: 'LIG', countryCode: 'FR' },
          departureTime: '2027-01-01T08:00:00',
          arrivalTime: '2027-01-01T14:00:00',
          airlineCode: 'AF',
          durationMinutes: 360,
        },
      ],
      price: { amount: 512, currency: 'USD' },
      durationMinutes: 360,
      stops: 0,
      layovers: [],
    };
    vi.spyOn(travelService, 'searchFlights').mockResolvedValueOnce({ status: 'ok', offers: [offer] });

    renderWith('en', { status: 'granted', coords: RIYADH }, france);

    await waitFor(() => expect(screen.getByText('512 USD')).toBeInTheDocument());
    expect(screen.getByText('6h 0m')).toBeInTheDocument();
    expect(screen.getByText('Non-stop')).toBeInTheDocument();
    expect(screen.getByText(/Real flight offer from our travel search/)).toBeInTheDocument();

    vi.restoreAllMocks();
  });
});
