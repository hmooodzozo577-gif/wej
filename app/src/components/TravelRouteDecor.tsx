import type { ReactNode } from 'react';
import { FLIGHT_PATHS } from './flightPaths';

// An original, simplified top-down airplane silhouette (fuselage, swept
// wings, tail fin and stabilizers as separate closed subpaths in one `d`) —
// authored for this project, not traced from any reference image. Nose
// points toward +x so it reads correctly with `offset-rotate: auto` along
// the route paths below.
const PLANE_SILHOUETTE = 'M30 0 12-2.5-8-2.5-8 2.5 12 2.5Z M2-2-18-18-10-2Z M2 2-18 18-10 2Z M-22-2-28-6-24-2Z M-22 2-28 6-24 2Z M-22 0-30-9-26 0Z';

type Variant =
  | 'home'
  | 'home-portrait'
  | 'how'
  | 'purpose-header'
  | 'explore-header'
  | 'surprise'
  | 'destination'
  | 'quiz';

function Plane({ className, scale }: { className: string; scale?: number }) {
  return (
    <g className={`route-plane ${className}`}>
      <path className="route-plane-mark" d={PLANE_SILHOUETTE} transform={scale ? `scale(${scale})` : undefined} />
    </g>
  );
}

/** A "flight band": an SVG scaled uniformly (`slice`, never `none`), so the
 *  plane keeps its true shape at every width. Each context sizes and places
 *  its band; routes cross the band's clipped edges. */
function Band({ className, viewBox, align, children }: { className: string; viewBox: string; align: string; children: ReactNode }) {
  return (
    <svg
      className={`travel-route-decor travel-route-band ${className}`}
      viewBox={viewBox}
      preserveAspectRatio={`${align} slice`}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

function Route({ d, secondary }: { d: string; secondary?: boolean }) {
  return <path className={`travel-route-line${secondary ? ' route-two' : ''}`} d={d} />;
}

export function TravelRouteDecor({ variant = 'home' }: { variant?: Variant }) {
  switch (variant) {
    case 'quiz':
      // Lightest tier: two faint, distant planes in the header/progress
      // band — one longer and higher, one smaller, lower and slower,
      // flying the other way. Never over the question card.
      return (
        <Band className="travel-route-quiz" viewBox="0 0 1200 90" align="xMidYMid">
          <Route d={FLIGHT_PATHS.quizA} />
          <Route d={FLIGHT_PATHS.quizB} secondary />
          <Plane className="route-plane-quiz-a" scale={0.6} />
          <Plane className="route-plane-quiz-b" scale={0.42} />
        </Band>
      );
    case 'home-portrait':
      // Portrait Home Hero: the landscape routes would cross the stacked
      // copy, so the two flights move to the frame's top and bottom margins.
      return (
        <>
          <Band className="travel-route-home-band travel-route-home-top" viewBox="0 0 1000 80" align="xMidYMid">
            <Route d={FLIGHT_PATHS.homeTop} />
            <Plane className="route-plane-home-top" scale={0.9} />
          </Band>
          <Band className="travel-route-home-band travel-route-home-bottom" viewBox="0 0 1000 70" align="xMidYMid">
            <Route d={FLIGHT_PATHS.homeBottom} secondary />
            <Plane className="route-plane-home-bottom" scale={0.66} />
          </Band>
        </>
      );
    case 'how':
      // Ambient support beside the section heading: one plane arrives from
      // the outer edge and climbs out through the top; a smaller one drops
      // in from the top and leaves by the outer edge.
      return (
        <Band className="travel-route-how" viewBox="0 0 720 230" align="xMaxYMin">
          <Route d={FLIGHT_PATHS.howA} />
          <Route d={FLIGHT_PATHS.howB} secondary />
          <Plane className="route-plane-how-a" scale={0.9} />
          <Plane className="route-plane-how-b" scale={0.62} />
        </Band>
      );
    case 'purpose-header':
      // One quiet swoop in the open side of the page head.
      return (
        <Band className="travel-route-purpose" viewBox="0 0 720 230" align="xMaxYMin">
          <Route d={FLIGHT_PATHS.purpose} />
          <Plane className="route-plane-purpose" scale={0.85} />
        </Band>
      );
    case 'explore-header':
      // Wide, exploratory: two long routes across the whole header, edge
      // to edge, at different heights, speeds and directions.
      return (
        <Band className="travel-route-explore" viewBox="0 0 1440 220" align="xMidYMin">
          <Route d={FLIGHT_PATHS.exploreA} />
          <Route d={FLIGHT_PATHS.exploreB} secondary />
          <Plane className="route-plane-explore-a" scale={0.95} />
          <Plane className="route-plane-explore-b" scale={0.7} />
        </Band>
      );
    case 'surprise':
      // Compact: a single small plane on a short internal route; the
      // compass is the card's other living element.
      return (
        <Band className="travel-route-surprise" viewBox="0 0 600 160" align="xMaxYMid">
          <Route d={FLIGHT_PATHS.surprise} />
          <Plane className="route-plane-surprise" scale={0.55} />
        </Band>
      );
    case 'destination':
      // One elegant route across the photograph's upper sky, clear of the
      // title and the previous/next controls.
      return (
        <Band className="travel-route-destination" viewBox="0 0 1200 240" align="xMidYMin">
          <Route d={FLIGHT_PATHS.destination} />
          <Plane className="route-plane-destination" scale={0.78} />
        </Band>
      );
    default:
      return (
        <svg
          className="travel-route-decor travel-route-home"
          viewBox="-80 -80 1360 780"
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <path className="travel-route-line route-one" d="M-70 105 C150 235 286 22 500 122 S870 262 1280 62" />
          <path className="travel-route-line route-two" d="M1270 344 C875 150 712 259 555 382 C398 505 230 466 90 700" />
          <g className="route-plane route-plane-moving">
            <path className="route-plane-mark" d={PLANE_SILHOUETTE} />
          </g>
          <g className="route-plane route-plane-secondary-moving">
            <path className="route-plane-mark" d={PLANE_SILHOUETTE} transform="scale(.72)" />
          </g>
        </svg>
      );
  }
}
