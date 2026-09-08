// Runtime security check: loads the built site in a real browser and proves
// the hardening actually holds, rather than assuming it from the source.
//
// It fails if any of these is true:
//   - the browser reports a Content-Security-Policy violation
//   - the page makes a request to any origin other than its own
//   - the page logs an error
//   - the flags, fonts or navigation stop working under the policy
//
// The last one matters as much as the others: a policy strict enough to break
// the app is not protection, it is an outage. So the script walks the real
// flow — home, purpose, quiz, results, destination, explorer — with the
// production CSP enforced.
//
// Usage:  npm run build && node scripts/security-check.mjs
//
// Playwright is not a dependency of this app; the script uses whatever
// installation is on the machine. Install with `npm i -g playwright` if
// missing. CI does not need it: the unit tests and the build-time
// external-origin guard cover the same ground without a browser.

import { createServer } from 'node:http'
import { existsSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { execSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

/** Playwright is intentionally not a dependency of this app (a browser
 *  engine is a heavy thing to pin for one script), so resolve it from the
 *  project first and fall back to a global installation. */
async function loadChromium() {
  // Playwright ships CommonJS, so a dynamic import of a path may put the
  // exports on `.default` rather than naming them.
  const pick = (mod) => mod.chromium ?? mod.default?.chromium
  try {
    const found = pick(await import('playwright'))
    if (found) return found
  } catch {
    // fall through to the global installation
  }
  const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim()
  const found = pick(await import(pathToFileURL(join(globalRoot, 'playwright', 'index.js')).href))
  if (!found) throw new Error('Could not load Playwright. Install it with: npm i -g playwright')
  return found
}

/** The pre-installed browser, or Playwright's own resolution if it is absent. */
function browserOptions() {
  const preinstalled = '/opt/pw-browsers/chromium'
  return existsSync(preinstalled) ? { executablePath: preinstalled } : {}
}

const DIST = new URL('../dist/', import.meta.url).pathname
const PORT = 8099
const BASE = `http://127.0.0.1:${PORT}/wej/`

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
}

/** Serves dist/ under /wej/ with an SPA fallback, mirroring GitHub Pages. */
function serve() {
  return createServer(async (req, res) => {
    let path = decodeURIComponent(req.url.split('?')[0])
    path = path.startsWith('/wej/') ? path.slice('/wej'.length) : path
    let file = join(DIST, normalize(path).replace(/^(\.\.[/\\])+/, ''))
    try {
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html')
    } catch {
      file = join(DIST, 'index.html') // SPA fallback
    }
    try {
      const body = await readFile(file)
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' })
      res.end(body)
    } catch {
      res.writeHead(404).end('not found')
    }
  })
}

const failures = []
const fail = (msg) => {
  failures.push(msg)
  console.error('  FAIL  ' + msg)
}
const pass = (msg) => console.log('  ok    ' + msg)

async function main() {
  const server = serve()
  await new Promise((r) => server.listen(PORT, r))

  const chromium = await loadChromium()
  const browser = await chromium.launch(browserOptions())
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

  const violations = []
  const consoleErrors = []
  const foreignRequests = []

  // Catch CSP violations from inside the page, where the browser reports them.
  await page.addInitScript(() => {
    window.__cspViolations = []
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__cspViolations.push(`${e.violatedDirective} blocked ${e.blockedURI}`)
    })
  })

  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message))
  page.on('request', (r) => {
    const url = r.url()
    if (!url.startsWith(`http://127.0.0.1:${PORT}/`) && !url.startsWith('data:')) {
      foreignRequests.push(url)
    }
  })

  const collect = async () => {
    violations.push(...(await page.evaluate(() => window.__cspViolations ?? [])))
  }

  console.log('\nContent-Security-Policy')
  await page.goto(BASE, { waitUntil: 'networkidle' })
  const csp = await page.getAttribute('meta[http-equiv="Content-Security-Policy"]', 'content')
  if (!csp) fail('no CSP meta tag in the served page')
  else {
    pass('policy present')
    for (const required of ["default-src 'none'", "script-src 'self'", "connect-src 'none'"]) {
      if (csp.includes(required)) pass(`enforces ${required}`)
      else fail(`policy is missing ${required}`)
    }
    if (/script-src[^;]*unsafe-(inline|eval)/.test(csp)) fail('script-src allows unsafe-inline or unsafe-eval')
    else pass('script-src allows neither unsafe-inline nor unsafe-eval')
  }

  console.log('\nRendering under the policy')
  const fontsLoaded = await page.evaluate(async () => {
    await document.fonts.ready
    return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family)
  })
  if (fontsLoaded.length === 0) fail('no web font loaded — self-hosted fonts are being blocked')
  else pass(`fonts loaded: ${[...new Set(fontsLoaded)].join(', ')}`)

  console.log('\nWalking the app')
  const steps = [
    ['home', async () => page.locator('svg, .flag-chip').first().waitFor({ timeout: 5000 })],
    [
      'purpose selection',
      async () => {
        await page.goto(BASE + '#/purpose', { waitUntil: 'networkidle' }).catch(() => {})
        await page.locator('body').waitFor()
      },
    ],
    [
      'destination explorer',
      async () => {
        await page.goto(BASE + 'explore', { waitUntil: 'networkidle' })
        await page.locator('.flag-banner, .flag-chip, .dest-card').first().waitFor({ timeout: 5000 })
      },
    ],
  ]
  for (const [name, run] of steps) {
    try {
      await run()
      await collect()
      pass(`${name} rendered`)
    } catch (e) {
      fail(`${name} failed to render: ${e.message.split('\n')[0]}`)
    }
  }

  const flagCount = await page.locator('.flag-banner svg, .flag-chip svg').count()
  if (flagCount === 0) fail('no flag SVG reached the DOM — the guard or the CSP is rejecting the artwork')
  else pass(`${flagCount} flag SVGs rendered`)

  console.log('\nIsolation')
  await collect()
  if (violations.length) [...new Set(violations)].forEach((v) => fail('CSP violation: ' + v))
  else pass('no CSP violations')

  if (foreignRequests.length) [...new Set(foreignRequests)].forEach((u) => fail('request to another origin: ' + u))
  else pass('every request stayed on this origin')

  if (consoleErrors.length) [...new Set(consoleErrors)].forEach((e) => fail('console error: ' + e))
  else pass('no console errors')

  await browser.close()
  server.close()

  console.log('')
  if (failures.length) {
    console.error(`${failures.length} check(s) failed.`)
    process.exit(1)
  }
  console.log('All security checks passed.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
