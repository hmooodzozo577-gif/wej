// Item #12 — one place that fetches entry requirements for the traveller's
// passport against a set of destinations, and reports honestly which of the
// three states the app is in:
//
//   no passport        -> nothing was asked, nothing is claimed
//   no provider        -> the service is not enabled (today's production state)
//   provider answered  -> whatever it actually said, including nothing
//
// The distinction matters to a traveller: "we can't tell you" for a reason
// they can understand is not the same as a silent blank.
import { useEffect, useState } from 'react';
import { lookupVisaRequirements } from './visaClient';
import type { VisaRequirement } from './types';

export interface VisaRequirementsState {
  requirements: Map<string, VisaRequirement>;
  providerConfigured: boolean;
  loading: boolean;
}

const EMPTY = new Map<string, VisaRequirement>();

interface Loaded {
  /** The request this result answers. Comparing it against the request the
   *  current render WOULD make is how `loading` is derived, instead of
   *  setting a loading flag from inside the effect. */
  key: string;
  requirements: Map<string, VisaRequirement>;
  providerConfigured: boolean;
}

export function useVisaRequirements(
  passportCode: string | null,
  destinationCodes: string[],
  purpose?: string,
): VisaRequirementsState {
  // Depend on the destination VALUES, not on a fresh array identity each
  // render.
  const requestKey = passportCode ? `${passportCode}|${purpose ?? ''}|${destinationCodes.join(',')}` : '';
  const [loaded, setLoaded] = useState<Loaded>({ key: '', requirements: EMPTY, providerConfigured: false });

  useEffect(() => {
    if (!requestKey) return;
    let cancelled = false;
    const [passport, effectPurpose, codes] = requestKey.split('|');
    void lookupVisaRequirements(passport!, codes ? codes.split(',') : [], effectPurpose || undefined).then((result) => {
      if (cancelled) return;
      setLoaded({ key: requestKey, requirements: result.requirements, providerConfigured: result.providerConfigured });
    });
    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  // Derived during render: no setState-in-effect, and a stale result from a
  // previous passport can never be presented as the current one.
  const current = loaded.key === requestKey;
  return {
    requirements: current ? loaded.requirements : EMPTY,
    providerConfigured: current ? loaded.providerConfigured : false,
    loading: !!requestKey && !current,
  };
}
