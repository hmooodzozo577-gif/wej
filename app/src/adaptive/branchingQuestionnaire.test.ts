import { describe, expect, it } from 'vitest';
import { QUESTION_BANKS } from '../data/questionBanks';
import { selectNextQuestion } from './selectNextQuestion';

describe('answer-driven branching', () => {
  it('takes a distinct immediate path for every answer to the first question', () => {
    const bank = QUESTION_BANKS.tourism;
    const first = selectNextQuestion(bank, {}, []);
    expect(first?.id).toBe('tourism-proximity');

    const nextIds = first!.options.map((option) =>
      selectNextQuestion(bank, { [first!.id]: option.value }, [first!.id])?.id,
    );

    expect(nextIds.every(Boolean)).toBe(true);
    expect(new Set(nextIds).size).toBe(first!.options.length);
  });

  it('never asks the traveler to choose a region, subregion, or compass direction', () => {
    const disallowedDimensions = new Set(['region', 'subregion', 'latitudeZone', 'longitudeZone']);
    for (const bank of Object.values(QUESTION_BANKS)) {
      for (const question of bank) {
        expect(disallowedDimensions.has(String(question.profileKey)), question.id).toBe(false);
        expect(`${question.text.ar} ${question.text.en}`, question.id).not.toMatch(/أي منطقة|أي نطاق|اتجاه جغرافي|أقصى الشمال|أقصى الجنوب|which region|which area|geographic direction|far north|far south/i);
      }
    }
  });
});
