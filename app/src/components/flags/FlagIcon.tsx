// Ports flagChip() / flagBannerInner() / thumbHTML() from wejhaty.html.
// Renders the embedded flag-icons SVGs locally — never emoji, never a
// remote URL, never a redrawn/simplified flag. The only original SVG
// source data used is FLAG_SVG_RAW (data/flags.ts), instantiated through
// instantiateFlagSvg() exactly as before.
//
// Phase 10: typed against FlagSubject (id/nameEn/nameAr/countryCode) rather
// than the full Destination, since these components only ever needed those
// fields — this lets them render flags for the 165 new basic countries too,
// with no change to how the original 30 render.
import { useId } from 'react';
import type { Continent, FlagSubject, Lang } from '../../data/types';
import { FLAG_SVG_RAW } from '../../data/flags';
import { instantiateFlagSvg } from './instantiateFlagSvg';
import { regionGradientCss } from '../regionGradient';

function nameOf(country: FlagSubject, lang: Lang): string {
  return lang === 'ar' ? country.nameAr : country.nameEn;
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
  dest: FlagSubject;
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
export function FlagBanner({ dest, lang }: { dest: FlagSubject; lang: Lang }) {
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
 *  and Explorer cards, with the flag banner layered on top. `continent`
 *  drives the gradient (Destination.region and BasicCountry.continent are
 *  both Continent-shaped; pass whichever the caller has via continentOf()). */
export function FlagThumb({
  dest,
  lang,
  continent,
  className = 'thumb',
  style,
}: {
  dest: FlagSubject;
  lang: Lang;
  continent: Continent;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`${className} flag-banner`}
      style={{ backgroundImage: regionGradientCss(continent), ...style }}
    >
      <FlagBanner dest={dest} lang={lang} />
    </div>
  );
}
