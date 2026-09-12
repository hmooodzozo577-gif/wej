import climateCompatJson from './generated/climateCompat.json';
import type { ClimateCompat, Continent, LocalizedText, PurposeId, Question, QuestionBanks, QuestionOption, RecommendationProfileKey } from './types';

const text = (ar: string, en: string): LocalizedText => ({ ar, en });
const option = (value: string | number, ar: string, en: string, descAr?: string, descEn?: string): QuestionOption => ({
  value,
  label: text(ar, en),
  ...(descAr && descEn ? { desc: text(descAr, descEn) } : {}),
});

const REGIONS: Array<{ value: Continent; ar: string; en: string }> = [
  { value: 'Asia', ar: 'آسيا', en: 'Asia' }, { value: 'MiddleEast', ar: 'الشرق الأوسط', en: 'Middle East' },
  { value: 'Europe', ar: 'أوروبا', en: 'Europe' }, { value: 'Africa', ar: 'أفريقيا', en: 'Africa' },
  { value: 'NAmerica', ar: 'أمريكا الشمالية والكاريبي', en: 'North America & Caribbean' },
  { value: 'SouthAmerica', ar: 'أمريكا الجنوبية', en: 'South America' }, { value: 'Oceania', ar: 'أوقيانوسيا', en: 'Oceania' },
];

const SUBREGIONS: Record<Continent, Array<{ value: string; ar: string; en: string }>> = {
  Asia: [
    { value: 'Central Asia', ar: 'آسيا الوسطى', en: 'Central Asia' }, { value: 'Eastern Asia', ar: 'شرق آسيا', en: 'East Asia' },
    { value: 'South-Eastern Asia', ar: 'جنوب شرق آسيا', en: 'Southeast Asia' }, { value: 'Southern Asia', ar: 'جنوب آسيا', en: 'South Asia' },
  ],
  MiddleEast: [{ value: 'Western Asia', ar: 'غرب آسيا والشرق الأوسط', en: 'Western Asia & Middle East' }],
  Europe: [
    { value: 'Central Europe', ar: 'وسط أوروبا', en: 'Central Europe' }, { value: 'Eastern Europe', ar: 'شرق أوروبا', en: 'Eastern Europe' },
    { value: 'Northern Europe', ar: 'شمال أوروبا', en: 'Northern Europe' }, { value: 'Southeast Europe', ar: 'جنوب شرق أوروبا', en: 'Southeast Europe' },
    { value: 'Southern Europe', ar: 'جنوب أوروبا', en: 'Southern Europe' }, { value: 'Western Europe', ar: 'غرب أوروبا', en: 'Western Europe' },
  ],
  Africa: [
    { value: 'Eastern Africa', ar: 'شرق أفريقيا', en: 'East Africa' }, { value: 'Middle Africa', ar: 'وسط أفريقيا', en: 'Central Africa' },
    { value: 'Northern Africa', ar: 'شمال أفريقيا', en: 'North Africa' }, { value: 'Southern Africa', ar: 'جنوب أفريقيا', en: 'Southern Africa' },
    { value: 'Western Africa', ar: 'غرب أفريقيا', en: 'West Africa' },
  ],
  NAmerica: [
    { value: 'Caribbean', ar: 'الكاريبي', en: 'Caribbean' }, { value: 'Central America', ar: 'أمريكا الوسطى', en: 'Central America' },
    { value: 'North America', ar: 'أمريكا الشمالية', en: 'North America' },
  ],
  SouthAmerica: [{ value: 'South America', ar: 'أمريكا الجنوبية', en: 'South America' }],
  Oceania: [
    { value: 'Australia and New Zealand', ar: 'أستراليا ونيوزيلندا', en: 'Australia & New Zealand' }, { value: 'Melanesia', ar: 'ميلانيزيا', en: 'Melanesia' },
    { value: 'Micronesia', ar: 'ميكرونيزيا', en: 'Micronesia' }, { value: 'Polynesia', ar: 'بولينيزيا', en: 'Polynesia' },
  ],
};

const PURPOSE_WORDS: Record<PurposeId, LocalizedText> = {
  tourism: text('رحلتك السياحية', 'your holiday'), work: text('تجربة العمل', 'your work move'),
  education: text('رحلتك الدراسية', 'your study plan'), medical: text('رحلتك العلاجية', 'your medical trip'),
  immigration: text('حياتك الجديدة', 'your new life'), investment: text('خطتك الاستثمارية', 'your investment plan'),
  wellness: text('رحلة الاستجمام', 'your wellness retreat'), other: text('رحلتك', 'your trip'),
};

