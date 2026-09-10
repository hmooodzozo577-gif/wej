// Phase 13.5a — AccommodationInfo: renders honest, deterministic
// accommodation guidance for real full-destination catalog entries
// (reusing the SAME Destination.costLevel already shown elsewhere on
// the page), returns null (graceful omission, never fabricated data)
// for the 165 BasicCountry entries that have no costLevel, and never
// emits a live price/availability/booking claim.
import { useReducer, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppStateContext } from '../state/context';
import { appReducer, initialAppState } from '../state/reducer';
import { AccommodationInfo } from './AccommodationInfo';
import { WORLD_CATALOG } from '../data/worldCatalog';
import type { Lang } from '../data/types';

const thailand = WORLD_CATALOG.find((e) => e.id === 'thailand')!; // costLevel 1
const ksa = WORLD_CATALOG.find((e) => e.id === 'ksa')!; // costLevel 2
const japan = WORLD_CATALOG.find((e) => e.id === 'japan')!; // costLevel 3
const switzerland = WORLD_CATALOG.find((e) => e.id === 'switzerland')!; // costLevel 4
// A real BasicCountry (Phase 10, recommendationReady: false) — no costLevel.
const basicCountry = WORLD_CATALOG.find((e) => !e.recommendationReady)!;

function renderWith(destination: (typeof WORLD_CATALOG)[number], lang: Lang = 'en') {
  function Providers({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(appReducer, { ...initialAppState, lang });
    return <AppStateContext.Provider value={{ state, dispatch }}>{children}</AppStateContext.Provider>;
  }
  return render(
    <Providers>
      <MemoryRouter>
        <AccommodationInfo destination={destination} />
      </MemoryRouter>
    </Providers>,
  );
}

describe('Phase 13.5a — AccommodationInfo: renders for a full destination', () => {
  it('shows the section title and the reused cost tier for a real destination', () => {
    renderWith(japan, 'en');
    expect(screen.getByText('Accommodation')).toBeInTheDocument();
    expect(screen.getByText('General accommodation affordability')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument(); // japan costLevel 3 -> costLevels[2] = 'High'
  });

  it('always shows the guidance sentence directly (not inside the details disclosure)', () => {
    const { container } = renderWith(japan, 'en');
    const guidance = screen.getByText(/generally on the pricier side/);
    const details = container.querySelector('details.tc-more-details');
    expect(details).not.toBeNull();
    expect(details!.contains(guidance)).toBe(false);
  });
});

describe('Composition-refinement pass — Accommodation <details> disclosure (concise by default)', () => {
  it('concise state: the disclaimer is inside <details>, collapsed by default', () => {
    const { container } = renderWith(japan, 'en');
    const details = container.querySelector('details.tc-more-details')!;
    expect(details.hasAttribute('open')).toBe(false);
    const disclaimer = screen.getByText(/not a live price, availability, or booking/);
    expect(details.contains(disclaimer)).toBe(true);
  });

  it('expanded state: clicking the summary opens <details> and the disclaimer remains reachable', () => {
    const { container } = renderWith(japan, 'en');
    const details = container.querySelector('details.tc-more-details')!;
    fireEvent.click(screen.getByText('How is this calculated?'));
    expect(details.hasAttribute('open')).toBe(true);
    expect(screen.getByText(/not a live price, availability, or booking/)).toBeInTheDocument();
  });

  it('Arabic: summary label is the Arabic string and toggles the same way', () => {
    const { container } = renderWith(japan, 'ar');
    const details = container.querySelector('details.tc-more-details')!;
    fireEvent.click(screen.getByText('كيف يُحسب هذا؟'));
    expect(details.hasAttribute('open')).toBe(true);
  });
});

describe('Phase 13.5a — AccommodationInfo: guidance is derived from the real costLevel, deterministically', () => {
  it('costLevel 1 (Thailand) shows the budget-friendly guidance sentence', () => {
    renderWith(thailand, 'en');
    expect(screen.getByText('Low')).toBeInTheDocument();
    expect(screen.getByText(/generally budget-friendly/)).toBeInTheDocument();
  });

  it('costLevel 2 (Saudi Arabia) shows the moderately-priced guidance sentence', () => {
    renderWith(ksa, 'en');
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText(/generally moderately priced/)).toBeInTheDocument();
  });

  it('costLevel 3 (Japan) shows the pricier-side guidance sentence', () => {
    renderWith(japan, 'en');
    expect(screen.getByText(/generally on the pricier side/)).toBeInTheDocument();
  });

  it('costLevel 4 (Switzerland) shows the premium/luxury guidance sentence', () => {
    renderWith(switzerland, 'en');
    expect(screen.getByText('Luxury')).toBeInTheDocument();
    expect(screen.getByText(/generally premium\/luxury-priced/)).toBeInTheDocument();
  });

  it('is deterministic: rendering the same destination twice produces the same text', () => {
    const first = renderWith(japan, 'en');
    const firstText = first.container.textContent;
    first.unmount();
    const second = renderWith(japan, 'en');
    expect(second.container.textContent).toBe(firstText);
  });
});

describe('Phase 13.5a — AccommodationInfo: Arabic localization', () => {
  it('renders the Arabic title, tier, and matching guidance sentence for the same real destination/costLevel', () => {
    renderWith(japan, 'ar');
    expect(screen.getByText('الإقامة')).toBeInTheDocument();
    expect(screen.getByText('مرتفعة')).toBeInTheDocument(); // costLevels ar[2] for costLevel 3
    expect(screen.getByText(/أعلى تكلفة نسبيًا/)).toBeInTheDocument();
  });

  it('Arabic and English make the same claim for the same destination (same tier, not a more/less specific claim)', () => {
    const en = renderWith(japan, 'en');
    expect(en.container.textContent).toContain('High');
    en.unmount();
    const ar = renderWith(japan, 'ar');
    expect(ar.container.textContent).toContain('مرتفعة');
  });
});

describe('Phase 13.5a — AccommodationInfo: graceful omission for entries with no honest cost data', () => {
  it('renders nothing for a real BasicCountry entry (no costLevel — never fabricated)', () => {
    const { container } = renderWith(basicCountry, 'en');
    expect(container).toBeEmptyDOMElement();
  });
});

describe('Phase 13.5a — AccommodationInfo: never a fake live claim', () => {
  it('never renders a currency amount, room count, or booking-style call to action', () => {
    renderWith(japan, 'en');
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/\$\d/);
    expect(text.toLowerCase()).not.toMatch(/book now|available tonight|rooms? left|reserve/);
  });
});
