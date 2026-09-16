// Item #12 — passport/visa entry requirements, behind a provider abstraction.
//
// PROVIDER RESEARCH SUMMARY (the full comparison is in ../VISA_PROVIDERS.md).
// Three legitimate, maintainable sources were evaluated — IATA Timatic /
// Timatic AutoCheck, VisaHQ, and Sherpa. All three are commercial products
// reached through a contract, a partnership agreement, or an approved API
// key; none offers self-serve access that Wejhaty can use today. The
// open-source "passport index" datasets on GitHub were considered and
// rejected: they are scraped, unofficial, and carry no accuracy commitment,
// which is precisely what the brief forbids.
//
// Consequences for this file:
//   - the recommendation engine never talks to a vendor. It talks to
//     VisaRequirementsProvider, which returns Wejhaty's own canonical
//     vocabulary (see VisaRequirementCategory).
//   - the DEFAULT provider is `unavailableProvider`, which answers 'unknown'
//     for everything. With no credentials configured that is the honest
//     answer, and every caller already has to handle it.
//   - the Sherpa adapter is written but INERT until SHERPA_API_KEY exists,
//     and its category mapping is a single table that must be verified
//     against a real sandbox response before the provider is switched on.
//     See VERIFY_BEFORE_ENABLING below.
//
// Nothing here ever stores or receives a passport NUMBER. The only traveller
// input is a passport COUNTRY (ISO 3166-1 alpha-2), which is what every one
// of these providers actually keys on.

/** Wejhaty's canonical entry-requirement vocabulary. Deliberately coarse:
 *  it is the most a recommendation product can honestly say, and it maps
 *  onto every provider's own taxonomy without pretending to more precision
 *  than the provider gave. 'unknown' is a first-class answer, not a failure
 *  mode to be smoothed over. */
export type VisaRequirementCategory =
  | 'visaFree'
  | 'visaOnArrival'
  | 'eVisa'
  | 'authorizationRequired'
  | 'embassyVisaRequired'
  | 'unknown';

export interface VisaRequirement {
  /** ISO 3166-1 alpha-2 of the PASSPORT the traveller would use. */
  passportCode: string;
  /** ISO 3166-1 alpha-2 of the destination country. */
  destinationCode: string;
  category: VisaRequirementCategory;
  /** Provider-supplied detail, passed through verbatim and never
   *  paraphrased into a stronger claim. */
  details?: string;
  /** Which provider answered — shown to the user, so they can judge it. */
  provider: string;
  /** When this answer was obtained (ISO 8601). Entry rules change; a
   *  requirement with no freshness stamp must never be displayed. */
  checkedAt: string;
}

export interface VisaRequirementsProvider {
  readonly name: string;
  /** True when the provider is actually usable (credentials present). */
  isConfigured(): boolean;
  lookup(input: VisaLookupInput): Promise<VisaRequirement>;
}

export interface VisaLookupInput {
  passportCode: string;
  destinationCode: string;
  /** Travel purpose, where the provider distinguishes them. Wejhaty's own
   *  purpose ids are mapped by each adapter; an adapter that cannot express
   *  a purpose must fall back to the provider's general/tourism rule and say
   *  so in `details`, never silently answer a different question. */
  purpose?: string;
}

export interface VisaEnv {
  /** Sherpa API key. Never committed; set with `wrangler secret put`. */
  SHERPA_API_KEY?: string;
  /** Optional override for the Sherpa base URL (sandbox vs production). */
  SHERPA_BASE_URL?: string;
}

const ISO2_RE = /^[A-Z]{2}$/;

/** Israel stays excluded from every effective path, including this one — a
 *  visa lookup is a destination path like any other. */
const EXCLUDED_DESTINATIONS = new Set(['IL']);

export function validateVisaLookup(body: unknown): string[] {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return ['Request body must be a JSON object.'];
  }
  const value = body as Record<string, unknown>;
  const errors: string[] = [];
  if (typeof value.passportCode !== 'string' || !ISO2_RE.test(value.passportCode)) {
    errors.push('passportCode must be a 2-letter uppercase ISO 3166-1 alpha-2 code.');
  }
  if (typeof value.destinationCode !== 'string' || !ISO2_RE.test(value.destinationCode)) {
    errors.push('destinationCode must be a 2-letter uppercase ISO 3166-1 alpha-2 code.');
  }
  if (typeof value.destinationCode === 'string' && EXCLUDED_DESTINATIONS.has(value.destinationCode)) {
    errors.push('destinationCode is not part of the effective catalog.');
  }
  if (value.purpose !== undefined && typeof value.purpose !== 'string') {
    errors.push('purpose must be a string if provided.');
  }
  return errors;
}

export function unknownRequirement(input: VisaLookupInput, provider: string, details?: string): VisaRequirement {
  return {
    passportCode: input.passportCode,
    destinationCode: input.destinationCode,
    category: 'unknown',
    provider,
    checkedAt: new Date().toISOString(),
    ...(details ? { details } : {}),
  };
}

/** The default. Answers 'unknown' for everything, which is the truthful
 *  answer when no provider is configured — the alternative (guessing from a
 *  scraped dataset) is what this product must not do. */
export const unavailableProvider: VisaRequirementsProvider = {
  name: 'none',
  isConfigured: () => false,
  lookup: async (input) => unknownRequirement(input, 'none', 'No visa data provider is configured.'),
};

