// Item #10 — the explanation must speak the traveller's language and cite
// the traveller's own choices. The previous version emitted engine labels
// ("purpose fit", "climate", "price level"), which is what the user rejected.
import { describe, expect, it } from 'vitest';
import { buildWhyText, rankDestinations } from './index';
import { QUESTION_BANKS } from '../data/questionBanks';
import { WORLD_CATALOG } from '../data/worldCatalog';
import type { Answers } from './types';
import type { PurposeId } from '../data/types';

function answersFor(purpose: PurposeId, picks: Record<string, number | string>): Answers {
  const answers: Answers = {};
  for (const [dimension, value] of Object.entries(picks)) answers[`${purpose}-${dimension}`] = value;
  return answers;
}

function explain(purpose: PurposeId, answers: Answers, lang: 'ar' | 'en', rank = 0) {
  const ranked = rankDestinations(purpose, answers);
  const item = ranked[rank]!;
  return { text: buildWhyText(lang, purpose, item.reasons, item.dest, item.score, answers), item };
}

const STUDENT = answersFor('education', {
  climate: 'mediterranean',
  cost: 2,
  urbanity: 95,
  safety: 100,
  education: 100,
});

const BACKPACKER = answersFor('tourism', {
  climate: 'cold',
  cost: 1,
  urbanity: 15,
  coastal: 0,
  popularity: 10,
});

const INVESTOR = answersFor('investment', {
  climate: 'desert',
  cost: 4,
  urbanity: 95,
  investment: 100,
  growth: 100,
  income: 75,
});

describe('the explanation never uses internal engine terminology', () => {
  const FORBIDDEN_EN = [/purpose fit/i, /climate score/i, /cost factor/i, /price level/i, /profile key/i, /tourism popularity/i, /\bfit\b/i, /\bweight\b/i];
  const FORBIDDEN_AR = [/ملاءمة الغرض/, /مستوى الأسعار الداخلي/, /معامل/, /الوزن/];

  it('across every purpose, in English', () => {
    for (const purpose of Object.keys(QUESTION_BANKS) as PurposeId[]) {
      const answers = answersFor(purpose, { cost: 2, safety: 75 });
      const { text } = explain(purpose, answers, 'en');
      for (const pattern of FORBIDDEN_EN) {
        expect(pattern.test(text), `${purpose}: ${text}`).toBe(false);
      }
    }
  });

  it('across every purpose, in Arabic', () => {
    for (const purpose of Object.keys(QUESTION_BANKS) as PurposeId[]) {
      const answers = answersFor(purpose, { cost: 2, safety: 75 });
      const { text } = explain(purpose, answers, 'ar');
      for (const pattern of FORBIDDEN_AR) {
        expect(pattern.test(text), `${purpose}: ${text}`).toBe(false);
      }
    }
  });
});

describe('the explanation quotes the traveller\'s own answers back', () => {
  it('names what they came for', () => {
    expect(explain('education', STUDENT, 'en').text).toMatch(/You chose studying abroad/);
    expect(explain('education', STUDENT, 'ar').text).toMatch(/اخترت الدراسة في الخارج/);
    expect(explain('tourism', BACKPACKER, 'en').text).toMatch(/You chose a holiday/);
    expect(explain('investment', INVESTOR, 'en').text).toMatch(/You chose investing/);
  });

  it('names the actual options they picked, not the dimension names', () => {
    const text = explain('education', STUDENT, 'en').text;
    expect(text).toMatch(/5,000 – 10,000 SAR/);
    expect(text).toMatch(/warm, mild climate/);
    expect(text).toMatch(/strong education indicators/);
  });

  it('keeps acronyms intact inside a quoted answer', () => {
    // A blanket lowercase would have produced "5,000 – 10,000 sar".
    expect(explain('education', STUDENT, 'en').text).not.toMatch(/\bsar\b/);
  });

  it('mentions between two and four matched factors', () => {
    // Counted by looking for the phrases the five answered dimensions would
    // each produce, rather than by splitting on commas — several option
    // labels contain commas of their own ("5,000 – 10,000 SAR", "a warm,
    // mild climate"), which makes naive splitting overcount.
    const studentPhrases = [
      '5,000 – 10,000 SAR',
      'warm, mild climate',
      'strong education indicators',
      'major city with active student life',
      'a low crime rate',
    ];
    const text = explain('education', STUDENT, 'en').text;
    const named = studentPhrases.filter((phrase) => text.includes(phrase));
    expect(named.length, text).toBeGreaterThanOrEqual(2);
    expect(named.length, text).toBeLessThanOrEqual(4);
    // Five dimensions were answered, so at least one must have been left out
    // — the explanation summarises, it does not dump every answer.
    expect(named.length, text).toBeLessThan(studentPhrases.length);
  });

  it('names at least two factors for every purpose that has good matches', () => {
    for (const [purpose, answers] of [['tourism', BACKPACKER], ['investment', INVESTOR]] as const) {
      const text = explain(purpose, answers, 'en').text;
      expect(text, purpose).toMatch(/preferred /);
      expect(text.includes(' and '), `${purpose}: ${text}`).toBe(true);
    }
  });

  it('never claims a preference the traveller did not express', () => {
    // 50 is the "no preference" value on coastal/island.
    const indifferent = answersFor('tourism', { coastal: 50, island: 50, cost: 2 });
    const text = explain('tourism', indifferent, 'en').text;
    expect(text).not.toMatch(/no preference/i);
    expect(text).not.toMatch(/beaches|inland|island|mainland/i);
  });
});

