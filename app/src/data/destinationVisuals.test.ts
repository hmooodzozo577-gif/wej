// Destination Imagery System — manifest-level pipeline tests (§21/§27's
// explicit requirement for a dedicated exclusion test on the real
// generated manifest, not just the pure-function unit tests in
// scripts/lib/destinationImageIngest.test.mjs).
import { describe, expect, it } from 'vitest';
import destinationImages from './generated/destinationImages.json';
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
  it('is empty (network-blocked pipeline, honestly reported — see destinationVisuals.ts doc comment)', () => {
    expect(Object.keys(DESTINATION_VISUALS)).toEqual([]);
  });
});
