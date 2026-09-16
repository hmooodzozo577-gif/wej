// Item #10 — "Why this suits you", in the user's own words.
//
// What was wrong: the explanation was assembled from ENGINE labels — "purpose
// fit", "climate", "price level", "tourism popularity". Those are the names
// of scoring dimensions, not anything the traveller said, and the result read
// like a debug dump ("Japan is a good match for your priorities, especially
// purpose fit, climate, price level").
//
// What this produces instead is built from the chain the user's brief
// specifies, one link at a time:
//
//     the user's answer  ->  its canonical meaning  ->  the destination's
//     real value on that dimension  ->  a match or a trade-off
//
// Concretely: the OPTION LABEL the traveller actually picked is what gets
// quoted back ("warm and mild", "up to 5,000 SAR", "a large city with quieter
// areas nearby"), and a trade-off names the real DIRECTION of the gap ("more
// expensive than the level you chose", "more urban than you chose", "farther
// from you than you wanted"), derived by comparing the destination's stored
// profile value against the answer.
//
// Every clause traces to something real:
//   - a factor is only named if the traveller answered that question
//   - a trade-off is only named if a real answered dimension scored badly
//   - no destination characteristic is asserted that is not in the profile
//   - nothing ever claims a perfect or guaranteed fit
import { QUESTION_BANKS } from '../data/questionBanks';
import { RECOMMENDATION_PROFILE_BY_CODE } from '../data/worldRecommendation';
import type { CatalogEntry, Lang, LocalizedText, PurposeId, Question } from '../data/types';
import type { Answers, Reason } from './types';

/** What the traveller came for, said the way they would say it — never
 *  "purpose fit". */
