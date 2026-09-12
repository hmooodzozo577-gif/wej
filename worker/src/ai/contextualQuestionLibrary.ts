import type { DimensionCatalogEntry, NextTurnRequest, NextTurnResult } from './types';

type PurposeId = NextTurnRequest['purposeId'];

interface ScenarioBlueprint {
  id: string;
  purposeId: PurposeId;
  dimensions: string[];
  focus: string;
}

interface ScenarioLens {
  id: string;
  instruction: string;
}

export interface ContextualQuestionScenario {
  id: string;
  targetDimensions: string[];
  contextAnchors: string[];
  guidance: string;
}

const LENSES: ScenarioLens[] = [
  {
    id: 'lived-moment',
    instruction: 'Frame the choice as a concrete moment or day in the traveler’s real experience; make every option describe a visibly different way the trip or move would feel.',
  },
  {
    id: 'honest-tradeoff',
    instruction: 'Frame the choice as an honest trade-off between attractive alternatives; avoid rating scales and make every option a complete, natural scenario.',
  },
  {
    id: 'decision-style',
    instruction: 'Frame the choice around a realistic decision the traveler could picture making; use behavior and priorities rather than synonyms for the canonical labels.',
  },
];

// 37 purpose-specific blueprints × 3 interviewing lenses = 111 trusted
// contextual scenarios. This is intentionally a moderate library: broad enough
// to avoid walking the old question bank, small enough to remain reviewable.
// It contains no scores or new answer values. Phase 14's catalog remains the
// sole authority for canonical dimensions, values, and weights.
const BLUEPRINTS: ScenarioBlueprint[] = [
  { id: 'tourism-trip-rhythm', purposeId: 'tourism', dimensions: ['climate', 'naturecity', 'adventure', 'nightlife'], focus: 'Connect the preferred setting to the traveler’s daytime pace and evening atmosphere.' },
  { id: 'tourism-landscape-activity', purposeId: 'tourism', dimensions: ['naturecity', 'beaches', 'adventure'], focus: 'Distinguish landscape and activity combinations the traveler would actually choose for most days.' },
  { id: 'tourism-culture-evenings', purposeId: 'tourism', dimensions: ['culture', 'nightlife', 'naturecity'], focus: 'Explore whether memorable evenings mean heritage, urban energy, or a quieter setting.' },
  { id: 'tourism-comfort-boundary', purposeId: 'tourism', dimensions: ['safety', 'adventure', 'nightlife'], focus: 'Clarify the traveler’s preferred balance between reassurance, spontaneity, and activity.' },
  { id: 'tourism-weather-setting', purposeId: 'tourism', dimensions: ['climate', 'beaches', 'naturecity'], focus: 'Turn weather preference into a concrete destination setting rather than asking about weather again.' },
  { id: 'tourism-budget-band', purposeId: 'tourism', dimensions: ['budget'], focus: 'Ask for the approximate trip budget band; the frontend owns and renders the canonical numeric SAR ranges.' },

  { id: 'work-career-direction', purposeId: 'work', dimensions: ['field', 'salary', 'growth', 'jobmarket'], focus: 'Clarify which career outcome matters most in the traveler’s professional field.' },
  { id: 'work-pay-life-tradeoff', purposeId: 'work', dimensions: ['salary', 'colTolerance', 'wlb'], focus: 'Contrast take-home ambition, living-cost tolerance, and time outside work.' },
  { id: 'work-market-language', purposeId: 'work', dimensions: ['language', 'jobmarket', 'growth'], focus: 'Explore whether access, opportunity volume, or long-term progression drives the move.' },
  { id: 'work-daily-stability', purposeId: 'work', dimensions: ['safety', 'wlb', 'colTolerance'], focus: 'Describe different everyday working-life environments and their practical trade-offs.' },
  { id: 'work-field-environment', purposeId: 'work', dimensions: ['field', 'language', 'growth'], focus: 'Connect the professional field to the kind of workplace and progression path desired.' },

  { id: 'education-program-path', purposeId: 'education', dimensions: ['field', 'uniRank', 'language'], focus: 'Contrast program fit, institutional prestige, and language of study through realistic study paths.' },
  { id: 'education-total-affordability', purposeId: 'education', dimensions: ['tuition', 'col'], focus: 'Clarify affordability through the balance between tuition and everyday living costs.' },
  { id: 'education-campus-life', purposeId: 'education', dimensions: ['safety', 'col', 'language'], focus: 'Describe different campus and city experiences rather than separate importance scales.' },
  { id: 'education-field-investment', purposeId: 'education', dimensions: ['field', 'tuition', 'uniRank'], focus: 'Connect the intended field to what the student is willing to invest for program reputation.' },

  { id: 'medical-care-path', purposeId: 'medical', dimensions: ['category', 'quality', 'waiting'], focus: 'Clarify the treatment path by balancing specialty, quality expectations, and urgency.' },
  { id: 'medical-budget-band', purposeId: 'medical', dimensions: ['budget'], focus: 'Ask for the treatment budget band without inventing provider prices or availability.' },
  { id: 'medical-communication-speed', purposeId: 'medical', dimensions: ['language', 'quality', 'waiting'], focus: 'Contrast rapid access, communication comfort, and the desired standard of care.' },
  { id: 'medical-reassurance', purposeId: 'medical', dimensions: ['safety', 'quality', 'category'], focus: 'Explore what would make the traveler feel reassured throughout the care journey.' },

  { id: 'immigration-family-life', purposeId: 'immigration', dimensions: ['family', 'safety', 'qol'], focus: 'Describe future daily-life scenarios for an individual or family settling long term.' },
  { id: 'immigration-career-entry', purposeId: 'immigration', dimensions: ['jobs', 'salary', 'friendly'], focus: 'Contrast quick labor-market entry, earning ambition, and ease of settling.' },
  { id: 'immigration-language-opportunity', purposeId: 'immigration', dimensions: ['lang', 'jobs', 'qol'], focus: 'Connect language comfort to employment access and everyday quality of life.' },
  { id: 'immigration-budget-band', purposeId: 'immigration', dimensions: ['budget'], focus: 'Ask for the relocation budget band using only the application’s canonical ranges.' },
  { id: 'immigration-settlement-confidence', purposeId: 'immigration', dimensions: ['safety', 'friendly', 'family'], focus: 'Clarify what creates confidence when building a new home and support network.' },

  { id: 'investment-sector-path', purposeId: 'investment', dimensions: ['sector', 'growth', 'bizease'], focus: 'Connect the chosen sector to growth ambition and operational simplicity.' },
  { id: 'investment-risk-environment', purposeId: 'investment', dimensions: ['stability', 'safety', 'growth'], focus: 'Contrast growth appetite with the level of environmental predictability desired.' },
  { id: 'investment-scale', purposeId: 'investment', dimensions: ['budget'], focus: 'Clarify investment scale using the existing non-price canonical bands.' },
  { id: 'investment-market-entry', purposeId: 'investment', dimensions: ['sector', 'stability', 'bizease'], focus: 'Describe distinct market-entry styles for the selected sector.' },

  { id: 'wellness-rest-setting', purposeId: 'wellness', dimensions: ['climate', 'nature', 'quiet'], focus: 'Turn climate and nature preferences into a concrete restorative setting.' },
  { id: 'wellness-water-nature', purposeId: 'wellness', dimensions: ['beachesw', 'nature', 'quiet'], focus: 'Contrast coastal restoration, inland nature, and the desired level of seclusion.' },
  { id: 'wellness-treatment-rhythm', purposeId: 'wellness', dimensions: ['spa', 'quiet', 'safety'], focus: 'Describe different wellness-day rhythms and levels of support.' },
  { id: 'wellness-facility-priority', purposeId: 'wellness', dimensions: ['spa', 'nature', 'climate'], focus: 'Clarify whether facilities, surroundings, or weather should shape the stay most.' },
  { id: 'wellness-budget-band', purposeId: 'wellness', dimensions: ['budget'], focus: 'Ask for the wellness-trip budget band; numeric ranges remain frontend-owned.' },

  { id: 'other-destination-feel', purposeId: 'other', dimensions: ['climate', 'naturecity', 'qol'], focus: 'Describe different destination lifestyles combining setting, climate, and everyday comfort.' },
  { id: 'other-reassurance-setting', purposeId: 'other', dimensions: ['safety', 'qol', 'naturecity'], focus: 'Contrast environmental preference with reassurance and quality-of-life priorities.' },
  { id: 'other-budget-band', purposeId: 'other', dimensions: ['budget'], focus: 'Ask for the approximate budget band using only the application’s canonical ranges.' },
  { id: 'other-climate-comfort', purposeId: 'other', dimensions: ['naturecity', 'climate', 'safety'], focus: 'Turn broad destination preferences into concrete place-and-comfort scenarios.' },
];

