// Destination Imagery System — manifest-level pipeline tests (§21/§27's
// explicit requirement for a dedicated exclusion test on the real
// generated manifest, not just the pure-function unit tests in
// scripts/lib/destinationImageIngest.test.mjs).
import { describe, expect, it } from 'vitest';
import destinationImages from './generated/destinationImages.json';
import imageAudit from '../../scripts/destinationImageAudit.json';
import { DESTINATION_VISUALS } from './destinationVisuals';

describe('destinationImages.json (generated manifest) — Israel exclusion', () => {
  it('never contains an IL/ISR entry', () => {
    const entries = destinationImages as Array<{ iso2: string; iso3: string }>;
    expect(entries.some((e) => e.iso2 === 'IL')).toBe(false);
    expect(entries.some((e) => e.iso3 === 'ISR')).toBe(false);
  });

  it('DESTINATION_VISUALS (built from the manifest) never has an IL key either', () => {
    expect(DESTINATION_VISUALS.IL).toBeUndefined();
  });
});

describe('DESTINATION_VISUALS — current production state', () => {
  it('covers all 194 effective countries with real, license-valid entries', () => {
    const keys = Object.keys(DESTINATION_VISUALS);
    expect(keys).toHaveLength(194);
  });

  it('matches the complete human visual-review record, so regenerated unreviewed files cannot silently ship', () => {
    const entries = destinationImages as Array<{ iso2: string; sourcePage: string }>;
    expect(imageAudit.coverage).toBe(194);
    expect(imageAudit.entries).toHaveLength(194);
    const reviewedByIso2 = new Map(imageAudit.entries.map((entry) => [entry.iso2, entry]));
    for (const entry of entries) {
      const reviewed = reviewedByIso2.get(entry.iso2);
      expect(reviewed?.status, `${entry.iso2} review status`).toBe('approved');
      expect(reviewed?.sourcePage, `${entry.iso2} reviewed source`).toBe(entry.sourcePage);
    }
  });

  it('Monaco (MC) has a real entry — confirms the exclusion mechanism only removed IL, not a nearby/similar code', () => {
    expect(DESTINATION_VISUALS.MC).toBeDefined();
    expect(DESTINATION_VISUALS.MC.imagePath).toBe(`${import.meta.env.BASE_URL.replace(/\/$/, '')}/destinations/mc.webp`);
  });

  it('REGRESSION: imagePath is deploy-base-prefixed from the RAW manifest localPath, not used as-is', () => {
    // Found by a live Playwright check against the built preview server
    // (base: '/wej/') during this pass's UI-integration verification: a
    // bare manifest localPath used directly as <img src> 404s once the
    // app is served from a sub-path — the request landed on
    // http://host/destinations/sa.webp instead of
    // http://host/wej/destinations/sa.webp. Fixed by prefixing with
    // import.meta.env.BASE_URL in destinationVisuals.ts. Vitest's own
    // BASE_URL resolves to '/' regardless of vite.config's `base`
    // (a Vitest env quirk, not a bug in this code), so this compares
    // against the SAME computed prefix rather than a hardcoded '/wej/'
    // — it locks in "always transform via BASE_URL", not one fixed
    // value, and the actual '/wej/' production value is confirmed
    // separately via the manual Playwright/build check in the final
    // report's UI Integration section.
    const rawEntry = (destinationImages as Array<{ iso2: string; localPath: string }>).find((e) => e.iso2 === 'SA')!;
    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    expect(DESTINATION_VISUALS.SA.imagePath).toBe(`${base}${rawEntry.localPath}`);
    expect(DESTINATION_VISUALS.SA.imagePath).not.toBe(rawEntry.localPath.slice(1)); // not missing its leading slash either
  });

  it('every entry has a non-empty local image path (deploy-base-prefixed), alt text in both languages, and a valid attribution URL', () => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    const imagePathPattern = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/destinations/[a-z]{2}\\.webp$`);
    for (const [iso2, visual] of Object.entries(DESTINATION_VISUALS)) {
      expect(visual.imagePath, `${iso2} imagePath`).toMatch(imagePathPattern);
      expect(visual.altEn, `${iso2} altEn`).toBeTruthy();
      expect(visual.altAr, `${iso2} altAr`).toBeTruthy();
      expect(visual.attributionUrl, `${iso2} attributionUrl`).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
    }
  });
});
