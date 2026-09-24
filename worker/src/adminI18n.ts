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
// Phase 21 — DATA vocabulary is translated too: every enum value the product
// records (rating kinds, arrival sources, location states, themes, locales,
// devices, city-description statuses, Explore filters/sorts/regions/costs)
// renders as a label in the operator's language, never as a raw English
// code in the Arabic UI. Explore's labels are not duplicated here: they come
// from the public site's own i18n through worker/src/generated/
// adminCatalog.json (kept in sync by app/src/data/adminCatalog.sync.test.ts).
// Country codes render as the localized country name (Intl.DisplayNames) with
// the ISO code kept beside it. What stays untranslated is data that has no
// translation: report reference IDs, dates, question IDs, JavaScript error
// names and script file names. Metric labels and definitions live in
// adminMetrics.ts, the authoritative metric dictionary. Numbers stay Latin-digit everywhere, in both languages — the
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
  common: {
    loading: string; noData: string; notEnoughTrend: string; dash: string;
    howCounted: string; openDetails: string; share: string; yes: string; no: string;
    filterToCountry: string; filteredTo: string; daysAgo: string; tableRegion: string;
  };
  metricMeta: {
    definition: string; numerator: string; denominator: string; noDenominator: string; unit: string;
    aggregation: string; window: string; source: string; interpretation: string; limitation: string;
  };
  units: {
    sessions: string; events: string; percent: string; milliseconds: string; score: string; countries: string;
    cityLookups: string; questions: string; position: string; reports: string; ratings: string; date: string;
  };
  aggregations: { count: string; distinctSessions: string; ratio: string; mean: string; distinctCount: string; latest: string };
  windows: { eventTime: string; sessionOverlap: string; createdTime: string; staticSnapshot: string; cacheLifetime: string };
  enums: {
    ratingKind: { results: string; destination: string };
    arrival: { results: string; explore: string; surprise: string; direct: string };
    locationOutcome: {
      idle: string; requesting: string; granted: string; denied: string; unavailable: string;
      timeout: string; unsupported: string; ok: string;
    };
    theme: { light: string; dark: string };
    locale: { ar: string; en: string };
    browser: { Chrome: string; Safari: string; Firefox: string; Edge: string; Other: string };
    contentStatus: { ok: string; no_article: string; ambiguous: string; wrong_place: string; too_short: string; unavailable: string };
    accuracy: { high: string; standard: string };
    outcome: { finished: string; stopped: string; inProgress: string; neverAnswered: string };
    checkpoint: { results: string; continue: string };
    exploreFilterAll: string;
  };
  overview: {
    title: string; hint: string;
    trendTitle: string; trendHint: string; trendAria: string; seriesSessions: string; seriesCompletions: string; seriesRatings: string;
  };
  funnel: {
    title: string; hint: string;
    outcomesTitle: string; outcomesHint: string; outcome: string; sessions: string;
    questionsTitle: string; questionsHint: string; showPurpose: string;
    colOrder: string; colQuestion: string; colPosition: string; colSessions: string; colAnswers: string;
    colCompletedAfter: string; colStopped: string; colStillAnswering: string; colDropOff: string;
    notInCatalog: string; questionId: string;
    positionTitle: string; positionHint: string; position: string; stoppedAfter: string;
    purposeTitle: string; purposeHint: string; purpose: string; picked: string; reached: string; completed: string; completionRate: string;
    checkpointTitle: string; checkpointHint: string; choice: string; events: string;
  };
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
    sectionTitle: string;
    mostTitle: string; mostHint: string; leastTitle: string; leastHint: string;
    openedTitle: string; openedHint: string; opens: string; appearances: string;
    surpriseTitle: string; surpriseHint: string; landings: string;
    feedbackTitle: string; feedbackHint: string; feedbackCount: string; countryCol: string;
  };
  discovery: {
    sectionTitle: string; sectionHint: string;
    openedTitle: string; openedHint: string; source: string; opens: string; sessions: string;
    filtersTitle: string; filtersHint: string; filter: string; changes: string;
    sortTitle: string; sort: string; uses: string;
    distanceTitle: string; distanceHint: string;
    regionTitle: string; region: string; costTitle: string; cost: string; purposeTitle: string; purpose: string;
  };
  location: {
    sectionTitle: string; sectionHint: string;
    permissionTitle: string; permissionHint: string; outcome: string; events: string; sessionsCount: string;
    requestTitle: string; requestHint: string; avgMs: string;
    stageTitle: string; stageHint: string; stage: string; accuracy: string; attempts: string;
    edgeTitle: string; edgeHint: string;
  };
  technical: {
    sectionTitle: string; sectionHint: string;
    errorsTitle: string; errorsHint: string; errorKind: string; errorScript: string; count: string;
    browserFamily: string; deviceClass: string; language: string; theme: string; referrer: string; sessions: string; pageViews: string;
    ms: string;
  };
  content: {
    unavailableTitle: string; unavailableHint: string;
    coverageTitle: string; coverageHint: string;
    statusTitle: string; statusHint: string; status: string; cities: string;
    langTitle: string; lang: string; verifiedCol: string; lookedUpCol: string;
  };
  intelligence: {
    title: string; hint: string; sourceFiles: string; tableTitle: string;
    purpose: string; modelVersion: string; sufficientCount: string; averageCoverage: string; highConfidenceCount: string;
  };
  reports: {
    title: string; hint: string; search: string; searchPlaceholder: string;
    status: string; type: string; screenshot: string; screenshotYes: string; screenshotNo: string; searchAction: string;
    queueTitle: string; byType: string;
    resultsTitle: string; resultsHint: string; resultsEmpty: string;
    colReference: string; colWhen: string; colType: string; colCountry: string; colMessage: string; colStatus: string; colScreenshot: string;
    open: string;
    commentsTitle: string; commentsHint: string; commentsEmpty: string; kind: string;
    saving: string; saved: string;
  };
  reportType: {
    wrong_info: string; image: string; bug: string; suggestion: string;
    results: string; translation: string; other: string;
  };
  reportStatus: { new: string; triaged: string; in_progress: string; resolved: string; declined: string };
  reportDetail: {
    title: string; received: string; type: string; page: string; country: string; language: string;
    contactEmail: string; screenshot: string; screenshotAttached: string; screenshotNone: string; statusChanged: string; message: string;
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
    title: 'Filters', hint: 'Every panel below respects these. Data older than 90 days is removed by the retention job.', from: 'From', to: 'To', language: 'Traveller language',
    localeAr: 'Arabic', localeEn: 'English',
    device: 'Device', purpose: 'Purpose', country: 'Country (ISO code)', countryPlaceholder: 'JP',
    minRating: 'Min rating', maxRating: 'Max rating', apply: 'Apply', clear: 'Clear', any: 'Any',
  },
  devices: { mobile: 'Mobile', tablet: 'Tablet', desktop: 'Desktop' },
  purposes: {
    tourism: 'Tourism', work: 'Work', education: 'Education', medical: 'Medical',
    immigration: 'Immigration', investment: 'Investment', wellness: 'Wellness', other: 'Other',
  },
  tabs: {
    overview: 'Overview', funnel: 'Questionnaire', quality: 'Recommendation quality', countries: 'Countries',
    discovery: 'Discovery', location: 'Location', reports: 'Reports and feedback', technical: 'Technical', content: 'Content and data',
    ariaLabel: 'Dashboard sections',
  },
  common: {
    loading: 'Loading…', noData: 'No data in this range.', notEnoughTrend: 'Not enough days in this range to plot a trend.', dash: '—',
    howCounted: 'How is this counted?', openDetails: 'Details', share: 'Share', yes: 'Yes', no: 'No',
    filterToCountry: 'Filter', filteredTo: 'Show only {country}', daysAgo: '{days} days ago', tableRegion: '{title} (scrollable table)',
  },
  metricMeta: {
    definition: 'Definition', numerator: 'Counts', denominator: 'Divided by', noDenominator: 'Nothing — a plain count', unit: 'Unit',
    aggregation: 'Aggregation', window: 'Time window', source: 'Source', interpretation: 'How to read it', limitation: 'Limitation',
  },
  units: {
    sessions: 'sessions', events: 'events', percent: 'percent', milliseconds: 'milliseconds', score: 'score from 1 to 5', countries: 'countries',
    cityLookups: 'city lookups', questions: 'questions', position: 'position in the questionnaire', reports: 'reports', ratings: 'ratings', date: 'date',
  },
  aggregations: {
    count: 'Count', distinctSessions: 'Distinct sessions', ratio: 'Ratio', mean: 'Arithmetic mean', distinctCount: 'Distinct count', latest: 'Latest value',
  },
  windows: {
    eventTime: 'Events whose time falls inside the date filter',
    sessionOverlap: 'Sessions active at any point inside the date filter',
    createdTime: 'Rows created inside the date filter',
    staticSnapshot: 'A bundled snapshot; the date filter does not apply',
    cacheLifetime: 'Everything in the cache; the date filter does not apply',
  },
  enums: {
    ratingKind: { results: 'Results rating', destination: 'Destination rating' },
    arrival: { results: 'From results', explore: 'From Explore', surprise: 'From Surprise Me', direct: 'Other card' },
    locationOutcome: {
      idle: 'Not requested', requesting: 'Asking', granted: 'Granted', denied: 'Denied', unavailable: 'Position unavailable',
      timeout: 'Timed out', unsupported: 'Not supported by the browser', ok: 'Location obtained',
    },
    theme: { light: 'Light', dark: 'Dark' },
    locale: { ar: 'Arabic', en: 'English' },
    browser: { Chrome: 'Chrome', Safari: 'Safari', Firefox: 'Firefox', Edge: 'Edge', Other: 'Other browser' },
    contentStatus: {
      ok: 'Verified description', no_article: 'No article found', ambiguous: 'Ambiguous title (disambiguation page)',
      wrong_place: 'Article about another place', too_short: 'Article too short', unavailable: 'Source unavailable',
    },
    accuracy: { high: 'High accuracy (GPS)', standard: 'Standard (coarse, cached)' },
    outcome: { finished: 'Finished with results', stopped: 'Stopped before results', inProgress: 'Still answering', neverAnswered: 'Picked a purpose, answered nothing' },
    checkpoint: { results: 'Took early results', continue: 'Kept answering' },
    exploreFilterAll: 'Cleared (all)',
  },
  overview: {
    title: 'Overview', hint: 'Everything below respects the filter bar above. Open “How is this counted?” on any figure for its exact definition.',
    trendTitle: 'Daily trend', trendHint: 'New sessions, completed questionnaires and ratings per day.', trendAria: '{series} per day',
    seriesSessions: 'Sessions', seriesCompletions: 'Completed questionnaires', seriesRatings: 'Ratings',
  },
  funnel: {
    title: 'Questionnaire', hint: 'The questionnaire is adaptive: the order of questions depends on earlier answers, so questions are listed by their own ID, with the position they were asked at.',
    outcomesTitle: 'How questionnaire sessions ended', outcomesHint: 'Each questionnaire session appears in exactly one row. “Stopped” means no activity for {minutes} minutes after the last answer.',
    outcome: 'Outcome', sessions: 'Sessions',
    questionsTitle: 'Questions', questionsHint: 'Every question of the selected purpose, in questionnaire order. Drop-off is the share of sessions that answered the question and then left before results.',
    showPurpose: 'Purpose shown',
    colOrder: '#', colQuestion: 'Question', colPosition: 'Asked at position', colSessions: 'Sessions', colAnswers: 'Answer events',
    colCompletedAfter: 'Went on to results', colStopped: 'Stopped after', colStillAnswering: 'Still answering', colDropOff: 'Drop-off',
    notInCatalog: 'No longer in the questionnaire', questionId: 'Question ID',
    positionTitle: 'By position', positionHint: 'Sessions that answered a question at each position, whichever question it was, and how many stopped after it.',
    position: 'Position', stoppedAfter: 'Stopped after',
    purposeTitle: 'Completion by purpose', purposeHint: '“Picked” counts the purpose picker; “Answered” also counts questionnaires reopened from “Edit my preferences”.',
    purpose: 'Purpose', picked: 'Picked', reached: 'Answered', completed: 'Completed', completionRate: 'Completion',
    checkpointTitle: 'Checkpoint after 5 answers', checkpointHint: 'Early results are offered after the fifth answer.',
    choice: 'Choice', events: 'Events',
  },
  quality: {
    distributionTitle: 'Rating distribution', distributionHint: 'All ratings in range, by score.', score: 'Score', count: 'Ratings',
    byKindTitle: 'By rating kind', byKindHint: 'A results rating covers a whole recommendation set; a destination rating covers one country.',
    kind: 'Kind', average: 'Average',
    countryTitle: 'Country ratings', countryHint: 'Lowest average first — the countries whose pages disappoint.',
    country: 'Country', ratingsCount: 'Ratings',
    negativeTitle: 'What people said when they rated low', negativeHint: 'Scores of 1 or 2 that came with a written comment. This is the closest thing to a reason the product collects.',
    negativeEmpty: 'No low ratings with a written comment in this range.',
    colWhen: 'When (UTC)', colKind: 'Kind', colScore: 'Score', colCountry: 'Country', colArrivedVia: 'Arrived via', colComment: 'Comment',
    setsTitle: 'Recommendation sets behind a poor rating', setsHint: 'Which countries were on screen, with their scores, when someone rated the results 1 or 2.',
    setsEmpty: 'No poorly-rated recommendation sets in this range.', colRecommendedSet: 'Recommended set',
    pathTitle: 'Questionnaire path behind a results rating', pathHint: 'Purpose and how many questions were answered — no identity, and nothing narrower.',
    path: 'Path', ratingsLabel: 'Ratings', answersWord: 'answers', unknownPurpose: 'unknown purpose',
  },
  countries: {
    sectionTitle: 'Country performance',
    mostTitle: 'Most recommended', mostHint: 'Appearances in a generated top 5.',
    leastTitle: 'Least recommended', leastHint: 'Countries that DID appear, ranked from the rarest up. A country missing from both tables was never recommended in this range.',
    openedTitle: 'Most opened', openedHint: 'Destination pages opened from a destination card.', opens: 'Opens', appearances: 'Appearances',
    surpriseTitle: 'Surprise Me landings', surpriseHint: 'Countries the wheel actually landed on.', landings: 'Landings',
    feedbackTitle: 'Reports per country', feedbackHint: 'Reports filed from a specific country page.', feedbackCount: 'Reports', countryCol: 'Country',
  },
  discovery: {
    sectionTitle: 'Discovery', sectionHint: 'How people move through Explore and reach destination pages.',
    openedTitle: 'How destination pages were opened', openedHint: 'Which screen the clicked destination card was on.', source: 'Opened from', opens: 'Opens', sessions: 'Sessions',
    filtersTitle: 'Which controls get used', filtersHint: 'Changes per Explore control.', filter: 'Control', changes: 'Changes',
    sortTitle: 'Sort choices', sort: 'Sort', uses: 'Times chosen',
    distanceTitle: 'Nearest / farthest', distanceHint: 'The two sorts that need a shared location to work.',
    regionTitle: 'Region filter', region: 'Region', costTitle: 'Cost filter', cost: 'Cost level', purposeTitle: 'Purpose filter', purpose: 'Purpose',
  },
  location: {
    sectionTitle: 'Location', sectionHint: 'Whether the feature works — never where anyone is. No coordinate is stored, sent or shown anywhere in this dashboard.',
    permissionTitle: 'Location states', permissionHint: 'Every change of the site’s location state. Events count each change; sessions count each session once per state.',
    outcome: 'State', events: 'Events', sessionsCount: 'Sessions',
    requestTitle: 'Request results and duration', requestHint: 'Completed location requests by result, with the mean time to that result.', avgMs: 'Mean time (ms)',
    stageTitle: 'Two-stage request', stageHint: 'Stage one is coarse and cached; stage two escalates to high accuracy only after a timeout or an unavailable position.',
    stage: 'Stage', accuracy: 'Accuracy', attempts: 'Attempts',
    edgeTitle: 'Sessions by coarse country', edgeHint: 'The country Cloudflare attaches at the edge. Country-level only, and the only geography in this dashboard.',
  },
  technical: {
    sectionTitle: 'Technical quality', sectionHint: 'Load timing from real visits, in milliseconds (1,000 ms = 1 second).',
    errorsTitle: 'Frontend errors', errorsHint: 'Error name and the file it came from. No message text and no stack — those can carry user content.',
    errorKind: 'Error name', errorScript: 'File', count: 'Events',
    browserFamily: 'Browser family', deviceClass: 'Screen class', language: 'Site language', theme: 'Theme', referrer: 'Referrer origin', sessions: 'Sessions', pageViews: 'Page views',
    ms: 'ms',
  },
  content: {
    unavailableTitle: 'City descriptions', unavailableHint: 'The description cache table is not present yet — apply migration 0003.',
    coverageTitle: 'City description coverage', coverageHint: 'Real coverage from the cache — not an estimate. A city counts as covered only when an article was found AND its own coordinates matched the city.',
    statusTitle: 'Why a city has no description', statusHint: 'Every lookup result in the cache, by outcome.',
    status: 'Result', cities: 'City lookups',
    langTitle: 'By language', lang: 'Language', verifiedCol: 'Verified', lookedUpCol: 'Looked up',
  },
  intelligence: {
    title: 'Country Intelligence data', hint: 'A static, versioned dataset bundled with the server code and regenerated by the data pipeline. Its sources are public yearly indicators; nothing here is a live measurement or a sample of visitors.',
    sourceFiles: 'Dataset and methodology:',
    tableTitle: 'Coverage by purpose',
    purpose: 'Purpose', modelVersion: 'Methodology version', sufficientCount: 'Enough data', averageCoverage: 'Mean coverage', highConfidenceCount: 'High confidence',
  },
  reports: {
    title: 'Reports and feedback', hint: 'Everything a traveller sent, with a status you can move, and the comments left with ratings.',
    search: 'Search', searchPlaceholder: 'message, reference, country code', status: 'Status', type: 'Type',
    screenshot: 'Screenshot', screenshotYes: 'With screenshot', screenshotNo: 'Without screenshot', searchAction: 'Search',
    queueTitle: 'Queue', byType: 'By type',
    resultsTitle: 'Reports', resultsHint: 'Newest first.', resultsEmpty: 'No reports match.',
    colReference: 'Reference', colWhen: 'When (UTC)', colType: 'Type', colCountry: 'Country', colMessage: 'Message', colStatus: 'Status', colScreenshot: 'Screenshot',
    open: 'Open',
    commentsTitle: 'Rating comments', commentsHint: 'Ratings that came with a written comment, newest first. Shown exactly as written.', commentsEmpty: 'No rating comments in this range.', kind: 'Rating kind',
    saving: 'Saving…', saved: 'Status saved: {reference} is now “{status}”.',
  },
  reportType: { wrong_info: 'Wrong information', image: 'Image problem', bug: 'Bug', suggestion: 'Suggestion', results: 'Results', translation: 'Translation', other: 'Other' },
  reportStatus: { new: 'New', triaged: 'Triaged', in_progress: 'In progress', resolved: 'Resolved', declined: 'Declined' },
  reportDetail: {
    title: 'Report', received: 'Received (UTC)', type: 'Type', page: 'Page', country: 'Country', language: 'Traveller language',
    contactEmail: 'Contact e-mail (only if they volunteered one)', screenshot: 'Screenshot', screenshotAttached: 'Attached (kept in private storage)', screenshotNone: 'None',
    statusChanged: 'Status changed (UTC)',
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
    title: 'عوامل التصفية', hint: 'كل لوحة أدناه تلتزم بهذه العوامل. تُحذف البيانات الأقدم من 90 يومًا بمهمة الاحتفاظ.', from: 'من', to: 'إلى', language: 'لغة المسافر',
    localeAr: 'العربية', localeEn: 'الإنجليزية',
    device: 'الجهاز', purpose: 'الغرض', country: 'الدولة (رمز ISO)', countryPlaceholder: 'JP',
    minRating: 'أقل تقييم', maxRating: 'أعلى تقييم', apply: 'تطبيق', clear: 'مسح', any: 'أي',
  },
  devices: { mobile: 'جوال', tablet: 'لوحي', desktop: 'حاسوب' },
  purposes: {
    tourism: 'سياحة', work: 'عمل', education: 'تعليم', medical: 'طبي',
    immigration: 'هجرة', investment: 'استثمار', wellness: 'عافية', other: 'أخرى',
  },
  tabs: {
    overview: 'نظرة عامة', funnel: 'الاستبيان', quality: 'جودة التوصيات', countries: 'الدول',
    discovery: 'الاستكشاف', location: 'الموقع', reports: 'البلاغات والملاحظات', technical: 'تقني', content: 'المحتوى والبيانات',
    ariaLabel: 'أقسام لوحة التحكم',
  },
  common: {
    loading: 'جارٍ التحميل…', noData: 'لا توجد بيانات ضمن هذا النطاق.', notEnoughTrend: 'لا توجد أيام كافية ضمن هذا النطاق لرسم اتجاه.', dash: '—',
    howCounted: 'كيف يُحتسب؟', openDetails: 'التفاصيل', share: 'النسبة', yes: 'نعم', no: 'لا',
    filterToCountry: 'تصفية', filteredTo: 'اعرض {country} فقط', daysAgo: 'قبل {days} يومًا', tableRegion: '{title} (جدول قابل للتمرير)',
  },
  metricMeta: {
    definition: 'التعريف', numerator: 'ما يُعدّ', denominator: 'يُقسم على', noDenominator: 'لا شيء — عدد مباشر', unit: 'الوحدة',
    aggregation: 'طريقة التجميع', window: 'النافذة الزمنية', source: 'المصدر', interpretation: 'كيف تقرؤه', limitation: 'القيود',
  },
  units: {
    sessions: 'جلسات', events: 'أحداث', percent: 'نسبة مئوية', milliseconds: 'مللي ثانية', score: 'درجة من 1 إلى 5', countries: 'دول',
    cityLookups: 'عمليات بحث عن مدن', questions: 'أسئلة', position: 'الموضع في الاستبيان', reports: 'بلاغات', ratings: 'تقييمات', date: 'تاريخ',
  },
  aggregations: {
    count: 'عدد', distinctSessions: 'جلسات مميزة', ratio: 'نسبة', mean: 'متوسط حسابي', distinctCount: 'عدد مميز', latest: 'أحدث قيمة',
  },
  windows: {
    eventTime: 'الأحداث التي يقع وقتها داخل مرشح التاريخ',
    sessionOverlap: 'الجلسات النشطة في أي لحظة داخل مرشح التاريخ',
    createdTime: 'الصفوف المنشأة داخل مرشح التاريخ',
    staticSnapshot: 'لقطة مضمّنة؛ لا ينطبق عليها مرشح التاريخ',
    cacheLifetime: 'كل ما في المخزن؛ لا ينطبق عليه مرشح التاريخ',
  },
  enums: {
    ratingKind: { results: 'تقييم النتائج', destination: 'تقييم الوجهة' },
    arrival: { results: 'من النتائج', explore: 'من استكشف', surprise: 'من فاجئني بوجهة', direct: 'بطاقة أخرى' },
    locationOutcome: {
      idle: 'لم يُطلب', requesting: 'جارٍ الطلب', granted: 'مسموح', denied: 'مرفوض', unavailable: 'الموقع غير متاح',
      timeout: 'انتهت المهلة', unsupported: 'غير مدعوم في المتصفح', ok: 'تم الحصول على الموقع',
    },
    theme: { light: 'فاتح', dark: 'داكن' },
    locale: { ar: 'العربية', en: 'الإنجليزية' },
    browser: { Chrome: 'كروم', Safari: 'سفاري', Firefox: 'فايرفوكس', Edge: 'إيدج', Other: 'متصفح آخر' },
    contentStatus: {
      ok: 'وصف موثّق', no_article: 'لا يوجد مقال', ambiguous: 'عنوان ملتبس (صفحة توضيح)',
      wrong_place: 'المقال عن مكان آخر', too_short: 'المقال قصير جدًا', unavailable: 'المصدر غير متاح',
    },
    accuracy: { high: 'دقة عالية (GPS)', standard: 'عادية (تقريبية ومخزّنة)' },
    outcome: { finished: 'انتهت بالنتائج', stopped: 'توقفت قبل النتائج', inProgress: 'لا تزال تُجيب', neverAnswered: 'اختارت غرضًا ولم تُجب' },
    checkpoint: { results: 'اختارت النتائج المبكرة', continue: 'واصلت الإجابة' },
    exploreFilterAll: 'أُلغي (الكل)',
  },
  overview: {
    title: 'نظرة عامة', hint: 'كل ما يلي يلتزم بشريط عوامل التصفية أعلاه. افتح «كيف يُحتسب؟» على أي رقم لمعرفة تعريفه الدقيق.',
    trendTitle: 'الاتجاه اليومي', trendHint: 'الجلسات الجديدة والاستبيانات المكتملة والتقييمات لكل يوم.', trendAria: '{series} لكل يوم',
    seriesSessions: 'الجلسات', seriesCompletions: 'الاستبيانات المكتملة', seriesRatings: 'التقييمات',
  },
  funnel: {
    title: 'الاستبيان', hint: 'الاستبيان متكيّف: ترتيب الأسئلة يعتمد على الإجابات السابقة، لذا تُعرض الأسئلة بمعرّفها مع الموضع الذي طُرحت فيه.',
    outcomesTitle: 'كيف انتهت جلسات الاستبيان', outcomesHint: 'تظهر كل جلسة استبيان في صف واحد فقط. «توقفت» تعني عدم وجود نشاط لمدة {minutes} دقيقة بعد آخر إجابة.',
    outcome: 'النتيجة', sessions: 'الجلسات',
    questionsTitle: 'الأسئلة', questionsHint: 'كل أسئلة الغرض المختار بترتيب الاستبيان. الانسحاب هو نسبة الجلسات التي أجابت عن السؤال ثم غادرت قبل النتائج.',
    showPurpose: 'الغرض المعروض',
    colOrder: '#', colQuestion: 'السؤال', colPosition: 'موضع الطرح', colSessions: 'الجلسات', colAnswers: 'أحداث الإجابة',
    colCompletedAfter: 'وصلت إلى النتائج', colStopped: 'توقفت بعده', colStillAnswering: 'لا تزال تُجيب', colDropOff: 'الانسحاب',
    notInCatalog: 'لم يعد ضمن الاستبيان', questionId: 'معرّف السؤال',
    positionTitle: 'حسب الموضع', positionHint: 'الجلسات التي أجابت عن سؤال في كل موضع، أيًّا كان السؤال، وكم منها توقف بعده.',
    position: 'الموضع', stoppedAfter: 'توقفت بعده',
    purposeTitle: 'الإكمال حسب الغرض', purposeHint: '«اختيار» يعدّ شاشة اختيار الغرض؛ و«أجابت» يعدّ أيضًا الاستبيانات المعاد فتحها من «تعديل تفضيلاتي».',
    purpose: 'الغرض', picked: 'اختيار', reached: 'أجابت', completed: 'أكملت', completionRate: 'الإكمال',
    checkpointTitle: 'نقطة التوقف بعد 5 إجابات', checkpointHint: 'تُعرض النتائج المبكرة بعد الإجابة الخامسة.',
    choice: 'الخيار', events: 'الأحداث',
  },
  quality: {
    distributionTitle: 'توزيع التقييمات', distributionHint: 'كل التقييمات ضمن النطاق، حسب الدرجة.', score: 'الدرجة', count: 'التقييمات',
    byKindTitle: 'حسب نوع التقييم', byKindHint: 'تقييم النتائج يغطي مجموعة توصيات كاملة؛ تقييم الوجهة يغطي دولة واحدة.',
    kind: 'النوع', average: 'المتوسط',
    countryTitle: 'تقييمات الدول', countryHint: 'الأقل متوسطًا أولًا — الدول التي تخيّب صفحاتها التوقعات.',
    country: 'الدولة', ratingsCount: 'التقييمات',
    negativeTitle: 'ما قاله الناس عند التقييم المنخفض', negativeHint: 'درجات 1 أو 2 مصحوبة بتعليق مكتوب. هذا أقرب شيء لسبب يجمعه المنتج.',
    negativeEmpty: 'لا توجد تقييمات منخفضة مصحوبة بتعليق مكتوب ضمن هذا النطاق.',
    colWhen: 'الوقت (UTC)', colKind: 'النوع', colScore: 'الدرجة', colCountry: 'الدولة', colArrivedVia: 'طريقة الوصول', colComment: 'التعليق',
    setsTitle: 'مجموعات التوصيات خلف تقييم ضعيف', setsHint: 'الدول التي كانت ظاهرة على الشاشة، مع درجاتها، عندما قيّم أحدهم النتائج بـ1 أو 2.',
    setsEmpty: 'لا توجد مجموعات توصيات ذات تقييم ضعيف ضمن هذا النطاق.', colRecommendedSet: 'المجموعة الموصى بها',
    pathTitle: 'مسار الاستبيان خلف تقييم النتائج', pathHint: 'الغرض وعدد الأسئلة المُجابة — بلا هوية، وبلا أي تفصيل أدق.',
    path: 'المسار', ratingsLabel: 'التقييمات', answersWord: 'إجابة', unknownPurpose: 'غرض غير معروف',
  },
  countries: {
    sectionTitle: 'أداء الدول',
    mostTitle: 'الأكثر توصية', mostHint: 'الظهور ضمن أفضل 5 نتائج مولَّدة.',
    leastTitle: 'الأقل توصية', leastHint: 'الدول التي ظهرت بالفعل، مرتّبة من الأندر ظهورًا. أي دولة غائبة عن كلا الجدولين لم يُوصَ بها ضمن هذا النطاق.',
    openedTitle: 'الأكثر فتحًا', openedHint: 'صفحات الوجهات المفتوحة من بطاقة وجهة.', opens: 'مرات الفتح', appearances: 'مرات الظهور',
    surpriseTitle: 'مرات استقرار فاجئني بوجهة', surpriseHint: 'الدول التي استقرت عليها العجلة فعليًا.', landings: 'مرات الاستقرار',
    feedbackTitle: 'البلاغات لكل دولة', feedbackHint: 'بلاغات قُدِّمت من صفحة دولة محددة.', feedbackCount: 'البلاغات', countryCol: 'الدولة',
  },
  discovery: {
    sectionTitle: 'الاستكشاف', sectionHint: 'كيف يتنقّل الناس في استكشف ويصلون إلى صفحات الوجهات.',
    openedTitle: 'كيف فُتحت صفحات الوجهات', openedHint: 'الشاشة التي كانت عليها بطاقة الوجهة المنقورة.', source: 'فُتحت من', opens: 'مرات الفتح', sessions: 'الجلسات',
    filtersTitle: 'العناصر المستخدمة', filtersHint: 'التغييرات لكل عنصر في استكشف.', filter: 'العنصر', changes: 'التغييرات',
    sortTitle: 'خيارات الترتيب', sort: 'الترتيب', uses: 'مرات الاختيار',
    distanceTitle: 'الأقرب / الأبعد', distanceHint: 'نوعا الترتيب اللذان يحتاجان موقعًا مشتركًا ليعملا.',
    regionTitle: 'تصفية المنطقة', region: 'المنطقة', costTitle: 'تصفية التكلفة', cost: 'مستوى التكلفة', purposeTitle: 'تصفية الغرض', purpose: 'الغرض',
  },
  location: {
    sectionTitle: 'الموقع', sectionHint: 'هل الميزة تعمل — لا أين يوجد أي شخص. لا يُخزَّن أي إحداثي أو يُرسَل أو يُعرَض في أي مكان بهذه اللوحة.',
    permissionTitle: 'حالات الموقع', permissionHint: 'كل تغيّر في حالة الموقع داخل الموقع. الأحداث تعدّ كل تغيّر؛ والجلسات تعدّ كل جلسة مرة واحدة لكل حالة.',
    outcome: 'الحالة', events: 'الأحداث', sessionsCount: 'الجلسات',
    requestTitle: 'نتائج الطلب ومدته', requestHint: 'طلبات الموقع المكتملة حسب النتيجة، مع متوسط الوقت حتى النتيجة.', avgMs: 'متوسط الوقت (مللي ثانية)',
    stageTitle: 'الطلب على مرحلتين', stageHint: 'المرحلة الأولى تقريبية ومخزّنة؛ والمرحلة الثانية تنتقل إلى الدقة العالية فقط بعد انتهاء المهلة أو تعذّر تحديد الموقع.',
    stage: 'المرحلة', accuracy: 'الدقة', attempts: 'المحاولات',
    edgeTitle: 'الجلسات حسب الدولة التقريبية', edgeHint: 'الدولة التي تحدّدها Cloudflare عند الحافة. على مستوى الدولة فقط، وهي الموقع الجغرافي الوحيد في هذه اللوحة.',
  },
  technical: {
    sectionTitle: 'الجودة التقنية', sectionHint: 'توقيت التحميل من زيارات حقيقية، بالمللي ثانية (1,000 مللي ثانية = ثانية واحدة).',
    errorsTitle: 'أخطاء الواجهة', errorsHint: 'اسم الخطأ والملف الذي جاء منه. بلا نص الرسالة وبلا تتبّع المكدس — فقد يحملان محتوى المستخدم.',
    errorKind: 'اسم الخطأ', errorScript: 'الملف', count: 'الأحداث',
    browserFamily: 'عائلة المتصفح', deviceClass: 'فئة الشاشة', language: 'لغة الموقع', theme: 'المظهر', referrer: 'مصدر الإحالة', sessions: 'الجلسات', pageViews: 'مشاهدات الصفحات',
    ms: 'مللي ثانية',
  },
  content: {
    unavailableTitle: 'أوصاف المدن', unavailableHint: 'جدول تخزين الأوصاف غير موجود بعد — طبّق الترحيل 0003.',
    coverageTitle: 'تغطية أوصاف المدن', coverageHint: 'تغطية حقيقية من المخزن — وليست تقديرًا. تُحتسب المدينة مغطاة فقط عند العثور على مقال وتطابق إحداثياته الخاصة مع المدينة.',
    statusTitle: 'سبب عدم وجود وصف لمدينة', statusHint: 'كل نتائج البحث في المخزن، حسب النتيجة.',
    status: 'النتيجة', cities: 'عمليات البحث',
    langTitle: 'حسب اللغة', lang: 'اللغة', verifiedCol: 'موثّق', lookedUpCol: 'تم البحث',
  },
  intelligence: {
    title: 'بيانات معلومات الدول', hint: 'مجموعة بيانات ثابتة وذات إصدار مضمّنة في شيفرة الخادم، يعيد خط البيانات توليدها. مصادرها مؤشرات عامة سنوية؛ ولا شيء هنا قياس حي أو عيّنة من الزوار.',
    sourceFiles: 'ملف البيانات والمنهجية:',
    tableTitle: 'التغطية حسب الغرض',
    purpose: 'الغرض', modelVersion: 'إصدار المنهجية', sufficientCount: 'بيانات كافية', averageCoverage: 'متوسط التغطية', highConfidenceCount: 'ثقة عالية',
  },
  reports: {
    title: 'البلاغات والملاحظات', hint: 'كل ما أرسله مسافر، مع حالة يمكنك تحريكها، والتعليقات المتروكة مع التقييمات.',
    search: 'بحث', searchPlaceholder: 'الرسالة، المرجع، رمز الدولة', status: 'الحالة', type: 'النوع',
    screenshot: 'لقطة الشاشة', screenshotYes: 'مع لقطة شاشة', screenshotNo: 'دون لقطة شاشة', searchAction: 'بحث',
    queueTitle: 'قائمة الانتظار', byType: 'حسب النوع',
    resultsTitle: 'البلاغات', resultsHint: 'الأحدث أولًا.', resultsEmpty: 'لا توجد بلاغات مطابقة.',
    colReference: 'المرجع', colWhen: 'الوقت (UTC)', colType: 'النوع', colCountry: 'الدولة', colMessage: 'الرسالة', colStatus: 'الحالة', colScreenshot: 'لقطة الشاشة',
    open: 'فتح',
    commentsTitle: 'تعليقات التقييم', commentsHint: 'التقييمات المصحوبة بتعليق مكتوب، الأحدث أولًا. تُعرض كما كُتبت تمامًا.', commentsEmpty: 'لا توجد تعليقات تقييم ضمن هذا النطاق.', kind: 'نوع التقييم',
    saving: 'جارٍ الحفظ…', saved: 'حُفظت الحالة: {reference} أصبح «{status}».',
  },
  reportType: { wrong_info: 'معلومة خاطئة', image: 'مشكلة صورة', bug: 'خلل', suggestion: 'اقتراح', results: 'النتائج', translation: 'ترجمة', other: 'أخرى' },
  reportStatus: { new: 'جديد', triaged: 'قيد الفرز', in_progress: 'قيد المعالجة', resolved: 'تم الحل', declined: 'مرفوض' },
  reportDetail: {
    title: 'البلاغ', received: 'وقت الاستلام (UTC)', type: 'النوع', page: 'الصفحة', country: 'الدولة', language: 'لغة المسافر',
    contactEmail: 'بريد التواصل (فقط إن تطوّع به)', screenshot: 'لقطة الشاشة', screenshotAttached: 'مرفقة (محفوظة في تخزين خاص)', screenshotNone: 'لا توجد',
    statusChanged: 'وقت تغيير الحالة (UTC)',
    message: 'الرسالة', statusLabel: 'الحالة', noteLabel: 'ملاحظة داخلية', save: 'حفظ', close: 'إغلاق',
  },
};

export const ADMIN_I18N: { en: AdminDictionary; ar: AdminDictionary } = { en: ADMIN_EN, ar: ADMIN_AR };
