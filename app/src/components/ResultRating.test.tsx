import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { I18N } from '../data/i18n';
import { WORLD_CATALOG } from '../data/worldCatalog';
import { ResultRating } from './ResultRating';

const submitRating = vi.fn(async (_payload: unknown, _context: unknown) => ({ ok: true }));
vi.mock('../telemetry/productDataClient', () => ({ submitRating: (payload: unknown, context: unknown) => submitRating(payload, context) }));

describe('ResultRating', () => {
  it('submits an overall score and optional per-country usefulness without changing results', async () => {
    const japan = WORLD_CATALOG.find((country) => country.id === 'japan')!;
    render(<ResultRating results={[{ dest: japan, score: 91, reasons: [] }]} lang="en" strings={I18N.en.results} />);
    fireEvent.click(screen.getByRole('button', { name: '4 / 5' }));
    fireEvent.click(screen.getByText(I18N.en.results.rateCountries));
    fireEvent.click(screen.getByRole('button', { name: `${I18N.en.results.usefulYes} Japan` }));
    fireEvent.click(screen.getByRole('button', { name: I18N.en.results.submitRating }));
    await waitFor(() => expect(submitRating).toHaveBeenCalled());
    expect(screen.getByText(I18N.en.results.ratingThanks)).toBeInTheDocument();
  });
});
