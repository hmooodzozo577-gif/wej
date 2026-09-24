// Phase 21 — the admin dashboard names things the way the public site does.
// It shows each adaptive question by its real wording, and each Explore
// filter, sort, region and cost value by the label a traveller saw, in the
// operator's language. The Worker cannot import these TypeScript modules, so
// it bundles a generated catalog (worker/src/generated/adminCatalog.json).
// This test keeps the two in sync: it fails when the catalog is stale, and
// rewrites it when run with UPDATE_ADMIN_CATALOG=1.
//   UPDATE_ADMIN_CATALOG=1 npx vitest run src/data/adminCatalog.sync.test.ts
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PERSONAL_COPY } from '../personalization/copy';
import { I18N } from './i18n';
import { effectiveQuestionBank, QUESTION_BANKS } from './questionBanks';
import type { Continent, Lang, PurposeId } from './types';

// Tests run from app/ (vitest's root).
const TARGET = resolve(process.cwd(), '../worker/src/generated/adminCatalog.json');

// The same lists Explore.tsx offers (its CONTINENTS constant and its sort
// options), so the admin never shows a value the site cannot produce.
const CONTINENTS: Continent[] = ['Africa', 'Asia', 'Europe', 'MiddleEast', 'NAmerica', 'SouthAmerica', 'Oceania'];

function both(pick: (lang: Lang) => string) {
  return { ar: pick('ar'), en: pick('en') };
}

function buildCatalog() {
  const purposes = Object.keys(QUESTION_BANKS) as PurposeId[];
  const explore = (lang: Lang) => I18N[lang].explore;
  const personal = (lang: Lang) => PERSONAL_COPY[lang];
  return {
    source: 'app/src/data/questionBanks.ts, app/src/data/i18n, app/src/personalization/copy.ts',
    questions: Object.fromEntries(purposes.map((purpose) => [
      purpose,
      effectiveQuestionBank(purpose, true).map((question) => ({
        id: question.id,
        kind: question.kind,
        ar: question.text.ar,
        en: question.text.en,
      })),
    ])),
    exploreFilters: {
      region: both((lang) => explore(lang).region),
      purpose: both((lang) => explore(lang).purpose),
      cost: both((lang) => explore(lang).cost),
      sort: both((lang) => explore(lang).sort),
    },
    exploreSorts: {
      'personal-desc': both((lang) => personal(lang).sortPersonalDesc),
      'personal-asc': both((lang) => personal(lang).sortPersonalAsc),
      default: both((lang) => explore(lang).sortDefault),
      'name-asc': both((lang) => explore(lang).sortNameAsc),
      'name-desc': both((lang) => explore(lang).sortNameDesc),
      'area-desc': both((lang) => explore(lang).sortAreaDesc),
      'area-asc': both((lang) => explore(lang).sortAreaAsc),
      'cost-asc': both((lang) => explore(lang).sortCostAsc),
      'cost-desc': both((lang) => explore(lang).sortCostDesc),
      nearest: both((lang) => explore(lang).sortNearest),
      farthest: both((lang) => explore(lang).sortFarthest),
    },
    exploreRegions: {
      all: both((lang) => explore(lang).allRegions),
      ...Object.fromEntries(CONTINENTS.map((region) => [region, both((lang) => I18N[lang].regionLabels[region])])),
    },
    exploreCosts: {
      all: both((lang) => explore(lang).allCosts),
      ...Object.fromEntries([1, 2, 3, 4].map((level) => [String(level), both((lang) => I18N[lang].costLevels[level - 1]!)])),
    },
  };
}

describe('admin catalog', () => {
  it('matches the live question banks and Explore vocabulary', () => {
    const expected = `${JSON.stringify(buildCatalog(), null, 2)}\n`;
    if (process.env.UPDATE_ADMIN_CATALOG === '1') writeFileSync(TARGET, expected);
    expect(existsSync(TARGET)).toBe(true);
    expect(readFileSync(TARGET, 'utf8')).toBe(expected);
  });
});
