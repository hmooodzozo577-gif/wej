// Fail-closed allowlist guard for the only HTML-injection surface in the app.
//
// FlagIcon and Icon render their SVGs through dangerouslySetInnerHTML. Today
// that is safe because both sources (FLAG_SVG_RAW, ICON) are compile-time
// constants checked into the repository. Nothing in the type system says so,
// though: a future change that loads a flag or icon from anywhere less trusted
// would turn those four call sites into stored-XSS sinks without a single
// compiler or lint error.
//
// This module makes the guarantee explicit and enforced at runtime. Every SVG
// string is parsed against a strict allowlist of elements and attributes drawn
// from what the real artwork actually uses. Anything outside that vocabulary —
// a <script>, an onload=, an href to another origin — fails the check and the
// caller renders its normal fallback instead. The guard never rewrites or
// repairs markup: valid artwork passes through byte-for-byte, so the flags and
// icons render exactly as before.
//
// Results are cached by source string. The catalogue is 49 fixed strings, so
// each is validated once per page load regardless of how many times it renders.

/** Every element that appears in the shipped flag and icon artwork, plus the
 *  common SVG shape and gradient elements a future asset could reasonably use.
 *  Deliberately excludes script, style, foreignObject, iframe, object, embed,
 *  and the animation elements — all of which can execute or load. */
const ALLOWED_ELEMENTS = new Set([
  'svg',
  'g',
  'defs',
  'clipPath',
  'mask',
  'path',
  'circle',
  'ellipse',
  'rect',
  'line',
  'polyline',
  'polygon',
  'use',
  'marker',
  'symbol',
  'linearGradient',
  'radialGradient',
  'stop',
  'title',
  'desc',
])

/** Attribute allowlist: geometry, presentation and the few structural
 *  attributes the artwork needs. No event handlers, no xlink:* beyond href,
 *  no style (which can smuggle url() fetches). */
const ALLOWED_ATTRIBUTES = new Set([
  // structure / identity
  'id',
  'class',
  'xmlns',
  'xmlns:xlink',
  'viewBox',
  'preserveAspectRatio',
  'version',
  'role',
  'aria-hidden',
  'aria-label',
  // geometry
  'd',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'width',
  'height',
  'points',
  'transform',
  'gradientUnits',
  'gradientTransform',
  'offset',
  'patternUnits',
  'markerWidth',
  'markerHeight',
  'refX',
  'refY',
  'orient',
  'maskUnits',
  'clipPathUnits',
  // presentation
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-dasharray',
  'stroke-dashoffset',
  'opacity',
  'color',
  'clip-path',
  'clip-rule',
  'mask',
  'marker-start',
  'marker-mid',
  'marker-end',
  'stop-color',
  'stop-opacity',
  'vector-effect',
  'paint-order',
  'shape-rendering',
  // references (values are checked separately — fragments only)
  'href',
  'xlink:href',
])

/** Attributes whose value must be a same-document fragment reference. */
const REFERENCE_ATTRIBUTES = new Set(['href', 'xlink:href'])

const TAG = /<\s*(\/?)\s*([a-zA-Z][\w:.-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g
const QUOTED_ATTRIBUTE = /([a-zA-Z][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g

/** Rejects a value that could trigger a fetch or a navigation. */
function attributeValueIsSafe(name: string, value: string): boolean {
  const v = value.trim()

  // href/xlink:href must point inside this document, never at another origin.
  if (REFERENCE_ATTRIBUTES.has(name)) return v.startsWith('#')

  // funcIRI values (fill="url(#x)", clip-path="url(#y)") must also be local.
  for (const m of v.matchAll(/url\(\s*['"]?([^'")]*)/gi)) {
    if (!m[1].startsWith('#')) return false
  }

  // Belt and braces: no scheme that can execute or inline a document.
  if (/(?:javascript|vbscript|data)\s*:/i.test(v)) return false

  return true
}

const rootCache = new Map<string, boolean>()
const fragmentCache = new Map<string, boolean>()

/**
 * True when `svg` is a complete `<svg>` document made only of allowlisted
 * elements and attributes, with no reference that leaves the document.
 * Does not modify the input. Used for the embedded country flags.
 */
export function isSafeSvgSource(svg: string): boolean {
  const cached = rootCache.get(svg)
  if (cached !== undefined) return cached
  const result = check(svg, true)
  rootCache.set(svg, result)
  return result
}

/**
 * Same allowlist, for a fragment that will be inserted *inside* an `<svg>`
 * element the component itself renders — the shape of the icon catalogue,
 * whose entries are bare `<path>`/`<circle>` markup with no root element.
 */
export function isSafeSvgFragment(svg: string): boolean {
  const cached = fragmentCache.get(svg)
  if (cached !== undefined) return cached
  const result = check(svg, false)
  fragmentCache.set(svg, result)
  return result
}

function check(svg: string, requireRoot: boolean): boolean {
  if (typeof svg !== 'string' || svg.length === 0) return false

  // A flag must be a lone SVG document. Anything before the root element
  // (a stray text node, a processing instruction, a comment) is not artwork.
  if (requireRoot && !/^\s*<\s*svg[\s>]/i.test(svg)) return false

  // A fragment must still start with a tag, not with text.
  if (!requireRoot && !/^\s*</.test(svg)) return false

  // CDATA sections can hide markup from a tag-level scan.
  if (svg.includes('<![CDATA[')) return false

  let tagCount = 0

  TAG.lastIndex = 0
  let tag: RegExpExecArray | null
  while ((tag = TAG.exec(svg)) !== null) {
    tagCount += 1
    const [, closing, element, attributeText] = tag

    if (!ALLOWED_ELEMENTS.has(element)) return false
    if (closing) {
      // A closing tag carries no attributes.
      if (attributeText.trim() !== '') return false
      continue
    }

    let remainder = attributeText
    QUOTED_ATTRIBUTE.lastIndex = 0
    let attr: RegExpExecArray | null
    while ((attr = QUOTED_ATTRIBUTE.exec(attributeText)) !== null) {
      const name = attr[1]
      const value = attr[2] ?? attr[3] ?? ''
      // Event handlers are rejected by the allowlist, but check the prefix too
      // so a future allowlist edit cannot accidentally let one through.
      if (/^on/i.test(name)) return false
      if (!ALLOWED_ATTRIBUTES.has(name)) return false
      if (!attributeValueIsSafe(name, value)) return false
      remainder = remainder.replace(attr[0], '')
    }

    // Whatever is left must be whitespace or the self-closing slash. This is
    // what catches unquoted attributes, which the matcher above cannot see.
    if (!/^[\s/]*$/.test(remainder)) return false
  }

  if (tagCount === 0) return false

  // Every '<' in the string must have been part of a tag the loop validated.
  // A leftover one means markup escaped the scan — in an attribute value, in
  // text content, or in a tag the matcher could not terminate.
  if ((svg.match(/</g) ?? []).length !== tagCount) return false

  return true
}

/**
 * Returns `svg` unchanged when it passes {@link isSafeSvgSource}, or the empty
 * string when it does not — so a rejected asset renders as nothing rather than
 * as untrusted markup. Callers should treat `''` as "show the fallback".
 */
export function safeSvg(svg: string): string {
  return isSafeSvgSource(svg) ? svg : ''
}

/** Fragment counterpart of {@link safeSvg}. */
export function safeSvgFragment(svg: string): string {
  return isSafeSvgFragment(svg) ? svg : ''
}
