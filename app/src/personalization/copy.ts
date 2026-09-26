// Phase 18 — controlled Arabic/English copy for personalization. Arabic is
// authored first. Kept in this module (not the generated i18n JSON) so
// the whole phase stays self-contained and removable. All numbers are
// rendered with Latin digits by the callers.
import type { Lang } from '../data/types';
import type { FactorId, PersonalConfidence, SignalStrength } from './types';

export interface PersonalCopy {
  /** The Personal Match label. Compact badges show only "NN%"; this label
   *  sits beside them (or in their accessible name), never inside. */
  personalMatch: string;
  generalSuitability: (purposeName: string) => string;
  whyHeading: string;
  basedOn: (purposeName: string) => string;
  groupPositive: string;
  groupPartial: string;
  groupNegative: string;
  groupUnavailable: string;
  confidence: Record<PersonalConfidence, string>;
  strength: Partial<Record<SignalStrength, string>>;
  editPrefs: string;
  resetPrefs: string;
  newTrip: string;
  continuePrev: string;
  savedLocally: string;
  resetDone: string;
  noProfileTitle: string;
  noProfileBody: string;
  noProfileCta: string;
  sortPersonalDesc: string;
  sortPersonalAsc: string;
  exploreNote: string;
  resetConfirm: string;
  resetConfirmYes: string;
  resetCancel: string;
  retakeQuiz: string;
  constraintFailed: string;
  noSignals: string;
  methodNote: string;
  scoreAria: (score: number) => string;
  factor: Record<FactorId, string>;
}

export const PERSONAL_COPY: Record<Lang, PersonalCopy> = {
  ar: {
    personalMatch: 'التوافق معك',
    generalSuitability: (purposeName) => `الملاءمة العامة (${purposeName})`,
    whyHeading: 'لماذا تناسبك هذه الوجهة؟',
    basedOn: (purposeName) => `بحسب تفضيلاتك في «${purposeName}»`,
    groupPositive: 'يتوافق مع تفضيلاتك',
    groupPartial: 'توافق جزئي',
    groupNegative: 'أقل توافقًا',
    groupUnavailable: 'لم يُحتسب',
    confidence: {
      high: 'مبنية على معظم تفضيلاتك',
      medium: 'مبنية على جزء من تفضيلاتك',
      low: 'مبنية على عدد قليل من تفضيلاتك — تقدير أولي',
    },
    strength: { strong: 'عامل حاسم', minor: 'عامل ثانوي' },
    editPrefs: 'تعديل تفضيلاتي',
    resetPrefs: 'إعادة تعيين التفضيلات',
    newTrip: 'بدء رحلة جديدة',
    continuePrev: 'متابعة بتفضيلاتي السابقة',
    savedLocally: 'تُحفظ تفضيلاتك على هذا المتصفح فقط، بلا حساب ولا مزامنة بين الأجهزة.',
    resetDone: 'تمت إعادة تعيين تفضيلاتك.',
    noProfileTitle: 'مدى توافقها معك',
    noProfileBody: 'أجب عن أسئلة قصيرة لنقيس توافق هذه الوجهة مع تفضيلاتك أنت، إلى جانب ملاءمتها العامة.',
    noProfileCta: 'اكتشف مدى توافقها معك',
    sortPersonalDesc: 'التوافق معك: الأعلى أولًا',
    sortPersonalAsc: 'التوافق معك: الأقل أولًا',
    exploreNote: 'النسبة على كل بطاقة هي التوافق معك، بحسب تفضيلاتك المحفوظة.',
    resetConfirm: 'ستُحذف تفضيلاتك المحفوظة من هذا المتصفح فقط.',
    resetConfirmYes: 'تأكيد الإعادة',
    resetCancel: 'إلغاء',
    retakeQuiz: 'اختبر تفضيلاتك',
    constraintFailed: 'خارج شرط الوصول البري الذي اخترته',
    noSignals: 'لم تحدد تفضيلات كافية لحساب توافق شخصي لهذه الوجهة.',
    methodNote: 'نسبة «التوافق معك» تقيس توافق الوجهة مع تفضيلاتك أنت فقط، أما الملاءمة العامة فتقيس مناسبة الدولة لهذا الغرض لأي مسافر. كلتاهما تقدير.',
    scoreAria: (score) => `التوافق معك ${score}%`,
    factor: {
      climate: 'المناخ',
      budget: 'الميزانية',
      setting: 'طبيعة المكان',
      coast: 'البحر والساحل',
      island: 'طابع الجزيرة',
      size: 'حجم الدولة',
      popularity: 'مستوى الشهرة',
      safety: 'الأمان',
      health: 'النظام الصحي',
      income: 'مستوى الدخل',
      opportunity: 'فرص العمل',
      education: 'التعليم',
      investment: 'الاستثمار الأجنبي',
      growth: 'النمو الاقتصادي',
      proximity: 'القرب من موقعك',
      language: 'التواصل بلغة تعرفها',
      islamicPractice: 'سهولة ممارسة الشعائر',
      halalFood: 'الطعام الحلال',
    },
  },
  en: {
    personalMatch: 'Personal match',
    generalSuitability: (purposeName) => `General suitability (${purposeName})`,
    whyHeading: 'Why this destination suits you',
    basedOn: (purposeName) => `Based on your preferences for “${purposeName}”`,
    groupPositive: 'Fits your preferences',
    groupPartial: 'Partly fits',
    groupNegative: 'Weaker fit',
    groupUnavailable: 'Not counted',
    confidence: {
      high: 'Based on most of your preferences',
      medium: 'Based on some of your preferences',
      low: 'Based on only a few of your preferences — an early estimate',
    },
    strength: { strong: 'deciding factor', minor: 'secondary factor' },
    editPrefs: 'Edit my preferences',
    resetPrefs: 'Reset preferences',
    newTrip: 'Start a new trip',
    continuePrev: 'Continue with my saved preferences',
    savedLocally: 'Your preferences are remembered in this browser only — no account, no sync across devices.',
    resetDone: 'Your preferences were reset.',
    noProfileTitle: 'How well it fits you',
    noProfileBody: 'Answer a few short questions to see how well this destination fits your own preferences, alongside its general suitability.',
    noProfileCta: 'See how well it fits you',
    sortPersonalDesc: 'Personal match: Highest first',
    sortPersonalAsc: 'Personal match: Lowest first',
    exploreNote: 'The percentage on each card is your personal match, from your saved preferences.',
    resetConfirm: 'Your saved preferences will be removed from this browser only.',
    resetConfirmYes: 'Confirm reset',
    resetCancel: 'Cancel',
    retakeQuiz: 'Take the quiz again',
    constraintFailed: 'Outside your reach-by-land requirement',
    noSignals: 'Not enough stated preferences to compute a personal match for this destination.',
    methodNote: '“Personal match” measures how well a destination fits only your own preferences; general suitability measures how suitable the country is for this purpose for any traveller. Both are estimates.',
    scoreAria: (score) => `Personal match ${score}%`,
    factor: {
      climate: 'climate',
      budget: 'budget',
      setting: 'type of place',
      coast: 'the sea',
      island: 'island setting',
      size: 'country size',
      popularity: 'popularity',
      safety: 'safety',
      health: 'health system',
      income: 'income levels',
      opportunity: 'job opportunities',
      education: 'education',
      investment: 'foreign investment',
      growth: 'economic growth',
      proximity: 'distance from you',
      language: 'communicating in a language you know',
      islamicPractice: 'ease of Islamic practice',
      halalFood: 'halal food',
    },
  },
};
