// v1.1.1 — Android Chrome Hero scroll regression. The Home Hero photo's
// settle animation used `fill-mode: both`. The finished animation then kept
// holding the photo, so Chrome kept it (and, by overlap, the scrim and all
// the Hero copy) as separate composited layers for the life of the page.
// After a scroll cycle on Android those layers came back without their top
// part, leaving an empty navy band inside the frame. jsdom cannot composite,
// so this reads the shipped stylesheet for the rule that decides it; the
// Playwright layer-tree check in production-smoke.mjs is the browser proof.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const css = fs.readFileSync(path.join(import.meta.dirname, '..', 'styles', 'wejhaty.css'), 'utf8');

function block(source: string, header: string, from = 0): string {
  const start = source.indexOf(header, from);
  expect(start, `missing ${header}`).toBeGreaterThan(-1);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(open + 1, i);
  }
  throw new Error(`unbalanced ${header}`);
}

function declaration(body: string, property: string): string | undefined {
  return new RegExp(`(?:^|[;{\\s])${property}\\s*:\\s*([^;]+);`).exec(body)?.[1]?.trim();
}

// `saturate(1)` and `none` render the same; compare the effect, not the text.
const normalizeFilter = (value: string | undefined) => (value ?? 'none').replace(/\bsaturate\(1\)/g, '').trim() || 'none';

const photo = block(css, '\n.home-hero-frame > .hero-folio-image {');
const settleTo = block(block(css, '@keyframes hero-photo-settle'), 'to');

describe('Home Hero photo settle animation', () => {
  it('does not hold the photo after it ends (no forwards/both fill)', () => {
    const animation = declaration(photo, 'animation');
    expect(animation).toMatch(/\bhero-photo-settle\b/);
    expect(animation).not.toMatch(/\b(both|forwards)\b/);
    expect(declaration(photo, 'animation-fill-mode')).toBeUndefined();
  });

  it('rests exactly where the animation ends, so nothing jumps when it stops', () => {
    expect(declaration(photo, 'transform')).toBe(declaration(settleTo, 'transform'));
    expect(normalizeFilter(declaration(photo, 'filter'))).toBe(normalizeFilter(declaration(settleTo, 'filter')));
  });

  it('keeps the unchanged still-photo look for reduced motion', () => {
    const reduced = block(css, '@media (prefers-reduced-motion: reduce)', css.indexOf('@keyframes hero-photo-settle'));
    const still = block(reduced, '.home-hero-frame > .hero-folio-image {');
    expect(declaration(still, 'filter')).toBe(declaration(block(css, '\n.hero-folio-image {'), 'filter'));
  });
});
