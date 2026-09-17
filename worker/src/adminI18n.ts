// Admin dashboard localization — Arabic / English.
//
// ARCHITECTURAL NOTE ON "REUSE THE EXISTING I18N SYSTEM": the public app's
// i18n (app/src/data/i18n/*) is a set of TypeScript modules imported into a
// React bundle built by Vite. The admin dashboard is a single self-contained
// HTML document that this Worker generates and returns per-request (see
// adminPage.ts's own header comment on why: no CDN, no build step, works
// behind Cloudflare Access, tight CSP). Its client-side script is a plain
// string of browser JS with no import capability, so the two i18n systems
// cannot literally share a module. What IS reused is the *shape*: a flat
// per-language dictionary object, looked up through one `t()` helper — the
// same pattern app/src/data/i18n/{ar,en}.ts uses (I18N.ar.section.key). This
// file is the Worker-side twin of that pattern, typed so both languages are
// forced to carry the same keys, and it is the single source of truth: the
// browser-side script never hand-duplicates any string — adminPage.ts
// serializes ADMIN_I18N straight into the page via JSON.stringify.
//
// Deliberately NOT translated here (see the acceptance brief): underlying
// DATA values — country codes, report reference IDs, dates, purpose ids,
// device/locale/browser values shown as table rows, city-description status
// codes. Only UI chrome (labels, headers, hints, buttons, empty/error
// states) and the report WORKFLOW status vocabulary (new/triaged/
// in_progress/resolved/declined), which the brief explicitly calls out, are
// translated. Numbers stay Latin-digit everywhere, in both languages — the
// project-wide rule (see app/src/data/format.ts) — because the admin's own
// `num()` helper formats via `toLocaleString('en-US')` regardless of the
// admin's selected language, unchanged by this feature.
export interface AdminDictionary {
  brand: string;
  subtitle: string;
  langSwitch: { label: string; ar: string; en: string };
  signIn: { title: string; hint: string; tokenLabel: string; submit: string };
  authVia: { access: string; token: string };
  errors: { unauthorized: string; notConfigured: string; requestFailed: string; network: string };
  filters: {
    title: string; hint: string; from: string; to: string; language: string;
    /** Options for the `locale` filter — which language a TRAVELLER used, a
     *  data filter value distinct from the admin dashboard's own language. */
    localeAr: string; localeEn: string;
    device: string; purpose: string; country: string; countryPlaceholder: string;
    minRating: string; maxRating: string; apply: string; clear: string; any: string;
  };
  devices: { mobile: string; tablet: string; desktop: string };
  purposes: {
    tourism: string; work: string; education: string; medical: string;
    immigration: string; investment: string; wellness: string; other: string;
  };
  tabs: {
    overview: string; funnel: string; quality: string; countries: string;
    discovery: string; location: string; reports: string; technical: string; content: string;
    ariaLabel: string;
  };
  common: { loading: string; noData: string; notEnoughTrend: string; dash: string };
  overview: {
    title: string; hint: string; sessions: string; pageViews: string; questionnaireStarts: string;
    completions: string; completionRate: string; completionRateNote: string; resultsViewed: string;
    ratings: string; averageRating: string; averageRatingNote: string; reports: string;
    trendTitle: string; trendHint: string; seriesSessions: string; seriesCompletions: string; seriesRatings: string;
  };
  funnel: {
    title: string; hint: string; avgAnswered: string;
    checkpointPrefix: string; checkpointTookEarly: string; checkpointKeptAnswering: string;
    progressionTitle: string; progressionHint: string; question: string; sessions: string;
    abandonmentTitle: string; abandonmentHint: string; stoppedAfter: string;
    purposeDistTitle: string; purposeDistHint: string; purpose: string; starts: string;
  };
  checkpointChoice: { results: string; continueChoice: string };
  quality: {
    distributionTitle: string; distributionHint: string; score: string; count: string;
    byKindTitle: string; byKindHint: string; kind: string; average: string;
    countryTitle: string; countryHint: string; country: string; ratingsCount: string;
    negativeTitle: string; negativeHint: string; negativeEmpty: string;
    colWhen: string; colKind: string; colScore: string; colCountry: string; colArrivedVia: string; colComment: string;
    setsTitle: string; setsHint: string; setsEmpty: string; colRecommendedSet: string;
    pathTitle: string; pathHint: string; path: string; ratingsLabel: string; answersWord: string; unknownPurpose: string;
  };
  countries: {
    sectionTitle: string; everRecommended: string; everRecommendedNote: string; surpriseOpened: string;
    mostTitle: string; mostHint: string; leastTitle: string; leastHint: string;
    openedTitle: string; openedHint: string; sourceTitle: string; source: string; opens: string; appearances: string;
    surpriseTitle: string; surpriseHint: string; landings: string;
    feedbackTitle: string; feedbackHint: string; feedbackCount: string; countryCol: string;
  };
  discovery: {
    sectionTitle: string; sectionHint: string; searchInteractions: string; searchWithText: string;
    filterResets: string; surpriseSpins: string; surpriseSessions: string;
    filtersTitle: string; filter: string; changes: string;
    sortTitle: string; sort: string; uses: string;
    distanceTitle: string; distanceHint: string;
    regionTitle: string; region: string;
  };
  location: {
    sectionTitle: string; sectionHint: string; asked: string; granted: string; grantRate: string;
    permissionTitle: string; outcome: string; sessionsCount: string;
    requestTitle: string; requestHint: string; requests: string; avgMs: string;
    stageTitle: string; stageHint: string; highAccuracy: string; attempts: string;
    edgeTitle: string; edgeHint: string;
  };
  technical: {
    sectionTitle: string; samples: string; avgTtfb: string; avgDomReady: string; avgLoad: string;
    errorsTitle: string; errorsHint: string; errorKind: string; errorScript: string; count: string;
    browserFamily: string; deviceClass: string; language: string; theme: string; referrer: string;
  };
  content: {
    unavailableTitle: string; unavailableHint: string;
    coverageTitle: string; coverageHint: string; lookedUp: string; verified: string; verifiedNote: string; countriesSeen: string;
    statusTitle: string; statusHint: string; status: string; cities: string;
    langTitle: string; lang: string; verifiedCol: string; lookedUpCol: string;
  };
  intelligence: {
    title: string; hint: string;
    totalCountries: string; purposesScored: string; generatedAt: string;
    purpose: string; modelVersion: string; sufficientCount: string; averageCoverage: string; highConfidenceCount: string;
  };
  reports: {
    title: string; hint: string; search: string; searchPlaceholder: string;
    status: string; type: string; searchAction: string;
    queueTitle: string; matching: string;
    resultsTitle: string; resultsHint: string; resultsEmpty: string;
    colReference: string; colWhen: string; colType: string; colCountry: string; colMessage: string; colStatus: string;
    open: string;
  };
  reportType: {
    wrong_info: string; image: string; bug: string; suggestion: string;
    results: string; translation: string; other: string;
  };
  reportStatus: { new: string; triaged: string; in_progress: string; resolved: string; declined: string };
  reportDetail: {
    title: string; received: string; type: string; page: string; country: string; language: string;
    contactEmail: string; screenshot: string; statusChanged: string; message: string;
    statusLabel: string; noteLabel: string; save: string; close: string;
  };
}

