import climateCompatJson from './generated/climateCompat.json';
import type { ClimateCompat, LocalizedText, PurposeId, Question, QuestionBanks, QuestionOption, RecommendationProfileKey } from './types';

const text = (ar: string, en: string): LocalizedText => ({ ar, en });
const option = (value: string | number, ar: string, en: string, descAr?: string, descEn?: string): QuestionOption => ({
  value,
  label: text(ar, en),
  ...(descAr && descEn ? { desc: text(descAr, descEn) } : {}),
});

const DESTINATION_WORDS: Record<PurposeId, LocalizedText> = {
  tourism: text('الوجهة السياحية', 'the holiday destination'),
  work: text('دولة العمل', 'the work destination'),
  education: text('وجهة الدراسة', 'the study destination'),
  medical: text('وجهة العلاج', 'the medical destination'),
  immigration: text('الدولة التي ستعيش فيها', 'the country you would live in'),
  investment: text('وجهة الاستثمار', 'the investment destination'),
  wellness: text('وجهة الاستجمام', 'the wellness destination'),
  other: text('الوجهة', 'the destination'),
};

const PURPOSE_METRIC: Record<PurposeId, { key: RecommendationProfileKey; ar: string; en: string }> = {
  tourism: { key: 'popularity', ar: 'ما مدى أهمية توفر خيارات وخدمات سياحية معروفة؟', en: 'How important is a well-established range of tourism services?' },
  work: { key: 'opportunity', ar: 'ما مدى أهمية قوة فرص العمل في الدولة؟', en: 'How important are strong job opportunities?' },
  education: { key: 'education', ar: 'ما مدى أهمية قوة مؤشرات التعليم العالي؟', en: 'How important are strong higher-education indicators?' },
  medical: { key: 'health', ar: 'ما مدى أهمية قوة النظام الصحي في الدولة؟', en: 'How important is the country’s overall health system?' },
  immigration: { key: 'income', ar: 'ما مدى أهمية ارتفاع مستوى الدخل والرفاه الاقتصادي؟', en: 'How important are income levels and economic well-being?' },
  investment: { key: 'investment', ar: 'ما مدى أهمية نشاط الاستثمار الأجنبي في الدولة؟', en: 'How important is active foreign investment in the country?' },
  wellness: { key: 'health', ar: 'ما مدى أهمية قوة المؤشرات الصحية العامة؟', en: 'How important are strong public-health indicators?' },
  other: { key: 'growth', ar: 'هل يهمك أن تكون الوجهة في اقتصاد ينمو حاليًا؟', en: 'How important is current economic growth at the destination?' },
};

function question(id: string, profileKey: RecommendationProfileKey, kind: Question['kind'], weight: number, ar: string, en: string, options: QuestionOption[], scale?: number): Question {
  return { id, profileKey, kind, weight, text: text(ar, en), options, ...(scale ? { scale } : {}) };
}

