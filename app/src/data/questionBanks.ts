import climateCompatJson from './generated/climateCompat.json';
import type { ClimateCompat, LocalizedText, PurposeId, Question, QuestionBanks, QuestionOption, RecommendationProfileKey } from './types';

const text = (ar: string, en: string): LocalizedText => ({ ar, en });
const option = (value: string | number, ar: string, en: string, descAr?: string, descEn?: string): QuestionOption => ({
  value,
  label: text(ar, en),
  ...(descAr && descEn ? { desc: text(descAr, descEn) } : {}),
});

// ---------------------------------------------------------------------------
// Item #9 — full purpose-specific question audit.
//
// What was wrong: all eight purposes shared ONE fixed list of dimensions.
// The previous pass reworded some of them but changed nothing about WHICH
// questions each purpose asks, so Education still asked "do you want the sea
// to be a central part of this experience?" and "would you prefer the study
// destination to be an island?" — questions that cannot earn their place for
// someone choosing where to study. Rewording that one string, as the user
// notes, would not have fixed the class of problem.
//
// What this is instead: every purpose declares its OWN ordered dimension
// list (PURPOSE_DIMENSIONS), and every dimension declares purpose-specific
// wording (DIMENSIONS[...].text). A dimension a purpose does not list is
// simply never asked for that purpose. Nothing about Phase 14 changes: the
// canonical option values, kinds, weights, scales and profileKeys are the
// same ones the ranking engine already supports, and no new scoring
// dimension is introduced.
//
// Two structural bugs are fixed on the way through:
//   - tourism's "metric" question scored profileKey 'popularity', which its
//     own popularity question already scored. scoreDestination() de-dupes by
//     profileKey and selectNextQuestion() skips an already-asked dimension,
//     so that question could never be reached or scored — a dead entry
//     inflating the bank. Tourism's importance question now uses 'health'
//     (real indicator data, genuinely relevant while travelling).
//   - the same duplicate would have applied to any purpose whose metric key
//     collided with a listed target dimension; PURPOSE_DIMENSIONS is a set
//     keyed by profileKey, so a collision is now impossible by construction
//     and is asserted in questionBanks.audit.test.ts.
// ---------------------------------------------------------------------------

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

/** Local dimension identifier — the question-id suffix and the key used by
 *  PURPOSE_DIMENSIONS. Distinct from RecommendationProfileKey only because
 *  'proximity' is not a profile key at all (it is scored from real distance,
 *  not from a profile value). */
type DimensionId =
  | 'proximity'
  | 'climate'
  | 'cost'
  | 'urbanity'
  | 'coastal'
  | 'island'
  | 'size'
  | 'popularity'
  | 'safety'
  | 'income'
  | 'opportunity'
  | 'health'
  | 'education'
  | 'investment'
  | 'growth';

interface DimensionSpec {
  profileKey?: RecommendationProfileKey;
  kind: Question['kind'];
  weight: number;
  scale?: number;
  options: (purpose: PurposeId) => QuestionOption[];
  /** Purpose-specific question wording. Every purpose that lists the
   *  dimension must have an entry — enforced at module load below, so a new
   *  purpose/dimension pairing cannot ship with tourism wording by accident. */
  text: Partial<Record<PurposeId, LocalizedText>> & { fallback?: (purpose: PurposeId) => LocalizedText };
}

// --- shared option sets (canonical values, unchanged) -----------------------

const climateOptions = (): QuestionOption[] => [
  option('cold', 'بارد وقد يكون ثلجيًا', 'Cold and possibly snowy'),
  option('temperate', 'معتدل يميل للبرودة', 'Cool and temperate'),
  option('mediterranean', 'دافئ ومعتدل', 'Warm and mild'),
  option('tropical', 'دافئ ورطب أو ممطر', 'Warm, humid, or rainy'),
  option('desert', 'حار وجاف', 'Hot and dry'),
];

// The canonical approximate SAR ranges are preserved exactly — only the
// question STEM varies by purpose (see DIMENSIONS.cost.text).
const costOptions = (): QuestionOption[] => [
  option(1, 'حتى 5,000 ريال', 'Up to 5,000 SAR'),
  option(2, '5,000 – 10,000 ريال', '5,000 – 10,000 SAR'),
  option(3, '10,000 – 20,000 ريال', '10,000 – 20,000 SAR'),
  option(4, 'أكثر من 20,000 ريال', 'More than 20,000 SAR'),
];

