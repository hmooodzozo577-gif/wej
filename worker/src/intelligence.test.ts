import { describe, expect, it } from 'vitest';
import { handleIntelligenceRequest, lookupSuitabilityDetail } from './intelligence';

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function get(path: string) {
  return new Request(`https://worker.test${path}`, { method: 'GET' });
}

describe('handleIntelligenceRequest', () => {
  it('returns null (not this route) for an unrelated path', async () => {
    expect(await handleIntelligenceRequest(new Request('https://worker.test/api/other'), json)).toBeNull();
  });

  it('rejects a non-GET method with 405', async () => {
    const response = await handleIntelligenceRequest(
      new Request('https://worker.test/api/intelligence/SA/tourism', { method: 'POST' }),
      json,
    );
    expect(response!.status).toBe(405);
  });

  it('rejects a malformed country code with 400', async () => {
    const response = await handleIntelligenceRequest(get('/api/intelligence/saudi/tourism'), json);
    expect(response!.status).toBe(400);
  });

  it('rejects an unknown purpose with 400', async () => {
    const response = await handleIntelligenceRequest(get('/api/intelligence/SA/skydiving'), json);
    expect(response!.status).toBe(400);
  });

  it('never returns data for the excluded country (IL), even if it were somehow in the dataset', async () => {
    const response = await handleIntelligenceRequest(get('/api/intelligence/IL/tourism'), json);
    expect(response!.status).toBe(404);
  });

  it('returns 404 for a well-formed but unknown country code', async () => {
    const response = await handleIntelligenceRequest(get('/api/intelligence/ZZ/tourism'), json);
    expect(response!.status).toBe(404);
  });

  it('accepts a lowercase country code and normalizes it', async () => {
    const response = await handleIntelligenceRequest(get('/api/intelligence/sa/tourism'), json);
    expect(response!.status).toBe(200);
    const body = await response!.json() as { countryCode: string };
    expect(body.countryCode).toBe('SA');
  });

  it('returns full component detail, with sources resolved to their real source records', async () => {
    const response = await handleIntelligenceRequest(get('/api/intelligence/SA/tourism'), json);
    expect(response!.status).toBe(200);
    const body = await response!.json() as {
      purpose: string;
      modelVersion: string;
      components: { factor: string; sourceId: string }[];
      sources: Record<string, { name: string; url: string; license: string }>;
    };
    expect(body.purpose).toBe('tourism');
    expect(body.modelVersion).toMatch(/^tourism-v\d+$/);
    expect(body.components.length).toBeGreaterThan(0);
    for (const component of body.components) {
      const source = body.sources[component.sourceId];
      if (!source) throw new Error(`missing source record for ${component.sourceId}`);
      expect(source.name).toBeTruthy();
      expect(source.url).toMatch(/^https:\/\//);
      expect(source.license).toBeTruthy();
    }
  });

  it('matches lookupSuitabilityDetail() directly (same underlying data)', () => {
    const detail = lookupSuitabilityDetail('SA', 'tourism');
    expect(detail).not.toBeNull();
    expect(detail!.countryCode).toBe('SA');
  });

  it('returns null from lookupSuitabilityDetail() for an unknown combination', () => {
    expect(lookupSuitabilityDetail('ZZ', 'tourism')).toBeNull();
    expect(lookupSuitabilityDetail('SA', 'skydiving')).toBeNull();
  });
});