function buildBank(purpose: PurposeId): Question[] {
  const destination = DESTINATION_WORDS[purpose];
  const ids = {
    proximity: `${purpose}-proximity`, climate: `${purpose}-climate`, cost: `${purpose}-cost`,
    urbanity: `${purpose}-urbanity`, popularity: `${purpose}-popularity`, coastal: `${purpose}-coastal`,
    size: `${purpose}-size`, island: `${purpose}-island`, safety: `${purpose}-safety`, metric: `${purpose}-metric`,
  };

  const proximity: Question = {
    id: ids.proximity,
    kind: 'proximity',
    weight: 12,
    text: text(
      `هل يهمك أن تكون ${destination.ar} قريبة من موقعك الحالي؟`,
      `Does it matter that ${destination.en} is close to your current location?`,
    ),
    options: [
      option(100, 'نعم، القرب مهم', 'Yes, proximity matters', 'سنستخدم الموقع الذي سمحت به سابقًا لحساب القرب.', 'We will use the location you previously allowed to calculate proximity.'),
      option(0, 'لا، المسافة لا تهمني', 'No, distance does not matter', 'لن تؤثر المسافة في التوصيات.', 'Distance will not affect your recommendations.'),
    ],
    nextByValue: { '100': ids.climate, '0': ids.cost },
  };

  const metric = PURPOSE_METRIC[purpose];
  return [
    proximity,
    // Purpose-specific question audit (item #11): the dimensions below are
    // shared across all 8 purposes (they score the same RecommendationProfile
    // key regardless of purpose), but their WORDING previously hardcoded
    // tourism/trip phrasing ("the trip", "tourism destination", "your trip")
    // that reads wrong for Education/Work/Medical/Investment/Immigration/
    // Wellness (e.g. Education literally asked "Which type of tourism
    // destination suits you best?"). Reworded to be purpose-neutral, or to
    // substitute the purpose's own `destination` word (already used by
    // `proximity` and `metric` above) — never tourism-specific by default.
    question(ids.climate, 'climate', 'climate', 12, 'أي طقس تفضّله خلال فترة إقامتك؟', 'Which weather do you prefer for most of your time there?', [
      option('cold', 'بارد وقد يكون ثلجيًا', 'Cold and possibly snowy'),
      option('temperate', 'معتدل يميل للبرودة', 'Cool and temperate'),
      option('mediterranean', 'دافئ ومعتدل', 'Warm and mild'),
      option('tropical', 'دافئ ورطب أو ممطر', 'Warm, humid, or rainy'),
      option('desert', 'حار وجاف', 'Hot and dry'),
    ]),
    question(ids.cost, 'costLevel', 'target', 14, 'ما ميزانيتك التقريبية الإجمالية؟', 'What is your approximate overall budget?', [
      option(1, 'حتى 5,000 ريال', 'Up to 5,000 SAR'), option(2, '5,000 – 10,000 ريال', '5,000 – 10,000 SAR'),
      option(3, '10,000 – 20,000 ريال', '10,000 – 20,000 SAR'), option(4, 'أكثر من 20,000 ريال', 'More than 20,000 SAR'),
    ], 4),
    question(ids.urbanity, 'urbanity', 'target', 10, 'أين تفضّل قضاء معظم وقتك؟', 'Where would you prefer to spend most of your time?', [
      option(15, 'بين الطبيعة والريف', 'In nature and rural areas'), option(40, 'في بلدات أو مدن هادئة', 'In quiet towns or smaller cities'),
      option(70, 'بين الطبيعة والمدينة', 'A mix of nature and city'), option(95, 'في مدينة كبيرة ونشطة', 'In a large, active city'),
    ]),
    question(ids.popularity, 'popularity', 'target', 8, `ما نوع ${destination.ar} الذي ترتاح له أكثر؟`, `Which type of ${destination.en} suits you best?`, [
      option(10, 'غير مشهورة وبعيدة عن المسارات المعتادة', 'Little-known and away from usual routes'),
      option(40, 'معروفة قليلًا وهادئة غالبًا', 'Somewhat known and generally quiet'),
      option(70, 'معروفة وتوفر خيارات كثيرة', 'Well-known with many options'),
      option(95, 'وجهة عالمية شديدة الشهرة', 'A globally famous destination'),
    ]),
    question(ids.coastal, 'coastal', 'target', 11, 'هل تريد أن يكون البحر جزءًا أساسيًا من هذه التجربة؟', 'Do you want the sea to be a central part of this experience?', [
      option(100, 'نعم، أريد شواطئ أو ساحلًا قريبًا', 'Yes, I want beaches or a nearby coast'),
      option(0, 'لا، أفضل وجهة داخلية', 'No, I prefer an inland destination'), option(50, 'لا فرق لدي', 'No preference'),
    ]),
    question(ids.size, 'size', 'target', 6, 'أي تجربة تنقّل تناسبك أكثر؟', 'Which travel pattern suits you better?', [
      option(10, 'دولة صغيرة ومسافات أقصر', 'A compact country with shorter distances'),
      option(40, 'مسافات متوسطة وخيارات متنوعة', 'Moderate distances with varied options'),
      option(70, 'دولة كبيرة ومدن ومناطق متعددة', 'A large country with many cities and regions'),
      option(95, 'مساحات شاسعة وتنقّل بين أقاليم مختلفة', 'Vast distances and travel across distinct regions'),
    ]),
    question(ids.island, 'island', 'target', 5, `هل تفضّل أن تكون ${destination.ar} في جزيرة؟`, `Would you prefer ${destination.en} to be an island?`, [
      option(100, 'نعم، أفضل الجزر', 'Yes, I prefer islands'), option(0, 'لا، أفضل وجهة متصلة باليابسة', 'No, I prefer a mainland destination'),
      option(50, 'لا فرق لدي', 'No preference'),
    ]),
    question(ids.safety, 'safety', 'importance', 11, 'كم يهمك انخفاض معدل الجرائم العنيفة في الوجهة؟', 'How important is a low violent-crime rate at the destination?', [
      option(25, 'عامل ثانوي', 'A secondary factor'), option(50, 'مهم', 'Important'),
      option(75, 'مهم جدًا', 'Very important'), option(100, 'أولوية قصوى', 'A top priority'),
    ]),
    question(ids.metric, metric.key, 'importance', 10, metric.ar, metric.en, [
      option(25, 'عامل ثانوي', 'A secondary factor'), option(50, 'مهم', 'Important'),
      option(75, 'مهم جدًا', 'Very important'), option(100, 'عامل حاسم', 'A deciding factor'),
    ]),
  ];
}