export const CONTEXTUAL_QUESTION_LIBRARY_SIZE = BLUEPRINTS.length * LENSES.length;
export const MAX_CONTEXTUAL_SCENARIOS_PER_TURN = 8;

function optionMeaning(dimension: DimensionCatalogEntry, value: string | number): string {
  return dimension.options.find((option) => option.value === value)?.label ?? String(value);
}

/** Selects a compact, profile-aware shortlist from the trusted library. The AI
 * still chooses the next useful scenario; this function only prevents all 111
 * entries from being sent on every turn. Resolved dimensions in a blueprint
 * become context anchors, while at most two unresolved dimensions become
 * targets so 2–4 honest options remain feasible. */
export function selectContextualQuestionScenarios(request: NextTurnRequest): ContextualQuestionScenario[] {
  const catalogById = new Map(request.catalog.map((dimension) => [dimension.id, dimension]));
  const eligible = new Set(request.catalog.filter((dimension) => !dimension.resolved && !dimension.alreadyAsked).map((dimension) => dimension.id));

  const rankedPlans = BLUEPRINTS
    .filter((blueprint) => blueprint.purposeId === request.purposeId)
    .map((blueprint) => {
      const unresolved = blueprint.dimensions
        .filter((id) => eligible.has(id))
        .sort((left, right) => (catalogById.get(right)?.rankingWeight ?? 0) - (catalogById.get(left)?.rankingWeight ?? 0));
      const targetDimensions = unresolved.includes('budget') ? ['budget'] : unresolved.slice(0, 2);
      const contextAnchors = blueprint.dimensions
        .filter((id) => request.confirmedProfile[id] !== undefined)
        .map((id) => {
          const dimension = catalogById.get(id);
          const value = request.confirmedProfile[id] as string | number;
          return dimension ? `${id}=${optionMeaning(dimension, value)}` : `${id}=${String(value)}`;
        });
      const targetWeight = targetDimensions.reduce((sum, id) => sum + (catalogById.get(id)?.rankingWeight ?? 0), 0);
      const score = targetWeight + (targetDimensions.length > 1 ? 20 : 0) + contextAnchors.length * 12;
      return { blueprint, targetDimensions, contextAnchors, score };
    })
    .filter((candidate) => candidate.targetDimensions.length > 0)
    .sort((left, right) => right.score - left.score || left.blueprint.id.localeCompare(right.blueprint.id));

  // Once the traveler has already provided useful context, do not let a
  // generic single-dimension budget card crowd out richer scenario choices.
  // Budget remains available later when no multi-dimension plan is left.
  const hasConfirmedContext = Object.keys(request.confirmedProfile).length > 0;
  const hasMultiDimensionPlan = rankedPlans.some((candidate) => candidate.targetDimensions.length > 1);
  const shortlistedPlans = hasConfirmedContext && hasMultiDimensionPlan
    ? rankedPlans.filter((candidate) => candidate.targetDimensions.length > 1 || candidate.contextAnchors.length > 0)
    : rankedPlans;

  return shortlistedPlans.slice(0, MAX_CONTEXTUAL_SCENARIOS_PER_TURN).map((candidate, index) => {
    const lens = LENSES[(request.turnNumber + index + candidate.contextAnchors.length) % LENSES.length] as ScenarioLens;
    return {
      id: `${candidate.blueprint.id}--${lens.id}`,
      targetDimensions: candidate.targetDimensions,
      contextAnchors: candidate.contextAnchors,
      guidance: `${candidate.blueprint.focus} ${lens.instruction}`,
    };
  });
}

