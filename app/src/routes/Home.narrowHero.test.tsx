// Structural guard for the narrow Home Hero composition (Phase 18
// acceptance). jsdom cannot evaluate container queries, so this reads the
// shipped stylesheet for the narrow block's key decisions and checks the
// markup the block relies on; the Playwright audit is the visual proof.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import fs from 'node:fs';
import path from 'node:path';
import { AppStateProvider } from '../state/AppStateContext';
import { PersonalizationProvider } from '../personalization/PersonalizationProvider';
import { PERSONALIZATION_STORAGE_KEY, type StorageLike } from '../personalization/storage';
import { createProfile } from '../personalization/profile';
import { Home } from './Home';

const css = fs.readFileSync(path.join(import.meta.dirname, '..', 'styles', 'wejhaty.css'), 'utf8');
const start = css.indexOf('@container hero-stage (max-width: 560px)');
const narrow = css.slice(start, css.indexOf('\n}\n', start));

describe('narrow Home Hero composition', () => {
  it('is its own container-query composition in reading order', () => {
    expect(start).toBeGreaterThan(-1);
    expect(narrow.replace(/\s+/g, ' ')).toContain("'label label' 'title title' 'lead lead' 'cta cta' 'visual stats' 'badge badge'");
  });

  it('sizes the compass drawing to its box, so it can never spill out and be clipped', () => {
    expect(narrow).toMatch(/\.home-hero-compass \.compass-mark \{\s*width: 100%;\s*height: auto;/);
  });

  it('shows two orbit labels, one route and no inner frame at this width', () => {
    expect(narrow).toMatch(/\.hero-orbit-destination\.orbit-2,\s*\.hero-orbit-destination\.orbit-4 \{ display: none; \}/);
    expect(narrow).toContain('.home-hero-stage > .travel-route-home-bottom { display: none; }');
    expect(narrow).toContain('.home-hero-frame::after { display: none; }');
  });

  it('balances the headline instead of shrinking everything', () => {
    expect(narrow).toMatch(/h1 \{[^}]*text-wrap: balance;/);
  });

  it('renders the saved-profile continuation as a text link, not a third button', () => {
    const data: Record<string, string> = {
      [PERSONALIZATION_STORAGE_KEY]: JSON.stringify(createProfile('tourism', { 'tourism-climate': 'cold' }, ['tourism-climate'], new Date('2026-09-23T00:00:00Z'))),
    };
    const storage: StorageLike = { getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; }, removeItem: (k) => { delete data[k]; } };
    const { container } = render(
      <AppStateProvider>
        <PersonalizationProvider storage={storage}>
          <MemoryRouter>
            <Home />
          </MemoryRouter>
        </PersonalizationProvider>
      </AppStateProvider>,
    );
    const link = container.querySelector('.hero-continue-link')!;
    expect(link.tagName).toBe('A');
    expect(link.classList.contains('btn')).toBe(false);
    expect(container.querySelectorAll('.hero-cta-row .btn')).toHaveLength(2);
    // Every orbit label stays in the markup (session-stable, dynamic); the
    // narrow layout only chooses how many to show.
    expect(container.querySelectorAll('.hero-orbit-destination').length).toBe(4);
  });
});
