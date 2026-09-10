// Correction pass (production visual QA): a long series (e.g. 1995-2024,
// 30 annual points) previously rendered a text label under EVERY point in
// TourismLineChart.tsx, producing an unreadable run of overlapping digits.
// Fix is label SELECTION only — selectTickIndices() below picks a
// deterministic subset of point indices to LABEL; every real data point is
// still plotted (circle + path segment) and still present in that
// component's hidden accessible table. The chart's own viewBox is a fixed,
// scale-invariant coordinate space (rendered at width="100%"), so tick
// spacing and font size shrink together on a narrower card — a single
// defensible fixed tick-count cap (not a runtime width measurement) stays
// visually safe at any rendered size, which is why MAX_TICKS is a constant
// rather than something requiring a ResizeObserver.
//
// Pulled into its own module (rather than living in TourismLineChart.tsx)
// so the component file only exports the component — oxlint's
// react(only-export-components) flags a component file that also exports
// a plain function, since it breaks Fast Refresh.
export const MAX_TICKS = 7;

/** Picks up to `maxTicks` indices out of `n` points, evenly spread, always
 *  including the first (0) and last (n-1) index. Deterministic — same
 *  input always yields the same output, no randomness, no current time.
 *  When n <= maxTicks every index is returned (nothing to reduce). */
export function selectTickIndices(n: number, maxTicks: number = MAX_TICKS): number[] {
  if (n <= 0) return [];
  if (n <= maxTicks || maxTicks <= 1) return Array.from({ length: n }, (_, i) => i);
  const step = (n - 1) / (maxTicks - 1);
  const picked = new Set<number>();
  for (let i = 0; i < maxTicks; i++) picked.add(Math.round(i * step));
  return [...picked].sort((a, b) => a - b);
}
