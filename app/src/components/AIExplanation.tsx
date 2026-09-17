// Phase 16 workstream E.6 — the on-demand AI explanation panel. Additive
// only: it never replaces buildWhyText/bestSuitedFor/the suitability list,
// it does not fetch until the traveller explicitly asks for it (E.9), and
// it disappears cleanly (no button at all) when no provider is configured
// or the status check fails — the deterministic content around it is
// completely unaffected either way (E.1).
import { useEffect, useState } from 'react';
import { useI18n } from '../state/hooks';
import { checkAIStatus, requestAIExplanation } from '../ai/aiExplanationClient';
import type { AIExplanationOutput, AIExplanationRequest } from '../ai/types';

type PanelState = 'checking' | 'hidden' | 'idle' | 'loading' | 'ready' | 'failed';

export function AIExplanation({ request, buttonLabel }: { request: AIExplanationRequest; buttonLabel?: string }) {
  const { t } = useI18n();
  const ai = t.ai;
  const [state, setState] = useState<PanelState>('checking');
  const [output, setOutput] = useState<AIExplanationOutput | null>(null);

  useEffect(() => {
    let cancelled = false;
    void checkAIStatus().then((available) => {
      if (!cancelled) setState(available ? 'idle' : 'hidden');
    });
    return () => {
      cancelled = true;
    };
    // Checked once per mount, not on every prop change — this is a
    // provider-configuration check, not a per-destination lookup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state === 'checking' || state === 'hidden') return null;

  const handleClick = () => {
    setState('loading');
    void requestAIExplanation(request).then((result) => {
      if (result.available) {
        setOutput(result.explanation);
        setState('ready');
      } else {
        setState('failed');
      }
    });
  };

  return (
    <div className="ai-explanation">
      {state === 'idle' ? (
        <button type="button" className="ai-explanation-button" onClick={handleClick}>
          <span className="ai-badge" aria-hidden="true">{ai.badge}</span> {buttonLabel ?? ai.explainButton}
        </button>
      ) : null}
      {state === 'loading' ? (
        <p className="ai-explanation-loading" aria-live="polite">
          <span className="quiz-spinner" aria-hidden="true" /> {ai.loading}
        </p>
      ) : null}
      {state === 'failed' ? <p className="ai-explanation-unavailable">{ai.unavailable}</p> : null}
      {state === 'ready' && output ? (
        <div className="ai-explanation-body">
          <span className="ai-badge" aria-hidden="true">{ai.badge}</span>
          <p className="ai-explanation-summary">{output.summary}</p>
          {output.whyItFits.length > 0 ? (
            <div className="ai-explanation-group">
              <strong>{ai.whyItFitsLabel}</strong>
              <ul>{output.whyItFits.map((clause, index) => <li key={index}>{clause}</li>)}</ul>
            </div>
          ) : null}
          {output.tradeoffs.length > 0 ? (
            <div className="ai-explanation-group">
              <strong>{ai.tradeoffsLabel}</strong>
              <ul>{output.tradeoffs.map((clause, index) => <li key={index}>{clause}</li>)}</ul>
            </div>
          ) : null}
          {output.confidenceNotes ? (
            <p className="ai-explanation-confidence"><strong>{ai.confidenceNotesLabel}:</strong> {output.confidenceNotes}</p>
          ) : null}
          {output.missingDataNotes.length > 0 ? (
            <div className="ai-explanation-group">
              <strong>{ai.missingDataLabel}</strong>
              <ul>{output.missingDataNotes.map((clause, index) => <li key={index}>{clause}</li>)}</ul>
            </div>
          ) : null}
          <p className="ai-explanation-disclaimer">{ai.disclaimer}</p>
        </div>
      ) : null}
    </div>
  );
}
