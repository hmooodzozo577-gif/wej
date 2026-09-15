import type { CatalogEntry, Lang } from '../data/types';
import type { Reason } from './types';
import { QUESTION_BANKS } from '../data/questionBanks';

const PURPOSE_LABEL = { ar: 'ملاءمة الغرض', en: 'purpose fit' };
const PROXIMITY_LABEL = { ar: 'القرب من موقعك', en: 'proximity to you' };
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

function labelOf(purposeId: string, reason: Reason, lang: Lang): string {
  if (reason.id === '__purpose') return PURPOSE_LABEL[lang];
  const question = QUESTION_BANKS[purposeId as keyof typeof QUESTION_BANKS]?.find((item) => item.id === reason.id);
  if (question?.kind === 'proximity') return PROXIMITY_LABEL[lang];
  return question?.profileKey ? PROFILE_LABELS[question.profileKey][lang] : reason.id;
}

/** Item #12: the previous version always produced the same fixed sentence
 *  shape ("strong match... especially X, Y, Z") regardless of the actual
 *  score or how the answers actually fit. This version varies the
 *  match-strength phrase with the real score, names the single strongest
 *  matched factor, and — only when a real answered factor scored a
 *  meaningfully weak fit (never invented) — names one honest trade-off.
 *  Every word here traces back to a real Reason the scoring engine
 *  produced for this destination and this user's own answers. */
export function buildWhyText(
  lang: Lang,
  purposeId: string,
  reasons: Reason[],
  dest: CatalogEntry,
  score: number,
): string {
  const name = lang === 'ar' ? dest.nameAr : dest.nameEn;
  const answered = reasons.filter((r) => r.weight > 0);
  const strong = answered.filter((r) => r.weight > 1).slice(0, 3).map((reason) => labelOf(purposeId, reason, lang));
  // Weakest genuinely-answered factor, excluding the always-present purpose
  // baseline — only surfaced as a trade-off when it is meaningfully below a
  // good fit, never manufactured when everything actually scored well.
  const weakest = [...answered]
    .filter((r) => r.id !== '__purpose')
    .sort((a, b) => a.fit - b.fit)[0];
  const tradeOff = weakest && weakest.fit < 55 ? labelOf(purposeId, weakest, lang) : null;

  const strength = score >= 80
    ? { ar: 'توافق قوي جدًا', en: 'a very strong match' }
    : score >= 60
      ? { ar: 'توافق جيد', en: 'a good match' }
      : { ar: 'توافق جزئي', en: 'a partial match' };

  if (lang === 'ar') {
    const factors = strong.length ? `، خصوصًا في ${strong.join('، ')}` : '';
    const trade = tradeOff ? ` مع ملاحظة أن ${tradeOff} أقل توافقًا مع تفضيلاتك.` : '';
    return `${name} ${strength.ar} مع أولوياتك${factors}.${trade}`;
  }
  const factors = strong.length ? `, especially ${strong.join(', ')}` : '';
  const trade = tradeOff ? ` One trade-off: ${tradeOff} matches your preferences less closely.` : '';
  return `${name} is ${strength.en} for your priorities${factors}.${trade}`;
}
