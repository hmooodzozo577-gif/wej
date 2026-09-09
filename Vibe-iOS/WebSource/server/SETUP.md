# OpenAI support activation

The Worker serves the existing Vibe interface and implements `/api/support/status` and `/api/support`. No OpenAI credential is configured. The default is disabled; the UI must not claim a live ChatGPT connection. This is an OpenAI API integration, not access to the owner's personal ChatGPT conversations/subscription.

Configure through Sites runtime environment settings, never in client source, Git, or chat:

- `OPENAI_API_KEY`: secret for the intended OpenAI API project with appropriate billing.
- `OPENAI_MODEL`: a Responses-compatible model available to that project; no model is guessed or silently chosen.
- `SUPPORT_ALLOWED_USER_IDS`: comma-separated per-Site user identities from trusted Sites dispatcher authentication. These are not email addresses or workspace account IDs. The prototype login fields do not authenticate anyone. Keep the pilot limited to explicitly configured identities.
- `SUPPORT_ENABLED=true`: only after the previous configuration and review are complete.

Redeploy a saved version to apply runtime environment changes. Use a low project budget and configure limits in the OpenAI project. The per-isolate 5 requests/minute limiter is a best-effort pilot measure, not a global distributed quota. Replace it with durable global/user quotas before opening to a public user population. Actual app accounts and Plus entitlements still need a backend; do not trust client flags for production subscription access.

Only consented support text is sent. Images and voice notes are local, never sent to this endpoint. Provider responses are rendered as escaped text. The assistant has no tools and no authority to change accounts/payments or resolve moderation cases. Requests have bounded input, bounded output, a timeout, same-origin POST checks, and trusted identity checks. API credentials and raw provider errors are not returned to clients. `store:false` is requested; this does not itself guarantee zero retention by the provider.

Tests in `tests/support.mjs` mock OpenAI. No live model response or deployed endpoint has been tested. Actual microphone/photo browser flows also require target-device testing.

Official references:
- https://developers.openai.com/api/docs/guides/text
- https://developers.openai.com/api/reference/overview
