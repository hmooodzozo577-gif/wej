import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18N } from '../data/i18n';
import { FeedbackDialog } from './FeedbackDialog';

const submitFeedback = vi.fn(async (_payload: unknown, _context: unknown) => ({ ok: true, data: { referenceId: 'WJH-TEST-123' } }));
vi.mock('../telemetry/productDataClient', () => ({ submitFeedback: (payload: unknown, context: unknown) => submitFeedback(payload, context) }));

// The Turnstile *loading* logic (script error, timeout, retry) already has
// dedicated coverage in telemetry/turnstile.test.ts. Here the hook is
// mocked so these tests can drive FeedbackDialog's own RESPONSE to each
// state it can report — in particular `failed`, which used to have no
// representation at all: Submit just stayed disabled forever with no
// explanation, the reported "cannot be pressed or completed" bug.
const useTurnstile = vi.fn();
vi.mock('../telemetry/turnstile', () => ({ useTurnstile: (...args: unknown[]) => useTurnstile(...args) }));

function notRequired() {
  return { token: undefined, required: false, blocking: false, failed: false, retry: vi.fn() };
}

describe('FeedbackDialog', () => {
  afterEach(() => {
    useTurnstile.mockReset();
    submitFeedback.mockClear();
  });

  it('moves focus into the dialog, closes with Escape, and restores focus', () => {
    useTurnstile.mockReturnValue(notRequired());
    render(<FeedbackDialog lang="en" strings={I18N.en.feedback} />);
    const opener = screen.getByRole('button', { name: I18N.en.feedback.open });
    fireEvent.click(opener);
    expect(screen.getByRole('dialog')).toHaveFocus();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('submits a country-specific report and shows its reference id', async () => {
    useTurnstile.mockReturnValue(notRequired());
    render(<FeedbackDialog lang="en" strings={I18N.en.feedback} countryCode="JP" />);
    fireEvent.click(screen.getByRole('button', { name: I18N.en.feedback.open }));
    fireEvent.change(screen.getByLabelText(I18N.en.feedback.message), { target: { value: 'This country image is incorrect.' } });
    fireEvent.click(screen.getByRole('button', { name: I18N.en.feedback.submit }));
    await waitFor(() => expect(submitFeedback).toHaveBeenCalled());
    expect(screen.getByText(/WJH-TEST-123/)).toBeInTheDocument();
    expect(submitFeedback.mock.calls[0]![1]).toMatchObject({ countryCode: 'JP' });
  });

  it('sends the Turnstile token along when the challenge is solved', async () => {
    useTurnstile.mockReturnValue({ token: 'a-real-token', required: true, blocking: false, failed: false, retry: vi.fn() });
    render(<FeedbackDialog lang="en" strings={I18N.en.feedback} />);
    fireEvent.click(screen.getByRole('button', { name: I18N.en.feedback.open }));
    fireEvent.change(screen.getByLabelText(I18N.en.feedback.message), { target: { value: 'A message with more than ten characters.' } });
    fireEvent.click(screen.getByRole('button', { name: I18N.en.feedback.submit }));
    await waitFor(() => expect(submitFeedback).toHaveBeenCalled());
    expect(submitFeedback.mock.calls[0]![0]).toMatchObject({ turnstileToken: 'a-real-token' });
  });

  // The reported bug, reproduced at the component level: with Turnstile
  // required and NOT yet solved, Submit must stay disabled (correct — the
  // challenge is still the gate) but the traveller must not be left
  // guessing why. `failed` (the challenge could not load at all) is where
  // the previous code had literally no branch: no message, no retry, just
  // a permanently disabled button.
  it('a required-but-unsolved challenge disables Submit without any error shown yet', () => {
    useTurnstile.mockReturnValue({ token: undefined, required: true, blocking: true, failed: false, retry: vi.fn() });
    render(<FeedbackDialog lang="en" strings={I18N.en.feedback} />);
    fireEvent.click(screen.getByRole('button', { name: I18N.en.feedback.open }));
    fireEvent.change(screen.getByLabelText(I18N.en.feedback.message), { target: { value: 'A message with more than ten characters.' } });
    expect(screen.getByRole('button', { name: I18N.en.feedback.submit })).toBeDisabled();
    expect(screen.queryByText(I18N.en.feedback.verificationFailed)).not.toBeInTheDocument();
  });

  it('a challenge that fails to load explains why Submit is disabled and offers a retry', () => {
    const retry = vi.fn();
    useTurnstile.mockReturnValue({ token: undefined, required: true, blocking: true, failed: true, retry });
    render(<FeedbackDialog lang="en" strings={I18N.en.feedback} />);
    fireEvent.click(screen.getByRole('button', { name: I18N.en.feedback.open }));
    fireEvent.change(screen.getByLabelText(I18N.en.feedback.message), { target: { value: 'A message with more than ten characters.' } });

    expect(screen.getByRole('button', { name: I18N.en.feedback.submit })).toBeDisabled();
    expect(screen.getByText(I18N.en.feedback.verificationFailed)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: I18N.en.feedback.retryVerification }));
    expect(retry).toHaveBeenCalledTimes(1);
    // Retrying must never bypass the challenge itself.
    expect(screen.getByRole('button', { name: I18N.en.feedback.submit })).toBeDisabled();
    expect(submitFeedback).not.toHaveBeenCalled();
  });

  it('renders in Arabic too, with the same failed/retry affordance', () => {
    useTurnstile.mockReturnValue({ token: undefined, required: true, blocking: true, failed: true, retry: vi.fn() });
    render(<FeedbackDialog lang="ar" strings={I18N.ar.feedback} />);
    fireEvent.click(screen.getByRole('button', { name: I18N.ar.feedback.open }));
    expect(screen.getByText(I18N.ar.feedback.verificationFailed)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: I18N.ar.feedback.retryVerification })).toBeInTheDocument();
  });
});
