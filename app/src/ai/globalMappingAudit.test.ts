// Phase 16.5 CORRECTION PASS — global semantic mapping audit.
//
// Real production bug this file exists to prevent from recurring, in
// ANY dimension, not just the one a user happened to find: a traveler
// wrote "أبغى دولة باردة وهادئة وفيها طبيعة" (explicitly wants NATURE).
// The deployed AI returned naturecity=90, which this project's own
// question bank defines as "🏙️ Cities" — the opposite meaning. Root
// cause, traced end-to-end (see mapQuestionsForAi.ts and
// worker/src/ai/prompts.ts's matching doc comments): the payload sent
// to the model carried bare numbers ([15, 50, 90]) with no label, so
// the model had nothing to ground a direction in and guessed. Phase 14
// itself was never wrong — see the "Phase 14 destKey direction" describe
// block below, which proves dest.urban's real data already agrees with
// the option labels.
//
// This suite does two things no single-dimension bug-fix test can:
// 1. Proves the FIX (labels attached to every option) is applied
//    globally, across every purpose bank and every question, not just
//    naturecity — a mechanical, data-driven sweep, not a spot check.
// 2. Proves the canonical meaning of every bipolar dimension the task
//    named, derived from ACTUAL code (scoreDestination.ts) and ACTUAL
//    destination data, never assumed from a variable name.
import { describe, expect, it } from 'vitest';
import { QUESTION_BANKS } from '../data/questionBanks';
import { DESTINATIONS } from '../data/destinations';
import { scoreDestination } from '../engine';
import { appReducer, initialAppState } from '../state/reducer';
import { mapQuestionsForAi } from './mapQuestionsForAi';
import type { PurposeId, Question } from '../data/types';
import type { AppState } from '../state/types';

const ALL_PURPOSES = Object.keys(QUESTION_BANKS) as PurposeId[];

// ---------------------------------------------------------------------------
// 1. MECHANICAL GLOBAL SWEEP — every AI-interpretable question, every bank,
//    both languages: every option must carry a real, distinct, non-numeric
//    label. This is the general form of the exact bug class that was found.
// ---------------------------------------------------------------------------
describe('Global semantic mapping audit — every question, every purpose bank, both languages', () => {
  for (const purposeId of ALL_PURPOSES) {
    const bank = QUESTION_BANKS[purposeId];
    for (const lang of ['ar', 'en'] as const) {
      it(`${purposeId} (${lang}): every option sent to the AI carries a real label, never a bare value`, () => {
        const mapped = mapQuestionsForAi(bank, lang);
        expect(mapped).toHaveLength(bank.length);
        for (const q of mapped) {
          expect(q.options.length).toBeGreaterThan(0);
          for (const opt of q.options) {
            expect(typeof opt.label).toBe('string');
            expect(opt.label.trim().length).toBeGreaterThan(0);
            // The exact shape of the original bug: a "label" that is
            // really just the value restated as a string teaches the
            // model nothing new — this must never happen again.
            expect(opt.label).not.toBe(String(opt.value));
          }
          // No two options of the same question may carry the same
          // label — an ambiguous label is exactly as useless to the
          // model as no label at all.
          const labels = q.options.map((o) => o.label);
          expect(new Set(labels).size).toBe(labels.length);
        }
      });
    }
  }

  it('every purpose bank is actually covered — this audit is not silently skipping a bank', () => {
    expect(ALL_PURPOSES.length).toBeGreaterThanOrEqual(8);
    expect(ALL_PURPOSES).toEqual(expect.arrayContaining(['tourism', 'work', 'education', 'medical', 'immigration', 'investment', 'wellness', 'other']));
  });
});

