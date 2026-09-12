// Phase 11 Step 2 — the compact Country Information chip row on
// DestinationCard for basic (non-recommendation-ready) countries.
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DestinationCard } from './DestinationCard';
import { I18N } from '../data/i18n';
import { DESTINATIONS } from '../data/destinations';
import { BASIC_COUNTRIES } from '../data/basicCountries';
import { RECOMMENDATION_PROFILE_BY_CODE } from '../data/worldRecommendation';

const t = I18N.ar;

function renderCard(dest: (typeof DESTINATIONS)[number] | (typeof BASIC_COUNTRIES)[number]) {
  return render(
    <MemoryRouter>
      <DestinationCard dest={dest} lang="ar" t={t} />
    </MemoryRouter>,
  );
}

describe('Phase 11 Step 2 — DestinationCard Country Information chips', () => {
  it('shows worldwide recommendation cost/climate plus factual area for a basic country', () => {
    const eg = BASIC_COUNTRIES.find((c) => c.id === 'eg')!;
    renderCard(eg);
    expect(screen.getByText(/1,002,450/)).toBeInTheDocument();
    const profile = RECOMMENDATION_PROFILE_BY_CODE.get('EG')!;
    expect(screen.getByText(I18N.ar.climateLabels[profile.climate])).toBeInTheDocument();
  });

  it('does not depend on currency availability for worldwide recommendation chips', () => {
    const fm = BASIC_COUNTRIES.find((c) => c.id === 'fm')!;
    const { container } = renderCard(fm);
    expect(container.textContent).not.toContain('undefined');
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
