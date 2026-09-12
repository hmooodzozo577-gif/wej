import { describe, expect, it } from 'vitest';
import {
  CONTEXTUAL_QUESTION_LIBRARY_SIZE,
  MAX_CONTEXTUAL_SCENARIOS_PER_TURN,
  materializeTrustedScenario,
  recoverTrustedScenarioId,
  selectContextualQuestionScenarios,
} from './contextualQuestionLibrary';
import { validateNextTurnResult } from './validate';
import type { NextTurnRequest } from './types';

const coldNatureRequest: NextTurnRequest = {
  lang: 'ar',
  purposeId: 'tourism',
  purposeName: 'السياحة والإجازة',
  turnNumber: 1,
  confirmedProfile: { climate: 'cold', naturecity: 15 },
  unresolvedPreferences: ['هادئة'],
  catalog: [
    { id: 'budget', kind: 'target', question: 'الميزانية', rankingWeight: 12, rankingSupported: true, resolved: false, alreadyAsked: false, options: [{ value: 1, label: 'منخفضة' }, { value: 4, label: 'فاخرة' }] },
    { id: 'climate', kind: 'climate', question: 'الطقس', rankingWeight: 8, rankingSupported: true, resolved: true, alreadyAsked: true, options: [{ value: 'cold', label: 'بارد' }] },
    { id: 'naturecity', kind: 'target', question: 'المكان', rankingWeight: 10, rankingSupported: true, resolved: true, alreadyAsked: true, options: [{ value: 15, label: 'الطبيعة' }] },
    { id: 'beaches', kind: 'target', question: 'الوجهة', rankingWeight: 10, rankingSupported: true, resolved: false, alreadyAsked: false, options: [{ value: 10, label: 'جبال' }, { value: 90, label: 'شواطئ' }] },
    { id: 'adventure', kind: 'target', question: 'الوقت', rankingWeight: 8, rankingSupported: true, resolved: false, alreadyAsked: false, options: [{ value: 10, label: 'استرخاء' }, { value: 90, label: 'مغامرة' }] },
    { id: 'nightlife', kind: 'importance', question: 'المساء', rankingWeight: 7, rankingSupported: true, resolved: false, alreadyAsked: false, options: [{ value: 10, label: 'هادئ' }, { value: 100, label: 'حيوي' }] },
    { id: 'safety', kind: 'importance', question: 'الأمان', rankingWeight: 10, rankingSupported: true, resolved: false, alreadyAsked: false, options: [{ value: 30, label: 'مرن' }, { value: 100, label: 'أولوية' }] },
    { id: 'culture', kind: 'importance', question: 'الثقافة', rankingWeight: 10, rankingSupported: true, resolved: false, alreadyAsked: false, options: [{ value: 20, label: 'قليل' }, { value: 100, label: 'أساسي' }] },
  ],
};

