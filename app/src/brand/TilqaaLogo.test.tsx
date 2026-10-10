// The approved TILQAA artwork (brand/tilqaa-v2, logo package v2) drawn by
// TilqaaLogo: the same shapes in the same order as the master SVG files, the
// approved colours as the defaults, no retyped lettering, no distortion.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { TilqaaLogo, type LogoVariant } from './TilqaaLogo';

const MASTER = resolve(__dirname, '../../brand/tilqaa-v2/svg');
const FILE: Record<LogoVariant, string> = {
  horizontal: 'horizontal',
  compact: 'compact',
  symbol: 'symbol',
  symbolSmall: 'symbol-small',
};
const GEOMETRY = ['d', 'transform', 'cx', 'cy', 'r', 'x', 'y', 'width', 'height', 'rx', 'stroke-width', 'stroke-linecap', 'stroke-linejoin'];

function master(variant: LogoVariant, tone: 'color' | 'color-on-dark' = 'color'): SVGSVGElement {
  const text = readFileSync(resolve(MASTER, `tilqaa-${FILE[variant]}--${tone}.svg`), 'utf8');
  return new DOMParser().parseFromString(text, 'image/svg+xml').documentElement as unknown as SVGSVGElement;
}

const shapes = (svg: Element) => [...svg.querySelectorAll('path, circle, rect')];
const geometry = (el: Element) => [el.tagName, ...GEOMETRY.map((name) => el.getAttribute(name) ?? '')].join('|');
/** "var(--tq-main, #0E3F3D)" -> "#0E3F3D"; a plain colour stays as it is. */
const fallback = (value: string | null) => (value ?? '').replace(/^var\(--tq-[a-z]+, (#[0-9A-F]{6})\)$/i, '$1');

describe('TilqaaLogo', () => {
  it.each<LogoVariant>(['horizontal', 'compact', 'symbol', 'symbolSmall'])('%s: draws the master artwork shape for shape', (variant) => {
    const { container } = render(<TilqaaLogo variant={variant} height={40} />);
    const svg = container.querySelector('svg')!;
    const art = master(variant);
    expect(svg.getAttribute('viewBox')).toBe(art.getAttribute('viewBox'));
    expect(shapes(svg).map(geometry)).toEqual(shapes(art).map(geometry));
    // Default colours are the approved light-background colours.
    for (const [index, shape] of shapes(svg).entries()) {
      const source = shapes(art)[index]!;
      expect(fallback(shape.getAttribute('fill'))).toBe(source.getAttribute('fill'));
      expect(fallback(shape.getAttribute('stroke'))).toBe(source.getAttribute('stroke') ?? '');
    }
    // Never retyped in a font, never stretched.
    expect(svg.querySelector('text')).toBeNull();
    expect(svg.getAttribute('preserveAspectRatio')).toBeNull();
  });

  it.each<LogoVariant>(['horizontal', 'compact', 'symbol', 'symbolSmall'])('%s: the on-dark colours are the approved on-dark artwork', (variant) => {
    const { container } = render(<TilqaaLogo variant={variant} height={40} />);
    const dark = shapes(master(variant, 'color-on-dark'));
    const ON_DARK: Record<string, string> = { main: '#F5EFE4', tile: '#F5EFE4', glyph: '#0E3F3D', accent: '#C77524' };
    for (const [index, shape] of shapes(container.querySelector('svg')!).entries()) {
      for (const paint of ['fill', 'stroke'] as const) {
        const value = shape.getAttribute(paint);
        const role = value?.match(/^var\(--tq-([a-z]+),/)?.[1];
        const expected = dark[index]!.getAttribute(paint);
        expect(role ? ON_DARK[role] : value, `${variant} shape ${index} ${paint}`).toBe(expected);
      }
    }
  });

  it('keeps the artwork proportions at any height', () => {
    const { container } = render(<TilqaaLogo variant="horizontal" height={36} />);
    const svg = container.querySelector('svg')!;
    const [, , w, h] = svg.getAttribute('viewBox')!.split(' ').map(Number);
    expect(Number(svg.getAttribute('height'))).toBe(36);
    expect(Number(svg.getAttribute('width'))).toBe(Math.round((36 * w!) / h!));
  });

  it('is decorative inside a labelled control and an image with a name on its own', () => {
    const { container, rerender } = render(<TilqaaLogo variant="compact" height={30} />);
    let svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
    expect(svg).not.toHaveAttribute('role');
    rerender(<TilqaaLogo variant="horizontal" height={34} label="تِلقاء — TILQAA" />);
    svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('role', 'img');
    expect(svg).toHaveAttribute('aria-label', 'تِلقاء — TILQAA');
    expect(svg).not.toHaveAttribute('aria-hidden');
    expect(svg.querySelector('title')?.textContent).toBe('تِلقاء — TILQAA');
  });
});
