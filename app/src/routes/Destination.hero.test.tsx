// Hero-image correction pass — real user visual review of the deployed
// Saudi Arabia Destination page: the destination image must live as the
// Hero background, never as a standalone sidebar card, and never
// duplicated. Same render harness as the other Destination.*.test.tsx
// files (full app providers, real router, real data — no mocks) so
// these assertions reflect actual production behavior, not a stubbed
// component in isolation.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppStateProvider } from '../state/AppStateContext';
import { Destination } from './Destination';
import { DESTINATION_VISUALS } from '../data/destinationVisuals';

function renderAt(path: string) {
  return render(
    <AppStateProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/destination/:id" element={<Destination />} />
        </Routes>
      </MemoryRouter>
    </AppStateProvider>,
  );
}

describe('Hero-image correction pass — full-destination branch (ksa, real SA imagery)', () => {
  it('sanity: SA has a real manifest-backed visual (guards against the fixture drifting)', () => {
    expect(DESTINATION_VISUALS.SA).toBeDefined();
  });

  it('renders the real destination image as an eager, dimensioned Hero image instead of a CSS background', () => {
    const { container } = renderAt('/destination/ksa');
    const hero = container.querySelector('.detail-hero')!;
    expect(hero).not.toBeNull();
    expect(hero.classList.contains('flag-banner')).toBe(false);
    expect(hero.getAttribute('style') || '').not.toContain(DESTINATION_VISUALS.SA.imagePath);
    const image = hero.querySelector('.detail-hero-image') as HTMLImageElement;
    expect(image).not.toBeNull();
    expect(image.getAttribute('src')).toBe(DESTINATION_VISUALS.SA.imagePath);
    expect(image.getAttribute('srcset')).toContain(DESTINATION_VISUALS.SA.cardImagePath);
    expect(image.getAttribute('sizes')).toBe('(max-width: 900px) 100vw, 1280px');
    expect(image.getAttribute('loading')).toBe('eager');
    expect(image.getAttribute('fetchpriority')).toBe('high');
    expect(image.getAttribute('width')).toBe(String(DESTINATION_VISUALS.SA.width));
    expect(image.getAttribute('height')).toBe(String(DESTINATION_VISUALS.SA.height));
    expect(image.getAttribute('alt')).toBe('');
  });

  it('the flag no longer renders as the dominant Hero banner — only as the small identity chip next to the name', () => {
    const { container } = renderAt('/destination/ksa');
    const hero = container.querySelector('.detail-hero')!;
    // .flag-banner-bg/.flag-banner-fg are FlagBanner's own decorative
    // layers — must be absent once a real photo exists.
    expect(hero.querySelector('.flag-banner-bg')).toBeNull();
    expect(hero.querySelector('.flag-banner-fg')).toBeNull();
    // The small chip next to the name must still be present.
    expect(hero.querySelector('.name-flag .flag-chip, .name-flag .flag-fallback')).not.toBeNull();
  });

  it('country name remains prominent (h1) and readable content is present', () => {
    const { container } = renderAt('/destination/ksa');
    const h1 = container.querySelector('.detail-hero h1');
    expect(h1).not.toBeNull();
    expect(h1!.textContent).toBeTruthy();
  });

  it('the Hero image is the only destination photo and no standalone sidebar image card exists', () => {
    const { container } = renderAt('/destination/ksa');
    expect(container.querySelectorAll('.detail-hero-image')).toHaveLength(1);
    expect(container.querySelector('.destination-visual')).toBeNull();
  });

  it('exactly ONE photo-attribution disclosure exists on the page — never duplicated', () => {
    const { container } = renderAt('/destination/ksa');
    expect(container.querySelectorAll('.hero-photo-attribution')).toHaveLength(1);
  });

  it('the photo-attribution disclosure lives inside the Hero, is closed by default, and exposes source/author/license', () => {
    const { container, getByText } = renderAt('/destination/ksa');
    const hero = container.querySelector('.detail-hero')!;
    const disclosure = hero.querySelector('.hero-photo-attribution') as HTMLDetailsElement;
    expect(disclosure).not.toBeNull();
    expect(disclosure.open).toBe(false);
    expect(getByText('معلومات الصورة')).toBeInTheDocument();
    const link = disclosure.querySelector('a[href]');
    expect(link).not.toBeNull();
    expect(link!.getAttribute('href')).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
  });

  it('the real landmark identity is exposed accessibly in the disclosure (not lost once the photo has no alt text)', () => {
    const { getByText } = renderAt('/destination/ksa');
    expect(getByText(DESTINATION_VISUALS.SA.altAr)).toBeInTheDocument();
  });
});

describe('Hero-image correction pass — worldwide imagery (bg, Bulgaria — basic-country branch)', () => {
  it('BG now has a reviewed manifest entry', () => {
    expect(DESTINATION_VISUALS.BG).toBeDefined();
  });

  it('uses the reviewed country image in the Hero', () => {
    const { container } = renderAt('/destination/bg');
    const hero = container.querySelector('.detail-hero')!;
    expect(hero).not.toBeNull();
    expect(hero.classList.contains('flag-banner')).toBe(false);
    expect(hero.querySelector('.detail-hero-image')?.getAttribute('src')).toBe(DESTINATION_VISUALS.BG.imagePath);
  });

  it('renders the matching attribution disclosure', () => {
    const { container } = renderAt('/destination/bg');
    expect(container.querySelector('.hero-photo-attribution')).not.toBeNull();
  });
});

describe('Hero-image correction pass — second full-destination spot check (japan, real JP imagery)', () => {
  it('resolves its own real image, not a stale/shared one', () => {
    const { container } = renderAt('/destination/japan');
    const hero = container.querySelector('.detail-hero')!;
    const src = hero.querySelector('.detail-hero-image')?.getAttribute('src') || '';
    expect(src).toBe(DESTINATION_VISUALS.JP.imagePath);
    expect(src).not.toBe(DESTINATION_VISUALS.SA.imagePath);
  });
});
