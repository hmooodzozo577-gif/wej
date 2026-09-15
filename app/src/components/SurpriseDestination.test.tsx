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

  it('item #9: skips the flag reel and lands directly on the winner when reduced motion is preferred', () => {
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
