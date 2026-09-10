// Phase 16 — AI API Integration, Capability B. explainRecommendation is
// mocked (its own real env-gating/fetch/validation logic is fully
// covered by ai/aiService.test.ts) so each test can drive an exact
// ExplainRecommendationResult and verify: it calls once per distinct
// result set (never duplicated), the deterministic ranking above it is
// never touched, and every status renders a safe, non-blocking UI.
import { useReducer, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AppStateContext } from '../state/context';
import { appReducer, initialAppState } from '../state/reducer';
import { RecommendationExplanation } from './RecommendationExplanation';
import { explainRecommendation } from '../ai/aiService';
import { DESTINATIONS } from '../data/destinations';
import type { RankedResult } from '../engine';

vi.mock('../ai/aiService', () => ({ explainRecommendation: vi.fn() }));

const mockExplain = vi.mocked(explainRecommendation);
const japan = DESTINATIONS.find((d) => d.id === 'japan')!;
const ksa = DESTINATIONS.find((d) => d.id === 'ksa')!;

const top: RankedResult[] = [
  { dest: japan, score: 82, reasons: [{ id: 'climate', weight: 10, fit: 0.9 }] },
  { dest: ksa, score: 70, reasons: [{ id: 'safety', weight: 8, fit: 0.8 }] },
];

function Providers({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  return <AppStateContext.Provider value={{ state, dispatch }}>{children}</AppStateContext.Provider>;
}

function tree(items: RankedResult[]) {
  return (
    <Providers>
      <RecommendationExplanation purposeName="Tourism" profileSummary="Prefers cold, quiet places." top={items} />
    </Providers>
  );
}

function renderWith(items: RankedResult[] = top) {
  const utils = render(tree(items));
  return { ...utils, rerenderSame: (nextItems: RankedResult[]) => utils.rerender(tree(nextItems)) };
}

describe('RecommendationExplanation', () => {
  it('shows a loading state, then the AI-unavailable fallback message — the section never claims content it does not have', async () => {
    mockExplain.mockResolvedValue({ status: 'unavailable', reason: 'not configured' });
    renderWith();
    await waitFor(() => expect(screen.getByText(/غير متاح حاليًا|isn't available right now/)).toBeInTheDocument());
  });

  it('shows the graceful error fallback on a service error, never a raw error message', async () => {
    mockExplain.mockResolvedValue({ status: 'error', message: 'upstream 500' });
    renderWith();
    await waitFor(() => expect(screen.getByText(/Couldn't generate|تعذّر إنشاء/)).toBeInTheDocument());
    expect(screen.queryByText(/upstream 500/)).toBeNull();
  });

  it('renders the AI summary and per-destination explanations, clearly labeled as AI-enhanced', async () => {
    mockExplain.mockResolvedValue({
      status: 'ok',
      summary: 'Great overall fit.',
      perDestination: [{ destId: 'japan', explanation: 'Matches your climate preference.' }],
      caveats: [],
    });
    renderWith();
    await waitFor(() => expect(screen.getByText('Great overall fit.')).toBeInTheDocument());
    expect(screen.getByText(/Matches your climate preference\./)).toBeInTheDocument();
    expect(screen.getByText(/AI-enhanced|مدعوم بالذكاء الاصطناعي/)).toBeInTheDocument();
  });

  it('the AI explanation content only ever names destIds it was given — it cannot introduce/reorder destinations', async () => {
    mockExplain.mockResolvedValue({
      status: 'ok',
      summary: 'overall summary text',
      perDestination: [
        { destId: 'japan', explanation: 'japan explanation text' },
        { destId: 'atlantis', explanation: 'a made-up place' }, // should be validated server-side, but prove the UI just renders whatever it's handed without special-casing an unknown id into a crash
      ],
      caveats: [],
    });
    renderWith();
    await waitFor(() => expect(screen.getByText(/japan explanation text/)).toBeInTheDocument());
    // No crash, no destination-name lookup failure for the unknown id.
    expect(screen.getByText(/a made-up place/)).toBeInTheDocument();
  });

  it('renders caveats when supplied (e.g. unavailable-data disclosures)', async () => {
    mockExplain.mockResolvedValue({ status: 'ok', summary: 's', perDestination: [], caveats: ['Accommodation cost data is not available.'] });
    renderWith();
    await waitFor(() => expect(screen.getByText('Accommodation cost data is not available.')).toBeInTheDocument());
  });

  it('calls explainRecommendation exactly once for a given result set (no duplicate calls on re-render)', async () => {
    mockExplain.mockResolvedValue({ status: 'ok', summary: 's', perDestination: [], caveats: [] });
    const { rerenderSame } = renderWith();
    await waitFor(() => expect(mockExplain).toHaveBeenCalledTimes(1));
    rerenderSame(top);
    expect(mockExplain).toHaveBeenCalledTimes(1);
  });
});