const importanceOptions = (): QuestionOption[] => [
  option(25, 'عامل ثانوي', 'A secondary factor'),
  option(50, 'مهم', 'Important'),
  option(75, 'مهم جدًا', 'Very important'),
  option(100, 'عامل حاسم', 'A deciding factor'),
];

const yesNoEitherOptions = (yesAr: string, yesEn: string, noAr: string, noEn: string): QuestionOption[] => [
  option(100, yesAr, yesEn),
  option(0, noAr, noEn),
  option(50, 'لا فرق لدي', 'No preference'),
];

// --- the dimension catalogue ------------------------------------------------

const DIMENSIONS: Record<DimensionId, DimensionSpec> = {
  proximity: {
    kind: 'proximity',
    weight: 12,
    options: (purpose) => [
      option(
        100,
        'نعم، القرب مهم',
        'Yes, proximity matters',
        'سنستخدم الموقع الذي سمحت به لحساب القرب.',
        'We will use the location you allowed to calculate proximity.',
      ),
      option(
        0,
        'لا، المسافة لا تهمني',
        'No, distance does not matter',
        purpose === 'immigration' ? 'لن تؤثر المسافة في الترتيب.' : 'لن تؤثر المسافة في التوصيات.',
        'Distance will not affect your recommendations.',
      ),
    ],
    text: {
      fallback: (purpose) =>
        text(
          `هل يهمك أن تكون ${DESTINATION_WORDS[purpose].ar} قريبة من موقعك الحالي؟`,
          `Does it matter that ${DESTINATION_WORDS[purpose].en} is close to your current location?`,
        ),
    },
  },

  climate: {
    profileKey: 'climate',
    kind: 'climate',
    weight: 12,
    options: climateOptions,
    text: {
      tourism: text('أي طقس تفضّله خلال رحلتك؟', 'Which weather do you prefer for your trip?'),
      work: text('أي مناخ يناسبك للحياة اليومية أثناء العمل؟', 'Which climate suits your day-to-day life while working?'),
      education: text('أي مناخ تفضّله طوال سنة دراسية كاملة؟', 'Which climate would you prefer across a full academic year?'),
      medical: text('أي مناخ تفضّله لفترة العلاج والتعافي؟', 'Which climate would you prefer for treatment and recovery?'),
      immigration: text('أي مناخ تريد أن تعيش فيه على المدى الطويل؟', 'Which climate would you want to live in long term?'),
      investment: text('هل يهمك مناخ معيّن للسوق الذي تستثمر فيه (عقار، ضيافة، زراعة)؟', 'Does a particular climate matter for the market you would invest in (property, hospitality, agriculture)?'),
      wellness: text('أي طقس يساعدك على الاسترخاء أكثر؟', 'Which weather helps you relax most?'),
      other: text('أي طقس تفضّله خلال فترة إقامتك؟', 'Which weather do you prefer for most of your time there?'),
    },
  },

  cost: {
    profileKey: 'costLevel',
    kind: 'target',
    weight: 14,
    scale: 4,
    options: costOptions,
    text: {
      tourism: text('ما ميزانيتك التقريبية الإجمالية للرحلة؟', 'What is your approximate total budget for the trip?'),
      work: text('ما مستوى الإنفاق الشهري الذي يناسبك؟', 'What monthly spending level suits you?'),
      education: text('ما مستوى الإنفاق الشهري الذي يناسبك أثناء الدراسة؟', 'What monthly spending level suits you while studying?'),
      medical: text('ما مستوى الإنفاق التقريبي الذي يناسبك لهذه الرحلة العلاجية؟', 'What approximate spending level suits you for this medical trip?'),
      immigration: text('ما مستوى الإنفاق الشهري الذي يناسبك للمعيشة هناك؟', 'What monthly spending level suits you for living there?'),
      investment: text('ما مستوى الأسعار الذي تفضّله في السوق المستهدف؟', 'What price level do you prefer in the target market?'),
      wellness: text('ما ميزانيتك التقريبية الإجمالية لهذه الإقامة؟', 'What is your approximate total budget for this stay?'),
      other: text('ما مستوى الإنفاق الذي يناسبك؟', 'What spending level suits you?'),
    },
  },

  urbanity: {
    profileKey: 'urbanity',
    kind: 'target',
    weight: 10,
    options: (purpose) => {
      if (purpose === 'work' || purpose === 'investment') {
        return [
          option(15, 'مناطق صغيرة وهادئة بعيدًا عن المراكز', 'Small, quiet areas away from the main centers'),
          option(40, 'مدن متوسطة بتكاليف أقل', 'Mid-sized cities with lower costs'),
          option(70, 'مزيج من مدينة نشطة ومحيط أهدأ', 'A mix of an active city and quieter surroundings'),
          option(95, 'مركز أعمال كبير ونشط', 'A large, active business hub'),
        ];
      }
      if (purpose === 'education') {
        return [
          option(15, 'بلدة جامعية صغيرة وهادئة', 'A small, quiet university town'),
          option(40, 'مدينة جامعية متوسطة', 'A mid-sized university city'),
          option(70, 'مدينة كبيرة مع مناطق هادئة قريبة', 'A large city with quieter areas nearby'),
          option(95, 'مدينة كبرى بحياة طلابية نشطة', 'A major city with active student life'),
        ];
      }
      if (purpose === 'medical') {
        return [
          option(15, 'مكان هادئ بعيد عن ازدحام المدن', 'A quiet place away from city congestion'),
          option(40, 'مدينة متوسطة يسهل التنقل فيها', 'A mid-sized city that is easy to get around'),
          option(70, 'مدينة كبيرة مع إمكانية الإقامة في محيط أهدأ', 'A large city with the option to stay somewhere quieter'),
          option(95, 'مدينة كبرى فيها مراكز طبية رئيسية', 'A major city with large medical centers'),
        ];
      }
      return [
        option(15, 'بين الطبيعة والريف', 'In nature and rural areas'),
        option(40, 'في بلدات أو مدن هادئة', 'In quiet towns or smaller cities'),
        option(70, 'بين الطبيعة والمدينة', 'A mix of nature and city'),
        option(95, 'في مدينة كبيرة ونشطة', 'In a large, active city'),
      ];
    },
    text: {
      tourism: text('أين تفضّل قضاء معظم وقتك في الرحلة؟', 'Where would you prefer to spend most of your trip?'),
      work: text('أي بيئة عمل ومعيشة تناسبك أكثر؟', 'Which work and living environment suits you best?'),
      education: text('أي بيئة دراسية تناسبك أكثر؟', 'Which study environment suits you best?'),
      medical: text('أي محيط تفضّله أثناء فترة العلاج؟', 'What kind of surroundings would you prefer during treatment?'),
      immigration: text('أين تفضّل أن تسكن على المدى الطويل؟', 'Where would you prefer to live long term?'),
      investment: text('أي نوع من الأسواق المحلية يناسب استثمارك؟', 'Which kind of local market suits your investment?'),
      wellness: text('أين تفضّل قضاء معظم وقتك للاستجمام؟', 'Where would you prefer to spend most of your time unwinding?'),
      other: text('أين تفضّل قضاء معظم وقتك؟', 'Where would you prefer to spend most of your time?'),
    },
  },

  coastal: {
    profileKey: 'coastal',
    kind: 'target',
    weight: 11,
    options: () =>
      yesNoEitherOptions(
        'نعم، أريد شواطئ أو ساحلًا قريبًا',
        'Yes, I want beaches or a nearby coast',
        'لا، أفضل وجهة داخلية',
        'No, I prefer an inland destination',
      ),
    text: {
      tourism: text('هل تريد أن يكون البحر جزءًا أساسيًا من رحلتك؟', 'Do you want the sea to be a central part of your trip?'),
      immigration: text('هل تفضّل العيش قريبًا من الساحل؟', 'Would you prefer to live near the coast?'),
      wellness: text('هل تريد أن يكون البحر جزءًا أساسيًا من هذه الإقامة؟', 'Do you want the sea to be a central part of this stay?'),
      other: text('هل تريد أن يكون البحر جزءًا أساسيًا من هذه التجربة؟', 'Do you want the sea to be a central part of this experience?'),
    },
  },

  island: {
    profileKey: 'island',
    kind: 'target',
    weight: 5,
    options: () =>
      yesNoEitherOptions('نعم، أفضل الجزر', 'Yes, I prefer islands', 'لا، أفضل وجهة متصلة باليابسة', 'No, I prefer a mainland destination'),
    text: {
      tourism: text('هل تفضّل أن تكون الوجهة السياحية في جزيرة؟', 'Would you prefer the holiday destination to be an island?'),
      wellness: text('هل تفضّل أن تكون وجهة الاستجمام في جزيرة؟', 'Would you prefer the wellness destination to be an island?'),
      other: text('هل تفضّل أن تكون الوجهة في جزيرة؟', 'Would you prefer the destination to be an island?'),
    },
  },

  size: {
    profileKey: 'size',
    kind: 'target',
    weight: 6,
    options: (purpose) => {
      if (purpose === 'work' || purpose === 'education' || purpose === 'immigration') {
        return [
          option(10, 'دولة صغيرة يسهل التنقل داخلها', 'A compact country that is easy to move around'),
          option(40, 'دولة متوسطة بعدة مدن رئيسية', 'A mid-sized country with several main cities'),
          option(70, 'دولة كبيرة بمدن ومناطق متعددة', 'A large country with many cities and regions'),
          option(95, 'دولة شاسعة بأقاليم مختلفة تمامًا', 'A vast country with very different regions'),
        ];
      }
      if (purpose === 'medical') {
        return [
          option(10, 'دولة صغيرة، تنقل داخلي أقصر إلى المركز الطبي', 'A compact country, with shorter internal travel to the facility'),
          option(40, 'دولة متوسطة بعدة مراكز طبية', 'A mid-sized country with several medical centers'),
          option(70, 'دولة كبيرة بخيارات علاجية متعددة', 'A large country with many treatment options'),
          option(95, 'لا يهمني حجم الدولة', 'The size of the country does not matter to me'),
        ];
      }
      if (purpose === 'investment') {
        return [
          option(10, 'سوق صغير ومركّز', 'A small, concentrated market'),
          option(40, 'سوق متوسط الحجم', 'A mid-sized market'),
          option(70, 'سوق كبير بمناطق متعددة', 'A large market with multiple regions'),
          option(95, 'سوق ضخم متعدد الأقاليم', 'A very large, multi-region market'),
        ];
      }
      return [
        option(10, 'دولة صغيرة ومسافات أقصر', 'A compact country with shorter distances'),
        option(40, 'مسافات متوسطة وخيارات متنوعة', 'Moderate distances with varied options'),
        option(70, 'دولة كبيرة ومدن ومناطق متعددة', 'A large country with many cities and regions'),
        option(95, 'مساحات شاسعة وتنقّل بين أقاليم مختلفة', 'Vast distances and travel across distinct regions'),
      ];
    },
    text: {
      tourism: text('أي تجربة تنقّل تناسبك أكثر في الرحلة؟', 'Which travel pattern suits your trip better?'),
      work: text('أي حجم دولة يناسب حياتك العملية؟', 'Which country scale suits your working life?'),
      education: text('أي حجم دولة يناسبك أثناء الدراسة؟', 'Which country scale suits you while studying?'),
      medical: text('ما مدى أهمية قصر التنقل الداخلي إلى مكان العلاج؟', 'How much does short internal travel to the treatment location matter?'),
      immigration: text('أي حجم دولة تريد أن تعيش فيه؟', 'Which country scale would you want to live in?'),
      investment: text('أي حجم سوق تستهدف؟', 'Which market size are you targeting?'),
      wellness: text('كم تريد أن تتنقل داخل الدولة خلال إقامتك؟', 'How much do you want to move around inside the country during your stay?'),
      other: text('أي حجم دولة يناسبك؟', 'Which country scale suits you?'),
    },
  },

  popularity: {
    profileKey: 'popularity',
    kind: 'target',
    weight: 8,
    options: (purpose) => {
      if (purpose === 'wellness') {
        return [
          option(10, 'وجهة منعزلة وقليلة الزوار', 'A secluded destination with few visitors'),
          option(40, 'وجهة هادئة ومعروفة قليلًا', 'A quiet, lesser-known destination'),
          option(70, 'وجهة معروفة بخيارات إقامة جيدة', 'A well-known destination with good places to stay'),
          option(95, 'وجهة استجمام عالمية الشهرة', 'A globally famous wellness destination'),
        ];
      }
      return [
        option(10, 'غير مشهورة وبعيدة عن المسارات المعتادة', 'Little-known and away from usual routes'),
        option(40, 'معروفة قليلًا وهادئة غالبًا', 'Somewhat known and generally quiet'),
        option(70, 'معروفة وتوفر خيارات كثيرة', 'Well-known with many options'),
        option(95, 'وجهة عالمية شديدة الشهرة', 'A globally famous destination'),
      ];
    },
    text: {
      tourism: text('ما مستوى الشهرة السياحية الذي ترتاح له؟', 'What level of tourism popularity are you most comfortable with?'),
      wellness: text('هل تفضّل مكانًا منعزلًا أم وجهة استجمام معروفة؟', 'Would you prefer somewhere secluded, or a well-known wellness destination?'),
      other: text('ما نوع الوجهة الذي ترتاح له أكثر؟', 'Which type of destination suits you best?'),
    },
  },

  safety: {
    profileKey: 'safety',
    kind: 'importance',
    weight: 11,
    options: importanceOptions,
    text: {
      tourism: text('كم يهمك انخفاض معدل الجرائم العنيفة في وجهة رحلتك؟', 'How important is a low violent-crime rate at your trip destination?'),
      work: text('كم يهمك انخفاض معدل الجرائم العنيفة في دولة العمل؟', 'How important is a low violent-crime rate in the country you would work in?'),
      education: text('كم يهمك انخفاض معدل الجرائم العنيفة في مدينة الدراسة؟', 'How important is a low violent-crime rate where you would study?'),
      medical: text('كم يهمك انخفاض معدل الجرائم العنيفة في وجهة العلاج؟', 'How important is a low violent-crime rate at the medical destination?'),
      immigration: text('كم يهمك انخفاض معدل الجرائم العنيفة في الدولة التي ستعيش فيها؟', 'How important is a low violent-crime rate in the country you would live in?'),
      investment: text('كم يهمك استقرار الأمن في السوق المستهدف؟', 'How important is a stable security situation in the target market?'),
      wellness: text('كم يهمك انخفاض معدل الجرائم العنيفة في وجهة الاستجمام؟', 'How important is a low violent-crime rate at the wellness destination?'),
      other: text('كم يهمك انخفاض معدل الجرائم العنيفة في الوجهة؟', 'How important is a low violent-crime rate at the destination?'),
    },
  },

  income: {
    profileKey: 'income',
    kind: 'importance',
    weight: 10,
    options: importanceOptions,
    text: {
      work: text('ما مدى أهمية ارتفاع مستوى الدخل في الدولة؟', 'How important is a high income level in the country?'),
      medical: text('ما مدى أهمية أن تكون الدولة مرتفعة الدخل (بنية تحتية طبية أفضل تمويلًا)؟', 'How important is a high-income country (better-funded medical infrastructure)?'),
      immigration: text('ما مدى أهمية ارتفاع مستوى الدخل والرفاه الاقتصادي؟', 'How important are income levels and economic well-being?'),
      investment: text('ما مدى أهمية ارتفاع مستوى دخل السوق المستهدف؟', 'How important is a high income level in the target market?'),
    },
  },

  opportunity: {
    profileKey: 'opportunity',
    kind: 'importance',
    weight: 10,
    options: importanceOptions,
    text: {
      work: text('ما مدى أهمية قوة فرص العمل في الدولة؟', 'How important are strong job opportunities?'),
      education: text('ما مدى أهمية توفر فرص عمل بعد التخرج؟', 'How important are job opportunities after graduating?'),
      investment: text('ما مدى أهمية قوة سوق العمل في السوق المستهدف؟', 'How important is a strong labour market in the target market?'),
    },
  },

  health: {
    profileKey: 'health',
    kind: 'importance',
    weight: 10,
    options: importanceOptions,
    text: {
      tourism: text('ما مدى أهمية قوة المؤشرات الصحية أثناء السفر؟', 'How important are strong health indicators while travelling?'),
      work: text('ما مدى أهمية قوة النظام الصحي حيث ستعيش وتعمل؟', 'How important is a strong health system where you would live and work?'),
      education: text('ما مدى أهمية سهولة الوصول إلى رعاية صحية جيدة أثناء الدراسة؟', 'How important is access to good healthcare while studying?'),
      medical: text('ما مدى أهمية قوة النظام الصحي في الدولة؟', 'How important is the country’s overall health system?'),
      immigration: text('ما مدى أهمية قوة النظام الصحي لك ولعائلتك؟', 'How important is a strong health system for you and your family?'),
      wellness: text('ما مدى أهمية قوة المؤشرات الصحية العامة؟', 'How important are strong public-health indicators?'),
    },
  },

  education: {
    profileKey: 'education',
    kind: 'importance',
    weight: 10,
    options: importanceOptions,
    text: {
      education: text('ما مدى أهمية قوة مؤشرات التعليم العالي؟', 'How important are strong higher-education indicators?'),
      immigration: text('ما مدى أهمية قوة مؤشرات التعليم لك أو لعائلتك؟', 'How important are strong education indicators for you or your family?'),
    },
  },

  investment: {
    profileKey: 'investment',
    kind: 'importance',
    weight: 10,
    options: importanceOptions,
    text: {
      investment: text('ما مدى أهمية نشاط الاستثمار الأجنبي في الدولة؟', 'How important is active foreign investment in the country?'),
    },
  },

  growth: {
    profileKey: 'growth',
    kind: 'importance',
    weight: 10,
    options: importanceOptions,
    text: {
      work: text('ما مدى أهمية أن يكون اقتصاد الدولة في نمو حاليًا؟', 'How important is it that the country’s economy is currently growing?'),
      investment: text('ما مدى أهمية النمو الاقتصادي الحالي للسوق؟', 'How important is the market’s current economic growth?'),
      other: text('هل يهمك أن تكون الوجهة في اقتصاد ينمو حاليًا؟', 'How important is current economic growth at the destination?'),
    },
  },
};

