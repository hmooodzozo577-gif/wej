import { describe, expect, it } from 'vitest';
import { buildExplainContext } from './buildExplainContext';
import { I18N } from '../data/i18n';
import { DESTINATIONS } from '../data/destinations';
import type { RankedResult } from '../engine';

const japan = DESTINATIONS.find((d) => d.id === 'japan')!;

const top: RankedResult[] = [
  {
    dest: japan,
    score: 82,
    reasons: [
      { id: 'climate', weight: 10, fit: 0.9 },
      { id: 'safety', weight: 8, fit: 0.8 },
      { id: 'lowWeight', weight: 0.5, fit: 1 }, // below the weight>1 threshold — excluded
    ],
  },
];

describe('buildExplainContext', () => {
  it('produces one context entry per ranked destination, carrying its real destId/name/score', () => {
    const ctx = buildExplainContext('en', I18N.en, top);
    expect(ctx).toHaveLength(1);
    expect(ctx[0].destId).toBe('japan');
    expect(ctx[0].name).toBe(japan.nameEn);
    expect(ctx[0].score).toBe(82);
  });

  it('reasons are the SAME top-weighted reasons buildWhyText would show (weight > 1, max 3), as readable labels', () => {
    const ctx = buildExplainContext('en', I18N.en, top);
    expect(ctx[0].reasons.length).toBe(2); // the weight:0.5 reason is excluded
  });

  it('facts contain only already-displayed-elsewhere data — cost/safety/climate/visa — never a fabricated price', () => {
    const ctx = buildExplainContext('en', I18N.en, top);
    expect(ctx[0].facts).toMatch(/Safety/i);
    expect(ctx[0].facts).not.toMatch(/\$\d|SAR\s*\d|USD\s*\d/);
  });

  it('never includes a precise lat/lng-shaped coordinate', () => {
    const ctx = buildExplainContext('en', I18N.en, top);
    expect(JSON.stringify(ctx)).not.toMatch(/\d{1,3}\.\d{4,}/);
  });

  it('Arabic and English produce the same destId/score, only display text differs', () => {
    const en = buildExplainContext('en', I18N.en, top);
    const ar = buildExplainContext('ar', I18N.ar, top);
    expect(ar[0].destId).toBe(en[0].destId);
    expect(ar[0].score).toBe(en[0].score);
    expect(ar[0].name).toBe(japan.nameAr);
  });

  it('an empty ranked list produces an empty context array', () => {
    expect(buildExplainContext('en', I18N.en, [])).toEqual([]);
  });
});