describe('contextual question library', () => {
  it('contains a reviewable 80–150 scenario library while sending only a bounded shortlist per turn', () => {
    expect(CONTEXTUAL_QUESTION_LIBRARY_SIZE).toBeGreaterThanOrEqual(80);
    expect(CONTEXTUAL_QUESTION_LIBRARY_SIZE).toBeLessThanOrEqual(150);
    expect(selectContextualQuestionScenarios(coldNatureRequest).length).toBeLessThanOrEqual(MAX_CONTEXTUAL_SCENARIOS_PER_TURN);
  });

  it('provides a valid contextual shortlist for every supported trip purpose', () => {
    const purposeDimensions: Array<{
      purposeId: NextTurnRequest['purposeId'];
      dimensions: string[];
    }> = [
      { purposeId: 'tourism', dimensions: ['budget', 'climate', 'naturecity', 'beaches', 'adventure', 'nightlife', 'safety', 'culture'] },
      { purposeId: 'work', dimensions: ['field', 'salary', 'colTolerance', 'language', 'jobmarket', 'wlb', 'safety', 'growth'] },
      { purposeId: 'education', dimensions: ['field', 'tuition', 'uniRank', 'language', 'safety', 'col'] },
      { purposeId: 'medical', dimensions: ['category', 'quality', 'budget', 'waiting', 'language', 'safety'] },
      { purposeId: 'immigration', dimensions: ['budget', 'jobs', 'salary', 'safety', 'qol', 'friendly', 'lang', 'family'] },
      { purposeId: 'investment', dimensions: ['sector', 'budget', 'bizease', 'growth', 'stability', 'safety'] },
      { purposeId: 'wellness', dimensions: ['budget', 'climate', 'nature', 'beachesw', 'spa', 'quiet', 'safety'] },
      { purposeId: 'other', dimensions: ['budget', 'safety', 'climate', 'naturecity', 'qol'] },
    ];

    for (const fixture of purposeDimensions) {
      const request: NextTurnRequest = {
        lang: 'en',
        purposeId: fixture.purposeId,
        purposeName: fixture.purposeId,
        turnNumber: 1,
        confirmedProfile: {},
        catalog: fixture.dimensions.map((id, index) => ({
          id,
          kind: 'target',
          question: `Bank question ${id}`,
          rankingWeight: fixture.dimensions.length - index,
          rankingSupported: true,
          resolved: false,
          alreadyAsked: false,
          options: [{ value: 10, label: 'First' }, { value: 90, label: 'Second' }],
        })),
      };
      const scenarios = selectContextualQuestionScenarios(request);

      expect(scenarios.length, fixture.purposeId).toBeGreaterThan(0);
      expect(scenarios.length, fixture.purposeId).toBeLessThanOrEqual(MAX_CONTEXTUAL_SCENARIOS_PER_TURN);
      expect(
        scenarios.every((scenario) =>
          scenario.targetDimensions.every((id) => fixture.dimensions.includes(id)),
        ),
        fixture.purposeId,
      ).toBe(true);
    }
  });

  it('uses confirmed cold+nature preferences as anchors and prioritizes a new multi-dimension trip-rhythm choice', () => {
    const scenarios = selectContextualQuestionScenarios(coldNatureRequest);
    expect(scenarios[0]).toMatchObject({
      targetDimensions: ['adventure', 'nightlife'],
      contextAnchors: ['climate=بارد', 'naturecity=الطبيعة'],
    });
    expect(scenarios[0]?.guidance).toMatch(/daytime pace and evening atmosphere/i);
    expect(scenarios.every((scenario) => !scenario.targetDimensions.includes('climate') && !scenario.targetDimensions.includes('naturecity'))).toBe(true);
    expect(scenarios.every((scenario) => !scenario.targetDimensions.includes('budget'))).toBe(true);
  });

  it('changes the shortlist after a dimension is answered instead of asking the same semantic question again', () => {
    const answered: NextTurnRequest = {
      ...coldNatureRequest,
      turnNumber: 2,
      confirmedProfile: { ...coldNatureRequest.confirmedProfile, adventure: 10 },
      catalog: coldNatureRequest.catalog.map((dimension) =>
        dimension.id === 'adventure' ? { ...dimension, resolved: true, alreadyAsked: true } : dimension,
      ),
    };
    const next = selectContextualQuestionScenarios(answered);
    expect(next.every((scenario) => !scenario.targetDimensions.includes('adventure'))).toBe(true);
    expect(next.some((scenario) => scenario.contextAnchors.includes('adventure=استرخاء'))).toBe(true);
  });

  it('materializes a fully validated contextual choice when generation fails after a trusted scenario selection', () => {
    const scenario = selectContextualQuestionScenarios(coldNatureRequest).find((candidate) => candidate.id.startsWith('tourism-landscape-activity--'));
    expect(scenario).toBeDefined();
    const raw = { status: 'ask', scenarioId: scenario?.id, options: [] };
    const recoveredId = recoverTrustedScenarioId(raw, coldNatureRequest);
    const repaired = recoveredId ? materializeTrustedScenario(coldNatureRequest, recoveredId) : null;

    expect(recoveredId).toBe(scenario?.id);
    expect(repaired).toMatchObject({
      status: 'ask',
      scenarioId: scenario?.id,
      targetDimensions: ['beaches', 'adventure'],
      questionType: 'choice',
    });
    expect(repaired?.status === 'ask' ? repaired.prompt : '').toMatch(/بارد/u);
    expect(repaired?.status === 'ask' ? repaired.prompt : '').toMatch(/الطبيعة/u);
    expect(JSON.stringify(repaired)).not.toMatch(/كلاهما|مزيج من الاثنين/u);
    expect(validateNextTurnResult(repaired, coldNatureRequest).status).toBe('ask');
  });

  it('never recovers an untrusted model-authored scenario id', () => {
    expect(recoverTrustedScenarioId({ scenarioId: 'invented' }, coldNatureRequest)).toBeNull();
    expect(materializeTrustedScenario(coldNatureRequest, 'invented')).toBeNull();
  });
});