export const ADMIN_EN: AdminDictionary = {
  brand: 'Wejhaty — product data',
  subtitle: 'Anonymous product analytics, ratings and reports. No coordinates, no IP addresses, no device fingerprints, no passport data — by schema, not by policy.',
  langSwitch: { label: 'Dashboard language', ar: 'AR', en: 'EN' },
  signIn: { title: 'Sign in', hint: 'Cloudflare Access signs you in automatically when it is configured. Otherwise, use the admin token.', tokenLabel: 'Admin token', submit: 'Open dashboard' },
  authVia: { access: 'Signed in through Cloudflare Access', token: 'Signed in with an admin token' },
  errors: {
    unauthorized: 'Not authorised. Check the admin token, or sign in through Cloudflare Access.',
    notConfigured: 'The admin surface is not configured, or the product database is unavailable.',
    requestFailed: 'Request failed ({status})',
    network: 'Could not reach the server. Check your connection and try again.',
  },
  filters: {
    title: 'Filters', hint: 'Every panel below respects these.', from: 'From', to: 'To', language: 'Language',
    localeAr: 'Arabic', localeEn: 'English',
    device: 'Device', purpose: 'Purpose', country: 'Country (ISO)', countryPlaceholder: 'JP',
    minRating: 'Min rating', maxRating: 'Max rating', apply: 'Apply', clear: 'Clear', any: 'Any',
  },
  devices: { mobile: 'Mobile', tablet: 'Tablet', desktop: 'Desktop' },
  purposes: {
    tourism: 'Tourism', work: 'Work', education: 'Education', medical: 'Medical',
    immigration: 'Immigration', investment: 'Investment', wellness: 'Wellness', other: 'Other',
  },
  tabs: {
    overview: 'Overview', funnel: 'Funnel', quality: 'Recommendation quality', countries: 'Countries',
    discovery: 'Discovery', location: 'Location', reports: 'Reports', technical: 'Technical', content: 'Content',
    ariaLabel: 'Dashboard sections',
  },
  common: { loading: 'Loading…', noData: 'No data in this range.', notEnoughTrend: 'Not enough days in this range to plot a trend.', dash: '—' },
  overview: {
    title: 'Overview', hint: 'Everything below respects the filter bar above.',
    sessions: 'Sessions', pageViews: 'Page views', questionnaireStarts: 'Questionnaire starts',
    completions: 'Completions', completionRate: 'Completion rate', completionRateNote: 'completions ÷ starts',
    resultsViewed: 'Results viewed', ratings: 'Ratings', averageRating: 'Average rating', averageRatingNote: 'out of 5',
    reports: 'Reports', trendTitle: 'Daily trend', trendHint: 'Sessions, completed questionnaires and ratings.',
    seriesSessions: 'Sessions', seriesCompletions: 'Completions', seriesRatings: 'Ratings',
  },
  funnel: {
    title: 'Questionnaire funnel', hint: 'How far people get, and where they stop.',
    avgAnswered: 'Average questions answered', checkpointPrefix: 'Checkpoint',
    checkpointTookEarly: 'took early results', checkpointKeptAnswering: 'kept answering',
    progressionTitle: 'Progression by question', progressionHint: 'Distinct sessions that answered each question number.',
    question: 'Question', sessions: 'Sessions',
    abandonmentTitle: 'Abandonment point', abandonmentHint: 'Last question answered by sessions that never reached results.',
    stoppedAfter: 'Stopped after question',
    purposeDistTitle: 'Purpose distribution', purposeDistHint: 'Which purpose people chose to start with.',
    purpose: 'Purpose', starts: 'Starts',
  },
  checkpointChoice: { results: 'results', continueChoice: 'continue' },
  quality: {
    distributionTitle: 'Rating distribution', distributionHint: 'All ratings in range, by score.', score: 'Score', count: 'Count',
    byKindTitle: 'By rating kind', byKindHint: 'A results rating covers a whole recommendation set; a destination rating covers one country.',
    kind: 'Kind', average: 'Average',
    countryTitle: 'Country ratings', countryHint: 'Lowest average first — the countries whose pages disappoint.',
    country: 'Country', ratingsCount: 'Ratings',
    negativeTitle: 'What people said when they rated low', negativeHint: 'Scores of 1 or 2 that came with a written comment. This is the closest thing to a reason the product collects.',
    negativeEmpty: 'No low ratings with a written comment in this range.',
    colWhen: 'When', colKind: 'Kind', colScore: 'Score', colCountry: 'Country', colArrivedVia: 'Arrived via', colComment: 'Comment',
    setsTitle: 'Recommendation sets behind a poor rating', setsHint: 'Which countries were on screen when someone rated the results 1 or 2.',
    setsEmpty: 'No poorly-rated recommendation sets in this range.', colRecommendedSet: 'Recommended set',
    pathTitle: 'Questionnaire path behind a rating', pathHint: 'Purpose and how many questions were answered — no identity, and nothing narrower.',
    path: 'Path', ratingsLabel: 'Ratings', answersWord: 'answers', unknownPurpose: 'unknown',
  },
  countries: {
    sectionTitle: 'Country performance', everRecommended: 'Countries ever recommended', everRecommendedNote: 'out of 194 in the catalog',
    surpriseOpened: 'Surprise Me results opened',
    mostTitle: 'Most recommended', mostHint: 'Appearances in a generated top-5.',
    leastTitle: 'Least recommended', leastHint: 'Countries that DID appear, ranked from the rarest up. A country missing from both tables was never recommended at all in this range.',
    openedTitle: 'Most opened', openedHint: 'Destination pages actually opened.',
    sourceTitle: 'How people arrive at a destination page', source: 'Source', opens: 'Opens', appearances: 'Appearances',
    surpriseTitle: 'Surprise Me appearances', surpriseHint: 'Countries the wheel actually landed on.', landings: 'Landings',
    feedbackTitle: 'Country reports', feedbackHint: 'Reports filed against a specific country page.', feedbackCount: 'Reports', countryCol: 'Country',
  },
  discovery: {
    sectionTitle: 'Discovery', sectionHint: 'How people move through Explore.',
    searchInteractions: 'Search interactions', searchWithText: 'Searches with text', filterResets: 'Filter resets',
    surpriseSpins: 'Surprise spins', surpriseSessions: 'Sessions that span',
    filtersTitle: 'Which filters get used', filter: 'Filter', changes: 'Changes',
    sortTitle: 'Sort usage', sort: 'Sort', uses: 'Uses',
    distanceTitle: 'Nearest / farthest usage', distanceHint: 'The two sorts that need a shared location to work.',
    regionTitle: 'Region filter usage', region: 'Region',
  },
  location: {
    sectionTitle: 'Location', sectionHint: 'Whether the feature works — never where anyone is. No coordinate is stored, sent or shown anywhere in this dashboard.',
    asked: 'Sessions that asked', granted: 'Sessions that granted', grantRate: 'Grant rate',
    permissionTitle: 'Permission outcome', outcome: 'Outcome', sessionsCount: 'Sessions',
    requestTitle: 'Request outcome and duration', requestHint: 'Error category and how long the request took.', requests: 'Requests', avgMs: 'Average ms',
    stageTitle: 'Two-stage request', stageHint: 'Stage one is coarse and cached; stage two escalates to GPS only after a timeout or an unavailable position.',
    highAccuracy: 'High accuracy', attempts: 'Attempts',
    edgeTitle: 'Coarse country', edgeHint: 'The country Cloudflare attaches at the edge. Country-level only, and the only geography in this dashboard.',
  },
  technical: {
    sectionTitle: 'Technical quality', samples: 'Performance samples', avgTtfb: 'Avg TTFB', avgDomReady: 'Avg DOM ready', avgLoad: 'Avg load',
    errorsTitle: 'Frontend error categories', errorsHint: 'Error name and the script it came from. No message text and no stack — those can carry user content.',
    errorKind: 'Kind', errorScript: 'Script', count: 'Count',
    browserFamily: 'Browser family', deviceClass: 'Device / viewport class', language: 'Language', theme: 'Theme', referrer: 'Referrer origin',
  },
  content: {
    unavailableTitle: 'City descriptions', unavailableHint: 'The description cache table is not present yet — apply migration 0003.',
    coverageTitle: 'City description coverage', coverageHint: 'Real coverage from the cache — not an estimate. A city is only counted as covered when an article was found AND its own coordinates matched the city.',
    lookedUp: 'Cities looked up', verified: 'With a verified description', verifiedNote: '% of those looked up', countriesSeen: 'Countries seen',
    statusTitle: 'Why a city has no description', statusHint: 'wrong_place means an article existed but was about somewhere else; ambiguous means a disambiguation page.',
    status: 'Status', cities: 'Cities',
    langTitle: 'By language', lang: 'Language', verifiedCol: 'Verified', lookedUpCol: 'Looked up',
  },
  intelligence: {
    title: 'Country Intelligence health', hint: 'A static, versioned dataset — see COUNTRY_INTELLIGENCE.md. Regenerated by the data pipeline, not live per request.',
    totalCountries: 'Countries covered', purposesScored: 'Purposes scored', generatedAt: 'Last generated',
    purpose: 'Purpose', modelVersion: 'Model version', sufficientCount: 'Sufficient data', averageCoverage: 'Avg. coverage', highConfidenceCount: 'High confidence',
  },
  reports: {
    title: 'Reports and feedback', hint: 'Everything a traveller sent, with a status you can move.',
    search: 'Search', searchPlaceholder: 'message, reference, country', status: 'Status', type: 'Type', searchAction: 'Search',
    queueTitle: 'Queue', matching: 'Matching reports',
    resultsTitle: 'Results', resultsHint: 'Newest first.', resultsEmpty: 'No reports match.',
    colReference: 'Reference', colWhen: 'When', colType: 'Type', colCountry: 'Country', colMessage: 'Message', colStatus: 'Status',
    open: 'Open',
  },
  reportType: { wrong_info: 'wrong info', image: 'image', bug: 'bug', suggestion: 'suggestion', results: 'results', translation: 'translation', other: 'other' },
  reportStatus: { new: 'new', triaged: 'triaged', in_progress: 'in progress', resolved: 'resolved', declined: 'declined' },
  reportDetail: {
    title: 'Report', received: 'Received', type: 'Type', page: 'Page', country: 'Country', language: 'Language',
    contactEmail: 'Contact e-mail (only if they volunteered one)', screenshot: 'Screenshot object', statusChanged: 'Status changed',
    message: 'Message', statusLabel: 'Status', noteLabel: 'Internal note', save: 'Save', close: 'Close',
  },
};

