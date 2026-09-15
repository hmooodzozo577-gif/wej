import { describe, expect, it } from 'vitest';
import { effectiveQuestionBank, isLocationDependentQuestionId, landBorderQuestionId, QUESTION_BANKS } from './questionBanks';

describe('item #7/#8 — location-dependent question gating', () => {
  it('is absent from the bank when there is no location context', () => {
    const bank = effectiveQuestionBank('tourism', false);
    expect(bank.some((q) => q.id === landBorderQuestionId('tourism'))).toBe(false);
  });

  // Item #8: the user was able to answer "does it matter that the
  // destination is close to your current location?" with no location
  // permission granted, and that "yes" then did nothing at all. Proximity
  // is now gated exactly like the land-travel question.
  it('omits EVERY location-dependent question — not just land-travel — without location, for every purpose', () => {
    for (const purpose of Object.keys(QUESTION_BANKS) as (keyof typeof QUESTION_BANKS)[]) {
      const bank = effectiveQuestionBank(purpose, false);
      expect(bank.some((q) => q.kind === 'proximity')).toBe(false);
      expect(bank.some((q) => q.kind === 'landBorder')).toBe(false);
      // Everything else survives untouched, in its original order.
      expect(bank).toEqual(QUESTION_BANKS[purpose].filter((q) => q.kind !== 'proximity'));
    }
  });

  it('asks proximity again as soon as location context exists', () => {
    for (const purpose of Object.keys(QUESTION_BANKS) as (keyof typeof QUESTION_BANKS)[]) {
      const bank = effectiveQuestionBank(purpose, true);
      expect(bank.filter((q) => q.kind === 'proximity')).toHaveLength(1);
      expect(bank[0]!.kind).toBe('proximity');
    }
  });

  it('recognises location-dependent ids across every purpose namespace', () => {
    for (const purpose of Object.keys(QUESTION_BANKS) as (keyof typeof QUESTION_BANKS)[]) {
      expect(isLocationDependentQuestionId(`${purpose}-proximity`)).toBe(true);
      expect(isLocationDependentQuestionId(landBorderQuestionId(purpose))).toBe(true);
      expect(isLocationDependentQuestionId(`${purpose}-climate`)).toBe(false);
      expect(isLocationDependentQuestionId(`${purpose}-cost`)).toBe(false);
    }
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
