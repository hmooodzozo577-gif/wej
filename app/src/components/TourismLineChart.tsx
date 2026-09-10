// Phase 13.5d — a small, dependency-free SVG line chart for a single
// real historical time series (year -> value). No charting library:
// this project has none installed, and one simple line chart doesn't
// justify adding one (see TOURISM_INSIGHTS.md for that evaluation).
//
// Deliberately minimal: no animation, no interpolation of missing
// years (only the real observed points are plotted, connected in
// period order — a gap in the source, e.g. missing 2021, is a real gap
// and is never invented or smoothed over), no tooltip/zoom. Renders
// nothing useful for fewer than 2 points (a single dot isn't a trend);
// callers should check for that and show an "unavailable" state
// instead — this component itself just renders a plain message so it
// never silently shows a blank/broken chart.
//
// RTL: time-series charts conventionally read left-to-right (oldest to
// newest) regardless of UI text direction — the wrapper is pinned
// dir="ltr" so Arabic's RTL layout never mirrors the chart itself, only
// the surrounding page. Accessible: role="img" with a full text summary
// (never relies on visually reading the line), plus a visually-hidden
// data table with the exact values for screen readers/zoom users.
//
// Correction pass (production visual QA): a long series (e.g. 1995-2024,
// 30 annual points) previously rendered a text label under EVERY point,
// producing an unreadable run of overlapping digits. Fix is label
// SELECTION only, via selectTickIndices() (../data/tourismChartTicks.ts —
// pulled into its own module so this component file only exports the
// component, per oxlint's react(only-export-components) rule): every
// real data point is still plotted (circle + path segment) and still
// present in the hidden accessible table below — only which points also
// get a year label is reduced.
// Visual refinement pass: the wrapper used to carry `maxWidth: WIDTH`
// (320px), hard-capping the chart at that width no matter how wide its
// card actually was — on a ~1130px-wide card this left ~800px of blank
// space beside a 320px-wide chart, the real cause of the Tourism
// Insights card looking oversized/empty. WIDTH/HEIGHT below are only the
// SVG's internal viewBox coordinate space (still needed for the point
// math); the rendered element itself now has no width cap and fills
// whatever its parent (TourismInsights.tsx's chart row) gives it, via
// `width="100%"` on the <svg> below.
import type { TourismObservation } from '../data/types';
import { selectTickIndices } from '../data/tourismChartTicks';

const WIDTH = 320;
const HEIGHT = 120;
const PAD_LEFT = 36;
const PAD_RIGHT = 8;
const PAD_TOP = 10;
const PAD_BOTTOM = 20;

export function TourismLineChart({
  series,
  formatValue,
  ariaLabel,
  color = '#b8860b',
}: {
  series: TourismObservation[];
  formatValue: (value: number) => string;
  ariaLabel: string;
  color?: string;
}) {
  if (series.length < 2) return null;

  const sorted = [...series].sort((a, b) => Number(a.period) - Number(b.period));
  const values = sorted.map((o) => o.value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1; // avoid divide-by-zero when every value is identical

  const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const stepX = sorted.length > 1 ? plotW / (sorted.length - 1) : 0;

  const points = sorted.map((obs, i) => {
    const x = PAD_LEFT + i * stepX;
    const y = PAD_TOP + plotH - ((obs.value - minV) / range) * plotH;
    return { x, y, obs };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  return (
    <div dir="ltr" style={{ marginTop: 8 }}>
      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        height={HEIGHT}
        style={{ display: 'block', overflow: 'visible' }}
      >
        {/* Baseline + top gridline for a minimal sense of scale. */}
        <line x1={PAD_LEFT} y1={PAD_TOP + plotH} x2={WIDTH - PAD_RIGHT} y2={PAD_TOP + plotH} stroke="currentColor" opacity={0.25} strokeWidth={1} />
        <text x={2} y={PAD_TOP + plotH + 4} fontSize={9} fill="currentColor" opacity={0.7}>
          {formatValue(minV)}
        </text>
        <text x={2} y={PAD_TOP + 8} fontSize={9} fill="currentColor" opacity={0.7}>
          {formatValue(maxV)}
        </text>

        <path d={pathD} fill="none" stroke={color} strokeWidth={2} />
        {points.map((p) => (
          <circle key={p.obs.period} cx={p.x} cy={p.y} r={2.5} fill={color} />
        ))}

        {/* Label SELECTION only (see selectTickIndices doc comment above) —
            every point above already got its circle/path segment; this
            only decides which of them also gets a year text label, so
            long series don't render an overlapping wall of digits. */}
        {selectTickIndices(points.length).map((i) => {
          const p = points[i]!;
          // First/last tick anchor away from the chart edge instead of
          // centering (centering would clip half the label off-canvas).
          const anchor = i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle';
          return (
            <text key={p.obs.period} x={p.x} y={HEIGHT - 4} fontSize={9} fill="currentColor" opacity={0.7} textAnchor={anchor}>
              {p.obs.period}
            </text>
          );
        })}
      </svg>

      {/* Visually-hidden exact data table — same real points as the SVG,
          for screen readers and anyone who wants the precise numbers. */}
      <table style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th>Year</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((obs) => (
            <tr key={obs.period}>
              <td>{obs.period}</td>
              <td>{obs.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
