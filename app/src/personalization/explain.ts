// Phase 18.4 — "Why it matches YOU". Every sentence is assembled from the
// structured FactorResults the engine produced, so the words can never
// disagree with the score: a factor is only called a match if its outcome
// is 'positive', only called weaker if its outcome is 'negative', and a
// factor that could not be evaluated is never described as either. The
// traveller's own answers are quoted back through the same shared
// vocabulary the Phase 14 result text uses (engine/answerVocabulary.ts).
import { QUESTION_BANKS } from '../data/questionBanks';
import { I18N } from '../data/i18n';
import { costLabel } from '../data/destinationText';
import type { CatalogEntry, Lang } from '../data/types';
import {
  CLIMATE_BARE,
  DIRECTION_PHRASE,
  IMPORTANCE_WANT,
  PURPOSE_PHRASE,
  chosenLabel,
  joinList,
} from '../engine/answerVocabulary';
import { PERSONAL_COPY } from './copy';
import { languageLabel } from './travelNeeds';
import { FACTOR_BY_PROFILE_KEY } from './signals';
import type { FactorId, FactorResult, NormalizedPreferences, PersonalMatch } from './types';

export interface FactorGroups {
  positive: FactorResult[];
  partial: FactorResult[];
  negative: FactorResult[];
  unavailable: FactorResult[];
}

/** Factors grouped by outcome, each group strongest-weight first. */
export function groupFactors(match: PersonalMatch): FactorGroups {
  const byWeight = [...match.factors].sort((a, b) => b.weight - a.weight || a.questionId.localeCompare(b.questionId));
  return {
    positive: byWeight.filter((factor) => factor.outcome === 'positive'),
    partial: byWeight.filter((factor) => factor.outcome === 'partial'),
    negative: byWeight.filter((factor) => factor.outcome === 'negative'),
    unavailable: byWeight.filter((factor) => factor.outcome === 'unavailable'),
  };
}