const PURPOSE_METRIC: Record<PurposeId, { key: RecommendationProfileKey; ar: string; en: string }> = {
  tourism: { key: 'popularity', ar: 'ما مدى أهمية وجود بنية سياحية معروفة؟', en: 'How important is an established tourism scene?' },
  work: { key: 'opportunity', ar: 'ما مدى أهمية قوة فرص العمل؟', en: 'How important are strong job opportunities?' },
  education: { key: 'education', ar: 'ما مدى أهمية قوة مؤشرات التعليم العالي؟', en: 'How important are strong higher-education indicators?' },
  medical: { key: 'health', ar: 'ما مدى أهمية قوة المؤشرات الصحية؟', en: 'How important are strong health indicators?' },
  immigration: { key: 'income', ar: 'ما مدى أهمية مستوى الدخل والرفاه الاقتصادي؟', en: 'How important are income and economic well-being?' },
  investment: { key: 'investment', ar: 'ما مدى أهمية تدفقات الاستثمار الحالية؟', en: 'How important are current investment flows?' },
  wellness: { key: 'health', ar: 'ما مدى أهمية قوة المؤشرات الصحية العامة؟', en: 'How important are strong public-health indicators?' },
  other: { key: 'growth', ar: 'ما مدى أهمية النمو الاقتصادي للوجهة؟', en: 'How important is the destination’s economic growth?' },
};

