import { describe, expect, it } from 'vitest'
import { FLAG_SVG_RAW } from '../data/flags'
import { ICON } from '../data/icons'
import { instantiateFlagSvg } from '../components/flags/instantiateFlagSvg'
import { isSafeSvgFragment, isSafeSvgSource, safeSvg, safeSvgFragment } from './svgGuard'

describe('the shipped artwork passes unchanged', () => {
  const flagCodes = Object.keys(FLAG_SVG_RAW)
  const iconNames = Object.keys(ICON)

  it('has the full catalogue to check', () => {
    expect(flagCodes.length).toBe(30)
    expect(iconNames.length).toBeGreaterThan(0)
  })

  it.each(flagCodes)('accepts the %s flag', (code) => {
    expect(isSafeSvgSource(FLAG_SVG_RAW[code])).toBe(true)
  })

  it.each(iconNames)('accepts the %s icon', (name) => {
    expect(isSafeSvgFragment(ICON[name as keyof typeof ICON])).toBe(true)
  })

  // The guard must never repair or reformat artwork — a byte-for-byte
  // pass-through is what keeps the flags rendering exactly as before.
  it('returns every flag byte-for-byte', () => {
    for (const code of flagCodes) {
      expect(safeSvg(FLAG_SVG_RAW[code])).toBe(FLAG_SVG_RAW[code])
    }
  })

  it('returns every icon byte-for-byte', () => {
    for (const name of iconNames) {
      const raw = ICON[name as keyof typeof ICON]
      expect(safeSvgFragment(raw)).toBe(raw)
    }
  })

  // instantiateFlagSvg() runs after the check, so its output must stay inside
  // the allowlist too — otherwise the guard would be checking the wrong string.
  it('still accepts a flag after id rewriting, in both fit modes', () => {
    for (const code of flagCodes) {
      for (const fit of ['meet', 'slice'] as const) {
        expect(isSafeSvgSource(instantiateFlagSvg(FLAG_SVG_RAW[code], fit, 'fir1'))).toBe(true)
      }
    }
  })
})

describe('rejects markup that could execute or phone home', () => {
  const attacks: Array<[string, string]> = [
    ['script element', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'],
    ['event handler', '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0" onload="alert(1)"/></svg>'],
    ['mixed-case event handler', '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0" OnLoad="alert(1)"/></svg>'],
    ['foreignObject', '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><b>x</b></foreignObject></svg>'],
    ['iframe', '<svg xmlns="http://www.w3.org/2000/svg"><iframe src="https://evil.test"></iframe></svg>'],
    ['animation element', '<svg xmlns="http://www.w3.org/2000/svg"><set attributeName="x" to="1"/></svg>'],
    ['style element', '<svg xmlns="http://www.w3.org/2000/svg"><style>@import url(https://evil.test)</style></svg>'],
    ['style attribute', '<svg xmlns="http://www.w3.org/2000/svg"><path style="background:url(https://evil.test)"/></svg>'],
    ['remote xlink:href', '<svg xmlns="http://www.w3.org/2000/svg"><use xlink:href="https://evil.test/x.svg#a"/></svg>'],
    ['remote href', '<svg xmlns="http://www.w3.org/2000/svg"><use href="//evil.test/x.svg#a"/></svg>'],
    ['javascript: reference', '<svg xmlns="http://www.w3.org/2000/svg"><use href="javascript:alert(1)"/></svg>'],
    ['remote funcIRI fill', '<svg xmlns="http://www.w3.org/2000/svg"><path fill="url(https://evil.test/x#p)"/></svg>'],
    ['data: URI value', '<svg xmlns="http://www.w3.org/2000/svg"><path fill="data:image/svg+xml;base64,AAAA"/></svg>'],
    ['unquoted attribute', '<svg xmlns="http://www.w3.org/2000/svg"><path d=M0 onload=alert(1)/></svg>'],
    ['CDATA section', '<svg xmlns="http://www.w3.org/2000/svg"><![CDATA[<script>alert(1)</script>]]></svg>'],
    ['unknown attribute', '<svg xmlns="http://www.w3.org/2000/svg"><path formaction="x"/></svg>'],
    ['angle bracket in text', '<svg xmlns="http://www.w3.org/2000/svg"><title>a < b</title></svg>'],
    ['markup before the root', 'x<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>'],
  ]

  it.each(attacks)('rejects a %s', (_label, payload) => {
    expect(isSafeSvgSource(payload)).toBe(false)
  })

  it('renders nothing rather than the payload', () => {
    for (const [, payload] of attacks) {
      expect(safeSvg(payload)).toBe('')
    }
  })

  it('rejects the same payloads as fragments', () => {
    // 'markup before the root' is the one attack with no fragment equivalent:
    // it abuses the root-element rule, and stripping the wrapper leaves
    // ordinary, genuinely safe path markup.
    const rootOnly = new Set(['markup before the root'])
    for (const [label, payload] of attacks) {
      if (rootOnly.has(label)) continue
      // Strip the wrapping <svg> so each payload is judged as icon-shaped markup.
      const fragment = payload.replace(/^[^<]*<svg[^>]*>/, '').replace(/<\/svg>$/, '')
      if (fragment.trim() === '') continue
      expect(safeSvgFragment(fragment), label).toBe('')
    }
  })

  it('rejects empty and non-string input', () => {
    expect(isSafeSvgSource('')).toBe(false)
    expect(isSafeSvgFragment('')).toBe(false)
    expect(isSafeSvgSource('not markup at all')).toBe(false)
    // Defends the runtime boundary, where types are not enforced.
    expect(isSafeSvgSource(null as unknown as string)).toBe(false)
    expect(isSafeSvgSource(undefined as unknown as string)).toBe(false)
  })

  it('requires a root element for a flag but not for an icon', () => {
    const fragment = '<path d="M0 0" fill="#fff"/>'
    expect(isSafeSvgSource(fragment)).toBe(false)
    expect(isSafeSvgFragment(fragment)).toBe(true)
  })
})