// --- which dimensions each purpose actually asks ---------------------------
//
// Order matters: it is the order a purpose's bank is built in, and
// selectNextQuestion() falls back to bank[0] for the opening question.
// Proximity leads wherever it is present (it is location-gated, so it is
// filtered out again by effectiveQuestionBank when there is no location).
//
// A dimension is listed ONLY where it changes a real, defensible answer for
// that purpose. The omissions are the point of item #9:
//   - coastal / island: not asked for work, education, medical or
//     investment. "Do you want the sea to be central to this experience?"
//     is not a question about where to study, work, be treated, or invest.
//   - popularity (tourism arrivals): not asked outside leisure purposes —
//     how many tourists a country receives says nothing useful about it as
//     a place to study, work, be treated, live, or invest.
//   - island: also dropped for immigration; the coastal preference already
//     covers "near the sea" for somewhere to live, and island status is a
//     leisure characteristic rather than a relocation one.
// Each purpose keeps at least eight dimensions, so the questionnaire stays
// as discriminating as before — irrelevant dimensions were replaced by
// relevant ones, not merely deleted.
const PURPOSE_DIMENSIONS: Record<PurposeId, DimensionId[]> = {
  tourism: ['proximity', 'climate', 'cost', 'urbanity', 'coastal', 'size', 'island', 'popularity', 'safety', 'health'],
  work: ['proximity', 'climate', 'cost', 'urbanity', 'size', 'safety', 'opportunity', 'income', 'growth', 'health'],
  education: ['proximity', 'climate', 'cost', 'urbanity', 'size', 'safety', 'education', 'opportunity', 'health'],
  medical: ['proximity', 'climate', 'cost', 'urbanity', 'size', 'safety', 'health', 'income'],
  immigration: ['proximity', 'climate', 'cost', 'urbanity', 'coastal', 'size', 'safety', 'income', 'health', 'education'],
  investment: ['proximity', 'climate', 'cost', 'urbanity', 'size', 'safety', 'investment', 'growth', 'income', 'opportunity'],
  wellness: ['proximity', 'climate', 'cost', 'urbanity', 'coastal', 'size', 'island', 'popularity', 'safety', 'health'],
  other: ['proximity', 'climate', 'cost', 'urbanity', 'coastal', 'size', 'island', 'popularity', 'safety', 'growth'],
};

