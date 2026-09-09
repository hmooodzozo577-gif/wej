// Arabic strings, ported verbatim from I18N.ar in wejhaty.html. Arabic
// remains the default language.
//
// Phase 10: the original never needed continent labels beyond the 5 the 30
// destinations use, so `regionLabels.Africa`/`SouthAmerica` don't exist in
// the extracted JSON. Added here at the wrapper layer (not by hand-editing
// the generated file) — standard geographic terminology, not invented data.
import arJson from '../generated/i18n.ar.json';
import type { I18nDict } from '../types';

const base = arJson as I18nDict;

export const AR: I18nDict = {
  ...base,
  regionLabels: {
    ...base.regionLabels,
    Africa: 'أفريقيا',
    SouthAmerica: 'أمريكا الجنوبية',
  },
  detail: {
    ...base.detail,
    capital: 'العاصمة',
    notRecommendationReady:
      'لا تتوفر بعد بيانات كافية لتضمين هذه الوجهة في محرك التوصيات — ستُضاف في مرحلة قادمة.',
    countryInfo: 'معلومات الدولة',
    officialName: 'الاسم الرسمي',
    area: 'المساحة',
    areaUnit: 'كم²',
    currency: 'العملة',
    languages: 'اللغات',
    callingCode: 'رمز الاتصال',
    borders: 'الدول المجاورة',
  },
  // المرحلة 12 — التخصيص حسب الموقع. ليست جزءًا من نص wejhaty.html الأصلي
  // (هذه الميزة لم تكن موجودة فيه)، لذا هي مفتاح جديد كليًا هنا وليست
  // امتدادًا لـ `base`.
  location: {
    title: 'التخصيص حسب الموقع',
    sub: 'شارك موقعك التقريبي لرؤية الدول القريبة منك في الكتالوج.',
    cta: 'استخدام موقعي',
    retry: 'إعادة المحاولة',
    reset: 'مسح',
    requesting: 'جارٍ طلب موقعك…',
    resolving: 'جارٍ تحديد دولتك…',
    currentLocation: 'موقعك الحالي',
    nearestCountry: 'أقرب دولة في الكتالوج (تقريبية)',
    approxNote: 'هذا تقدير تقريبي بخط مستقيم، وليس مسافة سفر حقيقية أو تحديدًا فعليًا للحدود.',
    nearbyTitle: 'الدول القريبة',
    denied: 'تم رفض إذن الوصول إلى الموقع. يمكنك متابعة التصفح والبحث بشكل طبيعي.',
    unavailable: 'تعذّر تحديد موقعك حاليًا.',
    timeout: 'استغرق طلب الموقع وقتًا طويلاً.',
    unsupported: 'متصفحك لا يدعم خدمات تحديد الموقع.',
  },
  // المرحلة 13.6 — التكامل الكامل للسفر. مثل قسم الموقع أعلاه، ليست جزءًا
  // من نص wejhaty.html الأصلي.
  travel: {
    title: 'السفر',
    loading: 'جارٍ البحث عن معلومات السفر…',
    needLocation: 'شارك موقعك لرؤية مسافة السفر ومدة الرحلة إلى هذه الوجهة.',
    setLocationCta: 'تحديد موقعك',
    distanceLabel: 'المسافة',
    distanceUnit: 'كم',
    durationLabel: 'مدة الرحلة',
    durationUnit: { h: 'س', m: 'د' },
    estimateNote: 'تقدير تقريبي بخط مستقيم للمسافة ومدة الرحلة — وليس سعرًا حقيقيًا أو حجزًا.',
    priceLabel: 'السعر',
    stopsLabel: 'التوقفات',
    nonStop: 'رحلة مباشرة',
    offerFoundNote: 'عرض رحلة حقيقي من بحث السفر لدينا — للعِلم فقط، وليس حجزًا.',
  },
};