export function factorLabel(factor: FactorId, lang: Lang): string {
  return PERSONAL_COPY[lang].factor[factor];
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

/** The traveller's own wording for what they asked for — quoted, not
 *  paraphrased into engine terms. */
function preferenceInOwnWords(prefs: NormalizedPreferences, questionId: string, lang: Lang): string | undefined {
  const signal = prefs.signals.find((item) => item.questionId === questionId);
  if (!signal) return undefined;
  if (signal.kind === 'near') return lang === 'ar' ? 'أن تكون قريبة من موقعك' : 'being close to your location';
  if (signal.kind === 'language') {
    const names = String(signal.value).split(',').map((code) => languageLabel(code, lang));
    return lang === 'ar' ? `التواصل ب${joinList(names, 'ar')}` : `communicating in ${joinList(names, 'en')}`;
  }
  if (signal.kind === 'evidence') {
    if (signal.factor === 'halalFood') return lang === 'ar' ? 'سهولة العثور على طعام حلال' : 'finding halal food easily';
    return lang === 'ar' ? 'سهولة ممارسة شعائرك' : 'observing your Islamic practice easily';
  }
  const question = QUESTION_BANKS[prefs.purpose]?.find((item) => item.id === questionId);
  if (!question) return undefined;
  if (signal.kind === 'importance') {
    return question.profileKey ? IMPORTANCE_WANT[question.profileKey]?.[lang] : undefined;
  }
  return chosenLabel(question, { [questionId]: signal.value }, lang);
}

/** personal-match-1.1 — the data exists but shows too little either way.
 *  Said plainly, including what it does NOT mean. */
function noEvidenceDetail(factor: FactorResult, ar: boolean): string {
  if (factor.factor === 'language') {
    return ar
      ? 'لا توجد بين لغاتها الرسمية لغة من لغاتك — ولا يعني ذلك صعوبة التواصل، فلم يُحتسب هذا العامل'
      : 'None of your languages is an official language there — that does not mean communication is hard, so this factor was not counted';
  }
  if (factor.factor === 'halalFood') {
    return ar
      ? 'قليل من الأماكن فيها موسوم بالحلال على الخريطة المفتوحة، فلم يُحتسب هذا العامل — وفي بلدان كثيرة يكون الحلال هو السائد دون وسم'
      : 'Few places there are tagged halal on the open map, so this factor was not counted — in many countries halal is the norm and simply not tagged';
  }
  return ar
    ? 'المسجّل منها على الخريطة المفتوحة قليل، فلم يُحتسب هذا العامل — ولا يعني ذلك صعوبة ممارسة الشعائر'
    : 'Too few places are mapped there to judge, so this factor was not counted — that does not mean practice is difficult';
}

/** One line describing how this country compares on this factor. */
export function factorDetail(factor: FactorResult, lang: Lang): string {
  const ar = lang === 'ar';
  if (factor.outcome === 'unavailable') {
    if (factor.reason === 'noLocation') return ar ? 'موقعك غير مشارك، فلم تُحتسب المسافة' : 'Your location is not shared, so distance was not counted';
    if (factor.reason === 'noEvidence') return noEvidenceDetail(factor, ar);
    return ar ? 'لا تتوفر بيانات مباشرة لهذه الدولة، فلم يُحتسب هذا العامل' : 'No direct data for this country, so this factor was not counted';
  }
  const { outcome } = factor;

  switch (factor.kind) {
    case 'climate': {
      const bare = CLIMATE_BARE[String(factor.countryValue)]?.[lang] ?? '';
      if (outcome === 'positive') return ar ? `مناخها ${bare} — كما فضّلت` : `Its climate is ${bare} — as you preferred`;
      if (outcome === 'partial') return ar ? `مناخها ${bare} — قريب مما فضّلت` : `Its climate is ${bare} — close to your choice`;
      return ar ? `مناخها ${bare} — وليس ما اخترته` : `Its climate is ${bare}, not the one you chose`;
    }
    case 'budget': {
      const level = typeof factor.countryValue === 'number' ? costLabel(I18N[lang].costLevels, factor.countryValue) : '';
      if (factor.direction === 'above') {
        return ar ? `مستوى الأسعار فيها (${level}) أعلى من ميزانيتك` : `Its price level (${level.toLowerCase()}) is above your budget`;
      }
      return ar ? `مستوى الأسعار فيها (${level}) ضمن ميزانيتك` : `Its price level (${level.toLowerCase()}) is within your budget`;
    }
    case 'target': {
      if (outcome === 'positive' || !factor.direction) return ar ? 'قريبة مما اخترت' : 'Close to what you chose';
      const key = (Object.keys(FACTOR_BY_PROFILE_KEY) as (keyof typeof FACTOR_BY_PROFILE_KEY)[])
        .find((profileKey) => FACTOR_BY_PROFILE_KEY[profileKey] === factor.factor);
      const phrase = key ? DIRECTION_PHRASE[key]?.[factor.direction]?.[lang] : undefined;
      if (!phrase) return ar ? 'تختلف عمّا اخترت' : 'Different from what you chose';
      return ar ? phrase : phrase.charAt(0).toUpperCase() + phrase.slice(1);
    }
    case 'want':
    case 'avoid': {
      const has = factor.countryValue === 100;
      if (factor.factor === 'coast') {
        if (factor.kind === 'want') return has ? (ar ? 'تطل على البحر كما أردت' : 'It has a coastline, as you wanted') : (ar ? 'لا تطل على البحر' : 'It has no coastline');
        return has ? (ar ? 'تطل على البحر، وقد فضّلت وجهة داخلية' : 'It has a coastline; you preferred inland') : (ar ? 'دولة داخلية كما فضّلت' : 'Inland, as you preferred');
      }
      if (factor.kind === 'want') return has ? (ar ? 'جزيرة كما فضّلت' : 'An island, as you preferred') : (ar ? 'ليست جزيرة' : 'Not an island');
      return has ? (ar ? 'جزيرة، وقد فضّلت وجهة متصلة باليابسة' : 'An island; you preferred the mainland') : (ar ? 'متصلة باليابسة كما فضّلت' : 'On the mainland, as you preferred');
    }
    case 'importance': {
      const value = typeof factor.countryValue === 'number' ? formatNumber(factor.countryValue) : '';
      const band = outcome === 'positive'
        ? (ar ? 'قوي' : 'strong')
        : outcome === 'partial'
          ? (ar ? 'متوسط' : 'moderate')
          : (ar ? 'أضعف مما طلبت' : 'weaker than you asked for');
      return ar ? `المؤشر ${value}/100 — ${band}` : `Indicator ${value}/100 — ${band}`;
    }
    case 'language': {
      const names = String(factor.countryValue ?? '').split(',').filter(Boolean).map((code) => languageLabel(code, lang));
      return ar
        ? `${joinList(names, 'ar')} من لغاتها الرسمية`
        : `${joinList(names, 'en')} ${names.length > 1 ? 'are official languages' : 'is an official language'} there`;
    }
    case 'evidence': {
      const count = formatNumber(Number(factor.countryValue ?? 0));
      const limited = outcome === 'partial' ? (ar ? ' — عدد محدود' : ' — a limited number') : '';
      if (factor.factor === 'halalFood') {
        return ar
          ? `أماكن موسومة بتقديم طعام حلال على خريطة OpenStreetMap: ${count}${limited}`
          : `${count} places tagged as serving halal food on OpenStreetMap${limited}`;
      }
      return ar
        ? `مساجد ومصليات مسجّلة على خريطة OpenStreetMap: ${count}${limited}`
        : `${count} mosques and Muslim prayer places mapped on OpenStreetMap${limited}`;
    }
    case 'near': {
      const km = formatNumber(factor.distanceKm ?? 0);
      if (outcome === 'negative') return ar ? `على بعد نحو ${km} كم منك — أبعد مما تفضّل` : `About ${km} km from you — farther than you wanted`;
      return ar ? `على بعد نحو ${km} كم منك` : `About ${km} km from you`;
    }
    default:
      return '';
  }
}

/** The one-paragraph explanation for a result card. */
export function personalSummary(match: PersonalMatch, prefs: NormalizedPreferences, dest: CatalogEntry, lang: Lang): string {
  const ar = lang === 'ar';
  const copy = PERSONAL_COPY[lang];
  const name = ar ? dest.nameAr : dest.nameEn;
  const purposePhrase = PURPOSE_PHRASE[prefs.purpose]?.[lang] ?? '';

  const wanted = prefs.signals
    .slice(0, 4)
    .map((signal) => preferenceInOwnWords(prefs, signal.questionId, lang))
    .filter((text): text is string => !!text);

  const opening = ar
    ? (wanted.length ? `اخترت ${purposePhrase}، وفضّلت ${joinList(wanted, 'ar')}.` : `اخترت ${purposePhrase}.`)
    : (wanted.length ? `You chose ${purposePhrase} and preferred ${joinList(wanted, 'en')}.` : `You chose ${purposePhrase}.`);

  if (match.score === null) return `${opening} ${copy.noSignals}`;

  const groups = groupFactors(match);
  const positives = groups.positive.slice(0, 3).map((factor) => factorLabel(factor.factor, lang));
  const negatives = groups.negative.slice(0, 2).map((factor) => factorLabel(factor.factor, lang));

  let body: string;
  if (ar) {
    body = positives.length
      ? ` ${name}: توافق مع تفضيلاتك في ${joinList(positives, 'ar')}`
      : ` ${name}: توافق جزئي مع تفضيلاتك`;
    body += negatives.length ? `، بينما ${joinList(negatives, 'ar')} أقل توافقًا مع ما اخترته.` : '.';
  } else {
    body = positives.length ? ` ${name} fits you on ${joinList(positives, 'en')}` : ` ${name} only partly fits your preferences`;
    body += negatives.length
      ? `; it is a weaker fit on ${joinList(negatives, 'en')}.`
      : '.';
  }
  const constraint = match.eligible ? '' : ` ${copy.constraintFailed}.`;
  return `${opening}${body}${constraint}`;
}
