/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { contentSecurityPolicy } from './build/contentSecurityPolicy.ts'

// https://vite.dev/config/
export default defineConfig({
  base: '/wej/',
  plugins: [react(), contentSecurityPolicy()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
  },
})
