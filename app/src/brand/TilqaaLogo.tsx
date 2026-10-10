// TILQAA / تِلقاء — the approved logo artwork (logo package v2, concept A
// "the direction needle"), adapted from the package's TilqaaLogo.jsx: the
// shapes are copied verbatim; only the variants the site uses are kept
// (horizontal, compact, symbol, symbolSmall) and the props are typed. The
// masters are in app/brand/tilqaa-v2 (TilqaaLogo.test.tsx keeps the two in
// step). Never retype the logo in a font.
//
// Colours are CSS custom properties with the approved light-background
// defaults, so a theme can switch to the approved on-dark colours
// (wejhaty.css): --tq-main (letters), --tq-tile (symbol tile), --tq-glyph
// (letter inside the tile), --tq-accent (the needle's saffron half).
import type { ReactNode } from 'react';

export type LogoVariant = 'horizontal' | 'compact' | 'symbol' | 'symbolSmall';

interface Artwork {
  viewBox: string;
  /** width / height of the viewBox. */
  ratio: number;
  shapes: ReactNode;
}

const ART: Record<LogoVariant, Artwork> = {
  horizontal: {
    viewBox: '-581.44 -134.75 771.52 178.93',
    ratio: 4.3118,
    shapes: (
      <>
        <path transform="translate(0 0) scale(1)" d="M0 -46 L0 -18 Q0 0 -18 0 L-192 0 Q-210 0 -210 -18 L-210 -124" fill="none" stroke="var(--tq-main, #0E3F3D)" strokeWidth="13.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path transform="translate(0 0) scale(1)" d="M-64 0 L-64 -124" fill="none" stroke="var(--tq-main, #0E3F3D)" strokeWidth="13.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path transform="translate(0 0) scale(1)" d="M-176 -22 a22 22 0 1 0 44 0 a22 22 0 1 0 -44 0 Z" fill="none" stroke="var(--tq-main, #0E3F3D)" strokeWidth="13.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="-16" cy="-70" r="9.5" fill="var(--tq-main, #0E3F3D)"/>
        <circle cx="-42" cy="-70" r="9.5" fill="var(--tq-main, #0E3F3D)"/>
        <circle cx="-141" cy="-69" r="9.5" fill="var(--tq-main, #0E3F3D)"/>
        <circle cx="-167" cy="-69" r="9.5" fill="var(--tq-main, #0E3F3D)"/>
        <path transform="translate(0 0) scale(1)" d="M-17.47 24.57 L-36.53 37.43" fill="none" stroke="var(--tq-main, #0E3F3D)" strokeWidth="13.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path transform="translate(0 0) scale(1)" d="M-241.34 -42.7 A13 13 0 1 0 -242.3 -24.34 L-266 0" fill="none" stroke="var(--tq-main, #0E3F3D)" strokeWidth="13.5" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="44.58" y="-134.75" width="145.5" height="145.5" rx="37.83" fill="var(--tq-tile, #0E3F3D)"/>
        <path transform="translate(117.33 -52.49) scale(0.75)" d="M44 -30 L44 -22 Q44 0 22 0 L-22 0 Q-44 0 -44 -22 L-44 -56" fill="none" stroke="var(--tq-glyph, #F5EFE4)" strokeWidth="16.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M139.68 -107.1 L126.6 -79.67 L113.77 -91.23 Z" fill="var(--tq-accent, #C77524)"/>
        <path d="M99.48 -62.46 L125.4 -78.33 L112.56 -89.89 Z" fill="var(--tq-glyph, #F5EFE4)"/>
        <path transform="translate(117.33 -52.49) scale(0.75)" d="M11.12 26.85 L-7.12 39.15" fill="none" stroke="var(--tq-glyph, #F5EFE4)" strokeWidth="16.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M-306.75 -108.75 L-306.75 -1.25" fill="none" stroke="var(--tq-main, #0E3F3D)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        <path transform="translate(-577.25 -40) scale(1)" d="M0 -44 L27.28 -44 M13.64 -44 L13.64 0" fill="none" stroke="var(--tq-main, #0E3F3D)" strokeWidth="8.37" strokeLinecap="round" strokeLinejoin="round"/>
        <path transform="translate(-577.25 -40) scale(1)" d="M42.24 -44 L42.24 0" fill="none" stroke="var(--tq-main, #0E3F3D)" strokeWidth="8.37" strokeLinecap="round" strokeLinejoin="round"/>
        <path transform="translate(-577.25 -40) scale(1)" d="M57.2 -44 L57.2 0 L78.32 0" fill="none" stroke="var(--tq-main, #0E3F3D)" strokeWidth="8.37" strokeLinecap="round" strokeLinejoin="round"/>
        <path transform="translate(-577.25 -40) scale(1)" d="M93.28 -22 a22 22 0 1 0 44 0 a22 22 0 1 0 -44 0 Z" fill="none" stroke="var(--tq-main, #0E3F3D)" strokeWidth="8.37" strokeLinecap="round" strokeLinejoin="round"/>
        <path transform="translate(-577.25 -40) scale(1)" d="M124.52 -12.76 L138.75 -3.16" fill="none" stroke="var(--tq-main, #0E3F3D)" strokeWidth="8.37" strokeLinecap="round" strokeLinejoin="round"/>
        <path transform="translate(-577.25 -40) scale(1)" d="M152.24 0 L168.52 -44 L184.8 0 M157.78 -14.96 L179.26 -14.96" fill="none" stroke="var(--tq-main, #0E3F3D)" strokeWidth="8.37" strokeLinecap="round" strokeLinejoin="round"/>
        <path transform="translate(-577.25 -40) scale(1)" d="M199.76 0 L216.04 -44 L232.32 0 M205.3 -14.96 L226.78 -14.96" fill="none" stroke="var(--tq-main, #0E3F3D)" strokeWidth="8.37" strokeLinecap="round" strokeLinejoin="round"/>
      </>
    ),
  },
  compact: {
    viewBox: '-272.75 -134.75 462.83 178.93',
    ratio: 2.5866,
    shapes: (
      <>
        <path transform="translate(0 0) scale(1)" d="M0 -46 L0 -18 Q0 0 -18 0 L-192 0 Q-210 0 -210 -18 L-210 -124" fill="none" stroke="var(--tq-main, #0E3F3D)" strokeWidth="13.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path transform="translate(0 0) scale(1)" d="M-64 0 L-64 -124" fill="none" stroke="var(--tq-main, #0E3F3D)" strokeWidth="13.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path transform="translate(0 0) scale(1)" d="M-176 -22 a22 22 0 1 0 44 0 a22 22 0 1 0 -44 0 Z" fill="none" stroke="var(--tq-main, #0E3F3D)" strokeWidth="13.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="-16" cy="-70" r="9.5" fill="var(--tq-main, #0E3F3D)"/>
        <circle cx="-42" cy="-70" r="9.5" fill="var(--tq-main, #0E3F3D)"/>
        <circle cx="-141" cy="-69" r="9.5" fill="var(--tq-main, #0E3F3D)"/>
        <circle cx="-167" cy="-69" r="9.5" fill="var(--tq-main, #0E3F3D)"/>
        <path transform="translate(0 0) scale(1)" d="M-17.47 24.57 L-36.53 37.43" fill="none" stroke="var(--tq-main, #0E3F3D)" strokeWidth="13.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path transform="translate(0 0) scale(1)" d="M-241.34 -42.7 A13 13 0 1 0 -242.3 -24.34 L-266 0" fill="none" stroke="var(--tq-main, #0E3F3D)" strokeWidth="13.5" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="44.58" y="-134.75" width="145.5" height="145.5" rx="37.83" fill="var(--tq-tile, #0E3F3D)"/>
        <path transform="translate(117.33 -52.49) scale(0.75)" d="M44 -30 L44 -22 Q44 0 22 0 L-22 0 Q-44 0 -44 -22 L-44 -56" fill="none" stroke="var(--tq-glyph, #F5EFE4)" strokeWidth="16.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M139.68 -107.1 L126.6 -79.67 L113.77 -91.23 Z" fill="var(--tq-accent, #C77524)"/>
        <path d="M99.48 -62.46 L125.4 -78.33 L112.56 -89.89 Z" fill="var(--tq-glyph, #F5EFE4)"/>
        <path transform="translate(117.33 -52.49) scale(0.75)" d="M11.12 26.85 L-7.12 39.15" fill="none" stroke="var(--tq-glyph, #F5EFE4)" strokeWidth="16.5" strokeLinecap="round" strokeLinejoin="round"/>
      </>
    ),
  },
  symbol: {
    viewBox: '0 0 120 120',
    ratio: 1.0000,
    shapes: (
      <>
        <rect x="0" y="0" width="120" height="120" rx="31.2" fill="var(--tq-tile, #0E3F3D)"/>
        <path transform="translate(60 67.84) scale(0.62)" d="M44 -30 L44 -22 Q44 0 22 0 L-22 0 Q-44 0 -44 -22 L-44 -56" fill="none" stroke="var(--tq-glyph, #F5EFE4)" strokeWidth="16.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M78.43 22.8 L67.65 45.42 L57.06 35.89 Z" fill="var(--tq-accent, #C77524)"/>
        <path d="M45.28 59.62 L66.65 46.53 L56.07 37 Z" fill="var(--tq-glyph, #F5EFE4)"/>
        <path transform="translate(60 67.84) scale(0.62)" d="M11.12 26.85 L-7.12 39.15" fill="none" stroke="var(--tq-glyph, #F5EFE4)" strokeWidth="16.5" strokeLinecap="round" strokeLinejoin="round"/>
      </>
    ),
  },
  symbolSmall: {
    viewBox: '0 0 120 120',
    ratio: 1.0000,
    shapes: (
      <>
        <rect x="0" y="0" width="120" height="120" rx="31.2" fill="var(--tq-tile, #0E3F3D)"/>
        <path transform="translate(60 67.57) scale(0.64)" d="M47 -32 L47 -22 Q47 0 25 0 L-25 0 Q-47 0 -47 -22 L-47 -60" fill="none" stroke="var(--tq-glyph, #F5EFE4)" strokeWidth="20.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M80.15 19.2 L69.44 43.54 L57.06 32.39 Z" fill="var(--tq-accent, #C77524)"/>
        <path d="M44.98 58.26 L68.07 45.07 L55.69 33.92 Z" fill="var(--tq-glyph, #F5EFE4)"/>
        <path transform="translate(60 67.57) scale(0.64)" d="M11.29 30.41 L-5.29 41.59" fill="none" stroke="var(--tq-glyph, #F5EFE4)" strokeWidth="20.5" strokeLinecap="round" strokeLinejoin="round"/>
      </>
    ),
  },
};

export function TilqaaLogo({ variant, height, label, className }: {
  variant: LogoVariant;
  /** Rendered height in CSS pixels; the width follows the artwork. */
  height: number;
  /** A name makes the logo an image of its own; without one it is
   *  decorative (inside a control that is already labelled). */
  label?: string;
  className?: string;
}) {
  const art = ART[variant];
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={art.viewBox}
      width={Math.round(height * art.ratio)}
      height={height}
      className={className}
      data-variant={variant}
      focusable="false"
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {label ? <title>{label}</title> : null}
      {art.shapes}
    </svg>
  );
}
