import type { ReactNode } from 'react';

// An original, simplified top-down airplane silhouette (fuselage, swept
// wings, tail fin and stabilizers as separate closed subpaths in one `d`) —
// authored for this project, not traced from any reference image. Nose
// points toward +x so it reads correctly with `offset-rotate: auto` along
// the route paths below.
const PLANE_SILHOUETTE = 'M30 0 12-2.5-8-2.5-8 2.5 12 2.5Z M2-2-18-18-10-2Z M2 2-18 18-10 2Z M-22-2-28-6-24-2Z M-22 2-28 6-24 2Z M-22 0-30-9-26 0Z';

type Variant = 'home' | 'home-portrait' | 'band' | 'surprise' | 'destination' | 'quiz';

// Flight paths, in each SVG's own viewBox units, written in the direction
// of travel. The same string drives both the drawn dashed route and the
// plane's CSS `offset-path` (see wejhaty.css), so a plane always flies the
// line the reader can see.
const FLIGHT_PATHS = {
  bandA: 'M40 150 C200 70 380 180 560 100 S760 40 850 70',
  bandB: 'M850 176 C660 206 500 136 330 170 S130 204 30 156',
  quiz: 'M-60 58 C220 20 460 76 700 42 S1080 20 1260 52',
  homeTop: 'M-60 46 C180 18 400 64 620 36 S900 22 1060 44',
  homeBottom: 'M1060 30 C820 54 600 16 380 40 S120 58 -60 30',
} as const;

function Plane({ className, scale }: { className: string; scale?: number }) {
  return (
    <g className={`route-plane ${className}`}>
      <path className="route-plane-mark" d={PLANE_SILHOUETTE} transform={scale ? `scale(${scale})` : undefined} />
    </g>
  );
}

/** A "flight band": a strip of uniform-scale SVG (never stretched, so the
 *  plane keeps its shape at every width) whose box always matches the
 *  viewBox's aspect ratio. Contexts place it in empty space only — beside
 *  a heading, above a photo's copy — never behind a grid of cards. */
function Band({ className, viewBox, children }: { className: string; viewBox: string; children: ReactNode }) {
  return (
    <svg className={`travel-route-decor travel-route-band ${className}`} viewBox={viewBox} aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export function TravelRouteDecor({ variant = 'home' }: { variant?: Variant }) {
  if (variant === 'quiz') {
    // The lightest tier in the site's motion hierarchy: one slow, faint
    // plane in the header/progress band, clear of the question card.
    return (
      <Band className="travel-route-quiz" viewBox="0 0 1200 90">
        <path className="travel-route-line" d={FLIGHT_PATHS.quiz} />
        <Plane className="route-plane-quiz" scale={0.6} />
      </Band>
    );
  }
  if (variant === 'home-portrait') {
    // Portrait Home Hero: the landscape routes would cross the stacked
    // copy, so the two flights move to the frame's top and bottom margins.
    return (
      <>
        <Band className="travel-route-home-band travel-route-home-top" viewBox="0 0 1000 80">
          <path className="travel-route-line" d={FLIGHT_PATHS.homeTop} />
          <Plane className="route-plane-home-top" scale={0.9} />
        </Band>
        <Band className="travel-route-home-band travel-route-home-bottom" viewBox="0 0 1000 70">
          <path className="travel-route-line route-two" d={FLIGHT_PATHS.homeBottom} />
          <Plane className="route-plane-home-bottom" scale={0.66} />
        </Band>
      </>
    );
  }
  if (variant === 'band' || variant === 'surprise' || variant === 'destination') {
    // Two distinct flights crossing the open side of a section head, a
    // card's empty column, or a photo's sky. Each fades in at its origin
    // and flies out past the band's outer edge.
    return (
      <Band className={`travel-route-${variant}`} viewBox="0 0 800 220">
        <path className="travel-route-line" d={FLIGHT_PATHS.bandA} />
        <path className="travel-route-line route-two" d={FLIGHT_PATHS.bandB} />
        <Plane className="route-plane-band-a" />
        <Plane className="route-plane-band-b" scale={0.85} />
      </Band>
    );
  }
  return (
    <svg
      className="travel-route-decor travel-route-home"
      viewBox="-80 -80 1360 780"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path className="travel-route-line route-one" d="M-70 105 C150 235 286 22 500 122 S870 262 1280 62" />
      <path className="travel-route-line route-two" d="M90 700 C230 466 398 505 555 382 S875 150 1270 344" />
      <g className="route-plane route-plane-moving">
        <path className="route-plane-mark" d={PLANE_SILHOUETTE} />
      </g>
      <g className="route-plane route-plane-secondary-moving" transform="scale(.72)">
        <path className="route-plane-mark" d={PLANE_SILHOUETTE} />
      </g>
    </svg>
  );
}