export const ADMIN_AR: AdminDictionary = {
  brand: 'وجهتي — بيانات المنتج',
  subtitle: 'بيانات تحليلية وتقييمات وبلاغات مجهولة المصدر. لا إحداثيات، ولا عناوين IP، ولا بصمات أجهزة، ولا بيانات جواز سفر — بحكم البنية، لا بحكم السياسة فقط.',
  langSwitch: { label: 'لغة لوحة التحكم', ar: 'AR', en: 'EN' },
  signIn: { title: 'تسجيل الدخول', hint: 'يسجّل دخولك Cloudflare Access تلقائيًا عند تفعيله. غير ذلك، استخدم رمز المشرف.', tokenLabel: 'رمز المشرف', submit: 'فتح لوحة التحكم' },
  authVia: { access: 'تم تسجيل الدخول عبر Cloudflare Access', token: 'تم تسجيل الدخول برمز المشرف' },
  errors: {
    unauthorized: 'غير مصرَّح به. تحقق من رمز المشرف، أو سجّل الدخول عبر Cloudflare Access.',
    notConfigured: 'واجهة الإدارة غير مُهيَّأة، أو قاعدة بيانات المنتج غير متاحة.',
    requestFailed: 'فشل الطلب ({status})',
    network: 'تعذّر الوصول إلى الخادم. تحقق من اتصالك وحاول مرة أخرى.',
  },
  filters: {
    title: 'عوامل التصفية', hint: 'كل لوحة أدناه تلتزم بهذه العوامل.', from: 'من', to: 'إلى', language: 'اللغة',
    localeAr: 'العربية', localeEn: 'الإنجليزية',
    device: 'الجهاز', purpose: 'الغرض', country: 'الدولة (ISO)', countryPlaceholder: 'JP',
    minRating: 'أقل تقييم', maxRating: 'أعلى تقييم', apply: 'تطبيق', clear: 'مسح', any: 'أي',
  },
  devices: { mobile: 'جوال', tablet: 'لوحي', desktop: 'حاسوب' },
  purposes: {
    tourism: 'سياحة', work: 'عمل', education: 'تعليم', medical: 'طبي',
    immigration: 'هجرة', investment: 'استثمار', wellness: 'عافية', other: 'أخرى',
  },
  tabs: {
    overview: 'نظرة عامة', funnel: 'مسار الاستبيان', quality: 'جودة التوصيات', countries: 'الدول',
    discovery: 'الاستكشاف', location: 'الموقع', reports: 'البلاغات', technical: 'تقني', content: 'المحتوى',
    ariaLabel: 'أقسام لوحة التحكم',
  },
  common: { loading: 'جارٍ التحميل…', noData: 'لا توجد بيانات ضمن هذا النطاق.', notEnoughTrend: 'لا توجد أيام كافية ضمن هذا النطاق لرسم اتجاه.', dash: '—' },
  overview: {
    title: 'نظرة عامة', hint: 'كل ما يلي يلتزم بشريط عوامل التصفية أعلاه.',
    sessions: 'الجلسات', pageViews: 'مشاهدات الصفحات', questionnaireStarts: 'بدايات الاستبيان',
    completions: 'الإكمالات', completionRate: 'معدّل الإكمال', completionRateNote: 'الإكمالات ÷ البدايات',
    resultsViewed: 'مشاهدات النتائج', ratings: 'التقييمات', averageRating: 'متوسط التقييم', averageRatingNote: 'من 5',
    reports: 'البلاغات', trendTitle: 'الاتجاه اليومي', trendHint: 'الجلسات، الاستبيانات المكتملة، والتقييمات.',
    seriesSessions: 'الجلسات', seriesCompletions: 'الإكمالات', seriesRatings: 'التقييمات',
  },
  funnel: {
    title: 'مسار الاستبيان', hint: 'إلى أي مدى يصل الناس، وأين يتوقفون.',
    avgAnswered: 'متوسط الأسئلة المُجابة', checkpointPrefix: 'نقطة التوقف',
    checkpointTookEarly: 'اختار النتائج المبكرة', checkpointKeptAnswering: 'واصل الإجابة',
    progressionTitle: 'التقدّم حسب السؤال', progressionHint: 'عدد الجلسات المميزة التي أجابت على كل رقم سؤال.',
    question: 'السؤال', sessions: 'الجلسات',
    abandonmentTitle: 'نقطة التوقف عن الإكمال', abandonmentHint: 'آخر سؤال أُجيب عليه في الجلسات التي لم تصل إلى النتائج أبدًا.',
    stoppedAfter: 'توقف بعد السؤال',
    purposeDistTitle: 'توزيع الأغراض', purposeDistHint: 'الغرض الذي اختاره الناس للبدء.',
    purpose: 'الغرض', starts: 'البدايات',
  },
  checkpointChoice: { results: 'النتائج', continueChoice: 'متابعة' },
  quality: {
    distributionTitle: 'توزيع التقييمات', distributionHint: 'كل التقييمات ضمن النطاق، حسب الدرجة.', score: 'الدرجة', count: 'العدد',
    byKindTitle: 'حسب نوع التقييم', byKindHint: 'تقييم النتائج يغطي مجموعة توصيات كاملة؛ تقييم الوجهة يغطي دولة واحدة.',
    kind: 'النوع', average: 'المتوسط',
    countryTitle: 'تقييمات الدول', countryHint: 'الأقل متوسطًا أولًا — الدول التي تخيّب صفحاتها التوقعات.',
    country: 'الدولة', ratingsCount: 'التقييمات',
    negativeTitle: 'ما قاله الناس عند التقييم المنخفض', negativeHint: 'درجات 1 أو 2 مصحوبة بتعليق مكتوب. هذا أقرب شيء لسبب يجمعه المنتج.',
    negativeEmpty: 'لا توجد تقييمات منخفضة مصحوبة بتعليق مكتوب ضمن هذا النطاق.',
    colWhen: 'الوقت', colKind: 'النوع', colScore: 'الدرجة', colCountry: 'الدولة', colArrivedVia: 'طريقة الوصول', colComment: 'التعليق',
    setsTitle: 'مجموعات التوصيات خلف تقييم ضعيف', setsHint: 'الدول التي كانت ظاهرة على الشاشة عندما قيّم أحدهم النتائج بـ1 أو 2.',
    setsEmpty: 'لا توجد مجموعات توصيات ذات تقييم ضعيف ضمن هذا النطاق.', colRecommendedSet: 'المجموعة الموصى بها',
    pathTitle: 'مسار الاستبيان خلف تقييم', pathHint: 'الغرض وعدد الأسئلة المُجابة — بلا هوية، وبلا أي تفصيل أدق.',
    path: 'المسار', ratingsLabel: 'التقييمات', answersWord: 'إجابة', unknownPurpose: 'غير معروف',
  },
  countries: {
    sectionTitle: 'أداء الدول', everRecommended: 'الدول التي أُوصي بها ولو مرة', everRecommendedNote: 'من أصل 194 في الكتالوج',
    surpriseOpened: 'نتائج فاجئني بوجهة المفتوحة',
    mostTitle: 'الأكثر توصية', mostHint: 'الظهور ضمن أفضل 5 نتائج مولَّدة.',
    leastTitle: 'الأقل توصية', leastHint: 'الدول التي ظهرت بالفعل، مرتّبة من الأندر ظهورًا. أي دولة غائبة عن كلا الجدولين لم تُوصَ بها إطلاقًا ضمن هذا النطاق.',
    openedTitle: 'الأكثر فتحًا', openedHint: 'صفحات الوجهات التي فُتحت فعليًا.',
    sourceTitle: 'كيف يصل الناس إلى صفحة الوجهة', source: 'المصدر', opens: 'الفتحات', appearances: 'الظهور',
    surpriseTitle: 'ظهور فاجئني بوجهة', surpriseHint: 'الدول التي استقرت عليها العجلة فعليًا.', landings: 'مرات الاستقرار',
    feedbackTitle: 'بلاغات الدول', feedbackHint: 'بلاغات قُدِّمت على صفحة دولة محددة.', feedbackCount: 'البلاغات', countryCol: 'الدولة',
  },
  discovery: {
    sectionTitle: 'الاستكشاف', sectionHint: 'كيف يتنقّل الناس عبر صفحة استكشف.',
    searchInteractions: 'تفاعلات البحث', searchWithText: 'عمليات بحث بنص', filterResets: 'إعادة ضبط عوامل التصفية',
    surpriseSpins: 'مرات تدوير فاجئني', surpriseSessions: 'جلسات استخدمت فاجئني',
    filtersTitle: 'عوامل التصفية المستخدَمة', filter: 'عامل التصفية', changes: 'التغييرات',
    sortTitle: 'استخدام الترتيب', sort: 'الترتيب', uses: 'مرات الاستخدام',
    distanceTitle: 'استخدام الأقرب / الأبعد', distanceHint: 'نوعا الترتيب اللذان يحتاجان موقعًا مشتركًا ليعملا.',
    regionTitle: 'استخدام عامل تصفية المنطقة', region: 'المنطقة',
  },
  location: {
    sectionTitle: 'الموقع', sectionHint: 'هل الميزة تعمل — لا أين يوجد أي شخص. لا يُخزَّن أي إحداثي أو يُرسَل أو يُعرَض في أي مكان بهذه اللوحة.',
    asked: 'الجلسات التي طلبت', granted: 'الجلسات التي وافقت', grantRate: 'معدّل الموافقة',
    permissionTitle: 'نتيجة طلب الإذن', outcome: 'النتيجة', sessionsCount: 'الجلسات',
    requestTitle: 'نتيجة الطلب ومدته', requestHint: 'فئة الخطأ ومدة الطلب.', requests: 'الطلبات', avgMs: 'المتوسط (مللي ثانية)',
    stageTitle: 'الطلب على مرحلتين', stageHint: 'المرحلة الأولى تقريبية ومخزَّنة مؤقتًا؛ والمرحلة الثانية تصعّد إلى GPS فقط بعد انتهاء المهلة أو تعذّر تحديد الموقع.',
    highAccuracy: 'دقة عالية', attempts: 'المحاولات',
    edgeTitle: 'الدولة التقريبية', edgeHint: 'الدولة التي تحدّدها Cloudflare عند الحافة. على مستوى الدولة فقط، وهي الموقع الجغرافي الوحيد في هذه اللوحة.',
  },
  technical: {
    sectionTitle: 'الجودة التقنية', samples: 'عيّنات الأداء', avgTtfb: 'متوسط TTFB', avgDomReady: 'متوسط جاهزية DOM', avgLoad: 'متوسط التحميل',
    errorsTitle: 'فئات أخطاء الواجهة', errorsHint: 'اسم الخطأ والملف الذي جاء منه. بلا نص الرسالة وبلا تتبّع المكدس — فقد يحملان محتوى المستخدم.',
    errorKind: 'النوع', errorScript: 'الملف', count: 'العدد',
    browserFamily: 'عائلة المتصفح', deviceClass: 'فئة الجهاز / حجم الشاشة', language: 'اللغة', theme: 'المظهر', referrer: 'مصدر الإحالة',
  },
  content: {
    unavailableTitle: 'أوصاف المدن', unavailableHint: 'جدول تخزين الأوصاف غير موجود بعد — طبّق الترحيل 0003.',
    coverageTitle: 'تغطية أوصاف المدن', coverageHint: 'تغطية حقيقية من التخزين المؤقت — وليست تقديرًا. تُحتسب المدينة مغطاة فقط عند العثور على مقال وتطابق إحداثياته الخاصة مع المدينة.',
    lookedUp: 'المدن التي تم البحث عنها', verified: 'بوصف موثّق', verifiedNote: '% من التي بُحث عنها', countriesSeen: 'الدول التي ظهرت',
    statusTitle: 'سبب عدم وجود وصف لمدينة', statusHint: 'wrong_place تعني أن المقال موجود لكنه عن مكان آخر؛ وambiguous تعني صفحة تفريق.',
    status: 'الحالة', cities: 'المدن',
    langTitle: 'حسب اللغة', lang: 'اللغة', verifiedCol: 'موثّق', lookedUpCol: 'تم البحث',
  },
  intelligence: {
    title: 'سلامة معلومات الدول', hint: 'مجموعة بيانات ثابتة وذات إصدار — راجع COUNTRY_INTELLIGENCE.md. تُولَّد بواسطة خط أنابيب البيانات، وليست حية لكل طلب.',
    totalCountries: 'الدول المشمولة', purposesScored: 'الأغراض المقيَّمة', generatedAt: 'آخر توليد',
    purpose: 'الغرض', modelVersion: 'إصدار المنهجية', sufficientCount: 'بيانات كافية', averageCoverage: 'متوسط التغطية', highConfidenceCount: 'ثقة عالية',
  },
  reports: {
    title: 'البلاغات والتغذية الراجعة', hint: 'كل ما أرسله مسافر، مع حالة يمكنك تحريكها.',
    search: 'بحث', searchPlaceholder: 'الرسالة، المرجع، الدولة', status: 'الحالة', type: 'النوع', searchAction: 'بحث',
    queueTitle: 'قائمة الانتظار', matching: 'البلاغات المطابقة',
    resultsTitle: 'النتائج', resultsHint: 'الأحدث أولًا.', resultsEmpty: 'لا توجد بلاغات مطابقة.',
    colReference: 'المرجع', colWhen: 'الوقت', colType: 'النوع', colCountry: 'الدولة', colMessage: 'الرسالة', colStatus: 'الحالة',
    open: 'فتح',
  },
  reportType: { wrong_info: 'معلومة خاطئة', image: 'صورة', bug: 'خلل', suggestion: 'اقتراح', results: 'النتائج', translation: 'ترجمة', other: 'أخرى' },
  reportStatus: { new: 'جديد', triaged: 'قيد الفرز', in_progress: 'قيد المعالجة', resolved: 'تم الحل', declined: 'مرفوض' },
  reportDetail: {
    title: 'البلاغ', received: 'وقت الاستلام', type: 'النوع', page: 'الصفحة', country: 'الدولة', language: 'اللغة',
    contactEmail: 'بريد التواصل (فقط إن تطوّع به)', screenshot: 'كائن لقطة الشاشة', statusChanged: 'وقت تغيير الحالة',
    message: 'الرسالة', statusLabel: 'الحالة', noteLabel: 'ملاحظة داخلية', save: 'حفظ', close: 'إغلاق',
  },
};

export const ADMIN_I18N: { en: AdminDictionary; ar: AdminDictionary } = { en: ADMIN_EN, ar: ADMIN_AR };
