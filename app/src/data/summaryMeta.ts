// Phase 16.5 UX correction — global human-readable preference summaries.
//
// Real user-observed bug: the "هذا ما فهمناه من رحلتك" (what we understood)
// review card, and the persistent "already accounted for" list, both
// rendered a bare option label as the entire summary line — e.g. "ما الذي
// تفضله؟ — مزيج من الاثنين" ("What do you prefer? — A mix of both"). Read
// without the question text right above it (which the persistent list does
// NOT repeat), "مزيج من الاثنين" alone answers nothing: a mix of WHAT?
//
// Root cause: the summary was built from `question.text + ": " +
// option.label` — and `question.text` itself is sometimes a vague generic
// prompt ("ما الذي تفضله؟" / "What do you prefer?"), never written to stand
// alone outside its question card. Question wording and standalone summary
// wording are different concerns with different audiences (a question is
// read WITH its options in front of the user; a summary is read ALONE,
// possibly long after the question was answered).
//
// Fix: this module is the ONE centralized place that maps
// (purposeId, questionId, value) -> a standalone, human-readable summary,
// separate from `question.text`/`option.label` entirely. Never read
// implicitly from `question.text` for this purpose again.
import { QUESTION_BANKS } from './questionBanks';
import type { Lang, PurposeId } from './types';

interface DimensionMeta {
  /** The dimension name alone — e.g. "الميزانية" / "Budget". Always
   *  prefixed to a value so the line is standalone. */
  dimension: Record<Lang, string>;
  /** Explicit, fully-authored per-value summaries for dimensions where
   *  the raw option label is itself ambiguous out of context (bipolar/
   *  compound dimensions like nature-vs-city) — rephrased to name BOTH
   *  sides, never left as a bare "مزيج من الاثنين"/"كلاهما". Takes
   *  priority over the generic tier-word/raw-label fallback below. */
  valueOverrides?: Record<string | number, Record<Lang, string>>;
}

// Generic importance-tier wording, keyed by option COUNT (every
// `kind: 'importance'` question in every bank uses either 4 ascending
// tiers or 2 — see the audit in the Phase 16.5 final report). Applied by
// the option's ORDINAL RANK within its own question, never by absolute
// value (values differ per question — e.g. 20/50/80/100 vs 40/65/85/100 —
// but the tier MEANING at a given rank is the same: low/medium/high/
// highest importance).
const IMPORTANCE_TIER_WORDS: Record<number, Record<Lang, string[]>> = {
  4: {
    ar: ['أهمية منخفضة', 'أهمية متوسطة', 'أهمية عالية', 'أهمية قصوى'],
    en: ['Low importance', 'Medium importance', 'High importance', 'Highest priority'],
  },
};

