import { describe, expect, it } from 'vitest';
import { QUESTION_BANKS } from '../data/questionBanks';
import { selectNextQuestion } from './selectNextQuestion';

describe('answer-driven branching', () => {
  it('takes a distinct immediate path for every answer to the first question', () => {
    const bank = QUESTION_BANKS.tourism;
    const first = selectNextQuestion(bank, {}, []);
    expect(first?.id).toBe('tourism-region');

    const nextIds = first!.options.map((option) =>
      selectNextQuestion(bank, { [first!.id]: option.value }, [first!.id])?.id,
    );

    expect(nextIds.every(Boolean)).toBe(true);
    expect(new Set(nextIds).size).toBe(first!.options.length);
  });
});
