// Ported verbatim from instantiateFlagSVG() in wejhaty.html: rewrites a raw
// flag-icons SVG's internal ids/refs (clipPaths, <use> refs) with a unique
// suffix so multiple copies of the same flag can coexist in the DOM without
// one copy's <defs> silently overriding another's. `fit` controls whether
// the flag shows uncropped ('meet') or fills its box edge-to-edge ('slice').
//
// The only change from the original is that the caller supplies `uid`
// (React's useId(), sanitized) instead of a module-level mutable counter —
// same purpose (uniqueness per rendered instance), idiomatic React source.
export function instantiateFlagSvg(rawSvg: string, fit: 'meet' | 'slice', uid: string): string {
  const uniq = rawSvg
    .replace(/id="([^"]+)"/g, (_m, p1: string) => `id="${p1}-${uid}"`)
    .replace(/url\(#([^)]+)\)/g, (_m, p1: string) => `url(#${p1}-${uid})`)
    .replace(/xlink:href="#([^"]+)"/g, (_m, p1: string) => `xlink:href="#${p1}-${uid}"`)
    .replace(/(?<!xlink:)href="#([^"]+)"/g, (_m, p1: string) => `href="#${p1}-${uid}"`)
    // Phase 19 (19.5) — some source SVGs (San Marino's arms) label inner
    // <path>s; ARIA forbids that on role-less elements, and the flag is
    // decorative beside the country name anyway.
    .replace(/\saria-label="[^"]*"/g, '');
  return uniq.replace(/<svg([^>]*)>/, (_m, attrs: string) => {
    const cleanedAttrs = attrs.replace(/\s(width|height|preserveAspectRatio)="[^"]*"/g, '');
    return `<svg${cleanedAttrs} width="100%" height="100%" preserveAspectRatio="xMidYMid ${fit}">`;
  });
}
