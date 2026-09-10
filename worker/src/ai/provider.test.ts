import { describe, expect, it, vi } from 'vitest';
import type { Ai } from '@cloudflare/workers-types';
import { resolveAiProvider } from './provider';
import type { Env } from './types';

describe('resolveAiProvider — AI PROVIDER STATUS: Cloudflare Workers AI selected, native binding', () => {
  it('returns a real provider (not null) when env.AI (the Workers AI binding) is present', () => {
    const fakeAiBinding = { run: vi.fn() } as unknown as Ai;
    const provider = resolveAiProvider({ AI: fakeAiBinding } as Env);
    expect(provider).not.toBeNull();
    expect(typeof provider?.interpretPreferences).toBe('function');
    expect(typeof provider?.explainRecommendation).toBe('function');
  });

  it('env.AI takes priority over a stray legacy AI_PROVIDER/AI_API_KEY pair, never picks the unregistered legacy path when a real binding exists', () => {
    const fakeAiBinding = { run: vi.fn() } as unknown as Ai;
    const provider = resolveAiProvider({ AI: fakeAiBinding, AI_PROVIDER: 'some-unregistered-vendor', AI_API_KEY: 'sk-test' } as Env);
    expect(provider).not.toBeNull();
  });
});

describe('resolveAiProvider — no env.AI binding present (this repository\'s real undeployed state)', () => {
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
