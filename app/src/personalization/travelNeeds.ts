// v1.1 — three optional traveller needs for Personal Match (personal-match-1.1):
//
//   LANGUAGE           how much easy communication in a language the
//                      traveller knows matters, and which languages
//   ISLAMIC PRACTICE   how much the practical ease of observing Islamic
//                      practice while travelling matters
//   HALAL FOOD         how much finding halal food easily matters
//
// They refine PERSONAL MATCH only. Phase 14 never sees them: they are not in
// QUESTION_BANKS (which is all scoreDestination() reads), they carry no
// profileKey, and the questionnaire asks them only after every Phase 14
// question is done (adaptive/nextQuestion.ts), so the Phase 14 questions,
// their order and the ranking are exactly as before.
//
// Evidence, and what it is not:
//   - Language: the country's OFFICIAL languages (world-countries, ODbL). A
//     match is real positive evidence of easy communication. No match is
//     NOT evidence of the opposite — English, for one, is widely used in
//     many countries where it is not official — so it is "not counted",
//     never a low score.
//   - Islamic practice: mosques / Muslim places of worship MAPPED in
//     OpenStreetMap (islamicTravelEvidence.json), by count and, for small
//     countries, by density per land area. Halal food: places explicitly
//     TAGGED as serving halal food there. Neither is read from religion
//     statistics, an official religion, a name or a region; no country or
//     society is rated for religiosity. Mapping completeness varies, so
//     only positive evidence counts and anything below the evidence floor
//     is "not counted".
//   - Halal has ONE level on purpose: where halal is simply the default it
//     is rarely tagged, so a count of tags cannot say that one country is
//     "less halal-friendly" than another. Enough tagged places is positive
//     evidence; fewer is not counted — never a partial or low score.
//
// Privacy: these answers stay in the local profile. They are never sent to
// the Worker, analytics or admin, never put in a URL, a share text or page
// metadata (see Quiz.tsx, which skips telemetry for these questions).
import evidenceJson from '../data/generated/islamicTravelEvidence.json';
import type { LocalizedText, PurposeId, Question, QuestionOption } from '../data/types';

export const TRAVEL_NEED_BASE_WEIGHT = 10;

export const TRAVEL_NEED_COPY = {
  ar: {
    privateNote: 'يبقى جوابك على هذا المتصفح فقط، ويُستخدم لحساب مدى توافق الوجهات معك.',
    chooseLanguages: 'اختر لغة واحدة أو أكثر.',
    continue: 'متابعة',
  },
  en: {
    privateNote: 'Your answer stays in this browser only and is used for your personal match.',
    chooseLanguages: 'Choose one or more languages.',
    continue: 'Continue',
  },
} as const;

/** Importance answers: 100 very important (a deciding factor), 60
 *  important, 0 not important (neutral, never scored). */
export const IMPORTANCE_VERY = 100;
export const IMPORTANCE_SOME = 60;

/** Evidence floors (places mapped in OpenStreetMap).
 *  Mosques: at least STRONG places, or at least SOME places at a density of
 *  STRONG_DENSITY per 1,000 km² (a small country with many mosques), is a
 *  good match (fit 100); at least SOME is a partial match (fit 60); fewer
 *  is not counted.
 *  Halal: at least FLOOR tagged places is a good match (fit 100); fewer is
 *  not counted (see the header for why there is no partial level). */
export const MOSQUE_EVIDENCE = { strong: 200, some: 20, strongDensityPer1000Km2: 5 } as const;
export const HALAL_EVIDENCE = { floor: 20 } as const;
export const STRONG_EVIDENCE_FIT = 100;
export const SOME_EVIDENCE_FIT = 60;

export interface LanguageOption {
  code: string;
  label: LocalizedText;
  /** The names world-countries uses for this language as an official one. */
  officialNames: readonly string[];
}

/** Languages a traveller can pick: each is an official language of at least
 *  one catalog country, so a match is always possible to evaluate. */
