// Ported verbatim from REGION_GRADIENTS / thumbStyle() in wejhaty.html —
// CSS-gradient region placeholders, no external images.
import type { Region } from '../data/types';

export const REGION_GRADIENTS: Record<Region, [string, string]> = {
  Asia: ['#B3492F', '#7A2B1F'],
  Europe: ['#1E6B67', '#123E3B'],
  MiddleEast: ['#B3813C', '#7A5726'],
  NAmerica: ['#3A5A8C', '#1E2F4D'],
  Oceania: ['#2B8B85', '#155450'],
};

export function regionGradientCss(region: Region): string {
  const g = REGION_GRADIENTS[region] ?? REGION_GRADIENTS.Europe;
  return `linear-gradient(150deg, ${g[0]}, ${g[1]})`;
}
