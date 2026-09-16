// Guards the admin dashboard's translation source of truth.
//
// TypeScript already forces ADMIN_EN and ADMIN_AR to satisfy the same
// AdminDictionary interface, so a MISSING key is a compile error. What
// TypeScript cannot catch: an accidentally EMPTY string, a leftover
// untranslated (English-in-the-Arabic-dictionary) value, or a `{status}`-
// style placeholder present in one language but not the other. Those are
// exactly the failure modes that would make a raw or wrong string reach the
// admin UI, so they are asserted here instead.
import { describe, expect, it } from 'vitest';
import { ADMIN_AR, ADMIN_EN, ADMIN_I18N } from './adminI18n';

/** Every string value in a nested dictionary, as {path, value} pairs. */
function leaves(value: unknown, path = ''): { path: string; value: string }[] {
  if (typeof value === 'string') return [{ path, value }];
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      leaves(child, path ? `${path}.${key}` : key));
  }
  return [];
}

const enLeaves = leaves(ADMIN_EN);
const arLeaves = leaves(ADMIN_AR);
const enPaths = enLeaves.map((leaf) => leaf.path).sort();
const arPaths = arLeaves.map((leaf) => leaf.path).sort();

describe('admin dictionary completeness', () => {
  it('has exactly the same key paths in both languages', () => {
    expect(arPaths).toEqual(enPaths);
  });

  it('never carries an empty string', () => {
    for (const { path, value } of [...enLeaves, ...arLeaves]) {
      expect(value.length, path).toBeGreaterThan(0);
    }
  });

  it('never leaves an English string untranslated in the Arabic dictionary', () => {
    const enByPath = new Map(enLeaves.map((leaf) => [leaf.path, leaf.value]));
    const offenders: string[] = [];
    for (const { path, value } of arLeaves) {
      // Country/language codes like "AR"/"EN" and the ISO placeholder "JP"
      // are legitimately identical in both dictionaries — they are not
      // prose. Anything else identical to the English string, with any
      // letter in it, is a real leftover.
      if (path === 'langSwitch.ar' || path === 'langSwitch.en' || path === 'filters.countryPlaceholder') continue;
      const english = enByPath.get(path);
      if (english && english === value && /[A-Za-z]/.test(value)) offenders.push(path);
    }
    expect(offenders).toEqual([]);
  });

  it('keeps every {placeholder} token identical across languages', () => {
    const placeholder = /\{[a-zA-Z]+\}/g;
    const enByPath = new Map(enLeaves.map((leaf) => [leaf.path, leaf.value]));
    for (const { path, value } of arLeaves) {
      const english = enByPath.get(path);
      if (!english) continue;
      expect((value.match(placeholder) ?? []).sort(), path).toEqual((english.match(placeholder) ?? []).sort());
    }
  });

  it('covers the report workflow statuses named in the brief, in both languages', () => {
    const required = ['new', 'triaged', 'in_progress', 'resolved', 'declined'];
    for (const status of required) {
      expect(ADMIN_EN.reportStatus[status as keyof typeof ADMIN_EN.reportStatus]).toBeTruthy();
      expect(ADMIN_AR.reportStatus[status as keyof typeof ADMIN_AR.reportStatus]).toBeTruthy();
    }
  });

  it('is reachable from ADMIN_I18N by language code, the shape adminPage.ts embeds', () => {
    expect(ADMIN_I18N.en).toBe(ADMIN_EN);
    expect(ADMIN_I18N.ar).toBe(ADMIN_AR);
  });

  it('never contains the raw dot-path pattern a missing translation would fall back to', () => {
    // If a future edit introduces a `t()`-style fallback that returns the
    // key itself, a string shaped like "section.key" would start showing up
    // as a dictionary VALUE by accident (e.g. a copy-paste of a path into a
    // value). That is exactly the "raw translation key visible to the user"
    // failure the brief rules out, so it is guarded here at the source.
    const keyShaped = /^[a-z][a-zA-Z]*(\.[a-zA-Z_]+)+$/;
    for (const { path, value } of [...enLeaves, ...arLeaves]) {
      expect(keyShaped.test(value), `${path} = "${value}"`).toBe(false);
    }
  });
});
