# Vibe security implementation and remaining iOS work

Scope: existing Arabic/English browser prototype. No Xcode project, iOS executable, production authentication backend, API origin, certificate ownership, or signing entitlement is present. This change does not implement an iOS security architecture or certify the product as secure.

## Implemented in this revision

- Strict Content Security Policy in the HTML before resource loading: no inline scripts, inline event attributes, eval, third-party scripts, remote media, objects, frames, workers, network API connections, form submissions, or base-URL changes. Only same-origin JavaScript/styles and local blob media are allowed. These restrictions fit the current offline prototype; a real auth/voice service will need a narrowly reviewed policy update.
- Replaced inline event code with externally defined closure callbacks. Callback tables are scoped to the app/dialog and cleared on rerender. Production state and callbacks are enclosed in a private function scope. This is code organization, not tamper-proof authorization.
- Removed external Google Fonts requests and used the existing system-font fallback.
- Retained output escaping and added validation/limits: 60-character room title, known room type/category, 2,000-character messages, 100 messages per conversation, 50 demo rooms, and a 100 MiB local media file limit. Recording checks accumulated chunks and stops at the limit; the final chunk may overshoot it.
- Microphone permission requests are invalidated on departure, hiding, or room-type changes. A late permission grant immediately stops its stream. Recordings/blob references are discarded on room exit or hiding; recording callbacks cannot recreate discarded media. Page departure clears prototype conversations, created rooms, and rendered app content. Explicit downloads remain under the user's control and cannot be erased by this site.
- Only language preference is saved in localStorage. No app passwords, auth tokens, real accounts, or session credentials exist. No new account or token storage was added.
- Added Cloudflare static `_headers` configuration for CSP (including restricted framing), no-referrer, nosniff, HSTS, no-store, and permissions restrictions. Header delivery depends on the hosting asset pipeline and has NOT been verified at the live endpoint. The HTML CSP is independently included in the artifact. HSTS configuration is not certificate pinning.

## Validation actually performed

`node --check dist/app.js` and `node tests/security.cjs` passed. The latter checks source restrictions, local asset references, both languages, rendered callback attributes, stale callback removal, output escaping, validation/limits, flash cleanup, game behavior, permission-arrival-after-leave handling, blob cleanup, and page lifecycle handling in a mocked DOM environment.

Not performed: browser CSP enforcement/host injection compatibility, response-header delivery, actual microphone capture, penetration testing, TLS interception testing, iPhone hardware testing, Xcode build, jailbreak/Frida testing, binary analysis, or an independent security audit. Passing these checks is not proof of invulnerability. JavaScript garbage collection does not provide reliable zeroization of all previous string/blob copies.

## Native iOS implementation requirements

1. Storage: put small credentials/keys in Keychain. Do not store raw passwords. Choose accessibility according to background needs; use WhenPasscodeSetThisDeviceOnly when foreground-only access and passcode policy are appropriate, or AfterFirstUnlockThisDeviceOnly only for a justified background need. Disable synchronization for device-bound credentials. Keychain is an encrypted database on the filesystem; the Secure Enclave protects key operations, not arbitrary app records residing inside it. ThisDeviceOnly generally prevents useful restoration to another device; it is not a blanket no-backup guarantee. Protect larger private files with iOS Data Protection and an explicit backup policy rather than storing all records in Keychain.
2. Network: keep ATS enabled without arbitrary HTTP exceptions. Use a fixed allowlist of owned API origins and normal platform trust evaluation. If pinning is required, configure actual SPKI identities for those APIs with a backup key and tested rotation/recovery plan. Never invent certificate fingerprints or pin third-party OAuth services blindly. Carry API bearer tokens in Authorization headers, never in URLs or logs; review OAuth redirect handling separately.
3. Integrity: combine supported platform attestation, server validation, and a risk policy with jailbreak/runtime signals. Client checks can be bypassed. Do not promise perfect jailbreak/Frida detection or add private APIs/fork probes without checking platform support and release rules. Prefer blocking sensitive operations with an explanatory lock screen and server session revocation over deliberately crashing the application. No crash/exit or native device checks were added to this website.
4. Memory: minimize credential lifetime/copies, avoid secret logs, and clear explicitly owned mutable buffers where meaningful. Do not claim setting a Swift/JavaScript variable to nil/empty overwrites every memory copy. Hardware/runtime testing is required.
5. Binary: native release signing, restricted entitlements, removal of debug artifacts, and tested obfuscation can raise reverse-engineering cost; they do not make the binary encrypted or impossible to inspect. No native binary exists in this repository and no binary obfuscation has been claimed.
6. Server: enforce account authorization, subscription entitlement, rate limits, token expiry/rotation/revocation and room access on the server. Prototype Plus/Ghost flags are not trusted security controls.

## Required inputs before native implementation/release

The actual iOS/Xcode source (or an explicit native app build scope), API/backend and auth design, owned domain and certificate rotation plan, signing/Apple Developer setup through appropriate secure channels, and target-device security tests. Do not send private keys, passwords, or production secrets in chat.

## Official references

- Apple Keychain data protection: https://support.apple.com/guide/security/keychain-data-protection-secb0694df1a/web
- Apple identity pinning and rotation guidance: https://developer.apple.com/news/?id=g9ejcf8y
- OWASP mobile resilience controls: https://mas.owasp.org/MASVS/controls/MASVS-RESILIENCE-1/
- Cloudflare static asset headers: https://developers.cloudflare.com/workers/static-assets/headers/

## Subsequent support/media update

Source assets moved to `public/`; a dependency-free Worker now embeds and serves them with actual response-header code. CSP intentionally allows same-origin `/api/support` requests and blob images. The OpenAI adapter is disabled by default and requires a secret, explicit model, and an allowlist of trusted dispatcher identities. Tests mock the upstream provider; a live integration is not verified. Local photo sharing re-encodes accepted raster files, rejects SVG and oversized inputs, and voice notes require permission and a preview before sending. Media sharing is a session-only demo with no uploads. Terms consent is enforced in the prototype flow but must still be enforced and versioned server-side for real account creation. See `server/SETUP.md` for pilot limitations, especially the non-distributed rate limiter.
