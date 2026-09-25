// v1.1 — Share for a destination. Uses the device's own share sheet when
// there is one (no imitation sheet), else copies the canonical link, else
// shows the link in a read-only field. Outcomes are announced politely.
import { useId, useState } from 'react';
import type { CatalogEntry, Lang } from '../data/types';
import { Icon } from '../components/Icon';
import { announce } from '../site/announce';
import { SHARE_COPY, destinationSharePayload, shareOrCopy } from './share';

export function ShareButton({ destination, lang, personalScore, className = '' }: {
  destination: CatalogEntry;
  lang: Lang;
  /** Only passed where the sender can see their own Personal Match. */
  personalScore?: number | null;
  className?: string;
}) {
  const copy = SHARE_COPY[lang];
  const fieldId = useId();
  const [manualUrl, setManualUrl] = useState<string | null>(null);
  const payload = destinationSharePayload(destination, lang, personalScore);

  const onShare = async () => {
    const outcome = await shareOrCopy(payload);
    if (outcome === 'shared') announce(copy.shared);
    else if (outcome === 'copied') announce(copy.copied);
    else if (outcome === 'manual') {
      setManualUrl(payload.url);
      announce(copy.failed);
    }
  };

  return (
    <span className={`share-control ${className}`.trim()}>
      <button type="button" className="btn btn-ghost share-button" onClick={onShare}>
        <Icon name="share" size={18} /> {copy.share}
      </button>
      {manualUrl ? (
        <span className="share-manual">
          <label htmlFor={fieldId} className="visually-hidden">{copy.linkLabel}</label>
          <input id={fieldId} type="url" readOnly value={manualUrl} dir="ltr" onFocus={(event) => event.currentTarget.select()} />
        </span>
      ) : null}
    </span>
  );
}
