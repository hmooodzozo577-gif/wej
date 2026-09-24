import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { buildContentSecurityPolicy, TURNSTILE_ORIGIN } from './contentSecurityPolicy.ts'

const html = '<head><meta charset="UTF-8" /><script>document.documentElement.dataset.theme = "dark";</script><script type="module" src="/wej/assets/index.js"></script></head>'
const directive = (policy: string, name: string) => policy.split('; ').find((part) => part.startsWith(`${name} `)) ?? ''

describe('content security policy', () => {
  it('allows only the hashed inline script, the site and Turnstile to run code', () => {
    const policy = buildContentSecurityPolicy(html, 'https://worker.example.workers.dev/')
    const hash = createHash('sha256').update('document.documentElement.dataset.theme = "dark";').digest('base64')
    expect(directive(policy, 'script-src')).toBe(`script-src 'self' 'sha256-${hash}' ${TURNSTILE_ORIGIN}`)
    expect(policy).not.toMatch(/unsafe-eval/)
    expect(directive(policy, 'script-src')).not.toMatch(/unsafe-inline/)
    expect(policy).toMatch(/object-src 'none'/)
    expect(policy).toMatch(/base-uri 'self'/)
  })

  it('lets requests reach only the site, the configured Worker origin and Turnstile', () => {
    expect(directive(buildContentSecurityPolicy(html, 'https://worker.example.workers.dev/api'), 'connect-src'))
      .toBe(`connect-src 'self' https://worker.example.workers.dev ${TURNSTILE_ORIGIN}`)
    expect(directive(buildContentSecurityPolicy(html, undefined), 'connect-src')).toBe(`connect-src 'self' ${TURNSTILE_ORIGIN}`)
    expect(directive(buildContentSecurityPolicy(html, 'http://insecure.example'), 'connect-src')).toBe(`connect-src 'self' ${TURNSTILE_ORIGIN}`)
  })

  it('does not claim framing protection a meta policy cannot give', () => {
    expect(buildContentSecurityPolicy(html, undefined)).not.toMatch(/frame-ancestors/)
  })
})
