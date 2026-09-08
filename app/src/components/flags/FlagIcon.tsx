// Ports flagChip() / flagBannerInner() / thumbHTML() from wejhaty.html.
// Renders the embedded flag-icons SVGs locally — never emoji, never a
// remote URL, never a redrawn/simplified flag. The only original SVG
// source data used is FLAG_SVG_RAW (data/flags.ts), instantiated through
// instantiateFlagSvg() exactly as before.
import { useId } from 'react';
import type { Destination, Lang } from '../../data/types';
import { FLAG_SVG_RAW } from '../../data/flags';
import { instantiateFlagSvg } from './instantiateFlagSvg';
import { regionGradientCss } from '../regionGradient';
import { isSafeSvgSource } from '../../security/svgGuard';

function nameOf(dest: Destination, lang: Lang): string {
  return lang === 'ar' ? dest.nameAr : dest.nameEn;
}

/** React's useId() includes colons (":r1:"), which aren't worth risking inside
 *  `url(#...)`/`href="#...` fragment references. Rather than strip only the
 *  colons, keep an allowlist of characters: the uid is interpolated into the
 *  SVG's id attributes by instantiateFlagSvg(), so restricting it to letters,
 *  digits and hyphens is what guarantees that rewrite cannot break out of the
 *  quoted attribute it is written into. */
function useFlagUid(): string {
  return 'fi' + useId().replace(/[^A-Za-z0-9-]/g, '');
}

/** The flag artwork for a destination, or null when there is none to show.
 *  Returns null for a country with no embedded flag *and* for artwork that
 *  fails the SVG allowlist, so both cases fall back to the letter badge
 *  rather than reaching dangerouslySetInnerHTML. */
function usableFlagSvg(dest: Destination): string | null {
  const code = dest.countryCode ? dest.countryCode.toLowerCase() : null;
  if (!code) return null;
  const raw = FLAG_SVG_RAW[code];
  if (!raw || !isSafeSvgSource(raw)) return null;
  return raw;
}

/** Small inline flag chip — next to a destination name (nav cards, headings). */
export function FlagChip({
  dest,
  width = 26,
  height = 19,
}: {
  dest: Destination;
  width?: number;
  height?: number;
}) {
  const uid = useFlagUid();
  const raw = usableFlagSvg(dest);
  const sizeStyle: React.CSSProperties = { width, height };

  if (!raw) {
    return (
      <span className="flag-fallback" style={sizeStyle}>
        {dest.nameEn.charAt(0)}
      </span>
    );
  }
  const svg = instantiateFlagSvg(raw, 'slice', uid);
  return (
    <span className="flag-chip" style={sizeStyle} dangerouslySetInnerHTML={{ __html: svg }} />
  );
}

/** Two-layer flag banner: blurred full-bleed backdrop + crisp centered flag,
 *  with a fallback badge only if a country genuinely has no embedded flag. */
export function FlagBanner({ dest, lang }: { dest: Destination; lang: Lang }) {
  const uid = useFlagUid();
  const raw = usableFlagSvg(dest);

  if (!raw) {
    return <span className="flag-banner-fallback-badge">{dest.nameEn.charAt(0)}</span>;
  }
  const bg = instantiateFlagSvg(raw, 'slice', uid + '-bg');
  const fg = instantiateFlagSvg(raw, 'meet', uid + '-fg');
  return (
    <>
      <span className="flag-banner-bg" aria-hidden="true" dangerouslySetInnerHTML={{ __html: bg }} />
      <span
        className="flag-banner-fg"
        role="img"
        aria-label={`${nameOf(dest, lang)} — flag`}
        dangerouslySetInnerHTML={{ __html: fg }}
      />
    </>
  );
}

/** Ports thumbHTML(): the region-gradient thumb/card image used on Results
 *  and Explorer cards, with the flag banner layered on top. */
export function FlagThumb({
  dest,
  lang,
  className = 'thumb',
  style,
}: {
  dest: Destination;
  lang: Lang;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`${className} flag-banner`}
      style={{ backgroundImage: regionGradientCss(dest.region), ...style }}
    >
      <FlagBanner dest={dest} lang={lang} />
    </div>
  );
}
