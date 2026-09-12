// Destination Imagery System — UI-facing lookup. Reads the GENERATED
// manifest (data/generated/destinationImages.json, produced by
// scripts/generate-destination-images.mjs — see that script's own doc
// comment for the full SOURCE -> DISCOVERY -> LICENSE VALIDATION ->
// SELECTION -> OPTIMIZATION -> MANIFEST -> UI pipeline) rather than a
// hand-typed per-country object literal. Deliberately NOT a per-country
// hardcoded JSX condition (`if (country === 'Saudi Arabia')`) and
// deliberately NOT requiring a code change to add a country — a future
// ingestion run that can reach an image host only needs to add an entry
// to the generated JSON; this file and DestinationHero.tsx/
// HeroPhotoAttribution.tsx already handle it.
//
// Hero-image correction pass: the real photo is now the Destination
// Hero's own CSS background (see DestinationHero.tsx) instead of a
// separate sidebar card — the data layer here is unchanged, only its
// consumer moved.
//
// Coverage is 194/194 effective countries. The build-time ingestion pipeline
// starts from each country's Wikivoyage travel article, validates the exact
// Commons license and metadata, stores an optimized local WebP, and is gated by
// app/scripts/destinationImageAudit.json so unreviewed replacements cannot
// silently ship.
import destinationImages from './generated/destinationImages.json';
import { DESTINATION_IMAGE_CROPS } from './destinationImageCrops';

export interface DestinationVisualMeta {
  /** Local asset path (e.g. via a Vite `import`), never a remote/hotlinked URL. */
  imagePath: string;
  altEn: string;
  altAr: string;
  /** Required whenever the source license mandates attribution (e.g. CC BY, CC BY-SA). */
  attributionEn?: string;
  attributionAr?: string;
  attributionUrl?: string;
  /** Hero-image correction pass — structured fields (verified, straight
   *  from the manifest entry, never invented) for the compact photo-info
   *  disclosure's separate Source/Author/License rows. `landmarkName` is
   *  also the only place the real landmark identity survives once the
   *  photo is a CSS background instead of an <img alt="…">. */
  landmarkName: string;
  author: string | null;
  license: string;
  cardPosition: string;
  heroPosition: string;
}

interface DestinationImageManifestEntry {
  iso2: string;
  iso3: string;
  countryName: string;
  landmarkName: string;
  localPath: string;
  sourcePage: string;
  author: string | null;
  license: string;
  licenseUrl: string | null;
  originalUrl: string;
  retrievedAt: string;
  width: number;
  height: number;
}

function buildAltText(entry: DestinationImageManifestEntry): { altEn: string; altAr: string } {
  // Meaningful, verified-metadata-derived alt text — never "country
  // image"/"صورة الدولة", and never an invented landmark name: built
  // only from `landmarkName`/`countryName`, both taken directly from
  // the manifest entry (itself derived from the real Commons file
  // title — see destinationImageIngest.mjs's buildManifestEntry()).
  return {
    altEn: `${entry.landmarkName} in ${entry.countryName}`,
    altAr: `${entry.landmarkName} في ${entry.countryName}`,
  };
}

function buildAttribution(entry: DestinationImageManifestEntry): Pick<DestinationVisualMeta, 'attributionEn' | 'attributionAr' | 'attributionUrl'> {
  const who = entry.author ? entry.author : 'Wikimedia Commons';
  return {
    attributionEn: `Photo: ${who} (${entry.license}, via Wikimedia Commons)`,
    attributionAr: `الصورة: ${who} (${entry.license}، عبر Wikimedia Commons)`,
    attributionUrl: entry.sourcePage,
  };
}

// The manifest's own localPath ("/destinations/xx.webp") is
// app-root-relative, not deployment-root-relative — this app is served
// from a sub-path (Vite `base: '/wej/'`, a GitHub Pages project site),
// so a bare "/destinations/xx.webp" 404s in production (confirmed live
// via a Playwright check against the built preview server during this
// pass's UI-integration verification: the request landed on
// http://host/destinations/xx.webp instead of http://host/wej/destinations/xx.webp).
// Vite injects the actual configured base as import.meta.env.BASE_URL
// (always trailing-slash-terminated) at both build AND test time, so
// prefixing here — once, at the single place a manifest path becomes a
// real `<img src>` — fixes it for every deployment target without
// hand-coding "/wej/" anywhere.
const DEPLOY_BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Keyed by CatalogEntry.countryCode (ISO 3166-1 alpha-2, uppercase).
 *  Built once, at module load, from the generated manifest. */
export const DESTINATION_VISUALS: Record<string, DestinationVisualMeta> = Object.fromEntries(
  (destinationImages as DestinationImageManifestEntry[]).map((entry) => [
    entry.iso2,
    {
      imagePath: `${DEPLOY_BASE}${entry.localPath}`,
      landmarkName: entry.landmarkName,
      author: entry.author,
      license: entry.license,
      cardPosition: DESTINATION_IMAGE_CROPS[entry.iso2]?.card ?? 'center',
      heroPosition: DESTINATION_IMAGE_CROPS[entry.iso2]?.hero ?? 'center',
      ...buildAltText(entry),
      ...buildAttribution(entry),
    },
  ]),
);
