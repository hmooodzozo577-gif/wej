// An original, simplified top-down airplane silhouette (fuselage, swept
// wings, tail fin and stabilizers as separate closed subpaths in one `d`) —
// authored for this project, not traced from any reference image. Nose
// points toward +x so it reads correctly with `offset-rotate: auto` along
// the route paths below.
const PLANE_SILHOUETTE = 'M30 0 12-2.5-8-2.5-8 2.5 12 2.5Z M2-2-18-18-10-2Z M2 2-18 18-10 2Z M-22-2-28-6-24-2Z M-22 2-28 6-24 2Z M-22 0-30-9-26 0Z';

export function TravelRouteDecor({ variant = 'home' }: { variant?: 'home' | 'explore' | 'destination' }) {
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
          <g className="route-plane route-plane-secondary" transform="translate(555 382) rotate(-24) scale(.7)">
            <path className="route-plane-mark" d={PLANE_SILHOUETTE} />
          </g>
        </>
      ) : (
        <g className="route-plane route-plane-static" transform="translate(500 122) rotate(8)">
          <path className="route-plane-mark" d={PLANE_SILHOUETTE} />
        </g>
      )}
    </svg>
  );
}
