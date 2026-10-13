import { defineConfig, devices } from '@playwright/test'

/**
 * Smoke tests run against the dev server with placeholder Supabase settings when none are
 * configured (they never reach the network). Full-flow tests in flows.spec.ts need a real,
 * NON-production Supabase project in .env.local plus E2E_EMAIL / E2E_PASSWORD, and skip otherwise.
 */
const PORT = 5174
const hasSupabase = Boolean(process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_PUBLISHABLE_KEY)

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /smoke/ },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: false,
    env: hasSupabase
      ? {}
      : { VITE_SUPABASE_URL: 'http://127.0.0.1:9', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_placeholder' },
  },
})
