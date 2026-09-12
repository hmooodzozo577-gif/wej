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
    question(ids.climate, 'climate', 'climate', 12, 'أي طقس تفضّل خلال معظم الرحلة؟', 'Which weather do you prefer for most of the trip?', [
      option('cold', 'بارد وقد يكون ثلجيًا', 'Cold and possibly snowy'),
      option('temperate', 'معتدل يميل للبرودة', 'Cool and temperate'),
      option('mediterranean', 'دافئ ومعتدل', 'Warm and mild'),
      option('tropical', 'دافئ ورطب أو ممطر', 'Warm, humid, or rainy'),
      option('desert', 'حار وجاف', 'Hot and dry'),
    ]),
    question(ids.cost, 'costLevel', 'target', 14, 'ما ميزانيتك التقريبية للرحلة؟', 'What is your approximate trip budget?', [
      option(1, 'حتى 5,000 ريال', 'Up to 5,000 SAR'), option(2, '5,000 – 10,000 ريال', '5,000 – 10,000 SAR'),
      option(3, '10,000 – 20,000 ريال', '10,000 – 20,000 SAR'), option(4, 'أكثر من 20,000 ريال', 'More than 20,000 SAR'),
    ], 4),
    question(ids.urbanity, 'urbanity', 'target', 10, 'أين تفضّل قضاء معظم وقتك؟', 'Where would you prefer to spend most of your time?', [
      option(15, 'بين الطبيعة والريف', 'In nature and rural areas'), option(40, 'في بلدات أو مدن هادئة', 'In quiet towns or smaller cities'),
      option(70, 'بين الطبيعة والمدينة', 'A mix of nature and city'), option(95, 'في مدينة كبيرة ونشطة', 'In a large, active city'),
    ]),
    question(ids.popularity, 'popularity', 'target', 8, 'ما نوع الوجهة السياحية الذي ترتاح له أكثر؟', 'Which type of tourism destination suits you best?', [
      option(10, 'غير مشهورة وبعيدة عن المسارات المعتادة', 'Little-known and away from usual routes'),
      option(40, 'معروفة قليلًا وهادئة غالبًا', 'Somewhat known and generally quiet'),
      option(70, 'معروفة وتوفر خيارات سياحية كثيرة', 'Well-known with many tourism options'),
      option(95, 'وجهة عالمية شديدة الشهرة', 'A globally famous destination'),
    ]),
    question(ids.coastal, 'coastal', 'target', 11, 'هل تريد أن يكون البحر جزءًا أساسيًا من الرحلة؟', 'Do you want the sea to be a central part of the trip?', [
      option(100, 'نعم، أريد شواطئ أو ساحلًا قريبًا', 'Yes, I want beaches or a nearby coast'),
      option(0, 'لا، أفضل وجهة داخلية', 'No, I prefer an inland destination'), option(50, 'لا فرق لدي', 'No preference'),
    ]),
    question(ids.size, 'size', 'target', 6, 'أي تجربة تنقّل تناسبك أكثر؟', 'Which travel pattern suits you better?', [
      option(10, 'دولة صغيرة ومسافات أقصر', 'A compact country with shorter distances'),
      option(40, 'مسافات متوسطة وخيارات متنوعة', 'Moderate distances with varied options'),
      option(70, 'دولة كبيرة ومدن ومناطق متعددة', 'A large country with many cities and regions'),
      option(95, 'مساحات شاسعة ورحلة بين أقاليم مختلفة', 'Vast distances and travel across distinct regions'),
    ]),
    question(ids.island, 'island', 'target', 5, 'هل تفضّل أن تكون رحلتك إلى جزيرة؟', 'Would you prefer an island destination?', [
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
export const CLIMATE_COMPAT: ClimateCompat = climateCompatJson as ClimateCompat;
