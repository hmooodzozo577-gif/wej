import { beforeEach, describe, expect, it } from 'vitest';
import destinationImages from '../data/generated/destinationImages.json';
import { buildHeroPool, selectHeroOrbitDestinations, selectSessionHero } from './heroDestination';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe('the data-backed Home hero destination', () => {
  let session: Storage;
  let local: Storage;

  beforeEach(() => {
    session = new MemoryStorage();
    local = new MemoryStorage();
  });

  it('builds a broad eligible pool from tourism confidence, coverage, and landscape image evidence', () => {
    const pool = buildHeroPool();
    const images = new Map(destinationImages.map((image) => [image.iso2, image]));

    expect(pool.length).toBeGreaterThanOrEqual(20);
    expect(pool.length).toBeLessThanOrEqual(40);
    expect(pool.some((destination) => destination.countryCode === 'IL')).toBe(false);
    for (const destination of pool) {
      const image = images.get(destination.countryCode)!;
      expect(image).toBeDefined();
      expect(image.width).toBeGreaterThanOrEqual(1200);
      expect(image.width / image.height).toBeGreaterThanOrEqual(1.35);
    }
  });

  it('stays stable for navigation, language, theme, and rerenders inside one session', () => {
    const pool = buildHeroPool();
    const first = selectSessionHero(pool, { session, local }, () => 0);
    const second = selectSessionHero(pool, { session, local }, () => pool.length - 1);
    expect(second.countryCode).toBe(first.countryCode);
  });

  it('avoids the recent cross-session history while alternatives remain', () => {
    const pool = buildHeroPool();
    const first = selectSessionHero(pool, { session, local }, () => 0);
    session.clear();
    const second = selectSessionHero(pool, { session, local }, () => 0);
    expect(second.countryCode).not.toBe(first.countryCode);
  });

  it('never lets malformed stored values escape the effective catalog', () => {
    const pool = buildHeroPool();
    session.setItem('wejhaty.hero.current.v1', 'IL');
    local.setItem('wejhaty.hero.recent.v1', '{broken json');
    const selected = selectSessionHero(pool, { session, local }, () => 0);
    expect(pool).toContain(selected);
    expect(selected.countryCode).not.toBe('IL');
  });

  it('builds four unique compass destinations from the eligible pool and excludes the featured destination', () => {
    const pool = buildHeroPool();
    const featured = pool[0]!;
    const orbit = selectHeroOrbitDestinations(pool, featured, { session, local }, 4, () => 0);

    expect(orbit).toHaveLength(4);
    expect(new Set(orbit.map((destination) => destination.countryCode))).toHaveLength(4);
    expect(orbit.some((destination) => destination.countryCode === featured.countryCode)).toBe(false);
    expect(orbit.every((destination) => pool.includes(destination))).toBe(true);
  });

  it('keeps compass destinations stable in-session and avoids the previous orbit on a new session', () => {
    const pool = buildHeroPool();
    const featured = pool[0]!;
    const first = selectHeroOrbitDestinations(pool, featured, { session, local }, 4, () => 0);
    const stable = selectHeroOrbitDestinations(pool, featured, { session, local }, 4, (length) => length - 1);
    expect(stable.map((destination) => destination.countryCode)).toEqual(first.map((destination) => destination.countryCode));

    session.clear();
    const next = selectHeroOrbitDestinations(pool, featured, { session, local }, 4, () => 0);
    expect(next.every((destination) => !first.includes(destination))).toBe(true);
  });

  it('rejects duplicate or invalid remembered compass destinations', () => {
    const pool = buildHeroPool();
    const featured = pool[0]!;
    session.setItem('wejhaty.hero.orbit.current.v1', JSON.stringify({
      featured: featured.countryCode,
      codes: [pool[1]!.countryCode, pool[1]!.countryCode, 'XX', featured.countryCode],
    }));

    const selected = selectHeroOrbitDestinations(pool, featured, { session, local }, 4, () => 0);
    expect(selected).toHaveLength(4);
    expect(new Set(selected.map((destination) => destination.countryCode))).toHaveLength(4);
    expect(selected.some((destination) => destination.countryCode === featured.countryCode)).toBe(false);
  });
});
