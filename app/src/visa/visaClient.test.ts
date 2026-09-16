// Item #12F — the client's failure and privacy behaviour.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lookupVisaRequirements } from './visaClient';

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const requirement = (destinationCode: string, category: string) => ({
  requirement: {
    passportCode: 'SA',
    destinationCode,
    category,
    provider: 'test',
    checkedAt: '2026-09-16T00:00:00.000Z',
  },
  providerConfigured: true,
});

beforeEach(() => {
  vi.stubEnv('VITE_TRAVEL_WORKER_URL', 'https://worker.test');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('lookupVisaRequirements', () => {
  it('returns nothing, and calls nothing, without a passport', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await lookupVisaRequirements(null, ['JP', 'FR']);
    expect(result.requirements.size).toBe(0);
    expect(result.providerConfigured).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns nothing for an empty destination list', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect((await lookupVisaRequirements('SA', [])).requirements.size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends only the passport COUNTRY and the destination — never a passport number', async () => {
    const fetchMock = vi.fn(async () => ok(requirement('JP', 'visaFree')));
    vi.stubGlobal('fetch', fetchMock);
    await lookupVisaRequirements('SA', ['JP'], 'tourism');
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ passportCode: 'SA', destinationCode: 'JP', purpose: 'tourism' });
    expect(Object.keys(body)).not.toContain('passportNumber');
  });

  it('collects requirements for several destinations', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { destinationCode: string };
      return ok(requirement(body.destinationCode, body.destinationCode === 'JP' ? 'visaFree' : 'eVisa'));
    }));
    const result = await lookupVisaRequirements('SA', ['JP', 'FR']);
    expect(result.requirements.get('JP')?.category).toBe('visaFree');
    expect(result.requirements.get('FR')?.category).toBe('eVisa');
    expect(result.providerConfigured).toBe(true);
  });

  it('drops an "unknown" requirement so that "no entry" means one thing everywhere', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok(requirement('JP', 'unknown'))));
    const result = await lookupVisaRequirements('SA', ['JP']);
    expect(result.requirements.size).toBe(0);
  });

  it('survives a provider failure without throwing, and claims nothing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })));
    const result = await lookupVisaRequirements('SA', ['JP', 'FR']);
    expect(result.requirements.size).toBe(0);
    expect(result.providerConfigured).toBe(false);
  });

  it('survives a network error without throwing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('offline');
    }));
    await expect(lookupVisaRequirements('SA', ['JP'])).resolves.toMatchObject({ providerConfigured: false });
  });

  it('keeps the destinations that DID answer when one of several fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { destinationCode: string };
      if (body.destinationCode === 'FR') throw new Error('offline');
      return ok(requirement('JP', 'visaFree'));
    }));
    const result = await lookupVisaRequirements('SA', ['JP', 'FR']);
    expect(result.requirements.get('JP')?.category).toBe('visaFree');
    expect(result.requirements.has('FR')).toBe(false);
  });

  it('reports providerConfigured: false when the worker says no provider is set up', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok({
      requirement: { passportCode: 'SA', destinationCode: 'JP', category: 'unknown', provider: 'none', checkedAt: '2026-09-16T00:00:00.000Z' },
      providerConfigured: false,
    })));
    const result = await lookupVisaRequirements('SA', ['JP']);
    expect(result.providerConfigured).toBe(false);
    expect(result.requirements.size).toBe(0);
  });
});
