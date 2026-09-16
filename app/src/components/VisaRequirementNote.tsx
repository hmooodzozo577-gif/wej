// Item #12E — how an entry requirement is shown.
//
// Rules this component exists to enforce, not just to satisfy once:
//   - the provider and the check date are always shown alongside the
//     category, because a requirement without either is not a usable claim
//   - the standing caveat (requirements change; re-check before booking) is
//     always present, never conditional on the category
//   - nothing here promises entry, visa approval, an open border, or legal
//     eligibility beyond what the provider returned
//   - "no data" is stated as what it is, and the two reasons for it (no
//     provider enabled vs. a provider with nothing to say) are distinguished
import type { VisaStrings } from '../data/types';
import { formatIsoDate } from '../data/format';
import { Icon } from './Icon';
import type { VisaRequirement } from '../visa/types';

export function VisaRequirementNote({
  requirement,
  providerConfigured,
  strings,
  compact = false,
}: {
  requirement: VisaRequirement | undefined;
  providerConfigured: boolean;
  strings: VisaStrings;
  compact?: boolean;
}) {
  if (!requirement) {
    return (
      <p className="visa-note visa-note-empty">
        <Icon name="info" size={14} stroke={2.2} />{' '}
        {providerConfigured ? strings.unavailable : strings.noProvider}
      </p>
    );
  }

  const category = strings.categories[requirement.category];

  if (compact) {
    return (
      <span className="mini-tag visa-tag" title={strings.changeNote}>
        <Icon name="shield" size={13} stroke={2.4} /> {category}
      </span>
    );
  }

  return (
    <div className="visa-note">
      <h4>
        <Icon name="shield" size={16} stroke={2.2} /> {strings.title}
      </h4>
      <p className="visa-category">{category}</p>
      {requirement.details ? <p className="visa-details">{requirement.details}</p> : null}
      <p className="visa-provenance">
        {strings.providerLabel}: {requirement.provider} · {strings.checkedAtLabel}: {formatIsoDate(requirement.checkedAt)}
      </p>
      <p className="visa-caveat">{strings.changeNote}</p>
    </div>
  );
}
