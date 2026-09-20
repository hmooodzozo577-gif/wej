export function TravelRouteDecor({ variant = 'home' }: { variant?: 'home' | 'explore' | 'destination' }) {
  return (
    <svg
      className={`travel-route-decor travel-route-${variant}`}
      viewBox="0 0 1200 620"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path className="travel-route-line route-one" d="M-30 92 C170 210 270 20 470 116 S820 245 1240 75" />
      <path className="travel-route-line route-two" d="M170 600 C260 430 390 456 505 350 S745 155 1030 285" />
      <g className="route-plane plane-one" transform="translate(458 112) rotate(10)">
        <path d="M0 0 31-6 41-1 31 4 20 3 12 15 5 16 9 3-2 5-6 1 9-3 5-16 12-15 20-3Z" />
      </g>
      <g className="route-plane plane-two" transform="translate(1010 277) rotate(-17)">
        <path d="M0 0 31-6 41-1 31 4 20 3 12 15 5 16 9 3-2 5-6 1 9-3 5-16 12-15 20-3Z" />
      </g>
      {variant === 'home' ? (
        <g className="route-plane plane-three" transform="translate(175 585) rotate(-54)">
          <path d="M0 0 31-6 41-1 31 4 20 3 12 15 5 16 9 3-2 5-6 1 9-3 5-16 12-15 20-3Z" />
        </g>
      ) : null}
    </svg>
  );
}
