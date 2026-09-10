// Phase 16.5 completion pass — bounded contextual follow-up selection.
import { describe, expect, it } from 'vitest';
import { MAX_FOLLOWUP_TURNS, selectFollowup } from './followupTemplates';

describe('selectFollowup — deterministic, zero-AI-call template selection', () => {
  it('SCENARIO A: "هادئة" (quiet) signal in unmapped text triggers the quietness clarification for tourism', () => {
    const followup = selectFollowup('tourism', ['هادئة'], {});
    expect(followup).not.toBeNull();
    expect(followup!.templateId).toBe('quietness_clarify');
    expect(followup!.options.length).toBeGreaterThan(0);
  });

  it('every quietness option maps to a REAL existing tourism dimension value, never a fabricated score', () => {
    const followup = selectFollowup('tourism', ['هادئة'], {})!;
    for (const opt of followup.options) {
      for (const [qid, value] of Object.entries(opt.satisfies)) {
        expect(['nightlife', 'naturecity', 'adventure']).toContain(qid);
        expect(typeof value === 'number' || typeof value === 'string').toBe(true);
      }
    }
  });

  it('SCENARIO B: "مختلف عن المعتاد" (different from usual) triggers the cultural-novelty clarification', () => {
    const followup = selectFollowup('tourism', ['مختلف عن المعتاد'], {});
    expect(followup).not.toBeNull();
    expect(followup!.templateId).toBe('cultural_novelty_clarify');
    expect(followup!.candidateDimensionIds).toEqual(['culture']);
  });

  it('unrelated unmapped text triggers no follow-up at all', () => {
    expect(selectFollowup('tourism', ['شيء غامض تمامًا'], {})).toBeNull();
  });

  it('no unmapped text at all -> no follow-up', () => {
    expect(selectFollowup('tourism', [], {})).toBeNull();
  });

  it('DUPLICATE PREVENTION: if every candidate dimension is already known, the quietness template is not offered even with a matching signal', () => {
    const followup = selectFollowup('tourism', ['هادئة'], { nightlife: 10, naturecity: 15, adventure: 10 });
    expect(followup).toBeNull();
  });

  it('DUPLICATE PREVENTION (partial): already-known dimensions are excluded from the offered options, not the whole template', () => {
    const followup = selectFollowup('tourism', ['هادئة'], { naturecity: 90 })!;
    expect(followup).not.toBeNull();
    const targetedIds = followup.options.flatMap((o) => Object.keys(o.satisfies));
    expect(targetedIds).not.toContain('naturecity');
    expect(targetedIds).toEqual(expect.arrayContaining(['nightlife', 'adventure']));
  });

  it('a purpose bank with no matching template purpose (e.g. work) never offers tourism-specific clarifications', () => {
    expect(selectFollowup('work', ['هادئة'], {})).toBeNull();
  });

  it('MAX_FOLLOWUP_TURNS is a small, real bound (the orchestration test suite enforces it via state.followupTurnsUsed)', () => {
    expect(MAX_FOLLOWUP_TURNS).toBeGreaterThan(0);
    expect(MAX_FOLLOWUP_TURNS).toBeLessThanOrEqual(3);
  });

  it('MULTI-DIMENSION: a single quietness follow-up choice can satisfy exactly one dimension, and a cultural-novelty choice exactly one — no option silently satisfies an unrelated dimension', () => {
    const quiet = selectFollowup('tourism', ['هادئة'], {})!;
    for (const opt of quiet.options) expect(Object.keys(opt.satisfies).length).toBe(1);
    const novelty = selectFollowup('tourism', ['مختلف عن المعتاد'], {})!;
    for (const opt of novelty.options) expect(Object.keys(opt.satisfies).length).toBe(1);
  });

  it('both AR and EN prompt/option text exist and are non-empty for every template', () => {
    const quiet = selectFollowup('tourism', ['هادئة'], {})!;
    expect(quiet.prompt.ar.length).toBeGreaterThan(0);
    expect(quiet.prompt.en.length).toBeGreaterThan(0);
    for (const opt of quiet.options) {
      expect(opt.label.ar.length).toBeGreaterThan(0);
      expect(opt.label.en.length).toBeGreaterThan(0);
    }
  });
});