/** Returns a scenario id only when it came from the trusted shortlist for this
 * exact request. This deliberately ignores every other model-authored field. */
export function recoverTrustedScenarioId(raw: unknown, request: NextTurnRequest): string | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const scenarioId = (raw as { scenarioId?: unknown }).scenarioId;
  if (typeof scenarioId !== 'string') return null;
  return selectContextualQuestionScenarios(request).some((scenario) => scenario.id === scenarioId) ? scenarioId : null;
}

function localizedFallbackPrompt(request: NextTurnRequest, scenario: ContextualQuestionScenario): string {
  const anchors = scenario.contextAnchors.map((anchor) => anchor.slice(anchor.indexOf('=') + 1));
  const context = anchors.length > 0 ? anchors.join(request.lang === 'ar' ? ' و' : ' and ') : request.purposeName;
  const lensId = scenario.id.slice(scenario.id.lastIndexOf('--') + 2);
  if (request.lang === 'ar') {
    if (lensId === 'honest-tradeoff') return `مع تفضيلاتك المؤكدة (${context})، أي توازن أقرب لما تبحث عنه؟`;
    if (lensId === 'decision-style') return `انطلاقًا من تفضيلاتك (${context})، أي اختيار يناسب رحلتك أكثر؟`;
    return `بناءً على ما أكّدته (${context})، أي صورة ليومك تناسبك أكثر؟`;
  }
  if (lensId === 'honest-tradeoff') return `With your confirmed preferences (${context}), which balance fits what you want best?`;
  if (lensId === 'decision-style') return `Starting from your preferences (${context}), which choice would suit your trip best?`;
  return `Based on what you confirmed (${context}), which picture of your day fits you best?`;
}