const PURPOSE_PHRASE: Record<PurposeId, LocalizedText> = {
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
const IMPORTANCE_SUBJECT: Partial<Record<string, LocalizedText>> = {
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
const IMPORTANCE_WANT: Partial<Record<string, LocalizedText>> = {
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
const PREFERENCE_WANT: Partial<Record<string, Record<number, LocalizedText>>> = {
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
const DIRECTION_PHRASE: Partial<Record<string, { above: LocalizedText; below: LocalizedText }>> = {
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

const PROXIMITY_TRADE_OFF: LocalizedText = {
  ar: 'المسافة إليها أبعد مما تفضّل',
  en: 'it is farther from you than you wanted',
};

/** Two forms per climate: the noun phrase used when quoting the traveller's
 *  own choice back to them, and the bare adjective used after "its climate
 *  is ..." — without the split, the trade-off sentence reads "its climate is
 *  a cold climate". */
const CLIMATE_LABELS: Record<string, LocalizedText> = {
  cold: { ar: 'مناخًا باردًا', en: 'a cold climate' },
  temperate: { ar: 'مناخًا معتدلًا يميل للبرودة', en: 'a cool, temperate climate' },
  mediterranean: { ar: 'مناخًا دافئًا ومعتدلًا', en: 'a warm, mild climate' },
  tropical: { ar: 'مناخًا دافئًا ورطبًا', en: 'a warm, humid climate' },
  desert: { ar: 'مناخًا حارًا وجافًا', en: 'a hot, dry climate' },
};

const CLIMATE_BARE: Record<string, LocalizedText> = {
  cold: { ar: 'بارد', en: 'cold' },
  temperate: { ar: 'معتدل يميل للبرودة', en: 'cool and temperate' },
  mediterranean: { ar: 'دافئ ومعتدل', en: 'warm and mild' },
  tropical: { ar: 'دافئ ورطب', en: 'warm and humid' },
  desert: { ar: 'حار وجاف', en: 'hot and dry' },
};

/** A fit at or above this is worth naming as something that matched. */
const GOOD_FIT = 62;
/** A fit below this is worth naming as an honest trade-off. */
const WEAK_FIT = 55;

function questionOf(purposeId: PurposeId, reasonId: string): Question | undefined {
  return QUESTION_BANKS[purposeId]?.find((question) => question.id === reasonId);
}

/** The traveller's own words for the option they picked — this is the whole
 *  point of item #10: quote the answer back, do not name the dimension. */
function chosenLabel(question: Question, answers: Answers, lang: Lang): string | undefined {
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

/** How the destination actually differs from the answer, or undefined when
 *  the dimension has no meaningful direction (an importance question has a
 *  level, not a direction). */
function directionOf(question: Question, answers: Answers, dest: CatalogEntry, lang: Lang): string | undefined {
  const key = question.profileKey;
  if (!key) return undefined;
  const phrases = DIRECTION_PHRASE[key];
  if (!phrases) return undefined;
  const profile = RECOMMENDATION_PROFILE_BY_CODE.get(dest.countryCode);
  const actual = profile?.[key];
  const answer = answers[question.id];
  if (typeof actual !== 'number' || typeof answer !== 'number') return undefined;
  if (actual === answer) return undefined;
  return (actual > answer ? phrases.above : phrases.below)[lang];
}

/** The honest trade-off clause for one genuinely weak answered dimension.
 *  Never invented: it describes a direction read from the profile, a climate
 *  the destination really has, or a distance the traveller really asked
 *  about. */
function tradeOffClause(
  purposeId: PurposeId,
  reason: Reason,
  answers: Answers,
  dest: CatalogEntry,
  lang: Lang,
): string | undefined {
  if (reason.id === '__purpose') return undefined;
  const question = questionOf(purposeId, reason.id);
  if (!question) return undefined;

  if (question.kind === 'proximity') return PROXIMITY_TRADE_OFF[lang];

  if (question.kind === 'climate') {
    const profile = RECOMMENDATION_PROFILE_BY_CODE.get(dest.countryCode);
    const actual = profile ? CLIMATE_BARE[String(profile.climate)] : undefined;
    if (!actual) return undefined;
    return lang === 'ar' ? `مناخها ${actual.ar} وليس ما اخترته` : `its climate is ${actual.en}, not the one you chose`;
  }

  const direction = directionOf(question, answers, dest, lang);
  if (direction) return direction;

  if (question.kind === 'importance' && question.profileKey) {
    const subject = IMPORTANCE_SUBJECT[question.profileKey];
    if (!subject) return undefined;
    return lang === 'ar'
      ? `${subject.ar} أقل مما طلبت`
      : `${subject.en} is weaker than you asked for`;
  }
  return undefined;
}

function joinList(parts: string[], lang: Lang): string {
  if (parts.length <= 1) return parts[0] ?? '';
  const last = parts[parts.length - 1]!;
  const head = parts.slice(0, -1).join(lang === 'ar' ? '، ' : ', ');
  return lang === 'ar' ? `${head} و${last}` : `${head} and ${last}`;
}

export function buildWhyText(
  lang: Lang,
  purposeId: string,
  reasons: Reason[],
  dest: CatalogEntry,
  score: number,
  answers: Answers = {},
): string {
  const purpose = purposeId as PurposeId;
  const name = lang === 'ar' ? dest.nameAr : dest.nameEn;
  const purposePhrase = PURPOSE_PHRASE[purpose]?.[lang] ?? '';

  // Only dimensions the traveller actually answered, and that actually
  // scored — reasons with zero weight contributed nothing and must not be
  // presented as if they had.
  const answered = reasons.filter((reason) => reason.id !== '__purpose' && reason.weight > 0);

  const matched = answered
    .filter((reason) => reason.fit >= GOOD_FIT)
    .sort((a, b) => b.weight * b.fit - a.weight * a.fit)
    .slice(0, 4)
    .map((reason) => {
      const question = questionOf(purpose, reason.id);
      if (!question) return undefined;
      if (question.kind === 'proximity') {
        return lang === 'ar' ? 'أن تكون قريبة من موقعك' : 'being close to your location';
      }
      if (question.kind === 'importance') {
        const want = question.profileKey ? IMPORTANCE_WANT[question.profileKey] : undefined;
        return want?.[lang];
      }
      return chosenLabel(question, answers, lang);
    })
    .filter((clause): clause is string => !!clause);

  const weakest = [...answered].sort((a, b) => a.fit - b.fit)[0];
  const tradeOff = weakest && weakest.fit < WEAK_FIT
    ? tradeOffClause(purpose, weakest, answers, dest, lang)
    : undefined;

  // Deliberately never "a perfect match": the score is an estimate built on
  // partly-imputed indicator data (see Results' own method note).
  // Arabic uses a nominal clause ("<name>: strong agreement with these
  // choices") rather than a verb, because a verb would have to agree in
  // gender with 194 different country names — most of which are feminine in
  // Arabic, but not all, and the catalogue does not record grammatical
  // gender. A nominal clause is correct for every one of them.
  const strength = score >= 80
    ? { ar: 'توافق قوي مع هذه الاختيارات', en: 'matches those choices closely' }
    : score >= 60
      ? { ar: 'توافق جيد مع هذه الاختيارات', en: 'matches those choices well' }
      : { ar: 'توافق جزئي مع هذه الاختيارات', en: 'matches those choices only partly' };

  if (lang === 'ar') {
    const opening = matched.length
      ? `اخترت ${purposePhrase}، وفضّلت ${joinList(matched, 'ar')}.`
      : `اخترت ${purposePhrase}.`;
    const body = matched.length
      ? ` ${name}: ${strength.ar}.`
      : ` ${name}: من أقرب الوجهات لما اخترته حتى الآن.`;
    const trade = tradeOff ? ` لكن ${tradeOff}.` : '';
    return `${opening}${body}${trade}`;
  }

  const opening = matched.length
    ? `You chose ${purposePhrase}, and preferred ${joinList(matched, 'en')}.`
    : `You chose ${purposePhrase}.`;
  const body = matched.length
    ? ` ${name} ${strength.en}.`
    : ` ${name} is among the closest fits to what you have chosen so far.`;
  const trade = tradeOff ? ` However, ${tradeOff}.` : '';
  return `${opening}${body}${trade}`;
}
