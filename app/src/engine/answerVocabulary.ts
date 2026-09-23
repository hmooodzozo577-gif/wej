// The traveller-facing vocabulary shared by every explanation Wejhaty
// writes from quiz answers: the Phase 14 result text (buildWhyText.ts) and
// the Phase 18 Personal Match explanation (personalization/explain.ts).
// One vocabulary, so the two can never describe the same answer in two
// different ways. Moved verbatim out of buildWhyText.ts — no wording or
// behaviour change.
import type { Lang, LocalizedText, PurposeId, Question } from '../data/types';
import type { Answers } from './types';

/** What the traveller came for, said the way they would say it — never
 *  "purpose fit". */
export const PURPOSE_PHRASE: Record<PurposeId, LocalizedText> = {
  tourism: { ar: 'رحلة سياحية', en: 'a holiday' },
  work: { ar: 'العمل في الخارج', en: 'working abroad' },
  education: { ar: 'الدراسة في الخارج', en: 'studying abroad' },
  medical: { ar: 'رحلة علاجية', en: 'medical treatment' },
  immigration: { ar: 'الهجرة والاستقرار', en: 'relocating' },
  investment: { ar: 'الاستثمار', en: 'investing' },
  wellness: { ar: 'الاستجمام', en: 'rest and recovery' },
  other: { ar: 'غرض آخر', en: 'another purpose' },
};

/** Plain-language names for the "how important is X" dimensions. These are
 *  what the thing IS to a traveller, not what the engine calls its column. */
export const IMPORTANCE_SUBJECT: Partial<Record<string, LocalizedText>> = {
  safety: { ar: 'مستوى الأمان فيها', en: 'its safety record' },
  income: { ar: 'مستوى الدخل فيها', en: 'its income levels' },
  health: { ar: 'نظامها الصحي', en: 'its health system' },
  education: { ar: 'مؤشرات التعليم فيها', en: 'its education indicators' },
  opportunity: { ar: 'فرص العمل فيها', en: 'its job opportunities' },
  investment: { ar: 'نشاط الاستثمار الأجنبي فيها', en: 'its foreign-investment activity' },
  growth: { ar: 'نمو اقتصادها', en: 'its economic growth' },
  popularity: { ar: 'مدى شهرتها', en: 'its international profile' },
};

/** The same dimensions said as something a traveller WANTED, for the
 *  "you preferred ..." list. An importance question's option label is a
 *  bare intensity ("very important"), which says nothing on its own — this
 *  is what that intensity was about. */
export const IMPORTANCE_WANT: Partial<Record<string, LocalizedText>> = {
  safety: { ar: 'انخفاض معدل الجريمة', en: 'a low crime rate' },
  income: { ar: 'ارتفاع مستوى الدخل', en: 'high income levels' },
  health: { ar: 'قوة النظام الصحي', en: 'a strong health system' },
  education: { ar: 'قوة مؤشرات التعليم', en: 'strong education indicators' },
  opportunity: { ar: 'قوة فرص العمل', en: 'strong job opportunities' },
  investment: { ar: 'نشاط الاستثمار الأجنبي', en: 'active foreign investment' },
  growth: { ar: 'اقتصادًا ينمو', en: 'a growing economy' },
  popularity: { ar: 'وجهة معروفة', en: 'a well-known destination' },
};

/** Yes/no preference dimensions: their option labels are conversational
 *  ("No, I prefer an inland destination") and read badly inside a list of
 *  preferences. The middle "no preference" value is deliberately absent —
 *  a traveller who expressed no preference must never be told they
 *  "preferred" anything here. */
export const PREFERENCE_WANT: Partial<Record<string, Record<number, LocalizedText>>> = {
  coastal: {
    100: { ar: 'شواطئ أو ساحلًا قريبًا', en: 'beaches or a nearby coast' },
    0: { ar: 'وجهة داخلية', en: 'an inland destination' },
  },
  island: {
    100: { ar: 'أن تكون جزيرة', en: 'an island' },
    0: { ar: 'دولة متصلة باليابسة', en: 'a mainland country' },
  },
};

/** For a "pick a value on a scale" dimension, how the destination differs
 *  when it sits ABOVE or BELOW what the traveller chose. Direction is
 *  computed from the real profile value, never assumed. */
