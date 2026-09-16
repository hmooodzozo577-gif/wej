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


  // Item #11 — the compass. The needle's resting angle is a real bearing
  // when there is a location to measure from, and a claim of nothing when
  // there is not.
  describe('the compass points at something real, or at nothing', () => {
    const japan = WORLD_CATALOG.find((country) => country.id === 'japan')!;

    it('captions the result with the real direction when the traveller shared a location', () => {
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

    it('rotates the needle to the destination\'s bearing, not to a random angle', () => {
      vi.useFakeTimers();
      const { container } = render(
        <MemoryRouter>
          <SurpriseDestination candidates={[japan]} lang="en" strings={I18N.en.explore} origin={{ lat: 24.7, lng: 46.7 }} />
        </MemoryRouter>,
      );
      fireEvent.click(screen.getByRole('button', { name: I18N.en.explore.surpriseSpin }));
      act(() => vi.advanceTimersByTime(900));
      const needle = container.querySelector('.compass-needle') as HTMLElement;
      const degrees = Number(/rotate\((-?[\d.]+)deg\)/.exec(needle.style.transform)?.[1] ?? '0') % 360;
      // Japan from Riyadh is roughly east-north-east.
      expect(degrees).toBeGreaterThan(40);
      expect(degrees).toBeLessThan(110);
    });

    it('settles due north when there is no bearing to show', () => {
      vi.useFakeTimers();
      const { container } = render(
        <MemoryRouter><SurpriseDestination candidates={[japan]} lang="en" strings={I18N.en.explore} /></MemoryRouter>,
      );
      fireEvent.click(screen.getByRole('button', { name: I18N.en.explore.surpriseSpin }));
      act(() => vi.advanceTimersByTime(900));
      const needle = container.querySelector('.compass-needle') as HTMLElement;
      const degrees = Number(/rotate\((-?[\d.]+)deg\)/.exec(needle.style.transform)?.[1] ?? '0') % 360;
      expect(degrees).toBe(0);
    });

    it('renders the dial with real flags in its window, not an abstract disc', () => {
      vi.useFakeTimers();
      const { container } = render(
        <MemoryRouter><SurpriseDestination candidates={[japan]} lang="en" strings={I18N.en.explore} /></MemoryRouter>,
      );
      fireEvent.click(screen.getByRole('button', { name: I18N.en.explore.surpriseSpin }));
      act(() => vi.advanceTimersByTime(900));
      expect(container.querySelector('.compass-window svg')).not.toBeNull();
      expect(container.querySelectorAll('.compass-ticks i').length).toBe(24);
    });
  });

  it('item #11: skips the sweep and lands directly on the winner when reduced motion is preferred', () => {
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
