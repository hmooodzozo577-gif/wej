// Phase 20 — Content-Security-Policy for the static site.
//
// GitHub Pages cannot send response headers, so the policy ships as a
// <meta> tag in the built index.html (and its 404.html copy). Scripts may
// only come from the site itself, the hashed inline theme bootstrap and
// Cloudflare Turnstile (off today; allowed so enabling it later does not
// break) — no 'unsafe-inline' or 'unsafe-eval' for scripts. Network
// requests may only reach the site, the configured Worker and Turnstile.
// Styles keep 'unsafe-inline' because the flag and icon SVGs are injected
// as markup. A meta policy cannot set frame-ancestors, report-uri or
// sandbox, so it does NOT protect against framing.
import { createHash } from 'node:crypto'
import type { Plugin } from 'vite'

export const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com'

function httpsOrigin(url: string | undefined): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' ? parsed.origin : null
  } catch {
    return null
  }
}

/** The policy for a built page: hashes every inline <script> it contains. */
export function buildContentSecurityPolicy(html: string, workerUrl: string | undefined): string {
  const inlineScriptHashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
    (match) => `'sha256-${createHash('sha256').update(match[1]!).digest('base64')}'`,
  )
  const worker = httpsOrigin(workerUrl)
  return [
    "default-src 'self'",
    `script-src 'self' ${[...inlineScriptHashes, TURNSTILE_ORIGIN].join(' ')}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    `connect-src 'self' ${[worker, TURNSTILE_ORIGIN].filter(Boolean).join(' ')}`,
    `frame-src ${TURNSTILE_ORIGIN}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}

/** Injects the policy right after <meta charset>, before any script runs.
 *  Build only: the dev server's module reloading needs inline scripts. */
export function contentSecurityPolicy(): Plugin {
  return {
    name: 'wejhaty-content-security-policy',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const policy = buildContentSecurityPolicy(html, process.env.VITE_TRAVEL_WORKER_URL)
        return html.replace(
          '<meta charset="UTF-8" />',
          `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`,
        )
      },
    },
  }
}