export const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  { code: 'ar', label: { ar: 'العربية', en: 'Arabic' }, officialNames: ['Arabic'] },
  { code: 'en', label: { ar: 'الإنجليزية', en: 'English' }, officialNames: ['English'] },
  { code: 'fr', label: { ar: 'الفرنسية', en: 'French' }, officialNames: ['French'] },
  { code: 'es', label: { ar: 'الإسبانية', en: 'Spanish' }, officialNames: ['Spanish'] },
  { code: 'pt', label: { ar: 'البرتغالية', en: 'Portuguese' }, officialNames: ['Portuguese'] },
  { code: 'de', label: { ar: 'الألمانية', en: 'German' }, officialNames: ['German', 'Swiss German', 'Austro-Bavarian German'] },
  { code: 'it', label: { ar: 'الإيطالية', en: 'Italian' }, officialNames: ['Italian'] },
  { code: 'ru', label: { ar: 'الروسية', en: 'Russian' }, officialNames: ['Russian'] },
  { code: 'tr', label: { ar: 'التركية', en: 'Turkish' }, officialNames: ['Turkish'] },
  { code: 'fa', label: { ar: 'الفارسية', en: 'Persian' }, officialNames: ['Persian (Farsi)', 'Dari'] },
  { code: 'ur', label: { ar: 'الأردية', en: 'Urdu' }, officialNames: ['Urdu'] },
  { code: 'hi', label: { ar: 'الهندية', en: 'Hindi' }, officialNames: ['Hindi'] },
  { code: 'bn', label: { ar: 'البنغالية', en: 'Bengali' }, officialNames: ['Bengali'] },
  { code: 'ms', label: { ar: 'الملايوية', en: 'Malay' }, officialNames: ['Malay'] },
  { code: 'id', label: { ar: 'الإندونيسية', en: 'Indonesian' }, officialNames: ['Indonesian'] },
  { code: 'zh', label: { ar: 'الصينية', en: 'Chinese' }, officialNames: ['Chinese'] },
  { code: 'sw', label: { ar: 'السواحيلية', en: 'Swahili' }, officialNames: ['Swahili'] },
];

const LANGUAGE_BY_CODE = new Map(LANGUAGE_OPTIONS.map((option) => [option.code, option]));

export type TravelNeed = 'languageImportance' | 'languages' | 'islamicPractice' | 'halalFood';

export function travelNeedQuestionId(purpose: PurposeId, need: TravelNeed): string {
  return `${purpose}-${need}`;
}

const importanceOptions = (): QuestionOption[] => [
  { value: IMPORTANCE_VERY, label: { ar: 'مهم جدًا', en: 'Very important' } },
  { value: IMPORTANCE_SOME, label: { ar: 'مهم', en: 'Important' } },
  { value: 0, label: { ar: 'غير مهم', en: 'Not important' } },
];

const QUESTIONS_BY_PURPOSE = new Map<PurposeId, readonly Question[]>();

/** The four questions, in the order they are asked. The language list is
 *  asked only when communication matters; the Islamic-practice and halal
 *  questions are always separate, so any combination can be expressed. */
export function travelNeedQuestions(purpose: PurposeId): readonly Question[] {
  let questions = QUESTIONS_BY_PURPOSE.get(purpose);
  if (!questions) {
    questions = buildTravelNeedQuestions(purpose);
    QUESTIONS_BY_PURPOSE.set(purpose, questions);
  }
  return questions;
}

function buildTravelNeedQuestions(purpose: PurposeId): Question[] {
  const importanceId = travelNeedQuestionId(purpose, 'languageImportance');
  return [
    {
      id: importanceId,
      kind: 'personalImportance',
      weight: 0,
      text: {
        ar: 'ما مدى أهمية سهولة التواصل بلغة تعرفها أثناء السفر؟',
        en: 'How important is it to communicate easily in a language you know while travelling?',
      },
      options: importanceOptions(),
    },
    {
      id: travelNeedQuestionId(purpose, 'languages'),
      kind: 'personalLanguages',
      weight: 0,
      text: {
        ar: 'ما اللغات التي تستطيع استخدامها أثناء السفر؟',
        en: 'Which languages can you use while travelling?',
      },
      options: LANGUAGE_OPTIONS.map((language) => ({ value: language.code, label: language.label })),
      parent: { questionId: importanceId, values: [IMPORTANCE_VERY, IMPORTANCE_SOME] },
    },
    {
      id: travelNeedQuestionId(purpose, 'islamicPractice'),
      kind: 'personalImportance',
      weight: 0,
      text: {
        ar: 'ما مدى أهمية سهولة ممارسة شعائرك الإسلامية أثناء السفر؟',
        en: 'How important is it that you can easily observe your Islamic practice while travelling?',
      },
      options: importanceOptions(),
    },
    {
      id: travelNeedQuestionId(purpose, 'halalFood'),
      kind: 'personalImportance',
      weight: 0,
      text: {
        ar: 'ما مدى أهمية سهولة العثور على طعام حلال في وجهتك؟',
        en: 'How important is it to find halal food easily at your destination?',
      },
      options: importanceOptions(),
    },
  ];
}

