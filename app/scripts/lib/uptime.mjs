// v1.1 — free uptime monitoring (.github/workflows/uptime-monitor.yml).
//
// Four read-only GET requests, once an hour:
//   1. the home page                     200, the app shell and the brand
//   2. a destination deep link           200, its own static page (SEO route)
//   3. a safe public Worker endpoint     200 and JSON
//   4. the admin boundary                401 without credentials
// No request writes anything (no event, rating, feedback or admin action),
// no credential is ever sent, and each check is tried at most twice.

import { PRODUCTION_SITE_URL, PRODUCTION_WORKER_URL } from './productionUrls.mjs';

export const DEFAULT_SITE = PRODUCTION_SITE_URL;
export const DEFAULT_WORKER = PRODUCTION_WORKER_URL;
const USER_AGENT = 'WejhatyUptime/1.1 (+https://github.com/hmooodzozo577-gif/wej)';

function withSlash(url) {
  return url.endsWith('/') ? url : `${url}/`;
}

/** The checks, as data: what is requested and what a healthy answer is. */
export function uptimeChecks(site = DEFAULT_SITE, worker = DEFAULT_WORKER) {
  const base = withSlash(site);
  const api = worker.replace(/\/$/, '');
  return [
    {
      name: 'home page',
      url: base,
      expectStatus: 200,
      verify: (body) => body.includes('<div id="root"') && body.includes('وجهتي'),
    },
    {
      name: 'destination deep link (Japan)',
      url: `${base}destination/japan/`,
      expectStatus: 200,
      verify: (body) => body.includes(`<link rel="canonical" href="${base}destination/japan/"`) && /Japan/.test(body),
    },
    {
      name: 'Worker public endpoint',
      url: `${api}/api/intelligence/SA/tourism`,
      expectStatus: 200,
      verify: (body) => {
        try {
          const value = JSON.parse(body);
          return !!value && typeof value === 'object';
        } catch {
          return false;
        }
      },
    },
    {
      name: 'admin boundary (no credentials)',
      url: `${api}/api/admin/summary`,
      expectStatus: 401,
      verify: () => true,
    },
  ];
}

/** Runs one check: at most two attempts, a timeout on each, GET only. */
export async function runCheck(check, { fetchImpl = fetch, retryDelayMs = 20000, timeoutMs = 20000, sleep } = {}) {
  const wait = sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  let last = '';
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetchImpl(check.url, {
        method: 'GET',
        redirect: 'follow',
        headers: { 'User-Agent': USER_AGENT, 'Cache-Control': 'no-cache' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      const body = await response.text();
      if (response.status === check.expectStatus && check.verify(body)) return { ok: true, name: check.name, detail: `${response.status}` };
      last = response.status === check.expectStatus ? `${response.status}, unexpected content` : `HTTP ${response.status}, expected ${check.expectStatus}`;
    } catch (error) {
      last = `request failed: ${error?.name === 'TimeoutError' ? 'timeout' : error?.message ?? error}`;
    }
    if (attempt === 1) await wait(retryDelayMs);
  }
  return { ok: false, name: check.name, detail: last };
}

export async function runUptime({ site, worker, ...options } = {}) {
  const results = [];
  for (const check of uptimeChecks(site, worker)) results.push(await runCheck(check, options));
  return results;
}
