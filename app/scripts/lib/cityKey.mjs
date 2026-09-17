// Acceptance fix — the diacritic-stripping city-name key used to look up a
// city's coordinates.
//
// THE BUG THIS REPLACES: generate-featured-cities.mjs previously normalized
// with `value.toLocaleLowerCase('en').replace(/[^a-z0-9]/g, '')` — no
// diacritic handling, so an accented letter is simply DROPPED rather than
// transliterated ("Zürich" -> "zrich", "Bogotá" -> "bogot"). The Worker's
// own lookup key (worker/src/cityDescriptions.ts's normalizeCityKey) has
// always decomposed accents first ("Zürich" -> "zurich"), so any city whose
// name carries a diacritic got a coordinate-index entry under a key the
// Worker would never compute — referenceCoordinates() always missed,
// resolveCityDescription() always returned 'no_article' without ever
// calling Wikipedia, and the description silently never appeared for that
// city while its structured facts (which never touched this table) kept
// rendering normally. The same mismatch also broke same-city dedup and
// capital-row matching whenever world-countries' capital spelling carried
// an accent that city-timezones' row spelling didn't (or vice versa) —
// see generate-featured-cities.mjs's own comment at its `add()` calls.
//
// THE FIX: use the exact same algorithm as the Worker's normalizeCityKey,
// in one place both the generator (via this module) and the Worker import
// from — except the Worker is a separately-deployed package that cannot
// import from app/, so worker/src/cityDescriptions.ts keeps its own
// literal copy of this same three-step algorithm. Keep them in lockstep:
// cityKey.test.mjs and cityDescriptions.test.ts both assert the identical
// expected output for the identical set of real diacritic city names.
export function normalizeCityKey(name) {
  return name
    .toLocaleLowerCase('en')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}