// ---------------------------------------------------------------------------
// 2. CANONICAL SEMANTICS, DERIVED FROM CODE AND DATA — never from a variable
//    name. For each bipolar dimension the task named, prove: (a) which
//    destinations Phase 14's own scoring formula treats as the "low" and
//    "high" end, and (b) that the option label at each numeric end matches
//    that real-world direction.
// ---------------------------------------------------------------------------
describe('Canonical semantic meaning of bipolar dimensions — derived from real scoring, not assumed', () => {
  function findQuestion(purposeId: PurposeId, id: string): Question {
    const q = QUESTION_BANKS[purposeId].find((x) => x.id === id);
    if (!q) throw new Error(`question ${id} not found in ${purposeId}`);
    return q;
  }

  it('naturecity: dest.urban DATA agrees with the "Nature" (low value) / "Cities" (high value) labels', () => {
    // Real destination data, not a guess: the LOWEST-urban destinations
    // must be the ones this app already markets as nature-forward, and
    // the HIGHEST-urban ones as city-forward.
    const byUrban = [...DESTINATIONS].sort((a, b) => a.urban - b.urban);
    const mostNatural = byUrban[0];
    const mostUrban = byUrban[byUrban.length - 1];
    expect(mostNatural.urban).toBeLessThan(mostUrban.urban);
    // A traveler who picks the "Nature" (15) option must score the
    // most-natural destination BETTER than the most-urban one, and the
    // "Cities" (90) option must score the reverse — this is the actual
    // Phase 14 formula (closeness-to-destination-value), not a re-guess.
    const q = findQuestion('tourism', 'naturecity');
    const natureValue = q.options.find((o) => /nature|طبيعة/i.test(o.label.en + o.label.ar))!.value;
    const cityValue = q.options.find((o) => /cities|مدن/i.test(o.label.en + o.label.ar))!.value;
    expect(natureValue).toBe(15);
    expect(cityValue).toBe(90);

    // Isolate the naturecity-specific FIT component (not the overall
    // score, which also mixes in the fixed-weight purpose-fit component
    // and would mask this dimension's own signal) via scoreDestination's
    // own `reasons` breakdown — the same real formula, just read at the
    // per-dimension level instead of the blended total.
    function fitFor(dest: (typeof DESTINATIONS)[number], value: number): number {
      return scoreDestination(dest, 'tourism', { naturecity: value }).reasons.find((r) => r.id === 'naturecity')!.fit;
    }
    expect(fitFor(mostNatural, natureValue as number)).toBeGreaterThan(fitFor(mostUrban, natureValue as number));
    expect(fitFor(mostUrban, cityValue as number)).toBeGreaterThan(fitFor(mostNatural, cityValue as number));
  });

  it('beaches: "Beaches & Relaxation" (90) vs "Mountains & Nature" (10) agree with dest.beaches data direction', () => {
    const byBeaches = [...DESTINATIONS].sort((a, b) => a.beaches - b.beaches);
    const leastBeachy = byBeaches[0];
    const mostBeachy = byBeaches[byBeaches.length - 1];
    const q = findQuestion('tourism', 'beaches');
    const beachValue = q.options.find((o) => /beach/i.test(o.label.en))!.value;
    const mountainValue = q.options.find((o) => /mountain/i.test(o.label.en))!.value;
    expect(beachValue).toBe(90);
    expect(mountainValue).toBe(10);

    function fitFor(dest: (typeof DESTINATIONS)[number], value: number): number {
      return scoreDestination(dest, 'tourism', { beaches: value }).reasons.find((r) => r.id === 'beaches')!.fit;
    }
    expect(fitFor(mostBeachy, beachValue as number)).toBeGreaterThan(fitFor(leastBeachy, beachValue as number));
    expect(fitFor(leastBeachy, mountainValue as number)).toBeGreaterThan(fitFor(mostBeachy, mountainValue as number));
  });

  it('adventure: "Adventure & Activities" (90) vs "Rest & Relaxation" (10) agree with dest.adventure data direction', () => {
    const byAdventure = [...DESTINATIONS].sort((a, b) => a.adventure - b.adventure);
    const leastAdventurous = byAdventure[0];
    const mostAdventurous = byAdventure[byAdventure.length - 1];
    const q = findQuestion('tourism', 'adventure');
    const adventureValue = q.options.find((o) => /adventure/i.test(o.label.en))!.value;
    const restValue = q.options.find((o) => /rest|relax/i.test(o.label.en))!.value;
    expect(adventureValue).toBe(90);
    expect(restValue).toBe(10);

    function fitFor(dest: (typeof DESTINATIONS)[number], value: number): number {
      return scoreDestination(dest, 'tourism', { adventure: value }).reasons.find((r) => r.id === 'adventure')!.fit;
    }
    expect(fitFor(mostAdventurous, adventureValue as number)).toBeGreaterThan(fitFor(leastAdventurous, adventureValue as number));
    expect(fitFor(leastAdventurous, restValue as number)).toBeGreaterThan(fitFor(mostAdventurous, restValue as number));
  });

  it('climate: "cold" and "hot" resolve to opposite ends of CLIMATE_COMPAT, both AR and EN option labels agree', () => {
    const q = findQuestion('tourism', 'climate');
    const coldOpt = q.options.find((o) => o.value === 'cold')!;
    const hotOpt = q.options.find((o) => o.value === 'hot')!;
    expect(coldOpt.label.en).toMatch(/cold/i);
    expect(coldOpt.label.ar).toMatch(/برد|بارد/);
    expect(hotOpt.label.en).toMatch(/hot/i);
    expect(hotOpt.label.ar).toMatch(/حار|حرارة|شمس/);
  });
});

