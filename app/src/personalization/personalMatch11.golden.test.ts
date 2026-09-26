// v1.1 — proof that personal-match-1.1 did not silently change
// personal-match-1.0. The fixture was produced by running THIS file against
// the untouched v1.0.0 release (tag wejhaty-v1.0.0) with WRITE_GOLDEN set:
// for 112 profile archetypes (every purpose × first/middle/last options ×
// sparse/dense answers × with/without a location, plus the land-border
// constraint) it holds a digest of every country's full Personal Match —
// score, coverage, confidence, eligibility, constraints and every factor —
// and of the Phase 14 → Personal Match refined top 10. Only the
// methodologyVersion label is left out: it is the one thing that must
// change. A profile without the new answers must reproduce every digest.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { rankDestinations } from '../engine';
import type { Answers } from '../engine/types';
import { QUESTION_BANKS, landBorderQuestionId } from '../data/questionBanks';
import type { PurposeId } from '../data/types';
import { WORLD_CATALOG } from '../data/worldCatalog';
import { normalizePreferences } from './signals';
import { computePersonalMatch, refineRanking } from './personalMatch';

const RIYADH = { lat: 24.7136, lng: 46.6753 };
const PURPOSE_IDS: PurposeId[] = ['tourism', 'work', 'education', 'medical', 'immigration', 'investment', 'wellness', 'other'];
const FIXTURE = path.join(__dirname, 'fixtures', 'personalMatch-1.0.golden.json');

type Pick = 'first' | 'middle' | 'last';
function answersFor(purpose: PurposeId, pick: Pick, density: 'sparse' | 'dense'): Answers {
  const answers: Answers = {};
  const bank = QUESTION_BANKS[purpose];
  for (const question of density === 'sparse' ? bank.slice(0, 2) : bank) {
    const options = question.options;
    if (!options.length) continue;
    const option = pick === 'first' ? options[0]! : pick === 'last' ? options[options.length - 1]! : options[Math.floor(options.length / 2)]!;
    answers[question.id] = option.value;
  }
  return answers;
}

export const ARCHETYPES: { label: string; purpose: PurposeId; answers: Answers; origin: typeof RIYADH | null }[] = [];
for (const purpose of PURPOSE_IDS) {
  for (const pick of ['first', 'middle', 'last'] as const) {
    for (const density of ['sparse', 'dense'] as const) {
      for (const origin of [null, RIYADH]) {
        ARCHETYPES.push({ label: `${purpose}/${pick}/${density}/${origin ? 'located' : 'no-location'}`, purpose, answers: answersFor(purpose, pick, density), origin });
      }
    }
  }
  const withBorder = { ...answersFor(purpose, 'middle', 'dense'), [landBorderQuestionId(purpose)]: 1 };
  ARCHETYPES.push({ label: `${purpose}/land-border/located`, purpose, answers: withBorder, origin: RIYADH });
  ARCHETYPES.push({ label: `${purpose}/land-border/no-location`, purpose, answers: withBorder, origin: null });
}

export function digestOf(purpose: PurposeId, answers: Answers, origin: typeof RIYADH | null) {
  const prefs = normalizePreferences(purpose, answers);
  const matches = WORLD_CATALOG.map((dest) => {
    const { methodologyVersion: _version, ...rest } = computePersonalMatch(dest, prefs, { origin });
    return [dest.id, rest];
  });
  const refined = refineRanking(rankDestinations(purpose, answers, origin), prefs, { origin }).map((item) => [item.result.dest.id, item.result.score, item.personal.score]);
  const scores = matches.map(([, match]) => (match as { score: number | null }).score).filter((score): score is number => score !== null);
  return {
    digest: createHash('sha256').update(JSON.stringify({ matches, refined })).digest('hex'),
    countries: matches.length,
    scored: scores.length,
    scoreSum: scores.reduce((sum, score) => sum + score, 0),
  };
}

describe('personal-match-1.1 reproduces personal-match-1.0 for every profile without the new answers', () => {
  it('matches the v1.0.0 golden digests', () => {
    const actual = Object.fromEntries(ARCHETYPES.map((a) => [a.label, digestOf(a.purpose, a.answers, a.origin)]));
    if (process.env.WRITE_GOLDEN) {
      fs.mkdirSync(path.dirname(process.env.WRITE_GOLDEN), { recursive: true });
      fs.writeFileSync(process.env.WRITE_GOLDEN, `${JSON.stringify(actual, null, 1)}\n`);
      return;
    }
    const golden = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    expect(Object.keys(golden)).toHaveLength(ARCHETYPES.length);
    expect(actual).toEqual(golden);
  });
});