export function isTravelNeedQuestion(question: Pick<Question, 'kind'>): boolean {
  return question.kind === 'personalImportance' || question.kind === 'personalLanguages';
}

const TRAVEL_NEEDS: ReadonlySet<string> = new Set<TravelNeed>(['languageImportance', 'languages', 'islamicPractice', 'halalFood']);

/** True for a question id of any purpose's travel-need question. Id-based,
 *  like isLocationDependentQuestionId(), for ids already in answers/path. */
export function isTravelNeedQuestionId(id: string): boolean {
  return TRAVEL_NEEDS.has(id.slice(id.indexOf('-') + 1));
}

/** A language answer is a comma-separated, sorted, de-duplicated list of
 *  known codes ("ar,en"). Anything else is not a valid answer. */
export function parseLanguageAnswer(value: unknown): string[] | null {
  if (typeof value !== 'string' || !value || value.length > 120) return null;
  const codes = value.split(',');
  if (codes.some((code) => !LANGUAGE_BY_CODE.has(code))) return null;
  if (new Set(codes).size !== codes.length) return null;
  return codes;
}

export function languageAnswer(codes: readonly string[]): string {
  return [...new Set(codes.filter((code) => LANGUAGE_BY_CODE.has(code)))].sort().join(',');
}

export function languageLabel(code: string, lang: 'ar' | 'en'): string {
  return LANGUAGE_BY_CODE.get(code)?.label[lang] ?? code;
}

/** Official-language evidence: the traveller's languages that are official
 *  in the country (world-countries names). */
export function matchingOfficialLanguages(codes: readonly string[], officialLanguages: readonly string[]): string[] {
  const official = new Set(officialLanguages);
  return codes.filter((code) => LANGUAGE_BY_CODE.get(code)?.officialNames.some((name) => official.has(name)));
}

interface EvidenceEntry {
  countryCode: string;
  status: 'ok' | 'unavailable';
  mosques?: number;
  halalPlaces?: number;
}

interface EvidenceSnapshot {
  snapshotUpdatedAt: string | null;
  entries: EvidenceEntry[];
}

const EVIDENCE = evidenceJson as EvidenceSnapshot;
const EVIDENCE_BY_CODE = new Map(EVIDENCE.entries.map((entry) => [entry.countryCode, entry]));

export type EvidenceTier = 'strong' | 'some' | 'insufficient' | 'noData';

export function evidenceTier(
  countryCode: string,
  kind: 'mosques' | 'halalPlaces',
  areaKm2?: number,
): { tier: EvidenceTier; count?: number } {
  const entry = EVIDENCE_BY_CODE.get(countryCode);
  const count = entry?.status === 'ok' ? entry[kind] : undefined;
  if (typeof count !== 'number') return { tier: 'noData' };
  if (kind === 'halalPlaces') return { tier: count >= HALAL_EVIDENCE.floor ? 'strong' : 'insufficient', count };
  const dense = typeof areaKm2 === 'number' && areaKm2 > 0 && (count / areaKm2) * 1000 >= MOSQUE_EVIDENCE.strongDensityPer1000Km2;
  if (count >= MOSQUE_EVIDENCE.strong || (count >= MOSQUE_EVIDENCE.some && dense)) return { tier: 'strong', count };
  if (count >= MOSQUE_EVIDENCE.some) return { tier: 'some', count };
  return { tier: 'insufficient', count };
}