function questionId(purpose: PurposeId, dimension: DimensionId): string {
  return `${purpose}-${dimension}`;
}

function wordingFor(dimension: DimensionId, purpose: PurposeId): LocalizedText {
  const spec = DIMENSIONS[dimension];
  const specific = spec.text[purpose];
  if (specific) return specific;
  if (spec.text.fallback) return spec.text.fallback(purpose);
  // Unreachable in a correct configuration, and asserted in
  // questionBanks.audit.test.ts: a purpose must never inherit another
  // purpose's wording by accident, which is exactly how Education came to
  // ask a tourism question in the first place.
  throw new Error(`Missing ${dimension} wording for purpose "${purpose}"`);
}

function buildQuestion(purpose: PurposeId, dimension: DimensionId): Question {
  const spec = DIMENSIONS[dimension];
  return {
    id: questionId(purpose, dimension),
    ...(spec.profileKey ? { profileKey: spec.profileKey } : {}),
    kind: spec.kind,
    weight: spec.weight,
    text: wordingFor(dimension, purpose),
    options: spec.options(purpose),
    ...(spec.scale ? { scale: spec.scale } : {}),
  } as Question;
}

function buildBank(purpose: PurposeId): Question[] {
  const dimensions = PURPOSE_DIMENSIONS[purpose];
  const questions = dimensions.map((dimension) => buildQuestion(purpose, dimension));
  // Proximity keeps its explicit branch: answering it routes straight to
  // climate or cost, which every purpose asks.
  const proximity = questions.find((question) => question.kind === 'proximity');
  if (proximity) {
    proximity.nextByValue = {
      '100': questionId(purpose, 'climate'),
      '0': questionId(purpose, 'cost'),
    };
  }
  return questions;
}

