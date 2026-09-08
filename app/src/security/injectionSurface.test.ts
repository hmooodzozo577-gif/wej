// Keeps the HTML-injection surface from growing.
//
// The SVG guard only protects the call sites that use it. Nothing stops someone
// adding a fifth dangerouslySetInnerHTML tomorrow and wiring it straight to a
// string, so this test walks the source tree and fails if one appears that does
// not pass through the guard. It is the enforcement half of the rule that
// svgGuard.ts only states.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(import.meta.dirname, '..')

/** The only components allowed to write raw HTML into the DOM, each because it
 *  renders vetted SVG artwork through the allowlist guard. */
const GUARDED_SINKS = ['components/Icon.tsx', 'components/flags/FlagIcon.tsx']

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      out.push(...sourceFiles(path))
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(path)
    }
  }
  return out
}

describe('HTML injection surface', () => {
  const files = sourceFiles(SRC)

  it('finds the source tree', () => {
    expect(files.length).toBeGreaterThan(20)
  })

  it('is limited to the components that render guarded SVG', () => {
    // Match the JSX attribute itself, not prose: svgGuard.ts and FlagIcon.tsx
    // both name the API in comments explaining why it is guarded.
    const found = files
      .filter((f) => /dangerouslySetInnerHTML\s*=\s*\{/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(SRC, f).replaceAll('\\', '/'))
      .sort()

    expect(found).toEqual([...GUARDED_SINKS].sort())
  })

  it('routes every sink through the allowlist guard', () => {
    for (const sink of GUARDED_SINKS) {
      const text = readFileSync(join(SRC, sink), 'utf8')
      const usesGuard =
        text.includes('safeSvgFragment(') || text.includes('safeSvg(') || text.includes('isSafeSvgSource(')
      expect(usesGuard, `${sink} writes raw HTML without consulting svgGuard`).toBe(true)
    }
  })

  // eval() and new Function() would let injected text execute, and the CSP's
  // script-src has no 'unsafe-eval' to permit them anyway — so a use here would
  // be a runtime failure as well as a risk.
  it('never evaluates strings as code', () => {
    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      expect(/\beval\s*\(/.test(text), `${relative(SRC, file)} calls eval()`).toBe(false)
      expect(/new\s+Function\s*\(/.test(text), `${relative(SRC, file)} calls new Function()`).toBe(false)
      expect(/\bdocument\.write\s*\(/.test(text), `${relative(SRC, file)} calls document.write()`).toBe(false)
    }
  })

  // The app is offline by design. A fetch would need connect-src, which the CSP
  // sets to 'none', so this catches the mistake before a user does.
  it('makes no network requests', () => {
    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      expect(/\bfetch\s*\(/.test(text), `${relative(SRC, file)} calls fetch()`).toBe(false)
      expect(/XMLHttpRequest/.test(text), `${relative(SRC, file)} uses XMLHttpRequest`).toBe(false)
      expect(/new\s+WebSocket/.test(text), `${relative(SRC, file)} opens a WebSocket`).toBe(false)
    }
  })
})
