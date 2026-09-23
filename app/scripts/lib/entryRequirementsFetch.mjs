// Phase 19 P3/P8 — the only way generate-entry-requirements.mjs reads the
// network. Kept separate from the generator and parameterised on `fetchImpl`
// so every safety rule below is unit-tested without a live connection
// (entryRequirementsFetch.test.mjs).
//
//   - URLs come only from the generator's own registry; HTTPS only, and
//     only to allowlisted hosts
//   - redirects are followed manually, at most `maxRedirects`, and only to
//     allowlisted hosts; an http:// hop on an allowlisted host is upgraded
//     to https:// rather than followed in the clear
//   - every response body is capped at `maxBytes`; every request aborts
//     after `timeoutMs`
//   - robots.txt is honoured for `User-agent: *` (RFC 9309: a 4xx
//     robots.txt means no restrictions; 5xx or unreachable means disallow)

export function createSafeFetcher({ allowedHosts, fetchImpl = fetch, timeoutMs = 30_000, maxBytes = 3_000_000, maxRedirects = 3, userAgent }) {
  const hosts = new Set(allowedHosts);
  const robotsCache = new Map();

  function assertAllowed(url) {
    if (url.protocol !== 'https:') throw new Error(`refusing non-HTTPS URL ${url.href}`);
    if (!hosts.has(url.hostname)) throw new Error(`refusing host outside the allowlist: ${url.hostname}`);
  }

  async function readCapped(response) {
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > maxBytes) throw new Error(`response of ${declared} bytes exceeds ${maxBytes}`);
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        // Not awaited: cancelling must never be what keeps the run waiting.
        reader.cancel().catch(() => {});
        throw new Error(`response exceeded ${maxBytes} bytes`);
      }
      chunks.push(value);
    }
    return new TextDecoder().decode(Buffer.concat(chunks));
  }

  async function safeFetch(startUrl, { accept = 'text/html,application/json', acceptLanguage } = {}) {
    let url = new URL(startUrl);
    for (let hop = 0; hop <= maxRedirects; hop += 1) {
      assertAllowed(url);
      const response = await fetchImpl(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { 'User-Agent': userAgent, Accept: accept, ...(acceptLanguage ? { 'Accept-Language': acceptLanguage } : {}) },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) throw new Error(`redirect without Location from ${url.href}`);
        const next = new URL(location, url);
        if (next.protocol === 'http:' && hosts.has(next.hostname)) next.protocol = 'https:';
        url = next;
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status} from ${url.href}`);
      return { body: await readCapped(response), finalUrl: url.href };
    }
    throw new Error(`more than ${maxRedirects} redirects from ${startUrl}`);
  }

  async function assertRobotsAllow(url) {
    const origin = `${url.protocol}//${url.host}`;
    if (!robotsCache.has(origin)) {
      const rules = [];
      try {
        const response = await fetchImpl(`${origin}/robots.txt`, { signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': userAgent, Accept: '*/*' } });
        if (response.status >= 500) throw new Error(`robots.txt ${response.status}`);
        if (response.ok) {
          let applies = false;
          for (const raw of (await response.text()).split('\n')) {
            const line = raw.replace(/#.*/, '').trim();
            const [key, ...rest] = line.split(':');
            const value = rest.join(':').trim();
            if (/^user-agent$/i.test(key)) applies = value === '*';
            else if (applies && /^disallow$/i.test(key) && value) rules.push(value);
          }
        }
      } catch (error) {
        throw new Error(`robots.txt for ${origin} unavailable (${error.message}); treating as disallowed`);
      }
      robotsCache.set(origin, rules);
    }
    const target = url.pathname + url.search;
    for (const rule of robotsCache.get(origin)) {
      const pattern = new RegExp(`^${rule.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$')}`);
      if (pattern.test(target)) throw new Error(`robots.txt of ${origin} disallows ${target} (${rule})`);
    }
  }

  return { safeFetch, assertRobotsAllow };
}
