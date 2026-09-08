// Ported verbatim from buildWhyText() in wejhaty.html, including its unused
// `purposeId` parameter (kept for signature parity with the original).
import { REASON_LABELS } from '../data/reasonLabels';
import type { Destination, Lang } from '../data/types';
import type { Reason } from './types';

export function buildWhyText(
  lang: Lang,
  _purposeId: string,
  reasons: Reason[],
  dest: Destination,
): string {
  const top = reasons
    .filter((r) => r.weight > 1)
    .slice(0, 3)
    .map((r) => REASON_LABELS[lang][r.id] || r.id);
  const name = lang === 'ar' ? dest.nameAr : dest.nameEn;
  if (lang === 'ar') {
    return `${name} توافق قوي مع أولوياتك، خصوصاً في ${top.join('، ')}.`;
  }
  return `${name} is a strong match for your priorities, especially ${top.join(', ')}.`;
}
