import { describe, expect, it, vi } from 'vitest';
import { waitForLocationSettle } from './waitForLocationSettle';

describe('waitForLocationSettle', () => {
  it('resolves immediately when status is already settled (not requesting)', async () => {
    const start = Date.now();
    const status = await waitForLocationSettle(() => 'granted', 2500, 50);
    expect(status).toBe('granted');
    expect(Date.now() - start).toBeLessThan(50);
  });

  it('polls until status leaves requesting (fast resolution)', async () => {
    let status: 'requesting' | 'granted' = 'requesting';
    setTimeout(() => { status = 'granted'; }, 120);
    const result = await waitForLocationSettle(() => status, 2500, 20);
    expect(result).toBe('granted');
  });

  it('times out and returns the still-pending status if it never settles in time', async () => {
    const result = await waitForLocationSettle(() => 'requesting', 150, 20);
    expect(result).toBe('requesting');
  });

  it('never calls getStatus fewer than once, even with a zero timeout', async () => {
    const getStatus = vi.fn(() => 'requesting' as const);
    await waitForLocationSettle(getStatus, 0, 20);
    expect(getStatus).toHaveBeenCalled();
  });

  it('reports denied/unavailable/timeout/unsupported immediately once reached, without waiting out the full budget', async () => {
    let status: 'requesting' | 'denied' = 'requesting';
    setTimeout(() => { status = 'denied'; }, 50);
    const start = Date.now();
    const result = await waitForLocationSettle(() => status, 2500, 20);
    expect(result).toBe('denied');
    expect(Date.now() - start).toBeLessThan(500);
  });

  it('does not poll forever — respects the given timeout bound even under many rapid polls', async () => {
    const start = Date.now();
    await waitForLocationSettle(() => 'requesting', 200, 10);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(190);
    expect(elapsed).toBeLessThan(500);
  });
});