function slug(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

function sharedQuestion(id: string, profileKey: RecommendationProfileKey, kind: Question['kind'], weight: number, ar: string, en: string, options: QuestionOption[], scale?: number): Question {
  return { id, profileKey, kind, weight, text: text(ar, en), options, ...(scale ? { scale } : {}) };
}

function buildBank(purpose: PurposeId): Question[] {
  const word = PURPOSE_WORDS[purpose];
  const rootId = `${purpose}-region`;
  const commonIds = { climate: `${purpose}-climate`, cost: `${purpose}-cost`, urbanity: `${purpose}-urbanity`, popularity: `${purpose}-popularity` };
  const root: Question = {
    id: rootId, profileKey: 'region', kind: 'category', weight: 18,
    text: text(`أي منطقة تبدو أقرب إلى ${word.ar}؟`, `Which region feels closest to ${word.en}?`),
    options: REGIONS.map((region) => option(region.value, region.ar, region.en)),
    nextByValue: Object.fromEntries(REGIONS.map((region) => [region.value, `${purpose}-subregion-${slug(region.value)}`])),
  };

  const subregionQuestions: Question[] = [];
  const contextQuestions: Question[] = [];
  for (const region of REGIONS) {
    const subregions = SUBREGIONS[region.value];
    const subId = `${purpose}-subregion-${slug(region.value)}`;
    subregionQuestions.push({
      id: subId, profileKey: 'subregion', kind: 'category', weight: 16,
      parent: { questionId: rootId, values: [region.value] },
      text: text(`داخل ${region.ar}، أي نطاق يناسب ${word.ar} أكثر؟`, `Within ${region.en}, which area suits ${word.en} best?`),
      options: subregions.map((subregion) => option(subregion.value, subregion.ar, subregion.en)),
      nextByValue: Object.fromEntries(subregions.map((subregion) => [subregion.value, `${purpose}-setting-${slug(subregion.value)}`])),
    });
    for (const subregion of subregions) {
      const values = [100, 0, 75, 50];
      contextQuestions.push({
        id: `${purpose}-setting-${slug(subregion.value)}`, profileKey: 'coastal', kind: 'target', weight: 11, scale: 100,
        parent: { questionId: subId, values: [subregion.value] },
        text: text(`في ${subregion.ar}، أي محيط تفضّل؟`, `In ${subregion.en}, which setting do you prefer?`),
        options: [
          option(values[0], 'ساحل وبحر قريب', 'Coast and nearby sea'), option(values[1], 'وجهة داخلية وبرية', 'Inland destination'),
          option(values[2], 'جزيرة أو أرخبيل', 'Island or archipelago'), option(values[3], 'لا فرق، الأهم بقية الأولويات', 'No preference; other priorities matter more'),
        ],
        nextByValue: { [String(values[0])]: commonIds.climate, [String(values[1])]: commonIds.cost, [String(values[2])]: commonIds.popularity, [String(values[3])]: commonIds.urbanity },
      });
    }
  }

  const metric = PURPOSE_METRIC[purpose];
  const shared: Question[] = [
    sharedQuestion(commonIds.climate, 'climate', 'climate', 12, 'أي مناخ تريده فعلًا؟', 'Which climate do you actually want?', [
      option('cold', 'بارد وثلجي', 'Cold and snowy'), option('temperate', 'معتدل يميل للبرودة', 'Cool and temperate'),
      option('mediterranean', 'دافئ معتدل', 'Warm and mild'), option('tropical', 'استوائي ودافئ', 'Tropical and warm'),
      option('desert', 'حار وجاف', 'Hot and dry'),
    ]),
    sharedQuestion(commonIds.cost, 'costLevel', 'target', 14, 'ما مستوى الأسعار التقريبي المناسب لك؟', 'Which approximate price level suits you?', [
      option(1, 'حتى 5,000 ريال', 'Up to 5,000 SAR'), option(2, '5,000 – 10,000 ريال', '5,000 – 10,000 SAR'),
      option(3, '10,000 – 20,000 ريال', '10,000 – 20,000 SAR'), option(4, 'أكثر من 20,000 ريال', 'More than 20,000 SAR'),
    ], 4),
    sharedQuestion(commonIds.urbanity, 'urbanity', 'target', 10, 'ما مقدار الحياة الحضرية التي تفضّلها؟', 'How urban do you want the destination to feel?', [
      option(15, 'ريف وطبيعة أكثر', 'Mostly rural and natural'), option(40, 'مدن صغيرة وهدوء', 'Smaller cities and calm'),
      option(70, 'توازن بين المدن والهدوء', 'A balance of cities and calm'), option(95, 'مدن كبيرة وحركة مستمرة', 'Large cities and constant activity'),
    ]),
    sharedQuestion(commonIds.popularity, 'popularity', 'target', 8, 'هل تفضّل وجهة مشهورة أم أقل ازدحامًا؟', 'Do you prefer a famous or less-visited destination?', [
      option(10, 'بعيدة عن المسارات المعتادة', 'Well off the usual routes'), option(40, 'هادئة نسبيًا', 'Relatively quiet'),
      option(70, 'معروفة بخيارات كثيرة', 'Established with many options'), option(95, 'وجهة عالمية شديدة الشهرة', 'A globally famous destination'),
    ]),
    sharedQuestion(`${purpose}-size`, 'size', 'target', 6, 'أي حجم للوجهة يلائم طريقة تنقلك؟', 'What destination size suits how you travel?', [
      option(10, 'صغيرة وسهلة الاستكشاف', 'Compact and easy to explore'), option(40, 'متوسطة ومتنوعة', 'Medium-sized and varied'),
      option(70, 'كبيرة بخيارات واسعة', 'Large with broad options'), option(95, 'شاسعة ومتعددة الأقاليم', 'Vast and multi-region'),
    ]),
    sharedQuestion(`${purpose}-latitude`, 'latitudeZone', 'target', 9, 'داخل النطاق المختار، أي اتجاه جغرافي تفضّل؟', 'Within that area, which geographic direction do you prefer?', [
      option(15, 'أقصى الجنوب', 'Far south'), option(35, 'الجنوب', 'South'), option(50, 'الوسط', 'Central'), option(65, 'الشمال', 'North'), option(85, 'أقصى الشمال', 'Far north'),
    ]),
    sharedQuestion(`${purpose}-longitude`, 'longitudeZone', 'target', 9, 'وأي امتداد داخل المنطقة أقرب لك؟', 'Which side of the area appeals to you?', [
      option(15, 'أقصى الغرب', 'Far west'), option(35, 'الغرب', 'West'), option(50, 'الوسط', 'Central'), option(65, 'الشرق', 'East'), option(85, 'أقصى الشرق', 'Far east'),
    ]),
    sharedQuestion(`${purpose}-island`, 'island', 'target', 5, 'هل يهمك أن تكون الوجهة جزيرية؟', 'Does an island destination appeal to you?', [
      option(100, 'نعم، أفضل الجزر', 'Yes, I prefer islands'), option(0, 'لا، أفضل اليابسة المتصلة', 'No, I prefer mainland destinations'), option(50, 'لا فرق', 'No preference'),
    ]),
    sharedQuestion(`${purpose}-safety`, 'safety', 'importance', 11, 'ما مدى أهمية انخفاض مؤشرات الجريمة العنيفة؟', 'How important are lower violent-crime indicators?', [
      option(25, 'أهمية محدودة', 'Low importance'), option(50, 'مهم', 'Important'), option(75, 'مهم جدًا', 'Very important'), option(100, 'أولوية قصوى', 'Top priority'),
    ]),
    sharedQuestion(`${purpose}-metric`, metric.key, 'importance', 10, metric.ar, metric.en, [
      option(25, 'عامل ثانوي', 'Secondary factor'), option(50, 'مهم', 'Important'), option(75, 'مهم جدًا', 'Very important'), option(100, 'عامل حاسم', 'Decisive factor'),
    ]),
  ];
  return [root, ...subregionQuestions, ...contextQuestions, ...shared];
}

const purposes: PurposeId[] = ['tourism', 'work', 'education', 'medical', 'immigration', 'investment', 'wellness', 'other'];
export const QUESTION_BANKS: QuestionBanks = Object.fromEntries(purposes.map((purpose) => [purpose, buildBank(purpose)])) as QuestionBanks;
export const CLIMATE_COMPAT: ClimateCompat = climateCompatJson as ClimateCompat;
