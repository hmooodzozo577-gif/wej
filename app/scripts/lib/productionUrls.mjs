// The production URLs the ops scripts (smoke, SEO, uptime) check by
// default — the one place to change them when a custom domain goes live.
// A command-line argument still overrides each script's default.
//
// The app itself does not read this file: its origin and base path come
// from build/site.ts (VITE_SITE_ORIGIN / VITE_BASE_PATH), and the Worker
// keeps its own CORS allow-list (worker/src/shared.ts). See
// docs/SITE_ORIGIN.md for the full switch-over list.
export const PRODUCTION_SITE_URL = 'https://hmooodzozo577-gif.github.io/wej/';
export const PRODUCTION_SITE_ORIGIN = new URL(PRODUCTION_SITE_URL).origin;
export const PRODUCTION_WORKER_URL = 'https://wejhaty-travel-worker.hmooodzozo577.workers.dev';
export const PRODUCTION_WORKER_HOST = new URL(PRODUCTION_WORKER_URL).host;
