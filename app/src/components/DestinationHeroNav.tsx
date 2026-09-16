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
//     tooltip, and — where the hero has the room for it — a visible label
//     revealed on hover/focus. Acceptance item #2 asked for the visible
//     "previous country" / "next country" wording, but only if it does not
//     damage the photography, collide with the title, or clutter mobile.
//     Measured outcome: at >=900px the control's row sits clear above the
//     title block, so the label is shown there; below 900px the title block
//     reaches the control's row (and there is no hover anyway), so the label
//     is not rendered at all and the accessible name plus tooltip carry it
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
      <span className="hero-nav-icon" aria-hidden="true">
        <Icon name={direction === 'previous' ? 'arrowStart' : 'arrowEnd'} size={20} stroke={2.4} />
      </span>
      {/* Acceptance item #2 — the compact visible label, revealed on hover
          or keyboard focus and ONLY on viewports wide enough that the hero's
          title block does not reach the control's row (see the .hero-nav-name
          rules in wejhaty.css, which hide it entirely below 900px). It is
          aria-hidden because the same words are already in the link's
          accessible name; announcing them twice would be worse, not better. */}
      <span className="hero-nav-name" aria-hidden="true">
        <b>{label}</b>
        <i>{name}</i>
      </span>
    </Link>
  );
}
