// Phase 1 tooling smoke test only — proves the Vitest + jsdom + Testing
// Library wiring works. Not a migrated test; the engine's real tests
// (verifying scoreDestination/rankDestinations/buildWhyText against the
// original implementation) are added in Phase 3.
import { describe, expect, it } from 'vitest'

describe('vitest wiring', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
