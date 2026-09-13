import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { I18N } from '../data/i18n';
import { FeedbackDialog } from './FeedbackDialog';

const submitFeedback = vi.fn(async (_payload: unknown, _context: unknown) => ({ ok: true, data: { referenceId: 'WJH-TEST-123' } }));
vi.mock('../telemetry/productDataClient', () => ({ submitFeedback: (payload: unknown, context: unknown) => submitFeedback(payload, context) }));

describe('FeedbackDialog', () => {
  it('moves focus into the dialog, closes with Escape, and restores focus', () => {
    render(<FeedbackDialog lang="en" strings={I18N.en.feedback} />);
    const opener = screen.getByRole('button', { name: I18N.en.feedback.open });
    fireEvent.click(opener);
    expect(screen.getByRole('dialog')).toHaveFocus();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('submits a country-specific report and shows its reference id', async () => {
    render(<FeedbackDialog lang="en" strings={I18N.en.feedback} countryCode="JP" />);
    fireEvent.click(screen.getByRole('button', { name: I18N.en.feedback.open }));
    fireEvent.change(screen.getByLabelText(I18N.en.feedback.message), { target: { value: 'This country image is incorrect.' } });
    fireEvent.click(screen.getByRole('button', { name: I18N.en.feedback.submit }));
    await waitFor(() => expect(submitFeedback).toHaveBeenCalled());
    expect(screen.getByText(/WJH-TEST-123/)).toBeInTheDocument();
    expect(submitFeedback.mock.calls[0]![1]).toMatchObject({ countryCode: 'JP' });
  });
});
