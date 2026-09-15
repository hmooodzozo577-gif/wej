import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { I18N } from '../data/i18n';
import { WORLD_CATALOG } from '../data/worldCatalog';
import { FeaturedCitiesCard } from './FeaturedCitiesCard';

describe('FeaturedCitiesCard', () => {
  it('keeps city information optional and reveals sourced details on demand', async () => {
    const japan = WORLD_CATALOG.find((country) => country.id === 'japan')!;
    render(<FeaturedCitiesCard destination={japan} lang="ar" strings={I18N.ar.detail} />);

    const section = screen.getByText(I18N.ar.detail.prominentCities).closest('summary')!;
    expect(section.parentElement).not.toHaveAttribute('open');
    expect(screen.getByText(I18N.ar.detail.showMore)).toBeInTheDocument();
    fireEvent.click(section);
    await waitFor(() => expect(screen.getByText(I18N.ar.detail.showLess)).toBeInTheDocument());

    const tokyo = (await screen.findByText('طوكيو', {}, { timeout: 5000 })).closest('summary')!;
    fireEvent.click(tokyo);
    expect(screen.getByText(I18N.ar.detail.capitalCity)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: I18N.ar.detail.cityDataSource }).length).toBeGreaterThan(0);
  });
});