const purposes: PurposeId[] = ['tourism', 'work', 'education', 'medical', 'immigration', 'investment', 'wellness', 'other'];
export const QUESTION_BANKS: QuestionBanks = Object.fromEntries(purposes.map((purpose) => [purpose, buildBank(purpose)])) as QuestionBanks;

/** The dimension list a purpose asks, exposed for the audit test and for
 *  anything that needs to reason about coverage without re-deriving it from
 *  question ids. */
export const PURPOSE_DIMENSION_IDS: Record<PurposeId, readonly string[]> = PURPOSE_DIMENSIONS;

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

/** Item #8 — question KINDS whose answer is only meaningful relative to the
 *  user's real current position. Asking any of these without location
 *  context invites an answer the app then cannot honour: the previous build
 *  asked "does it matter that the destination is close to your current
 *  location?" before any location permission existed, and a "yes" silently
 *  did nothing. These are appended to a purpose's bank only when there IS
 *  location context, and stripped from questionnaire state when it goes away
 *  (see state/reducer.ts). */
const LOCATION_DEPENDENT_KINDS: ReadonlySet<Question['kind']> = new Set(['proximity', 'landBorder']);

/** True for a question id that belongs to a location-dependent question, for
 *  any purpose. Id-based (rather than object-based) because the reducer has
 *  to make this call about ids already recorded in `path`/`answers`, whose
 *  question objects may no longer be in the effective bank at all. */
export function isLocationDependentQuestionId(id: string): boolean {
  const suffix = id.slice(id.indexOf('-') + 1);
  return suffix === 'proximity' || suffix === 'landBorder';
}

/** The question bank actually shown to the user for a purpose: the fixed
 *  bank, minus any location-dependent question, plus (when there IS location
 *  context) proximity in its original leading position and the optional
 *  land-travel question at the end. Both the reducer (path/advance) and
 *  Quiz.tsx must use this instead of reading QUESTION_BANKS[purpose]
 *  directly, so a question's presence stays consistent across the whole quiz
 *  flow. QUESTION_BANKS itself deliberately still CONTAINS proximity: the
 *  scoring engine looks questions up there by id, and a question that is not
 *  asked simply has no answer to score. */
export function effectiveQuestionBank(purpose: PurposeId, hasLocation: boolean): Question[] {
  const bank = QUESTION_BANKS[purpose];
  if (!hasLocation) return bank.filter((question) => !LOCATION_DEPENDENT_KINDS.has(question.kind));
  return [...bank, landBorderQuestion(purpose)];
}
export const CLIMATE_COMPAT: ClimateCompat = climateCompatJson as ClimateCompat;
