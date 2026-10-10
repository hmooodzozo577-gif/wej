// The public name is تِلقاء / TILQAA. These checks walk the user-facing copy
// modules and every generated page head so the previous name cannot survive
// in one forgotten string (the travel-need explanations built by
// personalization/explain.ts are checked in travelNeeds.test.ts). Technical identifiers that keep the old
// name on purpose (storage keys, the stylesheet's filename, build-tool User
// Agents) are not public copy and are not scanned here.
import { describe, expect, it } from 'vitest';
import { I18N } from '../data/i18n';
import { COMPARE_COPY } from '../compare/compareModel';
import { FAVORITES_COPY } from '../favorites/copy';
import { TRAVEL_NEED_COPY, TRAVEL_NEED_SOURCES } from '../personalization/travelNeeds';
import { PERSONAL_COPY } from '../personalization/copy';
import { ENTRY_COPY } from '../entry/copy';
import { METHODOLOGIES } from '../intelligence/methodology';
import { SOURCES } from '../intelligence/sources';
import { SHARE_COPY, destinationSharePayload } from '../share/share';
import { WORLD_CATALOG } from '../data/worldCatalog';
import { BRAND as META_BRAND, HOME_META, NOT_FOUND_META, staticPages } from '../seo/meta';
import { SHARE_IMAGE, documentTitle, headTags, structuredData, webManifest, type SiteInfo } from '../seo/document';
import { BRAND, BRAND_TAGLINE } from './brand';
import { NAME_STORY_COPY } from './nameStoryCopy';

const SITE: SiteInfo = { origin: 'https://hmooodzozo577-gif.github.io', basePath: '/wej/', url: 'https://hmooodzozo577-gif.github.io/wej/' };

/** The previous name as a whole word. "وجهتين" (two destinations) and
 *  "وجهتك" (your destination) are ordinary words and must not match. */
const OLD_BRAND = /Wejhaty|(?<![\p{L}\p{M}])وِ?جهتي(?![\p{L}\p{M}])/u;

function strings(value: unknown, sample = ['Japan', 87] as const): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value === 'function') {
    try {
      const result = (value as (...args: unknown[]) => unknown)(...sample);
      return typeof result === 'string' ? [result] : [];
    } catch {
      return []; // a formatter that needs a different argument shape
    }
  }
  if (Array.isArray(value)) return value.flatMap((item) => strings(item, sample));
  if (value && typeof value === 'object') return Object.values(value).flatMap((item) => strings(item, sample));
  return [];
}

describe('brand identity', () => {
  it('names the product تِلقاء in Arabic and TILQAA in Latin script, with the kasra under the ت', () => {
    expect(BRAND).toEqual({ ar: 'تِلقاء', en: 'TILQAA' });
    expect([...BRAND.ar].map((char) => char.codePointAt(0)!.toString(16))).toEqual(['62a', '650', '644', '642', '627', '621']);
    expect(BRAND_TAGLINE).toEqual({ ar: 'العالم في اتجاهك.', en: 'The World Within Your Reach.' });
    expect(META_BRAND).toEqual(BRAND);
  });

  it('shows the new name in the interface copy of both languages', () => {
    expect(I18N.ar.brand).toBe('تِلقاء');
    expect(I18N.en.brand).toBe('TILQAA');
    expect(I18N.ar.how.title).toBe('كيف يعمل تِلقاء');
    expect(I18N.en.how.title).toBe('How TILQAA Works');
  });

  it('leaves no trace of the previous name in any public copy module', () => {
    const modules = {
      I18N, COMPARE_COPY, FAVORITES_COPY, TRAVEL_NEED_COPY, TRAVEL_NEED_SOURCES, SHARE_COPY, NAME_STORY_COPY,
      PERSONAL_COPY, ENTRY_COPY, METHODOLOGIES, SOURCES,
    };
    for (const [name, module] of Object.entries(modules)) {
      const offenders = strings(module).filter((text) => OLD_BRAND.test(text));
      expect(offenders, name).toEqual([]);
    }
  });

  it('leaves no trace of the previous name in any page title, description, head or structured data', () => {
    const pages = [...staticPages(), NOT_FOUND_META];
    for (const page of pages) {
      const surfaces = [
        page.title.ar, page.title.en, page.description.ar, page.description.en, page.heading.ar, page.heading.en,
        documentTitle(page), headTags(page, SITE), JSON.stringify(structuredData(page, SITE)),
      ];
      expect(surfaces.filter((text) => OLD_BRAND.test(text)), page.path ?? 'not-found').toEqual([]);
    }
    expect(webManifest(SITE)).not.toMatch(OLD_BRAND);
    expect(SHARE_IMAGE.alt).not.toMatch(OLD_BRAND);
  });

  it('titles the home page with both names and the tagline', () => {
    expect(HOME_META.title).toEqual({ ar: 'تِلقاء TILQAA — العالم في اتجاهك', en: 'TILQAA — The World Within Your Reach' });
    expect(HOME_META.heading).toEqual({ ar: 'تِلقاء', en: 'TILQAA' });
    expect(documentTitle(HOME_META)).toBe('تِلقاء TILQAA — العالم في اتجاهك');
  });

  it('brands destination titles, the social metadata and the structured data', () => {
    const japan = staticPages().find((page) => page.destinationId === 'japan')!;
    expect(japan.title).toEqual({ ar: 'اليابان للسفر | تِلقاء', en: 'Japan travel | TILQAA' });
    expect(documentTitle(japan)).toBe('اليابان للسفر — Japan travel | تِلقاء TILQAA');
    expect(headTags(japan, SITE)).toContain('<meta property="og:site_name" content="تِلقاء TILQAA" />');
    expect(SHARE_IMAGE.alt).toBe('تِلقاء — TILQAA');
    expect(structuredData(HOME_META, SITE)).toEqual([expect.objectContaining({ name: 'تِلقاء', alternateName: 'TILQAA' })]);
    expect(JSON.stringify(structuredData(japan, SITE))).toContain('"position":1,"name":"تِلقاء"');
  });

  it('names the installed app تِلقاء', () => {
    const manifest = JSON.parse(webManifest(SITE)) as Record<string, unknown>;
    expect(manifest.name).toBe('تِلقاء — TILQAA');
    expect(manifest.short_name).toBe('تِلقاء');
    expect(manifest.description).toBe('TILQAA — The World Within Your Reach.');
    // The installed app still starts on the deployment's own base path.
    expect(manifest.start_url).toBe('/wej/');
  });

  it('shares a destination under the new name', () => {
    const japan = WORLD_CATALOG.find((entry) => entry.id === 'japan')!;
    expect(destinationSharePayload(japan, 'en').text).toBe('Japan on TILQAA');
    expect(destinationSharePayload(japan, 'ar').text).toBe('اليابان على تِلقاء');
  });

  it('keeps every page address exactly as before the rename', () => {
    const paths = staticPages().map((page) => page.path).filter((path) => !path?.startsWith('destination/'));
    expect(paths).toEqual([
      '', 'explore/', 'purpose/',
      'quiz/tourism/', 'quiz/work/', 'quiz/education/', 'quiz/medical/', 'quiz/immigration/', 'quiz/investment/', 'quiz/wellness/', 'quiz/other/',
      'results/', 'favorites/', 'compare/',
    ]);
    expect(staticPages().filter((page) => page.path?.startsWith('destination/'))).toHaveLength(WORLD_CATALOG.length);
  });
});