const DIMENSION_META: Record<PurposeId, Record<string, DimensionMeta>> = {
  tourism: {
    budget: { dimension: { ar: 'الميزانية', en: 'Budget' } },
    climate: { dimension: { ar: 'الطقس المفضل', en: 'Preferred weather' } },
    naturecity: {
      dimension: { ar: 'الطبيعة أو المدن', en: 'Nature or cities' },
      valueOverrides: {
        15: { ar: 'الطبيعة أو المدن: أميل إلى الطبيعة', en: 'Nature or cities: leaning toward nature' },
        50: { ar: 'الطبيعة أو المدن: مزيج متوازن بين الطبيعة والمدن', en: 'Nature or cities: a balanced mix of both' },
        90: { ar: 'الطبيعة أو المدن: أميل إلى المدن', en: 'Nature or cities: leaning toward cities' },
      },
    },
    beaches: {
      dimension: { ar: 'الشواطئ أو الجبال', en: 'Beaches or mountains' },
      valueOverrides: {
        90: { ar: 'الشواطئ أو الجبال: أفضّل الشواطئ والاسترخاء', en: 'Beaches or mountains: prefers beaches & relaxation' },
        50: { ar: 'الشواطئ أو الجبال: مزيج بين الشواطئ والجبال', en: 'Beaches or mountains: a mix of both' },
        10: { ar: 'الشواطئ أو الجبال: أفضّل الجبال والطبيعة', en: 'Beaches or mountains: prefers mountains & nature' },
      },
    },
    adventure: {
      dimension: { ar: 'أسلوب الرحلة', en: 'Trip style' },
      valueOverrides: {
        90: { ar: 'أسلوب الرحلة: أميل إلى المغامرة والأنشطة', en: 'Trip style: leaning toward adventure & activities' },
        50: { ar: 'أسلوب الرحلة: مزيج بين الاسترخاء والمغامرة', en: 'Trip style: a mix of relaxation and adventure' },
        10: { ar: 'أسلوب الرحلة: أميل إلى الراحة والاسترخاء', en: 'Trip style: leaning toward rest & relaxation' },
      },
    },
    nightlife: { dimension: { ar: 'أهمية الحياة الليلية', en: 'Nightlife importance' } },
    safety: { dimension: { ar: 'أهمية الأمان', en: 'Safety importance' } },
    culture: { dimension: { ar: 'الاهتمام بالثقافة والتاريخ', en: 'Interest in culture & history' } },
  },
  work: {
    field: { dimension: { ar: 'المجال المهني', en: 'Professional field' } },
    salary: { dimension: { ar: 'مستوى الراتب المستهدف', en: 'Target salary level' } },
    colTolerance: { dimension: { ar: 'تحمل تكلفة المعيشة', en: 'Cost-of-living tolerance' } },
    language: { dimension: { ar: 'أهمية العمل بالإنجليزية', en: 'Importance of working in English' } },
    jobmarket: { dimension: { ar: 'أهمية فرص العمل', en: 'Importance of job opportunities' } },
    wlb: { dimension: { ar: 'أهمية التوازن بين العمل والحياة', en: 'Importance of work-life balance' } },
    safety: { dimension: { ar: 'أهمية الأمان في المدينة الجديدة', en: 'Safety importance in the new city' } },
    growth: { dimension: { ar: 'أهمية النمو الوظيفي', en: 'Importance of career growth' } },
  },
  education: {
    field: { dimension: { ar: 'التخصص الدراسي', en: 'Field of study' } },
    tuition: { dimension: { ar: 'ميزانية الرسوم الدراسية', en: 'Tuition budget' } },
    uniRank: { dimension: { ar: 'أهمية تصنيف الجامعة', en: 'Importance of university ranking' } },
    language: { dimension: { ar: 'أهمية الدراسة بالإنجليزية', en: 'Importance of studying in English' } },
    safety: { dimension: { ar: 'أهمية أمان الحرم الجامعي والمدينة', en: 'Campus & city safety importance' } },
    col: { dimension: { ar: 'تكلفة المعيشة المحتملة', en: 'Affordable cost of living' } },
  },
  medical: {
    category: { dimension: { ar: 'فئة العلاج', en: 'Treatment category' } },
    quality: { dimension: { ar: 'أهمية جودة الرعاية الصحية', en: 'Healthcare quality importance' } },
    budget: { dimension: { ar: 'ميزانية العلاج', en: 'Treatment budget' } },
    waiting: { dimension: { ar: 'أهمية قصر فترة الانتظار', en: 'Importance of short waiting time' } },
    language: { dimension: { ar: 'أهمية طاقم يتحدث الإنجليزية', en: 'Importance of English-speaking staff' } },
    safety: { dimension: { ar: 'أهمية الأمان العام', en: 'Overall safety importance' } },
  },
  immigration: {
    budget: { dimension: { ar: 'ميزانية الانتقال', en: 'Relocation budget' } },
    jobs: { dimension: { ar: 'أهمية فرص العمل', en: 'Importance of job opportunities' } },
    salary: { dimension: { ar: 'مستوى الراتب المتوقع', en: 'Expected salary level' } },
    safety: { dimension: { ar: 'أهمية الأمان للعائلة', en: 'Safety importance for family' } },
    qol: { dimension: { ar: 'أهمية جودة الحياة العامة', en: 'Overall quality-of-life importance' } },
    friendly: { dimension: { ar: 'أهمية سهولة إجراءات الهجرة', en: 'Importance of immigration friendliness' } },
    lang: { dimension: { ar: 'أهمية بيئة ناطقة بالإنجليزية', en: 'Importance of an English-speaking environment' } },
    family: { dimension: { ar: 'السفر مع العائلة', en: 'Traveling with family' } },
  },
  investment: {
    sector: { dimension: { ar: 'قطاع الاستثمار', en: 'Investment sector' } },
    budget: { dimension: { ar: 'حجم الاستثمار', en: 'Investment scale' } },
    bizease: { dimension: { ar: 'أهمية سهولة ممارسة الأعمال', en: 'Importance of ease of doing business' } },
    growth: { dimension: { ar: 'أهمية إمكانات النمو', en: 'Importance of growth potential' } },
    stability: { dimension: { ar: 'أهمية الاستقرار السياسي والاقتصادي', en: 'Importance of market & political stability' } },
    safety: { dimension: { ar: 'أهمية الأمان العام', en: 'Importance of general safety' } },
  },
  wellness: {
    budget: { dimension: { ar: 'الميزانية', en: 'Budget' } },
    climate: { dimension: { ar: 'الطقس المفضل', en: 'Preferred weather' } },
    nature: { dimension: { ar: 'أهمية التواجد وسط الطبيعة', en: 'Importance of being surrounded by nature' } },
    beachesw: { dimension: { ar: 'أهمية الشواطئ', en: 'Importance of beaches' } },
    spa: { dimension: { ar: 'أهمية مرافق السبا والعافية', en: 'Importance of spa & wellness facilities' } },
    quiet: { dimension: { ar: 'أهمية الهدوء والسكينة', en: 'Importance of peace & quiet' } },
    safety: { dimension: { ar: 'أهمية الأمان', en: 'Safety importance' } },
  },
  other: {
    budget: { dimension: { ar: 'الميزانية', en: 'Budget' } },
    safety: { dimension: { ar: 'أهمية الأمان', en: 'Safety importance' } },
    climate: { dimension: { ar: 'الطقس المفضل', en: 'Preferred weather' } },
    naturecity: {
      dimension: { ar: 'الطبيعة أو المدن', en: 'Nature or cities' },
      valueOverrides: {
        15: { ar: 'الطبيعة أو المدن: أميل إلى الطبيعة', en: 'Nature or cities: leaning toward nature' },
        50: { ar: 'الطبيعة أو المدن: مزيج متوازن بين الطبيعة والمدن', en: 'Nature or cities: a balanced mix of both' },
        90: { ar: 'الطبيعة أو المدن: أميل إلى المدن', en: 'Nature or cities: leaning toward cities' },
      },
    },
    qol: { dimension: { ar: 'أهمية جودة الحياة العامة', en: 'Overall quality-of-life importance' } },
  },
};

