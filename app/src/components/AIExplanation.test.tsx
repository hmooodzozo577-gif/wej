// Phase 16 workstream E.6 — the on-demand AI explanation panel. The client
// module is mocked here (its own network/fallback behaviour is covered by
// aiExplanationClient.test.ts); this file only proves the PANEL renders the
// right state for each outcome and never fetches until clicked.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useReducer, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppStateContext } from '../state/context';
import { appReducer, initialAppState } from '../state/reducer';
import { AIExplanation } from './AIExplanation';
import type { AIExplanationRequest } from '../ai/types';
import * as client from '../ai/aiExplanationClient';

const sampleRequest: AIExplanationRequest = {
  kind: 'recommendation',
  lang: 'en',
  countryCode: 'JP',
  purpose: 'tourism',
  matchScore: 82,
};

function renderWith(lang: 'ar' | 'en' = 'en') {
  function Providers({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(appReducer, { ...initialAppState, lang });
    return <AppStateContext.Provider value={{ state, dispatch }}>{children}</AppStateContext.Provider>;
  }
  return render(
    <Providers>
      <AIExplanation request={sampleRequest} />
    </Providers>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AIExplanation panel', () => {
  it('renders nothing while the availability check is pending, and nothing when unavailable', async () => {
    vi.spyOn(client, 'checkAIStatus').mockResolvedValue(false);
    const { container } = renderWith();
    expect(container).toBeEmptyDOMElement();
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('shows the "explain with AI" button once a provider is confirmed configured', async () => {
    vi.spyOn(client, 'checkAIStatus').mockResolvedValue(true);
    renderWith();
    await waitFor(() => expect(screen.getByText('Explain this fit with AI')).toBeInTheDocument());
  });

  it('does not call requestAIExplanation until the traveller clicks the button (E.9)', async () => {
    vi.spyOn(client, 'checkAIStatus').mockResolvedValue(true);
    const explainSpy = vi.spyOn(client, 'requestAIExplanation');
    renderWith();
    await waitFor(() => expect(screen.getByText('Explain this fit with AI')).toBeInTheDocument());
    expect(explainSpy).not.toHaveBeenCalled();
  });

  it('shows a loading state, then the structured explanation, clearly marked as AI-generated', async () => {
    vi.spyOn(client, 'checkAIStatus').mockResolvedValue(true);
    vi.spyOn(client, 'requestAIExplanation').mockResolvedValue({
      available: true,
      cached: false,
      modelVersion: 'test-model',
      explanation: {
        summary: 'A strong match for a beach-focused holiday.',
        whyItFits: ['warm, mild climate'],
        tradeoffs: ['a bit farther than you wanted'],
        confidenceNotes: 'High confidence, well covered by data.',
        missingDataNotes: ['Visa information has not been verified yet.'],
      },
    });
    renderWith();
    const button = await screen.findByText('Explain this fit with AI');
    fireEvent.click(button);

    expect(document.querySelector('.ai-explanation-loading')).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('A strong match for a beach-focused holiday.')).toBeInTheDocument());
    expect(screen.getByText('warm, mild climate')).toBeInTheDocument();
    expect(screen.getByText('a bit farther than you wanted')).toBeInTheDocument();
    expect(screen.getByText('Visa information has not been verified yet.')).toBeInTheDocument();
    // The disclaimer and badge are what keep this visually distinct from a
    // hard fact elsewhere on the page (E.6).
    expect(document.querySelector('.ai-explanation-disclaimer')).toBeInTheDocument();
    expect(document.querySelectorAll('.ai-badge').length).toBeGreaterThan(0);
  });

  it('shows an honest unavailable message on failure, never a broken or blank state', async () => {
    vi.spyOn(client, 'checkAIStatus').mockResolvedValue(true);
    vi.spyOn(client, 'requestAIExplanation').mockResolvedValue({ available: false, reason: 'provider_timeout' });
    renderWith();
    const button = await screen.findByText('Explain this fit with AI');
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByText(/not available right now/)).toBeInTheDocument());
  });

  it('renders in Arabic', async () => {
    vi.spyOn(client, 'checkAIStatus').mockResolvedValue(true);
    render(
      (() => {
        function Providers({ children }: { children: ReactNode }) {
          const [state, dispatch] = useReducer(appReducer, { ...initialAppState, lang: 'ar' as const });
          return <AppStateContext.Provider value={{ state, dispatch }}>{children}</AppStateContext.Provider>;
        }
        return (
          <Providers>
            <AIExplanation request={{ ...sampleRequest, lang: 'ar' }} />
          </Providers>
        );
      })(),
    );
    await waitFor(() => expect(screen.getByText('اشرح لي هذا التوافق بالذكاء الاصطناعي')).toBeInTheDocument());
  });

  it('uses a custom button label when provided (country-first surface)', async () => {
    vi.spyOn(client, 'checkAIStatus').mockResolvedValue(true);
    function Providers({ children }: { children: ReactNode }) {
      const [state, dispatch] = useReducer(appReducer, { ...initialAppState, lang: 'en' as const });
      return <AppStateContext.Provider value={{ state, dispatch }}>{children}</AppStateContext.Provider>;
    }
    render(
      <Providers>
        <AIExplanation request={sampleRequest} buttonLabel="Summarize with AI" />
      </Providers>,
    );
    await waitFor(() => expect(screen.getByText('Summarize with AI')).toBeInTheDocument());
  });
});
