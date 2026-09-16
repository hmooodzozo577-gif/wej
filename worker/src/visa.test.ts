import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  createSherpaProvider,
  extractSherpaRequirement,
  handleVisaRequest,
  mapSherpaCategory,
  resolveVisaProvider,
  unavailableProvider,
  validateVisaLookup,
} from './visa';

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function post(body: unknown) {
  return new Request('https://worker.test/api/visa/requirements', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('visa lookup validation', () => {
  it('requires ISO 3166-1 alpha-2 codes for both sides', () => {
    expect(validateVisaLookup({ passportCode: 'SA', destinationCode: 'JP' })).toEqual([]);
    expect(validateVisaLookup({ passportCode: 'SAU', destinationCode: 'JP' })).toHaveLength(1);
    expect(validateVisaLookup({ passportCode: 'sa', destinationCode: 'JP' })).toHaveLength(1);
    expect(validateVisaLookup({ passportCode: 'SA', destinationCode: '' })).toHaveLength(1);
  });

  it('rejects a non-object body', () => {
    expect(validateVisaLookup(null)).toHaveLength(1);
    expect(validateVisaLookup([])).toHaveLength(1);
    expect(validateVisaLookup('SA')).toHaveLength(1);
  });

  // The IL/ISR exclusion is absolute across every effective path, and a visa
  // lookup is a destination path like any other.
  it('refuses an excluded destination', () => {
    expect(validateVisaLookup({ passportCode: 'SA', destinationCode: 'IL' })).toContain(
      'destinationCode is not part of the effective catalog.',
    );
  });

  it('accepts Monaco, which is a valid destination', () => {
    expect(validateVisaLookup({ passportCode: 'SA', destinationCode: 'MC' })).toEqual([]);
  });

  it('never asks for or accepts a passport number', () => {
    // The shape has no field for one; anything extra is simply ignored, and
    // must never be echoed back (asserted in the endpoint tests below).
    expect(validateVisaLookup({ passportCode: 'SA', destinationCode: 'JP', passportNumber: 'X1234567' })).toEqual([]);
  });
});

describe('the default provider is honest rather than helpful', () => {
  it('reports itself unconfigured and answers unknown', async () => {
    expect(unavailableProvider.isConfigured()).toBe(false);
    const requirement = await unavailableProvider.lookup({ passportCode: 'SA', destinationCode: 'JP' });
    expect(requirement.category).toBe('unknown');
    expect(requirement.provider).toBe('none');
    expect(requirement.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('is what resolveVisaProvider falls back to with no credentials', () => {
    expect(resolveVisaProvider({}).name).toBe('none');
    expect(resolveVisaProvider({ SHERPA_API_KEY: '' }).name).toBe('none');
  });

  it('selects a configured provider when credentials exist', () => {
    expect(resolveVisaProvider({ SHERPA_API_KEY: 'test-key' }).name).toBe('sherpa');
  });
});

describe('Sherpa category mapping', () => {
  it('maps the documented values onto Wejhaty categories', () => {
    expect(mapSherpaCategory('not_required')).toBe('visaFree');
    expect(mapSherpaCategory('visa_on_arrival')).toBe('visaOnArrival');
    expect(mapSherpaCategory('e_visa')).toBe('eVisa');
    expect(mapSherpaCategory('eta')).toBe('authorizationRequired');
    expect(mapSherpaCategory('required')).toBe('embassyVisaRequired');
  });

  it('is tolerant of case and separator differences', () => {
    expect(mapSherpaCategory('VISA ON ARRIVAL')).toBe('visaOnArrival');
    expect(mapSherpaCategory('Visa-Free')).toBe('visaFree');
  });

  // The whole point of a coarse canonical vocabulary: an unrecognised
  // provider value degrades to "we do not know", never to a wrong claim.
  it('maps anything unrecognised to unknown, never to a guess', () => {
    expect(mapSherpaCategory('something_new')).toBe('unknown');
    expect(mapSherpaCategory(undefined)).toBe('unknown');
    expect(mapSherpaCategory(42)).toBe('unknown');
    expect(mapSherpaCategory(null)).toBe('unknown');
  });
});

describe('Sherpa payload extraction', () => {
  const payload = (group: Record<string, unknown>) => ({ data: { attributes: { informationGroups: [group] } } });

  it('reads the visa requirement group and its summary', () => {
    expect(
      extractSherpaRequirement(payload({ type: 'VISA_REQUIREMENTS', visaStatus: 'not_required', summary: 'Up to 90 days.' })),
    ).toEqual({ category: 'visaFree', details: 'Up to 90 days.' });
  });

  it('ignores other information groups', () => {
    expect(
      extractSherpaRequirement({
        data: {
          attributes: {
            informationGroups: [
              { type: 'HEALTH', status: 'not_required' },
              { type: 'VISA_REQUIREMENTS', status: 'required' },
            ],
          },
        },
      }),
    ).toEqual({ category: 'embassyVisaRequired' });
  });

  it('returns unknown for a payload whose shape has drifted, without throwing', () => {
    for (const drifted of [undefined, null, {}, { data: {} }, { data: { attributes: {} } }, { data: { attributes: { informationGroups: 'nope' } } }]) {
      expect(extractSherpaRequirement(drifted)).toEqual({ category: 'unknown' });
    }
  });

  it('never invents a details string', () => {
    const result = extractSherpaRequirement(payload({ type: 'VISA_REQUIREMENTS', status: 'required', summary: 12 }));
    expect(result.details).toBeUndefined();
  });
});

describe('Sherpa provider failure behaviour', () => {
  it('answers unknown, not an error, when the provider returns a non-2xx', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 503 })));
    const provider = createSherpaProvider({ SHERPA_API_KEY: 'key' });
    const requirement = await provider.lookup({ passportCode: 'SA', destinationCode: 'JP' });
    expect(requirement.category).toBe('unknown');
    expect(requirement.provider).toBe('sherpa');
  });

  it('answers unknown when the provider throws or times out', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network down');
    }));
    const provider = createSherpaProvider({ SHERPA_API_KEY: 'key' });
    expect((await provider.lookup({ passportCode: 'SA', destinationCode: 'JP' })).category).toBe('unknown');
  });

  it('answers unknown when the provider returns malformed JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>', { status: 200 })));
    const provider = createSherpaProvider({ SHERPA_API_KEY: 'key' });
    expect((await provider.lookup({ passportCode: 'SA', destinationCode: 'JP' })).category).toBe('unknown');
  });

  it('sends the key as a bearer token and never in the URL', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { attributes: { informationGroups: [] } } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await createSherpaProvider({ SHERPA_API_KEY: 'super-secret' }).lookup({ passportCode: 'SA', destinationCode: 'JP' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain('super-secret');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer super-secret');
  });

  it('maps a real success payload through to a canonical requirement', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      data: { attributes: { informationGroups: [{ type: 'VISA_REQUIREMENTS', visaStatus: 'visa_on_arrival', summary: 'On arrival, 30 days.' }] } },
    }), { status: 200 })));
    const requirement = await createSherpaProvider({ SHERPA_API_KEY: 'key' }).lookup({ passportCode: 'SA', destinationCode: 'JP' });
    expect(requirement).toMatchObject({
      passportCode: 'SA',
      destinationCode: 'JP',
      category: 'visaOnArrival',
      details: 'On arrival, 30 days.',
      provider: 'sherpa',
    });
    expect(requirement.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('the /api/visa/requirements endpoint', () => {
  it('ignores any other path', async () => {
    expect(await handleVisaRequest(new Request('https://worker.test/api/other'), {}, json)).toBeNull();
  });

  it('rejects a non-POST method', async () => {
    const response = await handleVisaRequest(
      new Request('https://worker.test/api/visa/requirements'),
      {},
      json,
    );
    expect(response?.status).toBe(405);
  });

  it('rejects an invalid body with field-level detail', async () => {
    const response = await handleVisaRequest(post({ passportCode: 'X', destinationCode: 'JP' }), {}, json);
    expect(response?.status).toBe(400);
    const body = await response!.json() as { fields: string[] };
    expect(body.fields.length).toBeGreaterThan(0);
  });

  it('answers 200 with an unknown requirement when no provider is configured', async () => {
    const response = await handleVisaRequest(post({ passportCode: 'SA', destinationCode: 'JP' }), {}, json);
    expect(response?.status).toBe(200);
    const body = await response!.json() as { requirement: { category: string; provider: string }; providerConfigured: boolean };
    expect(body.requirement.category).toBe('unknown');
    expect(body.providerConfigured).toBe(false);
  });

  it('never echoes back anything beyond passport country and destination', async () => {
    const response = await handleVisaRequest(
      post({ passportCode: 'SA', destinationCode: 'JP', passportNumber: 'X1234567', email: 'a@b.c' }),
      {},
      json,
    );
    const text = await response!.text();
    expect(text).not.toContain('X1234567');
    expect(text).not.toContain('a@b.c');
  });
});
