// Acceptance fix — proves generate-featured-cities.mjs's coordinate-index
// key generation now transliterates diacritics exactly the way the
// Worker's normalizeCityKey (worker/src/cityDescriptions.ts) does, for the
// real city names this repository's own generated data contains. Keep
// this list's expectations identical to cityDescriptions.test.ts's own
// normalizeCityKey assertions — a change to either algorithm that breaks
// this contract must fail a test on both sides.
import { describe, expect, it } from 'vitest';
import { normalizeCityKey } from './cityKey.mjs';

describe('normalizeCityKey — diacritic transliteration (not deletion)', () => {
  it.each([
    ['Zürich', 'zurich'],
    ['Bogotá', 'bogota'],
    ['Malmö', 'malmo'],
    ['Kraków', 'krakow'],
    ['Córdoba', 'cordoba'],
    ['Montréal', 'montreal'],
    ['Göteborg', 'goteborg'],
    ['Västerås', 'vasteras'],
    ['Reykjavík', 'reykjavik'],
    ['São Tomé', 'saotome'],
    ['Malé', 'male'],
    ['Chișinău', 'chisinau'],
    ['Asunción', 'asuncion'],
    ['Yaoundé', 'yaounde'],
    ['Brasília', 'brasilia'],
    ['San José', 'sanjose'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeCityKey(input)).toBe(expected);
  });

  it('never drops a letter down to nothing but the accent-bearing one, unlike the old buggy normalize()', () => {
    // The regression this guards: the old normalize() computed "zrich" for
    // "Zürich" (the ü simply vanished) instead of "zurich".
    expect(normalizeCityKey('Zürich')).not.toBe('zrich');
  });
});