export const DIRECTION_PHRASE: Partial<Record<string, { above: LocalizedText; below: LocalizedText }>> = {
  costLevel: {
    above: { ar: 'مستوى الأسعار فيها أعلى مما اخترت', en: 'it is more expensive than the level you chose' },
    below: { ar: 'مستوى الأسعار فيها أقل مما اخترت', en: 'it is cheaper than the level you chose' },
  },
  urbanity: {
    above: { ar: 'طابعها الحضري أعلى مما اخترت', en: 'it is more urban than you chose' },
    below: { ar: 'طابعها الحضري أقل مما اخترت', en: 'it is quieter and less urban than you chose' },
  },
  coastal: {
    above: { ar: 'ارتباطها بالساحل أكبر مما اخترت', en: 'it is more coastal than you chose' },
    below: { ar: 'ارتباطها بالساحل أقل مما اخترت', en: 'it is less coastal than you chose' },
  },
  island: {
    above: { ar: 'طابعها الجزري أوضح مما اخترت', en: 'it is more of an island than you chose' },
    below: { ar: 'طابعها الجزري أقل مما اخترت', en: 'it is more of a mainland country than you chose' },
  },
  size: {
    above: { ar: 'مساحتها أكبر مما اخترت', en: 'it is larger than you chose' },
    below: { ar: 'مساحتها أصغر مما اخترت', en: 'it is smaller than you chose' },
  },
  popularity: {
    above: { ar: 'شهرتها أعلى مما اخترت', en: 'it is better known than you chose' },
    below: { ar: 'شهرتها أقل مما اخترت', en: 'it is less known than you chose' },
  },
};

export const PROXIMITY_TRADE_OFF: LocalizedText = {
  ar: 'المسافة إليها أبعد مما تفضّل',
  en: 'it is farther from you than you wanted',
};

/** Two forms per climate: the noun phrase used when quoting the traveller's
 *  own choice back to them, and the bare adjective used after "its climate
 *  is ..." — without the split, the trade-off sentence reads "its climate is
 *  a cold climate". */
export const CLIMATE_LABELS: Record<string, LocalizedText> = {
  cold: { ar: 'مناخًا باردًا', en: 'a cold climate' },
  temperate: { ar: 'مناخًا معتدلًا يميل للبرودة', en: 'a cool, temperate climate' },
  mediterranean: { ar: 'مناخًا دافئًا ومعتدلًا', en: 'a warm, mild climate' },
  tropical: { ar: 'مناخًا دافئًا ورطبًا', en: 'a warm, humid climate' },
  desert: { ar: 'مناخًا حارًا وجافًا', en: 'a hot, dry climate' },
};

export const CLIMATE_BARE: Record<string, LocalizedText> = {
  cold: { ar: 'بارد', en: 'cold' },
  temperate: { ar: 'معتدل يميل للبرودة', en: 'cool and temperate' },
  mediterranean: { ar: 'دافئ ومعتدل', en: 'warm and mild' },
  tropical: { ar: 'دافئ ورطب', en: 'warm and humid' },
  desert: { ar: 'حار وجاف', en: 'hot and dry' },
};

/** The traveller's own words for the option they picked — this is the whole
 *  point of item #10: quote the answer back, do not name the dimension. */
export function chosenLabel(question: Question, answers: Answers, lang: Lang): string | undefined {
  const answer = answers[question.id];
  if (answer === undefined) return undefined;

  if (question.kind === 'climate') {
    const climate = CLIMATE_LABELS[String(answer)];
    if (climate) return climate[lang];
  }

  // A yes/no/either dimension: use the written-out preference, and treat
  // "no preference" (the middle value) as nothing the traveller preferred.
  const preference = question.profileKey ? PREFERENCE_WANT[question.profileKey] : undefined;
  if (preference) {
    if (typeof answer !== 'number') return undefined;
    return preference[answer]?.[lang];
  }

  const option = question.options.find((item) => item.value === answer);
  if (!option) return undefined;
  // Lowercase only the leading character: the labels are sentence-cased for
  // standalone display, but "SAR" and other acronyms inside them must not be
  // flattened ("5,000 – 10,000 sar").
  const label = option.label[lang];
  if (lang === 'ar') return label;
  return label.charAt(0).toLowerCase() + label.slice(1);
}

export function joinList(parts: string[], lang: Lang): string {
  if (parts.length <= 1) return parts[0] ?? '';
  const last = parts[parts.length - 1]!;
  const head = parts.slice(0, -1).join(lang === 'ar' ? '، ' : ', ');
  return lang === 'ar' ? `${head} و${last}` : `${head} and ${last}`;
}
