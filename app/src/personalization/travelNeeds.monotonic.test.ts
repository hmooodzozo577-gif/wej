// personal-match-1.2 — on the committed OpenStreetMap snapshot and the real
// official-language data: answering a travel need can only raise or keep a
// destination's Personal Match, never lower it. personal-match-1.1's
// partial mosque level (fit 60) broke this for 33 countries — a country
// with 20–199 mapped mosques could score below one with none — which is
// why 1.2 counts thin evidence as "not counted" instead.
import { describe, expect, it } from 'vitest';
import type { PurposeId } from '../data/types';
import type { Answers } from '../engine/types';
import { QUESTION_BANKS } from '../data/questionBanks';
import { WORLD_CATALOG } from '../data/worldCatalog';
import { computePersonalMatch } from './personalMatch';
import { normalizePreferences } from './signals';
import { travelNeedQuestionId } from './travelNeeds';

const PURPOSES: PurposeId[] = ['tourism', 'work', 'education', 'medical', 'immigration', 'investment', 'wellness', 'other'];

/** Two core profiles per purpose: every first option, every last option. */
function coreProfiles(purpose: PurposeId): Answers[] {
  const questions = QUESTION_BANKS[purpose].filter((q) => q.options?.length && !q.parent);
  const pick = (index: 0 | -1) => Object.fromEntries(questions.map((q) => [q.id, q.options!.at(index)!.value])) as Answers;
  return [pick(0), pick(-1)];
}

describe('a travel need never lowers a Personal Match', () => {
  it.each(PURPOSES)('%s: every country, every need, both importance levels', (purpose) => {
    const needs: Answers[] = [];
    for (const importance of [100, 60]) {
      needs.push({ [travelNeedQuestionId(purpose, 'islamicPractice')]: importance });
      needs.push({ [travelNeedQuestionId(purpose, 'halalFood')]: importance });
      needs.push({ [travelNeedQuestionId(purpose, 'languageImportance')]: importance, [travelNeedQuestionId(purpose, 'languages')]: 'ar,en' });
    }
    for (const core of coreProfiles(purpose)) {
      const base = normalizePreferences(purpose, core);
      for (const extra of needs) {
        const withNeed = normalizePreferences(purpose, { ...core, ...extra });
        for (const dest of WORLD_CATALOG) {
          const before = computePersonalMatch(dest, base).score;
          const after = computePersonalMatch(dest, withNeed).score;
          if (before === null || after === null) continue;
          expect(after, `${purpose} ${dest.id} ${Object.keys(extra).join('+')}`).toBeGreaterThanOrEqual(before);
        }
      }
    }
  });
});
