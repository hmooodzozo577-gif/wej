// Visual refinement pass — landmark image architecture.
//
// LANDMARK IMAGE — BLOCKED — LICENSED SOURCE REQUIRED (see the final
// report's "Landmark Image" section for the full account): the only
// defensible source evaluated (Wikimedia Commons — public-domain/CC
// licensed, redistribution-permitted, exactly what this task's own
// source-priority list calls for) is unreachable from this environment —
// commons.wikimedia.org, upload.wikimedia.org, and en.wikipedia.org all
// return EGRESS_BLOCKED / a 403 from the outbound network proxy, the same
// class of organization-policy block seen for github.io in a prior pass.
// No image could be downloaded, verified, or attributed this pass, so
// per this task's own hard rule ("If no defensible image can be sourced,
// DO NOT add an unlicensed image"), none was added — no hotlinked,
// placeholder, or AI-generated image was substituted either, since none
// of those would be a real, licensed landmark photo.
//
// This file is the small, extensible, keyed metadata mechanism the task
// asked for regardless of whether an image is present yet — deliberately
// NOT a per-country hardcoded JSX condition (`if (country === 'Saudi
// Arabia')`), and deliberately NOT scoped to sourcing images for all 194
// countries this pass. It is empty today (zero entries); a future pass
// that can reach an image host only needs to add one entry here — no
// component or layout change required, since DestinationVisual.tsx
// already renders null for any countryCode with no entry.
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

/** Keyed by CatalogEntry.countryCode (ISO 3166-1 alpha-2, uppercase). */
export const DESTINATION_VISUALS: Record<string, DestinationVisualMeta> = {};
