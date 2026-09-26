// v1.1 — the travel-need questions are asked strictly AFTER the Phase 14
// questions, and the Phase 14 part of every path is exactly what v1.0's
// selectNextQuestion() produced on its own.
import { describe, expect, it } from 'vitest';
import { effectiveQuestionBank } from '../data/questionBanks';
import type { PurposeId } from '../data/types';
import type { Answers } from '../engine/types';
import { travelNeedQuestionId, travelNeedQuestions } from '../personalization/travelNeeds';
import { nextQuestion, questionnaireBank } from './questionnaire';
import { selectNextQuestion } from './selectNextQuestion';

const PURPOSES: PurposeId[] = ['tourism', 'work', 'education', 'medical', 'immigration', 'investment', 'wellness', 'other'];

/** v1.0: the Phase 14 questions only, answered with option `pick`. */
function v10Path(purpose: PurposeId, hasLocation: boolean, pick: number): { path: string[]; answers: Answers } {
  const bank = effectiveQuestionBank(purpose, hasLocation);
  const answers: Answers = {};
  const path: string[] = [];
  for (let question = selectNextQuestion(bank, answers, path); question; question = selectNextQuestion(bank, answers, path)) {
    path.push(question.id);
    answers[question.id] = question.options[Math.min(pick, question.options.length - 1)]!.value;
  }
  return { path, answers };
}

function v11Path(purpose: PurposeId, hasLocation: boolean, pick: number, travelAnswer: (id: string) => string | number): string[] {
  const answers: Answers = {};
  const path: string[] = [];
  for (let question = nextQuestion(purpose, hasLocation, answers, path); question; question = nextQuestion(purpose, hasLocation, answers, path)) {
    path.push(question.id);
    answers[question.id] = travelNeedQuestions(purpose).includes(question)
      ? travelAnswer(question.id)
      : question.options[Math.min(pick, question.options.length - 1)]!.value;
    if (path.length > 40) throw new Error('runaway questionnaire');
  }
  return path;
}

describe('questionnaire order (v1.1)', () => {
  it('asks every Phase 14 question exactly as v1.0 did, then the travel needs in order', () => {
    for (const purpose of PURPOSES) {
      for (const hasLocation of [false, true]) {
        for (const pick of [0, 1, 2, 4]) {
          const core = v10Path(purpose, hasLocation, pick).path;
          const needsOn = v11Path(purpose, hasLocation, pick, (id) => (id.endsWith('-languages') ? 'ar,en' : 100));
          expect(needsOn.slice(0, core.length), `${purpose}/${hasLocation}/${pick}`).toEqual(core);
          expect(needsOn.slice(core.length)).toEqual(travelNeedQuestions(purpose).map((q) => q.id));

          // "Not important" to communication skips the language list.
          const needsOff = v11Path(purpose, hasLocation, pick, () => 0);
          expect(needsOff.slice(0, core.length)).toEqual(core);
          expect(needsOff.slice(core.length)).toEqual([
            travelNeedQuestionId(purpose, 'languageImportance'),
            travelNeedQuestionId(purpose, 'islamicPractice'),
            travelNeedQuestionId(purpose, 'halalFood'),
          ]);
        }
      }
    }
  });

  it('opens with the same first question as v1.0', () => {
    for (const purpose of PURPOSES) {
      for (const hasLocation of [false, true]) {
        expect(nextQuestion(purpose, hasLocation, {}, [])?.id).toBe(selectNextQuestion(effectiveQuestionBank(purpose, hasLocation), {}, [])?.id);
      }
    }
  });

  it('lists the Phase 14 bank first, then the travel needs', () => {
    const bank = questionnaireBank('tourism', true);
    const core = effectiveQuestionBank('tourism', true);
    expect(bank.slice(0, core.length)).toEqual(core);
    expect(bank.slice(core.length)).toEqual([...travelNeedQuestions('tourism')]);
  });
});
