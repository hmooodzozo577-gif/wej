// @vitest-environment node
// Phase 19 P8/P19 — fetch safety for the entry-requirements generator, with
// a fake fetch: allowlist, HTTPS-only, bounded redirects, size cap,
// timeout, HTTP failures and robots.txt.
import { describe, expect, it } from 'vitest';
import { createSafeFetcher } from './entryRequirementsFetch.mjs';

const HOSTS = ['www.gov.uk', 'publications.europa.eu'];

function fakeFetch(routes) {
  const calls = [];
  const impl = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    const route = routes[url];
    if (!route) return new Response('not found', { status: 404 });
    if (typeof route === 'function') return route(init);
    // Bodiless responses (redirects) may be served repeatedly; a body is
    // served once, uncloned, so cancelling it is a real cancel.
    return route.body ? route : route.clone();
  };
  return { impl, calls };
}

const fetcher = (routes, options = {}) => {
  const fake = fakeFetch(routes);
  return { ...createSafeFetcher({ allowedHosts: HOSTS, fetchImpl: fake.impl, userAgent: 'test', timeoutMs: 200, maxBytes: 1000, ...options }), calls: fake.calls };
};

describe('safeFetch', () => {
  it('reads an allowlisted HTTPS page', async () => {
    const { safeFetch } = fetcher({ 'https://www.gov.uk/a': new Response('hello') });
    await expect(safeFetch('https://www.gov.uk/a')).resolves.toEqual({ body: 'hello', finalUrl: 'https://www.gov.uk/a' });
  });

  it('refuses plain HTTP and hosts outside the allowlist', async () => {
    const { safeFetch, calls } = fetcher({});
    await expect(safeFetch('http://www.gov.uk/a')).rejects.toThrow(/non-HTTPS/);
    await expect(safeFetch('https://attacker.example/a')).rejects.toThrow(/outside the allowlist/);
    await expect(safeFetch('https://169.254.169.254/latest/meta-data')).rejects.toThrow(/outside the allowlist/);
    expect(calls).toHaveLength(0);
  });

  it('follows a redirect only to an allowlisted host, upgrading an http hop to https', async () => {
    const { safeFetch, calls } = fetcher({
      'https://publications.europa.eu/resource/x': new Response(null, { status: 303, headers: { location: 'http://publications.europa.eu/resource/cellar/y' } }),
      'https://publications.europa.eu/resource/cellar/y': new Response('annex'),
    });
    await expect(safeFetch('https://publications.europa.eu/resource/x')).resolves.toEqual({ body: 'annex', finalUrl: 'https://publications.europa.eu/resource/cellar/y' });
    expect(calls.map((call) => call.url)).toEqual(['https://publications.europa.eu/resource/x', 'https://publications.europa.eu/resource/cellar/y']);
  });

  it('refuses a redirect off the allowlist', async () => {
    const { safeFetch } = fetcher({ 'https://www.gov.uk/a': new Response(null, { status: 302, headers: { location: 'https://evil.example/steal' } }) });
    await expect(safeFetch('https://www.gov.uk/a')).rejects.toThrow(/outside the allowlist: evil.example/);
  });

  it('stops after the redirect limit', async () => {
    const loop = new Response(null, { status: 302, headers: { location: 'https://www.gov.uk/a' } });
    const { safeFetch } = fetcher({ 'https://www.gov.uk/a': loop });
    await expect(safeFetch('https://www.gov.uk/a')).rejects.toThrow(/more than 3 redirects/);
  });

  it('caps the response size, declared or streamed', async () => {
    const big = 'x'.repeat(1500);
    const declared = fetcher({ 'https://www.gov.uk/a': new Response(big, { headers: { 'content-length': '1500' } }) });
    await expect(declared.safeFetch('https://www.gov.uk/a')).rejects.toThrow(/exceeds 1000/);
    const streamed = fetcher({ 'https://www.gov.uk/a': new Response(big) });
    await expect(streamed.safeFetch('https://www.gov.uk/a')).rejects.toThrow(/exceeded 1000 bytes/);
  });

  it('fails on a timeout instead of hanging', async () => {
    const { safeFetch } = fetcher({
      'https://www.gov.uk/slow': (init) =>
        new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason))),
    });
    await expect(safeFetch('https://www.gov.uk/slow')).rejects.toThrow(/timed out|aborted|timeout/i);
  });

  it('fails on an HTTP error or an unavailable source', async () => {
    const { safeFetch } = fetcher({ 'https://www.gov.uk/down': new Response('oops', { status: 503 }) });
    await expect(safeFetch('https://www.gov.uk/down')).rejects.toThrow(/HTTP 503/);
    await expect(safeFetch('https://www.gov.uk/missing')).rejects.toThrow(/HTTP 404/);
  });
});

describe('assertRobotsAllow', () => {
  it('blocks a path disallowed for every user agent', async () => {
    const { assertRobotsAllow } = fetcher({ 'https://www.gov.uk/robots.txt': new Response('User-agent: *\nDisallow: /search/all*\n') });
    await expect(assertRobotsAllow(new URL('https://www.gov.uk/search/all?q=x'))).rejects.toThrow(/disallows/);
    await expect(assertRobotsAllow(new URL('https://www.gov.uk/api/content/guidance/x'))).resolves.toBeUndefined();
  });

  it('ignores groups for other agents, allows on 4xx and refuses on 5xx', async () => {
    const other = fetcher({ 'https://www.gov.uk/robots.txt': new Response('User-agent: deepcrawl\nDisallow: /\n') });
    await expect(other.assertRobotsAllow(new URL('https://www.gov.uk/x'))).resolves.toBeUndefined();
    const missing = fetcher({});
    await expect(missing.assertRobotsAllow(new URL('https://www.gov.uk/x'))).resolves.toBeUndefined();
    const broken = fetcher({ 'https://www.gov.uk/robots.txt': new Response('', { status: 500 }) });
    await expect(broken.assertRobotsAllow(new URL('https://www.gov.uk/x'))).rejects.toThrow(/treating as disallowed/);
  });
});