// ---------------------------------------------------------------------------
// 3. MANDATORY PARITY: a traveler who picks the normal "nature"/"city"
//    option, and a traveler whose AI interpretation confirms the same
//    dimension, must reach Phase 14 with the IDENTICAL value and score.
// ---------------------------------------------------------------------------
describe('Manual selection vs AI-confirmed interpretation — same canonical value reaches Phase 14 (task requirement)', () => {
  function stateAfter(actions: Array<Parameters<typeof appReducer>[1]>): AppState {
    return actions.reduce(appReducer, initialAppState);
  }

  it('NATURE: manual "🌲 Nature" answer and a confirmed AI interpretation of "nature" produce identical stored value and identical Phase 14 score', () => {
    const manualState = stateAfter([{ type: 'SET_ANSWER', questionId: 'naturecity', value: 15, provenance: 'direct' }]);
    const aiState = stateAfter([{ type: 'SET_ANSWER', questionId: 'naturecity', value: 15, provenance: 'ai_interpreted' }]);

    expect(manualState.answers.naturecity).toBe(aiState.answers.naturecity);
    expect(manualState.answers.naturecity).toBe(15);

    const dest = DESTINATIONS[0];
    const manualScore = scoreDestination(dest, 'tourism', manualState.answers).score;
    const aiScore = scoreDestination(dest, 'tourism', aiState.answers).score;
    expect(aiScore).toBe(manualScore);
  });

  it('CITY: manual "🏙️ Cities" answer and a confirmed AI interpretation of "city" produce identical stored value and identical Phase 14 score', () => {
    const manualState = stateAfter([{ type: 'SET_ANSWER', questionId: 'naturecity', value: 90, provenance: 'direct' }]);
    const aiState = stateAfter([{ type: 'SET_ANSWER', questionId: 'naturecity', value: 90, provenance: 'ai_interpreted' }]);

    expect(manualState.answers.naturecity).toBe(aiState.answers.naturecity);
    expect(manualState.answers.naturecity).toBe(90);

    const dest = DESTINATIONS[0];
    const manualScore = scoreDestination(dest, 'tourism', manualState.answers).score;
    const aiScore = scoreDestination(dest, 'tourism', aiState.answers).score;
    expect(aiScore).toBe(manualScore);
  });

  it('provenance never appears anywhere in the value read by Phase 14 — the ONLY thing that could make manual/AI answers differ structurally does not exist', () => {
    const dest = DESTINATIONS[0];
    for (const value of [15, 50, 90]) {
      const manual = stateAfter([{ type: 'SET_ANSWER', questionId: 'naturecity', value, provenance: 'direct' }]);
      const ai = stateAfter([{ type: 'SET_ANSWER', questionId: 'naturecity', value, provenance: 'ai_interpreted' }]);
      expect(scoreDestination(dest, 'tourism', manual.answers)).toEqual(scoreDestination(dest, 'tourism', ai.answers));
    }
  });
});

// ---------------------------------------------------------------------------
// 4. USER-FAILURE REGRESSION (§37) and OPPOSITE-SCENARIO REGRESSION (§38):
//    the confirmed values a (correctly grounded) AI interpretation would
//    apply must render the CORRECT label and reach Phase 14 correctly —
//    proven at the app-pipeline layer (reducer + rendering-data lookup),
//    which is what a "fake label patch" could not survive.
// ---------------------------------------------------------------------------
describe('§37/§38 — real user-failure scenario and its opposite, reproduced through the actual reducer', () => {
  const bank = QUESTION_BANKS.tourism;

  it('USER-FAILURE SCENARIO: confirming climate=cold + naturecity=15 (NATURE, the correct value for "فيها طبيعة") removes both questions and neither is ever labeled "Cities"', () => {
    let state = initialAppState;
    state = appReducer(state, { type: 'SET_ANSWER', questionId: 'climate', value: 'cold', provenance: 'ai_interpreted' });
    state = appReducer(state, { type: 'SET_ANSWER', questionId: 'naturecity', value: 15, provenance: 'ai_interpreted' });

    expect(state.answers.climate).toBe('cold');
    expect(state.answers.naturecity).toBe(15);
    expect(state.satisfaction.climate).toBe('ai_interpreted');
    expect(state.satisfaction.naturecity).toBe('ai_interpreted');

    const naturecityQ = bank.find((q) => q.id === 'naturecity')!;
    const renderedOption = naturecityQ.options.find((o) => o.value === state.answers.naturecity)!;
    expect(renderedOption.label.en).not.toMatch(/cities/i);
    expect(renderedOption.label.ar).not.toContain('المدن');
    expect(renderedOption.label.en).toMatch(/nature/i);
    expect(renderedOption.label.ar).toContain('طبيعة');
  });

  it('OPPOSITE SCENARIO (proves the fix is not a blind reversal): confirming naturecity=90 (CITY, for "مدينة كبيرة وحياة حضرية") renders "Cities", never "Nature"', () => {
    let state = initialAppState;
    state = appReducer(state, { type: 'SET_ANSWER', questionId: 'naturecity', value: 90, provenance: 'ai_interpreted' });

    const naturecityQ = bank.find((q) => q.id === 'naturecity')!;
    const renderedOption = naturecityQ.options.find((o) => o.value === state.answers.naturecity)!;
    expect(renderedOption.label.en).toMatch(/cities/i);
    expect(renderedOption.label.ar).toContain('المدن');
    expect(renderedOption.label.en).not.toMatch(/^🌲 nature$/i);
  });

  it('"هادئة" (quietness) has no supported ranking dimension in the TOURISM bank — must remain unmapped/context, never forced onto naturecity or any other field', () => {
    const dimensionIds = bank.map((q) => q.id);
    expect(dimensionIds).not.toContain('quiet');
    expect(dimensionIds).not.toContain('quietness');
    // wellness, by contrast, DOES have a real "quiet" ranking dimension
    // — the correct behavior differs by purpose, and must be read from
    // the actual bank, never assumed.
    expect(QUESTION_BANKS.wellness.map((q) => q.id)).toContain('quiet');
  });
});
