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
        <g className="route-plane route-plane-moving">
          <path className="route-plane-mark" d="M31 0 9-6-3-27h-8l6 23-21-8-7 8 28 8-6 23h8L9 6Z" />
        </g>
      ) : (
        <g className="route-plane route-plane-static" transform="translate(500 122) rotate(8)">
          <path className="route-plane-mark" d="M31 0 9-6-3-27h-8l6 23-21-8-7 8 28 8-6 23h8L9 6Z" />
        </g>
      )}
    </svg>
  );
}
