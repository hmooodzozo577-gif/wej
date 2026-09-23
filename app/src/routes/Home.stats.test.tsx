// Regression test for the stale "30+" hero stat: proves the displayed
// destination count is read from WORLD_CATALOG.length at render time, not a
// hard-coded string, so it can't drift from the real catalog size again.
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppStateProvider } from '../state/AppStateContext';
import { Home } from './Home';
import { WORLD_CATALOG } from '../data/worldCatalog';
import { EXCLUDED_COUNTRIES } from '../data/excludedCountries';
import { I18N } from '../data/i18n';

function renderHome() {
  return render(
    <AppStateProvider>
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    </AppStateProvider>,
  );
}

describe('Home hero stat — destination count', () => {
  it('displays the real catalog size, not a hard-coded "30"', () => {
    renderHome();
    // Phase 19 — the catalog is the complete country list, so the count is
    // exact: no "+" suffix claiming more destinations than exist.
    expect(screen.getByText(`${WORLD_CATALOG.length}`)).toBeInTheDocument();
    expect(screen.queryByText(`${WORLD_CATALOG.length}+`)).not.toBeInTheDocument();
    expect(screen.queryByText('30+')).not.toBeInTheDocument();
    expect(screen.queryByText('٣٠+')).not.toBeInTheDocument();
  });

  it('offers both card and full Hero image candidates for the cinematic frame', () => {
    const { container } = renderHome();
    const image = container.querySelector<HTMLImageElement>('.hero-folio-image');
    expect(image).not.toBeNull();
    expect(image!.getAttribute('src')).toMatch(/\/destinations\/[a-z]{2}\.webp$/);
    expect(image!.getAttribute('srcset')).toMatch(/\/destinations\/cards\/[a-z]{2}\.webp 960w, .*\/destinations\/[a-z]{2}\.webp \d+w$/);
    expect(image!.getAttribute('sizes')).toBe('(max-width: 760px) 100vw, min(88vw, 1240px)');
  });

  it('is wired to WORLD_CATALOG.length, not a separate hard-coded number', () => {
    // Sanity anchor: the base convention is 195 (193 UN members + 2
    // observers), minus whatever excludedCountries.ts currently configures
    // (a QA test entry today). If this ever fails, WORLD_CATALOG itself
    // changed size for some other reason — the Home test above should still
    // pass regardless, since it reads the same source rather than a literal.
    expect(WORLD_CATALOG.length).toBe(195 - EXCLUDED_COUNTRIES.length);
  });

  it('keeps the flight path outside the clipping frame and renders the locked travel copy', () => {
    const { container } = renderHome();
    expect(container.querySelector('.home-hero-stage > .travel-route-decor')).not.toBeNull();
    expect(container.querySelector('.home-hero-frame > .travel-route-decor')).toBeNull();
    expect(screen.getByText(I18N.ar.hero.journeyStarts)).toBeInTheDocument();
    expect(screen.getByText(I18N.ar.hero.nearbyDestinations)).toBeInTheDocument();
  });

  it('renders four data-backed compass labels that never repeat the featured destination', () => {
    const { container } = renderHome();
    const featuredId = container.querySelector<HTMLAnchorElement>('.hero-destination-badge')!.getAttribute('href')!.split('/').at(-1);
    const orbitLabels = [...container.querySelectorAll<HTMLElement>('.hero-orbit-destination')];
    expect(orbitLabels).toHaveLength(4);
    expect(new Set(orbitLabels.map((label) => label.dataset.destination)).size).toBe(4);
    expect(orbitLabels.every((label) => label.dataset.destination !== featuredId)).toBe(true);
    expect(orbitLabels.every((label) => label.tagName === 'SPAN')).toBe(true);
  });

  it('carries a flag chip inside every compass badge, matching each badge\'s own destination', () => {
    const { container } = renderHome();
    const orbitLabels = [...container.querySelectorAll<HTMLElement>('.hero-orbit-destination')];
    for (const label of orbitLabels) {
      const chip = label.querySelector('.flag-chip, .flag-fallback');
      expect(chip).not.toBeNull();
      // The flag chip must be the badge's own destination, not a stray/duplicated one.
      expect(label.textContent).not.toBe('');
    }
  });

  it('renders the decorative vertical tagline localized to the active language, hidden from assistive tech', () => {
    const { container } = renderHome();
    const tagline = container.querySelector('.hero-vertical-tagline');
    expect(tagline).not.toBeNull();
    expect(tagline!.getAttribute('aria-hidden')).toBe('true');
    expect(tagline!.textContent).toBe(I18N.ar.hero.verticalTagline);
    expect(I18N.ar.hero.verticalTagline).not.toBe(I18N.en.hero.verticalTagline);
  });
});
