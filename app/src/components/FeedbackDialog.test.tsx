import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18N } from '../data/i18n';
import { FeedbackDialog } from './FeedbackDialog';

const submitFeedback = vi.fn(async (_payload: unknown, _context: unknown): Promise<{ ok: boolean; data?: { referenceId: string } }> => ({ ok: true, data: { referenceId: 'WJH-TEST-123' } }));
vi.mock('../telemetry/productDataClient', () => ({ submitFeedback: (payload: unknown, context: unknown) => submitFeedback(payload, context) }));

// The Turnstile *loading* logic (script error, timeout, retry) already has
// dedicated coverage in telemetry/turnstile.test.ts. Here the hook is
// mocked so these tests can drive FeedbackDialog's own RESPONSE to each
// state it can report — in particular `failed`, which needs a visible
// explanation and retry path instead of a silently disabled control.
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

  // A required but unfinished challenge is a legitimate temporary gate.
  // Keep that state distinct from a load failure, explain it neutrally, and
  // reserve the error/retry treatment for the hook's explicit failed state.
  it('a required-but-unsolved challenge disables Submit and shows a neutral "verifying" hint, not an error', () => {
    useTurnstile.mockReturnValue({ token: undefined, required: true, blocking: true, failed: false, retry: vi.fn() });
    render(<FeedbackDialog lang="en" strings={I18N.en.feedback} />);
    fireEvent.click(screen.getByRole('button', { name: I18N.en.feedback.open }));
    fireEvent.change(screen.getByLabelText(I18N.en.feedback.message), { target: { value: 'A message with more than ten characters.' } });
    expect(screen.getByRole('button', { name: I18N.en.feedback.submit })).toBeDisabled();
    expect(screen.queryByText(I18N.en.feedback.verificationFailed)).not.toBeInTheDocument();
    expect(screen.getByText(I18N.en.feedback.verifyingChallenge)).toBeInTheDocument();
  });

  it('the "verifying" hint disappears once the challenge is solved', () => {
    useTurnstile.mockReturnValue({ token: 'a-real-token', required: true, blocking: false, failed: false, retry: vi.fn() });
    render(<FeedbackDialog lang="en" strings={I18N.en.feedback} />);
    fireEvent.click(screen.getByRole('button', { name: I18N.en.feedback.open }));
    expect(screen.queryByText(I18N.en.feedback.verifyingChallenge)).not.toBeInTheDocument();
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

  // Acceptance fix — a request failure (network error, Worker rejection,
  // e.g. a Turnstile server-side verification mismatch) must not lose the
  // traveller's typed text, and must show an accessible error distinct
  // from success.
  it('a failed submission preserves the typed message and shows an accessible error', async () => {
    submitFeedback.mockResolvedValueOnce({ ok: false });
    useTurnstile.mockReturnValue(notRequired());
    render(<FeedbackDialog lang="en" strings={I18N.en.feedback} />);
    fireEvent.click(screen.getByRole('button', { name: I18N.en.feedback.open }));
    const typed = 'A message that will fail to send this time.';
    fireEvent.change(screen.getByLabelText(I18N.en.feedback.message), { target: { value: typed } });
    fireEvent.click(screen.getByRole('button', { name: I18N.en.feedback.submit }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(I18N.en.feedback.failed));
    expect(screen.getByLabelText(I18N.en.feedback.message)).toHaveValue(typed);
  });

  it('keeps Tab and Shift+Tab focus inside the open dialog', () => {
    useTurnstile.mockReturnValue(notRequired());
    render(<FeedbackDialog lang="en" strings={I18N.en.feedback} />);
    fireEvent.click(screen.getByRole('button', { name: I18N.en.feedback.open }));
    const dialog = screen.getByRole('dialog');
    const close = screen.getByRole('button', { name: I18N.en.feedback.close });
    const file = screen.getByLabelText(`${I18N.en.feedback.screenshot} ${I18N.en.feedback.chooseFile}`);

    close.focus();
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(file).toHaveFocus();

    fireEvent.keyDown(window, { key: 'Tab' });
    expect(close).toHaveFocus();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it('explains the one-hour session limit instead of reporting a generic broken form', async () => {
    submitFeedback.mockResolvedValueOnce({ ok: false, data: { error: 'rate_limited' } } as never);
    useTurnstile.mockReturnValue(notRequired());
    render(<FeedbackDialog lang="en" strings={I18N.en.feedback} />);
    fireEvent.click(screen.getByRole('button', { name: I18N.en.feedback.open }));
    fireEvent.change(screen.getByLabelText(I18N.en.feedback.message), { target: { value: 'A sixth message inside the same hour.' } });
    fireEvent.click(screen.getByRole('button', { name: I18N.en.feedback.submit }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(I18N.en.feedback.rateLimited));
    expect(screen.getByLabelText(I18N.en.feedback.message)).toHaveValue('A sixth message inside the same hour.');
  });

  // Acceptance fix — double-tapping Send (a slow network, an eager double
  // click) must never fire a second submission while the first is saving.
  it('double-clicking Submit sends only one request', async () => {
    useTurnstile.mockReturnValue(notRequired());
    render(<FeedbackDialog lang="en" strings={I18N.en.feedback} />);
    fireEvent.click(screen.getByRole('button', { name: I18N.en.feedback.open }));
    fireEvent.change(screen.getByLabelText(I18N.en.feedback.message), { target: { value: 'A message with more than ten characters.' } });
    const submit = screen.getByRole('button', { name: I18N.en.feedback.submit });
    fireEvent.click(submit);
    fireEvent.click(submit);
    fireEvent.click(submit);
    await waitFor(() => expect(submitFeedback).toHaveBeenCalled());
    expect(submitFeedback).toHaveBeenCalledTimes(1);
  });

  it('renders in Arabic too, with the same failed/retry affordance', () => {
    useTurnstile.mockReturnValue({ token: undefined, required: true, blocking: true, failed: true, retry: vi.fn() });
    render(<FeedbackDialog lang="ar" strings={I18N.ar.feedback} />);
    fireEvent.click(screen.getByRole('button', { name: I18N.ar.feedback.open }));
    expect(screen.getByText(I18N.ar.feedback.verificationFailed)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: I18N.ar.feedback.retryVerification })).toBeInTheDocument();
  });

  it('explains the minimum message length while the visible Send button is disabled', () => {
    useTurnstile.mockReturnValue(notRequired());
    render(<FeedbackDialog lang="ar" strings={I18N.ar.feedback} />);
    fireEvent.click(screen.getByRole('button', { name: I18N.ar.feedback.open }));
    const submit = screen.getByRole('button', { name: I18N.ar.feedback.submit });
    expect(submit).toBeDisabled();
    expect(screen.getByText(I18N.ar.feedback.messageHint)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(I18N.ar.feedback.message), { target: { value: 'رسالة واضحة تتجاوز الحد الأدنى.' } });
    expect(submit).toBeEnabled();
  });

  it('uses localized copy for the custom screenshot picker', () => {
    useTurnstile.mockReturnValue(notRequired());
    render(<FeedbackDialog lang="ar" strings={I18N.ar.feedback} />);
    fireEvent.click(screen.getByRole('button', { name: I18N.ar.feedback.open }));
    expect(screen.getByText(I18N.ar.feedback.chooseFile)).toBeInTheDocument();
    expect(screen.getByText(I18N.ar.feedback.noFileSelected)).toBeInTheDocument();
    expect(screen.getByLabelText(`${I18N.ar.feedback.screenshot} ${I18N.ar.feedback.chooseFile}`)).toHaveAttribute('type', 'file');
  });
});
