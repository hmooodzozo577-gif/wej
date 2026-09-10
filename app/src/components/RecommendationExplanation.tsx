// Phase 16 — AI API Integration, Capability B (personalized
// recommendation explanation). Calls the Worker exactly once per
// distinct result set (deduped via requestedKeyRef — never on every
// render, never repeated for the identical results), only after Phase
// 14 has already ranked destinations. Never replaces or blocks the
// deterministic results above it: a loading/unavailable/error state
// here never removes the ranking or reasons already on screen.
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../state/hooks';
import { explainRecommendation } from '../ai/aiService';
import { buildExplainContext } from '../ai/buildExplainContext';
import type { ExplainRecommendationResult } from '../ai/types';
import type { RankedResult } from '../engine';
import { Icon } from './Icon';

export function RecommendationExplanation({
  purposeName,
  profileSummary,
  top,
}: {
  purposeName: string;
  profileSummary: string;
  top: RankedResult[];
}) {
  const { lang, t } = useI18n();
  const ex = t.ai.explain;
  const [result, setResult] = useState<ExplainRecommendationResult | null>(null);
  const requestedKeyRef = useRef<string | null>(null);

  const key = `${lang}|${purposeName}|${top.map((r) => r.dest.id).join(',')}`;

  useEffect(() => {
    if (requestedKeyRef.current === key) return; // dedup: one call per distinct (lang, purpose, result set)
    requestedKeyRef.current = key;
    setResult(null);
    let cancelled = false;
    explainRecommendation(lang, purposeName, profileSummary, buildExplainContext(lang, t, top)).then((res) => {
      if (!cancelled) setResult(res);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` already captures every input that should trigger a re-fetch
  }, [key]);

  return (
    <div className="detail-card ai-explain-card">
      <h3>
        <Icon name="sparkle" size={16} /> {ex.title} <span className="ai-badge">{ex.badge}</span>
      </h3>
      {result === null && <p className="ai-explain-note">{ex.loading}</p>}
      {result?.status === 'unavailable' && <p className="ai-explain-note">{ex.unavailable}</p>}
      {result?.status === 'error' && <p className="ai-explain-note">{ex.error}</p>}
      {result?.status === 'ok' && (
        <div className="ai-explain-content">
          {result.summary && <p>{result.summary}</p>}
          {result.perDestination.map((item) => {
            const dest = top.find((r) => r.dest.id === item.destId);
            const name = dest ? (lang === 'ar' ? dest.dest.nameAr : dest.dest.nameEn) : item.destId;
            return (
              <p key={item.destId}>
                <strong>{name}:</strong> {item.explanation}
              </p>
            );
          })}
          {result.caveats.length > 0 && (
            <ul className="ai-explain-caveats">
              {result.caveats.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
