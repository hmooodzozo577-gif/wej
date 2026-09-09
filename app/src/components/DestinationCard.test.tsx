// Phase 11 Step 2 — the compact Country Information chip row on
// DestinationCard for basic (non-recommendation-ready) countries.
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DestinationCard } from './DestinationCard';
import { I18N } from '../data/i18n';
import { DESTINATIONS } from '../data/destinations';
import { BASIC_COUNTRIES } from '../data/basicCountries';

const t = I18N.ar;

function renderCard(dest: (typeof DESTINATIONS)[number] | (typeof BASIC_COUNTRIES)[number]) {
  return render(
    <MemoryRouter>
      <DestinationCard dest={dest} lang="ar" t={t} />
    </MemoryRouter>,
  );
}

describe('Phase 11 Step 2 — DestinationCard Country Information chips', () => {
  it('shows both area and currency chips for a basic country that has both (Egypt, eg)', () => {
    const eg = BASIC_COUNTRIES.find((c) => c.id === 'eg')!;
    renderCard(eg);
    expect(screen.getByText(/1,002,450/)).toBeInTheDocument();
    expect(screen.getByText(/EGP/)).toBeInTheDocument();
  });

  it('omits the currency chip cleanly, without crashing, when a country has no reported currency (Micronesia, fm)', () => {
    const fm = BASIC_COUNTRIES.find((c) => c.id === 'fm')!;
    renderCard(fm);
    // Area chip still renders...
    expect(screen.getByText(new RegExp(t.detail.area))).toBeInTheDocument();
    // ...but no currency chip/label appears anywhere on the card.
    expect(screen.queryByText(new RegExp(t.detail.currency))).not.toBeInTheDocument();
  });

  it('leaves the existing recommendation-ready chip row (cost/safety/climate) unchanged', () => {
    const japan = DESTINATIONS.find((d) => d.id === 'japan')!;
    renderCard(japan);
    expect(screen.getByText(`${japan.safety}/100`)).toBeInTheDocument();
    // No area/currency chip text should appear on a full destination's card.
    expect(screen.queryByText(new RegExp(t.detail.area))).not.toBeInTheDocument();
    expect(screen.queryByText(new RegExp(t.detail.currency))).not.toBeInTheDocument();
  });
});
