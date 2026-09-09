// Phase 13.4a — flightEstimate.ts tests. Verifies: (1) distance is
// computed via the REAL haversineKm from data/geo.ts (no reimplemented
// formula — cross-checked directly against that function's own output),
// (2) the duration formula is deterministic and matches the documented
// cruise-speed-plus-fixed-overhead calculation exactly, and (3) the
// required edge cases (same origin/destination, short-haul, long-haul,
// cross-hemisphere).
import { describe, expect, it } from 'vitest';
import { haversineKm, type Coords } from '../data/geo';
import {
  CRUISE_SPEED_KMH,
  FIXED_OVERHEAD_MINUTES,
  estimateDistanceKm,
  estimateDurationMinutes,
  estimateFlight,
} from './flightEstimate';

const RUH: Coords = { lat: 24.7136, lng: 46.6753 }; // Riyadh, Saudi Arabia
const JED: Coords = { lat: 21.4858, lng: 39.1925 }; // Jeddah, Saudi Arabia (short-haul from RUH)
const JFK: Coords = { lat: 40.6413, lng: -73.7781 }; // New York, USA (long-haul from RUH)
const SYD: Coords = { lat: -33.8688, lng: 151.2093 }; // Sydney, Australia (cross-hemisphere from RUH)

describe('Phase 13.4a — estimateDistanceKm reuses haversineKm (no duplicated algorithm)', () => {
  it('matches haversineKm exactly (rounded to 1 decimal place), for several real coordinate pairs', () => {
    for (const [a, b] of [
      [RUH, JED],
      [RUH, JFK],
      [RUH, SYD],
    ] as [Coords, Coords][]) {
      const expected = Math.round(haversineKm(a, b) * 10) / 10;
      expect(estimateDistanceKm(a, b)).toBe(expected);
    }
  });

  it('is symmetric, exactly like haversineKm', () => {
    expect(estimateDistanceKm(RUH, JFK)).toBe(estimateDistanceKm(JFK, RUH));
  });

  it('returns 0 for identical origin/destination coordinates', () => {
    expect(estimateDistanceKm(RUH, RUH)).toBe(0);
    expect(estimateDistanceKm(JFK, { ...JFK })).toBe(0);
  });
});

describe('Phase 13.4a — estimateDurationMinutes: deterministic aviation formula', () => {
  it('is exactly distanceKm / CRUISE_SPEED_KMH * 60 + FIXED_OVERHEAD_MINUTES, rounded, for a positive distance', () => {
    const distanceKm = 845.1;
    const expected = Math.round((distanceKm / CRUISE_SPEED_KMH) * 60 + FIXED_OVERHEAD_MINUTES);
    expect(estimateDurationMinutes(distanceKm)).toBe(expected);
  });

  it('zero distance (same origin/destination) returns exactly 0 minutes — no flight, no overhead', () => {
    expect(estimateDurationMinutes(0)).toBe(0);
  });

  it('a negative distance (defensive, not a real input) also returns 0 rather than a nonsensical negative duration', () => {
    expect(estimateDurationMinutes(-5)).toBe(0);
  });

  it('never uses Math.random or any other source of non-determinism: repeated calls with the same input are always identical', () => {
    const results = new Set<number>();
    for (let i = 0; i < 20; i++) results.add(estimateDurationMinutes(1234.5));
    expect(results.size).toBe(1);
  });

  it('duration increases monotonically with distance', () => {
    expect(estimateDurationMinutes(100)).toBeLessThan(estimateDurationMinutes(1000));
    expect(estimateDurationMinutes(1000)).toBeLessThan(estimateDurationMinutes(10000));
  });
});

describe('Phase 13.4a — estimateFlight: required edge cases (real coordinates)', () => {
  it('same origin and destination: zero distance, zero duration', () => {
    const result = estimateFlight(RUH, RUH);
    expect(result).toEqual({ distanceKm: 0, durationMinutes: 0 });
  });

  it('short-haul flight (Riyadh -> Jeddah, ~845 km): correct distance and duration', () => {
    const result = estimateFlight(RUH, JED);
    expect(result.distanceKm).toBe(845.1);
    expect(result.durationMinutes).toBe(93); // 845.1/800*60 + 30 = 93.38 -> 93
  });

  it('long-haul flight (Riyadh -> New York, ~10,499 km): correct distance and duration', () => {
    const result = estimateFlight(RUH, JFK);
    expect(result.distanceKm).toBe(10499.0);
    expect(result.durationMinutes).toBe(817); // 10499/800*60 + 30 = 817.43 -> 817
  });

  it('cross-hemisphere flight (Riyadh, N -> Sydney, S; ~12,785 km): correct distance and duration', () => {
    const result = estimateFlight(RUH, SYD);
    expect(result.distanceKm).toBe(12785.0);
    expect(result.durationMinutes).toBe(989); // 12785/800*60 + 30 = 988.88 -> 989
  });

  it('is deterministic: repeated calls for the same pair return the exact same estimate', () => {
    const first = estimateFlight(RUH, JFK);
    const second = estimateFlight(RUH, JFK);
    expect(first).toEqual(second);
  });

  it('is not hardcoded to one pair — distinct coordinate pairs produce distinct estimates', () => {
    const shortHaul = estimateFlight(RUH, JED);
    const longHaul = estimateFlight(RUH, JFK);
    expect(shortHaul.distanceKm).not.toBe(longHaul.distanceKm);
    expect(shortHaul.durationMinutes).toBeLessThan(longHaul.durationMinutes);
  });
});

describe('Phase 13.4a — travelService re-exports the estimate functions', () => {
  it('estimateFlight/estimateDistanceKm/estimateDurationMinutes are available from travelService.ts too', async () => {
    const mod = await import('./travelService');
    expect(mod.estimateFlight(RUH, JED)).toEqual(estimateFlight(RUH, JED));
    expect(mod.estimateDistanceKm(RUH, JED)).toBe(estimateDistanceKm(RUH, JED));
    expect(mod.estimateDurationMinutes(100)).toBe(estimateDurationMinutes(100));
  });
});
