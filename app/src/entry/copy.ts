// Phase 19 — passport entry information copy. Every requirement label and
// note below states only what the matching official source says; the note
// codes are attached by the generator only when the source's own sentence
// was found (see scripts/lib/entryRequirementsIngest.mjs).
import type { Lang } from '../data/types';
import type { EntryCategory, EntryNote } from './entryInfo';

export interface EntryCopy {
  title: string;
  destinationTitle: string;
  categories: Record<EntryCategory | 'unknown', string>;
  notes: Record<EntryNote, string>;
  stayLabel: string;
  validityLabel: string;
  conditionsLabel: string;
  additionalLabel: string;
  sourceLabel: string;
  lastCheckedLabel: string;
  ownCountry: string;
  notListed: string;
  noSource: string;
  stale: (date: string) => string;
  loading: string;
  error: string;
  disclaimer: string;
  passportStepCoverage: (count: number, regions: string[]) => string;
  /** Names for the snapshot's rule tables, used to say which destinations
   *  are covered without hard-coding the list into a sentence. */
  tableNames: Record<string, string>;
  opensInNewTab: string;
}

export const ENTRY_COPY: Record<Lang, EntryCopy> = {
  ar: {
    title: 'متطلبات الدخول حسب جوازك',
    destinationTitle: 'متطلبات الدخول بجوازك',
    categories: {
      visa_free: 'لا تلزم تأشيرة مسبقة',
      visa_on_arrival: 'تأشيرة عند الوصول',
      evisa: 'مؤهَّل لتأشيرة إلكترونية',
      visa_required: 'تأشيرة مطلوبة قبل السفر',
      permit_required: 'تصريح سفر إلكتروني مطلوب قبل السفر',
      unknown: 'غير محدد في مصادرنا',
    },
    notes: {
      uk_eta: 'تقديم طلب تصريح السفر الإلكتروني البريطاني (ETA) قبل السفر',
      eu_90_in_180: 'إقامة لا تتجاوز 90 يومًا خلال أي فترة 180 يومًا',
      biometric_passport: 'الإعفاء لحاملي الجوازات البيومترية فقط',
      ca_some_eta: 'قد يكون بعض حاملي هذا الجواز مؤهلين لتصريح eTA بدل التأشيرة بشروط',
      ca_eta_air: 'تصريح eTA مطلوب عند السفر جوًا',
      sa_evisa_90_days: 'تتيح التأشيرة الإلكترونية الإقامة حتى 90 يومًا',
      mv_passport_1_month: 'جواز بمنطقة قراءة آلية (MRZ) وصالح لشهر واحد على الأقل',
      mv_traveller_declaration: 'تعبئة «إقرار المسافر» خلال 96 ساعة قبل الوصول',
    },
    stayLabel: 'مدة الإقامة',
    validityLabel: 'صلاحية الجواز',
    conditionsLabel: 'شروط',
    additionalLabel: 'مطلوب أيضًا',
    sourceLabel: 'المصدر الرسمي',
    lastCheckedLabel: 'آخر تحقق',
    ownCountry: 'هذه دولة جوازك.',
    notListed: 'لا يذكر المصدر الرسمي الذي نعتمده لهذه الوجهة جنسيةَ جوازك، لذلك لا نحدد حالة التأشيرة. تحقّق من المصدر الرسمي.',
    noSource: 'لا يتوفر لدينا بعد مصدر رسمي مدعوم لهذه الوجهة. تحقّق من سفارة الوجهة أو موقع الهجرة الرسمي لها.',
    stale: (date) => `لم نتمكن من تحديث هذه المعلومات مؤخرًا (آخر تحقق ${date})، لذلك لا نعرض حالة التأشيرة. تحقّق من المصدر الرسمي.`,
    loading: 'جارٍ تحميل متطلبات الدخول…',
    error: 'تعذّر تحميل متطلبات الدخول الآن. تحقّق من المصدر الرسمي للوجهة قبل السفر.',
    disclaimer: 'متطلبات الدخول والتأشيرات قد تتغيّر. تحقّق دائمًا من المصدر الرسمي قبل السفر.',
    passportStepCoverage: (count, regions) => `التغطية جزئية: ${count} وجهة حاليًا${regions.length ? ` (${regions.join('، ')})` : ''}.`,
    tableNames: { schengen: 'دول شنغن', uk: 'المملكة المتحدة', canada: 'كندا', singapore: 'سنغافورة', saudi: 'السعودية', maldives: 'المالديف' },
    opensInNewTab: 'يُفتح في نافذة جديدة',
  },
  en: {
    title: 'Entry requirements for your passport',
    destinationTitle: 'Entry with your passport',
    categories: {
      visa_free: 'No visa needed in advance',
      visa_on_arrival: 'Visa on arrival',
      evisa: 'Eligible for an eVisa',
      visa_required: 'Visa required before travel',
      permit_required: 'Electronic travel authorisation required before travel',
      unknown: 'Not covered by our sources',
    },
    notes: {
      uk_eta: 'Apply for a UK Electronic Travel Authorisation (ETA) before travelling',
      eu_90_in_180: 'Stays of up to 90 days in any 180-day period',
      biometric_passport: 'The exemption applies to biometric passports only',
      ca_some_eta: 'Some holders of this passport may qualify for an eTA instead of a visa, under conditions',
      ca_eta_air: 'An eTA is required when flying',
      sa_evisa_90_days: 'The eVisa allows stays of up to 90 days',
      mv_passport_1_month: 'A passport with a machine-readable zone (MRZ) and at least 1 month’s validity',
      mv_traveller_declaration: 'Submit the Traveller Declaration within 96 hours before arrival',
    },
    stayLabel: 'Stay',
    validityLabel: 'Passport validity',
    conditionsLabel: 'Conditions',
    additionalLabel: 'Also required',
    sourceLabel: 'Official source',
    lastCheckedLabel: 'Last checked',
    ownCountry: 'This is your passport country.',
    notListed: 'The official source we use for this destination does not list your passport country, so we do not state a visa status. Check the official source.',
    noSource: 'We do not have a supported official source for this destination yet. Check the destination’s embassy or official immigration website.',
    stale: (date) => `We could not refresh this information recently (last checked ${date}), so no visa status is shown. Check the official source.`,
    loading: 'Loading entry requirements…',
    error: 'Entry requirements could not be loaded right now. Check the destination’s official source before travel.',
    disclaimer: 'Entry and visa requirements can change. Always verify the official source before travel.',
    passportStepCoverage: (count, regions) => `Coverage is partial: ${count} destinations so far${regions.length ? ` (${regions.join(', ')})` : ''}.`,
    tableNames: { schengen: 'the Schengen countries', uk: 'the United Kingdom', canada: 'Canada', singapore: 'Singapore', saudi: 'Saudi Arabia', maldives: 'the Maldives' },
    opensInNewTab: 'opens in a new tab',
  },
};
