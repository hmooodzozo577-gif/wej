// Ported verbatim from buildWhyText() in wejhaty.html, including its unused
// `purposeId` parameter (kept for signature parity with the original).
import type { CatalogEntry, Lang } from '../data/types';
import type { Reason } from './types';
import { QUESTION_BANKS } from '../data/questionBanks';

const PURPOSE_LABEL = { ar: 'ملاءمة الغرض', en: 'purpose fit' };
const PROFILE_LABELS = {
  region: { ar: 'المنطقة', en: 'region' }, subregion: { ar: 'النطاق الجغرافي', en: 'subregion' },
  climate: { ar: 'المناخ', en: 'climate' }, costLevel: { ar: 'مستوى الأسعار', en: 'price level' },
  coastal: { ar: 'البيئة الساحلية', en: 'coastal setting' }, island: { ar: 'الطابع الجزيري', en: 'island setting' },
  urbanity: { ar: 'نمط المدن', en: 'urban setting' }, popularity: { ar: 'الشهرة السياحية', en: 'tourism popularity' },
  size: { ar: 'حجم الوجهة', en: 'destination size' }, income: { ar: 'مستوى الدخل', en: 'income level' },
  opportunity: { ar: 'فرص العمل', en: 'job opportunities' }, health: { ar: 'المؤشرات الصحية', en: 'health indicators' },
  education: { ar: 'مؤشرات التعليم', en: 'education indicators' }, investment: { ar: 'مؤشرات الاستثمار', en: 'investment indicators' },
  growth: { ar: 'النمو', en: 'growth' }, safety: { ar: 'مؤشرات السلامة', en: 'safety indicators' },
  latitudeZone: { ar: 'الموقع شمالًا وجنوبًا', en: 'north–south location' }, longitudeZone: { ar: 'الموقع شرقًا وغربًا', en: 'east–west location' },
} as const;

export function buildWhyText(
  lang: Lang,
  purposeId: string,
  reasons: Reason[],
  dest: CatalogEntry,
): string {
  const top = reasons
    .filter((r) => r.weight > 1)
    .slice(0, 3)
    .map((reason) => {
      if (reason.id === '__purpose') return PURPOSE_LABEL[lang];
      const question = QUESTION_BANKS[purposeId as keyof typeof QUESTION_BANKS]?.find((item) => item.id === reason.id);
      return question?.profileKey ? PROFILE_LABELS[question.profileKey][lang] : reason.id;
    });
  const name = lang === 'ar' ? dest.nameAr : dest.nameEn;
  if (lang === 'ar') {
    return `${name} توافق قوي مع أولوياتك، خصوصاً في ${top.join('، ')}.`;
  }
  return `${name} is a strong match for your priorities, especially ${top.join(', ')}.`;
}
