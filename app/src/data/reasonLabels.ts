// Bilingual labels for scoring-factor reason ids, ported verbatim from
// REASON_LABELS in wejhaty.html (used by buildWhyText).
import reasonLabelsJson from './generated/reasonLabels.json';
import type { ReasonLabels } from './types';

export const REASON_LABELS: ReasonLabels = reasonLabelsJson as ReasonLabels;
