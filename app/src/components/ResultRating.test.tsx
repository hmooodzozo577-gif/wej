// Item #13A/#13C — the results feedback form and its submission states.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18N } from '../data/i18n';
import { WORLD_CATALOG } from '../data/worldCatalog';
import { ResultRating } from './ResultRating';

const submitRating = vi.fn(async (_payload: unknown, _context: unknown) => ({ ok: true }));
vi.mock('../telemetry/productDataClient', () => ({ submitRating: (payload: unknown, context: unknown) => submitRating(payload, context) }));

const japan = WORLD_CATALOG.find((country) => country.id === 'japan')!;
const strings = I18N.en.results;

function renderRating() {
  return render(<ResultRating results={[{ dest: japan, score: 91, reasons: [] }]} lang="en" strings={strings} />);
}

beforeEach(() => {
  submitRating.mockClear();
  submitRating.mockResolvedValue({ ok: true });
});

describe('the form is stars, optional text, and Submit', () => {
  it('offers exactly five star options as one radio group', () => {
    renderRating();
    const group = screen.getByRole('radiogroup', { name: strings.ratingStarsLabel });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(5);
  });

  it('offers an optional free-text box', () => {
    renderRating();
    expect(screen.getByLabelText(strings.ratingCommentLabel)).toBeInTheDocument();
  });

  // The acceptance round removed these explicitly.
  it('no longer offers per-country useful / not useful voting', () => {
    const { container } = renderRating();
    expect(container.textContent).not.toMatch(/useful/i);
    expect(container.querySelector('.rating-countries')).toBeNull();
  });
});

describe('submission states', () => {
  it('disables Submit until a rating is chosen, and says so up front', () => {
    renderRating();
    expect(screen.getByRole('button', { name: strings.submitRating })).toBeDisabled();
    expect(screen.getByText(strings.ratingRequiredNote)).toBeInTheDocument();
  });

  it('enables Submit once a rating is chosen, and drops the requirement note', () => {
    renderRating();
    fireEvent.click(screen.getByRole('radio', { name: '4 of 5' }));
    expect(screen.getByRole('button', { name: strings.submitRating })).toBeEnabled();
    expect(screen.queryByText(strings.ratingRequiredNote)).not.toBeInTheDocument();
  });

  it('sends the score and the comment, and shows a success state', async () => {
    renderRating();
    fireEvent.click(screen.getByRole('radio', { name: '4 of 5' }));
    fireEvent.change(screen.getByLabelText(strings.ratingCommentLabel), { target: { value: 'Good, but far.' } });
    fireEvent.click(screen.getByRole('button', { name: strings.submitRating }));

    await waitFor(() => expect(submitRating).toHaveBeenCalled());
    expect(submitRating.mock.calls[0]![0]).toMatchObject({
      kind: 'results',
      overallScore: 4,
      comment: 'Good, but far.',
    });
    expect(await screen.findByText(strings.ratingThanks)).toBeInTheDocument();
  });

  it('omits an empty comment rather than sending a blank string', async () => {
    renderRating();
    fireEvent.click(screen.getByRole('radio', { name: '2 of 5' }));
    fireEvent.change(screen.getByLabelText(strings.ratingCommentLabel), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: strings.submitRating }));
    await waitFor(() => expect(submitRating).toHaveBeenCalled());
    expect((submitRating.mock.calls[0]![0] as { comment?: string }).comment).toBeUndefined();
  });

  it('shows a loading state while the request is in flight', async () => {
    let resolve!: (value: { ok: boolean }) => void;
    submitRating.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    renderRating();
    fireEvent.click(screen.getByRole('radio', { name: '5 of 5' }));
    fireEvent.click(screen.getByRole('button', { name: strings.submitRating }));

    expect(await screen.findByRole('button', { name: strings.ratingSaving })).toBeDisabled();
    resolve({ ok: true });
    await waitFor(() => expect(screen.getByText(strings.ratingThanks)).toBeInTheDocument());
  });

  it('shows a clear error and a retry that keeps what was typed', async () => {
    submitRating.mockResolvedValueOnce({ ok: false });
    renderRating();
    fireEvent.click(screen.getByRole('radio', { name: '3 of 5' }));
    fireEvent.change(screen.getByLabelText(strings.ratingCommentLabel), { target: { value: 'Keep me' } });
    fireEvent.click(screen.getByRole('button', { name: strings.submitRating }));

    expect(await screen.findByRole('alert')).toHaveTextContent(strings.ratingFailed);
    expect(screen.getByLabelText(strings.ratingCommentLabel)).toHaveValue('Keep me');

    const retry = screen.getByRole('button', { name: strings.ratingRetry });
    fireEvent.click(retry);
    await waitFor(() => expect(submitRating).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(strings.ratingThanks)).toBeInTheDocument();
  });

  it('cannot be submitted twice by double-clicking', async () => {
    let resolve!: (value: { ok: boolean }) => void;
    submitRating.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    renderRating();
    fireEvent.click(screen.getByRole('radio', { name: '5 of 5' }));
    const submit = screen.getByRole('button', { name: strings.submitRating });
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(submitRating).toHaveBeenCalledTimes(1);
    resolve({ ok: true });
    await waitFor(() => expect(screen.getByText(strings.ratingThanks)).toBeInTheDocument());
  });
});
