// An original, simplified top-down airplane silhouette (fuselage, swept
// wings, tail fin and stabilizers as separate closed subpaths in one `d`) —
// authored for this project, not traced from any reference image. Nose
// points toward +x so it reads correctly with `offset-rotate: auto` along
// the route paths below.
const PLANE_SILHOUETTE = 'M30 0 12-2.5-8-2.5-8 2.5 12 2.5Z M2-2-18-18-10-2Z M2 2-18 18-10 2Z M-22-2-28-6-24-2Z M-22 2-28 6-24 2Z M-22 0-30-9-26 0Z';

export function TravelRouteDecor({ variant = 'home' }: { variant?: 'home' | 'explore' | 'destination' | 'how' | 'quiz' }) {
  if (variant === 'quiz') {
    // The lightest tier in the site's motion hierarchy: a single, very
    // faint, very slow plane near the header/progress zone. Positioned to
    // span the full viewport width (not just the narrow centered quiz
    // column) so it has room to drift without ever crossing the opaque
    // question card in the middle.
    return (
      <svg className="travel-route-decor travel-route-quiz" viewBox="-40 -10 1360 140" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <g className="route-plane route-plane-quiz">
          <path className="route-plane-mark" d={PLANE_SILHOUETTE} />
        </g>
      </svg>
    );
  }
  if (variant === 'how') {
    // A quieter pair of background planes for the How-It-Works band: no
    // visible route lines (the section already has text content to carry),
    // slower than the Hero planes, and tinted with the orange accent so it
    // reads as an intentional, low-contrast continuation of the Hero motif.
    return (
      <svg className="travel-route-decor travel-route-how" viewBox="-40 -20 1360 220" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <g className="route-plane route-plane-how-a">
          <path className="route-plane-mark" d={PLANE_SILHOUETTE} />
        </g>
        <g className="route-plane route-plane-how-b" transform="scale(.66)">
          <path className="route-plane-mark" d={PLANE_SILHOUETTE} />
        </g>
      </svg>
    );
  }
  return (
    <svg
      className={`travel-route-decor travel-route-${variant}`}
      viewBox="-80 -80 1360 780"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path className="travel-route-line route-one" d="M-70 105 C150 235 286 22 500 122 S870 262 1280 62" />
      <path className="travel-route-line route-two" d="M90 700 C230 466 398 505 555 382 S875 150 1270 344" />
      {variant === 'home' ? (
        <>
          <g className="route-plane route-plane-moving">
            <path className="route-plane-mark" d={PLANE_SILHOUETTE} />
          </g>
          <g className="route-plane route-plane-secondary-moving" transform="scale(.72)">
            <path className="route-plane-mark" d={PLANE_SILHOUETTE} />
          </g>
        </>
      ) : (
        <g className="route-plane route-plane-drift" transform="translate(500 122) rotate(8)">
          <path className="route-plane-mark" d={PLANE_SILHOUETTE} />
        </g>
      )}
    </svg>
  );
}
