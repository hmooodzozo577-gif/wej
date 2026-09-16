// Item #12F — the browser side of the visa lookup.
//
// Sends only a passport COUNTRY and a destination country. Never a passport
// number: there is no field for one anywhere in this path, and the app never
// asks for one. No provider credential exists in the frontend — the Worker
// holds it (see worker/src/visa.ts and SECRETS.md).
//
// Failure is not an error state for the traveller: every failure resolves to
// no requirement at all, the UI says visa information is unavailable, and
// the recommendation still works. There is no fabricated fallback.
import type { VisaRequirement } from './types';

// Read per call rather than captured at module load: the value is build-time
// configuration, but reading it lazily keeps this module testable without a
// module-registry reset, and costs nothing.
function workerBaseUrl(): string | undefined {
  return import.meta.env.VITE_TRAVEL_WORKER_URL;
}

const LOOKUP_TIMEOUT_MS = 7000;

export interface VisaLookupResult {
  requirements: Map<string, VisaRequirement>;
  /** False when no provider is configured on the Worker, which is the
   *  current production state. The UI uses this to explain WHY there is no
   *  visa information, instead of implying a transient failure. */
  providerConfigured: boolean;
}

const EMPTY: VisaLookupResult = { requirements: new Map(), providerConfigured: false };

async function lookupOne(passportCode: string, destinationCode: string, purpose?: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const response = await fetch(`${workerBaseUrl()}/api/visa/requirements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passportCode, destinationCode, ...(purpose ? { purpose } : {}) }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return (await response.json()) as { requirement: VisaRequirement; providerConfigured: boolean };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Looks up entry requirements for one passport against several
 *  destinations. Individual failures are absorbed: a destination with no
 *  answer simply has no entry in the returned map, which every caller
 *  already treats as 'unknown'. */
export async function lookupVisaRequirements(
  passportCode: string | null,
  destinationCodes: string[],
  purpose?: string,
): Promise<VisaLookupResult> {
  if (!passportCode || !workerBaseUrl() || !destinationCodes.length) return EMPTY;

  const responses = await Promise.all(
    destinationCodes.map((code) => lookupOne(passportCode, code, purpose)),
  );

  const requirements = new Map<string, VisaRequirement>();
  let providerConfigured = false;
  for (const response of responses) {
    if (!response) continue;
    if (response.providerConfigured) providerConfigured = true;
    // An 'unknown' requirement is deliberately NOT stored: it carries no
    // information, and keeping it out means "no entry" has exactly one
    // meaning everywhere downstream.
    if (response.requirement && response.requirement.category !== 'unknown') {
      requirements.set(response.requirement.destinationCode, response.requirement);
    }
  }
  return { requirements, providerConfigured };
}
