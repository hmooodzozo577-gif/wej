# Sherpa response fixtures

Drop a **real** sandbox response here and the contract test
(`worker/src/visa.contract.test.ts`) starts checking the adapter's mapping
against it automatically. Until then, that test asserts only that the adapter
stays honest with no provider at all — because the mapping itself is
UNVERIFIED and must not be claimed otherwise.

## How to add one

1. Get sandbox credentials (see `/VISA_PROVIDERS.md`).
2. Make one real lookup per requirement category you can reproduce.
3. Save each response as `<category>.json` in this directory, where
   `<category>` is the Wejhaty category it is expected to map to — one of:
   `visaFree`, `visaOnArrival`, `eVisa`, `authorizationRequired`,
   `embassyVisaRequired`, `unknown`.
4. Run `npm test` in `worker/`. A mapping that does not produce the expected
   category fails the build.

## Before you commit one

- **Remove every credential.** A response body should not contain one, but
  check the whole file, including any echoed request.
- **Remove anything about a real person.** Use a synthetic traveller.
- A fixture is third-party content: check the provider's terms permit storing
  a sample in a private repository before adding it.
