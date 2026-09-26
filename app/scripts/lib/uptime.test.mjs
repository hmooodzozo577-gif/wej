import { describe, expect, it } from 'vitest';
import { runCheck, runUptime, uptimeChecks } from './uptime.mjs';

const response = (status, body) => ({ status, text: async () => body });

describe('uptime checks', () => {
  it('checks four read-only URLs and never sends a credential', () => {
    const checks = uptimeChecks('https://example.org/wej', 'https://worker.example/');
    expect(checks.map((check) => check.url)).toEqual([
      'https://example.org/wej/',
      'https://example.org/wej/destination/japan/',
      'https://worker.example/api/intelligence/SA/tourism',
      'https://worker.example/api/admin/summary',
    ]);
    expect(checks.map((check) => check.expectStatus)).toEqual([200, 200, 200, 401]);
  });

  it('uses GET only, without Authorization, and passes a healthy answer', async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push(init);
      if (url.endsWith('/admin/summary')) return response(401, '{"error":"unauthorized"}');
      if (url.includes('/api/')) return response(200, '{"score":70}');
      if (url.includes('/destination/japan/')) return response(200, '<link rel="canonical" href="https://example.org/wej/destination/japan/"> Japan');
      return response(200, '<div id="root"></div> وجهتي');
    };
    const results = await runUptime({ site: 'https://example.org/wej/', worker: 'https://worker.example', fetchImpl, sleep: async () => {} });
    expect(results.every((result) => result.ok)).toBe(true);
    for (const init of calls) {
      expect(init.method).toBe('GET');
      expect(JSON.stringify(init.headers)).not.toMatch(/authorization|bearer/i);
    }
  });

  it('retries once, then reports the failure (no loop)', async () => {
    let attempts = 0;
    const result = await runCheck(uptimeChecks()[1], { fetchImpl: async () => { attempts += 1; return response(404, 'Not found'); }, sleep: async () => {} });
    expect(attempts).toBe(2);
    expect(result).toMatchObject({ ok: false, detail: 'HTTP 404, expected 200' });
  });

  it('an open admin boundary is a failure', async () => {
    const result = await runCheck(uptimeChecks()[3], { fetchImpl: async () => response(200, '{}'), sleep: async () => {} });
    expect(result.ok).toBe(false);
  });

  it('a network error recovers on the second attempt', async () => {
    let attempts = 0;
    const fetchImpl = async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('ECONNRESET');
      return response(200, '{"ok":true}');
    };
    expect((await runCheck(uptimeChecks()[2], { fetchImpl, sleep: async () => {} })).ok).toBe(true);
  });
});
