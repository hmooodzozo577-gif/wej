// Destination Imagery System — UI-facing lookup. Reads the GENERATED
// manifest (data/generated/destinationImages.json, produced by
// scripts/generate-destination-images.mjs — see that script's own doc
// comment for the full SOURCE -> DISCOVERY -> LICENSE VALIDATION ->
// SELECTION -> OPTIMIZATION -> MANIFEST -> UI pipeline) rather than a
// hand-typed per-country object literal. Deliberately NOT a per-country
// hardcoded JSX condition (`if (country === 'Saudi Arabia')`) and
// deliberately NOT requiring a code change to add a country — a future
// ingestion run that can reach an image host only needs to add an entry
// to the generated JSON; this file and DestinationVisual.tsx already
// handle it.
//
// LANDMARK IMAGE — BLOCKED — LICENSED SOURCE REQUIRED (still true this
// pass, re-verified live): Wikimedia Commons (commons.wikimedia.org,
// upload.wikimedia.org) and every alternative open-image source tested
// (Openverse) return EGRESS_BLOCKED / 403 from this environment's
// outbound network proxy — an organization-level allowlist policy, not
// a transient failure (its own explicit allowlist covers only package
// registries and the Anthropic API, confirmed via the proxy's own status
// endpoint). The manifest below is therefore genuinely empty
// (`destinationImages.json` = `[]`) — a real 194-country ingestion run
// (scripts/generate-destination-images.mjs --all) was executed this
// pass and correctly enumerated the full effective catalog (194,
// IL/ISR excluded, MC/MCO present), but every entry honestly reports
// `BLOCKED — NETWORK`, not a fabricated success.
import destinationImages from './generated/destinationImages.json';

export interface DestinationVisualMeta {
  /** Local asset path (e.g. via a Vite `import`), never a remote/hotlinked URL. */
  imagePath: string;
  altEn: string;
  altAr: string;
  /** Required whenever the source license mandates attribution (e.g. CC BY, CC BY-SA). */
  attributionEn?: string;
  attributionAr?: string;
  attributionUrl?: string;
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

/** Keyed by CatalogEntry.countryCode (ISO 3166-1 alpha-2, uppercase).
 *  Built once, at module load, from the generated manifest — empty
 *  today (see this file's doc comment above), non-empty automatically
 *  once a future ingestion run adds real entries. */
export const DESTINATION_VISUALS: Record<string, DestinationVisualMeta> = Object.fromEntries(
  (destinationImages as DestinationImageManifestEntry[]).map((entry) => [
    entry.iso2,
    { imagePath: entry.localPath, ...buildAltText(entry), ...buildAttribution(entry) },
  ]),
);