// --- Sherpa adapter --------------------------------------------------------
//
// VERIFY_BEFORE_ENABLING: this mapping is written against Sherpa's published
// Requirements API shape — visa requirements arrive in the /v3/trips response
// under `informationGroups` with `type: VISA_REQUIREMENTS`. The exact string
// values in the table below MUST be confirmed against a real sandbox
// response before SHERPA_API_KEY is set in production. Anything not in the
// table maps to 'unknown', so an unverified value degrades to "we don't
// know" rather than to a wrong claim — but an unverified table would still
// mean systematically answering 'unknown', which is why verification is a
// prerequisite and not an optimisation.
const SHERPA_CATEGORY_BY_VALUE: Record<string, VisaRequirementCategory> = {
  not_required: 'visaFree',
  visa_free: 'visaFree',
  visa_on_arrival: 'visaOnArrival',
  e_visa: 'eVisa',
  evisa: 'eVisa',
  eta: 'authorizationRequired',
  electronic_travel_authorization: 'authorizationRequired',
  required: 'embassyVisaRequired',
  visa_required: 'embassyVisaRequired',
  embassy: 'embassyVisaRequired',
};

const SHERPA_DEFAULT_BASE_URL = 'https://requirements-api.joinsherpa.io/v3';
const SHERPA_TIMEOUT_MS = 6000;

export function mapSherpaCategory(value: unknown): VisaRequirementCategory {
  if (typeof value !== 'string') return 'unknown';
  return SHERPA_CATEGORY_BY_VALUE[value.trim().toLowerCase().replace(/[\s-]+/g, '_')] ?? 'unknown';
}

/** Pulls the visa requirement out of a Sherpa trips payload. Written
 *  defensively on purpose: a provider response shape that has drifted must
 *  produce 'unknown', never an exception and never a confident wrong answer. */
export function extractSherpaRequirement(payload: unknown): { category: VisaRequirementCategory; details?: string } {
  const root = payload as { data?: { attributes?: { informationGroups?: unknown[] } } } | undefined;
  const groups = root?.data?.attributes?.informationGroups;
  if (!Array.isArray(groups)) return { category: 'unknown' };
  for (const group of groups) {
    const entry = group as { type?: unknown; status?: unknown; visaStatus?: unknown; summary?: unknown };
    if (entry?.type !== 'VISA_REQUIREMENTS') continue;
    const category = mapSherpaCategory(entry.visaStatus ?? entry.status);
    const details = typeof entry.summary === 'string' ? entry.summary : undefined;
    return { category, ...(details ? { details } : {}) };
  }
  return { category: 'unknown' };
}

export function createSherpaProvider(env: VisaEnv): VisaRequirementsProvider {
  return {
    name: 'sherpa',
    isConfigured: () => typeof env.SHERPA_API_KEY === 'string' && env.SHERPA_API_KEY.length > 0,
    async lookup(input) {
      if (!env.SHERPA_API_KEY) return unknownRequirement(input, 'sherpa', 'Provider credentials are not configured.');
      const base = env.SHERPA_BASE_URL ?? SHERPA_DEFAULT_BASE_URL;
      const url = `${base}/trips?citizenship=${encodeURIComponent(input.passportCode)}&destination=${encodeURIComponent(input.destinationCode)}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), SHERPA_TIMEOUT_MS);
      try {
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${env.SHERPA_API_KEY}`, Accept: 'application/json' },
          signal: controller.signal,
        });
        if (!response.ok) {
          return unknownRequirement(input, 'sherpa', 'The visa data provider could not answer this lookup.');
        }
        const payload = await response.json();
        const { category, details } = extractSherpaRequirement(payload);
        return {
          passportCode: input.passportCode,
          destinationCode: input.destinationCode,
          category,
          provider: 'sherpa',
          checkedAt: new Date().toISOString(),
          ...(details ? { details } : {}),
        };
      } catch {
        // Timeout, abort, network failure, malformed JSON — all of them mean
        // the same thing to a traveller: we do not know. Never a fallback
        // guess (see the module comment).
        return unknownRequirement(input, 'sherpa', 'The visa data provider is temporarily unavailable.');
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

/** Picks the first configured provider, else the honest 'unknown' one.
 *  Adding VisaHQ or Timatic later means adding an adapter to this list —
 *  no caller changes, no engine changes. */
export function resolveVisaProvider(env: VisaEnv): VisaRequirementsProvider {
  const candidates = [createSherpaProvider(env)];
  return candidates.find((provider) => provider.isConfigured()) ?? unavailableProvider;
}

export async function handleVisaRequest(
  request: Request,
  env: VisaEnv,
  json: (body: unknown, status: number) => Response,
): Promise<Response | null> {
  const url = new URL(request.url);
  // Acceptance item #5 — the passport step must be able to tell the
  // traveller, BEFORE they choose, whether live entry-requirement data is
  // actually active. It cannot learn that from a requirements lookup,
  // because it has no destination yet. This is that answer, and nothing
  // else: no credential, no provider configuration, no traveller data.
  if (url.pathname === '/api/visa/status') {
    if (request.method !== 'GET') {
      return json({ error: 'method_not_allowed', message: 'Use GET.' }, 405);
    }
    const configured = resolveVisaProvider(env);
    return json(
      { providerConfigured: configured.isConfigured(), provider: configured.isConfigured() ? configured.name : null },
      200,
    );
  }
  if (url.pathname !== '/api/visa/requirements') return null;
  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed', message: 'Use POST.' }, 405);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_request', message: 'Request body must be valid JSON.' }, 400);
  }
  const fields = validateVisaLookup(body);
  if (fields.length > 0) {
    return json({ error: 'invalid_request', message: 'Request failed validation.', fields }, 400);
  }
  const input = body as VisaLookupInput;
  const provider = resolveVisaProvider(env);
  const requirement = await provider.lookup(input);
  // A 200 with category 'unknown' is a real, useful answer — the client
  // renders "not available" from it. It is not an error state.
  return json({ requirement, providerConfigured: provider.isConfigured() }, 200);
}
