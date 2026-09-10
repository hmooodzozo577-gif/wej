import { describe, expect, it } from 'vitest';
import { resolveAiProvider } from './provider';
import type { Env } from './types';

describe('resolveAiProvider — AI PROVIDER STATUS: no vendor selected', () => {
  it('returns null when no AI_API_KEY is configured (this repository\'s actual current state)', () => {
    expect(resolveAiProvider({} as Env)).toBeNull();
  });

  it('returns null when only AI_PROVIDER is set but no key (never treats a bare provider name as configured)', () => {
    expect(resolveAiProvider({ AI_PROVIDER: 'anthropic' } as Env)).toBeNull();
  });

  it('returns null when only a key is set but no provider name', () => {
    expect(resolveAiProvider({ AI_API_KEY: 'sk-test' } as Env)).toBeNull();
  });

  it('REGRESSION: a provider name with no registered adapter is treated as unconfigured, never a crash or a silent fabricated fallback', () => {
    expect(resolveAiProvider({ AI_PROVIDER: 'some-unregistered-vendor', AI_API_KEY: 'sk-test' } as Env)).toBeNull();
  });
});
