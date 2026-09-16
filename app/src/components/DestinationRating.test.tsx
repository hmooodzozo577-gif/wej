// Item #13B/#13C — the destination-page rating, from every entry path.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18N } from '../data/i18n';
import { WORLD_CATALOG } from '../data/worldCatalog';
import { DestinationRating } from './DestinationRating';
import type { DestinationNavigation } from '../state/types';

const submitRating = vi.fn(async (_payload: unknown, _context: unknown) => ({ ok: true }));
vi.mock('../telemetry/productDataClient', () => ({ submitRating: (payload: unknown, context: unknown) => submitRating(payload, context) }));

const japan = WORLD_CATALOG.find((country) => country.id === 'japan')!;
const strings = I18N.en.destinationRating;

function renderRating(navigation: DestinationNavigation | null = null) {
  return render(<DestinationRating destination={japan} navigation={navigation} lang="en" strings={strings} />);
}

beforeEach(() => {
  submitRating.mockClear();
  submitRating.mockResolvedValue({ ok: true });
});

describe('the destination rating form', () => {
  it('asks how helpful the destination was, with stars and an optional comment', () => {
    renderRating();
    expect(screen.getByText(strings.title)).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: strings.starsLabel })).toBeInTheDocument();
    expect(screen.getByLabelText(strings.commentLabel)).toBeInTheDocument();
  });

  it('submits the destination country alongside the score', async () => {
    renderRating();
    fireEvent.click(screen.getByRole('radio', { name: '5 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: strings.submit }));
    await waitFor(() => expect(submitRating).toHaveBeenCalled());
    expect(submitRating.mock.calls[0]![0]).toMatchObject({
      kind: 'destination',
      overallScore: 5,
      countryCode: japan.countryCode,
    });
  });
});

describe('it works from every entry path, and records which one', () => {
  const cases: [string, DestinationNavigation | null][] = [
    ['direct', null],
    ['results', { source: 'results', ids: [japan.id], index: 0 }],
    ['explore', { source: 'explore', ids: [japan.id], index: 0 }],
    ['surprise', { source: 'surprise', ids: [japan.id], index: 0 }],
  ];

  for (const [expected, navigation] of cases) {
    it(`records origin "${expected}"`, async () => {
      const { unmount } = renderRating(navigation);
      fireEvent.click(screen.getByRole('radio', { name: '4 of 5' }));
      fireEvent.click(screen.getByRole('button', { name: strings.submit }));
      await waitFor(() => expect(submitRating).toHaveBeenCalled());
      expect((submitRating.mock.calls[0]![0] as { origin: string }).origin).toBe(expected);
      unmount();
    });
  }

  it('records nothing more precise than the route — no coordinates, no identifiers', async () => {
    renderRating({ source: 'explore', ids: [japan.id], index: 0 });
    fireEvent.click(screen.getByRole('radio', { name: '4 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: strings.submit }));
    await waitFor(() => expect(submitRating).toHaveBeenCalled());
    const payload = submitRating.mock.calls[0]![0] as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(['countryCode', 'kind', 'origin', 'overallScore'].sort());
  });
});

describe('submission states', () => {
  it('disables Submit until a rating is chosen, and says so', () => {
    renderRating();
    expect(screen.getByRole('button', { name: strings.submit })).toBeDisabled();
    expect(screen.getByText(strings.requiredNote)).toBeInTheDocument();
  });

  it('shows a loading state, then a success state', async () => {
    let resolve!: (value: { ok: boolean }) => void;
    submitRating.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    renderRating();
    fireEvent.click(screen.getByRole('radio', { name: '3 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: strings.submit }));
    expect(await screen.findByRole('button', { name: strings.saving })).toBeDisabled();
    resolve({ ok: true });
    expect(await screen.findByText(strings.thanks)).toBeInTheDocument();
  });

  it('shows an error with a retry, keeping the typed comment', async () => {
    submitRating.mockResolvedValueOnce({ ok: false });
    renderRating();
    fireEvent.click(screen.getByRole('radio', { name: '2 of 5' }));
    fireEvent.change(screen.getByLabelText(strings.commentLabel), { target: { value: 'Needs more detail' } });
    fireEvent.click(screen.getByRole('button', { name: strings.submit }));

    expect(await screen.findByRole('alert')).toHaveTextContent(strings.failed);
    expect(screen.getByLabelText(strings.commentLabel)).toHaveValue('Needs more detail');
    fireEvent.click(screen.getByRole('button', { name: strings.retry }));
    await waitFor(() => expect(submitRating).toHaveBeenCalledTimes(2));
  });
});

describe('the star control is a real radio group', () => {
  it('moves the selection with the arrow keys', () => {
    renderRating();
    const third = screen.getByRole('radio', { name: '3 of 5' });
    fireEvent.click(third);
    expect(third).toBeChecked();
    fireEvent.keyDown(third, { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: '4 of 5' })).toBeChecked();
    fireEvent.keyDown(screen.getByRole('radio', { name: '4 of 5' }), { key: 'ArrowLeft' });
    expect(screen.getByRole('radio', { name: '3 of 5' })).toBeChecked();
  });

  it('never moves past either end', () => {
    renderRating();
    const first = screen.getByRole('radio', { name: '1 of 5' });
    fireEvent.click(first);
    fireEvent.keyDown(first, { key: 'ArrowLeft' });
    expect(screen.getByRole('radio', { name: '1 of 5' })).toBeChecked();

    const fifth = screen.getByRole('radio', { name: '5 of 5' });
    fireEvent.click(fifth);
    fireEvent.keyDown(fifth, { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: '5 of 5' })).toBeChecked();
  });
});
