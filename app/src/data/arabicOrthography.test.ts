// Item #1 — Arabic ya / alef-maqsura orthography, enforced.
//
// The user reported the nearest-sort label as "الأقرب إلى موقعى" (final
// alef maqsura ى where a ya ي belongs). That exact string is NOT in this
// repository and never has been — see the acceptance report — but the
// mistake it names is a whole CLASS of Arabic typo, and the class is worth
// a guard rather than a one-off assertion:
//
//   - a word that must end in ya (a possessive "-i", a nisba adjective)
//     written with alef maqsura: موقعى for موقعي
//   - a word that must end in alef maqsura written with ya: علي for على
//
// Both directions are checked across EVERY Arabic string the app can
// render, so the next one is caught wherever it is introduced.
import { describe, expect, it } from 'vitest';
import { I18N } from './i18n';
import { DESTINATIONS } from './destinations';
import { QUESTION_BANKS } from './questionBanks';

/** Every string reachable from a JSON-shaped value, with its path. */
function strings(value: unknown, path = ''): { path: string; text: string }[] {
  if (typeof value === 'string') return [{ path, text: value }];
  if (Array.isArray(value)) return value.flatMap((item, index) => strings(item, `${path}[${index}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) =>
      strings(item, path ? `${path}.${key}` : key),
    );
  }
  return [];
}

const ARABIC_SOURCES: Record<string, unknown> = {
  'I18N.ar': I18N.ar,
  destinations: DESTINATIONS.map((destination) => ({
    id: destination.id,
    nameAr: destination.nameAr,
    descAr: destination.descAr,
    citiesAr: destination.citiesAr,
  })),
  questionBanks: QUESTION_BANKS,
};

function arabicWords(text: string): string[] {
  return text.match(/[؀-ۿݐ-ݿ]+/g) ?? [];
}

/** Words that legitimately end in alef maqsura (ى). Anything else ending
 *  in ى in our copy is the موقعى-class typo. */
const ALEF_MAQSURA_WORDS = new Set([
  'إلى', 'على', 'حتى', 'لدى', 'متى', 'سوى', 'يرجى', 'يُرجى',
  'أخرى', 'الأخرى', 'أولى', 'الأولى', 'كبرى', 'الكبرى', 'صغرى', 'الصغرى',
  'عظمى', 'العظمى', 'قصوى', 'القصوى', 'أقصى', 'الأقصى', 'أدنى', 'الأدنى',
  'أعلى', 'الأعلى', 'مستوى', 'المستوى', 'لمستوى', 'كمستوى', 'بمستوى',
  'مدى', 'المدى', 'بمدى', 'محتوى', 'المحتوى', 'مبنى', 'المبنى',
  'معنى', 'المعنى', 'مقهى', 'المقهى', 'ملتقى', 'الملتقى',
  'معفى', 'المعفى', 'أقوى', 'الأقوى', 'وسطى', 'الوسطى', 'مصطفى',
  'شتى', 'أغنى', 'الأغنى', 'أبقى', 'أنقى', 'أحرى', 'يسعى', 'يبقى',
  'مرسى', 'المرسى', 'منحنى', 'المنحنى', 'مستشفى', 'المستشفى',
]);

/** Words that must NOT be written with a final ya — the reverse typo.
 *
 *  Deliberately excluded, because a final ya is CORRECT there: لدي / علي /
 *  إلي carrying the first-person pronoun ("I have no preference" is
 *  "لا فرق لدي", not "لدى"). Only forms with no first-person reading are
 *  listed. */
const MUST_END_IN_ALEF_MAQSURA = new Set([
  'حتي', 'متي', 'اخري', 'أخري', 'الاخري', 'الأخري',
  'مستوي', 'المستوي', 'مدي', 'المدي', 'اقصي', 'أقصي', 'الاقصي', 'الأقصي',
  'اعلي', 'أعلي', 'الاعلي', 'الأعلي', 'كبري', 'الكبري', 'محتوي', 'المحتوي',
]);

describe('Arabic ya / alef-maqsura orthography', () => {
  it('never ends a word in alef maqsura unless that word genuinely takes one', () => {
    const offenders: string[] = [];
    for (const [source, value] of Object.entries(ARABIC_SOURCES)) {
      for (const { path, text } of strings(value)) {
        for (const word of arabicWords(text)) {
          if (word.endsWith('ى') && !ALEF_MAQSURA_WORDS.has(word)) {
            offenders.push(`${source}.${path}: "${word}"`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('never writes an alef-maqsura word with a final ya', () => {
    const offenders: string[] = [];
    for (const [source, value] of Object.entries(ARABIC_SOURCES)) {
      for (const { path, text } of strings(value)) {
        for (const word of arabicWords(text)) {
          if (MUST_END_IN_ALEF_MAQSURA.has(word)) offenders.push(`${source}.${path}: "${word}"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('spells the nearest-sort label the user reported with a final ya', () => {
    expect(I18N.ar.explore.sortNearest).toBe('الأقرب إلى موقعي');
  });

  // The pair was inconsistent: "nearest to MY LOCATION" against "farthest
  // from YOU". Both now speak about the same thing in the same voice.
  it('phrases nearest and farthest as one consistent pair in both languages', () => {
    expect(I18N.ar.explore.sortFarthest).toBe('الأبعد عن موقعي');
    expect(I18N.en.explore.sortNearest).toBe('Nearest to me');
    expect(I18N.en.explore.sortFarthest).toBe('Farthest from me');
  });
});
