// Item #3 — previous/next destination controls INSIDE the hero image.
//
// They used to be two full-width cards below the hero (.destination-pager),
// which the user's marked-up screenshot rejects: the controls belong in the
// hero's own side gutters, at the far left and far right edges, as a subtle
// translucent frame over the photography rather than a block of chrome
// underneath it.
//
// Design constraints this satisfies:
//   - translucent + blurred, so the country photo still reads through it
//   - a fixed light foreground with its own shadow, legible over both a
//     bright sky and a dark night shot (the same problem, and the same
//     solution, as the hero title — see wejhaty.css)
//   - 44px minimum hit area at every breakpoint, so it stays usable on touch
//   - the destination NAME is the control's accessible name and its native
//     tooltip. It is deliberately NOT an inline expanding label: visual QA
//     showed no collision-free room for one inside this hero (see the
//     .hero-nav rules in wejhaty.css), and this way a screen-reader user, a
//     keyboard user and a mouse user all get the same information
//   - the arrow glyphs are physically left/right (see data/icons.json), so
//     they are mirrored in RTL by CSS — in Arabic, "previous" points toward
//     the start of the reading direction, which is the right-hand side
import { Link } from 'react-router-dom';
import type { Lang } from '../data/types';
import { nameOf } from '../data/destinationText';
import { Icon } from './Icon';
import type { HeroNavTarget } from './heroNavTargets';

export function HeroNavButton({
  target,
  direction,
  label,
  lang,
}: {
  target: HeroNavTarget;
  direction: 'previous' | 'next';
  label: string;
  lang: Lang;
}) {
  const name = nameOf(target.entry, lang);
  return (
    <Link
      className={`hero-nav hero-nav-${direction}`}
      to={`/destination/${target.entry.id}`}
      state={{ navigation: target.navigation }}
      aria-label={`${label}: ${name}`}
      title={`${label}: ${name}`}
    >
      {/* The destination name is the control's accessible name and its
          native tooltip, not a visible inline label — see the .hero-nav
          rules in wejhaty.css for why an inline one cannot fit this hero
          without covering the country title. */}
      <span className="hero-nav-icon" aria-hidden="true">
        <Icon name={direction === 'previous' ? 'arrowStart' : 'arrowEnd'} size={20} stroke={2.4} />
      </span>
    </Link>
  );
}
