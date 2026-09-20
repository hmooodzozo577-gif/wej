import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18N } from '../data/i18n';
import { WORLD_CATALOG } from '../data/worldCatalog';
import { SurpriseDestination } from './SurpriseDestination';

beforeEach(() => sessionStorage.clear());
afterEach(() => vi.useRealTimers());

describe('SurpriseDestination', () => {
  it('selects only from the supplied filtered candidates and exposes a real country link', () => {
    vi.useFakeTimers();
    const candidate = WORLD_CATALOG.find((country) => country.id === 'japan')!;
    render(<MemoryRouter><SurpriseDestination candidates={[candidate]} lang="ar" strings={I18N.ar.explore} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: I18N.ar.explore.surpriseSpin }));
    expect(screen.getByText(I18N.ar.explore.surpriseSpinning)).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(900));
    expect(screen.getByRole('link', { name: /استكشف الدولة/ })).toHaveAttribute('href', '/destination/japan');
  });

  it('does not repeat a country after leaving and returning during the same session', () => {
    vi.useFakeTimers();
    vi.spyOn(crypto, 'getRandomValues').mockImplementation(((array: Uint32Array) => {
      array[0] = 0;
      return array;
    }) as typeof crypto.getRandomValues);
    const candidates = [
      WORLD_CATALOG.find((country) => country.id === 'japan')!,
      WORLD_CATALOG.find((country) => country.id === 'france')!,
    ];

    const first = render(<MemoryRouter><SurpriseDestination candidates={candidates} lang="en" strings={I18N.en.explore} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: I18N.en.explore.surpriseSpin }));
    act(() => vi.advanceTimersByTime(900));
    expect(screen.getByText('Japan')).toBeInTheDocument();
    first.unmount();

    render(<MemoryRouter><SurpriseDestination candidates={candidates} lang="en" strings={I18N.en.explore} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: I18N.en.explore.surpriseSpin }));
    act(() => vi.advanceTimersByTime(900));
    expect(screen.getByText('France')).toBeInTheDocument();
  });


  describe('the compact compass reveal', () => {
    const japan = WORLD_CATALOG.find((country) => country.id === 'japan')!;

    it('renders the compass identity at rest instead of waiting for activation', () => {
      vi.useFakeTimers();
      const { container } = render(
        <MemoryRouter><SurpriseDestination candidates={[japan]} lang="en" strings={I18N.en.explore} /></MemoryRouter>,
      );
      expect(container.querySelector('.surprise-compass .compass-mark')).not.toBeNull();
      expect(container.querySelector('.surprise-reel')).toBeNull();
    });

    it('keeps the decorative compass out of the accessibility tree and announces the outcome once', () => {
      vi.useFakeTimers();
      const { container } = render(
        <MemoryRouter><SurpriseDestination candidates={[japan]} lang="en" strings={I18N.en.explore} /></MemoryRouter>,
      );
      fireEvent.click(screen.getByRole('button', { name: I18N.en.explore.surpriseSpin }));
      expect(container.querySelector('.surprise-compass')).toHaveAttribute('aria-hidden', 'true');
      const live = container.querySelectorAll('[aria-live]');
      expect(live).toHaveLength(1);
      expect(live[0]).toHaveClass('surprise-outcome');
      act(() => vi.advanceTimersByTime(900));
      expect(container.querySelector('.surprise-compass')).toHaveAttribute('aria-hidden', 'true');
    });

    it('survives a blocked sessionStorage instead of throwing out of the click handler', () => {
      vi.useFakeTimers();
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      render(<MemoryRouter><SurpriseDestination candidates={[japan]} lang="en" strings={I18N.en.explore} /></MemoryRouter>);
      expect(() => {
        fireEvent.click(screen.getByRole('button', { name: I18N.en.explore.surpriseSpin }));
        act(() => vi.advanceTimersByTime(900));
      }).not.toThrow();
      expect(screen.getByRole('link', { name: /Explore country/ })).toBeInTheDocument();
      vi.restoreAllMocks();
    });

    it('still captions the result with the real direction when a location was shared', () => {
      vi.useFakeTimers();
      // Riyadh: Japan is clearly to the east/north-east.
      render(
        <MemoryRouter>
          <SurpriseDestination candidates={[japan]} lang="en" strings={I18N.en.explore} origin={{ lat: 24.7, lng: 46.7 }} />
        </MemoryRouter>,
      );
      fireEvent.click(screen.getByRole('button', { name: I18N.en.explore.surpriseSpin }));
      act(() => vi.advanceTimersByTime(900));
      const directions = Object.values(I18N.en.explore.surpriseDirections);
      expect(directions.some((label) => screen.queryByText(label))).toBe(true);
    });

    it('claims no direction at all without a location', () => {
      vi.useFakeTimers();
      render(<MemoryRouter><SurpriseDestination candidates={[japan]} lang="en" strings={I18N.en.explore} /></MemoryRouter>);
      fireEvent.click(screen.getByRole('button', { name: I18N.en.explore.surpriseSpin }));
      act(() => vi.advanceTimersByTime(900));
      for (const label of Object.values(I18N.en.explore.surpriseDirections)) {
        expect(screen.queryByText(label)).toBeNull();
      }
    });
  });

  it('skips the reel and lands directly on the winner when reduced motion is preferred', () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
    const candidates = [
      WORLD_CATALOG.find((country) => country.id === 'japan')!,
      WORLD_CATALOG.find((country) => country.id === 'france')!,
    ];
    render(<MemoryRouter><SurpriseDestination candidates={candidates} lang="en" strings={I18N.en.explore} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: I18N.en.explore.surpriseSpin }));
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByRole('link', { name: /Explore country/ })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
