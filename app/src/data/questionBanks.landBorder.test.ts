import { describe, expect, it } from 'vitest';
import { effectiveQuestionBank, landBorderQuestionId, QUESTION_BANKS } from './questionBanks';

describe('item #7 — optional land-travel question gating', () => {
  it('is absent from the bank when there is no location context', () => {
    const bank = effectiveQuestionBank('tourism', false);
    expect(bank).toEqual(QUESTION_BANKS.tourism);
    expect(bank.some((q) => q.id === landBorderQuestionId('tourism'))).toBe(false);
  });

  it('is appended only when location context is available, for every purpose', () => {
    for (const purpose of Object.keys(QUESTION_BANKS) as (keyof typeof QUESTION_BANKS)[]) {
      const bank = effectiveQuestionBank(purpose, true);
      const question = bank.find((q) => q.id === landBorderQuestionId(purpose));
      expect(question).toBeDefined();
      expect(question!.kind).toBe('landBorder');
      // Never scored as a weighted preference — it is a hard filter.
      expect(question!.weight).toBe(0);
    }
  });

  it('explicitly disclaims that this means open crossings, valid visas, or a drivable route', () => {
    const question = effectiveQuestionBank('tourism', true).find((q) => q.id === landBorderQuestionId('tourism'))!;
    const yesOption = question.options.find((o) => o.value === 1)!;
    expect(yesOption.desc!.en).toMatch(/does not mean.*open|visa|drivable/i);
    expect(yesOption.desc!.ar).toMatch(/لا يعني/);
  });
});
