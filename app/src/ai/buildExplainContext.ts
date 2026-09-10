// Phase 16 — AI API Integration. Builds the verified structured context
// sent to the Worker's /api/ai/explain-recommendation — deterministic,
// pure, built entirely from data the Results page already displays
// (buildWhyText's own REASON_LABELS, the same cost/safety/climate/visa
// mini-tags shown on the top pick). Never a precise coordinate, never a
// fabricated number, never anything beyond what's already on-screen.
import { REASON_LABELS } from '../data/reasonLabels';
import { costLabel } from '../data/destinationText';
import type { RankedResult } from '../engine';
import type { I18nDict, Lang } from '../data/types';
import type { RankedDestinationContext } from './types';

export function buildExplainContext(lang: Lang, t: I18nDict, top: RankedResult[]): RankedDestinationContext[] {
  return top.map((r) => ({
    destId: r.dest.id,
    name: lang === 'ar' ? r.dest.nameAr : r.dest.nameEn,
    score: r.score,
    // Same filter/slice buildWhyText.ts already applies — the AI is
    // handed the SAME top reasons already shown to the user, never a
    // recomputed or embellished set.
    reasons: r.reasons
      .filter((reason) => reason.weight > 1)
      .slice(0, 3)
      .map((reason) => REASON_LABELS[lang][reason.id] || reason.id),
    facts: [
      `${t.results.cost}: ${costLabel(t.costLevels, r.dest.costLevel)}`,
      `${t.results.safety}: ${r.dest.safety}/100`,
      `${t.results.climate}: ${t.climateLabels[r.dest.climate]}`,
      `${t.results.visa}: ${t.visaLabels[r.dest.visaDiff]}`,
    ].join('. '),
  }));
}
