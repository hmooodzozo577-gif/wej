// Ports the `.dest-card` markup shared by renderResults() (with a match %
// and "why" text) and renderExplore() (with the plain description instead)
// in wejhaty.html — same card, same two use sites, one component.
import { Link } from 'react-router-dom';
import type { Destination, I18nDict, Lang } from '../data/types';
import { citiesOf, costLabel, descOf, nameOf } from '../data/destinationText';
import { FlagChip, FlagThumb } from './flags/FlagIcon';
import { Icon } from './Icon';

export function DestinationCard({
  dest,
  lang,
  t,
  matchScore,
  whyText,
}: {
  dest: Destination;
  lang: Lang;
  t: I18nDict;
  /** Present in Results (ranked match); absent in Explorer (plain browsing). */
  matchScore?: number;
  whyText?: string;
}) {
  const fromResults = matchScore !== undefined;
  return (
    <Link
      to={`/destination/${dest.id}`}
      state={{ fromResults }}
      className="dest-card"
      data-open={dest.id}
    >
      <FlagThumb dest={dest} lang={lang} />
      <div className="dest-body">
        <div className="dest-body-top">
          <span className="name-flag">
            <FlagChip dest={dest} width={24} height={18} />
            <h3>{nameOf(dest, lang)}</h3>
          </span>
          {matchScore !== undefined ? <span className="match-pill">{matchScore}%</span> : null}
        </div>
        <div className="dest-region">
          {t.regionLabels[dest.region]} · {citiesOf(dest, lang)[0]}
        </div>
        <p className="dest-why">{whyText ?? descOf(dest, lang)}</p>
        <div className="dest-meta">
          <span className="meta-chip">
            <Icon name="tag" size={13} stroke={2.4} /> {costLabel(t.costLevels, dest.costLevel)}
          </span>
          <span className="meta-chip">
            <Icon name="shield" size={13} stroke={2.4} /> {dest.safety}/100
          </span>
          <span className="meta-chip">
            <Icon name="sun" size={13} stroke={2.4} /> {t.climateLabels[dest.climate]}
          </span>
        </div>
      </div>
    </Link>
  );
}