/** Builds a STANDALONE, human-readable summary for one answered question —
 *  understandable without seeing `question.text` at all. Never returns a
 *  bare option label alone. Falls back to `dimension: rawLabel` (still
 *  standalone, since every dimension has a real name) if no bespoke
 *  override exists — used for monotonic scales (budget tiers, salary
 *  levels, climate, flavor fields) whose raw labels are already
 *  self-explanatory once the dimension name is attached. */
export function summarizeAnswer(purposeId: PurposeId, questionId: string, value: string | number, lang: Lang): string {
  const bank = QUESTION_BANKS[purposeId];
  const q = bank.find((x) => x.id === questionId);
  const meta = DIMENSION_META[purposeId]?.[questionId];
  const dimensionLabel = meta?.dimension[lang] ?? (q ? (lang === 'ar' ? q.text.ar : q.text.en) : questionId);

  const override = meta?.valueOverrides?.[value];
  if (override) return override[lang];

  if (q?.kind === 'importance') {
    const idx = q.options.findIndex((o) => o.value === value);
    const words = IMPORTANCE_TIER_WORDS[q.options.length];
    if (idx !== -1 && words) return `${dimensionLabel}: ${words[lang][idx]}`;
  }

  const opt = q?.options.find((o) => o.value === value);
  const optLabel = opt ? (lang === 'ar' ? opt.label.ar : opt.label.en) : String(value);
  return `${dimensionLabel}: ${optLabel}`;
}

/** Every (purposeId, questionId) pair this module has explicit dimension
 *  metadata for — used by the global summary audit test to prove full
 *  coverage (no AI-interpretable question silently falls back to its raw
 *  `question.text`, even though that fallback is itself still standalone). */
export function coveredDimensions(): Array<{ purposeId: PurposeId; questionId: string }> {
  const out: Array<{ purposeId: PurposeId; questionId: string }> = [];
  for (const purposeId of Object.keys(DIMENSION_META) as PurposeId[]) {
    for (const questionId of Object.keys(DIMENSION_META[purposeId])) {
      out.push({ purposeId, questionId });
    }
  }
  return out;
}
