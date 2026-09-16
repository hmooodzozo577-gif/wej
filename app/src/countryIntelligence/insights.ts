// Derives "main strengths" / "main limitations" labels from a suitability
// detail's OWN structured components — never generated prose, per task
// 3.5 ("the recommendation engine must consume structured values...
// Prose explanations should be derived from... structured data, never
// act as the only source of truth").
import type { SuitabilityComponent } from './detailClient';

const STRONG_THRESHOLD = 70;
const WEAK_THRESHOLD = 40;
const MAX_ITEMS = 3;

function observed(components: SuitabilityComponent[]): SuitabilityComponent[] {
  return components.filter((component) => component.status === 'observed' && component.normalizedValue !== null);
}

export function deriveStrengths(components: SuitabilityComponent[]): SuitabilityComponent[] {
  return observed(components)
    .filter((component) => component.normalizedValue! >= STRONG_THRESHOLD)
    .sort((a, b) => b.normalizedValue! - a.normalizedValue!)
    .slice(0, MAX_ITEMS);
}

export function deriveLimitations(components: SuitabilityComponent[]): SuitabilityComponent[] {
  return observed(components)
    .filter((component) => component.normalizedValue! < WEAK_THRESHOLD)
    .sort((a, b) => a.normalizedValue! - b.normalizedValue!)
    .slice(0, MAX_ITEMS);
}
