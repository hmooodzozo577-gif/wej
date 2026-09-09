// Ported verbatim from REGION_GRADIENTS / thumbStyle() in wejhaty.html —
// CSS-gradient region placeholders, no external images.
//
// Phase 10 adds Africa/SouthAmerica (using colors already in the app's
// existing palette — --gold and --ink-adjacent tones — rather than
// inventing a new visual identity) so the worldwide catalog's Explorer
// cards have a gradient too.
import type { Continent } from '../data/types';

export const REGION_GRADIENTS: Record<Continent, [string, string]> = {
  Asia: ['#B3492F', '#7A2B1F'],
  Europe: ['#1E6B67', '#123E3B'],
  MiddleEast: ['#B3813C', '#7A5726'],
  NAmerica: ['#3A5A8C', '#1E2F4D'],
  Oceania: ['#2B8B85', '#155450'],
  Africa: ['#B3813C', '#5C4014'],
  SouthAmerica: ['#2B8B85', '#1E4A47'],
};

export function regionGradientCss(continent: Continent): string {
  const g = REGION_GRADIENTS[continent] ?? REGION_GRADIENTS.Europe;
  return `linear-gradient(150deg, ${g[0]}, ${g[1]})`;
}