const purposes: PurposeId[] = ['tourism', 'work', 'education', 'medical', 'immigration', 'investment', 'wellness', 'other'];
export const QUESTION_BANKS: QuestionBanks = Object.fromEntries(purposes.map((purpose) => [purpose, buildBank(purpose)])) as QuestionBanks;

/** Item #7 — optional land-travel question id, namespaced per purpose like
 *  every other question here. Not part of QUESTION_BANKS itself: it is a
 *  hard filter on candidate destinations (see rankDestinations.ts), not a
 *  weighted score input, and it must only ever be asked when there is real
 *  location context to answer it honestly — see effectiveQuestionBank(). */
export function landBorderQuestionId(purpose: PurposeId): string {
  return `${purpose}-landBorder`;
}

function landBorderQuestion(purpose: PurposeId): Question {
  return {
    id: landBorderQuestionId(purpose),
    kind: 'landBorder',
    weight: 0,
    text: text(
      'هل يهمك أن تكون الوجهة قابلة للوصول برًا من موقعك الحالي؟',
      'Does it matter to you that the destination can be reached by land from your current location?',
    ),
    options: [
      option(
        1,
        'نعم',
        'Yes',
        'سنقتصر على الدول التي تشترك في حدود برية مباشرة مع موقعك الحالي. هذا لا يعني أن المعابر مفتوحة أو أن التأشيرة متاحة أو أن الطريق قابل للقيادة فعليًا الآن — فقط أن الحدود متجاورة جغرافيًا.',
        'We will limit results to countries that share a direct land border with your current location. This does not mean border crossings are open, a visa is available, or the route is currently drivable — only that the borders are geographically adjacent.',
      ),
      option(0, 'لا', 'No'),
    ],
  };
}

/** The question bank actually shown to the user for a purpose: the fixed
 *  bank plus the optional land-travel question, appended ONLY when there is
 *  real location context (`hasLocation`) — never asked when it can't be
 *  answered honestly. Both the reducer (path/advance) and Quiz.tsx must use
 *  this instead of reading QUESTION_BANKS[purpose] directly, so the
 *  question's presence stays consistent across the whole quiz flow. */
export function effectiveQuestionBank(purpose: PurposeId, hasLocation: boolean): Question[] {
  const bank = QUESTION_BANKS[purpose];
  return hasLocation ? [...bank, landBorderQuestion(purpose)] : bank;
}
export const CLIMATE_COMPAT: ClimateCompat = climateCompatJson as ClimateCompat;
