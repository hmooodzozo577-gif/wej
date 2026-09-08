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

function nameOf(dest: Destination, lang: Lang): string {
  return lang === 'ar' ? dest.nameAr : dest.nameEn;
}

/** React's useId() includes colons (":r1:"), which aren't worth risking inside
 *  `url(#...)`/`href="#...` fragment references — strip them for the flag uid. */
function useFlagUid(): string {
  return 'fi' + useId().replace(/:/g, '');
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
  const code = dest.countryCode ? dest.countryCode.toLowerCase() : null;
  const sizeStyle: React.CSSProperties = { width, height };

  if (!code || !FLAG_SVG_RAW[code]) {
    return (
      <span className="flag-fallback" style={sizeStyle}>
        {dest.nameEn.charAt(0)}
      </span>
    );
  }
  const svg = instantiateFlagSvg(FLAG_SVG_RAW[code], 'slice', uid);
  return (
    <span className="flag-chip" style={sizeStyle} dangerouslySetInnerHTML={{ __html: svg }} />
  );
}

/** Two-layer flag banner: blurred full-bleed backdrop + crisp centered flag,
 *  with a fallback badge only if a country genuinely has no embedded flag. */
export function FlagBanner({ dest, lang }: { dest: Destination; lang: Lang }) {
  const uid = useFlagUid();
  const code = dest.countryCode ? dest.countryCode.toLowerCase() : null;

  if (!code || !FLAG_SVG_RAW[code]) {
    return <span className="flag-banner-fallback-badge">{dest.nameEn.charAt(0)}</span>;
  }
  const bg = instantiateFlagSvg(FLAG_SVG_RAW[code], 'slice', uid + '-bg');
  const fg = instantiateFlagSvg(FLAG_SVG_RAW[code], 'meet', uid + '-fg');
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
