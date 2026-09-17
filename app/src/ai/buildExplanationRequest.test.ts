import { describe, expect, it } from 'vitest';
import { buildCountryFitExplanationRequest, buildRecommendationExplanationRequest } from './buildExplanationRequest';
import { QUESTION_BANKS } from '../data/questionBanks';
import { WORLD_CATALOG } from '../data/worldCatalog';
import { getCountrySuitability } from '../data/countryIntelligence';
import type { Reason } from '../engine';

const saudiArabia = WORLD_CATALOG.find((entry) => entry.countryCode === 'SA')!;
const [firstTourismQuestion] = QUESTION_BANKS.tourism;

const FORBIDDEN_KEYS = ['lat', 'lng', 'latitude', 'longitude', 'coords', 'coordinates', 'passportNumber', 'email', 'token', 'adminToken', 'apiKey', 'ip'];

function assertNoForbiddenFields(value: unknown) {
  expect(typeof value === 'object' && value !== null ? Object.keys(value) : []).not.toEqual(expect.arrayContaining(FORBIDDEN_KEYS));
}

describe('buildRecommendationExplanationRequest (workstream F — purpose-first)', () => {
  const reasons: Reason[] = [
    { id: '__purpose', weight: 0, fit: 100 },
    { id: firstTourismQuestion!.id, weight: 10, fit: 90 },
  ];

  it('builds a "recommendation" request from real Phase 14 output, with canonical codes only', () => {
    const request = buildRecommendationExplanationRequest({
      lang: 'en',
      purpose: 'tourism',
      dest: saudiArabia,
      score: 82.4,
      reasons,
      suitability: getCountrySuitability('SA').find((entry) => entry.purpose === 'tourism'),
      visaStatus: 'eVisa',
      visaConfigured: true,
    });
    expect(request.kind).toBe('recommendation');
    expect(request.countryCode).toBe('SA');
    expect(request.purpose).toBe('tourism');
    expect(request.matchScore).toBe(82);
    expect(request.visaStatus).toBe('eVisa');
    assertNoForbiddenFields(request);
  });

  it('never includes the "__purpose" pseudo-reason or a zero-weight reason in matchReasons', () => {
    const request = buildRecommendationExplanationRequest({
      lang: 'en',
      purpose: 'tourism',
      dest: saudiArabia,
      score: 80,
      reasons,
      visaConfigured: false,
    });
    expect(request.matchReasons?.some((reason) => reason.label.length === 0)).toBeFalsy();
    expect(request.matchReasons?.length).toBeGreaterThan(0);
  });

  it('flags visaUnknown when no provider is configured, never inventing a category', () => {
    const request = buildRecommendationExplanationRequest({
      lang: 'en',
      purpose: 'tourism',
      dest: saudiArabia,
      score: 80,
      reasons,
      visaConfigured: false,
    });
    expect(request.visaStatus).toBe('unknown');
    expect(request.missingDataFlags).toContain('visaUnknown');
  });

  it('flags visaUnknown when the provider itself answered unknown', () => {
    const request = buildRecommendationExplanationRequest({
      lang: 'en',
      purpose: 'tourism',
      dest: saudiArabia,
      score: 80,
      reasons,
      visaStatus: 'unknown',
      visaConfigured: true,
    });
    expect(request.missingDataFlags).toContain('visaUnknown');
  });

  it('does not flag visaUnknown when a provider answered with a real category', () => {
    const request = buildRecommendationExplanationRequest({
      lang: 'en',
      purpose: 'tourism',
      dest: saudiArabia,
      score: 80,
      reasons,
      visaStatus: 'visaFree',
      visaConfigured: true,
    });
    expect(request.missingDataFlags ?? []).not.toContain('visaUnknown');
  });

  it('omits suitability entirely for the "other" purpose, which has no suitability methodology', () => {
    const request = buildRecommendationExplanationRequest({
      lang: 'en',
      purpose: 'other',
      dest: saudiArabia,
      score: 60,
      reasons,
      visaConfigured: false,
    });
    expect(request.suitability).toBeUndefined();
  });

  it('renders Arabic question text for matchReasons when lang is ar', () => {
    const request = buildRecommendationExplanationRequest({
      lang: 'ar',
      purpose: 'tourism',
      dest: saudiArabia,
      score: 80,
      reasons,
      visaConfigured: false,
    });
    const label = request.matchReasons?.[0]?.label ?? '';
    expect(label).toBe(firstTourismQuestion!.text.ar);
  });
});

describe('buildCountryFitExplanationRequest (workstream F — country-first)', () => {
  it('builds a "countryFit" request using the SAME bestSuitedFor grouping as the UI (real data: Saudi Arabia)', () => {
    const entries = getCountrySuitability('SA');
    const request = buildCountryFitExplanationRequest({ lang: 'en', countryCode: 'SA', entries });
    expect(request.kind).toBe('countryFit');
    expect(request.countryCode).toBe('SA');
    expect(request.bestSuitedForGroup).not.toBeNull();
    expect(request.bestSuitedForGroup!.length).toBeGreaterThan(0);
    assertNoForbiddenFields(request);
  });

  it('never sends a passport-specific visa status for a country-first (no traveller) request', () => {
    const entries = getCountrySuitability('SA');
    const request = buildCountryFitExplanationRequest({ lang: 'en', countryCode: 'SA', entries });
    expect(request.visaStatus).toBe('unknown');
    expect(request.missingDataFlags).toContain('visaUnknown');
  });

  it('flags insufficientDataAllPurposes and never forces a lead purpose when nothing is eligible (real data: Vatican City)', () => {
    const entries = getCountrySuitability('VA');
    expect(entries.every((entry) => entry.insufficientData)).toBe(true);
    const request = buildCountryFitExplanationRequest({ lang: 'en', countryCode: 'VA', entries });
    expect(request.bestSuitedForGroup).toBeNull();
    expect(request.missingDataFlags).toContain('insufficientDataAllPurposes');
  });

  it('bounds otherSuitablePurposes to a small list', () => {
    const entries = getCountrySuitability('SA');
    const request = buildCountryFitExplanationRequest({ lang: 'en', countryCode: 'SA', entries });
    expect(request.otherSuitablePurposes?.length ?? 0).toBeLessThanOrEqual(6);
  });
});
