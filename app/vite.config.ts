/// <reference types="vitest/config" />
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * The production Content-Security-Policy.
 *
 * The app is a static bundle that talks to nobody: no API, no analytics, no
 * fonts or images from another origin, no user accounts. That makes a
 * deny-by-default policy achievable rather than aspirational — `default-src
 * 'none'` with a short list of same-origin exceptions.
 *
 * Two directives deserve their reasons written down:
 *
 * - `style-src` keeps `'unsafe-inline'` because React writes the `style`
 *   attributes this UI uses for flag sizing and the region gradients. The
 *   tighter CSP Level 3 split (`style-src 'self'` plus `style-src-attr
 *   'unsafe-inline'`) would express that precisely, but Firefox does not
 *   implement `style-src-attr` and would fall back to `style-src 'self'`,
 *   silently dropping those attributes and breaking the layout. The residual
 *   risk is small here: the app renders no user-supplied content anywhere, so
 *   there is no path by which an attacker's CSS could reach the page.
 *
 * - `connect-src 'none'` is the load-bearing one. The bundle performs no
 *   network requests at all, so even if markup were somehow injected, it
 *   would have no channel to send anything out.
 *
 * `frame-ancestors` is deliberately absent: browsers ignore it in a <meta>
 * policy and log a warning. Clickjacking protection has to come from a real
 * HTTP header, which GitHub Pages cannot set — the generated dist/_headers
 * carries it for hosts that can. See SECURITY.md.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'none'",
  "manifest-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
  'upgrade-insecure-requests',
].join('; ')

/**
 * Injects the CSP into the built index.html.
 *
 * Build-only on purpose: the dev server needs inline scripts and a websocket
 * for hot reload, and a policy strict enough to be worth shipping would block
 * both. Enforcing it at build time means the policy is checked against exactly
 * the artifact that gets deployed.
 */
function contentSecurityPolicy(): Plugin {
  return {
    name: 'wejhaty-csp',
    apply: 'build',
    // GitHub Pages serves static files and cannot set response headers, so the
    // policy has to travel inside the document. Hosts that *can* set headers
    // (Netlify, Cloudflare Pages) read dist/_headers, which is generated below
    // from this same constant so the two can never drift apart.
    closeBundle() {
      const headers = [
        '/*',
        `  Content-Security-Policy: ${CONTENT_SECURITY_POLICY}; frame-ancestors 'none'`,
        // Stops a browser from second-guessing a Content-Type and executing an
        // asset as script.
        '  X-Content-Type-Options: nosniff',
        // Clickjacking: the meta policy cannot express frame-ancestors, so this
        // is the only place the site can refuse to be framed.
        '  X-Frame-Options: DENY',
        '  Referrer-Policy: no-referrer',
        // The app asks for none of these, so refuse them all up front.
        '  Permissions-Policy: accelerometer=(), autoplay=(), camera=(), display-capture=(),' +
          ' geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(),' +
          ' usb=(), xr-spatial-tracking=()',
        // Severs the window.opener relationship a malicious opener could use.
        '  Cross-Origin-Opener-Policy: same-origin',
        '  Cross-Origin-Resource-Policy: same-origin',
        '  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload',
        '',
      ].join('\n')
      writeFileSync(join(import.meta.dirname, 'dist', '_headers'), headers)
    },
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        // Placed immediately after <meta charset>, which the HTML spec wants
        // to stay first in <head>.
        const charset = /<meta charset="[^"]*"\s*\/?>/i
        if (!charset.test(html)) {
          throw new Error('index.html has no <meta charset> to anchor the CSP after.')
        }
        return html.replace(
          charset,
          (tag) =>
            `${tag}\n    <meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`,
        )
      },
    },
  }
}

/**
 * Fails the build if any emitted asset references another origin.
 *
 * The CSP already blocks such a request at runtime, but a blocked request is a
 * broken feature discovered by a user. This catches the mistake at the point it
 * is introduced — someone adding a CDN script tag, a tracking pixel, or a
 * remote font — and turns the app's "contacts no third party" property into
 * something the build enforces rather than something a comment claims.
 */
function noExternalOrigins(): Plugin {
  // Namespace URLs are identifiers inside SVG/XML, never fetched. React and
  // React Router embed documentation links in their development warnings.
  const ALLOWED = [
    'http://www.w3.org/',
    'https://www.w3.org/',
    'https://react.dev/',
    'https://reactjs.org/',
    'https://reactrouter.com/',
  ]

  return {
    name: 'wejhaty-no-external-origins',
    apply: 'build',
    closeBundle() {
      const dist = join(import.meta.dirname, 'dist')
      const offenders: string[] = []

      const walk = (dir: string) => {
        for (const entry of readdirSync(dir)) {
          const path = join(dir, entry)
          if (statSync(path).isDirectory()) {
            walk(path)
            continue
          }
          if (!/\.(js|css|html|json|webmanifest)$/.test(entry)) continue
          const text = readFileSync(path, 'utf8')
          for (const match of text.matchAll(/https?:\/\/[^\s"'`)<>\\]+/g)) {
            const url = match[0]
            if (ALLOWED.some((prefix) => url.startsWith(prefix))) continue
            if (url.startsWith('http://localhost')) continue
            offenders.push(`${entry}: ${url}`)
          }
        }
      }

      walk(dist)

      if (offenders.length > 0) {
        const unique = [...new Set(offenders)]
        this.error(
          'Build blocked: the bundle references origins outside itself, which the ' +
            'Content-Security-Policy will refuse to load at runtime.\n  ' +
            unique.join('\n  ') +
            '\nSelf-host the resource, or add it to the CSP and to ALLOWED in ' +
            'vite.config.ts if it is genuinely needed.',
        )
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/wej/',
  plugins: [react(), contentSecurityPolicy(), noExternalOrigins()],
  build: {
    // Source maps would republish the readable source alongside the bundle.
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
  },
})
