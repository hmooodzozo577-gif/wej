// Visual refinement pass — data/destinationVisuals.ts's registry is now
// populated with real ingested entries for most (not all — see the
// final report's coverage sections) of the effective catalog. These
// tests guard the "no entry" behavior for a country genuinely absent
// from the manifest, prove the component renders REAL production data
// end-to-end for a country that does have one (SA — part of the
// mandatory 6-country proof), and prove the component WOULD render a
// real, accessible image/attribution for any entry shape via a scoped
// module mock (not by adding a fake production entry).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { useReducer, type ReactElement, type ReactNode } from 'react';
import { AppStateContext } from '../state/context';
import { appReducer, initialAppState } from '../state/reducer';
import type { Lang } from '../data/types';

function renderWithLang(node: ReactElement, lang: Lang = 'ar') {
  function Providers({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(appReducer, { ...initialAppState, lang });
    return <AppStateContext.Provider value={{ state, dispatch }}>{children}</AppStateContext.Provider>;
  }
  return render(<Providers>{node}</Providers>);
}

describe('DestinationVisual — no registry entry', () => {
  it('renders nothing for any arbitrary/unknown country code — never a broken image or placeholder box', async () => {
    const { DestinationVisual } = await import('./DestinationVisual');
    const { container } = renderWithLang(<DestinationVisual countryCode="ZZ" />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing for IL — must never render even if somehow requested', async () => {
    const { DestinationVisual } = await import('./DestinationVisual');
    const { container } = renderWithLang(<DestinationVisual countryCode="IL" />);
    expect(container.innerHTML).toBe('');
  });
});

describe('DestinationVisual — real production data (SA, part of the mandatory 6-country proof)', () => {
  it('renders a real image with attribution end-to-end using the actual generated manifest, no mocks', async () => {
    const { DestinationVisual } = await import('./DestinationVisual');
    const { container } = renderWithLang(<DestinationVisual countryCode="SA" />, 'en');
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe(`${import.meta.env.BASE_URL.replace(/\/$/, '')}/destinations/sa.webp`);
    expect(img!.getAttribute('alt')).toBeTruthy();
    expect(img!.getAttribute('loading')).toBe('lazy');
    expect(container.querySelector('.destination-visual-attribution')).not.toBeNull();
  });
});

describe('DestinationVisual — with a mocked registry entry (proves the mechanism, not production data)', () => {
  // Mocks both the (empty, production) registry AND useI18n directly —
  // sidesteps needing a real AppStateContext Provider for a dynamically
  // re-imported module tree (vi.resetModules() would otherwise give the
  // freshly-imported component a DIFFERENT AppStateContext object than
  // the one this file's statically-imported Provider uses, making
  // useContext() see no provider at all).
  beforeEach(() => vi.resetModules());
  afterEach(() => {
    vi.doUnmock('../data/destinationVisuals');
    vi.doUnmock('../state/hooks');
  });

  async function importMocked(lang: Lang, entry: Record<string, unknown>) {
    vi.doMock('../data/destinationVisuals', () => ({ DESTINATION_VISUALS: entry }));
    vi.doMock('../state/hooks', () => ({ useI18n: () => ({ lang, t: {} }) }));
    return import('./DestinationVisual');
  }

  it('renders an accessible image with meaningful EN alt text and attribution when an entry exists', async () => {
    const { DestinationVisual } = await importMocked('en', {
      SA: {
        imagePath: '/fake/kingdom-centre.jpg',
        altEn: 'Kingdom Centre tower in Riyadh',
        altAr: 'برج المملكة في الرياض',
        attributionEn: 'Photo: Example Author (CC BY-SA 4.0)',
        attributionAr: 'الصورة: مثال (CC BY-SA 4.0)',
        attributionUrl: 'https://example.org/license',
      },
    });
    const { getByAltText, getByText } = render(<DestinationVisual countryCode="SA" />);
    const img = getByAltText('Kingdom Centre tower in Riyadh');
    expect(img.tagName).toBe('IMG');
    expect(getByText('Photo: Example Author (CC BY-SA 4.0)')).toBeInTheDocument();
  });

  it('uses the Arabic alt text and attribution when lang is ar', async () => {
    const { DestinationVisual } = await importMocked('ar', {
      SA: {
        imagePath: '/fake/kingdom-centre.jpg',
        altEn: 'Kingdom Centre tower in Riyadh',
        altAr: 'برج المملكة في الرياض',
        attributionEn: 'Photo: Example Author (CC BY-SA 4.0)',
        attributionAr: 'الصورة: مثال (CC BY-SA 4.0)',
      },
    });
    const { getByAltText, getByText } = render(<DestinationVisual countryCode="SA" />);
    expect(getByAltText('برج المملكة في الرياض')).toBeInTheDocument();
    expect(getByText('الصورة: مثال (CC BY-SA 4.0)')).toBeInTheDocument();
  });

  it('never uses generic non-meaningful alt text like "image" or "picture"', async () => {
    const { DestinationVisual } = await importMocked('en', {
      SA: { imagePath: '/fake/x.jpg', altEn: 'Kingdom Centre tower in Riyadh', altAr: 'برج المملكة في الرياض' },
    });
    const { container } = render(<DestinationVisual countryCode="SA" />);
    const alt = container.querySelector('img')!.getAttribute('alt')!;
    expect(alt.toLowerCase()).not.toBe('image');
    expect(alt.toLowerCase()).not.toMatch(/^saudi arabia (picture|image)$/);
  });

  it('renders no attribution paragraph when the entry has none', async () => {
    const { DestinationVisual } = await importMocked('en', {
      SA: { imagePath: '/fake/x.jpg', altEn: 'Kingdom Centre', altAr: 'برج المملكة' },
    });
    const { container } = render(<DestinationVisual countryCode="SA" />);
    expect(container.querySelector('.destination-visual-attribution')).toBeNull();
  });
});
