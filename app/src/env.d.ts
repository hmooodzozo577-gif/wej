/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Injected by vite.config.ts from build/site.ts. */
  readonly VITE_SITE_ORIGIN: string;
  /** Injected by vite.config.ts from app/package.json. */
  readonly VITE_APP_VERSION: string;
}