describe('the trade-off is real, directional, and never invented', () => {
  it('states the direction of the gap, read from the destination\'s own profile', () => {
    // Somewhere far down the ranking must differ from the traveller on
    // something; whatever is named has to be a direction or a named subject,
    // never a bare dimension label.
    const { text } = explain('tourism', BACKPACKER, 'en', 193);
    expect(text).toMatch(/However, /);
    expect(text).toMatch(
      /more expensive|cheaper|more urban|quieter and less urban|more coastal|less coastal|more of an island|more of a mainland|larger|smaller|better known|less known|its climate is|is weaker than you asked for|farther from you/,
    );
  });

  it('omits the trade-off sentence entirely when nothing scored badly', () => {
    // The top result for its own ideal answers should have no weak factor.
    const { text } = explain('education', STUDENT, 'en');
    expect(text).not.toMatch(/However, /);
  });

  it('never promises a perfect or guaranteed fit', () => {
    for (const rank of [0, 1, 50, 193]) {
      for (const lang of ['en', 'ar'] as const) {
        const { text } = explain('education', STUDENT, lang, rank);
        expect(text).not.toMatch(/perfect|guarantee|ideal match|مثالي|مضمون/i);
      }
    }
  });

  it('describes a climate mismatch with the climate the destination really has', () => {
    const { text, item } = explain('investment', INVESTOR, 'en');
    if (/its climate is/.test(text)) {
      expect(WORLD_CATALOG.some((entry) => entry.id === item.dest.id)).toBe(true);
      expect(text).toMatch(/its climate is (cold|cool and temperate|warm and mild|warm and humid|hot and dry), not the one you chose/);
    }
  });
});

describe('the explanation genuinely varies', () => {
  it('differs between two different traveller profiles for the SAME destination', () => {
    const destination = WORLD_CATALOG.find((entry) => entry.countryCode === 'TR')!;
    const first = rankDestinations('education', STUDENT).find((item) => item.dest.id === destination.id)!;
    const second = rankDestinations('education', answersFor('education', {
      climate: 'cold',
      cost: 4,
      urbanity: 15,
      safety: 25,
      education: 25,
    }))!.find((item) => item.dest.id === destination.id)!;
    const textA = buildWhyText('en', 'education', first.reasons, first.dest, first.score, STUDENT);
    const textB = buildWhyText('en', 'education', second.reasons, second.dest, second.score, answersFor('education', {
      climate: 'cold',
      cost: 4,
      urbanity: 15,
      safety: 25,
      education: 25,
    }));
    expect(textA).not.toBe(textB);
  });

  it('differs between destinations for the SAME traveller', () => {
    const ranked = rankDestinations('tourism', BACKPACKER);
    const texts = [0, 1, 2, 30, 100, 193].map((rank) =>
      buildWhyText('en', 'tourism', ranked[rank]!.reasons, ranked[rank]!.dest, ranked[rank]!.score, BACKPACKER),
    );
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('produces many distinct explanations across the whole ranking, not one template', () => {
    const ranked = rankDestinations('tourism', BACKPACKER);
    // Strip the destination name so identical-but-for-the-name sentences do
    // not count as variation.
    const shapes = new Set(
      ranked.slice(0, 60).map((item) => {
        const text = buildWhyText('en', 'tourism', item.reasons, item.dest, item.score, BACKPACKER);
        return text.replace(item.dest.nameEn, '<name>');
      }),
    );
    expect(shapes.size).toBeGreaterThan(3);
  });

  it('produces a different sentence in Arabic than in English, not a transliteration', () => {
    const en = explain('tourism', BACKPACKER, 'en').text;
    const ar = explain('tourism', BACKPACKER, 'ar').text;
    expect(ar).not.toBe(en);
    expect(ar).toMatch(/اخترت/);
  });

  it('uses a nominal Arabic clause, so it never disagrees in gender with a country name', () => {
    for (const rank of [0, 5, 60, 193]) {
      const { text } = explain('tourism', BACKPACKER, 'ar', rank);
      expect(text).not.toMatch(/يتوافق|تتوافق/);
      expect(text).toMatch(/توافق (قوي|جيد|جزئي)|من أقرب الوجهات/);
    }
  });
});

describe('degenerate inputs stay safe', () => {
  it('still says something useful when the traveller has answered nothing', () => {
    const text = buildWhyText('en', 'tourism', [], WORLD_CATALOG[0]!, 50, {});
    expect(text).toMatch(/You chose a holiday/);
    expect(text).not.toMatch(/undefined|NaN/);
  });

  it('ignores reasons that carry no weight rather than presenting them as matches', () => {
    const dest = WORLD_CATALOG[0]!;
    const text = buildWhyText('en', 'tourism', [{ id: 'tourism-climate', weight: 0, fit: 100 }], dest, 70, {
      'tourism-climate': 'cold',
    });
    expect(text).not.toMatch(/cold climate/);
  });
});