/** Last-resort Capability C repair. It is used only after the model selected a
 * trusted scenario but failed to produce valid wording/options on every bounded
 * repair attempt. The selected scenario still controls what is asked; canonical
 * values still come only from the request catalog. A total provider failure has
 * no recoverable scenario and continues to Phase 15 fallback as before. */
export function materializeTrustedScenario(
  request: NextTurnRequest,
  scenarioId: string,
): NextTurnResult | null {
  const scenario = selectContextualQuestionScenarios(request).find((candidate) => candidate.id === scenarioId);
  if (!scenario) return null;
  const dimensions = scenario.targetDimensions.map((id) => request.catalog.find((dimension) => dimension.id === id));
  if (dimensions.some((dimension) => !dimension || dimension.options.length < 2)) return null;
  const safeDimensions = dimensions as DimensionCatalogEntry[];
  const candidateCount = Math.min(4, Math.max(...safeDimensions.map((dimension) => dimension.options.length)));
  const seenUpdates = new Set<string>();
  const options = Array.from({ length: candidateCount }, (_, index) => {
    const selected = safeDimensions.map((dimension) => {
      const optionIndex = Math.round((index * (dimension.options.length - 1)) / Math.max(candidateCount - 1, 1));
      return { id: dimension.id, option: dimension.options[optionIndex] as DimensionCatalogEntry['options'][number] };
    });
    const updates = Object.fromEntries(selected.map(({ id, option }) => [id, option.value]));
    const valueText = selected.map(({ option }) => option.label).join(request.lang === 'ar' ? ' مع ' : ' with ');
    const lensId = scenario.id.slice(scenario.id.lastIndexOf('--') + 2);
    const label = request.lang === 'ar'
      ? lensId === 'honest-tradeoff'
        ? `توازن يميل إلى ${valueText}`
        : lensId === 'decision-style'
          ? `اختيار يركز على ${valueText}`
          : `يوم يقوم على ${valueText}`
      : lensId === 'honest-tradeoff'
        ? `A balance leaning toward ${valueText}`
        : lensId === 'decision-style'
          ? `A choice centered on ${valueText}`
          : `A day centered on ${valueText}`;
    return { id: `trusted-${index + 1}`, label, updates };
  }).filter((option) => {
    const key = JSON.stringify(option.updates);
    if (seenUpdates.has(key)) return false;
    seenUpdates.add(key);
    return true;
  });
  if (options.length < 2) return null;
  return {
    status: 'ask',
    scenarioId: scenario.id,
    questionType: 'choice',
    targetDimensions: scenario.targetDimensions,
    prompt: localizedFallbackPrompt(request, scenario),
    options,
  };
}
