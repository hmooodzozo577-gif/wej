import countryIntelligence from '../data/generated/countryIntelligence.json';
import destinationImages from '../data/generated/destinationImages.json';
import type { CatalogEntry } from '../data/types';
import { WORLD_CATALOG } from '../data/worldCatalog';

const SESSION_KEY = 'wejhaty.hero.current.v1';
const HISTORY_KEY = 'wejhaty.hero.recent.v1';
const HISTORY_LIMIT = 4;

// These thresholds describe the evidence needed for a country to carry the
// first viewport. They are intentionally data rules, not a hand-written list:
// a high-confidence tourism model (built from the project's sourced public
// indicators), a complete editorial destination profile, and a local
// landscape image large enough for the responsive crop.
const MIN_TOURISM_SCORE = 60;
const MIN_COVERAGE = 80;
const MIN_IMAGE_WIDTH = 1200;
const MIN_LANDSCAPE_RATIO = 1.35;

interface HeroStorage { session: Storage; local: Storage }

function safeRead(storage: Storage, key: string): string | null {
  try { return storage.getItem(key); } catch { return null; }
}

function safeWrite(storage: Storage, key: string, value: string) {
  try { storage.setItem(key, value); } catch { /* Storage is optional. */ }
}

function recentCodes(storage: Storage): string[] {
  try {
    const value = JSON.parse(safeRead(storage, HISTORY_KEY) ?? '[]');
    return Array.isArray(value)
      ? value.filter((code): code is string => typeof code === 'string').slice(0, HISTORY_LIMIT)
      : [];
  } catch {
    return [];
  }
}

function secureIndex(length: number): number {
  if (length <= 1) return 0;
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0]! % length;
}

export function buildHeroPool(): CatalogEntry[] {
  const catalog = new Map(WORLD_CATALOG.map((destination) => [destination.countryCode, destination]));
  const imageCodes = new Set(
    destinationImages
      .filter((image) => image.width >= MIN_IMAGE_WIDTH && image.width / image.height >= MIN_LANDSCAPE_RATIO)
      .map((image) => image.iso2),
  );
  return countryIntelligence.entries
    .filter((entry) =>
      entry.purpose === 'tourism'
      && entry.insufficientData === false
      && entry.confidence === 'high'
      && entry.coverage >= MIN_COVERAGE
      && entry.score !== null
      && entry.score >= MIN_TOURISM_SCORE
      && entry.countryCode !== 'IL'
      && imageCodes.has(entry.countryCode)
      && catalog.get(entry.countryCode)?.recommendationReady === true,
    )
    .map((entry) => catalog.get(entry.countryCode)!)
    .sort((a, b) => a.countryCode.localeCompare(b.countryCode));
}

/** Select once per browser session and keep a short cross-session history.
 *  The stored code is accepted only if it still belongs to today's eligible
 *  pool, so stale or manipulated storage cannot bypass catalog exclusions. */
export function selectSessionHero(
  pool: CatalogEntry[],
  storage: HeroStorage = { session: sessionStorage, local: localStorage },
  pickIndex: (length: number) => number = secureIndex,
): CatalogEntry {
  if (!pool.length) throw new Error('The Home hero has no eligible destination.');
  const byCode = new Map(pool.map((destination) => [destination.countryCode, destination]));
  const remembered = safeRead(storage.session, SESSION_KEY);
  if (remembered && byCode.has(remembered)) return byCode.get(remembered)!;

  const recent = recentCodes(storage.local);
  const recentSet = new Set(recent);
  const available = pool.filter((destination) => !recentSet.has(destination.countryCode));
  const candidates = available.length ? available : pool;
  const selected = candidates[Math.abs(pickIndex(candidates.length)) % candidates.length]!;

  safeWrite(storage.session, SESSION_KEY, selected.countryCode);
  safeWrite(
    storage.local,
    HISTORY_KEY,
    JSON.stringify([selected.countryCode, ...recent.filter((code) => code !== selected.countryCode)].slice(0, HISTORY_LIMIT)),
  );
  return selected;
}

export const HERO_DESTINATION_POOL = buildHeroPool();
