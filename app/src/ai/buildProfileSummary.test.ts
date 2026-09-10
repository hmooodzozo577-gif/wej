import { describe, expect, it } from 'vitest';
import { buildProfileSummary } from './buildProfileSummary';
import { QUESTION_BANKS } from '../data/questionBanks';

const questions = QUESTION_BANKS.tourism;

describe('buildProfileSummary', () => {
  it('includes only the answered questions, as "question text: option label" pairs', () => {
    const budgetQ = questions.find((q) => q.id === 'budget')!;
    const summary = buildProfileSummary('en', questions, { budget: budgetQ.options[0].value });
    expect(summary).toBe(`${budgetQ.text.en}: ${budgetQ.options[0].label.en}`);
  });

  it('omits unanswered questions entirely — never a guess', () => {
    const summary = buildProfileSummary('en', questions, {});
    expect(summary).toBe('');
  });

  it('omits an answer whose value is not a real option for that question (defensive, never invents a label)', () => {
    const summary = buildProfileSummary('en', questions, { budget: 'not-a-real-option' });
    expect(summary).toBe('');
  });

  it('never includes a raw coordinate-shaped value', () => {
    const budgetQ = questions.find((q) => q.id === 'budget')!;
    const summary = buildProfileSummary('en', questions, { budget: budgetQ.options[0].value });
    expect(summary).not.toMatch(/\d{1,3}\.\d{4,}/);
  });

  it('is capped at 1000 characters even for a fully-answered large bank', () => {
    const answers: Record<string, string | number> = {};
    for (const q of questions) answers[q.id] = q.options[0].value;
    const summary = buildProfileSummary('en', questions, answers);
    expect(summary.length).toBeLessThanOrEqual(1000);
  });

  it('Arabic and English use the same question ids, only the label text differs', () => {
    const budgetQ = questions.find((q) => q.id === 'budget')!;
    const ar = buildProfileSummary('ar', questions, { budget: budgetQ.options[0].value });
    const en = buildProfileSummary('en', questions, { budget: budgetQ.options[0].value });
    expect(ar).toBe(`${budgetQ.text.ar}: ${budgetQ.options[0].label.ar}`);
    expect(en).not.toBe(ar);
  });
});
