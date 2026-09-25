/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { contentSecurityPolicy } from './build/contentSecurityPolicy.ts'
import { seoPages } from './build/seoPages.ts'
import { resolveSite } from './build/site.ts'

// v1.1 — one site origin/base path (build/site.ts) and one release version
// (package.json) for the whole build.
const site = resolveSite(process.env)
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

// https://vite.dev/config/
export default defineConfig({
  base: site.basePath,
  define: {
    'import.meta.env.VITE_SITE_ORIGIN': JSON.stringify(site.origin),
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(version),
  },
  plugins: [react(), contentSecurityPolicy(), seoPages(site)],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
  },
})
