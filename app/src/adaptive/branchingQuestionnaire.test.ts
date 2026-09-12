import { describe, expect, it } from 'vitest';
import { QUESTION_BANKS } from '../data/questionBanks';
import { selectNextQuestion } from './selectNextQuestion';

describe('answer-driven branching', () => {
  it('takes a distinct immediate path for every answer to the first question', () => {
    const bank = QUESTION_BANKS.tourism;
    const first = selectNextQuestion(bank, {}, []);
    expect(first?.id).toBe('budget');

    const nextIds = first!.options.map((option) =>
      selectNextQuestion(bank, { budget: option.value }, ['budget'])?.id,
    );

    expect(nextIds.every(Boolean)).toBe(true);
    expect(new Set(nextIds).size).toBe(first!.options.length);
  });
});
