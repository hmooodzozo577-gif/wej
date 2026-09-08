import { describe, expect, it } from 'vitest';
import { instantiateFlagSvg } from './instantiateFlagSvg';
import { FLAG_SVG_RAW } from '../../data/flags';

describe('instantiateFlagSvg', () => {
  it('rewrites ids/refs with the given uid and sets fit-specific attrs (Japan — has a clipPath + transform, exercises id/url rewriting)', () => {
    const out = instantiateFlagSvg(FLAG_SVG_RAW.jp, 'slice', 'test1');
    expect(out).toContain('id="flag-icons-jp-test1"');
    expect(out).toContain('id="jp-a-test1"');
    expect(out).toContain('url(#jp-a-test1)');
    expect(out).not.toContain('id="jp-a"');
    expect(out).not.toContain('url(#jp-a)');
    expect(out).toContain('preserveAspectRatio="xMidYMid slice"');
    expect(out).toContain('width="100%" height="100%"');
    // The <svg> tag has exactly one width attr (the injected 100%) — none of
    // the 30 source flags carry their own explicit width/height to begin
    // with, but the strip step exists defensively for any that might.
    const svgTagMatch = out.match(/<svg[^>]*>/)?.[0] ?? '';
    expect(svgTagMatch.match(/\swidth="/g)?.length).toBe(1);
  });

  it('produces different uids for different instances, so two copies never collide', () => {
    const a = instantiateFlagSvg(FLAG_SVG_RAW.jp, 'meet', 'a');
    const b = instantiateFlagSvg(FLAG_SVG_RAW.jp, 'meet', 'b');
    expect(a).toContain('-a"');
    expect(b).toContain('-b"');
    expect(a).not.toBe(b);
  });

  it('leaves a flag with no ids/refs unaffected beyond the outer <svg> attrs (Poland — flat rects, no defs)', () => {
    const out = instantiateFlagSvg(FLAG_SVG_RAW.pl, 'meet', 'x');
    expect(out).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(out).toContain('width="100%" height="100%"');
  });

  it('matches the original instantiateFlagSVG output exactly, modulo the uid source', () => {
    // Same algorithm as the original, run inline here as a golden comparison
    // (the full engine parity tests separately load the original file live).
    function originalInstantiate(raw: string, fit: 'meet' | 'slice', uid: string) {
      const uniq = raw
        .replace(/id="([^"]+)"/g, (_m, p1) => `id="${p1}-${uid}"`)
        .replace(/url\(#([^)]+)\)/g, (_m, p1) => `url(#${p1}-${uid})`)
        .replace(/xlink:href="#([^"]+)"/g, (_m, p1) => `xlink:href="#${p1}-${uid}"`)
        .replace(/(?<!xlink:)href="#([^"]+)"/g, (_m, p1) => `href="#${p1}-${uid}"`);
      return uniq.replace(/<svg([^>]*)>/, (_m, attrs) => {
        const cleaned = (attrs as string).replace(/\s(width|height|preserveAspectRatio)="[^"]*"/g, '');
        return `<svg${cleaned} width="100%" height="100%" preserveAspectRatio="xMidYMid ${fit}">`;
      });
    }
    for (const code of Object.keys(FLAG_SVG_RAW)) {
      expect(instantiateFlagSvg(FLAG_SVG_RAW[code], 'slice', 'uid1')).toBe(
        originalInstantiate(FLAG_SVG_RAW[code], 'slice', 'uid1'),
      );
    }
  });
});
