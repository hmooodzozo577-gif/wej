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
import type { CatalogEntry, Lang, PurposeId, Question } from '../data/types';
import type { Answers, Reason } from './types';
import {
  CLIMATE_BARE,
  DIRECTION_PHRASE,
  IMPORTANCE_SUBJECT,
  IMPORTANCE_WANT,
  PROXIMITY_TRADE_OFF,
  PURPOSE_PHRASE,
  chosenLabel,
  joinList,
} from './answerVocabulary';

/** A fit at or above this is worth naming as something that matched. */
const GOOD_FIT = 62;
/** A fit below this is worth naming as an honest trade-off. */
const WEAK_FIT = 55;

function questionOf(purposeId: PurposeId, reasonId: string): Question | undefined {
  return QUESTION_BANKS[purposeId]?.find((question) => question.id === reasonId);
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
