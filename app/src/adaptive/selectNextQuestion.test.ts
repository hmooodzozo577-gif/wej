import { describe, expect, it } from 'vitest';
import { QUESTION_BANKS } from '../data/questionBanks';
import { selectNextQuestion } from './selectNextQuestion';
import type { PurposeId } from '../data/types';

describe('deterministic branching question selection', () => {
  it('starts every purpose at its region node', () => {
    for (const purpose of Object.keys(QUESTION_BANKS) as PurposeId[]) {
      expect(selectNextQuestion(QUESTION_BANKS[purpose], {}, [])?.id).toBe(`${purpose}-region`);
    }
  });

  it('follows every explicit option edge and never sends sibling options to the same node', () => {
    for (const purpose of Object.keys(QUESTION_BANKS) as PurposeId[]) {
      const bank = QUESTION_BANKS[purpose];
      for (const question of bank.filter((item) => item.nextByValue)) {
        const nextIds = question.options.map((option) =>
          selectNextQuestion(bank, { [question.id]: option.value }, [question.id])?.id,
        );
        expect(nextIds, `${purpose}/${question.id}`).toEqual(question.options.map((option) => question.nextByValue![String(option.value)]));
        expect(new Set(nextIds).size, `${purpose}/${question.id}`).toBe(nextIds.length);
      }
    }
  });

  it('a complete path terminates without duplicate questions or dimensions', () => {
    for (const purpose of Object.keys(QUESTION_BANKS) as PurposeId[]) {
      const bank = QUESTION_BANKS[purpose];
      const path: string[] = [];
      const answers: Record<string, string | number> = {};
      let next = selectNextQuestion(bank, answers, path);
      while (next) {
        path.push(next.id);
        answers[next.id] = next.options[0]!.value;
        next = selectNextQuestion(bank, answers, path);
      }
      expect(new Set(path).size).toBe(path.length);
      const dimensions = path.map((id) => bank.find((question) => question.id === id)!.profileKey).filter(Boolean);
      expect(new Set(dimensions).size).toBe(dimensions.length);
      expect(path.length).toBeGreaterThanOrEqual(10);
      expect(path.length).toBeLessThan(bank.length);
    }
  });
});
